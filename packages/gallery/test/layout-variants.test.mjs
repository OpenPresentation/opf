// LH-01: the default section draws on the accent, statement and quote on light2 and closing on dark1, in every default theme and colour
// scheme, light or dark, left to right or right to left, with text and secondary text that pass 4.5:1 on that background. A slide's own
// variant still wins.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorContrast } from '@openpresentation/opf/composition';
import { resolveSlideContext } from '@openpresentation/opf';
import { gallery } from '../dist/index.js';

const VARIANTS = { section: 'accent1', statement: 'light2', quote: 'light2', closing: 'dark1' };
const context = (design, layout, slide = {}, extra = {}) =>
  resolveSlideContext({ name: 'Variants', language: 'en-US', ...extra, design, slides: [{ layout, title: 'A title', subtitle: 'A subtitle', ...slide }] }, 0, { catalogs: [gallery] });

test('the default records name their variant', () => {
  for (const [id, variant] of Object.entries(VARIANTS)) assert.equal(gallery.layouts[id].design.variant, variant, id);
});

test('every theme, scheme and deck variant draws them on their variant with readable text', () => {
  const schemes = Object.keys(gallery.colorSchemes), themes = Object.keys(gallery.themes);
  let checked = 0;
  for (const theme of themes)
    for (const colorScheme of schemes)
      for (const deckVariant of [undefined, 'dark1'])
        for (const [layout, variant] of Object.entries(VARIANTS)) {
          const { roles } = context({ theme, colorScheme, ...(deckVariant ? { variant: deckVariant } : {}) }, layout).resolved;
          const label = `${theme}/${colorScheme}/${deckVariant ?? 'theme'}/${layout}`;
          assert.equal(roles.variant.background, variant, label);
          assert.equal(roles.background, gallery.colorSchemes[colorScheme][variant], label);
          assert.ok(colorContrast(roles.text, roles.background) >= 4.5, `${label} text ${roles.text} on ${roles.background}`);
          assert.ok(colorContrast(roles.textSecondary, roles.background) >= 4.5, `${label} secondary ${roles.textSecondary} on ${roles.background}`);
          checked++;
        }
  assert.equal(checked, themes.length * schemes.length * 2 * 4);
});

test('a right-to-left deck draws the same variants', () => {
  for (const [layout, variant] of Object.entries(VARIANTS))
    assert.equal(context({ theme: 'classic' }, layout, {}, { language: 'ar' }).resolved.roles.variant.background, variant, layout);
});

test("a slide's own variant or background wins over its layout", () => {
  assert.equal(context({ theme: 'classic' }, 'section', { design: { variant: 'dark2' } }).resolved.roles.variant.background, 'dark2');
  assert.equal(context({ theme: 'classic' }, 'closing', { design: { background: 'light1' } }).resolved.roles.variant.background, 'light1');
});
