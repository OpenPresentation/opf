// Explicit local development setup: link this OPF checkout without saving file: dependencies.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {packageManagerInvocation} from './package-manager.mjs';
import {assertSingleCore} from './check-one-core.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opfPackage = path.join(root, 'packages/javascript');
if (!existsSync(path.join(opfPackage, 'dist/composition.js'))) throw new Error('Build OPF first: pnpm build');
const names = ['opf-render', 'opf-pptx', 'opf-editor'];
if (!process.argv.includes('--packages-only')) names.push('pptx-gallery');
function linkPackage(directory, packageName, source) {
  const target = path.join(directory, 'node_modules', packageName);
  if (!existsSync(target)) throw new Error(`Install dependencies in ${directory} first.`);
  const relativeParent = path.relative(realpathSync(directory), realpathSync(path.dirname(target)));
  if (path.isAbsolute(relativeParent) || relativeParent.split(path.sep)[0] !== 'node_modules') {
    throw new Error(`Refusing to replace a package outside ${directory}'s node_modules: ${target}`);
  }
  if (!lstatSync(target).isSymbolicLink()) {
    const metadata = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
    if (metadata.name !== packageName) throw new Error(`Refusing to replace unexpected package at ${target}`);
  }
  // node_modules is disposable; never follow a symlink into another checkout.
  if (lstatSync(target).isSymbolicLink()) unlinkSync(target);
  else rmSync(target, { recursive: true, force: true });
  symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
}
// The linked renderer pins its script and emoji font packages exactly (optional peers), and its font loader checks every
// file against those pins' SHA-256. A sibling's own lockfile installs the pins of the published renderer it develops
// against, so after a renderer font bump on main the linked checkout would load files it rejects
// (font-integrity-mismatch). Install the linked renderer's pins in their place, as an app that upgrades the renderer does.
// Only packages the sibling already has are replaced. The tarballs come from `npm pack` (OPF_LINK_FONT_CACHE, if set, is
// checked first and filled), and nothing re-runs npm install, which would undo the links above.
const renderManifest = path.resolve(root, '../opf-render/package.json');
const fontCache = process.env.OPF_LINK_FONT_CACHE || mkdtempSync(path.join(tmpdir(), 'opf-link-fonts-'));
function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
  return result.stdout;
}
function fontTarball(name, version) {
  const file = path.join(fontCache, `${name.slice(1).replace('/', '-')}-${version}.tgz`);
  if (!existsSync(file)) {
    mkdirSync(fontCache, { recursive: true });
    const {command,args} = packageManagerInvocation('npm', ['pack', `${name}@${version}`, '--pack-destination', fontCache, '--silent']);
    run(command, args);
    if (!existsSync(file)) throw new Error(`npm pack ${name}@${version} did not write ${file}`);
  }
  return file;
}
function alignFontPeers(directory) {
  if (!existsSync(renderManifest)) return [];
  const peers = JSON.parse(readFileSync(renderManifest, 'utf8')).peerDependencies ?? {};
  const moved = [];
  for (const [name, version] of Object.entries(peers)) {
    if (!name.startsWith('@expo-google-fonts/') || !/^\d+\.\d+\.\d+$/.test(version)) continue;
    const target = path.join(directory, 'node_modules', name);
    const manifest = path.join(target, 'package.json');
    if (!existsSync(manifest) || lstatSync(target).isSymbolicLink()) continue;
    const installed = JSON.parse(readFileSync(manifest, 'utf8')).version;
    if (installed === version) continue;
    const staging = mkdtempSync(path.join(path.dirname(target), '.opf-link-'));
    try {
      run('tar', ['-xzf', fontTarball(name, version), '-C', staging]);
      rmSync(target, { recursive: true, force: true });
      renameSync(path.join(staging, 'package'), target);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
    moved.push(`${name} ${installed} -> ${version}`);
  }
  return moved;
}
for (const name of names) {
  const directory = path.resolve(root, '..', name);
  if (!existsSync(path.join(directory, 'package.json'))) throw new Error(`Missing sibling checkout: ${directory}`);
  linkPackage(directory, '@openpresentation/opf', opfPackage);
  if (name === 'opf-pptx' || name === 'opf-editor') {
    linkPackage(directory, '@openpresentation/opf-render', path.resolve(root, '../opf-render'));
    for (const line of alignFontPeers(directory)) console.log(`${name}: font package ${line} (the linked renderer's pin)`);
  }
  if (name === 'opf-editor') {
    linkPackage(directory, '@openpresentation/opf-pptx', path.resolve(root, '../opf-pptx'));
  }
  if (name !== 'pptx-gallery') {
    const {command,args} = packageManagerInvocation('npm', ['run', 'build']);
    const result = spawnSync(command, args, { cwd: directory, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  // RR-62: the linked checkout is the only core. Core now declares opf-render and opf-pptx as optional peers (and has them as
  // devDependencies), so check that no sibling, and no sibling's linked renderer or converter, reaches another copy.
  if (name !== 'pptx-gallery') {
    const linked = ['opf-render', 'opf-pptx'].filter((peer) => existsSync(path.join(directory, 'node_modules', '@openpresentation', peer, 'package.json')));
    await assertSingleCore({
      expected: opfPackage,
      roots: [directory],
      resolvers: [path.join(directory, 'package.json'), ...linked.map((peer) => path.join(directory, 'node_modules', '@openpresentation', peer, 'package.json'))],
      label: `${name} (linked ecosystem)`,
    });
  }
  console.log(`${name}: linked current OPF${name === 'opf-pptx' || name === 'opf-editor' ? ', renderer' : ''}${name === 'opf-editor' ? ', converter' : ''} checkout`);
}
