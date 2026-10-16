import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitRichText, fitText } from '../dist/composition.js';

const box = { x: 0, y: 0, width: 70, height: 500 };
const measure = (text, size) => [...text].length * size / 2;
const options = { style: { fontFamily: 'Fixture', fontWeight: 400 }, textMeasurement: { measure } };
for (const separator of ['\u00a0', '\u202f', '\u2060', '\ufeff']) {
  for (const multi of [false, true]) test(`protected U+${separator.codePointAt(0).toString(16)} fits truthfully across ${multi ? 'multiple' : 'one'} runs`, () => {
    const text = `aaaa${separator}bbbb`;
    const input = multi ? ['aa', { text: `aa${separator}`, bold: true }, { text: 'bbbb', italic: true }] : [{ text, bold: true }];
    const before = structuredClone(input);
    const plain = fitText(text, box, 20, 20, measure);
    const rich = fitRichText(input, box, 20, 20, options);
    assert.deepEqual(rich.lines, plain.lines);
    assert.deepEqual(rich.lines, [text]);
    assert.equal(rich.overflow, true);
    assert.equal(rich.fontSize, 20);
    const fragments = rich.richLines.flatMap(line => line.fragments);
    assert.equal(fragments.map(fragment => fragment.text).join(''), text);
    for (const fragment of fragments) {
      const run = input[fragment.runIndex];
      const source = typeof run === 'string' ? run : run.text;
      assert.equal(source.slice(fragment.start, fragment.end), fragment.text);
      assert.deepEqual(fragment.run, typeof run === 'string' ? { text: run } : run);
    }
    assert.deepEqual(input, before);
    const wide = fitRichText(input, { ...box, width: 100 }, 20, 20, options);
    assert.deepEqual(wide.lines, [text]);
    assert.equal(wide.overflow, false);
  });
}

test('ordinary whitespace, hanging spaces and hard newlines keep existing rich/plain behavior', () => {
  for (const text of ['aaaa bbbb', 'aaaa bbbb cccc', 'aaaa\nbbbb', 'aaaa\r\nbbbb']) {
    const plain = fitText(text, box, 20, 20, measure);
    const rich = fitRichText([{ text, bold: true }], box, 20, 20, options);
    assert.deepEqual(rich.lines, plain.lines);
    assert.equal(rich.overflow, plain.overflow);
  }
});
