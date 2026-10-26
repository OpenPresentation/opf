import assert from 'node:assert/strict';
import {chartPaletteForFill, chartSeriesPalette, chartTextSize, chartValueAxis, resolveChartData} from '@openpresentation/opf/composition';
import {resolvePresentation, toSvg} from './catalog-harness.mjs';

// RR-89, RR-90 and RR-92: the preview draws what core composes. Series colours are core's chartSeriesPalette of the deck's
// colour scheme (not a copy of the cool-horizon accents), the value axis is the one core composed for the chart box, and the
// chart text is core's chartTextSize.
const scheme = {id: 'forest', dark1: '#10231A', light1: '#F5F7F2', dark2: '#2B3A33', light2: '#E6ECE3', accent1: '#B45309', accent2: '#7C2D12', accent3: '#0F766E', accent4: '#6D28D9', accent5: '#BE185D', accent6: '#4D7C0F', hyperlink: '#B45309', followedHyperlink: '#6D28D9'};
const data = {columns: ['Quarter', 'North', 'South', 'West'], rows: [['Q1', 320, 210, 150], ['Q2', 410, 260, 190], ['Q3', 520, 330, 240], ['Q4', 780, 450, 310]]};
const deck = (chart, colorScheme) => ({...(colorScheme ? {design: {colorScheme}} : {}), slides: [{title: 'Chart', chart}]});
const attrs = (svg, tag, path) => [...svg.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))].map(([, a]) => Object.fromEntries([...a.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]))).filter((a) => path.test(a['data-opf-path'] ?? ''));

// Series follow the colour scheme: a deck with its own accents draws them, and the cool-horizon default is no longer fixed.
for (const type of ['column', 'bar', 'line', 'area']) {
  const input = deck({type, data}, scheme), bound = resolvePresentation(input).slides[0];
  // WI-5: series 1 from the scheme reaches 4.5:1 on a dark panel (legibleLead), as the preview draws it.
  const expected = chartPaletteForFill(bound.design.colors.surface, chartSeriesPalette(bound.design.colorScheme), {legibleLead: true}).slice(0, 3);
  const svg = toSvg(input, 1, {trace: true});
  const marks = attrs(svg, type === 'line' ? 'polyline' : type === 'area' ? 'path' : 'rect', /\.chart\.data\./);
  const colors = new Set(marks.map((a) => (a.fill !== 'none' && a.fill !== undefined ? a.fill : a.stroke).toUpperCase()));
  for (const color of expected) assert.ok(colors.has(color.toUpperCase()), `${type}: ${color} is drawn, got ${[...colors]}`);
  assert.ok(!colors.has('#2874A6'), `${type}: the cool-horizon series 1 colour is not drawn on a forest deck`);
}

// On a card that already contrasts with them the accents are drawn as the scheme names them, in order.
{
  const light = {...scheme, dark1: '#0F172A', light1: '#0F172A', dark2: '#F8FAFC', light2: '#F8FAFC'};
  const input = {design: {background: '#FFFFFF', colorScheme: light}, slides: [{title: 'Chart', chart: {type: 'column', data}}]};
  const svg = toSvg(input, 1, {trace: true});
  const fills = new Map(attrs(svg, 'rect', /\.chart\.data\.rows\.\d+\.(\d)$/).map((a) => [Number(a['data-opf-path'].split('.').at(-1)), a.fill.toUpperCase()]));
  assert.deepEqual([...fills.entries()].sort((x, y) => x[0] - y[0]).map(([, fill]) => fill), chartPaletteForFill('#F8FAFC', chartSeriesPalette(light)).slice(0, 3).map((color) => color.toUpperCase()));
  assert.equal(fills.get(1), '#B45309', 'series 1 is accent1');
  assert.equal(fills.get(3), '#0F766E', 'series 3 is accent3');
}

// chart.colors (core RR-89 follow-up): entry i replaces palette colour i before the contrast adjustment; a scheme slot follows the
// deck's colour scheme; highlight wins; a chart without colors draws the same bytes as before.
{
  const light = {...scheme, dark1: '#0F172A', light1: '#0F172A', dark2: '#F8FAFC', light2: '#F8FAFC'};
  const render = (chart, colorScheme = light) => toSvg({design: {background: '#FFFFFF', colorScheme}, slides: [{title: 'Chart', chart}]}, 1, {trace: true});
  const fillsOf = (svg) => {
    const byColumn = new Map(attrs(svg, 'rect', /\.chart\.data\.rows\.\d+\.(\d)$/).map((a) => [Number(a['data-opf-path'].split('.').at(-1)), a.fill.toUpperCase()]));
    return [...byColumn.entries()].sort((x, y) => x[0] - y[0]).map(([, fill]) => fill);
  };
  const expected = (colors, colorScheme = light) => chartPaletteForFill('#F8FAFC', chartSeriesPalette(colorScheme, colors, {})).slice(0, 3).map((color) => color.toUpperCase());
  const colors = ['accent3', '#7B241C'];
  const fills = fillsOf(render({type: 'column', data, colors}));
  assert.deepEqual(fills, expected(colors), 'colors replace series 1 and 2, series 3 keeps the scheme colour');
  assert.equal(fills[0], '#0F766E', 'accent3 of the scheme');
  assert.equal(fills[1], '#7B241C');
  assert.equal(fills[2], expected(undefined)[2]);
  const recolored = {...light, accent3: '#1D4ED8'};
  assert.equal(fillsOf(render({type: 'column', data, colors}, recolored))[0], '#1D4ED8', 'a scheme slot follows a changed colour scheme');
  const highlighted = fillsOf(render({type: 'column', data, colors, highlight: {series: ['North']}}));
  assert.deepEqual(highlighted, fillsOf(render({type: 'column', data, highlight: {series: ['North']}})), 'highlight overrides colors');
  assert.equal(render({type: 'column', data}), render({type: 'column', data, colors: undefined}), 'no colors draws the same bytes');
  assert.deepEqual(fillsOf(render({type: 'column', data, colors: ['var:unknown-color']})), expected(undefined), 'an entry that does not resolve keeps the scheme colour of its position');
  const pie = render({type: 'pie', data: {columns: ['Region', 'Share'], rows: [['North', 45], ['South', 30], ['West', 25]]}, colors: ['#7B241C']});
  assert.ok(attrs(pie, 'path', /\.chart\.data\.rows\.0\./).concat(attrs(pie, 'path', /\.chart\.data/)).some((a) => (a.fill ?? '').toUpperCase() === expected(['#7B241C'])[0]), 'a pie slice takes its entry');
}

// A deck without a colour scheme of its own keeps the engine default's accents, so existing decks draw the colours they always did.
{
  const bound = resolvePresentation(deck({type: 'column', data})).slides[0];
  const palette = chartSeriesPalette(bound.design.colorScheme);
  assert.equal(palette.length, 12);
  assert.equal(palette[0].toUpperCase(), '#2874A6');
}

// The value axis is core's: the gridline labels are min, min + majorUnit, ... max of chartValueAxis for the chart's box, in a tall
// box and in a short one (fewer, larger intervals).
{
  const chart = {type: 'column', data: {columns: ['Quarter', 'Revenue'], rows: [['Q1', 120], ['Q2', 480], ['Q3', 760], ['Q4', 310]]}};
  const ticksOf = (input, path) => {
    const svg = toSvg(input, 1, {trace: true});
    const frame = attrs(svg, 'rect', new RegExp(`^${path.replaceAll('.', '\\.')}$`))[0];
    const labels = attrs(svg, 'text', new RegExp(`^${path.replaceAll('.', '\\.')}$`));
    const texts = [...svg.matchAll(new RegExp(`<text\\b[^>]*data-opf-path="${path}"[^>]*>([\\s\\S]*?)</text>`, 'g'))].map(([, body]) => body.replace(/<[^>]+>/g, '').trim());
    assert.ok(frame && labels.length, path);
    return {box: {width: Number(frame.width), height: Number(frame.height)}, ticks: texts.filter((label) => /^\d+$/.test(label)).map(Number)};
  };
  const cases = [[deck(chart), 'slides.0.chart'], [{slides: [{title: 'Two', blocks: [{chart}, {chart: {...chart, type: 'line'}}]}]}, 'slides.0.blocks.0.chart']];
  const steps = [];
  for (const [input, path] of cases) {
    const {box, ticks} = ticksOf(input, path);
    const axis = chartValueAxis(chart, resolveChartData(chart), {...box, scale: 1, minFontSize: 16});
    assert.ok(axis && ticks.length >= 2, path);
    assert.deepEqual(ticks, Array.from({length: Math.round((axis.max - axis.min) / axis.majorUnit) + 1}, (_, i) => axis.min + i * axis.majorUnit), `${path}: the preview draws core's axis ${JSON.stringify(axis)}`);
    steps.push(axis.majorUnit);
  }
  assert.ok(steps[1] >= steps[0], 'the narrower box has no finer axis');
}

// The chart text size is core's chartTextSize: 20 px in a roomy box, smaller only for a small box, never under minFontSize.
{
  assert.equal(chartTextSize({width: 1200, height: 500, scale: 1}), 20);
  assert.equal(chartTextSize({width: 560, height: 500, scale: 1}), 18);
  assert.equal(chartTextSize({width: 300, height: 200, scale: 1}), 16);
  assert.equal(chartTextSize({width: 300, height: 200, scale: 1, minFontSize: 18}), 18);
  // The preview asks for that size: the tick labels of a roomy chart are 20 px, of a small one the floor.
  const fontSizes = (svg) => new Set(attrs(svg, 'text', /^slides\.0\.chart\./).map((a) => Number(a['font-size'])));
  assert.deepEqual([...fontSizes(toSvg(deck({type: 'column', data}), 1, {trace: true}))], [20]);
  const small = {slides: [{title: 'Two', blocks: [{chart: {type: 'column', data}}, {chart: {type: 'line', data}}]}]};
  assert.ok([...fontSizes(toSvg(small, 1, {trace: true}))].every((size) => size >= 16 && size <= 20));
}

console.log('Chart scheme palette passed: series colours follow the colour scheme, the value axis and text size are core\'s.');
