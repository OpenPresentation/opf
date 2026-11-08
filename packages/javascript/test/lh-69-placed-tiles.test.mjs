// LH-69: a placed region's lone short text draws as a tile, left to right and right to left.
// - A promoted region (a slide key such as `top:left`) whose one block is a plain text of at most 4 words that is no sentence draws as a
//   card filling the region, the text bold at its foot, at one size for every tile of the slide, larger than the heading it was.
// - The blocks beside the tiles keep every size they have without them (not even LH-149's half step is given up).
// - A sentence ("Teams want fewer exports.") and a longer text keep LH-69's bold heading and draw no tile.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, PLACED_TILE_LINES } from '../dist/composition.js';

const WORDS = {
  en: { title: 'Team Responsibilities', teams: ['Product', 'Engineering', 'Operations'], bullets: ['Weekly planning review', 'Shared risk register', 'Single launch checklist'], focus: 'Reduce long-tail retries', steps: ['Profile slow tool calls', 'Cache stable lookups', 'Batch low-risk writes'], sentence: 'Teams want fewer exports.', detail: 'They want review status, owners, and exceptions in one operating view.', long: 'Product owns the roadmap and the launch calendar' },
  ar: { title: 'مسؤوليات الفرق', teams: ['المنتج', 'الهندسة', 'العمليات'], bullets: ['مراجعة التخطيط الأسبوعية', 'سجل مشترك للمخاطر', 'قائمة إطلاق واحدة'], focus: 'تقليل إعادة المحاولات', steps: ['قياس الاستدعاءات البطيئة', 'تخزين النتائج الثابتة', 'تجميع الكتابات الآمنة'], sentence: 'الفرق تريد تصديرًا أقل.', detail: 'يريدون حالة المراجعة والمسؤولين والاستثناءات في عرض تشغيلي واحد.', long: 'فريق المنتج يملك خطة الطريق وجدول الإطلاق كله' },
};
const tiles = (result) => result.steps?.find((step) => step.form === 'tiles');
const field = (result, name) => result.items.find((entry) => entry.field === name);
const texts = (result) => result.items.filter((entry) => entry.field === 'text');
const inside = (box, outer) => box.x >= outer.x - 0.5 && box.y >= outer.y - 0.5 && box.x + box.width <= outer.x + outer.width + 0.5 && box.y + box.height <= outer.y + outer.height + 0.5;

for (const [language, text] of Object.entries(WORDS)) {
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const teams = (labels) => ({ title: text.title, 'top+middle:left': { text: labels[0] }, 'top+middle:center': { text: labels[1] }, 'top+middle:right': { text: labels[2] }, 'bottom:left+center+right': { bullets: text.bullets } });

  test(`LH-69 (${direction}): placed short texts draw as tiles at one size, the bullets beside them at their own size`, () => {
    const result = composeSlide(teams(text.teams), { direction });
    const grid = tiles(result);
    assert.ok(grid, 'the placed texts draw as tiles');
    const heads = texts(result);
    assert.equal(grid.chips.length, 3, 'one tile a text');
    assert.deepEqual(grid.chips.map((chip) => chip.path), heads.map((entry) => entry.path));
    const size = heads[0].text.fontSize;
    for (const [index, head] of heads.entries()) {
      const card = grid.chips[index].box;
      assert.ok(inside(head.box, card), `${head.path} sits on its tile`);
      assert.ok(card.y + card.height - (head.box.y + head.box.height) < 0.25 * card.height, `${head.path} sits at its tile's foot`);
      assert.equal(head.text.fontSize, size, 'the tiles share one size');
      assert.ok(head.text.lines.length <= PLACED_TILE_LINES);
      assert.equal(head.textStyle.fontWeight, 700, 'the tile text is bold');
    }
    // The same slide with sentences instead of labels draws headings and no tiles: the bullets keep their size and the tiles are larger.
    const plain = composeSlide(teams(text.teams.map((label) => `${label}.`)), { direction });
    assert.equal(tiles(plain), undefined, 'sentences keep their headings');
    assert.ok(size > texts(plain)[0].text.fontSize, 'a tile sets its text larger than the heading');
    assert.ok(field(result, 'bullets').text.fontSize >= field(plain, 'bullets').text.fontSize - 1e-6, 'the bullets beside the tiles are never smaller');
  });

  test(`LH-69 (${direction}): one placed short text over a list is one tile across its region`, () => {
    const result = composeSlide({ title: text.title, top: { text: text.focus }, 'middle+bottom': { items: text.steps } }, { direction });
    const grid = tiles(result);
    assert.ok(grid, 'the lone short text draws as a tile');
    assert.equal(grid.chips.length, 1);
    const head = texts(result)[0], list = field(result, 'items');
    assert.ok(inside(head.box, grid.chips[0].box));
    assert.ok(grid.chips[0].box.y + grid.chips[0].box.height <= list.box.y + 0.5, 'the tile stays in its region, above the list');
    const plain = composeSlide({ title: text.title, top: { text: `${text.focus}.` }, 'middle+bottom': { items: text.steps } }, { direction });
    assert.ok(list.text.fontSize >= field(plain, 'items').text.fontSize - 1e-6, 'the list is never smaller');
    assert.ok(list.text.fontSize > head.text.fontSize, 'the sibling list grows past the fixed tile-label size');
  });

  test(`LH-69 (${direction}): a sentence or a longer text keeps its heading`, () => {
    const sentence = composeSlide({ title: text.title, left: { text: text.sentence }, 'center+right': { text: text.detail } }, { direction });
    assert.equal(tiles(sentence), undefined, 'a short sentence is a statement, not a label');
    const long = composeSlide(teams([text.long, ...text.teams.slice(1)]), { direction });
    const grid = tiles(long);
    assert.ok(!grid?.chips.some((chip) => chip.path.endsWith('top+middle:left.text')), 'a text of more than four words draws no tile');
  });
}
