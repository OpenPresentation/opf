// opf#1470: a layout body that grows keeps its bold run-in heading (LH-63). The team layout's "name, line break, role" cards drew their
// names bold in 0.35.1; LH-102's growth then composed every growth step without the run-in rule, so the names drew regular, larger and
// broken over two lines. A growth step never drops a rule the slide's own composition kept, and never breaks a heading that sat on one line.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '@openpresentation/opf/composition';
import { gallery } from '../dist/index.js';

const compose = (slide, extra = {}) => composeSlide(slide, { width: 1280, height: 720, layout: gallery.layouts.team, ...extra });
const person = (name, role) => ({ text: `${name}\n${role}` });
const cards = (...people) => ({ title: 'Team', blocks: people.map(([name, role]) => person(name, role)) });
const dana = ['Dana Levi', 'Operations lead, North terminal'], omar = ['Omar Haddad', 'Scheduling analyst'], lena = ['Lena Park', 'Gate staff trainer'];

const texts = (result) => result.items.filter((item) => item.field === 'text');
// The lines that carry a name (the bold first run of the item's rich lines).
const nameLines = (item) => item.text.richLines.filter((line) => line.fragments.some((fragment) => fragment.runIndex === 0 && fragment.text.trim()));

for (const [label, slide] of [
  ['three people, one long role (opf#1470)', cards(dana, omar, lena)],
  ['three people, short roles', cards(['Dana Levi', 'Operations lead'], omar, lena)],
  ['two people, short roles', cards(['Dana Levi', 'Operations lead'], omar)],
]) {
  test(`team: ${label} keeps its bold names on one line each`, () => {
    const result = compose(slide), items = texts(result);
    assert.equal(items.length, slide.blocks.length);
    for (const item of items) {
      assert.ok(item.runs?.[0]?.bold === true, `${item.path}: the name is a bold run`);
      assert.equal(nameLines(item).length, 1, `${item.path}: the name sits on one line`);
    }
    assert.equal(new Set(items.map((item) => item.text.fontSize)).size, 1, 'the cards share one size');
  });
}

test('team: the long-role slide still grows past its role size, with the names bold', () => {
  const grown = compose(cards(dana, omar, lena)), held = compose(cards(dana, omar, lena), { fill: false });
  assert.ok(texts(grown)[0].text.fontSize > texts(held)[0].text.fontSize, 'the body grew');
  assert.ok(texts(grown).every((item) => item.runs?.[0]?.bold === true));
});
