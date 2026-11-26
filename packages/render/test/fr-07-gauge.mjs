// FR-07, part 3 (core docs/content-payloads.md, "Gauges"): the preview draws a metric's gauge from core's plan (metricGaugeDrawing): each arc
// is the blockArc preset's outline at its frame and adjustments, the target a line, the ends' labels text. And the supervisor's contrast check
// (addition 4): over every gallery theme, color scheme and variant, the lowest contrast between the value arc and what it is drawn over (the
// track, and each default neutral band) is printed; it is asserted at 3:1 or more.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { colorContrast, metricGaugeAngle } from '@openpresentation/opf/composition';
import { toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const parts = (svg) => Object.fromEntries([...svg.matchAll(/<(path|line|text)\b([^>]*data-opf-gauge-part[^>]*)>/g)].map(([, tag, a]) => { const attrs = attributesOf(a); return [attrs['data-opf-gauge-part'], { tag, ...attrs }]; }));
const deck = (metric, design = {}) => ({ design: { fontScheme: 'roboto', ...design }, slides: [{ title: 'Utilization', metric }] });

// --- the drawing --------------------------------------------------------------------------------------------------------------------------

{
  const svg = toSvg(deck({ label: 'Net Promoter Score', value: 41, gauge: { min: -100, max: 100, bands: [{ to: 0, label: 'Detractors lead', color: 'accent2' }, { to: 30 }, { to: 100, label: 'Strong', color: 'accent3' }], target: 40 } }), 1, { trace: true });
  const drawn = parts(svg);
  assert.deepEqual(Object.keys(drawn).sort(), ['gauge band 1', 'gauge band 2', 'gauge band 3', 'gauge max', 'gauge min', 'gauge target', 'gauge value']);
  for (const part of ['gauge band 1', 'gauge band 2', 'gauge band 3', 'gauge value']) {
    assert.equal(drawn[part].tag, 'path');
    assert.match(drawn[part].transform, /^translate\(/, 'an arc is drawn in its frame');
  }
  assert.equal(drawn['gauge target'].tag, 'line');
  // The ends' labels, then the value: the arcs are drawn before (under) the metric's text.
  assert.ok(svg.indexOf('data-opf-gauge-part="gauge value"') < svg.indexOf('data-opf-metric-role="value"'));
  assert.ok(/>-100<\/text>/.test(svg) && />100<\/text>/.test(svg), 'the ends are labeled');
  // Angles: 180 at the left end (min), 270 at the top, 0 at the right end (max).
  assert.deepEqual([0, .5, 1, .705].map(metricGaugeAngle), [180, 270, 0, 306.9]);
}

// --- a value outside the range: its arc stops at the end, its number is printed -----------------------------------------------------------

{
  const svg = toSvg(deck({ label: 'Utilization', value: 1.18, format: '0%', gauge: { max: 1 } }), 1, { trace: true });
  assert.ok(svg.includes('118%') || (svg.includes('>118<') && svg.includes('%')), 'the real number is printed');
  assert.ok(parts(svg)['gauge value'], 'the value arc is drawn, clamped to the end');
}

// --- a metric without a number draws no gauge -------------------------------------------------------------------------------------------

{
  const svg = toSvg(deck({ label: 'Utilization', value: '72%', gauge: { max: 1 } }), 1, { trace: true });
  assert.deepEqual(parts(svg), {});
}

// --- contrast: the value arc against the track and each default band, over every theme, color scheme and variant ---------------------------

{
  const catalog = (kind) => readdirSync(new URL(`../../gallery/catalog/${kind}/`, import.meta.url)).filter((file) => file !== 'index.json').map((file) => file.replace(/\.json$/, ''));
  const schemes = catalog('color-schemes'), themes = catalog('themes'), variants = ['light1', 'light2', 'dark1', 'dark2'];
  const combos = themes.flatMap((theme) => schemes.flatMap((colorScheme) => variants.map((variant) => ({ theme, colorScheme, variant }))));
  let lowest = { ratio: Infinity }, classic = { ratio: Infinity }, light = { ratio: Infinity }, track = { ratio: Infinity };
  const under = new Set();
  for (const design of combos) {
    const name = `${design.theme} ${design.colorScheme} ${design.variant}`;
    const note = (ratio, what) => {
      if (ratio < lowest.ratio) lowest = { ratio, name, what };
      if (design.theme === 'classic' && ratio < classic.ratio) classic = { ratio, name, what };
      if (design.theme === 'classic' && design.variant === 'light1' && ratio < light.ratio) light = { ratio, name, what };
      if (ratio < 3) under.add(name);
    };
    // A full gauge over three default bands (the value arc crosses every band), and a gauge without bands (over its track).
    const banded = parts(toSvg(deck({ label: 'Utilization', value: 1, gauge: { max: 1, bands: [{ to: 0.4 }, { to: 0.7 }, { to: 1 }] } }, design), 1, { trace: true }));
    const value = banded['gauge value'].fill;
    for (const band of ['gauge band 1', 'gauge band 2', 'gauge band 3']) note(colorContrast(value, banded[band].fill), `value ${value} on ${band} ${banded[band].fill}`);
    const plain = parts(toSvg(deck({ label: 'Utilization', value: 0.5, gauge: { max: 1 } }, design), 1, { trace: true }));
    const onTrack = colorContrast(plain['gauge value'].fill, plain['gauge track'].fill);
    note(onTrack, `value ${plain['gauge value'].fill} on track ${plain['gauge track'].fill}`);
    if (onTrack < track.ratio) track = { ratio: onTrack, name, what: `value ${plain['gauge value'].fill} on track ${plain['gauge track'].fill}` };
  }
  const line = (entry) => `${entry.ratio.toFixed(2)}:1 (${entry.name}, ${entry.what})`;
  console.log(`FR-07 gauge: lowest value arc contrast over ${combos.length} theme, scheme and variant combinations: ${line(lowest)}; in the classic theme: ${line(classic)}; classic light1: ${line(light)}; on the track alone: ${line(track)}; combinations under 3:1: ${under.size} (${[...under].join(', ')})`);
  assert.ok(lowest.ratio >= 3, `the value arc keeps 3:1 against the track and every default band: ${line(lowest)}`);
}
console.log('fr-07 gauge (render): ok');
