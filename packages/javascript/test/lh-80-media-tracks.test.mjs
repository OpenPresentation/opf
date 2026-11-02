// LH-80, LH-49, LH-66: in automatic composition one picture among other blocks takes a full-height, cover-cropped, bled side track;
// one chart whose plot is too short takes the filling track; a layout that leaves a chart's plot too short is composed as the automatic
// grid; and a paragraph keeps a measure of at least 28 average characters.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartPlotBox, composeSlide } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const svg = (width, height) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#3f8a55"/></svg>`).toString('base64')}`;
const paragraph = 'City Sanitation Bureau should focus the next cycle on increasing household recycling participation with clearer guidance while making the operating tradeoffs clear to sanitation stakeholders.';
const quote = { quote: { text: 'Teams already know where the friction is; the deck makes the sequence of choices explicit.', attribution: 'Program sponsor' } };
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const picture = (result) => result.items.find((item) => item.field === 'image');
const chartData = { type: 'line-with-markers', data: { columns: ['Quarter', 'Current', 'Baseline'], rows: [['Q1', 18, 15], ['Q2', 22, 17], ['Q3', 25, 19], ['Q4', 29, 21]] } };
const metric = { metric: { value: '$4.8M', label: 'Primary signal', description: 'Move anchor tenants from interest to signed letters of intent', trend: 'up' } };

test('LH-80: the first block\'s picture takes a bled, cover-cropped track at the start side; the headings and blocks compose beside it', () => {
  const result = composeSlide({ title: 'Signal trend', blocks: [{ image: svg(1600, 1000) }, { text: paragraph }, quote] });
  const image = picture(result);
  assert.equal(result.track.kind, 'picture');
  assert.equal(result.track.edge, 'left');
  assert.equal(result.track.path, 'slides.0.blocks.0');
  assert.ok(result.track.size >= 0.35 && result.track.size <= 0.5, `${result.track.size}`);
  assert.equal(image.image.fit, 'cover');
  assert.deepEqual(image.image.placement, { edge: 'left', size: result.track.size, inset: false, path: 'slides.0.blocks.0.placement', automatic: true });
  assert.deepEqual(image.image.box, { x: 0, y: 0, width: 1280 * result.track.size, height: 720 }, 'full height, bled to the slide edges');
  for (const item of result.items.filter((entry) => entry.field !== 'image')) assert.ok(item.box.x >= image.image.box.width, `${item.field} beside the track`);
  assert.deepEqual(findings(result), []);
  // The paragraph keeps a reading measure beside the picture (LH-66): 28 average characters or more.
  const text = result.items.find((item) => item.field === 'text');
  assert.ok(text.box.width >= 28 * 0.5 * text.text.fontSize, `${text.box.width} at ${text.text.fontSize}`);
});

test('LH-80: a picture after the other blocks takes the end side; right to left, the start side is the right', () => {
  assert.equal(composeSlide({ title: 'T', blocks: [{ text: paragraph }, { image: svg(1600, 1000) }] }).track.edge, 'right');
  const rtl = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 1000) }, { text: paragraph }] }, { direction: 'rtl' });
  assert.equal(rtl.track.edge, 'right');
  assert.equal(picture(rtl).image.box.x + picture(rtl).image.box.width, 1280);
  // A portrait canvas takes a band at the top (first) or the bottom.
  const portrait = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 1000) }, { text: paragraph }] }, { width: 720, height: 1280 });
  assert.equal(portrait.track.edge, 'top');
  assert.equal(picture(portrait).image.box.width, 720);
});

test('LH-80: a portrait picture takes a narrower track than a landscape one; a very wide picture none', () => {
  const portrait = composeSlide({ title: 'T', blocks: [{ image: svg(600, 1200) }, { text: paragraph }] });
  const landscape = composeSlide({ title: 'T', blocks: [{ image: svg(1600, 900) }, { text: paragraph }] });
  assert.ok(portrait.track.size < landscape.track.size, `${portrait.track.size} vs ${landscape.track.size}`);
  // A panorama would lose more than half of its width in any track: it stays whole in the flow.
  const panorama = composeSlide({ title: 'T', blocks: [{ image: svg(3000, 900) }, { text: paragraph }] });
  assert.equal(panorama.track, undefined);
  assert.equal(picture(panorama).image.fit, 'contain');
});

test('LH-80: an authored fit, frame, placement, layout, weights or a second picture keep the composition as before', () => {
  const blocks = (image) => [{ image: svg(1600, 1000), ...image }, { text: paragraph }];
  assert.equal(composeSlide({ title: 'T', blocks: blocks({ fit: 'contain' }) }).track, undefined);
  assert.equal(composeSlide({ title: 'T', design: { imageFit: 'contain' }, blocks: blocks({}) }).track, undefined);
  assert.equal(composeSlide({ title: 'T', blocks: blocks({ shape: 'circle' }) }).track, undefined);
  assert.equal(composeSlide({ title: 'T', blocks: blocks({ placement: { edge: 'right', size: 0.3 } }) }).track, undefined);
  assert.equal(composeSlide({ title: 'T', composition: { mode: 'row', weights: [1, 1] }, blocks: blocks({}) }).track, undefined);
  assert.equal(composeSlide({ title: 'T', blocks: [...blocks({}), { image: svg(1600, 1000) }] }).track, undefined);
  assert.equal(composeSlide({ title: 'T', blocks: blocks({}) }, { layout: layouts['image-beside'] }).track, undefined);
  assert.equal(composeSlide({ title: 'T', blocks: [{ image: svg(1600, 1000) }] }).track, undefined, 'a picture alone');
});

test('LH-80: an authored mode keeps flowing the other blocks beside the track; a track that would read worse is not taken', () => {
  const column = composeSlide({ title: 'T', composition: { mode: 'column' }, blocks: [{ text: paragraph }, metric, { image: svg(1600, 1000) }] });
  assert.equal(column.track.edge, 'right');
  const [text, value] = ['text', 'metric'].map((field) => column.items.find((item) => item.field === field));
  assert.ok(value.box.y > text.box.y && Math.abs(value.box.x - text.box.x) < 1, 'still one column');
  // An authored row of four narrow blocks: the track would shorten the paragraph's measure further, so the row stays as it was.
  const row = composeSlide({ title: 'T', composition: { mode: 'row' }, blocks: [{ text: paragraph }, metric, metric, { image: svg(1600, 1000) }] });
  assert.equal(row.track, undefined);
});

test('LH-49: a chart whose plot is too short takes the filling track beside the other blocks, in their own mode', () => {
  const blocks = [{ chart: chartData }, metric, quote];
  const plain = composeSlide({ title: 'Why this matters', composition: { mode: 'column' }, blocks }, { recompose: false });
  const result = composeSlide({ title: 'Why this matters', composition: { mode: 'column' }, blocks });
  assert.equal(result.track.kind, 'chart');
  assert.equal(result.track.edge, 'left');
  const chart = result.items.find((item) => item.field === 'chart'), plot = chartPlotBox(chart, 1);
  assert.ok(plot.height >= Math.max(120, 0.22 * result.contentBox.height), `plot ${plot.height}`);
  assert.ok(plot.width <= 3 * plot.height, `aspect ${plot.width} x ${plot.height}`);
  assert.ok(chart.box.height === result.contentBox.height, 'the chart fills its track');
  const others = result.items.filter((item) => item.field === 'metric' || item.field === 'quote');
  assert.ok(others.every((item) => item.box.x > chart.box.x + chart.box.width), 'the others beside it');
  assert.ok(others[1].box.y > others[0].box.y, 'stacked in their column');
  assert.ok(result.items.filter((item) => item.field !== 'chart' && item.field !== 'title').every((item) => item.box.width >= 0.35 * 1280), 'text keeps 40% of the width');
  assert.deepEqual(findings(result), findings(plain));
  // Right to left the chart is at the right; design.chartPrimary (even 'none') is the author's.
  assert.equal(composeSlide({ title: 'T', composition: { mode: 'column' }, blocks }, { direction: 'rtl' }).track.edge, 'right');
  assert.equal(composeSlide({ title: 'T', design: { chartPrimary: 'none' }, composition: { mode: 'column' }, blocks }).track, undefined);
  // A chart whose plot is large enough keeps the grid.
  assert.equal(composeSlide({ title: 'T', blocks: [{ chart: chartData }, { text: 'Median review time fell 57%.' }] }).track, undefined);
});

test('LH-49: a layout that leaves a chart\'s plot too short is composed as the automatic grid when that reads as well', () => {
  const pair = (index) => [{ chart: { ...chartData, type: index % 2 ? 'column' : 'area' } }, { text: `${paragraph} (${index})` }];
  const slide = { title: 'Evidence pack', blocks: [...pair(0), ...pair(1), ...pair(2)] };
  const kept = composeSlide(slide, { layout: layouts['chart-beside'], recompose: false });
  const result = composeSlide(slide, { layout: layouts['chart-beside'] });
  assert.ok(Math.min(...kept.items.filter((item) => item.field === 'chart').map((item) => chartPlotBox(item, 1).height)) < 120, 'the layout draws a short plot');
  assert.ok(result.recomposed?.chart, 'recomposed for the chart');
  assert.ok(result.recomposed.chart.plot > result.recomposed.chart.layoutPlot);
  assert.ok(findings(result).length <= findings(kept).length);
  assert.equal(new Set(result.items.flatMap((item) => /\.blocks\.(\d+)/.exec(item.path)?.[1] ?? [])).size, 6, 'every block is drawn');
});

test('LH-66: automatic composition keeps a paragraph on 28 average characters or more; labels and lists keep their grid', () => {
  const long = (index) => ({ text: `${paragraph} Option ${index} names the owner, the checkpoint and the evidence the board will see.` });
  const auto = composeSlide({ title: 'T', blocks: [long(1), long(2), long(3)] }, { explain: true });
  const texts = auto.items.filter((item) => item.field === 'text' && item.path.includes('blocks'));
  for (const text of texts) assert.ok(text.box.width >= 28 * 0.5 * text.text.fontSize - 0.5, `${text.box.width} at ${text.text.fontSize}`);
  const root = auto.explanation.decisions[0];
  assert.ok(root.selectedColumns < 3, `${root.selectedColumns} columns`);
  assert.equal(root.candidates.find((candidate) => candidate.columns === 3).penalties.narrowMeasure, 60);
  // A grid with no column count of its own takes fewer columns the same way, but never at the cost of a paragraph's size: three long
  // paragraphs stacked would shrink, so they keep the grid's three columns and their size.
  const texts3 = (result) => result.items.filter((item) => item.field === 'text' && item.path.includes('blocks'));
  const grid = composeSlide({ title: 'T', composition: { mode: 'grid' }, blocks: [long(1), long(2), long(3)] });
  const columns = composeSlide({ title: 'T', composition: { mode: 'grid', columns: 3 }, blocks: [long(1), long(2), long(3)] });
  for (const [index, item] of texts3(grid).entries()) assert.ok(item.text.fontSize >= texts3(columns)[index].text.fontSize - 1e-6, `paragraph ${index} keeps its size`);
  // Two paragraphs and a label: two columns hold the paragraphs at the same size on a measure of 40 characters.
  const two = composeSlide({ title: 'T', composition: { mode: 'grid' }, blocks: [{ text: paragraph }, { text: paragraph }, { text: 'A short label.' }] });
  for (const item of texts3(two)) assert.ok(item.text.fontSize === 28 && item.box.width >= 28 * 0.5 * 28, `${item.box.width} at ${item.text.fontSize}`);
  // Short labels and lists are not paragraphs: three of them keep three columns.
  const labels = composeSlide({ title: 'T', blocks: [{ text: 'Start with a baseline.' }, { text: 'Keep the scope to one workflow.' }, { text: 'Review feedback every week.' }] });
  assert.equal(new Set(labels.items.filter((item) => item.field === 'text' && item.path.includes('blocks')).map((item) => Math.round(item.box.y))).size, 1);
  const list = { items: ['Agree on the owner for healthcare operations.', 'Confirm the reporting cadence.', 'Return with the first progress readout.'] };
  const lists = composeSlide({ title: 'T', blocks: [list, list, list] });
  assert.equal(new Set(lists.items.filter((item) => item.field === 'items').map((item) => Math.round(item.box.y))).size, 1);
});
