// v0.33.0 integration, LH-184 with LH-186: a paginated FAQ page whose list is set in columns is not recomposed into one
// column whose lines run past the prose measure (LH-184's 70-character rule) for a size less than a step (10%) larger.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';
import { paginate } from '../dist/pagination.js';
import { layouts, sampleSlide } from './support/template-samples.mjs';

test('the pages of a long four-block FAQ keep their list columns', () => {
  const record = layouts.faq;
  const slide = sampleSlide(record, 4, 'long');
  const { presentation } = paginate({ catalogs: { custom: { layouts: { faq: record } } }, slides: [{ ...slide, layout: 'faq', design: { contentBox: true } }] });
  assert.ok(presentation.slides.length > 1, 'the slide is paginated');
  for (const [index, page] of presentation.slides.entries()) {
    const result = composeSlide(page, { layout: record });
    const list = result.items.find((item) => item.field === 'items' || item.field === 'bullets');
    assert.ok(list, `page ${index + 1} has its list`);
    const oneColumn = !list.listColumns && list.text.fontSize * 70 * 0.5 < list.box.width - 0.5;
    assert.ok(!oneColumn, `page ${index + 1} sets no single column past the prose measure`);
  }
});
