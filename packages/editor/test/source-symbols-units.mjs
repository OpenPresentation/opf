// The outline of a document (src/source-symbols.js): slides, sections and records in JSON, YAML and Markdown, also from text that does not parse.
import assert from 'node:assert/strict';
import test from 'node:test';
import { documentSymbols, filterSymbols, symbolAt } from '../src/source-symbols.js';

const labels = (symbols) => symbols.map((symbol) => symbol.label);
const slice = (text, symbol) => text.slice(symbol.from, symbol.to);

test('JSON: slides numbered by position, titles from strings and runs, ranges of the slide objects', () => {
  const text = '{"name": "d", "assets": {"logo": "a.png"}, "slides": [{"title": "A", "layout": "cover"}, {"title": [{"text": "B "}, {"text": "b"}]}, {"text": "x"}]}';
  const symbols = documentSymbols('json', text);
  assert.deepEqual(labels(symbols), ['assets', 'logo', '1. A', '2. B b', '3. Untitled slide']);
  assert.deepEqual(symbols.map((symbol) => symbol.kind), ['section', 'asset', 'slide', 'slide', 'slide']);
  assert.equal(symbols[2].detail, 'layout cover');
  assert.equal(slice(text, symbols[2]), '{"title": "A", "layout": "cover"}');
  assert.equal(symbols[1].depth, 1);
});

test('JSON: records of embedded catalogs, references, datasets and variables', () => {
  const text = JSON.stringify({ catalogs: { custom: { layouts: { hero: {} }, themes: { dark: {} } }, acme: { layouts: { pillars: {} } } }, references: [{ id: 'r1', text: 'A paper' }], datasets: { sales: { title: 'Sales', columns: [] } }, variables: { client: { type: 'text' } }, design: {}, slides: [] });
  const symbols = documentSymbols('json', text);
  assert.ok(labels(symbols).includes('layout hero'));
  assert.ok(labels(symbols).includes('theme dark'));
  assert.equal(symbols.find((symbol) => symbol.label === 'layout pillars').detail, 'acme');
  assert.equal(symbols.find((symbol) => symbol.label === 'layout hero').detail, 'this document');
  assert.ok(labels(symbols).includes('r1') && labels(symbols).includes('sales') && labels(symbols).includes('client') && labels(symbols).includes('design'));
  assert.equal(symbols.find((symbol) => symbol.label === 'sales').detail, 'Sales');
});

test('JSON: broken text still gives the slides it can read', () => {
  const symbols = documentSymbols('json', '{"slides": [{"title": "A",\n {"title": "B"}\n]');
  assert.ok(symbols.length >= 1 && symbols.every((symbol) => symbol.from <= symbol.to));
  assert.deepEqual(documentSymbols('json', ''), []);
  assert.deepEqual(documentSymbols('json', 'not json at all'), []);
});

test('YAML: slide mappings without their trailing line break; runs in titles', () => {
  const text = 'assets:\n  logo: a.png\nslides:\n  - title: A\n    layout: cover\n  - title:\n      - text: B\n      - text: " b"\n';
  const symbols = documentSymbols('yaml', text);
  assert.deepEqual(labels(symbols), ['assets', 'logo', '1. A', '2. B b']);
  assert.equal(slice(text, symbols[2]), 'title: A\n    layout: cover');
  assert.equal(symbols[2].line, 4);
  assert.deepEqual(documentSymbols('yaml', 'slides: [\n  - title'), documentSymbols('yaml', 'slides: [\n  - title'));
});

test('Markdown: slides by their heading outside fences, layout from the options comment, front matter sections', () => {
  const text = '---\nassets:\n  logo: a.png\n---\n\n<!-- slide: layout=cover -->\n# Q3\n\n```sh\n# not a title\n```\n\n---\n\n# Highlights\n\n---\n\nno heading here\n';
  const symbols = documentSymbols('md', text);
  assert.deepEqual(labels(symbols), ['assets', 'logo', '1. Q3', '2. Highlights', '3. Untitled slide']);
  assert.equal(symbols[2].detail, 'layout cover');
  assert.ok(slice(text, symbols[3]).startsWith('# Highlights'));
  assert.equal(symbols[2].line, 6);
});

test('symbolAt finds the innermost symbol around an offset; filterSymbols matches words, then letters in order', () => {
  const text = '{"assets": {"logo": "a.png"}, "slides": [{"title": "First"}, {"title": "Second"}]}';
  const symbols = documentSymbols('json', text);
  assert.equal(symbolAt(symbols, text.indexOf('Second')).label, '2. Second');
  assert.equal(symbolAt(symbols, text.indexOf('a.png')).label, 'logo');
  assert.equal(symbolAt(symbols, 0), null);
  assert.deepEqual(labels(filterSymbols(symbols, 'seco')), ['2. Second']);
  assert.deepEqual(labels(filterSymbols(symbols, 'slide 2')), ['2. Second'], 'the kind is a word too');
  assert.deepEqual(labels(filterSymbols(symbols, 'asset')), ['assets', 'logo'], 'a kind narrows the list');
  assert.deepEqual(labels(filterSymbols(symbols, '2 second')), ['2. Second']);
  assert.deepEqual(labels(filterSymbols(symbols, 'fst')), ['1. First'], 'letters in order when no word matches');
  assert.equal(filterSymbols(symbols, '').length, symbols.length);
});

test('a 1000-slide deck is read quickly', () => {
  const slides = Array.from({ length: 1000 }, (_, index) => ({ title: `Slide ${index + 1} headline`, items: ['a', 'b', 'c'], notes: 'n' }));
  const text = JSON.stringify({ name: 'Perf', slides }, null, 2);
  const start = performance.now();
  const symbols = documentSymbols('json', text);
  assert.equal(symbols.length, 1000);
  assert.ok(performance.now() - start < 250, `read in ${performance.now() - start} ms`);
});
