import assert from 'node:assert/strict';
import { MAX_EXACT_SOURCE_LENGTH, createSourceMemory, findDuplicateKey, updateJsonSource } from '@openpresentation/opf-editor/exact-source';

// The exact-source writer is a public entry point (`@openpresentation/opf-editor/exact-source`), so a host that keeps the authored JSON of a deck
// itself (pptx.dev's buffers) writes an edit back with the editor's own writer instead of a JSON token parser of its own.
const authored = '{\r\n\t"name" : "Caf\\u00e9 \\/ Deck",\r\n\t"slides": [ { "title": "One" , "notes": "keep\\u0020me" } ]\r\n}\r\n';
const memory = createSourceMemory();
const deck = JSON.parse(authored);
const edited = structuredClone(deck);
edited.slides[0].title = 'One, edited';
const written = updateJsonSource(authored, edited, memory);
assert.equal(written, authored.replace('"One"', '"One, edited"'), 'only the changed token is rewritten: tabs, CRLF, spaces and escapes stay');
assert.deepEqual(JSON.parse(written), edited);
// The value comes back (Undo): the authored spelling returns with it.
assert.equal(updateJsonSource(written, deck, memory), authored, 'Undo brings back the authored bytes');

// A structural edit keeps the rest of the text.
const added = structuredClone(edited);
added.slides.push({ title: 'Two' });
const grown = updateJsonSource(written, added, memory);
assert.ok(grown.startsWith('{\r\n\t"name" : "Caf\\u00e9 \\/ Deck",'), 'the untouched lines keep their bytes');
assert.deepEqual(JSON.parse(grown), added);

assert.deepEqual(findDuplicateKey('{"a":1,"b":{"c":1,"c":2}}'), { key: 'c', path: ['b'] });
assert.equal(findDuplicateKey('{"a":1}'), null);
assert.equal(typeof MAX_EXACT_SOURCE_LENGTH, 'number');
assert.throws(() => updateJsonSource('{ not json', edited, memory), SyntaxError, 'text that is not JSON throws');
assert.equal(memory.limited, false);

console.log('exact-source entry: @openpresentation/opf-editor/exact-source rewrites only changed tokens and restores authored bytes.');
