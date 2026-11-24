// opf#1412 (A5): the blocks beside LH-80's picture track sit in the middle of their column: a stack of paragraphs and lists is centered
// as one group, as a lone block beside the picture is.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

const svg = (width, height) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ccc"/></svg>`).toString('base64')}`;
const paragraph = 'The pilot cut review time by a third, so we can widen it to two more sites this quarter.';

for (const [name, first] of [['a list and a text', { items: ['Faster reviews', 'Fewer handoffs'] }], ['two texts', { text: 'Ship the pilot in March.' }]]) {
  for (const direction of ['ltr', 'rtl']) {
    test(`${name} beside a picture track stack in the middle of their column (${direction})`, () => {
      const result = composeSlide({ title: 'Picture and stack', blocks: [{ image: svg(1000, 1000), alt: 'A square.' }, first, { text: paragraph }] }, { direction });
      assert.equal(result.track?.kind, 'picture', 'the picture takes a track');
      const body = result.items.filter((item) => /^slides\.0\.blocks\.[12]\./.test(item.path));
      assert.equal(body.length, 2);
      const top = Math.min(...body.map((item) => item.box.y)), bottom = Math.max(...body.map((item) => item.box.y + item.box.height));
      const middle = result.contentBox.y + result.contentBox.height / 2;
      assert.ok(Math.abs((top + bottom) / 2 - middle) < 2, `the stack is centered (${top}..${bottom} around ${middle})`);
      assert.ok(top > result.contentBox.y + result.contentBox.height / 6, 'not at the top of the column');
    });
  }
}
