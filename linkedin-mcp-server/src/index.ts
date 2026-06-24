#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { LinkedInClient } from "./client.js";

const tools: Tool[] = [
  // ── People & Profile ──────────────────────────────────────────────────────
  {
    name: "linkedin_get_my_profile",
    description: "Get your own LinkedIn profile information (name, headline, location, etc.)",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "linkedin_get_profile",
    description: "Get any LinkedIn member's profile by their profile URL or username",
    inputSchema: {
      type: "object",
      properties: {
        profile_url: {
          type: "string",
          description: "LinkedIn profile URL (e.g. https://linkedin.com/in/username) or just the username",
        },
      },
      required: ["profile_url"],
    },
  },
  {
    name: "linkedin_search_people",
    description: "Search for people on LinkedIn by keywords, with optional filters for company, title, or location",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keywords (name, skills, etc.)" },
        company: { type: "string", description: "Filter by current company name" },
        title: { type: "string", description: "Filter by job title" },
        location: { type: "string", description: "Filter by location" },
        count: { type: "number", description: "Number of results (default: 10, max: 25)", default: 10 },
      },
      required: ["query"],
    },
  },
  // ── Companies & Leads ─────────────────────────────────────────────────────
  {
    name: "linkedin_get_company",
    description: "Get information about a LinkedIn company page (description, size, industry, website, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description: "Company LinkedIn URL (e.g. https://linkedin.com/company/acme) or company slug/name",
        },
      },
      required: ["company"],
    },
  },
  {
    name: "linkedin_find_decision_makers",
    description: "Find decision makers (VPs, Directors, Heads, C-suite) at a specific company",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Company name to search" },
        titles: {
          type: "array",
          items: { type: "string" },
          description: "Job titles to search for (default: VP, Director, Head, Manager, Chief)",
        },
      },
      required: ["company"],
    },
  },
  {
    name: "linkedin_search_jobs",
    description: "Search for job postings on LinkedIn — useful as a buying signal (companies hiring = companies spending)",
    inputSchema: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "Job title or keywords to search" },
        location: { type: "string", description: "Location or location ID" },
        count: { type: "number", description: "Number of results (default: 10)", default: 10 },
      },
      required: ["keywords"],
    },
  },
  // ── Messaging ─────────────────────────────────────────────────────────────
  {
    name: "linkedin_get_inbox",
    description: "Get your LinkedIn message inbox — lists conversations with participants and last message preview",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Number of conversations to return (default: 20)", default: 20 },
      },
      required: [],
    },
  },
  {
    name: "linkedin_get_conversation",
    description: "Get the full message thread of a specific LinkedIn conversation",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: {
          type: "string",
          description: "Conversation ID or URN (from linkedin_get_inbox)",
        },
        count: { type: "number", description: "Number of messages to return (default: 20)", default: 20 },
      },
      required: ["conversation_id"],
    },
  },
  {
    name: "linkedin_send_message",
    description: "Send a message in an existing LinkedIn conversation — requires your approval before sending",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: {
          type: "string",
          description: "Conversation ID or URN (from linkedin_get_inbox)",
        },
        message: { type: "string", description: "Text of the message to send" },
      },
      required: ["conversation_id", "message"],
    },
  },
  {
    name: "linkedin_send_connection_request",
    description: "Send a LinkedIn connection request to a member, optionally with a personalized note",
    inputSchema: {
      type: "object",
      properties: {
        profile_url: {
          type: "string",
          description: "LinkedIn profile URL of the person to connect with",
        },
        note: {
          type: "string",
          description: "Optional personalized message (max 300 characters)",
        },
      },
      required: ["profile_url"],
    },
  },
  // ── Content ───────────────────────────────────────────────────────────────
  {
    name: "linkedin_get_posts",
    description: "Get the most recent posts from a LinkedIn member's profile",
    inputSchema: {
      type: "object",
      properties: {
        profile_url: {
          type: "string",
          description: "LinkedIn profile URL or username",
        },
        count: { type: "number", description: "Number of posts to return (default: 5)", default: 5 },
      },
      required: ["profile_url"],
    },
  },
  {
    name: "linkedin_create_post",
    description: "Create and publish a post on your LinkedIn feed — requires your approval before posting",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The content of the post" },
        visibility: {
          type: "string",
          enum: ["PUBLIC", "CONNECTIONS"],
          description: "Who can see the post: PUBLIC (everyone) or CONNECTIONS (your connections only)",
          default: "PUBLIC",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "linkedin_get_notifications",
    description: "Get your recent LinkedIn notifications (connection requests, profile views, mentions)",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Number of notifications to return (default: 15)", default: 15 },
      },
      required: [],
    },
  },
];

async function main() {
  const client = new LinkedInClient();

  const server = new Server(
    { name: "linkedin-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      await client.connect();

      let result: unknown;

      switch (name) {
        // ── People & Profile ─────────────────────────────────────────────
        case "linkedin_get_my_profile":
          result = await client.getMyProfile();
          break;

        case "linkedin_get_profile": {
          const { profile_url } = args as { profile_url: string };
          result = await client.getProfile(profile_url);
          break;
        }

        case "linkedin_search_people": {
          const { query, company, title, location, count = 10 } = args as {
            query: string;
            company?: string;
            title?: string;
            location?: string;
            count?: number;
          };
          result = await client.searchPeople(query, { company, title, location }, count);
          break;
        }

        // ── Companies & Leads ────────────────────────────────────────────
        case "linkedin_get_company": {
          const { company } = args as { company: string };
          result = await client.getCompany(company);
          break;
        }

        case "linkedin_find_decision_makers": {
          const { company, titles } = args as { company: string; titles?: string[] };
          result = await client.findDecisionMakers(company, titles);
          break;
        }

        case "linkedin_search_jobs": {
          const { keywords, location, count = 10 } = args as {
            keywords: string;
            location?: string;
            count?: number;
          };
          result = await client.searchJobs(keywords, location, count);
          break;
        }

        // ── Messaging ────────────────────────────────────────────────────
        case "linkedin_get_inbox": {
          const { count = 20 } = args as { count?: number };
          result = await client.getInbox(count);
          break;
        }

        case "linkedin_get_conversation": {
          const { conversation_id, count = 20 } = args as {
            conversation_id: string;
            count?: number;
          };
          result = await client.getConversation(conversation_id, count);
          break;
        }

        case "linkedin_send_message": {
          const { conversation_id, message } = args as {
            conversation_id: string;
            message: string;
          };
          await client.sendMessage(conversation_id, message);
          result = { success: true, message: "Message sent successfully" };
          break;
        }

        case "linkedin_send_connection_request": {
          const { profile_url, note } = args as { profile_url: string; note?: string };
          await client.sendConnectionRequest(profile_url, note);
          result = { success: true, message: "Connection request sent" };
          break;
        }

        // ── Content ──────────────────────────────────────────────────────
        case "linkedin_get_posts": {
          const { profile_url, count = 5 } = args as {
            profile_url: string;
            count?: number;
          };
          result = await client.getPosts(profile_url, count);
          break;
        }

        case "linkedin_create_post": {
          const { text, visibility = "PUBLIC" } = args as {
            text: string;
            visibility?: "PUBLIC" | "CONNECTIONS";
          };
          const postId = await client.createPost(text, visibility);
          result = { success: true, postId, message: "Post published successfully" };
          break;
        }

        case "linkedin_get_notifications": {
          const { count = 15 } = args as { count?: number };
          result = await client.getNotifications(count);
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LinkedIn MCP Server running — 13 tools, your browser, your session");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
