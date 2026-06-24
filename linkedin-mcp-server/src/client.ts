import { Browser, BrowserContext, Page, chromium } from "playwright";

const VOYAGER = "https://www.linkedin.com/voyager/api";

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  summary: string;
  publicProfileUrl: string;
  connectionDegree?: string;
  followersCount?: number;
}

export interface LinkedInMessage {
  id: string;
  sender: string;
  text: string;
  sentAt: string;
  isRead: boolean;
}

export interface LinkedInConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastActivityAt: string;
  unread: boolean;
}

export interface LinkedInJob {
  id: string;
  title: string;
  company: string;
  location: string;
  postedAt: string;
  jobUrl: string;
  description?: string;
}

export class LinkedInClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private csrfToken: string | null = null;

  async connect(): Promise<void> {
    const debugPort = process.env.CHROME_DEBUG_PORT || "9222";

    try {
      this.browser = await chromium.connectOverCDP(`http://localhost:${debugPort}`);
      const contexts = this.browser.contexts();
      this.context = contexts[0] ?? await this.browser.newContext();
      const pages = this.context.pages();
      this.page = pages.find(p => p.url().includes("linkedin.com")) ?? pages[0] ?? await this.context.newPage();
    } catch {
      const userDataDir = process.env.CHROME_USER_DATA_DIR ?? "";
      if (userDataDir) {
        this.context = await chromium.launchPersistentContext(userDataDir, {
          headless: false,
          channel: "chrome",
        });
      } else {
        this.browser = await chromium.launch({ headless: false });
        this.context = await this.browser.newContext();
      }
      this.page = await this.context.newPage();
    }

    if (!this.page.url().includes("linkedin.com")) {
      await this.page.goto("https://www.linkedin.com/feed/");
      await this.page.waitForLoadState("networkidle");
    }

    await this.ensureLoggedIn();
    await this.extractCsrfToken();
  }

  private async ensureLoggedIn(): Promise<void> {
    const url = this.page!.url();
    if (url.includes("/login") || url.includes("/checkpoint") || url.includes("authwall")) {
      throw new Error(
        "Not logged into LinkedIn. Open Chrome, navigate to linkedin.com, log in, " +
        "then restart the MCP server with CHROME_DEBUG_PORT=9222."
      );
    }
  }

  private async extractCsrfToken(): Promise<void> {
    const cookies = await this.context!.cookies("https://www.linkedin.com");
    const jsessionCookie = cookies.find(c => c.name === "JSESSIONID");
    if (jsessionCookie) {
      this.csrfToken = jsessionCookie.value.replace(/"/g, "");
    }
  }

  private async voyagerGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${VOYAGER}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await this.page!.request.get(url.toString(), {
      headers: {
        "csrf-token": this.csrfToken ?? "",
        "x-restli-protocol-version": "2.0.0",
        accept: "application/vnd.linkedin.normalized+json+2.1",
      },
    });

    if (!response.ok()) {
      throw new Error(`LinkedIn API error ${response.status()}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  private async voyagerPost<T>(path: string, body: unknown): Promise<T> {
    const response = await this.page!.request.post(`${VOYAGER}${path}`, {
      headers: {
        "csrf-token": this.csrfToken ?? "",
        "x-restli-protocol-version": "2.0.0",
        "content-type": "application/json",
        accept: "application/vnd.linkedin.normalized+json+2.1",
      },
      data: JSON.stringify(body),
    });

    if (!response.ok()) {
      throw new Error(`LinkedIn API error ${response.status()}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  // ── People & Profile ─────────────────────────────────────────────────────

  async getMyProfile(): Promise<LinkedInProfile> {
    const data = await this.voyagerGet<any>("/me");
    return this.normalizeProfile(data);
  }

  async getProfile(profileUrl: string): Promise<LinkedInProfile> {
    const vanityName = this.extractVanityName(profileUrl);
    const data = await this.voyagerGet<any>(`/identity/profiles/${vanityName}/profileView`);
    return this.normalizeProfileView(data);
  }

  async searchPeople(query: string, filters?: { company?: string; title?: string; location?: string }, count = 10): Promise<LinkedInProfile[]> {
    const params: Record<string, string> = {
      q: "people",
      keywords: query,
      count: String(count),
      origin: "GLOBAL_SEARCH_HEADER",
    };

    if (filters?.company) params["facetCurrentCompany"] = filters.company;
    if (filters?.title) params["facetTitle"] = filters.title;
    if (filters?.location) params["facetGeoRegion"] = filters.location;

    const data = await this.voyagerGet<any>("/search/blended", params);
    const elements = data?.data?.elements ?? [];
    return elements
      .filter((e: any) => e.type === "MEMBER")
      .map((e: any) => this.normalizeSearchResult(e));
  }

  // ── Companies & Leads ─────────────────────────────────────────────────────

  async getCompany(companyIdentifier: string): Promise<any> {
    const universalName = companyIdentifier.replace(/.*\/company\/([^/]+).*/,'$1');
    const data = await this.voyagerGet<any>(`/organization/companies`, {
      q: "universalName",
      universalName,
      decorationId: "com.linkedin.voyager.deco.organization.web.WebFullCompanyMain-12",
    });
    return data?.elements?.[0] ?? data;
  }

  async findDecisionMakers(company: string, titles: string[] = ["VP", "Director", "Head", "Manager", "Chief", "C-Level"]): Promise<LinkedInProfile[]> {
    const results: LinkedInProfile[] = [];
    for (const title of titles) {
      const people = await this.searchPeople(`${title} at ${company}`, { company }, 5);
      results.push(...people);
    }
    return results.slice(0, 15);
  }

  async searchJobs(keywords: string, location?: string, count = 10): Promise<LinkedInJob[]> {
    const params: Record<string, string> = {
      q: "jobSearch",
      keywords,
      count: String(count),
    };
    if (location) params.locationId = location;

    const data = await this.voyagerGet<any>("/jobs/jobPostings", params);
    return (data?.elements ?? []).map((j: any) => ({
      id: j.entityUrn ?? j.id,
      title: j.title ?? "",
      company: j.companyDetails?.company?.name ?? j.formattedLocation ?? "",
      location: j.formattedLocation ?? "",
      postedAt: j.listedAt ? new Date(j.listedAt).toISOString() : "",
      jobUrl: `https://www.linkedin.com/jobs/view/${j.jobPostingId ?? ""}`,
      description: j.description?.text?.slice(0, 300),
    }));
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  async getInbox(count = 20): Promise<LinkedInConversation[]> {
    const data = await this.voyagerGet<any>("/messaging/conversations", {
      keyVersion: "LEGACY_INBOX",
      q: "autofillSuggestions",
      count: String(count),
    });

    return (data?.elements ?? []).map((c: any) => ({
      id: c.entityUrn ?? c.id,
      participants: (c.participants ?? []).map((p: any) => {
        const member = p["com.linkedin.voyager.messaging.MessagingMember"];
        return member?.miniProfile ? `${member.miniProfile.firstName} ${member.miniProfile.lastName}` : "Unknown";
      }),
      lastMessage: c.events?.[0]?.eventContent?.["com.linkedin.voyager.messaging.event.MessageEvent"]?.attributedBody?.text ?? "",
      lastActivityAt: c.lastActivityAt ? new Date(c.lastActivityAt).toISOString() : "",
      unread: c.unreadCount > 0,
    }));
  }

  async getConversation(conversationId: string, count = 20): Promise<LinkedInMessage[]> {
    const cleanId = conversationId.replace("urn:li:fs_conversation:", "");
    const data = await this.voyagerGet<any>(`/messaging/conversations/${encodeURIComponent(cleanId)}/events`, {
      count: String(count),
    });

    return (data?.elements ?? []).reverse().map((e: any) => {
      const msg = e.eventContent?.["com.linkedin.voyager.messaging.event.MessageEvent"];
      return {
        id: e.entityUrn ?? e.id,
        sender: e.from?.["com.linkedin.voyager.messaging.MessagingMember"]?.miniProfile
          ? `${e.from["com.linkedin.voyager.messaging.MessagingMember"].miniProfile.firstName} ${e.from["com.linkedin.voyager.messaging.MessagingMember"].miniProfile.lastName}`
          : "Unknown",
        text: msg?.attributedBody?.text ?? "",
        sentAt: e.createdAt ? new Date(e.createdAt).toISOString() : "",
        isRead: e.subtype !== "UNREAD",
      };
    });
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    const cleanId = conversationId.replace("urn:li:fs_conversation:", "");
    await this.voyagerPost(`/messaging/conversations/${encodeURIComponent(cleanId)}/events`, {
      eventCreate: {
        value: {
          "com.linkedin.voyager.messaging.create.MessageCreate": {
            attributedBody: { text, attributes: [] },
            attachments: [],
          },
        },
      },
    });
  }

  async sendConnectionRequest(profileUrl: string, message?: string): Promise<void> {
    const vanityName = this.extractVanityName(profileUrl);
    const profileData = await this.voyagerGet<any>(`/identity/profiles/${vanityName}`);
    const profileId = profileData?.entityUrn?.split(":").pop();

    if (!profileId) throw new Error(`Could not find profile ID for ${profileUrl}`);

    const body: any = {
      trackingId: this.generateTrackingId(),
      invitations: [],
      excludeInvitations: [],
      invitee: {
        "com.linkedin.voyager.growth.invitation.InviteeProfile": {
          profileId,
        },
      },
    };

    if (message) {
      body.customMessage = message;
    }

    await this.voyagerPost("/growth/normInvitations", body);
  }

  // ── Content ───────────────────────────────────────────────────────────────

  async getPosts(profileUrl: string, count = 5): Promise<any[]> {
    const vanityName = this.extractVanityName(profileUrl);
    const data = await this.voyagerGet<any>(`/identity/profiles/${vanityName}/posts`, {
      count: String(count),
      q: "memberShareFeed",
      moduleKey: "member-shares:phone-task",
    });
    return (data?.elements ?? []).map((p: any) => ({
      id: p.entityUrn,
      text: p.value?.["com.linkedin.voyager.feed.render.UpdateV2"]?.commentary?.text?.text ?? "",
      postedAt: p.value?.["com.linkedin.voyager.feed.render.UpdateV2"]?.actor?.subDescription?.text ?? "",
      likes: p.value?.["com.linkedin.voyager.feed.render.UpdateV2"]?.socialDetail?.totalSocialActivityCounts?.numLikes ?? 0,
      comments: p.value?.["com.linkedin.voyager.feed.render.UpdateV2"]?.socialDetail?.totalSocialActivityCounts?.numComments ?? 0,
    }));
  }

  async createPost(text: string, visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC"): Promise<string> {
    const me = await this.getMyProfile();
    const data = await this.voyagerPost<any>("/ugcPosts", {
      author: `urn:li:person:${me.id}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility,
      },
    });
    return data?.id ?? data?.headers?.["x-restli-id"] ?? "Post created";
  }

  async getNotifications(count = 15): Promise<any[]> {
    const data = await this.voyagerGet<any>("/notifications/invitations", {
      count: String(count),
    });
    return data?.elements ?? [];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private extractVanityName(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
    if (match) return match[1];
    if (!url.includes("/")) return url;
    throw new Error(`Invalid LinkedIn profile URL: ${url}`);
  }

  private normalizeProfile(data: any): LinkedInProfile {
    return {
      id: data?.id ?? data?.entityUrn?.split(":").pop() ?? "",
      firstName: data?.firstName?.localized?.en_US ?? data?.localizedFirstName ?? "",
      lastName: data?.lastName?.localized?.en_US ?? data?.localizedLastName ?? "",
      headline: data?.headline?.localized?.en_US ?? data?.localizedHeadline ?? "",
      location: data?.geoCountryName ?? "",
      summary: "",
      publicProfileUrl: `https://www.linkedin.com/in/${data?.vanityName ?? ""}`,
    };
  }

  private normalizeProfileView(data: any): LinkedInProfile {
    const profile = data?.profile ?? data?.data?.elements?.[0] ?? data;
    return {
      id: profile?.entityUrn?.split(":").pop() ?? "",
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      headline: profile?.headline ?? "",
      location: profile?.locationName ?? "",
      summary: profile?.summary ?? "",
      publicProfileUrl: `https://www.linkedin.com/in/${profile?.miniProfile?.publicIdentifier ?? ""}`,
      connectionDegree: profile?.distance?.value ?? "",
      followersCount: profile?.followingInfo?.followerCount ?? 0,
    };
  }

  private normalizeSearchResult(element: any): LinkedInProfile {
    const profile = element.image?.attributes?.[0]?.miniProfile ?? element;
    return {
      id: profile?.entityUrn?.split(":").pop() ?? "",
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      headline: profile?.occupation ?? element.subline?.text ?? "",
      location: element.secondarySubline?.text ?? "",
      summary: "",
      publicProfileUrl: `https://www.linkedin.com/in/${profile?.publicIdentifier ?? ""}`,
    };
  }

  private generateTrackingId(): string {
    return Math.random().toString(36).substring(2, 18).toUpperCase();
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}
