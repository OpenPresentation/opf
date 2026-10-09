import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SKIP_EVENTS, cliPeerGate, gate, satisfies, mayWait, ROLLER_CANDIDATE_REF, isCoreReleaseRef, peerCoreGate } from './unreleased-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('satisfies follows npm caret, tilde and exact rules, 0.x included', () => {
  assert.equal(satisfies('0.15.0', '^0.15.0'), true);
  assert.equal(satisfies('0.15.3', '^0.15.0'), true);
  assert.equal(satisfies('0.16.0', '^0.15.0'), false);
  assert.equal(satisfies('0.14.9', '^0.15.0'), false);
  assert.equal(satisfies('0.15.0-dev.0', '^0.15.0'), false, 'a prerelease is below its release');
  assert.equal(satisfies('1.4.0', '^1.2.0'), true);
  assert.equal(satisfies('2.0.0', '^1.2.0'), false);
  assert.equal(satisfies('0.15.2', '~0.15.1'), true);
  assert.equal(satisfies('0.14.0', '0.14.0'), true);
  assert.equal(satisfies('0.14.1', '0.14.0'), false);
  assert.equal(satisfies('3.0.0', '>=0.14.0'), true);
  assert.throws(() => satisfies('0.14.0', 'workspace:*'), /unsupported range/);
});

test('an unmet requirement skips only on a pull request or merge-queue run, and fails everywhere else', () => {
  assert.deepEqual([...SKIP_EVENTS].sort(), ['merge_group', 'pull_request']);
  const unmet = (event) => gate({ subject: 'x', required: 'y@^0.15.0', installed: '0.14.0', met: false, event, ref: 'refs/heads/main', what: 'its tests' });
  for (const event of ['pull_request', 'merge_group']) {
    const result = unmet(event);
    assert.equal(result.run, false, event);
    assert.match(result.message, /x needs y@\^0\.15\.0, and the installed published version is 0\.14\.0, so its tests skip/);
  }
  for (const event of ['push', 'schedule', 'workflow_dispatch', 'release', '']) assert.throws(() => unmet(event), /only a pull request, merge-queue or roller-candidate run may skip its tests/, event);
  for (const event of ['push', 'pull_request', '']) assert.deepEqual(gate({ subject: 'x', required: 'y', installed: '1', met: true, event }), { run: true });
});

test("the roller's candidate dispatch waits like a pull request; any other dispatch or push does not", () => {
  const unmet = (event, ref) => gate({ subject: 'x', required: 'y@^0.15.0', installed: '0.14.0', met: false, event, ref, what: 'its tests' });
  assert.equal(mayWait('workflow_dispatch', ROLLER_CANDIDATE_REF), true);
  assert.equal(unmet('workflow_dispatch', 'refs/heads/ecosystem-roll/main').run, false);
  for (const [event, ref] of [['workflow_dispatch', 'refs/heads/main'], ['workflow_dispatch', 'refs/heads/ecosystem-roll/other'], ['push', ROLLER_CANDIDATE_REF], ['schedule', ROLLER_CANDIDATE_REF]]) {
    assert.throws(() => unmet(event, ref), /roller-candidate run may skip/, `${event} ${ref}`);
  }
});

test('cliPeerGate reads the CLI peer ranges and the peers the CLI entry resolves', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'unreleased-gate-'));
  const cli = path.join(dir, 'cli');
  mkdirSync(path.join(cli, 'dist'), { recursive: true });
  writeFileSync(path.join(cli, 'package.json'), JSON.stringify({ name: '@openpresentation/cli', peerDependencies: { '@openpresentation/opf-render': '^0.15.0', '@openpresentation/opf-pptx': '^0.15.0' } }));
  writeFileSync(path.join(cli, 'dist/index.js'), '');
  const install = (name, version) => {
    mkdirSync(path.join(cli, 'node_modules', name), { recursive: true });
    writeFileSync(path.join(cli, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
  };
  install('@openpresentation/opf-render', '0.14.0');
  install('@openpresentation/opf-pptx', '0.14.0');
  const names = ['@openpresentation/opf-render', '@openpresentation/opf-pptx'];
  const executable = pathToFileURL(path.join(cli, 'dist/index.js')).href;
  const skipped = cliPeerGate({ cliRoot: cli, executable, names, event: 'pull_request', ref: 'refs/heads/main' });
  assert.equal(skipped.run, false);
  assert.match(skipped.message, /opf-render@\^0\.15\.0 and @openpresentation\/opf-pptx@\^0\.15\.0/);
  assert.throws(() => cliPeerGate({ cliRoot: cli, executable, names, event: 'push', ref: 'refs/heads/main' }), /only a pull request, merge-queue or roller-candidate run/);
  const coreRelease = cliPeerGate({ cliRoot: cli, executable, names, event: 'push', ref: 'refs/tags/opf-v0.15.1' });
  assert.equal(coreRelease.run, false);
  assert.match(coreRelease.message, /opf-v0\.15\.1 publishes @openpresentation\/opf only/);
  assert.throws(() => cliPeerGate({ cliRoot: cli, executable, names, event: 'push', ref: 'refs/tags/cli-v0.15.0' }), /only a pull request, merge-queue or roller-candidate run/);
  install('@openpresentation/opf-render', '0.15.0');
  install('@openpresentation/opf-pptx', '0.15.1');
  assert.equal(cliPeerGate({ cliRoot: cli, executable, names, event: 'push', ref: 'refs/heads/main' }).run, true);
  // The packed-install test names the versions it installs.
  assert.equal(cliPeerGate({ cliRoot: cli, executable, names, event: 'pull_request', installedVersions: { '@openpresentation/opf-render': '0.14.0', '@openpresentation/opf-pptx': '0.14.0' } }).run, false);
  assert.throws(() => cliPeerGate({ cliRoot: cli, executable, names: ['@openpresentation/opf-editor'], event: 'push', ref: 'refs/heads/main' }), /no peer range/);
});

test('the CLI peer tests use the gate; the peer ranges of core equal PEER_RANGES, and the CLI ranges equal or lag them', () => {
  for (const file of ['packages/cli/test/files.mjs', 'packages/cli/test/packed-files.mjs']) assert.match(readFileSync(path.join(root, file), 'utf8'), /cliPeerGate\(/, file);
  const manifest = JSON.parse(readFileSync(path.join(root, 'packages/cli/package.json'), 'utf8'));
  const peers = readFileSync(path.join(root, 'packages/javascript/src/node/peers.ts'), 'utf8');
  // RR-62: core's /node engine loads the peers, so core declares them (optional) and PEER_RANGES (its install hints)
  // with the same ranges. Core ships first in a train, so it raises them to the train's sibling minor before its release;
  // until the CLI's release prep raises the CLI's, the CLI's ranges may only lag core's.
  const floor = (r) => r.replace(/^\^/, '').split('.').reduce((n, part) => n * 1000 + Number(part), 0);
  const core = JSON.parse(readFileSync(path.join(root, 'packages/javascript/package.json'), 'utf8')).peerDependencies;
  assert.deepEqual(Object.keys(core).sort(), Object.keys(manifest.peerDependencies).sort());
  for (const [name, range] of Object.entries(core)) {
    const constant = name.endsWith('opf-render') ? 'RENDER_PACKAGE' : 'PPTX_PACKAGE';
    assert.match(peers, new RegExp(`\\[${constant}\\]: "${range.replace(/[.^]/g, '\\$&')}"`), name);
    const cli = manifest.peerDependencies[name];
    assert.ok(cli === range || floor(cli) < floor(range), `${name}: the CLI's ${cli} is ahead of core's ${range}`);
  }
});

test('a core release tag skips only the CLI peer tests; the CLI release and other tags keep the hard gate', () => {
  assert.equal(isCoreReleaseRef('refs/tags/opf-v0.15.1'), true);
  assert.equal(isCoreReleaseRef('refs/tags/@openpresentation/opf@v0.15.1'), true);
  for (const ref of ['refs/tags/cli-v0.15.0', 'refs/tags/opf-render-v0.15.0', 'refs/heads/main', '']) assert.equal(isCoreReleaseRef(ref), false, ref);
  // A core release still fails the generic gate (only the CLI peer gate knows the core run does not ship the CLI).
  assert.throws(() => gate({ subject: 'x', required: 'y', installed: '0.14.0', met: false, event: 'push', ref: 'refs/tags/opf-v0.15.1' }), /roller-candidate run may skip/);
});

test('peerCoreGate waits while a published sibling does not accept the candidate core, and only on the pre-publish runs', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'peer-core-gate-'));
  const put = (name, version, coreRange) => {
    mkdirSync(path.join(dir, name), { recursive: true });
    writeFileSync(path.join(dir, name, 'package.json'), JSON.stringify({ name, version, dependencies: coreRange ? { '@openpresentation/opf': coreRange } : {} }));
  };
  const names = ['@openpresentation/opf-render', '@openpresentation/opf-pptx'];
  put('@openpresentation/opf-render', '0.15.0', '^0.15.0');
  put('@openpresentation/opf-pptx', '0.15.0', '^0.15.0');
  const at = (event, ref) => peerCoreGate({ modules: dir, names, coreVersion: '0.16.0', event, ref });
  assert.equal(at('pull_request', 'refs/heads/main').run, false);
  assert.match(at('merge_group', 'refs/heads/gh-readonly-queue/main/pr-1-abc').message, /opf-render@0\.15\.0 accepting @openpresentation\/opf 0\.16\.0/);
  assert.equal(at('push', 'refs/tags/opf-v0.16.0').run, false);
  for (const [event, ref] of [['push', 'refs/heads/main'], ['push', 'refs/tags/cli-v0.16.0'], ['schedule', 'refs/heads/main'], ['', '']]) {
    assert.throws(() => at(event, ref), /roller-candidate run may skip/, `${event} ${ref}`);
  }
  // The siblings at the candidate's minor accept it: the checks run everywhere.
  put('@openpresentation/opf-render', '0.16.0', '^0.16.0');
  put('@openpresentation/opf-pptx', '0.16.0', '^0.16.0');
  assert.equal(at('push', 'refs/tags/cli-v0.16.0').run, true);
  assert.equal(at('', '').run, true);
});
