// RR-35: chart options (axis titles, legend position, data labels).
//
// One normalisation and one support table for every engine. The preview
// (opf-render), the PPTX exporter and importer (opf-pptx) and the validator all
// read the same resolved options, so a chart that asks for something a type cannot
// show is adapted the same way everywhere and reported with the same
// `chart-option-adapted` diagnostic. Decks that carry none of the three fields
// resolve to `active: false` and nothing in any engine changes.

/** The chart constructs the engines draw. Every catalog chart type id resolves to one (see `chartOptionTarget`). */
export type ChartOptionKind = 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'treemap' | 'histogram' | 'pareto' | 'box' | 'waterfall' | 'funnel' | 'map';
export interface ChartOptionTarget {
  kind: ChartOptionKind;
  /** Stacked and 100% stacked columns, bars, lines and areas: their data labels have no outside-end position. */
  stacked?: boolean;
}
export type ChartLegendPosition = 'none' | 'top' | 'bottom' | 'left' | 'right';
export type ChartLabelContent = 'category' | 'value' | 'percent';
export type ChartLabelPosition = 'center' | 'inside-end' | 'inside-base' | 'outside-end' | 'above' | 'below' | 'left' | 'right';

export interface ChartOptionDiagnostic {
  code: 'chart-option-adapted';
  /** The option that was adapted: `axisTitles.category`, `axisTitles.value`, `legend`, `dataLabels`, `dataLabels.content`, `dataLabels.position` or `dataLabels.separator`. */
  option: string;
  reason: 'unsupported-type' | 'unsupported-content' | 'unsupported-position';
  message: string;
}

export interface ResolvedChartDataLabels {
  /** Canonical order: category, value, percent. Never empty. */
  content: ChartLabelContent[];
  /** The concrete position, or null for a construct whose labels have no position choice (area, doughnut, radar, treemap). */
  position: ChartLabelPosition | null;
  separator: string;
}

export interface ResolvedChartOptions {
  /** True when the chart carries at least one option (after adaptation); false means every engine keeps today's output. */
  active: boolean;
  axisTitles: {category?: string; value?: string};
  /** Undefined = no legend option: each engine keeps its default (a right legend on multi-series, pie and doughnut charts). */
  legend?: ChartLegendPosition;
  dataLabels?: ResolvedChartDataLabels;
  /** True when `dataLabels: false` switches off the labels a construct draws by default (funnel values, treemap category names). */
  dataLabelsOff?: boolean;
  diagnostics: ChartOptionDiagnostic[];
}

export interface ChartOptionSupport {
  axisTitles: {category: boolean; value: boolean};
  legend: boolean;
  dataLabels: {
    supported: boolean;
    content: readonly ChartLabelContent[];
    /** Empty when labels have no position choice. */
    positions: readonly ChartLabelPosition[];
    /** The position `auto` resolves to; null with no positions. */
    defaultPosition: ChartLabelPosition | null;
    /** True for the constructs that label their marks by default (funnel, treemap): `dataLabels: false` removes those labels. */
    defaultOn: boolean;
  };
}

const END_POSITIONS: readonly ChartLabelPosition[] = ['center', 'inside-end', 'inside-base', 'outside-end'];
const STACKED_POSITIONS: readonly ChartLabelPosition[] = ['center', 'inside-end', 'inside-base'];
const POINT_POSITIONS: readonly ChartLabelPosition[] = ['above', 'below', 'left', 'right', 'center'];
const PIE_POSITIONS: readonly ChartLabelPosition[] = ['center', 'inside-end', 'outside-end'];
const NONE: readonly ChartLabelPosition[] = [];
const VALUE_CATEGORY: readonly ChartLabelContent[] = ['category', 'value'];
const ALL_CONTENT: readonly ChartLabelContent[] = ['category', 'value', 'percent'];

const categoryKinds: ReadonlySet<ChartOptionKind> = new Set(['bar', 'line', 'area', 'scatter', 'histogram', 'pareto', 'box', 'waterfall', 'funnel']);
const valueKinds: ReadonlySet<ChartOptionKind> = new Set(['bar', 'line', 'area', 'scatter', 'histogram', 'pareto', 'box', 'waterfall']);
const legendKinds: ReadonlySet<ChartOptionKind> = new Set(['bar', 'line', 'area', 'pie', 'doughnut', 'scatter', 'radar', 'box']);

function labelSupport(target: ChartOptionTarget): ChartOptionSupport['dataLabels'] {
  const none: ChartOptionSupport['dataLabels'] = {supported: true, content: VALUE_CATEGORY, positions: NONE, defaultPosition: null, defaultOn: false};
  switch (target.kind) {
    case 'bar': return target.stacked
      ? {...none, positions: STACKED_POSITIONS, defaultPosition: 'center'}
      : {...none, positions: END_POSITIONS, defaultPosition: 'outside-end'};
    case 'line':
    case 'scatter': return {...none, positions: POINT_POSITIONS, defaultPosition: 'above'};
    case 'pie': return {...none, content: ALL_CONTENT, positions: PIE_POSITIONS, defaultPosition: 'outside-end'};
    case 'doughnut': return {...none, content: ALL_CONTENT};
    // The funnel labels its bars with values and the treemap its tiles with category names by default.
    case 'funnel':
    case 'treemap': return {...none, defaultOn: true};
    case 'area':
    case 'radar': return none;
    case 'histogram':
    case 'pareto':
    case 'waterfall': return {...none, positions: END_POSITIONS, defaultPosition: 'outside-end'};
    default: return {...none, supported: false, content: []};
  }
}

/** What a chart construct can show. The table the docs, the validator, the preview and the exporter all follow. */
export function chartOptionSupport(target: ChartOptionTarget): ChartOptionSupport {
  return {
    axisTitles: {category: categoryKinds.has(target.kind), value: valueKinds.has(target.kind)},
    legend: legendKinds.has(target.kind),
    dataLabels: labelSupport(target),
  };
}

// The catalog chart types that have a preview and a native export (the same set opf-render's CHART_TYPES keeps).
const KEPT: Readonly<Record<string, ChartOptionTarget>> = {
  column: {kind: 'bar'},
  'stacked-column': {kind: 'bar', stacked: true},
  '100pct-stacked-column': {kind: 'bar', stacked: true},
  bar: {kind: 'bar'},
  'stacked-bar': {kind: 'bar', stacked: true},
  '100pct-stacked-bar': {kind: 'bar', stacked: true},
  line: {kind: 'line'},
  'line-with-markers': {kind: 'line'},
  'stacked-line': {kind: 'line', stacked: true},
  'stacked-line-with-markers': {kind: 'line', stacked: true},
  area: {kind: 'area'},
  'stacked-area': {kind: 'area', stacked: true},
  '100pct-stacked-area': {kind: 'area', stacked: true},
  pie: {kind: 'pie'},
  doughnut: {kind: 'doughnut'},
  scatter: {kind: 'scatter'},
  radar: {kind: 'radar'},
  'radar-with-markers': {kind: 'radar'},
  'filled-radar': {kind: 'radar'},
  treemap: {kind: 'treemap'},
  histogram: {kind: 'histogram'},
  pareto: {kind: 'pareto'},
  'box-and-whisker': {kind: 'box'},
  waterfall: {kind: 'waterfall'},
  funnel: {kind: 'funnel'},
  world: {kind: 'map'},
};

/** The option target for a catalog chart type id; undefined for an id outside the catalog. */
export function chartOptionTarget(typeId: unknown): ChartOptionTarget | undefined {
  if (typeof typeId !== 'string') return undefined;
  const raw = typeId.trim().toLowerCase();
  const id = raw === 'donut' ? 'doughnut' : raw;
  const target = Object.hasOwn(KEPT, id) ? KEPT[id] : undefined;
  return target ? {...target} : undefined;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const LEGEND_POSITIONS: ReadonlySet<string> = new Set(['none', 'top', 'bottom', 'left', 'right']);
const CONTENT_ORDER: readonly ChartLabelContent[] = ['category', 'value', 'percent'];
const POSITIONS: ReadonlySet<string> = new Set(['auto', 'center', 'inside-end', 'inside-base', 'outside-end', 'above', 'below', 'left', 'right']);
export const DEFAULT_CHART_LABEL_SEPARATOR = ', ';

/**
 * Normalise a chart's `axisTitles`, `legend` and `dataLabels` against what its type can show. `target` is undefined for a chart type
 * outside the catalog: nothing is adapted then (the engines fall back to their legacy output for such charts anyway).
 */
export function resolveChartOptions(chart: unknown, target?: ChartOptionTarget): ResolvedChartOptions {
  const result: ResolvedChartOptions = {active: false, axisTitles: {}, diagnostics: []};
  if (!record(chart)) return result;
  const support = target ? chartOptionSupport(target) : undefined;
  const adapt = (option: string, reason: ChartOptionDiagnostic['reason'], message: string) => result.diagnostics.push({code: 'chart-option-adapted', option, reason, message});
  const kind = target?.kind ?? 'unknown';

  if (record(chart.axisTitles)) {
    for (const axis of ['category', 'value'] as const) {
      const raw = chart.axisTitles[axis];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      if (support && !support.axisTitles[axis]) {
        adapt(`axisTitles.${axis}`, 'unsupported-type', `A '${kind}' chart has no ${axis} axis to title; the ${axis} axis title is not drawn or exported.`);
        continue;
      }
      result.axisTitles[axis] = raw.trim();
    }
  }

  if (typeof chart.legend === 'string' && LEGEND_POSITIONS.has(chart.legend)) {
    if (support && !support.legend) adapt('legend', 'unsupported-type', `A '${kind}' chart has no legend option; the legend setting is ignored.`);
    else result.legend = chart.legend as ChartLegendPosition;
  }

  const labels = chart.dataLabels;
  if (labels === false && support?.dataLabels.defaultOn) result.dataLabelsOff = true;
  if (labels === true || record(labels)) {
    const options = record(labels) ? labels : {};
    if (support && !support.dataLabels.supported) {
      adapt('dataLabels', 'unsupported-type', `A '${kind}' chart has no data label option; data labels are not drawn or exported.`);
    } else {
      const allowed = support?.dataLabels.content ?? ALL_CONTENT;
      const requested = Array.isArray(options.content) ? options.content.filter((part): part is ChartLabelContent => typeof part === 'string' && (CONTENT_ORDER as readonly string[]).includes(part)) : ['value' as const];
      const content = CONTENT_ORDER.filter(part => requested.includes(part) && allowed.includes(part));
      for (const part of CONTENT_ORDER) {
        if (requested.includes(part) && !allowed.includes(part)) adapt('dataLabels.content', 'unsupported-content', `A '${kind}' chart cannot label '${part}'${part === 'percent' ? ' (percent exists only on pie and doughnut charts)' : ''}; it is dropped from the data labels.`);
      }
      if (!content.length) content.push('value');
      const positions = support?.dataLabels.positions ?? NONE;
      let position: ChartLabelPosition | null = support?.dataLabels.defaultPosition ?? null;
      if (typeof options.position === 'string' && POSITIONS.has(options.position) && options.position !== 'auto') {
        if (!support || positions.includes(options.position as ChartLabelPosition)) position = options.position as ChartLabelPosition;
        else adapt('dataLabels.position', 'unsupported-position', `A '${kind}'${target?.stacked ? ' stacked' : ''} chart cannot place data labels '${options.position}'; the type's default position is used.`);
      }
      let separator = typeof options.separator === 'string' ? options.separator : DEFAULT_CHART_LABEL_SEPARATOR;
      // A label is one line in every engine's drawing of it, so a separator never carries a line break.
      if (/[\r\n]/.test(separator)) {
        separator = separator.replace(/[\r\n]+/g, ' ');
        adapt('dataLabels.separator', 'unsupported-content', 'A data label is one line; the line break in the separator is replaced with a space.');
      }
      result.dataLabels = {content, position, separator};
    }
  }

  result.active = result.legend !== undefined || result.dataLabels !== undefined || result.dataLabelsOff === true || result.axisTitles.category !== undefined || result.axisTitles.value !== undefined;
  return result;
}

/** A General-format number as a label: at most twelve significant digits, no exponent unless the value needs one. */
export function formatChartLabelNumber(value: number): string {
  return String(Number(value.toPrecision(12)));
}

/** A share as PowerPoint's `0%` label. */
export function formatChartLabelPercent(share: number): string {
  return `${Math.round(Number((share * 100).toPrecision(12)))}%`;
}

/** The label text: the selected parts in the fixed order category, value, percent, joined by the separator. */
export function chartLabelText(parts: {category?: string; value?: string; percent?: string}, content: readonly ChartLabelContent[], separator = DEFAULT_CHART_LABEL_SEPARATOR): string {
  return CONTENT_ORDER.filter(part => content.includes(part) && parts[part] !== undefined).map(part => parts[part]).join(separator);
}
