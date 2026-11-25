// FR-07 (CR 5): bands behind the gridlines and the data of column, bar, line and area charts, the bullet chart (bands, a thin measure bar
// and a target tick per row), right to left, and the lowest contrast between a data mark and a band over every gallery color scheme.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { chartBandFill, colorContrast, mixOklab } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const marks = (svg) => [...svg.matchAll(/<(rect|line|polyline|path|circle)\b([^>]*)>/g)].map(([, tag, a]) => ({ tag, ...attributesOf(a) }));
const num = (value) => Number(value);
let checks = 0;

const wait = { columns: ['Week', 'Wait'], rows: [['W1', 14], ['W2', 11], ['W3', 9], ['W4', 12]] };
const deck = (chart, extra = {}) => ({ design: { fontScheme: 'roboto' }, ...extra, slides: [{ title: 'Wait time', chart: { alt: 'Wait time by week.', ...chart } }] });

// A column chart: three bands across the whole plot, behind the gridlines and the columns, darkest lowest, in core's colors.
{
  const input = deck({ type: 'column', data: wait, legend: 'right', bands: [{ to: 10, label: 'Good' }, { to: 15 }, { to: 20, label: 'Over' }] });
  const svg = toSvg(input, 1, { trace: true }), all = marks(svg);
  const colors = resolvePresentation(input).slides[0].design.colors;
  const bands = all.filter((mark) => mark.tag === 'rect' && /\.bands\.\d+$/.test(mark['data-opf-path'] ?? '') && num(mark.width) > 30);
  assert.equal(bands.length, 3);
  const columns = all.filter((mark) => mark.tag === 'rect' && /\.data\.rows\.\d+\.1$/.test(mark['data-opf-path'] ?? ''));
  const firstBand = all.indexOf(bands[0]), firstGrid = all.findIndex((mark) => mark.tag === 'line' && !mark['data-opf-path']), firstColumn = all.indexOf(columns[0]);
  assert.ok(firstBand < firstGrid && firstBand < firstColumn, 'bands come before the gridlines and the columns');
  // Bands span the plot width; each next band sits above the previous one and they touch.
  assert.ok(bands.every((band) => band.x === bands[0].x && band.width === bands[0].width));
  for (let i = 1; i < bands.length; i++) assert.ok(Math.abs(num(bands[i].y) + num(bands[i].height) - num(bands[i - 1].y)) < 0.02, `band ${i} sits on band ${i - 1}`);
  // 0-10 is twice 10-15.
  assert.ok(Math.abs(num(bands[0].height) - 2 * num(bands[1].height)) < 0.05);
  const surface = resolvePresentation(input).slides[0].design.backgroundColor ?? colors.background;
  assert.equal(bands[0].fill.toUpperCase(), chartBandFill({ neutral: 0 }, { surface, text: colors.text, resolve: () => '#000000' }));
  assert.equal(bands[0].fill.toUpperCase(), mixOklab(surface, colors.text, 0.18));
  // The legend names the series and the labeled bands, after the series; the unlabeled band has no entry.
  const legend = all.filter((mark) => mark.tag === 'rect' && /\.bands\.\d+$/.test(mark['data-opf-path'] ?? '') && num(mark.width) < 30).map((mark) => mark['data-opf-path']);
  assert.deepEqual(legend, ['slides.0.chart.bands.0', 'slides.0.chart.bands.2']);
  checks += 8;
}

// A chart without bands draws as before.
{
  const plain = toSvg(deck({ type: 'column', data: wait }), 1, { trace: true });
  const ignored = toSvg(deck({ type: 'pie', data: wait, bands: [{ to: 3 }] }), 1, { trace: true });
  assert.ok(!/\.bands\./.test(plain) && !/\.bands\./.test(ignored), 'no band marks without bands, or on a pie');
  assert.equal(toSvg(deck({ type: 'pie', data: wait, bands: [{ to: 3 }] }), 1), toSvg(deck({ type: 'pie', data: wait }), 1), 'a pie ignores bands');
  checks += 2;
}

// A line chart: bands from the first to the last category center.
{
  const svg = toSvg(deck({ type: 'line', data: wait, bands: [{ to: 10 }, { to: 20 }] }), 1, { trace: true });
  const bands = marks(svg).filter((mark) => mark.tag === 'rect' && /\.bands\.\d+$/.test(mark['data-opf-path'] ?? ''));
  const line = marks(svg).find((mark) => mark.tag === 'polyline' && /\.data\.columns\.1$/.test(mark['data-opf-path'] ?? ''));
  const xs = line.points.split(' ').map((point) => num(point.split(',')[0]));
  assert.ok(Math.abs(num(bands[0].x) - xs[0]) < 0.05 && Math.abs(num(bands[0].x) + num(bands[0].width) - xs[xs.length - 1]) < 0.05, 'first to last category center');
  checks += 1;
}

// A bullet chart: per row a measure bar a third of the row, a target tick two thirds of it, bands over every row; no tick for a missing target.
{
  const data = { columns: ['KPI', { name: 'Actual', format: '0%' }, { name: 'Target', format: '0%' }], rows: [['Win rate', 0.31, 0.35], ['Retention', 0.92, 0.9], ['NPS', 0.64, null]] };
  const chart = { type: 'bullet', data, mapping: { target: 'Target' }, bands: [{ to: 0.6, label: 'Poor' }, { to: 0.85, label: 'Fair' }, { to: 1, label: 'Good' }] };
  for (const language of ['en', 'ar']) {
    const svg = toSvg(deck(chart, { language }), 1, { trace: true }), all = marks(svg);
    const bars = all.filter((mark) => mark.tag === 'rect' && /\.data\.rows\.\d+\.1$/.test(mark['data-opf-path'] ?? ''));
    const ticks = all.filter((mark) => mark.tag === 'line' && /\.mapping\.target$/.test(mark['data-opf-path'] ?? ''));
    const bands = all.filter((mark) => mark.tag === 'rect' && /\.bands\.\d+$/.test(mark['data-opf-path'] ?? ''));
    assert.equal(bars.length, 3);
    assert.equal(ticks.length, 2, 'the row without a target has no tick');
    const row = num(bands[0].height) / 3;
    assert.ok(Math.abs(num(bars[0].height) - row / 3) < 0.05, 'a bar is a third of its row');
    assert.ok(Math.abs(num(ticks[0].y2) - num(ticks[0].y1) - 2 * row / 3) < 0.05, 'a tick is two thirds of its row');
    assert.ok(all.indexOf(bands[0]) < all.indexOf(bars[0]) && all.indexOf(bars[0]) < all.indexOf(ticks[0]), 'bands, then bars, then ticks');
    const plotLeft = Math.min(...bands.map((band) => num(band.x))), plotRight = Math.max(...bands.map((band) => num(band.x) + num(band.width)));
    const at = (value) => language === 'ar' ? plotRight - value * (plotRight - plotLeft) : plotLeft + value * (plotRight - plotLeft);
    assert.ok(Math.abs(num(ticks[0].x1) - at(0.35)) < 0.05, `tick at its target (${language})`);
    assert.ok(Math.abs((language === 'ar' ? num(bars[1].x) : num(bars[1].x) + num(bars[1].width)) - at(0.92)) < 0.05, `bar to its value (${language})`);
    checks += 7;
  }
}

// The lowest contrast between a data mark and a band (the three darkest neutrals) over every gallery color scheme, light and dark. The note asks
// for 3:1; the line is printed for the supervisor whatever it says.
{
  const schemes = readdirSync(new URL('../../gallery/catalog/color-schemes/', import.meta.url)).filter((file) => file !== 'index.json').map((file) => file.replace(/\.json$/, ''));
  let worst = { ratio: Infinity };
  for (const colorScheme of schemes) for (const variant of ['light1', 'dark1']) {
    const input = deck({ type: 'column', legend: 'none', data: { columns: ['Q', 'A', 'B', 'C'], rows: [['Q1', 10, 11, 12], ['Q2', 12, 13, 14]] }, bands: [{ to: 4 }, { to: 8 }, { to: 12 }, { to: 16 }] }, { design: { fontScheme: 'roboto', theme: 'classic', colorScheme, variant } });
    const all = marks(toSvg(input, 1, { trace: true }));
    const bands = [...new Set(all.filter((mark) => mark.tag === 'rect' && /\.bands\.[0-2]$/.test(mark['data-opf-path'] ?? '')).map((mark) => mark.fill))];
    const fills = [...new Set(all.filter((mark) => mark.tag === 'rect' && /\.data\.rows\.\d+\.\d+$/.test(mark['data-opf-path'] ?? '')).map((mark) => mark.fill))];
    for (const band of bands) for (const fill of fills) {
      const ratio = colorContrast(fill, band);
      if (ratio < worst.ratio) worst = { ratio, colorScheme, variant, band, fill };
    }
  }
  console.log(`FR-07 bands: lowest mark-to-band contrast ${worst.ratio.toFixed(2)}:1 (${worst.colorScheme} ${worst.variant}, mark ${worst.fill} on band ${worst.band}) over ${schemes.length} schemes, light and dark`);
  assert.ok(worst.ratio >= 3, `a data mark keeps 3:1 against every band (lowest ${worst.ratio.toFixed(2)}:1, ${worst.colorScheme} ${worst.variant}, mark ${worst.fill} on band ${worst.band})`);
  checks += 1;
}
console.log(`FR-07 bands and bullet render: ${checks} checks`);
