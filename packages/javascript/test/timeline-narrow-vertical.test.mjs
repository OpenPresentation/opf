// WI-5 (P22): below about 8 ems of the label size per event (176 px at the 22 px label size), a timeline is composed vertically: the same
// events, markers, statuses and order, stacked down the cell. The full-width timeline keeps its alternating arrangement.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { layoutTimeline } from '../dist/composition.js';

const events = [
	{ when: 'Week 1', what: 'Close access', description: 'Resolve the two known blockers.', status: 'done' },
	{ when: 'Week 2', what: 'Rehearse support', description: 'Review the exception route.', status: 'current' },
	{ when: 'Week 3', what: 'Add pilot team', description: 'Keep one workflow in scope.', status: 'planned' },
];
const measurement = { measure: (text, size) => [...text].length * size * 0.5 };
const compose = (width, height = 440, value = events) => layoutTimeline(value, { x: 0, y: 0, width, height }, { textMeasurement: measurement });
const texts = (layout) => layout.parts.map((part) => part.text);

describe('a narrow cell composes vertically', () => {
	test('per-event widths below 8 ems of the label size stack the events down the cell', () => {
		for (const width of [360, 440, 520]) {
			const layout = compose(width);
			assert.equal(layout.arrangement, 'vertical', `${width} px`);
			assert.equal(layout.overflow, false, `${width} px`);
			assert.equal(layout.connector.x1, layout.connector.x2, 'the markers share one rail');
			assert.ok(layout.connector.y2 > layout.connector.y1);
		}
	});

	test('the events keep their order, markers and statuses', () => {
		const layout = compose(400);
		assert.deepEqual(layout.markers.map((marker) => marker.status), ['done', 'current', 'planned']);
		assert.deepEqual(layout.markers.map((marker) => marker.eventIndex), [0, 1, 2]);
		assert.ok(layout.markers[0].y < layout.markers[1].y && layout.markers[1].y < layout.markers[2].y);
		assert.deepEqual(texts(layout), events.flatMap((event) => [event.when, event.what, event.description]));
		assert.ok(layout.markers[1].ring, 'the current event keeps its ring');
	});

	test('no label breaks inside a word', () => {
		const layout = compose(400);
		for (const part of layout.parts) {
			const lines = part.fit.sourceLines.map((line) => part.text.slice(line.start, line.end));
			assert.deepEqual(lines.join(' ').split(/\s+/u).filter(Boolean), part.text.split(/\s+/u).filter(Boolean), part.text);
		}
	});

	test('the label size is kept at its role sizes', () => {
		const layout = compose(400);
		const size = (role) => layout.parts.find((part) => part.role === role).fit.fontSize;
		assert.equal(size('what'), 22);
		assert.equal(size('when'), 18);
		assert.equal(size('event-description'), 18);
	});
});

describe('the threshold is 8 ems of the label size per event', () => {
	test('three events switch between 527 and 529 px', () => {
		assert.equal(compose(527).arrangement, 'vertical');
		assert.equal(compose(529, 600).arrangement, 'alternating');
	});

	test('the threshold follows the slide scale', () => {
		const scaled = (width) => layoutTimeline(events, { x: 0, y: 0, width, height: 880 }, { scale: 2, textMeasurement: measurement });
		assert.equal(scaled(1054).arrangement, 'vertical');
		assert.equal(scaled(1058).arrangement, 'alternating');
	});
});

describe('the full-width timeline is unchanged', () => {
	const wide = { x: 0, y: 0, width: 1100, height: 400 };
	const five = Array.from({ length: 5 }, (_, index) => ({ when: `Week ${index + 1}`, what: `Milestone ${index + 1}` }));

	test('it alternates its labels above and below one horizontal connector', () => {
		const layout = layoutTimeline(five, wide, { textMeasurement: measurement });
		assert.equal(layout.arrangement, 'alternating');
		assert.equal(layout.connector.y1, layout.connector.y2);
		const ys = new Set(layout.markers.map((marker) => marker.y));
		assert.equal(ys.size, 1);
		assert.equal(layout.attempts, 1);
	});

	test('a single event and a single column never go vertical for width', () => {
		assert.equal(layoutTimeline([{ what: 'Only' }], { x: 0, y: 0, width: 200, height: 300 }, { textMeasurement: measurement }).arrangement, 'alternating');
	});

	test('a narrow cell that cannot stack falls back to the usual search', () => {
		const many = Array.from({ length: 12 }, (_, index) => ({ when: `W${index + 1}`, what: `Step ${index + 1}`, description: 'A detail line.' }));
		const layout = layoutTimeline(many, { x: 0, y: 0, width: 400, height: 200 }, { textMeasurement: measurement });
		assert.ok(layout.attempts > 1);
		assert.equal(layout.markers.length, 12);
	});
});
