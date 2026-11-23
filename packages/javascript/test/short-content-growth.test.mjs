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

test('a FAQ written as one list sets its answers at the question size', () => {
  const composed = compose({ layout: 'faq', title: 'Questions', blocks: [{ items: [{ text: 'Who takes part?', description: 'Two teams.' }, { text: 'How long?', description: 'Six weeks.' }, { text: 'What next?', description: 'Review.' }] }] });
  const list = composed.items.find((item) => item.field === 'items');
  for (const entry of list.text.listEntries) assert.ok(Math.abs(entry.description.fontSize - list.text.fontSize) < 0.5, `answer ${entry.description.fontSize} at the question size ${list.text.fontSize}`);
});

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

test('a lone list with one long point keeps its size and sits in the middle of the body', () => {
  const slide = { layout: 'list', title: 'Make the next step explicit', blocks: [{ region: 'body', items: ['Short', 'Two teams and one workflow keep the pilot focused, and every week the team reviews the evidence, compares it with the baseline, records what changed, and agrees who owns the next decision before anything is expanded.', 'Also short', 'Medium length point about the baseline.'] }] };
  const composed = compose(slide), kept = compose({ ...slide, composition: undefined });
  const list = composed.items.find((item) => item.field === 'items');
  const top = list.box.y - composed.contentBox.y, title = composed.items.find((item) => item.field === 'title').box;
  assert.ok(list.text.fontSize >= kept.items.find((item) => item.field === 'items').text.fontSize - 1e-6, 'never smaller');
  const above = list.box.y - (title.y + title.height), below = composed.contentBox.y + composed.contentBox.height - (list.box.y + list.box.height);
  assert.ok(top > 0 && Math.abs(above - below) < 0.25 * composed.contentBox.height, `in the middle: ${above} above, ${below} below`);
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

test('a short text or list beside a layout picture or chart grows as the lone block of its cell', () => {
  const picture = { src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiLz4=', alt: 'Illustrative picture' };
  for (const body of [{ text: 'Look here.' }, { items: ['Two teams', 'Six weeks', 'One decision'] }]) {
    const composed = compose({ layout: 'image-beside', title: 'Explain what the audience should notice', blocks: [{ region: 'media', image: picture }, { region: 'body', ...body }] });
    const [size] = sizes(composed, body.text ? 'text' : 'items');
    assert.ok(size > LONE_DISPLAY_SIZES.list + 1, `beside a picture: ${size}`);
  }
  const chart = { type: 'column', alt: 'Illustrative', data: { columns: ['Team', 'Rate'], rows: [['A', 5.8], ['B', 6.7]] } };
  const columns = compose({ layout: 'three-column', title: 'Columns', blocks: [{ region: 'first', chart }, { region: 'second', text: 'Short text.' }, { region: 'third', text: 'Another short.' }] });
  const texts = sizes(columns, 'text');
  assert.equal(texts.length, 2);
  for (const size of texts) assert.ok(size > LONE_DISPLAY_SIZES.list + 1, `two short texts beside a chart grow: ${size}`);
  // Each keeps its whole column: the cards stay one height and one top beside the chart's card.
  const boxes = columns.items.filter((item) => item.field === 'text').map((item) => item.frameBox ?? item.box), chartBox = (({ frameBox, box }) => frameBox ?? box)(columns.items.find((item) => item.field === 'chart'));
  assert.equal(new Set(boxes.map((box) => Math.round(box.height))).size, 1, 'one height');
  assert.equal(new Set(boxes.map((box) => Math.round(box.y))).size, 1, 'one top');
  assert.ok(boxes[0].height >= chartBox.height - 1, 'as tall as the chart');
  // A hero's lead over its body keeps its size: its region holds two texts.
  const hero = compose({ layout: 'hero', title: 'One team', blocks: [{ text: 'One outcome.' }, { text: 'Narrow scope.' }, { image: picture }] });
  for (const size of sizes(hero, 'text')) assert.ok(size <= LONE_DISPLAY_SIZES.list + 1e-6, `a hero's texts keep their sizes: ${size}`);
});

test('two short lines on a text layout grow together past the list display size', () => {
  const composed = compose({ layout: 'text', title: 'Learn', blocks: [{ region: 'body', text: 'Start small.' }, { region: 'body', text: 'Measure weekly.' }] });
  const texts = sizes(composed, 'text');
  assert.equal(new Set(texts).size, 1, `one size: ${texts}`);
  // Texts of at most four words grow on to the display title's size, as one such text does.
  assert.ok(texts[0] > 56 + 1, `they grow past the compact display size: ${texts[0]}`);
  // A paragraph beside a short list grows too; the list may grow further than the paragraph its reading measure holds.
  const mixed = compose({ layout: 'text', title: 'Learn', blocks: [{ region: 'body', text: 'Keep the scope narrow, collect feedback weekly and give each decision a named owner.' }, { region: 'body', items: ['Start small', 'Measure weekly'] }] });
  for (const size of [...sizes(mixed, 'text'), ...sizes(mixed, 'items')]) assert.ok(size > LONE_DISPLAY_SIZES.list + 1, `both grow: ${size}`);
});
