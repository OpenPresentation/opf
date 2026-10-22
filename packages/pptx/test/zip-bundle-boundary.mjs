// RR-20: browser bundles of opf-pptx never follow @node-projects/jszip's require("readable-stream") probe.
// lib/support.js of @node-projects/jszip 4.3.0 runs `require("readable-stream")` inside try/catch. In Node ESM that
// always fails (no require), but a bundler follows the literal: when the consumer's tree holds readable-stream 2 (for
// example through jszip 3), esbuild bundles it and fails on "events" and "buffer" (opf-editor#94). The browser field of
// vendor/pptxgenjs/package.json maps the engine's import to vendor/jszip/index-min.js, the package's own bundle of the
// same lib/ (vendor/jszip/UPSTREAM.json), which has no literal require. The packed, in-browser check with readable-stream
// installed is test/packed-bundle-browser.mjs; this one runs offline on every `npm test`.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const probe = () => {
  const seen = [];
  return {
    seen,
    plugin: { name: 'probe-readable-stream', setup(context) {
      context.onResolve({ filter: /^readable-stream$/ }, ({ importer }) => { seen.push(importer); return { path: 'readable-stream', external: true }; });
    } },
  };
};
const bundle = async (entry, plugin) => build({ entryPoints: [entry], bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true, logLevel: 'silent', plugins: [plugin] });

// Control: bundling the installed lib/ directly does reach the probe, so the check below can fail.
const control = probe();
await bundle(createRequire(import.meta.url).resolve('@node-projects/jszip'), control.plugin);
assert.equal(control.seen.length, 1, 'the installed @node-projects/jszip lib/ probes readable-stream (control)');

for (const entry of ['../src/index.js', '../dist/index.js']) {
  const check = probe();
  const result = await bundle(fileURLToPath(new URL(entry, import.meta.url)), check.plugin);
  assert.deepEqual(check.seen, [], `${entry}: the browser bundle must not import readable-stream`);
  const inputs = Object.keys(result.metafile.inputs).map(input => input.replaceAll('\\', '/'));
  assert.ok(inputs.some(input => input.endsWith('vendor/jszip/index-min.js')), `${entry}: the browser bundle uses vendor/jszip/index-min.js`);
  assert.ok(!inputs.some(input => input.includes('node_modules/@node-projects/jszip/')), `${entry}: the browser bundle does not include @node-projects/jszip/lib`);
}
// Node is unchanged: it ignores the browser field and loads the installed package.
const vendor = await import('../vendor/pptxgenjs/pptxgen.es.js');
const { JSZip } = await import('@node-projects/jszip');
assert.equal(typeof vendor.default, 'function');
assert.equal(JSZip.support.nodestream, false, 'in Node ESM the probe fails, as the browser bundle assumes');
console.log('ZIP bundle boundary passed: browser bundles use the vendored @node-projects/jszip bundle and never import readable-stream; Node loads the installed package.');
