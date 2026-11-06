// LH-180: LH-164's message surface is decided by composing the slide, and that composition measures what the engines draw: a host
// measurement that plans scripts (`forScripts`, the renderer's loadFonts() measurement, as the preview passes it) is planned with the slide's
// script fonts, as the PPTX exporter's own planned measurement (no `forScripts`) already is. Measured in the one Latin face, an Arabic message
// failed that composition in the preview alone, which kept the plain surface where the export took the accent.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSlideContext } from '../dist/index.js';

const ARABIC = /[؀-ۿ]/u;
// A host face with Latin glyphs only: Arabic text in it is a missing glyph, as in the office pack's Latin display face.
const latinOnly = (text, size) => {
  if (ARABIC.test(text)) throw Object.assign(new Error(`Font 'Latin Display' cannot display ${text.match(ARABIC)[0]}.`), { code: 'missing-glyph' });
  return text.length * size * 0.5;
};
// The script planner: each run in its script slot's face, which has the glyphs.
const planned = (text, size) => text.length * size * 0.5;
const host = (profiles = []) => ({
  measure: latinOnly,
  forScripts(profile) {
    profiles.push(profile);
    return { measure: planned };
  },
});
// The exporter's measurement: planned already, without `forScripts`.
const exported = { measure: planned };

const deckOf = (language, slides) => ({ name: 'Surfaces', language, slides });
const arabic = deckOf('ar', [{ title: 'تجاوزات الفهرس', text: 'يمكن الإشارة إلى سجلات الفهرس المحلية في المستند بمعرفها من المستند نفسه.' }]);
const english = deckOf('en-US', [{ title: 'Catalog Overrides', text: 'Document-local catalog records can be referenced by id from the same OPF document.' }]);
const surface = (deck, textMeasurement) => resolveSlideContext(deck, 0, { catalogs: [gallery], fonts: { textMeasurement } }).resolved.messageSurface?.kind;

test('LH-180: the preview\'s host measurement and the exporter\'s planned one decide the same surface for an Arabic message', () => {
  const profiles = [];
  assert.equal(surface(arabic, exported), 'display-message', 'the export measures with its script planner');
  assert.equal(surface(arabic, host(profiles)), 'display-message', 'the preview\'s host measurement is planned with the slide\'s script fonts');
  assert.ok(profiles.length > 0, 'the check asked the host for the slide\'s script plan');
  assert.equal(profiles[0].rtl, true, 'the plan is the Arabic slide\'s (right to left)');
  assert.equal(profiles[0].body.latin, resolveSlideContext(arabic, 0, { catalogs: [gallery] }).options.fontFamilies.body, 'its Latin slot is the slide\'s body family');
});

test('LH-180: a Latin message decides the same surface with the host measurement, the planned one and the estimate', () => {
  const estimate = resolveSlideContext(english, 0, { catalogs: [gallery] }).resolved.messageSurface?.kind;
  assert.equal(surface(english, host()), estimate);
  assert.equal(surface(english, exported), estimate);
});

test('LH-180: a measurement that cannot plan scripts is used as it is', () => {
  assert.equal(surface(arabic, { measure: latinOnly }), undefined, 'the composition fails in the Latin face, so the slide keeps the plain surface');
});
