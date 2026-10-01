// chartEx-aware chart probes for the presence audit B and the parity harness (FF-56, FF-38). Pure: no I/O.
//
// opf-pptx 0.11.6 (`toPptx` chartex mode 'auto') writes the treemap, histogram, pareto, box-and-whisker, waterfall and funnel as native
// Office 2016 chartex parts. Each is an mc:AlternateContent: the Choice is a p:graphicFrame whose graphicData holds <cx:chart r:id> (a
// relationship of type .../2014/relationships/chartEx to a cx:chartSpace part) and the Fallback is a classic c:chart frame (a clustered
// column) that older consumers draw. A reader that understands chartex (PowerPoint 2016+, fromPptx) uses the Choice, so the audits read the
// chartex part and never the fallback frame. `world` stays on the clustered column fallback (PowerPoint's map needs online geodata).
//
// The core catalog names each kept chart type's construct in `mappings.openxml` (`element`, and `extension` for the Pareto line). The cx
// layoutId of the series follows from that element, so an id and its part are tied through the catalog, not through a list in the audit.

/** The cx:series layoutId a catalog `mappings.openxml.element` stands for (the histogram is a clusteredColumn series with binning). */
export const CX_LAYOUT_BY_ELEMENT = Object.freeze({treemapChart: 'treemap', histogramChart: 'clusteredColumn', boxWhiskerChart: 'boxWhisker', waterfallChart: 'waterfall', funnelChart: 'funnel', mapChart: 'regionMap'});
/** The cx:series layoutId an `extension` stands for (an owned series). */
export const CX_LAYOUT_BY_EXTENSION = Object.freeze({'cx:paretoLine': 'paretoLine'});

/**
 * Per kept chartex chart type: its catalog element and the layoutIds its chartex part carries, from the catalog records alone.
 * @param {Array<{id:string, deprecation?:object, mappings?:{openxml?:{element?:string, composition?:string, extension?:string}}}>} chartTypes
 * @returns {Map<string,{id:string, element:string, extension:string|null, layouts:string[]}>}
 */
export function chartexExpectations(chartTypes) {
  const out = new Map();
  for (const record of chartTypes) {
    if (record.deprecation) continue;
    const ox = record.mappings?.openxml ?? {};
    if (ox.composition !== 'extension' || !CX_LAYOUT_BY_ELEMENT[ox.element]) continue;
    const layouts = [CX_LAYOUT_BY_ELEMENT[ox.element]];
    if (ox.extension) { if (!CX_LAYOUT_BY_EXTENSION[ox.extension]) continue; layouts.push(CX_LAYOUT_BY_EXTENSION[ox.extension]); }
    out.set(record.id, {id: record.id, element: ox.element, extension: ox.extension ?? null, layouts});
  }
  return out;
}

/** The chart id whose catalog layouts are exactly the layoutIds of a part (the Pareto's two series before the histogram's one), or null. */
export function chartIdFromLayouts(expectations, layoutIds) {
  const have = [...new Set(layoutIds)].sort().join('|');
  for (const exp of expectations.values()) if ([...exp.layouts].sort().join('|') === have) return exp.id;
  return null;
}

const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
const attrsOf = s => Object.fromEntries([...String(s).matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], unesc(m[2])]));
const points = block => [...String(block).matchAll(/<cx:pt idx="(\d+)">([\s\S]*?)<\/cx:pt>/g)].map(m => unesc(m[2]));
const uniq = a => [...new Set(a)];

/**
 * What a cx:chartSpace carries, read from its XML: the series layoutIds (with ownerIdx), the category and value caches, every series colour
 * (fills and a:ln of the series and its data points, not the label or axis text), the text properties (faces, sizes, colours of every
 * cx:txPr) and the binning and quartile settings.
 */
export function parseChartex(xml) {
  const text = String(xml);
  const series = [...text.matchAll(/<cx:series\b([^>]*)>([\s\S]*?)<\/cx:series>/g)].map(m => {
    const a = attrsOf(m[1]); const body = m[2];
    const own = body.replace(/<cx:dataLabels\b[\s\S]*?<\/cx:dataLabels>/g, '');
    return {layoutId: a.layoutId, ownerIdx: a.ownerIdx ?? null, colors: uniq([...own.matchAll(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g)].map(x => x[1].toUpperCase())), name: body.match(/<cx:tx>[\s\S]*?<cx:v>([\s\S]*?)<\/cx:v>/)?.[1] ?? null, binning: /<cx:binning\b/.test(body), aggregation: /<cx:aggregation\b/.test(body), statistics: body.match(/<cx:statistics\b([^>]*)\/?>/)?.[1] ? attrsOf(body.match(/<cx:statistics\b([^>]*)\/?>/)[1]) : null, dataPoints: [...body.matchAll(/<cx:dataPt idx="(\d+)">/g)].length};
  });
  const strDims = [...text.matchAll(/<cx:strDim\b([^>]*)>([\s\S]*?)<\/cx:strDim>/g)].map(m => ({type: attrsOf(m[1]).type, values: points(m[2])}));
  const numDims = [...text.matchAll(/<cx:numDim\b([^>]*)>([\s\S]*?)<\/cx:numDim>/g)].map(m => ({type: attrsOf(m[1]).type, values: points(m[2]).map(Number)}));
  const txPr = [...text.matchAll(/<cx:txPr>([\s\S]*?)<\/cx:txPr>/g)].map(m => m[1]);
  return {
    layouts: series.map(s => s.layoutId), series, strDims, numDims,
    categories: strDims.find(d => d.type === 'cat')?.values ?? [], values: numDims.find(d => d.type === 'val' || d.type === 'size')?.values ?? [],
    colors: uniq(series.flatMap(s => s.colors)),
    typefaces: uniq(txPr.flatMap(t => [...t.matchAll(/<a:latin typeface="([^"]*)"/g)].map(m => m[1]))),
    sizes: uniq(txPr.flatMap(t => [...t.matchAll(/<a:defRPr\b[^>]*\bsz="(\d+)"/g)].map(m => +m[1]))),
    textColors: uniq(txPr.flatMap(t => [...t.matchAll(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase()))),
    quartileMethod: text.match(/<cx:statistics\b[^>]*quartileMethod="(\w+)"/)?.[1] ?? null,
    strings: uniq([...strDims.flatMap(d => d.values), ...series.map(s => s.name).filter(Boolean)]),
  };
}

/** Replace each mc:AlternateContent by the inner markup of its Choice: what a consumer that understands the Choice's requirement draws. */
export function chooseAlternateContent(xml) {
  return String(xml).replace(/<mc:AlternateContent\b[^>]*>([\s\S]*?)<\/mc:AlternateContent>/g, (_, inner) => inner.match(/<mc:Choice\b[^>]*>([\s\S]*?)<\/mc:Choice>/)?.[1] ?? inner.replace(/<mc:Fallback\b[^>]*>[\s\S]*?<\/mc:Fallback>/, ''));
}

// ---- the audit's independent oracles for what a chartex preview must draw ----------------------------------------------------------

const numeric = v => typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const close = (a, b, rel = 2e-3, abs = 0.05) => Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));
const num = v => v === undefined || v === '' ? NaN : Number(v);

/** Scott's normal reference rule: the number of equal-width bins of a sample (also what PowerPoint's automatic binning and opf-pptx use). */
export function scottBinCount(values) {
  const n = values.length; if (n < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const range = Math.max(...values) - Math.min(...values);
  if (!sd || !range) return 1;
  return Math.max(1, Math.ceil(range / (3.49 * sd * n ** (-1 / 3))));
}
/** Counts per bin: the first bin closed on both ends, every later bin (lower, upper]. */
export function binCounts(values, bins) {
  const min = Math.min(...values), max = Math.max(...values), width = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.max(0, v === min ? 0 : Math.ceil((v - min) / width) - 1))]++;
  return counts;
}
/** Quartiles by the exclusive median method (PowerPoint's default for a box and whisker chart): [q1, median, q3]. */
export function quartilesExclusive(sorted) {
  const median = a => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  const n = sorted.length, mid = Math.floor(n / 2);
  return [median(sorted.slice(0, mid)), median(sorted), median(sorted.slice(n % 2 ? mid + 1 : mid))];
}
/** The values outside the 1.5 IQR whiskers, per category, in source order of the categories. */
export function boxOutliers(rows) {
  const groups = new Map();
  for (const r of rows) { const v = numeric(r[1]); if (v === null) continue; (groups.get(String(r[0])) ?? groups.set(String(r[0]), []).get(String(r[0]))).push(v); }
  return [...groups].map(([name, vs]) => { const s = [...vs].sort((a, b) => a - b); const [q1, , q3] = quartilesExclusive(s); const lo = q1 - 1.5 * (q3 - q1), hi = q3 + 1.5 * (q3 - q1); return {name, n: s.length, outliers: s.filter(v => v < lo || v > hi)}; });
}

/**
 * Real mark checks of a chartex preview, on the traced marks of the chart group ({tag, path, x, y, width, height, cx, cy, points, ...} with
 * string attributes, as the audits parse them). Each check is exact apart from the SVG's 3-decimal rounding.
 * @param {string} id the chart id
 * @param {unknown[][]} rows the chart's data rows
 * @param {Array<Record<string,string>>} marks
 * @returns {{ok:boolean, checks:Array<{name:string, ok:boolean, expected:unknown, actual:unknown}>}}
 */
export function chartexPreviewMarks(id, rows, marks) {
  const checks = []; const add = (name, ok, expected, actual) => checks.push({name, ok: !!ok, expected, actual});
  const rects = marks.filter(m => m.tag === 'rect' && /\.data\.(rows\.\d+\.\d+|columns\.\d+)$/.test(m['data-opf-path'] ?? ''));
  const byRow = marks.filter(m => m.tag === 'rect' && /\.data\.rows\.(\d+)\.1$/.test(m['data-opf-path'] ?? '')).sort((a, b) => +a['data-opf-path'].match(/rows\.(\d+)\./)[1] - +b['data-opf-path'].match(/rows\.(\d+)\./)[1]);
  const vals = rows.map(r => numeric(r[1]));
  if (id === 'treemap') {
    const idx = vals.map((v, i) => v !== null && v > 0 ? i : -1).filter(i => i >= 0);
    add('one tile per positive value', byRow.length === idx.length, idx.length, byRow.length);
    const areas = byRow.map(m => num(m.width) * num(m.height)), total = areas.reduce((a, b) => a + b, 0), sum = idx.reduce((a, i) => a + vals[i], 0);
    add('tile areas are proportional to the values', byRow.length === idx.length && idx.every((i, k) => close(areas[k] / total, vals[i] / sum, 3e-3, 1e-4)), idx.map(i => +(vals[i] / sum).toFixed(4)), areas.map(a => +(a / total).toFixed(4)));
  } else if (id === 'histogram') {
    const sample = rows.map(r => numeric(r[0])).filter(v => v !== null), bins = scottBinCount(sample), counts = binCounts(sample, bins);
    const bars = rects.filter(m => /\.data\.columns\.\d+$/.test(m['data-opf-path'])).sort((a, b) => num(a.x) - num(b.x));
    add('one bar per bin (Scott)', bars.length === bins, bins, bars.length);
    const unit = counts.find(c => c > 0) ? num(bars[counts.findIndex(c => c > 0)]?.height) / counts.find(c => c > 0) : NaN;
    add('bar heights are proportional to the bin counts', bars.length === bins && counts.every((c, i) => close(num(bars[i].height), c * unit, 3e-3, 0.02)), counts, bars.map(b => +(num(b.height) / unit).toFixed(2)));
  } else if (id === 'pareto') {
    const bars = byRow; const order = vals.map((v, i) => [v, i]).filter(([v]) => v !== null).sort((a, b) => b[0] - a[0]);
    add('one bar per category', bars.length === order.length, order.length, bars.length);
    const unit = order.length && bars.length ? num(bars[0].height) / order[0][0] : NaN;
    add('bar heights follow the sorted values', bars.length === order.length && order.every(([v], i) => close(num(bars[i].height), v * unit, 3e-3, 0.02)), order.map(o => o[0]), bars.map(b => +(num(b.height) / unit).toFixed(2)));
    const line = marks.find(m => m.tag === 'polyline'), pts = (line?.points ?? '').trim().split(/\s+/).filter(Boolean).map(p => p.split(',').map(Number));
    add('a cumulative line with one point per category', pts.length === order.length, order.length, pts.length);
    if (pts.length === order.length && bars.length) {
      const base = num(bars[0].y) + num(bars[0].height), total = order.reduce((a, [v]) => a + v, 0); let c = 0; const h = pts.map(p => base - p[1]);
      const want = order.map(([v]) => (c += v) / total);
      add('the line is the cumulative share, ending at 100%', want.every((w, i) => close(h[i] / h[h.length - 1], w, 3e-3, 1e-3)), want.map(w => +w.toFixed(3)), h.map(x => +(x / h[h.length - 1]).toFixed(3)));
    }
  } else if (id === 'box-and-whisker') {
    const groups = boxOutliers(rows), boxes = rects.filter(m => /\.data\.columns\.\d+$/.test(m['data-opf-path']));
    add('one box per category', boxes.length === groups.length, groups.length, boxes.length);
    const dots = marks.filter(m => m.tag === 'circle' && /\.data\.rows\.\d+\.1$/.test(m['data-opf-path'] ?? '')), want = groups.reduce((a, g) => a + g.outliers.length, 0);
    add('one outlier mark per value outside the 1.5 IQR whiskers', dots.length === want, want, dots.length);
  } else if (id === 'waterfall') {
    const bars = byRow, ok = bars.length === vals.filter(v => v !== null).length;
    add('one bar per value', ok, vals.filter(v => v !== null).length, bars.length);
    const first = bars.findIndex((b, i) => vals[i] !== 0 && vals[i] !== null), scale = first >= 0 ? num(bars[first].height) / Math.abs(vals[first]) : NaN;
    add('bar heights are proportional to the magnitudes', ok && vals.every((v, i) => close(num(bars[i].height), Math.abs(v) * scale, 3e-3, 0.02)), vals.map(Math.abs), bars.map(b => +(num(b.height) / scale).toFixed(2)));
    // running total: each bar starts where the previous ended (positive up, negative down), from the baseline of the first bar.
    let running = 0; const base = ok && bars.length ? (vals[0] >= 0 ? num(bars[0].y) + num(bars[0].height) : num(bars[0].y)) : NaN;
    const stacked = ok && vals.every((v, i) => { const top = base - Math.max(running, running + v) * scale; running += v; return close(num(bars[i].y), top, 3e-3, 0.06); });
    add('each bar starts at the running total', stacked, 'running total', stacked ? 'running total' : 'positions differ');
  } else if (id === 'funnel') {
    const bars = byRow, ok = bars.length === vals.filter(v => v !== null).length;
    add('one bar per stage', ok, vals.filter(v => v !== null).length, bars.length);
    const scale = ok && bars.length ? num(bars[0].width) / vals[0] : NaN;
    add('bar widths are proportional to the values', ok && vals.every((v, i) => close(num(bars[i].width), v * scale, 3e-3, 0.02)), vals, bars.map(b => +(num(b.width) / scale).toFixed(2)));
    const centres = bars.map(b => num(b.x) + num(b.width) / 2);
    add('the bars share one centre line', ok && centres.every(c => close(c, centres[0], 1e-4, 0.05)), 'one centre', centres.map(c => +c.toFixed(2)));
  } else if (id === 'world') {
    // The map preview is a non-geographic tile grid (no geodata ships): one tile per region row, shaded by value.
    add('one tile per region', byRow.length === vals.filter(v => v !== null).length, vals.filter(v => v !== null).length, byRow.length);
  } else add('a chartex mark check exists for this id', false, id, null);
  return {ok: checks.length > 0 && checks.every(c => c.ok), checks};
}

/**
 * The chartex part against the source data: the layoutIds follow the catalog, the category and value caches are the source columns, and
 * the series carry the shape the construct needs. Returns the mismatches (empty = equal).
 */
export function chartexDataMismatches(id, expectation, part, rows) {
  const out = [];
  const want = [...expectation.layouts].sort().join('|'), have = [...new Set(part.layouts)].sort().join('|');
  if (want !== have) out.push(`chartex layoutIds ${have}, the catalog records ${want}`);
  const single = rows.length > 0 && rows.every(r => Array.isArray(r) && r.length === 1);
  const src = single ? rows.map(r => numeric(r[0])) : rows.map(r => numeric(r[1]));
  if (JSON.stringify(part.values) !== JSON.stringify(src)) out.push(`value cache differs from the data (${part.values.length} values, ${src.length} in the data)`);
  if (!single && JSON.stringify(part.categories) !== JSON.stringify(rows.map(r => String(r[0])))) out.push('category labels differ from the first column');
  if (id === 'pareto') { const owned = part.series.filter(s => s.layoutId === 'paretoLine' && s.ownerIdx !== null); if (owned.length !== 1) out.push('the Pareto line is not an owned series'); }
  if (id === 'histogram' && !part.series.some(s => s.layoutId === 'clusteredColumn' && (s.binning || s.aggregation))) out.push('the histogram series has no binning or aggregation');
  return out;
}
