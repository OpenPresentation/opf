import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { cliPeerMismatches, cliSkipNotice, installablePackages, satisfies } from './release-plan-cli.mjs';

const plan = ({ render = '0.14.0', pptx = '0.14.0', cli = '0.11.0' } = {}) => ({
  packages: [
    { name: '@openpresentation/opf', version: '0.14.0' },
    { name: '@openpresentation/opf-render', version: render },
    { name: '@openpresentation/opf-pptx', version: pptx },
    { name: '@openpresentation/cli', version: cli },
  ],
});
const peers = (render, pptx) => ({ '@openpresentation/opf-render': render, '@openpresentation/opf-pptx': pptx });
const reader = (value) => async () => value;
const names = (packages) => packages.map((item) => item.name);

test('satisfies: caret, tilde, exact, comparators, x-ranges, hyphen and ||', () => {
  assert.equal(satisfies('0.13.1', '^0.13.1'), true);
  assert.equal(satisfies('0.13.9', '^0.13.1'), true);
  assert.equal(satisfies('0.13.0', '^0.13.1'), false);
  assert.equal(satisfies('0.14.0', '^0.13.1'), false);
  assert.equal(satisfies('0.14.0', '^0.14.0'), true);
  assert.equal(satisfies('0.0.3', '^0.0.3'), true);
  assert.equal(satisfies('0.0.4', '^0.0.3'), false);
  assert.equal(satisfies('1.9.0', '^1.2.3'), true);
  assert.equal(satisfies('2.0.0', '^1.2.3'), false);
  assert.equal(satisfies('0.13.5', '~0.13.1'), true);
  assert.equal(satisfies('0.14.0', '~0.13.1'), false);
  assert.equal(satisfies('0.14.0', '0.14.0'), true);
  assert.equal(satisfies('0.14.1', '0.14.0'), false);
  assert.equal(satisfies('0.14.2', '0.14'), true);
  assert.equal(satisfies('0.15.0', '0.14.x'), false);
  assert.equal(satisfies('3.0.0', '*'), true);
  assert.equal(satisfies('0.14.0', '>=0.13.0 <0.15.0'), true);
  assert.equal(satisfies('0.15.0', '>=0.13.0 <0.15.0'), false);
  assert.equal(satisfies('0.14.0', '>= 0.14.0'), true);
  assert.equal(satisfies('0.14.0', '>0.14.0'), false);
  assert.equal(satisfies('0.14.0', '<=0.14.0'), true);
  assert.equal(satisfies('0.13.5', '0.13.0 - 0.13.9'), true);
  assert.equal(satisfies('0.14.0', '0.13.0 - 0.13.9'), false);
  assert.equal(satisfies('0.14.0', '^0.13.1 || ^0.14.0'), true);
  assert.equal(satisfies('0.14.0-dev.0', '^0.14.0'), false);
  assert.throws(() => satisfies('0.14.0', 'latest'), /Unsupported version or range/);
});

test('a CLI whose peer ranges the plan does not satisfy is skipped, and the notice names the mismatch', async () => {
  const p = plan();
  const read = reader(peers('^0.13.1', '^0.13.2'));
  assert.deepEqual((await cliPeerMismatches(p, { readPeers: read })).map((item) => item.short), ['opf-render', 'opf-pptx']);
  assert.equal(
    await cliSkipNotice(p, { readPeers: read }),
    "release plan's CLI 0.11.0 requires opf-render ^0.13.1, opf-pptx ^0.13.2; the plan has opf-render 0.14.0, opf-pptx 0.14.0: skipped until a compatible CLI is in the plan",
  );
  assert.deepEqual(names(await installablePackages(p, { readPeers: read })), ['@openpresentation/opf', '@openpresentation/opf-render', '@openpresentation/opf-pptx']);
});

test('one mismatching peer is enough, and only it is named', async () => {
  const read = reader(peers('^0.14.0', '^0.13.2'));
  assert.equal(
    await cliSkipNotice(plan(), { readPeers: read }),
    "release plan's CLI 0.11.0 requires opf-pptx ^0.13.2; the plan has opf-pptx 0.14.0: skipped until a compatible CLI is in the plan",
  );
});

test('a CLI whose peer ranges the plan satisfies runs, whatever its minor', async () => {
  const read = reader(peers('^0.14.0', '^0.14.0'));
  assert.equal(await cliSkipNotice(plan({ cli: '0.14.0' }), { readPeers: read }), null);
  assert.equal(await cliSkipNotice(plan({ render: '0.13.1', pptx: '0.13.2', cli: '0.11.0' }), { readPeers: reader(peers('^0.13.1', '^0.13.2')) }), null, 'CLI 0.11.0 beside the siblings its ranges accept');
});

test('the same CLI runs on a plan that still names the siblings it supports', async () => {
  const p = plan({ render: '0.13.1', pptx: '0.13.2', cli: '0.11.0' });
  const read = reader(peers('^0.13.1', '^0.13.2'));
  assert.equal(await cliSkipNotice(p, { readPeers: read }), null);
  assert.equal((await installablePackages(p, { readPeers: read })).length, 4);
});

test('a CLI with no peers, or a plan without the siblings or the CLI, runs', async () => {
  assert.equal(await cliSkipNotice(plan(), { readPeers: reader({}) }), null);
  assert.equal(await cliSkipNotice(plan(), { readPeers: reader(undefined) }), null);
  const withoutSiblings = { packages: [{ name: '@openpresentation/cli', version: '0.11.0' }] };
  assert.equal(await cliSkipNotice(withoutSiblings, { readPeers: reader(peers('^0.13.1', '^0.13.2')) }), null);
  const withoutCli = { packages: plan().packages.filter((item) => item.name !== '@openpresentation/cli') };
  let read = false;
  assert.equal(await cliSkipNotice(withoutCli, { readPeers: async () => { read = true; return peers('^0.13.1', '^0.13.2'); } }), null);
  assert.equal(read, false, 'no CLI, no registry read');
});

test('a registry read failure is an error, never a silent skip or a silent run', async () => {
  const failing = async () => {
    throw new Error('Cannot read the peer ranges of @openpresentation/cli@0.11.0 from npm: offline');
  };
  await assert.rejects(cliSkipNotice(plan(), { readPeers: failing }), /Cannot read the peer ranges/);
  await assert.rejects(installablePackages(plan(), { readPeers: failing }), /Cannot read the peer ranges/);
  await assert.rejects(cliPeerMismatches(plan(), { readPeers: failing }), /Cannot read the peer ranges/);
});

test("this checkout's CLI declares ranges that the 0.14 plan satisfies, so a plan that names it runs the CLI", async () => {
  const manifest = JSON.parse(await readFile(new URL('../packages/cli/package.json', import.meta.url), 'utf8'));
  assert.equal(await cliSkipNotice(plan({ cli: '0.14.0' }), { readPeers: reader(manifest.peerDependencies) }), null);
});
