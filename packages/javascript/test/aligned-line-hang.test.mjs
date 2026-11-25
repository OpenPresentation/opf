// The whitespace that ends a soft-wrapped line hangs at the wrap: core records its advance (`hang`) and the advance of the whole line
// with it (`advance`) on the line, and placeTextLines aligns the line by its glyphs, so an end-aligned line's glyphs end on the box edge
// and a centered line's are centered. The line's text, source range and `width` are unchanged; start-aligned lines do not move.
import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {composeSlide, fitRichText, fitText, placeTextLines} from '../dist/composition.js';

// Every character is 10 wide, so widths are exact.
const measure = text => [...text].length * 10;
const box = {x: 0, y: 0, width: 85, height: 1000};
const fit = (text, width = 85, direction) => fitText(text, {...box, width}, 20, 20, measure, direction);
const lines = result => result.sourceLines.map(line => ({text: result.lines[result.sourceLines.indexOf(line)], width: line.width, hang: line.hang, advance: line.advance}));

describe('the whitespace that hangs at a soft wrap', () => {
  test('a space that fits is counted in width and recorded as hanging', () => {
    assert.deepEqual(lines(fit('aaa bbb ccc')), [
      {text: 'aaa bbb ', width: 80, hang: 10, advance: 80},
      {text: 'ccc', width: 30, hang: undefined, advance: undefined},
    ]);
  });
  test('a space that does not fit (RR-17) keeps width without it; advance includes it', () => {
    assert.deepEqual(lines(fit('aaa bbb ccc', 75))[0], {text: 'aaa bbb ', width: 70, hang: 10, advance: 80});
  });
  test('several spaces, a tab and a Unicode space all hang', () => {
    assert.deepEqual(lines(fit('aaa bbb   ccc', 85))[0], {text: 'aaa bbb   ', width: 70, hang: 30, advance: 100});
    // A tab advances to the next multiple of four spaces (40): from 70 to 80.
    assert.deepEqual(lines(fit('aaa bbb\tccc', 85))[0], {text: 'aaa bbb\t', width: 80, hang: 10, advance: 80});
    assert.deepEqual(lines(fit('aaa bbb ccc', 85))[0], {text: 'aaa bbb ', width: 80, hang: 10, advance: 80});
  });
  test('a line broken inside a long word, a hard break and the end of the text do not hang', () => {
    for (const line of fit('aaaaaaaaaaaaaaaaaaaa', 85).sourceLines) assert.equal(line.hang, undefined);
    const hard = fit('aaa \nbbb ccc ', 85);
    assert.equal(hard.sourceLines[0].boundary, 'hard');
    assert.equal(hard.sourceLines[0].hang, undefined, 'a space typed before a line break stays in the line');
    assert.equal(hard.sourceLines.at(-1).boundary, 'end');
    assert.equal(hard.sourceLines.at(-1).hang, undefined, 'a space typed at the end of the text stays in the line');
  });
  test('a no-break space never hangs: it is not a break opportunity', () => {
    const result = fit('aaa bbb ccc', 85);
    assert.equal(result.lines[0], 'aaa bbb ');
    assert.equal(result.sourceLines[0].hang, 10, 'only the breaking space after it hangs');
  });
  test('a line drawn right to left keeps its whitespace; a left-to-right line of a right-to-left deck hangs it', () => {
    const rtl = fit('אאא בבב גגג', 85, 'rtl');
    assert.deepEqual(rtl.directions, ['rtl', 'rtl']);
    assert.equal(rtl.sourceLines[0].hang, undefined);
    const ltr = fit('aaa bbb ccc', 85, 'rtl');
    assert.deepEqual(ltr.directions, ['ltr', 'ltr']);
    assert.equal(ltr.sourceLines[0].hang, 10);
  });
  test('rich text records the hang across runs, and not before a hard break', () => {
    const textMeasurement = {measure};
    const rich = fitRichText(['aaa ', {text: 'bbb ', bold: true}, 'ccc'], {...box, width: 85}, 20, 20, {style: {fontFamily: 'Host', fontWeight: 400}, textMeasurement});
    assert.deepEqual(rich.lines, ['aaa bbb ', 'ccc']);
    assert.equal(rich.richLines[0].hang, 10);
    assert.equal(rich.richLines[0].advance, 80);
    assert.equal(rich.richLines[0].width, 80);
    assert.equal(rich.richLines[1].hang, undefined);
    const hard = fitRichText(['aaa \nbbb'], {...box, width: 85}, 20, 20, {style: {fontFamily: 'Host', fontWeight: 400}, textMeasurement});
    assert.equal(hard.richLines[0].hang, undefined);
  });
});

describe('placeTextLines aligns a line by its glyphs', () => {
  const area = {x: 10, y: 0, width: 100, height: 100};
  const hung = {width: 80, hang: 10, advance: 80, y: 0, baseline: 20, height: 25, outline: null};
  const plain = {width: 70, y: 25, baseline: 45, height: 25, outline: null};
  test('end aligned: the glyphs end on the edge, the anchor is past it by the hang', () => {
    const [line, other] = placeTextLines([hung, plain], area, 'right').lines;
    assert.equal(line.x, 40);
    assert.equal(line.width, 80);
    assert.equal(line.hang, 10);
    assert.equal(line.x + line.width - line.hang, 110, 'glyphs end on the box edge');
    assert.equal(line.x + line.width, 120, 'the text with its whitespace is anchored past the edge');
    assert.equal(other.x + other.width, 110);
  });
  test('centered: the glyphs are centered, the anchor is half the hang past the center', () => {
    const [line] = placeTextLines([hung], area, 'center').lines;
    assert.equal(line.x + (line.width - line.hang) / 2, 60);
    assert.equal(line.x + line.width / 2, 65);
  });
  test('start aligned: unchanged', () => {
    const [line] = placeTextLines([hung], area, 'left').lines;
    assert.equal(line.x, 10);
    assert.equal(line.width, 80);
  });
  test('RR-17 line: the advance includes the whitespace its width leaves out', () => {
    const [line] = placeTextLines([{...hung, width: 70}], area, 'right').lines;
    assert.equal(line.x, 40);
    assert.equal(line.width, 80);
    assert.equal(placeTextLines([{...hung, width: 70}], area, 'left').lines[0].width, 80, 'the text, its whitespace included, is 80 wide');
  });
  test('a right-to-left line is placed by its width, as before', () => {
    const [line] = placeTextLines([hung], area, 'left', 0, ['rtl']).lines;
    assert.equal(line.alignment, 'right');
    assert.equal(line.x, 30);
    assert.equal(line.width, 80);
    assert.equal(line.hang, undefined);
  });
  test('a line without a hang is placed as before', () => {
    assert.deepEqual(placeTextLines([plain], area, 'right').lines[0], {x: 40, y: 25, baseline: 45, height: 25, width: 70, outline: null});
  });
});

describe('composition', () => {
  // Proportional measurement with outlines: the ink of a text is its glyphs, never its spaces.
  const textMeasurement = {
    measure: (text, size) => text.length * size * .5,
    outlineBounds: (text, size) => text.trim() ? {x: (text.length - text.trimStart().length) * size * .5, y: -size * .8, width: text.trim().length * size * .5, height: size} : null,
  };
  const heading = 'Scale the pilot to four teams in January and keep every team on the same plan.';
  for (const [alignment, factor] of [['end', 1], ['center', .5]]) {
    test(`a wrapped ${alignment}-aligned title is flush by its glyphs`, () => {
      const result = composeSlide({title: heading, text: 'Body.', design: {titleAlignment: alignment}}, {textMeasurement});
      const title = result.items.find(item => item.field === 'title'), placed = title.text.placement.lines;
      assert.ok(placed.length > 1, 'the title wraps');
      assert.ok(placed.some(line => line.hang > 0), 'a line ends in a hanging space');
      const anchors = placed.map(line => line.x + (line.width - (line.hang ?? 0)) * factor);
      for (const anchor of anchors) assert.ok(Math.abs(anchor - anchors.at(-1)) < 1e-6, `every line's glyphs share one ${alignment} anchor (${anchors})`);
    });
  }
  test('a wrapped start-aligned title starts every line at the box edge, as before', () => {
    const result = composeSlide({title: heading, text: 'Body.', design: {titleAlignment: 'start'}}, {textMeasurement});
    const title = result.items.find(item => item.field === 'title');
    for (const line of title.text.placement.lines) assert.equal(line.x, title.text.placement.lines[0].x);
  });
});
