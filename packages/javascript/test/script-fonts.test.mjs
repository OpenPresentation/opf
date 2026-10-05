import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {DEFAULT_FONT_SCHEME, fontSchemes, languages, paragraphDirection, resolveScriptFonts, scriptFontRole, validatePresentation} from '../dist/index.js';

// Fixtures choose openly licensed families (Carlito for the Calibri class,
// Noto for CJK, Arabic, Hebrew, Devanagari and Thai). The resolver only
// returns family names; PowerPoint-target catalog names such as Meiryo appear
// here as strings and no font binary is loaded or bundled.
const carlito = {major: 'Carlito', minor: 'Carlito'};
const deck = (language, fontScheme = carlito, extra = {}) => ({
  slides: [{title: 'Script fonts'}],
  ...(language === undefined ? {} : {language}),
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
    assert.equal(resolved.languageId, 'english-gb');
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
    assert.equal(resolved.languageId, 'english-us');
    assert.equal(resolved.languageSource, 'default');
    assert.deepEqual(resolved.heading, same('Aptos Display'));
    assert.deepEqual(resolved.body, same('Aptos'));
    const french = resolveScriptFonts({slides: []}, {defaultLanguage: 'fr'});
    assert.equal(french.languageId, 'french');
    assert.equal(french.lang, 'fr-FR');
    assert.equal(resolveScriptFonts({slides: []}, {defaultLanguage: 'und'}).lang, 'en-US');
  });

  for (const [language, id, script, lang] of [['ru', 'russian', 'Cyrl', 'ru-RU'], ['uk-UA', 'ukrainian', 'Cyrl', 'uk-UA'], ['sr-Cyrl', 'serbian-cyrillic', 'Cyrl', 'sr-Cyrl-RS'], ['greek', 'greek', 'Grek', 'el-GR'], ['el-GR', 'greek', 'Grek', 'el-GR']]) {
    test(`${language} uses the latin slot (${script})`, () => {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.languageId, id);
      assert.equal(resolved.lang, lang);
      assert.equal(resolved.script, script);
      assert.equal(resolved.scriptRole, 'latin');
      assert.equal(resolved.rtl, false);
      assert.deepEqual(resolved.body, same('Carlito'));
      assert.equal(resolved.supplement, undefined);
    });
  }

  const cjk = [
    ['japanese', 'ja-JP', 'ja', 'japanese', 'Jpan', 'Meiryo', 'Noto Sans JP', 'Jpan'],
    ['ja-JP', 'ja-JP', 'ja-JP', 'japanese', 'Jpan', 'Meiryo', 'Noto Sans JP', 'Jpan'],
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
      assert.equal(resolved.languageId, id);
      assert.equal(resolved.script, script);
      assert.equal(resolved.scriptRole, 'eastAsian');
      assert.equal(resolved.rtl, false);
      assert.deepEqual(resolved.body, {latin: 'Carlito', eastAsian: powerPoint, complexScript: 'Carlito'});
      assert.deepEqual(resolved.heading, resolved.body);
      assert.deepEqual(resolved.sources, {eastAsian: 'language', complexScript: 'latin'});
      assert.deepEqual(resolved.supplement, {script: supplementScript, heading: powerPoint, body: powerPoint});
      const googleResolved = resolveScriptFonts(deck(language), {app: 'Google Slides'});
      assert.equal(googleResolved.eastAsian, google);
      assert.equal(googleResolved.latin, 'Carlito');
    });
  }

  const complex = [
    ['arabic', 'ar-SA', 'Arab', true, 'Arabic Typesetting', 'Noto Naskh Arabic'],
    ['fa-IR', 'fa-IR', 'Arab', true, 'Arabic Typesetting', 'Noto Naskh Arabic'],
    ['urdu', 'ur-PK', 'Arab', true, 'Arabic Typesetting', 'Noto Nastaliq Urdu'],
    ['he-IL', 'he-IL', 'Hebr', true, 'David', 'Noto Sans Hebrew'],
    ['hindi', 'hi-IN', 'Deva', false, 'Mangal', 'Noto Sans Devanagari'],
    ['bn', 'bn-BD', 'Beng', false, 'Shonar Bangla', 'Noto Sans Bengali'],
    ['ta', 'ta-IN', 'Taml', false, 'Latha', 'Noto Sans Tamil'],
    ['thai', 'th-TH', 'Thai', false, 'Angsana New', 'Noto Sans Thai'],
  ];
  for (const [language, lang, script, rtl, powerPoint, google] of complex) {
    test(`${language} fills complexScript${rtl ? ' and is right-to-left' : ''}`, () => {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.lang, lang);
      assert.equal(resolved.script, script);
      assert.equal(resolved.scriptRole, 'complexScript');
      assert.equal(resolved.rtl, rtl);
      assert.equal(resolved.direction, rtl ? 'rtl' : 'ltr');
      assert.deepEqual(resolved.body, {latin: 'Carlito', eastAsian: 'Carlito', complexScript: powerPoint});
      assert.deepEqual(resolved.sources, {eastAsian: 'latin', complexScript: 'language'});
      assert.deepEqual(resolved.supplement, {script, heading: powerPoint, body: powerPoint});
      assert.equal(resolveScriptFonts(deck(language), {app: 'Google Slides'}).complexScript, google);
    });
  }

  test('scripts outside latin/ea/cs keep the latin slot and get a supplemental theme font', () => {
    const armenian = resolveScriptFonts(deck('armenian'));
    assert.equal(armenian.script, 'Armn');
    assert.equal(armenian.scriptRole, 'latin');
    assert.deepEqual(armenian.body, same('Carlito'));
    assert.deepEqual(armenian.supplement, {script: 'Armn', heading: 'Sylfaen', body: 'Sylfaen'});
    assert.deepEqual(resolveScriptFonts(deck('ka'), {app: 'Google Slides'}).supplement, {script: 'Geor', heading: 'Noto Sans Georgian', body: 'Noto Sans Georgian'});
  });

  test('the theme supplement of a latin-slot script names the chosen cs scheme, not the language default (FF-46, opf#375)', () => {
    const ebrima = (extra = {}) => ({major: 'Ebrima', minor: 'Ebrima', languageFamily: 'cs', ...extra});
    // A deck language with no script font in the scheme keeps the catalog default (Nyala), as before.
    assert.deepEqual(resolveScriptFonts(deck('amharic')).supplement, {script: 'Ethi', heading: 'Nyala', body: 'Nyala'});
    // The design selects a cs scheme that serves the language: the Ethi entry names that family, in both slots.
    for (const scheme of [ebrima(), ebrima({languages: ['Amharic']}), ebrima({languages: ['amharic']})]) {
      const resolved = resolveScriptFonts(deck('amharic', scheme));
      assert.equal(resolved.script, 'Ethi');
      assert.equal(resolved.scriptRole, 'latin');
      assert.equal(resolved.sources.complexScript, 'schemeFamily');
      assert.deepEqual(resolved.supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Ebrima'});
    }
    // The same scheme as an inline catalog record referenced by id (how a deck selects "the ebrima scheme").
    const record = {id: 'ebrima', name: 'Ebrima', app: 'PowerPoint', ...ebrima({languages: ['Amharic']})};
    const byId = resolveScriptFonts(deck('amharic', 'ebrima', {catalogs: {fontSchemes: {records: [record]}}}));
    assert.deepEqual(byId.supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Ebrima'});
    // A heading and body that differ are kept apart.
    const pair = resolveScriptFonts(deck('amharic', ebrima({major: 'Ebrima', minor: 'Nyala'})));
    assert.deepEqual(pair.supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Nyala'});
    // Catalog schemes: the author-chosen scheme wins over the language's own, for either app.
    assert.deepEqual(resolveScriptFonts(deck('amharic', 'noto-sans-ethiopic')).supplement, {script: 'Ethi', heading: 'Noto Sans Ethiopic', body: 'Noto Sans Ethiopic'});
    assert.deepEqual(resolveScriptFonts(deck('amharic', 'nyala'), {app: 'Google Slides'}).supplement, {script: 'Ethi', heading: 'Nyala', body: 'Nyala'});
    // Armenian and Georgian are the same class: Sylfaen is the catalog default, a chosen cs scheme replaces it.
    for (const [language, script] of [['armenian', 'Armn'], ['georgian', 'Geor']]) {
      assert.deepEqual(resolveScriptFonts(deck(language, ebrima())).supplement, {script, heading: 'Ebrima', body: 'Ebrima'}, language);
      assert.deepEqual(resolveScriptFonts(deck(language, 'sylfaen')).supplement, {script, heading: 'Sylfaen', body: 'Sylfaen'}, language);
    }
    assert.deepEqual(resolveScriptFonts(deck('armenian', 'noto-sans-armenian')).supplement, {script: 'Armn', heading: 'Noto Sans Armenian', body: 'Noto Sans Armenian'});
    assert.deepEqual(resolveScriptFonts(deck('georgian', 'noto-sans-georgian')).supplement, {script: 'Geor', heading: 'Noto Sans Georgian', body: 'Noto Sans Georgian'});
    // Nothing else changes: the slots, the language and the script of the Amharic deck.
    const plain = resolveScriptFonts(deck('amharic', ebrima()));
    assert.deepEqual(plain.body, same('Ebrima'));
    assert.equal(plain.lang, 'am-ET');
  });

  test('an explicit complexScript slot is the deck\'s choice for a latin-slot script: the inline Ebrima deck of the native FF-46 run (opf#375)', () => {
    // scripts-40-amharic-ebrima: inline = (family) => ({major: family, minor: family, complexScript: {major: family, minor: family}}), language am.
    const inline = (family, slot = 'complexScript') => ({major: family, minor: family, [slot]: {major: family, minor: family}});
    for (const language of ['am', 'amharic', 'am-ET']) {
      const resolved = resolveScriptFonts(deck(language, inline('Ebrima')));
      assert.equal(resolved.script, 'Ethi');
      assert.equal(resolved.lang, 'am-ET');
      assert.deepEqual(resolved.sources, {eastAsian: 'latin', complexScript: 'fontScheme'});
      assert.deepEqual(resolved.heading, same('Ebrima'));
      assert.deepEqual(resolved.supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Ebrima'}, language);
    }
    // Heading and body are kept apart; a slot with one side falls back to the other (core's pair rule).
    const split = resolveScriptFonts(deck('amharic', {major: 'Ebrima', minor: 'Ebrima', complexScript: {major: 'Ebrima', minor: 'Nyala'}}));
    assert.deepEqual(split.supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Nyala'});
    // Armenian and Georgian are the same class.
    assert.deepEqual(resolveScriptFonts(deck('armenian', inline('Ebrima'))).supplement, {script: 'Armn', heading: 'Ebrima', body: 'Ebrima'});
    assert.deepEqual(resolveScriptFonts(deck('georgian', inline('Ebrima'))).supplement, {script: 'Geor', heading: 'Ebrima', body: 'Ebrima'});
    // A catalog record that carries a complexScript slot is the same choice.
    const record = {id: 'brand-ethiopic', major: 'Carlito', minor: 'Carlito', complexScript: {major: 'Ebrima', minor: 'Ebrima'}};
    assert.deepEqual(resolveScriptFonts(deck('amharic', 'brand-ethiopic', {catalogs: {fontSchemes: {records: [record]}}})).supplement, {script: 'Ethi', heading: 'Ebrima', body: 'Ebrima'});
    // An explicit East Asian slot (the MS Gothic form) is not a choice for Ethiopic, Armenian or Georgian text.
    for (const [language, script, family] of [['amharic', 'Ethi', 'Nyala'], ['armenian', 'Armn', 'Sylfaen'], ['georgian', 'Geor', 'Sylfaen']]) {
      assert.deepEqual(resolveScriptFonts(deck(language, inline('MS Gothic', 'eastAsian'))).supplement, {script, heading: family, body: family}, language);
    }
    // The language's own scripts in the same deck are unchanged by an explicit slot for the other side.
    assert.deepEqual(resolveScriptFonts(deck('amharic')).supplement, {script: 'Ethi', heading: 'Nyala', body: 'Nyala'});
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
    assert.deepEqual(resolveScriptFonts(deck('japanese', inline('Ebrima', 'complexScript'))).supplement, {script: 'Jpan', heading: 'Meiryo', body: 'Meiryo'});
    // Complex-script languages follow an explicit complexScript slot; an explicit eastAsian slot leaves them on the language default.
    for (const [language, script, family] of [['arabic', 'Arab', 'Arabic Typesetting'], ['hebrew', 'Hebr', 'David'], ['hindi', 'Deva', 'Mangal'], ['thai', 'Thai', 'Angsana New']]) {
      assert.deepEqual(resolveScriptFonts(deck(language, inline('Ebrima', 'complexScript'))).supplement, {script, heading: 'Ebrima', body: 'Ebrima'}, language);
      assert.deepEqual(resolveScriptFonts(deck(language, inline('MS Gothic', 'eastAsian'))).supplement, {script, heading: family, body: family}, language);
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

  test('a scheme that does not choose a family for the script leaves the language supplement alone (FF-46, opf#375)', () => {
    const nyala = {script: 'Ethi', heading: 'Nyala', body: 'Nyala'};
    const base = {major: 'Ebrima', minor: 'Ebrima'};
    // A latin scheme, an ea scheme, a cs scheme for another language and an explicit East Asian slot name no family for Ethiopic text.
    assert.deepEqual(resolveScriptFonts(deck('amharic', base)).supplement, nyala);
    assert.deepEqual(resolveScriptFonts(deck('amharic', {...base, languageFamily: 'ea'})).supplement, nyala);
    assert.deepEqual(resolveScriptFonts(deck('amharic', {...base, languageFamily: 'cs', languages: ['Arabic']})).supplement, nyala);
    assert.deepEqual(resolveScriptFonts(deck('amharic', {...base, eastAsian: {major: 'Ebrima', minor: 'Ebrima'}})).supplement, nyala);
    assert.deepEqual(resolveScriptFonts(deck('amharic', 'calibri')).supplement, nyala);
    // A complex-script language still reads its supplement from its own slot, which already follows the scheme.
    assert.deepEqual(resolveScriptFonts(deck('arabic', {...base, languageFamily: 'cs'})).supplement, {script: 'Arab', heading: 'Ebrima', body: 'Ebrima'});
    // Latin, Cyrillic and Greek decks get no supplement from a cs scheme.
    for (const language of ['english-us', 'russian', 'greek']) assert.equal(resolveScriptFonts(deck(language, {...base, languageFamily: 'cs'})).supplement, undefined, language);
  });

  test('every catalog scheme and language: a latin-slot script names the cs scheme only when it serves the language (FF-46, opf#375)', () => {
    const latinSlotLanguages = languages.filter((record) => ['Armn', 'Geor', 'Ethi'].includes(record.script));
    assert.deepEqual(latinSlotLanguages.map((record) => record.id).sort(), ['amharic', 'armenian', 'georgian']);
    for (const language of latinSlotLanguages) for (const scheme of fontSchemes) for (const app of ['PowerPoint', 'Google Slides']) {
      const resolved = resolveScriptFonts({language: language.id, design: {fontScheme: scheme.id}}, {app});
      const own = app === 'Google Slides' ? language.googleFontScheme : language.fontScheme;
      const ownScheme = fontSchemes.find((entry) => entry.id === own);
      const serves = scheme.languageFamily === 'cs' && (!scheme.languages?.length || scheme.languages.some((name) => name.toLowerCase() === language.name.toLowerCase()));
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
      assert.equal(resolved.languageId, id, language);
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
      for (const [language, id] of cases) assert.equal(resolveScriptFonts(deck(language)).languageId, id, language);
    });
    assert.equal(resolveScriptFonts(deck('zh-HK')).lang, 'zh-HK');
    assert.equal(resolveScriptFonts(deck('sr')).lang, 'sr-Cyrl-RS');
  });

  test('catalog ids and catalog tags never consult Intl.Locale', () => {
    withoutIntlLocale(() => {
      for (const record of languages) {
        for (const reference of [record.id, record.bcp47, {id: record.id}, {bcp47: record.bcp47}]) {
          const resolved = resolveScriptFonts(deck(reference));
          assert.equal(resolved.languageId, record.id, JSON.stringify(reference));
          assert.equal(resolved.script, record.script, JSON.stringify(reference));
        }
      }
    });
  });

  test('only uncatalogued tags use the runtime likely subtags', () => {
    const hawaiian = resolveScriptFonts(deck('haw'));
    assert.equal(hawaiian.lang, 'haw');
    assert.equal(hawaiian.languageId, undefined);
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

  test('a script design scheme fills its own slot only for the languages it lists', () => {
    const japanese = resolveScriptFonts(deck('japanese', 'meiryo'));
    assert.deepEqual(japanese.body, same('Meiryo'));
    assert.deepEqual(japanese.sources, {eastAsian: 'schemeFamily', complexScript: 'latin'});
    const korean = resolveScriptFonts(deck('korean', 'meiryo'));
    assert.deepEqual(korean.body, {latin: 'Meiryo', eastAsian: 'Malgun Gothic', complexScript: 'Meiryo'});
    assert.equal(korean.sources.eastAsian, 'language');
    assert.equal(resolveScriptFonts(deck('zh-Hans', 'meiryo')).eastAsian, 'Microsoft YaHei');
    const traditional = resolveScriptFonts(deck('zh-Hant', 'microsoft-yahei'));
    assert.equal(traditional.eastAsian, 'Microsoft YaHei', 'scheme language names match case-insensitively');
    assert.equal(traditional.sources.eastAsian, 'schemeFamily');
    assert.equal(resolveScriptFonts(deck('pa-Guru', 'raavi')).sources.complexScript, 'schemeFamily', 'a base name admits qualified names');
    const unlisted = resolveScriptFonts(deck('korean', {major: 'Noto Sans JP', minor: 'Noto Sans JP', languageFamily: 'ea'}));
    assert.equal(unlisted.eastAsian, 'Noto Sans JP', 'an empty languages list admits every language');
    assert.equal(unlisted.sources.eastAsian, 'schemeFamily');
    const arabicInMeiryo = resolveScriptFonts(deck('arabic', 'meiryo'));
    assert.deepEqual(arabicInMeiryo.body, {latin: 'Meiryo', eastAsian: 'Meiryo', complexScript: 'Arabic Typesetting'});
  });

  test('catalog font-scheme records may carry script slots', () => {
    const record = {id: 'brand-sans', major: 'Carlito', minor: 'Carlito', eastAsian: {major: 'Noto Sans SC', minor: 'Noto Sans SC'}};
    const resolved = resolveScriptFonts(deck('korean', 'brand-sans', {catalogs: {fontSchemes: {records: [record]}}}));
    assert.equal(resolved.eastAsian, 'Noto Sans SC');
    assert.equal(resolved.sources.eastAsian, 'fontScheme');
  });

  test('inline language records and objects override the bundled catalog', () => {
    const inline = {catalogs: {languages: {records: [{id: 'japanese', name: 'Japanese', bcp47: 'ja-JP', fontScheme: 'noto-sans-jp'}]}}};
    const resolved = resolveScriptFonts(deck('japanese', carlito, inline));
    assert.equal(resolved.lang, 'ja-JP');
    assert.equal(resolved.script, 'Jpan');
    assert.equal(resolved.eastAsian, 'Noto Sans JP');
    const object = resolveScriptFonts(deck({bcp47: 'ar-SA', name: 'Arabic (Saudi Arabia)', direction: 'rtl', script: 'Arab'}));
    assert.equal(object.lang, 'ar-SA');
    assert.equal(object.languageId, 'arabic');
    assert.equal(object.complexScript, 'Arabic Typesetting');
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

  test('the shared DEFAULT_FONT_SCHEME applies only when no slide, deck or theme scheme is named', () => {
    const customTheme = {slides: [{title: 'Custom theme'}], design: {theme: {name: 'Custom'}}};
    assert.equal(DEFAULT_FONT_SCHEME, 'aptos');
    assert.deepEqual(resolveScriptFonts(customTheme).heading, same('Aptos Display'), 'the shared default applies');
    assert.equal(resolveScriptFonts(customTheme).body.latin, 'Aptos');
    assert.equal(resolveScriptFonts(customTheme, {defaultFontScheme: 'roboto'}).body.latin, 'Aptos', 'there is no per-call default option');
    assert.equal(resolveScriptFonts({slides: [], design: {theme: {name: 'Custom', fontScheme: 'roboto'}}}).body.latin, 'Roboto');
    assert.equal(resolveScriptFonts(deck('english')).body.latin, 'Carlito');
  });

  test('options.language replaces the document language', () => {
    const resolved = resolveScriptFonts(deck('english'), {language: 'th-TH'});
    assert.equal(resolved.lang, 'th-TH');
    assert.equal(resolved.languageSource, 'option');
    assert.equal(resolved.complexScript, 'Angsana New');
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
    resolveScriptFonts(document, {app: 'Google Slides'});
    assert.deepEqual(document, before);
  });
});

describe('bundled catalogs', () => {
  const rtlScripts = new Set(['Arab', 'Hebr']);
  const schemeById = new Map(fontSchemes.map((record) => [record.id, record]));

  test('every language record declares script, direction and an OOXML culture tag', () => {
    assert.ok(languages.length >= 93);
    for (const record of languages) {
      assert.match(record.script ?? '', /^[A-Z][a-z]{3}$/, record.id);
      assert.equal(record.direction, rtlScripts.has(record.script) ? 'rtl' : 'ltr', record.id);
      assert.match(record.ooxmlLang ?? '', /^[a-z]{2,3}(-[A-Z][a-z]{3})?-[A-Z]{2}$/, record.id);
    }
  });

  test('the catalogs cover every FF-07 script class', () => {
    const scripts = new Set(languages.map((record) => record.script));
    for (const script of ['Latn', 'Cyrl', 'Grek', 'Jpan', 'Hans', 'Hant', 'Kore', 'Arab', 'Hebr', 'Deva', 'Thai']) assert.ok(scripts.has(script), script);
  });

  for (const app of ['PowerPoint', 'Google Slides']) {
    test(`every language resolves by id and by tag for ${app}`, () => {
      for (const record of languages) {
        const resolved = resolveScriptFonts(deck(record.id), {app});
        assert.equal(resolved.languageId, record.id);
        assert.equal(resolved.lang, record.ooxmlLang);
        assert.equal(resolved.bcp47, record.bcp47);
        assert.equal(resolved.script, record.script);
        assert.equal(resolved.rtl, record.direction === 'rtl');
        const byTag = resolveScriptFonts(deck(record.bcp47), {app});
        assert.equal(byTag.languageId, record.id, record.bcp47);
        assert.equal(byTag.lang, /-[A-Z]{2}$/.test(record.bcp47) ? record.bcp47 : record.ooxmlLang, record.bcp47);
        const scheme = schemeById.get(app === 'Google Slides' ? record.googleFontScheme : record.fontScheme);
        assert.ok(scheme, `${record.id} names a bundled font scheme`);
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
    assert.equal(validatePresentation(document).valid, true, JSON.stringify(validatePresentation(document).errors));
    for (const bad of [{eastAsian: {}}, {eastAsian: {major: 'Noto Sans JP', typeface: 'x'}}, {complexScript: 'Noto Naskh Arabic'}]) {
      assert.equal(validatePresentation(deck('japanese', {id: 'aptos', ...bad})).valid, false, JSON.stringify(bad));
    }
  });

  test('documents without script slots or language scripts stay valid', () => {
    assert.equal(validatePresentation(deck('japanese', 'meiryo')).valid, true);
    assert.equal(validatePresentation(deck({id: 'english', bcp47: 'en-US', fontScheme: 'aptos', googleFontScheme: 'roboto'})).valid, true);
    assert.equal(validatePresentation(deck({id: 'malay', ooxmlLang: 'ms-MY'})).valid, true);
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
