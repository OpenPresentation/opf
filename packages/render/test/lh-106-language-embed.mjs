// LH-106: embedding a slide's selected script scheme preserves the exact catalog-backed drawing.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {embed, validate} from '@openpresentation/opf';
import {resolveScriptFonts} from '@openpresentation/opf/composition';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '../dist/fonts-node.js';
import {toSvg, resolvePresentation} from '../dist/svg.js';
const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const originals = [];
for (const file of ['multilingual-slides', 'localized-timeline']) {
  const portable = JSON.parse(await fs.readFile(new URL('../../../examples/technical/' + file + '.opf.json', import.meta.url), 'utf8'));
  assert.deepEqual(validate(portable, {catalogs: []}).findings.filter(finding => finding.ruleId === 'opf/unresolved-reference'), [], file + ': public example is standalone');
  const authored = structuredClone(portable); delete authored.catalogs;
  originals.push({name: file, document: authored});
}
for (const scope of ['deck', 'slide']) {
  const language = {bcp47: 'ar-SA', fontScheme: 'noto-sans-arabic', googleFontScheme: 'noto-sans-arabic'};
  originals.push({name: scope + '-language', document: {language: scope === 'deck' ? language : 'en-US', design: {fontScheme: 'aptos'}, slides: [{...(scope === 'slide' ? {language} : {}), title: 'لغة الشريحة تحدد اتجاهها', text: 'تحتفظ الشريحة بخط العربية المختار'}]}});
}
for (const {name, document} of originals) {
  await fonts.ensure(document);
  const result = embed(document, {catalogs: [gallery]});
  assert.deepEqual(result.unresolved, [], name);
  assert.deepEqual(validate(result.document, {catalogs: []}).findings.filter(finding => finding.ruleId === 'opf/unresolved-reference'), [], name);
  assert.deepEqual(toSvg(result.document, {fonts, catalogs: []}), toSvg(document, {fonts, catalogs: [gallery]}), name + ': exact SVG without registered catalogs');
  const index = name === 'multilingual-slides' ? 1 : 0;
  if (name !== 'localized-timeline') {
    assert.equal(resolveScriptFonts(result.document, {catalogs: [], slideIndex: index}).heading.complexScript, 'Noto Naskh Arabic', name + ': preserve selected script face');
    const item = resolvePresentation(result.document, {fonts, catalogs: []}, {slides: [index]}).slides[index].geometry.items.find(item => item.field === 'title');
    assert.equal(item.text.fontSize, 54, name + ': intended core title size');
    assert.equal(Number(/font-size="([^"]+)"/.exec(toSvg(result.document, index + 1, {fonts, catalogs: []}))[1]), 54, name + ': serialized SVG keeps the selected font at 54px');
  }
}
console.log('LH-106: deck/slide language schemes and both portable public examples preserve exact standalone SVGs and selected Arabic font/54px size.');
