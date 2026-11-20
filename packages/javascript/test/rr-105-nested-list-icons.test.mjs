// RR-105 (coverage finding 05): a nested list draws the icons of its first-level entries on chips, as docs/icons.md promises; a nested
// entry draws no chip (its icon is reported icon-dropped) and keeps its bullet under its entry's text, a nested list's 1.1 em indent.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, fitList } from '../dist/composition.js';

const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const style = { fontFamily: 'sans-serif', fontWeight: 400, path: 'slides.0.items' };
const items = [
  { text: 'A', icon: 'mark' },
  { text: 'B', level: 1, icon: 'mark' },
  { text: 'C', level: 1 },
  { text: 'D', icon: 'mark' },
  { text: 'E', level: 2 },
];

test('fitList draws chips on the first-level entries of a nested list and bullets under their text on the nested ones', () => {
  const fit = fitList(items, { x: 0, y: 0, width: 1000, height: 1000 }, 32, 16, { style, icons: true });
  const [a, b, c, d, e] = fit.listEntries, size = fit.fontSize;
  assert.ok(a.icon && d.icon, 'first-level entries have chips');
  assert.ok(!b.icon && !c.icon && !e.icon, 'nested entries have none');
  // A nested entry's bullet starts where its first-level entry's text starts; its text is a hanging indent of 1.1 em further in.
  for (const entry of [b, c]) {
    assert.equal(entry.marker.text, '–');
    assert.ok(!entry.marker.none);
    assert.ok(Math.abs(entry.marker.x - a.textBox.x) < 1e-6, 'bullet under the entry text');
    assert.ok(Math.abs(entry.textBox.x - (a.textBox.x + size * 1.1)) < 1e-6, 'text a 1.1 em hanging indent in');
    assert.ok(Math.abs(entry.marker.indent - size * 1.1) < 1e-6, 'the native hanging indent is the same');
  }
  assert.ok(Math.abs(e.marker.x - (a.textBox.x + size * 1.1)) < 1e-6, 'a deeper level steps in by 1.1 em');
  assert.equal(e.marker.text, '•');
  // First-level entries keep the chip column.
  assert.ok(a.marker.none && Math.abs(a.textBox.x - d.textBox.x) < 1e-6);
  // A nested entry sits close under its entry (no chip gap); the next first-level row keeps the chips' gap.
  assert.ok(b.textBox.y - (a.textBox.y + a.textBox.height) < size * 0.6);
});

test('a flat icon list is laid out as before (one level, no nested rule applies)', () => {
  const flat = items.filter(item => !item.level);
  const fit = fitList(flat, { x: 0, y: 0, width: 1000, height: 1000 }, 32, 16, { style, icons: true });
  assert.ok(fit.listEntries.every(entry => entry.icon && entry.marker.none));
});

test('composeSlide draws the first-level icons of a nested list and reports the nested ones', () => {
  const deck = { icons: { mark: MARK }, slides: [{ title: 'Icons', items }] };
  const composed = composeSlide(deck.slides[0], { presentation: deck, slideIndex: 0 });
  assert.deepEqual(composed.icons.map(icon => icon.path), ['slides.0.items.0.icon', 'slides.0.items.3.icon']);
  const dropped = composed.diagnostics.filter(diagnostic => diagnostic.code === 'icon-dropped').map(diagnostic => diagnostic.path);
  assert.deepEqual(dropped, ['slides.0.items.1.icon']);
});
