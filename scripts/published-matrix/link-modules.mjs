// Lays out `node_modules` for a copied package of the installed-parity harness (installed-parity.mjs).
import {mkdir, readdir, symlink} from 'node:fs/promises';
import path from 'node:path';

// A directory junction on Windows (no administrator right needed), a symlink elsewhere.
export const link = (target, at) => symlink(target, at, process.platform === 'win32' ? 'junction' : 'dir');

const linkIfAbsent = (target, at) => link(target, at).catch((error) => {
  if (error.code !== 'EEXIST') throw error;
});

// A package copy keeps the dependencies npm nested inside it (opf-render 0.13.1 ships its own pako 1.0.11 beside the PPTX's pako 3), and those must keep
// winning over the consumer's top-level ones. Link the consumer's node_modules as a whole when the copy has none; otherwise link every entry the copy does
// not nest (scoped packages one by one). Running it again changes nothing.
export async function linkModules(modules, at) {
  const nested = await readdir(at).then(() => true, () => false);
  if (!nested) return link(modules, at);
  for (const entry of (await readdir(modules)).filter((name) => !name.startsWith('.'))) {
    if (!entry.startsWith('@')) {
      await linkIfAbsent(path.join(modules, entry), path.join(at, entry));
      continue;
    }
    await mkdir(path.join(at, entry), {recursive: true});
    for (const child of await readdir(path.join(modules, entry))) await linkIfAbsent(path.join(modules, entry, child), path.join(at, entry, child));
  }
}
