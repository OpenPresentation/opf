// The chart types that take explicit reference lines. A module of its own: chart-data.ts (validation) and chart-references.ts
// (placement) both read it, and chart-references.ts imports chart-data.ts.

/** The chart types with one numeric value axis for every series: the clustered and stacked category charts and combo. */
export const CHART_REFERENCE_TYPES: ReadonlySet<string> = new Set(['column', 'bar', 'line', 'line-with-markers', 'area', 'combo', 'stacked-column', 'stacked-bar', 'stacked-line', 'stacked-line-with-markers', 'stacked-area']);
/** Stacked types: the axis is the stack total, and the PPTX export draws the reference over the chart (a helper series would be stacked). */
export const CHART_REFERENCE_STACKED: ReadonlySet<string> = new Set(['stacked-column', 'stacked-bar', 'stacked-line', 'stacked-line-with-markers', 'stacked-area']);
/** The horizontal types: the value axis runs across, so a reference is a vertical line. */
export const CHART_REFERENCE_HORIZONTAL: ReadonlySet<string> = new Set(['bar', 'stacked-bar']);
