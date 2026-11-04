// LH-129: layout templates that set their message in the middle of the slide grow their type to fill it, as LH-48 grows an automatic
// body: a cover's, a section's and a closing's headings, and a stacked record's (statement, quote, closing) body, by steps of the type
// scale; a lone timeline by two or three steps of its labels. The size guard holds: nothing is smaller than without the growth.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide, HEADING_DISPLAY_SIZES, LONE_DISPLAY_SIZES, LONE_TARGET } from '../dist/composition.js';

const { layouts } = gallery;
const findings = (result) => result.diagnostics.filter((entry) => entry.code === 'text-overflow' || entry.code === 'small-cell');
const field = (result, name) => result.items.find((item) => item.field === name);
const lines = (item) => ('richLines' in item.text ? item.text.richLines.length : item.text.lines.length);
const middle = (box) => box.y + box.height / 2;
// The type scale at the default floor and canvas (LH-17): 16 px times (28/16)^(1/4) to a power, in whole pixels.
const STEPS = [16, 18, 21, 24, 28, 32, 37, 43, 49, 56, 65, 75, 86];
const sizesOf = (result) => new Map(result.items.filter((item) => item.text).map((item) => [`${item.path}:${item.field}`, item.text.fontSize]));
const neverSmaller = (grown, kept) => { for (const [key, size] of sizesOf(kept)) assert.ok((sizesOf(grown).get(key) ?? Infinity) >= size - 1e-6, `${key} ${size} -> ${sizesOf(grown).get(key)}`); };

test('a section grows its title and subtitle by steps of the type scale to their display sizes, keeps its eyebrow tag and stays centered', () => {
  for (const direction of ['ltr', 'rtl']) {
    const slide = { tag: 'Part 1', title: 'Where we stand', subtitle: 'Results from the first nine months of 2026' };
    const result = composeSlide(slide, { layout: layouts.section, direction }), kept = composeSlide(slide, { layout: layouts.section, direction, fill: false });
    assert.deepEqual(findings(result), []);
    assert.equal(field(kept, 'title').text.fontSize, 54, 'fill: false keeps the role size');
    // Wave 5: the tag is LH-32's eyebrow, set at its 22 px role size, which is also its display size, so it keeps that size.
    assert.equal(field(result, 'tag').text.fontSize, HEADING_DISPLAY_SIZES.tag);
    assert.equal(field(result, 'tag').text.fontSize, field(kept, 'tag').text.fontSize);
    for (const name of ['title', 'subtitle']) {
      const size = field(result, name).text.fontSize;
      assert.ok(size > field(kept, name).text.fontSize && size <= HEADING_DISPLAY_SIZES[name] && STEPS.includes(size), `${direction} ${name} ${size}`);
      assert.equal(lines(field(result, name)), lines(field(kept, name)), 'no heading takes another line');
    }
    assert.equal(field(result, 'title').text.fontSize, HEADING_DISPLAY_SIZES.title);
    const top = field(result, 'tag').box.y, bottom = field(result, 'subtitle').box.y + field(result, 'subtitle').box.height;
    assert.ok(Math.abs((top + bottom) / 2 - middle(result.contentBox)) < 2, 'the heading group stays in the middle');
  }
});

test('a cover title grows only while it keeps its lines; a long title stays at a step that fits', () => {
  const short = composeSlide({ title: 'Third-quarter customer review', subtitle: 'Renata Alvarez, November 4, 2026' }, { layout: layouts.cover });
  assert.equal(field(short, 'title').text.fontSize, 75);
  const long = { title: 'A deliberately long cover title that already needs two lines across the whole slide at its role size', subtitle: 'Board review' };
  const grown = composeSlide(long, { layout: layouts.cover }), kept = composeSlide(long, { layout: layouts.cover, fill: false });
  assert.deepEqual(findings(grown), []);
  assert.ok(lines(field(grown, 'title')) <= lines(field(kept, 'title')));
  const size = field(grown, 'title').text.fontSize;
  assert.ok(STEPS.includes(size) || size === field(kept, 'title').text.fontSize, `a step of the scale or the size it has without growth: ${size}`);
  neverSmaller(grown, kept);
});

test('a closing grows its title and its details; the body stops at a list\'s display size and the text covers at most LONE_TARGET', () => {
  const slide = { title: 'Thank you', blocks: [{ items: ['Renata Alvarez, VP Customer Success', 'renata.alvarez@northwind.example', '+1 415 555 0142', 'northwind.example/q3-review'] }] };
  const result = composeSlide(slide, { layout: layouts.closing }), kept = composeSlide(slide, { layout: layouts.closing, fill: false });
  assert.deepEqual(findings(result), []);
  assert.ok(field(result, 'title').text.fontSize > 54);
  const list = field(result, 'items');
  assert.ok(list.text.fontSize > field(kept, 'items').text.fontSize && list.text.fontSize <= LONE_DISPLAY_SIZES.list, `${list.text.fontSize}`);
  const top = field(result, 'title').box.y, bottom = list.box.y + list.box.height;
  assert.ok(bottom - top <= LONE_TARGET * result.contentBox.height + 2, 'about 60% of the slide at most');
  neverSmaller(result, kept);
});

test('a quote grows its quote and attribution; the title over it keeps its size', () => {
  const slide = { title: 'Why Brightwater Foods switched', blocks: [{ quote: { text: 'We cut stockouts by a third in the first quarter, and my planners finally trust the forecast.', attribution: 'Priya Raman', role: 'VP Operations, Brightwater Foods' } }] };
  const result = composeSlide(slide, { layout: layouts.quote }), kept = composeSlide(slide, { layout: layouts.quote, fill: false });
  assert.deepEqual(findings(result), []);
  assert.equal(field(result, 'title').text.fontSize, field(kept, 'title').text.fontSize);
  const part = (composed, role) => field(composed, 'quote').quoteLayout.parts.find((entry) => entry.role === role).fit.fontSize;
  assert.ok(part(result, 'body') > part(kept, 'body') && part(result, 'body') <= LONE_DISPLAY_SIZES.quote);
  assert.ok(part(result, 'footer') > part(kept, 'footer') && part(result, 'footer') <= LONE_DISPLAY_SIZES.quoteFooter);
});

test('a statement grows its message and keeps its title; a full statement keeps its sizes', () => {
  const slide = { title: 'Reliability is the feature customers pay for', blocks: [{ text: 'Every roadmap decision in 2027 starts with one question: does it make the service more dependable?' }] };
  const result = composeSlide(slide, { layout: layouts.statement }), kept = composeSlide(slide, { layout: layouts.statement, fill: false });
  assert.equal(field(result, 'title').text.fontSize, field(kept, 'title').text.fontSize);
  assert.ok(STEPS.includes(field(result, 'text').text.fontSize) && field(result, 'text').text.fontSize > field(kept, 'text').text.fontSize);
  const paragraph = 'State Workforce Board should focus the next cycle on preparing displaced workers for regional growth sectors while making the operating tradeoffs clear to every stakeholder.';
  const full = { title: 'Decision and follow-through', blocks: [{ text: paragraph }, { text: paragraph }, { text: paragraph }, { text: paragraph }] };
  assert.deepEqual(composeSlide(full, { layout: layouts.statement }).items.map((item) => item.text?.fontSize), composeSlide(full, { layout: layouts.statement, fill: false }).items.map((item) => item.text?.fontSize));
});

test('a closing keeps its automatic pill: a growth that would drop it is not kept', () => {
  const slide = { title: 'Demo moment', blocks: [{ text: 'Lakehaven Water District should focus the next cycle on approving staged replacement of high-risk mains while making the tradeoffs clear.' }, { text: 'Measure the result.' }] };
  const result = composeSlide(slide, { layout: layouts.closing }), kept = composeSlide(slide, { layout: layouts.closing, fill: false });
  assert.equal(result.emphasis?.shape, kept.emphasis?.shape);
  assert.equal(result.emphasis?.path, kept.emphasis?.path);
  neverSmaller(result, kept);
});

test('a content slide keeps its title size: only headings that are the message grow', () => {
  const slide = { title: 'Today\'s agenda', blocks: [{ items: ['Where we stand', 'What changed', 'The 2027 plan'] }] };
  assert.equal(field(composeSlide(slide, { layout: layouts.agenda }), 'title').text.fontSize, 54);
  const picture = { title: 'The site', blocks: [{ image: { src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Site' } }] };
  assert.equal(field(composeSlide(picture, { layout: layouts.image }), 'title').text.fontSize, field(composeSlide(picture, { layout: layouts.image, fill: false }), 'title').text.fontSize);
});

test('a lone timeline grows by steps of the type scale while its labels keep their lines and arrangement', () => {
  const slide = { title: 'Six weeks to an informed decision', blocks: [
    { region: 'timeline', timeline: { events: [{ when: 'Week 1', what: 'Baseline' }, { when: 'Weeks 2-5', what: 'Pilot' }, { when: 'Week 6', what: 'Review and decide' }] } },
    { region: 'notes', text: 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale.' },
  ] };
  for (const direction of ['ltr', 'rtl']) {
    const result = composeSlide(slide, { layout: layouts.timeline, direction }), timeline = field(result, 'timeline').timelineLayout;
    assert.deepEqual(findings(result), []);
    const size = (role) => timeline.parts.find((part) => part.role === role).fit.fontSize;
    assert.equal(size('when'), 28, direction);
    assert.equal(size('what'), 32, direction);
    assert.ok(timeline.parts.filter((part) => part.role === 'what' || part.role === 'when').every((part) => part.fit.lines.length === 1));
  }
});
