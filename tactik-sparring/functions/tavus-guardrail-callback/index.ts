/**
 * Supabase Edge Function: tavus-guardrail-callback
 *
 * Fires the instant the trainee pushes one of the counterparty's red lines.
 * This is the mechanism that gives TACTIK in-turn ledger persistence without
 * owning the conversation loop: Tavus runs the fast path, and the guardrail
 * webhook lands a turn-indexed, quote-backed row in `sparring_ledger` while the
 * call is still in progress.
 *
 * The same pattern handles objective callbacks (structured phase state) — the
 * only difference is which arbiter method the payload is routed to.
 */

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const secret = Deno.env.get('TAVUS_WEBHOOK_SECRET');

  // Reject unsigned callbacks: this endpoint writes to the scored ledger, so an
  // open webhook would let anyone forge a red-line contact.
  if (secret && req.headers.get('x-tavus-signature') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const payload = (await req.json()) as {
    conversation_id?: string;
    guardrail_name?: string;
    timestamp?: string;
    turn_idx?: number;
    seq?: number;
    properties?: { triggering_speech?: string };
  };

  if (!payload.conversation_id || !payload.guardrail_name) {
    return new Response('bad_request', { status: 400 });
  }

  const db = (path: string, init: RequestInit) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  const sres = await db(
    `sparring_sessions?tavus_conversation_id=eq.${encodeURIComponent(payload.conversation_id)}&select=id,compilation_hash`,
    { method: 'GET' },
  );
  const sessions = (await sres.json()) as { id: string; compilation_hash: string }[];
  if (!sessions.length) return new Response('unknown_conversation', { status: 404 });
  const session = sessions[0];

  // Integrity guardrail trips are a different signal: the trainee tried to
  // break the simulation rather than push a commercial limit. Recorded, but
  // never scored as a negotiation move.
  const isIntegrity = payload.guardrail_name.includes('character_integrity');

  await db('sparring_ledger', {
    method: 'POST',
    // Tavus may redeliver; the dedupe index makes the insert idempotent.
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({
      session_id: session.id,
      turn_idx: payload.turn_idx ?? 0,
      seq: payload.seq ?? 0,
      event_time: payload.timestamp ?? new Date().toISOString(),
      kind: isIntegrity ? 'steering' : 'red_line_contact',
      actor: isIntegrity ? 'tactik' : 'human',
      quote: payload.properties?.triggering_speech ?? null,
      compilation_hash: session.compilation_hash,
      meta: { guardrail: payload.guardrail_name, integrity_trip: isIntegrity },
    }),
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
