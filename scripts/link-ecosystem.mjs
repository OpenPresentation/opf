// Explicit local development setup: link this checkout's core into the pptx.gallery site checkout without saving file: dependencies.
// MR-34: the packages are workspace members of this repository now, so the sibling-repository linking this script did (render, PPTX,
// editor, the renderer's font pins, builds of the siblings) is gone; the sites stay separate repositories, and this is the site linker:
// it replaces the installed @openpresentation packages in the site's node_modules with links to this checkout's packages.
//
//   node scripts/link-ecosystem.mjs [<site directory>…]     default: ../pptx-gallery (the directory beside this checkout)
//
// Build core first (`pnpm build`). Reinstalling the site's dependencies can replace the link; rerun this command afterwards.
import { existsSync, lstatSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opfPackage = path.join(root, 'packages/javascript');
/** The workspace packages a site can install, and where they live here. */
export const PACKAGES = {
  '@openpresentation/opf': 'packages/javascript',
  '@openpresentation/cli': 'packages/cli',
  '@openpresentation/gallery': 'packages/gallery',
  '@openpresentation/opf-render': 'packages/render',
  '@openpresentation/opf-pptx': 'packages/pptx',
  '@openpresentation/opf-editor': 'packages/editor',
};

/** Replace `node_modules/<packageName>` of `directory` with a link to `source`; refuses anything that would write outside that node_modules. */
export function linkPackage(directory, packageName, source) {
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

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  if (!existsSync(path.join(opfPackage, 'dist/composition.js'))) throw new Error('Build OPF first: pnpm build');
  const sites = process.argv.slice(2).filter((arg) => !arg.startsWith('--')).map((site) => path.resolve(site));
  for (const directory of sites.length ? sites : [path.resolve(root, '..', 'pptx-gallery')]) {
    if (!existsSync(path.join(directory, 'package.json'))) throw new Error(`Missing site checkout: ${directory}`);
    // Every workspace package the site has installed (core always); a package it does not use is not added.
    for (const [name, source] of Object.entries(PACKAGES)) {
      if (name === '@openpresentation/opf' || existsSync(path.join(directory, 'node_modules', name))) linkPackage(directory, name, path.join(root, source));
    }
    console.log(`${path.basename(directory)}: linked the installed @openpresentation packages to this checkout`);
  }
}
