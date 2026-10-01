// FF-51: the gallery layouts that audit A flagged "export shape placement
// ignores layout that changes preview" differ from the no-layout default only
// in text alignment (the gallery derives design.titleAlignment and
// design.contentAlignment from the layout record). The preview must anchor
// every text to core's per-item alignment inside the same box the default
// uses, so the PPTX export, which writes the same alignment inside the same
// box, places every shape exactly as the preview does.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSvg, resolvePresentation} from '../dist/svg.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/gallery-alignment-layouts.json', import.meta.url), 'utf8'));
assert.equal(fixture.layouts.length, 57, 'the 50 partial and 7 gallery-only layouts audit A flagged');

const anchors = {left: 'start', center: 'middle', right: 'end'};
const attribute = (attrs, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
const tokens = text => text.split(/(?=<)/);
// The gallery also derives the layout hints core composes (contentDirection, chartPrimary, listBullet);
// they move boxes by design, so the default keeps them and drops only what is alignment (and the layout itself).
// A layout record's own composition.mode ranks above design.contentDirection (the gallery derives the hint from the
// layout's direction), so a layout with a mode ignores the hint and the layout-less default must not apply it either.
const LAYOUT_HINTS = ['contentDirection', 'chartPrimary', 'listBullet'];
const withoutLayout = (document, layoutMode) => {
  const base = structuredClone(document), design = document.slides[0].design ?? {};
  delete base.slides[0].layout; delete base.slides[0].design; delete base.slides[0].composition; delete base.catalogs;
  const hints = Object.fromEntries(LAYOUT_HINTS.filter(key => design[key] !== undefined && !(key === 'contentDirection' && layoutMode)).map(key => [key, design[key]]));
  if (Object.keys(hints).length) base.slides[0].design = hints;
  return base;
};
// The alignment the gallery design asks for, restated independently of core.
const expectedAlignment = (slide, field) => (field === 'title' ? slide.design?.titleAlignment : slide.design?.contentAlignment) ?? 'left';
const boxes = svg => [...svg.matchAll(/<(rect|image|circle|path|line)\b[^>]*>/g)].map(([token]) => token);

let traced = 0, layoutEffects = 0;
for (const {id, document} of fixture.layouts) {
  const slide = document.slides[0];
  assert.equal(slide.layout, id);
  const bound = resolvePresentation(document).slides[0];
  const base = withoutLayout(document, bound.layout?.composition?.mode);
  const baseBound = resolvePresentation(base).slides[0];
  assert.equal(bound.layout?.id, id, `${id}: the preview resolves the layout`);
  assert.equal(bound.geometry.items.length, baseBound.geometry.items.length, `${id}: the layout adds or drops no composed item`);

  // 1. Core resolves one alignment per item from the gallery design; the
  //    layout leaves every composed box where the default puts it.
  for (const [index, item] of bound.geometry.items.entries()) {
    assert.equal(item.alignment, expectedAlignment(slide, item.field), `${id}: ${item.path} item.alignment`);
    assert.deepEqual(item.box, baseBound.geometry.items[index].box, `${id}: ${item.path} box with and without the layout`);
  }

  // 2. Every traced text anchors at its item's alignment.
  const svg = renderSvg(document, {slideIndex: 0, trace: true});
  for (const item of bound.geometry.items.filter(item => item.type === 'text' && typeof item.value === 'string')) {
    const texts = [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].filter(([, attrs]) => attrs.includes(`data-opf-path="${item.path}"`));
    assert.ok(texts.length, `${id}: traced preview text for ${item.path}`);
    for (const [, attrs] of texts) assert.equal(attribute(attrs, 'text-anchor') ?? 'start', anchors[item.alignment], `${id}: ${item.path} preview anchor`);
    traced += texts.length;
  }

  // 3. With and without the layout, the untraced preview differs only in the
  //    text anchor and its x origin: no box, image, marker or path moves.
  const [a, b] = [tokens(renderSvg(document, {slideIndex: 0})), tokens(renderSvg(base, {slideIndex: 0}))];
  assert.equal(a.length, b.length, `${id}: preview token count`);
  assert.deepEqual(boxes(a.join('')), boxes(b.join('')), `${id}: non-text elements with and without the layout`);
  let changes = 0;
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) {
    assert.match(a[index], /^<(text|tspan)\b/, `${id}: preview difference outside text: ${a[index].slice(0, 120)}`);
    const strip = token => token.replace(/\btext-anchor="\w+"/, '').replace(/\bx="[\d.]+"/, '').replace(/\s+/g, ' ').replace(/ (?=[>/])/g, '');
    assert.equal(strip(a[index]), strip(b[index]), `${id}: preview difference beyond the text anchor: ${a[index].slice(0, 120)}`);
    changes++;
  }
  assert.ok(changes > 0, `${id}: the layout changes text alignment in the preview`);
  layoutEffects++;
}
console.log(`Gallery layout alignment passed: ${fixture.layouts.length} flagged layouts (pptx-gallery ${fixture.gallery.slice(0, 7)}), ${traced} traced texts at core's item alignment, ${layoutEffects} layouts changing only the text anchor with every composed box unchanged.`);
