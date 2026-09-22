/**
 * Supabase Edge Function: tavus-session-broker
 *
 * The only path by which a sparring session may start. It exists to close the
 * two P0 findings in the v5 execution freeze:
 *
 *   1. No Tavus API key in the frontend. VITE_TAVUS_API_KEY is removed; the
 *      client receives only an ephemeral room URL and a conversation id.
 *   2. Deterministic teardown. Every conversation is created with a hard
 *      duration cap and absence timeouts, so a browser that dies mid-call
 *      cannot leave a GPU stream billing against the account.
 *
 * Human-vs-AI makes both of these urgent rather than hygienic: unlike an
 * AI-vs-AI debate, a human session bills think-time, and a trainee who walks
 * away from their laptop is an open cost line.
 *
 * Deploy: supabase functions deploy tavus-session-broker --no-verify-jwt=false
 */

const TAVUS_API = 'https://tavusapi.com/v2';

interface StartRequest {
  personaId: string;
  compilationHash: string;
  scenario: string;
  humanMandate: unknown;
  mode: 'text_rehearsal' | 'live_video';
  /** Session-scoped private context (TACTIK Layer 8). Never stored on the PAL. */
  privateContext?: string;
  maxDurationSec?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('TAVUS_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !supabaseUrl || !serviceKey) return json({ error: 'not_configured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const body = (await req.json()) as StartRequest;

  // Identify the caller from their own JWT; never trust a user id in the body.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: serviceKey },
  });
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401);
  const user = (await userRes.json()) as { id: string };

  const db = (path: string, init: RequestInit) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(init.headers ?? {}),
      },
    });

  // A trainee may not start a second live session while one is still running:
  // concurrent GPU streams are the fastest way to burn the margin.
  if (body.mode === 'live_video') {
    const liveRes = await db(
      `sparring_sessions?user_id=eq.${user.id}&status=eq.live&mode=eq.live_video&select=id`,
      { method: 'GET' },
    );
    const live = (await liveRes.json()) as unknown[];
    if (Array.isArray(live) && live.length > 0) {
      return json({ error: 'session_already_live', sessionId: (live[0] as { id: string }).id }, 409);
    }
  }

  // Resolve the compiled build. The arbiter genome is read server-side only.
  const buildRes = await db(
    `sparring_persona_builds?compilation_hash=eq.${encodeURIComponent(body.compilationHash)}&select=*`,
    { method: 'GET' },
  );
  const builds = (await buildRes.json()) as {
    tavus_pal_id: string | null;
    face_id: string;
    likeness_cleared: boolean;
  }[];
  if (!builds.length) return json({ error: 'build_not_found' }, 404);
  const build = builds[0];
  if (!build.tavus_pal_id) return json({ error: 'build_not_deployed' }, 409);

  const maxDuration = clamp(body.maxDurationSec ?? 900, 60, 1800);

  const sessionRes = await db('sparring_sessions', {
    method: 'POST',
    body: JSON.stringify({
      user_id: user.id,
      persona_id: body.personaId,
      compilation_hash: body.compilationHash,
      mode: body.mode,
      status: body.mode === 'live_video' ? 'pending' : 'live',
      scenario: body.scenario,
      human_mandate: body.humanMandate,
      max_duration_sec: maxDuration,
      started_at: new Date().toISOString(),
    }),
  });
  const session = ((await sessionRes.json()) as { id: string }[])[0];

  // Text rehearsal costs nothing and needs no room. This is the default path:
  // the Turbo gate from the v5 freeze applied to human sessions.
  if (body.mode === 'text_rehearsal') {
    return json({ sessionId: session.id, mode: 'text_rehearsal' });
  }

  const conversationRes = await fetch(`${TAVUS_API}/conversations`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      persona_id: build.tavus_pal_id,
      conversation_name: `tactik_spar_${session.id}`,
      // Layer 8 private context is injected here, per conversation, so it is
      // never persisted on a reusable PAL.
      conversational_context: [body.scenario, body.privateContext ?? ''].filter(Boolean).join('\n\n'),
      callback_url: `${supabaseUrl}/functions/v1/tavus-conversation-callback`,
      properties: {
        max_call_duration: maxDuration,
        // Teardown on abandonment. Both are cost controls, not UX niceties.
        participant_left_timeout: 30,
        participant_absent_timeout: 60,
        enable_recording: true,
        enable_closed_captions: true,
      },
    }),
  });

  if (!conversationRes.ok) {
    const detail = await conversationRes.text();
    await db(`sparring_sessions?id=eq.${session.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'aborted' }),
    });
    return json({ error: 'tavus_create_failed', detail }, 502);
  }

  const conv = (await conversationRes.json()) as {
    conversation_id: string;
    conversation_url: string;
  };

  await db(`sparring_sessions?id=eq.${session.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'live',
      tavus_conversation_id: conv.conversation_id,
      daily_room_url: conv.conversation_url,
    }),
  });

  // The client gets a room URL and nothing else. No API key crosses this line.
  return json({
    sessionId: session.id,
    mode: 'live_video',
    roomUrl: conv.conversation_url,
    conversationId: conv.conversation_id,
    maxDurationSec: maxDuration,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
