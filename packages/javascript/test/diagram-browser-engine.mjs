// Run under `node --conditions=browser` by diagram.test.mjs: `#diagram-engine` resolves to the lazy engine, as in a browser bundle.
import assert from 'node:assert/strict';
import { checkDiagram, composeSlide, diagramsPending, ensureDiagrams } from '../dist/composition.js';

const deck = { slides: [{ title: 'Flow', diagram: 'flowchart LR\n  A --> B' }, { title: 'Order', blocks: [{ text: 'Context' }, { diagram: { source: 'sequenceDiagram\n  A->>B: hi' } }] }] };
assert.deepEqual(diagramsPending(deck), ['flowchart', 'sequence']);
assert.equal(checkDiagram(deck.slides[0].diagram).issue.code, 'diagram-unloaded');
const before = composeSlide(deck.slides[0], { width: 1920, height: 1080, scale: 1.5 });
assert.equal(before.items.find(item => item.field === 'diagram').diagram.issue.code, 'diagram-unloaded');
assert.equal(before.diagnostics.some(entry => entry.code === 'unresolved-content'), false, 'a type still loading is no finding');
assert.deepEqual(await ensureDiagrams(deck), ['flowchart', 'sequence']);
assert.deepEqual(diagramsPending(deck), []);
assert.deepEqual(await ensureDiagrams(deck), []);
const after = composeSlide(deck.slides[0], { width: 1920, height: 1080, scale: 1.5 });
assert.ok(after.items.find(item => item.field === 'diagram').diagram.svg.startsWith('<svg'));
// A type the page never loaded is still reported as loading, not as an error of the document; an unknown one is an error.
assert.deepEqual(diagramsPending({ diagram: 'pie\n  "A" : 1' }), ['pie']);
assert.equal(checkDiagram('not a diagram').issue.code, 'diagram-unsupported');
console.log('lazy diagram engine: ok');
