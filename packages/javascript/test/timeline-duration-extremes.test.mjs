// A timeline whose durations the schema accepts must never make composition throw: an extreme ratio gives the short event a minimum share.
import assert from 'node:assert/strict';
import test from 'node:test';
import { composeSlide, layoutTimeline } from '../dist/composition.js';
import { validate } from '../dist/index.js';

const RATIOS = [[1, 1e-17], [1e-300, 1e300], [1e300, 1e-300], [1, 1, 1e-17, 5], [Number.MAX_VALUE, Number.MIN_VALUE, 1], [Number.MIN_VALUE, Number.MIN_VALUE]];
const events = (durations) => durations.map((duration, index) => ({ when: `T${index}`, what: `Event ${index}`, duration }));

for (const durations of RATIOS)
	test(`durations ${durations.join(', ')} are schema-valid and compose without throwing`, () => {
		const deck = { name: 'Extreme', slides: [{ title: 'Plan', timeline: events(durations) }] };
		assert.equal(validate(deck, { only: ['format'] }).valid, true);
		const out = layoutTimeline(events(durations), { x: 0, y: 0, width: 800, height: 400 });
		assert.equal(out.ranges.length, durations.length);
		for (const range of out.ranges) assert.ok(range.box.width > 0 && Number.isFinite(range.box.width), 'every range keeps a positive finite size');
		const sum = out.ranges.reduce((total, range) => total + range.box.width, 0);
		assert.ok(Math.abs(sum - 800) < 1e-6, `the ranges still fill the box (${sum})`);
		assert.doesNotThrow(() => composeSlide(deck.slides[0]));
	});

test('ordinary ratios are unchanged by the minimum share', () => {
	const out = layoutTimeline(events([1, 4, 1]), { x: 0, y: 0, width: 1200, height: 500 });
	assert.ok(Math.abs(out.ranges[1].box.width - 4 * out.ranges[0].box.width) < 1e-7);
});
