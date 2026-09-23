import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {fontSchemes, languages, resolveScriptFonts, scriptFontRole, validatePresentation} from '../dist/index.js';

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

describe('script classes', () => {
  test('Latin deck fills every slot with the chosen heading/body family', () => {
    const resolved = resolveScriptFonts(deck('english-gb'));
    assert.equal(resolved.lang, 'en-GB');
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
    assert.equal(resolveScriptFonts({slides: []}, {defaultLanguage: 'fr'}).languageId, 'french');
  });

  for (const [language, id, script] of [['ru', 'russian', 'Cyrl'], ['uk-UA', 'ukrainian', 'Cyrl'], ['sr-Cyrl', 'serbian-cyrillic', 'Cyrl'], ['greek', 'greek', 'Grek'], ['el-GR', 'greek', 'Grek']]) {
    test(`${language} uses the latin slot (${script})`, () => {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.languageId, id);
      assert.equal(resolved.script, script);
      assert.equal(resolved.scriptRole, 'latin');
      assert.equal(resolved.rtl, false);
      assert.deepEqual(resolved.body, same('Carlito'));
      assert.equal(resolved.supplement, undefined);
    });
  }

  const cjk = [
    ['japanese', 'ja', 'japanese', 'Jpan', 'Meiryo', 'Noto Sans JP', 'Jpan'],
    ['ja-JP', 'ja-JP', 'japanese', 'Jpan', 'Meiryo', 'Noto Sans JP', 'Jpan'],
    ['zh-Hans', 'zh-Hans', 'chinese-simplified', 'Hans', 'Microsoft YaHei', 'Noto Sans SC', 'Hans'],
    ['zh-CN', 'zh-CN', 'chinese-simplified', 'Hans', 'Microsoft YaHei', 'Noto Sans SC', 'Hans'],
    ['zh-TW', 'zh-TW', 'chinese-traditional', 'Hant', 'Microsoft JhengHei', 'Noto Sans TC', 'Hant'],
    ['korean', 'ko', 'korean', 'Kore', 'Malgun Gothic', 'Noto Sans KR', 'Hang'],
  ];
  for (const [language, lang, id, script, powerPoint, google, supplementScript] of cjk) {
    test(`${language} fills eastAsian from the language font scheme`, () => {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.lang, lang);
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
    ['arabic', 'ar', 'Arab', true, 'Arabic Typesetting', 'Noto Naskh Arabic'],
    ['fa-IR', 'fa-IR', 'Arab', true, 'Arabic Typesetting', 'Noto Naskh Arabic'],
    ['urdu', 'ur', 'Arab', true, 'Arabic Typesetting', 'Noto Nastaliq Urdu'],
    ['he-IL', 'he-IL', 'Hebr', true, 'David', 'Noto Sans Hebrew'],
    ['hindi', 'hi', 'Deva', false, 'Mangal', 'Noto Sans Devanagari'],
    ['bn', 'bn', 'Beng', false, 'Shonar Bangla', 'Noto Sans Bengali'],
    ['ta', 'ta', 'Taml', false, 'Latha', 'Noto Sans Tamil'],
    ['thai', 'th', 'Thai', false, 'Angsana New', 'Noto Sans Thai'],
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

  test('scriptFontRole classifies ISO 15924 codes case-insensitively', () => {
    for (const script of ['Latn', 'Cyrl', 'Grek', 'Armn', 'Geor', 'Ethi', 'Zzzz', 'nonsense']) assert.equal(scriptFontRole(script), 'latin');
    for (const script of ['Jpan', 'Hans', 'Hant', 'Kore', 'Hang', 'hira', 'KANA', 'Bopo']) assert.equal(scriptFontRole(script), 'eastAsian');
    for (const script of ['Arab', 'Hebr', 'Deva', 'Beng', 'Taml', 'Thai', 'Khmr', 'syrc']) assert.equal(scriptFontRole(script), 'complexScript');
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

  test('an East Asian design scheme fills its own slot before the language scheme', () => {
    const resolved = resolveScriptFonts(deck('zh-Hans', 'meiryo'));
    assert.deepEqual(resolved.body, same('Meiryo'));
    assert.deepEqual(resolved.sources, {eastAsian: 'schemeFamily', complexScript: 'latin'});
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
    assert.equal(override.lang, 'he');
    assert.equal(override.complexScript, 'Noto Sans Hebrew');
    assert.equal(override.rtl, true);
  });

  test('slide design overrides the deck font scheme per field', () => {
    const document = deck('japanese', 'aptos', {slides: [{title: 'Deck'}, {title: 'Slide', design: {fontScheme: {major: 'Carlito', minor: 'Carlito', eastAsian: {major: 'Noto Sans JP'}}}}]});
    assert.equal(resolveScriptFonts(document).body.latin, 'Aptos');
    const slide = resolveScriptFonts(document, {slideIndex: 1});
    assert.deepEqual(slide.body, {latin: 'Carlito', eastAsian: 'Noto Sans JP', complexScript: 'Carlito'});
    assert.throws(() => resolveScriptFonts(document, {slideIndex: 2}), RangeError);
    assert.throws(() => resolveScriptFonts(document, {slideIndex: 0.5}), RangeError);
  });

  test('options.language replaces the document language', () => {
    const resolved = resolveScriptFonts(deck('english'), {language: 'th-TH'});
    assert.equal(resolved.lang, 'th-TH');
    assert.equal(resolved.languageSource, 'option');
    assert.equal(resolved.complexScript, 'Angsana New');
  });

  test('unresolvable language references fall back to the default tag', () => {
    for (const language of ['klingon-dialect', 'https://acme.com/languages/x.json', 'pkg:@acme/decks/languages/x', {name: 'No tag'}]) {
      const resolved = resolveScriptFonts(deck(language));
      assert.equal(resolved.languageSource, 'default', JSON.stringify(language));
      assert.equal(resolved.lang, 'en-US');
    }
    const uncatalogued = resolveScriptFonts(deck('haw'));
    assert.equal(uncatalogued.lang, 'haw');
    assert.equal(uncatalogued.languageId, undefined);
    assert.equal(uncatalogued.script, 'Latn');
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

  test('every language record declares script and direction', () => {
    assert.ok(languages.length >= 93);
    for (const record of languages) {
      assert.match(record.script ?? '', /^[A-Z][a-z]{3}$/, record.id);
      assert.equal(record.direction, rtlScripts.has(record.script) ? 'rtl' : 'ltr', record.id);
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
        assert.equal(resolved.lang, record.bcp47);
        assert.equal(resolved.script, record.script);
        assert.equal(resolved.rtl, record.direction === 'rtl');
        assert.equal(resolveScriptFonts(deck(record.bcp47), {app}).languageId, record.id, record.bcp47);
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
  });
});
