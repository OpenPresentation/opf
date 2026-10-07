// FA-10: rich headline text. `title`, `subtitle`, `tag` and `quote.text` accept string | TextRun[]: schema, composition,
// citation numbering (heading group first), variables, audit and pagination. A string keeps its exact geometry.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveVariables } from '../dist/index.js';
import { collectCitations, composeSlide, fitRichText, layoutQuote } from '../dist/composition.js';
import { paginateSlide } from '../dist/pagination.js';
import { check, errorsOf, warningsOf } from './support/validation.mjs';
import { validate } from '../dist/index.js';

const references = [{ id: 'r1', text: 'Annual report' }, { id: 'r2', text: 'Survey' }];
const accent = (text, extra = {}) => ({ text, color: 'accent1', ...extra });
const compose = (slide, presentation = { slides: [slide], references }, extra = {}) => composeSlide(slide, { presentation, slideIndex: 0, layout: { id: 'blank' }, ...extra });
const item = (composition, field) => composition.items.find(entry => entry.field === field);

describe('schema', () => {
  test('title, subtitle, tag and quote text accept strings and TextRun[]', () => {
    const slide = { title: ['Revenue grew ', accent('28%')], subtitle: [{ text: 'bold', bold: true }], tag: ['Q3 ', { text: 'review', italic: true }], quote: { text: ['A ', { text: 'quote', cite: 'r1' }] } };
    const result = check({ references, slides: [slide] });
    assert.deepEqual(errorsOf(result), []);
    assert.equal(check({ slides: [{ title: 'Plain', subtitle: 'Plain', tag: 'Plain', quote: { text: 'Plain' } }] }).valid, true);
  });
  test('a heading that is neither a string nor runs is rejected', () => {
    assert.equal(check({ slides: [{ title: 5 }] }).valid, false);
    assert.equal(check({ slides: [{ title: [5] }] }).valid, false);
    assert.equal(check({ slides: [{ quote: { text: { text: 'x' } } }] }).valid, false);
  });
  test('cite ids in headings and quotes are checked against the references', () => {
    const result = check({ references, slides: [{ title: [{ text: 'x', cite: 'nope' }], quote: { text: [{ text: 'y', cite: 'nope2' }] } }] });
    assert.deepEqual(errorsOf(result).map(error => `${error.ruleId} ${error.path}`).sort(), ['opf/cite-unknown-reference /slides/0/quote/text/0/cite', 'opf/cite-unknown-reference /slides/0/title/0/cite']);
  });
});

describe('composition', () => {
  test('a rich title composes through the rich-text layouter and keeps the title role', () => {
    const slide = { title: ['Revenue grew ', accent('28%')] };
    const title = item(compose(slide), 'title');
    assert.ok(title.text.richLines, 'a TextRun[] title reports rich lines');
    const fragments = title.text.richLines.flatMap(line => line.fragments);
    assert.equal(fragments.map(fragment => fragment.text).join(''), 'Revenue grew 28%');
    assert.equal(fragments.find(fragment => fragment.text === '28%').run.color, 'accent1');
    assert.ok(fragments.every(fragment => fragment.style.fontWeight === 700), 'the heading weight is the default for every run');
    assert.equal(title.value.length, 2);
  });
  test('a title of one plain run lays out exactly like the string', () => {
    const plain = item(compose({ title: 'A longer headline that will need to wrap across lines at the shrink size' }), 'title');
    const rich = item(compose({ title: ['A longer headline that will need to wrap across lines ', 'at the shrink size'] }), 'title');
    assert.equal(rich.text.fontSize, plain.text.fontSize);
    assert.deepEqual(rich.text.lines, plain.text.lines);
    assert.equal(rich.box.height, plain.box.height);
  });
  test('rich runs shrink and wrap with the same floor as a string', () => {
    const long = 'word '.repeat(80), size = { width: 640, height: 360 };
    const rich = compose({ title: [accent(long)] }, undefined, size), plain = compose({ title: long }, undefined, size);
    assert.ok(item(rich, 'title').text.richLines.length > 1);
    assert.equal(item(rich, 'title').text.fontSize, item(plain, 'title').text.fontSize);
    assert.deepEqual(rich.diagnostics.map(diagnostic => diagnostic.code), plain.diagnostics.map(diagnostic => diagnostic.code));
  });
  test('an empty run array draws nothing', () => {
    assert.equal(item(compose({ title: [], text: 'Body' }), 'title'), undefined);
  });
  test('strings keep their geometry: no rich lines on string headings', () => {
    const composition = compose({ tag: 'T', title: 'Title', subtitle: 'Sub', text: 'Body' });
    for (const field of ['tag', 'title', 'subtitle']) assert.equal(item(composition, field).text.richLines, undefined);
  });
});

describe('citations in headings', () => {
  const deck = {
    references,
    slides: [{
      tag: [{ text: 'Tag', footnote: 'Tag note' }],
      title: ['Claim', { text: ' one', cite: 'r2' }],
      subtitle: [{ text: 'Sub', cite: ['r1', 'r2'] }],
      text: [{ text: 'Body', cite: 'r1' }],
      quote: undefined,
    }],
  };
  delete deck.slides[0].quote;
  test('numbering follows reading order: tag, title, subtitle, then the body', () => {
    const slide = collectCitations(deck).slides.get(0);
    assert.deepEqual(slide.marked.map(marker => [marker.path, marker.text]), [
      ['slides.0.tag.0', '1'], ['slides.0.title.1', '2'], ['slides.0.subtitle.0', '3,2'], ['slides.0.text.0', '3']]);
    // r2 cites first on the title (number 2), r1 first on the subtitle (3); a later use keeps the number.
    assert.deepEqual(slide.notes.map(note => [note.number, note.kind, note.id]), [[1, 'footnote', undefined], [2, 'reference', 'r2'], [3, 'reference', 'r1']]);
  });
  test('heading markers are drawn after their run and the slide gets a footnote area', () => {
    const composition = compose(deck.slides[0], deck);
    const title = item(composition, 'title');
    const marker = title.text.richLines.flatMap(line => line.fragments).find(fragment => fragment.kind === 'marker');
    assert.ok(marker && marker.text.length > 0);
    assert.ok(composition.footnotes, 'a cited heading reserves the footnote area');
    assert.equal(composition.footnotes.entries.length, 3);
  });
  test('a deck without heading markers has no footnote area', () => {
    assert.equal(compose({ title: ['Plain ', accent('x')] }).footnotes, undefined);
  });
});

describe('quote text', () => {
  const box = { x: 0, y: 0, width: 800, height: 400 };
  test('layoutQuote fits a rich body through the rich-text layouter and joins the quotation marks to the end runs', () => {
    const layout = layoutQuote({ text: ['Cut review time by ', { text: '40%', bold: true }, ' in a quarter'], attribution: 'Ada' }, box, { path: 'slides.0.quote' });
    const body = layout.parts[0];
    assert.equal(body.text, '"Cut review time by 40% in a quarter"');
    assert.equal(body.runs.length, 3, 'run indexes do not shift');
    assert.equal(body.runs[0], '"Cut review time by ');
    assert.equal(body.runs[2], ' in a quarter"');
    assert.ok(body.fit.richLines);
    assert.equal(body.sources[0].path, 'slides.0.quote.text');
    assert.equal(layout.overflow, false);
    assert.equal(layout.parts[1].fit.richLines, undefined, 'the footer stays plain');
  });
  test('a plain quote is unchanged: no runs, a plain fit', () => {
    const layout = layoutQuote({ text: 'Plain', attribution: 'Ada' }, box);
    assert.equal(layout.parts[0].runs, undefined);
    assert.equal(layout.parts[0].fit.richLines, undefined);
  });
  test('composeSlide numbers a quote citation with the deck and draws the marker in the body', () => {
    const slide = { title: 'Voices', quote: { text: ['We grew ', { text: 'fast', cite: 'r1' }] } };
    const composition = compose(slide);
    const quote = item(composition, 'quote');
    const marker = quote.text.richLines.flatMap(line => line.fragments).find(fragment => fragment.kind === 'marker');
    assert.equal(marker.text, '1');
    assert.ok(composition.footnotes);
  });
  test('a rich quote in a block validates and composes', () => {
    const slide = { blocks: [{ quote: { text: [accent('Hi')] } }, { text: 'x' }] };
    assert.equal(check({ slides: [slide] }).valid, true);
    assert.ok(item(compose(slide), 'quote').quoteLayout.parts[0].runs);
  });
});

describe('variables', () => {
  test('a whole-field reference keeps the runs in a heading and tokens inside runs resolve', () => {
    const runs = [{ text: 'Grew ', bold: true }, accent('28%')];
    const document = { variables: { headline: { type: 'text', value: runs }, client: { type: 'text', value: 'Acme' } }, slides: [{ title: 'var:headline', subtitle: [{ text: 'For {{client}}', italic: true }], quote: { text: 'var:headline' } }] };
    const { presentation } = resolveVariables(document);
    assert.deepEqual(presentation.slides[0].title, runs);
    assert.deepEqual(presentation.slides[0].subtitle, [{ text: 'For Acme', italic: true }]);
    assert.deepEqual(presentation.slides[0].quote.text, runs);
    assert.equal(check(presentation).valid, true);
  });
});

describe('audit', () => {
  const white = { background: { type: 'solid', color: '#FFFFFF' } };
  const only = (slides, rule) => validate({ name: 'x', language: 'en-US', design: white, slides }, { only: [rule] }).findings;
  test('text-contrast checks each heading run color', () => {
    const found = only([{ title: ['Readable ', { text: 'pale', color: '#EEEEEE' }] }], 'text-contrast');
    assert.ok(found.some(diagnostic => diagnostic.path === '/slides/0/title/1/color'), JSON.stringify(found.map(d => d.path)));
    assert.equal(only([{ title: ['Readable ', { text: 'dark', color: '#222222' }] }], 'text-contrast').length, 0);
    assert.ok(only([{ title: 'T', quote: { text: [{ text: 'pale', color: '#EEEEEE' }] } }], 'text-contrast').some(diagnostic => diagnostic.path === '/slides/0/quote/text/0/color'));
  });
  test('a title of runs counts as a title and compares by plain text', () => {
    assert.equal(only([{ title: ['Has ', 'title'], text: 'x' }], 'missing-slide-title').length, 0);
    assert.equal(only([{ title: [{ text: '  ' }], text: 'x' }], 'missing-slide-title').length, 1);
    const duplicates = only([{ title: 'Same title', text: 'a' }, { title: ['Same ', { text: 'title', bold: true }], text: 'b' }], 'duplicate-slide-title');
    assert.equal(duplicates.length, 1);
  });
  test('poor link text is found in a heading run', () => {
    const found = only([{ title: [{ text: 'click here', link: 'https://example.com' }] }], 'link-text');
    assert.equal(found.length, 1);
  });
});

describe('pagination', () => {
  test('a long rich quote paginates by text offset and keeps each run formatting', () => {
    const runs = Array.from({ length: 40 }, (_, index) => (index % 2 ? { text: `bold sentence ${index}. `, bold: true } : `Plain sentence number ${index}. `));
    const slide = { title: 'Quote', quote: { text: runs, attribution: 'Ada' }, composition: { minFontSize: 28 } };
    const result = paginateSlide(slide, { width: 640, height: 360, presentation: { slides: [slide] } });
    assert.ok(result.slides.length > 1);
    const text = result.slides.map(page => (page.quote.text ?? []).map(run => (typeof run === 'string' ? run : run.text)).join('')).join('');
    assert.equal(text, runs.map(run => (typeof run === 'string' ? run : run.text)).join(''));
    assert.ok(result.slides[0].quote.text.some(run => run.bold === true));
  });
});

test('fitRichText stays the public rich fitter for headings', () => {
  const fit = fitRichText(['A ', accent('b')], { x: 0, y: 0, width: 400, height: 100 });
  assert.ok(fit.richLines.length >= 1);
});
