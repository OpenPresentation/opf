// CR 7: the document id is a claim about which deck this is, so no edit may touch it: not a patch to a slide or to the name, not
// adding, moving or deleting slides, not Undo or Redo, and not replacing the text of the source. The editor never makes one (hosts do).
import assert from 'node:assert/strict';
import { createEditorSession } from '../dist/index.js';

const UUID = '0192f4c8-6b1e-7c3a-9d42-5e8f1a7b3c90';
const deck = () => ({ id: UUID, name: 'Q3 business review', slides: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] });
const editor = createEditorSession(deck(), { rejectInvalid: true });

editor.applyPatch([{ op: 'replace', path: '/slides/0/title', value: 'A, edited' }]);
assert.equal(editor.presentation.id, UUID, 'a slide edit keeps the id');
editor.applyPatch([{ op: 'replace', path: '/name', value: 'Renamed' }]);
assert.equal(editor.presentation.id, UUID, 'a rename keeps the id');
editor.applyPatch([{ op: 'add', path: '/slides/-', value: { id: 'c', title: 'C' } }]);
editor.applyPatch([{ op: 'remove', path: '/slides/1' }]);
assert.equal(editor.presentation.id, UUID, 'adding and deleting slides keeps the id');
const after = structuredClone(editor.presentation);
editor.undo();
editor.undo();
assert.equal(editor.presentation.id, UUID, 'Undo keeps the id');
editor.redo();
editor.redo();
assert.deepEqual(editor.presentation, after, 'Redo restores the document exactly, id included');

// An invalid id is refused by the validating editor, and the deck keeps the old one.
assert.throws(() => editor.applyPatch([{ op: 'replace', path: '/id', value: '' }]));
assert.equal(editor.presentation.id, UUID);
// The editor does not mint an id for a deck that has none.
assert.equal(Object.hasOwn(createEditorSession({ slides: [{ title: 'No id' }] }).presentation, 'id'), false);
// A host may set one explicitly, like any other field.
const hosted = createEditorSession({ slides: [{ title: 'No id' }] });
hosted.applyPatch([{ op: 'add', path: '/id', value: 'dk_5e8f1a7b3c909d426b1e7c3a' }]);
assert.equal(hosted.presentation.id, 'dk_5e8f1a7b3c909d426b1e7c3a');
console.log('Document id: kept by every edit, Undo and Redo; never minted by the editor.');
