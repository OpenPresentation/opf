// LH-03 and LH-81: the chart layer in the PPTX export and import.
//
// Composition decides the layer once per chart item (core chart-layer.ts, `ComposedChart.layer`); the preview (opf-render charts.js)
// draws it and this module writes it natively into the generated classic chart:
//
//   small chart (LH-03)   value labels (core `chartLayerDataLabels`, written by chart-options.js `applyDataLabels`), no value axis
//                         (c:valAx c:delete 1) and no gridlines when the layer drops them, no chart area fill (the chart stands on
//                         the card or the slide background, whose colour the palette and labels are judged against), and the
//                         emphasis: one c:dPt per quieter point (chart-highlight.js), the emphasised point keeping the series colour;
//   header row (LH-81)    the caption as the chart title (c:title, bold, the chart text size, the full text colour) and the series
//                         legend at the top (c:legendPos t), each at the position core gave it (c:manualLayout, edge mode, fractions of
//                         the chart space), and the plot area below them (c:plotArea c:manualLayout, layoutTarget outer), so
//                         PowerPoint keeps the plot as wide as the preview does.
//
// Import does not write these defaults back as options: a value label that is the small-chart default (`withoutLayerDefaults`) and the
// header legend (chart-options.js `chartOptionsFromClassic`) import as no option, so a deck exported and imported again keeps its
// authored options only.
import {chartEmphasisColors, chartOptionSupport, chartOptionTarget, resolveChartData, smallChart} from '@openpresentation/opf/composition';

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
    // The chart stands on what is under it; PowerPoint draws no chart area fill.
    options.chartArea = {fill: {color: null}, roundedCorners: false};
    if (layer.small.valueAxis === false) Object.assign(options, {valAxisHidden: true, valGridLine: {style: 'none'}});
  }
  const header = layer.header;
  if (!header) return {options, layout};
  const left = region.x * 96, top = region.y * 96, width = region.w * 96, height = region.h * 96;
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
  layout.plot = {x: fraction(x / width), y: fraction(y / height), w: fraction(w / width), h: fraction(h / height)};
  return {options, layout};
}

const manualLayout = (box, target) => `<c:layout><c:manualLayout>${target ? `<c:layoutTarget val="${target}"/>` : ''}<c:xMode val="edge"/><c:yMode val="edge"/>` +
  `<c:x val="${box.x}"/><c:y val="${box.y}"/>${box.w === undefined ? '' : `<c:w val="${box.w}"/><c:h val="${box.h}"/>`}</c:manualLayout></c:layout>`;

/**
 * Write the header layout into a generated classic chart part: the title's position, the legend's box (CT_Legend: legendPos,
 * legendEntry*, layout, overlay) and the plot area's outer box. A part without a layout is returned unchanged.
 */
export function applyChartLayerLayout(xml, layout) {
  if (!layout || (!layout.title && !layout.legend && !layout.plot)) return xml;
  let out = xml;
  if (layout.title) out = out.replace(/(<c:title>[\s\S]*?<\/c:tx>)\s*(?:<c:layout\/>|<c:layout>[\s\S]*?<\/c:layout>)?/, (_, head) => `${head}${manualLayout(layout.title)}`);
  if (layout.legend) out = out.replace(/(<c:legend>\s*<c:legendPos val="t"\/>)\s*(?:<c:layout\/>|<c:layout>[\s\S]*?<\/c:layout>)?/, (_, head) => `${head}${manualLayout(layout.legend)}`);
  if (layout.plot) out = out.replace(/(<c:plotArea>)\s*(?:<c:layout\/>|<c:layout>[\s\S]*?<\/c:layout>)/, (_, head) => `${head}${manualLayout(layout.plot, 'outer')}`);
  return out;
}

/**
 * LH-03: the emphasis of a one-series small column or bar chart as a highlight plan (chart-highlight.js shape): the emphasised point keeps
 * the series colour (its scheme colour when the palette writes one), every other point takes the quieter tint, an sRGB literal.
 */
export function chartEmphasisPlan({layer, data, panelFill, palette, schemes}) {
  const row = layer?.small?.emphasis;
  if (row === undefined || !data?.rows) return undefined;
  const colors = chartEmphasisColors(panelFill, `#${palette[0]}`);
  // No room for a tint at 3:1 and 15 L* from the series colour: every point keeps the series colour, as in the preview.
  if (!colors) return undefined;
  const accentHex = colors.accent.replace(/^#/, '').toUpperCase(), mutedHex = colors.muted.replace(/^#/, '').toUpperCase();
  const accent = {hex: accentHex, xml: schemes?.[0] ? `<a:schemeClr val="${schemes[0]}"/>` : `<a:srgbClr val="${accentHex}"/>`};
  const muted = {hex: mutedHex, xml: `<a:srgbClr val="${mutedHex}"/>`};
  const marks = {series: [false], categories: data.rows.map((_, index) => index === row)};
  const markColor = (_, index) => marks.categories[index] ? accent : muted;
  // The series colour stays the accent (the legend and the series' own fill); each quieter point is a c:dPt.
  return {
    kind: 'bar', marks, accent, muted, circular: false, seriesColor: () => accent, markColor,
    seriesFills: [accentHex],
    pointFills: () => marks.categories.map(highlighted => (highlighted ? accent : muted).hex),
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
