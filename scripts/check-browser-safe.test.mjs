// RR-62, RR-70: the rules of scripts/check-browser-safe.mjs, on metafile outputs made up for the purpose.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { entryProblems, isNodeModule, reachedBuild, rootProblems, ROOT_TARGETS } from './check-browser-safe.mjs';
import { NODE_ENTRIES, tsupEntries } from './check-catalog-free.mjs';

test('a browser entry that imports a builtin, a peer or an engine module fails, and a clean one passes', () => {
  assert.deepEqual(entryProblems('browser', { imports: [{ path: 'yaml' }], inputs: { 'packages/javascript/src/browser.ts': {}, 'packages/javascript/src/core.ts': {} } }), []);
  assert.match(entryProblems('browser', { imports: [{ path: 'node:fs' }], inputs: {} })[0], /Node builtins \(node:fs\)/);
  assert.match(entryProblems('browser', { imports: [{ path: 'path' }], inputs: {} })[0], /Node builtins \(path\)/);
  assert.match(entryProblems('deck', { imports: [{ path: '@openpresentation/opf-render/fonts-node' }], inputs: {} })[0], /optional peers/);
  assert.match(entryProblems('deck', { imports: [], inputs: { 'packages/javascript/src/node/peers.ts': {} } })[0], /Node engine modules \(src\/node\/peers\.ts\)/);
  assert.match(entryProblems('browser', { imports: [], inputs: { 'packages/javascript/src/index.ts': {} } })[0], /Node engine modules \(src\/index\.ts\)/);
});

test('engine modules are src/node/, the Node build src/index.ts and src/node-engine.ts only', () => {
  for (const input of ['src/node/export.ts', 'packages/javascript/src/index.ts', 'src/index.ts', 'packages\\javascript\\src\\node-engine.ts']) assert.equal(isNodeModule(input), true, input);
  for (const input of ['src/nodes.ts', 'src/deck.ts', 'src/core.ts', 'src/browser.ts', 'src/composition/node-tree.ts', 'src/node-ish.ts', 'node_modules/yaml/src/index.ts']) assert.equal(isNodeModule(input), false, input);
});

test('a root bundle must reach the build its target names, and a browser one no builtin or peer', () => {
  const byName = Object.fromEntries(ROOT_TARGETS.map((target) => [target.name, target]));
  assert.deepEqual(Object.keys(byName), ['browser', 'worker', 'default', 'node']);
  assert.deepEqual(byName.worker.options.conditions, ['worker', 'workerd']);
  assert.equal(reachedBuild({ '../packages/javascript/dist/browser.js': {}, '../packages/javascript/dist/chunk-A.js': {} }), 'browser');
  assert.equal(reachedBuild({ 'packages\\javascript\\dist\\index.js': {} }), 'node');
  assert.equal(reachedBuild({ 'packages/javascript/dist/index.js': {}, 'packages/javascript/dist/browser.js': {} }), 'both');
  assert.equal(reachedBuild({}), 'neither');
  assert.deepEqual(rootProblems(byName.browser, { imports: [], inputs: { 'packages/javascript/dist/browser.js': {} } }), []);
  assert.match(rootProblems(byName.worker, { imports: [], inputs: { 'packages/javascript/dist/index.js': {} } })[0], /reaches the node build, not the browser build/);
  assert.match(rootProblems(byName.browser, { imports: [{ path: 'node:fs/promises' }], inputs: { 'packages/javascript/dist/browser.js': {} } })[0], /Node builtins/);
  assert.deepEqual(rootProblems(byName.node, { imports: [{ path: 'node:fs/promises' }], inputs: { 'packages/javascript/dist/index.js': {} } }), []);
});

test('the tsup config names the two root builds and the CLI engine', () => {
  const entries = tsupEntries(readFileSync(new URL('../packages/javascript/tsup.config.ts', import.meta.url), 'utf8'));
  assert.equal(entries.index, 'src/index.ts');
  assert.equal(entries.browser, 'src/browser.ts');
  assert.equal(entries['node-engine'], 'src/node-engine.ts');
  assert.equal(entries.node, undefined);
  assert.deepEqual([...NODE_ENTRIES].sort(), ['index', 'node-engine']);
});
