// FR-07 (CR 5): the band contrast checks over every gallery theme, color scheme and variant. (1) each default neutral differs from the surface
// and from the next band by at least 1.15:1; (2) each band label (inside its band, owner's "1B") keeps 4.5:1 against its band; (3a) the muted
// marks of a highlighted chart with bands keep 1.5:1 against every band, and a chart without bands keeps its muted color (supervisor,
// 2026-11-26, replacing the rule that a band keeps 80% of a mark's contrast); (3b) every default series color is at least 0.05 from every
// default band in OKLab distance. The lowest values are printed for the supervisor.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { chartBandMutedColor, chartHighlightColors, colorContrast, srgbToOklab } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const marks = (svg) => [...svg.matchAll(/<(rect|line|polyline|path|circle|text)\b([^>]*)>/g)].map(([, tag, a]) => ({ tag, ...attributesOf(a) }));
const distance = (a, b) => { const [x, y] = [srgbToOklab(a), srgbToOklab(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
let checks = 0;
const catalog = (kind) => readdirSync(new URL(`../../gallery/catalog/${kind}/`, import.meta.url)).filter((file) => file !== 'index.json').map((file) => file.replace(/\.json$/, ''));
const schemes = catalog('color-schemes'), themes = catalog('themes'), variants = ['light1', 'light2', 'dark1', 'dark2'];
const BANDS = [{ to: 4, label: 'Low' }, { to: 8, label: 'Mid' }, { to: 12, label: 'High' }];
const deck = (chart, design) => ({ design: { fontScheme: 'roboto', ...design }, slides: [{ title: 'Wait time', chart: { alt: 'Wait time by week.', ...chart } }] });
const bandFills = (all) => [0, 1, 2].map((k) => all.find((mark) => mark.tag === 'rect' && mark['data-opf-path'] === `slides.0.chart.bands.${k}`)?.fill);
const dataFills = (all, row) => all.filter((mark) => mark.tag === 'rect' && new RegExp(`\\.data\\.rows\\.${row ?? '\\d+'}\\.\\d+$`).test(mark['data-opf-path'] ?? '')).map((mark) => mark.fill);
const combos = themes.flatMap((theme) => schemes.flatMap((colorScheme) => variants.map((variant) => ({ theme, colorScheme, variant }))));

// (1) and (2): the bands and their labels, asserted over the classic theme light and dark (their scope since round 2); over every theme and
// variant the lowest values are printed only (a colored surface, as the bold theme's dark2, lowers them; reported to the supervisor).
{
  const worst = { visible: { ratio: Infinity }, text: { ratio: Infinity } }, wide = { visible: { ratio: Infinity }, text: { ratio: Infinity } };
  let asserted = false;
  const note = (check, ratio, detail) => {
    if (ratio < wide[check].ratio) wide[check] = { ratio, ...detail };
    if (asserted && ratio < worst[check].ratio) worst[check] = { ratio, ...detail };
  };
  for (const design of combos) {
    asserted = design.theme === 'classic' && (design.variant === 'light1' || design.variant === 'dark1');
    const input = deck({ type: 'column', legend: 'none', data: { columns: ['Q', 'A', 'B', 'C'], rows: [['Q1', 1, 1, 1], ['Q2', 2, 1, 2]] }, bands: BANDS }, design);
    const slide = resolvePresentation(input).slides[0], surface = slide.design.backgroundColor ?? slide.design.colors.background;
    const svg = toSvg(input, 1, { trace: true }), bands = bandFills(marks(svg));
    const inks = [0, 1, 2].map((k) => /\bfill="(#[0-9A-Fa-f]{6})/.exec([...svg.matchAll(/<text\b[^>]*>/g)].map(([tag]) => tag).find((tag) => tag.includes(`data-opf-path="slides.0.chart.bands.${k}.label"`)) ?? '')?.[1]);
    const name = `${design.theme} ${design.colorScheme} ${design.variant}`;
    assert.ok(bands.every(Boolean) && inks.every(Boolean), `every band and band label is drawn (${name})`);
    bands.forEach((band, k) => {
      note('visible', colorContrast(band, surface), { name, what: `band ${k} ${band} on surface ${surface}` });
      if (k) note('visible', colorContrast(band, bands[k - 1]), { name, what: `band ${k} ${band} beside band ${k - 1} ${bands[k - 1]}` });
    });
    inks.forEach((ink, k) => { note('text', colorContrast(ink, bands[k]), { name, what: `label ${ink} on band ${k} ${bands[k]}` }); });
  }
  const line = (check, from = worst) => `${from[check].ratio.toFixed(3)}:1 (${from[check].name}, ${from[check].what})`;
  console.log(`FR-07 bands, classic theme light1 and dark1 over ${schemes.length} schemes: (1) lowest band step ${line('visible')}; (2) lowest band label on its band ${line('text')}`);
  console.log(`FR-07 bands over all ${combos.length} theme, scheme and variant combinations (printed only): (1) lowest band step ${line('visible', wide)}; (2) lowest band label on its band ${line('text', wide)}`);
  assert.ok(worst.visible.ratio >= 1.15, `(1) bands visible: ${line('visible')}`);
  assert.ok(worst.text.ratio >= 4.5, `(2) a band label on its band: ${line('text')}`);
  checks += 2;
}

// (3a) The muted color of a highlighted column chart with default bands, and the same chart without bands (its muted color unchanged).
{
  let lowest = { ratio: Infinity }, surfaceLowest = { ratio: Infinity };
  const chart = { type: 'column', data: { columns: ['Q', 'A', 'B'], rows: [['Q1', 3, 5], ['Q2', 6, 9], ['Q3', 10, 7]] }, highlight: { categories: ['Q2'] } };
  for (const design of combos) {
    const name = `${design.theme} ${design.colorScheme} ${design.variant}`;
    const input = deck({ ...chart, bands: BANDS }, design);
    const slide = resolvePresentation(input).slides[0], surface = slide.design.backgroundColor ?? slide.design.colors.background;
    const all = marks(toSvg(input, 1, { trace: true })), bands = bandFills(all);
    const muted = [...new Set([...dataFills(all, 0), ...dataFills(all, 2)])];
    assert.equal(muted.length, 1, `one muted color (${name})`);
    assert.equal(muted[0].toUpperCase(), chartBandMutedColor(bands, surface, slide.design.colors.text).toUpperCase(), `the muted color is core's (${name})`);
    assert.notEqual(muted[0].toUpperCase(), dataFills(all, 1)[0].toUpperCase(), `the muted color is not the accent (${name})`);
    for (const band of bands) { const ratio = colorContrast(muted[0], band); if (ratio < lowest.ratio) lowest = { ratio, name, what: `muted ${muted[0]} on band ${band}` }; }
    const onSurface = colorContrast(muted[0], surface);
    if (onSurface < surfaceLowest.ratio) surfaceLowest = { ratio: onSurface, name, what: `muted ${muted[0]} on surface ${surface}` };
    // Without bands: today's muted color, core chartHighlightColors with the chart's label color (render's c.labelColor, which the
    // value-axis tick labels are drawn in).
    const plain = marks(toSvg(deck(chart, design), 1, { trace: true }));
    const plainMuted = [...new Set([...dataFills(plain, 0), ...dataFills(plain, 2)])];
    assert.equal(plainMuted.length, 1, `one muted color without bands (${name})`);
    const label = plain.find((mark) => mark.tag === 'text' && /^slides\.0\.chart(\.valueAxis)?$/.test(mark['data-opf-path'] ?? '') && /^#[0-9A-Fa-f]{6}$/.test(mark.fill ?? ''))?.fill;
    const expected = [label, slide.design.colors.textSecondary, slide.design.colors.text].filter(Boolean).map((ink) => chartHighlightColors(surface, slide.design.colors.primary, ink).muted.toUpperCase());
    assert.ok(expected.includes(plainMuted[0].toUpperCase()), `a chart without bands keeps today's muted color (${name}: ${plainMuted[0]}, expected one of ${expected.join(', ')})`);
  }
  console.log(`FR-07 (3a) muted color of a highlighted chart with bands over ${combos.length} combinations: lowest against a band ${lowest.ratio.toFixed(2)}:1 (${lowest.name}, ${lowest.what}); lowest against the surface ${surfaceLowest.ratio.toFixed(2)}:1 (${surfaceLowest.name}, ${surfaceLowest.what})`);
  assert.ok(lowest.ratio >= 1.5 - 1e-6, `(3a) the muted color keeps 1.5:1 from every band: ${lowest.ratio.toFixed(3)}:1 (${lowest.name}, ${lowest.what})`);
  checks += 2;
}

// (3b) Every default series color against every default band, in OKLab distance.
{
  const pairs = [];
  const columns = ['Q', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  for (const design of combos) {
    const name = `${design.theme} ${design.colorScheme} ${design.variant}`;
    const input = deck({ type: 'column', legend: 'none', data: { columns, rows: [['Q1', 1, 2, 3, 4, 5, 6]] }, bands: BANDS }, design);
    const all = marks(toSvg(input, 1, { trace: true })), bands = bandFills(all);
    const series = columns.slice(1).map((_, j) => all.find((mark) => mark.tag === 'rect' && mark['data-opf-path'] === `slides.0.chart.data.rows.0.${j + 1}`)?.fill);
    assert.ok(series.every(Boolean), `every series is drawn (${name})`);
    series.forEach((fill, j) => bands.forEach((band, k) => pairs.push({ d: distance(fill, band), name, what: `series ${j + 1} ${fill} on band ${k} ${band}` })));
  }
  pairs.sort((a, b) => a.d - b.d);
  console.log(`FR-07 (3b) series colors against bands over ${combos.length} combinations, the five nearest pairs (OKLab distance):\n${pairs.slice(0, 5).map((pair) => `  ${pair.d.toFixed(3)} ${pair.name}: ${pair.what}`).join('\n')}`);
  const near = pairs.filter((pair) => pair.d < 0.08);
  console.log(`FR-07 (3b) pairs below 0.08: ${near.length}${near.length ? `\n${near.map((pair) => `  ${pair.d.toFixed(3)} ${pair.name}: ${pair.what}`).join('\n')}` : ''}`);
  assert.ok(pairs[0].d >= 0.05, `(3b) every default series color is at least 0.05 from every default band: ${pairs[0].d.toFixed(3)} (${pairs[0].name}, ${pairs[0].what})`);
  checks += 1;
}
console.log(`FR-07 band contrast: ${checks} checks`);
