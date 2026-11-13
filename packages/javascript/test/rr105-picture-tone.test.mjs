import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSlideContext, validate } from '../dist/index.js';

// RR-105 (coverage findings 17 and 18): a picture background that names no tone takes the one its recolor, opacity and overlay imply, so
// text over a darkened picture turns light; an explicit tone always wins, and a photograph with nothing over it keeps the old default.

const deck = (background, extra = {}) => ({
  $schema: 'https://openpresentation.org/schema/opf/v1',
  language: 'en-US',
  design: { background: 'light1' },
  slides: [{ title: 'A cropped picture in brand colors', text: 'Cover fit around a focus point, recolored, with a band at the bottom.', design: { background: { type: 'image', src: 'https://example.com/harbor.png', alt: 'Harbor', ...background } }, ...extra }],
});
const dark = (document) => resolveSlideContext(document, 0).resolved.roles.dark;

test('a duotone in dark colors with a dark band makes the picture dark (finding 17)', () => {
  const background = { recolor: { dark: 'dark2', light: 'accent1' }, overlay: { color: 'dark1', opacity: 0.6, edge: 'bottom', size: 0.5 } };
  assert.equal(dark(deck(background)), true);
  const context = resolveSlideContext(deck(background), 0);
  assert.equal(context.options.darkBackground, true);
  assert.equal(context.options.roles.text.toUpperCase(), '#FFFFFF');
  // The author's tone always wins.
  assert.equal(dark(deck({ ...background, tone: 'light' })), false);
});

test('a full-frame dark overlay makes a photograph dark, a light one keeps it light (finding 18)', () => {
  assert.equal(dark(deck({ overlay: { color: 'dark1', opacity: 0.4 } })), true);
  assert.equal(dark(deck({ overlay: { color: 'light1', opacity: 0.4 } })), false);
  // A layout's own variant does not outrank the slide's picture: a cover over a darkened photograph draws light text.
  assert.equal(dark({ ...deck({ overlay: { color: 'dark1', opacity: 0.4 } }), slides: [{ layout: 'cover', title: 'Heading', subtitle: 'Harbor review', design: { background: { type: 'image', src: 'https://example.com/harbor.png', overlay: { color: 'dark1', opacity: 0.4 } } } }] }), true);
});

test('a photograph with nothing over it implies no tone: the old default holds', () => {
  assert.equal(dark(deck({})), false);
  assert.equal(dark(deck({ overlay: false })), false);
  assert.equal(dark(deck({ recolor: 'grayscale' })), false);
  // A faint dark band over an unknown photograph decides nothing either.
  assert.equal(dark(deck({ overlay: { color: 'dark1', opacity: 0.6, edge: 'bottom' } })), false);
  // A deck variant still applies when the picture implies no tone.
  assert.equal(dark({ ...deck({}), design: { variant: 'dark1' } }), true);
});

test('opf/text-on-image warns when text is too faint over every color the picture can show', () => {
  const onImage = (document) => validate(document, { only: ['accessibility'] }).findings.filter((finding) => finding.ruleId === 'opf/text-on-image');
  // Dark text forced onto a picture recolored in dark colors, with no scrim: certain to fail, whatever the picture.
  const forced = onImage(deck({ recolor: { dark: 'dark1', light: 'dark2' }, overlay: false, tone: 'light' }));
  const warnings = forced.filter((finding) => finding.severity === 'warning');
  assert.ok(warnings.length >= 1, JSON.stringify(forced));
  assert.ok(warnings.every((finding) => finding.measured.best < finding.measured.needed));
  // The same picture without the tone: the text turns light and reads, so nothing warns.
  assert.deepEqual(onImage(deck({ recolor: { dark: 'dark1', light: 'dark2' }, overlay: false })).filter((finding) => finding.severity === 'warning'), []);
  // Finding 17 as authored: the light text reads over the dark duotone and band.
  assert.deepEqual(onImage(deck({ recolor: { dark: 'dark2', light: 'accent1' }, overlay: { color: 'dark1', opacity: 0.6, edge: 'bottom', size: 0.5 } })).filter((finding) => finding.severity === 'warning'), []);
});
