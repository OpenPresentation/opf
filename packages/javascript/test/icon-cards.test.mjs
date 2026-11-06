// LH-165 and LH-162: icon cards and text tiles, left to right and right to left.
// - A lone list of 2 to 8 entries that each carry an icon and a short label draws as equal cards (LH-137's tiles: `steps` form `tiles`),
//   the chip at the start edge, the label bold, never smaller than the same slide without icons.
// - A numbered list and an agenda's list keep their numbers as numerals on the cards; a long label keeps the list.
// - A set of groups with icons draws as cards too, the label bold instead of an eyebrow.
// - 4 to 8 short paragraphs at the root draw as tiles with an accent dot, in reading order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { cardGridColumns, composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const SET = { name: 'Brand', license: 'MIT', copyright: 'Copyright (c) 2026 Example', viewBox: [0, 0, 24, 24], style: 'stroke', strokeWidth: 2, icons: { star: 'M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z', dot: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z' } };
const deckOf = (slide, language) => ({ name: 'Icon cards', language, catalogs: { custom: { iconSets: { brand: SET } } }, slides: [slide] });
const compose = (slide, language) => { const context = resolveSlideContext(deckOf(slide, language), 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };
const iconless = (value) => Array.isArray(value) ? value.map(iconless) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'icon').map(([key, entry]) => [key, iconless(entry)])) : value;
const tiles = (result) => result.steps?.find((step) => step.form === 'tiles');
const inside = (box, outer) => box.x >= outer.x - 0.5 && box.y >= outer.y - 0.5 && box.x + box.width <= outer.x + outer.width + 0.5 && box.y + box.height <= outer.y + outer.height + 0.5;
const body = (result) => result.items.filter((item) => !['title', 'subtitle', 'tag'].includes(item.field));

const TEXT = {
  en: {
    title: 'Inside the starter kit', agenda: 'What we will cover', lessons: 'Six lessons from the pilot',
    entries: [['Welcome guide', 'A 12-page walkthrough of the first week.'], ['Template library', '40 ready-made reports and dashboards.'], ['Sample data', 'A demo workspace to try changes safely.'], ['Office hours', 'A weekly call with a product specialist.']],
    topics: ['Customer feedback themes', 'Support performance', 'Product reliability', 'Priorities for next quarter'],
    long: 'A label that runs on far too long to be the short title of one card in a grid of equal cards',
    texts: ['Tickets close a day sooner.', 'Fewer handoffs between teams.', 'Customers rate replies higher.', 'Agents spend less time searching.'],
    steps: [['Join', 'Sign up in five minutes.'], ['Learn', 'Six short lessons a week.'], ['Build', 'Ship one small project.'], ['Certify', 'Pass a one-hour review.']],
  },
  ar: {
    title: 'محتويات حزمة البداية', agenda: 'ما سنتناوله', lessons: 'ستة دروس من التجربة',
    entries: [['دليل الترحيب', 'جولة من اثنتي عشرة صفحة في الأسبوع الأول.'], ['مكتبة القوالب', 'أربعون تقريرًا ولوحة جاهزة.'], ['بيانات تجريبية', 'مساحة عمل لتجربة التغييرات بأمان.'], ['ساعات مكتبية', 'مكالمة أسبوعية مع مختص.']],
    topics: ['ملاحظات العملاء', 'أداء الدعم', 'موثوقية المنتج', 'أولويات الربع القادم'],
    long: 'عنوان طويل جدًا لا يصلح أن يكون العنوان القصير لبطاقة واحدة في شبكة من البطاقات المتساوية في الحجم',
    texts: ['تُغلق التذاكر قبل يوم.', 'تسليم أقل بين الفرق.', 'يقيّم العملاء الردود أعلى.', 'وقت أقل في البحث.'],
    steps: [['انضم', 'سجّل في خمس دقائق.'], ['تعلّم', 'ستة دروس قصيرة أسبوعيًا.'], ['ابنِ', 'أنجز مشروعًا صغيرًا.'], ['احصل', 'اجتز مراجعة مدتها ساعة.']],
  },
};

test('cardGridColumns: two to four cards a row, balanced', () => {
  assert.deepEqual(cardGridColumns(2), [2]);
  assert.deepEqual(cardGridColumns(3), [3]);
  assert.deepEqual(cardGridColumns(4), [2, 4]);
  assert.deepEqual(cardGridColumns(5), [3]);
  assert.deepEqual(cardGridColumns(6), [2, 3]);
  assert.deepEqual(cardGridColumns(7), [4]);
  assert.deepEqual(cardGridColumns(8), [2, 3, 4]);
});

for (const [language, text] of Object.entries(TEXT)) {
  const rtl = language === 'ar', direction = rtl ? 'rtl' : 'ltr';

  test(`LH-165 (${direction}): a lone list with icons draws as equal cards, the chip at the start edge, never smaller than without icons`, () => {
    const slide = { title: text.title, blocks: [{ items: text.entries.map(([label, description], index) => ({ text: label, description, icon: index % 2 ? 'brand:dot' : 'brand:star' })) }] };
    const result = compose(slide, language), plain = compose(iconless(slide), language), cards = tiles(result), list = body(result)[0];
    assert.ok(cards, 'the list draws as cards');
    assert.equal(cards.chips.length, 4);
    assert.equal(result.icons.length, 4);
    assert.equal(list.listColumns.length, 4);
    assert.ok(list.text.fontSize >= body(plain)[0].text.fontSize - 0.01, 'the cards never set the list smaller than the list without icons');
    const sizes = new Set(cards.chips.map((chip) => `${Math.round(chip.box.width)}x${Math.round(chip.box.height)}`));
    assert.equal(sizes.size, 1, 'equal cards');
    list.listColumns.forEach((column, index) => {
      const entry = column.text.listEntries[0], card = cards.chips[index].box, icon = result.icons[index];
      assert.equal(entry.index, index, 'the cards keep the order');
      assert.equal(entry.text.richLines[0].fragments[0].style.fontWeight, 700, 'the label is bold');
      assert.ok(inside(entry.textBox, card) && inside(entry.descriptionBox, card), 'the text stays on its card');
      const chip = icon.chip;
      assert.ok(inside({ x: chip.cx - chip.radius, y: chip.cy - chip.radius, width: 2 * chip.radius, height: 2 * chip.radius }, card), 'the chip stays on its card');
      if (rtl) assert.ok(chip.cx > card.x + card.width / 2, 'right to left: the chip at the right'); else assert.ok(chip.cx < card.x + card.width / 2, 'the chip at the left');
    });
    // Reading order runs along each row from the start edge.
    const [first, second] = cards.chips.map((chip) => chip.box);
    if (rtl) assert.ok(first.x > second.x); else assert.ok(first.x < second.x);
  });

  test(`LH-165 (${direction}): a numbered list and an agenda keep their numbers on the cards; a long label keeps the list`, () => {
    const numbered = compose({ title: text.agenda, blocks: [{ numbering: 'arabic', items: text.topics.map((topic) => ({ text: topic, icon: 'brand:star' })) }] }, language);
    const badges = tiles(numbered).badges;
    assert.deepEqual(badges.map((badge) => badge.label), ['01', '02', '03', '04']);
    assert.ok(badges.every((badge, index) => badge.numeral && badge.list?.index === index), 'numerals that give a PPTX import the list numbers back');
    const agenda = compose({ layout: 'agenda-split', title: text.agenda, blocks: [{ region: 'items', items: text.topics.map((topic) => ({ text: topic, icon: 'brand:dot' })) }] }, language);
    const agendaCards = tiles(agenda);
    assert.ok(agendaCards, 'an agenda with icons draws as cards');
    assert.deepEqual(agendaCards.badges.map((badge) => badge.label), ['01', '02', '03', '04'], 'numbered as its badges would number it');
    assert.ok(agendaCards.badges.every((badge) => badge.list === undefined), 'drawing only: the agenda keeps no numbering');
    const long = compose({ title: text.title, blocks: [{ items: [{ text: text.long, icon: 'brand:star' }, ...text.entries.slice(1).map(([label]) => ({ text: label, icon: 'brand:dot' }))] }] }, language);
    assert.equal(tiles(long), undefined, 'a long label keeps the list');
  });

  test(`LH-165 (${direction}): a set of groups with icons draws as cards, the label bold and no eyebrow`, () => {
    const slide = { title: text.title, blocks: text.steps.map(([label, description], index) => ({ icon: index % 2 ? 'brand:dot' : 'brand:star', blocks: [{ text: label }, { text: description }] })) };
    const result = compose(slide, language), plain = compose(iconless(slide), language), cards = tiles(result);
    assert.ok(cards, 'the groups draw as cards');
    assert.equal(result.icons.length, 4);
    assert.ok(result.items.every((item) => !item.eyebrow), 'the labels are no eyebrows');
    const labels = result.items.filter((item) => /\.blocks\.0\.text$/u.test(item.path.replace(/^slides\.\d+\.blocks\.\d+/u, '')));
    assert.equal(labels.length, 4);
    assert.ok(labels.every((item) => item.textStyle.fontWeight === 700), 'bold labels');
    const descriptions = result.items.filter((item) => item.path.endsWith('.blocks.1.text'));
    const before = new Map(plain.items.map((item) => [item.path, item.text?.fontSize]));
    assert.ok(descriptions.every((item) => item.text.fontSize >= before.get(item.path) - 0.01), 'no description smaller');
    descriptions.forEach((item, index) => { assert.ok(inside(item.box, cards.chips[index].box), 'each description on its card'); });
  });

  test(`LH-162 (${direction}): short paragraphs at the root draw as tiles with an accent dot at the start`, () => {
    const result = compose({ title: text.lessons, blocks: text.texts.map((entry) => ({ text: entry })) }, language), cards = tiles(result);
    assert.ok(cards, 'the paragraphs draw as tiles');
    assert.equal(cards.chips.length, 4);
    assert.equal(cards.badges.length, 4);
    const texts = body(result);
    assert.equal(new Set(texts.map((item) => item.text.fontSize)).size, 1, 'one size');
    texts.forEach((item, index) => {
      const tile = cards.chips[index].box, dot = cards.badges[index];
      assert.ok(inside(item.box, tile), 'each text on its tile');
      assert.equal(dot.label, '');
      if (rtl) assert.ok(dot.cx > item.box.x + item.box.width, 'right to left: the dot at the right'); else assert.ok(dot.cx < item.box.x, 'the dot before the text');
    });
    const layout = compose({ layout: 'list', title: text.lessons, blocks: text.texts.map((entry) => ({ region: 'body', text: entry })) }, language);
    assert.equal(tiles(layout), undefined, 'only the root grid of an automatic slide');
  });
}
