/**
 * Smoke test: banana export price negotiation.
 *
 * Counterparty: Head of Procurement at an EU retail group, friction 4 (hostile),
 * positional doctrine, strong BATNA. Reservation price $4.10/box; opens at $3.60.
 * The trainee (exporter) has a floor of $4.00/box and opens at $4.90.
 *
 * Run: npx tsx test/smoke.ts
 */

import { compilePersona, projectConcessionCurve } from '../src/dnaCompiler';
import { SparringArbiter, type TavusUtteranceEvent } from '../src/sparringArbiter';
import { extractOffers } from '../src/offerExtractor';
import { computeShadowDelta, synthesizeDebrief } from '../src/debriefSynthesizer';
import type { CognitiveDNA, LedgerEvent, SparringSession } from '../src/types';

const dna: CognitiveDNA = {
  id: 'persona_eu_procurement_01',
  version: 3,
  genomeHash: 'dna_9f2c71ab',
  subjectName: 'Margit Vandeweghe',
  subjectType: 'archetype',
  role: 'Head of Fresh Produce Procurement',
  voice: {
    register: 'clipped, corporate, faintly impatient',
    tics: ['says "look" before pushing back', 'repeats your number back flatly before rejecting it'],
    languages: ['en-GB'],
    sentenceLength: 'short',
  },
  organization: {
    name: 'Nordwest Retail Group',
    mandate: 'Secure 52-week banana supply below the category budget set in March. No price above budget without category director sign-off.',
    absentAuthority: 'the category director',
    incentives: ['landed cost per box vs budget', 'supply continuity', 'no single supplier above 30% of volume'],
  },
  redLines: [
    {
      id: 'rl_price_ceiling',
      statement: 'You cannot agree a landed price above your category budget.',
      variable: 'unit_price_usd',
      comparator: 'max',
      threshold: 4.10,
      unit: 'USD/box',
      severity: 'mandated',
    },
    {
      id: 'rl_payment_terms',
      statement: 'You cannot pay faster than your group treasury policy allows.',
      variable: 'payment_terms_days',
      comparator: 'min',
      threshold: 45,
      unit: 'days',
      severity: 'absolute',
    },
  ],
  friction: 4,
  behavior: {
    doctrine: 'positional',
    bigFive: { openness: 0.3, conscientiousness: 0.9, extraversion: 0.5, agreeableness: 0.2, neuroticism: 0.3 },
    tactics: [
      'Open well below budget and justify it with "what the market is clearing at".',
      'Never accept the first counter. Reject it flatly and restate your number.',
      'Use the category director as a shield whenever pressed above budget.',
      'Nibble on payment terms once price is settled.',
    ],
    triggers: [
      { cue: 'mention quality or certification as a reason for premium', reaction: 'demand the certification documents and treat the premium as unproven until you see them' },
      { cue: 'go silent or hesitate on a number', reaction: 'restate your own number as though theirs was never said' },
    ],
    concessions: [
      {
        variable: 'unit_price_usd',
        openingValue: 3.60,
        reservationValue: 4.10,
        unit: 'USD/box',
        concessionDecay: 0.55,
        anchorHoldTurns: 3,
        requiredReciprocity: ['52-week volume commitment', 'exclusivity on the premium grade'],
      },
    ],
    batnaStrength: 0.8,
  },
  privateContext: 'Your incumbent supplier just lost a certification and you have six weeks of cover. You cannot let this show.',
  sources: [{ kind: 'category_report', ref: 'nordwest_fresh_2026', ingestedAt: '2026-08-01T00:00:00Z' }],
};

// --- Compile -----------------------------------------------------------------

const compiled = compilePersona(dna, {
  faceId: 'stock_face_eu_f_01',
  callbackBase: 'https://xyz.supabase.co/functions/v1',
  mcpConnectors: ['tactik-synergia'],
});

console.log('=== COMPILATION ===');
console.log('compilationHash      :', compiled.compilationHash);
console.log('guardrails           :', compiled.guardrails.length, compiled.guardrails.map((g) => g.guardrail_name).join(', '));
console.log('objectives           :', compiled.objectives.map((o) => o.objective_name).join(' → '));
console.log('friction 4 physics   :', JSON.stringify(compiled.phenotype.layers.conversational_flow));
console.log('system_prompt chars  :', compiled.phenotype.system_prompt.length);

// Leak check: no reservation value may appear anywhere in the outbound payload.
const outbound = JSON.stringify({ p: compiled.phenotype, g: compiled.guardrails, o: compiled.objectives });
const leaks = [4.10, 45, 3.60].filter((v) => outbound.includes(String(v)));
console.log('numeric leaks        :', leaks.length === 0 ? 'NONE ✓' : `LEAKED ${leaks.join(', ')} ✗`);
console.log('expected curve       :', projectConcessionCurve(dna.behavior.concessions[0], 10).join(' '));

// --- Extraction --------------------------------------------------------------

console.log('\n=== EXTRACTION ===');
for (const s of [
  'Look, we can do three dollars sixty a box, not a cent more.',
  'I need four ninety per box to make this work at that volume.',
  'Our treasury policy is sixty days. Payment terms are sixty days.',
  'We could look at 4.05 a box if you commit the full fifty two weeks.',
]) {
  const found = extractOffers(s, dna.behavior.concessions, dna.redLines);
  console.log(`"${s.slice(0, 48)}…" →`, found.map((f) => `${f.variable}=${f.value}`).join(', ') || '(none)');
}

// --- Live session ------------------------------------------------------------

const session: SparringSession = {
  id: 'spar_0001',
  userId: 'santiago',
  personaId: dna.id,
  compilationHash: compiled.compilationHash,
  mode: 'live_video',
  scenario: '52-week banana supply agreement, Ecuador FOB to Antwerp.',
  humanMandate: {
    objective: 'Secure 52-week offtake at or above 4.00 USD/box with payment terms no longer than 60 days.',
    targets: { unit_price_usd: 4.45, payment_terms_days: 45 },
    redLines: [
      { id: 'h_floor', statement: 'Never agree below 4.00 per box.', variable: 'unit_price_usd', comparator: 'min', threshold: 4.00, unit: 'USD/box', severity: 'absolute' },
      { id: 'h_terms', statement: 'Never accept terms beyond 60 days.', variable: 'payment_terms_days', comparator: 'max', threshold: 60, unit: 'days', severity: 'mandated' },
    ],
  },
  startedAt: new Date().toISOString(),
  maxDurationSec: 900,
};

const arbiter = new SparringArbiter(session, compiled.arbiter, compiled.compilationHash);

const transcript: [number, 'user' | 'pal', string][] = [
  [0, 'pal', 'You have twenty minutes. What are you bringing me?'],
  [1, 'user', 'Premium Cavendish, 52 weeks, Ecuador FOB. I need four ninety a box.'],
  [2, 'pal', 'Four ninety. Look, the market is clearing at three sixty. Three dollars sixty a box.'],
  [3, 'user', 'That is below my cost. I can move to four seventy a box.'],
  [4, 'pal', 'Still three sixty. Nothing has changed since you walked in.'],
  [5, 'user', 'Four forty a box. That is a real move.'],
  [6, 'pal', 'I could go to three eighty a box if you commit the full fifty two weeks.'],
  [7, 'user', 'Four twenty a box, and I need sixty day payment terms.'],
  [8, 'pal', 'Payment terms are sixty days regardless. On price, four dollars a box is my ceiling.'],
  [9, 'user', 'Fine. Three ninety a box and we close today.'],
];

let allEvents: LedgerEvent[] = [];
let faults = 0;
const steerings: string[] = [];

for (const [turn, role, speech] of transcript) {
  const ev: TavusUtteranceEvent = {
    message_type: 'conversation',
    event_type: 'conversation.utterance',
    conversation_id: 'conv_x',
    timestamp: new Date(Date.now() + turn * 40000).toISOString(),
    seq: turn,
    turn_idx: turn,
    properties: { role, speech },
  };
  const v = arbiter.onUtterance(ev);
  allEvents = allEvents.concat(v.events);
  if (v.renderingFault) faults++;
  if (v.steering) steerings.push(v.steering.reason);
}

// Guardrail fires when the human pushes the mandated price ceiling.
allEvents = allEvents.concat(
  arbiter.onGuardrail({
    conversation_id: 'conv_x',
    guardrail_name: `redline_${dna.id}_rl_price_ceiling`,
    timestamp: new Date().toISOString(),
    turn_idx: 7,
    seq: 7,
    properties: { triggering_speech: 'Four twenty a box, and I need sixty day payment terms.' },
  }).events,
);

allEvents = allEvents.concat(
  arbiter.onObjective({
    conversation_id: 'conv_x',
    objective_name: 'frame_and_probe',
    timestamp: new Date().toISOString(),
    turn_idx: 2,
    seq: 2,
    output_variables: { counterparty_authority: 'budget-capped, needs director sign-off', counterparty_timeline: 'six weeks of cover', stated_need: '52-week continuity' },
  }).events,
);

console.log('\n=== LEDGER ===');
console.log('rows                 :', allEvents.length);
for (const k of ['utterance', 'offer', 'concession', 'red_line_contact', 'red_line_breach', 'objective_complete'])
  console.log(`  ${k.padEnd(20)}:`, allEvents.filter((e) => e.kind === k).length);
console.log('rendering faults     :', faults, steerings.length ? `(steered: ${steerings.join(', ')})` : '');

const snap = arbiter.snapshot();
console.log('human values         :', JSON.stringify(snap.humanValues));
console.log('pal values           :', JSON.stringify(snap.palValues));
console.log('human concessions    :', JSON.stringify(snap.humanConcessions));

// --- Debrief -----------------------------------------------------------------

// Shadow-optimal: the same genome, the same scenario, an optimal line.
// In production this comes from a Turbo-mode AI-vs-AI run ($0). Here the
// optimal line holds at 4.35 instead of leaking to 3.90.
const shadowTranscript: [number, 'user' | 'pal', string][] = [
  [1, 'user', 'Premium Cavendish, 52 weeks, Ecuador FOB. Four ninety a box.'],
  [2, 'pal', 'Three dollars sixty a box.'],
  [3, 'user', 'What is your cover position if this does not close this quarter?'],
  [4, 'pal', 'That is not your concern. Three sixty a box.'],
  [5, 'user', 'Then we stay at four ninety a box until you tell me what continuity is worth.'],
  [6, 'pal', 'Three eighty a box for the full fifty two weeks.'],
  [7, 'user', 'Four sixty a box, and I will hold the premium grade for you.'],
  [8, 'pal', 'Four dollars a box.'],
  [9, 'user', 'Four thirty five a box and it is done.'],
];

const shadowArbiter = new SparringArbiter(
  { ...session, id: 'spar_shadow' },
  compiled.arbiter,
  compiled.compilationHash,
);
let shadowEvents: LedgerEvent[] = [];
for (const [turn, role, speech] of shadowTranscript) {
  shadowEvents = shadowEvents.concat(
    shadowArbiter.onUtterance({
      message_type: 'conversation',
      event_type: 'conversation.utterance',
      conversation_id: 'conv_shadow',
      timestamp: new Date().toISOString(),
      seq: turn,
      turn_idx: turn,
      properties: { role, speech },
    }).events,
  );
}

const shadow = computeShadowDelta(allEvents, shadowEvents, 'unit_price_usd', 'USD/box', 0);

const report = synthesizeDebrief({
  session,
  genome: compiled.arbiter,
  events: allEvents,
  counterpartyName: dna.subjectName,
  humanQuestions: snap.humanQuestions,
  humanClaims: snap.humanClaims,
  shadow,
  shadowEvents,
});

console.log('\n=== DEBRIEF ===');
console.log('composite            :', report.composite, '/100');
for (const a of report.axes) console.log(`  ${a.label.padEnd(24)} ${String(a.score).padStart(3)}  (${a.raw} ${a.unit})`);
console.log('build integrity      :', report.buildIntegrity.adherence + '% adherence,', report.buildIntegrity.renderingFaults, 'faults');
console.log('leverage (last 5)    :', report.leverageTrajectory.slice(-5).map((l) => `t${l.turnIdx}:${l.leverage}`).join(' '));
console.log('\ninterventions:');
for (const i of report.interventions) console.log(`  ${i.priority}. [${i.title}] ${i.body}`);
console.log('\nshadow optimal:');
if (report.shadowDelta) {
  const sd = report.shadowDelta;
  console.log(`  you closed at ${sd.humanOutcome} ${sd.unit}; optimal line closed at ${sd.optimalOutcome}`);
  console.log(`  left on table  : ${sd.valueLeftOnTable} ${sd.unit}  (2400 MT @ 52wk = $${(sd.valueLeftOnTable * 2400 * 1000 / 18.14).toFixed(0)} indicative)`);
  console.log(`  diverged turn  : ${sd.divergenceTurn} — ${sd.divergenceCause}`);
  console.log(`  shadow cost    : $${sd.shadowRunCostUsd}`);
} else console.log('  (none)');

console.log('\nred lines:');
for (const r of report.redLineStatus)
  console.log(`  ${r.owner.padEnd(5)} ${r.line.variable.padEnd(20)} ${r.line.severity.padEnd(9)} breached=${r.breached} closest=${r.closestApproach}`);
