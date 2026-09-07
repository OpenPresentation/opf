// Explicit local development setup: link this OPF checkout without saving file: dependencies.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opfPackage = path.join(root, 'packages/javascript');
if (!existsSync(path.join(opfPackage, 'dist/composition.js'))) throw new Error('Build OPF first: pnpm build');
for (const name of ['opf-render', 'opf-pptx', 'opf-editor', 'pptx-gallery']) {
  const directory = path.resolve(root, '..', name);
  const target = path.join(directory, 'node_modules/@openpresentation/opf');
  if (!existsSync(path.join(directory, 'package.json'))) throw new Error(`Missing sibling checkout: ${directory}`);
  if (!existsSync(target)) throw new Error(`Install dependencies in ${directory} first.`);
  if (!lstatSync(target).isSymbolicLink()) {
    const metadata = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
    if (metadata.name !== '@openpresentation/opf') throw new Error(`Refusing to replace unexpected package at ${target}`);
  }
  // node_modules is disposable; never follow a symlink into another checkout.
  if (lstatSync(target).isSymbolicLink()) unlinkSync(target);
  else rmSync(target, { recursive: true, force: true });
  symlinkSync(opfPackage, target, 'dir');
  if (name !== 'pptx-gallery') {
    const result = spawnSync('npm', ['run', 'build'], { cwd: directory, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log(`${name}: linked current OPF checkout`);
}
