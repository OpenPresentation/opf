import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { paginate } from '../dist/index.js';
import { composeSlide } from '../dist/composition.js';

// OPF 0.19 (RR-79), design section 4: pagination continues on a new slide with the same layout and never drops content.
const { layouts } = JSON.parse(readFileSync(new URL('./fixtures/layout-templates-0.19.json', import.meta.url), 'utf8'));
const deck = (layout, slide) => ({ catalogs: { custom: { layouts: { [layout]: layouts[layout] } } }, slides: [{ layout, ...slide }] });
const text = (value) => ({ text: value });

describe('pagination with template layouts', () => {
  test('blocks beyond a region\'s max move to a continuation with the same layout, in source order', () => {
    const blocks = Array.from({ length: 8 }, (_, index) => text(`Pillar ${index + 1}`));
    const { presentation, pages } = paginate(deck('pillars', { title: 'Eight pillars', blocks }));
    assert.equal(presentation.slides.length, 2);
    assert.deepEqual(presentation.slides.map((slide) => slide.layout), ['pillars', 'pillars']);
    assert.deepEqual(presentation.slides[0].blocks.map((block) => block.text), blocks.slice(0, 6).map((block) => block.text));
    assert.deepEqual(presentation.slides[1].blocks.map((block) => block.text), ['Pillar 7', 'Pillar 8']);
    // Headings repeat; moved blocks carry a pin to the region they came from.
    assert.equal(presentation.slides[1].title, 'Eight pillars');
    assert.deepEqual(presentation.slides[1].blocks.map((block) => block.region), ['pillars', 'pillars']);
    assert.equal(presentation.slides[0].blocks[0].region, undefined, 'blocks that stay are not pinned');
    assert.equal(pages.length, 2);
  });

  test('each page composes without layout-unplaced', () => {
    const blocks = Array.from({ length: 13 }, (_, index) => text(`Logo ${index + 1}`));
    const { presentation } = paginate(deck('logos', { title: 'Customers', blocks }));
    assert.equal(presentation.slides.length, 2);
    for (const slide of presentation.slides) {
      const result = composeSlide(slide, { layout: layouts.logos });
      assert.deepEqual(result.diagnostics.filter((entry) => entry.code === 'layout-unplaced'), []);
    }
  });

  test('a region whose text does not fit splits as today, after list columns were tried, on the same layout', () => {
    const items = Array.from({ length: 60 }, (_, index) => `Agenda point number ${index + 1}, explained in a sentence of some length`);
    const { presentation } = paginate(deck('agenda', { title: 'Agenda', items }));
    assert.ok(presentation.slides.length >= 2);
    assert.ok(presentation.slides.every((slide) => slide.layout === 'agenda'));
    assert.equal(presentation.slides.flatMap((slide) => slide.items).length, 60, 'nothing dropped');
  });

  test('a slide that fits stays one slide with its content unchanged', () => {
    const input = deck('pillars', { title: 'Three', blocks: [text('a'), text('b'), text('c')] });
    const { presentation } = paginate(input);
    assert.equal(presentation.slides.length, 1);
    assert.deepEqual(presentation.slides[0].blocks, input.slides[0].blocks);
  });
});
