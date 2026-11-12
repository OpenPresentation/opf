/** The smallest share of the whole range one event can take, so an extreme but schema-valid ratio never produces an empty range. */
export const TIMELINE_MIN_DURATION_SHARE = 1e-6;

/** Consecutive relative event ranges. Omission is one unit; no authored duration preserves the ordinary milestone layout. */
export function timelineDurationFractions(values: readonly (number | undefined)[]): {start: number; size: number}[] | undefined {
  if (!values.some(value => value !== undefined)) return undefined;
  if (values.some(value => value !== undefined && (!Number.isFinite(value) || value <= 0))) throw new RangeError('Timeline event duration must be a finite positive number.');
  const weights = values.map(value => value ?? 1), largest = weights.reduce((maximum, value) => Math.max(maximum, value), 0);
  // Divide by the largest first so a duration near the double maximum cannot overflow the sum; a share that then rounds to
  // zero (1e300 beside 1e-300) or vanishes in the total (1 beside 1e-17) takes the minimum share instead of throwing.
  const normalized = weights.map(value => Math.max(value / largest, TIMELINE_MIN_DURATION_SHARE));
  const total = normalized.reduce((sum, value) => sum + value, 0);
  let start = 0;
  return normalized.map((value, index) => {
    const size = index === values.length - 1 ? 1 - start : value / total;
    const interval = {start, size};
    start += size;
    return interval;
  });
}
