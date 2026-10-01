import {test} from 'node:test';
import assert from 'node:assert/strict';
import {binCounts, boxOutliers, chartIdFromLayouts, chartexDataMismatches, chartexExpectations, chartexPreviewMarks, chooseAlternateContent, parseChartex, quartilesExclusive, scottBinCount} from './chartex.mjs';

const record = (id, element, extension, deprecation) => ({id, ...(deprecation ? {deprecation} : {}), mappings: {openxml: {element, composition: 'extension', ...(extension ? {extension} : {})}}});
const CATALOG = [record('treemap', 'treemapChart'), record('histogram', 'histogramChart'), record('pareto', 'histogramChart', 'cx:paretoLine'), record('box-and-whisker', 'boxWhiskerChart'), record('waterfall', 'waterfallChart'), record('funnel', 'funnelChart'), record('world', 'mapChart'),
  {id: 'column', mappings: {openxml: {element: 'barChart', composition: 'native'}}}, record('old-treemap', 'treemapChart', undefined, {replacedBy: 'treemap'})];

test('the expectations come from the catalog records: element, extension, the cx layoutIds that follow, no deprecated or classic record', () => {
  const exp = chartexExpectations(CATALOG);
  assert.deepEqual([...exp.keys()], ['treemap', 'histogram', 'pareto', 'box-and-whisker', 'waterfall', 'funnel', 'world']);
  assert.deepEqual(exp.get('histogram').layouts, ['clusteredColumn']);
  assert.deepEqual(exp.get('pareto').layouts, ['clusteredColumn', 'paretoLine']);
  assert.deepEqual(exp.get('world').layouts, ['regionMap']);
  assert.equal(chartexExpectations([record('x', 'madeUpChart')]).size, 0, 'an element the audit does not know is not guessed');
  assert.equal(chartexExpectations([record('x', 'histogramChart', 'cx:unknownLine')]).size, 0);
});

test('layoutIds map back to the chart id: the Pareto line makes the histogram a Pareto; unknown sets are null', () => {
  const exp = chartexExpectations(CATALOG);
  assert.equal(chartIdFromLayouts(exp, ['clusteredColumn']), 'histogram');
  assert.equal(chartIdFromLayouts(exp, ['clusteredColumn', 'paretoLine']), 'pareto');
  assert.equal(chartIdFromLayouts(exp, ['paretoLine', 'clusteredColumn']), 'pareto');
  assert.equal(chartIdFromLayouts(exp, ['treemap']), 'treemap');
  assert.equal(chartIdFromLayouts(exp, ['sunburst']), null);
  assert.equal(chartIdFromLayouts(exp, []), null);
});

const PART = `<?xml version="1.0"?><cx:chartSpace xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:a="x"><cx:chartData><cx:data id="0"><cx:strDim type="cat"><cx:f>Sheet1!$A$2:$A$4</cx:f><cx:lvl ptCount="3"><cx:pt idx="0">A &amp; B</cx:pt><cx:pt idx="1">C</cx:pt><cx:pt idx="2">D</cx:pt></cx:lvl></cx:strDim><cx:numDim type="val"><cx:f>x</cx:f><cx:lvl ptCount="3"><cx:pt idx="0">52</cx:pt><cx:pt idx="1">31</cx:pt><cx:pt idx="2">24</cx:pt></cx:lvl></cx:numDim></cx:data></cx:chartData><cx:chart><cx:plotArea><cx:plotAreaRegion><cx:series layoutId="clusteredColumn" uniqueId="{1}"><cx:tx><cx:txData><cx:f>x</cx:f><cx:v>Defects</cx:v></cx:txData></cx:tx><cx:spPr><a:solidFill><a:srgbClr val="2874a6"/></a:solidFill></cx:spPr><cx:dataId val="0"/><cx:layoutPr><cx:aggregation/></cx:layoutPr></cx:series><cx:series layoutId="paretoLine" ownerIdx="0" uniqueId="{2}"><cx:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="3F6B88"/></a:solidFill></a:ln></cx:spPr><cx:dataLabels pos="ctr"><cx:txPr><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Aptos"/></a:defRPr></a:pPr></a:p></cx:txPr></cx:dataLabels></cx:series></cx:plotAreaRegion><cx:axis id="0"><cx:txPr><a:p><a:pPr><a:defRPr sz="1000"><a:latin typeface="Aptos"/></a:defRPr></a:pPr></a:p></cx:txPr></cx:axis></cx:plotArea></cx:chart></cx:chartSpace>`;

test('parseChartex reads layoutIds, owners, caches, series colours (not label colours), text properties and flags', () => {
  const p = parseChartex(PART);
  assert.deepEqual(p.layouts, ['clusteredColumn', 'paretoLine']);
  assert.deepEqual(p.series.map(s => s.ownerIdx), [null, '0']);
  assert.deepEqual(p.categories, ['A & B', 'C', 'D']);
  assert.deepEqual(p.values, [52, 31, 24]);
  assert.deepEqual(p.colors, ['2874A6', '3F6B88'], 'series fills and a:ln, upper-cased; the white data-label text colour is not a series colour');
  assert.deepEqual(p.typefaces, ['Aptos']); assert.deepEqual(p.sizes, [900, 1000]);
  assert.ok(p.series[0].aggregation && !p.series[0].binning); assert.equal(p.series[0].name, 'Defects');
  assert.deepEqual(p.strings, ['A & B', 'C', 'D', 'Defects']);
});

test('an AlternateContent is read as its Choice (the fallback frame is never a second shape); without a Choice the fallback is dropped', () => {
  const xml = '<a><mc:AlternateContent xmlns:mc="m"><mc:Choice Requires="cx1"><p:graphicFrame>CX</p:graphicFrame></mc:Choice><mc:Fallback><p:graphicFrame>CLASSIC</p:graphicFrame></mc:Fallback></mc:AlternateContent><b/></a>';
  assert.equal(chooseAlternateContent(xml), '<a><p:graphicFrame>CX</p:graphicFrame><b/></a>');
  assert.equal(chooseAlternateContent('<a><mc:AlternateContent><mc:Fallback>F</mc:Fallback></mc:AlternateContent></a>'), '<a></a>');
  assert.equal(chooseAlternateContent('<a><p:sp/></a>'), '<a><p:sp/></a>');
});

test('statistics: Scott bins, bin counts with a closed first bin, exclusive quartiles and Tukey outliers', () => {
  const sample = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 7, 7];
  const bins = scottBinCount(sample); assert.ok(bins >= 2 && bins <= 6);
  const counts = binCounts(sample, bins); assert.equal(counts.reduce((a, b) => a + b, 0), sample.length); assert.ok(counts[0] >= 1, 'the minimum is in the first bin');
  assert.deepEqual(binCounts([0, 5, 10], 2), [2, 1], 'the first bin is closed: 0 and 5, then (5, 10]');
  assert.equal(scottBinCount([4]), 1); assert.equal(scottBinCount([2, 2, 2]), 1);
  assert.deepEqual(quartilesExclusive([1, 2, 3, 4, 5, 6, 7, 8]), [2.5, 4.5, 6.5]);
  assert.deepEqual(quartilesExclusive([1, 2, 3, 4, 5, 6, 7]), [2, 4, 6]);
  const groups = boxOutliers([...[10, 11, 12, 13, 14, 15, 16, 17, 60].map(v => ['N', v]), ...[1, 2, 3, 4].map(v => ['S', v])]);
  assert.deepEqual(groups.map(g => [g.name, g.n, g.outliers]), [['N', 9, [60]], ['S', 4, []]]);
});

// ---- the mark checks, with controls: ideal marks pass, every perturbation fails the check it should -----------------------------
const rect = (path, x, y, w, h) => ({tag: 'rect', 'data-opf-path': path, x, y, width: w, height: h});
const failing = r => r.checks.filter(c => !c.ok).map(c => c.name);

test('treemap: one tile per positive value, areas proportional to the values', () => {
  const rows = [['a', 10], ['b', 30], ['c', 0]];
  const ok = [rect('slides.0.chart.data.rows.0.1', 0, 0, 10, 10), rect('slides.0.chart.data.rows.1.1', 10, 0, 30, 10)];
  assert.equal(chartexPreviewMarks('treemap', rows, ok).ok, true);
  assert.deepEqual(failing(chartexPreviewMarks('treemap', rows, [ok[0], rect('slides.0.chart.data.rows.1.1', 10, 0, 20, 10)])), ['tile areas are proportional to the values']);
  assert.deepEqual(failing(chartexPreviewMarks('treemap', rows, [ok[0]])).slice(0, 1), ['one tile per positive value']);
});

test('histogram: Scott bins and bar heights proportional to the counts', () => {
  const values = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 7, 7], rows = values.map(v => [v]);
  const counts = binCounts(values, scottBinCount(values));
  const ok = counts.map((c, i) => rect(`slides.0.chart.data.columns.0`, 10 + i * 20, 100 - c * 5, 18, c * 5));
  assert.equal(chartexPreviewMarks('histogram', rows, ok).ok, true);
  const bent = ok.map((m, i) => i === 0 ? {...m, height: m.height + 5} : m);
  assert.deepEqual(failing(chartexPreviewMarks('histogram', rows, bent)), ['bar heights are proportional to the bin counts']);
  assert.deepEqual(failing(chartexPreviewMarks('histogram', rows, ok.slice(1))).slice(0, 1), ['one bar per bin (Scott)']);
});

test('pareto: sorted bars, a cumulative line ending at 100%', () => {
  const rows = [['b', 30], ['a', 50], ['c', 20]];
  const bars = [['a', 50], ['b', 30], ['c', 20]].map(([, v], i) => rect(`slides.0.chart.data.rows.${i}.1`, 10 + i * 20, 100 - v * 2, 15, v * 2));
  const line = pts => ({tag: 'polyline', 'data-opf-path': 'slides.0.chart.data.columns.1', points: pts});
  // the bars of the preview follow the row order in the path index but are drawn from the sorted values
  const ordered = [rect('slides.0.chart.data.rows.0.1', 10, 0, 15, 100), rect('slides.0.chart.data.rows.1.1', 30, 40, 15, 60), rect('slides.0.chart.data.rows.2.1', 50, 60, 15, 40)];
  assert.equal(bars.length, 3);
  assert.equal(chartexPreviewMarks('pareto', rows, [...ordered, line('10,50 30,20 50,0')]).ok, true);
  assert.deepEqual(failing(chartexPreviewMarks('pareto', rows, [...ordered, line('10,50 30,30 50,0')])), ['the line is the cumulative share, ending at 100%']);
  assert.deepEqual(failing(chartexPreviewMarks('pareto', rows, [...ordered, line('10,50 30,20')])).slice(0, 1), ['a cumulative line with one point per category']);
  assert.ok(failing(chartexPreviewMarks('pareto', rows, [ordered[0], {...ordered[1], height: 70}, ordered[2], line('10,50 30,20 50,0')])).includes('bar heights follow the sorted values'));
});

test('box-and-whisker: one box per category and one mark per outlier outside the 1.5 IQR whiskers', () => {
  const rows = [...[10, 11, 12, 13, 14, 15, 16, 17, 60].map(v => ['N', v]), ...[1, 2, 3, 4].map(v => ['S', v])];
  const boxes = [rect('slides.0.chart.data.columns.1', 0, 0, 10, 10), rect('slides.0.chart.data.columns.1', 20, 0, 10, 10)];
  const dot = {tag: 'circle', 'data-opf-path': 'slides.0.chart.data.rows.8.1', cx: 5, cy: 5};
  assert.equal(chartexPreviewMarks('box-and-whisker', rows, [...boxes, dot]).ok, true);
  assert.deepEqual(failing(chartexPreviewMarks('box-and-whisker', rows, boxes)), ['one outlier mark per value outside the 1.5 IQR whiskers']);
  assert.deepEqual(failing(chartexPreviewMarks('box-and-whisker', rows, [boxes[0], dot])), ['one box per category']);
});

test('waterfall: bars proportional to the magnitudes, each starting at the running total', () => {
  const rows = [['a', 10], ['b', -4], ['c', 6]];
  const ok = [rect('slides.0.chart.data.rows.0.1', 0, 150, 9, 50), rect('slides.0.chart.data.rows.1.1', 10, 150, 9, 20), rect('slides.0.chart.data.rows.2.1', 20, 140, 9, 30)];
  assert.equal(chartexPreviewMarks('waterfall', rows, ok).ok, true);
  assert.deepEqual(failing(chartexPreviewMarks('waterfall', rows, [ok[0], ok[1], {...ok[2], y: 120}])), ['each bar starts at the running total']);
  assert.deepEqual(failing(chartexPreviewMarks('waterfall', rows, [ok[0], {...ok[1], height: 30}, ok[2]])).slice(0, 1), ['bar heights are proportional to the magnitudes']);
});

test('funnel: bar widths proportional to the values, one centre line', () => {
  const rows = [['a', 100], ['b', 60], ['c', 20]];
  const ok = [rect('slides.0.chart.data.rows.0.1', 0, 0, 100, 10), rect('slides.0.chart.data.rows.1.1', 20, 12, 60, 10), rect('slides.0.chart.data.rows.2.1', 40, 24, 20, 10)];
  assert.equal(chartexPreviewMarks('funnel', rows, ok).ok, true);
  assert.deepEqual(failing(chartexPreviewMarks('funnel', rows, [ok[0], {...ok[1], x: 25}, ok[2]])), ['the bars share one centre line']);
  assert.deepEqual(failing(chartexPreviewMarks('funnel', rows, [ok[0], {...ok[1], width: 50, x: 25}, ok[2]])), ['bar widths are proportional to the values']);
});

test('world: one tile per region; an id without a check fails instead of passing silently', () => {
  assert.equal(chartexPreviewMarks('world', [['a', 1], ['b', 2]], [rect('slides.0.chart.data.rows.0.1', 0, 0, 5, 5), rect('slides.0.chart.data.rows.1.1', 5, 0, 5, 5)]).ok, true);
  assert.equal(chartexPreviewMarks('world', [['a', 1], ['b', 2]], [rect('slides.0.chart.data.rows.0.1', 0, 0, 5, 5)]).ok, false);
  assert.equal(chartexPreviewMarks('sunburst', [['a', 1]], []).ok, false);
});

test('the part against the data: layoutIds follow the catalog, caches equal the columns, the Pareto line is owned, the histogram bins', () => {
  const exp = chartexExpectations(CATALOG), part = parseChartex(PART), rows = [['A & B', 52], ['C', 31], ['D', 24]];
  assert.deepEqual(chartexDataMismatches('pareto', exp.get('pareto'), part, rows), []);
  assert.deepEqual(chartexDataMismatches('treemap', exp.get('treemap'), part, rows), ['chartex layoutIds clusteredColumn|paretoLine, the catalog records treemap']);
  assert.match(chartexDataMismatches('pareto', exp.get('pareto'), part, [['A & B', 52], ['C', 31], ['D', 25]])[0], /value cache differs/);
  assert.match(chartexDataMismatches('pareto', exp.get('pareto'), part, [['X', 52], ['C', 31], ['D', 24]])[0], /category labels differ/);
  const unowned = parseChartex(PART.replace(' ownerIdx="0"', ''));
  assert.deepEqual(chartexDataMismatches('pareto', exp.get('pareto'), unowned, rows), ['the Pareto line is not an owned series']);
  const hist = parseChartex(PART.replace(/<cx:series layoutId="paretoLine"[\s\S]*?<\/cx:series>/, '').replace('<cx:strDim', '<cx:strDimX').replace('</cx:strDim>', '</cx:strDimX>'));
  assert.deepEqual(chartexDataMismatches('histogram', exp.get('histogram'), hist, [[52], [31], [24]]), []);
  const unbinned = parseChartex(PART.replace(/<cx:series layoutId="paretoLine"[\s\S]*?<\/cx:series>/, '').replace('<cx:aggregation/>', ''));
  assert.ok(chartexDataMismatches('histogram', exp.get('histogram'), unbinned, [[52], [31], [24]]).includes('the histogram series has no binning or aggregation'));
});
