// RR-17 (Mac checks): runs opf-render's own browser gates (test/*-browser.mjs, unchanged tolerances) in Chromium and in WebKit.
// A WebKit run is the same file with `import {chromium} from 'playwright'` replaced by `import {webkit as chromium} from 'playwright'`;
// nothing else is edited, so every gate keeps its assertions (0.1 px advance and origin, 0.15 px variable-font gate, ink masks).
//   [SUITE=editor] [GATES=a,b] node run-engine-gates.mjs <opf-render (or opf-editor with SUITE=editor) checkout, built, with node_modules> <out.json> [chromium|webkit ...]
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const engines = process.argv.slice(4).length ? process.argv.slice(4) : ["chromium", "webkit"];
const renderGates = [
  ["accepted-text-browser", []],
  ["rich-flow-browser", []],
  ["rich-spacing-browser", []],
  ["rich-tab-browser", []],
  ["rich-tab-estimated-browser", []],
  ["plain-whitespace-browser", []],
  ["shared-code-browser", []],
  ["image-placeholders-browser", []],
  ["player-browser", ["ARTIFACTS/player"]],
  ["export-browser", ["ARTIFACTS/export-browser"]],
  ["font-variants-browser", []],
  ["font-preparation-browser", ["ARTIFACTS/font-preparation-browser.json"]],
  ["aptos-preview-browser", ["ARTIFACTS/aptos-preview-browser.json"]],
  ["latin-family-hosts-browser", ["ARTIFACTS/latin-family-hosts"]],
  ["lazy-fonts-browser", ["ARTIFACTS/lazy-fonts"]],
  ["lazy-face-fallback-browser", ["ARTIFACTS/lazy-face-fallback"]],
  ["extra-lazy-fonts-browser", ["ARTIFACTS/extra-lazy-fonts"]],
  ["script-fonts-browser", ["ARTIFACTS/script-fonts-browser.json"]],
  ["script-fonts-auto-browser", ["ARTIFACTS/script-fonts-auto"]],
  ["script-corpora-browser", ["ARTIFACTS/script-corpora-browser.json"]],
  ["script-corpora-slides-browser", ["ARTIFACTS/script-corpora-slides-browser.json"]],
  ["symbol-fonts-browser", ["ARTIFACTS/symbol-fonts-browser.json"]],
  ["emoji-math-browser", ["ARTIFACTS/emoji-math-browser.json"]],
];
// opf-editor (SUITE=editor): the playground gates; the playground must be built first (npm run build:playground).
const editorGates = [
  ["playground-source", []], ["playground-pptx", []], ["playground-download", ["ARTIFACTS/playground-download"]],
  ["playground-script-fonts", ["ARTIFACTS/playground-script-fonts"]], ["playground-lazy-fonts", ["ARTIFACTS/playground-lazy-fonts"]],
  ["playground-base-fonts", ["ARTIFACTS/playground-base-fonts"]], ["playground-ensure-fonts", ["ARTIFACTS/playground-ensure-fonts"]],
  ["canvas-fonts-browser", ["ARTIFACTS/canvas-fonts"]], ["design-controls-browser", []], ["design-gaps-browser", []],
  ["chart-options-browser", []], ["persistence-browser", []], ["slides-browser", []], ["template-panel-browser", []],
  ["numbering-panel-browser", []], ["find-replace-browser", []], ["image-crop-browser", []], ["mobile-browser", []],
  ["review-panel-browser", []], ["json-editor-browser", []], ["selection-browser", []], ["click-entry-browser", []],
];
const gates = process.env.SUITE === "editor" ? editorGates : renderGates;
const only = process.env.GATES ? new Set(process.env.GATES.split(",")) : null;
const results = [];
for (const [name, args] of gates) {
  if (only && !only.has(name)) continue;
  for (const engine of engines) {
    const source = path.join(root, "test", `${name}.mjs`);
    let text = readFileSync(source, "utf8");
    // "webkit-online": WebKit with the test's `setOffline(true)` turned into `setOffline(false)`. Playwright's WebKit blocks blob: URL loads
    // while the context is offline (an <img> of a blob: SVG errors, a File read fails), which Chromium does not; the gates that assert
    // "no network" by going offline then fail for a reason that is not Safari's. Every other assertion of the file is unchanged.
    if (engine === "webkit" || engine === "webkit-online") {
      let replaced = text.replace(/import\s*\{\s*chromium\s*\}\s*from\s*(['"])playwright\1/, "import {webkit as chromium} from 'playwright'");
      // Tests that launch the browser through the editor's shared harness (test/support/playground-harness.mjs) get a WebKit copy of it.
      if (replaced === text && text.includes("./support/playground-harness.mjs")) {
        const harness = readFileSync(path.join(root, "test/support/playground-harness.mjs"), "utf8").replace(/import\s*\{\s*chromium\s*\}\s*from\s*(['"])playwright\1/, "import {webkit as chromium} from 'playwright'");
        writeFileSync(path.join(root, "test/support/playground-harness.webkit.mjs"), harness);
        replaced = text.replace("./support/playground-harness.mjs", "./support/playground-harness.webkit.mjs");
      }
      if (replaced === text) { results.push({ gate: name, engine, status: "not-run", note: "no `import {chromium}` line to swap" }); continue; }
      text = engine === "webkit-online" ? replaced.replaceAll("setOffline(true)", "setOffline(false)") : replaced;
    }
    const copy = path.join(root, "test", `${name}.${engine}.mjs`);
    writeFileSync(copy, text);
    const artifacts = path.join("artifacts", `engine-${engine}`);
    mkdirSync(path.join(root, artifacts), { recursive: true });
    const started = Date.now();
    const run = spawnSync(process.execPath, [copy, ...args.map((arg) => arg.replace("ARTIFACTS", artifacts))], { cwd: root, encoding: "utf8", timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
    const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.trim().split("\n");
    results.push({ gate: name, engine, status: run.status === 0 ? "pass" : "fail", exit: run.status, seconds: Math.round((Date.now() - started) / 1000), tail: run.status === 0 ? undefined : output.slice(-14).map((line) => line.slice(0, 400)) });
    console.log(name, engine, run.status === 0 ? "pass" : "FAIL", `${Math.round((Date.now() - started) / 1000)}s`);
    writeFileSync(out, `${JSON.stringify({ date: "2026-10-02", suite: process.env.SUITE ?? "render", checkout: process.env.CHECKOUT ?? "opf-render 0.12.0 (3b300a3)", results }, null, 1)}\n`);
  }
}
