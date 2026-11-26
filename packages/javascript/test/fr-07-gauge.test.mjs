// FR-07, part 3 (docs/content-payloads.md, "Gauges"): the schema of `metric.gauge`, its warnings, and the layout of a metric with a gauge:
// the arc above the text, the value in the bowl only when it fits there, no text under an arc, and a region too small for the arc.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMetric, validate } from '../dist/index.js';
import { composeSlide, layoutMetric, metricGaugeDrawing, metricGaugeInput, METRIC_GAUGE_MIN_WIDTH_PX } from '../dist/composition.js';

const findings = (deck) => validate(deck).findings;
const ids = (deck) => findings(deck).map((finding) => `${finding.ruleId} ${finding.path}`);
const input = (metric) => metricGaugeInput(metric, resolveMetric(metric, {}));
const box = { x: 40, y: 60, width: 600, height: 400 };

test('the schema takes a gauge on the object form of a metric and requires max', () => {
  assert.deepEqual(findings({ slides: [{ title: 'U', metric: { value: 0.72, gauge: { max: 1 } } }] }).filter((f) => f.severity === 'error'), []);
  const missing = findings({ slides: [{ title: 'U', metric: { value: 0.72, gauge: { min: 0 } } }] }).filter((f) => f.severity === 'error');
  assert.ok(missing.length > 0, 'max is required');
  assert.ok(findings({ slides: [{ title: 'U', metric: { value: 1, gauge: { max: 2, bands: [] } } }] }).some((f) => f.severity === 'error'), 'a band list is not empty');
  assert.ok(findings({ slides: [{ title: 'U', metric: { value: 1, gauge: { max: 2, bands: [{ to: 1, color: 'teal' }] } } }] }).some((f) => f.severity === 'error'), 'a band color is a scheme name');
});

test('the warnings: range, value and band order', () => {
  assert.deepEqual(ids({ slides: [{ title: 'U', metric: { value: '72%', gauge: { max: 1 } } }] }).filter((id) => id.includes('gauge')), ['opf/metric-gauge-value /slides/0/metric/value']);
  const outside = findings({ slides: [{ title: 'U', metric: { value: 1.2, gauge: { max: 1, target: 2, bands: [{ to: 0.5 }, { to: 1.5 }] } } }] }).filter((f) => f.ruleId === 'opf/metric-gauge-range');
  assert.equal(outside.length, 1, 'one warning per gauge');
  assert.equal(outside[0].path, '/slides/0/metric/gauge');
  assert.match(outside[0].message, /value .*, target .* and band 2 .* are outside its scale \(0 to 1\)/);
  assert.deepEqual(ids({ slides: [{ title: 'U', metric: { value: 1, gauge: { min: 2, max: 2 } } }] }).filter((id) => id.includes('gauge')), ['opf/metric-gauge-range /slides/0/metric/gauge']);
  assert.ok(ids({ slides: [{ title: 'U', metric: { value: 1, gauge: { max: 2, bands: [{ to: 1.5 }, { to: 1 }] } } }] }).includes('opf/chart-bands-order /slides/0/metric/gauge/bands'));
  assert.deepEqual(ids({ slides: [{ title: 'U', metric: { value: 0.72, gauge: { max: 1, target: 0.8 } } }] }).filter((id) => id.includes('gauge')), []);
});

test('a gauge draws only a number, against a range that is not empty', () => {
  assert.equal(input({ value: '72%', gauge: { max: 1 } }), undefined);
  assert.equal(input({ value: 1, gauge: { min: 1, max: 1 } }), undefined);
  assert.deepEqual(input({ value: 0.72, format: '0%', gauge: { max: 1 } }).ends, ['0%', '100%'], 'the ends are written with the value\'s format');
  assert.deepEqual(input({ value: 41, gauge: { min: -100, max: 100 } }).ends, ['-100', '100']);
  const linked = { value: 0.72, data: { dataset: 'ops', field: 'U', aggregate: 'last' }, gauge: { max: 1 } };
  const resolved = resolveMetric(linked, { datasets: { ops: { columns: ['W', { name: 'U', format: '0%' }], rows: [['W1', 0.68]] } } });
  assert.deepEqual(metricGaugeInput(linked, resolved), { min: 0, max: 1, value: 0.68, bands: [], ends: ['0%', '100%'] }, 'a gauge bound to data draws the computed number with the column\'s format');
});

// Every line of the metric's text is either inside the bowl (above the center line, within the track's inner circle) or below the arc's
// center line and clear of the ends' labels: no text is ever under an arc.
const clear = (layout) => {
  const { center, radius, thickness } = layout.gauge;
  for (const part of layout.parts.filter((p) => p.visible && p.fit)) part.fit.sourceLines.forEach((line, index) => {
    const { x, baseline } = part.linePositions[index], top = baseline - 0.75 * part.fit.fontSize;
    if (baseline <= center.y + 0.01) for (const [px, py] of [[x, top], [x + line.width, top]]) assert.ok(Math.hypot(px - center.x, py - center.y) <= radius - thickness - radius / 8 + 0.01, `${part.role} inside the bowl, an eighth of the radius from the track`);
    else {
      assert.ok(top >= center.y - 0.01, `${part.role} below the center line`);
      for (const end of layout.gauge.ends) assert.ok(x >= end.box.x + end.box.width || x + line.width <= end.box.x || top >= end.box.y + end.box.height, `${part.role} clear of ${end.text}`);
    }
  });
};

test('the value stands in the bowl when it fits there, and below the arc when it does not', () => {
  const fits = layoutMetric({ label: 'Utilization', value: '72%' }, box, { gauge: input({ value: 0.72, gauge: { max: 1 } }) });
  assert.ok(fits.gauge && fits.gauge.inBowl, 'a short value stands in the bowl');
  clear(fits);
  const long = layoutMetric({ label: 'Revenue', value: '1,284,300 USD' }, { ...box, width: 360 }, { gauge: input({ value: 1284300, gauge: { max: 2000000 } }) });
  assert.ok(long.gauge, 'the gauge is drawn');
  assert.equal(long.gauge.inBowl, false, 'a long value does not fit in the bowl: it stands under the arc');
  assert.ok(long.parts[0].linePositions[0].baseline > long.gauge.center.y, 'below the center line');
  clear(long);
});

test('a value outside the range: its arc stops at the end and its number is printed', () => {
  const layout = layoutMetric({ label: 'Utilization', value: '118%' }, box, { gauge: input({ value: 1.18, format: '0%', gauge: { max: 1 } }) });
  assert.equal(layout.gauge.fill, 1);
  assert.equal(layout.parts[0].text, '118%');
  const drawing = metricGaugeDrawing(layout.gauge, { surface: '#FFFFFF', text: '#000000', primary: '#1F4E79', muted: '#595959', resolve: () => '#C00000' });
  assert.deepEqual(drawing.arcs.find((arc) => arc.role === 'value').adjust, { adj1: 180, adj2: 0, adj3: drawing.arcs.find((arc) => arc.role === 'value').adjust.adj3 });
});

test('the drawing: one center, the track 18% of the radius thick, the value arc 60% of it, the band of the value colors it', () => {
  const gauge = input({ value: 41, gauge: { min: -100, max: 100, bands: [{ to: 0, color: 'accent2' }, { to: 30 }, { to: 100, color: 'accent3' }], target: 40 } });
  const layout = layoutMetric({ label: 'NPS', value: 41 }, box, { gauge });
  const drawing = metricGaugeDrawing(layout.gauge, { surface: '#FFFFFF', text: '#000000', primary: '#1F4E79', muted: '#595959', resolve: (name) => (name === 'accent3' ? '#2E7D32' : '#C00000') });
  assert.deepEqual(drawing.arcs.map((arc) => [arc.part, arc.adjust.adj1, arc.adjust.adj2]), [['gauge band 1', 180, 270], ['gauge band 2', 270, 297], ['gauge band 3', 297, 0], ['gauge value', 180, 306.9]]);
  const [band] = drawing.arcs, value = drawing.arcs.at(-1);
  assert.equal(band.adjust.adj3, 0.09);
  assert.ok(Math.abs(value.adjust.adj3 * value.frame.width - 0.6 * layout.gauge.thickness) < 1e-3);
  for (const arc of drawing.arcs) assert.ok(Math.abs(arc.frame.x + arc.frame.width / 2 - layout.gauge.center.x) < 1e-6 && Math.abs(arc.frame.y + arc.frame.height / 2 - layout.gauge.center.y) < 1e-6);
  assert.equal(value.fill, '#2E7D32', 'the value falls in the band that names accent3');
  assert.ok(drawing.target && drawing.ends.map((end) => end.end.text).join(' ') === '-100 100');
});

test('a region too small for the arc draws a plain metric, and composition says so', () => {
  const small = layoutMetric({ label: 'Utilization', value: '72%' }, { x: 0, y: 0, width: METRIC_GAUGE_MIN_WIDTH_PX - 10, height: 300 }, { gauge: input({ value: 0.72, gauge: { max: 1 } }) });
  assert.equal(small.gauge, undefined);
  assert.equal(small.gaugeDropped, true);
});

test('a row of tiles: every tile draws its gauge with its text clear of the arcs', () => {
  const metric = (label, value) => ({ metric: { label, value, format: '0%', gauge: { max: 1, bands: [{ to: 0.6 }, { to: 0.85 }, { to: 1, color: 'accent2' }], target: 0.8 } } });
  const slide = { title: 'Four sites', blocks: [metric('Berlin', 0.72), metric('Lisbon', 0.48), metric('Madrid', 0.91), metric('Oslo', 0.66)] };
  const presentation = { language: 'en-US', slides: [slide] };
  const composed = composeSlide(slide, { presentation, slideIndex: 0 });
  const metrics = composed.items.filter((item) => item.metricLayout);
  assert.equal(metrics.length, 4);
  for (const item of metrics) { assert.ok(item.metricLayout.gauge, item.path); clear(item.metricLayout); }
});

test('the arc outline the preview draws is the blockArc preset of shape-geometry at the same frame and adjustments', async () => {
  const { presetGeometry, flattenShapePath } = await import('../dist/shape-geometry.js');
  const { blockArcPath } = await import('../dist/composition.js');
  for (const adjust of [{ adj1: 180, adj2: 0, adj3: 0.09 }, { adj1: 180, adj2: 306.9, adj3: 0.05602 }, { adj1: 270, adj2: 297, adj3: 0.09 }]) {
    const ours = blockArcPath(400, adjust), preset = flattenShapePath(presetGeometry('blockArc', 400, 400, adjust).paths[0].commands).flat();
    const inner = 200 - 400 * adjust.adj3, sweep = ((adjust.adj2 - adjust.adj1) % 360 + 360) % 360;
    const angleOf = ([x, y]) => (((Math.atan2(y - 200, x - 200) * 180) / Math.PI - adjust.adj1) % 360 + 360) % 360;
    // The preset's outline lies on the two circles of ours, within the same sweep.
    for (const point of preset) {
      const radius = Math.hypot(point.x - 200, point.y - 200);
      assert.ok(Math.abs(radius - 200) < 0.6 || Math.abs(radius - inner) < 0.6, `on a circle: ${radius} (${JSON.stringify(adjust)})`);
      assert.ok(angleOf([point.x, point.y]) <= sweep + 0.2 || angleOf([point.x, point.y]) >= 359.8, `within the sweep (${JSON.stringify(adjust)})`);
    }
    // Our four corners are corners of the preset's outline.
    const corners = [...ours.matchAll(/(?:M|L|A [\d.]+ [\d.]+ 0 \d \d) (-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    assert.equal(corners.length, 4);
    for (const [x, y] of corners) assert.ok(preset.some((point) => Math.hypot(point.x - x, point.y - y) < 0.6), `corner ${x},${y} (${JSON.stringify(adjust)})`);
  }
});

test('Markdown and YAML: a gauge with bands and a target, and a gauge bound to data, round-trip as nested metric properties', async () => {
  const { fromMarkdown, toMarkdown } = await import('../dist/markdown.js');
  const { fromYaml, toYaml } = await import('../dist/yaml.js');
  const deck = { name: 'Gauges', language: 'en-US',
    datasets: { ops: { columns: ['Week', { name: 'Utilization', format: '0%' }], rows: [['W46', 0.68], ['W47', 0.72]] } },
    slides: [
      { title: 'NPS', metric: { label: 'Net Promoter Score', value: 41, gauge: { min: -100, max: 100, bands: [{ to: 0, label: 'Detractors lead', color: 'accent2' }, { to: 30 }, { to: 100, label: 'Strong', color: 'accent3' }], target: 40 } } },
      { title: 'Capacity', metric: { label: 'Utilization', value: 0.72, data: { dataset: 'ops', field: 'Utilization', aggregate: 'last' }, gauge: { max: 1 } } },
    ] };
  const metrics = (value) => value.slides.map((slide) => slide.metric ?? slide.blocks?.[0]?.metric);
  for (const back of [fromYaml(toYaml(deck).yaml), fromMarkdown(toMarkdown(deck).markdown, {})]) {
    assert.deepEqual(back.findings.filter((finding) => finding.severity === 'error'), []);
    assert.deepEqual(metrics(back.presentation), metrics(deck));
  }
});

test('a gauge in a tile fits its text to the readability floor, not to the tile\'s floors', () => {
  const gauge = input({ value: 0.48, format: '0%', gauge: { max: 1 } });
  const tile = layoutMetric({ label: 'Lisbon', value: '48%' }, { x: 0, y: 0, width: 570, height: 233 }, { gauge, tile: true, minimumSizes: { value: 120, label: 40 } });
  assert.ok(tile.gauge, 'the gauge is drawn');
  clear(tile);
});
