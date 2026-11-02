// LH-41: several timelines in one region are horizontal bands, one gap apart (two columns when one does not fit), never vertical rails
// side by side; a timeline's measured height includes its label bands; labels alternate only when wider than their spacing; notes
// come after the bands; a lone timeline may grow its type a little when it fits.
import { gallery } from '@openpresentation/gallery';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { composeSlide, layoutTimeline } from '../dist/composition.js';

const { layouts } = gallery;
const events = (label) => ['Baseline', 'Pilot', 'Scale', 'Embed'].map((what, index) => ({ when: ['Jun', 'Jul', 'Aug', 'Sep'][index], what, description: `${label} ${what.toLowerCase()} step.` }));
const timeline = (index, full = true) => ({ timeline: full ? { name: `Path ${index + 1}`, description: `Milestones for team ${index + 1}.`, events: events(`Team ${index + 1}`) } : events(`Team ${index + 1}`) });
const note = { text: 'Focus the next cycle on the pilot and make the tradeoffs clear.' };
const bottom = (box) => box.y + box.height;
const ink = (item) => item.timelineLayout.bounds;
const overlaps = (a, b) => a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01 && a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;
const timelines = (composed) => composed.items.filter((item) => item.field === 'timeline');

describe('several timelines in one region are a stack of bands', () => {
	test('two timelines and a note in the timeline layout: both bands in the region, the note after them, no ink over text', () => {
		const composed = composeSlide({ title: 'Execution', blocks: [timeline(0), note, timeline(1)] }, { layout: layouts.timeline });
		assert.deepEqual(composed.diagnostics, []);
		const [first, second] = timelines(composed);
		assert.equal(first.region, 'timeline');
		assert.equal(second.region, 'timeline', 'the second timeline is not drawn below the grid');
		for (const item of [first, second]) {
			assert.equal(item.timelineLayout.arrangement, 'band');
			assert.ok(ink(item).y >= item.box.y - 0.01 && bottom(ink(item)) <= bottom(item.box) + 0.01, 'the measured height holds the label bands');
		}
		assert.ok(second.box.y >= bottom(first.box), 'one band below the other');
		const text = composed.items.find((item) => item.field === 'text');
		assert.ok(text.box.y >= bottom(ink(second)), 'the note comes after the bands');
		assert.ok(!overlaps(ink(first), ink(second)) && !overlaps(ink(second), text.box));
	});

	test('four timelines in the process layout are compact bands at one size, never vertical rails', () => {
		const composed = composeSlide({ title: 'Paths', blocks: [0, 1, 2, 3].map((index) => timeline(index, false)) }, { layout: layouts.process });
		const items = timelines(composed);
		assert.equal(items.length, 4);
		for (const item of items) assert.equal(item.timelineLayout.arrangement, 'band');
		const sizes = new Set(items.flatMap((item) => item.timelineLayout.parts.filter((part) => part.role === 'what').map((part) => part.fit.fontSize)));
		assert.equal(sizes.size, 1, 'the bands of a stack read at one size');
		assert.ok([...sizes][0] <= 18, 'compact role size');
		// A compact band sets each when and what on one row below the marker.
		const [what] = items[0].timelineLayout.parts.filter((part) => part.role === 'what');
		const [when] = items[0].timelineLayout.parts.filter((part) => part.role === 'when');
		assert.ok(Math.abs(bottom(when.box) - bottom(what.box)) < 0.01 && when.box.x < what.box.x);
		assert.ok(when.box.y > items[0].timelineLayout.markers[0].y);
		for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) assert.ok(!overlaps(ink(items[i]), ink(items[j])));
	});

	test('many full timelines go two up and report overflow rather than turning vertical', () => {
		const composed = composeSlide({ title: 'Paths', blocks: Array.from({ length: 6 }, (_, index) => timeline(index)) }, { layout: layouts.process });
		const items = timelines(composed);
		assert.ok(items.every((item) => item.timelineLayout.arrangement !== 'vertical'));
		const xs = new Set(items.map((item) => Math.round(item.box.x)));
		assert.equal(xs.size, 2, 'two columns of bands');
		const fits = items.every((item) => bottom(ink(item)) <= bottom(item.box) + 0.01);
		assert.ok(fits || composed.diagnostics.some((entry) => entry.code === 'text-overflow'), 'either every band fits or the overflow is reported');
	});

	test('an odd last band in two columns spans both', () => {
		const composed = composeSlide({ title: 'Paths', blocks: Array.from({ length: 5 }, (_, index) => timeline(index)) }, { layout: layouts.process });
		const items = timelines(composed);
		if (new Set(items.map((item) => Math.round(item.box.x))).size === 2) assert.ok(items[4].box.width > items[0].box.width * 1.5);
	});
});

describe('one timeline', () => {
	test('labels within their spacing sit in one band; wider labels alternate', () => {
		const short = layoutTimeline(events('Team'), { x: 0, y: 0, width: 1100, height: 400 });
		assert.equal(short.arrangement, 'band');
		assert.equal(new Set(short.markers.map((marker) => marker.y)).size, 1);
		const long = layoutTimeline(events('Team').map((event) => ({ ...event, what: `${event.what} with every regional team at once` })), { x: 0, y: 0, width: 1100, height: 500 });
		assert.equal(long.arrangement, 'alternating');
	});

	test('bounds cover every part and marker', () => {
		const layout = layoutTimeline({ name: 'Plan', events: events('Team') }, { x: 10, y: 20, width: 1000, height: 600 });
		for (const part of layout.parts) assert.ok(part.box.y >= layout.bounds.y - 1e-9 && bottom(part.box) <= bottom(layout.bounds) + 1e-9);
		for (const marker of layout.markers) assert.ok(marker.y - marker.radius >= layout.bounds.y - 1e-9);
	});

	test('the size offset starts the search smaller or at the floor, never below it', () => {
		const floor = layoutTimeline(events('Team'), { x: 0, y: 0, width: 1100, height: 400 }, { sizeOffset: -1000 });
		assert.ok(floor.parts.every((part) => part.fit.fontSize === 16));
		const compact = layoutTimeline(events('Team'), { x: 0, y: 0, width: 1100, height: 400 }, { compact: true });
		assert.equal(compact.parts.find((part) => part.role === 'what').fit.fontSize, 18);
	});

	test('a lone timeline in its region grows its type a little when it fits', () => {
		const composed = composeSlide({ title: 'Plan', blocks: [{ timeline: events('Team').slice(0, 3).map(({ when, what }) => ({ when, what })) }] }, { layout: layouts.timeline });
		const [item] = timelines(composed);
		const what = item.timelineLayout.parts.find((part) => part.role === 'what').fit.fontSize;
		assert.ok(what > 22 && what <= 26, `${what}`);
		assert.deepEqual(composed.diagnostics, []);
	});

	test('a horizontal-only band never turns vertical in a narrow box', () => {
		const layout = layoutTimeline(events('Team'), { x: 0, y: 0, width: 420, height: 400 }, { horizontal: true });
		assert.notEqual(layout.arrangement, 'vertical');
		assert.equal(layoutTimeline(events('Team'), { x: 0, y: 0, width: 420, height: 400 }).arrangement, 'vertical');
	});
});
