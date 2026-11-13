// LH-189 (narrowed): display text (twice the body role size or more) of one line tracks -1.5% at the body pitch; one of two lines takes the
// 1.0 em pitch and the tracking only where that buys it a larger size; three lines or more take neither. Labels and attributions set in
// capitals take the eyebrow's +8% tracking. Measurement and the composed styles carry the same numbers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BODY_LINE_PITCH, capitalsLabel, composeSlide, DISPLAY_LINE_PITCH, DISPLAY_TRACKING, displayFrom, displayTracks, EYEBROW_TRACKING, fitText, layoutMetric,
  layoutQuote, linePitch, measureText, PROSE_NOMINAL_SIZE,
} from '../dist/composition.js';

const item = (result, field) => result.items.find((entry) => entry.field === field);
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} ${actual} vs ${expected}`);

test('LH-189: display text starts at twice the body role size, on the canvas scale', () => {
  assert.equal(displayFrom(1), 2 * PROSE_NOMINAL_SIZE);
  assert.equal(displayFrom(1.5), 84);
  assert.equal(linePitch(56, displayFrom(1)), DISPLAY_LINE_PITCH);
  assert.equal(linePitch(55.99, displayFrom(1)), DISPLAY_LINE_PITCH, 'a size snapped onto the 0.01 pt grid under 56 still counts');
  assert.equal(linePitch(55, displayFrom(1)), BODY_LINE_PITCH);
  assert.equal(linePitch(200), BODY_LINE_PITCH, 'without a display size every line is body text');
  assert.equal(DISPLAY_TRACKING, -0.015);
});

test('LH-189: display tracking for scripts with case and figures, never for cursive or full-width scripts', () => {
  assert.equal(displayTracks('Ship in March.'), true);
  assert.equal(displayTracks('98%'), true);
  assert.equal(displayTracks('Готово'), true);
  assert.equal(displayTracks('الإطلاق في مارس'), false);
  assert.equal(displayTracks('三月に出荷します'), false);
  assert.equal(displayTracks('—'), false);
  assert.equal(capitalsLabel('ANNUAL REVENUE'), true);
  assert.equal(capitalsLabel('JANE DOE, CEO'), true);
  assert.equal(capitalsLabel('Annual revenue'), false);
  assert.equal(capitalsLabel('Q3'), false, 'one letter is no label in capitals');
  assert.equal(capitalsLabel('الإيرادات'), false);
});

test('LH-189: fitText takes the display pitch from displayFrom, and the body pitch under it', () => {
  const box = { x: 0, y: 0, width: 400, height: 1000 };
  const display = fitText('Ship in March and then sell it', box, 60, 60, measureText, undefined, false, 56);
  assert.ok(display.lines.length > 1);
  close(display.lineHeight, 60 * DISPLAY_LINE_PITCH);
  close(fitText('Ship in March', box, 40, 40, measureText, undefined, false, 56).lineHeight, 40 * BODY_LINE_PITCH);
  close(fitText('Ship in March', box, 60, 60).lineHeight, 60 * BODY_LINE_PITCH, 'by default');
});

test('LH-189: a one-line display text tracks at the body pitch', () => {
  const short = item(composeSlide({ text: 'Ship in March.' }), 'text');
  assert.ok(short.text.fontSize >= displayFrom(1));
  assert.equal(short.text.lines.length, 1);
  close(short.text.lineHeight, short.text.fontSize * BODY_LINE_PITCH, 'one line: the pitch buys nothing');
  assert.equal(short.textStyle.tracking, DISPLAY_TRACKING);
});

test('LH-189: a two-line display text that reaches the same size either way keeps the body pitch and no tracking', () => {
  for (const text of ['Teams that own their calendar ship twice as often.', 'Fewer exports, more decisions.']) {
    const two = item(composeSlide({ text }), 'text');
    assert.ok(two.text.fontSize >= displayFrom(1));
    assert.equal(two.text.lines.length, 2, text);
    close(two.text.lineHeight, two.text.fontSize * BODY_LINE_PITCH, text);
    assert.equal(two.textStyle.tracking, undefined, text);
  }
});

test('LH-189: a two-line display text takes the 1.0 em pitch and the tracking where that reaches a larger size', () => {
  // A wide padding leaves a short body: at 1.22 em the two lines stop a step lower.
  const tight = item(composeSlide({ text: 'Ship the new ledger in March.', composition: { padding: 0.2 } }), 'text');
  assert.equal(tight.text.lines.length, 2);
  close(tight.text.lineHeight, tight.text.fontSize * DISPLAY_LINE_PITCH, 'pitch');
  assert.equal(tight.textStyle.tracking, DISPLAY_TRACKING);
  assert.ok(tight.text.fontSize >= 113 - 1e-6, `${tight.text.fontSize}`);
});

test('LH-189: three lines or more keep the body pitch and no tracking', () => {
  const three = item(composeSlide({ text: 'Teams that owned their release calendar shipped twice as often as teams on the shared train.' }), 'text');
  assert.ok(three.text.fontSize >= displayFrom(1));
  assert.ok(three.text.lines.length >= 3);
  close(three.text.lineHeight, three.text.fontSize * BODY_LINE_PITCH);
  assert.equal(three.textStyle.tracking, undefined);
  // Body text keeps its pitch and no tracking.
  const paragraph = 'The old ledger ran on three regional platforms that each kept their own copy of every account, so a change took a day to reach every region and the nightly reconciliation failed about once a week.';
  const body = item(composeSlide({ title: 'Why we moved the ledger this year', blocks: [{ text: paragraph }, { items: ['Costly to run in three regions', 'Fragile at month end', 'Late to reconcile', 'Hard to audit'] }] }), 'text');
  assert.ok(body.text.fontSize < displayFrom(1));
  close(body.text.lineHeight, body.text.fontSize * BODY_LINE_PITCH);
  assert.equal(body.textStyle.tracking, undefined);
});

test('LH-189: a one-line rich statement tracks on its fragments; an Arabic one keeps its spacing', () => {
  const rich = item(composeSlide({ text: ['Ship ', { text: 'in March.', bold: true }] }), 'text');
  assert.ok(rich.text.fontSize >= displayFrom(1));
  assert.equal(rich.text.richLines.length, 1);
  for (const line of rich.text.richLines) for (const fragment of line.fragments) assert.equal(fragment.style.tracking, DISPLAY_TRACKING);
  const arabic = item(composeSlide({ text: 'الإطلاق في مارس' }, { direction: 'rtl' }), 'text');
  assert.ok(arabic.text.fontSize >= displayFrom(1));
  close(arabic.text.lineHeight, arabic.text.fontSize * BODY_LINE_PITCH, 'a script without case keeps the body pitch');
  assert.equal(arabic.textStyle.tracking, undefined);
});

test('LH-189: a two-line cover title at display size keeps the body pitch; a content title at its role size is body text', () => {
  const cover = item(composeSlide({ title: 'Ledger migration plan for the next fiscal year' }), 'title');
  assert.ok(cover.text.fontSize >= displayFrom(1));
  assert.equal(cover.text.lines.length, 2);
  close(cover.text.lineHeight, cover.text.fontSize * BODY_LINE_PITCH);
  assert.equal(cover.textStyle.tracking, undefined);
  const content = item(composeSlide({ title: 'Ledger migration', items: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] }), 'title');
  assert.ok(content.text.fontSize < displayFrom(1));
  close(content.text.lineHeight, content.text.fontSize * BODY_LINE_PITCH);
});

test('LH-189: a one-line message quote body tracks at the body pitch; an attribution in capitals takes the eyebrow tracking', () => {
  const box = { x: 0, y: 0, width: 1100, height: 560 };
  const quote = layoutQuote({ text: 'Less, but better.', attribution: 'DIETER RAMS' }, box, { growth: 2, message: true });
  const body = quote.parts.find((part) => part.role === 'body'), footer = quote.parts.find((part) => part.role === 'footer');
  assert.ok(body.fit.fontSize >= displayFrom(1));
  assert.equal(body.fit.lines.length, 1);
  close(body.fit.lineHeight, body.fit.fontSize * BODY_LINE_PITCH);
  assert.equal(body.style.tracking, DISPLAY_TRACKING);
  assert.equal(footer.style.tracking, EYEBROW_TRACKING);
  const plain = layoutQuote({ text: 'Less, but better.', attribution: 'Dieter Rams' }, box);
  assert.equal(plain.parts.find((part) => part.role === 'footer').style.tracking, undefined);
  // A two-line message quote, and a quote among others at any size, keep the body pitch and no tracking.
  const two = layoutQuote({ text: 'Simplicity is the ultimate sophistication.', attribution: 'Leonardo' }, { ...box, width: 1000 }, { growth: 2, message: true }).parts.find((part) => part.role === 'body');
  assert.ok(two.fit.fontSize >= displayFrom(1) && two.fit.lines.length === 2, `${two.fit.fontSize} ${two.fit.lines.length}`);
  close(two.fit.lineHeight, two.fit.fontSize * BODY_LINE_PITCH);
  assert.equal(two.style.tracking, undefined);
  const among = layoutQuote({ text: 'Less, but better.', attribution: 'Dieter Rams' }, box, { growth: 2 }).parts.find((part) => part.role === 'body');
  assert.equal(among.style.tracking, undefined);
});

test('LH-189: the value of a message metric tracks at the body pitch; one at its role size among other blocks does not; a label in capitals tracks as an eyebrow', () => {
  const box = { x: 0, y: 0, width: 600, height: 400 };
  const metric = layoutMetric({ value: '$1.2M', label: 'ANNUAL REVENUE' }, box, { message: true });
  const value = metric.parts.find((part) => part.role === 'value'), label = metric.parts.find((part) => part.role === 'label');
  assert.ok(value.fit.fontSize >= displayFrom(1));
  close(value.fit.lineHeight, value.fit.fontSize * BODY_LINE_PITCH, 'a figure is one line: the pitch buys nothing');
  assert.equal(value.style.tracking, DISPLAY_TRACKING);
  assert.equal(label.style.tracking, EYEBROW_TRACKING);
  assert.equal(label.style.caps, undefined, 'already in capitals: drawn as written');
  const role = layoutMetric({ value: '$1.2M', label: 'Annual revenue' }, box), plain = role.parts.find((part) => part.role === 'value');
  assert.equal(role.parts.find((part) => part.role === 'label').style.tracking, undefined);
  assert.equal(plain.style.tracking, undefined);
  assert.equal(layoutMetric({ value: '$1.2M' }, box, { growth: 2 }).parts[0].style.tracking, DISPLAY_TRACKING, 'a lone metric that grows is the message too');
});

test('LH-189: a CJK statement at display size keeps the body pitch and no tracking', () => {
  const japanese = item(composeSlide({ text: '三月に出荷します' }, { language: 'ja' }), 'text');
  assert.ok(japanese.text.fontSize >= displayFrom(1));
  close(japanese.text.lineHeight, japanese.text.fontSize * BODY_LINE_PITCH);
  assert.equal(japanese.textStyle.tracking, undefined);
});
