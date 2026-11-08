/** Consecutive relative event ranges. Omission is one unit; no authored duration preserves the ordinary milestone layout. */
export function timelineDurationFractions(values: readonly (number | undefined)[]): {start: number; size: number}[] | undefined {
  if (!values.some(value => value !== undefined)) return undefined;
  if (values.some(value => value !== undefined && (!Number.isFinite(value) || value <= 0))) throw new RangeError('Timeline event duration must be a finite positive number.');
  const weights = values.map(value => value ?? 1), largest = weights.reduce((maximum, value) => Math.max(maximum, value), 0);
  const normalized = weights.map(value => value / largest);
  if (normalized.some(value => value === 0)) throw new RangeError('Timeline duration ratios exceed finite layout precision.');
  const total = normalized.reduce((sum, value) => sum + value, 0);
  let start = 0;
  return normalized.map((value, index) => {
    const size = index === values.length - 1 ? 1 - start : value / total;
    if (!(size > 0)) throw new RangeError('Timeline duration ratios exceed finite layout precision.');
    const interval = {start, size};
    start += size;
    return interval;
  });
}
