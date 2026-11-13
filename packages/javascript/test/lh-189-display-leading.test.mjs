// LH-189: display text (twice the body role size or more) takes a line pitch of 1.0 em and -1.5% tracking where its script has case;
// labels and attributions set in capitals take the eyebrow's +8% tracking. Measurement and the composed styles carry the same numbers.
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

test('LH-189: a statement at display size has a 1.0 em pitch and tracks; its measured lines include the tracking', () => {
  const result = composeSlide({ text: 'Teams that own their calendar ship twice as often.' });
  const text = item(result, 'text');
  assert.ok(text.text.fontSize >= displayFrom(1));
  assert.ok(text.text.lines.length >= 2, 'two lines or more');
  close(text.text.lineHeight, text.text.fontSize * DISPLAY_LINE_PITCH, 'pitch');
  assert.equal(text.textStyle.tracking, DISPLAY_TRACKING);
  // Body text keeps its pitch and no tracking.
  const paragraph = 'The old ledger ran on three regional platforms that each kept their own copy of every account, so a change took a day to reach every region and the nightly reconciliation failed about once a week.';
  const body = item(composeSlide({ title: 'Why we moved the ledger this year', blocks: [{ text: paragraph }, { items: ['Costly to run in three regions', 'Fragile at month end', 'Late to reconcile', 'Hard to audit'] }] }), 'text');
  assert.ok(body.text.fontSize < displayFrom(1));
  close(body.text.lineHeight, body.text.fontSize * BODY_LINE_PITCH);
  assert.equal(body.textStyle.tracking, undefined);
});

test('LH-189: a rich statement tracks on its fragments; an Arabic one keeps its spacing and the body pitch', () => {
  const rich = item(composeSlide({ text: ['Customers buy ', { text: 'fewer bad Mondays.', bold: true }] }), 'text');
  assert.ok(rich.text.fontSize >= displayFrom(1));
  close(rich.text.lineHeight, rich.text.fontSize * DISPLAY_LINE_PITCH);
  for (const line of rich.text.richLines) for (const fragment of line.fragments) assert.equal(fragment.style.tracking, DISPLAY_TRACKING);
  const arabic = item(composeSlide({ text: 'الإطلاق في مارس' }, { direction: 'rtl' }), 'text');
  assert.ok(arabic.text.fontSize >= displayFrom(1));
  close(arabic.text.lineHeight, arabic.text.fontSize * BODY_LINE_PITCH, 'a script without case keeps the body pitch');
  assert.equal(arabic.textStyle.tracking, undefined);
});

test('LH-189: a display title (a cover grown to display size) takes the pitch; a content title at its role size does not', () => {
  const cover = item(composeSlide({ title: 'Ledger migration plan for the next fiscal year' }), 'title');
  if (cover.text.fontSize >= displayFrom(1)) close(cover.text.lineHeight, cover.text.fontSize * DISPLAY_LINE_PITCH);
  const content = item(composeSlide({ title: 'Ledger migration', items: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] }), 'title');
  assert.ok(content.text.fontSize < displayFrom(1));
  close(content.text.lineHeight, content.text.fontSize * BODY_LINE_PITCH);
});

test('LH-189: the body of a message quote at display size takes the pitch and tracking; an attribution in capitals takes the eyebrow tracking', () => {
  const box = { x: 0, y: 0, width: 1100, height: 560 };
  const quote = layoutQuote({ text: 'Less, but better.', attribution: 'DIETER RAMS' }, box, { growth: 2, message: true });
  const body = quote.parts.find((part) => part.role === 'body'), footer = quote.parts.find((part) => part.role === 'footer');
  assert.ok(body.fit.fontSize >= displayFrom(1));
  close(body.fit.lineHeight, body.fit.fontSize * DISPLAY_LINE_PITCH);
  assert.equal(body.style.tracking, DISPLAY_TRACKING);
  assert.equal(footer.style.tracking, EYEBROW_TRACKING);
  const plain = layoutQuote({ text: 'Less, but better.', attribution: 'Dieter Rams' }, box);
  assert.equal(plain.parts.find((part) => part.role === 'footer').style.tracking, undefined);
  assert.ok(plain.parts.find((part) => part.role === 'body').fit.fontSize < displayFrom(1));
  assert.equal(plain.parts.find((part) => part.role === 'body').style.tracking, undefined);
  // A quote that grows among others (a stacked record's row of quotes) keeps the body pitch at any size.
  const among = layoutQuote({ text: 'Less, but better.', attribution: 'Dieter Rams' }, box, { growth: 2 }).parts.find((part) => part.role === 'body');
  assert.ok(among.fit.fontSize >= displayFrom(1));
  close(among.fit.lineHeight, among.fit.fontSize * BODY_LINE_PITCH);
  assert.equal(among.style.tracking, undefined);
});

test('LH-189: the value of a message metric is display text; one at its role size among other blocks is not; a label in capitals tracks as an eyebrow', () => {
  const box = { x: 0, y: 0, width: 600, height: 400 };
  const metric = layoutMetric({ value: '$1.2M', label: 'ANNUAL REVENUE' }, box, { message: true });
  const value = metric.parts.find((part) => part.role === 'value'), label = metric.parts.find((part) => part.role === 'label');
  assert.ok(value.fit.fontSize >= displayFrom(1));
  close(value.fit.lineHeight, value.fit.fontSize * DISPLAY_LINE_PITCH);
  assert.equal(value.style.tracking, DISPLAY_TRACKING);
  assert.equal(label.style.tracking, EYEBROW_TRACKING);
  assert.equal(label.style.caps, undefined, 'already in capitals: drawn as written');
  const role = layoutMetric({ value: '$1.2M', label: 'Annual revenue' }, box), plain = role.parts.find((part) => part.role === 'value');
  assert.equal(role.parts.find((part) => part.role === 'label').style.tracking, undefined);
  close(plain.fit.lineHeight, plain.fit.fontSize * BODY_LINE_PITCH, 'a value at its role size keeps the body pitch');
  assert.equal(plain.style.tracking, undefined);
  // A lone metric that grows is the body's message too.
  close(layoutMetric({ value: '$1.2M' }, box, { growth: 2 }).parts[0].fit.lineHeight, layoutMetric({ value: '$1.2M' }, box, { growth: 2 }).parts[0].fit.fontSize * DISPLAY_LINE_PITCH);
});

test('LH-189: a CJK statement at display size keeps the body pitch and no tracking', () => {
  const japanese = item(composeSlide({ text: '三月に出荷します' }, { language: 'ja' }), 'text');
  assert.ok(japanese.text.fontSize >= displayFrom(1));
  close(japanese.text.lineHeight, japanese.text.fontSize * BODY_LINE_PITCH);
  assert.equal(japanese.textStyle.tracking, undefined);
});
