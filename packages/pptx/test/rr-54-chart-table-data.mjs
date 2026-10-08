// RR-54 (core docs/chart-table-data.md): chart and table data in the PPTX export and import. Chart values pass core's strict
// chartNumber (a string that is not a plain decimal is a gap and one chart-value-not-numeric diagnostic per chart); column
// number formats become the series format codes, the data-label and value-axis formats and the embedded workbook cell
// formats; dataset references and chart.mapping export exactly like their inline equivalent; dataset tables and formatted
// cells export their display text; export -> import restores every new field from OPF_DATA_V1/OPF_DATASETS_V1 while the
// native evidence is unchanged; a deck without provenance maps the format codes core can map back, and reports the rest;
// and a deck that uses none of the new fields keeps its bytes (test/fixtures/rr-54-unchanged.json, from main).
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const exported = async (deck, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(deck), {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  const parts = unzipSync(bytes);
  const text = name => parts[name] ? strFromU8(parts[name]) : undefined;
  const workbook = () => {
    const name = Object.keys(parts).find(path => /^ppt\/embeddings\/.*\.xlsx$/.test(path));
    const book = unzipSync(parts[name]);
    return {styles: strFromU8(book['xl/styles.xml']), sheet: strFromU8(book['xl/worksheets/sheet1.xml'])};
  };
  return {bytes, parts, text, diagnostics, chart: text('ppt/charts/chart1.xml'), slide: text('ppt/slides/slide1.xml'), workbook};
};
const imported = async (bytes) => {
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
// A third-party deck: the same package without any OPF customer data.
const withoutTags = bytes => repack(bytes, (name, xml) => xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
const cache = (xml, role) => [...xml.matchAll(new RegExp(`<c:${role}>([\\s\\S]*?)</c:${role}>`, 'g'))].map(([, body]) => {
  const count = Number(/<c:ptCount val="(\d+)"\/>/.exec(body)?.[1] ?? 0);
  const values = Array(count).fill(null);
  for (const [, index, value] of body.matchAll(/<c:pt idx="(\d+)"><c:v>([^<]*)<\/c:v><\/c:pt>/g)) values[Number(index)] = value;
  return values;
});
const formatCodes = xml => [...xml.matchAll(/<c:formatCode>([^<]*)<\/c:formatCode>/g)].map(match => match[1]);
const block = (xml, tag) => xml.match(new RegExp(`<c:${tag}>[\\s\\S]*?</c:${tag}>`, 'g')) ?? [];
const numFmt = xml => /<c:numFmt formatCode="([^"]*)" sourceLinked="(\d)"\/>/.exec(xml)?.slice(1);
const slidePayloads = deck => deck.slides.map(slide => slide.chart ?? slide.table ?? slide.blocks?.find(item => item.chart || item.table)?.chart ?? slide.blocks?.find(item => item.table)?.table);
let checks = 0;

// ---------------------------------------------------------------------------------------------------------------------
// 1. Strict chart numbers (export): numbers and strict decimal strings plot; everything else is a gap, reported once.
{
  const cells = [12, '12', '1e6', '-3.5', '12%', '$5', '(5)', 'Q1', '1,234', '', null, true];
  const deck = {slides: [{title: 'Strict', chart: {type: 'column', data: {columns: ['Row', 'Value'], rows: cells.map((cell, index) => [`r${index}`, cell])}}}]};
  const {chart, diagnostics} = await exported(deck);
  assert.deepEqual(cache(chart, 'val')[0], ['12', '12', '1000000', '-3.5', null, null, null, null, null, null, null, null], 'only numbers and strict decimals are plotted; the rest are gaps, never stripped values (1e6 was 16, (5) was 5, Q1 was 1)');
  const strict = diagnostics.filter(entry => entry.code === 'chart-value-not-numeric');
  assert.equal(strict.length, 1, 'one chart-value-not-numeric diagnostic per chart');
  assert.equal(strict[0].count, 6, '"12%", "$5", "(5)", "Q1", "1,234" and true; never null or ""');
  assert.equal(strict[0].path, 'slides.0.chart');
  assert.match(strict[0].message, /"12%"/);
  // The single-column path parses with the same rule.
  const single = await exported({slides: [{title: 'One column', chart: {type: 'column', data: {columns: ['Value'], rows: [[3], ['4'], ['5%'], [null]]}}}]});
  assert.deepEqual(cache(single.chart, 'val')[0], ['3', '4'], 'a single value column plots its strict numbers');
  assert.deepEqual(single.diagnostics.filter(entry => entry.code === 'chart-value-not-numeric').map(entry => entry.count), [1]);
  // A chart with only numbers reports nothing.
  const clean = await exported({slides: [{title: 'Numbers', chart: {type: 'line', data: {columns: ['d', 'v'], rows: [['a', 1], ['b', 2.5]]}}}]});
  assert.equal(clean.diagnostics.filter(entry => entry.code === 'chart-value-not-numeric').length, 0);
  checks += 3;
}

// 2. Number formats in the chart part: series caches, data labels and the value axis; the category axis is untouched.
const formatted = {slides: [{title: 'Formats', chart: {type: 'column', dataLabels: true, data: {
  columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, {name: 'Margin', format: '0%'}, {name: 'Units', format: '#,##0 units'}, 'Plain'],
  rows: [['Q1', 12.4, 0.31, 1200, 3], ['Q2', null, 0.34, 1800, 4]],
}}}]};
{
  const {chart, workbook} = await exported(formatted);
  const series = block(chart, 'ser');
  assert.deepEqual(series.map(ser => formatCodes(ser)), [['$#,##0.0'], ['0%'], ['#,##0 &quot;units&quot;'], ['General']], 'each series cache carries its column code (Excel quoting for literal text)');
  assert.deepEqual(series.map(ser => numFmt(block(ser, 'dLbls')[0])), [['$#,##0.0', '0'], ['0%', '0'], ['#,##0 &quot;units&quot;', '0'], ['General', '0']], 'each series data label shows its column format');
  const valAx = block(chart, 'valAx')[0], catAx = block(chart, 'catAx')[0];
  assert.deepEqual(numFmt(valAx), ['$#,##0.0', '0'], 'the value axis shows the first series format, not source-linked');
  // The category axis is the engine's own (PptxGenJS 4.0.1 wrote sourceLinked="1", pptxgenjs-plus 4.3.4 writes "0"): the
  // formatted chart's must equal the same chart's without formats.
  const plain = structuredClone(formatted);
  plain.slides[0].chart.data.columns = plain.slides[0].chart.data.columns.map(column => typeof column === 'string' ? column : column.name);
  const plainCatAx = block((await exported(plain)).chart, 'catAx')[0];
  assert.deepEqual(numFmt(catAx), numFmt(plainCatAx), 'the category axis is unchanged');
  // The embedded workbook: one custom numFmt and cell style per code, on every value cell of its column (gaps too).
  const {styles, sheet} = workbook();
  assert.match(styles, /<numFmts count="4"><numFmt numFmtId="0" formatCode="General"\/><numFmt numFmtId="164" formatCode="\$#,##0.0"\/><numFmt numFmtId="165" formatCode="0%"\/><numFmt numFmtId="166" formatCode="#,##0 &quot;units&quot;"\/><\/numFmts>/);
  assert.match(styles, /<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"\/><xf numFmtId="164"[^>]*applyNumberFormat="1"\/><xf numFmtId="165"[^>]*\/><xf numFmtId="166"[^>]*\/><\/cellXfs>/);
  for (const [cell, style] of [['B2', 1], ['B3', 1], ['C2', 2], ['C3', 2], ['D2', 3], ['D3', 3]]) assert.match(sheet, new RegExp(`<c r="${cell}" s="${style}"`), `${cell} has style ${style}`);
  assert.match(sheet, /<c r="B3" s="1"\/>/, 'a gap stays a blank cell, with the column style');
  assert.doesNotMatch(sheet, /<c r="(?:A\d|E\d|[A-E]1)" s=/, 'categories, headings and unformatted columns keep the default style');
  // A percent-stacked chart keeps its 0% axis; percentage labels keep PowerPoint's own percent form.
  const stacked = await exported({slides: [{title: 'Stacked', chart: {type: '100pct-stacked-column', data: formatted.slides[0].chart.data}}]});
  assert.deepEqual(numFmt(block(stacked.chart, 'valAx')[0]), ['0%', '0'], 'percent-stacked axis stays 0%');
  const pie = await exported({slides: [{title: 'Pie', chart: {type: 'pie', dataLabels: {content: ['category', 'percent']}, data: {columns: ['Region', {name: 'Sales', format: '$#,##0'}], rows: [['A', 1], ['B', 3]]}}}]});
  assert.deepEqual(formatCodes(pie.chart).filter(code => code !== 'General'), ['$#,##0'], 'the pie series cache carries the format');
  assert.ok([...pie.chart.matchAll(/<c:numFmt formatCode="([^"]*)"/g)].every(match => match[1] === 'General'), 'percentage labels keep General');
  checks += 3;
}

// 3. Dataset charts, mapping and scatter X export exactly like their inline equivalents.
{
  const datasets = {revenue: {title: 'Revenue', columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, 'Costs', 'Notes'], rows: [['Q1', 12, 8, 'a'], ['Q2', 18, 11, 'b'], ['Q3', 24, 15, 'c']], source: {src: './data/revenue.csv', retrieved: '2026-10-05'}}};
  const byReference = await exported({datasets, slides: [{title: 'Dataset', chart: {type: 'column', dataLabels: true, data: {dataset: 'revenue', fields: ['Quarter', 'Revenue', 'Costs']}}}]}, {provenance: false});
  const inline = await exported({slides: [{title: 'Dataset', chart: {type: 'column', dataLabels: true, data: {columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, 'Costs'], rows: [['Q1', 12, 8], ['Q2', 18, 11], ['Q3', 24, 15]]}}}]}, {provenance: false});
  assert.equal(byReference.chart, inline.chart, 'a dataset chart writes the chart XML of its inline equivalent');
  assert.deepEqual(byReference.workbook(), inline.workbook(), 'and the same workbook');
  assert.equal(createHash('sha256').update(byReference.bytes).digest('hex'), createHash('sha256').update(inline.bytes).digest('hex'), 'without provenance the whole package is the same');
  // mapping picks and orders columns by name.
  const mapped = await exported({slides: [{title: 'Mapped', chart: {type: 'line', mapping: {category: 'Quarter', series: ['Costs', 'Revenue']}, data: {columns: ['Revenue', 'Quarter', 'Costs', 'Other'], rows: [[12, 'Q1', 8, 1], [18, 'Q2', 11, 2]]}}}]}, {provenance: false});
  const positional = await exported({slides: [{title: 'Mapped', chart: {type: 'line', data: {columns: ['Quarter', 'Costs', 'Revenue'], rows: [['Q1', 8, 12], ['Q2', 11, 18]]}}}]}, {provenance: false});
  assert.equal(mapped.chart, positional.chart, 'a mapping exports as the positional table it names');
  // scatter: mapping.x names the X column, with its format on c:xVal and the horizontal value axis.
  const scatter = await exported({slides: [{title: 'XY', chart: {type: 'scatter', mapping: {x: 'Weight', series: ['Height']}, data: {columns: ['Name', 'Height', 'Age', {name: 'Weight', format: '0.0'}], rows: [['a', 170, 30, 60.5], ['b', 180, 40, 75]]}}}]}, {provenance: false});
  assert.deepEqual(cache(scatter.chart, 'xVal'), [['60.5', '75']], 'X values come from the mapped X column');
  assert.deepEqual(cache(scatter.chart, 'yVal'), [['170', '180']], 'only the mapped series is plotted');
  const [horizontal, vertical] = block(scatter.chart, 'valAx');
  assert.match(horizontal, /<c:axPos val="b"\/>/);
  assert.deepEqual(numFmt(horizontal), ['0.0', '0'], 'the X axis shows the X format');
  assert.deepEqual(numFmt(vertical), ['General', '0'], 'the Y axis keeps General (Height has no format)');
  assert.deepEqual(formatCodes(block(scatter.chart, 'xVal')[0]), ['0.0']);
  const scatterInline = await exported({slides: [{title: 'XY', chart: {type: 'scatter', data: {columns: ['Name', {name: 'Weight', format: '0.0'}, 'Height'], rows: [['a', 60.5, 170], ['b', 75, 180]]}}}]}, {provenance: false});
  assert.equal(scatter.chart, scatterInline.chart, 'a scatter mapping exports as its positional [Point, X, Y...] table');
  checks += 3;
}

// 4. Dataset tables and formatted cells export their display text; DataColumn headers their name.
{
  const deck = {datasets: {sales: {columns: ['Region', {name: 'Revenue', format: '$#,##0.0'}, {name: 'Growth', format: '0%'}], rows: [['EMEA', 8.2, 0.4], ['APAC', 6.1, 0.52]]}},
    slides: [{title: 'Dataset table', table: {dataset: 'sales'}}, {title: 'Inline table', table: {
      columns: ['Region', {name: 'Revenue', format: '$#,##0.0'}, {value: 'Growth', style: {align: 'right'}, format: '0%'}],
      rows: [['EMEA', 8.2, 0.4], ['APAC', 6.1, {value: 0.52, format: '0.0%'}], ['LATAM', 'n/a', null]]}}]};
  const {text} = await exported(deck);
  const cells = xml => [...xml.matchAll(/<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g)].map(([, body]) => [...body.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''));
  assert.deepEqual(cells(text('ppt/slides/slide1.xml')), ['Region', 'Revenue', 'Growth', 'EMEA', '$8.2', '40%', 'APAC', '$6.1', '52%']);
  assert.deepEqual(cells(text('ppt/slides/slide2.xml')), ['Region', 'Revenue', 'Growth', 'EMEA', '$8.2', '40%', 'APAC', '$6.1', '52.0%', 'LATAM', 'n/a', ''], 'a cell format wins over the column format; text and empty cells are unchanged');
  checks += 1;
}

// 5. Export -> import restores every new field: datasets (unused ones too), dataset references with fields, mapping,
// DataColumn formats, data.source, dataset tables, DataColumn headers and StyledTableCell formats.
const roundTripDeck = {
  datasets: {
    revenue: {title: 'Revenue', description: 'Quarterly revenue', columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, 'Costs'], rows: [['Q1', 12.4, 8], ['Q2', 18, 11]], source: {src: './revenue.csv', retrieved: '2026-10-05'}},
    spare: {columns: ['a', 'b'], rows: [['x', 1]]},
  },
  slides: [
    {title: 'Dataset chart', chart: {type: 'column', dataLabels: true, data: {dataset: 'revenue', fields: ['Quarter', 'Revenue']}}},
    {title: 'Mapped chart', chart: {type: 'line', mapping: {category: 'Quarter', series: ['Costs', 'Revenue']}, data: {columns: ['Revenue', 'Quarter', {name: 'Costs', format: '#,##0'}], rows: [[1, 'a', 2], [3, 'b', 4]], source: {src: 'https://example.com/q.csv', description: 'Finance export'}}}},
    {title: 'Scatter', chart: {type: 'scatter', mapping: {x: 'W'}, data: {columns: ['N', 'H', {name: 'W', format: '0.0'}], rows: [['a', 170, 60.5], ['b', 180, 75]]}}},
    {title: 'Dataset table', table: {dataset: 'revenue', fields: ['Quarter', 'Revenue']}},
    {title: 'Inline table', table: {columns: ['Region', {name: 'Revenue', format: '$#,##0.0'}, {value: 'Growth', style: {align: 'right'}, format: '0%'}], rows: [['EMEA', 8.2, 0.4], ['APAC', 6.1, {value: 0.52, format: '0.0%'}]]}},
    {title: 'Treemap', chart: {type: 'treemap', data: {columns: ['Area', {name: 'Size', format: '#,##0.0'}], rows: [['A', 5], ['B', 3]]}}},
  ],
};
{
  const {bytes} = await exported(roundTripDeck);
  const {deck, diagnostics} = await imported(bytes);
  assert.deepEqual(deck.datasets, roundTripDeck.datasets, 'the datasets map returns whole, the unused dataset included');
  const [datasetChart, mappedChart, scatter, datasetTable, inlineTable, treemap] = slidePayloads(deck);
  assert.deepEqual(datasetChart.data, {dataset: 'revenue', fields: ['Quarter', 'Revenue']}, 'the dataset reference returns, not the inlined snapshot');
  assert.equal(datasetChart.dataLabels, true, 'the native chart options stay');
  assert.deepEqual({data: mappedChart.data, mapping: mappedChart.mapping}, {data: roundTripDeck.slides[1].chart.data, mapping: roundTripDeck.slides[1].chart.mapping}, 'mapping, DataColumn formats and data.source return as authored');
  assert.deepEqual({data: scatter.data, mapping: scatter.mapping}, {data: roundTripDeck.slides[2].chart.data, mapping: roundTripDeck.slides[2].chart.mapping}, 'the scatter X mapping returns');
  assert.deepEqual(datasetTable, roundTripDeck.slides[3].table, 'a dataset table returns as its reference');
  assert.deepEqual(inlineTable.columns[1], {name: 'Revenue', format: '$#,##0.0'}, 'a DataColumn header returns');
  assert.equal(inlineTable.columns[2].format, '0%', 'a formatted header cell regains its format');
  assert.deepEqual(inlineTable.rows.map(row => row.slice(1).map(cell => typeof cell === 'object' && cell !== null && 'value' in cell ? [cell.value, cell.format] : [cell])), [[[8.2], [0.4]], [[6.1], [0.52, '0.0%']]], 'formatted number cells return as numbers, with their own formats');
  assert.deepEqual(treemap.data, roundTripDeck.slides[5].chart.data, 'a chartex chart restores too');
  assert.deepEqual(diagnostics.filter(entry => /data-provenance|dataset-unavailable|number-format-adapted|not-numeric/.test(entry.code)), [], 'nothing is reported for an untouched deck');
  // The restored document exports the same charts again.
  const again = await exported(deck);
  const first = await exported(roundTripDeck);
  for (const name of Object.keys(first.parts).filter(path => /^ppt\/charts\/chart(?:Ex)?\d+\.xml$/.test(path))) assert.equal(again.text(name), first.text(name), `${name} re-exports identically`);
  checks += 2;
}

// 6. Edits in PowerPoint win: a changed cache imports its values inline (with the formats its codes map back) and says why;
// a changed table cell keeps its text; a slide without the datasets record keeps its values inline.
{
  const {bytes} = await exported(roundTripDeck);
  const edited = repack(bytes, (name, xml) => name === 'ppt/charts/chart1.xml' ? xml.replace('<c:v>12.4</c:v>', '<c:v>13</c:v>')
    : /^ppt\/slides\/slide5\.xml$/.test(name) ? xml.replace('<a:t>$8.2</a:t>', '<a:t>$9.0</a:t>') : xml);
  const {deck, diagnostics} = await imported(edited);
  const [chart, , , , table] = slidePayloads(deck);
  assert.deepEqual(chart.data, {columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}], rows: [['Q1', 13], ['Q2', 18]]}, 'the edited chart imports inline, with the format its code maps back');
  assert.ok(diagnostics.some(entry => entry.code === 'chart-data-provenance-changed' && entry.path === 'slides.0.charts.0'));
  assert.equal(JSON.stringify(table.rows[0][1]).includes('$9.0'), true, 'the edited cell keeps the text it shows');
  assert.deepEqual([table.rows[0][2], table.rows[1][2].value], [0.4, 0.52], 'the untouched cells still restore');
  assert.ok(diagnostics.some(entry => entry.code === 'table-data-provenance-changed' && /^1 authored table cell/.test(entry.message)));
  const noDatasets = repack(bytes, (name, xml) => name === 'ppt/presentation.xml' ? xml : /^ppt\/tags\//.test(name) ? xml.replace(/<p:tag name="OPF_DATASETS_V1"[^>]*\/>/, '') : xml);
  const orphan = await imported(noDatasets);
  assert.equal(orphan.deck.datasets, undefined);
  assert.deepEqual(slidePayloads(orphan.deck)[0].data.rows, [['Q1', 12.4], ['Q2', 18]], 'without its dataset the chart keeps its values inline');
  assert.ok(orphan.diagnostics.some(entry => entry.code === 'chart-dataset-unavailable'));
  assert.ok(orphan.diagnostics.some(entry => entry.code === 'table-dataset-unavailable'));
  checks += 3;
}

// 7. Third-party decks (no OPF tags): a format code core maps back becomes the column format; anything else is reported.
{
  const {bytes} = await exported(formatted);
  const plain = await imported(withoutTags(bytes));
  const chart = slidePayloads(plain.deck)[0];
  assert.deepEqual(chart.data.columns, ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, {name: 'Margin', format: '0%'}, {name: 'Units', format: '#,##0 units'}, 'Plain'], 'the codes map back to the authored NumberFormats');
  assert.ok(!plain.diagnostics.some(entry => /label number format/.test(entry.message ?? '')), 'labels in a series format are expressed by the column format');
  const accounting = withoutTags(repack(bytes, (name, xml) => name === 'ppt/charts/chart1.xml' ? xml.replace(/<c:formatCode>0%<\/c:formatCode>/, '<c:formatCode>_(* #,##0_);_(* (#,##0)</c:formatCode>') : xml));
  const odd = await imported(accounting);
  assert.equal(slidePayloads(odd.deck)[0].data.columns[2], 'Margin', 'a code without an exact NumberFormat is not invented');
  assert.ok(odd.diagnostics.some(entry => entry.code === 'chart-number-format-adapted' && /'Margin' \(_\(\* #,##0_\);_\(\* \(#,##0\)\)/.test(entry.message) && entry.path === 'slides.0.charts.0.data'));
  // A third-party cache value that is no number imports as a gap and is reported (the legacy stripping is gone).
  const dirty = await imported(withoutTags(repack(bytes, (name, xml) => name === 'ppt/charts/chart1.xml' ? xml.replace('<c:v>12.4</c:v>', '<c:v>1,240</c:v>') : xml)));
  assert.equal(slidePayloads(dirty.deck)[0].data.rows[0][1], null);
  assert.ok(dirty.diagnostics.some(entry => entry.code === 'chart-value-not-numeric' && entry.path === 'slides.0.charts.0.data'));
  // chartex: cx:lvl formatCode maps back the same way.
  const tree = await exported({slides: [{title: 'Treemap', chart: {type: 'treemap', dataLabels: {content: ['category', 'value']}, data: {columns: ['Area', {name: 'Size', format: '#,##0.0'}], rows: [['A', 5], ['B', 3]]}}}]});
  const part = tree.text('ppt/charts/chartEx1.xml');
  assert.match(part, /<cx:lvl ptCount="2" formatCode="#,##0.0">/);
  assert.match(part, /<cx:dataLabels pos="ctr"><cx:numFmt formatCode="#,##0.0" sourceLinked="0"\/>/, 'chartex value labels show the format');
  const treePlain = await imported(withoutTags(tree.bytes));
  assert.deepEqual(slidePayloads(treePlain.deck)[0].data.columns, ['Area', {name: 'Size', format: '#,##0.0'}]);
  // A deck that never used formats imports unchanged: no DataColumn objects, no diagnostics.
  const old = await imported(withoutTags((await exported({slides: [{title: 'Old', chart: {type: 'column', data: {columns: ['Q', 'V'], rows: [['a', 1]]}}}]})).bytes));
  assert.deepEqual(slidePayloads(old.deck)[0].data.columns, ['Q', 'V']);
  assert.ok(!old.diagnostics.some(entry => /number-format|not-numeric|data-provenance/.test(entry.code)));
  checks += 4;
}

// 8. Provenance modes: references-only and false write no data tags (formats are native and still export).
{
  for (const provenance of ['references-only', false]) {
    const {parts, chart} = await exported(roundTripDeck, {provenance});
    assert.ok(!Object.keys(parts).some(name => /^ppt\/tags\/opfData/.test(name) || name === 'ppt/tags/opfDatasets.xml'), `${provenance}: no data tag parts`);
    assert.ok(!Object.values(parts).some(bytes => { try { return strFromU8(bytes).includes('OPF_DATASETS_V1') || strFromU8(bytes).includes('OPF_DATA_V1'); } catch { return false; } }), `${provenance}: no data tags`);
    assert.deepEqual(formatCodes(chart), ['$#,##0.0']);
  }
  // full: one tag per recorded frame, the chartex choice and fallback frames sharing theirs; no tag on plain charts.
  const {parts} = await exported({...roundTripDeck, slides: [...roundTripDeck.slides, {title: 'Plain', chart: {type: 'column', data: {columns: ['a', 'b'], rows: [['x', 1]]}}}]});
  assert.equal(Object.keys(parts).filter(name => /^ppt\/tags\/opfData\d+\.xml$/.test(name)).length, 6);
  assert.doesNotMatch(strFromU8(parts['ppt/slides/slide7.xml']), /rIdOpfData/);
  assert.equal((strFromU8(parts['ppt/slides/slide6.xml']).match(/<p:tags r:id="rIdOpfData6"\/>/g) ?? []).length, 2, 'the chartex choice and fallback share one tag');
  checks += 2;
}

// 9. Documents without the new fields keep main's exact bytes.
{
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/rr-54-unchanged.json', import.meta.url), 'utf8'));
  for (const [name, {deck, sha256, nativeSlideSha256}] of Object.entries(fixture.entries)) {
    const bytes = await toPptx(structuredClone(deck));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, `${name}: locked ZIP bytes (RR-59 repins only full-provenance plain tables)`);
    if (nativeSlideSha256) {
      const native = Object.entries(unzipSync(bytes)).filter(([path]) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).map(([path, data]) => [path, strFromU8(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '')]);
      assert.equal(createHash('sha256').update(JSON.stringify(native)).digest('hex'), nativeSlideSha256, `${name}: pre-RR-59 native slide content remains unchanged`);
    }
  }
  checks += Object.keys(fixture.entries).length;
}

console.log(`RR-54 chart and table data passed: ${checks} checks (strict numbers, chart and workbook number formats, dataset/mapping/scatter X equivalence, dataset and formatted tables, full round trip, edits and missing datasets, third-party format codes and chartex, provenance modes, unchanged bytes).`);
