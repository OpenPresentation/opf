// LH-03 and LH-81: the chart layer in the PPTX export and import.
//
// Composition decides the layer once per chart item (core chart-layer.ts, `ComposedChart.layer`); the preview (opf-render charts.js)
// draws it and this module writes it natively into the generated classic chart:
//
//   small chart (LH-03)   value labels (core `chartLayerDataLabels`, written by chart-options.js `applyDataLabels`), no value axis
//                         (c:valAx c:delete 1) and no gridlines when the layer drops them, no chart area fill (the chart stands on
//                         the card or the slide background, whose colour the palette and labels are judged against), and the
//                         emphasis: the emphasised point as one c:dPt in core's stronger shade (chart-highlight.js), every other point
//                         keeping the series colour (LH-95);
//   header row (LH-81)    the caption as the chart title (c:title, bold, the chart text size, the full text colour) and the series
//                         legend at the top (c:legendPos t), each at the position core gave it (c:manualLayout, edge mode, fractions of
//                         the chart space), and the plot area below them (c:plotArea c:manualLayout, layoutTarget outer), so
//                         PowerPoint keeps the plot as wide as the preview does.
//
// Import does not write these defaults back as options: a value label that is the small-chart default (`withoutLayerDefaults`) and the
// header legend (chart-options.js `chartOptionsFromClassic`) import as no option, so a deck exported and imported again keeps its
// authored options only.
import {schemeColorXml} from './chart-scheme-colors.js';
import {chartContextColors, chartEmphasisColors, chartOptionSupport, chartOptionTarget, resolveChartData, smallChart} from '@openpresentation/opf/composition';

const fraction = value => Number(Math.min(1, Math.max(0, value)).toFixed(4));

/**
 * The PptxGenJS options and the native layout of a chart's layer. `layer` is `ComposedChart.layer`, `region` the chart frame in inches,
 * `scale` the slide's pixel scale (min(slide width, slide height) in px / 720), `textSize` the chart text size in hundredths of a point, `labelColor` the full text colour (RRGGBB), `font` the body font. Returns
 * `{options, layout}`: `options` go into addChart, `layout` (title, legend and plot area fractions) is written by `applyChartLayerLayout`
 * once the part exists; both are empty for a chart without a layer.
 */
export function chartLayerOptions(layer, {region, scale, textSize, labelColor, font, chart, rtl = false}) {
  const options = {}, layout = {};
  if (!layer) return {options, layout};
  if (layer.small) {
    // The chart stands on what is under it (LH-105: every chart does; the caller writes no chart area fill).
    if (layer.small.valueAxis === false) Object.assign(options, {valAxisHidden: true, valGridLine: {style: 'none'}});
  }
  const header = layer.header;
  if (!header && !layer.plot) return {options, layout};
  const left = region.x * 96, top = region.y * 96, width = region.w * 96, height = region.h * 96;
  // LH-93: a chart that shares its value axis with siblings has core's plot box, the plot itself without its tick and category labels
  // (layoutTarget inner), so its plot is as tall as theirs in PowerPoint too.
  const plot = layer.plot;
  if (plot) layout.plot = {x: fraction(plot.left / width), y: fraction(plot.top / height), w: fraction((width - plot.left - plot.right) / width), h: fraction((height - plot.top - plot.bottom) / height), target: 'inner'};
  if (!header) return {options, layout};
  // The chart text size in slide pixels (hundredths of a point x 96 / 72 / 100) and the preview's padding.
  const fontPx = textSize / 75, inset = 10 * scale;
  if (header.caption) {
    Object.assign(options, {showTitle: true, title: header.caption.text, titleColor: labelColor, titleFontFace: font, titleFontSize: textSize / 100, titleBold: true, titleAlign: rtl ? 'right' : 'left'});
    layout.title = {x: fraction((header.caption.box.x - left) / width), y: fraction((header.caption.box.y - top) / height)};
  }
  if (header.legend) {
    Object.assign(options, {showLegend: true, legendPos: 't'});
    // PowerPoint lays the entries out inside the box with its own key and spacing metrics: the box takes a text size of slack per entry,
    // grown away from the chart edge it is aligned to, so the entries stay on one row.
    const box = header.legend.box, slack = fontPx * header.legend.entries.length;
    const atEnd = Math.abs(box.x + box.width - (left + width)) < Math.abs(box.x - left);
    const x = Math.max(left, atEnd ? box.x - slack : box.x), right = Math.min(left + width, atEnd ? box.x + box.width : box.x + box.width + slack);
    layout.legend = {x: fraction((x - left) / width), y: fraction((box.y - top) / height), w: fraction((right - x) / width), h: fraction(box.height / height)};
  }
  // The plot area (with its tick labels: layoutTarget outer) fills the chart below the header, inside the padding the preview keeps,
  // less a band for each axis title on the side the preview puts it.
  const titles = chart?.axisTitles && typeof chart.axisTitles === 'object' ? chart.axisTitles : {};
  const horizontalBars = ['bar', 'stacked-bar', '100pct-stacked-bar'].includes(String(chart?.type ?? '').trim().toLowerCase());
  const lineHeight = fontPx * 1.5;
  const band = {left: 0, right: 0, bottom: 0};
  if (typeof titles.category === 'string' && titles.category.trim()) band[horizontalBars ? 'left' : 'bottom'] += lineHeight;
  if (typeof titles.value === 'string' && titles.value.trim()) band[horizontalBars ? 'bottom' : (rtl && String(chart?.type).trim().toLowerCase() === 'combo' ? 'right' : 'left')] += lineHeight;
  if (typeof titles.secondary === 'string' && titles.secondary.trim() && Array.isArray(chart?.secondaryAxis) && chart.secondaryAxis.length) band[rtl ? 'left' : 'right'] += lineHeight;
  const x = inset + band.left, y = header.height, w = width - 2 * inset - band.left - band.right, h = height - header.height - inset - band.bottom;
  layout.plot ??= {x: fraction(x / width), y: fraction(y / height), w: fraction(w / width), h: fraction(h / height)};
  return {options, layout};
}

const manualLayout = (box, target) => `<c:layout><c:manualLayout>${target ? `<c:layoutTarget val="${target}"/>` : ''}<c:xMode val="edge"/><c:yMode val="edge"/>` +
  `<c:x val="${box.x}"/><c:y val="${box.y}"/>${box.w === undefined ? '' : `<c:w val="${box.w}"/><c:h val="${box.h}"/>`}</c:manualLayout></c:layout>`;

/**
 * Write the header layout into a generated classic chart part: the title's position, the legend's box (CT_Legend: legendPos,
 * legendEntry*, layout, overlay) and the plot area's box: outer below a header row, inner for a plot of one height with its siblings
 * (LH-93). A part without a layout is returned unchanged.
 */
export function applyChartLayerLayout(xml, layout) {
  if (!layout || (!layout.title && !layout.legend && !layout.plot)) return xml;
  let out = xml;
  if (layout.title) out = out.replace(/(<c:title>[\s\S]*?<\/c:tx>)\s*(?:<c:layout\/>|<c:layout>[\s\S]*?<\/c:layout>)?/, (_, head) => `${head}${manualLayout(layout.title)}`);
  if (layout.legend) out = out.replace(/(<c:legend>\s*<c:legendPos val="t"\/>)\s*(?:<c:layout\/>|<c:layout>[\s\S]*?<\/c:layout>)?/, (_, head) => `${head}${manualLayout(layout.legend)}`);
  if (layout.plot) out = out.replace(/(<c:plotArea>)\s*(?:<c:layout\/>|<c:layout>[\s\S]*?<\/c:layout>)/, (_, head) => `${head}${manualLayout(layout.plot, layout.plot.target ?? 'outer')}`);
  return out;
}

/**
 * LH-03, LH-95: the emphasis of a one-series small column or bar chart as a highlight plan (chart-highlight.js shape): the series keeps its
 * colour (its scheme colour when the palette writes one), and the emphasised point takes core's stronger shade of it, an sRGB literal.
 */
export function chartEmphasisPlan({layer, data, panelFill, palette, strong, schemes}) {
  const row = layer?.small?.emphasis;
  if (row === undefined || !data?.rows) return undefined;
  // LH-105: the emphasised point takes the series colour at full strength (`strong`), or a shade of it; the others keep the soft colour.
  const colors = chartEmphasisColors(panelFill, `#${palette[0]}`, strong?.[0] ? `#${strong[0]}` : undefined);
  if (!colors) return undefined;
  const shadeHex = colors.accent.replace(/^#/, '').toUpperCase(), seriesHex = colors.muted.replace(/^#/, '').toUpperCase();
  const accent = {hex: shadeHex, xml: `<a:srgbClr val="${shadeHex}"/>`};
  const muted = {hex: seriesHex, xml: schemes?.[0] ? schemeColorXml(schemes[0]) : `<a:srgbClr val="${seriesHex}"/>`};
  const marks = {series: [false], categories: data.rows.map((_, index) => index === row)};
  const markColor = (_, index) => marks.categories[index] ? accent : muted;
  // The series colour stays the series' own fill (and the legend's); the emphasised point is the one c:dPt.
  return {
    kind: 'bar', marks, accent, muted, circular: false, seriesColor: () => muted, markColor,
    seriesFills: [seriesHex],
    pointFills: () => marks.categories.map(highlighted => (highlighted ? accent : muted).hex),
  };
}

/**
 * LH-105: the focus the slide title gives a chart (`layer.focus`, core chart-focus.ts) as a highlight plan (chart-highlight.js shape): a
 * focused series (or category, or pie slice) keeps its full-strength colour (`strong`, by series; by slice on a pie), every other mark
 * takes core's context neutral, as the preview draws it. Colours are sRGB literals.
 */
export function chartFocusPlan({layer, data, kind, panelFill, labelColor, strong}) {
  const focus = layer?.focus;
  if (!focus || !data?.rows || !strong?.length) return undefined;
  const srgb = hex => ({hex: String(hex).replace(/^#/, '').toUpperCase(), xml: `<a:srgbClr val="${String(hex).replace(/^#/, '').toUpperCase()}"/>`});
  const strongOf = index => srgb(strong[index % strong.length]);
  const circular = kind === 'pie' || kind === 'doughnut';
  const seriesCount = Math.max(1, data.columns.length - 1 - (data.hasX ? 1 : 0));
  const marks = {series: circular ? [false] : Array.from({length: seriesCount}, (_, index) => focus.series?.includes(index) === true), categories: data.rows.map((_, row) => focus.categories?.includes(row) === true)};
  // The context neutrals, one per context series (or slice) in order, as the preview draws them (core chartContextColors).
  const context = (count, avoid) => chartContextColors(panelFill, `#${labelColor}`, count, {labeled: focus.labeled === true, avoid: avoid.map(index => `#${strong[index % strong.length]}`)}).map(srgb);
  const indexes = length => Array.from({length}, (_, index) => index);
  const restSeries = indexes(seriesCount).filter(index => !marks.series[index]), restRows = indexes(data.rows.length).filter(row => !marks.categories[row]);
  const seriesGrays = circular ? [] : context(restSeries.length, indexes(seriesCount).filter(index => focus.categories ? true : marks.series[index]));
  const sliceGrays = circular ? context(restRows.length, indexes(data.rows.length).filter(row => marks.categories[row])) : [];
  const muted = (circular ? sliceGrays : seriesGrays)[0];
  const mutedOf = index => seriesGrays[Math.max(0, restSeries.indexOf(index))];
  const seriesColor = index => marks.series[index] ? strongOf(index) : mutedOf(index);
  const markColor = (series, row) => marks.series[series] || marks.categories[row] ? strongOf(series) : mutedOf(series);
  const sliceColor = row => marks.categories[row] ? strongOf(row) : sliceGrays[Math.max(0, restRows.indexOf(row))];
  return {
    kind, marks, accent: strongOf(0), muted, seriesColor, markColor, sliceColor, circular,
    seriesFills: marks.series.map((_, index) => seriesColor(index).hex),
    pointFills: series => circular ? marks.categories.map((_, row) => sliceColor(row).hex)
      : kind === 'bar' && marks.categories.some(Boolean) ? marks.categories.map((_, row) => markColor(series, row).hex) : undefined,
  };
}

/**
 * Import: drop the options an export of the chart layer wrote by default. `chart` is the imported chart (type, data and the options
 * read back). A `dataLabels: true` (the value, at the type's default position) is the small-chart default label, and is removed, on a
 * chart the small-chart rule covers by type and counts whose chart area has no fill (`unfilled`: the export drew the chart as small; a
 * chart whose labels did not fit keeps its panel, and its labels). The header legend is read as no option by chart-options.js.
 */
export function withoutLayerDefaults(chart, {unfilled = false} = {}) {
  if (!chart || typeof chart !== 'object') return chart;
  let out = chart;
  if (out.dataLabels === true && unfilled) {
    const target = chartOptionTarget(out.type);
    const resolved = resolveChartData({type: out.type, data: out.data, ...(out.mapping ? {mapping: out.mapping} : {})});
    const {dataLabels: _labels, ...rest} = out;
    if (target && chartOptionSupport(target).dataLabels.supported && resolved.ok && smallChart(rest, resolved)) out = rest;
  }
  return out;
}
