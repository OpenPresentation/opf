// TLN-1: a lone timeline on the timeline layout grows into a drawing that reads at its size (markers and gaps grow with its labels),
// and a lead above it and a note below it sit with it in the middle of the body instead of at the body's top and foot.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const events = [{ when: 'Week 1', what: 'Baseline' }, { when: 'Weeks 2–5', what: 'Pilot' }, { when: 'Week 6', what: 'Review and decide' }];
const compose = (slide) => { const context = resolveSlideContext({ slides: [{ layout: 'timeline', ...slide }] }, 0, { catalogs: [gallery] }); return composeSlide(context.slide, context.options); };
const findings = (result) => result.diagnostics.filter((entry) => ['text-overflow', 'small-cell', 'layout-unplaced'].includes(entry.code));
const of = (result, field) => result.items.find((item) => item.field === field);
const what = (layout) => Math.max(...layout.parts.filter((part) => part.role === 'what').map((part) => part.fit.fontSize));

test('TLN-1: the lead, the timeline and the note sit together in the middle of the body', () => {
  const result = compose({ title: 'Six weeks to an informed decision', blocks: [
    { region: 'lead', text: 'Test with two teams for six weeks. Measure task completion and time before deciding what to scale.' },
    { region: 'body', timeline: { events } },
    { region: 'aside', text: 'Keep the scope narrow, collect feedback weekly and give each decision a named owner.' },
  ] });
  assert.deepEqual(findings(result), []);
  const title = of(result, 'title'), timeline = of(result, 'timeline'), [lead, note] = result.items.filter((item) => item.field === 'text');
  const bounds = timeline.timelineLayout.bounds, leadEnd = lead.box.y + lead.box.height, noteEnd = note.box.y + note.box.height;
  // The lead ends and the note starts close to the drawing (one gap or so), not 150 px away.
  assert.ok(bounds.y - leadEnd < 60, `lead to timeline ${bounds.y - leadEnd}`);
  assert.ok(note.box.y - (bounds.y + bounds.height) < 60, `timeline to note ${note.box.y - bounds.y - bounds.height}`);
  // The group sits in the middle of the space under the title.
  const above = lead.box.y - (title.box.y + title.box.height), below = result.contentBox.y + result.contentBox.height - noteEnd;
  assert.ok(above > 60 && Math.abs(above - below) < 0.25 * (above + below), `above ${above}, below ${below}`);
  // The events grew (LH-129's steps) and the markers with them.
  assert.ok(what(timeline.timelineLayout) >= 32, `what ${what(timeline.timelineLayout)}`);
  assert.ok(timeline.timelineLayout.markers.every((marker) => marker.radius > 9.5), 'markers grow with the labels');
});

test('TLN-1: a lone timeline alone in the body grows its markers with its labels and stays in the middle', () => {
  const result = compose({ title: 'Six weeks to a decision', blocks: [{ region: 'body', timeline: { events: events.slice(0, 2) } }] });
  assert.deepEqual(findings(result), []);
  const timeline = of(result, 'timeline'), layout = timeline.timelineLayout;
  assert.ok(what(layout) > 22, `what ${what(layout)}`);
  assert.ok(layout.markers[0].radius > 9.5, `radius ${layout.markers[0].radius}`);
  const above = layout.bounds.y - timeline.box.y, below = timeline.box.y + timeline.box.height - layout.bounds.y - layout.bounds.height;
  assert.ok(Math.abs(above - below) < 0.1 * timeline.box.height, `above ${above}, below ${below}`);
});

test('TLN-1: the bands of a stack keep their role-size markers', () => {
  const result = compose({ title: 'Two plans', blocks: [{ region: 'body', timeline: { events } }, { region: 'body', timeline: { events } }] });
  for (const item of result.items.filter((entry) => entry.field === 'timeline')) assert.ok(item.timelineLayout.markers.every((marker) => marker.radius <= 9 + 1e-9));
});
