// LH-70, LH-72, LH-67, LH-78: paragraph columns at a reading measure, centered layouts that center only short text, a lead beside a
// stack, and quotes beside other blocks at the lead size on a card. The rules read block kinds, counts and lengths, never a slide id.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, layoutQuote } from '../dist/composition.js';
import { layouts, sampleSlide } from './support/template-samples.mjs';

const overflow = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const texts = (result) => result.items.filter((item) => item.field === 'text' && !item.path.endsWith('title'));
const quotes = (result) => result.items.filter((item) => item.quoteLayout);
const bodySize = (item) => item.quoteLayout.parts.find((part) => part.role === 'body').fit.fontSize;
const lines = (item) => (item.text.richLines ?? item.text.lines).length;
const paragraph = (name) => `${name} should focus the next cycle on one measurable change while making the operating tradeoffs clear to its stakeholders.`;
const names = ['Harborline Bank', 'Relay Cloud', 'Juniper Legal', 'Northstar Care', 'Voltcrest Components', 'Easton Library'];
const paragraphs = (count) => names.slice(0, count).map((name) => ({ text: paragraph(name) }));
// Average characters per line of a fitted text at its size, as core estimates them (half an em per character).
const measure = (item) => item.box.width / (0.5 * item.text.fontSize);

test('LH-70: similar paragraphs become columns at a 45 to 65 character measure only when that costs no size', () => {
  for (const count of [3, 4, 5, 6]) {
    const result = composeSlide({ title: 'Execution timeline', blocks: paragraphs(count) }, { layout: layouts.text });
    // The stack the region draws without the rule, for comparison: an authored column.
    const stack = composeSlide({ title: 'Execution timeline', composition: { mode: 'column' }, blocks: paragraphs(count) }, { layout: layouts.text });
    assert.deepEqual(overflow(result), [], `${count}: fits`);
    const items = texts(result);
    assert.equal(items.length, count);
    assert.equal(new Set(items.map((item) => item.text.fontSize)).size, 1, `${count}: one size`);
    if (new Set(items.map((item) => Math.round(item.box.x))).size < 2) continue;
    assert.ok(items[0].text.fontSize >= texts(stack)[0].text.fontSize - 1e-9, `${count}: columns are never smaller than the stack`);
  }
  // Three long paragraphs on a wide slide: three columns at a 45-character measure exist only at the floor, so they keep their
  // stack at the body size.
  const long = (name) => ({ text: `${paragraph(name)} It also names the owner and the date of the next review.` });
  const three = texts(composeSlide({ title: 'Execution timeline', blocks: [long('Harborline Bank'), long('Relay Cloud'), long('Juniper Legal')] }, { layout: layouts.text }));
  assert.ok(three[0].text.fontSize > 16, 'above the floor');
  // Six long paragraphs, stacked at 21 px before: two columns at a 45 to 65 character measure, at that size or larger.
  const six = texts(composeSlide(sampleSlide(layouts.text, 6, 'long'), { layout: layouts.text }));
  assert.ok(six[0].text.fontSize >= 21 - 1e-9);
  assert.equal(new Set(six.map((item) => Math.round(item.box.x))).size, 2, 'two columns');
  for (const item of six) assert.ok(measure(item) >= 44.5 && Math.min(item.box.width, 65 * 0.5 * item.text.fontSize) / (0.5 * item.text.fontSize) <= 65.5, `${item.path} measure ${measure(item)}`);
});

test('LH-70: paragraphs of unequal length, short notes and an authored mode keep their arrangement', () => {
  const unequal = [{ text: paragraph('Harborline Bank') }, { text: 'Review feedback every week.' }, { text: paragraph('Relay Cloud') }];
  assert.notEqual(composeSlide({ title: 'T', blocks: unequal }, { explain: true }).explanation.decisions[0].reason, 'paragraph-columns');
  const authored = composeSlide({ title: 'T', composition: { mode: 'column' }, blocks: paragraphs(3) });
  assert.equal(new Set(texts(authored).map((item) => Math.round(item.box.x))).size, 1, 'a column stays a column');
});

test('LH-70 right to left: the columns mirror and keep their size', () => {
  const ltr = texts(composeSlide({ title: 'T', blocks: paragraphs(4) }, { layout: layouts.text }));
  const rtl = texts(composeSlide({ title: 'T', blocks: paragraphs(4) }, { layout: layouts.text, direction: 'rtl' }));
  ltr.forEach((item, index) => {
    assert.ok(Math.abs(rtl[index].box.x - (1280 - item.box.x - item.box.width)) < 0.51, `${item.path} mirrored`);
    assert.equal(rtl[index].text.fontSize, item.text.fontSize);
  });
});

test('LH-72: a centered layout start-aligns long text in a centered measure column and keeps short text centered', () => {
  const result = composeSlide({ title: 'Why this matters', blocks: [{ metric: { value: '$4.8M', label: 'Illustrative result' } }, { text: `${paragraph('Kindred Systems')} It also names the owner.` }] }, { layout: layouts.metrics });
  const note = texts(result)[0];
  assert.equal(note.alignment, 'left', 'start-aligned');
  assert.ok(lines(note) > 2 || note.value.length > 120, 'long');
  assert.ok(note.box.width <= 65 * 0.5 * note.text.fontSize + 0.5, 'a measure-capped column');
  const middle = note.box.x + note.box.width / 2;
  assert.ok(Math.abs(middle - 640) < 1, 'the column sits on the slide axis');
  const short = texts(composeSlide({ title: 'Why this matters', blocks: [{ metric: { value: '$4.8M', label: 'Illustrative result' } }, { text: 'Keep the evidence together.' }] }, { layout: layouts.metrics }))[0];
  assert.equal(short.alignment, 'center', 'short text stays centered');
  // The author's own centering is kept.
  const authored = texts(composeSlide({ title: 'T', design: { contentAlignment: 'center' }, blocks: [{ text: paragraph('Kindred Systems') }, { metric: { value: '4', label: 'Teams' } }] }))[0];
  assert.equal(authored.alignment, 'center');
  // Right to left the column is start-aligned at the right edge: `left` is the logical start.
  const rtl = texts(composeSlide({ title: 'T', blocks: [{ metric: { value: '$4.8M', label: 'Result' } }, { text: `${paragraph('Kindred Systems')} It also names the owner.` }] }, { layout: layouts.metrics, direction: 'rtl' }))[0];
  assert.equal(rtl.alignment, 'left');
});

test('LH-72: siblings of a start-aligned text are start-aligned too', () => {
  const result = composeSlide({ title: 'Decision', blocks: [{ text: paragraph('Harborline Bank') }, { text: 'Keep the recommendation and its evidence together.' }, { text: 'Growth was broad-based.' }, { text: paragraph('Relay Cloud') }] }, { layout: layouts.closing });
  assert.deepEqual(texts(result).map((item) => item.alignment), ['left', 'left', 'left', 'left']);
});

test('LH-67: one text much longer than its siblings leads at 55% of the width, one role step larger, beside a stack', () => {
  const blocks = [{ text: paragraph('Ironwood Devices') }, { text: 'The deck-level language can be a catalog id.' }, { text: 'The new checklist reached both teams.' }, { text: 'Text payloads accept plain strings or runs.' }];
  for (const options of [{}, { layout: layouts.text }]) {
    const result = composeSlide({ title: 'Signal trend', blocks }, options);
    assert.deepEqual(overflow(result), []);
    const [lead, ...stack] = texts(result);
    const width = lead.box.width + stack[0].box.width;
    assert.ok(lead.box.width / width > 0.5 && lead.box.width / width < 0.6, `lead share ${lead.box.width / width}`);
    assert.ok(stack.every((item) => Math.abs(item.box.x - stack[0].box.x) < 0.01 && item.box.x > lead.box.x), 'a stack beside the lead');
    assert.ok(lead.text.fontSize > Math.max(...stack.map((item) => item.text.fontSize)), 'the lead is larger');
    assert.equal(new Set(stack.map((item) => item.text.fontSize)).size, 1, 'the stack shares one size');
  }
  const rtl = texts(composeSlide({ title: 'Signal trend', blocks }, { direction: 'rtl' }));
  assert.ok(rtl[0].box.x > rtl[1].box.x, 'right to left the lead is at the right');
});

test('LH-67: a chart with two compact siblings takes about 58% at full height', () => {
  // The quote sits between the others: a last (or first) one would be LH-114's pull line under the chart and the metric.
  const chart = { chart: { type: 'column', data: { columns: ['Quarter', 'Current'], rows: [['Q1', 19], ['Q2', 23], ['Q3', 26]] } } };
  const result = composeSlide({ title: 'Grant equity review', blocks: [chart, { quote: { text: 'The new workflow made exceptions visible.', attribution: 'VP Operations' } }, { metric: { value: '31%', label: 'Primary signal' } }] }, { explain: true });
  assert.equal(result.explanation.decisions[0].reason, 'lead-stack');
  const item = result.items.find((entry) => entry.field === 'chart');
  assert.ok(Math.abs(item.box.width / (result.contentBox.width - 24) - 0.58) < 0.01, `share ${item.box.width / result.contentBox.width}`);
  // An authored row keeps its equal cells.
  const row = composeSlide({ title: 'T', composition: { mode: 'row' }, blocks: [chart, { metric: { value: '31%', label: 'Signal' } }, { text: 'Short.' }] }, { explain: true });
  assert.equal(row.explanation.decisions[0].reason, 'configured-mode');
});

test('LH-78: a quote beside other blocks is on a card and never smaller than before; alone or as one of two it keeps the display size', () => {
  const quote = { quote: { text: 'The path is workable if we keep the metric simple and the decision owner visible.', attribution: 'Pricing working group' } };
  const beside = quotes(composeSlide({ title: 'T', blocks: [{ metric: { value: '31%', label: 'Signal' } }, quote] }))[0];
  assert.ok(beside.frameBox, 'a card');
  assert.ok(!beside.quoteLayout.overflow);
  const alone = quotes(composeSlide({ title: 'T', blocks: [quote] }))[0];
  assert.ok(!alone.frameBox && bodySize(alone) > 32, 'a lone quote keeps the display size');
  const pair = quotes(composeSlide({ title: 'T', blocks: [quote, quote] }, { layout: layouts.quote }));
  assert.ok(pair.every((item) => !item.frameBox && bodySize(item) > 32), 'two quotes keep the display size');
});

test('LH-78: sibling quotes share one size, a card never makes a quote overflow, and three or more quotes keep their size', () => {
  const quote = (text) => ({ quote: { text, attribution: 'Working group' } });
  const result = composeSlide({ title: 'Voices', blocks: [quote('Teams already know where the friction is; the deck makes the sequence of choices explicit.'), quote('Short and clear.'), quote('The path is workable if we keep the metric simple.')] }, { layout: layouts.quote });
  assert.deepEqual(overflow(result), []);
  assert.equal(new Set(quotes(result).map(bodySize)).size, 1, 'one size');
  // Short quotes fit at the display size, so the lead size (which would make them smaller) is not taken.
  const short = quotes(composeSlide({ title: 'Voices', blocks: [quote('Short and clear.'), quote('Keep it simple.'), quote('Name the owner.')] }, { layout: layouts.quote }));
  assert.ok(short.every((item) => bodySize(item) === 40), 'the display size');
  const long = 'Exceptions need a brief review of the decision, its reversibility, and the evidence that is still missing, and the owner should name the latest useful decision date. '.repeat(2);
  const crowded = composeSlide({ title: 'Voices', blocks: Array.from({ length: 6 }, () => quote(long)) }, { layout: layouts.quote });
  for (const item of quotes(crowded)) if (item.frameBox) assert.ok(!item.quoteLayout.overflow, `${item.path}: a card only when it fits`);
});

test('LH-78: the quote body steps down to fit its lines, never below the body text size', () => {
  const text = 'Teams already know where the friction is; the deck makes the sequence of choices explicit and keeps every owner visible to the board.';
  const box = { x: 0, y: 0, width: 420, height: 400 };
  const fitted = layoutQuote({ text }, box, { bodySize: 32, bodyLines: 4 }), body = fitted.parts.find((part) => part.role === 'body');
  assert.ok(body.requestedFontSize >= 28 - 1e-9 && body.requestedFontSize <= 32 + 1e-9);
  assert.ok(body.fit.lines.length <= 4 || body.requestedFontSize === 28);
  const display = layoutQuote({ text }, box).parts.find((part) => part.role === 'body');
  assert.equal(display.requestedFontSize, 40, 'the display size by default');
});

test('LH-78: quotes share one size within a row; a row of wider cells keeps its own', () => {
  const result = composeSlide(sampleSlide(layouts.quote, 5, 'long'), { layout: layouts.quote });
  assert.deepEqual(overflow(result), []);
  const rows = new Map();
  for (const item of quotes(result)) rows.set(Math.round((item.frameBox ?? item.box).y), [...(rows.get(Math.round((item.frameBox ?? item.box).y)) ?? []), bodySize(item)]);
  const [narrow, wide] = [...rows.values()];
  assert.equal(new Set(narrow).size, 1, 'one size in the row of three');
  assert.equal(new Set(wide).size, 1, 'one size in the row of two');
  assert.ok(wide[0] > narrow[0], 'the wider row keeps its larger size');
});
