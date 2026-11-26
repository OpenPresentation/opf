// FR-07 (CR 5): the band contrast checks over every gallery color scheme, light and dark. Check (3) does not hold with the neutrals the
// supervisor set (1.75, 1.45, 1.25 against the surface); it stays strict in a file of its own so the rest of the suite runs.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { chartBandFill, colorContrast } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const marks = (svg) => [...svg.matchAll(/<(rect|line|polyline|path|circle)\b([^>]*)>/g)].map(([, tag, a]) => ({ tag, ...attributesOf(a) }));
const num = (value) => Number(value);
let checks = 0;
const deck = (chart, extra = {}) => ({ design: { fontScheme: 'roboto' }, ...extra, slides: [{ title: 'Wait time', chart: { alt: 'Wait time by week.', ...chart } }] });
// The bands over every gallery color scheme, light and dark: (1) each default neutral differs from the surface and from the next band by at least
// 1.15:1; (2) each band's label (inside the band, owner's "1B") keeps 4.5:1 against its own band; (3) a band never takes a
// mark below 80% of the contrast it has against the bare surface. The lowest value of each is printed for the supervisor.
{
  const schemes = readdirSync(new URL('../../gallery/catalog/color-schemes/', import.meta.url)).filter((file) => file !== 'index.json').map((file) => file.replace(/\.json$/, ''));
  const worst = { visible: { ratio: Infinity }, text: { ratio: Infinity }, marks: { ratio: Infinity } };
  const note = (check, ratio, detail) => { if (ratio < worst[check].ratio) worst[check] = { ratio, ...detail }; };
  for (const colorScheme of schemes) for (const variant of ['light1', 'dark1']) {
    const input = deck({ type: 'column', legend: 'none', data: { columns: ['Q', 'A', 'B', 'C'], rows: [['Q1', 1, 1, 1], ['Q2', 2, 1, 2]] }, bands: [{ to: 4, label: 'Low' }, { to: 8, label: 'Mid' }, { to: 12, label: 'High' }] }, { design: { fontScheme: 'roboto', theme: 'classic', colorScheme, variant } });
    const slide = resolvePresentation(input).slides[0], surface = slide.design.backgroundColor ?? slide.design.colors.background;
    const svg = toSvg(input, 1, { trace: true }), all = marks(svg);
    const bands = [0, 1, 2].map((k) => all.find((mark) => mark.tag === 'rect' && mark['data-opf-path'] === `slides.0.chart.bands.${k}`).fill);
    const fills = [...new Set(all.filter((mark) => mark.tag === 'rect' && /\.data\.rows\.\d+\.\d+$/.test(mark['data-opf-path'] ?? '')).map((mark) => mark.fill))];
    // The text inside the plot: data labels (on a data row) and the reference label; the axis text stands outside the plot.
    const inks = [0, 1, 2].map((k) => /\bfill="(#[0-9A-Fa-f]{6})/.exec([...svg.matchAll(/<text\b[^>]*>/g)].map(([tag]) => tag).find((tag) => tag.includes(`data-opf-path="slides.0.chart.bands.${k}.label"`)) ?? '')?.[1]);
    assert.ok(inks.every(Boolean), `every band label is drawn inside its band (${colorScheme} ${variant})`);
    bands.forEach((band, k) => {
      note('visible', colorContrast(band, surface), { colorScheme, variant, what: `band ${k} ${band} on surface ${surface}` });
      if (k) note('visible', colorContrast(band, bands[k - 1]), { colorScheme, variant, what: `band ${k} ${band} beside band ${k - 1} ${bands[k - 1]}` });
    });
    inks.forEach((ink, k) => { note('text', colorContrast(ink, bands[k]), { colorScheme, variant, what: `label ${ink} on band ${k} ${bands[k]}` }); });
    for (const fill of fills) for (const band of bands) note('marks', colorContrast(fill, band) / colorContrast(fill, surface), { colorScheme, variant, what: `mark ${fill}: ${colorContrast(fill, band).toFixed(2)}:1 on band ${band}, ${colorContrast(fill, surface).toFixed(2)}:1 on surface ${surface}` });
  }
  const line = (check, unit) => `${worst[check].ratio.toFixed(2)}${unit} (${worst[check].colorScheme} ${worst[check].variant}, ${worst[check].what})`;
  console.log(`FR-07 bands over ${schemes.length} schemes, light and dark: (1) lowest band step ${line('visible', ':1')}; (2) lowest band label on its band ${line('text', ':1')}; (3) lowest kept share of a mark's contrast ${line('marks', '')}`);
  assert.ok(worst.visible.ratio >= 1.15, `(1) bands visible: ${line('visible', ':1')}`);
  assert.ok(worst.text.ratio >= 4.5, `(2) a band label on its band: ${line('text', ':1')}`);
  assert.ok(worst.marks.ratio >= 0.8, `(3) marks over a band: ${line('marks', '')}`);
  checks += 3;
}
console.log(`FR-07 band contrast: ${checks} checks`);
