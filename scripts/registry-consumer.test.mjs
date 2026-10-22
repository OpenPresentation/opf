import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CONSUMER_PACKAGES, ESBUILD_VERSION, consumerManifest, consumerPackages, existsAtRef, fileAtRef, installConsumer, parsePins, pinOverrides,
  registryManifest, rendererOptionalPeers, resolveRef, verifiedPackages,
} from './registry-consumer.mjs';
import { registryPlan } from './registry-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const withDirectory = (action) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'registry-consumer-'));
  return Promise.resolve(action(directory)).finally(() => rmSync(directory, { recursive: true, force: true }));
};
const git = (cwd, ...args) => {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

// What `npm view <name>@<spec>` answers for a published set, for registryPlan().
const view = (versions = {}) => (spec) => {
  const at = spec.lastIndexOf('@');
  const name = spec.slice(0, at);
  return { version: versions[name] ?? spec.slice(at + 1), gitHead: 'a'.repeat(40) };
};

test('MR-56: the set is registryPlan() at the shared version; a pin overrides one package', () => {
  const shared = consumerPackages(registryPlan({ tag: '0.26.0', refs: false, view: view() }));
  assert.deepEqual(shared, CONSUMER_PACKAGES.map((name) => ({ name, version: '0.26.0' })), 'the five libraries, in the order the site manifest lists them');
  const pins = parsePins(['opf-editor=0.25.3', '@openpresentation/cli=0.25.1', 'gallery=5.0.0']);
  assert.equal(pinOverrides(pins), '@openpresentation/opf-editor@0.25.3,@openpresentation/cli@0.25.1,@openpresentation/gallery@5.0.0');
  const pinned = registryPlan({ tag: '0.25.0', refs: false, overrides: pinOverrides(pins), view: (spec) => ({ version: spec.slice(spec.lastIndexOf('@') + 1) === '0.25.0' ? '0.25.0' : spec.slice(spec.lastIndexOf('@') + 1), gitHead: 'b'.repeat(40) }) });
  assert.deepEqual(Object.fromEntries(consumerPackages(pinned).map((item) => [item.name, item.version])), {
    '@openpresentation/opf': '0.25.0', '@openpresentation/opf-render': '0.25.0', '@openpresentation/opf-editor': '0.25.3', '@openpresentation/opf-pptx': '0.25.0', '@openpresentation/cli': '0.25.1',
  });
  assert.throws(() => consumerPackages({ packages: [] }), /has no @openpresentation\/opf/);
  assert.equal(pinOverrides(), '');
  for (const bad of ['opf-editor', 'opf-editor=1.0', 'nope=0.26.0', 'opf=0.26.0=1']) assert.throws(() => parsePins([bad]), /--pin needs/, bad);
});

test('MR-56: the consumer installs the five libraries at exact versions, the bundler and the renderer\'s optional peers', () => {
  const renderer = {
    dependencies: { harfbuzzjs: '0.4.0' },
    peerDependencies: { sharp: '^0.35.5', '@expo-google-fonts/arimo': '^0.4.0', required: '^1.0.0', bundled: '^1.0.0' },
    peerDependenciesMeta: { sharp: { optional: true }, '@expo-google-fonts/arimo': { optional: true }, bundled: { optional: true } },
    devDependencies: { sharp: '0.35.5' },
  };
  renderer.dependencies.bundled = '1.0.0';
  assert.deepEqual(rendererOptionalPeers(renderer), { sharp: '0.35.5', '@expo-google-fonts/arimo': '^0.4.0' }, 'tested version, else the range; required peers and bundled ones are not added');
  const manifest = consumerManifest({ packages: consumerPackages(registryPlan({ tag: '0.26.0', refs: false, view: view() })), rendererPackage: renderer });
  assert.equal(manifest.dependencies.esbuild, ESBUILD_VERSION);
  assert.equal(manifest.dependencies['@openpresentation/opf-editor'], '0.26.0');
  assert.equal(manifest.dependencies.sharp, '0.35.5');
  assert.ok(!('@openpresentation/gallery' in manifest.dependencies), 'core brings the gallery package');
  assert.equal(manifest.type, 'module');
});

test('MR-56: the bundler is the esbuild the workspace builds with', () => {
  assert.match(readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'), new RegExp(`^  '?esbuild@${ESBUILD_VERSION.replaceAll('.', '\\.')}'?:`, 'm'));
});

test('MR-56: a ref names one commit and its files are read from that commit, not from the working tree', () => withDirectory((directory) => {
  git(directory, 'init', '-q', '-b', 'main');
  mkdirSync(path.join(directory, 'packages/editor/examples'), { recursive: true });
  writeFileSync(path.join(directory, 'packages/editor/examples/playground.js'), 'one');
  git(directory, 'add', '-A');
  git(directory, 'commit', '-q', '-m', 'one');
  git(directory, 'tag', 'v0.26.0');
  const first = git(directory, 'rev-parse', 'HEAD');
  writeFileSync(path.join(directory, 'packages/editor/examples/playground.js'), 'two');
  writeFileSync(path.join(directory, 'packages/editor/examples/later.js'), 'later');
  git(directory, 'add', '-A');
  git(directory, 'commit', '-q', '-m', 'two');
  assert.equal(resolveRef('v0.26.0', { cwd: directory }), first, 'an annotated or lightweight tag resolves to its commit');
  assert.match(resolveRef('HEAD', { cwd: directory }), /^[a-f0-9]{40}$/);
  assert.notEqual(resolveRef('HEAD', { cwd: directory }), first);
  assert.equal(fileAtRef(first, 'packages/editor/examples/playground.js', { cwd: directory }), 'one');
  assert.equal(fileAtRef('HEAD', 'packages/editor/examples/playground.js', { cwd: directory }), 'two');
  assert.equal(existsAtRef(first, 'packages/editor/examples/later.js', { cwd: directory }), false);
  assert.equal(existsAtRef('HEAD', 'packages/editor/examples/later.js', { cwd: directory }), true);
  assert.throws(() => fileAtRef(first, 'packages/editor/examples/later.js', { cwd: directory }), /failed/);
  assert.throws(() => resolveRef('v9.9.9', { cwd: directory }), /does not name a commit|failed/);
  for (const bad of ['', '--output=x', undefined]) assert.throws(() => resolveRef(bad, { cwd: directory }), /not a git ref/, String(bad));
}));

test('MR-56: the renderer manifest is the registry\'s, for exactly the version asked for', () => {
  const answer = (body, status = 0) => () => ({ status, stdout: JSON.stringify(body), stderr: 'npm error E404\nmore' });
  assert.deepEqual(registryManifest('@openpresentation/opf-render', '0.26.0', { run: answer({ name: '@openpresentation/opf-render', version: '0.26.0', peerDependencies: {} }) }).version, '0.26.0');
  assert.throws(() => registryManifest('@openpresentation/opf-render', '0.26.0', { run: answer({}, 1) }), /not on the registry: npm error E404/);
  assert.throws(() => registryManifest('@openpresentation/opf-render', '0.26.0', { run: answer({ name: '@openpresentation/opf-render', version: '0.25.0' }) }), /answered/);
});

function fakeInstall(directory, packages, { link = false, resolved = 'https://registry.npmjs.org/x/-/x.tgz', integrity = 'sha512-abc' } = {}) {
  const lock = { packages: {} };
  for (const { name, version } of packages) {
    mkdirSync(path.join(directory, 'node_modules', name), { recursive: true });
    writeFileSync(path.join(directory, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
    lock.packages[`node_modules/${name}`] = { version, resolved, integrity, ...(link ? { link: true } : {}) };
  }
  writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify(lock));
}

test('MR-56: only a clean registry install of the exact versions is accepted', () => withDirectory(async (directory) => {
  const expected = consumerPackages(registryPlan({ tag: '0.26.0', refs: false, view: view() }));
  fakeInstall(directory, expected);
  const packages = await verifiedPackages(directory, expected);
  assert.deepEqual(packages.map((item) => item.name), CONSUMER_PACKAGES, 'the manifest order the site verifier expects');
  assert.ok(packages.every((item) => item.integrity === 'sha512-abc' && item.tarball.startsWith('https://registry.npmjs.org/')));
  await assert.rejects(verifiedPackages(directory, consumerPackages(registryPlan({ tag: '0.26.1', refs: false, view: view() }))), /clean registry installation/);
  fakeInstall(directory, expected, { link: true });
  await assert.rejects(verifiedPackages(directory, expected), /clean registry installation/);
  fakeInstall(directory, expected, { resolved: 'file:../x.tgz' });
  await assert.rejects(verifiedPackages(directory, expected), /clean registry installation/);
  fakeInstall(directory, expected, { integrity: 'sha1-abc' });
  await assert.rejects(verifiedPackages(directory, expected), /clean registry installation/);
}));

test('MR-56: an install of the same set is reused without npm', () => withDirectory(async (directory) => {
  const consumer = path.join(directory, 'consumer');
  const packages = consumerPackages(registryPlan({ tag: '0.26.0', refs: false, view: view() }));
  const options = { directory: consumer, packages, rendererPackage: {} };
  mkdirSync(consumer, { recursive: true });
  writeFileSync(path.join(consumer, 'package.json'), `${JSON.stringify(consumerManifest(options), null, 2)}\n`);
  fakeInstall(consumer, packages);
  const reused = await installConsumer(options);
  assert.equal(reused.directory, consumer);
  assert.equal(reused.packages.length, CONSUMER_PACKAGES.length);
}));

test('MR-56: the gallery editor scripts read no release plan and no sibling checkout but the pptx.gallery site', () => {
  for (const file of ['scripts/vendor-gallery-editor.mjs', 'scripts/gallery-editor-assets.mjs', 'scripts/registry-consumer.mjs']) {
    // Code only: no comment lines, and registry-consumer.mjs borrows the module-resolution helpers of registry-toolchain.mjs.
    const code = readFileSync(path.join(root, file), 'utf8').split('\n').filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line) && !/^import .* from '\.\/registry-toolchain\.mjs';$/.test(line)).join('\n');
    assert.ok(!/release-plan|registry-toolchain|\.\.\/opf-(editor|render|pptx)|verificationRefs|exampleRefs/.test(code), `${file} names the release plan or a sibling checkout`);
  }
});

test('MR-56: vendor-gallery-editor needs a version, a site directory and a known pin before it touches anything', () => {
  const run = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts/vendor-gallery-editor.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const missing = run();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /usage: vendor-gallery-editor\.mjs --version X\.Y\.Z/);
  assert.match(run('--version', '0.26.0', '--site').stderr, /--site needs a value/);
  assert.match(run('--version', '0.26.0', '--pin', 'nope=0.26.0').stderr, /--pin needs/);
  assert.match(run('--version', '0.26', '--site', '/x').stderr, /usage: vendor-gallery-editor/);
  assert.match(run('--version', '0.26.0', '--ref', 'no-such-ref', '--site', '/x').stderr, /does not name a commit|failed/);
});

test('MR-56: pnpm vendor:gallery-editor runs the script, and no registry-mode prepare script is left', () => {
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['vendor:gallery-editor'], 'node scripts/vendor-gallery-editor.mjs');
  assert.equal(scripts['prepare:gallery:registry'], undefined);
});
