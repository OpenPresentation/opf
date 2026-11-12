// The chart types that take explicit reference lines. A module of its own: chart-data.ts (validation) and chart-references.ts
// (placement) both read it, and chart-references.ts imports chart-data.ts.

/** The chart types with one numeric value axis for every series: the clustered category charts and combo. */
export const CHART_REFERENCE_TYPES: ReadonlySet<string> = new Set(['column', 'bar', 'line', 'line-with-markers', 'area', 'combo']);
