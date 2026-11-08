// The worker client sends only structured-cloneable catalogs. A host that registers the gallery's icon sets (`galleryIconSets`, whose sets are loader
// functions) used to make `postMessage` throw DataCloneError, so the checks fell back to the main thread and `onError` fired. The worker is
// faked with a real structured clone of every message, and its findings must equal the main thread's, before and after the sets are loaded.
import assert from 'node:assert/strict';
import { ensureIcons } from '@openpresentation/opf';
import { gallery } from '@openpresentation/gallery';
import { galleryIconSets } from '@openpresentation/gallery/icon-sets';
import { checkSource, createCheckService } from '../dist/source-check.js';
import { createSourceChecker } from '../dist/source-checker.js';

const clonedWorker = () => {
  const service = createCheckService();
  const worker = {
    log: [],
    postMessage(message) {
      const received = structuredClone(message); // what a real Worker does: functions throw DataCloneError
      worker.log.push(received);
      const reply = service.handle(received);
      setTimeout(() => worker.onmessage?.({ data: reply }), 0);
    },
    terminate() {},
    onmessage: null, onerror: null, onmessageerror: null,
  };
  return worker;
};
const catalogs = Object.freeze([gallery, galleryIconSets]);
assert.equal(Object.values(galleryIconSets.iconSets).every((set) => typeof set === 'function'), true, 'the gallery registers its icon sets as loaders');
assert.throws(() => structuredClone(catalogs), /DataCloneError|could not be cloned/i, 'the raw catalogs cannot be cloned (the bug)');

const errors = [];
const worker = clonedWorker();
const client = createSourceChecker({ worker: () => worker, onError: (error) => errors.push(error) });
const yaml = (icon) => `name: Icons\nslides:\n  - title: Hello\n    items:\n      - text: A point\n        icon: ${icon}\n`;
const same = async (icon, note) => {
  const mainResult = checkSource({ format: 'yaml', text: yaml(icon), catalogs });
  const workerResult = await client.check('yaml', yaml(icon), catalogs);
  assert.deepEqual(JSON.parse(JSON.stringify(workerResult)), JSON.parse(JSON.stringify(mainResult)), `the worker answers as the main thread does: ${note}`);
  return mainResult;
};

// Nothing loaded: a set registered as a loader is "not loaded yet", whatever the icon name.
const before = await same('lucide:no-such-icon', 'sets not loaded');
assert.deepEqual(errors, [], 'no DataCloneError, no onError');
assert.ok(client.answered >= 1 && worker.log.some((message) => message.type === 'check'), 'the worker was used');
assert.equal(worker.log[0].type, 'catalogs');
assert.deepEqual(worker.log[0].loaders['1'].slice().sort(), Object.keys(galleryIconSets.iconSets).sort(), 'the worker is told which sets exist');

// Loaded on the main thread (the icon picker does this): the worker's checks still equal the main thread's, and nothing is sent again.
await ensureIcons({ slides: [{ items: [{ text: 'x', icon: 'lucide:truck' }] }] }, { catalogs });
await same('lucide:no-such-icon', 'sets loaded');
await same('lucide:truck', 'a known icon');
assert.deepEqual(errors, [], 'still no onError');
assert.equal(worker.log.filter((message) => message.type === 'catalogs').length, 1, 'the catalogs are sent once');
client.dispose();
console.log('Source checker: icon-set loaders reach the worker as cloneable data, and the worker checks as the main thread does.');
