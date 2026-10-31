import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as expand from "../src/editor-expand.js";

// CE-28: what can be checked without a browser (test/editor-expand-browser.mjs does the rest): the module's surface, its argument errors, the
// package export and the stylesheets.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

assert.deepEqual(Object.keys(expand).sort(), ["createExpandButton", "createExpandController"]);
assert.throws(() => expand.createExpandController(null), TypeError);
assert.throws(() => expand.createExpandController({}), TypeError);
assert.throws(() => expand.createExpandButton({}, {}), TypeError);

const pkg = JSON.parse(read("package.json"));
assert.deepEqual(pkg.exports["./editor-expand"], { types: "./dist/editor-expand.d.ts", default: "./dist/editor-expand.js" }, "the package exports the part like ./slide-navigator");
assert.deepEqual(Object.keys(pkg.exports["./editor-expand"]), Object.keys(pkg.exports["./slide-navigator"]));

const dts = read("src/editor-expand.d.ts");
for (const name of ["createExpandController", "createExpandButton", "ExpandController", "ExpandButton", "ExpandLabels"]) assert.match(dts, new RegExp(`\\b${name}\\b`), `${name} is typed`);

const css = read("src/styles/expand.css").replace(/\/\*[\s\S]*?\*\//g, "");
assert.match(css, /\[data-opf-expanded\]\s*\{[^}]*position:\s*fixed\s*!important/, "the attribute makes a fixed overlay");
assert.match(css, /inset:\s*0\s*!important/);
assert.match(css, /z-index:\s*var\(--opf-expand-z,\s*1000\)/, "the z-index is a custom property with a default");
assert.match(css, /background:\s*var\(--opf-ui-bg\)/, "the background is a token");
assert.ok(!/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(css), "no color literal");
assert.ok([...css.matchAll(/\.(opf-[a-z]+)-/g)].every(([, prefix]) => prefix === "opf-expand"), "every class has the opf-expand- prefix");
assert.match(read("src/styles/touch.css"), /\(pointer: coarse\)\s*\{\s*\.opf-expand-button,[^}]*width:\s*44px;\s*height:\s*44px/, "touch.css lifts the button to 44px");

const suites = JSON.parse(read("test/browser-suites.json"));
assert.ok(suites.suites.browser.tests.some((test) => test.id === "browser:editor-expand" && test.command === "node test/editor-expand-browser.mjs"), "the browser suite runs the expand test");

console.log("editor expand unit checks passed");
