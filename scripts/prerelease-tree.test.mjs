// MR-41: a prerelease tree passes the same checks as a stable one. `release.mjs prepare X.Y.Z-rc.N` sets six versions and core's
// peer ranges; the 0.26.0-rc.0 pull request failed CI on tests and checks that assumed a stable `X.Y.Z` (the peer range shape in
// the CLI and integration tests, the lazy font gate refusing every prerelease). This prepares a copy of the real manifests for
// a stable version and for prereleases (planPrepare reads the repository and writes nothing; the copy is in a temp folder), and
// runs the checks that read those versions against the copy, so the next release candidate does not find the next such test.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LAZY_FONT_COUNTS, REVIEWED_FONT_SETS, assertLazyFontCount } from './lazy-font-counts.mjs';
import { checkPeerRanges, checkVersions } from './check-versions.mjs';
import { checkTag, defaultTag, planPrepare } from './release.mjs';
import { compareVersions, isPrerelease } from './release-registry.mjs';
import { CARET_RANGE, VERSION, prereleaseOutside } from './version-shapes.mjs';
import { loadWorkspace } from './workspace-packages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSIONS = ['0.26.0', '0.26.0-rc.0', '0.26.0-rc.12', '0.27.0-beta.3'];
const reviewed = Object.entries(REVIEWED_FONT_SETS)[0];

/** The files the version checks read, prepared for `version` in a temp folder. */
async function preparedTree(version) {
  const tree = mkdtempSync(path.join(os.tmpdir(), 'prerelease-tree-'));
  const { members, workspace } = loadWorkspace(root);
  const files = ['package.json', 'pnpm-workspace.yaml', 'changes/config.json', ...members.map(({ dir }) => `${dir}/package.json`)];
  for (const file of files) {
    mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
    cpSync(path.join(root, file), path.join(tree, file));
  }
  const plan = await planPrepare({ root, input: version, previous: '0.25.0', stability: undefined });
  for (const { file, text } of plan.writes) {
    mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
    writeFileSync(path.join(tree, file), text);
  }
  assert.ok(workspace.packages.length >= 6);
  return { tree, plan, cleanup: () => rmSync(tree, { recursive: true, force: true }) };
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const script = (name, tree) => spawnSync(process.execPath, [path.join(root, 'scripts', name), tree], { encoding: 'utf8' });

for (const version of VERSIONS) {
  test(`${version}: the prepared tree passes check:versions and check:pins, and its ranges have the shape the tests read`, async () => {
    const { tree, plan, cleanup } = await preparedTree(version);
    try {
      assert.equal(plan.version, version);
      assert.equal(plan.distTag, isPrerelease(version) ? 'next' : 'latest');
      for (const name of ['check-versions.mjs', 'check-pins.mjs']) {
        const result = script(name, tree);
        assert.equal(result.status, 0, `${name}: ${result.stdout}${result.stderr}`);
      }
      const { members } = loadWorkspace(tree);
      const peers = path.join(tree, 'packages/javascript/src/node/peers.ts');
      assert.deepEqual([...checkVersions(members), ...checkPeerRanges(members, existsSync(peers) ? readFileSync(peers, 'utf8') : null)], []);
      for (const { dir, manifest } of members.filter(({ manifest }) => manifest.name.startsWith('@openpresentation/') && manifest.name !== '@openpresentation/integration')) {
        assert.match(manifest.version, VERSION, dir);
        assert.equal(manifest.version, version, dir);
      }
      // What the CLI tests do: the source tree says workspace:^, the published manifest ^<version> (MR-23).
      const cli = readJson(path.join(tree, 'packages/cli/package.json'));
      for (const name of ['opf-render', 'opf-pptx']) {
        const range = cli.peerDependencies[`@openpresentation/${name}`].replace(/^workspace:\^/, `^${cli.version}`);
        assert.match(range, CARET_RANGE);
        assert.equal(range, `^${version}`);
      }
      const core = readJson(path.join(tree, 'packages/javascript/package.json'));
      for (const name of ['opf-render', 'opf-pptx']) assert.equal(core.peerDependencies[`@openpresentation/${name}`], `^${version}`);
      if (existsSync(peers)) assert.deepEqual([...readFileSync(peers, 'utf8').matchAll(/PEER_RANGES[\s\S]*?\}/g)].flatMap(([block]) => [...block.matchAll(/"([^"]+)"/g)].map(([, range]) => range)), [`^${version}`, `^${version}`]);
    } finally {
      cleanup();
    }
  });

  test(`${version}: the release rules and the installed-engine fixture treat it like a stable version`, () => {
    assert.equal(defaultTag(version), isPrerelease(version) ? 'next' : 'latest');
    assert.deepEqual(checkTag(version, defaultTag(version)), []);
    // The lazy font gate (RR-90): an unlisted version passes on a reviewed font set and its count, prerelease or not.
    assert.equal(LAZY_FONT_COUNTS[version], undefined);
    const [fontSetSha256, set] = reviewed;
    assertLazyFontCount(version, set.count, 'renderer', { fontSetSha256, manifestSha256: set.manifestSha256, files: set.files });
    assert.throws(() => assertLazyFontCount(version, set.count + 1, 'renderer', { fontSetSha256, manifestSha256: set.manifestSha256, files: set.files }), /count changed/);
    // The prerelease the doctor test installs to show a range refuses it.
    const outside = prereleaseOutside(`^${version}`);
    assert.ok(isPrerelease(outside));
    assert.match(outside, VERSION);
    assert.equal(compareVersions(outside, version), -1);
  });
}

test('the shared shapes accept stable and prerelease versions and refuse the rest', () => {
  for (const good of ['0.26.0', '0.26.0-rc.0', '0.27.0-beta.3']) {
    assert.match(good, VERSION);
    assert.match(`^${good}`, CARET_RANGE);
  }
  for (const bad of ['0.26', 'v0.26.0', '0.26.0-', '^0.26.0', '0.26.0+build']) assert.doesNotMatch(bad, VERSION);
  for (const bad of ['0.26.0', '~0.26.0', '^0.26', '>=0.26.0']) assert.doesNotMatch(bad, CARET_RANGE);
  assert.equal(prereleaseOutside('^0.26.0'), '0.26.0-next.0');
  assert.equal(prereleaseOutside('^0.26.0-rc.0'), '0.26.0-0');
});
