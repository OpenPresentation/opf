// MR-40: scripts/release.mjs and scripts/release-registry.mjs on a fixture workspace and a fake registry. Nothing here touches
// the network, npm or the real repository.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkPeerRanges, checkVersions } from './check-versions.mjs';
import {
  NAMES,
  NO_CHANGES,
  PACKAGES,
  checkPublish,
  checkTag,
  defaultTag,
  main,
  planPrepare,
  publishArgs,
  readReleaseManifest,
  releaseNotes,
  smoke,
  resolveVersion,
  setPeerHintsText,
  setPeerRangesText,
  setVersionText,
  sharedLine,
  stabilityOf,
  verifyRelease,
} from './release.mjs';
import { PUBLISH_WORKFLOW, REPOSITORY, SLSA, compareVersions, highest, isPrerelease, isVersion, verifyPackage } from './release-registry.mjs';

const GALLERY = '@openpresentation/gallery';
const CORE = '@openpresentation/opf';
const sha = (text) => createHash('sha512').update(text).digest();

// ---------------------------------------------------------------------------------------------------------------------
// A fixture workspace: six manifests at one version, core's peers and PEER_RANGES, six changelogs, changes/.

function fixture({ version = '0.26.0', fragments = {}, changelogVersions = {} } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'release-test-'));
  const write = (file, text) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  for (const { dir, name } of PACKAGES) {
    const manifest = { name, version, type: 'module', dependencies: { zod: '^3.0.0' } };
    if (name === CORE) manifest.peerDependencies = { '@openpresentation/opf-pptx': `^${version}`, '@openpresentation/opf-render': `^${version}` };
    write(`packages/${dir}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  write('packages/javascript/src/node/peers.ts', `export const PEER_RANGES = { [RENDER_PACKAGE]: "^${version}", [PPTX_PACKAGE]: "^${version}" } as const;\n`);
  write('pnpm-workspace.yaml', `packages:\n${PACKAGES.map(({ dir }) => `  - "packages/${dir}"`).join('\n')}\n`);
  const targets = { opf: 'CHANGELOG.md', cli: 'packages/cli/CHANGELOG.md', render: 'packages/render/CHANGELOG.md', pptx: 'packages/pptx/CHANGELOG.md', editor: 'packages/editor/CHANGELOG.md', gallery: 'packages/gallery/CHANGELOG.md' };
  write('changes/config.json', `${JSON.stringify({ default: 'opf', targets, codePaths: ['packages/'] })}\n`);
  for (const [key, file] of Object.entries(targets)) write(file, `# Changelog\n\n## Unreleased\n\n## ${changelogVersions[key] ?? '0.25.0'} (2026-10-21)\n\n- earlier\n`);
  for (const [slug, text] of Object.entries(fragments)) write(`changes/${slug}.md`, text);
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const fragment = (type, packages, body, drawing) => `---\ntype: ${type}\npackages: [${packages.join(', ')}]\n${drawing ? `drawing: [${drawing.map((id) => `"${id}"`).join(', ')}]\n` : ''}---\n${body}\n`;

/** A fake registry: `latest` and `versions` per package. */
function fakeRegistry({ latest = {}, published = {} } = {}) {
  const base = { [CORE]: '0.25.0', '@openpresentation/cli': '0.25.0', '@openpresentation/opf-render': '0.25.0', '@openpresentation/opf-pptx': '0.25.0', '@openpresentation/opf-editor': '0.25.3', [GALLERY]: '5.0.0' };
  const tags = { ...base, ...latest };
  return {
    distTags: async (name) => ({ latest: tags[name] }),
    manifest: async (name, version) => (published[name]?.includes(version) ? { name, version } : null),
  };
}

const noStability = { schemaChanged: false, schema: { previous: 4, candidate: 4 }, kinds: {}, content: {} };
const removedLayout = { schemaChanged: false, schema: { previous: 4, candidate: 4 }, kinds: { layouts: { compared: 3, changed: [], removed: ['hero'], added: [] } }, content: {} };

// ---------------------------------------------------------------------------------------------------------------------

test('versions: precedence, prerelease, the highest', () => {
  assert.equal(compareVersions('0.26.0', '0.25.3'), 1);
  assert.equal(compareVersions('0.26.0-rc.0', '0.26.0'), -1);
  assert.equal(compareVersions('0.26.0-rc.2', '0.26.0-rc.10'), -1);
  assert.equal(compareVersions('0.26.0', '5.0.0'), -1);
  assert.equal(highest(['0.25.0', '0.25.3', '0.9.9', 'junk']), '0.25.3');
  assert.ok(isVersion('0.26.0-rc.0') && !isVersion('0.26.0+build') && !isVersion('v0.26.0'));
  assert.ok(isPrerelease('0.26.0-rc.0') && !isPrerelease('0.26.0'));
  assert.equal(defaultTag('0.26.0-rc.0'), 'next');
  assert.equal(defaultTag('0.26.0'), 'latest');
});

test('the publish order is dependency order, gallery first, CLI last, and covers exactly the six', () => {
  assert.deepEqual(NAMES, [GALLERY, CORE, '@openpresentation/opf-render', '@openpresentation/opf-pptx', '@openpresentation/opf-editor', '@openpresentation/cli']);
});

test('text edits change the version, core peers and PEER_RANGES and nothing else', () => {
  const manifest = '{\n  "name": "x",\n  "version": "0.26.0",\n  "dependencies": { "zod": "^0.26.0" },\n  "peerDependencies": {\n    "@openpresentation/opf-pptx": "^0.26.0",\n    "left-pad": "^0.26.0"\n  }\n}\n';
  assert.equal(setVersionText(manifest, '0.27.0').match(/"version": "([^"]+)"/)[1], '0.27.0');
  assert.ok(setVersionText(manifest, '0.27.0').includes('"zod": "^0.26.0"'));
  const peers = setPeerRangesText(manifest, '0.27.0');
  assert.ok(peers.includes('"@openpresentation/opf-pptx": "^0.27.0"'));
  assert.ok(peers.includes('"left-pad": "^0.26.0"'), 'a peer outside the six is not touched');
  assert.equal(setPeerHintsText('export const PEER_RANGES = { [R]: "^0.26.0", [P]: "^0.26.0" } as const;', '0.27.0'), 'export const PEER_RANGES = { [R]: "^0.27.0", [P]: "^0.27.0" } as const;');
  assert.throws(() => setPeerHintsText('nothing', '0.27.0'), /PEER_RANGES/);
  assert.throws(() => setVersionText('{}', '1.0.0'), /no top-level/);
});

test('resolveVersion: explicit, patch and minor of the line, nothing else', () => {
  assert.equal(resolveVersion('0.26.0-rc.0', '0.25.0'), '0.26.0-rc.0');
  assert.equal(resolveVersion('patch', '0.26.0'), '0.26.1');
  assert.equal(resolveVersion('minor', '0.26.3'), '0.27.0');
  assert.throws(() => resolveVersion('major', '0.26.0'), /patch or minor/);
  assert.throws(() => resolveVersion('0.26.0+x', '0.26.0'), /build metadata/);
  assert.throws(() => resolveVersion('patch', '0.26.0-rc.0'), /prerelease/);
});

test('dist-tag rules: a release goes to latest, a prerelease never does', () => {
  assert.deepEqual(checkTag('0.26.0', 'latest'), []);
  assert.deepEqual(checkTag('0.26.0-rc.0', 'next'), []);
  assert.match(checkTag('0.26.0-rc.0', 'latest')[0], /prerelease/);
  assert.match(checkTag('0.26.0', 'next')[0], /release/);
  assert.match(checkTag('0.26.0', 'beta')[0], /one of latest, next/);
});

test('sharedLine ignores the gallery and any latest at or above the version (a package this release already published)', () => {
  const latest = { [GALLERY]: '5.0.0', [CORE]: '0.25.0', '@openpresentation/cli': '0.24.1', '@openpresentation/opf-render': '0.25.0', '@openpresentation/opf-pptx': '0.25.0', '@openpresentation/opf-editor': '0.25.3' };
  assert.equal(sharedLine(latest, '0.26.0'), '0.25.3');
  assert.equal(sharedLine({ ...latest, [CORE]: '0.26.0' }, '0.26.0'), '0.25.3');
  assert.equal(sharedLine({ [GALLERY]: '5.0.0' }, '0.26.0'), undefined);
});

// ---------------------------------------------------------------------------------------------------------------------
// prepare

test('prepare plans the first train: one version everywhere, peers, six changelogs, fragments consumed', async () => {
  const { root, cleanup } = fixture({ fragments: { 'a-core': fragment('added', ['opf', 'render'], 'Core and render change.'), 'b-gallery': fragment('added', ['gallery'], 'A new layout.') } });
  try {
    const plan = await planPrepare({ root, input: '0.26.0-rc.0', stability: noStability, registry: fakeRegistry(), date: '2026-10-23' });
    assert.equal(plan.version, '0.26.0-rc.0');
    assert.equal(plan.previous, '0.25.3');
    assert.equal(plan.tag, 'v0.26.0-rc.0');
    assert.equal(plan.distTag, 'next');
    const byFile = Object.fromEntries(plan.writes.map(({ file, text }) => [file, text]));
    for (const { dir } of PACKAGES) assert.equal(JSON.parse(byFile[`packages/${dir}/package.json`]).version, '0.26.0-rc.0');
    assert.deepEqual(JSON.parse(byFile['packages/javascript/package.json']).peerDependencies, { '@openpresentation/opf-pptx': '^0.26.0-rc.0', '@openpresentation/opf-render': '^0.26.0-rc.0' });
    assert.ok(byFile['packages/javascript/src/node/peers.ts'].includes('"^0.26.0-rc.0"'));
    // check:versions accepts the result
    const members = PACKAGES.map(({ dir }) => ({ dir: `packages/${dir}`, manifest: JSON.parse(byFile[`packages/${dir}/package.json`]) }));
    assert.deepEqual([...checkVersions(members), ...checkPeerRanges(members, byFile['packages/javascript/src/node/peers.ts'])], []);
    // changelogs: every package has the section; untouched ones say so; touched ones carry the fragment
    assert.match(byFile['CHANGELOG.md'], /## 0\.26\.0-rc\.0 \(2026-10-23\)\n\n- Core and render change\./);
    assert.match(byFile['packages/render/CHANGELOG.md'], /- Core and render change\./);
    assert.match(byFile['packages/gallery/CHANGELOG.md'], /- A new layout\./);
    for (const file of ['packages/cli/CHANGELOG.md', 'packages/pptx/CHANGELOG.md', 'packages/editor/CHANGELOG.md']) assert.match(byFile[file], new RegExp(`## 0\\.26\\.0-rc\\.0 \\(2026-10-23\\)\\n\\n${NO_CHANGES}\\n`), file);
    assert.deepEqual(plan.removes.sort(), ['changes/a-core.md', 'changes/b-gallery.md']);
  } finally {
    cleanup();
  }
});

test('prepare --dry-run writes nothing; prepare writes the plan, deletes the fragments and records the outputs', async () => {
  const { root, cleanup } = fixture({ fragments: { 'a-core': fragment('fixed', ['opf'], 'A fix.') } });
  const logs = [];
  const deps = { registry: fakeRegistry(), log: (line) => logs.push(line), pnpm: () => assert.fail('--no-lockfile'), runStability: () => assert.fail('--stability is given') };
  const stabilityFile = path.join(root, 'stability.json');
  writeFileSync(stabilityFile, JSON.stringify({ result: noStability, verdict: { ok: true } }));
  try {
    const before = readFileSync(path.join(root, 'packages/cli/package.json'), 'utf8');
    await main(['prepare', '0.26.0', '--dir', root, '--stability', stabilityFile, '--no-lockfile', '--dry-run'], deps);
    assert.equal(readFileSync(path.join(root, 'packages/cli/package.json'), 'utf8'), before);
    assert.ok(existsSync(path.join(root, 'changes/a-core.md')));
    const output = path.join(root, 'github-output.txt');
    await main(['prepare', '0.26.0', '--dir', root, '--stability', stabilityFile, '--no-lockfile', '--github-output', output, '--date', '2026-10-23'], deps);
    assert.equal(JSON.parse(readFileSync(path.join(root, 'packages/cli/package.json'), 'utf8')).version, '0.26.0');
    assert.ok(!existsSync(path.join(root, 'changes/a-core.md')));
    assert.deepEqual(readdirSync(path.join(root, 'changes')).sort(), ['config.json']);
    assert.equal(readFileSync(output, 'utf8'), 'version=0.26.0\nprevious=0.25.3\ntag=v0.26.0\ndist-tag=latest\nbump=patch\ncommit-message=release v0.26.0\n');
  } finally {
    cleanup();
  }
});

test('prepare runs pnpm to refresh the lockfile and fails when pnpm fails', async () => {
  const { root, cleanup } = fixture();
  try {
    const calls = [];
    const deps = { registry: fakeRegistry(), log() {}, pnpm: (args, options) => {
        calls.push([args, options.cwd]);
        return { status: 0 };
      },
    };
    await main(['prepare', '0.26.0', '--dir', root, '--no-stability'], deps);
    assert.deepEqual(calls, [[['install', '--lockfile-only', '--ignore-scripts'], root]]);
    await assert.rejects(() => main(['prepare', '0.26.1', '--dir', root, '--no-stability'], { ...deps, pnpm: () => ({ status: 1, stdout: '', stderr: 'ERR_PNPM' }) }), /ERR_PNPM/);
  } finally {
    cleanup();
  }
});

test('prepare refuses a patch when a drawing change is declared, a record id was removed or CATALOG_SCHEMA changed; a minor passes', async () => {
  const declared = { 'g-draw': fragment('changed', ['gallery'], 'Hero moved.', ['layouts:hero']) };
  const { root, cleanup } = fixture({ version: '0.26.0', fragments: declared });
  const registry = fakeRegistry({ latest: { [CORE]: '0.26.0', '@openpresentation/cli': '0.26.0', '@openpresentation/opf-render': '0.26.0', '@openpresentation/opf-pptx': '0.26.0', '@openpresentation/opf-editor': '0.26.0', [GALLERY]: '0.26.0' } });
  try {
    await assert.rejects(planPrepare({ root, input: 'patch', stability: noStability, registry }), /0\.26\.1 after 0\.26\.0 is not a minor bump.*declared drawing change: layouts:hero/s);
    const plan = await planPrepare({ root, input: 'minor', stability: noStability, registry });
    assert.equal(plan.version, '0.27.0');
    assert.equal(plan.bump, 'minor');
    const gallery = plan.writes.find(({ file }) => file === 'packages/gallery/CHANGELOG.md').text;
    assert.match(gallery, /Drawing change.*`layouts:hero`/);
  } finally {
    cleanup();
  }
  const plain = fixture({ version: '0.26.0' });
  try {
    await assert.rejects(planPrepare({ root: plain.root, input: '0.26.1', stability: removedLayout, registry }), /removed record id: layouts:hero/);
    await assert.rejects(planPrepare({ root: plain.root, input: '0.26.1', stability: { ...noStability, schemaChanged: true, schema: { previous: 4, candidate: 5 } }, registry }), /CATALOG_SCHEMA 4 -> 5/);
    assert.equal((await planPrepare({ root: plain.root, input: '0.26.1', stability: noStability, registry })).bump, 'patch');
  } finally {
    plain.cleanup();
  }
});

test('prepare refuses a failing check:stability, a version not above the previous release and a version already on npm', async () => {
  const { root, cleanup } = fixture();
  try {
    await assert.rejects(planPrepare({ root, input: '0.26.0', stability: { ...noStability, verdictOk: false }, registry: fakeRegistry() }), /check:stability fails/);
    await assert.rejects(planPrepare({ root, input: '0.25.3', previous: '0.25.3', stability: noStability, registry: fakeRegistry() }), /not above the previous release 0\.25\.3/);
    await assert.rejects(planPrepare({ root, input: '0.26.0', stability: noStability, registry: fakeRegistry({ published: { [CORE]: ['0.26.0'] } }) }), /@openpresentation\/opf@0\.26\.0 is already on npm/);
    await assert.rejects(planPrepare({ root, input: 'patch', stability: noStability, registry: undefined }), /pass --previous/);
    assert.equal((await planPrepare({ root, input: 'patch', previous: '0.26.0', stability: noStability, registry: undefined })).version, '0.26.1');
  } finally {
    cleanup();
  }
});

test('stabilityOf reads the --json file of gallery-stability and a bare result', () => {
  assert.equal(stabilityOf(undefined), undefined);
  assert.deepEqual(stabilityOf({ result: noStability, verdict: { ok: false } }), { ...noStability, verdictOk: false });
  assert.deepEqual(stabilityOf(noStability), noStability);
});

// ---------------------------------------------------------------------------------------------------------------------
// the publish gate and publish

test('checkPublish: the first train goes to the gallery below its 5.0.0 because it compares with the shared line', async () => {
  const gate = await checkPublish(fakeRegistry(), '0.26.0', 'latest');
  assert.deepEqual(gate.problems, []);
  assert.equal(gate.previous, '0.25.3');
  assert.deepEqual(gate.skip, []);
});

test('checkPublish: a version at or below a package\'s latest, a wrong tag and a missing shared line are refused', async () => {
  const gate = await checkPublish(fakeRegistry({ latest: { '@openpresentation/opf-pptx': '0.26.0' } }), '0.26.0', 'latest');
  assert.deepEqual(gate.problems, ['@openpresentation/opf-pptx@0.26.0 is not above its `latest` 0.26.0']);
  assert.match((await checkPublish(fakeRegistry(), '0.26.0-rc.0', 'latest')).problems[0], /prerelease/);
  assert.deepEqual((await checkPublish(fakeRegistry(), '0.26.0-rc.0', 'next')).problems, []);
  const empty = { distTags: async (name) => (name === GALLERY ? { latest: '5.0.0' } : {}), manifest: async () => null };
  assert.match((await checkPublish(empty, '0.26.0', 'latest')).problems.join(), /no shared line/);
});

test('checkPublish: a re-run after a partial publish skips the published ones and still passes the rest', async () => {
  const done = [GALLERY, CORE];
  const registry = fakeRegistry({ latest: { [GALLERY]: '0.26.0', [CORE]: '0.26.0' }, published: { [GALLERY]: ['0.26.0'], [CORE]: ['0.26.0'] } });
  const gate = await checkPublish(registry, '0.26.0', 'latest');
  assert.deepEqual(gate.problems, []);
  assert.deepEqual(gate.skip, done);
  assert.equal(gate.previous, '0.25.3');
});

function tarballs(version = '0.26.0') {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'release-tarballs-'));
  const packages = PACKAGES.map(({ name }) => {
    const filename = `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;
    writeFileSync(path.join(dir, filename), `tarball of ${name}`);
    return { name, version, filename, integrity: `sha512-${sha(`tarball of ${name}`).toString('base64')}` };
  });
  writeFileSync(path.join(dir, 'release-manifest.json'), JSON.stringify({ version, tag: `v${version}`, commit: 'a'.repeat(40), packages }));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('publish runs npm publish per tarball in dependency order with an explicit --tag and --provenance, and skips what is on npm', async () => {
  const { dir, cleanup } = tarballs();
  try {
    const calls = [];
    const deps = { registry: fakeRegistry({ published: { [GALLERY]: ['0.26.0'] } }), log() {}, npm: (args) => {
      calls.push(args);
      return { status: 0 };
    } };
    const results = await main(['publish', '0.26.0', '--dir', dir], deps);
    assert.deepEqual(results.map(({ status }) => status), ['skipped', 'published', 'published', 'published', 'published', 'published']);
    assert.deepEqual(calls.map((args) => PACKAGES.find(({ name }) => path.basename(args[1]) === `${name.replace('@', '').replace('/', '-')}-0.26.0.tgz`).name), NAMES.slice(1));
    for (const args of calls) {
      assert.deepEqual(args.slice(2), ['--access', 'public', '--provenance', '--tag', 'latest']);
      assert.ok(path.isAbsolute(args[1]));
    }
  } finally {
    cleanup();
  }
});

test('publish --dry-run passes --dry-run and no --provenance; a prerelease defaults to --tag next', async () => {
  assert.deepEqual(publishArgs('/t.tgz', 'next', { dryRun: true }), ['publish', '/t.tgz', '--access', 'public', '--dry-run', '--tag', 'next']);
  const { dir, cleanup } = tarballs('0.26.0-rc.0');
  try {
    const calls = [];
    await main(['publish', '0.26.0-rc.0', '--dir', dir, '--dry-run'], { registry: fakeRegistry(), log() {}, npm: (args) => {
      calls.push(args);
      return { status: 0 };
    } });
    assert.equal(calls.length, 6);
    for (const args of calls) assert.deepEqual(args.slice(-3), ['--dry-run', '--tag', 'next'].slice(-3));
    assert.ok(calls.every((args) => !args.includes('--provenance') && args.at(-1) === 'next'));
  } finally {
    cleanup();
  }
});

test('publish stops at the first failure and says what is already on npm; a changed tarball or a refused gate publishes nothing', async () => {
  const { dir, cleanup } = tarballs();
  try {
    const calls = [];
    const failing = { registry: fakeRegistry(), log() {}, npm: (args) => {
        calls.push(args);
        return { status: calls.length === 3 ? 1 : 0, stdout: '', stderr: 'E403 not a trusted publisher' };
      } };
    await assert.rejects(main(['publish', '0.26.0', '--dir', dir], failing), /failed \(exit 1\).*re-run to continue.*E403/s);
    assert.equal(calls.length, 3, 'nothing after the failed package is published');
    const never = { registry: fakeRegistry({ latest: { [CORE]: '0.26.0' } }), log() {}, npm: () => assert.fail('the gate refuses first') };
    await assert.rejects(main(['publish', '0.26.0', '--dir', dir], never), /not above its `latest`/);
    writeFileSync(path.join(dir, 'openpresentation-cli-0.26.0.tgz'), 'tampered');
    await assert.rejects(main(['publish', '0.26.0', '--dir', dir], { ...never, registry: fakeRegistry() }), /differs from the digest/);
    assert.throws(() => readReleaseManifest(dir, '0.27.0'), /is for 0\.26\.0/);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// verify

const COMMIT = 'c'.repeat(40);
const SIBLINGS = NAMES;

/** A manifest and attestation bundle as the registry serves them for a release published by npm-publish.yml on the tag. */
function published(name, version, { gitHead = COMMIT, ref = `refs/tags/v${version}`, path: workflowPath = PUBLISH_WORKFLOW, source = COMMIT, deps = {}, drop } = {}) {
  const integrity = `sha512-${sha(name + version).toString('base64')}`;
  const statement = {
    subject: [{ name: `pkg:npm/${name}@${version}`, digest: { sha512: sha(name + version).toString('hex') } }],
    predicate: { buildDefinition: { externalParameters: { workflow: { repository: REPOSITORY, path: workflowPath, ref } }, resolvedDependencies: [{ digest: { gitCommit: source } }] }, runDetails: { metadata: { invocationId: 'run/1' } } },
  };
  const bundle = { attestations: [{ predicateType: SLSA, bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString('base64') } } }] };
  const manifest = { name, version, gitHead, dist: { integrity, attestations: drop === 'attestations' ? undefined : { url: `https://registry/attestations/${name}`, provenance: { predicateType: SLSA } } }, dependencies: deps };
  return { manifest, bundle };
}

function verifyDeps(entries, { tags, audit } = {}) {
  const npm = {
    manifest: async (name) => entries[name]?.manifest ?? null,
    distTags: async (name) => tags?.[name] ?? { latest: entries[name]?.manifest.version },
    attestations: async (url) => Object.values(entries).find((entry) => url.endsWith(entry.manifest.name))?.bundle ?? null,
    auditSignatures: (name, version) => audit?.(name, version) ?? { ok: true, report: { verified: [{ name, version, attestations: {} }], invalid: [], missing: [] } },
  };
  return { npm, now: () => 0, sleep: async () => {}, log() {} };
}

const expectation = (extra = {}) => ({ version: '0.26.0', commit: COMMIT, tag: 'v0.26.0', distTag: 'latest', siblings: SIBLINGS, ...extra });

test('verifyPackage passes a release published by npm-publish.yml on its tag from the release commit', async () => {
  const entry = published(CORE, '0.26.0', { deps: { '@openpresentation/gallery': '^0.26.0', zod: '^3.0.0' } });
  const result = await verifyPackage(verifyDeps({ [CORE]: entry }), { name: CORE }, expectation({ changelogHas: () => true }));
  assert.ok(result.ok, JSON.stringify(result.checks.filter((check) => !check.ok)));
  assert.deepEqual(result.checks.map((check) => check.name), ['npm version', 'gitHead', 'dist-tag', 'lockstep ranges', 'changelog', 'dist.attestations', 'SLSA provenance', 'npm audit signatures']);
});

test('verifyPackage fails on each thing the canary exists to catch', async () => {
  const failing = async (options, expect = {}, deps = {}) => {
    const result = await verifyPackage(verifyDeps({ [CORE]: published(CORE, '0.26.0', options) }, deps), { name: CORE }, expectation(expect));
    return result.checks.filter((check) => !check.ok).map((check) => check.name);
  };
  assert.deepEqual(await failing({ gitHead: 'd'.repeat(40) }), ['gitHead']);
  assert.deepEqual(await failing({ gitHead: null }), ['gitHead']);
  assert.deepEqual(await failing({ ref: 'refs/heads/main' }), ['SLSA provenance']);
  assert.deepEqual(await failing({ path: '.github/workflows/release.yml' }), ['SLSA provenance']);
  assert.deepEqual(await failing({ source: 'd'.repeat(40) }), ['SLSA provenance']);
  assert.deepEqual(await failing({ drop: 'attestations' }), ['dist.attestations']);
  assert.deepEqual(await failing({}, {}, { tags: { [CORE]: { latest: '0.25.0', next: '0.26.0' } } }), ['dist-tag']);
  assert.deepEqual(await failing({}, { changelogHas: () => false }), ['changelog']);
  assert.deepEqual(await failing({ deps: { '@openpresentation/gallery': 'workspace:^' } }), ['lockstep ranges']);
  assert.deepEqual(await failing({ deps: { '@openpresentation/gallery': '^0.25.0' } }), ['lockstep ranges']);
  assert.deepEqual(await failing({}, {}, { audit: () => ({ ok: false, report: { verified: [], invalid: [{ name: CORE }], missing: [] } }) }), ['npm audit signatures']);
  const absent = await verifyPackage(verifyDeps({}), { name: CORE }, expectation());
  assert.deepEqual(absent.checks, [{ name: 'npm version', ok: false, detail: `${CORE}@0.26.0 is not on the registry` }]);
});

test('verifyPackage waits for the attestation bundle only while it is a 404', async () => {
  const entry = published(CORE, '0.26.0');
  let calls = 0;
  const deps = verifyDeps({ [CORE]: entry });
  deps.npm.attestations = async () => (++calls < 3 ? null : entry.bundle);
  let clock = 0;
  deps.now = () => clock;
  deps.sleep = async (ms) => {
    clock += ms;
  };
  const ok = await verifyPackage(deps, { name: CORE }, expectation(), { waitMinutes: 5, pollSeconds: 30 });
  assert.ok(ok.ok);
  assert.equal(calls, 3);
  calls = -100;
  const late = await verifyPackage(deps, { name: CORE }, expectation(), { waitMinutes: 1, pollSeconds: 30 });
  assert.match(late.checks.find((check) => check.name === 'SLSA provenance').detail, /still not propagated after 1 min/);
});

test('verifyRelease checks all six in order and reports the failing ones', async () => {
  const { root, cleanup } = fixture({ changelogVersions: { opf: '0.26.0', cli: '0.26.0', render: '0.26.0', pptx: '0.26.0', editor: '0.26.0', gallery: '0.26.0' } });
  try {
    const entries = Object.fromEntries(NAMES.map((name) => [name, published(name, '0.26.0')]));
    const ok = await verifyRelease(verifyDeps(entries), '0.26.0', { commit: COMMIT, root });
    assert.ok(ok.ok, JSON.stringify(ok.results.map((entry) => entry.checks.filter((check) => !check.ok))));
    assert.deepEqual(ok.results.map((entry) => entry.name), NAMES);
    const bad = await verifyRelease(verifyDeps({ ...entries, [GALLERY]: published(GALLERY, '0.26.0', { gitHead: 'e'.repeat(40) }) }), '0.26.0', { commit: COMMIT, root });
    assert.deepEqual(bad.results.filter((entry) => !entry.ok).map((entry) => entry.name), [GALLERY]);
    // `verify` reads the root changelog of the checkout: a package without a section fails
    const missing = await verifyRelease(verifyDeps(entries), '0.27.0', { commit: COMMIT, root });
    assert.ok(!missing.ok);
  } finally {
    cleanup();
  }
});

test('notes: the release body is grouped by package and names the packages released with no change', async () => {
  const { root, cleanup } = fixture({ fragments: { a: fragment('added', ['opf', 'cli'], 'Shared.'), b: fragment('fixed', ['gallery'], 'Gallery fix.') } });
  try {
    const plan = await planPrepare({ root, input: '0.26.0', stability: noStability, registry: fakeRegistry(), date: '2026-10-23' });
    for (const { file, text } of plan.writes) writeFileSync(path.join(root, file), text);
    const body = releaseNotes(root, '0.26.0');
    assert.match(body, /^## @openpresentation\/gallery\n\n### |^## @openpresentation\/gallery\n\n- Gallery fix\./m);
    assert.match(body, /## @openpresentation\/opf\n\n- Shared\./);
    assert.match(body, /## @openpresentation\/cli\n\n- Shared\./);
    assert.match(body, /Released with the set, no changes: `@openpresentation\/opf-render`, `@openpresentation\/opf-pptx`, `@openpresentation\/opf-editor`\./);
    assert.throws(() => releaseNotes(root, '0.27.0'), /has no 0\.27\.0 section/);
  } finally {
    cleanup();
  }
});

test('smoke installs the six tarballs together with overrides to themselves, then renders, resolves and runs the CLI', () => {
  const { dir, cleanup } = tarballs();
  const deck = path.join(dir, 'deck.json');
  writeFileSync(deck, '{}');
  try {
    const seen = [];
    const exec = (command, args, options) => {
      const manifest = JSON.parse(readFileSync(path.join(options.cwd, 'package.json'), 'utf8'));
      seen.push({ command: path.basename(command), args, dependencies: manifest.dependencies, overrides: manifest.overrides, files: readdirSync(options.cwd).sort() });
      return { status: 0, stdout: 'ok\n', stderr: '' };
    };
    const log = smoke(dir, '0.26.0', { deck, exec });
    assert.equal(log.length, 3);
    assert.deepEqual(seen.map((step) => step.args[0]), ['install', 'smoke.mjs', path.join('node_modules', '@openpresentation', 'cli', 'dist', 'index.js')]);
    assert.deepEqual(Object.keys(seen[0].dependencies), NAMES);
    assert.ok(Object.values(seen[0].dependencies).every((spec) => spec.startsWith('file:/')));
    assert.deepEqual(seen[0].overrides, Object.fromEntries(NAMES.map((name) => [name, `$${name}`])));
    assert.deepEqual(seen[1].files, ['deck.opf.json', 'package.json', 'smoke.mjs']);
    seen.length = 0;
    smoke(undefined, '0.26.0', { deck, registry: true, exec });
    assert.deepEqual(seen[0].dependencies, Object.fromEntries(NAMES.map((name) => [name, '0.26.0'])));
    assert.equal(seen[0].overrides, undefined);
    assert.throws(() => smoke(dir, '0.26.0', { deck, exec: () => ({ status: 1, stdout: '', stderr: 'ERESOLVE' }) }), /smoke: npm install .* failed.*ERESOLVE/s);
  } finally {
    cleanup();
  }
});
