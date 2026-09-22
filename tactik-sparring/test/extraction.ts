/**
 * Extraction tests. This layer decides whether the ledger tells the truth, so
 * every spoken form a negotiator actually uses is pinned here.
 * Run: npx tsx test/extraction.ts
 */

import { extractOffers } from '../src/offerExtractor';
import type { ConcessionPolicy, RedLine } from '../src/types';

const policies: ConcessionPolicy[] = [
  { variable: 'unit_price_usd', openingValue: 3.60, reservationValue: 4.10, unit: 'USD/box', concessionDecay: 0.55, anchorHoldTurns: 3, requiredReciprocity: [] },
  { variable: 'volume_mt', openingValue: 1200, reservationValue: 2400, unit: 'MT', concessionDecay: 0.5, anchorHoldTurns: 1, requiredReciprocity: [] },
];

const redLines: RedLine[] = [
  { id: 'rl_terms', statement: 'No faster than treasury policy.', variable: 'payment_terms_days', comparator: 'min', threshold: 45, unit: 'days', severity: 'absolute' },
];

const cases: [string, string, number | null][] = [
  ['Look, we can do three dollars sixty a box, not a cent more.', 'unit_price_usd', 3.60],
  ['I need four ninety per box to make this work at that volume.', 'unit_price_usd', 4.90],
  ['Four forty a box. That is a real move.', 'unit_price_usd', 4.40],
  ['We could look at 4.05 a box if you commit the full fifty two weeks.', 'unit_price_usd', 4.05],
  ['Four dollars a box is my ceiling.', 'unit_price_usd', 4.00],
  ['four point one five per box', 'unit_price_usd', 4.15],
  ['Three ninety a box and we close today.', 'unit_price_usd', 3.90],
  ['Our treasury policy is sixty days.', 'payment_terms_days', 60],
  ['Payment terms are forty five days.', 'payment_terms_days', 45],
  ['I can commit twenty four hundred tonnes.', 'volume_mt', 2400],
  ['Twelve hundred MT in year one.', 'volume_mt', 1200],
  // Must NOT extract: no alias cue anywhere near the number.
  ['We have been doing this since nineteen ninety eight.', 'unit_price_usd', null],
  ['There are twelve of us on the buying team.', 'unit_price_usd', null],
];

let pass = 0;
let fail = 0;

for (const [speech, variable, expected] of cases) {
  const offers = extractOffers(speech, policies, redLines).filter((o) => o.variable === variable);
  const got = offers.length ? offers[0].value : null;
  const ok = expected === null ? got === null : got !== null && Math.abs(got - expected) < 0.001;
  if (ok) pass++;
  else fail++;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${variable.padEnd(18)} expected=${String(expected).padEnd(7)} got=${String(got).padEnd(7)} conf=${offers[0]?.confidence ?? '-'}  "${speech.slice(0, 52)}"`,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) throw new Error(`${fail} extraction case(s) failed`);
