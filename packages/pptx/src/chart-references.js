// LH-110: explicit reference series/overlays. Ownership identifies generated furniture; CURRENT XML owns values and paint.
import { XMLParser } from 'fast-xml-parser';
import { OPFPptxError } from './errors.js';
import { attachTextTags, decodeTextTag, encodeTextTag } from './code-provenance.js';
import { readBackgroundColor, colorTransforms } from './background.js';
import { drawingObject } from './background-import.js';
import { resolveExportColor } from './color-ref.js';
import { applyComboConstruct, comboFromNative, NATIVE_CHART_ELEMENTS } from './chart-types.js';
import { isValidFormat } from './format-check.js';
export const REFERENCE_URI = 'urn:openpresentation:chart-references:v1';
const URI = REFERENCE_URI,
  TAG = 'OPF_CHART_REFERENCE_V1';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false });
const ordered = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: true,
  parseTagValue: false,
  trimValues: false,
});
const enc = new TextEncoder(),
  dec = new TextDecoder(),
  arr = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : (v?.['#text'] ?? ''));
const escape = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ownExt = (name, record) => `<c:ext uri="${URI}"><opf:${name} xmlns:opf="${URI}" data="${encodeTextTag(record)}"/></c:ext>`;
function record(node, name) {
  const exts = arr(node?.['c:extLst']?.['c:ext']).filter((e) => e.uri === URI && e[`opf:${name}`]);
  if (exts.length !== 1) return;
  const hex = exts[0][`opf:${name}`].data;
  if (typeof hex !== 'string' || hex.length > 4 * 1024 * 1024) return;
  try {
    const r = decodeTextTag(hex);
    return r?.v === 1 ? r : undefined;
  } catch {
    return;
  }
}
function addExt(xml, close, name, value) {
  const at = xml.lastIndexOf(close),
    head = xml.slice(0, at),
    tail = xml.slice(at);
  if (head.endsWith('</c:extLst>')) return head.slice(0, -11) + ownExt(name, value) + '</c:extLst>' + tail;
  return head + '<c:extLst>' + ownExt(name, value) + '</c:extLst>' + tail;
}
// Match the importer budgets before allocating helpers/workbook columns. These are export resource limits, not schema limits.
export function assertReferenceExportBudget(series, lines, { key = 'OPF chart', path = 'chart.referenceLines', multiAxisOverlays = false } = {}) {
  if (!lines.length) return;
  const refuse = (budget, limit) => {
    throw new OPFPptxError('chart-reference-resource-limit', 'Reference lines exceed the existing ' + budget + ' import budget; reduce chart rows, series or references before exporting.', { path, budget, limit });
  };
  if (lines.length > 100000) refuse('ownership-count', 100000);
  const nativeCount = lines.reduce((n, line) => n + Number(line.native), 0);
  if (series.length + nativeCount > 100000) refuse('series-count', 100000);
  let cells = 0, rows = 0;
  for (const entry of series) {
    for (const vector of [entry.labels, entry.values]) {
      const count = vector?.length ?? 0;
      if (!Number.isSafeInteger(count) || count < 0 || count > 100000) refuse('points', 100000);
      cells += count;
      rows = Math.max(rows, count);
    }
  }
  // Reference classification counts category and value caches; ordinary import also bounds its returned data table.
  cells += nativeCount * (series[0]?.labels?.length ?? 0) * 2;
  if (!Number.isSafeInteger(cells) || cells > 1000000 || rows * (series.length + nativeCount + 1) > 1000000) refuse('cache-cells', 1000000);
  const ownership = { v: 1, key, helpers: [], overlays: [] };
  for (const line of lines) {
    const id = key + ':' + line.index;
    if (line.native) ownership.helpers.push({ id, index: line.index, ...authoredBudgetRecord(line), ...(line.label !== undefined ? { labelAt: line.endpoint, labelPosition: line.labelPosition } : {}) });
    else ownership.overlays.push({ id, index: line.index, value: line.value, axis: line.axis, labelPosition: line.labelPosition, ...(multiAxisOverlays ? {axisIds: {category: 4294967295, value: 4294967295}} : {}), ...authoredBudgetRecord(line), binding: '0000000000000000' });
  }
  // The structural record uses UTF-8 uppercase hex; the binding placeholder has the exact fixed serialized width.
  if (enc.encode(JSON.stringify(ownership)).length * 2 > 4 * 1024 * 1024) refuse('ownership-metadata', 4 * 1024 * 1024);
}

/** Add helpers through the ordinary vendor writer, including their editable workbook columns. */
export function referenceChartTypes(base, series, lines, options) {
  assertReferenceExportBudget(series, lines, options);
  const types = [...base];
  for (const axis of ['value', 'secondary']) {
    const refs = lines.filter((l) => l.native && l.axis === axis);
    if (refs.length)
      types.push({
        type: 'line',
        data: refs.map((l) => ({
          name: `OPF reference ${l.index + 1}`,
          labels: [...series[0].labels],
          values: series[0].labels.map(() => l.value),
        })),
        options: {
          lineDataSymbol: 'none',
          showValue: false,
          ...(axis === 'secondary' ? { secondaryValAxis: true, secondaryCatAxis: true } : {}),
        },
      });
  }
  return types;
}
/** Patch only generated helper series after ordinary chart formatting; never modify the vendored writer. */
export function applyReferenceSeries(xml, info, binding) {
  const refs = info.lines.filter((l) => l.native),
    ordered = ['value', 'secondary'].flatMap((a) => refs.filter((l) => l.axis === a));
  let ordinal = 0;
  const helpers = [];
  let out = applyComboConstruct(xml).replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
    const index = ordinal++ - info.primaryCount;
    if (index < 0) return ser;
    const line = ordered[index];
    if (!line) throw Error('Unexpected reference helper series.');
    const id = `${info.key}:${line.index}`,
      idx = Number(/<c:idx val="(\d+)"/.exec(ser)?.[1]);
    const color = hiddenAware(resolveExportColor(line.stroke.color, { ...info.context, fallback: info.color }), line);
    const hex = color.slice(0, 6),
      alpha = color.length === 8 ? `<a:alpha val="${Math.round((parseInt(color.slice(6), 16) / 255) * 100000)}"/>` : '';
    // RR-105: core may move a label to the other end of its line (off the marks); the record keeps the authored end for the import.
    helpers.push({ id, index: line.index, ...authoredRecord(line, color), ...(line.label !== undefined ? { labelAt: line.endpoint, labelPosition: line.labelPosition } : {}) });
    const paint = `<c:spPr><a:ln w="${Math.round(line.strokeWidth * 9525)}" cap="flat"><a:solidFill><a:srgbClr val="${hex}">${alpha}</a:srgbClr></a:solidFill><a:prstDash val="${line.stroke.dash}"/></a:ln></c:spPr>`;
    let next = ser
      .replace(/<c:spPr>[\s\S]*?<\/c:spPr>/g, '')
      .replace(/<c:marker>[\s\S]*?<\/c:marker>/g, '')
      .replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g, '')
      .replace(/<c:dPt>[\s\S]*?<\/c:dPt>/g, '')
      .replace(/<c:invertIfNegative\b[^>]*\/>/g, '');
    const marker = '<c:marker><c:symbol val="none"/></c:marker>';
    const label =
      line.label === undefined
        ? ''
        : `<c:dLbl><c:idx val="${line.endpoint}"/><c:tx>${nativeLabelXml(line.label, info, binding?.lang)}</c:tx>${line.labelPlate && info.surface ? `<c:spPr><a:solidFill><a:srgbClr val="${info.surface}"/></a:solidFill></c:spPr>` : ""}<c:dLblPos val="${line.labelSide === 'below' ? 'b' : 't'}"/><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>`;
    // CT_DLbls: the c:dLbl entries, then either c:delete or the show flags, never both. A labeled helper shows only its one point's text;
    // an unlabeled one deletes its labels. Every show flag is written: CT_Boolean defaults to true, so PowerPoint reads an absent
    // c:showPercent or c:showBubbleSize as on, and Keynote refuses a line series that shows percentages or bubble sizes.
    const labels = line.label === undefined
      ? '<c:dLbls><c:delete val="1"/></c:dLbls>'
      : `<c:dLbls>${label}<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/><c:showLeaderLines val="0"/></c:dLbls>`;
    next = next.replace(/(<c:tx>[\s\S]*?<\/c:tx>)/, `$1${paint}${marker}${labels}`);
    next = addExt(next, '</c:ser>', 'reference', { v: 1, id });
    info.hidden.push(idx);
    return next;
  });
  if (ordinal !== info.primaryCount + refs.length) throw Error('Missing reference helper series.');
  const legendOrder = legendOrderIndexes(out);
  out = legendOrder.xml;
  if (info.hidden.length)
    out = out.replace(
      /(<c:legend>\s*<c:legendPos\b[^>]*\/>)/,
      `$1${info.hidden.map((idx) => legendOrder.indexes.get(idx) ?? idx).sort((a, b) => a - b).map((idx) => `<c:legendEntry><c:idx val="${idx}"/><c:delete val="1"/></c:legendEntry>`).join('')}`,
    );
  const overlayDoc = info.lines.some(line => !line.native) ? parser.parse(out) : undefined;
  const overlayPlot = overlayDoc?.['c:chartSpace']?.['c:chart']?.['c:plotArea'];
  const pairs = arr(overlayPlot?.['c:valAx']).length > 1 ? overlayAxisPairs(overlayPlot) : undefined;
  return addExt(out, '</c:chartSpace>', 'references', {
    v: 1,
    key: info.key,
    helpers,
    overlays: info.lines
      .filter((l) => !l.native)
      .map((l) => {
        const id = `${info.key}:${l.index}`,
          owned = binding.shapes
            .filter((shape) => String(shape['p:nvSpPr']?.['p:cNvPr']?.name ?? '').startsWith(id + ' '))
            .map((shape) => ({
              shape,
              style: binding.styles?.get(String(shape['p:nvSpPr']?.['p:cNvPr']?.id)),
              tag: { role: shape['p:nvSpPr']['p:cNvPr'].name === id + ' line' ? 'line' : 'label' },
            }));
        const value = { value: l.value, axis: l.axis, labelPosition: l.labelPosition };
        if (arr(overlayPlot?.['c:valAx']).length > 1) {
          const pair = pairs?.[l.axis];
          if (!pair) throw Error('Reference overlay has no unique reciprocal native combo axis pair.');
          value.axisIds = pair.axisIds;
        }
        const color = hiddenAware(resolveExportColor(l.stroke.color, { ...info.context, fallback: info.color }), l);
        return { id, index: l.index, ...value, ...authoredRecord(l, color), binding: overlayHash(overlayDoc, binding.frame, owned, value) };
      }),
  });
}
const cache = (node) =>
  node?.['c:numRef']?.['c:numCache'] ?? node?.['c:numLit'] ?? node?.['c:strRef']?.['c:strCache'] ?? node?.['c:strLit'];
function points(node) {
  const c = cache(node),
    n = Number(c?.['c:ptCount']?.val),
    pts = arr(c?.['c:pt']);
  if (!Number.isSafeInteger(n) || n < 0 || n > 100000 || pts.length !== n) return;
  const out = Array(n),
    seen = new Set();
  for (const p of pts) {
    const i = Number(p.idx);
    if (!Number.isSafeInteger(i) || i < 0 || i >= n || seen.has(i)) return;
    seen.add(i);
    out[i] = text(p['c:v']);
  }
  return out;
}
const ids = (node) => arr(node?.['c:axId']).map((a) => String(a.val));
const GROUPS = ['barChart', 'lineChart', 'areaChart'];
function chartRecord(doc) {
  const r = record(doc?.['c:chartSpace'], 'references');
  if (!r || typeof r.key !== 'string' || !Array.isArray(r.helpers) || !Array.isArray(r.overlays)) return;
  const all = [...r.helpers, ...r.overlays];
  if (
    all.length > 100000 ||
    all.some(
      (e) =>
        !e ||
        typeof e !== 'object' ||
        Array.isArray(e) ||
        typeof e.id !== 'string' ||
        !Number.isSafeInteger(e.index) ||
        e.index < 0,
    ) ||
    new Set(all.map((e) => e.id)).size !== all.length ||
    new Set(all.map((e) => e.index)).size !== all.length
  )
    return;
  return r;
}
// Canvas dimensions round to EMU before import: scale=shortEdgeEMU/6858000.
// Half a canvas EMU contributes at most64/1440 line EMU at the64 reference-pixel bound.
/** A reference of no width ('none', or width 0) is written fully transparent: PowerPoint draws a line of width 0 as a hairline. */
const hiddenAware = (color, line) => (line.strokeWidth > 0 ? color : color.slice(0, 6) + '00');
/** The native paint as raw facts (EMU width, color, alpha, dash): equal on export and import while nobody restyled the line. */
const paintKey = (emu, hex, alpha, dash) => `${emu}|${String(hex).replace(/^#/, '').slice(0, 6).toUpperCase()}|${alpha}|${dash}`;
/** What the export wrote and the stroke the document had, so an unchanged line imports as authored: no explicit defaults, color names kept. */
function authoredRecord(line, color) {
  const written = paintKey(Math.round(line.strokeWidth * 9525), color.slice(0, 6), color.length === 8 ? parseInt(color.slice(6), 16) : 255, line.stroke.dash);
  return { written, ...(line.authoredStroke !== undefined ? { stroke: line.authoredStroke } : {}) };
}
function currentPaintKey(node, colors) {
  const ln = node?.['a:ln'],
    read = readBackgroundColor(ln?.['a:solidFill'], colors);
  return ln && read ? paintKey(Number(ln.w), read.hex, read.alpha < 1 ? Math.round(read.alpha * 255) : 255, ln['a:prstDash']?.val ?? 'solid') : undefined;
}
// Width/dash are already resolved geometry. Six RGB digits and the longest
// possible alpha value conservatively bound native paint without resolving a
// named color here; zero-width paint always has the exact alpha 0. Preserve the
// actual authored-stroke JSON, including partial styles and 'none'.
function authoredBudgetRecord(line) {
  const emu = Number.isFinite(line.strokeWidth) ? Math.round(line.strokeWidth * 9525) : 4294967295;
  const written = paintKey(emu, 'FFFFFF', line.strokeWidth > 0 ? 255 : 0, line.stroke?.dash ?? 'solid');
  return {written, ...(line.authoredStroke !== undefined ? {stroke: line.authoredStroke} : {})};
}
/** Keep the reader's canonical axis/label fields; recover only the authored stroke while native paint is unchanged. */
function authoredReference(ref, owned, key, report) {
  const unchanged = typeof owned?.written === 'string' && owned.written === key;
  // Ownership is untrusted archive metadata. Ask the authoritative shared Line
  // schema before using its authored style; an outline's richer Stroke schema
  // would also allow arrowheads/caps that references cannot represent.
  const valid = !unchanged || owned.stroke === undefined || isValidFormat({slides: [{chart: {
    type: 'line', data: {columns: ['Category', 'Value'], rows: [['A', 0], ['B', 0]]},
    referenceLines: [{value: 0, stroke: owned.stroke}],
  }}]});
  if (!valid) report?.({code: 'chart-reference-style-uncertain', option: 'referenceLines',
    message: 'Stored authored reference stroke is not a valid Line; the current native paint was retained.'});
  const stroke = unchanged && valid ? owned.stroke : ref.stroke;
  return {
    index: ref.index,
    value: ref.value,
    axis: ref.axis,
    ...(ref.label !== undefined ? { label: ref.label, labelPosition: ref.labelPosition } : {}),
    ...(stroke !== undefined ? { stroke } : {}),
  };
}
function stroke(node, scale, colors) {
  const ln = node?.['a:ln'],
    w = Number(ln?.w),
    dash = ln?.['a:prstDash']?.val ?? 'solid',
    read = readBackgroundColor(ln?.['a:solidFill'], colors),
    color =
      read?.hex +
      (read?.alpha < 1
        ? Math.round(read.alpha * 255)
            .toString(16)
            .padStart(2, '0')
            .toUpperCase()
        : '');
  if (
    !Number.isSafeInteger(w) ||
    w < 0 ||
    w > Math.round(64 * scale * 9525 + 64 / 1440) ||
    !['solid', 'dash', 'dot'].includes(dash) ||
    !read ||
    !color ||
    (ln.cap !== undefined && ln.cap !== 'flat') ||
    node['a:effectLst'] ||
    ln['a:custDash'] ||
    ln['a:headEnd'] ||
    ln['a:tailEnd'] ||
    ln['a:gradFill']
  )
    return;
  return { color, width: Math.min(64, w / (9525 * scale)), dash };
}
function finiteCacheValue(value) {
  const token = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) return;
  const number = Number(token);
  if (!Number.isFinite(number) || (number === 0 && /[eE]/.test(token) && /[1-9]/.test(token.split(/[eE]/)[0]))) return;
  return number;
}
/** Classify before group detection. No title/name/constant-value inference; ambiguous/edited helpers stay ordinary data. */
export function readNativeReferences(xml, { scale = 1, colors = {}, report, parsed } = {}) {
  const doc = parsed ?? parser.parse(xml),
    r = chartRecord(doc),
    plot = doc?.['c:chartSpace']?.['c:chart']?.['c:plotArea'];
  const result = { xml, doc, plot, references: [], record: r };
  if (!r || !plot) {
    if (xml.includes(URI))
      report?.({
        code: 'chart-reference-ownership-uncertain',
        option: 'referenceLines',
        message: 'Reference ownership is incomplete or invalid; no reference is inferred and ordinary chart groups are retained.',
      });
    return result;
  }
  const groups = GROUPS.flatMap((kind) => arr(plot['c:' + kind]).map((node) => ({ kind, node }))),
    all = groups.flatMap((g) => arr(g.node['c:ser']).map((ser) => ({ ...g, ser, owner: record(ser, 'reference') })));
  const styles = new Map(),
    labelTexts = new Map();
  for (const [raw] of xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)) {
    const nodes = ordered.parse(raw);
    const value = drawingObject(nodes)['c:ser'],
      id = record(value, 'reference')?.id;
    if (id) {
      styles.set(id, value['c:spPr']);
      labelTexts.set(id, currentLabelText(nodes));
    }
  }
  const helperIds = new Set(r.helpers.map((h) => h.id)),
    owners = new Map();
  for (const e of all) {
    const id = e.owner?.id;
    if (id) {
      const entries = owners.get(id) ?? [];
      entries.push(e);
      owners.set(id, entries);
    }
  }
  const ordinary = all.filter((e) => !helperIds.has(e.owner?.id)),
    primary = ordinary[0],
    axes = arr(plot['c:valAx']),
    primaryAxis = axes.find((a) => ids(primary?.node).includes(String(a['c:axId']?.val))),
    primaryId = String(primaryAxis?.['c:axId']?.val),
    baseCats = points(primary?.ser?.['c:cat']);
  const cacheCells = all.reduce(
    (n, e) => n + ['c:val', 'c:cat'].reduce((n, k) => n + Number(cache(e.ser?.[k])?.['c:ptCount']?.val ?? 0), 0),
    0,
  );
  if (!Number.isSafeInteger(cacheCells) || cacheCells > 1000000) {
    report?.({
      code: 'chart-reference-ownership-uncertain',
      option: 'referenceLines',
      message:
        'Reference classification exceeds the existing million-cell chart budget; ordinary import retains its strict cache limits.',
    });
    return result;
  }
  const seriesIndexes = all.map((e) => Number(e.ser['c:idx']?.val)),
    uniqueIndexes =
      seriesIndexes.every((n) => Number.isSafeInteger(n) && n >= 0) && new Set(seriesIndexes).size === seriesIndexes.length;
  const consumedIds = new Set(),
    refs = [];
  for (const h of r.helpers) {
    const matches = owners.get(h.id) ?? [],
      e = matches[0],
      values = points(e?.ser?.['c:val']),
      cats = points(e?.ser?.['c:cat']);
    const axis = axes.filter((a) => ids(e?.node).includes(String(a['c:axId']?.val))),
      axisName = String(axis[0]?.['c:axId']?.val) === primaryId ? 'value' : 'secondary';
    const paint = stroke(styles.get(h.id) ?? e?.ser?.['c:spPr'], scale, colors),
      labels = arr(e?.ser?.['c:dLbls']?.['c:dLbl']),
      label = labels[0],
      idx = Number(label?.['c:idx']?.val),
      side = label?.['c:dLblPos']?.val;
    const unsupportedLabels = unsupportedReferenceLabels(e?.ser?.['c:dLbls'], e?.kind);
    const valid =
      matches.length === 1 &&
      uniqueIndexes &&
      e.kind === 'lineChart' &&
      (e.node['c:grouping']===undefined||e.node['c:grouping']?.val==='standard') &&
      e.ser?.['c:marker']?.['c:symbol']?.val === 'none' &&
      paint &&
      axis.length === 1 &&
      primaryAxis &&
      (axisName === 'value' ||
        ordinary.some((o) => o.kind === 'lineChart' && ids(o.node).includes(String(axis[0]['c:axId']?.val)))) &&
      values?.length >= 2 &&
      values.every((v) => finiteCacheValue(v) !== undefined && finiteCacheValue(v) === finiteCacheValue(values[0])) &&
      cats &&
      baseCats &&
      JSON.stringify(cats) === JSON.stringify(baseCats) &&
      cats.length === values.length &&
      !e.ser['c:dPt'] &&
      !e.ser['c:trendline'] &&
      !e.ser['c:errBars'] &&
      !unsupportedLabels &&
      labels.length <= 1 &&
      (!label ||
        ((idx === 0 || idx === values.length - 1) &&
          ['t', 'b'].includes(side) &&
          label['c:tx']?.['c:rich'] &&
          labelTexts.get(h.id) !== undefined));
    if (!valid) {
      report?.({
        code: 'chart-reference-ownership-uncertain',
        option: 'referenceLines',
        message:
          'A structurally identified reference helper was edited into unsupported or nonconstant data, or its native grouping/ownership/axes/categories are ambiguous; all of its current data remains ordinary chart data.' +
          (unsupportedLabels
            ? ' Current auto-label, leader-line or manual label-placement constructs cannot be represented by a plain reference label.'
            : ''),
      });
      continue;
    }
    const hiddenLabel =
      ['1', 1, true, 'true'].includes(label?.['c:delete']?.val) ||
      ['1', 1, true, 'true'].includes(e.ser['c:dLbls']?.['c:delete']?.val);
    const labelText = label && !hiddenLabel ? labelTexts.get(h.id) : undefined;
    refs.push(
      authoredReference(
        {
          index: h.index,
          value: Number(values[0]),
          axis: axisName,
          ...(labelText?.trim() ? { label: labelText, labelPosition: h.labelAt === idx && ['start', 'end'].includes(h.labelPosition) ? h.labelPosition : idx === 0 ? 'start' : 'end' } : {}),
          stroke: paint,
        },
        h,
        currentPaintKey(styles.get(h.id) ?? e?.ser?.['c:spPr'], colors),
        report,
      ),
    );
    consumedIds.add(h.id);
  }
  // Filter XML and parsed nodes using the SAME verified identities, preserving every uncertain series.
  result.xml = xml
    .replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (s) => {
      const p = parser.parse(s)['c:ser'],
        id = record(p, 'reference')?.id;
      return consumedIds.has(id) ? '' : s;
    })
    .replace(/<c:lineChart>([\s\S]*?)<\/c:lineChart>/g, (full, b) => (/<c:ser>/.test(b) ? full : ''));
  const filtered = parser.parse(result.xml);
  result.doc = filtered;
  result.plot = filtered?.['c:chartSpace']?.['c:chart']?.['c:plotArea'];
  result.references = refs;
  return result;
}
/** Fallbacks use full-plot native shapes. They cannot track independent chart moves or edits. */
export function addReferenceOverlays(slide, lines, { key, tags, context, color, labelColor = color, font, size, surface }) {
  for (const l of lines.filter((l) => !l.native)) {
    const id = `${key}:${l.index}`,
      name = id + ' line',
      hex = hiddenAware(resolveExportColor(l.stroke.color, { ...context, fallback: color }), l);
    slide.addShape('line', {
      objectName: name,
      x: l.x1 / 96,
      y: l.y1 / 96,
      w: (l.x2 - l.x1) / 96,
      h: (l.y2 - l.y1) / 96,
      line: {
        color: hex.slice(0, 6),
        ...(hex.length === 8 ? { transparency: (1 - parseInt(hex.slice(6), 16) / 255) * 100 } : {}),
        width: l.strokeWidth * 0.75,
        dashType: l.stroke.dash,
      },
    });
    tags.set(name, { v: 1, id, key, role: 'line' });
    if (l.label !== undefined && l.labelBox) {
      const n = id + ' label',
        b = l.labelBox;
      slide.addText(l.label, {
        isTextBox: true,
        objectName: n,
        x: b.x / 96,
        y: b.y / 96,
        w: b.width / 96,
        h: b.height / 96,
        fontFace: font,
        fontSize: size,
        color: labelColor,
        margin: 0,
        wrap: false,
        fit: 'none',
        align: l.labelAlign ?? 'center',
        // RR-105: a label core could not keep off the marks stands on a plate of the chart's surface, as in the preview.
        ...(l.labelPlate && surface ? { fill: { color: surface } } : {}),
        valign: 'middle',
      });
      tags.set(n, { v: 1, id, key, role: 'label' });
    }
  }
}
export function attachReferenceTags(entries, tags) {
  attachTextTags(entries, tags, TAG, 'opfReference', 'reference overlay');
}
function overlayTag(shape, rels, entries) {
  let found;
  for (const l of arr(shape?.['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
    const rel = rels.get(l['r:id']);
    if (
      rel?.type !== 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags' ||
      rel?.targetMode === 'External' ||
      !rel?.path ||
      !entries[rel.path]
    )
      continue;
    try {
      for (const t of arr(
        parser.parse(dec.decode(entries[rel.path]).includes(TAG) ? dec.decode(entries[rel.path]) : '')['p:tagLst']?.['p:tag'],
      ))
        if (t.name === TAG && typeof t.val === 'string' && t.val.length < 16384) {
          if (found) return;
          found = decodeTextTag(t.val);
        }
    } catch {}
  }
  return found?.v === 1 ? found : undefined;
}

// OOXML chart axis IDs use unsignedInt. IDs identify current native associations, never an array position.
const validAxisId = value => Number.isInteger(value) && value >= 0 && value <= 4294967295;
function nativeAxisId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return;
  const number = Number(value);
  return validAxisId(number) ? number : undefined;
}
function overlayAxisPairs(plot) {
  const combo = comboFromNative(plot), categories = arr(plot?.['c:catAx']), values = arr(plot?.['c:valAx']);
  if (!combo || categories.length !== 2 || values.length !== 2) return;
  const axes = new Map();
  for (const [kind, entries] of [['category', categories], ['value', values]]) for (const axis of entries) {
    const id = nativeAxisId(axis?.['c:axId']?.val);
    if (id === undefined || axes.has(id)) return;
    axes.set(id, {kind, axis});
  }
  const pairOf = group => {
    const groupIds = arr(group?.['c:axId']).map(a => nativeAxisId(a?.val));
    if (groupIds.length !== 2 || groupIds.some(id => id === undefined) || new Set(groupIds).size !== 2) return;
    const categoryId = groupIds.find(id => axes.get(id)?.kind === 'category'), valueId = groupIds.find(id => axes.get(id)?.kind === 'value');
    if (categoryId === undefined || valueId === undefined) return;
    const category = axes.get(categoryId).axis, value = axes.get(valueId).axis;
    if (nativeAxisId(category['c:crossAx']?.val) !== valueId || nativeAxisId(value['c:crossAx']?.val) !== categoryId) return;
    return {category, value, axisIds: {category: categoryId, value: valueId}};
  };
  const primary = pairOf(combo.bar);
  if (!primary) return;
  let secondary;
  for (const {node, secondary: isSecondary} of combo.lines) {
    const pair = pairOf(node);
    if (!pair) return;
    const same = pair.axisIds.category === primary.axisIds.category && pair.axisIds.value === primary.axisIds.value;
    if (same === isSecondary) return;
    if (!same) {
      if (pair.axisIds.category === primary.axisIds.category || pair.axisIds.value === primary.axisIds.value) return;
      if (secondary && (secondary.axisIds.category !== pair.axisIds.category || secondary.axisIds.value !== pair.axisIds.value)) return;
      secondary = pair;
    }
  }
  return secondary ? {value: primary, secondary} : undefined;
}
function overlayValue(record) {
  return {value: record.value, axis: record.axis, labelPosition: record.labelPosition, ...(record.axisIds === undefined ? {} : {axisIds: record.axisIds})};
}
// A bounded, deterministic identity hash, like existing data provenance. No hidden stored style overrides current native paint.
function overlayHash(doc, frame, members, value) {
  const plot = doc?.['c:chartSpace']?.['c:chart']?.['c:plotArea'];
  const state = {
    v: 1,
    value,
    // Full-plot singleton overlays must not become category-center native helpers after a category/type edit.
    // Ordinary numeric values remain outside the identity so unrelated data edits do not erase a valid explicit reference.
    chartEligibility: GROUPS.flatMap((kind) => arr(plot?.['c:' + kind]).map((group) => ({
      kind,
      direction: group['c:barDir'],
      grouping: group['c:grouping'],
      categories: arr(group['c:ser']).map((entry) => Number(cache(entry['c:cat'])?.['c:ptCount']?.val ?? 0)),
      ...(value.axisIds === undefined ? {} : {axisIds: ids(group).map(Number).sort((a,b) => a-b)}),
    }))),
    frame: frame['p:xfrm'],
    plot: plot?.['c:layout']?.['c:manualLayout'],
    axes: axisBindingProjection(plot, value.axisIds !== undefined),
    shapes: members
      .map((m) => ({ role: m.tag.role, properties: m.shape['p:spPr'], orderedProperties: m.style, text: m.shape['p:txBody'] }))
      .sort((a, b) => a.role < b.role ? -1 : a.role > b.role ? 1 : 0),
  };
  return identityHash(state);
}
function axisBindingProjection(plot, explicit) {
  const axes = ['c:catAx', 'c:valAx'].flatMap((k) =>
      arr(plot?.[k]).map((a) => ({
        kind: k,
        id: a['c:axId'],
        scale: a['c:scaling'],
        cross: a['c:crossAx'],
        between: a['c:crossBetween'],
      })),
    );
  // Only new explicitly associated receipts ignore axis declaration order; legacy V1 bytes remain exact.
  return explicit ? axes.sort((a,b) => a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : Number(a.id?.val)-Number(b.id?.val)) : axes;
}
function identityHash(state) {
  const canonical = JSON.stringify(state, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries([
          ...Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
          ...(v[colorTransforms] ? [['$colorTransforms', v[colorTransforms]]] : []),
        ])
      : v,
  );
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (const c of canonical) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619);
    b = Math.imul(b ^ c.charCodeAt(0), 2246822519);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

// V1 bound lexical XML artifacts too. Reconstruct only the observed nonrendering Office serialization,
// then require the same complete stored digest. Frame, paint, visible text and numeric changes stay bound.
function overlayOfficeHash(doc, frame, members, value) {
  const space = doc?.['c:chartSpace'], chart = space?.['c:chart'], plot = chart?.['c:plotArea'];
  const layout = plot?.['c:layout']?.['c:manualLayout'];
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return;
  const manual = {...layout};
  for (const key of ['c:x', 'c:y', 'c:w', 'c:h']) {
    const entry = layout[key];
    if (!entry || Object.keys(entry).join() !== 'val' || typeof entry.val !== 'string') return;
    const number = finiteCacheValue(entry.val);
    if (number === undefined) return;
    // Shortest exact round-trip spelling, never rounding/clipping to an exported layout.
    manual[key] = {...entry, val: Object.is(number, -0) ? '-0' : String(number)};
  }
  const axes = [];
  for (const axis of arr(plot['c:valAx'])) {
    const scale = axis?.['c:scaling'];
    if (!scale || Object.keys(scale).filter(k => k !== '#text').sort().join() !== 'c:max,c:min,c:orientation') return;
    if (Object.hasOwn(scale, '#text')) {
      if (scale['#text'] !== '  ') return;
      axes.push(axis);
    } else {
      // Exact whitespace written by the V1 generated value-axis scaling; no recursive text removal.
      axes.push({...axis, 'c:scaling': {...scale, '#text': '  '}});
    }
  }
  const normalizedMembers = [];
  for (const member of members) {
    const body = member.shape['p:txBody'];
    if (member.tag.role !== 'line' || body === undefined) {
      normalizedMembers.push(member);
      continue;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return;
    const paragraph = body['a:p'], end = paragraph?.['a:endParaRPr'];
    if (Object.keys(body).sort().join() !== 'a:bodyPr,a:lstStyle,a:p' || body['a:bodyPr'] !== '' || body['a:lstStyle'] !== '' ||
        !paragraph || Array.isArray(paragraph) || Object.keys(paragraph).join() !== 'a:endParaRPr' ||
        !end || Object.keys(end).join() !== 'lang' || typeof end.lang !== 'string' || !/^[A-Za-z0-9-]+$/.test(end.lang)) return;
    const {'p:txBody': _empty, ...shape} = member.shape;
    normalizedMembers.push({...member, shape});
  }
  // Shallow copies only: never copy chart data caches or mutate caller-owned shape/frame objects.
  const normalizedPlot = {...plot, 'c:layout': {...plot['c:layout'], 'c:manualLayout': manual}, 'c:valAx': axes};
  const normalizedDoc = {...doc, 'c:chartSpace': {...space, 'c:chart': {...chart, 'c:plotArea': normalizedPlot}}};
  return overlayHash(normalizedDoc, frame, normalizedMembers, value);
}
/** Recover explicit fallbacks only when CURRENT chart/shape evidence can express the line faithfully. Otherwise preserve visible shapes. */
export function importReferenceOverlays(shapes, frames, rels, entries, { scale = 1, colors = {}, report, slideXml } = {}) {
  const consumed = new Set(),
    byPart = new Map(),
    tagged = shapes
      .map((shape) => ({
        shape,
        tag: overlayTag(shape, rels, entries),
      }))
      .filter((e) => e.tag);
  if (!tagged.length) {
    for (const frame of frames) {
      const p = rels.get(frame['a:graphic']?.['a:graphicData']?.['c:chart']?.['r:id'])?.path;
      if (
        p &&
        entries[p] &&
        dec.decode(entries[p]).includes(URI) &&
        chartRecord(parser.parse(dec.decode(entries[p])))?.overlays.length
      )
        report?.({
          code: 'chart-reference-overlay-uncertain',
          message: 'Reference overlay tags are missing; ordinary drawings are preserved and no stale reference is restored.',
        });
    }
    return { consumed, byPart, preserved: new Set() };
  }
  const styles = shapeStyles(slideXml);
  for (const m of tagged) m.style = styles.get(String(m.shape['p:nvSpPr']?.['p:cNvPr']?.id));
  const keyCounts = new Map();
  for (const frame of frames) {
    const rel = rels.get(frame['a:graphic']?.['a:graphicData']?.['c:chart']?.['r:id']);
    const r = rel?.path && entries[rel.path] ? chartRecord(parser.parse(dec.decode(entries[rel.path]))) : undefined;
    if (r) keyCounts.set(r.key, (keyCounts.get(r.key) ?? 0) + 1);
  }
  for (const frame of frames) {
    const id = frame['a:graphic']?.['a:graphicData']?.['c:chart']?.['r:id'],
      part = rels.get(id)?.path;
    if (!part || !entries[part]) continue;
    const doc = parser.parse(dec.decode(entries[part])),
      r = chartRecord(doc);
    if (!r?.overlays.length) continue;
    if (keyCounts.get(r.key) !== 1) {
      report?.({
        code: 'chart-reference-overlay-uncertain',
        message:
          'Two chart frames claim the same overlay ownership; every visible overlay is preserved and no reference is restored.',
      });
      continue;
    }
    const plot = doc['c:chartSpace']?.['c:chart']?.['c:plotArea'],
      layout = plot?.['c:layout']?.['c:manualLayout'],
      off = frame['p:xfrm']?.['a:off'],
      ext = frame['p:xfrm']?.['a:ext'];
    const x = Number(off?.x) / 9525,
      y = Number(off?.y) / 9525,
      w = Number(ext?.cx) / 9525,
      h = Number(ext?.cy) / 9525,
      px = x + Number(layout?.['c:x']?.val) * w,
      py = y + Number(layout?.['c:y']?.val) * h,
      pw = Number(layout?.['c:w']?.val) * w,
      ph = Number(layout?.['c:h']?.val) * h;
    const horizontal = arr(plot?.['c:barChart'])[0]?.['c:barDir']?.val === 'bar',
      multiAxis = arr(plot?.['c:valAx']).length !== 1 || arr(plot?.['c:catAx']).length !== 1,
      pairs = multiAxis ? overlayAxisPairs(plot) : undefined;
    const refs = [];
    for (const o of r.overlays) {
      const pair = multiAxis && (o.axis === 'value' || o.axis === 'secondary') ? pairs?.[o.axis] : undefined,
        axis = multiAxis ? pair?.value : arr(plot?.['c:valAx'])[0],
        min = Number(axis?.['c:scaling']?.['c:min']?.val),
        max = Number(axis?.['c:scaling']?.['c:max']?.val);
      const association = multiAxis ? pair && o.axisIds && Object.keys(o.axisIds).sort().join() === 'category,value' &&
        validAxisId(o.axisIds.category) && validAxisId(o.axisIds.value) &&
        o.axisIds.category === pair.axisIds.category && o.axisIds.value === pair.axisIds.value : o.axis === 'value' && o.axisIds === undefined;
      const members = tagged.filter((e) => e.tag.id === o.id && e.tag.key === r.key),
        lines = members.filter((e) => e.tag.role === 'line'),
        labels = members.filter((e) => e.tag.role === 'label'),
        line = lines[0]?.shape,
        s = line?.['p:spPr'],
        t = s?.['a:xfrm'],
        a = t?.['a:off'],
        b = t?.['a:ext'],
        lx = Number(a?.x) / 9525,
        ly = Number(a?.y) / 9525,
        lw = Number(b?.cx) / 9525,
        lh = Number(b?.cy) / 9525,
        paint = stroke(styles.get(String(line?.['p:nvSpPr']?.['p:cNvPr']?.id)) ?? s, scale, colors),
        near = (a, b) => Math.abs(a - b) < 0.02;
      let valid =
        layout?.['c:layoutTarget']?.val === 'inner' &&
        [px, py, pw, ph, min, max].every(Number.isFinite) &&
        pw > 0 &&
        ph > 0 &&
        max > min &&
        association &&
        lines.length === 1 &&
        labels.length <= 1 &&
        paint &&
        !Number(t?.rot) &&
        !t?.flipH &&
        !t?.flipV &&
        (horizontal ? near(lw, 0) && lh > 0 : near(lh, 0) && lw > 0);
      const value = overlayValue(o);
      valid &&=
        Number.isFinite(o.value) &&
        ['start', 'end'].includes(o.labelPosition) &&
        typeof o.binding === 'string' &&
        (o.binding === overlayHash(doc, frame, members, value) || o.binding === overlayOfficeHash(doc, frame, members, value));
      const label = labels.length
        ? arr(labels[0].shape['p:txBody']?.['a:p'])
            .map((p) =>
              arr(p['a:r'])
                .map((run) => text(run['a:t']))
                .join(''),
            )
            .join('\n')
        : undefined;
      if (!valid) {
        report?.({
          code: 'chart-reference-overlay-uncertain',
          message:
            'An explicit reference overlay no longer agrees with its versioned line/label/plot/axis binding, or a legacy multi-axis receipt has no explicit pair. Its visible line and label remain ordinary shapes; re-export the OPF source to create a current binding.',
        });
        continue;
      }
      refs.push(
        authoredReference(
          { index: o.index, value: o.value, axis: o.axis, ...(label ? { label, labelPosition: o.labelPosition } : {}), stroke: paint },
          o,
          currentPaintKey(styles.get(String(line?.['p:nvSpPr']?.['p:cNvPr']?.id)) ?? s, colors),
          report,
        ),
      );
      for (const m of members) consumed.add(m.shape);
    }
    byPart.set(part, refs);
  }
  return { consumed, byPart, preserved: new Set(tagged.filter((e) => !consumed.has(e.shape)).map((e) => e.shape)) };
}
/** Preserve every ordinary mixed group instead of silently selecting the first area/line group. */
export function ordinaryMixedGroups(plot) {
  const groups = GROUPS.flatMap((kind) => arr(plot?.['c:' + kind]).map((node) => ({ kind, node })));
  if (groups.length < 2) return;
  const axes = arr(plot['c:valAx']),
    primary = axes.find((a) => ids(groups[0].node).includes(String(a['c:axId']?.val))),
    primaryId = String(primary?.['c:axId']?.val);
  return groups
    .flatMap((g) =>
      arr(g.node['c:ser']).map((ser) => ({
        ser,
        role: g.kind === 'lineChart' ? 'line' : 'bar',
        secondary: g.kind === 'lineChart' && !ids(g.node).includes(primaryId),
        area: g.kind === 'areaChart',
      })),
    )
    .map((e, i) => ({ ...e, index: i, key: Number(e.ser['c:order']?.val ?? i) }))
    .sort((a, b) => a.key - b.key || a.index - b.index);
}

/** Bind fallback receipts after final proofing/font/theme normalization, immediately before document/data provenance. */
export function sealReferenceBindings(entries, infos, relationships) {
  const owned = new Map([...infos].filter(([, i]) => i.references?.lines.some((l) => !l.native)));
  if (!owned.size) return;
  for (const [part, bytes] of Object.entries(entries)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(part)) continue;
    if (
      ![...dec.decode(bytes).matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)].some(([f]) =>
        owned.has(/<p:cNvPr\b[^>]*\bname="([^"]+)"/.exec(f)?.[1]),
      )
    )
      continue;
    const widths = new Map(
      [...infos.values()].flatMap((i) =>
        (i.references?.lines ?? [])
          .filter((l) => !l.native)
          .map((l) => [i.references.key + ':' + l.index + ' line', Math.round(l.strokeWidth * 9525)]),
      ),
    );
    const slideXml = dec.decode(bytes).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (shape) => {
      const name = /<p:cNvPr\b[^>]*\bname="([^"]+)"/.exec(shape)?.[1];
      if (!widths.has(name)) return shape;
      return shape.replace(/(<a:ln\b[^>]*\bw=")[^"]*(")/, (_m, a, b) => a + widths.get(name) + b);
    });
    entries[part] = enc.encode(slideXml);
    const styles = shapeStyles(slideXml),
      tree = parser.parse(slideXml)?.['p:sld']?.['p:cSld']?.['p:spTree'],
      rels = relationships(entries, part),
      shapes = arr(tree?.['p:sp']);
    for (const frame of arr(tree?.['p:graphicFrame'])) {
      const name = frame['p:nvGraphicFramePr']?.['p:cNvPr']?.name,
        info = infos.get(name)?.references;
      if (!info) continue;
      const id = frame['a:graphic']?.['a:graphicData']?.['c:chart']?.['r:id'],
        p = rels.get(id)?.path;
      if (!p || !entries[p]) throw Error('Missing final reference chart.');
      const xml = dec.decode(entries[p]),
        doc = parser.parse(xml),
        r = chartRecord(doc);
      if (!r) throw Error('Missing reference identity.');
      r.overlays = r.overlays.map((o) => {
        const members = shapes
          .filter((s) => String(s['p:nvSpPr']?.['p:cNvPr']?.name ?? '').startsWith(o.id + ' '))
          .map((shape) => ({
            shape,
            style: styles.get(String(shape['p:nvSpPr']?.['p:cNvPr']?.id)),
            tag: { role: shape['p:nvSpPr']['p:cNvPr'].name === o.id + ' line' ? 'line' : 'label' },
          }));
        return {
          ...o,
          binding: overlayHash(doc, frame, members, overlayValue(o)),
        };
      });
      entries[p] = enc.encode(
        xml.replace(/(<opf:references\b[^>]*\bdata=")[^"]*("\s*\/>)/, (_m, a, b) => a + encodeTextTag(r) + b),
      );
    }
  }
}

function shapeStyles(xml) {
  const shapes = xml ? drawingObject(ordered.parse(xml))?.['p:sld']?.['p:cSld']?.['p:spTree']?.['p:sp'] : [];
  return new Map(arr(shapes).map((s) => [String(s['p:nvSpPr']?.['p:cNvPr']?.id), s['p:spPr']]));
}

export function coalesceOrdinaryLines(plot) {
  const groups = arr(plot?.['c:lineChart']);
  if (groups.length < 2 || NATIVE_CHART_ELEMENTS.some((k) => k !== 'lineChart' && plot?.['c:' + k])) return;
  if (groups.some((g) => !['standard', undefined].includes(g['c:grouping']?.val))) return;
  const axis = JSON.stringify([...ids(groups[0])].sort());
  if (groups.some((g) => JSON.stringify([...ids(g)].sort()) !== axis)) return;
  const entries = groups
    .flatMap((g) => arr(g['c:ser']))
    .map((ser, i) => ({ ser, i, order: Number(ser['c:order']?.val ?? i) }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((e) => e.ser);
  return { ...groups[0], 'c:ser': entries };
}

/**
 * RR-105: PowerPoint lists a chart's legend by chart group, the groups on the primary axes before those on the secondary axes, and a
 * c:legendEntry names its entry by its place in that list. A combo with a reference on each axis has a helper group on the primary
 * axes after the authored line group on the secondary axes, so the helper's c:idx was not its legend place: deleting the helpers'
 * entries by c:idx hid the authored line series instead. The series indexes are renumbered in legend order (c:order, the plotting
 * order, is unchanged), so an entry's place and its series' c:idx agree. Returns the part and Map<old c:idx, new c:idx>; a chart whose
 * groups are already in that order keeps its bytes.
 */
function legendOrderIndexes(xml) {
  const indexes = new Map(),
    plot = /<c:plotArea>[\s\S]*<\/c:plotArea>/.exec(xml);
  if (!plot) return { xml, indexes };
  const primary = /<c:valAx>\s*<c:axId val="([^"]+)"/.exec(plot[0])?.[1];
  const groups = [...plot[0].matchAll(/<c:(\w+Chart)>[\s\S]*?<\/c:\1>/g)].map((m) => ({
    xml: m[0],
    primary: primary === undefined || [...m[0].matchAll(/<c:axId val="([^"]+)"\/>/g)].some((a) => a[1] === primary),
    series: [...m[0].matchAll(/<c:ser>\s*<c:idx val="(\d+)"\/>/g)].map((s) => Number(s[1])),
  }));
  let next = 0;
  for (const group of [...groups.filter((g) => g.primary), ...groups.filter((g) => !g.primary)])
    for (const idx of group.series) indexes.set(idx, next++);
  if ([...indexes].every(([from, to]) => from === to)) return { xml, indexes };
  let body = plot[0];
  for (const group of groups)
    body = body.replace(group.xml, group.xml.replace(/(<c:ser>\s*<c:idx val=")(\d+)("\/>)/g, (_, a, idx, b) => a + indexes.get(Number(idx)) + b));
  const remapped = xml.slice(0, plot.index) + body + xml.slice(plot.index + plot[0].length);
  return {
    xml: remapped.replace(/(<c:legendEntry>\s*<c:idx val=")(\d+)("\/>)/g, (_, a, idx, b) => a + (indexes.get(Number(idx)) ?? idx) + b),
    indexes,
  };
}

/** A helper's label as chart rich text: a paragraph a line, its runs in the slide's language (`lang`, en-US when the plan names none). */
function nativeLabelXml(label, info, lang = 'en-US') {
  const run = (part) =>
    '<a:r><a:rPr lang="' +
    escape(lang) +
    '" sz="' +
    info.textSize +
    '"><a:solidFill><a:srgbClr val="' +
    info.labelColor +
    '"/></a:solidFill><a:latin typeface="' +
    escape(info.font) +
    '"/><a:ea typeface="' +
    escape(info.font) +
    '"/><a:cs typeface="' +
    escape(info.font) +
    '"/></a:rPr><a:t>' +
    escape(part) +
    '</a:t></a:r>';
  return (
    '<c:rich><a:bodyPr/><a:lstStyle/>' +
    String(label)
      .split(/\r\n|\r|\n/)
      .map((p) => '<a:p><a:pPr/>' + run(p) + '</a:p>')
      .join('') +
    '</c:rich>'
  );
}
function currentLabelText(nodes) {
  const child = (nodes, key) => arr(nodes).find((n) => Object.hasOwn(n, key))?.[key],
    ser = child(nodes, 'c:ser'),
    labels = child(ser, 'c:dLbls'),
    points = arr(labels).filter((n) => Object.hasOwn(n, 'c:dLbl'));
  if (points.length !== 1) return;
  const tx = child(points[0]['c:dLbl'], 'c:tx'),
    rich = child(tx, 'c:rich');
  if (!rich || rich.some((n) => !['a:bodyPr', 'a:lstStyle', 'a:p'].some((k) => Object.hasOwn(n, k)))) return;
  const paragraphs = arr(rich).filter((n) => Object.hasOwn(n, 'a:p'));
  if (!paragraphs.length) return;
  const output = [];
  for (const paragraph of paragraphs) {
    let text = '';
    for (const n of paragraph['a:p']) {
      if (n['a:pPr'] !== undefined || n['a:endParaRPr'] !== undefined) continue;
      if (n['a:br'] !== undefined) {
        text += '\n';
        continue;
      }
      if (n['a:r'] === undefined) return;
      for (const r of n['a:r']) {
        if (r['a:rPr'] !== undefined) continue;
        if (r['a:t'] === undefined) return;
        text += arr(r['a:t'])
          .map((v) => String(v['#text'] ?? ''))
          .join('');
      }
    }
    output.push(text);
  }
  return output.join('\n');
}

function unsupportedReferenceLabels(node, kind) {
  const on = (n) => ['1', 1, true, 'true'].includes(n?.val);
  if (on(node?.['c:delete'])) return false;
  // PowerPoint adds percent/bubble defaults when saving explicit line labels; neither applies to a line series.
  // Keep every visible line-label/leader/manual-layout refusal, and the conservative flags for any other family.
  const flags = ['showVal', 'showCatName', 'showSerName', 'showLegendKey', ...(kind === 'lineChart' ? [] : ['showPercent', 'showBubbleSize'])];
  const unsupported = (n) =>
    flags.some((f) => on(n?.['c:' + f])) ||
    on(n?.['c:showLeaderLines']) ||
    n?.['c:leaderLines'] !== undefined ||
    !!n?.['c:layout']?.['c:manualLayout'];
  return unsupported(node) || arr(node?.['c:dLbl']).some((label) => !on(label['c:delete']) && unsupported(label));
}
