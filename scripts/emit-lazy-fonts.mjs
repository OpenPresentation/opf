// FF-31: emit the vendored (lazy) fonts of an opf-render font registry as separate, hash-pinned files.
//
// A registry's eager list (`registry.embeddedFonts`, the npm office and base faces) goes into one fonts.json. The vendored
// faces (Intos for the default Aptos scheme, and the open families) are `registry.lazyFonts`: they are not in fonts.json, so
// every editor and gallery visitor does not download them. A host copies their package directories next to the page, at the
// same package-relative paths (`fonts/intos/...`, `fonts/open/...`), and the browser loader fetches them on demand, verified
// against the sha256 the renderer's manifest pins, when a document's font families need them:
//   loadFonts({faces: eagerFaces, lazyFontsBaseUrl: './'}) from fonts-browser, then `await fonts.ensure(presentation)`.
// The committed half is `lazy-fonts.json` (gallery-lazy-fonts.mjs): the pinned manifest, no bytes. This local copy of the files is
// for the editor demo served from artifacts/editor; the gallery copies the faces from the pinned renderer package at build time.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * @param {{registry: {lazyFonts?: readonly {file: string, family: string, weight: number, italic: boolean, sha256: string, package: string}[]},
 *   packageRoot: string, out: string}} options `packageRoot` is the opf-render package (its `fonts/` directory), `out` the page directory.
 * @returns {Promise<{files: string[], faces: number, bytes: number}>} the emitted files, relative to `out`
 */
export async function emitLazyFonts({ registry, packageRoot, out }) {
  const lazy = registry.lazyFonts ?? [];
  if (!lazy.length) return { files: [], faces: 0, bytes: 0 };
  const files = [], sizes = new Map();
  for (const directory of new Set(lazy.map((face) => path.posix.dirname(face.file)))) {
    await mkdir(path.join(out, directory), { recursive: true });
    for (const name of (await readdir(path.join(packageRoot, directory))).sort()) {
      const relative = `${directory}/${name}`;
      await copyFile(path.join(packageRoot, relative), path.join(out, relative));
      files.push(relative);
    }
  }
  for (const face of lazy) {
    const bytes = await readFile(path.join(out, face.file));
    if (sha256(bytes) !== face.sha256) throw new Error(`Lazy font ${face.file} differs from the renderer's pinned sha256`);
    sizes.set(face.file, (await stat(path.join(out, face.file))).size);
  }
  const bytes = [...sizes.values()].reduce((sum, size) => sum + size, 0);
  return { files, faces: lazy.length, bytes };
}
