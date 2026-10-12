import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolvePresentation, toSvg} from './catalog-harness.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/gallery-alignment-layouts.json', import.meta.url), 'utf8'));
assert.equal(fixture.layouts.length, 57, 'the 50 partial and 7 gallery-only layouts audit A flagged');

// The 0.19 gallery uses region templates rather than these historical alignment-only IDs.
// Keep the original 57 content/design samples as alignment regressions, dropping their
// obsolete catalog records; actual gallery2 region templates have their own suite.
for (const {document} of fixture.layouts) {
  delete document.catalogs;
  delete document.slides[0].layout;
}

const anchors = {left: 'start', center: 'middle', right: 'end'};
const attribute = (attrs, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
const tokens = text => text.split(/(?=<)/);
// The gallery also derives the layout hints core composes (contentDirection, chartPrimary, listBullet, imageFit);
// they move boxes or change how an image or bullet draws by design, so the default keeps them and drops only what
// is alignment (and the layout itself). FA-22: imageFit ('contain' on the *-fit-* layouts) is one such hint.
// A layout record's own composition.mode ranks above design.contentDirection (the gallery derives the hint from the
// layout's direction), so a layout with a mode ignores the hint and the layout-less default must not apply it either.
const LAYOUT_HINTS = ['contentDirection', 'chartPrimary', 'listBullet', 'imageFit'];
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
  assert.equal(slide.layout, undefined);
  const bound = resolvePresentation(document).slides[0];
  const base = withoutLayout(document, bound.layout?.composition?.mode);
  const baseBound = resolvePresentation(base).slides[0];
  assert.equal(bound.layout, undefined, `${id}: automatic composition has no obsolete layout record`);
  assert.equal(bound.geometry.items.length, baseBound.geometry.items.length, `${id}: alignment adds or drops no composed item`);

  // 1. Core resolves one alignment per item from the gallery design; the
  //    layout leaves every composed box where the default puts it.
  for (const [index, item] of bound.geometry.items.entries()) {
    assert.equal(item.alignment, expectedAlignment(slide, item.field), `${id}: ${item.path} item.alignment`);
    assert.deepEqual(item.box, baseBound.geometry.items[index].box, `${id}: ${item.path} box with and without alignment`);
  }

  // 2. Every traced text anchors at its item's alignment.
  const svg = toSvg(document, 1, {trace: true});
  for (const item of bound.geometry.items.filter(item => item.type === 'text' && typeof item.value === 'string')) {
    const texts = [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].filter(([, attrs]) => attrs.includes(`data-opf-path="${item.path}"`));
    assert.ok(texts.length, `${id}: traced preview text for ${item.path}`);
    for (const [, attrs] of texts) assert.equal(attribute(attrs, 'text-anchor') ?? 'start', anchors[item.alignment], `${id}: ${item.path} preview anchor`);
    traced += texts.length;
  }

  // 3. With and without the layout, the untraced preview differs only in the
  //    text anchor and its x origin: no box, image, marker or path moves.
  const [a, b] = [tokens(toSvg(document, 1)), tokens(toSvg(base, 1))];
  assert.equal(a.length, b.length, `${id}: preview token count`);
  assert.deepEqual(boxes(a.join('')), boxes(b.join('')), `${id}: non-text elements with and without alignment`);
  let changes = 0;
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) {
    assert.match(a[index], /^<(text|tspan)\b/, `${id}: preview difference outside text: ${a[index].slice(0, 120)}`);
    const strip = token => token.replace(/\btext-anchor="\w+"/, '').replace(/\bx="[\d.]+"/, '').replace(/\s+/g, ' ').replace(/ (?=[>/])/g, '');
    assert.equal(strip(a[index]), strip(b[index]), `${id}: preview difference beyond the text anchor: ${a[index].slice(0, 120)}`);
    changes++;
  }
  assert.ok(changes > 0, `${id}: the design changes text alignment in the preview`);
  layoutEffects++;
}
console.log(`Historical content/design alignment passed: ${fixture.layouts.length} samples (source gallery ${fixture.gallery.slice(0, 7)}), ${traced} traced texts at core's item alignment, ${layoutEffects} designs changing only text anchors with every composed box unchanged.`);
