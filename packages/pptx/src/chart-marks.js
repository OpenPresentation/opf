// LH-107 to LH-110 and LH-125 in the PPTX export and import.
//
// Composition decides them (core chart-marks.ts, `ComposedChart.layer`); the preview (opf-render charts.js) draws them and this module
// writes what a native chart part cannot hold as native shapes over (or under) the chart frame, at the boxes core gave them:
//
//   value list (LH-108)        the unit, then per row a swatch (a rectangle in the slice's color), the category and the value
//                              (right-aligned text boxes) and a hairline between rows, beside the pie; the chart part draws the pie in
//                              core's square (the plot area's inner manual layout) without a legend.
//   stacked names (LH-109)     per series a swatch and its name beside the last column; the chart part has no legend and its plot is
//                              pinned (inner manual layout), so the segments stand where core measured them. The values inside the
//                              segments are the chart's own data labels (c:dLbls, c:dLblPos ctr on columns), one c:dLbl c:delete per
//                              segment whose value does not fit (`applyStackValueDeletes`).
//   stacked ends (LH-125)      the first and last values of an edge-to-edge stacked area, text boxes inside the band at the plot's edges
//                              (the chart part's own labels there are deleted), and a doughnut's focus value and category in its hole
//                              (text boxes over the chart at core's boxes).
//   doughnut hole (LH-182)     an ellipse in the surface color under the chart frame, at the hole of the doughnut core pinned (the
//                              plot area's inner manual layout), so what is behind the chart does not show through the hole.
//   reference marks (LH-110)   a period band (a rectangle under the chart frame: the chart and plot areas are unfilled) and a dashed
//                              reference line with its bold label (over the frame), on the pinned plot.
//
// The shapes do not follow the chart if it is moved by hand in PowerPoint: they are drawn for the plot core pinned. Each carries an
// OPF_CHART_MARK_V1 tag naming its chart and role, and import consumes the tagged shapes (they are the chart's defaults, not content);
// the chart itself imports without an option for them (chart-direct-labels.js `directLabelDefaults`, chart-options.js).
import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';
import {chartBandColor} from '@openpresentation/opf/composition';

export const CHART_MARK_TAG = 'OPF_CHART_MARK_V1';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const decoder = new TextDecoder('utf-8', {fatal: true});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const hex = value => String(value).replace(/^#/, '').toUpperCase();
const inches = box => ({x: box.x / 96, y: box.y / 96, w: Math.max(0.001, box.width / 96), h: Math.max(0.001, box.height / 96)});

/**
 * Add a chart's marks to the slide: `phase` 'under' (before the chart frame: the period bands) or 'over' (after it: the reference lines,
 * the value list and the stacked names). `paint` gives the colors (RRGGBB): `text` (the full text color), `chartText` (the chart text
 * neutral), `grid` (the gridline neutral), `surface` (the backdrop, #RRGGBB), `slice(row)` and `series(j)`; `font` the body face, `size`
 * the chart text size in points, `scale` the slide's pixel scale, `tags` the export's tag map.
 */
export function addChartMarks(slide, layer, phase, {chart, paint, font, size, scale, rtl = false, tags}) {
  if (!layer) return;
  let count = 0;
  const name = role => `${chart} mark ${phase} ${++count} ${role}`;
  const tag = (objectName, role) => tags.set(objectName, {v: 1, chart, role});
  const text = (value, box, role, {color, bold = false, align = 'left', fontSize = size}) => {
    const objectName = name(role);
    slide.addText(String(value), {...inches(box), objectName, isTextBox: true, margin: 0, fontFace: font, fontSize, color, bold, align, valign: 'middle', fit: 'none', wrap: false, paraSpaceAfter: 0, lineSpacingMultiple: 1});
    tag(objectName, role);
  };
  const rect = (box, role, fill) => {
    const objectName = name(role);
    slide.addShape('rect', {...inches(box), objectName, fill: {color: hex(fill)}, line: {type: 'none'}});
    tag(objectName, role);
  };
  const line = (x1, y1, x2, y2, role, color, dash) => {
    const objectName = name(role);
    slide.addShape('line', {objectName, x: x1 / 96, y: y1 / 96, w: Math.max(0, (x2 - x1) / 96), h: Math.max(0, (y2 - y1) / 96), line: {color: hex(color), width: scale, ...(dash ? {dashType: 'dash'} : {})}});
    tag(objectName, role);
  };
  const start = rtl ? 'right' : 'left', end = rtl ? 'left' : 'right';
  if (phase === 'under') {
    for (const band of layer.references?.bands ?? []) rect(band.box, 'band', chartBandColor(paint.surface, `#${paint.text}`));
    // LH-182: a doughnut's hole in the surface color, under the chart frame (whose plot core pinned to the doughnut's square), so a
    // watermark or a background motif does not show through it.
    const hole = layer.doughnut?.hole;
    if (hole) {
      const objectName = name('hole');
      slide.addShape('ellipse', {...inches({x: hole.cx - hole.r, y: hole.cy - hole.r, width: 2 * hole.r, height: 2 * hole.r}), objectName, fill: {color: hex(paint.surface)}, line: {type: 'none'}});
      tag(objectName, 'hole');
    }
    return;
  }
  for (const entry of layer.references?.lines ?? []) {
    line(entry.x1, entry.y, entry.x2, entry.y, 'reference', paint.chartText, true);
    text(entry.text, entry.label, 'reference-label', {color: paint.text, bold: true, align: start});
  }
  const list = layer.valueList;
  if (list) {
    const emphasis = list.rows.some(row => row.bold);
    if (list.header) text(list.header.text, list.header.box, 'list-header', {color: paint.chartText, align: end});
    list.rows.forEach((row, index) => {
      const box = row.box, middle = box.y + box.height / 2;
      if (index) line(box.x, box.y, box.x + box.width, box.y, 'list-rule', paint.grid, false);
      rect({x: rtl ? box.x + box.width - list.swatch : box.x, y: middle - list.swatch / 2, width: list.swatch, height: list.swatch}, 'list-swatch', paint.slice(row.row));
      const color = row.bold || !emphasis ? paint.text : paint.chartText;
      const inner = {x: box.x + (rtl ? 0 : list.swatch + list.gap), y: box.y, width: Math.max(1, box.width - list.swatch - list.gap), height: box.height};
      text(row.value, inner, 'list-value', {color, bold: row.bold === true, align: end});
      text(row.name, inner, 'list-name', {color, bold: row.bold === true, align: start});
    });
  }
  // LH-125: a doughnut's hole holds the focused slice's value, large and bold in the slice's color, with its category under it.
  const hole = list?.hole;
  if (hole) {
    text(hole.value.text, hole.value.box, 'hole-value', {color: paint.hole(hole.row), bold: true, align: 'center', fontSize: hole.value.size * 0.75});
    if (hole.name) text(hole.name.text, hole.name.box, 'hole-name', {color: paint.chartText, align: 'center'});
  }
  // LH-125: the values at the ends of an edge-to-edge stacked area, inside the band, in the text color that contrasts with its fill.
  for (const end of layer.stack?.ends ?? []) text(end.text, end.box, 'stack-end', {color: paint.onSeries(end.series), align: end.align});
  const names = layer.stack?.names;
  for (const entry of names?.entries ?? []) {
    const middle = entry.box.y + entry.box.height / 2, swatch = names.swatch, gap = size * 4 / 3 * 0.4;
    rect({x: rtl ? entry.box.x + entry.box.width - swatch : entry.box.x, y: middle - swatch / 2, width: swatch, height: swatch}, 'stack-swatch', paint.series(entry.series));
    text(entry.name, {x: rtl ? entry.box.x : entry.box.x + swatch + gap, y: entry.box.y, width: Math.max(1, entry.box.width - swatch - gap), height: entry.box.height}, 'stack-name',
      {color: entry.bold ? paint.text : paint.chartText, bold: entry.bold === true, align: start});
  }
}

/** Bind each generated mark to its chart with a native tag (export, after the package is written). */
export function attachChartMarkTags(entries, tags) {
  attachTextTags(entries, tags, CHART_MARK_TAG, 'opfChartMark', 'chart mark');
}

/**
 * LH-109: hide the values that do not fit their segments in a generated stacked chart part: one `<c:dLbl><c:idx/><c:delete val="1"/>` per
 * segment `values[series][row] === false`, in place of any label the data labels wrote for that point.
 */
export function applyStackValueDeletes(xml, values) {
  if (!Array.isArray(values) || !values.length) return xml;
  let index = 0;
  return xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, ser => {
    const hidden = (values[index++] ?? []).flatMap((fits, row) => fits === false ? [row] : []);
    if (!hidden.length) return ser;
    return ser.replace(/<c:dLbls>([\s\S]*?)<\/c:dLbls>/, (_, body) => {
      const points = new Map();
      const rest = body.replace(/<c:dLbl>[\s\S]*?<\/c:dLbl>/g, point => { points.set(Number(/<c:idx val="(\d+)"\/>/.exec(point)?.[1]), point); return ''; });
      for (const row of hidden) points.set(row, `<c:dLbl><c:idx val="${row}"/><c:delete val="1"/></c:dLbl>`);
      return `<c:dLbls>${[...points.entries()].sort((a, b) => a[0] - b[0]).map(([, point]) => point).join('')}${rest}</c:dLbls>`;
    });
  });
}

/** Import: the shapes of a slide that carry a valid chart mark tag (consumed: not content) and the names of the charts they belong to. */
export function importChartMarks(shapes, relationships, entries) {
  const consumed = new Set(), charts = new Set();
  for (const shape of shapes) {
    for (const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel = relationships.get(link['r:id']);
      if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) continue;
      try {
        for (const tag of array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])) {
          if (String(tag.name ?? '').toUpperCase() !== CHART_MARK_TAG) continue;
          const record = decodeTextTag(tag.val);
          if (record?.v === 1 && typeof record.chart === 'string' && typeof record.role === 'string') { consumed.add(shape); charts.add(record.chart); }
        }
      } catch { /* an unreadable tag leaves the shape as ordinary content */ }
    }
  }
  return {consumed, charts};
}
