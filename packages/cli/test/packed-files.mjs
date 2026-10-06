// Packed-install test for render, export and import: install the CLI tarball together with its optional peers
// (opf-render and opf-pptx at the versions the workspace tests against, from the npm registry) into an isolated global
// prefix, run the command tests against the installed binary, and repeat the main commands through an npx-style
// `npm exec` with all three packages. Needs network access for the peers; test:cli:packed stays offline.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile, realpath, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const pkg = path.join(root, 'packages/cli'), out = path.join(root, 'artifacts/cli');
const manifest = JSON.parse(await readFile(path.join(pkg, 'package.json'), 'utf8'));
const peers = ['@openpresentation/opf-render', '@openpresentation/opf-pptx'].map(name => `${name}@${manifest.devDependencies[name]}`);
for (const name of ['@openpresentation/opf-render', '@openpresentation/opf-pptx']) assert.equal(manifest.peerDependenciesMeta[name].optional, true, `${name} must stay an optional peer`);
assert.equal(manifest.dependencies, undefined, 'the CLI keeps no runtime dependencies');
const temp = await mkdtemp(path.join(tmpdir(), 'opf-cli-peers-'));
function run(command, args, cwd, env = {}) {
  if (process.platform === 'win32' && (command === 'npm' || command === 'pnpm')) {
    const entry = command === 'npm'
      ? (process.env.PATH ?? '').split(path.delimiter).flatMap(directory => [path.join(directory, 'node_modules/npm/bin/npm-cli.js'), path.resolve(directory, '../npm/bin/npm-cli.js')]).find(existsSync)
      : (process.env.npm_execpath?.endsWith('pnpm.cjs') ? process.env.npm_execpath : (process.env.PATH ?? '').split(path.delimiter).flatMap(directory => [path.join(directory, 'node_modules/pnpm/bin/pnpm.cjs'), path.resolve(directory, '../pnpm/bin/pnpm.cjs')]).find(existsSync));
    assert.ok(entry, `Cannot locate ${command} JavaScript entrypoint`);
    args = [entry, ...args]; command = process.execPath;
  }
  const result = spawnSync(command, args, {cwd, encoding: 'utf8', env: {...process.env, ...env}, timeout: 600000, maxBuffer: 256 * 1024 * 1024});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
try {
  await mkdir(out, {recursive: true});
  run('pnpm', ['build'], pkg);
  // RR-45 (opf#368, item 5): CI keeps the npm cache of the peers between runs (OPF_NPM_CACHE, restored by actions/cache) and
  // then prefers it to the registry's metadata; the versions are exact, and npm checks every tarball's integrity either way.
  const sharedCache = process.env.OPF_NPM_CACHE ? path.resolve(process.env.OPF_NPM_CACHE) : undefined;
  const cache = sharedCache ?? path.join(temp, 'npm-cache');
  const offline = sharedCache ? ['--prefer-offline'] : [];
  // npm exec keeps its installs under <cache>/_npx, keyed by the package specs: the CLI tarball's path does not change
  // between runs, so a restored _npx could hold an earlier CLI. Only the content-addressed downloads are reused.
  if (sharedCache) await rm(path.join(sharedCache, '_npx'), {recursive: true, force: true});
  const packed = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', out, '--cache', cache], pkg))[0];
  const tarball = path.join(out, packed.filename);
  // The published tarball stays small: no font packs, no native engines.
  assert.ok(packed.size < 3 * 1024 * 1024, `CLI tarball is ${packed.size} bytes`);

  // Install the CLI and its peers side by side, as `npm install -g @openpresentation/cli @openpresentation/opf-render ...` does.
  run('npm', ['install', '--global', '--prefix', temp, '--ignore-scripts', '--no-audit', '--no-fund', '--cache', cache, ...offline, tarball, ...peers], temp);
  const modules = path.join(temp, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules');
  const installed = JSON.parse(await readFile(path.join(modules, '@openpresentation/cli/package.json'), 'utf8'));
  assert.equal(Object.keys(installed.dependencies ?? {}).length, 0);
  assert.deepEqual(Object.keys(installed.peerDependenciesMeta).sort(), ['@openpresentation/opf-pptx', '@openpresentation/opf-render']);
  const bin = path.join(modules, '@openpresentation/cli', installed.bin.opf);
  const output = run(process.execPath, [path.join(pkg, 'test/files.mjs')], temp, {OPF_TEST_BIN: bin});
  console.log(output.trim());

  // npx-style: one run with the CLI and both peers in a single temporary install.
  const work = await realpath(await mkdtemp(path.join(temp, 'npx-')));
  await writeFile(path.join(work, 'deck.opf.json'), JSON.stringify({name: 'Npx', slides: [{title: 'Hello', text: 'From npx'}]}));
  const npx = (...args) => JSON.parse(run('npm', ['exec', '--yes', '--ignore-scripts', '--cache', cache, ...offline, ...[tarball, ...peers].flatMap(spec => ['--package', spec]), '--', 'opf', ...args], work));
  const rendered = npx('render', 'deck.opf.json', '--format', 'png', '--out', 'png');
  assert.equal(rendered.ok, true);
  assert.deepEqual(await readdir(path.join(work, 'png')), ['deck-001.png']);
  assert.equal(npx('export', 'deck.opf.json', '--format', 'pptx').ok, true);
  assert.equal(npx('import', 'deck.pptx', '--out', 'round.opf.json').valid, true);
  console.log(`CLI plus optional peers passed (${peers.join(', ')}). Tarball: ${tarball}`);
} finally {
  const actual = await realpath(temp), parent = await realpath(tmpdir());
  assert.ok(actual.startsWith(parent + path.sep) && path.basename(actual).startsWith('opf-cli-peers-'));
  await rm(actual, {recursive: true, force: true});
}
