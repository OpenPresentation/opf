// The self-contained View is UTF-8 HTML. Unicode must survive JavaScript
// compilation without reopening the inline script or changing string values.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {transform} from 'esbuild';
import {DECK_APP_HTML} from '../dist/index.js';

test('the served View is the built UTF-8 document with a single inline module', async () => {
  assert.equal(DECK_APP_HTML, await readFile(new URL('../app-dist/deck-app.html', import.meta.url), 'utf8'));
  assert.match(DECK_APP_HTML, /<meta charset="utf-8">/);
  assert.equal((DECK_APP_HTML.match(/<script type="module">/g) ?? []).length, 1);
  assert.equal((DECK_APP_HTML.match(/<\/script\s*>/gi) ?? []).length, 1);
  const builder = await readFile(new URL('../scripts/build-app.mjs', import.meta.url), 'utf8');
  assert.match(builder, /charset:\s*["']utf8["']/);
  assert.match(builder, /platform:\s*["']browser["']/);
});

test('supported UTF-8 output preserves Unicode, separators and lone surrogates while protecting inline HTML', async () => {
  const expected = ['Καλημέρα', '日本語', '🙂', '\u2028', '\u2029', '\ud800', '\udfff', '</script><script>attack()</script>', '</SCRIPT>', '<!--'];
  const source = `globalThis.values = ${JSON.stringify(expected)}; globalThis.regex = /日本語/u.test("日本語");`;
  for (const charset of ['ascii', 'utf8']) {
    const {code} = await transform(source, {charset, platform: 'browser', target: 'es2022', minify: true});
    assert.doesNotMatch(code, /<\/script/i, 'esbuild keeps its default inline-script protection');
    assert.doesNotMatch(code, /\ufffd/, 'unpaired UTF-16 code units must not become replacement characters');
    const context = {};
    runInNewContext(code, context);
    assert.deepEqual(Array.from(context.values), expected);
    assert.equal(context.regex, true);
  }
});
