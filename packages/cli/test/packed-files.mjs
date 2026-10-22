// Packed-install test for render, export and import: install the CLI tarball together with its optional peers
// (the packed opf-render and opf-pptx of this workspace, `pnpm pack`, MR-23e) into an isolated global
// prefix, run the command tests against the installed binary, and repeat the main commands through an npx-style
// `npm exec` with all three packages. Needs network access for core's and the renderer's third-party dependencies.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile, realpath, readdir} from 'node:fs/promises';
import {existsSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {rendererScriptFonts} from './helpers/renderer-script-fonts.mjs';
import {packWorkspacePackage} from '../../../scripts/workspace-pack.mjs';
import {assertOneCore} from '../../../scripts/check-one-core.mjs';
import {assertExecOutsideGlobal, globalPrefixLayout} from '../../../scripts/global-prefix.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const pkg = path.join(root, 'packages/cli'), out = path.join(root, 'artifacts/cli');
const manifest = JSON.parse(await readFile(path.join(pkg, 'package.json'), 'utf8'));
// MR-23e: the CLI, core, the gallery and both peers are workspace packages of one version, so the test installs their `pnpm pack`
// tarballs (the version under development is not on the registry) and the packed manifests, not the sources, say what they ask for.
const packedFor = name => packWorkspacePackage(name, out);
const cliPacked = packedFor('@openpresentation/cli'), corePacked = packedFor('@openpresentation/opf'), galleryPacked = packedFor('@openpresentation/gallery');
const rendererPacked = packedFor('@openpresentation/opf-render'), pptxPacked = packedFor('@openpresentation/opf-pptx');
const peers = [rendererPacked, pptxPacked].map(item => item.tarball);
for (const item of [corePacked, galleryPacked, rendererPacked, pptxPacked]) assert.equal(cliPacked.manifest.dependencies?.[item.name] ?? cliPacked.manifest.peerDependencies?.[item.name], `^${item.version}`, `the packed CLI asks for ${item.name} ^${item.version}`);
// RR-63: the renderer's converters (pdf-lib, @resvg/resvg-js, sharp) and font packages are its optional peers; install the ones the CLI's outputs use beside it.
// RR-59 (opf#476): and the Noto JP and SC script packages the installed-package regression draws Japanese and Chinese SVG with (opf-render pins them exactly as peers;
// installed-regression.mjs checks the installed versions against the renderer's declared ones).
const scriptFonts = rendererScriptFonts(rendererPacked.manifest, rendererPacked.version);
const rendererPeers = rendererPacked.manifest.peerDependencies;
const renderExtras = Object.keys(manifest.devDependencies).filter(name => name.startsWith('@expo-google-fonts/') || ['@resvg/resvg-js', 'sharp', 'pdf-lib'].includes(name)).map(name => `${name}@${rendererPeers?.[name]??manifest.devDependencies[name]}`).concat(scriptFonts);

for (const name of ['@openpresentation/opf-render', '@openpresentation/opf-pptx']) assert.equal(manifest.peerDependenciesMeta[name].optional, true, `${name} must stay an optional peer`);
const expectedDependencies=Object.hasOwn(manifest.dependencies??{},'@openpresentation/gallery')?['@openpresentation/gallery','@openpresentation/opf']:['@openpresentation/opf'];
assert.deepEqual(Object.keys(manifest.dependencies ?? {}).sort(), expectedDependencies, 'CLI runtime dependencies must match the core and explicit gallery contract');
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
  // RR-45 (opf#368, item 5): CI keeps the npm cache of the peers between runs (OPF_NPM_CACHE, restored by actions/cache) and
  // then prefers it to the registry's metadata; the versions are exact, and npm checks every tarball's integrity either way.
  const sharedCache = process.env.OPF_NPM_CACHE ? path.resolve(process.env.OPF_NPM_CACHE) : undefined;
  const cache = sharedCache ?? path.join(temp, 'npm-cache');
  const offline = sharedCache ? ['--prefer-offline'] : [];
  // npm exec keeps its installs under <cache>/_npx, keyed by the package specs: the CLI tarball's path does not change
  // between runs, so a restored _npx could hold an earlier CLI. Only the content-addressed downloads are reused.
  if (sharedCache) await rm(path.join(sharedCache, '_npx'), {recursive: true, force: true});
  const candidate = {cli: cliPacked, cliTarball: cliPacked.tarball, coreTarball: corePacked.tarball, galleryTarball: galleryPacked.tarball};
  const packed = candidate.cli, tarball = candidate.cliTarball;
  // The published tarball stays small: no font packs, no native engines.
  const packedSize = statSync(tarball).size;
  assert.ok(packedSize < 3 * 1024 * 1024, `CLI tarball is ${packedSize} bytes`);

  // Install the CLI and its peers side by side, as `npm install -g @openpresentation/cli @openpresentation/opf-render ...` does.
  // RR-66 (opf#466): in a folder of its own, so the npm exec runs below never resolve into it (scripts/global-prefix.mjs).
  const global = globalPrefixLayout(path.join(temp, 'global'));
  run('npm', ['install', '--global', '--prefix', global.prefix, '--ignore-scripts', '--no-audit', '--no-fund', '--cache', cache, ...offline, tarball, candidate.coreTarball, ...(candidate.additionalTarballs??(candidate.galleryTarball?[candidate.galleryTarball]:[])), ...peers, ...renderExtras], temp);
  const modules = global.modules;
  const installed = JSON.parse(await readFile(path.join(modules, '@openpresentation/cli/package.json'), 'utf8'));
  assert.deepEqual(installed.dependencies, cliPacked.manifest.dependencies, 'the installed CLI carries the packed manifest');
  assert.deepEqual(Object.keys(installed.dependencies ?? {}).sort(), expectedDependencies);
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
  const npx = (...args) => JSON.parse(run('npm', ['exec', '--yes', '--ignore-scripts', '--cache', cache, ...offline, ...[tarball, candidate.coreTarball, ...(candidate.additionalTarballs??(candidate.galleryTarball?[candidate.galleryTarball]:[])), ...peers, ...renderExtras].flatMap(spec => ['--package', spec]), '--', 'opf', ...args], work));
  // RR-75: `opf convert` replaces render, export and import; the output path names the files (a one-slide deck writes one file).
  const rendered = npx('convert', 'deck.opf.json', 'png/Npx.png');
  assert.equal(rendered.ok, true);
  assert.deepEqual(await readdir(path.join(work, 'png')), ['Npx.png']);
  assert.equal(npx('convert', 'deck.opf.json', 'Npx.pptx').ok, true);
  assert.ok((await readdir(work)).includes('Npx.pptx'));
  assert.equal(npx('convert', 'Npx.pptx', 'round.opf.json').ok, true);
  assert.ok((await readdir(work)).includes('round.opf.json'));
  console.log(`CLI plus optional peers passed (${peers.join(', ')}). Tarball: ${tarball}`);
} finally {
  const actual = await realpath(temp), parent = await realpath(tmpdir());
  assert.ok(actual.startsWith(parent + path.sep) && path.basename(actual).startsWith('opf-cli-peers-'));
  await rm(actual, {recursive: true, force: true});
}
