import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { decideSiblingHarness, siblingGate } from './registry-sibling-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const decide = (extra) => decideSiblingHarness({ sibling: '@openpresentation/opf-editor', declared: '0.15.0', installed: '0.14.0', event: 'pull_request', ref: 'refs/heads/main', ...extra });

test('a sibling without the field always runs its registry harness', () => {
  for (const event of ['pull_request', 'merge_group', 'push', 'schedule', '']) assert.equal(decideSiblingHarness({ sibling: 'x', declared: null, installed: '0.14.0', event }).run, true, event);
});

test('a Depends-On sibling that needs an unreleased core skips its harness on a pull request or merge-queue run only', () => {
  assert.equal(decide().run, false);
  assert.match(decide().message, /requiresUnreleasedCore\).*needs @openpresentation\/opf 0\.15\.0, and the installed published version is 0\.14\.0/);
  assert.equal(decide({ event: 'merge_group' }).run, false);
  // Main and releases keep the hard gate: an unreleased requirement there is an error, never a skip.
  for (const event of ['push', 'schedule', 'workflow_dispatch', '']) assert.throws(() => decide({ event }), /only a pull request, merge-queue or roller-candidate run/, event);
  // Once the core is published, the harness runs again.
  assert.equal(decide({ installed: '0.15.0' }).run, true);
  assert.equal(decide({ installed: '0.15.1' }).run, true);
  assert.equal(decide({ installed: '0.15.0-dev.0' }).run, false, 'a prerelease is lower than its release');
  assert.throws(() => decide({ declared: 'soon' }), /not a version/);
  assert.throws(() => decide({ installed: null }), /cannot read the published/);
});

test('siblingGate reads the sibling manifest and the registry consumer install', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'registry-sibling-gate-'));
  const sibling = path.join(dir, 'opf-editor'), consumer = path.join(dir, 'consumer');
  mkdirSync(sibling); mkdirSync(path.join(consumer, 'node_modules/@openpresentation/opf'), { recursive: true });
  writeFileSync(path.join(sibling, 'package.json'), JSON.stringify({ name: '@openpresentation/opf-editor', opf: { requiresUnreleasedCore: '0.15.0' } }));
  writeFileSync(path.join(consumer, 'node_modules/@openpresentation/opf/package.json'), JSON.stringify({ version: '0.14.0' }));
  assert.equal(siblingGate(sibling, consumer, 'pull_request').run, false);
  assert.throws(() => siblingGate(sibling, consumer, 'push'));
  writeFileSync(path.join(sibling, 'package.json'), JSON.stringify({ name: '@openpresentation/opf-editor' }));
  assert.equal(siblingGate(sibling, consumer, 'push').run, true);
});

test('the registry shard runs the editor harness through the gate', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/ecosystem-ci.yml'), 'utf8');
  assert.match(workflow, /registry-sibling-gate\.mjs \.\.\/opf-editor artifacts\/npm\/registry-consumer/);
  // The harness runs only inside the gate's if; every other mention of it would bypass the gate.
  assert.match(workflow, /if \[ "\$editor_gate" = run \]; then\n\s+node \.\.\/opf-editor\/test\/json-editor-browser\.mjs artifacts\/editor\/json-editor-registry\.json/);
  assert.equal(workflow.split('opf-editor/test/json-editor-browser.mjs artifacts/editor/json-editor-registry.json').length, 2);
});
