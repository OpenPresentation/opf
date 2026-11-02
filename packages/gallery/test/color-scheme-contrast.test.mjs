// LH-87: every color scheme passes line 7 of the review checklist in docs/default-catalog.md ("No low-contrast tints"),
// measured as WCAG contrast ratios; and LH-88: the generated gallery examples set no deck-level contentAlignment, so a
// deck value never centres a list or paragraph body.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gallery } from '../dist/index.js';

const channel = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => { const n = Number.parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const ACCENTS = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];

for (const [id, scheme] of Object.entries(gallery.colorSchemes)) {
  test(`color scheme ${id} passes the contrast checklist`, () => {
    const at = (a, b) => contrast(scheme[a], scheme[b]);
    const label = (a, b) => `${id}: ${a} ${scheme[a]} on ${b} ${scheme[b]}`;
    assert.ok(at('dark1', 'light1') >= 7, label('dark1', 'light1'));
    assert.ok(at('dark2', 'light1') >= 4.5, label('dark2', 'light1'));
    for (const bg of ['light1', 'dark1']) assert.ok(at('accent1', bg) >= 3, label('accent1', bg));
    for (const accent of ACCENTS) for (const bg of ['light1', 'dark1']) assert.ok(at(accent, bg) >= 1.5, label(accent, bg));
    assert.ok(at('light2', 'light1') >= 1.05, label('light2', 'light1'));
  });
}

test('the generated gallery examples set no deck-level contentAlignment', () => {
  const root = fileURLToPath(new URL('../../../examples/gallery/', import.meta.url));
  let decks = 0;
  for (const folder of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    for (const file of readdirSync(root + folder.name).filter((name) => name.endsWith('.opf.json'))) {
      const deck = JSON.parse(readFileSync(`${root}${folder.name}/${file}`, 'utf8'));
      decks++;
      assert.equal(deck.design?.contentAlignment, undefined, `${folder.name}/${file} sets design.contentAlignment`);
    }
  }
  assert.ok(decks >= 100, `${decks} decks`);
});
