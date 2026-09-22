/**
 * Offer extraction: spoken utterance → quantified, variable-tagged offers.
 *
 * Deliberately NOT an LLM call. It runs on every utterance inside the turn
 * window, where an inference would reintroduce the latency the architecture
 * exists to avoid, and where a hallucinated figure is worse than a missed one.
 * Anything this misses is recovered from the Tavus objective callbacks, which
 * ARE model-extracted but arrive per phase rather than per utterance.
 *
 * Disambiguation is range-driven. The parser hands back every reading a human
 * could have meant ("four ninety" → 4.90 | 490 | 94); the extractor keeps the
 * one that is possible for that variable given its negotiation range. This is
 * what lets one code path handle price (4.90), volume (2400) and terms (45)
 * without variable-specific regex.
 */

import { parseNumbers, type NumberCandidate } from './numberParser';
import type { ConcessionPolicy, RedLine } from './types';

/**
 * A variable the ledger tracks. Derived from concession policies (which give a
 * true range) and from red lines (which give only a bound, so the range is
 * inferred). Red-line-only variables matter: payment terms often have a hard
 * limit and no concession curve, and missing them was a real defect.
 */
export interface TrackedVariable {
  variable: string;
  unit: string;
  /** Plausible low/high bound for a spoken value on this variable. */
  lo: number;
  hi: number;
  aliases: string[];
  /** True when the range came from a policy rather than being inferred. */
  ranged: boolean;
}

const KNOWN_ALIASES: Record<string, string[]> = {
  unit_price_usd: ['price', 'per box', 'a box', 'per case', 'a case', 'per kilo', 'per kg', 'a kilo', 'dollars', 'dollar', 'usd', '$', 'fob', 'landed'],
  payment_terms_days: ['days', 'payment terms', 'terms', 'net', 'payment'],
  volume_mt: ['tonnes', 'tons', 'mt', 'metric tons', 'volume', 'boxes', 'containers', 'cases'],
  discount_pct: ['percent', '%', 'discount', 'rebate', 'off'],
  contract_months: ['months', 'month', 'term', 'weeks', 'duration'],
};

/** Derives alias cues from the unit string, e.g. "USD/box" → usd, box, per box. */
function aliasesFromUnit(unit: string): string[] {
  const parts = unit.toLowerCase().split(/[\/\s,]+/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    out.push(`per ${p}`);
    out.push(`a ${p}`);
  }
  return out;
}

export function buildTrackedVariables(
  policies: ConcessionPolicy[],
  redLines: RedLine[],
): TrackedVariable[] {
  const byVar = new Map<string, TrackedVariable>();

  for (const p of policies) {
    const lo = Math.min(p.openingValue, p.reservationValue);
    const hi = Math.max(p.openingValue, p.reservationValue);
    const span = hi - lo || Math.abs(hi) || 1;
    byVar.set(p.variable, {
      variable: p.variable,
      unit: p.unit,
      // Allow 3x the span beyond either end: an aggressive opening from the
      // human legitimately sits well outside the persona's own range.
      lo: lo - span * 3,
      hi: hi + span * 3,
      aliases: dedupe([
        p.variable.replace(/_/g, ' '),
        ...aliasesFromUnit(p.unit),
        ...(KNOWN_ALIASES[p.variable] ?? []),
      ]),
      ranged: true,
    });
  }

  for (const r of redLines) {
    if (byVar.has(r.variable)) continue;
    // No policy: infer a range around the threshold. Wide enough to catch a
    // real offer, tight enough to reject a stray year or quantity.
    const t = Math.abs(r.threshold) || 1;
    byVar.set(r.variable, {
      variable: r.variable,
      unit: r.unit,
      lo: r.comparator === 'min' ? 0 : Math.max(0, r.threshold - t * 2),
      hi: r.comparator === 'min' ? r.threshold + t * 3 : r.threshold + t * 2,
      aliases: dedupe([
        r.variable.replace(/_/g, ' '),
        ...aliasesFromUnit(r.unit),
        ...(KNOWN_ALIASES[r.variable] ?? []),
      ]),
      ranged: false,
    });
  }

  return Array.from(byVar.values());
}

export interface ExtractedOffer {
  variable: string;
  value: number;
  unit: string;
  quote: string;
  /** 0..1. Proximity of the alias cue plus reading quality. */
  confidence: number;
  reading: NumberCandidate['reading'];
}

/** Max characters between a number and its alias cue for them to be related. */
const PROXIMITY = 28;

/**
 * Locates an alias on word boundaries.
 *
 * Raw substring search is not safe here and produced a real defect: the alias
 * "net" matched inside "ninety", so "three ninety a box" was booked as a
 * payment-terms offer of 3.9 days. Aliases made of word characters are matched
 * with boundaries; symbol aliases such as "$" and "%" are matched literally,
 * since they have no word boundary to anchor against.
 */
function findCue(haystack: string, alias: string): number[] {
  const out: number[] = [];
  const symbolic = !/^[a-z0-9]/i.test(alias) || !/[a-z0-9]$/i.test(alias);

  if (symbolic) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(alias, from);
      if (at === -1) break;
      out.push(at);
      from = at + alias.length;
    }
    return out;
  }

  const re = new RegExp(`(?<![a-z0-9])${escapeRe(alias)}(?![a-z0-9])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack)) !== null) out.push(m.index);
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractOffers(
  speech: string,
  policies: ConcessionPolicy[],
  redLines: RedLine[] = [],
): ExtractedOffer[] {
  const tracked = buildTrackedVariables(policies, redLines);
  if (tracked.length === 0) return [];

  const lower = speech.toLowerCase();
  const candidates = parseNumbers(speech);
  if (candidates.length === 0) return [];

  // Every alias cue present in the utterance, tagged with its variable.
  const cues: { v: TrackedVariable; alias: string; at: number }[] = [];
  for (const v of tracked) {
    for (const alias of v.aliases) {
      for (const at of findCue(lower, alias)) cues.push({ v, alias, at });
    }
  }
  if (cues.length === 0) return [];

  // Group the candidate readings by the number run they came from.
  const runs = new Map<number, NumberCandidate[]>();
  for (const c of candidates) {
    const arr = runs.get(c.index) ?? [];
    arr.push(c);
    runs.set(c.index, arr);
  }

  const results: ExtractedOffer[] = [];

  /**
   * Competitive assignment: each number run belongs to exactly ONE variable —
   * the one whose cue sits closest to it and for which at least one reading is
   * physically possible.
   *
   * Assigning independently per variable was the defect that put a price into
   * the payment-terms series: in "Payment terms are sixty days regardless, on
   * price four dollars a box", the "4" sits 37 characters from "terms" and one
   * character from "box". Only the nearest cue may claim it.
   */
  for (const [, readings] of runs) {
    let best: { cue: (typeof cues)[number]; reading: NumberCandidate; d: number } | null = null;

    for (const cue of cues) {
      const viable = readings.filter((r) => r.value >= cue.v.lo && r.value <= cue.v.hi);
      if (viable.length === 0) continue;
      const d = distance(readings[0].index, readings[0].length, cue.at, cue.alias.length);
      if (d > PROXIMITY) continue;
      // Ties break toward the more specific cue (the longer alias).
      if (!best || d < best.d || (d === best.d && cue.alias.length > best.cue.alias.length)) {
        best = { cue, reading: pickReading(viable, cue.v), d };
      }
    }

    if (!best) continue;
    results.push({
      variable: best.cue.v.variable,
      value: best.reading.value,
      unit: best.cue.v.unit,
      quote: speech.trim(),
      confidence: scoreConfidence(best.d, best.reading, readings.length, best.cue.v),
      reading: best.reading.reading,
    });
  }

  return dedupeOffers(results);
}

/**
 * Chooses between competing readings of the same spoken run.
 *
 * A price variable whose whole range sits under 100 cannot mean 490 when the
 * speaker said "four ninety", so the decimal reading wins. A volume variable in
 * the thousands takes the concatenated reading. The variable's own range makes
 * the call — no hardcoded knowledge of what a price looks like.
 */
function pickReading(readings: NumberCandidate[], v: TrackedVariable): NumberCandidate {
  const rangeMax = Math.max(Math.abs(v.lo), Math.abs(v.hi));
  const priority: NumberCandidate['reading'][] =
    rangeMax < 100 ? ['decimal_split', 'literal', 'digit_concat', 'sum'] : ['digit_concat', 'literal', 'decimal_split', 'sum'];

  for (const r of priority) {
    const hit = readings.find((c) => c.reading === r);
    if (hit) return hit;
  }
  return readings[0];
}

function scoreConfidence(
  distanceChars: number,
  chosen: NumberCandidate,
  competing: number,
  v: TrackedVariable,
): number {
  let c = 0.9 - Math.min(0.35, distanceChars / PROXIMITY * 0.35);
  if (competing > 1) c -= 0.1;            // the run was ambiguous
  if (!v.ranged) c -= 0.1;                // range was inferred, not declared
  if (chosen.reading === 'digit_concat' || chosen.reading === 'decimal_split') c -= 0.05;
  return Math.max(0.2, Math.round(c * 100) / 100);
}

function distance(aStart: number, aLen: number, bStart: number, bLen: number): number {
  if (aStart + aLen <= bStart) return bStart - (aStart + aLen);
  if (bStart + bLen <= aStart) return aStart - (bStart + bLen);
  return 0;
}

function dedupeOffers(offers: ExtractedOffer[]): ExtractedOffer[] {
  const seen = new Map<string, ExtractedOffer>();
  for (const o of offers) {
    const k = `${o.variable}:${o.value}`;
    const prev = seen.get(k);
    if (!prev || o.confidence > prev.confidence) seen.set(k, o);
  }
  return Array.from(seen.values());
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0)));
}
