// CE-04: id-addressed patch events (`idPaths`), `documentHash` and `expectHash` on the session, and `assignIds` as one edit.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OPFEditorError, createEditorSession} from '../dist/index.js';
import {documentHash} from '@openpresentation/opf';

const deck = () => ({
  $schema: 'https://openpresentation.org/schema/opf/v1',
  name: 'Ids',
  slides: [
    {id: 'intro', title: 'Intro', text: 'Hello'},
    {id: 'kpis', title: 'KPIs', blocks: [{id: 'row', blocks: [{id: 'a', text: 'A'}, {text: 'B'}]}, {id: 'note', text: 'Note'}]},
    {id: 'close', title: 'Close'}
  ]
});
const events = editor => { const list = []; editor.subscribe(event => list.push(event)); return list; };

// Off by default: events and changes carry exactly the fields they always had.
{
  const editor = createEditorSession(deck(), {catalogs: []});
  const list = events(editor);
  const change = editor.set('slides.0.title', 'Welcome');
  editor.undo(); editor.redo();
  for (const item of [...list, change]) assert.deepEqual(Object.keys(item).filter(key => key.startsWith('id')), [], 'no id fields without the option');
  assert.equal(list.length, 3);
}

// On: every patch, undo and redo event reports the id form beside the index form.
{
  const editor = createEditorSession(deck(), {catalogs: [], idPaths: true});
  const list = events(editor);
  const change = editor.applyPatch([
    {op: 'replace', path: '/slides/1/blocks/1/text', value: 'Edited'},
    {op: 'move', from: '/slides/2', path: '/slides/0'},
    {op: 'add', path: '/slides/2/blocks/-', value: {id: 'extra', text: 'X'}},
    {op: 'replace', path: '/slides/1/title', value: 'Welcome'}
  ], {source: 'test'});
  assert.deepEqual(change.idPatches.map(op => op.path), ['/slides/@kpis/blocks/@note/text', '/slides/0', '/slides/@kpis/blocks/-', '/slides/@intro/title']);
  assert.deepEqual(change.patches.map(op => op.path), ['/slides/1/blocks/1/text', '/slides/0', '/slides/2/blocks/-', '/slides/1/title'], 'the index form is unchanged');
  assert.equal(change.idPatches[1].from, '/slides/@close');
  assert.equal(change.idInversePatches.length, change.inversePatches.length);
  assert.ok(change.idInversePatches.some(op => op.path.includes('@')), 'the inverse is addressed by id too');
  assert.deepEqual(list[0].idPatches, change.idPatches);
  assert.deepEqual(list[0].idInversePatches, change.idInversePatches);

  // The id form applies to a replica whose slides are in another order.
  const replica = createEditorSession(deck(), {catalogs: []});
  replica.applyPatch([{op: 'move', from: '/slides/1', path: '/slides/0'}]);
  replica.applyPatch(change.idPatches.filter(op => op.op === 'replace'));
  assert.equal(replica.get('slides.0.blocks.1.text'), 'Edited');
  assert.equal(replica.get('slides.1.title'), 'Welcome');

  const undone = editor.undo();
  assert.deepEqual(undone.idPatches, list[1].idPatches);
  assert.equal(list[1].type, 'undo');
  assert.equal(list[1].idPatches.length, undone.patches.length);
  assert.deepEqual(list[1].idRedoPatches, change.idPatches, 'redo patches are written against the document after the undo, which is the document they were made for');
  const redone = editor.redo();
  assert.equal(list[2].type, 'redo');
  assert.deepEqual(redone.idPatches, list[2].idPatches);
  assert.deepEqual(redone.idInversePatches, list[2].idInversePatches);
  assert.deepEqual(redone.idPatches.map(op => op.path), change.idPatches.map(op => op.path), 'redo replays the same patches against the same document');
  editor.setCatalogs([]);
  assert.deepEqual(list.at(-1).idPatches, []);
}

// Id paths are accepted wherever paths are: get, set, applyPatch.
{
  const editor = createEditorSession(deck(), {catalogs: [], idPaths: true});
  assert.equal(editor.get('slides.@kpis.blocks.@note.text'), 'Note');
  assert.equal(editor.get('/slides/@kpis/blocks/@row/blocks/@a/text'), 'A');
  const change = editor.set('slides.@intro.title', 'Via id');
  assert.equal(editor.get('slides.0.title'), 'Via id');
  assert.deepEqual(change.patches.map(op => op.path), ['/slides/@intro/title'], 'the patch keeps the path as the caller wrote it');
  assert.deepEqual(change.idPatches.map(op => op.path), ['/slides/@intro/title']);
  assert.deepEqual(change.inversePatches.map(op => op.path), ['/slides/0/title'], 'the inverse is in index form');
  editor.undo();
  assert.equal(editor.get('slides.0.title'), 'Intro');
  assert.throws(() => editor.applyPatch([{op: 'replace', path: '/slides/@nothing/title', value: 'x'}]), error => error instanceof OPFEditorError && error.code === 'patch-id-not-found');
}

// documentHash and expectHash.
{
  const editor = createEditorSession(deck(), {catalogs: []});
  const hash = editor.documentHash();
  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(hash, documentHash(deck()));
  const change = editor.applyPatch([{op: 'replace', path: '/name', value: 'Renamed'}], {}, {expectHash: hash});
  assert.equal(change.presentation.name, 'Renamed');
  assert.notEqual(editor.documentHash(), hash);
  const list = events(editor);
  const depth = editor.snapshot().undoDepth;
  assert.throws(
    () => editor.applyPatch([{op: 'replace', path: '/name', value: 'Mine'}], {}, {expectHash: hash}),
    error => error instanceof OPFEditorError && error.code === 'patch-hash-mismatch' && error.details.expected === hash && error.details.actual === editor.documentHash()
  );
  assert.equal(editor.get('name'), 'Renamed', 'a stale edit changes nothing');
  assert.equal(editor.snapshot().undoDepth, depth);
  assert.equal(list.length, 0, 'and emits nothing');
  assert.throws(() => editor.applyPatch([], {}, {expectHash: 'nope'}), error => error.code === 'invalid-expect-hash');
  editor.applyPatch([{op: 'replace', path: '/name', value: 'Fresh'}], {}, {expectHash: editor.documentHash()});
  assert.equal(editor.get('name'), 'Fresh');
  editor.undo();
  assert.equal(editor.documentHash(), documentHash(editor.presentation));
}

// assignIds: one undoable edit, or nothing.
{
  const bare = {slides: [{title: 'One'}, {id: 'two', title: 'Two', blocks: [{text: 'a'}]}]};
  const editor = createEditorSession(bare, {catalogs: [], idPaths: true});
  const list = events(editor);
  const change = editor.assignIds();
  assert.deepEqual(editor.presentation.slides.map(slide => slide.id), ['slide-1', 'two']);
  assert.equal(editor.get('slides.1.blocks.0.id'), 'block-1');
  assert.equal(list.length, 1);
  assert.equal(list[0].meta.source, 'assign-ids');
  assert.deepEqual(change.idPatches.map(op => op.path), ['/slides/0/id', '/slides/@two/blocks/0/id']);
  assert.equal(editor.assignIds(), null, 'nothing missing, nothing recorded');
  assert.equal(list.length, 1);
  editor.undo();
  assert.deepEqual(editor.presentation, bare, 'one undo takes every id back');
  assert.equal(editor.snapshot().undoDepth, 0);

  const named = createEditorSession(bare, {catalogs: []});
  named.assignIds({generate: ({kind, pointer}) => `${kind}${pointer.replaceAll('/', '-')}`}, {source: 'host'});
  assert.equal(named.get('slides.0.id'), 'slide-slides-0');
  const clash = createEditorSession({slides: [{title: 'a'}, {title: 'b'}]}, {catalogs: []});
  assert.throws(() => clash.assignIds({generate: () => 'same'}), error => error instanceof OPFEditorError && error.code === 'duplicate-id' && error.details.path === '/slides/1');
}

// The types ship with the feature.
{
  const types = readFileSync(new URL('../dist/index.d.ts', import.meta.url), 'utf8');
  for (const name of ['idPaths?: boolean', 'idPatches?: JsonPatchOperation[]', 'idInversePatches?', 'idRedoPatches?', 'expectHash?: string', 'documentHash(): string', 'assignIds(options?: AssignIdsOptions']) assert.ok(types.includes(name), name);
}
console.log('id paths, documentHash, expectHash and assignIds passed');
