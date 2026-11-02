import assert from 'node:assert/strict';
import {colorContrast, emphasisSurface} from '@openpresentation/opf/composition';
import {resolveSlideContext} from '@openpresentation/opf';
import {defaultCatalog, toSvg} from './catalog-harness.mjs';

// LH-06: the preview draws the emphasis surface (core geometry.emphasis) under the items on it, in core's emphasisSurface fill, and those
// items in the surface's roles: on a light deck a dark card with light text, on a dark deck an accent, every text at 4.5:1 on the fill.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const long = 'Easton University Library should focus the next cycle on shifting the library from stacks-first to research services first.';
const slides = [
  {title: 'Foot band', blocks: [{text: long}, {text: long}, {text: 'Next step: name the pilot lead.'}]},
  {title: 'Pill', blocks: [{text: long}, {text: 'Signal'}]},
  {title: 'Authored', layout: 'scorecard', blocks: [{metric: {value: '$4.8M', label: 'Primary signal', description: 'Shift the library to research services', trend: 'up'}, emphasis: true}, {metric: {value: '11 days', label: 'Primary signal', trend: 'down'}}]},
];
let checked = 0;
for (const design of [{theme: 'classic'}, {theme: 'classic', variant: 'dark1'}, {theme: 'minimal', colorScheme: 'cool-horizon'}]) for (const language of ['en-US', 'ar']) {
  const deck = {name: 'Emphasis', language, design, slides};
  const svgs = toSvg(deck, {trace: true, catalogs: [defaultCatalog]});
  svgs.forEach((svg, index) => {
    const label = `${JSON.stringify(design)} ${language} slide ${index + 1}`;
    const {resolved} = resolveSlideContext(deck, index, {catalogs: [defaultCatalog]});
    const surface = emphasisSurface(resolved.colorScheme, resolved.roles);
    const path = index === 2 ? 'slides.2.blocks.0' : `slides.${index}.blocks.${slides[index].blocks.length - 1}`;
    const rect = [...svg.matchAll(/<rect\b([^>]*)\/?>/g)].map(([, a]) => attrs(a)).find((entry) => entry['data-opf-path'] === path);
    assert.ok(rect, `${label}: the surface is drawn`);
    assert.equal(rect.fill.toUpperCase(), surface.fill, `${label}: in core's fill`);
    const texts = [...svg.matchAll(/<text\b([^>]*)>/g)].map(([, a]) => attrs(a)).filter((entry) => (entry['data-opf-path'] ?? '').startsWith(`${path}.`) && entry.fill);
    assert.ok(texts.length, `${label}: text on the surface`);
    for (const text of texts) assert.ok(colorContrast(text.fill.slice(0, 7), surface.fill) >= 4.5, `${label}: ${text['data-opf-path']} ${text.fill} on ${surface.fill}`);
    checked++;
  });
}
assert.equal(checked, 18);
console.log(`emphasis surface: ${checked} slides`);
