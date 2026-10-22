// RR-62: a copy of the workspace core (`packages/javascript`: its dist and manifest) in a tree with no optional peer above it.
// Core's Node build loads @openpresentation/opf-render and @openpresentation/opf-pptx from core's own location; the workspace
// core has them as devDependencies, so a test of a missing peer needs a core outside the workspace. Its runtime dependencies are
// linked from the workspace install (a pnpm layout resolves their own dependencies from their real paths).
import { cp, mkdir, readFile, realpath, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const coreRoot = path.join(root, 'packages', 'javascript');

/** Copy core into `modules/@openpresentation/opf` (a node_modules directory) and link its dependencies beside it. Returns the copy's directory. */
export async function installIsolatedCore(modules) {
  const target = path.join(modules, '@openpresentation', 'opf');
  await mkdir(target, { recursive: true });
  await cp(path.join(coreRoot, 'dist'), path.join(target, 'dist'), { recursive: true });
  const manifestText = await readFile(path.join(coreRoot, 'package.json'), 'utf8');
  await cp(path.join(coreRoot, 'package.json'), path.join(target, 'package.json'));
  const require = createRequire(path.join(coreRoot, 'package.json'));
  for (const name of Object.keys(JSON.parse(manifestText).dependencies ?? {})) {
    const source = await realpath(path.dirname(require.resolve(`${name}/package.json`)));
    const link = path.join(modules, ...name.split('/'));
    await mkdir(path.dirname(link), { recursive: true });
    await symlink(source, link, 'junction');
  }
  return target;
}
