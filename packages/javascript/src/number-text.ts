/**
 * Numbers written as text (LH-117, LH-118). Pure: no fonts, DOM or catalogs.
 *
 * - {@link numericText}: whether a cell reads as a number (a table column of them right-aligns, LH-117).
 * - {@link numberRanges} and {@link isolateNumbers}: the numbers of a text that read left to right inside right-to-left text (LH-118). The
 *   preview wraps each in a left-to-right isolate (LRI ... PDI); the PPTX export writes each as its own en-US run, which PowerPoint
 *   orders left to right (it draws LRI and PDI as visible boxes).
 */

// A number inside text: an optional sign (+, -, U+2212, U+00B1) that does not follow a letter or digit (there it is an operator or a
// hyphen: "x+1", "3-5"), an optional currency sign, ASCII digits joined by group and decimal separators, a time or date separator, or a
// hyphen or en dash between digits (1,234.5; 1 234,5 with a no-break or thin space; 10:30; 2026-11-02; 10-20), then an optional percent,
// per-mille or currency sign. A plain space never joins ("3 5" is two numbers). Arabic-Indic digits keep their own bidi class (AN) and
// order themselves.
const NUMBER_IN_TEXT = /(?:(?<![\p{L}\p{N}])[+\-−±])?\p{Sc}?[0-9]+(?:[.,:/'٫٬   ‐‑–-][0-9]+)*(?:[%‰٪]|\p{Sc})?/gu;

// The marks that make a number read wrongly in right-to-left text: a sign or currency before it, a percent, per-mille or currency sign
// after it.
const SIGNED_START = /^[+\-−±\p{Sc}]/u, SIGNED_END = /[%‰٪\p{Sc}]$/u;

/**
 * LH-118: the [start, end) ranges of the signed numbers in `text` (see NUMBER_IN_TEXT above): those with a sign or currency before them or
 * a percent or currency sign after them. "+16%" is one range, so in right-to-left text it keeps its sign before its digits. Bare digits
 * ("2026", "1,200", "10:30") are left out: they read the same left to right in either direction, in the preview and in PowerPoint.
 */
export function numberRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const match of String(text ?? '').matchAll(NUMBER_IN_TEXT)) {
    if (SIGNED_START.test(match[0]) || SIGNED_END.test(match[0])) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/** Left-to-right isolate (U+2066) and pop directional isolate (U+2069). */
export const LEFT_TO_RIGHT_ISOLATE = String.fromCharCode(0x2066), POP_DIRECTIONAL_ISOLATE = String.fromCharCode(0x2069);

/**
 * LH-118: `text` with every number ({@link numberRanges}) wrapped in a left-to-right isolate, for text drawn right to left: "+16%" in an
 * Arabic metric drew as "16%+" (the sign, a neutral at the paragraph start, took the paragraph's right-to-left direction). Text without
 * a number is returned unchanged.
 */
export function isolateNumbers(text: string): string {
  const ranges = numberRanges(text);
  if (!ranges.length) return text;
  let result = '', copied = 0;
  for (const [start, end] of ranges) {
    result += text.slice(copied, start) + LEFT_TO_RIGHT_ISOLATE + text.slice(start, end) + POP_DIRECTIONAL_ISOLATE;
    copied = end;
  }
  return result + text.slice(copied);
}

// A cell that reads as a number: an optional comparison or approximation mark, an optional sign, an optional currency (a sign, or a
// three-letter code), digits with group and decimal separators (or a leading decimal point), an optional scale (K, M, B, bn, ...), an
// optional percent or currency sign or multiplier, and an optional one-word unit (50 GB, 12 months, 4 pts); accounting parentheses
// around it ("(1,200)"). Dates, times, fractions and ranges ("24/7", "10:30", "2026-11-02") read as text.
const NUMERIC_TEXT = /^\(?[~≈<>≤≥]?\s?[+\-−±]?(?:\p{Sc}|[A-Z]{3}\s?|[A-Z]{1,2}\p{Sc})?\s?(?:[0-9]+(?:[.,'٫٬   ][0-9]+)*|[.,][0-9]+)(?:\s?(?:[KkMmBbTt]|bn|mn|tn)(?!\p{L}))?(?:\s?(?:[%‰٪]|\p{Sc}|[x×](?!\p{L})))?(?:\s?[\p{L}°µ][\p{L}\p{M}°²³/.]{0,11})?\)?$/u;

/**
 * LH-117: whether a table cell's text reads as a number: a number with an optional sign, currency, thousands separators, percent sign,
 * scale or short unit ("$1.2M", "-3.5%", "14,500", "50 GB", "(1,200)"). A column whose body cells mostly read so is aligned as numbers.
 */
export function numericText(text: string): boolean {
  const value = String(text ?? '').trim();
  return value.length > 0 && value.length <= 40 && NUMERIC_TEXT.test(value);
}
