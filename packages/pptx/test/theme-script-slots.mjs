import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import * as opf from '@openpresentation/opf';
import {examples} from '@openpresentation/opf/examples';
import {resolvePresentation} from '@openpresentation/opf-render';
import {fromPptx, toPptx, inventoryPptxTypefaces} from '../dist/index.js';

// FF-49 / FF-50 (font-fidelity-everywhere). The presentation theme's major and minor `a:ea` / `a:cs` typefaces follow
// Office's convention and the owner font policy (the PPTX names what the author selected and nothing else):
// - a slot is written only when a script font is actually selected for it (an explicit `eastAsian`/`complexScript`
//   on the design font scheme, the scheme's own script family, or the language's script font, Model C);
// - every other slot stays empty, exactly as in Office's own themes, so PowerPoint picks its per-language default;
// - the language never changes the theme's latin fonts.
// The preview resolves the same slots (opf-render's per-slide script profile): equal to the theme where the theme
// names a family, and the latin family where the theme is empty. Export is deterministic; re-import keeps the
// scheme and language.

const {catalogs, resolveScriptFonts} = opf;
const slide = text => ({title: text, text});
const deck = (fontScheme, language, extra = {}) => ({name: 'Theme slots', ...(language === undefined ? {} : {language}), ...(fontScheme === undefined ? {} : {design: {fontScheme}}), ...extra, slides: [slide('Heading'), {title: 'Second', items: ['One', 'Two']}]});

const exported = async (presentation, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(presentation), {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {bytes, diagnostics, inventory: inventoryPptxTypefaces(bytes)};
};
// The presentation package's own theme (prefix ''), slots as {latin, ea, cs}.
const theme = inventory => ({major: inventory.themes[''].major, minor: inventory.themes[''].minor});
const previewProfile = presentation => resolvePresentation(structuredClone(presentation)).slides[0].scriptFonts.profile;
const SLOTS = [['ea', 'eastAsian'], ['cs', 'complexScript']];
// What the resolver says was actually selected for each slot: its family, or '' when nothing was.
const supplied = (resolved, role, key) => resolved.sources[key] === 'latin' ? '' : resolved[role][key];

const fontSchemeIds = catalogs.fontSchemes.map(record => record.id);
assert.ok(fontSchemeIds.length >= 89, 'the bundled catalog has the 89 upstream font schemes');

// 1. Every font scheme in the default language selects no script font: ea and cs stay empty (as Office's themes),
// latin is the scheme's family, and the preview's ea/cs slots repeat latin.
for (const record of catalogs.fontSchemes) {
  const {inventory, diagnostics} = await exported(deck(record.id));
  const {major, minor} = theme(inventory);
  assert.deepEqual({major, minor}, {major: {latin: record.major, ea: '', cs: ''}, minor: {latin: record.minor, ea: '', cs: ''}}, `${record.id}: theme names latin only`);
  assert.deepEqual(diagnostics.filter(diagnostic => /script|language/.test(diagnostic.code)), [], `${record.id}: no script diagnostics`);
  const profile = previewProfile(deck(record.id));
  assert.deepEqual([profile.heading.latin, profile.heading.eastAsian, profile.heading.complexScript], [record.major, record.major, record.major], `${record.id}: preview heading slots`);
  assert.deepEqual([profile.body.latin, profile.body.eastAsian, profile.body.complexScript], [record.minor, record.minor, record.minor], `${record.id}: preview body slots`);
}

// 2. Schemes x languages: Latin-only, CJK, Arabic, Hebrew, Indic, Thai and the Latin-slot scripts that keep their font in the
// per-script entry. A slot is written only when supplied; the language never changes latin.
const languages = [
  ['english-us', 'latin'], ['french', 'latin'], ['russian', 'latin'], ['greek', 'latin'],
  ['armenian', 'latin'], ['georgian', 'latin'], ['amharic', 'latin'],
  ['japanese', 'eastAsian'], ['chinese-simplified', 'eastAsian'], ['chinese-traditional', 'eastAsian'], ['korean', 'eastAsian'],
  ['arabic', 'complexScript'], ['hebrew', 'complexScript'], ['persian', 'complexScript'], ['urdu', 'complexScript'],
  ['hindi', 'complexScript'], ['bengali', 'complexScript'], ['tamil', 'complexScript'], ['thai', 'complexScript'], ['khmer', 'complexScript'],
];
const schemes = ['aptos', 'calibri', 'georgia', 'meiryo', 'arabic-typesetting', 'mangal'];
let writtenSlots = 0, emptySlots = 0;
for (const scheme of schemes) {
  const record = catalogs.fontSchemes.find(entry => entry.id === scheme);
  for (const [language, role] of languages) {
    const presentation = deck(scheme, language);
    const label = `${scheme} + ${language}`;
    const resolved = resolveScriptFonts(presentation);
    assert.equal(resolved.scriptRole, role, `${label}: script role`);
    const {inventory, diagnostics, bytes} = await exported(presentation);
    const {major, minor} = theme(inventory);
    assert.deepEqual([major.latin, minor.latin], [record.major, record.minor], `${label}: latin stays the scheme (Model C)`);
    const profile = previewProfile(presentation);
    const language_ = catalogs.languages.find(entry => entry.id === language);
    const languageFont = catalogs.fontSchemes.find(entry => entry.id === language_.fontScheme);
    const selected = new Set([record.major, record.minor, languageFont?.major, languageFont?.minor]);
    for (const [element, key] of SLOTS) {
      for (const [name, slots, roleKey, latinFamily] of [['major', major, 'heading', record.major], ['minor', minor, 'body', record.minor]]) {
        const want = supplied(resolved, roleKey, key);
        assert.equal(slots[element], want, `${label}: ${name} ${element} is ${want ? 'the selected script font' : 'empty (nothing selected)'}`);
        if (want) {
          assert.ok(selected.has(want), `${label}: ${name} ${element} "${want}" is a selected family`);
          writtenSlots += 1;
        } else emptySlots += 1;
        // Preview and export agree: equal where the theme names a family, latin where it is empty.
        assert.equal(profile[roleKey][key], want || latinFamily, `${label}: preview ${roleKey} ${key}`);
      }
    }
    // The slot the language's script uses names the language's script font, and only that slot.
    if (role === 'latin') assert.deepEqual([major.ea, major.cs, minor.ea, minor.cs], ['', '', '', ''], `${label}: Latin-slot language writes no ea/cs`);
    else {
      const own = role === 'eastAsian' ? 'ea' : 'cs', other = own === 'ea' ? 'cs' : 'ea';
      assert.ok(major[own] && minor[own], `${label}: the language's ${own} is written`);
      assert.deepEqual([major[other], minor[other]], ['', ''], `${label}: the other slot stays empty`);
    }
    assert.equal(profile.lang, resolved.lang, `${label}: preview lang`);
    assert.equal(profile.rtl, resolved.rtl, `${label}: preview direction`);
    assert.deepEqual((await exported(presentation)).bytes, bytes, `${label}: deterministic`);
    const imported = [];
    const restored = await fromPptx(bytes, {onDiagnostic: diagnostic => imported.push(diagnostic.code)});
    assert.equal(restored.language, language, `${label}: language re-imports`);
    assert.equal(restored.design?.fontScheme, scheme, `${label}: font scheme re-imports`);
    // language-ambiguous is the pre-existing note for records that share one OOXML tag (bengali and chittagonian, bn-BD); the stored id still wins.
    assert.deepEqual(imported.filter(code => /script-font|language|rtl/.test(code) && code !== 'language-ambiguous'), [], `${label}: import diagnostics`);
    assert.deepEqual(diagnostics.filter(diagnostic => /script|language/.test(diagnostic.code)), [], `${label}: export diagnostics`);
  }
}
assert.ok(writtenSlots > 0 && emptySlots > 0);

// 3. Re-import then export again reproduces the same theme slots (FF-32 provenance restores the scheme and language).
for (const [scheme, language] of [['meiryo', 'japanese'], ['calibri', 'english-us'], ['aptos', 'arabic'], ['mangal', 'hindi'], ['georgia', 'hebrew']]) {
  const {bytes, inventory} = await exported(deck(scheme, language));
  const again = await exported(await fromPptx(bytes));
  assert.deepEqual(theme(again.inventory), theme(inventory), `${scheme} + ${language}: re-import exports the same theme slots`);
}

// 4. Inline (gallery legacy) records select nothing; an explicit script slot on the design scheme is written.
{
  const record = {id: 'legacy-face', name: 'Legacy face', app: 'PowerPoint', languageFamily: 'latin', languages: [], major: 'Legacy Head', minor: 'Legacy Body', type: 'sans-serif'};
  const {inventory} = await exported(deck('legacy-face', undefined, {catalogs: {fontSchemes: {records: [record]}}}));
  assert.deepEqual(theme(inventory), {major: {latin: 'Legacy Head', ea: '', cs: ''}, minor: {latin: 'Legacy Body', ea: '', cs: ''}});
  const explicit = {id: 'aptos', eastAsian: {major: 'Noto Sans JP', minor: 'Noto Sans JP'}, complexScript: {major: 'Noto Naskh Arabic', minor: 'Noto Naskh Arabic'}};
  const slots = theme((await exported(deck(explicit, 'english-us'))).inventory);
  assert.deepEqual([slots.major.ea, slots.major.cs, slots.minor.ea, slots.minor.cs], ['Noto Sans JP', 'Noto Naskh Arabic', 'Noto Sans JP', 'Noto Naskh Arabic']);
  const only = theme((await exported(deck({id: 'aptos', eastAsian: {major: 'Noto Sans JP', minor: 'Noto Sans JP'}}, 'english-us'))).inventory);
  assert.deepEqual([only.major.cs, only.minor.cs], ['', ''], 'only the selected slot is written');
}

// 5. Run-level slots are unchanged: runs still repeat their own latin face in ea/cs for a Latin deck.
{
  const {bytes} = await exported(deck('calibri'));
  const slideXml = new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const triples = [...slideXml.matchAll(/<a:latin typeface="([^"+][^"]*)"[^>]*\/>\s*<a:ea typeface="([^"]*)"[^>]*\/>\s*<a:cs\s+typeface="([^"]*)"/g)];
  assert.ok(triples.length > 0);
  for (const [, latin, ea, cs] of triples) assert.deepEqual([ea, cs], [latin, latin]);
}

// 6. The example corpus: a theme slot is written exactly where the deck selected a script font, and never with an open replacement.
const image = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
const families = new Set(catalogs.fontSchemes.flatMap(record => [record.major, record.minor]));
let corpus = 0, corpusWritten = 0;
for (const {file, deck: example} of examples) {
  const resolved = resolveScriptFonts(example);
  const {major, minor} = theme((await exported(example, {imageResolver: async () => image})).inventory);
  for (const [element, key] of SLOTS) {
    assert.equal(major[element], supplied(resolved, 'heading', key), `${file}: major ${element}`);
    assert.equal(minor[element], supplied(resolved, 'body', key), `${file}: minor ${element}`);
    for (const face of [major[element], minor[element]]) if (face) { corpusWritten += 1; assert.ok(families.has(face) || face === example.design?.fontScheme?.[key]?.major || face === example.design?.fontScheme?.[key]?.minor, `${file}: ${face} is selected`); }
  }
  corpus += 1;
}

console.log(JSON.stringify({test: 'theme-script-slots', passed: true, fontSchemes: fontSchemeIds.length, combinations: schemes.length * languages.length, corpusDecks: corpus, corpusWrittenSlots: corpusWritten}));
