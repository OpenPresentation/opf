// Explicit local development setup: link this OPF checkout without saving file: dependencies.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opfPackage = path.join(root, 'packages/javascript');
if (!existsSync(path.join(opfPackage, 'dist/composition.js'))) throw new Error('Build OPF first: pnpm build');
const names = ['opf-render', 'opf-pptx', 'opf-editor'];
if (!process.argv.includes('--packages-only')) names.push('pptx-gallery');
function linkPackage(directory, packageName, source) {
  const target = path.join(directory, 'node_modules', packageName);
  if (!existsSync(target)) throw new Error(`Install dependencies in ${directory} first.`);
  if (!lstatSync(target).isSymbolicLink()) {
    const metadata = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
    if (metadata.name !== packageName) throw new Error(`Refusing to replace unexpected package at ${target}`);
  }
  // node_modules is disposable; never follow a symlink into another checkout.
  if (lstatSync(target).isSymbolicLink()) unlinkSync(target);
  else rmSync(target, { recursive: true, force: true });
  symlinkSync(source, target, 'dir');
}
for (const name of names) {
  const directory = path.resolve(root, '..', name);
  if (!existsSync(path.join(directory, 'package.json'))) throw new Error(`Missing sibling checkout: ${directory}`);
  linkPackage(directory, '@openpresentation/opf', opfPackage);
  if (name === 'opf-pptx' || name === 'opf-editor') {
    linkPackage(directory, '@openpresentation/opf-render', path.resolve(root, '../opf-render'));
  }
  if (name !== 'pptx-gallery') {
    const result = spawnSync('npm', ['run', 'build'], { cwd: directory, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log(`${name}: linked current OPF${name === 'opf-pptx' || name === 'opf-editor' ? ' and renderer' : ''} checkout`);
}
