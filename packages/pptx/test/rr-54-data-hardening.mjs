// RR-54 review (core docs/chart-table-data.md): the chart and table data records survive what PowerPoint does to a deck
// and refuse what a hostile deck holds, and the export follows the contract on the value axis and its diagnostics.
//   1. A plain PowerPoint save writes <c:formatCode>General</c:formatCode> into every cache that had none (PptxGenJS writes
//      none on pie and doughnut series; observed on 16 native saves), so General and an absent code are the same evidence.
//   2. Hostile OPF_DATA_V1 records (deep nesting, '__proto__' or 'length' as an index) are reported, never thrown or let
//      through to change an imported array's prototype.
//   3. A cached value is any finite xsd:double decimal: 1e20 is written as "100000000000000000000" and imports back.
//   4. The value axis takes the first plotted series' format (General when it has none), as the preview does.
//   5. chart-value-not-numeric counts only the cells the chart exports (not those of a series a pie drops).
//   6. A dataset reference returns only while the package's dataset is the one the chart was exported from.
//   7. A record over the tag limit (16 MiB, the document tag's) is omitted with the chart's document path.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {decodeTextTag, encodeTextTag} from '../dist/code-provenance.js';

const exported = async (deck, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(deck), {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  const parts = unzipSync(bytes);
  return {bytes, parts, diagnostics, text: name => parts[name] ? strFromU8(parts[name]) : undefined};
};
const imported = async bytes => {
  const diagnostics = [];
  const deck = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {deck, diagnostics};
};
const repack = (bytes, edit) => {
  const parts = unzipSync(bytes);
  for (const name of Object.keys(parts)) {
    if (!/\.(xml|rels)$/.test(name)) continue;
    const before = strFromU8(parts[name]), after = edit(name, before);
    if (after !== before) parts[name] = strToU8(after);
  }
  return zipSync(parts);
};
const payloads = deck => deck.slides.map(slide => slide.chart ?? slide.table ?? slide.blocks?.find(item => item.chart)?.chart ?? slide.blocks?.find(item => item.table)?.table);
const block = (xml, tag) => xml.match(new RegExp(`<c:${tag}>[\\s\\S]*?</c:${tag}>`, 'g')) ?? [];
const numFmt = xml => /<c:numFmt formatCode="([^"]*)" sourceLinked="(\d)"\/>/.exec(xml)?.slice(1);
const dataCodes = diagnostics => diagnostics.filter(entry => /data-provenance|dataset-unavailable/.test(entry.code)).map(entry => entry.code);
let checks = 0;

const datasets = {rev: {columns: ['Region', {name: 'Sales', format: '$#,##0'}], rows: [['North', 4], ['South', 6]]}};
const deck = {datasets, slides: [
  {title: 'Pie', chart: {type: 'pie', data: {dataset: 'rev'}}},
  {title: 'Doughnut', chart: {type: 'doughnut', data: {dataset: 'rev'}}},
  {title: 'Table', table: {columns: ['Region', {name: 'Sales', format: '0.0'}], rows: [['North', 4], ['South', 6]]}},
]};

// 1. A plain PowerPoint save keeps the records.
{
  // Unformatted pie and doughnut caches have no c:formatCode in the export.
  const plain = {datasets: {share: {columns: ['Region', 'Sales'], rows: [['North', 4], ['South', 6]]}}, slides: [
    {title: 'Pie', chart: {type: 'pie', data: {dataset: 'share'}}},
    {title: 'Doughnut', chart: {type: 'doughnut', mapping: {series: ['Sales']}, data: {columns: ['Region', 'Sales'], rows: [['North', 4], ['South', 6]]}}},
  ]};
  const {bytes, text} = await exported(plain);
  assert.ok(block(text('ppt/charts/chart1.xml'), 'numCache').every(cache => !/<c:formatCode>/.test(cache)), 'the export writes no format code here');
  // What PowerPoint writes on a plain save: a General code in every cache, and its own whitespace.
  const saved = repack(bytes, (name, xml) => /^ppt\/charts\/chart\d+\.xml$/.test(name)
    ? xml.replace(/<c:numCache>(?!\s*<c:formatCode>)/g, '<c:numCache><c:formatCode>General</c:formatCode>').replace(/></g, '>\r\n<')
    : xml);
  const {deck: back, diagnostics} = await imported(saved);
  const [pie, doughnut] = payloads(back);
  assert.deepEqual(pie.data, {dataset: 'share'}, 'the pie keeps its dataset reference after a plain save');
  assert.deepEqual(doughnut.mapping, {series: ['Sales']}, 'the doughnut keeps its mapping after a plain save');
  assert.deepEqual(dataCodes(diagnostics), [], 'and nothing is reported as changed');
  // A real format change is still a change.
  const reformatted = repack(bytes, (name, xml) => name === 'ppt/charts/chart1.xml' ? xml.replace(/<c:numCache>/, '<c:numCache><c:formatCode>0.0</c:formatCode>') : xml);
  const changed = await imported(reformatted);
  assert.ok(changed.diagnostics.some(entry => entry.code === 'chart-data-provenance-changed' && entry.path === 'slides.0.charts.0'));
  checks += 2;
}

// 2. Hostile records are reported, never thrown, and never reach an array's prototype.
{
  const {bytes, parts} = await exported(deck);
  const tags = Object.keys(parts).filter(name => /^ppt\/tags\/opfData\d+\.xml$/.test(name));
  const records = Object.fromEntries(tags.map(name => [name, decodeTextTag(/val="([^"]*)"/.exec(strFromU8(parts[name]))[1])]));
  const forged = edit => repack(bytes, (name, xml) => {
    if (!tags.includes(name)) return xml;
    const next = edit(structuredClone(records[name]));
    return next === undefined ? xml : xml.replace(/val="[^"]*"/, `val="${typeof next === 'string' ? Buffer.from(next, 'utf8').toString('hex').toUpperCase() : encodeTextTag(next)}"`);
  });
  let deep = '1';
  for (let index = 0; index < 20000; index += 1) deep = `[${deep}]`;
  const cases = {
    'deeply nested chart data': record => record.kind === 'chart' ? `{"v":1,"kind":"chart","data":{"columns":["a","b"],"rows":[["x",${deep}]]},"evidence":${JSON.stringify(record.evidence)}}` : undefined,
    'deeply nested mapping': record => record.kind === 'chart' ? `{"v":1,"kind":"chart","data":{"dataset":"rev"},"mapping":${deep},"evidence":${JSON.stringify(record.evidence)}}` : undefined,
    'a __proto__ header column': record => record.kind === 'table' ? {...record, headers: [['__proto__', {name: 'Sales', format: '0.0'}, '']]} : undefined,
    'a __proto__ cell column': record => record.kind === 'table' ? {...record, cells: [[0, '__proto__', 5, '0.0', '']]} : undefined,
    'a length header column': record => record.kind === 'table' ? {...record, headers: [['length', {name: 'Sales'}, '2']]} : undefined,
    'a fractional cell row': record => record.kind === 'table' ? {...record, cells: [[0.5, 1, 5, null, '4.0']]} : undefined,
  };
  for (const [label, edit] of Object.entries(cases)) {
    let result;
    try { result = await imported(forged(edit)); } catch (error) { assert.fail(`${label}: import threw ${error?.constructor?.name}: ${error?.message}`); }
    assert.ok(result.diagnostics.some(entry => entry.code === 'invalid-data-provenance'), `${label}: reported as invalid-data-provenance`);
    const table = payloads(result.deck)[2];
    assert.ok(Array.isArray(table.columns) && Object.getPrototypeOf(table.columns) === Array.prototype, `${label}: the table columns stay a plain array`);
    assert.ok(table.rows.every(row => Object.getPrototypeOf(row) === Array.prototype), `${label}: every table row stays a plain array`);
    assert.doesNotThrow(() => JSON.stringify(result.deck), `${label}: the imported document serialises`);
  }
  checks += Object.keys(cases).length;
}

// 3. Large finite decimals in the cache import as numbers.
{
  const {bytes, text} = await exported({slides: [{title: 'Large', chart: {type: 'column', data: {columns: ['c', 'v'], rows: [['a', 1e20], ['b', 2 ** 60], ['c', 12345678901234567]]}}}]}, {provenance: false});
  assert.match(text('ppt/charts/chart1.xml'), /<c:v>100000000000000000000<\/c:v>/, 'the export writes 1e20 as a plain decimal');
  const {deck: back, diagnostics} = await imported(bytes);
  assert.deepEqual(payloads(back)[0].data.rows, [['a', 1e20], ['b', 2 ** 60], ['c', 12345678901234567]]);
  assert.ok(!diagnostics.some(entry => entry.code === 'chart-value-not-numeric'), 'a finite decimal is never a gap');
  checks += 1;
}

// 4. The value axis takes the first plotted series' format, as the preview does (opf-render charts.js).
{
  const data = {columns: ['Quarter', 'Units', {name: 'Revenue', format: '$#,##0'}], rows: [['Q1', 3, 12], ['Q2', 4, 18]]};
  const classic = await exported({slides: [{title: 'Axis', chart: {type: 'column', data}}]}, {provenance: false});
  assert.deepEqual(numFmt(block(classic.text('ppt/charts/chart1.xml'), 'valAx')[0]), ['General', '0'], 'an unformatted first series keeps a General axis');
  const box = await exported({slides: [{title: 'Box', chart: {type: 'box-and-whisker', data}}]}, {provenance: false});
  const axis = /<cx:axis id="1">[\s\S]*?<\/cx:axis>/.exec(box.text('ppt/charts/chartEx1.xml'))[0];
  assert.doesNotMatch(axis, /<cx:numFmt\b/, 'the chartex value axis too');
  // The axis shows the first series' format whether or not the labels are shown.
  const first = {columns: ['Quarter', {name: 'Revenue', format: '$#,##0'}, 'Units'], rows: [['Q1', 12, 3], ['Q2', 18, 4]]};
  for (const dataLabels of [true, false]) {
    const hidden = await exported({slides: [{title: 'Axis', chart: {type: 'line', dataLabels, data: first}}]}, {provenance: false});
    assert.deepEqual(numFmt(block(hidden.text('ppt/charts/chart1.xml'), 'valAx')[0]), ['$#,##0', '0'], `labels ${dataLabels ? 'shown' : 'hidden'}: the axis shows the format`);
  }
  checks += 3;
}

// 5. chart-value-not-numeric counts the exported cells only.
{
  const {diagnostics} = await exported({slides: [{title: 'Pie', chart: {type: 'pie', data: {columns: ['Region', 'Sales', 'Notes'], rows: [['North', 4, 'n1'], ['South', '6%', 'n2']]}}}]});
  const strict = diagnostics.filter(entry => entry.code === 'chart-value-not-numeric');
  assert.deepEqual(strict.map(entry => entry.count), [1], 'the dropped Notes series is not counted; "6%" is');
  assert.match(strict[0].message, /"6%"/);
  const mapped = await exported({slides: [{title: 'Pie', chart: {type: 'doughnut', mapping: {category: 'Region', series: ['Notes', 'Sales']}, data: {columns: ['Sales', 'Region', 'Notes'], rows: [[4, 'North', 7], ['x', 'South', 'y']]}}}]});
  const counted = mapped.diagnostics.filter(entry => entry.code === 'chart-value-not-numeric');
  assert.deepEqual(counted.map(entry => entry.count), [1], 'with a mapping, only the first mapped series (Notes) is exported and counted');
  assert.match(counted[0].message, /"y"/);
  checks += 2;
}

// 6. A dataset reference returns only against the dataset the chart was exported from.
{
  const {bytes} = await exported(deck);
  // A slide pasted into a deck whose own 'rev' dataset holds other data: the native chart still shows the old values.
  const other = repack(bytes, (name, xml) => {
    if (!/^ppt\/tags\//.test(name) || !/OPF_DATASETS_V1/.test(xml)) return xml;
    return xml.replace(/(<p:tag name="OPF_DATASETS_V1" val=")([^"]*)"/, (_match, head, value) => {
      const stored = decodeTextTag(value);
      stored.rev.rows = [['East', 40], ['West', 60]];
      return `${head}${encodeTextTag(stored)}"`;
    });
  });
  const {deck: back, diagnostics} = await imported(other);
  const [pie] = payloads(back);
  assert.deepEqual(pie.data.rows, [['North', 4], ['South', 6]], 'the chart keeps the values it shows, inline');
  assert.ok(diagnostics.some(entry => entry.code === 'chart-dataset-unavailable' && entry.path === 'slides.0.charts.0'));
  // The untouched deck still restores the reference.
  const same = await imported(bytes);
  assert.deepEqual(payloads(same.deck)[0].data, {dataset: 'rev'});
  assert.deepEqual(dataCodes(same.diagnostics), []);
  checks += 2;
}

// 7. A record over the tag limit is omitted with the chart's document path.
{
  const description = 'x'.repeat(9 * 1024 * 1024);
  const {parts, diagnostics} = await exported({slides: [{title: 'Big', chart: {type: 'column', data: {columns: ['a', 'b'], rows: [['x', 1]], source: {src: './big.csv', description}}}}]});
  const omitted = diagnostics.filter(entry => entry.code === 'data-provenance-omitted');
  assert.deepEqual(omitted.map(entry => entry.path), ['slides.0.chart'], 'reported once, on the chart path (not the generated frame name)');
  assert.ok(!Object.keys(parts).some(name => /^ppt\/tags\/opfData/.test(name)), 'and not written');
  checks += 1;
}

// 8. Radar and scatter labels show each series' own format (PptxGenJS writes their labels on the chart group only).
{
  const columns = ['Name', {name: 'Revenue', format: '$#,##0'}, {name: 'Margin', format: '0%'}, 'Plain'];
  for (const [type, role] of [['radar', 'val'], ['scatter', 'yVal']]) {
    const data = type === 'scatter' ? {columns: ['Point', 'X', ...columns.slice(1)], rows: [['a', 1, 12, 0.3, 5], ['b', 2, 18, 0.4, 6]]} : {columns, rows: [['a', 12, 0.3, 5], ['b', 18, 0.4, 6]]};
    const {text} = await exported({slides: [{title: type, chart: {type, dataLabels: true, data}}]}, {provenance: false});
    const xml = text('ppt/charts/chart1.xml');
    const series = block(xml, 'ser');
    assert.deepEqual(series.map(ser => numFmt(block(ser, 'dLbls')[0] ?? '')?.[0]), ['$#,##0', '0%', 'General'], `${type}: each series' labels show its format`);
    for (const ser of series) assert.ok(ser.indexOf('<c:dLbls>') < ser.indexOf(`<c:${role}>`) && ser.indexOf('<c:dLbls>') > ser.indexOf('</c:tx>'), `${type}: series labels sit before the series data (schema order)`);
    const outside = xml.split(/<c:ser>[\s\S]*?<\/c:ser>/).join('');
    assert.deepEqual(numFmt(block(outside, 'dLbls')[0]), ['$#,##0', '0'], `${type}: the chart group's labels keep the first series' format`);
    // Without labels, or with one format for every series, the chart group's labels are left as they are.
    const hidden = await exported({slides: [{title: type, chart: {type, data}}]}, {provenance: false});
    assert.ok(block(hidden.text('ppt/charts/chart1.xml'), 'ser').every(ser => !/<c:dLbls>/.test(ser)), `${type}: hidden labels add no series labels`);
  }
  checks += 2;
}

console.log(`RR-54 data hardening passed: ${checks} checks (plain PowerPoint save, hostile records, large cache values, first-series value axis, exported-cell counts, pasted dataset ids, tag limit, radar and scatter series labels).`);
