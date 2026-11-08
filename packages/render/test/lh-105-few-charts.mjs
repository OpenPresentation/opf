// LH-105: chart defaults that follow Stephen Few, in the preview. Composition decides them (core chart-focus.ts, chart-direct-labels.ts,
// chart-time-order.ts, softenChartPalette); this asserts what the preview draws from them.
import assert from 'node:assert/strict';
import { chartContextColors, chartPaletteForFill, chartSeriesLabelColor, chartSeriesPalette, colorContrast, textColorForFill } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, a]) => attributesOf(a));
const texts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, a, body]) => ({ ...attributesOf(a), body: body.replace(/<[^>]*>/g, '') }));
const deck = (slide, design = {}) => ({ design: { fontScheme: 'roboto', ...design }, slides: [slide] });
const designOf = (input) => resolvePresentation(input).slides[0].design;
const backdropOf = (input) => { const design = designOf(input); return design.backgroundColor ?? design.colors.background; };
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let checks = 0;

// 1. No panel on any chart; the series are the scheme accents softened towards the backdrop.
for (const design of [{}, { theme: 'classic', variant: 'dark1' }]) {
  const input = deck({ title: 'Two regions', chart: { type: 'column', dataLabels: false, data: { columns: ['Month', 'North', 'South'], rows: months.slice(0, 10).map((month, i) => [month, 20 + i, 10 + i]) } } }, design);
  const svg = toSvg(input, 1, { trace: true });
  assert.equal(tags(svg, 'rect').find((rect) => rect['data-opf-path'] === 'slides.0.chart'), undefined, 'no chart panel');
  const backdrop = backdropOf(input), scheme = designOf(input);
  const soft = chartSeriesPalette(scheme.colorScheme, undefined, { accents: scheme.roles.map.accents });
  const expected = chartPaletteForFill(backdrop, soft, { legible: Array(12).fill(true), soften: true }).slice(0, 2).map((color) => color.toUpperCase());
  const fills = [1, 2].map((column) => tags(svg, 'rect').find((rect) => rect['data-opf-path'] === `slides.0.chart.data.rows.0.${column}`).fill.toUpperCase());
  assert.deepEqual(fills, expected, 'the soft series colours');
  for (const fill of fills) assert.ok(colorContrast(fill, backdrop) >= 3, `${fill} on ${backdrop}`);
  // At most six value intervals: seven tick labels or fewer.
  const ticks = texts(svg).filter((entry) => entry['data-opf-path'] === 'slides.0.chart' && /^\d+$/.test(entry.body));
  assert.ok(ticks.length >= 2 && ticks.length <= 7, `${ticks.length} ticks`);
  checks += 3;
}

// 2. The title names a category: it keeps its full-strength colour, the other bars take the context neutral (3:1).
{
  const input = deck({ title: 'North America still leads on bookings', chart: { type: 'column', data: { columns: ['Region', 'Bookings'], rows: [['North America', 48.2], ['Europe', 31.5], ['Asia Pacific', 27.9], ['Latin America', 12.4], ['Middle East', 9.1], ['Africa', 6.3]] } } });
  const svg = toSvg(input, 1, { trace: true });
  const backdrop = backdropOf(input), design = designOf(input);
  const strong = chartPaletteForFill(backdrop, chartSeriesPalette(design.colorScheme), { legible: Array(12).fill(true) })[0].toUpperCase();
  // A small chart labels every bar, so the context is the light neutral (1.6:1), apart from the focused colour.
  const context = chartContextColors(backdrop, textColorForFill(backdrop, design.colors.text), 1, { labeled: true, avoid: [strong] })[0].toUpperCase();
  const fills = tags(svg, 'rect').filter((rect) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(rect['data-opf-path'] ?? '')).map((rect) => rect.fill.toUpperCase());
  assert.deepEqual(fills, [strong, context, context, context, context, context]);
  assert.ok(colorContrast(context, backdrop) >= 1.6);
  // Unlabeled context bars keep 3:1; two context series of a stacked chart take two grays. (LH-109: a stacked chart labels its segments
  // and names its series by default, so this one keeps a legend to stay unlabeled.)
  const stacked = toSvg(deck({ title: 'Subscriptions drive the growth', chart: { type: 'stacked-column', legend: 'right', data: { columns: ['Quarter', 'Subscriptions', 'Services', 'Hardware'], rows: [['Q1', 12, 8, 4], ['Q2', 14, 9, 4], ['Q3', 16, 9, 4], ['Q4', 19, 9, 5]] } } }), 1, { trace: true });
  const segment = (column) => tags(stacked, 'rect').find((rect) => rect['data-opf-path'] === `slides.0.chart.data.rows.0.${column}`).fill.toUpperCase();
  assert.equal(segment(1), strong);
  assert.notEqual(segment(2), segment(3), 'the two context segments differ');
  for (const column of [2, 3]) assert.ok(colorContrast(segment(column), backdrop) >= 3, 'unlabeled context at 3:1');
  // An explicit highlight wins over the title.
  const highlighted = toSvg(deck({ ...input.slides[0], chart: { ...input.slides[0].chart, highlight: { categories: ['Europe'] } } }), 1, { trace: true });
  assert.notEqual(tags(highlighted, 'rect').find((rect) => rect['data-opf-path'] === 'slides.0.chart.data.rows.1.1').fill.toUpperCase(), context);
  checks += 3;
}

// 3. Line ends: each series' last value and name in its colour, bold for the series the title names, and no legend.
{
  const input = deck({ title: 'Enterprise satisfaction pulled ahead of mid-market', chart: { type: 'line', data: { columns: ['Quarter', 'Enterprise NPS', 'Mid-market NPS'], rows: ["Q1 '24", "Q2 '24", "Q3 '24", "Q4 '24", "Q1 '25", "Q2 '25", "Q3 '25", "Q4 '25"].map((q, i) => [q, 38 + i * 3, 40 + (i % 3)]) } } });
  const svg = toSvg(input, 1, { trace: true });
  const ends = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.columns\.\d$/.test(entry['data-opf-path'] ?? ''));
  assert.deepEqual(ends.map((entry) => entry.body), ['59 Enterprise NPS', '41 Mid-market NPS']);
  assert.deepEqual(ends.map((entry) => entry['font-weight']), ['700', '400'], 'the named series is bold');
  const backdrop = backdropOf(input);
  for (const entry of ends) assert.ok(colorContrast(entry.fill, backdrop) >= 4.5, `${entry.fill} legible`);
  assert.equal(ends[0].fill.toUpperCase(), chartSeriesLabelColor(backdrop, chartPaletteForFill(backdrop, chartSeriesPalette(designOf(input).colorScheme), { legible: Array(12).fill(true) })[0]).toUpperCase());
  assert.equal(tags(svg, 'polyline').filter((line) => /^slides\.0\.chart\.data\.columns\.\d$/.test(line['data-opf-path'] ?? '')).length, 2, 'two lines, no legend keys');
  // Right to left the names stand at the left of the plot.
  const rtl = toSvg({ ...input, language: 'ar' }, 1, { trace: true });
  const rtlEnds = texts(rtl).filter((entry) => /^slides\.0\.chart\.data\.columns\.\d$/.test(entry['data-opf-path'] ?? ''));
  assert.ok(rtlEnds.length === 2 && rtlEnds.every((entry) => Number(entry.x) < 640), 'at the left');
  checks += 5;
}

// 4. A pie names its slices and draws no legend. (LH-108: in the whole body a pie lists its values
//    beside it instead; beside a text it names its slices.)
{
  const input = deck({ title: 'Budget', composition: { mode: 'row' }, text: 'Engineering takes most of the budget.', chart: { type: 'pie', data: { columns: ['Team', 'Budget'], rows: [['Engineering', 45], ['Sales', 30], ['Marketing', 25]] } } });
  const svg = toSvg(input, 1, { trace: true });
  assert.equal(tags(svg, 'rect').filter((rect) => /^slides\.0\.chart\.data\.rows\.\d\.0$/.test(rect['data-opf-path'] ?? '')).length, 0, 'no legend swatches');
  const names = texts(svg).filter((entry) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(entry['data-opf-path'] ?? '')).map((entry) => entry.body);
  assert.deepEqual(names, ['Engineering', 'Sales', 'Marketing']);
  const explicit = toSvg(deck({ title: 'Budget', chart: { ...input.slides[0].chart, legend: 'right' } }), 1, { trace: true });
  assert.ok(tags(explicit, 'rect').some((rect) => /^slides\.0\.chart\.data\.rows\.\d\.0$/.test(rect['data-opf-path'] ?? '')), 'an explicit legend keeps the legend');
  checks += 3;
}

// 5. Nominal categories have no last-point emphasis; quarters do.
{
  const bars = (rows, column) => {
    const svg = toSvg(deck({ title: 'Chart', chart: { type: 'column', data: { columns: [column, 'Count'], rows } } }), 1, { trace: true });
    return new Set(tags(svg, 'rect').filter((rect) => /^slides\.0\.chart\.data\.rows\.\d\.1$/.test(rect['data-opf-path'] ?? '')).map((rect) => rect.fill)).size;
  };
  assert.equal(bars([['Lead', 42], ['Qualified', 30], ['Proposal', 18], ['Won', 9]], 'Stage'), 1, 'stages: one colour');
  assert.equal(bars([['Q1', 9], ['Q2', 18], ['Q3', 30], ['Q4', 42]], 'Quarter'), 2, 'quarters: the last one emphasised');
  checks += 2;
}

console.log(`LH-105 preview passed: ${checks} checks (no panel, soft colours, six intervals, title focus, line-end labels, pie slice names, emphasis over time).`);
