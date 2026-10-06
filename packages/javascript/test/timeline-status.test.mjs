// FA-11: TimelineEvent.status (done | current | planned) in the schema, layout geometry, shared drawing helpers,
// Markdown, conversions and pagination.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TIMELINE_STATUSES, TIMELINE_TEXT_MIN_CONTRAST, colorContrast as contrastRatio, composeSlide, layoutTimeline,
  paginateSlide, timelineMarkerShapes, timelineTextColor, validatePresentation,
} from '../dist/index.js';
import { markdownToOpf, opfToMarkdown } from '../dist/markdown.js';
import { convertContent } from '../dist/convert.js';

const box = { x: 10, y: 20, width: 1400, height: 700 };
const events = [{ when: 'Q1', what: 'Discovery' }, { when: 'Q2', what: 'Pilot' }, { when: 'Q3', what: 'Rollout' }];
const withStatus = (...statuses) => events.map((event, index) => (statuses[index] ? { ...event, status: statuses[index] } : { ...event }));
const rich = { name: 'Roadmap', description: 'Where we are.', events: withStatus('done', 'current', 'planned') };
const colors = { background: '#FFFFFF', primary: '#1D4ED8', text: '#111827', mutedText: '#9CA3AF' };

test('the schema takes done, current and planned and nothing else', () => {
  assert.deepEqual([...TIMELINE_STATUSES], ['done', 'current', 'planned']);
  const deck = (status) => ({ slides: [{ timeline: [{ what: 'Pilot', status }] }] });
  for (const status of TIMELINE_STATUSES) assert.equal(validatePresentation(deck(status)).valid, true, status);
  for (const status of ['at-risk', 'blocked', 'Done', '', 1, null]) assert.equal(validatePresentation(deck(status)).valid, false, String(status));
  assert.equal(validatePresentation({ slides: [{ timeline: { events: withStatus('done', 'current', 'planned') } }] }).valid, true);
});

test('events without a status lay out exactly as before: no status keys anywhere', () => {
  for (const arrangementBox of [box, { x: 10, y: 20, width: 180, height: 400 }]) {
    const plain = layoutTimeline(events, arrangementBox), json = JSON.stringify(plain);
    assert.ok(!json.includes('status'));
    for (const marker of plain.markers) assert.deepEqual(Object.keys(marker), ['path', 'eventIndex', 'x', 'y', 'radius']);
  }
});

test('markers and parts carry the event status; only current has a ring and only current and planned an outline', () => {
  const layout = layoutTimeline(rich, box);
  assert.equal(layout.overflow, false);
  const [done, current, planned] = layout.markers;
  assert.equal(done.status, 'done'); assert.equal(done.ring, undefined); assert.equal(done.strokeWidth, undefined);
  assert.equal(current.status, 'current'); assert.ok(current.ring.radius > current.radius); assert.ok(current.strokeWidth > 0);
  assert.equal(planned.status, 'planned'); assert.equal(planned.ring, undefined); assert.ok(planned.strokeWidth > 0 && planned.strokeWidth <= planned.radius);
  for (const part of layout.parts) assert.equal(part.status, part.eventIndex === undefined ? undefined : rich.events[part.eventIndex].status);
  // The label of the current event is bold, and the line breaks were measured with that weight.
  const weights = layout.parts.filter((part) => part.eventIndex === 1).map((part) => [part.role, part.requestedStyle.fontWeight]);
  assert.deepEqual(weights, [['when', 500], ['what', 700]]);
  assert.ok(layout.parts.filter((part) => part.eventIndex !== 1).every((part) => part.requestedStyle.fontWeight === 500 || part.eventIndex === undefined));
});

test('a done event has the geometry of an event without status', () => {
  const plain = layoutTimeline(events, box), done = layoutTimeline(withStatus('done', 'done', 'done'), box);
  assert.deepEqual(done.parts.map((part) => ({ ...part, status: undefined })), plain.parts.map((part) => ({ ...part, status: undefined })));
  assert.deepEqual(done.markers.map(({ status, ...marker }) => marker), plain.markers);
  assert.deepEqual(done.connector, plain.connector);
});

test('the vertical rail makes room for the ring and keeps the text distance from the marker', () => {
  const description = 'Keep every source detail while measuring enough readable space for the complete milestone.';
  const narrow = { x: 10, y: 20, width: 220, height: 700 }, base = events.map((event) => ({ ...event, description })), value = base.map((event, index) => ({ ...event, status: ['done', 'current', 'planned'][index] }));
  const plain = layoutTimeline(base, narrow), status = layoutTimeline(value, narrow);
  assert.equal(plain.arrangement, 'vertical'); assert.equal(status.arrangement, 'vertical');
  const ring = status.markers[1].ring.radius, radius = status.markers[1].radius;
  const stroke = status.markers[1].strokeWidth;
  assert.ok(status.markers[0].x - ring - stroke / 2 >= narrow.x - 0.01);
  assert.equal(ring, 1.6 * radius);
  const gap = (layout) => layout.parts.find((part) => part.eventIndex === 0).box.x - (layout.markers[0].x + layout.markers[0].radius);
  assert.ok(Math.abs(gap(status) - gap(plain)) < 1e-9);
  assert.ok(status.parts.find((part) => part.eventIndex === 0).box.x > plain.parts.find((part) => part.eventIndex === 0).box.x);
  assert.ok(radius < ring);
  const rtl = layoutTimeline(value, narrow, { direction: 'rtl' });
  assert.ok(rtl.markers[0].x + ring + stroke / 2 <= narrow.x + narrow.width + 0.01);
});

test('a ring that does not fit reports the marker as out of space instead of drawing outside the box', () => {
  const tiny = layoutTimeline(withStatus('current'), { x: 0, y: 0, width: 200, height: 50 }, { minFontSize: 8 });
  for (const marker of tiny.markers) if (marker.ring) assert.ok(tiny.diagnostics.some((d) => d.path === marker.path) || marker.x - marker.ring.radius >= -0.01);
});

test('invalid status values are rejected by the layout', () => {
  assert.throws(() => layoutTimeline([{ what: 'A', status: 'blocked' }], box), TypeError);
});

test('marker shapes: filled for done and unset, ring plus filled dot for current, outlined and hollow for planned', () => {
  const layout = layoutTimeline(rich, box), plain = layoutTimeline(events, box);
  const shapes = layout.markers.map((marker) => timelineMarkerShapes(marker, colors));
  const [done, current, planned] = shapes;
  assert.deepEqual(done, [{ role: 'marker', shape: 'ellipse', cx: layout.markers[0].x, cy: layout.markers[0].y, radius: layout.markers[0].radius, fill: colors.primary }]);
  assert.deepEqual(timelineMarkerShapes(plain.markers[0], colors).map((shape) => ({ ...shape, cx: 0, cy: 0 })), done.map((shape) => ({ ...shape, cx: 0, cy: 0, radius: plain.markers[0].radius })));
  assert.deepEqual(current.map((shape) => shape.role), ['ring', 'marker']);
  assert.equal(current[0].fill, colors.background); assert.equal(current[0].stroke.color, colors.primary);
  assert.equal(current[1].fill, colors.primary); assert.equal(current[1].stroke, undefined);
  // One rule: the drawn ellipse of the ring is exactly 1.6 times the marker's, and every marker ellipse has the marker radius.
  assert.equal(current[0].radius, layout.markers[1].ring.radius); assert.equal(current[0].radius, 1.6 * layout.markers[1].radius);
  assert.equal(current[1].radius, layout.markers[1].radius);
  assert.equal(planned.length, 1);
  assert.equal(planned[0].fill, colors.background); assert.equal(planned[0].stroke.color, colors.primary);
  assert.equal(planned[0].radius, layout.markers[2].radius); assert.equal(planned[0].radius, done[0].radius);
});

test('planned text is the muted color kept at 4.5:1; other text keeps the normal color', () => {
  for (const background of ['#FFFFFF', '#0B1220', '#F4EDE0', '#777777']) {
    const palette = { ...colors, background, text: contrastRatio('#FFFFFF', background) > 4.5 ? '#FFFFFF' : '#000000', mutedText: '#9CA3AF' };
    assert.equal(timelineTextColor({}, palette), palette.text);
    assert.equal(timelineTextColor({ status: 'done' }, palette), palette.text);
    assert.equal(timelineTextColor({ status: 'current' }, palette), palette.text);
    const planned = timelineTextColor({ status: 'planned' }, palette);
    assert.ok(contrastRatio(planned, background) >= TIMELINE_TEXT_MIN_CONTRAST, `${background} ${planned}`);
  }
  assert.equal(timelineTextColor({ status: 'planned' }, { ...colors, mutedText: '#374151' }), '#374151');
  // An outline that is too faint is darkened or lightened to 3:1.
  const faint = layoutTimeline(withStatus('planned'), box).markers[0];
  const [shape] = timelineMarkerShapes(faint, { ...colors, primary: '#E5E7EB' });
  assert.ok(contrastRatio(shape.stroke.color, colors.background) >= 3);
});

test('composition carries the status through nested layouts', () => {
  const slide = { title: 'Roadmap', timeline: rich };
  const composition = composeSlide(slide, { explain: true });
  const layout = composition.items.find((item) => item.timelineLayout).timelineLayout;
  assert.deepEqual(layout.markers.map((marker) => marker.status), ['done', 'current', 'planned']);
});

test('pagination keeps each event with its status', () => {
  const many = Array.from({ length: 8 }, (_, index) => ({ when: `Q${index + 1}`, what: `Milestone ${index + 1}`, description: 'Keep every label inside its allocated space and preserve every source detail.', status: ['done', 'current', 'planned'][index % 3] }));
  const paged = paginateSlide({ title: 'Plan', timeline: { events: many }, composition: { minFontSize: 32 } }, { minFontSize: 32 });
  assert.ok(paged.slides.length > 1);
  assert.deepEqual(paged.slides.flatMap((slide) => slide.timeline.events), many);
});

test('Markdown writes and reads status as a task-list prefix and round-trips it', () => {
  const deck = { slides: [{ title: 'Roadmap', timeline: { name: 'Plan', events: [
    { when: '2025', what: 'Research', description: 'Interviews.', status: 'done' },
    { when: '2026', what: 'Pilot', status: 'current' },
    { what: 'Scale', status: 'planned' },
    { when: '2027', what: 'Review' },
  ] } }] };
  const { markdown, report } = opfToMarkdown(deck);
  assert.equal(report.lossless, true);
  assert.match(markdown, /```timeline name="Plan"\n\[x\] 2025 — Research\n {2}Interviews\.\n\[>\] 2026 — Pilot\n\[ \] Scale\n2027 — Review\n```/);
  assert.deepEqual(markdownToOpf(markdown).document.slides[0].timeline, deck.slides[0].timeline);
  const parsed = markdownToOpf('# T\n\n```timeline\n[x] Done thing\n[>] Doing thing\n[ ] Later thing\n```\n').document.slides[0].timeline;
  assert.deepEqual(parsed, [{ what: 'Done thing', status: 'done' }, { what: 'Doing thing', status: 'current' }, { what: 'Later thing', status: 'planned' }]);
  assert.equal(validatePresentation({ slides: [{ timeline: parsed }] }).valid, true);
});

test('Markdown keeps event text that looks like a status mark', () => {
  const deck = { slides: [{ title: 'T', timeline: [{ what: '[x] literal' }, { what: 'Plain' }] }] };
  const { markdown } = opfToMarkdown(deck);
  assert.deepEqual(markdownToOpf(markdown).document.slides[0].timeline, deck.slides[0].timeline);
  const marked = { slides: [{ title: 'T', timeline: [{ what: '[x] literal', status: 'planned' }] }] };
  assert.deepEqual(markdownToOpf(opfToMarkdown(marked).markdown).document.slides[0].timeline, marked.slides[0].timeline);
});

test('conversions that cannot show status say so', () => {
  const value = { timeline: withStatus('done', 'current') };
  for (const to of ['list', 'text', 'table']) assert.ok(convertContent(value, to).loss.includes('timeline event status'), to);
  assert.deepEqual(convertContent({ timeline: events }, 'list').loss, []);
});
