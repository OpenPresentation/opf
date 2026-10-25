// The npm 12 consumer leg (nightly.yml, job `npm12-consumer`): the six packages, packed the way they publish, installed into a clean
// project by npm 12 with npm 12's own defaults (no install scripts, no git or remote dependencies), then the CLI and the library
// convert a deck to SVG, PNG, PDF and PPTX and read the PPTX back. See scripts/npm12-consumer.mjs for what npm 12 changes.
//
//   node scripts/test-npm12-consumer.mjs     (`npm` on PATH must be npm 12; OPF_NPM_VERSION pins the exact version when set)
//
// Needs `pnpm build` first (the tarballs are `pnpm pack` of the built packages) and network access for the third-party dependencies.
// Nothing here passes a flag that re-enables scripts. `--strict-allow-scripts` does the opposite: npm blocks an install script
// with a warning by default, and with that flag a blocked script fails the install, so a package that needs one cannot pass.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertSingleCore } from './check-one-core.mjs';
import { NPM12_DEFAULTS, cleanNpmEnvironment, lockHazards, manifestHazards } from './npm12-consumer.mjs';
import { PACKAGE_DIRECTORIES, packWorkspacePackage } from './workspace-pack.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'artifacts/npm12');
const consumer = path.join(out, 'consumer');
const NAMES = Object.keys(PACKAGE_DIRECTORIES);
assert.equal(NAMES.length, 6, 'the six published packages');

await rm(out, { recursive: true, force: true });
await mkdir(consumer, { recursive: true });
const env = cleanNpmEnvironment(process.env, { directory: out, cache: path.join(out, 'cache') });

function npm(args, options = {}) {
  const result = spawnSync('npm', args, { cwd: options.cwd ?? consumer, env: { ...env, ...options.env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000 });
  if (result.error) throw result.error;
  if (!options.allowFailure) assert.equal(result.status, 0, `npm ${args.join(' ')} exited ${result.status}\n${result.stdout}${result.stderr}`);
  return result;
}

// 1. npm 12, at the pinned version when the workflow names one, with the defaults that make it npm 12.
const version = npm(['--version']).stdout.trim();
assert.equal(version.split('.')[0], '12', `npm ${version} is not npm 12`);
if (process.env.OPF_NPM_VERSION) assert.equal(version, process.env.OPF_NPM_VERSION, 'npm is not the pinned version');
for (const [key, expected] of Object.entries(NPM12_DEFAULTS)) assert.equal(npm(['config', 'get', key]).stdout.trim(), expected, `npm config ${key} is not the npm 12 default`);
console.log(`npm ${version} (node ${process.version}), install-time defaults: ${JSON.stringify(NPM12_DEFAULTS)}`);

// 2. The six packages as `pnpm pack` publishes them. A packed manifest never asks for an install script or a non-registry source.
const packed = NAMES.map((name) => packWorkspacePackage(name, out));
const problems = packed.flatMap((item) => manifestHazards(item.manifest, `${item.name}@${item.version}`));
assert.deepEqual(problems, [], `packed manifests need install scripts or a git or remote source:\n  ${problems.join('\n  ')}`);

// The renderer's converters and the font packages of its default (`office`) pack are optional peers, which npm does not install; a deck
// converts to PNG and PDF only with the converters, and to anything with the fonts. Ask for the ranges the packed renderer declares.
const render = packed.find((item) => item.name === '@openpresentation/opf-render');
const OPTIONAL_PEERS = ['@resvg/resvg-js', 'sharp', 'pdf-lib', ...['roboto', 'roboto-mono', 'caladea', 'arimo', 'tinos', 'cousine', 'gelasio', 'noto-sans'].map((name) => `@expo-google-fonts/${name}`)];
const peers = OPTIONAL_PEERS.map((name) => {
  const range = render.manifest.peerDependencies?.[name];
  assert.ok(range && render.manifest.peerDependenciesMeta?.[name]?.optional === true, `the packed renderer declares no optional ${name} peer`);
  return `${name}@${range}`;
});

// 3. A clean project and one install with npm 12's defaults.
await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'opf-npm12-consumer', private: true, type: 'module' }, null, 2));
const install = npm(['install', '--no-audit', '--no-fund', '--strict-allow-scripts', ...packed.map((item) => item.tarball), ...peers]);
console.log(install.stdout.trim(), install.stderr.trim());
assert.doesNotMatch(install.stdout + install.stderr, /npm warn install-scripts/u, 'npm 12 blocked an install script (npm warn install-scripts)');

// 4. The tree: no package needs an install script, none comes from a git or remote source.
const lock = JSON.parse(await readFile(path.join(consumer, 'package-lock.json'), 'utf8'));
const localTarballs = packed.map((item) => `file:../${path.basename(item.tarball)}`);
const lockProblems = lockHazards(lock, { localTarballs });
assert.deepEqual(lockProblems, [], `the installed tree needs install scripts or a git or remote source:\n  ${lockProblems.join('\n  ')}`);
for (const item of packed) assert.ok(lock.packages[`node_modules/${item.name}`], `${item.name} is installed`);
console.log(`${Object.keys(lock.packages).length - 1} packages installed; none has an install script or a git or remote source`);

const modules = path.join(consumer, 'node_modules');
const installedCore = path.join(modules, '@openpresentation/opf');
const bin = path.join(modules, '@openpresentation/cli', JSON.parse(await readFile(path.join(modules, '@openpresentation/cli/package.json'), 'utf8')).bin.opf);
await assertSingleCore({ expected: installedCore, roots: [consumer], resolvers: [path.join(consumer, 'package.json'), ...['opf-render', 'opf-pptx', 'opf-editor', 'cli'].map((name) => path.join(modules, '@openpresentation', name, 'package.json'))], label: 'npm 12 consumer' });

// 5. The CLI, then the library, convert and read back.
const node = (args) => {
  const result = spawnSync(process.execPath, args, { cwd: consumer, env: { ...env, FORCE_COLOR: '0' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  assert.equal(result.status, 0, `node ${args.join(' ')} exited ${result.status}\n${result.stdout}${result.stderr}`);
  return result.stdout;
};
const cli = packed.find((item) => item.name === '@openpresentation/cli');
assert.equal(JSON.parse(node([bin, '--version'])).cli, cli.version, 'opf --version');
await writeFile(path.join(consumer, 'deck.opf.json'), JSON.stringify({ name: 'Npm12', slides: [{ title: 'Installed with npm 12', text: 'No install scripts, no git dependencies.' }] }));
assert.equal(JSON.parse(node([bin, 'validate', 'deck.opf.json'])).ok, true);
const starts = {
  'out/Npm12.svg': (bytes) => /<svg[\s>]/u.test(bytes.subarray(0, 4096).toString('utf8')),
  'out/Npm12.png': (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'out/Npm12.pdf': (bytes) => bytes.subarray(0, 5).toString('latin1') === '%PDF-',
  'Npm12.pptx': (bytes) => bytes.subarray(0, 2).toString('latin1') === 'PK',
};
for (const [file, valid] of Object.entries(starts)) {
  assert.equal(JSON.parse(node([bin, 'convert', 'deck.opf.json', file])).ok, true, `opf convert ${file}`);
  const bytes = await readFile(path.join(consumer, file));
  assert.ok(bytes.length > 0 && valid(bytes), `${file} is not a valid file of its format`);
}
assert.deepEqual((await readdir(path.join(consumer, 'out'))).sort(), ['Npm12.pdf', 'Npm12.png', 'Npm12.svg']);
assert.equal(JSON.parse(node([bin, 'convert', 'Npm12.pptx', 'round.opf.json'])).ok, true, 'opf convert pptx back to OPF');
assert.equal(JSON.parse(await readFile(path.join(consumer, 'round.opf.json'), 'utf8')).slides.length, 1);

const probe = path.join(consumer, 'probe.mjs');
await writeFile(probe, `import * as opf from '@openpresentation/opf';
import '@openpresentation/opf-render';
import '@openpresentation/opf-pptx';
const deck = opf.parse('{"slides":[{"title":"Installed","text":"With npm 12"}]}');
const [svg, png, pdf, pptx] = await Promise.all(['svg', 'png', 'pdf', 'pptx'].map((format) => opf.convert(deck, {format})));
const back = await opf.open(pptx.files[0].bytes);
process.stdout.write(JSON.stringify({svg: svg.files.length, png: png.files.length, pdf: new TextDecoder().decode(pdf.files[0].bytes.subarray(0, 5)), slides: back.slides.length, editor: Boolean(import.meta.resolve('@openpresentation/opf-editor'))}));`);
assert.deepEqual(JSON.parse(node([probe])), { svg: 1, png: 1, pdf: '%PDF-', slides: 1, editor: true });
console.log(`npm ${version}: the six packages install with its defaults and the CLI and library convert to SVG, PNG, PDF and PPTX (${pathToFileURL(await realpath(consumer)).href})`);
