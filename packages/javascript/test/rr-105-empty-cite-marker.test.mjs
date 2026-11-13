// RR-105 (coverage finding 27): a `cite` or `footnote` on an empty run keeps its marker. The marker is drawn where the run stands,
// after the text before it, so the reference listed at the slide foot is always tied to the body.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, fitRichText } from '../dist/composition.js';
import { validate } from '../dist/index.js';

const references = [{ id: 'itf', text: 'International Transport Forum, Port Outlook 2025.' }];
const markersOf = fit => fit.richLines.map(line => line.fragments.filter(fragment => fragment.kind === 'marker').map(fragment => fragment.text));
const marker = path => path === 'slides.0.text.1' ? '1' : undefined;
const style = { fontFamily: 'sans-serif', fontWeight: 400, path: 'slides.0.text' };

test('an empty cited run draws its marker after the text before it', () => {
  const fit = fitRichText(['Ports grew 3 percent', { text: '', cite: 'itf' }, '.'], { x: 0, y: 0, width: 2000, height: 400 }, 32, 16, { style, citationMarker: marker });
  const fragments = fit.richLines[0].fragments;
  assert.deepEqual(fragments.map(fragment => fragment.kind === 'marker' ? `^${fragment.text}` : fragment.text), ['Ports grew 3 percent', '^1', '.']);
  const mark = fragments[1];
  assert.equal(mark.runIndex, 1);
  assert.equal(mark.start, 0);
  assert.equal(mark.end, 0);
  assert.ok(mark.x > 0 && mark.width > 0 && mark.baselineShift < 0);
  // The period follows the marker.
  assert.ok(fragments[2].x >= mark.x + mark.width - 1e-9);
});

test('the marker of an empty run is drawn once, on the line that ends with the text before it', () => {
  const runs = ['Ports grew three percent', { text: '', cite: 'itf' }, ' and kept growing through the year'];
  // The box holds the first run and its marker, so the line breaks at the empty run's offset.
  const one = fitRichText(runs.slice(0, 2), { x: 0, y: 0, width: 4000, height: 1000 }, 32, 16, { style, citationMarker: marker });
  for (const width of [500, one.richLines[0].width + 1]) {
    const narrow = fitRichText(runs, { x: 0, y: 0, width, height: 1000 }, 32, 16, { style, citationMarker: marker });
    assert.ok(narrow.richLines.length > 1);
    assert.equal(markersOf(narrow).flat().length, 1);
    const line = narrow.richLines.find(found => found.fragments.some(fragment => fragment.kind === 'marker'));
    const at = line.fragments.findIndex(fragment => fragment.kind === 'marker');
    assert.match(line.fragments[at - 1].text, /percent$/u);
  }
  // At the break the marker ends the first line (it does not start the next one).
  const broken = fitRichText(runs, { x: 0, y: 0, width: one.richLines[0].width + 1, height: 1000 }, 32, 16, { style, citationMarker: marker });
  assert.equal(broken.richLines[0].fragments.filter(fragment => fragment.kind === 'marker' || /\S/u.test(fragment.text)).at(-1).kind, 'marker');
  assert.ok(broken.richLines[1].fragments.every(fragment => fragment.kind !== 'marker'));
});

test('an empty run at the start of the text or of a paragraph keeps its marker', () => {
  const first = fitRichText([{ text: '', cite: 'itf' }, 'Ports grew'], { x: 0, y: 0, width: 2000, height: 400 }, 32, 16, { style: { ...style }, citationMarker: path => path === 'slides.0.text.0' ? '1' : undefined });
  assert.deepEqual(markersOf(first), [['1']]);
  const paragraph = fitRichText(['Ports grew\n', { text: '', cite: 'itf' }, 'again'], { x: 0, y: 0, width: 2000, height: 400 }, 32, 16, { style, citationMarker: marker });
  assert.deepEqual(markersOf(paragraph), [[], ['1']]);
});

test('a slide with an empty cited run or footnote run draws the marker its foot lists, and validate accepts it', () => {
  for (const run of [{ text: '', cite: 'itf' }, { text: '', footnote: 'Unaudited.' }]) {
    const deck = { references, slides: [{ title: 'Cite', text: ['Ports grew 3 percent', run, '.'] }] };
    const composed = composeSlide(deck.slides[0], { presentation: deck, slideIndex: 0 });
    const body = composed.items.find(item => item.field === 'text');
    assert.deepEqual(markersOf(body.text).flat(), ['1']);
    assert.equal(composed.footnotes?.entries.length, 1);
    const report = validate(deck);
    assert.equal(report.valid, true);
  }
});
