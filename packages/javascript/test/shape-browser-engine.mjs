// Run under `node --conditions=browser` by sh-02-shape-engine.test.mjs: `#shape-engine` resolves to the lazy engine, as in a browser bundle.
import assert from 'node:assert/strict';
import { composeSlide, ensureShapes, imageShape, shapesPending } from '../dist/composition.js';

const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
// Pictures masked by the four built-in masks need nothing loaded.
const pictures = { slides: [{ title: 'Team', blocks: [{ image: photo, shape: 'ellipse' }, { image: photo, shape: 'roundRect', adjust: { adj: 0.2 } }, { image: photo, shape: 'hexagon' }] }] };
assert.deepEqual(shapesPending(pictures), []);
assert.equal(imageShape('roundRect', { x: 0, y: 0, width: 100, height: 50 }).preset, 'roundRect');
// A shape block, a custom path or another mask needs the geometry.
assert.deepEqual(shapesPending({ slides: [{ blocks: [{ shape: 'chevron', text: 'Plan' }] }] }), ['shapes']);
assert.deepEqual(shapesPending({ slides: [{ blocks: [{ path: 'M0 0 L1 1 L0 1 Z' }] }] }), ['shapes']);
assert.deepEqual(shapesPending({ slides: [{ blocks: [{ image: photo, shape: 'star5' }] }] }), ['shapes']);
// Before it loads, a shape composes with its frame and text and no outline; a star mask is drawn as a rectangle.
const deck = { slides: [{ title: 'Plan', blocks: [{ shape: 'chevron', text: 'Plan', adjust: { adj: 0.9 } }, { image: photo, shape: 'star5' }] }] };
const before = composeSlide(deck.slides[0], { presentation: deck });
const shape = before.items.find((item) => item.field === 'shape');
assert.equal(shape.shape.loading, true);
assert.deepEqual(shape.shape.paths, []);
assert.ok(shape.text);
assert.equal(before.items.find((item) => item.field === 'image').image.shape.preset, 'rect');
assert.deepEqual(await ensureShapes(deck), ['shapes']);
assert.deepEqual(shapesPending(deck), []);
assert.deepEqual(await ensureShapes(deck), []);
const after = composeSlide(deck.slides[0], { presentation: deck });
const drawn = after.items.find((item) => item.field === 'shape');
assert.equal(drawn.shape.loading, undefined);
assert.ok(drawn.shape.paths.length > 0);
assert.equal(after.items.find((item) => item.field === 'image').image.shape.preset, 'star5');
console.log('lazy shape engine: ok');
