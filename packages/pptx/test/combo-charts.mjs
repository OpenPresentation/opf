// FA-15: combo charts in the PPTX export and import.
//
// A combo chart is one classic chart part: one c:plotArea with a clustered column c:barChart on the primary axes and a c:lineChart
// with markers per value axis; line series on the secondary axis plot against a second c:valAx (at the right, crossing at the
// maximum, in the first secondary series' number format, without gridlines) and a deleted second c:catAx. The embedded workbook
// holds every series. The part is checked against the dml-chart.xsd child sequences, and fromPptx reads type, `line`,
// `secondaryAxis`, the secondary axis title and the data labels back.
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';
import {chartOrderProblems} from './helpers/chart-schema-order.mjs';

const decoder = new TextDecoder();
const columns = ['Quarter', {name: 'Revenue', format: '$#,##0.0'}, {name: 'Margin', format: '0%'}];
const rows = [['Q1', 12.4, 0.31], ['Q2', 18.1, 0.34], ['Q3', 21.7, 0.29], ['Q4', 26.3, 0.37]];
const combo = (extra = {}) => ({type: 'combo', data: {columns, rows}, ...extra});

async function exportDeck(chart, deck = {}) {
  const diagnostics = [];
  const bytes = await toPptx({design: {fontScheme: 'roboto'}, ...deck, slides: [{title: 'Revenue and margin', chart}]}, {onDiagnostic: d => diagnostics.push(d)});
  const entries = unzipSync(bytes);
  const xml = decoder.decode(entries['ppt/charts/chart1.xml']);
  const imported = (await fromPptx(bytes, {onDiagnostic: d => diagnostics.push({...d, phase: 'import'})})).slides[0];
  return {entries, xml, diagnostics, imported: imported.chart ?? imported.blocks?.find(block => block.chart)?.chart};
}
const groups = (xml, element) => [...xml.matchAll(new RegExp(`<c:${element}>([\\s\\S]*?)</c:${element}>`, 'g'))].map(match => match[1]);
const seriesNames = body => [...body.matchAll(/<c:ser>[\s\S]*?<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/g)].map(match => match[1]);
const attr = (xml, element) => new RegExp(`<c:${element} val="([^"]*)"/>`).exec(xml)?.[1];

// 1. Secondary axis: the native structure, the formats, the workbook, schema order, and the import.
{
  const {entries, xml, diagnostics, imported} = await exportDeck(combo({secondaryAxis: ['Margin'], axisTitles: {category: 'Quarter', value: 'Revenue ($M)', secondary: 'Margin (%)'}, dataLabels: true, legend: 'bottom'}));
  assert.deepEqual(chartOrderProblems(xml), [], 'the chart part follows the dml-chart.xsd sequences');
  assert.equal(groups(xml, 'plotArea').length, 1, 'one plot area');
  const [bar] = groups(xml, 'barChart');
  const lines = groups(xml, 'lineChart');
  assert.equal(attr(bar, 'barDir'), 'col');
  assert.equal(attr(bar, 'grouping'), 'clustered');
  assert.deepEqual(seriesNames(bar), ['Revenue']);
  assert.equal(lines.length, 1);
  assert.equal(attr(lines[0], 'grouping'), 'standard');
  assert.deepEqual(seriesNames(lines[0]), ['Margin']);
  assert.match(lines[0], /<c:marker>\s*<c:symbol val="circle"\/>/, 'the line has markers');
  assert.doesNotMatch(lines[0], /invertIfNegative/, 'no bar-only element in the line series');
  assert.doesNotMatch(bar, /<c:dPt>/, 'one colour for the one column series');
  // Series colours run on across the groups (palette 0, then 1), and c:idx/c:order follow the plan.
  const colour = body => /<c:ser>[\s\S]*?<c:spPr>\s*<a:solidFill>\s*<a:srgbClr val="([0-9A-F]{6})"/.exec(body)?.[1];
  assert.notEqual(colour(bar), colour(lines[0]), 'the line takes the next palette colour');
  assert.deepEqual([...xml.matchAll(/<c:order val="(\d+)"\/>/g)].map(match => match[1]), ['0', '1']);
  // Axes: the line group plots against the second value axis and the second (deleted) category axis.
  const axIds = body => [...body.matchAll(/<c:axId val="(\d+)"\/>/g)].map(match => match[1]).slice(-2);
  const [barCat, barVal] = axIds(bar), [lineCat, lineVal] = axIds(lines[0]);
  assert.notEqual(lineVal, barVal);
  const valAxes = groups(xml, 'valAx'), catAxes = groups(xml, 'catAx');
  assert.equal(valAxes.length, 2);
  assert.equal(catAxes.length, 2);
  const axis = (list, id) => list.find(body => body.includes(`<c:axId val="${id}"/>`));
  const primary = axis(valAxes, barVal), secondary = axis(valAxes, lineVal);
  assert.equal(attr(primary, 'axPos'), 'l');
  assert.equal(attr(secondary, 'axPos'), 'r');
  assert.equal(attr(secondary, 'crosses'), 'max', 'the secondary value axis crosses at the maximum (the right)');
  assert.equal(attr(secondary, 'crossAx'), lineCat);
  assert.match(primary, /<c:numFmt formatCode="\$#,##0\.0" sourceLinked="0"\/>/, 'primary ticks in the Revenue format');
  assert.match(secondary, /<c:numFmt formatCode="0%" sourceLinked="0"\/>/, 'secondary ticks in the Margin format');
  assert.match(primary, /<c:majorGridlines>/);
  assert.doesNotMatch(secondary, /<c:majorGridlines>/, 'gridlines follow the primary axis only');
  assert.match(secondary, /<c:title>[\s\S]*Margin \(%\)[\s\S]*<\/c:title>/, 'the secondary axis title');
  assert.doesNotMatch(secondary, /Revenue \(\$M\)/, 'the primary title is not repeated on the secondary axis');
  assert.equal(attr(axis(catAxes, lineCat), 'delete'), '1', 'the second category axis is deleted');
  assert.equal(attr(axis(catAxes, barCat), 'delete'), '0');
  assert.equal(attr(xml, 'dispBlanksAs'), 'gap', 'a gap breaks the line, as in the preview');
  // Labels: columns outside the end, line points above, each in its series format.
  assert.match(bar, /<c:dLbls><c:numFmt formatCode="\$#,##0\.0" sourceLinked="0"\/>[\s\S]*?<c:dLblPos val="outEnd"\/>/);
  assert.match(lines[0], /<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"\/>[\s\S]*?<c:dLblPos val="t"\/>/);
  // The embedded workbook holds every series.
  const workbookName = Object.keys(entries).find(name => /^ppt\/embeddings\/.*\.xlsx$/.test(name));
  assert.ok(workbookName, 'an embedded workbook');
  const workbook = unzipSync(entries[workbookName]);
  const strings = decoder.decode(workbook['xl/sharedStrings.xml'] ?? new Uint8Array());
  const sheet = decoder.decode(workbook['xl/worksheets/sheet1.xml']);
  for (const name of ['Revenue', 'Margin']) assert.ok(strings.includes(name) || sheet.includes(name), `the workbook names ${name}`);
  assert.match(sheet, /<c r="C2"[^>]*>/, 'the workbook holds the second series column');
  assert.equal(diagnostics.filter(d => d.phase !== 'import' && /chart/.test(d.code)).length, 0, JSON.stringify(diagnostics));
  // Import.
  assert.equal(imported.type, 'combo');
  assert.deepEqual(imported.secondaryAxis, ['Margin']);
  assert.equal(imported.line, undefined, 'the default line (the last series) is not written');
  assert.deepEqual(imported.axisTitles, {category: 'Quarter', value: 'Revenue ($M)', secondary: 'Margin (%)'});
  assert.equal(imported.legend, 'bottom');
  assert.equal(imported.dataLabels, true);
  assert.deepEqual(imported.data.columns, columns);
}

// 2. Default combo: the last series is a line on the primary axis; one value axis, one category axis.
{
  const {xml, imported} = await exportDeck(combo());
  assert.deepEqual(chartOrderProblems(xml), []);
  assert.equal(groups(xml, 'lineChart').length, 1);
  assert.equal(groups(xml, 'valAx').length, 1);
  assert.equal(groups(xml, 'catAx').length, 1);
  assert.deepEqual(imported, combo(), 'a default combo chart round-trips unchanged');
}

// 3. Columns first, then the primary-axis lines, then the secondary-axis lines; the authored order and fields come back.
{
  const data = {columns: ['Quarter', 'Margin', 'Revenue', 'Cost', 'Target'], rows: [['Q1', 0.3, 12, 8, 13], ['Q2', 0.32, 15, 9, 14]]};
  const chart = {type: 'combo', data, line: ['Margin', 'Target'], secondaryAxis: ['Margin']};
  const {xml, imported} = await exportDeck(chart);
  assert.deepEqual(chartOrderProblems(xml), []);
  const lines = groups(xml, 'lineChart');
  assert.deepEqual(seriesNames(groups(xml, 'barChart')[0]), ['Revenue', 'Cost']);
  assert.deepEqual(lines.map(seriesNames), [['Target'], ['Margin']], 'a line group per axis');
  assert.equal(imported.type, 'combo');
  assert.deepEqual(imported.data, data, 'the authored column order is restored');
  assert.deepEqual([...imported.line].sort(), ['Margin', 'Target']);
  assert.deepEqual(imported.secondaryAxis, ['Margin']);
}

// 4. Right to left: both category axes run from the right, so the secondary axis moves to the left with them.
{
  const {xml} = await exportDeck(combo({secondaryAxis: ['Margin']}), {language: 'ar'});
  assert.deepEqual(chartOrderProblems(xml), []);
  assert.deepEqual(groups(xml, 'catAx').map(body => attr(body, 'orientation')), ['maxMin', 'maxMin']);
}

// 5. Label positions: 'below' applies to the lines and the columns keep outside-end; it imports back.
{
  const {xml, imported} = await exportDeck(combo({dataLabels: {position: 'below'}}));
  assert.match(groups(xml, 'barChart')[0], /<c:dLblPos val="outEnd"\/>/);
  assert.match(groups(xml, 'lineChart')[0], /<c:dLblPos val="b"\/>/);
  assert.deepEqual(imported.dataLabels, {position: 'below'});
  const center = await exportDeck(combo({dataLabels: {position: 'center'}}));
  assert.match(groups(center.xml, 'barChart')[0], /<c:dLblPos val="ctr"\/>/);
  assert.match(groups(center.xml, 'lineChart')[0], /<c:dLblPos val="ctr"\/>/);
  assert.deepEqual(center.imported.dataLabels, {position: 'center'});
}

// 6. One series: the combo plan keeps it a column (core warns), and the part has no line group.
{
  const {xml} = await exportDeck({type: 'combo', data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 1], ['Q2', 2]]}});
  assert.deepEqual(chartOrderProblems(xml), []);
  assert.equal(groups(xml, 'lineChart').length, 0);
  assert.equal(groups(xml, 'barChart').length, 1);
}

console.log('Combo charts passed: native bar and line groups, secondary value and category axes, formats, workbook, schema order, import.');
