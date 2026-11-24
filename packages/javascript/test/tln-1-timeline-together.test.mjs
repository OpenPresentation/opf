// TLN-1: a lone timeline grows in proportion to use its body (its labels up through the type scale to TIMELINE_DISPLAY_SIZE, a `what`
// label taking at most two lines of whole words), its markers, gaps and connector with it; the lead and the note keep their places.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const events = [{ when: 'Week 1', what: 'Baseline' }, { when: 'Weeks 2–5', what: 'Pilot' }, { when: 'Week 6', what: 'Review and decide' }];
const compose = (slide) => { const context = resolveSlideContext({ slides: [{ layout: 'timeline', ...slide }] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const of = (result, field) => result.items.find((item) => item.field === field);
const size = (layout, role) => Math.max(...layout.parts.filter((part) => part.role === role).map((part) => part.fit.fontSize));
const lead = 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale.';
const note = 'Keep the scope narrow, collect feedback weekly and give each decision a named owner.';

test('TLN-1: the timeline grows well past its role sizes, and the lead and note keep their places', () => {
  const result = compose({ title: 'Six weeks to an informed decision', blocks: [{ region: 'lead', text: lead }, { region: 'body', timeline: { events } }, { region: 'aside', text: note }] });
  assert.deepEqual(findings(result), []);
  const title = of(result, 'title'), timeline = of(result, 'timeline'), [first, last] = result.items.filter((item) => item.field === 'text'), layout = timeline.timelineLayout;
  assert.ok(size(layout, 'what') >= 43, `what ${size(layout, 'what')}`);
  assert.ok(size(layout, 'when') > 18 * 1.5, `when ${size(layout, 'when')}`);
  assert.ok(layout.markers.every((marker) => marker.radius > 12), 'markers grow');
  assert.ok(layout.lineWidth > 4, 'the connector grows');
  // The lead right under the title, the note at the foot of the content box, the timeline in the middle of the body between them.
  assert.ok(first.box.y - (title.box.y + title.box.height) < 40);
  assert.ok(result.contentBox.y + result.contentBox.height - (last.box.y + last.box.height) < 10);
  const above = layout.bounds.y - timeline.box.y, below = timeline.box.y + timeline.box.height - layout.bounds.y - layout.bounds.height;
  assert.ok(Math.abs(above - below) < 0.1 * timeline.box.height + 2, `above ${above}, below ${below}`);
});

test('TLN-1: the same timeline reads at one size with and without its lead and note', () => {
  const alone = compose({ title: 'Six weeks to a decision', blocks: [{ region: 'body', timeline: { events } }] });
  const framed = compose({ title: 'Six weeks to a decision', blocks: [{ region: 'lead', text: lead }, { region: 'body', timeline: { events } }, { region: 'aside', text: note }] });
  assert.equal(size(of(alone, 'timeline').timelineLayout, 'what'), size(of(framed, 'timeline').timelineLayout, 'what'));
});

test('TLN-1: six events fill the width and grow too', () => {
  const six = [...events, { when: 'Week 8', what: 'Scale' }, { when: 'Week 10', what: 'Report' }, { when: 'Week 12', what: 'Close' }];
  const result = compose({ title: 'Six weeks to a decision', blocks: [{ region: 'body', timeline: { events: six } }] });
  assert.deepEqual(findings(result), []);
  const layout = of(result, 'timeline').timelineLayout;
  assert.ok(size(layout, 'what') > 32, `what ${size(layout, 'what')}`);
  assert.ok(layout.bounds.width > 0.9 * of(result, 'timeline').box.width);
});

test('TLN-1: the bands of a stack keep their role sizes and markers', () => {
  const result = compose({ title: 'Two plans', blocks: [{ region: 'body', timeline: { events } }, { region: 'body', timeline: { events } }] });
  for (const item of result.items.filter((entry) => entry.field === 'timeline')) {
    assert.ok(item.timelineLayout.markers.every((marker) => marker.radius <= 9 + 1e-9));
    assert.equal(item.timelineLayout.lineWidth, undefined);
  }
});

test('TLN-1 with LH-129: the proportional growth never sets a date under the size the offset growth gives it', () => {
  const six = [['Week 1', 'Baseline'], ['Weeks 2–5', 'Pilot'], ['Week 6', 'Review and decide'], ['Week 8', 'Scale'], ['Week 10', 'Report'], ['Week 12', 'Close']].map(([when, what]) => ({ when, what }));
  const result = compose({ title: 'Six weeks to a decision', blocks: [{ region: 'body', timeline: { events: six } }, { region: 'lead', text: lead }, { region: 'aside', text: note }] });
  const layout = of(result, 'timeline').timelineLayout;
  // The offset growth sets the dates at 28 px and the events at 32; the proportional factor that would leave a date at 25.8 px is not taken.
  assert.ok(Math.min(...layout.parts.filter((part) => part.role === 'when').map((part) => part.fit.fontSize)) >= 28 - 1e-6);
  assert.ok(size(layout, 'what') > 32, `the events still grow (${size(layout, 'what')})`);
});
