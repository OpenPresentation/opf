// LH-106: the preview draws every number OPF generates in the numbering system of the slide's language, and the per-script font loading
// (`scripts: 'auto'`, `fonts.ensure`, `fonts.pending`) offers the faces of those digits even when no authored character is in their
// script: an ar-SA deck titled "T" with the metric 1000 threw OPFFontError missing-glyph in v0.33.0.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {toSvg} from '../dist/index.js';
import {autoScriptSelection, detectPresentationScripts, loadFonts} from '../dist/fonts-node.js';
import {gallery} from '@openpresentation/gallery';

const catalogs = [gallery];
const deck = (language, value = 1000) => ({language, slides: [{title: 'T', metric: {value, label: 'L'}}, {title: 'T', metric: {value: 999, label: 'L'}}]});
const drawn = svg => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(match => match[1].replace(/<[^>]+>/g, '').replace(/[⁦-⁩]/g, ''));

test('LH-106: the digits a slide generates choose its script faces, not only its authored text', () => {
  for (const [language, scripts] of [['ar-SA', ['Arab']], ['fa-IR', ['Arab']], ['bn-BD', ['Beng']], ['ar-AE', []], ['ar-SA-u-nu-latn', []], ['ar-AE-u-nu-arab', ['Arab']], ['hi-IN', []], ['en-US', []]]) {
    assert.deepEqual(detectPresentationScripts(deck(language)), [], `${language}: the authored text has no script of its own`);
    assert.deepEqual(autoScriptSelection(deck(language)).scripts, scripts, language);
  }
  // A slide's own language decides; a deck in Latin digits with one Saudi slide offers the Arabic faces for that slide.
  const mixed = {language: 'en-US', slides: [{title: 'T', metric: 1000}, {title: 'T', metric: 1000, language: 'ar-SA'}]};
  assert.deepEqual(autoScriptSelection(mixed).scripts, ['Arab']);
});

test('LH-106: an ar-SA deck without Arabic text renders its generated digits (no missing-glyph)', async () => {
  for (const [language, values] of [['ar-SA', ['١,٠٠٠', '٩٩٩']], ['fa-IR', ['۱٬۰۰۰', '۹۹۹']], ['ar-SA-u-nu-latn', ['1,000', '999']], ['de-DE', ['1.000', '999']]]) {
    const document = deck(language), fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: document, renderOptions: {catalogs}});
    try {
      const svgs = toSvg(document, {catalogs, fonts});
      assert.ok(drawn(svgs[0]).includes(values[0]), `${language} ${values[0]}`);
      assert.ok(drawn(svgs[1]).includes(values[1]), `${language} ${values[1]}`);
    } finally { fonts.dispose?.(); }
  }
});

test('LH-106: fonts.ensure loads the digits a slide language added in place', async () => {
  const document = deck('en-US'), fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: document, renderOptions: {catalogs}});
  try {
    assert.deepEqual(fonts.registry.scriptSelection.scripts, []);
    document.slides[0].language = 'ar-SA';
    assert.ok(fonts.pending(document, {catalogs}).some(name => name.includes('arabic')), 'the Arabic face is pending');
    await fonts.ensure(document, {renderOptions: {catalogs}});
    assert.deepEqual(fonts.pending(document, {catalogs}), []);
    assert.ok(drawn(toSvg(document, {catalogs, fonts})[0]).includes('١,٠٠٠'));
  } finally { fonts.dispose?.(); }
});
