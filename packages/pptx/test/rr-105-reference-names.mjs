// RR-105: a native reference helper series is named after its reference's label (Keynote lists helpers in the legend and ignores
// c:legendEntry, so the name is what a reader there sees). The name is the label (lines joined with one space, trimmed, at most
// REFERENCE_NAME_LIMIT characters), "Reference" without a label, and unique, ignoring case, against the data series, the category
// heading and the other helpers (" 2", " 3", ...). It is written to the series name cache, the workbook header and the table column;
// the importer identifies a helper by its opf:reference extension, so the document round-trips unchanged.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {REFERENCE_NAME_LIMIT, referenceHelperNames} from '../dist/chart-references.js';

const native = (index, label) => ({index, native: true, ...(label === undefined ? {} : {label})});
const names = (lines, series = [{name: 'Revenue'}], reserved = ['Quarter']) => [...referenceHelperNames(series, lines, reserved).values()];
assert.deepEqual(names([native(0, 'Target 150')]), ['Target 150']);
assert.deepEqual(names([native(0), native(1)]), ['Reference', 'Reference 2']);
assert.deepEqual(names([native(0, 'Goal'), native(1, 'goal')]), ['Goal', 'goal 2'], 'unique ignoring case, as Excel table columns');
assert.deepEqual(names([native(0, 'Revenue')]), ['Revenue 2'], 'a label equal to a data series name');
assert.deepEqual(names([native(0, 'QUARTER')]), ['QUARTER 2'], 'a label equal to the category heading');
assert.deepEqual(names([native(0, '  Plan \n 2027 ')]), ['Plan 2027'], 'lines joined with one space, trimmed');
assert.deepEqual(names([native(0, 'الهدف')]), ['الهدف'], 'right-to-left text is ordinary text');
assert.deepEqual(names([{index: 0, native: false, label: 'Overlay'}, native(1, 'Native')]), ['Native'], 'only native helpers are named');
const long = 'x'.repeat(REFERENCE_NAME_LIMIT + 50);
assert.deepEqual(names([native(0, long), native(1, long)]).map(name => name.length), [REFERENCE_NAME_LIMIT, REFERENCE_NAME_LIMIT], 'capped, the suffix within the cap');
assert.ok(REFERENCE_NAME_LIMIT <= 255, 'within Excel\'s table column name limit');

// The export: series name cache, workbook header and table column carry the name; import returns the same references.
const rows = [['Q1', 120], ['Q2', 140], ['Q3', 160]];
const document = {language: 'en-US', slides: [
  {title: 'One', chart: {type: 'line', alt: 'Revenue', data: {columns: ['Quarter', 'Revenue'], rows}, referenceLines: [{value: 150, label: 'Ziel & <Plan> "1"'}, {value: 125}]}},
  {title: 'Two', chart: {type: 'line', alt: 'Revenue', data: {columns: ['Quarter', 'Revenue'], rows}, referenceLines: [{value: 150, label: 'Revenue'}]}},
]};
const bytes = await toPptx(structuredClone(document));
const zip = unzipSync(new Uint8Array(bytes));
const helperNames = part => [...strFromU8(zip[part]).matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(([ser]) => ser)
  .filter(ser => ser.includes('urn:openpresentation:chart-references:v1')).map(ser => /<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(ser)[1]);
const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
assert.deepEqual(helperNames('ppt/charts/chart1.xml').map(decode), ['Ziel & <Plan> "1"', 'Reference'], 'the escaped label and the unlabeled default');
assert.ok(helperNames('ppt/charts/chart1.xml')[0].includes('&lt;Plan&gt;'), 'the name is XML-escaped');
assert.deepEqual(helperNames('ppt/charts/chart2.xml'), ['Revenue 2']);
for (const [part, expected] of [['ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx', ['Ziel & <Plan> "1"', 'Reference']], ['ppt/embeddings/Microsoft_Excel_Worksheet2.xlsx', ['Revenue 2']]]) {
  const workbook = unzipSync(zip[part]);
  const columns = [...strFromU8(workbook['xl/tables/table1.xml']).matchAll(/<tableColumn\b[^>]*\bname="([^"]*)"/g)].map(match => decode(match[1]));
  assert.deepEqual(columns.slice(2), expected, `${part}: table columns`);
  const strings = [...strFromU8(workbook['xl/sharedStrings.xml'] ?? new Uint8Array()).matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(match => decode(match[1]));
  for (const name of expected) assert.ok(strings.includes(name), `${part}: header ${name}`);
  assert.ok(Object.values(workbook).every(data => !strFromU8(data).includes('OPF reference')), `${part}: no internal name in any workbook part`);
}
const back = await fromPptx(bytes);
assert.deepEqual(back.slides.map(slide => slide.chart.referenceLines.map(line => [line.value, line.label])), [[[150, 'Ziel & <Plan> "1"'], [125, undefined]], [[150, 'Revenue']]]);
assert.deepEqual(back.slides.map(slide => slide.chart.data.columns), document.slides.map(slide => slide.chart.data.columns), 'helpers never become data columns');
console.log('rr-105 reference names: ok');
