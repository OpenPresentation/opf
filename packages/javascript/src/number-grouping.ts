// LH-141: whole numbers of four or more digits print with their thousands grouped by the deck language ("6,240"; "6.240" in German),
// wherever the author wrote no number format: chart value labels, the doughnut hole and the pie value list, the end labels of a line,
// and a metric's numeric value. A number format the author wrote is the author's and is never regrouped.

/** A whole number groups its thousands from this magnitude (four integer digits). */
export const NUMBER_GROUPING_MIN = 1000;

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * `value` in the General form (at most twelve significant digits) with its thousands grouped by the language's locale (`Intl`, English
 * when the tag is missing or unknown; a locale that groups only from five digits, Spanish, leaves four digits as they are). A number that
 * is not finite is its plain text.
 */
export function groupNumber(value: number, language?: string): string {
  if (!Number.isFinite(value)) return String(value);
  const key = language ?? '';
  let formatter = formatters.get(key);
  if (!formatter) {
    try { formatter = new Intl.NumberFormat(language || 'en', {useGrouping: true, maximumFractionDigits: 12}); }
    catch { formatter = new Intl.NumberFormat('en', {useGrouping: true, maximumFractionDigits: 12}); }
    formatters.set(key, formatter);
  }
  return formatter.format(Number(value.toPrecision(12)));
}

/**
 * True when a series' default value labels group their thousands: every value it has is a whole number (a safe integer: values past 2^53 are not counts) and one reaches four digits. A
 * series of fractions keeps the General form, which PowerPoint's own label format (`#,##0`, written for a series that groups) could not
 * print as the preview does.
 */
export function groupsThousands(values: readonly (number | null | undefined)[]): boolean {
  let large = false;
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (!Number.isSafeInteger(value)) return false;
    if (Math.abs(value) >= NUMBER_GROUPING_MIN) large = true;
  }
  return large;
}

/**
 * True when a value axis groups the thousands of its tick labels: its own ticks (the minimum and every major unit up to the maximum) are
 * whole numbers and one reaches four digits (`groupsThousands`). Only an axis with no number format of its own and no share scale asks.
 */
export function groupsAxisTicks(axis: {min: number; max: number; majorUnit: number}): boolean {
  if (!(axis.majorUnit > 0) || !Number.isFinite(axis.max - axis.min) || (axis.max - axis.min) / axis.majorUnit > 1000) return false;
  const ticks: number[] = [];
  for (let index = 0, count = Math.floor((axis.max - axis.min) / axis.majorUnit + 1e-9); index <= count; index++) ticks.push(Number((axis.min + index * axis.majorUnit).toPrecision(12)));
  return groupsThousands(ticks);
}

/** The number format code PowerPoint prints a grouping series' labels with, as `groupNumber` does (its separators follow the viewer's region). */
export const GROUPED_LABEL_CODE = '#,##0';
