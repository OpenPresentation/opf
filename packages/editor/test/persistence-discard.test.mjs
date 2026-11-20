// RR-115: use the public session/storage APIs; discard must never report deletion that failed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEditorSession } from '../dist/index.js';
import { createMemoryStorage, createPersistence } from '../dist/persistence.js';
const KEY = 'opf-editor/v2/rr115';
const EARLIER = KEY + '#earlier';
const deck = (title = 'Start') => ({ name: 'Recovery', slides: [{ title, text: 'Body' }] });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const make = (editor, storage) => createPersistence(editor, { key: 'rr115', storage, window: null, debounceMs: 60000, maxWaitMs: 60000 });
async function prepared() {
  const storage = createMemoryStorage(), editor = createEditorSession(deck()), writer = make(editor, storage);
  await writer.ready;
  editor.set('slides.0.title', 'Stored');
  assert.equal(await writer.flush(), true);
  writer.destroy();
  const record = await storage.get(KEY);
  await storage.set(EARLIER, { ...record, savedAt: record.savedAt - 1, presentation: deck('Earlier') });
  return storage;
}
for (const failedKey of [KEY, EARLIER]) {
  test('failed discard of ' + (failedKey === KEY ? 'main' : 'earlier') + ' retains recovery offer and allows a successful retry', { timeout: 10000 }, async (t) => {
    const storage = await prepared(); let fail = true;
    const adapter = { name: 'fault', get: (key) => storage.get(key), set: (key, value) => storage.set(key, value), delete: async (key) => { if (key === failedKey && fail) throw Error('delete denied'); await storage.delete(key); } };
    const editor = createEditorSession(deck()), controller = make(editor, adapter); t.after(() => controller.destroy());
    await controller.ready;
    const before = controller.pending, older = controller.pendingEarlier;
    assert.equal(await controller.discard(), false);
    assert.deepEqual(controller.pending, before);
    assert.deepEqual(controller.pendingEarlier, older);
    assert.equal(controller.status.state, 'error');
    assert.equal(controller.status.error, 'write');
    assert.match(controller.status.message, /discard/i);
    assert.deepEqual(controller.status.offer.presentation, before.presentation);
    assert.equal(editor.presentation.slides[0].title, 'Start');
    if (failedKey === EARLIER) assert.equal(await storage.get(KEY), undefined, 'partial deletion is not multi-key atomic');
    else assert.equal((await storage.get(KEY)).presentation.slides[0].title, 'Stored');
    assert.equal((await storage.get(EARLIER)).presentation.slides[0].title, 'Earlier');
    fail = false;
    assert.equal(await controller.discard(), true);
    assert.equal(controller.pending, undefined);
    assert.equal(controller.pendingEarlier, undefined);
    assert.equal(controller.status.offer, undefined);
    assert.equal(controller.status.error, undefined);
    assert.deepEqual(storage.keys(), []);
  });
}
test('discard waits for a previously queued write instead of deleting beneath it', { timeout: 10000 }, async (t) => {
  const storage = await prepared(), entered = deferred(), release = deferred(), calls = [];
  const adapter = { name: 'held-write', get: (key) => storage.get(key), set: async (key, value) => { calls.push('set:' + key); if (key === KEY) { entered.resolve(); await release.promise; } await storage.set(key, value); }, delete: async (key) => { calls.push('delete:' + key); await storage.delete(key); } };
  const editor = createEditorSession(deck()), controller = make(editor, adapter); t.after(() => { release.resolve(); controller.destroy(); });
  await controller.ready;
  editor.set('slides.0.title', 'Working');
  const write = controller.flush(); await entered.promise;
  const discard = controller.discard(); await Promise.resolve();
  assert.equal(calls.filter((call) => call.startsWith('delete:')).length, 0, 'no deletion before the queued write resolves');
  release.resolve(); assert.equal(await write, true); assert.equal(await discard, true);
  assert.deepEqual(storage.keys(), []);
  assert.equal(controller.pending, undefined);
});
test('a newer edit queued while deletion is held is written after discard and retained', { timeout: 10000 }, async (t) => {
  const storage = await prepared(), entered = deferred(), release = deferred(), calls = [];
  const adapter = { name: 'held-delete', get: (key) => storage.get(key), set: async (key, value) => { calls.push('set:' + key); await storage.set(key, value); }, delete: async (key) => { calls.push('delete-start:' + key); if (key === KEY) { entered.resolve(); await release.promise; } await storage.delete(key); calls.push('delete-end:' + key); } };
  const editor = createEditorSession(deck()), controller = make(editor, adapter); t.after(() => { release.resolve(); controller.destroy(); });
  await controller.ready;
  const discard = controller.discard(); await entered.promise;
  editor.set('slides.0.title', 'Newest'); const write = controller.flush(); await Promise.resolve();
  assert.equal(calls.filter((call) => call.startsWith('set:')).length, 0, 'new write is queued behind deletion');
  release.resolve(); assert.equal(await discard, true); assert.equal(await write, true);
  assert.equal((await storage.get(KEY)).presentation.slides[0].title, 'Newest');
  assert.equal(await storage.get(EARLIER), undefined);
  assert.equal(controller.pending, undefined);
  assert.equal(editor.presentation.slides[0].title, 'Newest');
  assert.ok(calls.indexOf('set:' + KEY) > calls.indexOf('delete-end:' + EARLIER));
});
test('failed discard leaves the offered document restorable through the public action', { timeout: 10000 }, async (t) => {
  const storage = await prepared(), adapter = { name: 'deny-delete', get: (key) => storage.get(key), set: (key, value) => storage.set(key, value), delete: async () => { throw Error('delete denied'); } };
  const editor = createEditorSession(deck()), controller = make(editor, adapter); t.after(() => controller.destroy()); await controller.ready;
  assert.equal(await controller.discard(), false);
  assert.equal(await controller.restore(), true);
  assert.equal(editor.presentation.slides[0].title, 'Stored');
});
