// The release qualification corpus (qualification/): the manifest names existing decks and known checks, every feature points at a
// deck and variant the build exports, and the grader reads a probe the way the Windows runner writes it. Office-free.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadManifest, parseArgs, pptxName } from './qualification/build.mjs';
import { gradeCheck, slideFacts } from './qualification/evaluate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = loadManifest();

test('qualification: every deck exists and parses, ids are unique', () => {
  const ids = manifest.decks.map((deck) => deck.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const deck of manifest.decks) {
    const file = path.join(root, deck.source);
    assert.ok(existsSync(file), deck.source);
    if (file.endsWith('.json')) assert.ok(Array.isArray(JSON.parse(readFileSync(file, 'utf8')).slides), deck.source);
    for (const variant of deck.variants ?? []) assert.ok(Array.isArray(variant.flags ?? []) && variant.name, `${deck.id} variant`);
  }
});

test('qualification: every feature names a deck, a variant and checks the manifest defines', () => {
  const decks = new Map(manifest.decks.map((deck) => [deck.id, deck]));
  const ids = manifest.features.map((feature) => feature.id);
  assert.equal(new Set(ids).size, ids.length, 'feature ids are unique');
  for (const feature of manifest.features) {
    const deck = decks.get(feature.deck);
    assert.ok(deck, `${feature.id}: deck ${feature.deck}`);
    const variants = (deck.variants ?? [{ name: 'default' }]).map((variant) => variant.name);
    assert.ok(variants.includes(feature.variant ?? 'default'), `${feature.id}: variant ${feature.variant}`);
    for (const check of feature.checks) assert.ok(check in manifest.checks, `${feature.id}: check ${check}`);
    for (const slide of feature.slides ?? []) assert.ok(Number.isInteger(slide) && slide > 0, `${feature.id}: slide ${slide}`);
  }
});

test('qualification: build arguments and file names', () => {
  assert.throws(() => parseArgs([]), /--out/);
  assert.deepEqual([...parseArgs(['--out', 'x', '--only', 'a,b']).only], ['a', 'b']);
  assert.equal(pptxName({ id: 'smartart' }, { name: 'default' }), 'smartart.pptx');
  assert.equal(pptxName({ id: 'smartart' }, { name: 'shapes' }), 'smartart~shapes.pptx');
});

test('qualification: the grader reads a probed slide', () => {
  const slide = {
    shapes: [
      { name: 'SmartArt', type: 24, smartArt: { layout: 'Basic Pyramid', layoutId: 'urn:x/pyramid1', nodes: 3, texts: ['A', 'B', 'C'], sizes: [24, 24, 24] }, children: [{ name: 'node', type: 1, text: { text: 'A', overflow: ['right'], autoSize: 0 } }] },
      { name: 'Line', type: 1, text: { text: 'Too wide', overflow: ['right'], autoSize: 0, bound: [0, 0, 10, 10] }, box: [0, 0, 5, 10] },
      { name: 'Connector', type: 1, connector: { type: 1, begin: true, end: true } },
      { name: 'Chart', type: 3, chart: { type: 51, series: 1 } },
    ],
    smartArtEdits: [{ sizesKept: true, framesKept: true, sizesBefore: [24], sizesAfter: [24] }],
    footer: { footer: true, slideNumber: true, date: false },
  };
  const facts = [slideFacts(slide)];
  assert.equal(facts[0].overflow.length, 1, 'text inside SmartArt is PowerPoint\'s own layout, not an overflow');
  const probe = { opened: true, slideCount: 1, previewSlides: 1, openSeconds: 1 };
  assert.equal(gradeCheck('opens', {}, probe, facts).status, 'pass');
  assert.equal(gradeCheck('noOverflow', {}, probe, facts).status, 'fail');
  assert.equal(gradeCheck('smartArt', { slides: [1], expect: { nodes: [3], layouts: ['pyramid'] } }, probe, facts).status, 'pass');
  assert.equal(gradeCheck('smartArt', { slides: [1], expect: { nodes: [4] } }, probe, facts).status, 'fail');
  assert.equal(gradeCheck('noSmartArt', { slides: [1] }, probe, facts).status, 'fail');
  assert.equal(gradeCheck('connectors', { slides: [1] }, probe, facts).status, 'pass');
  assert.equal(gradeCheck('nativeChart', { slides: [1] }, probe, facts).status, 'pass');
  assert.equal(gradeCheck('footer', { slides: [1], expect: { footer: [{ footer: true, date: true }] } }, probe, facts).status, 'fail');
  assert.equal(gradeCheck('slides', {}, { ...probe, slideCount: 2 }, facts).status, 'fail');
  assert.equal(gradeCheck('noOverflow', {}, { opened: false }, facts).status, 'not-run');
});
