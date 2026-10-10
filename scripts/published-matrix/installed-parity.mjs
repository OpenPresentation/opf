// RR-04 (FF-10, FF-38): the installed parity audit. Runs the FF-38 parity harness (docs/programs/font-fidelity-everywhere/
// gallery-support/parity) against the PUBLISHED packages installed from the npm registry, on the host it runs on, so the
// same command on ubuntu, windows and macos shows whether the perfect/near/mismatch classes depend on the operating system.
//
//   node scripts/published-matrix/installed-parity.mjs prepare   [--work <dir>]   install the packages, lay out the harness
//                                                                (default work directory: OPF_PARITY_WORK, else installed-parity under RUNNER_TEMP or the temporary directory)
//   node scripts/published-matrix/installed-parity.mjs snippets  [--work <dir>]   the gallery value documents (684 at gallery de1ddff, OPF 0.15)
//   node scripts/published-matrix/installed-parity.mjs parity    [--work <dir>]   parity.mjs + summarize.mjs (PARITY_FONT_HOST=gallery)
//   node scripts/published-matrix/installed-parity.mjs all        [--work <dir>]
//
// Versions come from release-plan.json. OPF_PARITY_OVERRIDES ("<package>@<version>", comma or space separated) replaces
// individual entries, e.g. a patch release the plan does not list yet. The gallery snippets come from GALLERY_DIR (a
// pptx-gallery checkout, built with the gallery's own builders by gen-snippets.mjs) when it is set, else from the committed
// snapshot scripts/published-matrix/fixtures/gallery-snippets-<gallery commit>.json.gz of that same build, because
// pptx-gallery is a private repository that the workflow token cannot read. No tolerance or check of the harness changes.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {appendFile, cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {linkModules} from './link-modules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const parityScripts = path.join(root, 'docs/programs/font-fidelity-everywhere/gallery-support/parity');
const PACKAGES = ['@openpresentation/opf', '@openpresentation/opf-render', '@openpresentation/opf-pptx', '@openpresentation/opf-editor'];
// The harness bundles the gallery's TypeScript snippet builders with esbuild; this is the version the sibling repositories pin.
const ESBUILD = '0.28.2';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const argv = process.argv.slice(2);
const command = argv[0] ?? 'all';
const optionAt = argv.indexOf('--work');
// Outside any git checkout: inside one, the harness would record that repository's HEAD as the head of each package (prepare checks it).
const work = path.resolve(optionAt >= 0 ? argv[optionAt + 1] : (process.env.OPF_PARITY_WORK ?? path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'installed-parity')));
const consumer = path.join(work, 'consumer');
const sources = path.join(work, 'sources');
const audit = path.join(work, 'dimension-audit', 'parity');
const out = path.join(work, 'out');
const resultsFile = path.join(out, 'parity-results.json');

function run(file, args, options = {}) {
  console.log(`$ ${[file, ...args].join(' ')}`);
  const result = spawnSync(file, args, {stdio: 'inherit', shell: file.endsWith('.cmd'), ...options, env: {...process.env, npm_config_update_notifier: 'false', ...options.env}});
  assert.equal(result.status, 0, `${file} ${args.join(' ')} failed (${result.status})`);
}
function capture(file, args, cwd) {
  const result = spawnSync(file, args, {encoding: 'utf8', shell: file.endsWith('.cmd'), cwd});
  assert.equal(result.status, 0, `${file} ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

export async function plannedVersions() {
  const plan = JSON.parse(await readFile(path.join(root, 'release-plan.json'), 'utf8'));
  const versions = Object.fromEntries(PACKAGES.map((name) => [name, plan.packages.find((entry) => entry.name === name)?.version]));
  for (const spec of (process.env.OPF_PARITY_OVERRIDES ?? '').split(/[\s,]+/).filter(Boolean)) {
    const at = spec.lastIndexOf('@');
    const name = spec.slice(0, at);
    assert.ok(PACKAGES.includes(name), `OPF_PARITY_OVERRIDES names ${name}, which is not one of ${PACKAGES.join(', ')}`);
    versions[name] = spec.slice(at + 1);
  }
  for (const [name, version] of Object.entries(versions)) assert.match(version ?? '', /^\d+\.\d+\.\d+$/, `${name} has an exact version`);
  return versions;
}

async function prepare() {
  const versions = await plannedVersions();
  console.log('Installed set:', JSON.stringify(versions));
  await rm(work, {recursive: true, force: true});
  await mkdir(consumer, {recursive: true});
  const inside = spawnSync('git', ['-C', work, 'rev-parse', '--show-toplevel'], {encoding: 'utf8'});
  assert.notEqual(inside.status, 0, `the work directory ${work} is inside the git checkout ${inside.stdout.trim()}: parity.mjs would record that HEAD as the head of every package; use --work or OPF_PARITY_WORK outside any checkout`);
  const peers = JSON.parse(capture(npm, ['view', `@openpresentation/opf-render@${versions['@openpresentation/opf-render']}`, 'peerDependencies', '--json'], root) || '{}');
  const dependencies = {...versions, ...peers, esbuild: ESBUILD};
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({name: 'opf-installed-parity', private: true, type: 'module', dependencies}, null, 2));
  // Registry tarballs only: no lifecycle scripts.
  run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact'], {cwd: consumer});

  const modules = path.join(consumer, 'node_modules');
  const installed = {};
  for (const name of PACKAGES) {
    const dir = path.join(modules, ...name.split('/'));
    const manifest = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    assert.equal(manifest.version, versions[name], `${name} resolved to ${manifest.version}, not ${versions[name]}`);
    // A published package is not a git checkout: the registry's gitHead names the commit it was built from (the harness reads it from package.json).
    const gitHead = capture(npm, ['view', `${name}@${versions[name]}`, 'gitHead'], root).trim();
    assert.match(gitHead, /^[0-9a-f]{40}$/, `${name}@${versions[name]} has a registry gitHead`);
    installed[name] = {version: manifest.version, gitHead};
  }
  const stamp = async (dir, gitHead) => {
    const file = path.join(dir, 'package.json');
    await writeFile(file, JSON.stringify({...JSON.parse(await readFile(file, 'utf8')), gitHead}, null, 2));
  };

  // The layout the harness expects (gallery-support README, "Re-running on published packages"): sources/parity-{opf,opf-render,opf-pptx}.
  // Each package is a real copy of the installed files; node_modules is a link to the consumer's, so the dependencies resolve as installed.
  const copyPackage = async (name, target) => {
    await cp(path.join(modules, ...name.split('/')), target, {recursive: true, dereference: true});
    await stamp(target, installed[name].gitHead);
  };
  const core = path.join(sources, 'parity-opf', 'packages', 'javascript');
  await copyPackage('@openpresentation/opf', core);
  await linkModules(modules, path.join(core, 'node_modules'));
  // RR-78: from core 0.19 the catalog is the @openpresentation/gallery package (core's dependency); the harness reads it at
  // packages/gallery, as in the repository. An older core has it at /catalog.
  const gallery = path.join(modules, '@openpresentation', 'gallery');
  if (existsSync(path.join(gallery, 'package.json'))) await cp(gallery, path.join(sources, 'parity-opf', 'packages', 'gallery'), {recursive: true, dereference: true});
  // The harness reads the head of each source from its root package.json gitHead when the root is not a git checkout.
  await writeFile(path.join(sources, 'parity-opf', 'package.json'), JSON.stringify({name: 'parity-opf', private: true, gitHead: installed['@openpresentation/opf'].gitHead}, null, 2));
  await mkdir(path.join(sources, 'parity-opf', 'scripts'), {recursive: true});
  for (const file of ['register-local-opf.mjs', 'local-opf-loader.mjs']) await cp(path.join(root, 'scripts', file), path.join(sources, 'parity-opf', 'scripts', file));
  for (const [name, dir] of [['@openpresentation/opf-render', 'parity-opf-render'], ['@openpresentation/opf-pptx', 'parity-opf-pptx']]) {
    const target = path.join(sources, dir);
    await copyPackage(name, target);
    await linkModules(modules, path.join(target, 'node_modules'));
  }
  // The harness never imports the editor; it is installed and recorded because the audited set includes it.
  await mkdir(out, {recursive: true});
  const versionsOf = async (dir) => {
    const names = (await readdir(dir)).filter((entry) => !entry.startsWith('.'));
    const found = {};
    for (const entry of names) {
      const scoped = entry.startsWith('@') ? (await readdir(path.join(dir, entry))).map((child) => `${entry}/${child}`) : [entry];
      for (const name of scoped) found[name] = JSON.parse(await readFile(path.join(dir, ...name.split('/'), 'package.json'), 'utf8')).version;
    }
    return found;
  };
  const tree = await versionsOf(modules);
  await writeFile(path.join(out, 'installed.json'), `${JSON.stringify({
    node: process.version, platform: process.platform, arch: process.arch, packages: installed, esbuild: tree.esbuild,
    dependencies: Object.fromEntries(Object.entries(tree).sort(([a], [b]) => a.localeCompare(b)))}, null, 2)}\n`);

  await mkdir(path.dirname(audit), {recursive: true});
  await cp(parityScripts, audit, {recursive: true, filter: (source) => !/[\\/](out|history)([\\/]|$)/.test(source) && !/parity-results.*\.json$|PARITY.*\.md$/.test(source)});
}

async function snippets() {
  const scripts = path.join(audit, 'scripts');
  const snapshot = path.join(audit, 'out', 'snippets.json');
  await mkdir(path.dirname(snapshot), {recursive: true});
  if (process.env.GALLERY_DIR) {
    run(process.execPath, [path.join(scripts, 'gen-snippets.mjs')], {cwd: scripts, env: {GALLERY_DIR: path.resolve(process.env.GALLERY_DIR)}});
    return;
  }
  const fixtures = path.join(here, 'fixtures');
  const files = existsSync(fixtures) ? (await readdir(fixtures)).filter((file) => /^gallery-snippets-[0-9a-f]{7,40}\.json\.gz$/.test(file)) : [];
  assert.equal(files.length, 1, `scripts/published-matrix/fixtures holds exactly one gallery-snippets-<commit>.json.gz (found ${files.length}); or set GALLERY_DIR`);
  await writeFile(snapshot, gunzipSync(await readFile(path.join(fixtures, files[0]))));
  // The harness records the gallery head from the package.json of sources/parity-pptx-gallery; the snapshot name carries the commit.
  const gallery = path.join(sources, 'parity-pptx-gallery');
  await mkdir(gallery, {recursive: true});
  await writeFile(path.join(gallery, 'package.json'), JSON.stringify({name: 'pptx-gallery-snippet-snapshot', private: true, gitHead: files[0].match(/gallery-snippets-([0-9a-f]+)\.json\.gz/)[1]}, null, 2));
  console.log(`Gallery snippets from ${files[0]}`);
}

async function parity() {
  const scripts = path.join(audit, 'scripts');
  const loader = pathToFileURL(path.join(sources, 'parity-opf', 'scripts', 'register-local-opf.mjs')).href;
  const env = {PARITY_FONT_HOST: 'gallery', OUT: resultsFile};
  run(process.execPath, ['--import', loader, 'parity.mjs'], {cwd: scripts, env});
  run(process.execPath, ['summarize.mjs', resultsFile, path.join(out, 'PARITY.md')], {cwd: scripts, env});
  if (process.env.GITHUB_STEP_SUMMARY) {
    const {results} = JSON.parse(await readFile(resultsFile, 'utf8'));
    const count = (cls) => results.filter((result) => result.class === cls).length;
    const installed = JSON.parse(await readFile(path.join(out, 'installed.json'), 'utf8'));
    const set = Object.entries(installed.packages).map(([name, entry]) => `${name}@${entry.version}`).join(', ');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Installed parity audit (${process.platform} ${process.arch}, Node ${process.version})\n\n${results.length} values: ${count('perfect')} perfect, ${count('near')} near, ${count('mismatch')} mismatch.\n\nInstalled: ${set}\n`);
  }
}

if (command === 'prepare' || command === 'all') await prepare();
if (command === 'snippets' || command === 'all') await snippets();
if (command === 'parity' || command === 'all') await parity();
assert.ok(['prepare', 'snippets', 'parity', 'all'].includes(command), `unknown command ${command}`);
