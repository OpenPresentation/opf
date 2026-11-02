// LH-01: the default section draws on the accent, statement and quote on the deck's secondary surface (light2 on a light deck, dark2 on a
// dark one) and closing on the brand dark (dark2, or dark1 on a deck already on dark2), in every default theme and colour scheme, light or
// dark, left to right or right to left, with text and secondary text that pass 4.5:1 on that background. A slide's own variant still wins.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorContrast } from '@openpresentation/opf/composition';
import { resolveSlideContext } from '@openpresentation/opf';
import { gallery } from '../dist/index.js';

const VARIANTS = { section: 'accent1', statement: 'surface', quote: 'surface', closing: 'brand' };
const context = (design, layout, slide = {}, extra = {}) =>
  resolveSlideContext({ name: 'Variants', language: 'en-US', ...extra, design, slides: [{ ...(layout ? { layout } : {}), title: 'A title', subtitle: 'A subtitle', ...slide }] }, 0, { catalogs: [gallery] });
// The slot each layout should draw on for a deck whose own background slot is `deck` (dark when its text is light).
const expected = (value, deck, dark) =>
  value === 'surface' ? (dark ? (deck === 'dark2' ? 'dark1' : 'dark2') : deck === 'light2' ? 'light1' : 'light2')
  : value === 'brand' ? (deck === 'dark2' ? 'dark1' : 'dark2')
  : value;

test('the default records name their variant', () => {
  for (const [id, variant] of Object.entries(VARIANTS)) assert.equal(gallery.layouts[id].design.variant, variant, id);
});

test('every theme, scheme and deck variant draws them on their tone-relative variant with readable text', () => {
  const schemes = Object.keys(gallery.colorSchemes), themes = Object.keys(gallery.themes);
  let checked = 0;
  for (const theme of themes)
    for (const colorScheme of schemes)
      for (const deckVariant of [undefined, 'dark1']) {
        const design = { theme, colorScheme, ...(deckVariant ? { variant: deckVariant } : {}) };
        const deck = context(design).resolved.roles;
        for (const [layout, value] of Object.entries(VARIANTS)) {
          const { roles } = context(design, layout).resolved;
          const label = `${theme}/${colorScheme}/${deckVariant ?? 'theme'}/${layout}`;
          const slot = expected(value, deck.map.bg1, deck.dark);
          assert.equal(roles.variant.background, slot, label);
          assert.equal(roles.background, gallery.colorSchemes[colorScheme][slot], label);
          assert.ok(colorContrast(roles.text, roles.background) >= 4.5, `${label} text ${roles.text} on ${roles.background}`);
          assert.ok(colorContrast(roles.textSecondary, roles.background) >= 4.5, `${label} secondary ${roles.textSecondary} on ${roles.background}`);
          if (value !== 'accent1') assert.notEqual(slot, deck.map.bg1, `${label}: stands off the deck background`);
          if (value === 'surface') assert.equal(roles.dark, deck.dark, `${label}: keeps the deck tone`);
          if (value === 'brand') assert.equal(roles.map.tx1, 'light1', `${label}: light text on the brand dark`);
          checked++;
        }
      }
  assert.equal(checked, themes.length * schemes.length * 2 * 4);
});

test('a right-to-left deck draws the same variants', () => {
  for (const [layout, value] of Object.entries(VARIANTS))
    assert.equal(context({ theme: 'classic' }, layout, {}, { language: 'ar' }).resolved.roles.variant.background, expected(value, 'light1', false), layout);
});

test("a slide's own variant or background wins over its layout", () => {
  assert.equal(context({ theme: 'classic' }, 'section', { design: { variant: 'dark2' } }).resolved.roles.variant.background, 'dark2');
  assert.equal(context({ theme: 'classic' }, 'closing', { design: { background: 'light1' } }).resolved.roles.variant.background, 'light1');
});
