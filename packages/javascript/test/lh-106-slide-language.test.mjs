import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate, resolveSlideContext } from '../dist/index.js';
import { composeSlide, quoteLanguage, resolveScriptFonts, resolveSlideDirection } from '../dist/composition.js';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';

const deck = { language: 'en-US', slides: [
  { title: 'English', items: ['First', 'Second'] },
  { language: 'ar-SA', title: 'العربية', items: ['الأول', 'الثاني'] },
  { language: { bcp47: 'ja', direction: 'ltr' }, title: '日本語', quote: '試して学ぶ' },
] };

test('LH-106: slide language is schema-valid and inherits only when omitted', () => {
  assert.equal(validate(deck, { only: ['format'] }).schemaValid, true);
  assert.equal(resolveScriptFonts(deck, { slideIndex: 0 }).bcp47, 'en-US');
  assert.equal(resolveScriptFonts(deck, { slideIndex: 1 }).bcp47, 'ar-SA');
  assert.equal(resolveScriptFonts(deck, { slideIndex: 1 }).scriptRole, 'complexScript');
  assert.equal(resolveScriptFonts(deck, { slideIndex: 2 }).script, 'Jpan');
  assert.equal(resolveScriptFonts(deck).bcp47, 'en-US', 'slide overrides never change deck resolution');
  assert.equal(resolveScriptFonts(deck, { slideIndex: 1, language: 'fr-FR' }).bcp47, 'fr-FR', 'a run override wins');
});

test('LH-106: direction and quotation marks use the same effective language', () => {
  assert.equal(resolveSlideDirection(deck, 0), 'ltr');
  assert.equal(resolveSlideDirection(deck, 1), 'rtl');
  assert.equal(quoteLanguage(deck, 2), 'ja');
  const context = resolveSlideContext(deck, 1);
  assert.equal(composeSlide(context.slide, context.options).direction, 'rtl');
  assert.equal(composeSlide(deck.slides[1]).direction, 'rtl', 'direct composition reads its own slide language');
  const withoutDeckLanguage = { slides: [deck.slides[1]] };
  assert.equal(resolveSlideDirection(withoutDeckLanguage, 0), 'rtl');
  assert.equal(quoteLanguage(withoutDeckLanguage, 0), 'ar-SA');
});

test('LH-106: Markdown preserves a string or inline slide language', () => {
  const markdown = toMarkdown(deck).markdown;
  assert.match(markdown, /language=ar-SA/);
  assert.deepEqual(fromMarkdown(markdown).presentation, deck);
});

test('LH-106: slide tags receive the located language validation rule', () => {
  const result = validate({ language: 'en-US', slides: [{ language: 'fr-fr', text: 'Bonjour' }] }, { only: ['format', 'content'] });
  assert.ok(result.findings.some(f => f.ruleId === 'opf/language-tag' && f.path === '/slides/0/language'));
  assert.equal(validate({ slides: [{ language: 'not_a_tag', text: 'Text' }] }).schemaValid, false);
});
