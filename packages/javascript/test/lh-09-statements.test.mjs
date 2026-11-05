// LH-09 and LH-69: statements and short bodies at display size, left to right and right to left.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, HEADING_DISPLAY_SIZES, LONE_DISPLAY_SIZES, MESSAGE_DISPLAY_LINES, MESSAGE_DISPLAY_SIZE, messageWords } from '../dist/composition.js';

const { layouts } = gallery;
const light = { text: '#000000', textSecondary: '#444444', primary: '#1F4E99', background: '#FFFFFF' };
const dark = { text: '#FFFFFF', textSecondary: '#F0F0F0', primary: '#2874A6', background: '#000000' };
const item = (result, field) => result.items.find((entry) => entry.field === field);
const lines = (fit) => ('richLines' in fit ? fit.richLines.length : fit.lines.length);
const words = {
  en: {
    statement: 'Reliability is the feature customers pay for',
    support: 'Every roadmap decision in 2027 starts with one question: does it make the service more dependable?',
    label: 'Our position',
    message: 'Teams that owned their release calendar shipped twice as often as teams on the shared train.',
    long: 'We will consolidate the three regional platforms into one service by the end of next year, keep every customer contract whole, publish our progress each quarter and retire the old portal.',
    three: 'Ship in March',
    emphasis: ['Customers do not buy software. ', { text: 'They buy fewer bad Mondays.', bold: true }],
    name: 'Sam Lee',
  },
  ar: {
    statement: 'الموثوقية هي الميزة التي يدفع العملاء ثمنها',
    support: 'كل قرار في خطة العام القادم يبدأ بسؤال واحد: هل يجعل الخدمة أكثر اعتمادية؟',
    label: 'موقفنا',
    message: 'الفرق التي امتلكت جدول إصداراتها أطلقت ضعف عدد التحديثات.',
    long: 'سندمج المنصات الإقليمية الثلاث في خدمة واحدة بحلول نهاية العام القادم ونحافظ على كل عقد مع العملاء وننشر تقدمنا كل ربع سنة ونوقف البوابة القديمة ونبلغ كل فريق بما تغير وما بقي على حاله.',
    three: 'الإطلاق في مارس',
    emphasis: ['العملاء لا يشترون البرمجيات. ', { text: 'إنهم يشترون أياما أقل سوءا.', bold: true }],
    name: 'سام لي',
  },
};

test('LH-09: a message is measured in words in any language', () => {
  assert.equal(messageWords('Ship in March'), 3);
  assert.equal(messageWords(['Customers do not buy software. ', { text: 'They buy fewer bad Mondays.', bold: true }]), 10);
  // A script written without spaces counts about two characters a word.
  assert.equal(messageWords('我们在三月发布'), 4);
  assert.equal(messageWords(''), 0);
});

for (const [direction, text] of [['ltr', words.en], ['rtl', words.ar]]) {
  const start = direction === 'rtl' ? 'right' : 'left';

  test(`LH-09 (${direction}): a statement whose title is the message draws it at display size under the accent rule, its paragraph below`, () => {
    const result = composeSlide({ title: text.statement, blocks: [{ region: 'message', text: text.support }] }, { layout: layouts.statement, direction });
    const title = item(result, 'title'), body = item(result, 'text');
    assert.ok(title.text.fontSize > 54 && title.text.fontSize <= HEADING_DISPLAY_SIZES.title, `the title grows to display size (${title.text.fontSize})`);
    assert.equal(title.alignment, 'left', 'start-aligned (the record)');
    assert.ok(result.titleRule, 'the accent rule stands above the title');
    assert.ok(result.titleRule.box.y + result.titleRule.box.height <= title.box.y + 1e-6, 'above it');
    const ruleEnd = start === 'left' ? result.titleRule.box.x : result.titleRule.box.x + result.titleRule.box.width;
    const titleEnd = start === 'left' ? title.box.x : title.box.x + title.box.width;
    assert.ok(Math.abs(ruleEnd - titleEnd) < 1, 'at the start edge');
    assert.ok(body.text.fontSize >= 37 - 1e-6, `the paragraph keeps the size the stack gives it (${body.text.fontSize})`);
    assert.ok(body.box.y > title.box.y + title.box.height - 1e-6, 'the paragraph is below the title');
    assert.equal(body.textStyle.fontWeight, 400, 'the paragraph is no display message');
    assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'text-overflow'), []);
  });

  test(`LH-09 (${direction}): a statement whose block is the message keeps the title as its running head and grows the block`, () => {
    const metric = composeSlide({ title: text.statement, blocks: [{ region: 'message', metric: { value: '14', label: text.three } }] }, { layout: layouts.statement, direction });
    const head = item(metric, 'title'), value = item(metric, 'metric').metricLayout.parts.find((part) => part.role === 'value');
    assert.ok(head.box.y < 100, 'the title is at the top of the slide');
    // A content slide's title (LH-51): its role size, or a step down where that keeps it on one line.
    assert.ok(head.text.fontSize <= 54 && head.text.fontSize >= 40, `a content slide's title (${head.text.fontSize})`);
    assert.ok(value.fit.fontSize >= 150, `the lone metric grows to display size (${value.fit.fontSize})`);
    assert.equal(metric.titleRule, undefined, 'a running head has no rule');
    const labeled = composeSlide({ title: text.label, blocks: [{ region: 'message', text: text.message }] }, { layout: layouts.statement, direction });
    const body = item(labeled, 'text');
    assert.ok(item(labeled, 'title').box.y < 100, 'a label title is the running head');
    assert.equal(body.textStyle.fontWeight, 400, "a message stays in the body face, so its author's bold words still stand out");
    assert.ok(body.text.fontSize > LONE_DISPLAY_SIZES.text && body.text.fontSize <= MESSAGE_DISPLAY_SIZE, `at display size (${body.text.fontSize})`);
    assert.ok(lines(body.text) <= MESSAGE_DISPLAY_LINES);
  });

  test(`LH-09 (${direction}): a short lone body under a normal title grows to display size; a long one keeps LH-48's size`, () => {
    const short = item(composeSlide({ title: text.label, text: text.message }, { direction }), 'text');
    assert.equal(short.textStyle.fontWeight, 400);
    assert.ok(short.text.fontSize > LONE_DISPLAY_SIZES.text, `grown past the lone text's display (${short.text.fontSize})`);
    assert.ok(lines(short.text) <= MESSAGE_DISPLAY_LINES);
    const long = item(composeSlide({ title: text.label, text: text.long }, { direction }), 'text');
    assert.ok(messageWords(text.long) > 25);
    assert.ok(long.text.fontSize <= LONE_DISPLAY_SIZES.text + 1e-6, 'a paragraph of more than 25 words is no display message');
    // LH-69: a lone text of 4 words or fewer reaches the display title's size.
    const three = item(composeSlide({ title: text.label, text: text.three }, { direction }), 'text');
    assert.equal(three.text.fontSize, HEADING_DISPLAY_SIZES.title);
    assert.equal(three.textStyle.fontWeight, 400, 'in the body face');
    // With fill off, nothing grows.
    assert.ok(item(composeSlide({ title: text.label, text: text.message }, { direction, fill: false }), 'text').text.fontSize <= LONE_DISPLAY_SIZES.text);
  });

  test(`LH-09 (${direction}): the words the author set bold draw in the primary color where it reads, and nothing else is emphasized`, () => {
    const colors = (result, field) => item(result, field).text.richLines.flatMap((line) => line.fragments.map((fragment) => fragment.run.color));
    const title = composeSlide({ title: text.emphasis, blocks: [{ region: 'message', text: text.support }] }, { layout: layouts.statement, direction, roles: light });
    assert.deepEqual([...new Set(colors(title, 'title'))].sort(), ['primary', undefined].sort(), 'the bold sentence of the display title');
    const body = composeSlide({ title: text.label, blocks: [{ region: 'message', text: text.emphasis }] }, { layout: layouts.statement, direction, roles: light });
    assert.ok(colors(body, 'text').includes('primary') && colors(body, 'text').includes(undefined), 'the bold sentence of the display message');
    assert.deepEqual(item(body, 'text').value, text.emphasis, 'the document is unchanged');
    const unread = composeSlide({ title: text.label, blocks: [{ region: 'message', text: text.emphasis }] }, { layout: layouts.statement, direction, roles: dark });
    assert.ok(!colors(unread, 'text').includes('primary'), 'not where the primary reads under 4.5:1');
    const plain = composeSlide({ title: text.label, blocks: [{ region: 'message', text: text.message }] }, { layout: layouts.statement, direction, roles: light });
    assert.equal(item(plain, 'text').value, text.message, 'a plain message has no emphasis to draw');
  });

  test(`LH-69 (${direction}): a lone name with its description is a display word over a short rule; a placed short text is a heading`, () => {
    const result = composeSlide({ title: text.label, items: [{ text: text.name, description: text.support }] }, { direction });
    const list = item(result, 'items');
    assert.equal(list.text.rules?.length, 1, 'one accent rule');
    const [rule] = list.text.rules;
    assert.ok(rule.accent && rule.width < list.box.width / 2, 'short, not across the box');
    assert.ok(Math.abs((start === 'left' ? rule.x : rule.x + rule.width) - (start === 'left' ? list.box.x : list.box.x + list.box.width)) < 1, 'at the start edge');
    const word = list.text.listEntries[0].text.fontSize, description = list.text.fontSize;
    assert.ok(word >= 1.25 * description - 1e-6, 'the word is larger than its heading size would be');
    const placed = composeSlide({ title: text.label, 'top:left': { text: text.three }, 'top:center+right': { text: text.label }, 'middle+bottom:left+center+right': { items: ['Queue', 'Route', 'Resolve'] } }, { direction });
    const heads = placed.items.filter((entry) => entry.field === 'text');
    assert.equal(heads.length, 2);
    assert.ok(heads.every((entry) => entry.textStyle.fontWeight === 700), 'each placed short text is a heading');
    assert.equal(item(placed, 'items').textStyle.fontWeight, 400);
  });
}

test('LH-09: cover, section and closing keep their own treatment (LH-129, LH-130)', () => {
  const closing = composeSlide({ title: 'Thank you', blocks: [{ text: 'Questions to the team at any time.' }] }, { layout: layouts.closing });
  assert.equal(item(closing, 'text').textStyle.fontWeight, 400, 'the closing details are no display message');
  const section = composeSlide({ title: 'Part two: delivery' }, { layout: layouts.section });
  assert.ok(section.titleRule, 'the section keeps its rule');
});
