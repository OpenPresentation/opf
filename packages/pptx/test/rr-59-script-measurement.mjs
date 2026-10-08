import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {renderSvg, resolvePresentation} from '@openpresentation/opf-render';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = shape => array(shape['p:txBody']?.['a:p']).map(p => array(p['a:r']).map(run => run['a:t'] ?? '').join('')).join('\n');
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .002, `${label}: ${actual} vs ${expected}`);
const cases = [
  {language: 'ar-SA', slides: [{title: 'مراجعة ربع سنوية', subtitle: 'Revenue 2026'}]},
  {language: 'ar-SA', slides: [{title: 'Revenue مراجعة 2026', subtitle: 'Latin supporting text', text: 'الإيرادات Revenue والنمو Growth'}]},
  {language: 'en-US', slides: [{title: 'Run language', text: ['Latin ', {text: 'مراجعة ربع سنوية', lang: 'ar-SA', bold: true}, ' end.']}]},
  {language: 'ar-SA', slides: [{title: 'مراجعة ربع سنوية'}, {design: {fontScheme: 'traditional-arabic'}, title: 'مراجعة مالية', text: 'الإيرادات والنمو'}]},
];
for (const deck of cases) {
  const fonts = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck});
  // The handle remains glyph-strict: script segmentation fixes the family selection, never disables glyph validation.
  assert.throws(() => fonts.textMeasurement.measure('م', 24, {fontFamily: 'Aptos Display', fontWeight: 700}), error => error.code === 'missing-glyph');
  assert.equal(renderSvg(deck, {fonts}).length, deck.slides.length);
  const bound = resolvePresentation(deck, {fonts});
  const diagnostics = [];
  const bytes = await toPptx(deck, {fonts, onDiagnostic: issue => diagnostics.push(issue)});
  const entries = unzipSync(bytes);
  for (let index = 0; index < deck.slides.length; index++) {
    const xml = strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
    const shapes = array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']).filter(shape => text(shape));
    const expected = bound.slides[index].geometry.items.flatMap(item => item.text.placement.lines.map((placed, line) => ({item, placed, line})));
    assert.equal(shapes.length, expected.length, 'one native text shape per shared accepted line');
    for (const [position, shape] of shapes.entries()) {
      const {item, placed, line} = expected[position];
      const transform = shape['p:spPr']['a:xfrm'];
      near(Number(transform['a:off'].y) / 9525, placed.y ?? placed.baseline - item.text.fontSize, 'shared line top');
      near(Number(transform['a:ext'].cy) / 9525, placed.height, 'shared line height');
      assert.equal(text(shape), item.text.lines[line], 'authored Arabic/Latin accepted text stays editable');
      const runs = array(shape['p:txBody']['a:p']).flatMap(p => array(p['a:r']));
      for (const run of runs) near(Number(run['a:rPr'].sz) / 100, item.text.fontSize * .75, 'shared font size');
    }
    const profile = resolveScriptFonts(deck, {slideIndex: index});
    if (profile.sources.complexScript !== 'latin') assert.ok(Object.entries(entries).filter(([name]) => /^ppt\/theme\//.test(name)).some(([, value]) => strFromU8(value).includes(`<a:cs typeface="${profile.heading.complexScript}"`)), `native theme keeps the selected complex-script slot: ${deck.language} ${index}`);
    if (deck.language === 'en-US') assert.match(xml, /lang="ar-SA"[^>]*>[\s\S]*?<a:cs typeface="[^"]+"/, 'a rich Arabic run retains its native language/script slots');
    assert.ok(!xml.includes('<a:latin typeface="Intos'), 'native Latin names never become preview replacement names');
  }
  const imported = await fromPptx(bytes);
  for (let index = 0; index < deck.slides.length; index++) {
    assert.equal(imported.slides[index].title, deck.slides[index].title);
    if (typeof deck.slides[index].text === 'string') assert.equal(imported.slides[index].text, deck.slides[index].text);
  }
  assert.ok(!diagnostics.some(issue => issue.code === 'language-export-unavailable'));
}
console.log('RR-59 script measurement: ar-SA, mixed Arabic/Latin, rich run language and slide scheme overrides export with strict pinned fonts and shared line geometry. Native raster parity is separate.');
