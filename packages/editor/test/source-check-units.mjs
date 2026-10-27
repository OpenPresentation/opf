// Phase 4 units (artifacts/source-editor/SPEC.md sections 9.1 and 14): the source pane's text checks run on the main thread or in a Web Worker and give
// the same answer. `checkSource` over a corpus equals what the pane's own `readText` returned before it moved (frozen in
// test/fixtures/source-read-text.golden.json), the validation it adds is the session's, the session takes a precomputed validation only for exactly the
// document and catalogs it was computed for (and never stores it), and the worker client (message order, stale replies, fallback, catalogs, dispose)
// behaves with an in-memory worker.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gallery } from '@openpresentation/gallery';
import { createEditorSession } from '../dist/index.js';
import { checkFormat } from '../dist/checks.js';
import { checkSource, checkSyntaxOnly, createCheckService, markdownNotesOf, readSource } from '../dist/source-check.js';
import { createSourceChecker } from '../dist/source-checker.js';
import { corpus } from './support/source-check-corpus.mjs';

const golden = JSON.parse(await readFile(new URL('./fixtures/source-read-text.golden.json', import.meta.url), 'utf8'));
const catalogsOf = (entry) => Object.freeze(entry.catalogs === 'gallery' ? [gallery] : []);
const plain = (value) => JSON.parse(JSON.stringify(value));
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- checkSource equals the pane's old readText --------------------------------------------------------------------------------------
for (const entry of corpus) {
  const catalogs = catalogsOf(entry);
  const old = golden[entry.id];
  assert.ok(old, `${entry.id} has a golden`);
  assert.deepEqual(plain(readSource(entry.format, entry.text, catalogs)), old, `${entry.id}: readSource equals the old readText`);
  const bare = checkSource({ format: entry.format, text: entry.text, catalogs, validate: false });
  assert.deepEqual(plain(bare), old, `${entry.id}: checkSource without validation equals the old readText`);
  const full = checkSource({ format: entry.format, text: entry.text, catalogs });
  const { validation, markdownNotes, ...rest } = full;
  assert.deepEqual(plain(rest), old, `${entry.id}: checkSource keeps every field of the old result`);
  if (old.deck) {
    assert.deepEqual(validation, checkFormat(full.deck, { catalogs }), `${entry.id}: the validation is the session's`);
    assert.equal(markdownNotes !== undefined, entry.format === 'md', `${entry.id}: Markdown notes come with a Markdown deck only`);
    if (entry.format === 'md') assert.deepEqual(markdownNotes, markdownNotesOf(full.deck), `${entry.id}: the Markdown notes`);
  } else assert.deepEqual([validation, markdownNotes], [undefined, undefined], `${entry.id}: nothing to validate without a deck`);
  // What a worker sends back: structured clone keeps it equal.
  assert.deepEqual(structuredClone(full), full, `${entry.id}: the result survives structured clone`);
}
console.log(`checkSource: ${corpus.length} texts equal the golden of the old readText.`);

// A registered catalog changes the reference findings; the validation follows the catalogs it was given.
{
  const text = corpus.find((entry) => entry.id === 'layouts-json').text;
  const withGallery = checkSource({ format: 'json', text, catalogs: Object.freeze([gallery]) }).validation;
  const without = checkSource({ format: 'json', text, catalogs: Object.freeze([]) }).validation;
  assert.notDeepEqual(withGallery.findings.map((finding) => finding.message), without.findings.map((finding) => finding.message), 'the catalogs change the reference findings');
  assert.ok(without.findings.length > withGallery.findings.length, 'fewer reference findings with the gallery registered');
}

// The quick JSON pass.
{
  const bad = corpus.find((entry) => entry.id === 'json-missing-comma').text;
  assert.deepEqual(checkSyntaxOnly(bad), golden['json-missing-comma'].findings, 'the syntax pass is the first part of the JSON check');
  assert.deepEqual(checkSyntaxOnly(corpus.find((entry) => entry.id === 'valid-json').text), []);
}

// ---- the worker's message service ---------------------------------------------------------------------------------------------------------
{
  const service = createCheckService();
  const entry = corpus.find((row) => row.id === 'layouts-json');
  assert.deepEqual(service.handle({ id: 1, type: 'catalogs', catalogs: [gallery] }), { id: 1, ok: true, result: null });
  const withGallery = service.handle({ id: 2, type: 'check', format: entry.format, text: entry.text });
  assert.equal(withGallery.ok, true);
  assert.deepEqual(withGallery.result, checkSource({ format: entry.format, text: entry.text, catalogs: [gallery] }), 'the service checks with the catalogs it was sent');
  service.handle({ id: 3, type: 'catalogs', catalogs: [] });
  assert.deepEqual(service.handle({ id: 4, type: 'check', format: entry.format, text: entry.text }).result, checkSource({ format: entry.format, text: entry.text, catalogs: [] }), 'the next catalogs apply to the next check');
  assert.deepEqual(service.handle({ id: 5, type: 'syntax', text: '{' }).result, checkSyntaxOnly('{'));
  assert.deepEqual(service.handle({ id: 6, type: 'nope' }), { id: 6, ok: false, error: 'Unknown message type nope.' });
  const bad = service.handle({ id: 7, type: 'check', format: 'yaml', text: null });
  assert.equal(bad.ok, false, 'an exception becomes an error reply');
  assert.equal(bad.id, 7);
  assert.equal(typeof bad.error, 'string');
}

// The worker script: queued checks of one kind collapse to the newest, catalogs always run first and in order.
{
  const sent = [];
  const hadSelf = Object.hasOwn(globalThis, 'self');
  const before = globalThis.self;
  globalThis.self = { postMessage: (message) => sent.push(message), onmessage: null };
  await import('../dist/source-worker.js');
  // The first message says the worker runs (the checker gives up on a worker that never says it).
  assert.deepEqual(sent.shift(), { ready: true }, 'the worker says it is ready as soon as its module has run');
  const text = corpus.find((row) => row.id === 'valid-yaml').text;
  globalThis.self.onmessage({ data: { id: 1, type: 'catalogs', catalogs: [gallery] } });
  globalThis.self.onmessage({ data: { id: 2, type: 'check', format: 'yaml', text } });
  globalThis.self.onmessage({ data: { id: 3, type: 'check', format: 'yaml', text: `${text}\n` } });
  globalThis.self.onmessage({ data: { id: 4, type: 'syntax', text: '{}' } });
  await tick(30);
  assert.deepEqual(sent.map((reply) => [reply.id, reply.skipped ? 'skipped' : reply.ok]), [[1, true], [2, 'skipped'], [3, true], [4, true]], 'the older check is skipped, the rest answer in order');
  assert.deepEqual(sent[2].result, checkSource({ format: 'yaml', text: `${text}\n`, catalogs: [gallery] }));
  if (hadSelf) globalThis.self = before; else delete globalThis.self;
}

// ---- the session takes a precomputed validation only when it is exactly right ------------------------------------------------------------
{
  const start = { name: 'Start', slides: [{ title: 'One' }] };
  const next = { name: 'Next', slides: [{ title: 'One' }, { title: 'Two', layout: 'cover' }] };
  const operations = [{ op: 'replace', path: '', value: next }];
  const own = createEditorSession(start, { catalogs: [gallery] });
  const reference = own.applyPatch(operations, { source: 'test' });
  const sentinel = () => ({ ...checkFormat(next, { catalogs: own.catalogs }), sentinel: 'precomputed' });

  const accepted = createEditorSession(start, { catalogs: [gallery] });
  const report = sentinel();
  const change = accepted.applyPatch(operations, { source: 'test' }, { validated: { document: structuredClone(next), validation: report, catalogs: accepted.catalogs } });
  assert.equal(change.validation, report, 'a validation for this document and these catalogs is used as given');
  assert.equal(accepted.validation, report, 'and becomes the session validation');
  assert.deepEqual(accepted.presentation, own.presentation, 'the document is the same');
  assert.deepEqual({ ...change.validation, sentinel: undefined }, { ...reference.validation, sentinel: undefined }, 'it equals what the session would have computed');

  const different = createEditorSession(start, { catalogs: [gallery] });
  const wrong = different.applyPatch(operations, { source: 'test' }, { validated: { document: { name: 'Other', slides: [] }, validation: sentinel(), catalogs: different.catalogs } });
  assert.equal(wrong.validation.sentinel, undefined, 'a validation for another document is ignored');
  assert.deepEqual(wrong.validation, reference.validation, 'the session validated the document itself');

  const otherCatalogs = createEditorSession(start, { catalogs: [gallery] });
  const stale = otherCatalogs.applyPatch(operations, { source: 'test' }, { validated: { document: next, validation: sentinel(), catalogs: Object.freeze([gallery]) } });
  assert.equal(stale.validation.sentinel, undefined, 'a validation computed with other catalogs (another list object) is ignored');
  otherCatalogs.undo();
  otherCatalogs.setCatalogs([]);
  const afterChange = otherCatalogs.applyPatch(operations, { source: 'test' }, { validated: { document: next, validation: sentinel(), catalogs: accepted.catalogs } });
  assert.equal(afterChange.validation.sentinel, undefined, 'after setCatalogs the old list is not the session list');

  const missing = createEditorSession(start, { catalogs: [gallery] }).applyPatch(operations, { source: 'test' }, { validated: { document: next, catalogs: undefined } });
  assert.deepEqual(missing.validation, reference.validation, 'an incomplete handoff is ignored');

  // Never stored: not in the history, the snapshot or the events.
  const seen = [];
  const stored = createEditorSession(start, { catalogs: [gallery] });
  stored.subscribe((event) => seen.push(event));
  stored.applyPatch(operations, { source: 'test' }, { validated: { document: next, validation: checkFormat(next, { catalogs: stored.catalogs }), catalogs: stored.catalogs } });
  assert.deepEqual(stored.exportHistory(), own.exportHistory(), 'exportHistory is the same as for a session that validated itself');
  assert.equal(JSON.stringify(stored.exportHistory()).includes('validated'), false);
  assert.deepEqual(stored.exportHistory().undo[0].meta, { source: 'test' }, 'meta holds only what the caller put in it');
  assert.equal(seen.length, 1);
  assert.equal(JSON.stringify(seen[0].meta).includes('validated'), false, 'the event meta has no handoff');
  assert.equal(Object.hasOwn(stored.snapshot(), 'validated'), false);
  stored.undo();
  assert.deepEqual(stored.presentation, start, 'undo works');
  stored.redo();
  assert.deepEqual(stored.presentation, own.presentation, 'redo works');
}

// ---- the worker client with an in-memory worker --------------------------------------------------------------------------------------------
/** A worker that runs the real service, answers on a later task and records every message. */
function fakeWorker({ delay = 0, delays = {}, broken } = {}) {
  const service = createCheckService();
  const worker = {
    log: [],
    terminated: 0,
    postMessage(message) {
      worker.log.push(message);
      if (broken === 'post') throw new DOMException('could not be cloned', 'DataCloneError');
      if (broken === 'silent') return;
      const reply = broken === 'bad' ? { id: message.id, ok: false, error: 'worker bug' } : service.handle(message);
      setTimeout(() => worker.onmessage?.({ data: reply }), delays[message.id] ?? delay);
    },
    terminate() { worker.terminated++; },
    onmessage: null,
    onerror: null,
    onmessageerror: null,
  };
  return worker;
}
const yaml = corpus.find((row) => row.id === 'valid-yaml').text;
const layouts = corpus.find((row) => row.id === 'layouts-yaml').text;

{
  // Message order and catalogs sync: catalogs go first, once per list object.
  const worker = fakeWorker();
  const errors = [];
  const client = createSourceChecker({ worker: () => worker, onError: (error) => errors.push(error) });
  assert.equal(worker.log.length, 0, 'the worker is created and used lazily');
  const list = Object.freeze([gallery]);
  const first = await client.check('yaml', yaml, list);
  assert.deepEqual(plain(first), plain(checkSource({ format: 'yaml', text: yaml, catalogs: list })), 'the client returns the checkSource result');
  assert.deepEqual(worker.log.map((message) => message.type), ['catalogs', 'check']);
  assert.ok(worker.log[0].id < worker.log[1].id, 'request ids increase');
  await client.check('yaml', yaml, list);
  assert.deepEqual(worker.log.map((message) => message.type), ['catalogs', 'check', 'check'], 'the same catalogs list is not sent again');
  const none = Object.freeze([]);
  const without = await client.check('yaml', layouts, none);
  assert.deepEqual(worker.log.map((message) => message.type), ['catalogs', 'check', 'check', 'catalogs', 'check'], 'new catalogs go before the check that needs them');
  assert.deepEqual(plain(without), plain(checkSource({ format: 'yaml', text: layouts, catalogs: none })), 'the check ran with the new catalogs');
  const withGallery = await client.check('yaml', layouts, list);
  assert.notDeepEqual(withGallery.validation.findings.length, without.validation.findings.length, 'and the old ones again after another switch');
  assert.deepEqual(await client.syntax('{'), checkSyntaxOnly('{'));
  assert.equal(client.answered, 5);
  assert.deepEqual(errors, []);
  client.dispose();
}
{
  // A stale reply is dropped: only the newest check resolves with a result.
  const worker = fakeWorker({ delays: { 2: 20 } });
  const client = createSourceChecker({ worker });
  const list = Object.freeze([gallery]);
  const older = client.check('yaml', yaml, list);
  const newer = client.check('yaml', layouts, list);
  const [a, b] = await Promise.all([older, newer]);
  assert.equal(a, null, 'the older check is superseded');
  assert.deepEqual(plain(b), plain(checkSource({ format: 'yaml', text: layouts, catalogs: list })));
  // The worker may skip it itself.
  const skipping = {
    log: [], postMessage(message) { skipping.log.push(message); setTimeout(() => skipping.onmessage({ data: { id: message.id, ok: true, skipped: true } }), 0); }, terminate() {},
  };
  const skip = createSourceChecker({ worker: skipping });
  assert.equal(await skip.check('yaml', yaml, list), null, 'a skipped request resolves with null');
  skip.dispose();
  client.dispose();
}
{
  // Every kind of worker failure rejects with workerFailed, calls onError once and disables the worker for good.
  const kinds = {
    'a factory that throws': () => { throw new Error('CSP blocked the worker'); },
    'postMessage that cannot clone': () => fakeWorker({ broken: 'post' }),
    'a worker that answers with an error': () => fakeWorker({ broken: 'bad' }),
    'a worker that never answers': () => fakeWorker({ broken: 'silent' }),
    'an object that is not a worker': () => ({}),
    'Worker unavailable (worker: true here)': true,
  };
  for (const [label, worker] of Object.entries(kinds)) {
    const errors = [];
    const client = createSourceChecker({ worker, onError: (error) => errors.push(error), timeout: 40 });
    await assert.rejects(client.check('yaml', yaml, Object.freeze([])), (error) => error.workerFailed === true, label);
    assert.equal(client.available, false, `${label}: the worker is not used again`);
    await assert.rejects(client.check('yaml', yaml, Object.freeze([])), (error) => error.workerFailed === true, `${label}: later requests reject at once`);
    await assert.rejects(client.syntax('{'), (error) => error.workerFailed === true);
    assert.equal(errors.length, 1, `${label}: onError is called once`);
  }
  // An error event of a worker whose script failed to load, and a message that cannot be read.
  for (const event of ['onerror', 'onmessageerror']) {
    const worker = fakeWorker({ broken: 'silent' });
    const errors = [];
    const client = createSourceChecker({ worker, onError: (error) => errors.push(error), timeout: 5000 });
    const pending = client.check('yaml', yaml, Object.freeze([]));
    worker[event]({ message: 'Failed to load', preventDefault() {} });
    await assert.rejects(pending, (error) => error.workerFailed === true, event);
    assert.equal(worker.terminated, 1, `${event}: the worker is terminated`);
    assert.equal(errors.length, 1);
  }
  // An onError that throws does not break the fallback.
  const client = createSourceChecker({ worker: () => { throw new Error('no'); }, onError: () => { throw new Error('host bug'); } });
  await assert.rejects(client.check('yaml', yaml, Object.freeze([])), (error) => error.workerFailed === true);
}
{
  // A worker that loads but never starts (a bundler emptied its script: `sideEffects: false` dropped a bare import of the worker entry) is given up
  // after `startTimeout`, not after the 15 s a check may take; one that says it is ready may take longer to answer.
  const errors = [];
  const silent = fakeWorker({ broken: 'silent' });
  const began = Date.now();
  const client = createSourceChecker({ worker: silent, onError: (error) => errors.push(error), startTimeout: 30 });
  await assert.rejects(client.check('yaml', yaml, Object.freeze([])), (error) => error.workerFailed === true && /did not start within/.test(error.message));
  assert.ok(Date.now() - began < 5000, 'the pane falls back long before the request timeout');
  assert.equal(client.available, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /^The source worker loaded but did not start/);

  const slow = fakeWorker({ delay: 80 });
  const ready = createSourceChecker({ worker: () => { setTimeout(() => slow.onmessage?.({ data: { ready: true } }), 0); return slow; }, startTimeout: 30 });
  const answer = await ready.check('yaml', yaml, Object.freeze([]));
  assert.ok(answer, 'a worker that said it is ready keeps its 15 s per check');
  assert.equal(ready.available, true);
  ready.dispose();

  // A host's own worker object that answers without the ready signal counts as started by its first answer.
  const plainWorker = fakeWorker({ delay: 10 });
  const quiet = createSourceChecker({ worker: plainWorker, startTimeout: 5000 });
  assert.ok(await quiet.check('yaml', yaml, Object.freeze([])));
  quiet.dispose();
}
{
  // The messages say which worker failed: a URL a host gave, or the package's own file (`worker: true`); a module worker that cannot load its
  // script fires an error event without a message.
  const made = [];
  const original = globalThis.Worker;
  globalThis.Worker = class { constructor(url, options) { this.url = String(url); this.options = options; made.push(this); } postMessage() {} terminate() {} };
  try {
    const cases = [
      [new URL('https://example.test/assets/opf-source-worker.js'), /^The source worker \(https:\/\/example\.test\/assets\/opf-source-worker\.js\) failed to start\.$/],
      ['/workers/source.js', /^The source worker \(\/workers\/source\.js\) failed to start\.$/],
      [true, /^The source worker \(worker: true, the package's source-worker\.js, which the app's bundler must emit\) failed to start\.$/],
    ];
    for (const [option, expected] of cases) {
      const errors = [];
      const client = createSourceChecker({ worker: option, onError: (error) => errors.push(error) });
      const request = client.check('yaml', yaml, Object.freeze([]));
      const worker = made.at(-1);
      assert.equal(worker.options.type, 'module', `${String(option)}: a module worker`);
      if (option === true) assert.match(worker.url, /\/source-worker\.js$/, 'worker: true starts the file next to the checker');
      else assert.equal(worker.url, String(option));
      worker.onerror({ preventDefault() {} });
      await assert.rejects(request, (error) => error.workerFailed === true);
      assert.equal(errors.length, 1);
      assert.match(errors[0].message, expected);
    }
  } finally {
    globalThis.Worker = original;
  }
}
{
  // dispose: pending requests end with null, the worker is terminated, nothing more is sent.
  const worker = fakeWorker({ delay: 30 });
  const client = createSourceChecker({ worker });
  const pending = client.check('yaml', yaml, Object.freeze([]));
  client.dispose();
  assert.equal(await pending, null);
  assert.equal(worker.terminated, 1);
  const sent = worker.log.length;
  await assert.rejects(client.check('yaml', yaml, Object.freeze([])), (error) => error.workerFailed === true);
  assert.equal(worker.log.length, sent);
  client.dispose();
  assert.equal(worker.terminated, 1, 'dispose twice terminates once');
  await tick(50);
}
console.log('Source worker: the checks, the session handoff and the client behave.');
