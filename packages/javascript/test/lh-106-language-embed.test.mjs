// LH-106: portable language-selected script schemes use the same reference walk as deck design.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {embed, validate, copySlides} from '../dist/index.js';
import {resolveScriptFonts} from '../dist/composition.js';

const source = 'https://language.example/catalog';
const record = family => ({name: family, major: family, minor: family});
const catalog = {source, fontSchemes: {arabic: record('Noto Naskh Arabic'), japanese: record('Noto Sans JP'), google: record('Noto Sans')}};
const findings = document => validate(document, {catalogs: []}).findings.filter(finding => finding.ruleId === 'opf/unresolved-reference');
const language = {bcp47: 'ar-SA', fontScheme: 'lang:arabic', googleFontScheme: 'lang:google'};

test('deck and slide language font schemes embed completely with no registered catalog', () => {
  const original = {catalogs: {lang: {source}}, language, slides: [{language: {bcp47: 'ja-JP', fontScheme: 'lang:japanese', googleFontScheme: 'lang:google'}, title: '日本語'}, {language: 'en-US', title: 'English'}]};
  const before = structuredClone(original), result = embed(original, {catalogs: [catalog]});
  assert.deepEqual(original, before, 'embedding never mutates authored language or content');
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(Object.keys(result.document.catalogs.lang.fontSchemes).sort(), ['arabic', 'google', 'japanese']);
  assert.deepEqual(findings(result.document), [], 'explicit empty catalogs prevents an accidental gallery fallback');
  assert.equal(resolveScriptFonts(result.document, {catalogs: [], slideIndex: 0}).heading.eastAsian, 'Noto Sans JP');
  assert.equal(resolveScriptFonts(result.document, {catalogs: [], slideIndex: 1}).lang, 'en-US');
  assert.deepEqual(embed(result.document, {catalogs: []}).document, result.document, 'standalone embedding is idempotent');
});

test('missing slide language schemes retain located validation and embed findings', () => {
  const document = {language: 'en-US', slides: [{language: {bcp47: 'ar-SA', fontScheme: 'missing-arabic', googleFontScheme: 'missing-google'}, title: 'عنوان'}]};
  const report = findings(document);
  assert.deepEqual(report.map(finding => finding.path).sort(), ['/slides/0/language/fontScheme', '/slides/0/language/googleFontScheme']);
  assert.deepEqual(embed(document, {catalogs: []}).unresolved.map(entry => entry.path).sort(), ['slides.0.language.fontScheme', 'slides.0.language.googleFontScheme']);
});

test('copying slides carries their language-selected schemes into a standalone target', () => {
  const sourceDocument = {catalogs: {lang: {source}}, slides: [{language, title: 'عنوان'}]};
  const result = copySlides(sourceDocument, {slides: [{title: 'Existing'}]}, [0], {catalogs: [catalog]});
  assert.deepEqual(findings(result.document), []);
  assert.equal(resolveScriptFonts(result.document, {catalogs: [], slideIndex: 1}).heading.complexScript, 'Noto Naskh Arabic');
});
