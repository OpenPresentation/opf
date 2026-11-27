// The core's build includes the part of `jsonc-parser` it uses. The package's `main` is a UMD build that loads its parts through a
// `require` parameter, which an esbuild bundle for Node cannot follow: a server that bundles the core would build and then throw when
// it loads. So `dist` must not import the package, and a bundle made the way a Node server adapter makes one must load and run.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(packageRoot, "dist");
const esbuild = createRequire(createRequire(path.join(packageRoot, "package.json")).resolve("tsup"))("esbuild");

/** Every built `.js` and `.d.ts` file under `dist`, as a path. */
function builtFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...builtFiles(full));
    else if (/\.js$|\.d\.ts$/.test(entry.name)) found.push(full);
  }
  return found;
}

// An import, an export-from, a dynamic import or a require of the package or one of its subpaths. The bundled chunk keeps esbuild's
// path comments that name the package, so the pattern matches statements, not the name.
const statement = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']jsonc-parser(?:\/[^"']*)?["']/;

test("no built file of the core imports jsonc-parser", () => {
  const files = builtFiles(dist);
  assert.ok(files.length > 30, "the core is built (run the package build first)");
  const importing = files.filter((file) => statement.test(readFileSync(file, "utf8"))).map((file) => path.relative(packageRoot, file));
  assert.deepEqual(importing, []);
});

const scratch = mkdtempSync(path.join(os.tmpdir(), "opf-jsonc-bundle-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

for (const [name, specifier] of [
  ["validator", "@openpresentation/opf/validator"],
  ["source", "@openpresentation/opf/source"],
  ["root", "@openpresentation/opf"],
]) {
  test(`a Node server bundle of the ${name} entry loads and runs without jsonc-parser's files`, async () => {
    const file = path.join(scratch, `${name}.mjs`);
    const result = await esbuild.build({
      stdin: { contents: `import * as m from '${specifier}'; export const names = Object.keys(m).length;`, resolveDir: packageRoot, loader: "js" },
      bundle: true,
      platform: "node",
      format: "esm",
      conditions: ["workerd"],
      outfile: file,
      metafile: true,
      logLevel: "silent",
      // A Node server adapter gives its bundle a working `require` for Node builtins (yaml's Node build calls require("process")).
      banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
    });
    const inputs = Object.keys(result.metafile.inputs).filter((input) => /[\\/]jsonc-parser[\\/]/.test(input));
    assert.deepEqual(inputs, [], "no file of node_modules/jsonc-parser is an input of the bundle");
    const loaded = await import(`${pathToFileURL(file).href}?${name}`);
    assert.ok(loaded.names > 0, "the bundle loads and exports names");
  });
}
