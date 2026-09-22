/**
 * Spoken-number parser for negotiation transcripts.
 *
 * This is the most failure-prone surface in the whole system and the one with
 * the worst failure mode: a misread number does not produce an error, it
 * produces a confident, quotable, wrong ledger. So the parser is deliberately
 * ambiguity-preserving — it returns every reading a human could have meant and
 * lets the caller disambiguate using the variable's own plausible range.
 *
 * Negotiators speak numbers in compound decimal shorthand that no naive
 * word-to-digit map handles:
 *
 *   "four ninety a box"          → 4.90   (not 490, not 94)
 *   "three dollars sixty"        → 3.60
 *   "four twenty"                → 4.20
 *   "four dollars a box"         → 4.00
 *   "forty five days"            → 45
 *   "twenty four hundred tonnes" → 2400
 *   "four point one five"        → 4.15
 *
 * Strategy: segment each run of number words into groups (currency words and
 * "point" act as group boundaries), then emit candidate readings — digit
 * concatenation, decimal split, and plain sum. The caller keeps whichever
 * candidate falls inside the negotiation's range for that variable.
 */

const UNITS: Record<string, number> = {
  zero: 0, oh: 0, nought: 0,
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9,
};

const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1000, million: 1_000_000, k: 1000,
};

/** Words that separate the integer part from the fractional part. */
const BOUNDARY = new Set([
  'point', 'dollars', 'dollar', 'euros', 'euro', 'usd', 'eur', 'bucks', 'and',
]);

/** Punctuation that ends a number run. A clause boundary is never inside one. */
const TERMINATOR = new Set(['.', ',', ';', ':', '!', '?']);

/** Words that may appear inside a number run without breaking it. */
const FILLER = new Set(['a', 'the', 'about', 'around', 'roughly', 'just', 'maybe']);

function isNumberWord(w: string): boolean {
  return w in UNITS || w in TEENS || w in TENS || w in SCALES || /^-?[\d][\d,]*(\.\d+)?$/.test(w);
}

interface Group {
  /** Digit string as spoken, e.g. "4", "90", "2400". */
  digits: string;
  value: number;
}

/**
 * Collapses one group of number words into a value.
 * "forty five" → 45, "twenty four hundred" → 2400, "ninety" → 90, "4.05" → 4.05
 */
function reduceGroup(words: string[]): Group | null {
  if (words.length === 0) return null;

  // Literal digits short-circuit.
  if (words.length === 1 && /^-?[\d][\d,]*(\.\d+)?$/.test(words[0])) {
    const v = Number(words[0].replace(/,/g, ''));
    return Number.isFinite(v) ? { digits: words[0].replace(/,/g, ''), value: v } : null;
  }

  let total = 0;
  let current = 0;
  let seen = false;

  for (const w of words) {
    if (w in UNITS) { current += UNITS[w]; seen = true; }
    else if (w in TEENS) { current += TEENS[w]; seen = true; }
    else if (w in TENS) { current += TENS[w]; seen = true; }
    else if (w in SCALES) {
      const s = SCALES[w];
      if (s >= 1000) { total += (current || 1) * s; current = 0; }
      else { current = (current || 1) * s; }
      seen = true;
    } else if (/^-?[\d][\d,]*(\.\d+)?$/.test(w)) {
      current += Number(w.replace(/,/g, ''));
      seen = true;
    }
  }
  if (!seen) return null;
  const value = total + current;
  return { digits: String(value), value };
}

export interface NumberCandidate {
  value: number;
  /** Character offset of the number run in the normalized string. */
  index: number;
  length: number;
  /** How the reading was derived — used only for diagnostics. */
  reading: 'literal' | 'decimal_split' | 'digit_concat' | 'sum';
  /** Verbatim span of the run. */
  span: string;
}

/**
 * Extracts every plausible numeric reading from an utterance.
 *
 * Returns candidates, not answers. "four ninety" yields both 4.90 and 490; the
 * caller decides which is possible for the variable in question. This is what
 * makes the parser safe across price (4.90), volume (2400) and terms (45)
 * without per-variable regex.
 */
export function parseNumbers(text: string): NumberCandidate[] {
  const lower = text.toLowerCase();
  /**
   * Punctuation is tokenized rather than discarded, because a sentence boundary
   * has to terminate a number run. Dropping it merged "three sixty. Three
   * dollars sixty a box" into a single run that reduced to 66.60 — so the
   * counterparty's opening anchor of 3.60 vanished from the ledger entirely.
   * A decimal point inside a figure is already captured by the number pattern,
   * so it never reaches the punctuation branch.
   */
  const tokens = lower.match(/[a-z]+|-?\d[\d,]*(?:\.\d+)?|%|[.,;:!?]/g) ?? [];

  // Re-derive offsets so quotes and proximity checks stay accurate.
  const offsets: number[] = [];
  let cursor = 0;
  for (const t of tokens) {
    const at = lower.indexOf(t, cursor);
    offsets.push(at);
    cursor = at + t.length;
  }

  const out: NumberCandidate[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (!isNumberWord(tokens[i])) { i++; continue; }

    // Walk a maximal run: number words, boundaries and filler between them.
    const runStart = i;
    const groups: string[][] = [[]];
    /**
     * True when the group was opened by an explicit "point". After "point",
     * digits are spoken one at a time ("four point one five" = 4.15), so they
     * must be concatenated as digits rather than summed — summing gives 4.6,
     * which is a different price and a wrong ledger row.
     */
    const afterPoint: boolean[] = [false];
    let sawBoundary = false;

    while (i < tokens.length) {
      const t = tokens[i];
      if (TERMINATOR.has(t)) break;
      if (isNumberWord(t)) {
        groups[groups.length - 1].push(t);
        i++;
      } else if (BOUNDARY.has(t) && groups[groups.length - 1].length > 0) {
        // Only open a new group if a number actually follows.
        let j = i + 1;
        while (j < tokens.length && FILLER.has(tokens[j])) j++;
        if (j < tokens.length && isNumberWord(tokens[j])) {
          groups.push([]);
          afterPoint.push(t === 'point');
          sawBoundary = true;
          i = j;
        } else break;
      } else if (FILLER.has(t) && groups[groups.length - 1].length > 0) {
        // Filler only continues the run if a number follows it.
        let j = i + 1;
        while (j < tokens.length && FILLER.has(tokens[j])) j++;
        if (j < tokens.length && isNumberWord(tokens[j]) && !sawBoundary) break;
        break;
      } else break;
    }

    const runEnd = i - 1;
    const index = offsets[runStart];
    const length = offsets[runEnd] + tokens[runEnd].length - index;
    const span = lower.slice(index, index + length);

    const reduced = groups.map(reduceGroup).filter((g): g is Group => g !== null);
    if (reduced.length === 0) continue;

    if (reduced.length === 1) {
      const g = reduced[0];
      // "four ninety" reduces to 94 as a bare sum, which is NOT a form English
      // speakers use — you would say "ninety four". So when the unit-then-tens
      // shorthand is present, the sum reading is suppressed entirely and only
      // the decimal (4.90) and concatenated (490) readings survive. Leaving it
      // in was producing phantom offers on unrelated variables.
      const split = splitUnitTens(groups[0]);
      if (split) {
        out.push({ value: split.decimal, index, length, reading: 'decimal_split', span });
        out.push({ value: split.concat, index, length, reading: 'digit_concat', span });
      } else {
        out.push({ value: g.value, index, length, reading: 'literal', span });
      }
    } else {
      // Multiple groups: "three dollars sixty" / "four point one five".
      const head = reduced[0];
      const fracDigits = groups
        .slice(1)
        .map((words, idx) => (afterPoint[idx + 1] ? spokenDigits(words) : reduceGroup(words)?.digits ?? ''))
        .join('');
      const decimal = Number(`${head.value}.${fracDigits}`);
      const concat = Number(`${head.digits}${fracDigits}`);
      if (Number.isFinite(decimal)) out.push({ value: decimal, index, length, reading: 'decimal_split', span });
      if (Number.isFinite(concat)) out.push({ value: concat, index, length, reading: 'digit_concat', span });
      out.push({ value: head.value, index, length, reading: 'literal', span });
    }
  }

  return out;
}

/**
 * Renders a group of number words as the digits a speaker enunciated.
 * ["one","five"] → "15";  ["zero","five"] → "05";  ["fifteen"] → "15"
 */
function spokenDigits(words: string[]): string {
  let out = '';
  for (const w of words) {
    if (w in UNITS) out += String(UNITS[w]);
    else if (w in TEENS) out += String(TEENS[w]);
    else if (w in TENS) out += String(TENS[w]);
    else if (/^\d+$/.test(w)) out += w;
  }
  return out;
}

/**
 * Detects the "unit then tens" shorthand inside a single group and returns the
 * readings a negotiator could have meant.
 *   ["four","ninety"]       → decimal 4.90,  concat 490
 *   ["four","ninety","five"]→ decimal 4.95,  concat 495
 *   ["four"]                → null (unambiguous)
 */
function splitUnitTens(words: string[]): { decimal: number; concat: number } | null {
  const nums = words.filter((w) => w in UNITS || w in TEENS || w in TENS);
  if (nums.length < 2) return null;
  if (!(nums[0] in UNITS)) return null;
  const head = UNITS[nums[0]];

  const rest = nums.slice(1);
  if (!(rest[0] in TENS) && !(rest[0] in TEENS)) return null;

  let frac = rest[0] in TENS ? TENS[rest[0]] : TEENS[rest[0]];
  if (rest.length > 1 && rest[1] in UNITS && rest[0] in TENS) frac += UNITS[rest[1]];

  const fracStr = String(frac).padStart(2, '0');
  return {
    decimal: Number(`${head}.${fracStr}`),
    concat: Number(`${head}${fracStr}`),
  };
}

export { UNITS, TENS, TEENS, SCALES };
