import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

// What a host that mounts only the source pane through the SDK (`createOpfEditor(el, { layout: "source" })`, or the React binding with only a
// `source` slot) loads before anything runs: the source pane, CodeMirror, the session and core. The renderer, the canvas and every slide part
// are one chunk the SDK imports on demand, only when a layout needs them. Measured the way a host bundles the package (esbuild, ESM, code
// splitting, minified): the "initial" graph is the entry's chunk and every chunk it imports statically.
const root = fileURLToPath(new URL('../', import.meta.url));
const SLIDE_ONLY = [/(^|[/\\])render[/\\]dist[/\\]/, /@openpresentation[/\\]opf-render/, ...['canvas', 'presenter', 'export-menu', 'design-controls', 'slide-manager', 'workspace-parts'].map((file) => new RegExp(`(^|[/\\\\])dist[/\\\\]${file}\\.js$`))];

async function measure(name, contents) {
  const outdir = mkdtempSync(path.join(os.tmpdir(), `opf-ws-bundle-${name}-`));
  try {
    const result = await build({
      stdin: { contents, resolveDir: root, sourcefile: `${name}.js` },
      bundle: true, splitting: true, format: 'esm', minify: true, platform: 'browser', outdir, write: true, metafile: true, logLevel: 'silent', absWorkingDir: root,
      loader: { '.wasm': 'file', '.ttf': 'file', '.woff2': 'file', '.woff': 'file' },
    });
    const outputs = result.metafile.outputs;
    // The stdin entry is the one output whose chunk is named after it.
    const entry = Object.keys(outputs).find((key) => outputs[key].entryPoint === `${name}.js`);
    assert.ok(entry, `${name}: the entry chunk`);
    const initial = new Set();
    const walk = (key) => {
      if (initial.has(key)) return;
      initial.add(key);
      for (const { path: next, kind } of outputs[key].imports) if (kind === 'import-statement' && outputs[next]) walk(next);
    };
    walk(entry);
    const js = (keys) => [...keys].filter((key) => key.endsWith('.js'));
    const size = (keys) => js(keys).reduce((sum, key) => {
      const bytes = readFileSync(path.resolve(root, key));
      return { raw: sum.raw + bytes.length, gzip: sum.gzip + gzipSync(bytes).length };
    }, { raw: 0, gzip: 0 });
    const inputsOf = (keys) => new Set([...keys].flatMap((key) => Object.keys(outputs[key].inputs)));
    return { initial: size(initial), total: size(Object.keys(outputs)), initialInputs: inputsOf(initial), allInputs: inputsOf(Object.keys(outputs)) };
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
}

const kib = ({ raw, gzip }) => `${(raw / 1024).toFixed(0)} KiB (${(gzip / 1024).toFixed(0)} KiB gzip)`;
const slideOnly = (inputs) => [...inputs].filter((input) => SLIDE_ONLY.some((pattern) => pattern.test(input)));
const slideFiles = (inputs) => new Set(slideOnly(inputs).map((input) => (/render/.test(input) ? 'renderer' : path.basename(input))));

const source = await measure('source-host', `
  import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
  createOpfEditor(document.getElementById("app"), { layout: "source", document: { name: "x", slides: [{ title: "Hi" }] } });
`);
const pane = await measure('pane-host', `
  import { createEditorSession } from "@openpresentation/opf-editor";
  import { createSourcePane } from "@openpresentation/opf-editor/source-pane";
  createSourcePane(document.getElementById("app"), { editor: createEditorSession({ name: "x", slides: [{ title: "Hi" }] }) });
`);

assert.deepEqual(slideOnly(source.initialInputs), [], 'a source-only SDK host loads no renderer, canvas or slide part up front');
assert.deepEqual([...slideFiles(source.allInputs)].sort(), ['canvas.js', 'design-controls.js', 'export-menu.js', 'presenter.js', 'renderer', 'slide-manager.js', 'workspace-parts.js'], 'the slide parts are still in the build, as a chunk loaded on demand');
assert.ok(source.initial.raw < pane.initial.raw * 1.25, `the SDK adds little to the bare source pane up front (${kib(source.initial)} against ${kib(pane.initial)})`);

console.log(`workspace-bundle: a source-only SDK host loads ${kib(source.initial)} up front (the bare source pane: ${kib(pane.initial)}); the slide chunk and the rest bring the build to ${kib(source.total)}; no renderer up front.`);
