// opf#1431: a chart with a reference line in a theme color keeps its data record (highlight, authored data) on import.
//
// The export hashes a chart's cached data with reference helpers read without theme colors (attachDataProvenance's chartXml), so a
// helper drawn in a theme color stays in the hashed part. The import reads the helper with the slide theme and removes it, so it must
// also compare the form the export hashed. A real edit of a plotted value must still drop the record and report it.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

const data = {columns: ['Terminal', 'Wait'], rows: [['North', 42], ['South', 28], ['East', 35], ['West', 31]]};
const two = {columns: ['Terminal', 'Wait', 'Walk'], rows: [['North', 42, 12], ['South', 28, 18], ['East', 35, 9], ['West', 31, 22]]};
const reference = {value: 30, label: 'Target 30 min', stroke: {color: 'accent2', dash: 'dash'}};
const deck = (chart, where = 'chart') => ({name: 'refline-highlight-roundtrip', slides: [where === 'chart'
  ? {title: 'Column, highlight, legend and a reference line', chart}
  : {title: 'Column, highlight, legend and a reference line', blocks: [{type: 'chart', chart}]}]});
const chartOf = document => document.slides[0].chart ?? document.slides[0].blocks?.find(block => block.chart)?.chart;
const provenanceChanged = diagnostics => diagnostics.filter(diagnostic => diagnostic.code === 'chart-data-provenance-changed');

async function roundTrip(document, edit) {
  let bytes = await toPptx(document);
  if (edit) {
    const entries = unzipSync(bytes), before = strFromU8(entries['ppt/charts/chart1.xml']), after = edit(before);
    assert.notEqual(after, before, 'the control edits the chart part');
    bytes = zipSync({...entries, 'ppt/charts/chart1.xml': strToU8(after)});
  }
  const diagnostics = [];
  const imported = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {chart: chartOf(imported), diagnostics};
}

// The issue's deck: a highlight of two of four categories (split into an added series for the legend) and a reference line in accent2.
const issue = {type: 'column', data, legend: 'bottom', dataLabels: {position: 'outside-end'}, highlight: {categories: ['North', 'East']}, referenceLines: [reference]};

for (const where of ['chart', 'blocks']) {
  test(`the issue's chart (${where}) imports its highlight and data without a provenance finding`, async () => {
    const {chart, diagnostics} = await roundTrip(deck(issue, where));
    assert.deepEqual(provenanceChanged(diagnostics), []);
    assert.deepEqual(chart.highlight, issue.highlight);
    assert.deepEqual(chart.data, data);
    assert.equal(chart.legend, 'bottom');
    assert.deepEqual(chart.referenceLines.map(line => [line.value, line.label, line.stroke?.color, line.stroke?.dash]), [[30, 'Target 30 min', 'accent2', 'dash']]);
  });
}

const neighbors = {
  'one highlighted category': {...issue, highlight: {categories: ['North']}},
  'two reference lines': {...issue, referenceLines: [reference, {value: 40, label: 'Max', stroke: {color: 'accent4'}}]},
  'the default reference stroke': {...issue, referenceLines: [{value: 30, label: 'Target'}]},
  'labels inside the end': {...issue, dataLabels: {position: 'inside-end'}},
  'a line chart': {type: 'line', data, legend: 'bottom', highlight: {categories: ['North']}, referenceLines: [reference]},
  'a line chart with markers': {type: 'line-with-markers', data: two, legend: 'bottom', highlight: {series: ['Walk']}, referenceLines: [reference]},
  'an area chart': {type: 'area', data: two, legend: 'bottom', highlight: {series: ['Wait']}, referenceLines: [reference]},
  'two series, a highlighted category': {type: 'column', data: two, legend: 'bottom', highlight: {categories: ['East']}, referenceLines: [reference]},
  'two series, a highlighted series': {type: 'column', data: two, legend: 'bottom', highlight: {series: ['Walk']}, referenceLines: [reference]},
};
for (const [name, chart] of Object.entries(neighbors)) {
  test(`${name} with a theme-colored reference line keeps its highlight`, async () => {
    const {chart: back, diagnostics} = await roundTrip(deck(chart));
    assert.deepEqual(provenanceChanged(diagnostics), []);
    assert.deepEqual(back.highlight, chart.highlight);
    if (chart.dataLabels?.position === 'inside-end') assert.deepEqual(back.dataLabels, chart.dataLabels);
    assert.equal(back.referenceLines.length, chart.referenceLines.length);
  });
}

test('an edit of a plotted value is still detected with a theme-colored reference line', async () => {
  // South stays in the authored series (North and East moved to the added series); 28 is its cached value.
  const {chart, diagnostics} = await roundTrip(deck(issue), xml => xml.replace('<c:v>28</c:v>', '<c:v>29</c:v>'));
  assert.equal(provenanceChanged(diagnostics).length, 1);
  assert.equal(chart.highlight, undefined);
  assert.equal(chart.data.rows[1][1], 29);
  assert.deepEqual(chart.referenceLines.map(line => line.value), [30]);
});

test('an edit of a highlighted point, held by the added series, is still detected', async () => {
  const {chart, diagnostics} = await roundTrip(deck(issue), xml => xml.replace('<c:v>42</c:v>', '<c:v>43</c:v>'));
  assert.equal(provenanceChanged(diagnostics).length, 1);
  assert.equal(chart.highlight, undefined);
  assert.equal(chart.data.rows[0][1], 43);
});

test('an edit of a number format is still detected with a theme-colored reference line', async () => {
  const {diagnostics} = await roundTrip(deck(issue), xml => xml.replace(/<c:formatCode>[^<]*<\/c:formatCode>/, '<c:formatCode>0.00</c:formatCode>'));
  assert.equal(provenanceChanged(diagnostics).length, 1);
});
