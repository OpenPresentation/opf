import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import { LANGUAGES, normalizeScriptGroup } from "../dist/index.js";
import { paragraphDirection, resolveScriptFonts as resolveWith, scriptFontRole } from "../dist/composition.js";
import { catalogDisplay, gallery } from "@openpresentation/gallery";
import { check, errorsOf } from "./support/validation.mjs";

// OPF 0.15: the language is an engine vocabulary (a BCP-47 tag); font schemes are catalog records the host registers.
const catalogs = [gallery];
const resolveScriptFonts = (document, options = {}) => resolveWith(document, { catalogs, ...options });
const fontSchemes = Object.entries(gallery.fontSchemes).map(([id, record]) => ({ id, ...record }));
// The gallery's language display records, by their display id. The tests name languages by that id for readability;
// deck() writes the record's BCP-47 tag into the document, which is all a document can name.
const languages = Object.entries(catalogDisplay.languages).map(([id, record]) => ({ id, ...record }));
const tagOf = Object.fromEntries(languages.map((record) => [record.id, record.bcp47]));
const asDocumentLanguage = (language) => {
  if (typeof language === 'string') return tagOf[language] ?? language;
  if (language && typeof language === 'object' && typeof language.id === 'string') {
    const { id, ...rest } = language;
    return { bcp47: rest.bcp47 ?? tagOf[id], ...rest };
  }
  return language;
};

// Fixtures choose openly licensed families (Carlito for the Calibri class,
// Noto for CJK, Arabic, Hebrew, Devanagari and Thai). The resolver only
// returns family names; PowerPoint-target catalog names such as Meiryo appear
// here as strings and no font binary is loaded or bundled.
const carlito = {major: 'Carlito', minor: 'Carlito'};
const deck = (language, fontScheme = carlito, extra = {}) => ({
  slides: [{title: 'Script fonts'}],
  ...(language === undefined ? {} : {language: asDocumentLanguage(language)}),
  design: {fontScheme},
  ...extra,
});
const same = (family) => ({latin: family, eastAsian: family, complexScript: family});

/** Run `fn` with the runtime's Intl.Locale unavailable, to prove catalog resolution needs no ICU data. */
function withoutIntlLocale(fn) {
  const original = Intl.Locale;
  Intl.Locale = class {
    constructor() {
      throw new Error('Intl.Locale must not be consulted for catalog tags');
    }
  };
  try {
    return fn();
  } finally {
    Intl.Locale = original;
  }
}

describe('script classes', () => {
  test('Latin deck fills every slot with the chosen heading/body family', () => {
    const resolved = resolveScriptFonts(deck('english-gb'));
    assert.equal(resolved.lang, 'en-GB');
    assert.equal(resolved.bcp47, 'en-GB');
    assert.equal(resolved.script, 'Latn');
    assert.equal(resolved.scriptRole, 'latin');
    assert.equal(resolved.direction, 'ltr');
    assert.equal(resolved.rtl, false);
    assert.deepEqual(resolved.heading, same('Carlito'));
    assert.deepEqual(resolved.body, same('Carlito'));
    assert.deepEqual({latin: resolved.latin, eastAsian: resolved.eastAsian, complexScript: resolved.complexScript}, resolved.body);
    assert.deepEqual(resolved.sources, {eastAsian: 'latin', complexScript: 'latin'});
    assert.equal(resolved.supplement, undefined);
  });

  test('a document without a language resolves the default theme and en-US', () => {
    const resolved = resolveScriptFonts({slides: [{title: 'Default'}]});
    assert.equal(resolved.lang, 'en-US');
    assert.equal(resolved.languageSource, 'default');
    assert.deepEqual(resolved.heading, same('Aptos Display'));
    assert.deepEqual(resolved.body, same('Aptos'));
    const french = resolveScriptFonts({slides: []}, {defaultLanguage: 'fr'});
    assert.equal(french.lang, 'fr-FR');
    assert.equal(resolveScriptFonts({slides: []}, {defaultLanguage: 'und'}).lang, 'en-US');
  });

  for (const [language, id, script, lang] of [['ru', 'russian', 'Cyrl', 'ru-RU'], ['uk-UA', 'ukrainian', 'Cyrl', 'uk-UA'], ['sr-Cyrl', 'serbian-cyrillic', 'Cyrl', 'sr-Cyrl-RS'], ['greek', 'greek', 'Grek', 'el-GR'], ['el-GR', 'greek', 'Grek', 'el-GR']]) {
    test(`${language} uses the latin slot (${script})`, () => {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.lang, lang);
      assert.equal(resolved.script, script);
      assert.equal(resolved.scriptRole, 'latin');
      assert.equal(resolved.rtl, false);
      assert.deepEqual(resolved.body, same('Carlito'));
      assert.equal(resolved.supplement, undefined);
    });
  }

  const cjk = [
    ['japanese', 'ja-JP', 'ja', 'japanese', 'Jpan', 'Yu Gothic', 'Noto Sans JP', 'Jpan'],
    ['ja-JP', 'ja-JP', 'ja-JP', 'japanese', 'Jpan', 'Yu Gothic', 'Noto Sans JP', 'Jpan'],
    ['zh-Hans', 'zh-CN', 'zh-Hans', 'chinese-simplified', 'Hans', 'Microsoft YaHei', 'Noto Sans SC', 'Hans'],
    ['zh-CN', 'zh-CN', 'zh-CN', 'chinese-simplified', 'Hans', 'Microsoft YaHei', 'Noto Sans SC', 'Hans'],
    ['zh-TW', 'zh-TW', 'zh-TW', 'chinese-traditional', 'Hant', 'Microsoft JhengHei', 'Noto Sans TC', 'Hant'],
    ['korean', 'ko-KR', 'ko', 'korean', 'Kore', 'Malgun Gothic', 'Noto Sans KR', 'Hang'],
  ];
  for (const [language, lang, bcp47, id, script, powerPoint, google, supplementScript] of cjk) {
    test(`${language} fills eastAsian from the language font scheme`, () => {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.lang, lang);
      assert.equal(resolved.bcp47, bcp47);
      assert.equal(resolved.script, script);
      assert.equal(resolved.scriptRole, 'eastAsian');
      assert.equal(resolved.rtl, false);
      assert.deepEqual(resolved.body, {latin: 'Carlito', eastAsian: powerPoint, complexScript: 'Carlito'});
      assert.deepEqual(resolved.heading, resolved.body);
      assert.deepEqual(resolved.sources, {eastAsian: 'language', complexScript: 'latin'});
      assert.deepEqual(resolved.supplement, {script: supplementScript, heading: powerPoint, body: powerPoint});
      const googleResolved = resolveScriptFonts(deck(language), {app: 'google-slides'});
      assert.equal(googleResolved.eastAsian, google);
      assert.equal(googleResolved.latin, 'Carlito');
    });
  }

  // v0.35: Arabic, Persian and Urdu take PowerPoint's Office theme fonts for the Arabic script, Times New Roman for headings and Arial for body.
  // The other complex-script defaults are fonts every Windows has: Segoe UI (Hebrew), Nirmala UI (the Indic scripts), Leelawadee UI (Thai, Khmer).
  const office = ['Times New Roman', 'Arial'];
  const complex = [
    ['arabic', 'ar-SA', 'Arab', true, office, 'Noto Naskh Arabic'],
    ['fa-IR', 'fa-IR', 'Arab', true, office, 'Noto Naskh Arabic'],
    ['urdu', 'ur-PK', 'Arab', true, office, 'Noto Nastaliq Urdu'],
    ['he-IL', 'he-IL', 'Hebr', true, 'Segoe UI', 'Noto Sans Hebrew'],
    ['hindi', 'hi-IN', 'Deva', false, 'Nirmala UI', 'Noto Sans Devanagari'],
    ['bn', 'bn-BD', 'Beng', false, 'Nirmala UI', 'Noto Sans Bengali'],
    ['ta', 'ta-IN', 'Taml', false, 'Nirmala UI', 'Noto Sans Tamil'],
    ['thai', 'th-TH', 'Thai', false, 'Leelawadee UI', 'Noto Sans Thai'],
  ];
  for (const [language, lang, script, rtl, families, google] of complex) {
    const [headingFamily, powerPoint] = Array.isArray(families) ? families : [families, families];
    test(`${language} fills complexScript${rtl ? ' and is right-to-left' : ''}`, () => {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.heading.complexScript, headingFamily);
      assert.equal(resolved.lang, lang);
      assert.equal(resolved.script, script);
      assert.equal(resolved.scriptRole, 'complexScript');
      assert.equal(resolved.rtl, rtl);
      assert.equal(resolved.direction, rtl ? 'rtl' : 'ltr');
      assert.deepEqual(resolved.body, {latin: 'Carlito', eastAsian: 'Carlito', complexScript: powerPoint});
      assert.deepEqual(resolved.sources, {eastAsian: 'latin', complexScript: 'language'});
      assert.deepEqual(resolved.supplement, {script, heading: headingFamily, body: powerPoint});
      assert.equal(resolveScriptFonts(deck(language), {app: 'google-slides'}).complexScript, google);
    });
  }

  test('scripts outside latin/ea/cs keep the latin slot and get a supplemental theme font', () => {
    const armenian = resolveScriptFonts(deck('armenian'));
    assert.equal(armenian.script, 'Armn');
    assert.equal(armenian.scriptRole, 'latin');
    assert.deepEqual(armenian.body, same('Carlito'));
    assert.deepEqual(armenian.supplement, {script: 'Armn', heading: 'Sylfaen', body: 'Sylfaen'});
    assert.deepEqual(resolveScriptFonts(deck('ka'), {app: 'google-slides'}).supplement, {script: 'Geor', heading: 'Noto Sans Georgian', body: 'Noto Sans Georgian'});
  });

  test('the theme supplement of a latin-slot script names the chosen cs scheme, not the language default (FF-46, opf#375)', () => {
    // The native FF-46 deck chose Ebrima over the default of its day, Nyala. Since 0.35 Ebrima is the Amharic default, so these decks
    // choose Nyala over Ebrima: the same assertions with the two names swapped.
    const nyala = (extra = {}) => ({major: 'Nyala', minor: 'Nyala', scriptGroup: 'complexScript', ...extra});
    // A deck language with no script font in the scheme keeps the catalog default (Ebrima), as before.
    assert.deepEqual(resolveScriptFonts(deck('amharic')).supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Ebrima'});
    // The design selects a cs scheme that serves the language: the Ethi entry names that family, in both slots.
    for (const scheme of [nyala(), nyala({languages: ['am']})]) {
      const resolved = resolveScriptFonts(deck('amharic', scheme));
      assert.equal(resolved.script, 'Ethi');
      assert.equal(resolved.scriptRole, 'latin');
      assert.equal(resolved.sources.complexScript, 'schemeFamily');
      assert.deepEqual(resolved.supplement, {script: 'Ethi', heading: 'Nyala', body: 'Nyala'});
    }
    // The same scheme as an inline catalog record referenced by id (how a deck selects "the nyala scheme").
    const record = {id: 'nyala', name: 'Nyala', app: 'powerpoint', ...nyala({languages: ['am']})};
    const {id: nyalaId, ...nyalaRecord} = record;
    const byId = resolveScriptFonts(deck('amharic', nyalaId, {catalogs: {custom: {fontSchemes: {[nyalaId]: nyalaRecord}}}}));
    assert.deepEqual(byId.supplement, {script: 'Ethi', heading: 'Nyala', body: 'Nyala'});
    // A heading and body that differ are kept apart.
    const pair = resolveScriptFonts(deck('amharic', nyala({major: 'Nyala', minor: 'Ebrima'})));
    assert.deepEqual(pair.supplement, {script: 'Ethi', heading: 'Nyala', body: 'Ebrima'});
    // Catalog schemes: the author-chosen scheme wins over the language's own, for either app.
    assert.deepEqual(resolveScriptFonts(deck('amharic', 'noto-sans-ethiopic')).supplement, {script: 'Ethi', heading: 'Noto Sans Ethiopic', body: 'Noto Sans Ethiopic'});
    assert.deepEqual(resolveScriptFonts(deck('amharic', 'ebrima'), {app: 'google-slides'}).supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Ebrima'});
    // Armenian and Georgian are the same class: Sylfaen is the catalog default, a chosen cs scheme replaces it.
    for (const [language, script] of [['armenian', 'Armn'], ['georgian', 'Geor']]) {
      assert.deepEqual(resolveScriptFonts(deck(language, nyala())).supplement, {script, heading: 'Nyala', body: 'Nyala'}, language);
      assert.deepEqual(resolveScriptFonts(deck(language, 'sylfaen')).supplement, {script, heading: 'Sylfaen', body: 'Sylfaen'}, language);
    }
    assert.deepEqual(resolveScriptFonts(deck('armenian', 'noto-sans-armenian')).supplement, {script: 'Armn', heading: 'Noto Sans Armenian', body: 'Noto Sans Armenian'});
    assert.deepEqual(resolveScriptFonts(deck('georgian', 'noto-sans-georgian')).supplement, {script: 'Geor', heading: 'Noto Sans Georgian', body: 'Noto Sans Georgian'});
    // Nothing else changes: the slots, the language and the script of the Amharic deck.
    const plain = resolveScriptFonts(deck('amharic', nyala()));
    assert.deepEqual(plain.body, same('Nyala'));
    assert.equal(plain.lang, 'am-ET');
  });

  test('an explicit complexScript slot is the deck\'s choice for a latin-slot script: an inline deck in the form of the native FF-46 run (opf#375)', () => {
    // The form of scripts-40-amharic-ebrima (that deck chose Ebrima, which is the Amharic default since 0.35, so this one chooses Nyala): inline = (family) => ({major: family, minor: family, complexScript: {major: family, minor: family}}), language am.
    const inline = (family, slot = 'complexScript') => ({major: family, minor: family, [slot]: {major: family, minor: family}});
    for (const language of ['am', 'amharic', 'am-ET']) {
      const resolved = resolveScriptFonts(deck(language, inline('Nyala')));
      assert.equal(resolved.script, 'Ethi');
      assert.equal(resolved.lang, 'am-ET');
      assert.deepEqual(resolved.sources, {eastAsian: 'latin', complexScript: 'fontScheme'});
      assert.deepEqual(resolved.heading, same('Nyala'));
      assert.deepEqual(resolved.supplement, {script: 'Ethi', heading: 'Nyala', body: 'Nyala'}, language);
    }
    // Heading and body are kept apart; a slot with one side falls back to the other (core's pair rule).
    const split = resolveScriptFonts(deck('amharic', {major: 'Nyala', minor: 'Nyala', complexScript: {major: 'Nyala', minor: 'Ebrima'}}));
    assert.deepEqual(split.supplement, {script: 'Ethi', heading: 'Nyala', body: 'Ebrima'});
    // Armenian and Georgian are the same class.
    assert.deepEqual(resolveScriptFonts(deck('armenian', inline('Nyala'))).supplement, {script: 'Armn', heading: 'Nyala', body: 'Nyala'});
    assert.deepEqual(resolveScriptFonts(deck('georgian', inline('Nyala'))).supplement, {script: 'Geor', heading: 'Nyala', body: 'Nyala'});
    // A catalog record that carries a complexScript slot is the same choice.
    const record = {major: 'Carlito', minor: 'Carlito', complexScript: {major: 'Nyala', minor: 'Nyala'}};
    assert.deepEqual(resolveScriptFonts(deck('amharic', 'brand-ethiopic', {catalogs: {custom: {fontSchemes: {'brand-ethiopic': record}}}})).supplement, {script: 'Ethi', heading: 'Nyala', body: 'Nyala'});
    // An explicit East Asian slot (the MS Gothic form) is not a choice for Ethiopic, Armenian or Georgian text.
    for (const [language, script, family] of [['amharic', 'Ethi', 'Ebrima'], ['armenian', 'Armn', 'Sylfaen'], ['georgian', 'Geor', 'Sylfaen']]) {
      assert.deepEqual(resolveScriptFonts(deck(language, inline('MS Gothic', 'eastAsian'))).supplement, {script, heading: family, body: family}, language);
    }
    // The language's own scripts in the same deck are unchanged by an explicit slot for the other side.
    assert.deepEqual(resolveScriptFonts(deck('amharic')).supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Ebrima'});
  });

  test('East Asian and complex-script supplements follow the resolved slot, including an explicit slot (inline MS Gothic form, opf#375)', () => {
    const inline = (family, slot) => ({major: family, minor: family, [slot]: {major: family, minor: family}});
    // scripts-xx MS Gothic: inline eastAsian slot, one deck per East Asian language. The entry named is the slot's family.
    for (const [language, script] of [['japanese', 'Jpan'], ['korean', 'Hang'], ['chinese-simplified', 'Hans'], ['chinese-traditional', 'Hant']]) {
      const resolved = resolveScriptFonts(deck(language, inline('MS Gothic', 'eastAsian')));
      assert.equal(resolved.scriptRole, 'eastAsian');
      assert.equal(resolved.sources.eastAsian, 'fontScheme');
      assert.deepEqual(resolved.supplement, {script, heading: 'MS Gothic', body: 'MS Gothic'}, language);
      assert.equal(resolved.supplement.heading, resolved.heading.eastAsian);
    }
    // An explicit complexScript slot for the same languages names nothing for them: the language default stays.
    assert.deepEqual(resolveScriptFonts(deck('japanese', inline('Ebrima', 'complexScript'))).supplement, {script: 'Jpan', heading: 'Yu Gothic', body: 'Yu Gothic'});
    // Complex-script languages follow an explicit complexScript slot; an explicit eastAsian slot leaves them on the language default.
    for (const [language, script, heading, body = heading] of [['arabic', 'Arab', 'Times New Roman', 'Arial'], ['hebrew', 'Hebr', 'Segoe UI'], ['hindi', 'Deva', 'Nirmala UI'], ['thai', 'Thai', 'Leelawadee UI']]) {
      assert.deepEqual(resolveScriptFonts(deck(language, inline('Ebrima', 'complexScript'))).supplement, {script, heading: 'Ebrima', body: 'Ebrima'}, language);
      assert.deepEqual(resolveScriptFonts(deck(language, inline('MS Gothic', 'eastAsian'))).supplement, {script, heading, body}, language);
    }
    // For every catalog language with a script slot, the supplement equals the resolved slot family under explicit slots, in both parts.
    for (const language of languages) {
      const role = scriptFontRole(language.script);
      if (role === 'latin') continue;
      for (const family of ['Ebrima', 'MS Gothic']) {
        const resolved = resolveScriptFonts(deck(language.id, inline(family, role)));
        assert.deepEqual(resolved.supplement, {script: language.script === 'Kore' ? 'Hang' : language.script, heading: family, body: family}, `${language.id} ${role} ${family}`);
        assert.equal(resolved.supplement.heading, resolved.heading[role]);
        assert.equal(resolved.supplement.body, resolved.body[role]);
      }
    }
  });

  test('scriptGroup: eastAsian is the ea slot and complexScript the cs slot; the short names are no longer read', () => {
    assert.deepEqual(['latin', 'ea', 'eastAsian', 'cs', 'complexScript', 'arabic', undefined, 3].map(normalizeScriptGroup), ['latin', undefined, 'ea', undefined, 'cs', undefined, undefined, undefined]);
    const base = {major: 'Ebrima', minor: 'Nyala'};
    for (const [short, long, language, slot] of [['ea', 'eastAsian', 'japanese', 'eastAsian'], ['cs', 'complexScript', 'arabic', 'complexScript']]) {
      const withShort = resolveScriptFonts(deck(language, {...base, scriptGroup: short}));
      const withLong = resolveScriptFonts(deck(language, {...base, scriptGroup: long}));
      assert.notEqual(withShort.sources[slot], 'schemeFamily', `${short} is not read since 0.37`);
      assert.equal(withLong.sources[slot], 'schemeFamily', long);
      assert.equal(withLong.body[slot], 'Nyala', long);
      assert.equal(withLong.heading[slot], 'Ebrima', long);
    }
    // A scheme for the other slot does not fill this one, in either spelling.
    assert.equal(resolveScriptFonts(deck('arabic', {...base, scriptGroup: 'eastAsian'})).sources.complexScript, 'language');
    assert.equal(resolveScriptFonts(deck('japanese', {...base, scriptGroup: 'complexScript'})).sources.eastAsian, 'language');
  });

  test('a scheme that does not choose a family for the script leaves the language supplement alone (FF-46, opf#375)', () => {
    const ebrima = {script: 'Ethi', heading: 'Ebrima', body: 'Ebrima'};
    const base = {major: 'Nyala', minor: 'Nyala'};
    // A latin scheme, an ea scheme, a cs scheme for another language and an explicit East Asian slot name no family for Ethiopic text.
    assert.deepEqual(resolveScriptFonts(deck('amharic', base)).supplement, ebrima);
    assert.deepEqual(resolveScriptFonts(deck('amharic', {...base, scriptGroup: 'eastAsian'})).supplement, ebrima);
    assert.deepEqual(resolveScriptFonts(deck('amharic', {...base, scriptGroup: 'complexScript', languages: ['ar']})).supplement, ebrima);
    assert.deepEqual(resolveScriptFonts(deck('amharic', {...base, eastAsian: {major: 'Nyala', minor: 'Nyala'}})).supplement, ebrima);
    assert.deepEqual(resolveScriptFonts(deck('amharic', 'calibri')).supplement, ebrima);
    // A complex-script language still reads its supplement from its own slot, which already follows the scheme.
    assert.deepEqual(resolveScriptFonts(deck('arabic', {...base, scriptGroup: 'complexScript'})).supplement, {script: 'Arab', heading: 'Nyala', body: 'Nyala'});
    // Latin, Cyrillic and Greek decks get no supplement from a cs scheme.
    for (const language of ['english-us', 'russian', 'greek']) assert.equal(resolveScriptFonts(deck(language, {...base, scriptGroup: 'complexScript'})).supplement, undefined, language);
  });

  test('every catalog scheme and language: a latin-slot script names the cs scheme only when it serves the language (FF-46, opf#375)', () => {
    const latinSlotLanguages = languages.filter((record) => ['Armn', 'Geor', 'Ethi'].includes(record.script));
    assert.deepEqual(latinSlotLanguages.map((record) => record.id).sort(), ['amharic', 'armenian', 'georgian']);
    for (const language of latinSlotLanguages) for (const scheme of fontSchemes) for (const app of ['powerpoint', 'google-slides']) {
      const resolved = resolveScriptFonts({language: language.bcp47, design: {fontScheme: scheme.id}}, {app});
      const own = app === 'google-slides' ? language.googleFontScheme : language.fontScheme;
      const ownScheme = fontSchemes.find((entry) => entry.id === own);
      const serves = scheme.scriptGroup === 'complexScript' && (!scheme.languages?.length || scheme.languages.includes(language.bcp47));
      const expected = serves ? scheme : ownScheme;
      const label = `${language.id} on ${scheme.id} (${app})`;
      assert.equal(resolved.sources.complexScript === 'schemeFamily', serves, label);
      assert.deepEqual(resolved.supplement, {script: language.script, heading: expected.major, body: expected.minor}, label);
    }
  });

  test('no supplement is invented when nothing supplies a script font', () => {
    const tibetan = resolveScriptFonts(deck('bo-Tibt-CN'));
    assert.equal(tibetan.script, 'Tibt');
    assert.equal(tibetan.scriptRole, 'complexScript');
    assert.equal(tibetan.lang, 'bo-Tibt-CN');
    assert.deepEqual(tibetan.sources, {eastAsian: 'latin', complexScript: 'latin'});
    assert.equal(tibetan.supplement, undefined);
    const explicit = resolveScriptFonts(deck('bo-Tibt-CN', {...carlito, complexScript: {major: 'Noto Serif Tibetan'}}));
    assert.deepEqual(explicit.supplement, {script: 'Tibt', heading: 'Noto Serif Tibetan', body: 'Noto Serif Tibetan'});
  });

  test('scriptFontRole classifies ISO 15924 codes case-insensitively', () => {
    for (const script of ['Latn', 'Cyrl', 'Grek', 'Armn', 'Geor', 'Ethi', 'Zzzz', 'nonsense']) assert.equal(scriptFontRole(script), 'latin');
    for (const script of ['Jpan', 'Hans', 'Hant', 'Kore', 'Hang', 'hira', 'KANA', 'Bopo']) assert.equal(scriptFontRole(script), 'eastAsian');
    for (const script of ['Arab', 'Hebr', 'Deva', 'Beng', 'Taml', 'Thai', 'Khmr', 'syrc', 'Tibt', 'Mong']) assert.equal(scriptFontRole(script), 'complexScript');
  });
});

describe('language tags', () => {
  test('catalog tags emit curated OOXML culture tags', () => {
    for (const [language, lang, bcp47] of [['zsm', 'ms-MY', 'zsm'], ['no', 'nb-NO', 'no'], ['kmr', 'kmr-TR', 'kmr'], ['tl', 'fil-PH', 'tl'], ['ber-Latn', 'tzm-Latn-DZ', 'ber-Latn'], ['vi-Latn', 'vi-VN', 'vi-Latn'], ['ctg', 'bn-BD', 'ctg'], ['english', 'en-US', 'en'], ['pa-Arab', 'pa-Arab-PK', 'pa-Arab']]) {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.lang, lang, language);
      assert.equal(resolved.bcp47, bcp47, language);
    }
  });

  test('returned tags use canonical casing and replace deprecated subtags', () => {
    for (const [language, lang, bcp47, id] of [
      ['en-us', 'en-US', 'en-US', 'english-us'],
      ['ZH-hant-tw', 'zh-Hant-TW', 'zh-Hant-TW', 'chinese-traditional'],
      ['iw', 'he-IL', 'he', 'hebrew'],
      ['iw-IL', 'he-IL', 'he-IL', 'hebrew'],
      ['in', 'id-ID', 'id', 'indonesian'],
      ['nb-NO', 'nb-NO', 'nb-NO', 'norwegian'],
      ['ms-MY', 'ms-MY', 'ms-MY', 'malay'],
      ['ku', 'kmr-TR', 'ku', 'kurmanji'],
      ['ku-Latn-TR', 'ku-Latn-TR', 'ku-Latn-TR', 'kurmanji'],
      ['sr-latn', 'sr-Latn-RS', 'sr-Latn', 'serbian-latin'],
    ]) {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.lang, lang, language);
      assert.equal(resolved.bcp47, bcp47, language);
    }
  });

  test('ambiguous catalog languages resolve from the vendored likely-script table', () => {
    const cases = [
      ['zh', 'chinese-simplified'], ['zh-SG', 'chinese-simplified'], ['zh-HK', 'chinese-traditional'], ['zh-MO', 'chinese-traditional'],
      ['sr', 'serbian-cyrillic'], ['sr-RS', 'serbian-cyrillic'], ['sr-ME', 'serbian-latin'],
      ['pa', 'punjabi-gurmukhi'], ['pa-IN', 'punjabi-gurmukhi'], ['pa-PK', 'punjabi-shahmukhi'],
      ['az-AZ', 'azerbaijani'], ['uz', 'uzbek-latin'], ['uz-UZ', 'uzbek-latin'], ['bs', 'bosnian-latin'], ['bs-BA', 'bosnian-latin'],
      ['mn', 'mongolian'], ['mn-MN', 'mongolian'], ['ms', 'malay'],
    ];
    withoutIntlLocale(() => {
      for (const [language, id] of cases) assert.equal(resolveScriptFonts(deck(language)).script, languages.find((record) => record.id === id).script, language);
    });
    assert.equal(resolveScriptFonts(deck('zh-HK')).lang, 'zh-HK');
    assert.equal(resolveScriptFonts(deck('sr')).lang, 'sr-Cyrl-RS');
  });

  test('vocabulary tags never consult Intl.Locale', () => {
    withoutIntlLocale(() => {
      for (const entry of LANGUAGES) {
        for (const reference of [entry.tag, {bcp47: entry.tag}]) {
          const resolved = resolveScriptFonts(deck(reference));
          assert.equal(resolved.bcp47, entry.tag, JSON.stringify(reference));
          assert.equal(resolved.script, entry.script, JSON.stringify(reference));
        }
      }
    });
  });

  test('only tags outside the vocabulary use the runtime likely subtags', () => {
    const hawaiian = resolveScriptFonts(deck('haw'));
    assert.equal(hawaiian.lang, 'haw');
    assert.equal(hawaiian.script, 'Latn');
    // Without ICU data, an uncatalogued tag with no explicit script is unresolvable.
    withoutIntlLocale(() => assert.equal(resolveScriptFonts(deck('haw')).languageSource, 'default'));
  });
});

describe('precedence', () => {
  test('explicit design slots win over the language, per major/minor with fallback', () => {
    const fontScheme = {id: 'aptos', eastAsian: {minor: 'Noto Sans JP'}, complexScript: {major: 'Noto Sans Arabic', minor: 'Noto Naskh Arabic'}};
    const inLatinDeck = resolveScriptFonts(deck('english', fontScheme));
    assert.deepEqual(inLatinDeck.heading, {latin: 'Aptos Display', eastAsian: 'Noto Sans JP', complexScript: 'Noto Sans Arabic'});
    assert.deepEqual(inLatinDeck.body, {latin: 'Aptos', eastAsian: 'Noto Sans JP', complexScript: 'Noto Naskh Arabic'});
    assert.deepEqual(inLatinDeck.sources, {eastAsian: 'fontScheme', complexScript: 'fontScheme'});
    const japanese = resolveScriptFonts(deck('japanese', fontScheme));
    assert.equal(japanese.eastAsian, 'Noto Sans JP');
    assert.deepEqual(japanese.supplement, {script: 'Jpan', heading: 'Noto Sans JP', body: 'Noto Sans JP'});
  });

  test('scheme languages are BCP-47 tags of the vocabulary, never names or catalog ids', () => {
    const tags = new Set(LANGUAGES.map((entry) => entry.tag));
    for (const scheme of fontSchemes) for (const entry of scheme.languages ?? []) assert.ok(tags.has(entry), `${scheme.id}: '${entry}' is not a vocabulary tag`);
    const ebrima = {major: 'Ebrima', minor: 'Ebrima', scriptGroup: 'complexScript'};
    assert.equal(resolveScriptFonts(deck('amharic', {...ebrima, languages: ['am']})).sources.complexScript, 'schemeFamily');
    assert.equal(resolveScriptFonts(deck('amharic', {...ebrima, languages: ['Amharic']})).sources.complexScript, 'latin', 'a language name is not a tag');
    assert.equal(resolveScriptFonts(deck('amharic', {...ebrima, languages: ['amharic']})).sources.complexScript, 'latin', 'a catalog id is not a tag');
    // An entry with a script matches only that script: pa-Guru serves Punjabi in Gurmukhi, not in Shahmukhi.
    assert.equal(resolveScriptFonts(deck('pa-Guru', {...ebrima, languages: ['pa-Guru']})).sources.complexScript, 'schemeFamily');
    assert.equal(resolveScriptFonts(deck('pa-Arab', {...ebrima, languages: ['pa-Guru']})).sources.complexScript, 'language');
  });

  test('a script design scheme fills its own slot only for the languages it lists', () => {
    const japanese = resolveScriptFonts(deck('japanese', 'meiryo'));
    assert.deepEqual(japanese.body, same('Meiryo'));
    assert.deepEqual(japanese.sources, {eastAsian: 'schemeFamily', complexScript: 'latin'});
    const korean = resolveScriptFonts(deck('korean', 'meiryo'));
    assert.deepEqual(korean.body, {latin: 'Meiryo', eastAsian: 'Malgun Gothic', complexScript: 'Meiryo'});
    assert.equal(korean.sources.eastAsian, 'language');
    assert.equal(resolveScriptFonts(deck('zh-Hans', 'meiryo')).eastAsian, 'Microsoft YaHei');
    const traditional = resolveScriptFonts(deck('zh-Hant', 'microsoft-yahei'));
    assert.equal(traditional.eastAsian, 'Microsoft YaHei', 'scheme languages are tags');
    assert.equal(traditional.sources.eastAsian, 'schemeFamily');
    assert.equal(resolveScriptFonts(deck('pa-Guru', 'raavi')).sources.complexScript, 'schemeFamily', 'raavi lists pa-Guru');
    const unlisted = resolveScriptFonts(deck('korean', {major: 'Noto Sans JP', minor: 'Noto Sans JP', scriptGroup: 'eastAsian'}));
    assert.equal(unlisted.eastAsian, 'Noto Sans JP', 'an empty languages list admits every language');
    assert.equal(unlisted.sources.eastAsian, 'schemeFamily');
    const arabicInMeiryo = resolveScriptFonts(deck('arabic', 'meiryo'));
    assert.deepEqual(arabicInMeiryo.body, {latin: 'Meiryo', eastAsian: 'Meiryo', complexScript: 'Arial'});
  });

  test('catalog font-scheme records may carry script slots', () => {
    const record = {major: 'Carlito', minor: 'Carlito', eastAsian: {major: 'Noto Sans SC', minor: 'Noto Sans SC'}};
    const resolved = resolveScriptFonts(deck('korean', 'brand-sans', {catalogs: {custom: {fontSchemes: {'brand-sans': record}}}}));
    assert.equal(resolved.eastAsian, 'Noto Sans SC');
    assert.equal(resolved.sources.eastAsian, 'fontScheme');
  });

  test('a Language object overrides what the vocabulary knows about its tag', () => {
    const resolved = resolveScriptFonts(deck({bcp47: 'ja-JP', name: 'Japanese', fontScheme: 'noto-sans-jp'}, carlito));
    assert.equal(resolved.lang, 'ja-JP');
    assert.equal(resolved.script, 'Jpan');
    assert.equal(resolved.eastAsian, 'Noto Sans JP');
    const object = resolveScriptFonts(deck({bcp47: 'ar-SA', name: 'Arabic (Saudi Arabia)', direction: 'rtl', script: 'Arab'}));
    assert.equal(object.lang, 'ar-SA');
    assert.equal(object.complexScript, 'Arial');
    assert.equal(object.rtl, true);
    const override = resolveScriptFonts(deck({id: 'hebrew', fontScheme: 'noto-sans-hebrew'}));
    assert.equal(override.lang, 'he-IL');
    assert.equal(override.bcp47, 'he');
    assert.equal(override.complexScript, 'Noto Sans Hebrew');
    assert.equal(override.rtl, true);
    assert.equal(resolveScriptFonts(deck({id: 'english', ooxmlLang: 'en-gb'})).lang, 'en-GB');
  });

  test('slide design overrides the deck font scheme per field', () => {
    const document = deck('japanese', 'aptos', {slides: [{title: 'Deck'}, {title: 'Slide', design: {fontScheme: {major: 'Carlito', minor: 'Carlito', eastAsian: {major: 'Noto Sans JP'}}}}]});
    assert.equal(resolveScriptFonts(document).body.latin, 'Aptos');
    const slide = resolveScriptFonts(document, {slideIndex: 1});
    assert.deepEqual(slide.body, {latin: 'Carlito', eastAsian: 'Noto Sans JP', complexScript: 'Carlito'});
    assert.throws(() => resolveScriptFonts(document, {slideIndex: 2}), RangeError);
    assert.throws(() => resolveScriptFonts(document, {slideIndex: 0.5}), RangeError);
  });

  test('the shared engine default font scheme applies only when no slide, deck or theme scheme is named', () => {
    const customTheme = {slides: [{title: 'Custom theme'}], design: {theme: 'custom'}, catalogs: {custom: {themes: {custom: {name: 'Custom'}}}}};
    assert.deepEqual(resolveScriptFonts(customTheme).heading, same('Aptos Display'), 'the shared default applies');
    assert.equal(resolveScriptFonts(customTheme).body.latin, 'Aptos');
    assert.equal(resolveScriptFonts(customTheme, {defaultFontScheme: 'roboto'}).body.latin, 'Aptos', 'there is no per-call default option');
    assert.equal(resolveScriptFonts({slides: [], design: {theme: 'custom'}, catalogs: {custom: {themes: {custom: {name: 'Custom', fontScheme: 'roboto'}}}}}).body.latin, 'Roboto');
    assert.equal(resolveScriptFonts(deck('english')).body.latin, 'Carlito');
  });

  test('options.language replaces the document language', () => {
    const resolved = resolveScriptFonts(deck('english'), {language: 'th-TH'});
    assert.equal(resolved.lang, 'th-TH');
    assert.equal(resolved.languageSource, 'option');
    assert.equal(resolved.complexScript, 'Leelawadee UI');
  });

  test('unresolvable language references fall back to the default tag', () => {
    for (const language of ['klingon-dialect', 'und', 'UND-Latn', '', '   ', 'https://acme.com/languages/x.json', 'pkg:@acme/decks/languages/x', {name: 'No tag'}, {bcp47: 'und'}, {bcp47: ''}]) {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.languageSource, 'default', JSON.stringify(language));
      assert.equal(resolved.lang, 'en-US');
    }
  });

  test('resolution is pure and does not mutate the document', () => {
    const document = deck('arabic', {id: 'aptos', complexScript: {minor: 'Noto Naskh Arabic'}});
    const before = structuredClone(document);
    resolveScriptFonts(document, {app: 'google-slides'});
    assert.deepEqual(document, before);
  });
});

describe('the language vocabulary', () => {
  const rtlScripts = new Set(['Arab', 'Hebr']);
  const schemeById = new Map(fontSchemes.map((record) => [record.id, record]));

  test('every vocabulary language declares script, direction and an OOXML culture tag', () => {
    assert.ok(LANGUAGES.length >= 93);
    for (const entry of LANGUAGES) {
      assert.match(entry.script ?? '', /^[A-Z][a-z]{3}$/, entry.tag);
      assert.equal(entry.direction, rtlScripts.has(entry.script) ? 'rtl' : 'ltr', entry.tag);
      assert.match(entry.ooxmlLang ?? '', /^[a-z]{2,3}(-[A-Z][a-z]{3})?-[A-Z]{2}$/, entry.tag);
    }
  });

  test('the vocabulary matches the gallery language records it was taken from', () => {
    for (const record of languages) {
      const entry = LANGUAGES.find((candidate) => candidate.tag === record.bcp47);
      assert.ok(entry, record.id);
      assert.deepEqual([entry.script, entry.direction, entry.ooxmlLang], [record.script, record.direction, record.ooxmlLang], record.id);
      for (const [app, key] of [['powerpoint', 'fontScheme'], ['google', 'googleFontScheme']]) {
        const scheme = schemeById.get(record[key] ?? record.fontScheme);
        assert.deepEqual(entry.fonts[app], {major: scheme.major, minor: scheme.minor}, `${record.id} ${app}`);
      }
    }
  });

  test('the vocabulary covers every FF-07 script class', () => {
    const scripts = new Set(LANGUAGES.map((entry) => entry.script));
    for (const script of ['Latn', 'Cyrl', 'Grek', 'Jpan', 'Hans', 'Hant', 'Kore', 'Arab', 'Hebr', 'Deva', 'Thai']) assert.ok(scripts.has(script), script);
  });

  for (const app of ['powerpoint', 'google-slides']) {
    test(`every vocabulary language resolves by tag for ${app}`, () => {
      for (const record of languages) {
        const resolved = resolveScriptFonts(deck(record.bcp47), {app});
        assert.equal(resolved.lang, /-[A-Z]{2}$/.test(record.bcp47) ? record.bcp47 : record.ooxmlLang, record.bcp47);
        assert.equal(resolved.bcp47, record.bcp47);
        assert.equal(resolved.script, record.script);
        assert.equal(resolved.rtl, record.direction === 'rtl');
        const scheme = schemeById.get(app === 'google-slides' ? record.googleFontScheme : record.fontScheme);
        assert.ok(scheme, `${record.id} names a font scheme of the default catalog`);
        if (resolved.scriptRole !== 'latin') {
          assert.equal(resolved.body[resolved.scriptRole], scheme.minor, record.id);
          assert.equal(resolved.heading[resolved.scriptRole], scheme.major, record.id);
          assert.equal(resolved.sources[resolved.scriptRole], 'language', record.id);
        }
        for (const family of Object.values(resolved.body)) assert.ok(family.length > 0, record.id);
      }
    });
  }
});

describe('schema', () => {
  test('design font schemes accept eastAsian and complexScript slots', () => {
    const document = deck('japanese', {id: 'aptos', eastAsian: {major: 'Noto Sans JP', minor: 'Noto Sans JP'}, complexScript: {minor: 'Noto Naskh Arabic'}});
    assert.equal(check(document).valid, true, JSON.stringify(errorsOf(check(document))));
    for (const bad of [{eastAsian: {}}, {eastAsian: {major: 'Noto Sans JP', typeface: 'x'}}, {complexScript: 'Noto Naskh Arabic'}]) {
      assert.equal(check(deck('japanese', {id: 'aptos', ...bad})).valid, false, JSON.stringify(bad));
    }
  });

  test('documents without script slots or language scripts stay valid', () => {
    assert.equal(check(deck('japanese', 'meiryo')).valid, true);
    assert.equal(check(deck({id: 'english', bcp47: 'en-US', fontScheme: 'aptos', googleFontScheme: 'roboto'})).valid, true);
    assert.equal(check(deck({id: 'malay', ooxmlLang: 'ms-MY'})).valid, true);
  });
});

describe('paragraphDirection (FF-07 RTL paragraph rule)', () => {
  test('a left-to-right deck keeps every paragraph left-to-right', () => {
    for (const text of ['English', 'العربية', 'עברית', '', '123']) assert.equal(paragraphDirection(text, 'ltr'), 'ltr');
    assert.equal(paragraphDirection('العربية', undefined), 'ltr');
  });
  test('a right-to-left deck follows the first strong character', () => {
    assert.equal(paragraphDirection('مرحبا بالعالم', 'rtl'), 'rtl');
    assert.equal(paragraphDirection('שלום עולם', 'rtl'), 'rtl');
    assert.equal(paragraphDirection('ދިވެހި', 'rtl'), 'rtl');
    assert.equal(paragraphDirection('Hello مرحبا', 'rtl'), 'ltr');
    assert.equal(paragraphDirection('const x = 1;', 'rtl'), 'ltr');
    assert.equal(paragraphDirection('日本語', 'rtl'), 'ltr');
    assert.equal(paragraphDirection('2026 — مرحبا', 'rtl'), 'rtl');
    assert.equal(paragraphDirection('«Hello»', 'rtl'), 'ltr');
  });
  test('digits, punctuation, marks and empty text take the deck direction', () => {
    for (const text of ['', '   ', '42%', '١٢٣', '٬ ،', 'ً']) assert.equal(paragraphDirection(text, 'rtl'), 'rtl');
  });
  const mark = (...codes) => String.fromCodePoint(...codes);
  const [LRM, RLM, ALM, LRI, RLI, PDI] = [0x200e, 0x200f, 0x061c, 0x2066, 0x2067, 0x2069].map(code => mark(code));
  test('directional marks are strong and isolates are skipped', () => {
    assert.equal(paragraphDirection(`${LRM}١٢٣`, 'rtl'), 'ltr');
    assert.equal(paragraphDirection(`${RLM}123 abc`, 'rtl'), 'rtl');
    assert.equal(paragraphDirection(`${ALM}123 abc`, 'rtl'), 'rtl');
    assert.equal(paragraphDirection(`${LRI}English${PDI} مرحبا`, 'rtl'), 'rtl');
    assert.equal(paragraphDirection(`${RLI}مرحبا${PDI} Hello`, 'rtl'), 'ltr');
  });
  test('Old Uyghur and Garay letters are right-to-left; their digits are not strong', () => {
    assert.equal(paragraphDirection(`${mark(0x10f70, 0x10f71)} abc`, 'rtl'), 'rtl');
    assert.equal(paragraphDirection(`${mark(0x10d4a, 0x10d4b)} abc`, 'rtl'), 'rtl');
    assert.equal(paragraphDirection(`${mark(0x10d40, 0x10d41)} abc`, 'rtl'), 'ltr');
  });
  test('letter numbers such as Roman numerals are left-to-right strong', () => {
    assert.equal(paragraphDirection(`${mark(0x2162)} مرحبا`, 'rtl'), 'ltr');
    assert.equal(paragraphDirection(`${mark(0x216b)}`, 'rtl'), 'ltr');
  });
  test('it pairs with the resolver direction', () => {
    const {direction} = resolveScriptFonts(deck('arabic'));
    assert.equal(paragraphDirection('مرحبا', direction), 'rtl');
    assert.equal(paragraphDirection('مرحبا', resolveScriptFonts(deck('english')).direction), 'ltr');
  });
});
