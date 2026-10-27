import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// A host may start the source worker from a file of its own that only imports the package's worker entry
// (`import "@openpresentation/opf-editor/source-worker";`). With `"sideEffects": false` every bundler (webpack, Turbopack, Rollup/Vite, esbuild)
// dropped that import, so the worker loaded, never answered, and the pane waited 15 s before it checked on the main thread. The worker entry
// (and the stylesheet) are listed in `sideEffects`, so the import keeps the worker's code.
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(Array.isArray(pkg.sideEffects), 'sideEffects lists the files that have them');
assert.ok(pkg.sideEffects.includes('./dist/source-worker.js'), 'the worker entry has a side effect (it installs onmessage)');
assert.ok(pkg.sideEffects.includes('./dist/styles.css'), 'the stylesheet has a side effect');
assert.equal(pkg.exports['./source-worker'].default, './dist/source-worker.js');

const result = await build({
  stdin: { contents: 'import "@openpresentation/opf-editor/source-worker";', resolveDir: root, sourcefile: 'opf-source-worker.js' },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
  logLevel: 'silent',
  metafile: true,
});
const ignored = result.warnings.filter((warning) => warning.id === 'ignored-bare-import' && /opf-editor|packages\/editor/.test(warning.text + JSON.stringify(warning.location)));
assert.deepEqual(ignored.map((warning) => warning.text), [], 'the bundler keeps the import of the worker entry');
const code = result.outputFiles[0].text;
assert.match(code, /ready: true/, 'the worker says it is ready');
assert.match(code, /onmessage/, 'the worker handles messages');
assert.ok(code.length > 100_000, `the worker's checks are in the bundle (${code.length} bytes)`);
assert.ok(Object.keys(result.metafile.inputs).some((input) => /dist\/source-worker\.js$/.test(input)), 'the dist worker entry is the input');

console.log(`source-worker-bundle: a host file that only imports the worker entry bundles the worker (${Math.round(code.length / 1024)} KiB unminified).`);
