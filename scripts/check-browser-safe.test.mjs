// RR-62: the rules of scripts/check-browser-safe.mjs, on metafile outputs made up for the purpose.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entryProblems, isNodeModule } from './check-browser-safe.mjs';

test('a browser entry that imports a builtin, a peer or an engine module fails, and a clean one passes', () => {
  assert.deepEqual(entryProblems('index', { imports: [{ path: 'yaml' }], inputs: { 'packages/javascript/src/index.ts': {} } }), []);
  assert.match(entryProblems('index', { imports: [{ path: 'node:fs' }], inputs: {} })[0], /Node builtins \(node:fs\)/);
  assert.match(entryProblems('index', { imports: [{ path: 'path' }], inputs: {} })[0], /Node builtins \(path\)/);
  assert.match(entryProblems('deck', { imports: [{ path: '@openpresentation/opf-render/fonts-node' }], inputs: {} })[0], /optional peers/);
  assert.match(entryProblems('deck', { imports: [], inputs: { 'packages/javascript/src/node/peers.ts': {} } })[0], /Node engine modules \(src\/node\/peers\.ts\)/);
});

test('engine modules are src/node/, src/node.ts and src/node-engine.ts only', () => {
  for (const input of ['src/node/export.ts', 'packages/javascript/src/node.ts', 'packages\\javascript\\src\\node-engine.ts']) assert.equal(isNodeModule(input), true, input);
  for (const input of ['src/nodes.ts', 'src/deck.ts', 'src/composition/node-tree.ts', 'src/node-ish.ts']) assert.equal(isNodeModule(input), false, input);
});
