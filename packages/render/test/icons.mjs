// LH-14 in the preview: core's icons on their chips. A monochrome glyph is SVG paths in core's glyph color (a stroke icon stroked with
// round caps and joins, unfilled) over a circle in core's chip color, at core's geometry; a multicolor SVG icon is an <image> with no
// chip; a slide without icons draws none. Traced icons name their field, not data-opf-path.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {composeSlide, ensureIcons} from '@openpresentation/opf/composition';
import {resolveSlideContext} from '@openpresentation/opf';
import {toSvg} from '../dist/index.js';

const MULTI = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="10" fill="#f00"/><rect x="5" width="5" height="10" fill="#00f"/></svg>';
const deck = {
  name: 'Icons', language: 'en', design: {background: 'light1'}, icons: {multi: MULTI},
  slides: [
    {title: 'What is new', items: [{text: 'Offline mode', description: 'Keep working without a connection.', icon: 'lucide:wifi-off'}, {text: 'Faster search', description: 'Results in 200 ms.', icon: 'lucide:search'}]},
    {title: 'Partners', blocks: [{icon: 'multi', blocks: [{text: 'Gold'}, {text: 'Co-selling and joint roadmaps.'}]}, {icon: 'lucide:handshake', blocks: [{text: 'Referral'}, {text: 'A share of first-year revenue.'}]}]},
    {title: 'Plain', items: ['One', 'Two']},
  ],
};
await ensureIcons(deck, {catalogs: [gallery]});
const [first, second, plain] = toSvg(deck, {catalogs: [gallery], trace: true});
const context = resolveSlideContext(deck, 0, {catalogs: [gallery]}), composed = composeSlide(context.slide, context.options);
let checks = 0;
for (const icon of composed.icons) {
  const group = new RegExp(`<g data-opf-icon="${icon.path.replaceAll('.', '\\.')}"[^>]*>([\\s\\S]*?)</g>`).exec(first)?.[1];
  assert.ok(group, icon.path);
  assert.match(group, new RegExp(`<circle[^>]*fill="${icon.colors.chip.hex}"`, 'i'), 'the chip in core\'s chip color');
  assert.match(group, new RegExp(`<path[^>]*fill="none"[^>]*stroke="${icon.colors.glyph.hex}"[^>]*stroke-linecap="round"`, 'i'), 'a stroked glyph in core\'s glyph color');
  checks += 3;
}
assert.equal(composed.icons.length, 2);
assert.match(second, /<g data-opf-icon="slides\.1\.blocks\.0\.icon"[^>]*><image[^>]*href="data:image\/svg\+xml;base64,/, 'a multicolor icon is a picture');
assert.doesNotMatch(/<g data-opf-icon="slides\.1\.blocks\.0\.icon"[^>]*>([\s\S]*?)<\/g>/.exec(second)[1], /<circle/, 'without a chip');
assert.doesNotMatch(plain, /data-opf-icon/);
checks += 3;
console.log(`icons passed: ${checks} checks (chips and glyphs at core's geometry and colors, a multicolor picture, nothing without icons).`);
