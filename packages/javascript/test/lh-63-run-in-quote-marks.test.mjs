// LH-63, LH-78 (the decorative mark): a text whose first line is short and ends where the author broke the line (or opens with a short
// "Label:") draws that line in bold over its body, and a quote on a card draws a quotation mark in the card's padding at the start edge.
// Every rule reads text lengths, block kinds and measured sizes, never a slide id, and works right to left.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUN_IN_HEADING_CHARS, QUOTE_MARK, composeSlide, markQuote, layoutQuote, runInHeading } from '../dist/composition.js';

const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const flat = (runs) => runs.map((run) => (typeof run === 'string' ? run : run.text)).join('');
const chart = { chart: { type: 'column', data: { columns: ['Quarter', 'Pilot', 'Baseline'], rows: [['Q1', 19, 16], ['Q2', 23, 18], ['Q3', 26, 20], ['Q4', 30, 22]] } } };
const quote = { quote: { text: 'The rollout took six weeks, not six months, and every store manager was using it by the second Monday.', attribution: 'Sofia Brandt', role: 'Head of procurement' } };
const arabicQuote = { quote: { text: 'تم الإطلاق في ستة أسابيع وليس ستة أشهر، وكان كل مدير متجر يستخدمه بحلول الاثنين الثاني.', attribution: 'سلمى الحداد', role: 'رئيسة المشتريات' } };

test('LH-63: the first line of a text is a bold run-in heading when it is short, unbroken by a sentence end and shorter than the body', () => {
  const text = 'Option A: focused pilot\nTwo teams, six weeks. Low setup cost and a clear baseline.';
  const runs = runInHeading(text);
  assert.deepEqual(runs, [{ text: 'Option A: focused pilot', bold: true }, '\nTwo teams, six weeks. Low setup cost and a clear baseline.']);
  assert.equal(flat(runs), text, 'every character stays');
  assert.deepEqual(runInHeading('Why now\r\n\r\nCompetitors ship every month.'), [{ text: 'Why now', bold: true }, '\r\n\r\nCompetitors ship every month.']);
  assert.equal(RUN_IN_HEADING_CHARS, 40);
  const edge = 'x'.repeat(RUN_IN_HEADING_CHARS), over = 'x'.repeat(RUN_IN_HEADING_CHARS + 1), body = 'A body that is longer than any heading line here, set under it.';
  assert.ok(runInHeading(`${edge}\n${body}`), 'exactly 40 characters');
  assert.equal(runInHeading(`${over}\n${body}`), undefined, '41 characters');
  for (const plain of [
    'Two teams, six weeks.\nA clear baseline against which to read the result of the pilot.', // a sentence, not a heading
    'Roses are red\nSky is blue', // the body is not longer than the line
    '- first entry\nSecond line of the entry follows after it here.', // a list entry
    'A single line with no break and no label at all',
    'Option A:', 'Meet at 10:30 sharp', 'See https://example.com/a for details of the plan we have',
  ]) assert.equal(runInHeading(plain), undefined, plain);
});

test('LH-63: "Label: rest" draws the label in bold, as a picture caption does, up to six words and under 40 characters', () => {
  assert.deepEqual(runInHeading('Recommendation: establish the evidence first.'), [{ text: 'Recommendation:', bold: true }, ' establish the evidence first.']);
  assert.deepEqual(runInHeading('Time: 10:30 start'), [{ text: 'Time:', bold: true }, ' 10:30 start']);
  assert.equal(runInHeading('This lead in is far too long to be a label: the rest follows'), undefined, 'seven words');
  assert.deepEqual(runInHeading('التوصية: ابدأ بتجربة مركزة'), [{ text: 'التوصية:', bold: true }, ' ابدأ بتجربة مركزة']);
});

for (const direction of ['ltr', 'rtl']) {
  const language = direction === 'rtl' ? 'ar' : 'en';
  const texts = direction === 'rtl'
    ? ['الخيار أ: تجربة مركزة\nفريقان لمدة ستة أسابيع. تكلفة إعداد منخفضة وخط أساس واضح لقراءة النتيجة.', 'الخيار ب: إطلاق واسع\nكل الفرق لمدة ثلاثة أشهر. انتشار أوسع مع حاجة أكبر إلى التنسيق.']
    : ['Option A: focused pilot\nTwo teams, six weeks. Low setup cost and a clear baseline against which to read the result.', 'Option B: broad rollout\nAll teams, three months. Wider reach with greater coordination needs and a longer path.'];
  test(`LH-63 (${direction}): two texts with a heading line draw it bold, over the same words, at the sizes they had`, () => {
    const slide = { title: direction === 'rtl' ? 'اختر أصغر تجربة' : 'Choose the smallest test', blocks: texts.map((text) => ({ text })) };
    const options = { presentation: { language, slides: [slide] }, slideIndex: 0 };
    const result = composeSlide(slide, options);
    assert.deepEqual(findings(result), []);
    const items = result.items.filter((item) => item.field === 'text');
    assert.equal(items.length, 2);
    for (const [index, item] of items.entries()) {
      assert.ok(item.runs, `${item.path} has runs`);
      assert.equal(flat(item.runs), texts[index], 'the runs hold the authored characters');
      assert.equal(item.runs[0].bold, true);
      assert.equal(item.value, texts[index], 'the document value is unchanged');
      assert.ok(item.text.richLines, "the fit is the runs' fit");
      const first = item.text.richLines[0].fragments.map((fragment) => fragment.text).join('').trim();
      assert.equal(first, texts[index].split('\n')[0], 'the heading is its own line');
      assert.ok(item.text.richLines[0].fragments.every((fragment) => fragment.style.fontWeight >= 700), 'drawn bold');
      assert.ok(item.text.richLines[1].fragments.every((fragment) => fragment.style.fontWeight < 700), 'the body is regular');
    }
    // The size guard: the same texts as plain runs of one weight draw at no larger a size.
    const plain = composeSlide({ ...slide, blocks: texts.map((text) => ({ text: [{ text }] })) }, options);
    for (const [index, item] of plain.items.filter((entry) => entry.field === 'text').entries()) assert.ok(items[index].text.fontSize >= item.text.fontSize - 1e-9, `${item.path}: ${items[index].text.fontSize} < ${item.text.fontSize}`);
  });
}

test('LH-63: runs the author formatted, a sentence first line and a long first line stay as written', () => {
  const slide = { title: 'Plain', blocks: [
    { text: [{ text: 'Option C: authored', italic: true }, '\nThe author formatted these runs, so they stay as written.'] },
    { text: 'Two teams, six weeks. Low setup cost.\nA clear baseline against which to read the result of the pilot.' },
    { text: 'This first line is longer than forty characters in all\nThe rest of this text follows after the line the author chose to break.' },
  ] };
  const result = composeSlide(slide);
  for (const item of result.items.filter((entry) => entry.field === 'text')) assert.equal(item.runs, undefined, item.path);
  assert.equal(result.items.find((item) => item.field === 'text').text.richLines?.[0].fragments[0].run.italic, true);
});

test('LH-63: no text reads smaller with its bold heading than as written (the guard)', () => {
  const body = 'It runs for the whole quarter and then it is reviewed again with the board. '.repeat(3).trim();
  const heads = ['Option A: the focused pilot', 'Option B: the broad rollout', 'Option C: the staged rollout', 'Option D: the hybrid model'];
  const slide = { title: 'Guard', blocks: heads.map((head) => ({ text: `${head}\n${body}` })) };
  const plain = composeSlide({ ...slide, blocks: slide.blocks.map((block) => ({ text: [{ text: block.text }] })) });
  const result = composeSlide(slide);
  const sizes = (composed) => composed.items.filter((item) => item.field === 'text').map((item) => item.text.fontSize);
  assert.ok(Math.min(...sizes(result)) >= Math.min(...sizes(plain)) - 1e-9, 'no text reads smaller than with no heading');
  assert.deepEqual(findings(result), findings(plain));
});

test('LH-78: a quote on a card draws a decorative mark in the card padding, over text that keeps its size, left to right and right to left', () => {
  for (const [direction, language, sample] of [['ltr', 'en', quote], ['rtl', 'ar', arabicQuote]]) {
    const slide = { title: direction === 'rtl' ? 'اتجاه المؤشر' : 'Signal trend', blocks: [chart, sample] };
    const options = { presentation: { language, slides: [slide] }, slideIndex: 0 };
    const result = composeSlide(slide, options);
    const item = result.items.find((entry) => entry.quoteLayout), layout = item.quoteLayout;
    assert.ok(item.frameBox, `${direction}: the quote is on a card`);
    assert.ok(layout.mark, `${direction}: the card has a mark`);
    const body = layout.parts.find((part) => part.role === 'body');
    assert.equal(layout.mark.style.fontWeight, 700);
    assert.equal(layout.mark.text.length, 1);
    assert.equal(layout.mark.box.x, body.box.x, 'at the start edge of the text column');
    assert.equal(layout.mark.fit.directions?.[0], direction === 'rtl' ? 'rtl' : undefined, 'the mark reads in the deck direction');
    // The ink (QUOTE_MARK.ink of its size from the line top) sits between the card's top edge and the text's top.
    const size = layout.mark.fit.fontSize, top = layout.mark.box.y + QUOTE_MARK.ink.top * size, bottom = layout.mark.box.y + QUOTE_MARK.ink.bottom * size;
    assert.ok(top >= item.frameBox.y - 0.01 && bottom <= body.box.y + 0.01, `${direction}: ${top}..${bottom} in ${item.frameBox.y}..${body.box.y}`);
    assert.ok(QUOTE_MARK.sizes.some((factor) => Math.abs(size - body.fit.fontSize * factor) < 0.01), 'a step of QUOTE_MARK.sizes of the body size');
    // Nothing moved and nothing shrank: a mark is never added twice, and the slide has no finding.
    assert.equal(markQuote(layout, item.frameBox, {}), layout);
    assert.deepEqual(findings(result), []);
  }
});

test('LH-78: no mark for a quote alone, a pull line or a card with no padding for it', () => {
  const alone = composeSlide({ title: 'Alone', blocks: [quote] });
  assert.equal(alone.items.find((item) => item.quoteLayout).quoteLayout.mark, undefined, 'a lone quote has no card');
  const table = { table: { columns: ['Vendor', 'Score'], rows: [['Apex', 86], ['Brightline', 79], ['Cobalt', 72]] } };
  const pulled = composeSlide({ title: 'Pull', blocks: [table, { quote: { text: 'We did not leave over a feature.', attribution: 'Exit interview' } }] });
  const pull = pulled.items.find((item) => item.quoteLayout?.rule);
  assert.ok(pull && !pull.quoteLayout.mark, 'a pull line keeps its rule alone');
  const layout = layoutQuote('A short quote.', { x: 0, y: 0, width: 400, height: 300 });
  assert.equal(markQuote(layout, { x: 0, y: 0, width: 400, height: 300 }), layout, 'the body starts at the card edge: no padding');
  assert.ok(markQuote(layout, { x: 0, y: -60, width: 400, height: 360 }).mark, 'padding above the text gives a mark');
  const two = composeSlide({ title: 'Two cards', blocks: [chart, quote, { quote: { text: 'Short.', attribution: 'A' } }] });
  const cards = two.items.filter((item) => item.quoteLayout && item.frameBox);
  assert.ok(cards.every((item) => !!item.quoteLayout.mark) || cards.every((item) => !item.quoteLayout.mark), 'the cards of a slide draw a mark together or not at all');
});
