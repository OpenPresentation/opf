import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validate} from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';

const slide = shapes => ({blocks: [{id: 'target', text: 'The launch begins in March.'}], shapes});
const document = shapes => ({slides: [slide(shapes)]});
const shape = at => ({shape: 'rect', at: {block: 'target', edge: 'center', ...at}});
const compose = shapes => composeSlide(slide(shapes), {width: 1280, height: 720});
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} versus ${expected}`);

test('anchored fractions have no 1 versus 1.01 pixel discontinuity', () => {
  const result = compose([shape({width: 1, height: 1}), shape({width: 1.01, height: 1.01}), shape({widthPx: 1.01, heightPx: 40}), shape({width: 1.5, heightPx: 40})]);
  const target = result.items.find(item => item.path === 'slides.0.blocks.0.text').box;
  const [same, larger, pixels, mixed] = result.overlayShapes.map(item => item.box);
  near(same.width, target.width); near(same.height, target.height);
  near(larger.width, target.width * 1.01); near(larger.height, target.height * 1.01);
  near(pixels.width, 1.01); near(pixels.height, 40);
  near(mixed.width, target.width * 1.5); near(mixed.height, 40);
});

test('duplicate units and nonpositive anchor sizes refuse, while dimensions can exceed their target', () => {
  for (const at of [{width: 0.5, widthPx: 40}, {height: 0.5, heightPx: 40}, {width: 0}, {heightPx: 0}, {width: -1}, {widthPx: 1281}])
    assert.equal(validate(document([shape(at)]), {only: ['format']}).valid, false, JSON.stringify(at));
  for (const at of [{width: 1.01}, {width: 9}, {width: 50, heightPx: 1280}])
    assert.equal(validate(document([shape(at)]), {only: ['format']}).valid, true, JSON.stringify(at));
  const conflict = compose([shape({width: 0.5, widthPx: 40})]);
  assert.equal((conflict.overlayShapes ?? []).length, 0, 'composition does not silently select a unit when validation was skipped');
  // RR-105: a frame composition cannot place is reported and left out, never thrown.
  const far = compose([shape({width: 1e300, height: 0.5})]);
  assert.equal((far.overlayShapes ?? []).length, 0);
  assert.ok(far.diagnostics.some(d => d.code === 'unresolved-content' && /safe integer native coordinate/.test(d.message)));
});
