import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  composeSlide, EYEBROW_FONT_SIZE, EYEBROW_TRACKING, eyebrowCaps, eyebrowLabel, fitList, isLabelText, LIST_ROWS_GAP, measureText, styledText,
  textWidthMeasurer, trackingWidth,
} from '../dist/composition.js';
import {validate} from '../dist/index.js';

// LH-08 (ruled rows), LH-32 (the tag as an eyebrow) and LH-50 (a short label over a longer text as its eyebrow).
const LABELLED = [
  {text: 'Clear scope', description: 'Two teams and one workflow keep the pilot focused.'},
  {text: 'Consistent measures', description: 'Track completion and task time against a baseline.'},
  {text: 'An explicit decision', description: 'Agree the evidence needed before expanding.'},
];
const listOf = composed => composed.items.find(item => item.field === 'items');
const style = {fontFamily: 'sans-serif', fontWeight: 400};

test('LH-32: an eyebrow is measured as drawn, in capitals with its tracking after every character', () => {
  assert.equal(eyebrowCaps('Compliance'), true);
  assert.equal(eyebrowCaps('Ελλάδα'), true);
  // No case (Arabic, CJK) or capitals that change the length (ß) keep the text as written.
  assert.equal(eyebrowCaps('مراجعة'), false);
  assert.equal(eyebrowCaps('概要'), false);
  assert.equal(eyebrowCaps('Straße'), false);
  assert.equal(eyebrowCaps('2026'), false);
  assert.equal(styledText('Signal', {caps: true}), 'SIGNAL');
  assert.equal(trackingWidth('Signal', 16, {tracking: EYEBROW_TRACKING}), 6 * 16 * EYEBROW_TRACKING);
  const eyebrow = textWidthMeasurer({...style, caps: true, tracking: EYEBROW_TRACKING});
  assert.equal(eyebrow('Signal', 16), measureText('SIGNAL', 16) + 6 * 16 * EYEBROW_TRACKING);
  // A host measurement is asked for the capitals.
  const asked = [];
  const host = textWidthMeasurer({...style, caps: true}, {measure: (text, size) => { asked.push(text); return text.length * size / 2; }});
  assert.equal(host('Inputs', 20), 60);
  assert.deepEqual(asked, ['INPUTS']);
});

test('LH-32: the slide tag is an eyebrow: bold, capitals and tracking where its script has case', () => {
  const tagOf = composed => composed.items.find(item => item.field === 'tag');
  const latin = tagOf(composeSlide({tag: 'Compliance', title: 'Readiness review'}));
  assert.equal(latin.textStyle.caps, true);
  assert.equal(latin.textStyle.tracking, EYEBROW_TRACKING);
  assert.equal(latin.textStyle.fontWeight, 700);
  assert.equal(latin.text.fontSize, EYEBROW_FONT_SIZE);
  assert.equal(latin.value, 'Compliance', 'the document keeps the text as written');
  const arabic = tagOf(composeSlide({tag: 'مراجعة ربع سنوية', title: 'نتائج التجربة'}, {presentation: {language: 'ar', slides: []}}));
  assert.equal(arabic.textStyle.caps, undefined);
  assert.equal(arabic.textStyle.tracking, undefined);
  assert.equal(arabic.textStyle.fontWeight, 700);
});

test('LH-50: a label is one line of 2 to 32 characters and at most 3 words, with no full stop', () => {
  for (const label of ['Signal', 'Next step', 'Key risk now', 'الإشارة', 'Inputs:']) assert.equal(isLabelText(label), true, label);
  for (const text of ['A', 'Four words are many', 'Done.', 'Two\nlines', 'A label that runs to more than thirty-two characters']) assert.equal(isLabelText(text), false, text);
  assert.equal(eyebrowLabel('Signal', 'Completion rose from 61% to 78% in six weeks.'), true);
  // The text must be no label itself and at least twice as long.
  assert.equal(eyebrowLabel('Signal', 'Inputs'), false);
  assert.equal(eyebrowLabel('Operations', 'Ship it now'), false);
});

test('LH-50: a short label before a longer paragraph is drawn as its eyebrow, in its cell, not as a block of its own', () => {
  const blocks = [{text: 'Signal'}, {text: 'Completion rose from 61% to 78% in the six pilot weeks, with no change in staffing.'},
    {text: 'Inputs'}, {text: 'Weekly exports from both teams, plus a baseline from the quarter before the pilot.'}];
  for (const contentBox of [false, true]) {
    const composed = composeSlide({title: 'Pilot review', blocks, design: {contentBox}});
    const texts = composed.items.filter(item => item.field === 'text');
    assert.deepEqual(texts.map(item => item.path), ['slides.0.blocks.0.text', 'slides.0.blocks.1.text', 'slides.0.blocks.2.text', 'slides.0.blocks.3.text'], 'every block is drawn, the eyebrow first');
    for (const at of [0, 2]) {
      const eyebrow = texts[at], body = texts[at + 1];
      assert.equal(eyebrow.eyebrow, true);
      assert.equal(body.eyebrow, undefined);
      assert.equal(eyebrow.text.fontSize, EYEBROW_FONT_SIZE);
      assert.equal(eyebrow.textStyle.caps, true);
      assert.ok(eyebrow.box.y + eyebrow.box.height <= body.box.y + 1e-6, 'over its paragraph');
      assert.equal(eyebrow.box.x, body.box.x);
      // One card for the two: the eyebrow carries its paragraph's.
      if (contentBox) assert.deepEqual(eyebrow.frameBox, body.frameBox);
      else assert.equal(eyebrow.frameBox, undefined);
    }
    assert.deepEqual(composed.diagnostics.filter(entry => entry.code === 'text-overflow'), []);
  }
  // The label is no body block, so the paragraphs read at least as large as they do with the label as a block.
  const plain = composeSlide({title: 'Pilot review', blocks: blocks.map(block => ({...block, emphasis: false}))});
  const sizes = composed => composed.items.filter(item => item.field === 'text' && !item.eyebrow && item.text.fontSize > EYEBROW_FONT_SIZE).map(item => item.text.fontSize);
  const withEyebrows = composeSlide({title: 'Pilot review', blocks});
  assert.ok(Math.min(...sizes(withEyebrows)) >= Math.min(...sizes(plain).filter((_, index) => index % 2)) - 1e-6);
});

test('LH-08: a list of short labels with descriptions is drawn as ruled rows, labels beside their descriptions', () => {
  const list = listOf(composeSlide({title: 'What makes a pilot worth running', items: LABELLED}));
  const {listEntries: entries, rules} = list.text;
  assert.equal(rules.length, LABELLED.length - 1);
  for (const [index, rule] of rules.entries()) {
    assert.equal(rule.x, list.box.x);
    assert.equal(rule.width, list.box.width);
    // Each hairline sits between the rows it separates.
    const above = entries[index], below = entries[index + 1];
    assert.ok(rule.y > Math.max(above.textBox.y + above.textBox.height, above.descriptionBox.y + above.descriptionBox.height));
    assert.ok(rule.y < below.textBox.y);
  }
  for (const entry of entries) {
    assert.equal(entry.marker.none, true, 'no bullet');
    assert.equal(entry.textBox.x, list.box.x);
    assert.ok(entry.descriptionBox.x > entry.textBox.x + entry.textBox.width, 'beside its label');
    assert.ok(Math.abs(entry.textBox.y + entry.text.richLines[0].baseline - (entry.descriptionBox.y + entry.description.richLines[0].baseline)) < 1e-6, 'first baselines aligned');
    assert.equal(entry.text.richLines[0].fragments[0].style.fontWeight, 700, 'bold label');
  }
  // One description column for every row.
  assert.equal(new Set(entries.map(entry => entry.descriptionBox.x)).size, 1);
});

test('LH-08: design.listStyle stack opts out, rows draws any list as ruled rows, numbers stay', () => {
  const stacked = listOf(composeSlide({title: 'T', items: LABELLED, design: {listStyle: 'stack'}}));
  assert.equal(stacked.text.rules, undefined);
  assert.deepEqual(stacked.text.listEntries.map(entry => entry.marker.text), ['•', '•', '•']);
  const plain = listOf(composeSlide({title: 'Agenda', items: ['Define the problem', 'Review the evidence', 'Agree the decision'], design: {listStyle: 'rows'}}));
  assert.equal(plain.text.rules.length, 2);
  assert.ok(plain.text.listEntries.every(entry => entry.marker.none));
  const numbered = listOf(composeSlide({title: 'Agenda', numbering: 'arabic', items: ['Define the problem', 'Review the evidence']}, {presentation: {design: {listStyle: 'rows'}, slides: []}}));
  assert.deepEqual(numbered.text.listEntries.map(entry => entry.marker.text), ['1.', '2.']);
  assert.equal(numbered.text.rules.length, 1);
  // The rows are LIST_ROWS_GAP em apart.
  const [first, second] = plain.text.listEntries;
  assert.ok(Math.abs(second.textBox.y - (first.textBox.y + first.text.height) - LIST_ROWS_GAP * plain.text.fontSize) < 1e-6);
});

test('LH-08: a nested entry stays under its row, and a narrow list sets descriptions under their labels', () => {
  const fit = fitList([{text: 'Scope', description: 'Two teams.'}, {text: 'Detail', level: 1}, {text: 'Measures', description: 'A baseline.'}], {x: 0, y: 0, width: 600, height: 600}, 24, 16, {style, rows: true});
  assert.equal(fit.rules.length, 1, 'no hairline above a nested entry');
  const narrow = fitList(LABELLED, {x: 0, y: 0, width: 300, height: 1000}, 24, 16, {style, rows: true});
  for (const entry of narrow.listEntries) {
    assert.equal(entry.descriptionBox.x, entry.textBox.x);
    assert.ok(entry.descriptionBox.y >= entry.textBox.y + entry.text.height);
  }
  assert.equal(narrow.rules.length, 2);
});

test('LH-08: right to left, the label column is at the right', () => {
  const items = [{text: 'نطاق واضح', description: 'فريقان وسير عمل واحد يحافظان على تركيز التجربة.'}, {text: 'قرار صريح', description: 'الاتفاق على الأدلة المطلوبة قبل التوسع.'}];
  const list = listOf(composeSlide({title: 'شروط', items}, {presentation: {language: 'ar', slides: []}}));
  for (const entry of list.text.listEntries) {
    assert.equal(entry.direction, 'rtl');
    assert.ok(Math.abs(entry.textBox.x + entry.textBox.width - (list.box.x + list.box.width)) < 1e-6);
    assert.ok(entry.descriptionBox.x + entry.descriptionBox.width < entry.textBox.x);
  }
  assert.equal(list.text.rules.length, 1);
});

test('LH-08: listStyle is a design key of the deck, the slide, a theme and a layout', () => {
  const deck = {$schema: 'https://openpresentation.org/schema/opf/v1', design: {listStyle: 'rows'}, slides: [{title: 'T', design: {listStyle: 'stack'}, items: ['One', 'Two']}]};
  assert.equal(validate(deck).findings.filter(finding => finding.ruleId === 'opf/schema').length, 0);
  const wrong = {...deck, design: {listStyle: 'grid'}};
  assert.ok(validate(wrong).findings.some(finding => finding.ruleId === 'opf/schema'));
});
