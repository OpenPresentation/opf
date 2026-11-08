// RR-105 (opf#1127): native wrapped titles need the same two-sided 1% safety margin as native bodies. Core balances titles, so
// their native box may need narrowing to keep PowerPoint from taking up a word. No font size, source text or alignment changes.
import assert from 'node:assert/strict';
import {unzipSync, strFromU8} from 'fflate';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {examples} from '@openpresentation/opf/examples';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {catalogs, fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {slideTemplate} from '../src/template-layouts.js';
import {nativeTitleWrapBox, nativeWrapWidths, WRAP_MARGIN} from '../src/native-body.js';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const measurement = fonts.textMeasurement, EMU = 9525;
const compose = (deck, index) => {
  const context = resolveSlideContext(deck, index, {catalogs, fonts});
  return {context, geometry: composeSlide(context.slide, context.options)};
};
const eligible = item => item.field === 'title' && typeof item.value === 'string' && item.value.trim() && !/[\r\n]/.test(item.value)
  && item.text?.lines?.length > 1 && !item.text.overflow && !item.text.richLines && !item.text.directions?.includes('rtl')
  && !item.text.sourceLines?.some(line => line.boundary === 'hard' || line.segments?.some(segment => segment.kind === 'tab'));
const checked = [], fallbacks = [];
let unsafeBefore = 0;
for (const {file, deck} of examples) {
  for (const index of deck.slides.keys()) {
    const {context, geometry} = compose(deck, index);
    if (!(slideTemplate(context) || context.slide.layout === undefined || context.slide.layout === 'auto' || geometry.recomposed !== undefined)) continue;
    for (const item of geometry.items.filter(eligible)) {
      const widths = nativeWrapWidths(item, [item.value], false, measurement), wrap = nativeTitleWrapBox(item, geometry, measurement);
      const where = `${file} slide ${index + 1}`, entry = {file, deck, index, item, geometry, widths, wrap};
      assert.ok(widths, `${where}: title lines retain the source words`);
      if (!wrap) { fallbacks.push(entry); continue; }
      const need = WRAP_MARGIN * item.box.width;
      assert.ok(wrap.width - widths.widest >= need - 1e-6, `${where}: widest line keeps 1% free`);
      assert.ok(widths.unbroken - wrap.width >= need - 1e-6, `${where}: a next word still overruns by 1%`);
      const area = geometry.headingAreas?.find(area => area.name === 'title' && !area.collapsed)?.box ?? geometry.contentBox;
      assert.ok(wrap.x >= Math.max(0, area?.x ?? item.box.x) - 1e-6, `${where}: inside title area's left edge`);
      assert.ok(wrap.x + wrap.width <= Math.min(geometry.width, (area?.x ?? item.box.x) + (area?.width ?? item.box.width)) + 1e-6, `${where}: inside right edge`);
      const factor = item.alignment === 'center' ? .5 : item.alignment === 'right' ? 1 : 0;
      assert.ok(Math.abs(wrap.x + wrap.width * factor - (item.box.x + item.box.width * factor)) < 1e-6, `${where}: alignment anchor retained`);
      if (item.box.width - widths.widest < need || widths.unbroken - item.box.width < need) unsafeBefore++;
      checked.push(entry);
    }
  }
}
assert.ok(checked.length >= 49, `${checked.length} native titles checked`);
assert.ok(unsafeBefore >= 31, `${unsafeBefore} exact-width titles violated the margin before`);
assert.ok(fallbacks.some(entry => entry.file.endsWith('layout-sampler.opf.json') && entry.index === 0), 'balanced pilot title cannot retain its line breaks at any native width');

// Actual XML for all three alignments and a tight fallback. Retain each example's design, canvas and catalog references.
const picks = ['employee-town-hall-run-of-show', 'pricing-and-packaging-decision', 'product-roadmap-decision-review']
  .map(name => checked.find(entry => entry.file.endsWith(`${name}.opf.json`) && entry.index === 0));
assert.deepEqual(picks.map(entry => entry.item.alignment), ['center', 'right', 'left']);
for (const entry of [...picks, fallbacks.find(entry => entry.file.endsWith('layout-sampler.opf.json') && entry.index === 0)]) {
  const deck = {...entry.deck, slides: [entry.deck.slides[entry.index]]}, diagnostics = [];
  const bytes = new Uint8Array(await toPptx(deck, {fonts, bodyText: 'native', onDiagnostic: value => diagnostics.push(value)}));
  const xml = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const titles = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => shape.includes('name="OPF heading slides.0.title line '));
  if (!entry.wrap) {
    assert.equal(titles.length, entry.item.text.lines.length, 'tight wrap keeps the measured title lines');
    assert.ok(!titles.some(shape => /<p:ph\b/.test(shape)), 'a measured line does not bind as the whole title');
    assert.ok(diagnostics.some(value => value.code === 'native-body-fallback' && value.reason === 'tight-wrap' && value.path === 'slides.0.title'));
  } else {
    assert.equal(titles.length, 1, 'one coherent native title');
    const [shape] = titles, [, x, , width] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shape).map(Number);
    assert.ok(Math.abs(x / EMU - entry.wrap.x) < .001 && Math.abs(width / EMU - entry.wrap.width) < .001, 'written frame uses the safe wrap width');
    assert.match(shape, /<p:ph type="(?:ctrTitle|title)"\/>/);
    assert.match(shape, /<a:noAutofit\/>/);
    assert.ok(!/normAutofit|spAutoFit/.test(shape));
    assert.ok([...shape.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].every(match => Number(match[1]) === Math.round(entry.item.text.fontSize * 75)), 'font size retained');
    const align = {left: 'l', center: 'ctr', right: 'r'}[entry.item.alignment];
    assert.match(shape, new RegExp(`<a:pPr\\b[^>]*algn="${align}"`));
    assert.ok(!diagnostics.some(value => value.code === 'native-body-fallback' && value.path === 'slides.0.title'));
  }
  const imported = await fromPptx(bytes);
  assert.equal(imported.slides[0].title, entry.item.value, 'source title survives import');
}
console.log(`RR-105: ${checked.length} native titles keep a 1% margin on both sides (${unsafeBefore} unsafe at the exact width); ${fallbacks.length} keep measured lines. Written XML preserves all three alignment anchors, size and source text.`);
