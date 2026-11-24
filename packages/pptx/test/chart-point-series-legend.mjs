// opf#1415: the legend of a one-series chart with colored points names the series in PowerPoint, as the preview draws it.
//
// The export writes each look of the colored points as one more series of the same name with its legend entry deleted, and the
// embedded workbook holds that series' column; the import joins it back, so the chart, its highlight, labels and reference lines
// round-trip. Asserts the native shape (series, c:dPt, c:overlap, c:legendEntry, cached values, workbook cells), that the split and
// the join are exact inverses on the generated parts (also for two looks), the controls the split leaves alone (no legend, two series,
// a pie), the round trip through fromPptx, and the diagnostic for a split that no longer has its exported shape.
import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {toPptx, fromPptx} from '../dist/index.js';
import {joinPointSeries, splitPointSeries, POINT_SERIES_URI} from '../dist/chart-point-series.js';

const decoder = new TextDecoder(), encoder = new TextEncoder();
const charts = {
  bar: {type: 'bar', data: {columns: ['Terminal', 'Wait', 'Target'], rows: [['North', 42, 30], ['South', 28, 30], ['East', 35, 30]]},
    mapping: {category: 'Terminal', series: ['Wait']}, legend: 'bottom', dataLabels: {position: 'inside-end'}, axisTitles: {category: 'Terminal', value: 'Minutes'},
    highlight: {categories: ['North']}, referenceLines: [{value: 30, label: 'Target 30 min', stroke: {color: 'accent2', dash: 'dot'}}]},
  column: {type: 'column', data: {columns: ['Terminal', 'Wait'], rows: [['North', 42], ['South', 28], ['East', 35], ['West', 31]]}, legend: 'bottom',
    dataLabels: {position: 'outside-end'}, highlight: {categories: ['North', 'East']}, referenceLines: [{value: 30, label: 'Target', stroke: {color: 'accent2', dash: 'dash'}}]},
  line: {type: 'line-with-markers', data: {columns: ['Month', 'Visits'], rows: [['Jan', 12], ['Feb', 18], ['Mar', 15], ['Apr', 22]]}, legend: 'right',
    highlight: {categories: ['Mar']}},
  stacked: {type: 'stacked-column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 10], ['Q2', 14], ['Q3', 12], ['Q4', 17]]}, legend: 'bottom', highlight: {categories: ['Q4']}},
  noLegend: {type: 'column', data: {columns: ['Terminal', 'Wait'], rows: [['North', 42], ['South', 28], ['East', 35]]}, highlight: {categories: ['North']}},
  twoSeries: {type: 'column', data: {columns: ['Terminal', 'Wait', 'Queue'], rows: [['North', 42, 12], ['South', 28, 9], ['East', 35, 14]]}, legend: 'bottom', highlight: {categories: ['North']}},
  pie: {type: 'pie', data: {columns: ['Region', 'Share'], rows: [['EMEA', 40], ['APAC', 35], ['AMER', 25]]}, legend: 'right', highlight: {categories: ['EMEA']}},
};

async function exported(chart) {
  const bytes = await toPptx({design: {fontScheme: 'roboto'}, slides: [{title: 'Chart', chart}]});
  const entries = unzipSync(bytes);
  const part = 'ppt/charts/chart1.xml';
  const rels = decoder.decode(entries['ppt/charts/_rels/chart1.xml.rels']);
  const workbookPath = `ppt/embeddings/${/Target="\.\.\/embeddings\/([^"]+)"/.exec(rels)[1]}`;
  const sheet = decoder.decode(unzipSync(entries[workbookPath])['xl/worksheets/sheet1.xml']);
  return {bytes, entries, part, xml: decoder.decode(entries[part]), sheet};
}
const series = xml => [...xml.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(match => match[0]);
const legendDeletes = xml => [.../<c:legend>[\s\S]*?<\/c:legend>/.exec(xml)[0].matchAll(/<c:legendEntry><c:idx val="(\d+)"\/><c:delete val="1"\/><\/c:legendEntry>/g)].map(match => Number(match[1]));
const name = ser => /<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(ser)?.[1];
const values = ser => Object.fromEntries([.../<c:val>[\s\S]*?<\/c:val>/.exec(ser)[0].matchAll(/<c:pt idx="(\d+)"><c:v>([^<]*)<\/c:v><\/c:pt>/g)].map(match => [Number(match[1]), Number(match[2])]));
const formula = (ser, role) => new RegExp(`<c:${role}>[\\s\\S]*?<c:f>([^<]*)</c:f>`).exec(ser)?.[1];
const cell = (sheet, ref) => new RegExp(`<c r="${ref}"(?=[\\s/>])[^>]*?(?:/>|>[\\s\\S]*?</c>)`).exec(sheet)?.[0];
const chartOf = imported => imported.slides[0].chart ?? imported.slides[0].blocks?.find(block => block.chart)?.chart;

// 1. A highlighted bar of one series with a legend: the North bar is its own series "Wait", its legend entry deleted, overlap 100.
{
  const {xml, sheet} = await exported(charts.bar);
  assert.equal(XMLValidator.validate(xml), true);
  const [authored, added] = series(xml).filter(ser => !ser.includes('chart-references'));
  assert.ok(added?.includes(POINT_SERIES_URI), 'the North bar is a series of its own');
  assert.equal(name(added), 'Wait');
  assert.equal(name(authored), 'Wait');
  assert.ok(!/<c:dPt>/.test(xml), 'no point of a series keeps its own fill');
  assert.match(added, /<c:idx val="1"\/><c:order val="1"\/>/);
  assert.match(/<c:spPr>[\s\S]*?<\/c:spPr>/.exec(added.slice(added.indexOf('</c:tx>')))[0], /<a:schemeClr val="accent1"\/>/, 'the added series takes the point fill');
  assert.deepEqual(values(authored), {1: 28, 2: 35});
  assert.deepEqual(values(added), {0: 42});
  assert.deepEqual(legendDeletes(xml), [1]);
  assert.match(xml, /<c:overlap val="100"\/>/);
  assert.match(xml, /<c:gapWidth val="150"\/>/, 'gap width unchanged');
  // The point's own label (its color contrasts with the accent bar) moved with it; the others stay on the authored series.
  assert.deepEqual([...added.matchAll(/<c:dLbl><c:idx val="(\d+)"\/>/g)].map(match => Number(match[1])), [0]);
  const pointLabel = text => /<c:dLbl><c:idx val="0"\/>[\s\S]*?<\/c:dLbl>/.exec(text)[0];
  assert.equal(pointLabel(added), pointLabel(joinPointSeries(xml)));
  assert.deepEqual([...authored.matchAll(/<c:dLbl><c:idx val="(\d+)"\/>/g)].map(match => Number(match[1])), [1, 2]);
  // The workbook: column C holds the added series (header and North's value); B2 is blank, so Edit Data shows what the chart draws.
  assert.equal(formula(added, 'tx'), 'Sheet1!$C$1');
  assert.equal(formula(added, 'val'), 'Sheet1!$C$2:$C$4');
  assert.equal(cell(sheet, 'C1'), '<c r="C1" t="inlineStr"><is><t xml:space="preserve">Wait</t></is></c>');
  assert.equal(cell(sheet, 'C2'), '<c r="C2"><v>42</v></c>');
  assert.equal(cell(sheet, 'B2'), '<c r="B2"/>');
  assert.equal(cell(sheet, 'B3'), '<c r="B3"><v>28</v></c>');
  assert.match(sheet, /<dimension ref="A1:C4"\/>/);
  // The split and the join are exact inverses of each other on the generated part.
  const joined = joinPointSeries(xml);
  assert.ok(!joined.includes(POINT_SERIES_URI) && /<c:dPt><c:idx val="0"\/>/.test(joined) && !/<c:legendEntry>/.test(joined));
  assert.equal(splitPointSeries(joined).xml, xml);
}

// 2. Column with a native reference helper: the helper's series and its legend entry move up by one; line, stacked: one added series each.
{
  const {xml, sheet} = await exported(charts.column);
  const all = series(xml);
  assert.equal(all.length, 3);
  assert.ok(all[1].includes(POINT_SERIES_URI) && all[2].includes('chart-references'));
  assert.match(all[2], /<c:idx val="2"\/><c:order val="2"\/>/, 'the reference helper moves up');
  assert.deepEqual(legendDeletes(xml), [1, 2], 'the added series and the helper are hidden from the legend');
  assert.deepEqual(values(all[1]), {0: 42, 2: 35}, 'both highlighted points share one look, so one series');
  assert.equal(formula(all[1], 'val'), 'Sheet1!$D$2:$D$5', 'after the helper column');
  assert.equal(cell(sheet, 'D4'), '<c r="D4"><v>35</v></c>');
  assert.equal(splitPointSeries(joinPointSeries(xml)).xml, xml);

  const line = (await exported(charts.line)).xml;
  const [lineAuthored, lineAdded] = series(line);
  assert.deepEqual(values(lineAuthored), {0: 12, 1: 18, 2: 15, 3: 22}, 'the line keeps every point');
  assert.deepEqual(values(lineAdded), {2: 15});
  assert.match(lineAdded, /<c:spPr><a:ln><a:noFill\/><\/a:ln><\/c:spPr>/, 'the added series draws no line');
  assert.match(lineAdded, /<c:marker><c:symbol val="circle"\/>[\s\S]*?accent1/, 'and the highlighted marker');
  assert.match(lineAdded, /<c:dLbls><c:delete val="1"\/><\/c:dLbls>/);
  assert.deepEqual(legendDeletes(line), [1]);
  assert.equal(splitPointSeries(joinPointSeries(line)).xml, line);

  const stacked = (await exported(charts.stacked)).xml;
  assert.equal(series(stacked).length, 2);
  assert.match(stacked, /<c:overlap val="100"\/>/);
  assert.equal(splitPointSeries(joinPointSeries(stacked)).xml, stacked);
}

// 3. Controls: no legend, two series and a pie keep their c:dPt and write no added series.
for (const key of ['noLegend', 'twoSeries', 'pie']) {
  const {xml} = await exported(charts[key]);
  assert.ok(!xml.includes(POINT_SERIES_URI), key);
  assert.match(xml, /<c:dPt>/, key);
}

// 4. Two looks (two point fills) need two added series, each hidden from the legend; the join restores both points.
{
  const {xml} = await exported(charts.bar);
  const joined = joinPointSeries(xml);
  const second = joined.replace(/(<c:dPt><c:idx val="0"\/>[\s\S]*?<\/c:dPt>)/, (point) => point + point.replace('<c:idx val="0"/>', '<c:idx val="2"/>').replace('<a:schemeClr val="accent1"/>', '<a:srgbClr val="C0504D"/>'));
  const split = splitPointSeries(second);
  const all = series(split.xml).filter(ser => !ser.includes('chart-references'));
  assert.equal(all.length, 3);
  assert.deepEqual(values(all[1]), {0: 42});
  assert.deepEqual(values(all[2]), {2: 35});
  assert.deepEqual(legendDeletes(split.xml), [1, 2]);
  assert.deepEqual(split.workbook.columns, [{column: 'C', rows: [2]}, {column: 'D', rows: [4]}]);
  assert.equal(joinPointSeries(split.xml), second);
}

// 5. The round trip: the chart comes back as authored (one series, the highlight, the legend, labels, axis titles, the reference line).
{
  const {bytes} = await exported(charts.bar);
  const diagnostics = [];
  const chart = chartOf(await fromPptx(bytes, {onDiagnostic: d => diagnostics.push(d)}));
  assert.deepEqual(chart.data, charts.bar.data);
  assert.deepEqual(chart.mapping, charts.bar.mapping);
  assert.deepEqual(chart.highlight, charts.bar.highlight);
  assert.equal(chart.legend, 'bottom');
  assert.deepEqual(chart.dataLabels, charts.bar.dataLabels);
  assert.deepEqual(chart.axisTitles, charts.bar.axisTitles);
  assert.equal(chart.referenceLines?.length, 1);
  assert.equal(chart.referenceLines[0].label, 'Target 30 min');
  assert.ok(!diagnostics.some(d => /chart-point-series|chart-data-provenance|chart-reference/.test(d.code)), JSON.stringify(diagnostics.map(d => d.code)));
  const line = chartOf(await fromPptx((await exported(charts.line)).bytes));
  assert.deepEqual(line.highlight, charts.line.highlight);
  assert.equal(line.legend, 'right');
  assert.deepEqual(line.data, charts.line.data);
  // Without provenance the chart still imports as one series (the split is joined), only the highlight names are not recorded.
  const bare = chartOf(await fromPptx(await toPptx({slides: [{title: 'Chart', chart: charts.line}]}, {provenance: false})));
  assert.deepEqual(bare.data, charts.line.data);
  assert.equal(bare.legend, 'right');
}

// 6. A split that lost its shape (the added series moved before the authored one) imports as it is, and says so.
{
  const {entries, part, xml} = await exported(charts.line);
  const [authored, added] = series(xml);
  const moved = {...entries, [part]: encoder.encode(xml.replace(authored + added, added + authored))};
  const diagnostics = [];
  const chart = chartOf(await fromPptx(zipSync(moved), {onDiagnostic: d => diagnostics.push(d)}));
  assert.ok(diagnostics.some(d => d.code === 'chart-point-series-uncertain'), JSON.stringify(diagnostics.map(d => d.code)));
  assert.equal(chart.data.columns.length, 3, 'the series import as they are');
}

console.log('Chart point series passed: one-series legends name the series (bar, column, line, stacked), workbook columns, exact split and join, controls, round trip, uncertain split.');
