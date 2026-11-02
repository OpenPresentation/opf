// LH wave 2: the rules the integration added where two wave 2 features meet (packages/render/test/golden/notes/LH-wave-2.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { layouts, sampleSlide } from './support/template-samples.mjs';

const overflow = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const code = (name) => ({ code: { filename: `${name}-inspection-rule.ts`, language: 'ts', source: 'const score = urgency * confidence;\nif (score >= threshold) {\n  routeToSponsor(workstream);\n} else {\n  keepInWeeklyReview(workstream);\n}' } });

test('LH-58 with LH-47: an automatic majority band is measured as the grid it draws, so the row under it keeps its room', () => {
  // Three code panels and two texts interleaved: the panels are a grid above a row of the texts (LH-82). Measured as a stack, the
  // band asked for three panels' height and left the texts at their floor (two small-cell findings and an overflow).
  const slide = { title: 'Signal trend', blocks: [code('video-demo-sales-narrative'), { text: 'Prairie Ridge High School should focus the next cycle on secure funding for hands-on robotics and chemistry labs.' }, code('validator'), { text: 'Keep the recommendation and its evidence together.' }, code('revenue-forecast')] };
  const result = composeSlide(slide, {});
  assert.deepEqual(overflow(result), []);
  const panels = result.items.filter((item) => item.codeLayout), texts = result.items.filter((item) => item.field === 'text');
  assert.equal(new Set(panels.map((item) => Math.round(item.box.y))).size, 1, 'the panels share one row');
  assert.ok(texts.every((item) => item.box.y > Math.max(...panels.map((panel) => panel.box.y + panel.box.height))), 'the texts sit under the panels');
  // Right to left the same row mirrors.
  const rtl = composeSlide(slide, { direction: 'rtl' });
  assert.deepEqual(overflow(rtl), []);
});

test('LH-46 with LH-44: extra tables stay below the grid when joining the fixed region overflows more', () => {
  const table = (first) => ({ table: { columns: ['Workstream', 'Owner', 'Status', 'Decision'], rows: [[first, 'Program lead', 'On track', 'Continue'], ['Data and reporting', 'Analytics', 'Watch', 'Tighten metric definitions'], ['Field adoption', 'Operations', 'At risk', 'Add weekly office hours']] } });
  const slide = { title: 'Advising retention review', blocks: [table('Student success'), { text: 'North Valley State should focus the next cycle on first-year retention through proactive advising.' }, table('Hospitality'), { text: 'First: state the situation.' }, table('Compliance')] };
  const result = composeSlide(slide, { layout: layouts['table-beside'] });
  assert.deepEqual(overflow(result), [], 'no table is squeezed until its words break');
  assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'layout-unplaced').map((entry) => entry.path), ['slides.0.blocks.2', 'slides.0.blocks.4']);
  // Pictures that fit still join (LH-46's mosaic).
  const image = (index) => ({ image: { src: `https://example.com/${index}.png`, alt: `Picture ${index}` } });
  const mosaic = composeSlide({ title: 'Gallery', blocks: [image(1), image(2), image(3), image(4)] }, { layout: layouts.image });
  assert.deepEqual(mosaic.diagnostics.filter((entry) => entry.code === 'layout-unplaced'), []);
});

test('LH-83 with LH-43: a recomposition as large as the layout with less overflow is kept', () => {
  const slide = sampleSlide(layouts['agenda-split'], 3, 'long');
  const kept = composeSlide(slide, { layout: layouts['agenda-split'], recompose: false });
  const result = composeSlide(slide, { layout: layouts['agenda-split'] });
  assert.ok(overflow(kept).length > 0, 'the layout overflows at the floor');
  assert.ok(result.recomposed, 'recomposed');
  assert.ok(result.recomposed.size >= result.recomposed.layoutSize);
  assert.ok(overflow(result).length < overflow(kept).length);
});

test('LH-03 with LH-60: the chart layer is decided for the construct drawn', () => {
  const quarters = { columns: ['Quarter', 'Current', 'Prior'], rows: [['Q1', 4, 3], ['Q2', 5, 4], ['Q3', 6, 5], ['Q4', 7, 5]] };
  const chartOf = (type) => composeSlide({ title: 'Chart', blocks: [{ chart: { type, data: quarters } }] }, {}).items.find((item) => item.field === 'chart').chart;
  const world = chartOf('world'), column = chartOf('column');
  // A world chart over quarters is drawn as clustered columns, so it takes their header row and small-chart labels.
  assert.ok(world.layer?.header?.legend, 'the header legend');
  assert.deepEqual(world.layer, column.layer);
  assert.deepEqual(world.valueAxis, column.valueAxis);
  // A world chart over places is a map: no layer.
  const places = composeSlide({ title: 'Chart', blocks: [{ chart: { type: 'world', data: { columns: ['Country', 'Sales'], rows: [['France', 4], ['Germany', 5], ['Japan', 6]] } } }] }, {}).items.find((item) => item.field === 'chart');
  assert.equal(places.chart?.layer, undefined);
});

test('LH-81 and LH-33 with LH-93: siblings with headers of one and two rows share one plot height', () => {
  // A one-series chart's header is its caption; a two-series chart with a value axis title has a caption and, when they do not fit
  // together, its legend on a second row. Sharing their value axis (LH-33), they also share one plot top, baseline and height.
  const quarters = (names, shift = 0) => ({ columns: ['Quarter', ...names], rows: [['Q1', 40 - shift, 31], ['Q2', 52 - shift, 38], ['Q3', 61 - shift, 44], ['Q4', 73 - shift, 52]].map((row) => row.slice(0, names.length + 1)) });
  const slide = { title: 'Revenue', blocks: [
    { chart: { type: 'line', data: quarters(['Revenue', 'Plan for the fiscal year']), axisTitles: { value: 'Revenue ($M) for every region' } } },
    { chart: { type: 'line', data: quarters(['Revenue', 'Plan for the fiscal year'], 12) } }] };
  const charts = composeSlide(slide, {}).items.filter((item) => item.field === 'chart');
  const plots = charts.map((item) => item.chart.layer.plot && { top: item.box.y + item.chart.layer.plot.top, height: item.box.height - item.chart.layer.plot.top - item.chart.layer.plot.bottom });
  assert.ok(plots.every(Boolean), 'both charts get a plot');
  assert.ok(Math.abs(plots[0].top - plots[1].top) < 1e-6 && Math.abs(plots[0].height - plots[1].height) < 1e-6);
  assert.notEqual(charts[0].chart.layer.header.height, charts[1].chart.layer.header?.height, 'the headers differ');
});

test('LH-105 with LH-93, LH-81 and LH-03: sibling line charts named at their line ends share one plot, and their names follow it', () => {
  // Two line charts of one unit share their value axis and plot (LH-33, LH-93). Each names its series at the line ends instead of a
  // header legend (LH-105); the shared plot moves the line ends, so the names are placed again against it.
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const lines = (shift) => ({ type: 'line', data: { columns: ['Month', 'Plan', 'Actual'], rows: months.map((month, row) => [month, 40 + row * 4 - shift, 38 + row * 6 - shift]) } });
  const slide = { title: 'Two regions', blocks: [{ chart: { ...lines(0), axisTitles: { value: 'Revenue ($M) for every region' } } }, { chart: lines(12) }] };
  const charts = composeSlide(slide, {}).items.filter((item) => item.field === 'chart');
  for (const item of charts) {
    const { layer, valueAxis } = item.chart;
    assert.ok(layer.endLabels, 'named at the line ends');
    assert.equal(layer.header?.legend, undefined, 'no header legend');
    const plotTop = item.box.y + layer.plot.top, plotHeight = item.box.height - layer.plot.top - layer.plot.bottom;
    for (const entry of layer.endLabels.entries) {
      const last = item.value.data.rows.at(-1)[entry.series + 1];
      const y = plotTop + (valueAxis.max - last) / (valueAxis.max - valueAxis.min) * plotHeight;
      assert.ok(Math.abs(entry.point.y - y) < 1e-6, 'the name stands at its line end on the shared plot');
    }
  }
  const [a, b] = charts.map((item) => ({ top: item.box.y + item.chart.layer.plot.top, height: item.box.height - item.chart.layer.plot.top - item.chart.layer.plot.bottom }));
  assert.ok(Math.abs(a.top - b.top) < 1e-6 && Math.abs(a.height - b.height) < 1e-6, 'one plot top and height');
});
