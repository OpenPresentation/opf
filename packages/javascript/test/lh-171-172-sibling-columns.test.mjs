// LH-171: sibling columns share one list form: a list whose labels are a short phrase ("Live in 8 weeks") is drawn as ruled rows when
// a sibling list of the slide is, so the two columns of a comparison read alike (narrative n19).
// LH-172: sibling groups of a heading text over one body block share their row tracks: the headings start on one line and take the
// tallest heading's height, and the bodies start on one line under them and end on one line.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, isLabelText, rowLabel } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';

const column = (region, heading, items) => ({ region, composition: { mode: 'column' }, blocks: [{ text: [{ text: heading, bold: true }] }, { items }] });
const buildOrBuy = {
  title: 'Should we build or buy the analytics layer?',
  blocks: [
    column('first', 'Why buy', [
      { text: 'Live in 8 weeks', description: 'Against an estimated 9 months to build' },
      { text: 'Predictable cost', description: '$180K a year, including support' },
      { text: 'Proven at our scale', description: 'Three reference customers with more data than ours' },
    ]),
    column('second', 'Why build', [
      { text: 'Full control', description: 'Our roadmap, our data model' },
      { text: 'No per-seat fees', description: 'Cost stays flat as we add users' },
      { text: 'Deeper integration', description: 'Metrics inside the product, not beside it' },
    ]),
  ],
};
const short = { title: 'Build or buy', blocks: [column('first', 'Why buy', [{ text: 'Live in 8 weeks', description: 'Faster start' }, { text: 'Predictable cost', description: 'Flat fee' }, { text: 'Proven at scale', description: 'Reference customers' }]), column('second', 'Why build', [{ text: 'Full control', description: 'Our roadmap' }, { text: 'No seat fees', description: 'Flat cost' }, { text: 'Deeper integration', description: 'In the product' }])] };
const lists = (result) => result.items.filter((item) => item.field === 'items');
const heads = (result) => result.items.filter((item) => /\.blocks\.0\.text$/.test(item.path));
const outer = (item) => item.frameBox ?? item.box;

test('LH-171: a short phrase is a row label, a sentence or a long phrase is not', () => {
  assert.equal(isLabelText('Live in 8 weeks'), false);
  assert.equal(rowLabel('Live in 8 weeks'), true);
  assert.equal(rowLabel('Proven at our scale'), true);
  assert.equal(rowLabel('We ship the product to every customer in eight weeks'), false);
  assert.equal(rowLabel('Live in 8 weeks.'), false);
});

for (const direction of ['ltr', 'rtl']) {
  test(`LH-171 (${direction}): both columns of a comparison draw their lists as ruled rows (main ruled only the second)`, () => {
    const result = composeSlide(short, { layout: layouts['two-column'], direction });
    const [first, second] = lists(result);
    assert.ok(first.text.rules?.length, 'the first column is ruled');
    assert.ok(second.text.rules?.length, 'the second column is ruled');
    assert.deepEqual(result.diagnostics.filter((entry) => ['text-overflow', 'small-cell'].includes(entry.code)), []);
  });

  test(`LH-172 (${direction}): the headings and bodies of sibling columns start on one line and end on one line`, () => {
    const result = composeSlide(buildOrBuy, { layout: layouts['two-column'], direction });
    const [a, b] = heads(result), [x, y] = lists(result);
    assert.ok(Math.abs(outer(a).y - outer(b).y) <= .5, `headings at ${outer(a).y} and ${outer(b).y}`);
    assert.ok(Math.abs(outer(a).height - outer(b).height) <= .5);
    assert.ok(Math.abs(outer(x).y - outer(y).y) <= .5, `bodies at ${outer(x).y} and ${outer(y).y}`);
    assert.ok(Math.abs(outer(x).y + outer(x).height - outer(y).y - outer(y).height) <= .5);
    for (const list of [x, y]) assert.ok(list.box.y + list.text.height <= outer(list).y + outer(list).height + .01, 'the text stays in its card');
  });
}

test('LH-171: where the guard refuses rows, both columns keep the stacked list together', () => {
  const result = composeSlide(buildOrBuy, { layout: layouts['two-column'] });
  const forms = lists(result).map((item) => Boolean(item.text.rules?.length));
  assert.equal(new Set(forms).size, 1, `forms ${forms}`);
});

test('LH-171: a lone list of short phrases keeps the stacked list (no sibling is ruled)', () => {
  const result = composeSlide({ title: 'Why buy', blocks: [{ items: buildOrBuy.blocks[0].blocks[1].items }] }, {});
  assert.equal(lists(result)[0].text.rules, undefined);
});
