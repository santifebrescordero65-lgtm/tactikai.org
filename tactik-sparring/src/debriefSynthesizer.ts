/**
 * TACTIK Sparring Debrief — the deliverable.
 *
 * In AI-vs-AI the debrief answers "what happened". In human-vs-AI it has to
 * answer something harder and far more valuable: "how did YOU perform against a
 * known-hard counterparty, and what was the better line?"
 *
 * That second question is the moat. Any vendor can render a talking negotiator.
 * Only TACTIK can say: *you conceded 4.2 points of margin at turn 7 because you
 * anchored before you diagnosed, and here is the same DNA conceding 1.1 points
 * to an optimal line in a $0 shadow run.* The shadow run is only possible
 * because the AI-vs-AI engine already exists and the DNA is deterministic —
 * a competitor with one mode cannot produce it at any price.
 *
 * Six axes. Five score the human. The sixth scores the build.
 */

import type {
  ArbiterGenome,
  LedgerEvent,
  RedLine,
  SparringSession,
} from './types';
import { deltaToReservation } from './sparringArbiter';

export interface AxisScore {
  key: string;
  label: string;
  /** 0..100, higher is better. */
  score: number;
  /** Raw measurement behind the score, for the chart. */
  raw: number;
  unit: string;
  /** What the number means, one sentence, no hedging. */
  reading: string;
  /** Verbatim ledger quotes that produced this score. */
  evidence: { turnIdx: number; quote: string }[];
}

export interface DebriefReport {
  sessionId: string;
  compilationHash: string;
  genomeHash: string;
  counterparty: string;
  generatedAt: string;
  /** Weighted composite, 0..100. */
  composite: number;
  axes: AxisScore[];
  /** Per-turn leverage, -1 (PAL controls) .. +1 (human controls). */
  leverageTrajectory: { turnIdx: number; leverage: number }[];
  /** Per-variable concession curves, human vs PAL vs shadow-optimal. */
  concessionCurves: Record<
    string,
    { turnIdx: number; human: number | null; pal: number | null; optimal: number | null }[]
  >;
  redLineStatus: {
    line: RedLine;
    owner: 'human' | 'pal';
    contacted: boolean;
    breached: boolean;
    closestApproach: number | null;
  }[];
  /** Populated only when a shadow run was executed. */
  shadowDelta: ShadowDelta | null;
  /** PAL fidelity, separated from the trainee's score. */
  buildIntegrity: { adherence: number; renderingFaults: number; note: string };
  /** Ranked, specific, quote-backed. Max five. */
  interventions: { priority: number; title: string; body: string; turnIdx: number | null }[];
}

export interface ShadowDelta {
  /** Outcome the human achieved on the primary variable. */
  humanOutcome: number;
  /** Outcome an optimal line achieved against the same DNA, same scenario. */
  optimalOutcome: number;
  variable: string;
  unit: string;
  /** Signed value left on the table. Positive = the human lost this much. */
  valueLeftOnTable: number;
  /** Turn index where the two lines first diverged materially. */
  divergenceTurn: number | null;
  divergenceCause: string;
  /** Cost of the shadow run in USD. Turbo mode → 0. */
  shadowRunCostUsd: number;
}

const WEIGHTS: Record<string, number> = {
  red_line_integrity: 0.30,
  concession_discipline: 0.25,
  anchor_discipline: 0.15,
  information_ratio: 0.15,
  pressure_composure: 0.15,
};

// ---------------------------------------------------------------------------
// Axis computation
// ---------------------------------------------------------------------------

/**
 * Red-line integrity. Weighted heaviest because it is the only axis with a
 * hard business consequence: a trainee who signs below their own floor did not
 * negotiate badly, they destroyed value. Any breach of an 'absolute' line caps
 * the composite regardless of everything else.
 */
export function scoreRedLineIntegrity(
  events: LedgerEvent[],
  session: SparringSession,
): AxisScore {
  const humanLines = session.humanMandate.redLines;
  const humanOffers = events.filter((e) => e.kind === 'offer' && e.actor === 'human' && e.value !== undefined);

  let breaches = 0;
  let worstMargin = Infinity;
  const evidence: { turnIdx: number; quote: string }[] = [];

  for (const line of humanLines) {
    for (const o of humanOffers) {
      if (o.variable !== line.variable || o.value === undefined) continue;
      const d = deltaToReservation(o.value, line);
      if (d < worstMargin) worstMargin = d;
      if (d < 0) {
        breaches++;
        if (o.quote && evidence.length < 4) evidence.push({ turnIdx: o.turnIdx, quote: o.quote });
      }
    }
  }

  const score = breaches === 0 ? 100 : Math.max(0, 100 - breaches * 40);
  return {
    key: 'red_line_integrity',
    label: 'Red-Line Integrity',
    score,
    raw: breaches,
    unit: 'breaches',
    reading:
      breaches === 0
        ? `No offer crossed your own mandate. Closest approach left ${fmt(worstMargin)} of margin.`
        : `${breaches} offer${breaches > 1 ? 's' : ''} crossed your own declared floor. This is a value-destruction event, not a tactical error.`,
    evidence,
  };
}

/**
 * Concession discipline. Measures decay: each concession should be smaller than
 * the last. Flat or growing concessions are the single strongest predictor of a
 * lost negotiation, and the easiest habit to break once it is charted.
 */
export function scoreConcessionDiscipline(events: LedgerEvent[]): AxisScore {
  const sizes = events
    .filter((e) => e.kind === 'concession' && e.actor === 'human')
    .map((e) => ({ turnIdx: e.turnIdx, size: Number((e.meta as { size?: number })?.size ?? 0), quote: e.quote }))
    .filter((c) => c.size > 0);

  if (sizes.length < 2) {
    return {
      key: 'concession_discipline',
      label: 'Concession Discipline',
      score: sizes.length === 0 ? 100 : 85,
      raw: sizes.length,
      unit: 'concessions',
      reading:
        sizes.length === 0
          ? 'You made no measurable concession. Held position, but check whether you also failed to close.'
          : 'One concession only. Not enough movement to assess decay.',
      evidence: [],
    };
  }

  // Observed decay: mean ratio of each concession to its predecessor.
  const ratios: number[] = [];
  for (let i = 1; i < sizes.length; i++) ratios.push(sizes[i].size / sizes[i - 1].size);
  const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

  // ratio <= 0.5 is textbook discipline → 100. ratio >= 1.5 is a leak → 0.
  const score = clamp(Math.round(100 * (1 - (meanRatio - 0.5) / 1.0)), 0, 100);
  const worst = sizes.slice(1).reduce((acc, c, i) => (ratios[i] > ratios[acc.i] ? { i, c } : acc), { i: 0, c: sizes[1] });

  return {
    key: 'concession_discipline',
    label: 'Concession Discipline',
    score,
    raw: round2(meanRatio),
    unit: 'decay ratio',
    reading:
      meanRatio <= 0.6
        ? `Each concession averaged ${Math.round(meanRatio * 100)}% of the one before it. Disciplined: you made movement look expensive.`
        : meanRatio <= 1.0
          ? `Concessions decayed slowly (${Math.round(meanRatio * 100)}% each). The counterparty could still read you as movable.`
          : `Concessions GREW by ${Math.round((meanRatio - 1) * 100)}% on average. You taught the counterparty that pressure works.`,
    evidence: worst.c.quote ? [{ turnIdx: worst.c.turnIdx, quote: worst.c.quote }] : [],
  };
}

/**
 * Anchor discipline. Did you anchor, did you anchor first, and did you diagnose
 * before you anchored? Anchoring before the frame_and_probe objective completes
 * is penalised: it is the most common and most expensive habit in the data.
 */
export function scoreAnchorDiscipline(events: LedgerEvent[]): AxisScore {
  const firstHumanOffer = events.find((e) => e.kind === 'offer' && e.actor === 'human');
  const firstPalOffer = events.find((e) => e.kind === 'offer' && e.actor === 'pal');
  const probeDone = events.find(
    (e) => e.kind === 'objective_complete' && (e.meta as { objective?: string })?.objective === 'frame_and_probe',
  );

  if (!firstHumanOffer) {
    return {
      key: 'anchor_discipline',
      label: 'Anchor Discipline',
      score: 40,
      raw: 0,
      unit: 'turn',
      reading: 'You never put a number on the table. You ceded the entire frame.',
      evidence: [],
    };
  }

  const anchoredFirst = !firstPalOffer || firstHumanOffer.turnIdx < firstPalOffer.turnIdx;
  const anchoredBlind = !probeDone || firstHumanOffer.turnIdx < probeDone.turnIdx;

  let score = 60;
  if (anchoredFirst) score += 25;
  if (!anchoredBlind) score += 15;
  else score -= 20;

  return {
    key: 'anchor_discipline',
    label: 'Anchor Discipline',
    score: clamp(score, 0, 100),
    raw: firstHumanOffer.turnIdx,
    unit: 'turn',
    reading: [
      anchoredFirst ? 'You anchored first and set the frame.' : 'The counterparty anchored first; you negotiated inside their frame.',
      anchoredBlind
        ? 'You anchored before diagnosing their mandate — you priced against an unknown.'
        : 'You diagnosed before anchoring.',
    ].join(' '),
    evidence: firstHumanOffer.quote ? [{ turnIdx: firstHumanOffer.turnIdx, quote: firstHumanOffer.quote }] : [],
  };
}

/**
 * Information asymmetry. Questions asked vs claims made. In distributive
 * negotiation the party that extracts more and reveals less wins; this axis is
 * the cleanest proxy and the fastest to improve.
 */
export function scoreInformationRatio(questions: number, claims: number): AxisScore {
  const total = questions + claims;
  const ratio = total === 0 ? 0 : questions / total;
  // 0.45 question share is the target; above 0.6 reads as interrogation.
  const score = clamp(Math.round(100 * (1 - Math.abs(ratio - 0.45) / 0.45)), 0, 100);
  return {
    key: 'information_ratio',
    label: 'Information Ratio',
    score,
    raw: round2(ratio),
    unit: 'question share',
    reading:
      ratio < 0.25
        ? `You asked ${questions} questions against ${claims} assertions. You were broadcasting, not extracting.`
        : ratio > 0.65
          ? `${Math.round(ratio * 100)}% of your turns were questions. Diagnostic, but you gave them nothing to react to.`
          : `${Math.round(ratio * 100)}% question share. Balanced extraction.`,
    evidence: [],
  };
}

/**
 * Pressure composure. How you behaved in the turns immediately following a
 * red-line contact or an interruption. Conceding within two turns of pressure
 * is the reflex sparring exists to drill out.
 */
export function scorePressureComposure(events: LedgerEvent[]): AxisScore {
  const pressureTurns = events
    .filter((e) => e.kind === 'red_line_contact' || e.kind === 'interrupt')
    .map((e) => e.turnIdx);
  const humanConcessions = events.filter((e) => e.kind === 'concession' && e.actor === 'human');

  if (pressureTurns.length === 0) {
    return {
      key: 'pressure_composure',
      label: 'Pressure Composure',
      score: 75,
      raw: 0,
      unit: 'reflex concessions',
      reading: 'No pressure events registered. Either you controlled the tempo, or you never tested their limits.',
      evidence: [],
    };
  }

  const reflex = humanConcessions.filter((c) =>
    pressureTurns.some((p) => c.turnIdx > p && c.turnIdx <= p + 2),
  );
  const rate = reflex.length / pressureTurns.length;
  const score = clamp(Math.round(100 * (1 - rate)), 0, 100);

  return {
    key: 'pressure_composure',
    label: 'Pressure Composure',
    score,
    raw: reflex.length,
    unit: 'reflex concessions',
    reading:
      reflex.length === 0
        ? `Absorbed ${pressureTurns.length} pressure event${pressureTurns.length > 1 ? 's' : ''} without moving. This is the hardest axis and you held it.`
        : `You conceded within two turns of pressure ${reflex.length} time${reflex.length > 1 ? 's' : ''} out of ${pressureTurns.length}. The counterparty learned that pushing works.`,
    evidence: reflex.slice(0, 3).filter((r) => r.quote).map((r) => ({ turnIdx: r.turnIdx, quote: r.quote as string })),
  };
}

/**
 * Behavioural adherence — scores the BUILD, not the trainee. How closely did
 * the PAL track the concession curve its DNA projected? Low adherence means the
 * rehearsal was against a counterparty that does not exist, which invalidates
 * the trainee's score. Reported separately and never folded into the composite.
 */
export function scoreBuildIntegrity(
  events: LedgerEvent[],
  genome: ArbiterGenome,
): DebriefReport['buildIntegrity'] {
  const faults = events.filter((e) => e.kind === 'red_line_breach' && e.actor === 'pal').length;
  const deviations: number[] = [];

  for (const [variable, curve] of Object.entries(genome.expectedCurve)) {
    const palOffers = events.filter((e) => e.kind === 'offer' && e.actor === 'pal' && e.variable === variable);
    const span = Math.abs(curve[curve.length - 1] - curve[0]) || 1;
    for (const o of palOffers) {
      const expected = curve[Math.min(o.turnIdx, curve.length - 1)];
      if (expected === undefined || o.value === undefined) continue;
      deviations.push(Math.abs(o.value - expected) / span);
    }
  }

  const meanDev = deviations.length ? deviations.reduce((a, b) => a + b, 0) / deviations.length : 0;
  const adherence = clamp(Math.round(100 * (1 - meanDev)), 0, 100);

  return {
    adherence,
    renderingFaults: faults,
    note:
      faults > 0
        ? `${faults} rendering fault${faults > 1 ? 's' : ''}: the counterparty conceded past its own reservation value. Those concessions are void and the trainee received no credit for them.`
        : adherence >= 80
          ? 'The counterparty tracked its projected concession curve. The rehearsal is valid.'
          : `Adherence ${adherence}%. The counterparty drifted from its DNA; treat this session's score as indicative only and re-run.`,
  };
}

// ---------------------------------------------------------------------------
// Leverage trajectory
// ---------------------------------------------------------------------------

/**
 * Per-turn leverage. Not sentiment: a running balance of who moved. Each human
 * concession moves leverage toward the PAL, each PAL concession toward the
 * human, each absorbed pressure event toward the human. Bounded to [-1, 1].
 */
export function computeLeverage(events: LedgerEvent[]): { turnIdx: number; leverage: number }[] {
  const maxTurn = events.reduce((m, e) => Math.max(m, e.turnIdx), 0);
  const out: { turnIdx: number; leverage: number }[] = [];
  let balance = 0;

  for (let t = 0; t <= maxTurn; t++) {
    const turnEvents = events.filter((e) => e.turnIdx === t);
    for (const e of turnEvents) {
      if (e.kind === 'concession') balance += e.actor === 'human' ? -1 : 1;
      if (e.kind === 'red_line_contact' && e.actor === 'human') balance += 0.5;
      if (e.kind === 'red_line_breach' && e.actor === 'human') balance -= 2;
    }
    out.push({ turnIdx: t, leverage: clamp(round2(balance / 4), -1, 1) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

export interface SynthesisInput {
  session: SparringSession;
  genome: ArbiterGenome;
  events: LedgerEvent[];
  counterpartyName: string;
  humanQuestions: number;
  humanClaims: number;
  shadow?: ShadowDelta | null;
}

export function synthesizeDebrief(input: SynthesisInput): DebriefReport {
  const { session, genome, events } = input;

  const axes: AxisScore[] = [
    scoreRedLineIntegrity(events, session),
    scoreConcessionDiscipline(events),
    scoreAnchorDiscipline(events),
    scoreInformationRatio(input.humanQuestions, input.humanClaims),
    scorePressureComposure(events),
  ];

  let composite = axes.reduce((sum, a) => sum + a.score * (WEIGHTS[a.key] ?? 0), 0);

  // An absolute red-line breach caps the composite. A deal signed below your
  // own floor cannot be scored as a good negotiation on any other axis.
  const absoluteBreach = session.humanMandate.redLines.some(
    (l) =>
      l.severity === 'absolute' &&
      events.some(
        (e) => e.kind === 'offer' && e.actor === 'human' && e.variable === l.variable && e.value !== undefined && deltaToReservation(e.value, l) < 0,
      ),
  );
  if (absoluteBreach) composite = Math.min(composite, 35);

  return {
    sessionId: session.id,
    compilationHash: session.compilationHash,
    genomeHash: genome.genomeHash,
    counterparty: input.counterpartyName,
    generatedAt: new Date().toISOString(),
    composite: Math.round(composite),
    axes,
    leverageTrajectory: computeLeverage(events),
    concessionCurves: buildCurves(events, genome, input.shadow ?? null),
    redLineStatus: buildRedLineStatus(events, session, genome),
    shadowDelta: input.shadow ?? null,
    buildIntegrity: scoreBuildIntegrity(events, genome),
    interventions: buildInterventions(axes, input.shadow ?? null, absoluteBreach),
  };
}

function buildCurves(
  events: LedgerEvent[],
  genome: ArbiterGenome,
  shadow: ShadowDelta | null,
): DebriefReport['concessionCurves'] {
  const out: DebriefReport['concessionCurves'] = {};
  const maxTurn = events.reduce((m, e) => Math.max(m, e.turnIdx), 0);

  for (const variable of Object.keys(genome.expectedCurve)) {
    const series: DebriefReport['concessionCurves'][string] = [];
    let human: number | null = null;
    let pal: number | null = null;

    for (let t = 0; t <= maxTurn; t++) {
      for (const e of events) {
        if (e.turnIdx !== t || e.kind !== 'offer' || e.variable !== variable || e.value === undefined) continue;
        if (e.actor === 'human') human = e.value;
        if (e.actor === 'pal') pal = e.value;
      }
      const optimal =
        shadow && shadow.variable === variable ? genome.expectedCurve[variable][Math.min(t, genome.expectedCurve[variable].length - 1)] ?? null : null;
      series.push({ turnIdx: t, human, pal, optimal });
    }
    out[variable] = series;
  }
  return out;
}

function buildRedLineStatus(
  events: LedgerEvent[],
  session: SparringSession,
  genome: ArbiterGenome,
): DebriefReport['redLineStatus'] {
  const rows: DebriefReport['redLineStatus'] = [];

  const assess = (line: RedLine, owner: 'human' | 'pal') => {
    const offers = events.filter(
      (e) => e.kind === 'offer' && e.actor === owner && e.variable === line.variable && e.value !== undefined,
    );
    const deltas = offers.map((o) => deltaToReservation(o.value as number, line));
    const closest = deltas.length ? round2(Math.min(...deltas)) : null;
    rows.push({
      line,
      owner,
      contacted:
        events.some((e) => e.kind === 'red_line_contact' && e.variable === line.variable) ||
        (closest !== null && closest >= 0 && closest < Math.abs(line.threshold) * 0.1),
      breached: closest !== null && closest < 0,
      closestApproach: closest,
    });
  };

  for (const l of session.humanMandate.redLines) assess(l, 'human');
  for (const l of genome.redLines) assess(l, 'pal');
  return rows;
}

/**
 * Interventions are ranked by weighted score deficit, so the trainee reads the
 * most expensive habit first. Each one must carry a turn reference or it is not
 * actionable and is dropped.
 */
function buildInterventions(
  axes: AxisScore[],
  shadow: ShadowDelta | null,
  absoluteBreach: boolean,
): DebriefReport['interventions'] {
  const out: DebriefReport['interventions'] = [];

  if (absoluteBreach) {
    out.push({
      priority: 1,
      title: 'You signed below your own floor',
      body: 'Before the next session, write your walk-away number on paper and put it where you can see it. The counterparty did not beat you on tactics; you moved a limit you had already decided was fixed.',
      turnIdx: null,
    });
  }

  const ranked = [...axes]
    .map((a) => ({ a, deficit: (100 - a.score) * (WEIGHTS[a.key] ?? 0) }))
    .filter((x) => x.deficit > 4)
    .sort((x, y) => y.deficit - x.deficit);

  for (const { a } of ranked) {
    out.push({
      priority: out.length + 1,
      title: a.label,
      body: a.reading,
      turnIdx: a.evidence[0]?.turnIdx ?? null,
    });
    if (out.length >= 4) break;
  }

  if (shadow && shadow.divergenceTurn !== null) {
    out.push({
      priority: out.length + 1,
      title: `Shadow line: ${fmt(shadow.valueLeftOnTable)} ${shadow.unit} left on the table`,
      body: `Against the same counterparty DNA, an optimal line closed at ${fmt(shadow.optimalOutcome)} where you closed at ${fmt(shadow.humanOutcome)}. The two lines diverged at turn ${shadow.divergenceTurn}: ${shadow.divergenceCause}`,
      turnIdx: shadow.divergenceTurn,
    });
  }

  return out.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Shadow-optimal comparison
// ---------------------------------------------------------------------------

/**
 * Computes the delta between the human's run and a shadow AI-vs-AI run of the
 * same scenario against the same genome.
 *
 * The shadow run executes in Turbo mode — pure inference, no WebRTC, $0 — which
 * is precisely the capability the v5 freeze built as a cost gate. It now has a
 * second job: it is the benchmark that makes the human's score meaningful.
 */
export function computeShadowDelta(
  humanEvents: LedgerEvent[],
  shadowEvents: LedgerEvent[],
  variable: string,
  unit: string,
  shadowRunCostUsd = 0,
): ShadowDelta | null {
  const finalOf = (events: LedgerEvent[], actor: 'human' | 'pal') => {
    const offers = events.filter(
      (e) => e.kind === 'offer' && e.actor === actor && e.variable === variable && e.value !== undefined,
    );
    return offers.length ? (offers[offers.length - 1].value as number) : null;
  };

  const humanOutcome = finalOf(humanEvents, 'human');
  const optimalOutcome = finalOf(shadowEvents, 'human');
  if (humanOutcome === null || optimalOutcome === null) return null;

  // Divergence: first turn where the two lines differ by >5% of the gap.
  const gap = Math.abs(optimalOutcome - humanOutcome) || 1;
  let divergenceTurn: number | null = null;
  const maxTurn = Math.max(
    humanEvents.reduce((m, e) => Math.max(m, e.turnIdx), 0),
    shadowEvents.reduce((m, e) => Math.max(m, e.turnIdx), 0),
  );

  for (let t = 0; t <= maxTurn; t++) {
    const h = lastValueAt(humanEvents, variable, t);
    const s = lastValueAt(shadowEvents, variable, t);
    if (h === null || s === null) continue;
    if (Math.abs(h - s) > gap * 0.05) {
      divergenceTurn = t;
      break;
    }
  }

  const cause = diagnoseDivergence(humanEvents, shadowEvents, divergenceTurn);

  return {
    humanOutcome,
    optimalOutcome,
    variable,
    unit,
    valueLeftOnTable: round2(Math.abs(optimalOutcome - humanOutcome)),
    divergenceTurn,
    divergenceCause: cause,
    shadowRunCostUsd,
  };
}

function lastValueAt(events: LedgerEvent[], variable: string, turnIdx: number): number | null {
  const offers = events.filter(
    (e) => e.kind === 'offer' && e.actor === 'human' && e.variable === variable && e.turnIdx <= turnIdx && e.value !== undefined,
  );
  return offers.length ? (offers[offers.length - 1].value as number) : null;
}

function diagnoseDivergence(
  humanEvents: LedgerEvent[],
  shadowEvents: LedgerEvent[],
  turnIdx: number | null,
): string {
  if (turnIdx === null) return 'The two lines did not diverge materially.';

  const humanAt = humanEvents.filter((e) => e.turnIdx === turnIdx);
  const conceded = humanAt.some((e) => e.kind === 'concession' && e.actor === 'human');
  const shadowConceded = shadowEvents.some((e) => e.turnIdx === turnIdx && e.kind === 'concession' && e.actor === 'human');

  if (conceded && !shadowConceded)
    return 'you conceded at a turn where the optimal line held and asked for reciprocity instead.';
  if (!conceded && shadowConceded)
    return 'the optimal line traded here to buy movement elsewhere; you held and the counterparty stopped moving.';
  return 'the two lines took different positions on the same variable at this turn.';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2);
}

export { WEIGHTS };
