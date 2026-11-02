// LH-11: core's line breaker never splits a number from its unit or %, and never starts a line with a closing mark. English,
// right-to-left (Arabic, Hebrew) and CJK samples, plain and rich text, and the no-break spaces the PPTX export writes.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bindNoBreak, fitRichText, fitText, lineMayStartAt, unbindNoBreak, wrapText } from '../dist/composition.js';

const SIZE = 20;
const widths = Array.from({ length: 28 }, (_, index) => 90 + index * 14);
// The wrapped lines without their hanging spaces.
const joinLines = lines => lines.map(line => line.replace(/\s+$/u, ''));
const startsWithClosing = line => /^[.,;:!?)\]}%\u2030\u066a\u00bb\u201d\u2019\u060c\u061b\u061f\u3002\u3001\uff0c\uff1a\uff1b\uff01\uff1f\uff09\u300d\u300f\u3011]/u.test(line);
const pairs = lines => lines.slice(0, -1).map((line, index) => [line, lines[index + 1]]);

const english = 'Revenue grew by 26 % in the last year and reached $4.8 M across 12 km of routes, said the "CEO" (really); costs fell 3 x.';
test('a number stays with its unit or % at every width (English)', () => {
  for (const width of widths) {
    const lines = joinLines(wrapText(english, width, SIZE));
    assert.equal(lines.join('').replace(/\s+/g, ''), english.replace(/\s+/g, ''), `${width}: no word is lost`);
    for (const line of lines) {
      assert.ok(!/^(%|M|km|x)(?!\p{L})/u.test(line), `${width}: a line starts with a unit: ${JSON.stringify(lines)}`);
      assert.ok(!startsWithClosing(line), `${width}: a line starts with a closing mark: ${JSON.stringify(lines)}`);
    }
    for (const [first, second] of pairs(lines)) {
      assert.ok(!/\d$/.test(first) || !/^(%|M|km|x)(?!\p{L})/u.test(second), `${width}: a figure parts from its unit: ${JSON.stringify(lines)}`);
    }
  }
});

test('the pair is kept whole when the line has to break before it', () => {
  const lines = joinLines(wrapText('Revenue grew by 26 % in the last year', 190, SIZE));
  assert.ok(lines.some(line => line.includes('26 %')), JSON.stringify(lines));
  const money = joinLines(wrapText('Annual revenue reached $4.8 M across twelve markets', 220, SIZE));
  assert.ok(money.some(line => line.includes('$4.8 M')), JSON.stringify(money));
});

test('a closing mark after a space stays with the word before it', () => {
  for (const width of widths) {
    const lines = joinLines(wrapText('Qu\u2019est-ce que c\u2019est , dit-il : voila ; fin ?', width, SIZE));
    for (const line of lines) assert.ok(!startsWithClosing(line), `${width}: ${JSON.stringify(lines)}`);
  }
});

test('right-to-left text keeps a figure with its unit (Arabic and Hebrew)', () => {
  const arabic = 'ارتفعت الإيرادات ٢٦ ٪ إلى 4.8 مليون دولار، وهذا جيد جدا في السنة الأخيرة.';
  const hebrew = 'הכנסות עלו ב־26 % ל־4.8 מיליון ש״ח בשנה האחרונה, וזה טוב מאוד.';
  for (const text of [arabic, hebrew]) {
    for (const width of widths) {
      const lines = joinLines(wrapText(text, width, SIZE));
      for (const [first, second] of pairs(lines)) {
        assert.ok(!/\p{Nd}$/u.test(first) || !/^(%|\u066a|\u0645\u0644\u064a\u0648\u0646|\u05de\u05d9\u05dc\u05d9\u05d5\u05df)/u.test(second), `${width}: ${JSON.stringify(lines)}`);
      }
      for (const line of lines) assert.ok(!startsWithClosing(line), `${width}: ${JSON.stringify(lines)}`);
    }
  }
  const lines = joinLines(wrapText(arabic, 200, SIZE));
  assert.ok(lines.some(line => line.includes('٢٦ ٪')), JSON.stringify(lines));
});

test('CJK text (no spaces) never parts a figure from its unit or starts a line with a closing mark', () => {
  const text = '増加率は26%でした。2024年に3万人が参加しました。(結果)「完了」です、ありがとう。売上は4.8億円に達しました。';
  for (const width of widths) {
    const lines = joinLines(wrapText(text, width, SIZE));
    assert.equal(lines.join(''), text, `${width}: lossless`);
    for (const line of lines) assert.ok(!startsWithClosing(line), `${width}: ${JSON.stringify(lines)}`);
    for (const [first, second] of pairs(lines)) {
      // A line that holds nothing but the figure's digits cannot do better (the figure is wider than the line).
      if (first.length > 4) assert.ok(!/\d$/.test(first) || !/^[%\u4e07\u5104\u5186\u5e74\u500b\u4eba\d.]/.test(second), `${width}: ${JSON.stringify(lines)}`);
    }
  }
});

test('lineMayStartAt names the breaks inside a word that are never taken', () => {
  assert.equal(lineMayStartAt('1234', 2), false, 'digit and digit');
  assert.equal(lineMayStartAt('4.8', 2), false, 'decimal separator and digit');
  assert.equal(lineMayStartAt('4.8', 1), false, 'digit and decimal separator');
  assert.equal(lineMayStartAt('$48', 1), false, 'currency symbol and digit');
  assert.equal(lineMayStartAt('26%', 2), false, 'figure and %');
  assert.equal(lineMayStartAt('12km', 2), false, 'figure and a unit');
  assert.equal(lineMayStartAt('12kilometres', 2), true, 'a word that merely starts like a unit');
  assert.equal(lineMayStartAt('word.', 4), false, 'before a full stop');
  assert.equal(lineMayStartAt('(word)', 5), false, 'before a closing bracket');
  assert.equal(lineMayStartAt('(word)', 1), false, 'after an opening bracket');
  assert.equal(lineMayStartAt('wordword', 4), true, 'inside plain letters');
});

test('rich text breaks by the same rule', () => {
  const runs = ['Revenue grew by ', { text: '26 %', bold: true }, ' in the last year and reached $4.8 M across 12 km of routes.'];
  for (const width of [180, 220, 260, 300]) {
    const fit = fitRichText(runs, { x: 0, y: 0, width, height: 1000 }, SIZE, SIZE);
    const lines = joinLines(fit.richLines.map(line => line.fragments.map(fragment => fragment.text).join('')));
    for (const [first, second] of pairs(lines)) {
      assert.ok(!/\d$/.test(first) || !/^(%|M|km)/.test(second), `${width}: ${JSON.stringify(lines)}`);
    }
  }
});

test('headings balance with a bound pair as one word', () => {
  const fit = fitText('Revenue grew 26 % to $4.8 M in the year across twelve of our markets', { x: 0, y: 0, width: 420, height: 400 }, SIZE, SIZE, undefined, undefined, true);
  const lines = joinLines(fit.lines);
  assert.ok(lines.length >= 2);
  for (const [first, second] of pairs(lines)) assert.ok(!/\d$/.test(first) || !/^(%|M)/.test(second), JSON.stringify(lines));
});

test('bindNoBreak writes the bound spaces as no-break spaces, and unbindNoBreak writes them back', () => {
  const bound = bindNoBreak(english);
  assert.equal(bound, english.replace('26 %', '26\u00a0%').replace('$4.8 M', '$4.8\u00a0M').replace('12 km', '12\u00a0km').replace('3 x', '3\u00a0x'));
  assert.equal(unbindNoBreak(bound), english);
  // Core reads the result the same way: the same lines.
  for (const width of widths) assert.deepEqual(wrapText(bound, width, SIZE).map(line => line.replace(/\u00a0/g, ' ')), wrapText(english, width, SIZE), String(width));
  assert.equal(bindNoBreak('plain words only'), 'plain words only');
  assert.equal(bindNoBreak('Arabic ٢٦ ٪ and Hebrew 26 מיליון'), 'Arabic ٢٦\u00a0٪ and Hebrew 26\u00a0מיליון');
  // An author's own no-break space between words is not ours to change.
  assert.equal(unbindNoBreak('Mr.\u00a0Smith'), 'Mr.\u00a0Smith');
});
