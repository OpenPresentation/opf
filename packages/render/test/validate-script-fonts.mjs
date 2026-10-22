// RR-59 (opf#485): the registry measurement plans script faces for core. `loadFonts().textMeasurement.forScripts(profile)` is the
// script planner (createScriptFonts) core `validate` and `paginate` ask for each slide's measurement, so they measure Arabic runs
// in the face this renderer draws (Arabic Typesetting -> Noto Naskh Arabic) instead of the Latin face the style names, where the
// raw measurement throws missing-glyph. Offline and deterministic.
import assert from 'node:assert/strict';
import { paginate, validate } from '@openpresentation/opf';
import { resolveScriptFonts } from '@openpresentation/opf/composition';
import { createScriptFonts } from '../dist/fonts.js';
import { loadFonts } from '../dist/fonts-node.js';
import { catalogs, toSvg } from './catalog-harness.mjs';

const TITLE = 'مراجعة ربع سنوية للمنتج';
const BODY = 'بدأ العمل على المنصة الجديدة في مطلع العام، وقد شمل ذلك إعادة تصميم تجربة المستخدم بالكامل، وتوحيد الخطوط والألوان عبر جميع الشرائح.';
const arabicDeck = { name: 'Arabic deck', language: 'ar-SA', slides: [{ title: TITLE, text: BODY }, { title: 'الخطوات التالية', items: ['إطلاق النسخة الثانية', 'مراجعة القوالب'] }] };
const runInEnglish = {
  name: 'Arabic run in an English deck',
  language: 'en-US',
  slides: [{ title: ['Quarterly review: ', { text: 'مراجعة ربع سنوية', lang: 'ar-SA' }], text: ['The Arabic phrase ', { text: TITLE, lang: 'ar-SA', bold: true }, ' sits inside this English paragraph.'] }],
};
const handle = (presentation) => loadFonts({ pack: 'office', scripts: 'auto', presentation, renderOptions: { catalogs } });
const layoutFailures = (report) => report.findings.filter((finding) => finding.ruleId === 'opf/layout-failed');

// 1. The hook: a planned measurement that measures Arabic in the complex-script slot's face, as createScriptFonts does.
{
  const fonts = await handle(arabicDeck);
  const raw = fonts.textMeasurement;
  assert.equal(typeof raw.forScripts, 'function');
  const style = raw.resolveStyle({ fontFamily: 'Aptos Display', fontWeight: 700, path: 'slides.0.title' });
  assert.throws(() => raw.measure(TITLE, 40, style), { code: 'missing-glyph' }, 'the raw measurement measures one face');
  const profile = resolveScriptFonts(arabicDeck, { catalogs, slideIndex: 0 });
  assert.equal(profile.heading.complexScript, 'Arabic Typesetting');
  const planned = raw.forScripts(profile);
  const width = planned.measure(TITLE, 40, style);
  assert.ok(Number.isFinite(width) && width > 0);
  assert.equal(width, createScriptFonts(profile, raw).textMeasurement.measure(TITLE, 40, style), 'the planner the renderer draws with');
  // The run is drawn in Noto Naskh Arabic at the policy's size multiplier, as the preview draws it.
  assert.deepEqual(createScriptFonts(profile, raw).plan(TITLE, style).map((run) => run.family), ['Noto Naskh Arabic']);
  // A planned measurement plans again from the registry, never from itself.
  assert.equal(planned.forScripts(profile).measure(TITLE, 40, style), width);
}

// 2. validate and paginate with the handle: no opf/layout-failed, no missing-glyph, for an ar-SA deck and an ar-SA run in an en-US deck.
for (const deck of [arabicDeck, runInEnglish]) {
  const fonts = await handle(deck);
  const report = validate(deck, { catalogs, fonts });
  assert.deepEqual(layoutFailures(report), [], deck.name);
  assert.equal(report.checks.layout, 'measured');
  assert.equal(paginate(deck, { catalogs, fonts }).presentation.slides.length, deck.slides.length, deck.name);
  assert.equal(toSvg(deck, { fonts }).length, deck.slides.length, 'the same handle renders the deck');
}

// 3. Control: without the Arabic script face no loaded face has the glyphs, and validate still reports it.
{
  const fonts = await loadFonts({ pack: 'office' });
  const failures = layoutFailures(validate(arabicDeck, { catalogs, fonts }));
  assert.equal(failures.length, 2);
  assert.match(failures[0].message, /cannot display U\+6/);
}

console.log('validate and paginate measure script runs with the registry\'s script planner (forScripts).');
