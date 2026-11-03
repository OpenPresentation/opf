// LH wave 4 (review of the golden run): a funnel or other chartex construct takes the context gray only for a focus the slide names
// (LH-105, LH-113). With no focus its stages keep the scheme's series color; a funnel drawn in gray is the scheme's own gray
// (black-and-white's accent1 is #939393), not a context color.
import assert from 'node:assert/strict';
import { toSvg } from './catalog-harness.mjs';

const fills = (svg, path) => [...svg.matchAll(/<rect\b[^>]*>/g)].map(([tag]) => tag).filter((tag) => tag.includes(`data-opf-path="${path}`)).map((tag) => /fill="(#[0-9A-Fa-f]{6})"/.exec(tag)?.[1]).filter(Boolean);
const gray = (hex) => { const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) < 12; };
const funnel = { type: 'funnel', data: { columns: ['Stage', 'Accounts'], rows: [['Visited', 1200], ['Trial', 640], ['Qualified', 310], ['Won', 120]] } };
let checks = 0;
for (const colorScheme of ['cool-horizon', 'black-and-white']) {
  const deck = { design: { theme: 'classic', colorScheme, fontScheme: 'roboto' }, slides: [{ title: 'Pipeline by stage', blocks: [{ chart: funnel }, { quote: { text: 'Teams already know where the friction is.', attribution: 'Program sponsor' } }] }] };
  const svg = toSvg(deck, 1, { trace: true }), stages = fills(svg, 'slides.0.blocks.0.chart.data.rows.');
  assert.ok(stages.length >= 4, `${colorScheme}: ${stages.length} stage fills`);
  if (colorScheme === 'black-and-white') assert.ok(stages.every(gray), `${colorScheme}: the scheme is gray, so are its stages`);
  else assert.ok(stages.every((hex) => !gray(hex)), `${colorScheme}: no focus, no context gray (${stages})`);
  checks += 2;
}
console.log(`LH wave 4 funnel colors passed: ${checks} checks (a funnel without a focus keeps the scheme's series color).`);
