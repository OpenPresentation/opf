import assert from 'node:assert/strict';
import { slideScene } from '../dist/slide-scene.js';
import { composeSlideGeometry } from '../dist/slide-adapter.js';
import { drawnTracks, prepareSceneTrackResize } from '../dist/slide-edits.js';

// CE-20: the first resize of a content-sized track starts from what is drawn. A column without weights is stacked at the heights its
// blocks need, so its rows do not fill it; weights fill the container. Before the fix the first nudge of such a divider jumped from where it
// was drawn (about 26% of the pair) to the middle (about 48%). `drawnTracks` reads the drawn heights as weights, the last row taking the empty
// space below, and maps the drawn fraction onto them, so every divider stays where it is drawn and the first nudge moves it one step.
const scene = (deck, index = 0) => slideScene(deck, index, { geometry: composeSlideGeometry(deck, index) });
const dividers = (container) => container.tracks.slice(0, -1).map((track) => track.start + track.length);
const stack = { name: 'Stack', slides: [{ id: 's', title: 'A stack', composition: { mode: 'column' }, blocks: [{ id: 'a', text: 'Short line' }, { id: 'b', text: 'Another short line' }, { id: 'c', text: 'Third' }] }] };

const before = scene(stack);
const container = before.node(before.slideKey).container;
assert.equal(container.mode, 'column');
const drawn = drawnTracks(before.flowOf(before.slideKey));
assert.equal(drawn.drawn, true, 'a stacked column is read from its drawn heights');
assert.ok(drawn.weights.every((weight) => weight > 0 && weight <= 100), `weights core accepts: ${drawn.weights}`);
assert.ok(drawn.weights.at(-1) > drawn.weights[0], 'the last row takes the empty space');

// The divider where it is drawn: nothing moves (the last row grows to fill).
const [first, second] = container.tracks;
const atRest = prepareSceneTrackResize(stack, before, before.slideKey, 0, first.length / (first.length + second.length));
const rest = scene(atRest.presentation).node(before.slideKey).container;
dividers(container).forEach((at, index) => assert.ok(Math.abs(dividers(rest)[index] - at) < 0.004, `divider ${index} stays at ${at.toFixed(3)} (now ${dividers(rest)[index].toFixed(3)})`));

// A small nudge moves the first divider a little, not to the middle of the pair.
const nudged = prepareSceneTrackResize(stack, before, before.slideKey, 0, (first.length / (first.length + second.length)) + 0.1);
const after = scene(nudged.presentation).node(before.slideKey).container;
const pair = second.start + second.length - first.start;
const moved = (dividers(after)[0] - dividers(container)[0]) / pair;
assert.ok(moved > 0 && moved <= 0.25, `the first nudge moves the divider one step: ${(moved * 100).toFixed(1)}% of the pair`);
assert.ok(Math.abs(dividers(after)[1] - dividers(container)[1]) < 0.004, 'the other divider stays where it is drawn');

// A container that already has weights, or tracks that fill it, is unchanged by the rule.
const weighted = { name: 'Row', slides: [{ id: 'r', title: 'A row', composition: { mode: 'row', weights: [2, 1] }, blocks: [{ id: 'x', text: 'Left' }, { id: 'y', text: 'Right' }] }] };
const row = scene(weighted);
const plain = drawnTracks(row.flowOf(row.slideKey));
assert.deepEqual(plain, { ...plain, weights: [2, 1], drawn: false });
assert.equal(plain.scale(0), 1);
const resized = prepareSceneTrackResize(weighted, row, row.slideKey, 0, 0.5);
assert.deepEqual(resized.weights, [1, 1], 'a weighted row resizes as before');
console.log('studio tracks: a content-sized column starts from its drawn heights; weighted containers resize as before');
