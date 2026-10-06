// RR-54 native check (OpenPresentation/opf#385, PowerPoint 16.0.20430): a plain PowerPoint save re-spells every number
// format code without changing what it shows, and the chart data record must survive it.
//
//   $#,##0.0       -> \$#,##0.0          $#,##0  -> \$#,##0
//   #,##0 "units"  -> #,##0\ "units"     0.0 "kg" -> 0.0\ "kg"
//
// chartEvidence hashes each code in core's canonical form (numberFormatFromExcel), so the re-spelled caches keep their
// evidence: the dataset reference, `fields` and `mapping` return (the doughnut included) and the scatter point names stay
// a, b, c instead of falling back to the cache's 1, 2, 3. A real format change (other decimals, another unit, another
// code core cannot map) still changes the evidence and is reported as chart-data-provenance-changed.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {chartEvidence} from '../dist/data-provenance.js';

const exported = async deck => unzipSync(await toPptx(structuredClone(deck), {}));
const imported = async parts => {
  const diagnostics = [];
  const deck = await fromPptx(zipSync(parts), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {deck, diagnostics};
};
const edit = (parts, change) => {
  const next = {...parts};
  for (const name of Object.keys(parts).filter(path => /^ppt\/charts\/chart(?:Ex)?\d+\.xml$/.test(path))) {
    const before = strFromU8(parts[name]), after = change(before);
    if (after !== before) next[name] = strToU8(after);
  }
  return next;
};
// PowerPoint's spelling (opf#385): a literal-safe `$` gains a backslash, and the space before a quoted literal is escaped.
const respell = code => code.replace(/(^|[^\\])\$/g, '$1\\$').replace(/ (?=&quot;|")/g, '\\ ');
const powerPointSave = parts => edit(parts, xml => xml
  .replace(/<c:formatCode>([^<]*)<\/c:formatCode>/g, (_match, code) => `<c:formatCode>${respell(code)}</c:formatCode>`)
  .replace(/(<(?:c|cx):numFmt formatCode=")([^"]*)"/g, (_match, open, code) => `${open}${respell(code)}"`)
  .replace(/(<cx:lvl\b[^>]*?\bformatCode=")([^"]*)"/g, (_match, open, code) => `${open}${respell(code)}"`));
const codes = parts => Object.keys(parts).filter(path => /^ppt\/charts\/chart\d+\.xml$/.test(path)).sort()
  .flatMap(name => [...strFromU8(parts[name]).matchAll(/<c:formatCode>([^<]*)<\/c:formatCode>/g)].map(match => match[1]));
const payloads = deck => deck.slides.map(slide => slide.chart ?? slide.table);
const dataCodes = diagnostics => diagnostics.filter(entry => /data-provenance|dataset-unavailable/.test(entry.code)).map(entry => `${entry.code} ${entry.path}`);
let checks = 0;

// 1. chartEvidence: the exact re-spellings of opf#385 hash equal; real changes do not.
{
  const part = code => `<c:chartSpace><c:ser><c:tx><c:v>Revenue</c:v></c:tx><c:val><c:numRef><c:numCache><c:formatCode>${code}</c:formatCode><c:pt idx="0"><c:v>12.4</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser></c:chartSpace>`;
  const same = [
    ['$#,##0.0', '\\$#,##0.0'],
    ['$#,##0', '\\$#,##0'],
    ['#,##0 &quot;units&quot;', '#,##0\\ &quot;units&quot;'],
    ['#,##0 "units"', '#,##0\\ "units"'],
    ['0.0 &quot;kg&quot;', '0.0\\ &quot;kg&quot;'],
    ['$#,##0.0', '"$"#,##0.0'],
  ];
  for (const [exportedCode, savedCode] of same) assert.equal(chartEvidence(part(savedCode)), chartEvidence(part(exportedCode)), `${savedCode} is the same format as ${exportedCode}`);
  const changed = [
    ['$#,##0.0', '\\$#,##0.00'],
    ['$#,##0.0', '€#,##0.0'],
    ['#,##0 "units"', '#,##0\\ "kg"'],
    ['0%', '0.0%'],
    ['0.0 "kg"', 'General'],
    ['[Red]0', '[Blue]0'],
    // A code core cannot map is hashed as written, apart from the canonical form of a code it can map.
    ['#,##0 units', '#,##0 "units"'],
  ];
  for (const [before, after] of changed) assert.notEqual(chartEvidence(part(after)), chartEvidence(part(before)), `${before} -> ${after} is a format change`);
  checks += 2;
}

// 2. Export -> PowerPoint's re-spelling -> import restores every record, as the untouched deck does.
const deck = {
  datasets: {
    sales: {columns: ['Region', {name: 'Sales', format: '$#,##0'}, {name: 'Units', format: '#,##0 units'}], rows: [['EMEA', 4200, 120], ['APAC', 3100, 80], ['AMER', 5600, 150]]},
  },
  slides: [
    {title: 'Formats', chart: {type: 'column', dataLabels: true, data: {columns: ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, {name: 'Margin', format: '0%'}, {name: 'Units', format: '#,##0 units'}], rows: [['Q1', 12.4, 0.31, 1200], ['Q2', 18.1, 0.34, 1800], ['Q3', null, 0.29, 2400], ['Q4', 24.6, 0.4, 3100]]}}},
    {title: 'Scatter', chart: {type: 'scatter', dataLabels: true, data: {columns: ['Point', {name: 'Weight', format: '0.0 kg'}, {name: 'Price', format: '$#,##0'}], rows: [['a', 1.5, 1200], ['b', 2.5, 1850], ['c', 3.5, 2400]]}}},
    {title: 'Doughnut', chart: {type: 'doughnut', data: {dataset: 'sales', fields: ['Region', 'Sales']}}},
    {title: 'Mapped', chart: {type: 'line', mapping: {category: 'Region', series: ['Units', 'Sales']}, data: {dataset: 'sales'}}},
  ],
};
{
  const parts = await exported(deck);
  const saved = powerPointSave(parts);
  assert.ok(codes(saved).includes('\\$#,##0.0') && codes(saved).includes('#,##0\\ &quot;units&quot;') && codes(saved).includes('0.0\\ &quot;kg&quot;'), 'the saved copy carries PowerPoint\'s spellings');
  assert.notDeepEqual(codes(saved), codes(parts), 'the re-spelling changed the cached codes');
  const untouched = await imported(parts);
  const resaved = await imported(saved);
  assert.deepEqual(dataCodes(resaved.diagnostics), [], 'no chart-data-provenance-changed after a re-spelling save');
  assert.deepEqual(payloads(resaved.deck), payloads(untouched.deck), 'the re-spelled deck imports as the untouched one');
  assert.deepEqual(resaved.deck.datasets, deck.datasets, 'the datasets map returns');
  const [formats, scatter, doughnut, mapped] = payloads(resaved.deck);
  assert.deepEqual(formats.data, deck.slides[0].chart.data, 'the DataColumn formats return as authored');
  assert.deepEqual(scatter.data.rows.map(row => row[0]), ['a', 'b', 'c'], 'the scatter point names stay a, b, c (not the cache\'s 1, 2, 3)');
  assert.deepEqual(scatter.data, deck.slides[1].chart.data);
  assert.deepEqual(doughnut.data, {dataset: 'sales', fields: ['Region', 'Sales']}, 'the doughnut keeps its dataset reference and fields');
  assert.deepEqual({data: mapped.data, mapping: mapped.mapping}, {data: {dataset: 'sales'}, mapping: deck.slides[3].chart.mapping}, 'the mapping returns');
  checks += 2;
}

// 3. A real format change in the saved copy is still a change: the chart imports inline with what the cache shows.
{
  const parts = await exported(deck);
  const changed = edit(powerPointSave(parts), xml => xml.replace('<c:formatCode>\\$#,##0.0</c:formatCode>', '<c:formatCode>\\$#,##0.00</c:formatCode>')
    .replace(/<c:formatCode>0\.0\\ (&quot;|")kg\1<\/c:formatCode>/, '<c:formatCode>0.0\\ $1lb$1</c:formatCode>'));
  const {deck: result, diagnostics} = await imported(changed);
  assert.deepEqual(dataCodes(diagnostics).filter(code => code.startsWith('chart-data-provenance-changed')), ['chart-data-provenance-changed slides.0.charts.0', 'chart-data-provenance-changed slides.1.charts.0'], 'the two charts whose formats changed are reported, the others restore');
  const [formats, scatter, doughnut] = payloads(result);
  assert.deepEqual(formats.data.columns[1], {name: 'Revenue', format: '$#,##0.00'}, 'the changed format imports as the cache shows it');
  assert.deepEqual(scatter.data.columns[1], {name: 'Weight', format: '0.0 lb'});
  assert.deepEqual(doughnut.data, {dataset: 'sales', fields: ['Region', 'Sales']}, 'an unchanged chart in the same deck still restores');
  checks += 1;
}

console.log(`rr-54 format re-spelling: ${checks} checks passed`);
