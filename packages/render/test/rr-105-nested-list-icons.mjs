// RR-105 (coverage finding 05): the preview draws the chips of a nested list's first-level entries at core's geometry, and the nested
// entries' bullets; a flat list of the same first-level entries draws the same chips.
import assert from 'node:assert/strict';
import { composeSlide } from '@openpresentation/opf/composition';
import { resolveSlideContext } from '@openpresentation/opf';
import { toSvg } from '../dist/index.js';

const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const deck = {
  icons: { mark: MARK },
  slides: [{ title: 'Icons', items: [{ text: 'Alpha', icon: 'mark' }, { text: 'Beta', level: 1, icon: 'mark' }, { text: 'Gamma', level: 1 }, { text: 'Delta', icon: 'mark' }] }],
};
const svg = toSvg(deck, 1, { trace: true });
const context = resolveSlideContext(deck, 0), composed = composeSlide(context.slide, context.options);
assert.equal(composed.icons.length, 2);
for (const icon of composed.icons) {
  const group = new RegExp(`<g data-opf-icon="${icon.path.replaceAll('.', '\\.')}"[^>]*>([\\s\\S]*?)</g>`).exec(svg)?.[1];
  assert.ok(group, icon.path);
  const circle = /<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"/.exec(group);
  assert.ok(circle, `${icon.path}: chip`);
  assert.ok(Math.abs(Number(circle[1]) - icon.chip.cx) < 0.01 && Math.abs(Number(circle[2]) - icon.chip.cy) < 0.01, `${icon.path}: at core's center`);
}
assert.doesNotMatch(svg, /data-opf-icon="slides\.0\.items\.1\.icon"/, 'the nested icon is not drawn');
// The nested entries' bullet (the level-1 dash) is drawn.
assert.equal((svg.match(/>–<\/t(?:span|ext)>/g) ?? []).length, 2, 'two nested bullets');
console.log('RR-105 nested list icons: preview checks passed.');
