import assert from 'node:assert/strict';
import {colorContrast} from '@openpresentation/opf/composition';
import {resolvePresentation, toSvg} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot, as a host does
// WI-5 (data readability): what the preview draws for the table, chart and metric rules core and the PPTX export share.
// Default navy deck (cool-horizon, accent1 #2874A6): metric value and chart series 1 reach 4.5:1 (3.42:1 before D3); a table has horizontal rules
// only; a chart panel has no outer frame and few, wide intervals.
const attrsOf = text => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(match => attrsOf(match[1]));
const surfaceOf = deck => { const design = resolvePresentation(deck).slides[0].design; return {background: design.backgroundColor ?? design.colors.background, surface: design.colors.surface, primary: design.colors.primary}; };

// --- Metric value (P18, D3)
{
  const deck = {slides: [{title: 'Task completion', metric: {value: '84%', label: 'Task completion'}}]};
  const {background, primary} = surfaceOf(deck);
  assert.equal(primary.toUpperCase(), '#2874A6', 'the default palette is kept');
  assert.ok(colorContrast(primary, background) < 4.5, 'the palette colour alone is below 4.5:1');
  const svg = toSvg(deck, 1, {trace: true});
  const value = [...svg.matchAll(/<text\b([^>]*data-opf-metric-role="value"[^>]*)>/g)].map(match => attrsOf(match[1]));
  assert.ok(value.length > 0);
  for (const text of value) assert.ok(colorContrast(text.fill, background) >= 4.5, `metric value ${text.fill} on ${background}: ${colorContrast(text.fill, background)}`);
  const label = [...svg.matchAll(/<text\b([^>]*data-opf-metric-role="label"[^>]*)>/g)].map(match => attrsOf(match[1]))[0];
  assert.notEqual(label.fill.toUpperCase(), value[0].fill.toUpperCase(), 'only the value is lifted');
}
// A light surface keeps the palette colour.
{
  const deck = {design: {background: '#FFFFFF'}, slides: [{title: 'Task completion', metric: {value: '84%', label: 'Task completion'}}]};
  const {primary} = surfaceOf(deck);
  const svg = toSvg(deck, 1, {trace: true});
  const value = [...svg.matchAll(/<text\b([^>]*data-opf-metric-role="value"[^>]*)>/g)].map(match => attrsOf(match[1]));
  assert.ok(value.every(text => text.fill.toUpperCase() === primary.toUpperCase()));
}

// --- Table rules (P20)
{
  const table = {columns: ['Measure', 'Baseline', 'Pilot'], rows: [['Task completion', '68%', '84%'], ['Median review (h)', 44, 19], ['Escalation rate', '11%', '6%']]};
  const svg = toSvg({slides: [{title: 'Table', table}]}, 1, {trace: true});
  const lines = tags(svg, 'line').filter(line => /table/.test(line['data-opf-path'] ?? ''));
  assert.ok(lines.length > 0);
  assert.ok(lines.every(line => line.y1 === line.y2), 'no vertical rule by default');
  const ys = new Set(lines.map(line => Number(line.y1).toFixed(2)));
  assert.equal(ys.size, 5, 'a rule over the header and under each of the four rows');
  const cells = tags(svg, 'rect').filter(rect => /^slides\.0\.table\.(columns|rows)\.\d+(\.\d+)?$/.test(rect['data-opf-path'] ?? ''));
  assert.ok(cells.length >= 9 && cells.every(rect => rect.stroke === undefined), 'the cell fills carry no outline');
  // an explicit border still wins, on its own edge
  const explicit = structuredClone(table);
  explicit.rows[0][1] = {value: '68%', style: {borders: {left: {color: '#AA00AA', width: 2}}}};
  const styled = toSvg({slides: [{title: 'Table', table: explicit}]}, 1, {trace: true});
  const vertical = tags(styled, 'line').filter(line => line.x1 === line.x2);
  assert.equal(vertical.length, 1);
  assert.equal(vertical[0].stroke.toLowerCase(), '#aa00aa');
}

// --- Chart frame, intervals and series 1 (P19, P18)
{
  const chart = {type: 'column', data: {columns: ['Week', 'Task completion'], rows: [['1', 68], ['2', 72], ['3', 76], ['4', 84]]}};
  const deck = {slides: [{title: 'The largest gain came in week four', chart}]};
  const {surface} = surfaceOf(deck);
  const svg = toSvg(deck, 1, {trace: true});
  const panel = tags(svg, 'rect').find(rect => rect['data-opf-path'] === 'slides.0.chart');
  assert.ok(panel && panel.fill.toUpperCase() === surface.toUpperCase());
  assert.equal(panel.stroke, undefined, 'no outer frame');
  const gridlines = tags(svg, 'line').filter(line => line.y1 === line.y2 && line['stroke-width'] !== undefined);
  assert.ok(gridlines.length > 0 && gridlines.length <= 9, `${gridlines.length} horizontal lines`);
  // Value-axis tick labels carry the chart's own path (the category labels carry their row's).
  const labels = [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].filter(match => attrsOf(match[1])['data-opf-path'] === 'slides.0.chart').map(match => match[2].replace(/<[^>]*>/g, ''));
  assert.deepEqual(labels, ['0', '20', '40', '60', '80', '100'], 'a 0 to 100 axis in steps of 20, not 0 to 90 in tens');
  const bars = tags(svg, 'rect').filter(rect => /^slides\.0\.chart\.data\.rows\.\d+\.1$/.test(rect['data-opf-path'] ?? ''));
  assert.equal(bars.length, 4);
  for (const bar of bars) assert.ok(colorContrast(bar.fill, surface) >= 4.5, `series 1 ${bar.fill} on ${surface}: ${colorContrast(bar.fill, surface)}`);
  // an explicit colour is untouched
  const explicit = toSvg({slides: [{title: 'Chart', chart: {...chart, colors: ['#2874A6']}}]}, 1, {trace: true});
  const explicitBars = tags(explicit, 'rect').filter(rect => /^slides\.0\.chart\.data\.rows\.\d+\.1$/.test(rect['data-opf-path'] ?? ''));
  assert.ok(explicitBars.every(bar => bar.fill.toUpperCase() === '#2874A6'));
}
console.log('Data readability passed: metric value 4.5:1 on the default navy, horizontal table rules, no chart frame, five intervals and series 1 at 4.5:1.');
