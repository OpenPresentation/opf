// Packed-install test for render, export and import: install the CLI tarball together with its optional peers
// (opf-render and opf-pptx at the versions the workspace tests against, from the npm registry) into an isolated global
// prefix, run the command tests against the installed binary, and repeat the main commands through an npx-style
// `npm exec` with all three packages. Needs network access for the peers and for core's own dependencies.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile, realpath, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {packCliCandidate} from '../../../scripts/pack-cli-candidate.mjs';
import {assertOneCore} from '../../../scripts/check-one-core.mjs';
import {cliPeerGate, peerCoreGate, report} from '../../../scripts/unreleased-gate.mjs';
import {assertExecOutsideGlobal, globalPrefixLayout} from '../../../scripts/global-prefix.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const pkg = path.join(root, 'packages/cli'), out = path.join(root, 'artifacts/cli');
const manifest = JSON.parse(await readFile(path.join(pkg, 'package.json'), 'utf8'));
const peers = ['@openpresentation/opf-render', '@openpresentation/opf-pptx'].map(name => `${name}@${manifest.devDependencies[name]}`);
// RR-63: the renderer's converters (pdf-lib, @resvg/resvg-js, sharp) and font packages are its optional peers; install the ones the CLI's outputs use beside it.
// RR-59 (opf#476): and the Noto JP and SC script packages the installed-package regression draws Japanese and Chinese SVG with (opf-render pins them exactly as peers;
// installed-regression.mjs checks the installed versions against the renderer's declared ones).
const scriptFonts = ['@expo-google-fonts/noto-sans-jp@0.4.3', '@expo-google-fonts/noto-sans-sc@0.4.3'];
const renderExtras = Object.keys(manifest.devDependencies).filter(name => name.startsWith('@expo-google-fonts/') || ['@resvg/resvg-js', 'sharp', 'pdf-lib'].includes(name)).map(name => `${name}@${manifest.devDependencies[name]}`).concat(scriptFonts);
// RR-55: this test installs the published peers at the workspace's versions; while those do not satisfy the CLI's peer
// ranges (a coordinated release not on npm yet), a pull request, merge-queue or roller-candidate run skips it with a notice (scripts/unreleased-gate.mjs).
if (!report(cliPeerGate({cliRoot: pkg, executable: path.join(pkg, 'dist/index.js'), names: ['@openpresentation/opf-render', '@openpresentation/opf-pptx'], installedVersions: manifest.devDependencies}))) process.exit(0);
// The candidate core declares the same peers (optional, for its Node build's file API; opf#498 raises them to the next train's line before
// core's release prep), and npm refuses to install it next to peers outside its ranges: the same wait applies.
if (!report(cliPeerGate({cliRoot: path.join(root, 'packages/javascript'), subject: '@openpresentation/opf (optional peers of the Node build)', executable: path.join(pkg, 'dist/index.js'), names: ['@openpresentation/opf-render', '@openpresentation/opf-pptx'], installedVersions: manifest.devDependencies}))) process.exit(0);
for (const name of ['@openpresentation/opf-render', '@openpresentation/opf-pptx']) assert.equal(manifest.peerDependenciesMeta[name].optional, true, `${name} must stay an optional peer`);
assert.deepEqual(Object.keys(manifest.dependencies ?? {}), ['@openpresentation/opf'], 'core is the only runtime dependency of the CLI');
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
  // RR-62: the CLI depends on core; the candidate core is packed with it and both are installed (scripts/pack-cli-candidate.mjs).
  const candidate = await packCliCandidate({cliDirectory: pkg, coreDirectory: path.join(root, 'packages/javascript'), destination: out, run, npmArgs: ['--cache', cache]});
  const packed = candidate.cli, tarball = candidate.cliTarball;
  // The published tarball stays small: no font packs, no native engines.
  assert.ok(packed.size < 3 * 1024 * 1024, `CLI tarball is ${packed.size} bytes`);

  // Install the CLI and its peers side by side, as `npm install -g @openpresentation/cli @openpresentation/opf-render ...` does.
  // RR-66 (opf#466): in a folder of its own, so the npm exec runs below never resolve into it (scripts/global-prefix.mjs).
  const global = globalPrefixLayout(path.join(temp, 'global'));
  run('npm', ['install', '--global', '--prefix', global.prefix, '--ignore-scripts', '--no-audit', '--no-fund', '--cache', cache, ...offline, tarball, candidate.coreTarball, ...peers, ...renderExtras], temp);
  const modules = global.modules;
  const installed = JSON.parse(await readFile(path.join(modules, '@openpresentation/cli/package.json'), 'utf8'));
  assert.deepEqual(Object.keys(installed.dependencies ?? {}), ['@openpresentation/opf']);
  // A new core minor is released before its siblings: until they publish, the published siblings' own core range does not
  // accept the candidate core and npm nests another core under them (RR-55: wait on the core release prep, its queue run and
  // the core tag; the CLI release keeps the hard gate).
  if (!report(peerCoreGate({modules, names: ['@openpresentation/opf-render', '@openpresentation/opf-pptx'], coreVersion: JSON.parse(await readFile(path.join(modules, '@openpresentation/opf/package.json'), 'utf8')).version}))) process.exit(0);
  // One core for the command, the application's @openpresentation/opf and both peers.
  await assertOneCore(modules);
  assert.deepEqual(Object.keys(installed.peerDependenciesMeta).sort(), ['@openpresentation/opf-pptx', '@openpresentation/opf-render']);
  assert.equal(installed.exports['./api'], undefined, 'the CLI is the command; applications use @openpresentation/opf');
  const bin = path.join(modules, '@openpresentation/cli', installed.bin.opf);
  // RR-62, RR-70: core's root under the `node` condition, installed beside the CLI, draws and imports through the installed peers.
  const coreManifest = JSON.parse(await readFile(path.join(modules, '@openpresentation/opf/package.json'), 'utf8'));
  const nodeBuild = coreManifest.exports['.'].node ?? coreManifest.exports['.'].import;
  const nodeProbe = path.join(temp, 'node-probe.mjs');
  await writeFile(nodeProbe, `import * as opf from ${JSON.stringify(pathToFileURL(path.join(modules, '@openpresentation/opf', nodeBuild)).href)};
    const deck = opf.parse('{"slides":[{"title":"Installed","text":"From the packed core"}]}');
    const pdf = await opf.convert(deck, {format: 'pdf'}), pptx = await opf.convert(deck, {format: 'pptx'}), png = await opf.convert(deck, {format: 'png'});
    const back = await opf.open(pptx.files[0].bytes);
    process.stdout.write(JSON.stringify({pdf: new TextDecoder().decode(pdf.files[0].bytes.subarray(0, 5)), png: png.files.length, slides: back.slides.length}));`);
  assert.deepEqual(JSON.parse(run(process.execPath, [nodeProbe], temp)), {pdf: '%PDF-', png: 1, slides: 1});
  const output = run(process.execPath, [path.join(pkg, 'test/files.mjs')], temp, {OPF_TEST_BIN: bin});
  console.log(output.trim());
  // RR-59 (opf#476): script-font SVG, the unresolved-image gate and zero fetches through the installed binary (the candidate CLI and core, the peers and Noto packages beside them).
  console.log(run(process.execPath, [path.join(pkg, 'test/installed-regression.mjs')], temp, {OPF_TEST_BIN: bin}).trim());

  // npx-style: one run with the CLI and both peers in a single temporary install.
  const work = await realpath(await mkdtemp(path.join(temp, 'npx-')));
  assertExecOutsideGlobal(work, global);
  await writeFile(path.join(work, 'deck.opf.json'), JSON.stringify({name: 'Npx', slides: [{title: 'Hello', text: 'From npx'}]}));
  const npx = (...args) => JSON.parse(run('npm', ['exec', '--yes', '--ignore-scripts', '--cache', cache, ...offline, ...[tarball, candidate.coreTarball, ...peers, ...renderExtras].flatMap(spec => ['--package', spec]), '--', 'opf', ...args], work));
  const rendered = npx('render', 'deck.opf.json', '--format', 'png', '--out', 'png');
  assert.equal(rendered.ok, true);
  // FA-08: output files are named by the deck's `name` ("Npx"), not the input file's stem.
  assert.deepEqual(await readdir(path.join(work, 'png')), ['Npx-1.png']);
  assert.equal(npx('export', 'deck.opf.json', '--format', 'pptx').ok, true);
  assert.ok((await readdir(work)).includes('Npx.pptx'), 'export without --out names the file after the deck');
  assert.equal(npx('import', 'Npx.pptx', '--out', 'round.opf.json').valid, true);
  console.log(`CLI plus optional peers passed (${peers.join(', ')}). Tarball: ${tarball}`);
} finally {
  const actual = await realpath(temp), parent = await realpath(tmpdir());
  assert.ok(actual.startsWith(parent + path.sep) && path.basename(actual).startsWith('opf-cli-peers-'));
  await rm(actual, {recursive: true, force: true});
}
