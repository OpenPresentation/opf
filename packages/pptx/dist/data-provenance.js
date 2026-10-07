import {XMLParser} from 'fast-xml-parser';
import {checkFormat, isValidFormat} from './format-check.js';
import {decodeTextTag, encodeTextTag} from './code-provenance.js';
import {chartUsesDataFields, isDatasetRef, fromExcelNumberFormat, resolveTableData, tableCellDisplayValue, tableUsesDataFields} from './chart-data.js';

// RR-54: chart and table data survive a PPTX round trip (core docs/chart-table-data.md).
//
// A native chart holds plotted values and a number format code per series; a native table holds cell text. Neither has a
// field for what the OPF author wrote: the top-level `datasets`, a chart's or table's dataset reference (`{dataset,
// fields}`), `chart.mapping`, DataColumn objects, `data.source`, or a table cell's number value behind its formatted text.
// In `full` provenance mode the exporter records them as PresentationML customer-data tags, the mechanism of the other
// OPF records (uppercase-hex UTF-8 JSON, because PowerPoint's Tags API is case-insensitive):
//
//   OPF_DATASETS_V1  on p:presentation (beside OPF_DOCUMENT_V1): the whole `datasets` map, unused datasets included.
//   OPF_DATA_V1      on each chart or table graphic frame that uses one of the fields above:
//     chart  {v: 1, kind: 'chart', data, mapping?, highlight?, dataset?: hash, evidence: [hash]}   `data` is the authored
//            chart.data (a dataset reference, or inline columns with DataColumn objects and `source`); `evidence`
//            hashes the native caches (series names, categories, values and format codes) of the chart part(s) the frame
//            shows (the chartex part and its classic fallback); `dataset` hashes the referenced dataset, so a slide
//            pasted into a deck whose dataset of the same id holds other data keeps its values inline. `highlight` (FA-14) is
//            the authored chart.highlight: the native chart carries only the accent and muted colours it produced, which no
//            exact inference turns back into series and category names, and a chart with only a highlight records its inline `data`.
//     table  {v: 1, kind: 'table', table}                                a dataset-backed table, as authored
//            {v: 1, kind: 'table', headers: [[column, header, text]], cells: [[row, column, value, format, text]]}
//                                                                         an inline table: the DataColumn or formatted
//            headers and every number cell shown through a format, each with the text the native cell shows.
//
// Import restores a record only while its native evidence is unchanged: a chart while its caches hash the same (an edit in
// PowerPoint's Edit Data changes them), a dataset table while every native cell still shows the dataset's display text,
// and an inline table cell by cell while the native cell shows the recorded text. Otherwise the native values stay (with
// the format codes core maps back, src/chart-data.js) and a diagnostic names what was not restored. Tags are untrusted
// input: they are size-limited (16 MiB, the limit of the document tag), depth- and shape-checked, validated as OPF, and
// never executed; a record that fails a check, or that a restore cannot use, is reported and the native values stay.

export const DATA_TAG = 'OPF_DATA_V1';
export const DATASETS_TAG = 'OPF_DATASETS_V1';
const REL_TAGS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const TAGS_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.tags+xml';
const MAX_TAG_CHARS = 16 * 1024 * 1024;
// Datasets and records nest a few levels (datasets, id, rows, row, cell; a table cell's runs and style). A deeper value is
// not one the exporter writes, and is refused before anything recurses into it.
const MAX_DEPTH = 32;

const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => object(value) && Object.hasOwn(value, key);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const index = value => Number.isSafeInteger(value) && value >= 0;
// Key-sorted JSON, so the dataset hash does not depend on key order.
const canonical = value => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
function tooDeep(value) {
  const stack = [[value, 0]];
  while (stack.length) {
    const [item, depth] = stack.pop();
    if (item === null || typeof item !== 'object') continue;
    if (depth >= MAX_DEPTH) return true;
    for (const child of Object.values(item)) stack.push([child, depth + 1]);
  }
  return false;
}

/** The text a table cell value shows: strings and numbers as written, rich runs joined, null and absent as ''. */
export function cellText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(run => typeof run === 'string' ? run : object(run) ? String(run.text ?? '') : '').join('');
  if (object(value)) return own(value, 'value') ? cellText(value.value) : typeof value.name === 'string' ? value.name : '';
  return String(value);
}

// ---------------------------------------------------------------------------
// Native evidence

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
const decodeEntities = text => text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi, (_match, decimal, hex, name) => decimal ? String.fromCodePoint(Number(decimal)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ENTITIES[name.toLowerCase()]);
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
// A cached number in Excel's 15 significant digits, so a resave that rewrites 0.30000000000000004 as 0.3 keeps the evidence.
const canonicalValue = text => NUMBER.test(text.trim()) && Number.isFinite(Number(text)) ? String(Number(Number(text).toPrecision(15))) : text;
// A General format code is left out: on a plain save PowerPoint writes <c:formatCode>General</c:formatCode> into every
// cache that has none (PptxGenJS writes none on pie and doughnut series), so General and no code are the same evidence.
const generalCode = code => /^\s*general\s*$/i.test(code);
// A format code is hashed in core's canonical form (fromExcelNumberFormat), because a plain PowerPoint save re-spells codes
// without changing what they show: `$#,##0.0` becomes `\$#,##0.0` and `#,##0 "units"` becomes `#,##0\ "units"` (native
// check opf#385). Core reads quoted and backslash-escaped literals and literal-safe characters to the same NumberFormat, so
// both spellings hash equal, while a real change (another number of decimals, another unit) still changes the hash. A code
// core cannot map is hashed as written; the `opf:` prefix keeps a mapped form apart from a verbatim code of the same text.
const formatEvidence = code => {
  const format = fromExcelNumberFormat(code);
  return typeof format === 'string' ? `format:opf:${format}` : `format:${code}`;
};
function hash(text) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** The hash of a chart part's cached data: series names, categories, values and number format codes, in order. */
export function chartEvidence(xml) {
  const parts = [];
  for (const match of String(xml).matchAll(/<(c:v|c:formatCode|cx:pt|cx:v)\b[^>]*>([^<]*)<\/\1>|<cx:lvl\b[^>]*?\bformatCode="([^"]*)"/g)) {
    const code = match[3] !== undefined ? decodeEntities(match[3]) : match[1] === 'c:formatCode' ? decodeEntities(match[2]) : undefined;
    if (code === undefined) parts.push(`${match[1]}:${canonicalValue(decodeEntities(match[2]))}`);
    else if (!generalCode(code)) parts.push(formatEvidence(code));
  }
  return hash(parts.join('\u0000'));
}

// ---------------------------------------------------------------------------
// Export

/** The hash of a dataset, or undefined when the map does not hold the id. */
const datasetHash = (datasets, id) => own(datasets, id) ? hash(canonical(datasets[id])) : undefined;

/** The record of a chart that uses an RR-54 data field, or undefined (the frame then carries no tag). */
export function chartDataRecord(chart, datasets) {
  if (!chartUsesDataFields(chart) && !object(chart?.highlight)) return undefined;
  const dataset = isDatasetRef(chart.data) ? datasetHash(datasets, chart.data.dataset) : undefined;
  return {v: 1, kind: 'chart', data: clone(chart.data), ...(chart.mapping !== undefined ? {mapping: clone(chart.mapping)} : {}), ...(object(chart.highlight) ? {highlight: clone(chart.highlight)} : {}), ...(dataset ? {dataset} : {})};
}

/** The record of a table that is dataset-backed or formats numbers, or undefined. `layout` is the exported table layout. */
export function tableDataRecord(table, layout) {
  if (!tableUsesDataFields(table)) return undefined;
  if (isDatasetRef(table)) return {v: 1, kind: 'table', table: clone(table)};
  const hasHeaders = Array.isArray(table.columns) && table.columns.length > 0;
  const shown = (row, column) => cellText(layout?.rows?.[row]?.cells?.find(cell => cell.column === column)?.value);
  // A header's format: a DataColumn's or a header StyledTableCell's (both are the column format).
  const formatOf = value => object(value) && typeof value.format === 'string' ? value.format : undefined;
  const headers = [], cells = [];
  const columnFormats = [];
  (hasHeaders ? table.columns : []).forEach((header, column) => {
    const format = formatOf(header);
    columnFormats[column] = format;
    const dataColumn = object(header) && typeof header.name === 'string' && !own(header, 'value');
    if (dataColumn || format !== undefined) headers.push([column, clone(header), shown(0, column)]);
  });
  (table.rows ?? []).forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, column) => {
      const value = own(cell, 'value') ? cell.value : cell;
      const format = own(cell, 'value') && typeof cell.format === 'string' ? cell.format : undefined;
      if (typeof value !== 'number' || (format === undefined && columnFormats[column] === undefined)) return;
      cells.push([rowIndex, column, value, format ?? null, shown(rowIndex + (hasHeaders ? 1 : 0), column)]);
    });
  });
  return {v: 1, kind: 'table', headers, cells};
}

function relationshipsXml(entries, path) {
  const slash = path.lastIndexOf('/');
  return `${path.slice(0, slash + 1)}_rels/${path.slice(slash + 1)}.rels`;
}
const freeId = (rels, base) => { let id = base, index = 1; while (rels.includes(`Id="${id}"`)) id = `${base}${++index}`; return id; };
const tagPart = (name, value) => enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${name}" val="${encodeTextTag(value)}"/></p:tagLst>`);

/**
 * Attach the data records to the finished package (`entries`: part path -> bytes, changed in place): one OPF_DATA_V1 tag
 * per recorded chart or table frame (both frames of a chartex chart share it) and OPF_DATASETS_V1 beside the document
 * tag. `records` maps generated frame names to records; `datasets` is the document's datasets map.
 */
export function attachDataProvenance(entries, {records, paths = new Map(), datasets, parseRelationships, report}) {
  // A record the importer would refuse (MAX_TAG_CHARS) is not written; the native values still export and import. `paths`
  // maps a frame name to the document path of its chart or table, which the diagnostic names.
  const fits = (value, path) => {
    if (enc.encode(JSON.stringify(value)).byteLength * 2 <= MAX_TAG_CHARS) return true;
    report?.({code: 'data-provenance-omitted', path, message: `The recorded ${path === 'datasets' ? 'datasets map' : 'chart or table data'} exceeds the ${MAX_TAG_CHARS / (1024 * 1024)} MiB tag limit, so it is not stored; the native values export and re-import, without the dataset references, mapping and formats.`});
    return false;
  };
  for (const [name, record] of [...records]) if (!fits(record, paths.get(name) ?? name)) records.delete(name);
  const storedDatasets = object(datasets) && Object.keys(datasets).length && fits(datasets, 'datasets') ? datasets : undefined;
  if (!records.size && !storedDatasets) return;
  const types = [];
  const slides = Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  let count = 0;
  const seen = new Set();
  for (const path of slides) {
    let xml = dec.decode(entries[path]);
    const frames = [...xml.matchAll(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)].map(match => match[0]);
    const named = frames.map(frame => frame.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1]).filter(name => records.has(name));
    if (!named.length) continue;
    const relationships = parseRelationships(entries, path);
    // Evidence first: every chart part a frame of that name shows (a chartex choice and its classic fallback).
    const evidence = new Map();
    for (const frame of frames) {
      const name = frame.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const record = records.get(name);
      if (record?.kind !== 'chart') continue;
      const id = frame.match(/<(?:c|cx):chart\b[^>]*\br:id="([^"]+)"/)?.[1];
      const part = relationships.get(id)?.path;
      if (!part || !entries[part]) throw Error('Generated chart frame has no chart part.');
      evidence.set(name, [...(evidence.get(name) ?? []), chartEvidence(dec.decode(entries[part]))]);
    }
    const relsPath = relationshipsXml(entries, path);
    let rels = dec.decode(entries[relsPath]);
    const ids = new Map();
    for (const name of new Set(named)) {
      if (seen.has(name)) throw Error(`Duplicate generated frame name ${name}.`);
      seen.add(name);
      const record = records.get(name);
      const value = record.kind === 'chart' ? {...record, evidence: evidence.get(name) ?? []} : record;
      const part = `ppt/tags/opfData${++count}.xml`;
      if (entries[part]) throw Error('Colliding data tag part.');
      entries[part] = tagPart(DATA_TAG, value);
      types.push(part);
      const id = freeId(rels, `rIdOpfData${count}`);
      rels = rels.replace('</Relationships>', `<Relationship Id="${id}" Type="${REL_TAGS}" Target="../tags/opfData${count}.xml"/></Relationships>`);
      ids.set(name, id);
    }
    xml = xml.replace(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g, frame => {
      const id = ids.get(frame.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1]);
      if (!id) return frame;
      const list = `<p:custDataLst><p:tags r:id="${id}"/></p:custDataLst>`;
      // CT_ApplicationNonVisualDrawingProps: custDataLst precedes extLst.
      return frame.replace(/<p:nvPr\s*\/>|<p:nvPr>([\s\S]*?)<\/p:nvPr>/, (_match, inner = '') => {
        if (/<p:custDataLst\b/.test(inner)) throw Error('Generated frame already has customer data.');
        const at = inner.search(/<p:extLst\b/);
        return `<p:nvPr>${at < 0 ? inner + list : inner.slice(0, at) + list + inner.slice(at)}</p:nvPr>`;
      });
    });
    entries[path] = enc.encode(xml);
    entries[relsPath] = enc.encode(rels);
  }
  if (seen.size !== records.size) throw Error('A recorded chart or table frame is missing from the package.');
  if (storedDatasets) {
    const presentationXml = dec.decode(entries['ppt/presentation.xml']);
    const tag = `<p:tag name="${DATASETS_TAG}" val="${encodeTextTag(storedDatasets)}"/>`;
    const existing = /<p:custDataLst>\s*<p:tags r:id="([^"]+)"\s*\/>\s*<\/p:custDataLst>/.exec(presentationXml);
    if (existing) {
      // Join the document tag list (OPF_DOCUMENT_V1): CT_CustomerDataList holds one p:tags per element.
      const target = parseRelationships(entries, 'ppt/presentation.xml').get(existing[1]);
      if (target?.type !== REL_TAGS || !target.path || !entries[target.path]) throw Error('Presentation tag relationship is missing.');
      entries[target.path] = enc.encode(dec.decode(entries[target.path]).replace('</p:tagLst>', `${tag}</p:tagLst>`));
    } else {
      if (/<p:custDataLst\b/.test(presentationXml) || entries['ppt/tags/opfDatasets.xml']) throw Error('Colliding presentation customer data.');
      let presentationRels = dec.decode(entries['ppt/_rels/presentation.xml.rels']);
      const id = freeId(presentationRels, 'rIdOpfDatasets');
      // CT_Presentation: custDataLst precedes kinsoku, defaultTextStyle, modifyVerifier and extLst.
      const anchor = presentationXml.search(/<p:(kinsoku|defaultTextStyle|modifyVerifier|extLst)\b|<\/p:presentation>/);
      if (anchor < 0) throw Error('Generated presentation part has no closing element.');
      entries['ppt/presentation.xml'] = enc.encode(`${presentationXml.slice(0, anchor)}<p:custDataLst><p:tags r:id="${id}"/></p:custDataLst>${presentationXml.slice(anchor)}`);
      presentationRels = presentationRels.replace('</Relationships>', `<Relationship Id="${id}" Type="${REL_TAGS}" Target="tags/opfDatasets.xml"/></Relationships>`);
      entries['ppt/_rels/presentation.xml.rels'] = enc.encode(presentationRels);
      entries['ppt/tags/opfDatasets.xml'] = enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}">${tag}</p:tagLst>`);
      types.push('ppt/tags/opfDatasets.xml');
    }
  }
  if (types.length) {
    const contentTypes = dec.decode(entries['[Content_Types].xml']);
    entries['[Content_Types].xml'] = enc.encode(contentTypes.replace('</Types>', types.map(part => `<Override PartName="/${part}" ContentType="${TAGS_TYPE}"/>`).join('') + '</Types>'));
  }
}

// ---------------------------------------------------------------------------
// Import

function readTags(entries, container, relationships, name) {
  const found = [];
  for (const link of array(container?.['p:tags'])) {
    const rel = relationships.get(link?.['r:id']);
    if (rel?.type !== REL_TAGS || rel.targetMode === 'External' || !rel.path || !entries[rel.path]) continue;
    found.push(...array(parser.parse(dec.decode(entries[rel.path]))?.['p:tagLst']?.['p:tag']).filter(tag => String(tag?.name ?? '').toUpperCase() === name));
  }
  if (!found.length) return undefined;
  if (found.length > 1) throw Error(`Multiple ${name} tags.`);
  const value = found[0].val;
  if (typeof value !== 'string' || value.length > MAX_TAG_CHARS) throw Error(`Oversized or empty ${name} tag.`);
  const decoded = decodeTextTag(value);
  if (tooDeep(decoded)) throw Error(`The ${name} tag nests deeper than ${MAX_DEPTH} levels.`);
  return decoded;
}

/** The stored datasets map, or undefined. An unreadable or invalid record is reported and ignored. */
export function readDatasetsTag(entries, presentationRoot, relationships, report) {
  try {
    const datasets = readTags(entries, presentationRoot?.['p:custDataLst'], relationships, DATASETS_TAG);
    if (datasets === undefined) return undefined;
    if (!object(datasets) || !Object.keys(datasets).length) throw Error('Invalid datasets record.');
    const report = checkFormat({slides: [{title: 'Datasets'}], datasets});
    const [first] = report.findings.filter(finding => finding.severity === 'error');
    if (!report.valid) throw Error(`The stored datasets do not validate (${first?.path ?? ''} ${first?.message ?? ''}).`);
    return datasets;
  } catch (error) {
    report?.({code: 'invalid-data-provenance', path: 'datasets', message: `${error instanceof Error ? error.message : String(error)} The datasets recorded at export were not restored.`});
    return undefined;
  }
}

/** The OPF_DATA_V1 record of a graphic frame (parsed), or undefined. Throws on a malformed record. */
export function readDataTag(entries, frame, relationships) {
  const record = readTags(entries, frame?.['p:nvGraphicFramePr']?.['p:nvPr']?.['p:custDataLst'], relationships, DATA_TAG);
  if (record === undefined) return undefined;
  if (!object(record) || record.v !== 1 || !['chart', 'table'].includes(record.kind)) throw Error('Unsupported data provenance version.');
  if (record.kind === 'chart' && (!object(record.data) || !Array.isArray(record.evidence) || !record.evidence.every(item => typeof item === 'string'))) throw Error('Invalid chart data record.');
  if (record.kind === 'chart' && record.dataset !== undefined && typeof record.dataset !== 'string') throw Error('Invalid chart data record.');
  if (record.kind === 'chart' && record.highlight !== undefined && !object(record.highlight)) throw Error('Invalid chart data record.');
  if (record.kind === 'table' && !(object(record.table) || (Array.isArray(record.headers) && Array.isArray(record.cells)))) throw Error('Invalid table data record.');
  // Inline table entries are [column, header, text] and [row, column, value, format, text]; their indices are array
  // indices (non-negative integers), never a key such as "__proto__" or "length".
  if (record.kind === 'table' && !object(record.table)) {
    const header = entry => Array.isArray(entry) && entry.length === 3 && index(entry[0]) && object(entry[1]) && typeof entry[2] === 'string';
    const cell = entry => Array.isArray(entry) && entry.length === 5 && index(entry[0]) && index(entry[1]) && typeof entry[2] === 'number' && Number.isFinite(entry[2])
      && (entry[3] === null || typeof entry[3] === 'string') && typeof entry[4] === 'string';
    if (!record.headers.every(header) || !record.cells.every(cell)) throw Error('Invalid table data record.');
  }
  return record;
}

const validWith = (payload, datasets) => isValidFormat({slides: [{title: 'Data', ...payload}], ...(datasets ? {datasets} : {})});

/**
 * The authored chart data while the native caches are unchanged: the imported chart (type and options) with the recorded
 * `data` and `mapping`. Otherwise the imported chart, and a diagnostic.
 */
export function restoreChartData(chart, record, evidence, {datasets, report}) {
  if (!record.evidence.includes(evidence)) {
    report({code: 'chart-data-provenance-changed', message: 'The chart\'s cached data or number formats changed after export (for example in Edit Data), so the dataset reference, column mapping, column formats and data source recorded at export were not restored; the chart imports the values and formats it now shows.' + (record.highlight ? ' The chart highlight (series and categories named at export) was not restored either: its names refer to the data as exported.' : '')});
    return chart;
  }
  if (isDatasetRef(record.data) && !own(datasets, record.data.dataset)) {
    report({code: 'chart-dataset-unavailable', message: `The chart referenced dataset '${record.data.dataset}', which this package's datasets record does not hold (a slide pasted from another deck, or a missing record); the chart imports its values inline.`});
    return chart;
  }
  if (isDatasetRef(record.data) && record.dataset !== undefined && datasetHash(datasets, record.data.dataset) !== record.dataset) {
    report({code: 'chart-dataset-unavailable', message: `The chart referenced dataset '${record.data.dataset}', but this package's dataset of that id holds other data than at export (a slide pasted from another deck); the chart imports its values inline.`});
    return chart;
  }
  const {mapping: _mapping, highlight: _highlight, ...rest} = chart;
  const restored = {...rest, data: clone(record.data), ...(record.mapping !== undefined ? {mapping: clone(record.mapping)} : {}), ...(record.highlight !== undefined ? {highlight: clone(record.highlight)} : {})};
  if (!validWith({chart: restored}, isDatasetRef(record.data) ? datasets : undefined)) {
    report({code: 'invalid-data-provenance', message: 'The chart data recorded at export does not form a valid chart; the chart imports the values it shows.'});
    return chart;
  }
  return restored;
}

/** The authored table data where the native cells still show the recorded text; the imported table otherwise. */
export function restoreTableData(table, record, {datasets, report}) {
  if (!object(table)) return table;
  const columns = Array.isArray(table.columns) ? table.columns : undefined;
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (record.table) {
    const id = record.table.dataset;
    if (!own(datasets, id)) {
      report({code: 'table-dataset-unavailable', message: `The table referenced dataset '${id}', which this package's datasets record does not hold; the table imports its cells inline.`});
      return table;
    }
    const resolved = resolveTableData(record.table, {datasets});
    const expectedHeaders = (resolved.columns ?? []).map(cellText);
    const expectedRows = resolved.rows.map(row => row.map((cell, column) => cellText(tableCellDisplayValue(cell, resolved.formats[column]))));
    const same = expectedHeaders.length === (columns?.length ?? 0) && expectedHeaders.every((text, index) => text === cellText(columns[index]))
      && expectedRows.length === rows.length && expectedRows.every((row, index) => row.length === rows[index].length && row.every((text, column) => text === cellText(rows[index][column])));
    if (!same || !validWith({table: record.table}, datasets)) {
      report({code: 'table-data-provenance-changed', message: `The table's cells no longer show dataset '${id}' as exported, so the dataset reference was not restored; the table imports the cells it shows, inline.`});
      return table;
    }
    return clone(record.table);
  }
  const next = {...table, ...(columns ? {columns: [...columns]} : {}), rows: rows.map(row => Array.isArray(row) ? [...row] : row)};
  let changed = 0;
  for (const entry of record.headers) {
    const [column, header, text] = Array.isArray(entry) ? entry : [];
    const current = next.columns?.[column];
    if (current === undefined || cellText(current) !== text) { changed++; continue; }
    // A DataColumn returns as authored; a formatted header cell keeps its imported value and style and regains its format.
    next.columns[column] = own(header, 'value') ? {...(object(current) && own(current, 'value') ? current : {value: current}), format: header.format} : clone(header);
  }
  for (const entry of record.cells) {
    const [row, column, value, format, text] = Array.isArray(entry) ? entry : [];
    const current = next.rows[row]?.[column];
    if (current === undefined || typeof value !== 'number' || cellText(current) !== text) { changed++; continue; }
    next.rows[row][column] = object(current) && own(current, 'value')
      ? {...current, value, ...(typeof format === 'string' ? {format} : {})}
      : typeof format === 'string' ? {value, format} : value;
  }
  if (!validWith({table: next})) {
    report({code: 'invalid-data-provenance', message: 'The table number formats recorded at export do not form a valid table; the table imports the cells it shows.'});
    return table;
  }
  if (changed) report({code: 'table-data-provenance-changed', message: `${changed} recorded table ${changed === 1 ? 'cell no longer shows' : 'cells no longer show'} the text exported for ${changed === 1 ? 'it' : 'them'}, so ${changed === 1 ? 'its' : 'their'} number value and format were not restored; ${changed === 1 ? 'it imports' : 'they import'} the text shown.`});
  return next;
}
