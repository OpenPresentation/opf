// The rules where two layout-harvest features meet: wave 2 (packages/render/test/golden/notes/LH-wave-2.md) and wave 3 (LH-wave-3.md).
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

test('LH-48 with LH-43 and LH-64: an under-filled row of cards grows at one size, the cards hug it and the row sits in the middle', () => {
  const blocks = [{ text: 'Waypoint Apps should move repetitive questions into self-service without hurting satisfaction.' }, { text: 'This fixture keeps identity metadata separate from slide content.' }];
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Decision options', blocks }, { layout: layouts['three-column'], direction });
    const kept = composeSlide({ title: 'Decision options', blocks }, { layout: layouts['three-column'], direction, fill: false });
    const cards = result.items.filter((item) => item.frameBox), sizes = cards.map((item) => item.text.fontSize);
    assert.deepEqual(overflow(result), []);
    assert.equal(cards.length, 2);
    assert.equal(new Set(sizes).size, 1, `${direction}: one size (LH-43)`);
    assert.ok(sizes[0] > kept.items.find((item) => item.frameBox).text.fontSize, `${direction}: grown`);
    assert.equal(new Set(cards.map((item) => item.frameBox.height)).size, 1, `${direction}: one card height (LH-64)`);
    const title = result.items.find((item) => item.field === 'title').box, end = result.contentBox.y + result.contentBox.height;
    const card = cards[0].frameBox, above = card.y - (title.y + title.height), below = end - (card.y + card.height);
    assert.ok(Math.abs(above - below) < 30, `${direction}: centered (${above} above, ${below} below)`);
  }
});

// Wave 3 integration: the combined rules (packages/render/test/golden/notes/LH-wave-3.md).
const longText = (name) => ({ text: `${name} should focus the next cycle on one measurable change while making the operating tradeoffs clear to every stakeholder and owner.` });
const bodySizes = (result) => new Map(result.items.filter((item) => !['title', 'subtitle', 'tag'].includes(item.field)).flatMap((item) => {
  const internal = item.quoteLayout ?? item.codeLayout ?? item.metricLayout ?? item.timelineLayout;
  return internal ? internal.parts.filter((part) => part.visible !== false && part.fit && ['body', 'value', 'label', 'what'].includes(part.role)).map((part) => [`${item.path}#${part.role}`, part.fit.fontSize]) : item.text ? [[item.path, item.text.fontSize]] : [];
}));

test('wave 3 guard: no rule sets a block smaller than the slide without the wave 3 rules, in both directions', () => {
  // A quote beside a metric (LH-78), long text in a centered statement (LH-72), two short texts in three columns (LH-65, LH-48) and a
  // short takeaway after long text (LH-06): each slide is compared with itself composed with `fill: false` and no automatic band, the
  // nearest public form of wave 2. A rule may only be kept where no block is smaller.
  const quote = { quote: { text: 'The path is workable if we keep the metric simple and the decision owner visible.', attribution: 'Working group' } };
  const slides = [
    [{ title: 'Signal', blocks: [{ metric: { value: '31%', label: 'Signal' } }, quote] }, {}],
    [{ title: 'Statement', blocks: [longText('Northwind'), longText('Contoso')] }, { layout: layouts.statement }],
    [{ title: 'Options', blocks: [longText('Northwind'), { text: 'Keep it short.' }] }, {}],
  ];
  for (const direction of ['ltr', 'rtl']) for (const [slide, options] of slides) {
    const result = composeSlide(slide, { ...options, direction }), plain = composeSlide({ ...slide, blocks: slide.blocks.map((block) => ({ ...block, emphasis: false })) }, { ...options, direction, fill: false });
    assert.deepEqual(overflow(result), [], slide.title);
    for (const [key, size] of bodySizes(plain)) assert.ok((bodySizes(result).get(key) ?? Infinity) >= size - 1e-6, `${direction} ${slide.title}: ${key} keeps ${size}`);
  }
});

test('LH-52 with LH-78: a quote beside another block in a centered split takes its card and sits in the middle of its cell', () => {
  const quote = { quote: { text: 'The path is workable if we keep the metric simple and the decision owner visible.', attribution: 'Working group' } };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Signal', blocks: [{ metric: { value: '31%', label: 'Signal' } }, quote] }, { direction });
    const said = result.items.find((item) => item.field === 'quote'), metric = result.items.find((item) => item.field === 'metric');
    assert.ok(said.frameBox, `${direction}: the quote has its card`);
    const middle = (box) => box.y + box.height / 2;
    assert.ok(Math.abs(middle(said.frameBox) - middle(metric.box)) < 30, `${direction}: the card is in the middle like the metric`);
    assert.deepEqual(overflow(result), []);
  }
});

test('LH-52 with LH-70 and LH-67: paragraph columns and a lead plus stack keep their own cells; LH-48 does not grow them', () => {
  const lead = { text: `${longText('Ironwood Devices').text} ${longText('Ironwood Devices').text}` };
  const result = composeSlide({ title: 'Signal trend', blocks: [lead, { text: 'The deck-level language can be a catalog id.' }, { text: 'The new checklist reached both teams.' }] }, { explain: true });
  assert.equal(result.explanation.decisions[0].reason, 'lead-stack');
  const [first, ...stack] = result.items.filter((item) => item.field === 'text');
  assert.ok(first.box.height > stack[0].box.height, 'the lead keeps its full-height cell');
  assert.equal(stack[0].text.fontSize, stack[1].text.fontSize, 'the stack shares one size');
});

test('LH-86 with LH-70 and LH-06: long texts moved into one region stay rows; a short last text is the foot band below them', () => {
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Decision options', blocks: [longText('Evergreen CRM'), longText('Asteria Robotics'), longText('Lumina Foods'), { text: 'Decide by Friday.' }] }, { layout: layouts['three-column'], direction });
    assert.deepEqual(overflow(result), []);
    const texts = result.items.filter((item) => item.field === 'text' && !item.emphasis);
    assert.equal(texts.length, 3);
    assert.ok(texts.every((item, index) => index === 0 || item.frameBox.y > texts[index - 1].frameBox.y), `${direction}: one card per row, in reading order`);
    assert.equal(new Set(texts.map((item) => Math.round(item.frameBox.width))).size, 1, `${direction}: rows across the region`);
    assert.equal(result.emphasis?.shape, 'band', `${direction}: the short text is the band`);
    assert.ok(result.emphasis.box.y >= Math.max(...texts.map((item) => item.frameBox.y + item.frameBox.height)), `${direction}: below the rows`);
  }
});

test('LH-71 with LH-49 and LH-80: a split that stacks a chart above a takeaway gives it the filling track; a picture keeps the rules that read well beside it', () => {
  const chart = { chart: { type: 'line', data: { columns: ['Month', 'Minutes'], rows: [['Apr', 44], ['May', 39], ['Jun', 33], ['Jul', 29], ['Aug', 24], ['Sep', 19]] } } };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'T', blocks: [chart, { text: 'Median review time fell 57% between April and September.', emphasis: false }] }, { direction });
    assert.equal(result.track?.kind, 'chart', direction);
    assert.equal(result.track.edge, direction === 'rtl' ? 'right' : 'left');
  }
});

test('LH-93 with LH-49: charts a template slide is recomposed for share one plot height', () => {
  const result = composeSlide({ ...sampleSlide(layouts['chart-beside'], 3, 'long') }, { layout: layouts['chart-beside'] });
  const charts = result.items.filter((item) => item.field === 'chart');
  assert.ok(result.recomposed?.chart && charts.length > 1 && charts.every((item) => item.chart.layer?.plot), 'recomposed for its charts, each with a shared plot');
  {
    const heights = charts.map((item) => item.box.height - item.chart.layer.plot.top - item.chart.layer.plot.bottom);
    const rows = new Map();
    charts.forEach((item, index) => { rows.set(Math.round(item.box.y), [...(rows.get(Math.round(item.box.y)) ?? []), heights[index]]); });
    for (const row of rows.values()) assert.ok(Math.max(...row) - Math.min(...row) < 1e-6, 'one plot height per row');
  }
  assert.deepEqual(overflow(result), []);
});

test('LH-80 with reading order: a picture track keeps the blocks in reading order, in both directions', () => {
  const picture = { image: `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#3f8a55"/></svg>').toString('base64')}` };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide({ title: 'Signal', blocks: [longText('Northwind'), picture] }, { direction });
    assert.equal(result.track?.kind, 'picture', direction);
    const order = result.items.filter((item) => !['title', 'subtitle', 'tag'].includes(item.field)).map((item) => item.path);
    assert.deepEqual(order, ['slides.0.blocks.0.text', 'slides.0.blocks.1.image'], `${direction}: the text is read before the picture after it`);
  }
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

test('LH-48 with LH-86: long texts drawn as full-width rows grow together when the body is under half full, and keep their rows', () => {
  const text = (name) => ({ text: `${name} should focus the next cycle on move repetitive questions into self-service without hurting satisfaction.` });
  const slide = { title: 'Decision options', blocks: [text('Waypoint Apps'), text('Northwind Health')] };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide(slide, { layout: layouts['three-column'], direction }), plain = composeSlide(slide, { layout: layouts['three-column'], direction, fill: false });
    const rows = result.items.filter((item) => item.field === 'text'), before = plain.items.filter((item) => item.field === 'text');
    assert.deepEqual(overflow(result), []);
    assert.equal(new Set(rows.map((item) => item.text.fontSize)).size, 1, `${direction}: one size (LH-43)`);
    assert.ok(rows[0].text.fontSize > before[0].text.fontSize, `${direction}: grown (${before[0].text.fontSize} -> ${rows[0].text.fontSize})`);
    assert.ok(rows[1].frameBox.y > rows[0].frameBox.y + rows[0].frameBox.height - 1e-6, `${direction}: still one card per row`);
    assert.ok(Math.abs(rows[0].frameBox.width - rows[1].frameBox.width) < 1e-6 && rows[0].frameBox.width > result.contentBox.width * 0.9, `${direction}: across the region`);
  }
});
