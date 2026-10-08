// FA-23: the type declarations name every option the JavaScript reads, so a TypeScript host never has to route around a missing one
// (pptx-dev hit `createCanvasEditor`'s `catalogs`). The check reads `options.<name>` in each module and the declared option interface.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
function declared(text, name) {
  const start = text.indexOf(`export interface ${name} `);
  assert.ok(start >= 0, `${name} is declared`);
  let depth = 0, end = start;
  for (let at = text.indexOf("{", start); at < text.length; at += 1) {
    if (text[at] === "{") depth += 1;
    else if (text[at] === "}" && --depth === 0) { end = at; break; }
  }
  const body = text.slice(text.indexOf("{", start) + 1, end);
  // Top-level members only: drop nested braces and comments.
  const flat = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{[^{}]*\}/g, "{}").replace(/\{[^{}]*\}/g, "{}");
  return new Set([...flat.matchAll(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*[:(]/gm)].map((match) => match[1]));
}
for (const [module, types, name, ignore] of [
  ["canvas.js", "canvas.d.ts", "CanvasEditorOptions", []],
  ["design-controls.js", "design-controls.d.ts", "DesignControlsOptions", []],
]) {
  const js = await source(module);
  const read = new Set([...js.matchAll(/(?<![\w$/-])options\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]));
  const names = declared(await source(types), name);
  const missing = [...read].filter((key) => !names.has(key) && !ignore.includes(key));
  assert.deepEqual(missing, [], `${name} declares every option ${module} reads`);
}
assert.ok(declared(await source("canvas.d.ts"), "CanvasEditorOptions").has("catalogs"), "createCanvasEditor's catalogs option is declared");
console.log("declared options: canvas and design-controls types name every option the code reads");
