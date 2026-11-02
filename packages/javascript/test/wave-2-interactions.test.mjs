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

test('LH-90 with LH-83: every page of a continued slide composes alike, recomposed at the floor or on the layout', async () => {
  const { gallery } = await import('@openpresentation/gallery');
  const { continueOverfull, resolveSlideContext } = await import('../dist/index.js');
  for (const [id, units] of [['agenda-split', [3, 3]], ['process', [3, 3]]]) {
    const slide = { ...sampleSlide(layouts[id], 6, 'long'), layout: id };
    const result = continueOverfull({ slides: [slide] }, { catalogs: [gallery] });
    assert.deepEqual(result.continued.map((entry) => entry.units), [units], id);
    // A continued page is bound by the layout as the first page is: no region pin keeps a later page from recomposing (explicit
    // pagination pins a moved block to its region; a whole-block page does not), so both pages of the agendas recompose and fit.
    const pages = result.presentation.slides.map((page, index) => { const context = resolveSlideContext(result.presentation, index, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); });
    assert.ok(result.presentation.slides.every((page) => page.blocks.every((block) => block.region === undefined)), `${id}: no pins`);
    assert.deepEqual(pages.map((page) => overflow(page).length), [0, 0], `${id}: every page fits`);
    assert.equal(new Set(pages.map((page) => Boolean(page.recomposed))).size, 1, `${id}: the pages compose alike`);
  }
});

// Wave 3 (LH-70, LH-67, LH-72, LH-78) where they meet wave 2's grouping (LH-46), sibling sizes (LH-43) and recomposition (LH-83).
const paragraph = (name) => `${name} should focus the next cycle on one measurable change while making the operating tradeoffs clear to its stakeholders.`;

test('LH-70 with LH-46: a statement of similar paragraphs is a grid of columns, not a lead over cards, in both directions', () => {
  // Six paragraphs: two columns at the size the statement's lead plus cards had, so the guard keeps them.
  const slide = sampleSlide(layouts.statement, 6, 'long');
  for (const direction of [undefined, 'rtl']) {
    const result = composeSlide(slide, { layout: layouts.statement, ...(direction ? { direction } : {}) });
    assert.deepEqual(overflow(result), []);
    const texts = result.items.filter((item) => item.field === 'text');
    assert.equal(new Set(texts.map((item) => Math.round(item.box.width))).size, 1, 'equal columns: no lead');
    assert.equal(new Set(texts.map((item) => item.text.fontSize)).size, 1, 'one size (LH-43)');
    assert.ok(texts.every((item) => item.alignment === 'left'), 'long text in a centered layout is start-aligned (LH-72)');
  }
});

test('LH-67 with LH-43: the lead keeps its larger size while the stack shares one', () => {
  const slide = { title: 'Signal trend', blocks: [{ text: paragraph('Ironwood Devices') }, { text: 'The deck-level language can be a catalog id.' }, { text: 'The new checklist reached both teams.' }] };
  const [lead, ...stack] = composeSlide(slide, {}).items.filter((item) => item.field === 'text');
  assert.ok(lead.text.fontSize > stack[0].text.fontSize);
  assert.equal(stack[0].text.fontSize, stack[1].text.fontSize);
});

test('LH-78 with LH-43: quotes of one grid share one size', () => {
  const quote = (text) => ({ quote: { text, attribution: 'Working group' } });
  const result = composeSlide({ title: 'Voices', blocks: [quote('Teams already know where the friction is; the deck makes the sequence of choices explicit to everyone.'), quote('The path is workable if we keep the metric simple.'), quote('The decision owner stays visible to the board.')] }, { layout: layouts.quote });
  assert.deepEqual(overflow(result), []);
  assert.ok(result.regions, 'the layout is kept');
  assert.equal(new Set(result.items.filter((item) => item.quoteLayout).map((item) => item.quoteLayout.parts[0].fit.fontSize)).size, 1);
});

test('LH-06 with LH-43 and LH-58: a foot band is no sibling of the blocks above it, which still share one size', () => {
  const text = (name, more = '') => ({ text: `${name} should focus the next cycle on secure funding for hands-on robotics and chemistry labs${more}.` });
  const slide = { title: 'Demo moment', blocks: [text('Prairie Ridge'), text('Canyon Unified'), text('Morrow Labs'), { text: 'Next step: name the pilot lead.' }] };
  for (const direction of ['ltr', 'rtl']) for (const layout of [undefined, layouts.pillars]) {
    const result = composeSlide(slide, { direction, ...(layout ? { layout } : {}) });
    assert.equal(result.emphasis?.shape, 'band');
    const above = result.items.filter((item) => item.field === 'text' && !item.emphasis);
    assert.equal(new Set(above.map((item) => item.text.fontSize)).size, 1, 'the blocks above share one size');
    assert.deepEqual(overflow(result), []);
    // The band costs no block its size (LH-06's guard): the blocks above keep the size they have without it.
    const plain = composeSlide({ ...slide, blocks: slide.blocks.map((block, index) => (index === 3 ? { ...block, emphasis: false } : block)) }, { direction, ...(layout ? { layout } : {}) });
    for (const item of above) assert.ok(item.text.fontSize >= plain.items.find((entry) => entry.path === item.path).text.fontSize - 1e-6, item.path);
  }
});

test('LH-71 and LH-52 with LH-44: a table that wraps beside its text goes full width above it, and the pair is centered', () => {
  const table = { table: { columns: ['Workstream', 'Owner', 'Status', 'Decision'], rows: [['Community college', 'Program lead', 'At risk', 'Continue'], ['Data and reporting', 'Analytics', 'On track', 'Tighten metric definitions'], ['Field adoption', 'Operations', 'Watch', 'Add weekly office hours']] } };
  const text = { text: 'Metro Technical College should focus the next cycle on connecting employer demand to short-cycle training capacity while making the operating tradeoffs clear.' };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Execution timeline', blocks: [table, text] }, { direction, explain: true });
    assert.deepEqual(overflow(result), []);
    const grid = result.items.find((item) => item.field === 'table'), note = result.items.find((item) => item.field === 'text');
    // LH-44's row would give the table 65% of the width and wrap its cells; the column shows every cell on one line.
    assert.equal(result.explanation.decisions[0].reason, 'split-fill');
    assert.ok(Math.abs(grid.box.width - result.contentBox.width) < 1);
    // The table keeps its rows' height (no spare height), so the text follows it.
    assert.ok(note.box.y - (grid.box.y + grid.box.height) < 40);
  }
});

test('LH-86 with LH-43 and LH-46: long rows joined into one region share its height at one size', () => {
  const paragraph = (name) => ({ text: `${name} should focus the next cycle on preparing supplier data collection for annual reporting while making the operating tradeoffs clear to its stakeholders.` });
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Scope 3 reporting readiness', blocks: ['Lumina Foods', 'Cedarwell Properties', 'Brightpath Analytics', 'North Pier Advisory', 'RheinWorks Mobility'].map(paragraph) }, { layout: layouts['two-column'], direction });
    assert.deepEqual(overflow(result), []);
    const texts = result.items.filter((item) => item.field === 'text');
    assert.equal(texts.length, 5);
    assert.equal(new Set(texts.map((item) => item.text.fontSize)).size, 1);
    const region = result.regions.find((entry) => entry.arrangement === 'column').box;
    assert.ok(Math.abs(texts[0].frameBox.y - region.y) < 1 && Math.abs(texts[4].frameBox.y + texts[4].frameBox.height - region.y - region.height) < 1);
  }
});

test('LH-49 with LH-58: a layout that squeezes chart and text pairs is composed as the automatic pairs, each chart above its text', () => {
  // chart-beside with three long chart and text pairs stacks them in rows of 140 px: plots of a few pixels.
  const slide = sampleSlide(layouts['chart-beside'], 6, 'long');
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide(slide, { layout: layouts['chart-beside'], direction });
    assert.ok(result.recomposed?.chart, `${direction}: recomposed for the short plots`);
    assert.ok(result.recomposed.chart.plot > result.recomposed.chart.layoutPlot);
    const charts = result.items.filter((item) => item.field === 'chart'), texts = result.items.filter((item) => item.field === 'text' && item.path.includes('blocks'));
    assert.equal(new Set(charts.map((item) => Math.round(item.box.y))).size, 1, `${direction}: the charts share one row`);
    for (const [index, item] of charts.entries()) assert.ok(Math.abs(texts[index].box.x - item.box.x) < 1 && texts[index].box.y > item.box.y, `${direction}: pair ${index} is one column`);
    const first = charts[0].box.x, last = charts.at(-1).box.x;
    assert.ok(direction === 'rtl' ? first > last : first < last, `${direction}: reading order`);
    assert.deepEqual(overflow(result), []);
  }
});
