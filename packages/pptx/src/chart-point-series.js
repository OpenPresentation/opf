// opf#1415: the legend of a one-series chart whose points have their own colors names the series, as the preview draws it.
//
// PowerPoint lists the points of a chart's only series in its legend (one entry per category) as soon as one of its points carries its
// own formatting (a c:dPt), whatever c:varyColors says. The highlight, emphasis and focus plans (chart-highlight.js, chart-layer.js)
// write exactly such points, so a highlighted one-series column or bar chart with a legend showed "North, South, East" in PowerPoint and
// "Wait" in the preview. The owner's decision (2026-11-24): the legend names the series in both, so the export changes.
//
// The export writes every look of the colored points as one more series of the same name, after the authored series in its chart group:
//
//   column, bar   the colored points move to their look's series (value, c:dPt fill as the series fill, their own data labels) and
//                 leave a gap in the authored series; the bar group's c:overlap is 100, so each category still holds one bar of the
//                 group's width, and a stack of one series stays one segment;
//   line          the authored line keeps every value and label; each look's series holds only its points, draws no line (a:ln noFill)
//                 and the c:dPt marker as its marker, so the marker sits on the line where the c:dPt drew it, and its labels are off;
//
// and each added series' legend entry is deleted (c:legendEntry by its place in the legend, which equals its c:idx: the added series
// take the c:idx after the authored one, and every later series and legend entry moves up by as many). The embedded workbook holds
// each added series' column (header and values) after the last column the chart uses, outside the generated table (whose column
// names must be unique), and a column or bar point that moved is a blank cell in the authored column, so Edit Data shows what the
// chart draws and a refresh from the workbook changes nothing. This runs last on the final chart parts, after the reference bindings and
// the data records (src/chart-references.js, src/data-provenance.js) have sealed their evidence from the authored form.
//
// Each added series carries `opf:pointSeries` (OPF_* style uppercase-hex JSON `{v: 1, base, kind, overlap}`) in its c:extLst. Import
// first joins the added series back into the authored one (joinPointSeries), in memory, before anything reads the chart: the points'
// c:dPt (from the added series' current fill or marker), their values and labels, the overlap and the legend entries, so every later
// step (data and reference evidence, options, highlight) reads the chart as it was before the split. A split that no longer has its
// shape (a series removed or reordered, overlapping points) is reported and the series import as they are.
import {decodeTextTag, encodeTextTag} from './code-provenance.js';
import {children, SERIES_SEQUENCES} from './chart-order.js';
import {REFERENCE_URI} from './chart-references.js';

export const POINT_SERIES_URI = 'urn:openpresentation:chart-point-series:v1';
// The chart groups where PowerPoint lists the points of a lone series with a formatted point and OPF writes such points: column and
// bar (c:barChart, clustered and stacked), and line (c:lineChart, the marker of a highlighted point). Pie and doughnut list their
// points by design; area, radar and scatter highlights color whole series and write no c:dPt.
const KINDS = {barChart: 'bar', lineChart: 'line'};

const SER = /<c:ser>[\s\S]*?<\/c:ser>/g;
const LABEL = /<c:dLbl>[\s\S]*?<\/c:dLbl>/g;
const POINT = /<c:pt idx="(\d+)"[^>]*>[\s\S]*?<\/c:pt>/g;
const idxOf = text => Number(/<c:idx val="(\d+)"\/>/.exec(text)?.[1]);
const valOf = text => Number(/\bval="(-?\d+)"/.exec(text)?.[1]);
const columnNumber = letters => [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
const columnName = number => { let name = ''; for (let n = number; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name; return name; };
const lead = text => /^\s*/.exec(text)[0];

// `Sheet1!$B$2:$B$4` or `'My sheet'!$B$1`: {sheetText, sheet, column, first, last}.
function reference(formula) {
  const match = /^((?:'(?:[^']|'')+'|[^'!]+))!\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/.exec(String(formula ?? '').trim());
  if (!match || (match[4] !== undefined && match[4] !== match[2])) return undefined;
  const sheet = match[1].startsWith("'") ? match[1].slice(1, -1).replaceAll("''", "'") : match[1];
  return {sheetText: match[1], sheet, column: match[2], first: Number(match[3]), last: Number(match[5] ?? match[3])};
}
const formulaOf = text => /<c:f>([^<]*)<\/c:f>/.exec(text ?? '')?.[1];

function parse(ser) {
  const parsed = children(ser.slice('<c:ser>'.length, -'</c:ser>'.length));
  return parsed && {items: parsed.items, tail: parsed.tail};
}
const text = series => `<c:ser>${series.items.map(item => item.text).join('')}${series.tail}</c:ser>`;
const item = (series, name) => series.items.find(entry => entry.name === name);
const drop = (series, name) => ({...series, items: series.items.filter(entry => entry.name !== name)});
const edit = (series, name, change) => ({...series, items: series.items.map(entry => entry.name === name ? {name, text: change(entry.text)} : entry)});
// Replace a child, or insert it at its place in the CT_*Ser sequence.
function put(series, name, xml, sequence) {
  const at = series.items.findIndex(entry => entry.name === name);
  if (at >= 0) return {...series, items: series.items.map((entry, index) => index === at ? {name, text: lead(entry.text) + xml} : entry)};
  const rank = entry => sequence.indexOf(entry.slice(2));
  const before = series.items.findIndex(entry => rank(entry.name) > rank(name));
  const items = [...series.items];
  items.splice(before < 0 ? items.length : before, 0, {name, text: xml});
  return {...series, items};
}
const record = ser => {
  const data = new RegExp(`<c:ext uri="${POINT_SERIES_URI}">\\s*<opf:pointSeries\\b[^>]*\\bdata="([0-9A-Fa-f]+)"`).exec(ser)?.[1];
  if (!data || data.length > 4096) return undefined;
  try { const value = decodeTextTag(data); return value?.v === 1 ? value : undefined; } catch { return undefined; }
};
const extension = value => `<c:extLst><c:ext uri="${POINT_SERIES_URI}"><opf:pointSeries xmlns:opf="${POINT_SERIES_URI}" data="${encodeTextTag(value)}"/></c:ext></c:extLst>`;

// The series of a plot area in document order, with their chart group.
function plotSeries(plot) {
  const out = [];
  for (const group of plot.matchAll(/<c:(\w+Chart)>[\s\S]*?<\/c:\1>/g)) {
    for (const ser of group[0].matchAll(SER)) out.push({kind: group[1], text: ser[0], group: group.index, at: group.index + ser.index});
  }
  return out;
}

function legendEntries(legend) {
  return [...legend.matchAll(/<c:legendEntry>[\s\S]*?<\/c:legendEntry>/g)].map(match => ({text: match[0], idx: idxOf(match[0])}));
}
// The legend with its entries replaced (sorted by place, right after c:legendPos, CT_Legend order).
function withLegendEntries(legend, entries) {
  const bare = legend.replace(/<c:legendEntry>[\s\S]*?<\/c:legendEntry>/g, '');
  const list = [...entries].sort((a, b) => a.idx - b.idx).map(entry => entry.text).join('');
  return /<c:legendPos\b[^>]*\/>/.test(bare) ? bare.replace(/<c:legendPos\b[^>]*\/>/, match => match + list) : bare.replace('<c:legend>', `<c:legend>${list}`);
}
const renumber = (ser, from, by, orderFrom) => ser
  .replace(/^(<c:ser>\s*<c:idx val=")(\d+)/, (match, head, idx) => Number(idx) > from ? head + (Number(idx) + by) : match)
  .replace(/(<c:order val=")(\d+)/, (match, head, order) => Number(order) > orderFrom ? head + (Number(order) + by) : match);

/**
 * Split the colored points of a lone series into series of their own (see the module comment). `xml` is a final classic chart part.
 * Returns `{xml}` unchanged when the chart is not one this covers, else `{xml, workbook}`, where `workbook` is what
 * writePointSeriesWorkbook writes: `{sheet, column, firstRow, header, columns: [{column, rows}], blank: [row]}`.
 */
export function splitPointSeries(xml) {
  const legend = /<c:legend>[\s\S]*?<\/c:legend>/.exec(xml);
  const plot = /<c:plotArea>[\s\S]*<\/c:plotArea>/.exec(xml);
  if (!legend || !plot || xml.includes(POINT_SERIES_URI)) return {xml};
  const all = plotSeries(plot[0]);
  const ordinary = all.filter(entry => !entry.text.includes(REFERENCE_URI));
  if (ordinary.length !== 1 || !KINDS[ordinary[0].kind]) return {xml};
  const base = ordinary[0], kind = KINDS[base.kind], sequence = SERIES_SEQUENCES[base.kind];
  const series = parse(base.text);
  if (!series) return {xml};
  const points = series.items.filter(entry => entry.name === 'c:dPt');
  if (!points.length) return {xml};
  const P = valOf(item(series, 'c:idx')?.text ?? ''), O = valOf(item(series, 'c:order')?.text ?? '');
  if (!Number.isSafeInteger(P) || !Number.isSafeInteger(O)) return {xml};
  const entries = legendEntries(legend[0]);
  if (entries.some(entry => entry.idx === P && /<c:delete val="(?:1|true)"\/>/.test(entry.text))) return {xml};
  // The looks of the colored points, in the order of their first point: the c:dPt body after its c:idx.
  const looks = new Map();
  for (const point of points) {
    const match = /^\s*<c:dPt>\s*<c:idx val="(\d+)"\/>([\s\S]*)<\/c:dPt>$/.exec(point.text);
    const look = match?.[2];
    if (!look || !children(look)) return {xml};
    if (kind === 'bar' ? !/<c:spPr>/.test(look) : !/<c:marker>/.test(look)) return {xml};
    if (!looks.has(look)) looks.set(look, []);
    looks.get(look).push(Number(match[1]));
  }
  const name = reference(formulaOf(item(series, 'c:tx')?.text)), values = reference(formulaOf(item(series, 'c:val')?.text));
  if (!name || !values || name.sheet !== values.sheet || name.column !== values.column || !/<c:numCache>/.test(item(series, 'c:val').text)) return {xml};
  const header = /<c:strCache>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(item(series, 'c:tx').text)?.[1] ?? '';
  // The added columns follow the last column any formula of the chart names (the authored series, then reference helpers).
  const last = Math.max(...[...xml.matchAll(/<c:f>([^<]*)<\/c:f>/g)].map(match => columnNumber(reference(match[1])?.column ?? 'A')));
  const n = looks.size, moved = new Set([...looks.values()].flat());
  const overlap = /<c:overlap val="(-?\d+)"\/>/.exec(plot[0].slice(base.group, plot[0].indexOf(`</c:${base.kind}>`, base.group)))?.[1] ?? null;
  const labels = item(series, 'c:dLbls')?.text;
  const added = [...looks].map(([look, rows], index) => {
    const k = index + 1, column = columnName(last + k);
    const parts = children(look).items;
    let extra = {items: series.items.filter(entry => !['c:dPt', 'c:extLst'].includes(entry.name)), tail: series.tail};
    extra = edit(extra, 'c:idx', value => value.replace(/val="\d+"/, `val="${P + k}"`));
    extra = edit(extra, 'c:order', value => value.replace(/val="\d+"/, `val="${O + k}"`));
    extra = edit(extra, 'c:tx', value => value.replace(/<c:f>[^<]*<\/c:f>/, `<c:f>${name.sheetText}!$${column}$${name.first}</c:f>`));
    if (kind === 'bar') {
      extra = put(extra, 'c:spPr', parts.find(part => part.name === 'c:spPr').text.trim(), sequence);
      const invert = parts.find(part => part.name === 'c:invertIfNegative');
      if (invert) extra = put(extra, 'c:invertIfNegative', invert.text.trim(), sequence);
      if (labels) extra = edit(extra, 'c:dLbls', value => value.replace(LABEL, label => rows.includes(idxOf(label)) ? label : ''));
    } else {
      extra = put(extra, 'c:spPr', '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>', sequence);
      extra = put(extra, 'c:marker', parts.find(part => part.name === 'c:marker').text.trim(), sequence);
      extra = put(extra, 'c:dLbls', '<c:dLbls><c:delete val="1"/></c:dLbls>', sequence);
    }
    extra = edit(extra, 'c:val', value => value
      .replace(/<c:f>[^<]*<\/c:f>/, `<c:f>${values.sheetText}!$${column}$${values.first}:$${column}$${values.last}</c:f>`)
      .replace(POINT, (pt, row) => rows.includes(Number(row)) ? pt : ''));
    extra = put(extra, 'c:extLst', extension({v: 1, base: P, kind, overlap}), sequence);
    const present = [...item(series, 'c:val').text.matchAll(POINT)].map(match => Number(match[1])).filter(row => rows.includes(row));
    return {xml: text(extra), column, rows: present.map(row => values.first + row)};
  });
  let authored = drop(series, 'c:dPt');
  if (kind === 'bar') {
    if (labels) authored = edit(authored, 'c:dLbls', value => value.replace(LABEL, label => moved.has(idxOf(label)) ? '' : label));
    authored = edit(authored, 'c:val', value => value.replace(POINT, (pt, row) => moved.has(Number(row)) ? '' : pt));
  }
  // Every other series and legend entry after the authored one moves up by the added count.
  let body = '';
  let cursor = 0;
  for (const entry of all) {
    body += plot[0].slice(cursor, entry.at);
    body += entry === base ? text(authored) + added.map(extra => extra.xml).join('') : renumber(entry.text, P, n, O);
    cursor = entry.at + entry.text.length;
  }
  body += plot[0].slice(cursor);
  if (kind === 'bar') {
    const start = body.indexOf(`<c:${base.kind}>`, 0), end = body.indexOf(`</c:${base.kind}>`, start);
    let group = body.slice(start, end);
    group = /<c:overlap val="-?\d+"\/>/.test(group) ? group.replace(/<c:overlap val="-?\d+"\/>/, '<c:overlap val="100"/>')
      : /<c:gapWidth\b[^>]*\/>/.test(group) ? group.replace(/<c:gapWidth\b[^>]*\/>/, match => `${match}<c:overlap val="100"/>`)
        : group.replace(/(\s*<c:(?:serLines|axId)\b)/, '<c:overlap val="100"/>$1');
    body = body.slice(0, start) + group + body.slice(end);
  }
  const shifted = entries.map(entry => entry.idx > P ? {idx: entry.idx + n, text: entry.text.replace(/<c:idx val="\d+"\/>/, `<c:idx val="${entry.idx + n}"/>`)} : entry);
  const deleted = added.map((_, index) => ({idx: P + index + 1, text: `<c:legendEntry><c:idx val="${P + index + 1}"/><c:delete val="1"/></c:legendEntry>`}));
  let out = xml.slice(0, plot.index) + body + xml.slice(plot.index + plot[0].length);
  out = out.replace(/<c:legend>[\s\S]*?<\/c:legend>/, withLegendEntries(legend[0], [...shifted, ...deleted]));
  return {xml: out, workbook: {sheet: name.sheet, column: values.column, headerRow: name.first, header, columns: added.map(({column, rows}) => ({column, rows})), blank: kind === 'bar' ? [...moved].map(row => values.first + row) : []}};
}

/**
 * The added columns of a split chart in its embedded workbook: `workbook` maps the unzipped part names to bytes and is changed in place;
 * `plan` is splitPointSeries' `workbook`. Each column's header is the series name (an inline string) and its cells copy the authored
 * column's cells of its rows (value and number format); a column or bar point that moved leaves a blank cell, its style kept.
 */
export function writePointSeriesWorkbook(workbook, plan) {
  const decoder = new TextDecoder('utf-8', {fatal: true}), encoder = new TextEncoder();
  const book = decoder.decode(workbook['xl/workbook.xml']);
  const sheet = [...book.matchAll(/<sheet\b[^>]*\/>/g)].map(match => match[0]).find(tag => /\bname="([^"]*)"/.exec(tag)?.[1].replace(/&apos;/g, "'").replace(/&amp;/g, '&') === plan.sheet);
  const id = sheet && /\br:id="([^"]+)"/.exec(sheet)?.[1];
  const rels = decoder.decode(workbook['xl/_rels/workbook.xml.rels'] ?? new Uint8Array());
  const target = id && new RegExp(`<Relationship\\b(?=[^>]*\\bId="${id}")[^>]*\\bTarget="([^"]+)"`).exec(rels)?.[1];
  const path = target && (target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  if (!path || !workbook[path]) throw Error('The chart workbook has no sheet for the split series.');
  let xml = decoder.decode(workbook[path]);
  const cellPattern = (column, row) => new RegExp(`<c r="${column}${row}"(?=[\\s/>])[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);
  const cells = new Map();
  const add = (row, cell) => { if (!cells.has(row)) cells.set(row, []); cells.get(row).push(cell); };
  for (const {column, rows} of plan.columns) {
    add(plan.headerRow, `<c r="${column}${plan.headerRow}" t="inlineStr"><is><t xml:space="preserve">${plan.header}</t></is></c>`);
    for (const row of rows) {
      const cell = cellPattern(plan.column, row).exec(xml)?.[0];
      if (!cell) throw Error('The chart workbook has no cell for a split point.');
      add(row, cell.replace(`r="${plan.column}${row}"`, `r="${column}${row}"`));
    }
  }
  for (const row of plan.blank) xml = xml.replace(cellPattern(plan.column, row), cell => cell.replace(/^<c\b([^>]*?)\s*\/?>[\s\S]*$/, (_match, attributes) => `<c${attributes.replace(/\s+t="[^"]*"/, '')}/>`));
  const widest = columnNumber(plan.columns.at(-1).column);
  for (const [row, list] of cells) {
    const pattern = new RegExp(`(<row\\b(?=[^>]*\\br="${row}")[^>]*?)(\\/>|>([\\s\\S]*?)<\\/row>)`);
    if (!pattern.test(xml)) throw Error('The chart workbook has no row for a split point.');
    xml = xml.replace(pattern, (_match, open, close, inner) => `${open.replace(/\bspans="(\d+):(\d+)"/, (_spans, from, to) => `spans="${from}:${Math.max(Number(to), widest)}"`)}>${inner ?? ''}${list.join('')}</row>`);
  }
  workbook[path] = encoder.encode(xml);
  return workbook;
}

/**
 * Import: the split series of every one-series chart back into the authored series (see the module comment). Returns the chart part
 * unchanged when it has none, or when the split no longer has its exported shape (then `report` names it).
 */
export function joinPointSeries(xml, report) {
  if (!xml.includes(POINT_SERIES_URI)) return xml;
  try {
    return join(xml);
  } catch (error) {
    report?.({code: 'chart-point-series-uncertain', option: 'highlight', message: `A chart's series that its export split for the legend (one series per point color, so the legend names the series) no longer have the exported shape (${error.message}); they import as separate series.`});
    return xml;
  }
}

function join(xml) {
  const plot = /<c:plotArea>[\s\S]*<\/c:plotArea>/.exec(xml);
  if (!plot) throw Error('no plot area');
  const all = plotSeries(plot[0]);
  const extras = all.map(entry => ({...entry, record: record(entry.text)})).filter(entry => entry.text.includes(POINT_SERIES_URI));
  if (extras.some(entry => !entry.record)) throw Error('a split record cannot be read');
  const P = extras[0].record.base, kind = extras[0].record.kind, overlap = extras[0].record.overlap;
  if (extras.some(entry => entry.record.base !== P || entry.record.kind !== kind || entry.record.overlap !== overlap) || KINDS[extras[0].kind] !== kind) throw Error('the split records disagree');
  const bases = all.filter(entry => !entry.text.includes(POINT_SERIES_URI) && idxOf(entry.text) === P);
  if (bases.length !== 1) throw Error('the authored series is missing');
  const base = bases[0], at = all.indexOf(base), n = extras.length;
  if (extras.some((entry, index) => all[at + index + 1]?.at !== entry.at || entry.group !== base.group || idxOf(entry.text) !== P + index + 1)) throw Error('the split series were moved');
  const sequence = SERIES_SEQUENCES[base.kind];
  let series = parse(base.text);
  if (!series) throw Error('the authored series cannot be read');
  const O = valOf(item(series, 'c:order')?.text ?? '');
  const pointsOf = ser => [...(item(ser, 'c:val')?.text ?? '').matchAll(POINT)].map(match => ({row: Number(match[1]), text: match[0]}));
  const dPts = [], labels = [], values = [];
  const taken = new Set(pointsOf(series).map(point => point.row));
  for (const entry of extras) {
    const extra = parse(entry.text);
    if (!extra) throw Error('a split series cannot be read');
    for (const point of pointsOf(extra)) {
      if (kind === 'bar') {
        if (taken.has(point.row)) throw Error('a point has two values');
        taken.add(point.row);
        values.push(point);
        const invert = item(extra, 'c:invertIfNegative')?.text.trim() ?? '<c:invertIfNegative val="0"/>';
        dPts.push({row: point.row, text: `<c:dPt><c:idx val="${point.row}"/>${invert}<c:bubble3D val="0"/>${item(extra, 'c:spPr')?.text.trim() ?? ''}</c:dPt>`});
        for (const label of (item(extra, 'c:dLbls')?.text ?? '').match(LABEL) ?? []) if (idxOf(label) === point.row) labels.push({row: point.row, text: label});
      } else {
        dPts.push({row: point.row, text: `<c:dPt><c:idx val="${point.row}"/>${item(extra, 'c:marker')?.text.trim() ?? ''}<c:bubble3D val="0"/></c:dPt>`});
      }
    }
  }
  // The points, values and labels in index order, among those the authored series still has.
  const existing = series.items.filter(entry => entry.name === 'c:dPt').map(entry => ({row: idxOf(entry.text), text: entry.text.trim()}));
  const points = [...existing, ...dPts].sort((a, b) => a.row - b.row);
  series = drop(series, 'c:dPt');
  const rank = name => sequence.indexOf(name.slice(2));
  const before = series.items.findIndex(entry => rank(entry.name) > rank('c:dPt'));
  series.items.splice(before < 0 ? series.items.length : before, 0, ...points.map(point => ({name: 'c:dPt', text: point.text})));
  if (values.length) series = edit(series, 'c:val', value => {
    const merged = [...[...value.matchAll(POINT)].map(match => ({row: Number(match[1]), text: match[0]})), ...values].sort((a, b) => a.row - b.row);
    return value.replace(POINT, '').replace(/(<c:ptCount val="\d+"\/>)/, `$1${merged.map(point => point.text).join('')}`);
  });
  if (labels.length) {
    if (!item(series, 'c:dLbls')) throw Error('the authored series has no data labels');
    series = edit(series, 'c:dLbls', value => {
      const merged = [...(value.match(LABEL) ?? []).map(label => ({row: idxOf(label), text: label})), ...labels].sort((a, b) => a.row - b.row);
      return value.replace(LABEL, '').replace('<c:dLbls>', `<c:dLbls>${merged.map(label => label.text).join('')}`);
    });
  }
  let body = '', cursor = 0;
  for (const entry of all) {
    body += plot[0].slice(cursor, entry.at);
    if (entry === base) body += text(series);
    else if (!extras.some(extra => extra.at === entry.at)) body += renumber(entry.text, P + n, -n, O + n);
    cursor = entry.at + entry.text.length;
  }
  body += plot[0].slice(cursor);
  if (kind === 'bar') {
    const start = body.indexOf(`<c:${base.kind}>`), end = body.indexOf(`</c:${base.kind}>`, start);
    const group = body.slice(start, end).replace(/<c:overlap val="-?\d+"\/>/, overlap === null ? '' : `<c:overlap val="${overlap}"/>`);
    body = body.slice(0, start) + group + body.slice(end);
  }
  let out = xml.slice(0, plot.index) + body + xml.slice(plot.index + plot[0].length);
  const legend = /<c:legend>[\s\S]*?<\/c:legend>/.exec(out);
  if (legend) {
    const entries = legendEntries(legend[0]).filter(entry => !(entry.idx > P && entry.idx <= P + n))
      .map(entry => entry.idx > P + n ? {idx: entry.idx - n, text: entry.text.replace(/<c:idx val="\d+"\/>/, `<c:idx val="${entry.idx - n}"/>`)} : entry);
    out = out.replace(/<c:legend>[\s\S]*?<\/c:legend>/, withLegendEntries(legend[0], entries));
  }
  return out;
}
