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

// opf#1431, second part: `dataLabels: false` on a chart whose export labels its marks by default (a small column, bar or line chart,
// LH-03; a stacked chart's segment values, LH-109; a pie's or doughnut's value list, LH-108) exports a file without labels, which imported as no option, so the next export
// drew the labels the author had turned off. It imports as `false` now; where the default would draw nothing, the option stays absent.
const shownLabels = xml => /<c:show(?:Val|CatName|Percent|SerName) val="1"\/>/.test(xml);
const firstChartPart = entries => strFromU8(entries[Object.keys(entries).find(name => /^ppt\/charts\/chart\d+\.xml$/.test(name))]);
const offKinds = {
  column: data, bar: data, line: data, 'line-with-markers': data, area: two,
  'stacked-column': two, 'stacked-bar': two, 'stacked-area': two, '100pct-stacked-column': two, pie: data, doughnut: data,
};
const takesReference = new Set(['column', 'bar', 'line', 'line-with-markers', 'area']);
for (const [type, chartData] of Object.entries(offKinds)) {
  for (const where of ['chart', 'blocks']) {
    for (const extra of ['plain', 'highlight and reference line']) {
      if (extra !== 'plain' && !takesReference.has(type)) continue;
      const options = extra === 'plain' ? {} : {legend: 'bottom', highlight: chartData === two ? {series: ['Walk']} : {categories: ['North']}, referenceLines: [reference]};
      test(`dataLabels: false on ${type} (${where}, ${extra}) comes back off`, async () => {
        const off = {type, data: chartData, dataLabels: false, ...options};
        const {dataLabels: _off, ...plain} = off;
        const offBytes = await toPptx(deck(off, where)), plainBytes = await toPptx(deck(plain, where));
        assert.equal(shownLabels(firstChartPart(unzipSync(offBytes))), false, 'the control: the export of dataLabels: false shows no labels');
        const {chart} = await roundTrip(deck(off, where));
        // Where the default draws labels, the files differ and the import must say `false`; where they are the same file, either reads the same.
        if (Buffer.compare(Buffer.from(offBytes), Buffer.from(plainBytes)) !== 0) assert.equal(chart.dataLabels, false);
        else assert.equal(chart.dataLabels, undefined);
        // The next export draws what the file showed: no labels.
        const again = await toPptx({name: 'again', slides: [where === 'chart' ? {title: 'again', chart} : {title: 'again', blocks: [{type: 'chart', chart}]}]});
        assert.equal(shownLabels(firstChartPart(unzipSync(again))), false);
      });
    }
  }
}

test('which kinds label their marks by default: the cases above that must come back false', async () => {
  // A record of the affected kinds, so a change in core's defaults shows up here rather than as a silently weaker test.
  const affected = [];
  for (const [type, chartData] of Object.entries(offKinds)) {
    const off = await toPptx(deck({type, data: chartData, dataLabels: false})), plain = await toPptx(deck({type, data: chartData}));
    if (Buffer.compare(Buffer.from(off), Buffer.from(plain)) !== 0) affected.push(type);
  }
  // Area draws no labels by default, so its `false` exports the same file as no option.
  assert.deepEqual(affected, ['column', 'bar', 'line', 'line-with-markers', 'stacked-column', 'stacked-bar', 'stacked-area', '100pct-stacked-column', 'pie', 'doughnut']);
});

test('labels turned back on in the file import as labels, not as dataLabels: false', async () => {
  for (const type of ['column', 'stacked-column']) {
    const off = {type, data: type === 'column' ? data : two, dataLabels: false};
    const {chart} = await roundTrip(deck(off), xml => xml.replaceAll('<c:showVal val="0"/>', '<c:showVal val="1"/>'));
    assert.notEqual(chart.dataLabels, false, type);
    const again = await toPptx(deck(chart));
    assert.equal(shownLabels(firstChartPart(unzipSync(again))), true, type);
  }
});

test('a chart whose default labels do not fit, exported without the option, comes back without it', async () => {
  const wide = {columns: ['Month', 'Revenue'], rows: Array.from({length: 12}, (_, i) => [`Month ${i}`, 1234567 + i * 98765])};
  for (const dataLabels of [undefined, false]) {
    const {chart} = await roundTrip(deck({type: 'column', data: wide, ...(dataLabels === undefined ? {} : {dataLabels})}));
    assert.equal(chart.dataLabels, undefined);
  }
});
