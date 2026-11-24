// opf#1412 (A4): on a slide with no layout, LH-114's stack of the data and its pull line sits in the middle of the body, not at its top
// over an empty foot; every block keeps the size it had at the top, and nothing reaches past the body.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const table = { table: { columns: ['Region', 'Revenue'], rows: [['North', '$4.2M'], ['South', '$3.1M']] } };
const quote = { quote: { text: 'The new workflow cut our review time in half.', attribution: 'Priya Raman' } };
const paragraph = 'The pilot cut review time by a third, so we can widen it to two more sites this quarter.';
const bodyOf = (result) => result.items.filter((item) => item.path.startsWith('slides.0.blocks.'));

for (const [name, blocks] of [['a table and a pull line', [table, quote]], ['a text, a list and a pull line', [{ text: paragraph }, { items: ['Faster reviews', 'Fewer handoffs'] }, quote]]]) {
  test(`${name} stack in the middle of the body`, () => {
    const result = composeSlide({ title: 'Pull line', blocks });
    const pull = result.items.find((item) => item.quoteLayout?.rule);
    assert.ok(pull, 'the quote is a pull line');
    const body = bodyOf(result).filter((item) => item !== pull);
    const titleBottom = Math.max(...result.items.filter((item) => item.field === 'title').map((item) => item.box.y + item.box.height));
    const top = Math.min(...body.map((item) => item.box.y)), bottom = pull.box.y + pull.box.height;
    const foot = result.height - 0.08 * result.height;
    assert.ok(top - titleBottom > result.height / 20, `the stack moved down from under the title (${top})`);
    assert.ok(bottom < foot, 'and does not reach the foot');
    for (const item of bodyOf(result)) assert.ok(item.box.y + item.box.height <= foot + 1, `${item.path} stays in the body`);
  });
}

test('the stack keeps the sizes it had at the top', () => {
  const blocks = [{ text: paragraph }, { items: ['Faster reviews', 'Fewer handoffs'] }, quote];
  const result = composeSlide({ title: 'Pull line', blocks });
  const sizes = bodyOf(result).map((item) => item.text?.fontSize ?? 0);
  assert.ok(sizes.every((size) => size >= 28 - 1e-6), `no block is set small (${sizes})`);
});

test('a sparse stack draws its pull line as a quote: larger than the lead size, on at most two lines, the stack in the body', () => {
  for (const blocks of [[table, quote], [{ text: paragraph }, { items: ['Faster reviews', 'Fewer handoffs'] }, quote]]) {
    const result = composeSlide({ title: 'Pull line', blocks });
    const pull = result.items.find((item) => item.quoteLayout?.rule);
    const body = pull.quoteLayout.parts.find((part) => part.role === 'body');
    assert.ok(body.fit.fontSize > 32 + 1e-6, `the quote grows past the lead size (${body.fit.fontSize})`);
    assert.ok(body.fit.lines.length <= 2);
    assert.ok(pull.box.y + pull.box.height <= result.height - 0.08 * result.height, 'clear of the foot');
  }
});

test('a pull line beside data that fills the body keeps the lead size', () => {
  const rows = Array.from({ length: 6 }, (_, index) => [`Region ${index + 1}`, `$${index + 1}.0M`]);
  const result = composeSlide({ title: 'Pull line', blocks: [{ table: { columns: ['Region', 'Revenue'], rows } }, quote] });
  const pull = result.items.find((item) => item.quoteLayout?.rule);
  assert.ok(pull, 'the quote is a pull line');
  assert.ok(pull.quoteLayout.parts.find((part) => part.role === 'body').fit.fontSize <= 32 + 1e-6);
});
