import assert from 'node:assert/strict';
import { MAX_EXACT_SOURCE_LENGTH, createSourceMemory, findDuplicateKey, updateJsonSource } from '../src/exact-source.js';

// Exact-source memory: only edited tokens are rewritten, and Escape/Undo/Redo restore the
// authored bytes (escapes and irregular whitespace included), even after long typing drafts.
const original = [
  '{ "name"  :   "Caf\\u00e9 \\/ Deck",',
  '\t"slides" : [ {"title":   "Caf\\u00e9 \\/ Q1" ,  "text":"Line one\\nLine two \\/ \\u00e9" },',
  '    { "title" :"Items", "items": [ "Onboard caf\\u00e9s \\/ partners"  ,',
  '\t"Second\\u00a0\\/ item" ] } ]',
  '}',
  '',
].join('\n');
const doc = JSON.parse(original);
const edit = (change) => { const next = structuredClone(doc); change(next); return next; };
const memory = createSourceMemory();

// Only the edited token changes; every other byte is untouched. A plain JSON.stringify of
// the restored value would have produced "Café / Q1", the bug this guards against.
const titleDoc = edit((d) => { d.slides[0].title = 'Draft'; });
const titleSource = updateJsonSource(original, titleDoc, memory);
assert.equal(titleSource, original.replace('"Caf\\u00e9 \\/ Q1"', '"Draft"'));
assert.equal(updateJsonSource(titleSource, doc, memory), original, 'restoring the authored value returns its exact bytes');
assert.equal(updateJsonSource(original, titleDoc, memory), titleSource, 'redo returns the exact edited bytes');

// Long typing drafts on one field must not push the authored spelling out of the memory.
let source = original;
for (let index = 1; index <= 300; index += 1) source = updateJsonSource(source, edit((d) => { d.slides[0].title = `Draft ${index}`; }), memory);
assert.equal(source, original.replace('"Caf\\u00e9 \\/ Q1"', '"Draft 300"'));
assert.equal(updateJsonSource(source, doc, memory), original, 'Escape after a long draft restores the authored bytes');
assert.ok(memory.entries.size <= memory.limit, 'the memory is bounded');

// A chain of committed edits restores step by step, in both directions.
const firstDoc = edit((d) => { d.slides[1].items[0] = 'Committed bullet'; });
const secondDoc = structuredClone(firstDoc);
secondDoc.slides[0].text = 'Replaced text';
const first = updateJsonSource(original, firstDoc, memory);
const second = updateJsonSource(first, secondDoc, memory);
assert.equal(updateJsonSource(second, firstDoc, memory), first);
assert.equal(updateJsonSource(first, doc, memory), original);
assert.equal(updateJsonSource(original, firstDoc, memory), first);
assert.equal(updateJsonSource(first, secondDoc, memory), second);

// Removing and re-adding a key restores the exact bytes around it.
const removed = updateJsonSource(original, edit((d) => { delete d.slides[0].text; }), memory);
assert.ok(!removed.includes('"text"'));
assert.equal(updateJsonSource(removed, doc, memory), original, 'undoing a removal restores whitespace and commas');

// Typing in the source is a new authored spelling of the same value: it wins over older bytes.
const retyped = original.replace('"Caf\\u00e9 \\/ Q1"', '"Café / Q1"');
const retypedEdit = updateJsonSource(retyped, titleDoc, memory);
assert.equal(updateJsonSource(retypedEdit, doc, memory), retyped);

// Unchanged documents, separate memories and invalid sources.
assert.equal(updateJsonSource(original, doc, createSourceMemory()), original);
assert.equal(updateJsonSource('{"title":"a"}', { title: 'b' }, createSourceMemory()), '{"title":"b"}');
assert.throws(() => updateJsonSource('{', {}, createSourceMemory()));
// Review fixes: duplicate keys, structural array edits, manual respellings, byte cap and limit flag.
{
  const parsed = (text) => JSON.parse(text);

  // A repeated object key must never lose the edit (the first token would be rewritten while
  // JSON.parse keeps the last one). Fall back to indented JSON for that edit.
  for (const [source, next] of [
    ['{"a":1,"a":2}', { a: 3 }],
    ['{"x":{"a":1,"a":2},"y":1}', { x: { a: 3 }, y: 1 }],
    ['[{"a":1,"a":2}]', [{ a: 3 }]],
    ['{"slides":[{"title":"t","title":"u"}]}', { slides: [{ title: 'v' }] }],
  ]) {
    const result = updateJsonSource(source, next, createSourceMemory());
    assert.deepEqual(parsed(result), next, `duplicate keys keep the edit: ${source}`);
  }
  // An edit elsewhere leaves the duplicated keys, and every other byte, alone.
  assert.equal(updateJsonSource('{"a":1,"a":2,"b":1}', { a: 2, b: 9 }, createSourceMemory()), '{"a":1,"a":2,"b":9}');
  assert.deepEqual(findDuplicateKey('{"a":1,"a":2}'), { key: 'a', path: [] });
  assert.deepEqual(findDuplicateKey('{"s":[{"t":1},{"t":2,"t":3}]}'), { key: 't', path: ['s', 1] });
  assert.equal(findDuplicateKey('{"a":{"a":1},"b":[{"a":1},{"a":2}]}'), null);
  assert.equal(findDuplicateKey('{'), null);

  // Adding or removing array elements keeps every untouched sibling token, escapes included.
  const slides = '{\n  "slides": [\n    { "title": "Caf\\u00e9 \\/ A" },\n    { "title": "B \\/ two" },\n    { "title": "C\\u00e9" }\n  ]\n}\n';
  const deck = parsed(slides);
  const siblings = ['{ "title": "Caf\\u00e9 \\/ A" }', '{ "title": "B \\/ two" }', '{ "title": "C\\u00e9" }'];
  const withSlides = (...list) => ({ slides: list.map((title) => ({ title })) });
  for (const [label, next, kept] of [
    ['append', withSlides('Café / A', 'B / two', 'Cé', 'New'), [0, 1, 2]],
    ['insert in the middle', withSlides('Café / A', 'New', 'B / two', 'Cé'), [0, 1, 2]],
    ['insert first', withSlides('New', 'Café / A', 'B / two', 'Cé'), [0, 1, 2]],
    ['remove the middle', withSlides('Café / A', 'Cé'), [0, 2]],
    ['remove the first', withSlides('B / two', 'Cé'), [1, 2]],
    ['remove the last', withSlides('Café / A', 'B / two'), [0, 1]],
    ['edit one and append', withSlides('Café / A', 'B edited', 'Cé', 'New'), [0, 2]],
    ['replace two with one', withSlides('Café / A', 'Only'), [0]],
  ]) {
    const result = updateJsonSource(slides, next, createSourceMemory());
    assert.deepEqual(parsed(result), next, `${label}: value`);
    for (const index of kept) assert.ok(result.includes(siblings[index]), `${label}: sibling ${index} keeps its exact token`);
    assert.ok(result.startsWith('{\n  "slides": [\n'), `${label}: the array is not minified`);
  }
  assert.equal(updateJsonSource(slides, withSlides('Café / A', 'Cé'), createSourceMemory()), slides.replace('    { "title": "B \\/ two" },\n', ''));
  // Structural edits then Undo return the exact source through the memory.
  {
    const memory = createSourceMemory();
    const added = updateJsonSource(slides, withSlides('Café / A', 'B / two', 'Cé', 'New'), memory);
    assert.equal(updateJsonSource(added, deck, memory), slides);
    assert.equal(updateJsonSource(slides, withSlides('Café / A', 'B / two', 'Cé', 'New'), memory), added);
  }
  // Nested arrays: only the touched array changes.
  {
    const source = '{"a":["x\\/y","z"],"b":["p\\u00e9","q"]}';
    const result = updateJsonSource(source, { a: ['x/y', 'z'], b: ['pé', 'q', 'r'] }, createSourceMemory());
    assert.ok(result.startsWith('{"a":["x\\/y","z"],"b":['), 'sibling arrays are untouched');
    assert.deepEqual(parsed(result), { a: ['x/y', 'z'], b: ['pé', 'q', 'r'] });
  }

  // A remembered source never reverts manual respellings outside the edited node.
  {
    const memory = createSourceMemory();
    const edited = updateJsonSource(original, edit((d) => { d.slides[0].title = 'Draft'; }), memory);
    const manual = edited.replace('"Caf\\u00e9 \\/ Deck"', '"Café \\/ Deck"');
    assert.notEqual(manual, edited);
    const restored = updateJsonSource(manual, doc, memory);
    assert.equal(restored, manual.replace('"Draft"', '"Caf\\u00e9 \\/ Q1"'), 'the edited token returns as authored while the respelling stays');
    assert.ok(restored.includes('"Café \\/ Deck"') && !restored.includes('"Caf\\u00e9 \\/ Deck"'));
    // Without a manual respelling the whole remembered source is returned.
    const plain = updateJsonSource(original, edit((d) => { d.slides[0].title = 'Draft'; }), createSourceMemory());
    assert.equal(plain, edited);
  }

  // The memory is bounded in total bytes as well as entries, and reports the exact-restore limit.
  {
    const memory = createSourceMemory(64, 5000);
    for (let index = 0; index < 20; index += 1) {
      const source = JSON.stringify({ id: index, filler: 'x'.repeat(900) });
      updateJsonSource(source, { id: index + 100, filler: 'x'.repeat(900) }, memory);
    }
    assert.ok(memory.bytes <= 5000, 'total remembered bytes stay under the cap');
    assert.equal(memory.bytes, [...memory.entries.values()].reduce((sum, text) => sum + text.length, 0), 'the byte count matches the entries');
    assert.equal(memory.limited, false);
    const huge = '{"a":"' + 'x'.repeat(MAX_EXACT_SOURCE_LENGTH) + '","b":"\\u00e9"}';
    const big = createSourceMemory();
    const result = updateJsonSource(huge, { a: 'y', b: 'é' }, big);
    assert.equal(result, '{"a":"y","b":"\\u00e9"}', 'edits still work and untouched tokens stay exact');
    assert.equal(big.limited, true, 'the limit is reported instead of failing silently');
    assert.equal(big.entries.size, 1, 'only the small result is remembered');
    assert.equal(updateJsonSource(result, { a: 'z', b: 'é' }, big).includes('"a":"z"'), true);
  }
}
// Delta review: inline removals, moves, prototype-named keys, discrete-edit chains and performance.
{
  const parsed = (value) => JSON.parse(value);
  const fresh = () => createSourceMemory();

  // Removing the last child of an inline container keeps the siblings byte for byte.
  const inline = '{"a": [1, 2, 3], "b": "\\u00e9 \\/", "c": {"x": 1, "y": [ 4 ,5 ]}}';
  for (const [label, change] of [
    ['last inline element', (d) => d.a.pop()],
    ['first inline element', (d) => d.a.shift()],
    ['middle inline element', (d) => d.a.splice(1, 1)],
    ['last inline key', (d) => { delete d.c.y; }],
    ['first inline key', (d) => { delete d.c.x; }],
    ['spaced last element', (d) => d.c.y.pop()],
  ]) {
    const next = parsed(inline);
    change(next);
    const result = updateJsonSource(inline, next, fresh());
    assert.deepEqual(parsed(result), next, `${label}: value`);
    assert.ok(result.includes('"b": "\\u00e9 \\/"'), `${label}: untouched tokens keep their bytes`);
    assert.ok(!result.includes('\n'), `${label}: stays inline`);
  }
  assert.equal(updateJsonSource('{"a": [1, 2, 3]}', { a: [1, 2] }, fresh()), '{"a": [1, 2]}');
  assert.equal(updateJsonSource('[[1],[2],[3]]', [[1], [2]], fresh()), '[[1],[2]]');
  assert.equal(updateJsonSource('{\n  "a": [\n    1\n  ],\n  "b": 2\n}', { a: [], b: 2 }, fresh()), '{\n  "a": [],\n  "b": 2\n}', 'the only child empties the container without a blank body');
  assert.equal(updateJsonSource('{\n  "a": {\n    "k": 1\n  }\n}', { a: {} }, fresh()), '{\n  "a": {}\n}');
  assert.equal(updateJsonSource('[\n  1,\n  2\n]', [1], fresh()), '[\n  1\n]');

  // Reordering elements moves their exact tokens, in one pass.
  const movable = '[\n  {"t": "Caf\\u00e9 \\/ A"},\n  {"t": "B \\/ two"},\n  {"t": "C\\u00e9"}\n]\n';
  const items = parsed(movable);
  for (const order of [[1, 2, 0], [2, 0, 1], [2, 1, 0], [1, 0, 2]]) {
    const next = order.map((index) => items[index]);
    const result = updateJsonSource(movable, next, fresh());
    assert.deepEqual(parsed(result), next);
    for (const token of ['{"t": "Caf\\u00e9 \\/ A"}', '{"t": "B \\/ two"}', '{"t": "C\\u00e9"}']) assert.ok(result.includes(token), `move ${order}: token ${token} survives`);
  }
  {
    const memory = fresh();
    const moved = updateJsonSource(movable, [items[1], items[2], items[0]], memory);
    assert.equal(updateJsonSource(moved, items, memory), movable, 'moving back restores the exact bytes');
  }

  // Keys named like Object.prototype members are ordinary keys.
  const protoSource = '{"a": 1, "z": "\\u00e9"}';
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
    const added = { ...parsed(protoSource) };
    Object.defineProperty(added, name, { value: { n: 1 }, enumerable: true, writable: true, configurable: true });
    const memory = fresh();
    const result = updateJsonSource(protoSource, added, memory);
    assert.ok(Object.hasOwn(parsed(result), name), `${name}: added`);
    assert.ok(result.startsWith('{"a": 1, "z": "\\u00e9"'), `${name}: in-place insert keeps the siblings`);
    const edited = structuredClone(added);
    edited[name] = { n: 2 };
    const changed = updateJsonSource(result, edited, memory);
    assert.deepEqual(parsed(changed)[name], { n: 2 }, `${name}: edited`);
    const removed = { ...parsed(protoSource) };
    const gone = updateJsonSource(changed, removed, memory);
    assert.equal(Object.hasOwn(parsed(gone), name), false, `${name}: removed`);
    assert.equal(gone, protoSource, `${name}: removal restores the exact bytes`);
  }

  // Every discrete edit stays exactly restorable: a four-step add/remove chain, undone and redone.
  {
    const base = '{\n  "slides": [\n    {"t": "Caf\\u00e9 \\/ A"},\n    {"t": "B \\/ two"}\n  ]\n}\n';
    const d0 = parsed(base);
    const d1 = structuredClone(d0); d1.slides.push({ t: 'N1' });
    const d2 = structuredClone(d1); d2.slides.shift();
    const d3 = structuredClone(d2); d3.slides.push({ t: 'N2' });
    const d4 = structuredClone(d3); d4.slides.shift();
    const docs = [d0, d1, d2, d3, d4], memory = fresh(), sources = [base];
    for (let index = 1; index < docs.length; index += 1) sources.push(updateJsonSource(sources[index - 1], docs[index], memory));
    let current = sources[4];
    for (let index = 3; index >= 0; index -= 1) {
      current = updateJsonSource(current, docs[index], memory);
      assert.equal(current, sources[index], `undo step ${4 - index} returns the exact bytes`);
    }
    for (let index = 1; index <= 4; index += 1) {
      current = updateJsonSource(current, docs[index], memory);
      assert.equal(current, sources[index], `redo step ${index} returns the exact bytes`);
    }
    // Editing the same field twice as discrete edits (not typing) keeps the first state restorable too.
    const t0 = '{"list": [1, 2, 3]}';
    const t1 = { list: [1, 2] }, t2 = { list: [1, 2, 9] }, t3 = { list: [1] };
    const memory2 = fresh();
    const s1 = updateJsonSource(t0, t1, memory2), s2 = updateJsonSource(s1, t2, memory2), s3 = updateJsonSource(s2, t3, memory2);
    assert.equal(updateJsonSource(s3, t2, memory2), s2);
    assert.equal(updateJsonSource(s2, t1, memory2), s1);
    assert.equal(updateJsonSource(s1, parsed(t0), memory2), t0);
  }

  // Performance: a move or reverse of a large array is one pass, not one parse per element.
  {
    const big = { slides: Array.from({ length: 200 }, (_value, index) => ({ id: `s${index}`, title: `Slide ${index}`, body: 'x'.repeat(20000), items: [1, 2, 3, { a: index }] })) };
    const source = JSON.stringify(big, null, 2);
    const moved = structuredClone(big);
    moved.slides.push(moved.slides.shift());
    const started = performance.now();
    const result = updateJsonSource(source, moved, fresh());
    const elapsed = performance.now() - started;
    assert.deepEqual(parsed(result), moved);
    assert.ok(elapsed < 3000, `moving a slide in a ${(source.length / 1e6).toFixed(1)} MB deck took ${Math.round(elapsed)} ms`);
    const reversed = structuredClone(big);
    reversed.slides.reverse();
    const reverseStart = performance.now();
    assert.deepEqual(parsed(updateJsonSource(source, reversed, fresh())), reversed);
    assert.ok(performance.now() - reverseStart < 3000, 'reversing 200 slides stays fast');
  }
}
console.log('Exact source: edited tokens only, Escape/Undo/Redo bytes, long drafts, chains, removals and bounds pass.');
