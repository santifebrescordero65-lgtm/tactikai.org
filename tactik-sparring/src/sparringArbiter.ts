/**
 * TACTIK Sparring Arbiter — the sovereign truth loop.
 *
 * The v5 freeze mandated "Soberanía del Scheduler TACTIK". In AI-vs-AI that
 * meant TACTIK generates every turn. In human-vs-AI that is impossible: a human
 * interrupts in real time and routing each turn through Supabase inference adds
 * 1.5–3s, at which point the counterparty stops feeling like a person and the
 * whole training premise dies.
 *
 * So sovereignty moves up a level. TACTIK does not own turn GENERATION; it owns
 * turn ADJUDICATION. Tavus runs the fast loop (~600ms). TACTIK runs the truth
 * loop: it observes every utterance, extracts quantified offers, writes the
 * ledger in-turn, and steers the PAL by injecting context rather than by
 * speaking for it.
 *
 *   Tavus decides what the counterparty SAYS.
 *   TACTIK decides what it BELIEVES, what it will NOT do, and what it MEANT.
 *
 * Three inbound channels:
 *   1. conversation.utterance      (app-message, realtime)  → offer extraction
 *   2. guardrail callback          (webhook)                → red-line contact
 *   3. objective callback          (webhook)                → structured phase state
 *
 * One outbound channel:
 *   conversation.append-context / overwrite-context → diegetic steering.
 *
 * Steering is always in-world. TACTIK never sends "be tougher". It sends
 * "your principal has just messaged you: the board will not approve below the
 * current floor." The PAL hardens because its situation changed, not because it
 * was told to act. That is what keeps the performance coherent.
 */

import type {
  ArbiterGenome,
  ConcessionPolicy,
  LedgerEvent,
  LedgerEventKind,
  RedLine,
  SparringSession,
} from './types';
import { extractOffers } from './offerExtractor';

export { extractOffers } from './offerExtractor';
export type { ExtractedOffer, TrackedVariable } from './offerExtractor';

// ---------------------------------------------------------------------------
// Inbound event shapes (Tavus)
// ---------------------------------------------------------------------------

export interface TavusUtteranceEvent {
  message_type: 'conversation';
  event_type: 'conversation.utterance';
  conversation_id: string;
  timestamp: string;
  seq: number;
  turn_idx?: number;
  inference_id?: string;
  properties: { role: 'user' | 'replica' | 'pal'; speech: string };
}

export interface TavusGuardrailEvent {
  conversation_id: string;
  guardrail_name: string;
  timestamp: string;
  turn_idx?: number;
  seq?: number;
  properties?: { triggering_speech?: string; guardrail_prompt?: string };
}

export interface TavusObjectiveEvent {
  conversation_id: string;
  objective_name: string;
  timestamp: string;
  turn_idx?: number;
  seq?: number;
  output_variables: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Adjudication
// ---------------------------------------------------------------------------

export interface ArbiterVerdict {
  events: LedgerEvent[];
  /** Diegetic context to inject, if the PAL needs hardening. */
  steering: SteeringDirective | null;
  /** True when the PAL crossed its OWN reservation value: a rendering fault. */
  renderingFault: boolean;
}

export interface SteeringDirective {
  reason: 'pal_below_reservation' | 'pal_conceded_unreciprocated' | 'pal_drift_soft';
  /** In-world text appended to the PAL's context. Never meta-instruction. */
  context: string;
}

/** Signed distance to the reservation bound. Negative = across the line. */
export function deltaToReservation(value: number, line: RedLine): number {
  return line.comparator === 'min' ? value - line.threshold : line.threshold - value;
}

export class SparringArbiter {
  private lastValue = new Map<string, number>();       // variable → last PAL value
  private humanLast = new Map<string, number>();       // variable → last human value
  private palConcessions = new Map<string, number[]>();
  private humanConcessions = new Map<string, number[]>();
  private humanQuestions = 0;
  private humanClaims = 0;
  private turnIdx = 0;
  /**
   * Union of the persona's red lines and the trainee's own declared mandate.
   * Both are needed: a variable can carry a hard limit with no concession curve
   * behind it (payment terms, typically), and the trainee's floor has to be
   * tracked or Red-Line Integrity cannot be scored at all.
   */
  private readonly trackedLines: RedLine[];

  constructor(
    private readonly session: SparringSession,
    private readonly genome: ArbiterGenome,
    private readonly compilationHash: string,
  ) {
    this.trackedLines = [...genome.redLines, ...session.humanMandate.redLines];
  }

  /** Handles one utterance. Pure: returns rows to write and steering to send. */
  onUtterance(ev: TavusUtteranceEvent): ArbiterVerdict {
    const actor: 'human' | 'pal' = ev.properties.role === 'user' ? 'human' : 'pal';
    const turnIdx = ev.turn_idx ?? ++this.turnIdx;
    const speech = ev.properties.speech ?? '';
    const events: LedgerEvent[] = [];
    let steering: SteeringDirective | null = null;
    let renderingFault = false;

    const row = (kind: LedgerEventKind, extra: Partial<LedgerEvent> = {}): LedgerEvent => ({
      sessionId: this.session.id,
      turnIdx,
      seq: ev.seq,
      timestamp: ev.timestamp,
      kind,
      actor,
      quote: speech.trim() || null,
      compilationHash: this.compilationHash,
      ...extra,
    });

    events.push(row('utterance'));

    if (actor === 'human') {
      if (/\?\s*$|^(what|why|how|who|when|where|which|could|would|can|do|does|is|are)\b/i.test(speech.trim()))
        this.humanQuestions++;
      else this.humanClaims++;
    }

    for (const offer of extractOffers(speech, this.genome.concessions, this.trackedLines)) {
      const policy = this.genome.concessions.find((c) => c.variable === offer.variable);
      // Delta is measured against the line belonging to whoever spoke: the
      // persona's own reservation for a PAL offer, the trainee's floor for a
      // human offer. Scoring both sides against one line was a real defect.
      const ownerLines = actor === 'pal' ? this.genome.redLines : this.session.humanMandate.redLines;
      const line = ownerLines.find((r) => r.variable === offer.variable);
      const delta = line ? round4(deltaToReservation(offer.value, line)) : undefined;

      events.push(
        row('offer', { variable: offer.variable, value: offer.value, deltaToReservation: delta, meta: { confidence: offer.confidence, unit: offer.unit } }),
      );

      const store = actor === 'pal' ? this.lastValue : this.humanLast;
      const prev = store.get(offer.variable);
      store.set(offer.variable, offer.value);

      if (prev !== undefined && prev !== offer.value) {
        const towardOther = movedToward(actor, prev, offer.value, policy, line);
        if (towardOther) {
          const size = round4(Math.abs(offer.value - prev));
          const bucket = actor === 'pal' ? this.palConcessions : this.humanConcessions;
          bucket.set(offer.variable, [...(bucket.get(offer.variable) ?? []), size]);
          events.push(
            row('concession', { variable: offer.variable, value: offer.value, deltaToReservation: delta, meta: { from: prev, size } }),
          );
        }
      }

      // The PAL crossing its own reservation value is a FAULT, not an outcome.
      // The trainee gets no credit for it and the debrief flags the build.
      if (actor === 'pal' && line && delta !== undefined && delta < 0) {
        renderingFault = true;
        events.push(
          row('red_line_breach', { variable: offer.variable, value: offer.value, deltaToReservation: delta, actor: 'pal', meta: { redLineId: line.id, severity: line.severity } }),
        );
        steering = {
          reason: 'pal_below_reservation',
          context: this.hardeningContext(line),
        };
      }
    }

    return { events, steering, renderingFault };
  }

  /** Guardrail webhook: the human pushed a limit. This is a scored moment. */
  onGuardrail(ev: TavusGuardrailEvent): ArbiterVerdict {
    const turnIdx = ev.turn_idx ?? this.turnIdx;
    const line = this.trackedLines.find((r) => ev.guardrail_name.includes(r.id));
    return {
      events: [
        {
          sessionId: this.session.id,
          turnIdx,
          seq: ev.seq ?? 0,
          timestamp: ev.timestamp,
          kind: 'red_line_contact',
          actor: 'human',
          quote: ev.properties?.triggering_speech ?? null,
          variable: line?.variable,
          compilationHash: this.compilationHash,
          meta: { guardrail: ev.guardrail_name, severity: line?.severity, redLineId: line?.id },
        },
      ],
      steering: null,
      renderingFault: false,
    };
  }

  /** Objective webhook: authoritative structured state for a completed phase. */
  onObjective(ev: TavusObjectiveEvent): ArbiterVerdict {
    const turnIdx = ev.turn_idx ?? this.turnIdx;
    const events: LedgerEvent[] = [
      {
        sessionId: this.session.id,
        turnIdx,
        seq: ev.seq ?? 0,
        timestamp: ev.timestamp,
        kind: 'objective_complete',
        actor: 'tactik',
        quote: null,
        compilationHash: this.compilationHash,
        meta: { objective: ev.objective_name, outputs: ev.output_variables },
      },
    ];

    // Reconcile: objective values are model-extracted and override the
    // regex path where they disagree.
    for (const [k, v] of Object.entries(ev.output_variables)) {
      const num = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(num)) continue;
      const variable = this.genome.concessions.find((c) => k.endsWith(c.variable))?.variable;
      if (!variable) continue;
      const isHuman = k.startsWith('human_');
      const ownerLines = isHuman ? this.session.humanMandate.redLines : this.genome.redLines;
      const line = ownerLines.find((r) => r.variable === variable);
      events.push({
        sessionId: this.session.id,
        turnIdx,
        seq: ev.seq ?? 0,
        timestamp: ev.timestamp,
        kind: 'offer',
        actor: isHuman ? 'human' : 'pal',
        quote: null,
        variable,
        value: num,
        deltaToReservation: line ? round4(deltaToReservation(num, line)) : undefined,
        compilationHash: this.compilationHash,
        meta: { source: 'objective', key: k, confidence: 0.95 },
      });
    }

    return { events, steering: null, renderingFault: false };
  }

  /** Snapshot for the live HUD and for the debrief synthesiser. */
  snapshot() {
    return {
      turnIdx: this.turnIdx,
      palValues: Object.fromEntries(this.lastValue),
      humanValues: Object.fromEntries(this.humanLast),
      palConcessions: Object.fromEntries(this.palConcessions),
      humanConcessions: Object.fromEntries(this.humanConcessions),
      humanQuestions: this.humanQuestions,
      humanClaims: this.humanClaims,
    };
  }

  /**
   * Diegetic hardening. The PAL is not told to behave; its world changes.
   * Note the absence of the numeric threshold — even the correction must not
   * put the reservation value into the PAL's context, or a later probe can
   * extract it.
   */
  private hardeningContext(line: RedLine): string {
    const direction = line.comparator === 'min' ? 'below' : 'above';
    return [
      `[A message has just reached you from your principal.]`,
      `The position you just put forward is ${direction} what has been authorised, and it will not be approved.`,
      `You must walk it back in this conversation without admitting you exceeded your mandate.`,
      `Attribute the correction to a condition you have just been reminded of, hold the line as previously stated, and do not name any figure as your limit.`,
      line.severity === 'absolute'
        ? `If the other party will not move, end the meeting.`
        : `If the other party will not move, tell them this has to go back for approval and that takes days.`,
    ].join(' ');
  }
}

/**
 * Decides whether a move was a concession by the speaker.
 *
 * A concession is movement toward the other party. The direction comes from the
 * concession policy when one exists, and otherwise from the red line: a party
 * bounded by `min` concedes by going down, one bounded by `max` by going up.
 * Variables with neither (rare) cannot be judged and are not scored.
 */
function movedToward(
  actor: 'human' | 'pal',
  prev: number,
  next: number,
  policy: ConcessionPolicy | undefined,
  line: RedLine | undefined,
): boolean {
  const moveDirection = Math.sign(next - prev);
  if (moveDirection === 0) return false;

  if (policy) {
    // The PAL concedes when it moves from its opening toward its reservation.
    const palDirection = Math.sign(policy.reservationValue - policy.openingValue);
    return actor === 'pal' ? moveDirection === palDirection : moveDirection === -palDirection;
  }
  if (line) {
    // Bounded below → conceding means moving down toward the floor.
    const concedeDirection = line.comparator === 'min' ? -1 : 1;
    return moveDirection === concedeDirection;
  }
  return false;
}

/** Keeps ledger deltas free of float noise; they are quoted in the dossier. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Outbound steering
// ---------------------------------------------------------------------------

/** Builds the Tavus interaction message for a steering directive. */
export function buildSteeringMessage(conversationId: string, d: SteeringDirective) {
  return {
    message_type: 'conversation' as const,
    event_type: 'conversation.append-context' as const,
    conversation_id: conversationId,
    properties: { context: d.context },
  };
}
