// FR-07d (supervisor, 2026-11-26): band labels that do not all stand inside their bands stand beside the plot: a gutter past the end of a
// column, line or area chart's plot (the left right to left), a row above a bar or bullet chart's plot; in the secondary text color. A stacked
// chart's series names start past the plot's end, so the bands end before them.
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const elements = (svg, tag) => [...svg.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))].map(([, a]) => attributesOf(a));
const num = Number;
let checks = 0;
const deck = (chart, extra = {}) => ({ design: { fontScheme: 'roboto' }, ...extra, slides: [{ title: 'Bands', chart: { alt: 'Bands.', ...chart } }] });
const weeks = { columns: ['Week', { name: 'Wait (min)', format: '0' }], rows: [['W1', 14], ['W2', 11], ['W3', 9], ['W4', 12], ['W5', 16], ['W6', 8]] };
const stripes = [{ to: 10, label: 'Within target' }, { to: 15, label: 'Watch' }, { to: 20, label: 'Over target' }];
const kpis = { columns: ['KPI', { name: 'Actual', format: '0%' }, { name: 'Target', format: '0%' }], rows: [['Win rate', 0.31, 0.35], ['Retention', 0.92, 0.9], ['NPS reached', 0.64, 0.7], ['On-time delivery', 0.88, 0.95], ['Upsell rate', 0.47, 0.4]] };
const strips = [{ to: 0.6, label: 'Poor' }, { to: 0.85, label: 'Fair' }, { to: 1, label: 'Good' }];
const bandRects = (svg) => elements(svg, 'rect').filter((r) => /\.bands\.\d+$/.test(r['data-opf-path'] ?? ''));
const labelBoxes = (svg) => elements(svg, 'g').filter((g) => /\.bands\.\d+\.label$/.test(g['data-opf-path'] ?? '')).map((g) => ({ path: g['data-opf-path'], x: num(g['data-opf-box-x']), y: num(g['data-opf-box-y']), width: num(g['data-opf-box-width']), height: num(g['data-opf-box-height']) }));

// Stripes: past the plot's end, 8 px from it, each label's middle on its band's middle; right to left at the left.
for (const rtl of [false, true]) {
  const svg = toSvg(deck({ type: 'column', data: weeks, bands: stripes, legend: 'bottom' }, rtl ? { language: 'ar' } : {}), 1, { trace: true });
  const rects = bandRects(svg), labels = labelBoxes(svg);
  assert.equal(labels.length, 3, `column ${rtl ? 'rtl' : 'ltr'}: three labels`);
  const left = Math.min(...rects.map((r) => num(r.x))), right = Math.max(...rects.map((r) => num(r.x) + num(r.width)));
  for (const label of labels) {
    const k = Number(/bands\.(\d+)\.label/.exec(label.path)[1]), band = rects.find((r) => r['data-opf-path'].endsWith(`bands.${k}`));
    if (rtl) assert.ok(Math.abs(label.x + label.width - (left - 8)) < 0.01, `rtl: ${label.path} ends 8 px before the plot's start`);
    else assert.ok(Math.abs(label.x - (right + 8)) < 0.01, `${label.path} starts 8 px past the plot's end`);
    assert.ok(Math.abs(label.y + label.height / 2 - (num(band.y) + num(band.height) / 2)) < 0.01, `${label.path} centered on its band`);
  }
  checks += 2;
}

// Strips: a row above the plot, each label centered over its strip.
{
  const svg = toSvg(deck({ type: 'bullet', data: kpis, mapping: { category: 'KPI', series: ['Actual'], target: 'Target' }, bands: strips, legend: 'bottom' }), 1, { trace: true });
  const rects = bandRects(svg).filter((r) => num(r.width) > 30), labels = labelBoxes(svg);
  assert.equal(labels.length, 3, 'bullet: three labels');
  const top = Math.min(...rects.map((r) => num(r.y)));
  for (const label of labels) {
    const k = Number(/bands\.(\d+)\.label/.exec(label.path)[1]), band = rects.find((r) => r['data-opf-path'].endsWith(`bands.${k}`));
    assert.ok(label.y + label.height <= top - 3.99, `${label.path} above the plot`);
    assert.ok(Math.abs(label.x + label.width / 2 - (num(band.x) + num(band.width) / 2)) < 0.01, `${label.path} centered over its strip`);
  }
  checks += 2;
}

// A stacked chart's names start past the plot's end: the bands end before them, and its band labels go to the legend.
{
  const diagnostics = [];
  const svg = toSvg(deck({ type: 'stacked-column', data: { columns: ['Quarter', 'North', 'South', 'West'], rows: [['Q1', 4, 3, 2], ['Q2', 5, 4, 3], ['Q3', 6, 4, 4], ['Q4', 7, 5, 4]] }, bands: [{ to: 6, label: 'Below plan' }, { to: 12, label: 'On plan' }, { to: 20, label: 'Above plan' }] }), 1, { trace: true, onDiagnostic: (d) => diagnostics.push(d.code) });
  const right = Math.max(...bandRects(svg).map((r) => num(r.x) + num(r.width)));
  const names = elements(svg, 'g').filter((g) => /\.data\.columns\.\d+$/.test(g['data-opf-path'] ?? '') && g['data-opf-box-x']);
  const starts = [...svg.matchAll(/<(?:rect|text)\b[^>]*data-opf-path="slides\.0\.chart\.data\.columns\.\d+"[^>]*>/g)].map(([tag]) => num(/\bx="([\d.]+)"/.exec(tag)?.[1] ?? NaN)).filter(Number.isFinite);
  assert.ok(starts.length >= 3 || names.length >= 3, 'the series names are drawn');
  for (const x of [...starts, ...names.map((g) => num(g['data-opf-box-x']))]) assert.ok(x >= right - 0.01, `a series name starts at ${x}, past the plot's end ${right}`);
  assert.ok(diagnostics.includes('chart-band-labels-in-legend'), 'the names use the end side, so the labels go to the legend');
  checks += 2;
}

console.log(`FR-07d band labels beside the plot: ${checks} checks`);
