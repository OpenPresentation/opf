// LH-102 extended (the size of short content): short content grows toward its role's display size when its space is mostly empty,
// whatever its kind and whatever the author's way of writing it; a body that already fills its space keeps its sizes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide, LONE_DISPLAY_SIZES, MESSAGE_CEILINGS } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const compose = (slide) => {
  const document = { $schema: 'https://openpresentation.org/schema/opf/v1', language: 'en-US', slides: [slide] };
  const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
  return composeSlide(context.slide, context.options);
};
const sizes = (composed, field) => composed.items.filter((item) => item.field === field).map((item) => item.text.fontSize);

test('a lone list of two short points grows past the list display size while its body is mostly empty', () => {
  for (const slide of [
    { title: 'Two points', blocks: [{ items: ['Faster reviews', 'Fewer handoffs'] }] },
    { title: 'Two points', blocks: [{ bullets: ['Faster reviews', 'Fewer handoffs'] }] },
    { title: 'Two steps', blocks: [{ items: ['Pilot in March', 'Rollout in June'], numbering: 'arabic' }] },
    { layout: 'list', title: 'Two points', blocks: [{ region: 'body', items: ['One short point', 'Another short point'] }] },
  ]) {
    const [size] = sizes(compose(slide), slide.blocks[0].bullets ? 'bullets' : 'items');
    assert.ok(size > LONE_DISPLAY_SIZES.list + 1, `${slide.title}: ${size} grows past ${LONE_DISPLAY_SIZES.list}`);
    assert.ok(size <= 56 + 1e-6, `${slide.title}: ${size} stays at most the compact display size`);
  }
});

test('a lone list that is drawn, or fills half its body, keeps its size', () => {
  // LH-134: a few numbered takeaways in a layout keep their display numerals and their list size.
  const takeaways = compose({ layout: 'list', title: 'Steps', blocks: [{ region: 'body', items: ['Establish a baseline', 'Run the pilot', 'Decide what to scale'], numbering: 'arabic' }] });
  const list = takeaways.items.find((item) => item.field === 'items');
  assert.ok(list.text.fontSize <= LONE_DISPLAY_SIZES.list + 1e-6, `takeaways keep their size: ${list.text.fontSize}`);
  assert.ok(list.text.listEntries.some((entry) => entry.badge?.numeral), 'the takeaways keep their numerals');
  // A list that fills its body keeps its role size.
  const long = compose({ layout: 'list', title: 'Many', blocks: [{ region: 'body', items: Array.from({ length: 8 }, (_, index) => `Point number ${index + 1} about the pilot plan`) }] });
  for (const size of sizes(long, 'items')) assert.ok(size <= LONE_DISPLAY_SIZES.list + 1e-6, `a full list keeps its size: ${size}`);
});

test('the lone quote of a quote slide grows to its length-keyed ceiling under any title', () => {
  const quote = (text) => compose({ layout: 'quote', title: 'A shared view makes decisions easier', blocks: [{ region: 'body', quote: { text, attribution: 'Pilot lead' } }] }).items.find((item) => item.field === 'quote');
  const body = (item) => item.quoteLayout.parts.find((part) => part.role === 'body').fit.fontSize;
  const word = body(quote('Simple.')), sentence = body(quote('We can now see where participants need help.'));
  assert.ok(word > LONE_DISPLAY_SIZES.quote + 1, `"Simple." grows past the quote display size: ${word}`);
  assert.ok(word > sentence, `"Simple." (${word}) is larger than a quoted sentence (${sentence})`);
  assert.ok(word > MESSAGE_CEILINGS.quote.find(([most]) => most >= 30)[1] + 1, `a quoted word reaches a short statement's size: ${word}`);
  // A sentence balances its two lines, so no stub line holds it at the quote display size.
  assert.ok(sentence > LONE_DISPLAY_SIZES.quote + 1, `a quoted sentence grows past the quote display size: ${sentence}`);
  const long = body(quote('We can now see where participants need help, and the weekly review keeps the next step clear for everyone on both teams, so nobody waits for a decision that has already been made.'));
  assert.ok(long <= LONE_DISPLAY_SIZES.quote + 1e-6, `a long quote keeps the quote display size at most: ${long}`);
});
