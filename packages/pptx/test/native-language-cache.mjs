// RR-105: the right-to-left language cache of native-language-provenance.js is keyed by altLang values that imported files name. It
// keeps only short language-tag shapes and a bounded number of them, so a long-running host never keeps a crafted file's strings.
import assert from 'node:assert/strict';
import {rtlLanguage, rtlLanguageCacheSize} from '../dist/native-language-provenance.js';

assert.equal(rtlLanguage('ar-SA'), true);
assert.equal(rtlLanguage('he-IL'), true);
assert.equal(rtlLanguage('de-DE'), false);
assert.equal(rtlLanguage('ar-SA'), true, 'a cached tag answers the same');
const before = rtlLanguageCacheSize();
for (const value of ['x'.repeat(100000), `ar-${'a'.repeat(40)}`, 'ar SA', '<ar>', '', 'ar-SA\u0000', undefined, 12, {}])
  assert.equal(rtlLanguage(value), false, `${JSON.stringify(String(value)).slice(0, 30)} is not a language tag`);
assert.equal(rtlLanguageCacheSize(), before, 'values that are not short language tags are never cached');
for (let i = 0; i < 1000; i++) rtlLanguage(`zz-x${i}`);
assert.ok(rtlLanguageCacheSize() <= 64, `the cache is bounded (${rtlLanguageCacheSize()})`);
assert.equal(rtlLanguage('ar-SA'), true, 'an evicted tag resolves again');
console.log('Native language cache: only short language tags, at most 64 of them.');
