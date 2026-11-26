// FR-07 (CR 5): bands on value axes and the bullet chart: the band list, ranges and colors core hands every engine, the rules, the target
// column and the value axis.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  CHART_BAND_NEUTRAL_CONTRASTS, chartBandDiagnostics, colorContrast, chartBandFill, chartBandMaximum, chartBandRanges, chartBands, chartValueAxis, mixOklab, resolveChartData,
} from '../dist/composition.js';
import { validate } from '../dist/index.js';

const wait = { columns: ['Week', 'Wait'], rows: [['W1', 14], ['W2', 11], ['W3', 9], ['W4', 12]] };
const kpis = { columns: ['KPI', { name: 'Actual', format: '0%' }, { name: 'Target', format: '0%' }], rows: [['Win rate', 0.31, 0.35], ['Retention', 0.92, 0.9], ['NPS', 0.64, null]] };
const geometry = { width: 960, height: 540, scale: 1 };
const findings = (deck) => validate(deck).findings ?? validate(deck).issues ?? [];
const codes = (deck) => findings(deck).map((finding) => `${finding.ruleId ?? finding.code}@${finding.path}`);

describe('band list (FR-07)', () => {
  test('sorted by their end, authored index kept, unknown colors and blank labels dropped', () => {
    const bands = chartBands({ type: 'column', bands: [{ to: 20, label: 'High' }, { to: 10, label: ' ', color: 'accent3' }, { to: 'x' }, { to: 15, color: '#FF0000' }] });
    assert.deepEqual(bands, [{ index: 1, to: 10, color: 'accent3' }, { index: 3, to: 15 }, { index: 0, to: 20, label: 'High' }]);
    assert.equal(chartBandMaximum({ type: 'line', bands: [{ to: 3 }, { to: 9 }] }), 9);
  });
  test('only bar, column, line, area and bullet charts draw bands', () => {
    for (const type of ['column', 'stacked-bar', '100pct-stacked-area', 'line-with-markers', 'bullet']) assert.equal(chartBands({ type, bands: [{ to: 1 }] }).length, 1, type);
    for (const type of ['pie', 'scatter', 'radar', 'combo', 'waterfall', 'treemap']) assert.equal(chartBands({ type, bands: [{ to: 1 }] }).length, 0, type);
  });
  test('ranges run from the previous end (the first from the axis minimum), clamped to the axis', () => {
    const ranges = chartBandRanges(chartBands({ type: 'column', bands: [{ to: -5 }, { to: 4, color: 'accent1' }, { to: 30 }, { to: 50 }] }), { min: 0, max: 40 });
    // -5 lies below the axis: not drawn. 50 is clamped to 40; the neutral count skips the colored band.
    assert.deepEqual(ranges.map(({ from, to, neutral, color }) => [from, to, neutral, color]), [[0, 4, undefined, 'accent1'], [4, 30, 0, undefined], [30, 40, 1, undefined]]);
    assert.deepEqual(chartBandRanges(chartBands({ type: 'column', bands: [{ to: 5 }] }), { min: -10, max: 10 }).map(({ from, to }) => [from, to]), [[-10, 5]], 'the first band starts at a negative minimum');
  });
  test('neutral fills by contrast against the surface (1.75, 1.45, 1.25, then again), a scheme color as a light tint, in OKLab', () => {
    for (const [surface, text] of [['#FFFFFF', '#000000'], ['#000000', '#FFFFFF'], ['#0B1F3A', '#F2F2F2']]) {
      const colors = { surface, text, resolve: (name) => ({ accent3: '#1B9E4B' })[name] ?? '#808080' };
      const fills = [0, 1, 2, 3].map((neutral) => chartBandFill({ neutral }, colors));
      for (const [k, ratio] of CHART_BAND_NEUTRAL_CONTRASTS.entries()) assert.ok(Math.abs(colorContrast(fills[k], surface) - ratio) < 0.02, `${surface} band ${k}: ${colorContrast(fills[k], surface)}`);
      assert.equal(fills[3], fills[0], 'a fourth band starts again');
      assert.equal(chartBandFill({ color: 'accent3' }, colors), mixOklab(surface, '#1B9E4B', 0.25));
    }
  });
});

describe('band and target rules (FR-07)', () => {
  test('unordered bands and bands on a type that does not draw them are warnings', () => {
    assert.deepEqual(chartBandDiagnostics({ type: 'column', bands: [{ to: 20 }, { to: 10 }] }, '/slides/0/chart').map((d) => [d.code, d.severity, d.path]), [['chart-bands-order', 'warning', '/slides/0/chart/bands']]);
    assert.deepEqual(chartBandDiagnostics({ type: 'column', bands: [{ to: 10 }, { to: 10 }] }).map((d) => d.code), ['chart-bands-order'], 'equal ends are not increasing');
    assert.deepEqual(chartBandDiagnostics({ type: 'pie', bands: [{ to: 10 }] }).map((d) => d.code), ['chart-bands-unsupported']);
    assert.match(chartBandDiagnostics({ type: 'pie', bands: [{ to: 10 }] })[0].message, /^This chart type does not draw bands; they are ignored\./);
    assert.match(chartBandDiagnostics({ type: 'line', bands: [{ to: 9 }, { to: 3 }] })[0].message, /^The bands are not in increasing order; they are drawn sorted\./);
    assert.deepEqual(chartBandDiagnostics({ type: 'column', bands: [{ to: 1 }, { to: 2 }] }), []);
  });
  test('validate: an unknown target is an error, a target off a bullet chart, extra measures and text targets are warnings', () => {
    assert.ok(codes({ slides: [{ title: 'KPIs', chart: { type: 'bullet', data: { columns: ['KPI', 'Actual'], rows: [['Win rate', 0.31]] }, mapping: { target: 'Goal' } } }] }).includes('opf/chart-mapping-unknown-column@/slides/0/chart/mapping/target'));
    assert.ok(codes({ slides: [{ title: 'Wait', chart: { type: 'column', data: { columns: ['Week', 'Wait'], rows: [['W1', 14]] }, bands: [] } }] }).includes('opf/schema@/slides/0/chart/bands'));
    assert.ok(codes({ slides: [{ title: 'Wait', chart: { type: 'column', data: wait, bands: [{ to: 1 }, { to: 2 }, { to: 3 }, { to: 4 }, { to: 5 }, { to: 6 }, { to: 7 }] } }] }).includes('opf/schema@/slides/0/chart/bands'), 'over six bands');
    assert.ok(codes({ slides: [{ title: 'Wait', chart: { type: 'column', data: wait, bands: [{ to: 1, color: '#FF0000' }] } }] }).some((entry) => entry.startsWith('opf/schema@/slides/0/chart/bands/0/color')), 'a raw color');
    const warned = codes({ slides: [
      { title: 'A', chart: { type: 'pie', data: wait, bands: [{ to: 3 }] } },
      { title: 'B', chart: { type: 'column', data: { columns: ['Week', 'Wait', 'T'], rows: [['W1', 14, 3]] }, mapping: { target: 'T' }, bands: [{ to: 30 }, { to: 3 }] } },
      { title: 'C', chart: { type: 'bullet', data: { columns: ['Week', 'Wait', 'B', 'T'], rows: [['W1', 14, 2, 'x']] }, mapping: { target: 'T' } } },
    ] });
    for (const expected of ['opf/chart-bands-unsupported@/slides/0/chart/bands', 'opf/chart-mapping-adapted@/slides/1/chart/mapping/target', 'opf/chart-bands-order@/slides/1/chart/bands', 'opf/chart-value-not-numeric@/slides/2/chart/data/rows/0/3', 'opf/chart-series-dropped@/slides/2/chart/type']) assert.ok(warned.includes(expected), expected);
    const severities = Object.fromEntries(findings({ slides: [{ title: 'A', chart: { type: 'pie', data: wait, bands: [{ to: 3 }] } }] }).map((finding) => [finding.ruleId, finding.severity]));
    assert.equal(severities['opf/chart-bands-unsupported'], 'warning');
  });
  test('the note\'s valid deck validates without errors', () => {
    const deck = { name: 'Bands and bullet', datasets: { kpis, wait }, slides: [
      { title: 'KPIs against target', chart: { type: 'bullet', data: { dataset: 'kpis' }, mapping: { category: 'KPI', series: ['Actual'], target: 'Target' }, bands: [{ to: 0.6, label: 'Poor' }, { to: 0.85, label: 'Fair' }, { to: 1, label: 'Good' }] } },
      { title: 'Wait', chart: { type: 'column', data: { dataset: 'wait' }, bands: [{ to: 10, label: 'Within target', color: 'accent3' }, { to: 20, label: 'Over target' }] } },
    ] };
    assert.deepEqual(findings(deck).filter((finding) => finding.severity === 'error'), []);
  });
});

describe('bullet data and the value axis (FR-07)', () => {
  test('the target is not a series; its values are read as numbers, null keeps no tick', () => {
    const resolved = resolveChartData({ type: 'bullet', data: kpis, mapping: { target: 'Target' } });
    assert.deepEqual(resolved.columns, ['KPI', 'Actual']);
    assert.deepEqual(resolved.target, { column: 'Target', format: '0%', values: [0.35, 0.9, null] });
    assert.equal(resolveChartData({ type: 'column', data: kpis, mapping: { target: 'Target' } }).target, undefined, 'only a bullet chart has a target');
    assert.deepEqual(resolveChartData({ type: 'bullet', data: kpis, mapping: { series: ['Actual', 'Target'], target: 'Target' } }).columns, ['KPI', 'Actual'], 'a mapped series that is the target is not plotted');
  });
  test('the last band end extends the axis, the first does not lower it', () => {
    const chart = { type: 'column', data: wait, bands: [{ to: -20 }, { to: 40 }] };
    const axis = chartValueAxis(chart, resolveChartData(chart), geometry);
    assert.ok(axis.max >= 40, `max ${axis.max}`);
    assert.equal(axis.min, 0, 'a band below the data does not move the minimum');
  });
  test('a bullet axis runs from 0 to the largest value, target or band end', () => {
    const chart = { type: 'bullet', data: kpis, mapping: { target: 'Target' }, bands: [{ to: 0.6 }, { to: 1 }] };
    assert.deepEqual(chartValueAxis(chart, resolveChartData(chart), geometry), { min: 0, max: 1, majorUnit: 0.2 });
    const noBands = { type: 'bullet', data: { columns: ['K', 'A', 'T'], rows: [['a', 40, 55], ['b', 30, 20]] }, mapping: { target: 'T' } };
    assert.equal(chartValueAxis(noBands, resolveChartData(noBands), geometry).max, 55, 'the largest target');
  });
});

describe('Markdown and YAML (FR-07)', () => {
  test('a column chart with bands and a bullet chart round-trip as nested chart properties', async () => {
    const { fromMarkdown, toMarkdown } = await import('../dist/markdown.js');
    const { fromYaml, toYaml } = await import('../dist/yaml.js');
    const deck = { name: 'Bands', language: 'en-US', slides: [
      { title: 'Wait', chart: { type: 'column', alt: 'Wait by week.', data: wait, bands: [{ to: 10, label: 'Within target', color: 'accent3' }, { to: 20, label: 'Over target' }] } },
      { title: 'KPIs', chart: { type: 'bullet', alt: 'KPIs against targets.', data: kpis, mapping: { category: 'KPI', series: ['Actual'], target: 'Target' }, bands: [{ to: 0.6, label: 'Poor' }, { to: 1 }] } },
    ] };
    const charts = (value) => value.slides.map((slide) => slide.chart);
    for (const back of [fromYaml(toYaml(deck).yaml), fromMarkdown(toMarkdown(deck).markdown, {})]) {
      assert.deepEqual(back.findings.filter((finding) => finding.severity === 'error'), []);
      assert.deepEqual(charts(back.presentation), charts(deck));
    }
  });
});

describe('band labels inside the bands (FR-07, owner "1B")', async () => {
  const { placeBandLabels } = await import('../dist/composition.js');
  const geometry = { scale: 1, measure: (text, size) => text.length * size * 0.5 };
  const box = { x: 0, y: 0, width: 800, height: 400 }, inset = { left: 50, top: 20, right: 20, bottom: 40 };
  const axis = { min: 0, max: 20, majorUnit: 5 };
  const place = (chart, extra = {}) => placeBandLabels(chart, resolveChartData(chart), chart.type === 'bullet' ? { min: 0, max: 1, majorUnit: 0.2 } : axis, box, inset, { ...geometry, ...extra });
  const low = { columns: ['W', 'V'], rows: [['W1', 14], ['W2', 2]] };
  test('a stripe\'s label at its end corner, 8 px from the end and 4 px from the top; the start when the end meets a column', () => {
    const placed = place({ type: 'column', data: low, bands: [{ to: 10, label: 'Good' }, { to: 20 }] });
    assert.deepEqual(placed.labels.map((label) => [label.index, label.place, label.category, label.align]), [[0, 'end', 1, 'right']]);
    const { box: label } = placed.labels[0];
    assert.equal(label.x + label.width, 800 - 20 - 8);
    assert.equal(label.y, 20 + 340 / 2 + 4);
    const tall = place({ type: 'column', data: { columns: ['W', 'V'], rows: [['W1', 2], ['W2', 2], ['W3', 2], ['W4', 2], ['W5', 2], ['W6', 19]] }, bands: [{ to: 10, label: 'Good' }] });
    assert.equal(tall.labels[0].place, 'start');
  });
  test('the fallback: a label wider than its band, or one that meets a mark at both places, sends every label to the legend', () => {
    assert.deepEqual(place({ type: 'column', data: low, bands: [{ to: 10, label: 'Good' }, { to: 10.5, label: 'Far too long for so thin a band' }] }), { labels: [], legend: true, reason: 'too-large' });
    assert.deepEqual(place({ type: 'area', data: { columns: ['W', 'V'], rows: [['W1', 19], ['W2', 19]] }, bands: [{ to: 10, label: 'Good' }] }), { labels: [], legend: true, reason: 'collision' }, 'an area covers both corners');
    assert.equal(place({ type: 'column', data: low, bands: [{ to: 10 }] }), undefined, 'no labeled band');
  });
  test('a strip\'s label at its top, at the strip\'s start (the right, right to left)', () => {
    const data = { columns: ['K', 'A', 'T'], rows: [['a', 0.3, 0.4], ['b', 0.5, 0.6]] };
    const chart = { type: 'bullet', data, mapping: { target: 'T' }, bands: [{ to: 0.6, label: 'Poor' }, { to: 1, label: 'Good' }] };
    const ltr = place(chart), rtl = place(chart, { direction: 'rtl' });
    assert.deepEqual(ltr.labels.map((label) => [label.place, label.align]), [['top', 'left'], ['top', 'left']]);
    assert.equal(ltr.labels[0].box.x, 50 + 8);
    assert.equal(rtl.labels[0].box.x + rtl.labels[0].box.width, 800 - 20 - 8);
  });
});

describe('one band label color per chart (FR-07)', async () => {
  const { bandLabelColor } = await import('../dist/composition.js');
  test('the secondary text color when it reads at 4.5:1 on every labeled band, else the primary; a band where even that fails is listed', () => {
    assert.deepEqual(bandLabelColor(['#E6E5E5', '#D7D6D6'], '#595959', '#000000'), { color: '#595959', failing: [] });
    assert.deepEqual(bandLabelColor(['#C4C3C3', '#D7D6D6', '#E6E5E5'], '#595959', '#000000'), { color: '#000000', failing: [] }, '595959 is 3.98:1 on C4C3C3');
    assert.deepEqual(bandLabelColor(['#E6E5E5', '#202020'], '#595959', '#000000'), { color: '#000000', failing: [1] }, 'an author\'s dark band');
  });
});
