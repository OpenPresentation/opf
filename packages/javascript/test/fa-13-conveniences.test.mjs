import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CODE_PANEL_BACKGROUND, CODE_SYNTAX_MIN_CONTRAST, WATERMARK_TEXT_ROTATION, codeHighlightBands, codeHighlightColors, codeHighlightLines,
  codeHighlightList, codeHighlightSlice, codeLineCount, codeLineNumbers, codeSyntaxPaletteForScheme, colorContrast, composeSlide,
  fitRichText, layoutCode, layoutWatermark, paginateSlide, resolveCanvasDimensions, validatePresentation,
} from '../dist/index.js';
import { markdownToOpf, opfToMarkdown } from '../dist/markdown.js';

const fromMarkdown = (source) => markdownToOpf(source).document;
const toMarkdown = (document) => opfToMarkdown(document).markdown;

const deck = (slides, extra = {}) => ({ name: 'D', slides, ...extra });
const issuesOf = (document, code) => validatePresentation(document).warnings.filter((issue) => issue.params.code === code);

// --- code.highlight ----------------------------------------------------------------------------------------------

test('code.highlight resolves numbers and inclusive ranges against the source', () => {
  const source = 'a\nb\nc\nd\ne\nf\ng\n';
  const result = codeHighlightLines([3, [5, 7]], source);
  assert.equal(result.lineCount, 7, 'a trailing line break does not start a line');
  assert.deepEqual(result.lines, [3, 5, 6, 7]);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(codeHighlightList([3, 5, 6, 7]), [3, [5, 7]]);
  assert.equal(codeLineCount('x'), 1);
  assert.equal(codeLineCount('x\r\ny\rz'), 3);
  assert.equal(codeLineCount(''), 1);
});

test('code.highlight reports out-of-range, reversed and invalid entries and ignores them', () => {
  const result = codeHighlightLines([2, 9, [3, 12], [6, 4], 'x', [1, 2, 3]], 'a\nb\nc\nd');
  assert.deepEqual(result.lines, [2, 3, 4]);
  assert.deepEqual(result.issues.map((issue) => [issue.code, issue.index]), [
    ['code-highlight-out-of-range', 1], ['code-highlight-out-of-range', 2], ['code-highlight-range-reversed', 3],
    ['code-highlight-invalid', 4], ['code-highlight-invalid', 5],
  ]);
});

test('a wrapped source line keeps one number and one band', () => {
  // A boundary says how a displayed line ends: 'soft' wraps into the next displayed line of the same source line.
  const sourceLines = [{ boundary: 'soft' }, { boundary: 'soft' }, { boundary: 'hard' }, { boundary: 'hard' }, { boundary: 'hard' }, { boundary: 'end' }];
  assert.deepEqual(codeLineNumbers(sourceLines), [1, 1, 1, 2, 3, 4]);
  assert.deepEqual(codeHighlightBands(sourceLines, [1, 3, 4]), [{ first: 0, last: 2 }, { first: 4, last: 5 }]);
  assert.deepEqual(codeHighlightBands(sourceLines, []), []);
});

test('highlight colours keep 4.5:1 on the band (marked) and on the panel (dimmed), for every theme', () => {
  const schemes = [{}, { primary: '#2563EB' }, { primary: '#F59E0B' }, { primary: '#111111' }, { primary: '#FFFFFF' }, { primary: '#10B981', accent: '#EF4444' }];
  for (const scheme of schemes) {
    const colors = codeHighlightColors(scheme);
    for (const [name, color] of Object.entries(colors.lit)) {
      assert.ok(colorContrast(color, colors.band) >= CODE_SYNTAX_MIN_CONTRAST, `${JSON.stringify(scheme)} lit ${name} ${color} on ${colors.band}`);
    }
    for (const [name, color] of Object.entries(colors.dim)) {
      assert.ok(colorContrast(color, CODE_PANEL_BACKGROUND) >= CODE_SYNTAX_MIN_CONTRAST, `${JSON.stringify(scheme)} dim ${name} ${color}`);
    }
    assert.notEqual(colors.band.toUpperCase(), CODE_PANEL_BACKGROUND, 'the band differs from the panel');
    const palette = codeSyntaxPaletteForScheme(scheme);
    assert.notEqual(colors.dim.plain, palette.plain, 'unmarked lines are dimmed');
  }
});

test('the band colour follows the theme and is deterministic', () => {
  const blue = codeHighlightColors({ primary: '#2563EB' }), amber = codeHighlightColors({ primary: '#F59E0B' });
  assert.notEqual(blue.band, amber.band);
  assert.deepEqual(codeHighlightColors({ primary: '#2563EB' }), blue);
});

test('slicing a code block keeps the marked lines of the page, renumbered', () => {
  const source = 'l1\nl2\nl3\nl4\nl5\nl6';
  const second = source.indexOf('l4');
  assert.deepEqual(codeHighlightSlice([2, [4, 5]], source, 0, second), [2]);
  assert.deepEqual(codeHighlightSlice([2, [4, 5]], source, second, source.length), [[1, 2]]);
  assert.equal(codeHighlightSlice([1], source, second, source.length), undefined);
  // A page that starts inside a line keeps that line's number for its first line.
  assert.deepEqual(codeHighlightSlice([4], source, source.indexOf('l4') + 1, source.length), [1]);
});

test('validation: schema accepts highlight; warnings name the entry', () => {
  const document = deck([{ title: 'Code', code: { source: 'a\nb\nc', language: 'ts', highlight: [1, [2, 3]] } }]);
  const ok = validatePresentation(document);
  assert.equal(ok.valid, true, JSON.stringify(ok.errors));
  assert.deepEqual(ok.warnings.filter((issue) => /^code-highlight/.test(issue.params.code ?? '')), []);

  const bad = deck([{ title: 'Code', code: { source: 'a\nb\nc', highlight: [2, 7, [3, 1]] } }]);
  const result = validatePresentation(bad);
  assert.equal(result.valid, true);
  assert.deepEqual(issuesOf(bad, 'code-highlight-out-of-range').map((issue) => issue.path), ['/slides/0/code/highlight/1']);
  assert.deepEqual(issuesOf(bad, 'code-highlight-range-reversed').map((issue) => issue.path), ['/slides/0/code/highlight/2']);

  const nested = deck([{ title: 'T', layout: 'two-column', blocks: [{ code: { source: 'one', highlight: [4] } }] }]);
  assert.equal(issuesOf(nested, 'code-highlight-out-of-range').length, 1, 'blocks are checked too');

  for (const highlight of [[], [0], [1.5], [[1]], [[1, 2, 3]], 'x']) {
    assert.equal(validatePresentation(deck([{ title: 'C', code: { source: 'a', highlight } }])).valid, false, JSON.stringify(highlight));
  }
});

test('pagination keeps each page\'s marked lines', () => {
  const source = Array.from({ length: 80 }, (_, index) => `line ${index + 1}`).join('\n');
  const slide = { title: 'Long', code: { source, highlight: [3, [40, 42], 78] } };
  const pages = paginateSlide(slide, { width: 1280, height: 720 }).slides;
  assert.ok(pages.length > 1, 'the code needs more than one slide');
  const marked = new Set();
  for (const page of pages) {
    const code = page.code ?? page.blocks?.find((block) => block.code)?.code;
    const rows = code.source.split('\n');
    for (const line of codeHighlightLines(code.highlight, code.source).lines) marked.add(rows[line - 1]);
  }
  // Whatever page a marked line lands on, the same source lines stay marked and no other line becomes marked.
  assert.deepEqual([...marked].filter(Boolean).sort(), ['line 3', 'line 40', 'line 41', 'line 42', 'line 78'].sort());
});

test('layoutCode and composeSlide leave the code geometry unchanged by highlight', () => {
  const plain = layoutCode({ source: 'a\nb\nc', language: 'ts' }, { x: 0, y: 0, width: 600, height: 300 });
  const marked = layoutCode({ source: 'a\nb\nc', language: 'ts', highlight: [2] }, { x: 0, y: 0, width: 600, height: 300 });
  assert.deepEqual(marked, plain);
  const a = composeSlide({ title: 'T', code: { source: 'a\nb', language: 'ts' } }, { width: 1280, height: 720 });
  const b = composeSlide({ title: 'T', code: { source: 'a\nb', language: 'ts', highlight: [1] } }, { width: 1280, height: 720 });
  assert.deepEqual(b.items.map((item) => item.box), a.items.map((item) => item.box));
});

// --- Watermark.text ----------------------------------------------------------------------------------------------

test('Watermark takes exactly one of src and text', () => {
  const valid = (watermark) => validatePresentation(deck([{ title: 'T' }], { design: { watermark } })).valid;
  assert.equal(valid({ text: 'DRAFT', opacity: 0.1 }), true);
  assert.equal(valid({ src: 'asset:w', opacity: 0.1 }), true);
  assert.equal(valid('asset:w'), true);
  assert.equal(valid({ text: 'DRAFT', src: 'asset:w', opacity: 0.1 }), false, 'both');
  assert.equal(valid({ opacity: 0.1 }), false, 'neither');
  assert.equal(valid({ text: '', opacity: 0.1 }), false, 'empty text');
  assert.equal(valid({ text: 'DRAFT' }), false, 'opacity is required');
  assert.equal(validatePresentation(deck([{ title: 'T', design: { watermark: { text: 'CONFIDENTIAL', opacity: 0.08 } } }])).valid, true, 'slide level');
});

test('a text watermark is centered, diagonal and inside every preset', () => {
  for (const preset of ['16:9', '4:3', '16:10', '1:1', '4:5', '9:16', 'letter', 'a4']) {
    const { width, height } = resolveCanvasDimensions(preset);
    for (const text of ['DRAFT', 'CONFIDENTIAL', 'Internal use only - do not distribute']) {
      const layout = layoutWatermark(text, { width, height });
      assert.equal(layout.rotation, WATERMARK_TEXT_ROTATION);
      assert.ok(layout.textWidth <= width * 0.7 + 0.01, `${preset} ${text} width`);
      assert.ok(layout.fontSize <= Math.min(width, height) * 0.3 + 0.01);
      const { box } = layout, cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      assert.ok(Math.abs(cx - width / 2) < 0.01 && Math.abs(cy - height / 2) < 0.01, 'centered');
      // The rotated box stays on the slide.
      const radians = Math.abs(layout.rotation) * Math.PI / 180;
      const rotatedWidth = box.width * Math.cos(radians) + box.height * Math.sin(radians), rotatedHeight = box.width * Math.sin(radians) + box.height * Math.cos(radians);
      assert.ok(rotatedWidth <= width + 0.01 && rotatedHeight <= height + 0.01, `${preset} ${text} fits (${rotatedWidth.toFixed(0)}x${rotatedHeight.toFixed(0)} in ${width}x${height})`);
    }
  }
  assert.equal(layoutWatermark('  \n ', { width: 100, height: 100 }), undefined);
  assert.equal(layoutWatermark('A\nB', { width: 1000, height: 500 }).text, 'A B');
});

// --- TextRun.code and TextRun.lang -------------------------------------------------------------------------------

test('a code run takes the code family; its own fontFamily wins; lang reaches the fragment style', () => {
  const runs = ['See ', { text: 'npm i', code: true }, ' and ', { text: 'x', code: true, fontFamily: 'Courier New' }, { text: ' bonjour', lang: 'fr-FR' }];
  const fit = fitRichText(runs, { x: 0, y: 0, width: 900, height: 200 }, 24, 12, { style: { fontFamily: 'Aptos', fontWeight: 400 }, codeFontFamily: 'Consolas' });
  const families = fit.richLines.flatMap((line) => line.fragments).map((fragment) => [fragment.text, fragment.style.fontFamily, fragment.style.lang]);
  assert.deepEqual(families, [['See ', 'Aptos', undefined], ['npm i', 'Consolas', undefined], [' and ', 'Aptos', undefined], ['x', 'Courier New', undefined], [' bonjour', 'Aptos', 'fr-FR']]);
  const without = fitRichText(['a ', { text: 'b', code: true }], { x: 0, y: 0, width: 900, height: 200 }, 24, 12, { style: { fontFamily: 'Aptos', fontWeight: 400 } });
  assert.equal(without.richLines[0].fragments[1].style.fontFamily, 'monospace');
});

test('composeSlide measures an inline code run in the design code font', () => {
  const slide = { title: 'T', text: ['Run ', { text: 'pnpm install', code: true }] };
  const composed = composeSlide(slide, { width: 1280, height: 720, fonts: { heading: 'Aptos Display', body: 'Aptos', code: 'Consolas' } });
  const text = composed.items.find((item) => item.field === 'text');
  const fragments = text.text.richLines.flatMap((line) => line.fragments);
  assert.equal(fragments.find((fragment) => fragment.text === 'pnpm install').style.fontFamily, 'Consolas');
  assert.equal(fragments.find((fragment) => fragment.text === 'Run ').style.fontFamily, 'Aptos');
});

test('TextRun schema: code is boolean, lang is a BCP-47 tag', () => {
  const valid = (run) => validatePresentation(deck([{ title: 'T', text: [run] }])).valid;
  assert.equal(valid({ text: 'x', code: true }), true);
  assert.equal(valid({ text: 'x', code: 'yes' }), false);
  assert.equal(valid({ text: 'x', lang: 'fr-FR' }), true);
  assert.equal(valid({ text: 'x', lang: 'zh-Hant-TW' }), true);
  assert.equal(valid({ text: 'x', lang: 'not a tag' }), false);
  assert.equal(valid({ text: 'x', lang: '' }), false);
});

test('markdown reads and writes inline code in both directions', () => {
  const doc = fromMarkdown('# T\n\nRun `pnpm install` now, **`bold code`**, and ``a ` b`` too.\n');
  const slide = doc.slides[0];
  assert.deepEqual(slide.text, ['Run ', { text: 'pnpm install', code: true }, ' now, ', { text: 'bold code', bold: true, code: true }, ', and ', { text: 'a ` b', code: true }, ' too.']);
  const markdown = toMarkdown(doc);
  assert.ok(markdown.includes('Run `pnpm install` now, **`bold code`**, and ``a ` b`` too.'), markdown);
  assert.deepEqual(fromMarkdown(markdown).slides[0].text, slide.text);
});

test('markdown: an unmatched backtick and an escaped backtick stay text; text with backticks round-trips', () => {
  assert.equal(fromMarkdown('# T\n\nA lone ` tick.\n').slides[0].text, 'A lone ` tick.');
  const doc = fromMarkdown('# T\n\nUse \\`literal\\` ticks.\n');
  assert.equal(doc.slides[0].text, 'Use `literal` ticks.');
  const again = fromMarkdown(toMarkdown(doc));
  assert.equal(again.slides[0].text, doc.slides[0].text);
  // Padding rules: a span that begins or ends with a backtick or space.
  const tricky = { slides: [{ title: 'T', text: [{ text: '`x', code: true }, ' ', { text: ' y ', code: true }, ' ', { text: 'z`', code: true }] }] };
  const back = fromMarkdown(toMarkdown(tricky)).slides[0].text;
  assert.deepEqual(back, tricky.slides[0].text);
});

test('markdown: a code span in a title keeps its backticks as text', () => {
  const doc = fromMarkdown('# The `foo` API\n\nBody\n');
  assert.equal(doc.slides[0].title, 'The `foo` API');
});

test('markdown: lang is a span attribute and round-trips', () => {
  const doc = fromMarkdown('# T\n\nHello [bonjour]{lang=fr-FR} you.\n');
  assert.deepEqual(doc.slides[0].text, ['Hello ', { text: 'bonjour', lang: 'fr-FR' }, ' you.']);
  assert.deepEqual(fromMarkdown(toMarkdown(doc)).slides[0].text, doc.slides[0].text);
});

test('markdown: a code run holding a line break has no native form and does not corrupt the deck', () => {
  const doc = { slides: [{ title: 'T', text: [{ text: 'a\nb', code: true }] }] };
  const back = fromMarkdown(toMarkdown(doc));
  assert.equal(JSON.stringify(back.slides[0].text).includes('a'), true);
});

// --- presets -----------------------------------------------------------------------------------------------------

test('the 1:1, 4:5 and 9:16 presets keep the 7.5 in short edge', () => {
  const inches = (preset) => { const { width, height } = resolveCanvasDimensions(preset); return [width / 96, height / 96]; };
  assert.deepEqual(inches('1:1'), [7.5, 7.5]);
  assert.deepEqual(inches('4:5'), [7.5, 9.375]);
  const [w, h] = inches('9:16');
  assert.equal(w, 7.5);
  assert.ok(Math.abs(h - 40 / 3) < 1e-9);
  assert.deepEqual(inches({ preset: '4:5' }), [7.5, 9.375]);
  assert.deepEqual(inches({ preset: '1:1', widthInches: 5 }), [5, 7.5], 'explicit inches still win');
  for (const preset of ['1:1', '4:5', '9:16']) {
    assert.equal(validatePresentation(deck([{ title: 'T' }], { design: { dimensions: preset } })).valid, true, preset);
    assert.equal(validatePresentation(deck([{ title: 'T' }], { design: { dimensions: { preset } } })).valid, true, preset);
  }
});
