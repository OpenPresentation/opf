// Shared helpers for the diff, merge and format tests: the 127 example decks and
// seeded, deterministic edits.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples");

export function exampleFiles() {
  const files = [];
  (function walk(directory) {
    for (const entry of readdirSync(directory).sort()) {
      const file = path.join(directory, entry);
      if (statSync(file).isDirectory()) walk(file);
      else if (file.endsWith(".json")) files.push(file);
    }
  })(root);
  return files;
}

export function loadExamples() {
  return exampleFiles().map(file => ({ file: path.relative(root, file).replaceAll("\\", "/"), raw: readFileSync(file, "utf8") }));
}

export function rng(seed) {
  let state = seed >>> 0;
  return n => { state = (state * 1664525 + 1013904223) >>> 0; return state % n; };
}

/** Walk string leaves of a slide (not ids) and return their pointers. */
function stringLeaves(value, base, out) {
  if (typeof value === "string") out.push(base);
  else if (Array.isArray(value)) { for (const [i, item] of value.entries()) stringLeaves(item, `${base}/${i}`, out); }
  else if (value && typeof value === "object") for (const key of Object.keys(value)) if (key !== "id") stringLeaves(value[key], `${base}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, out);
}

function setAt(document, pointer, value) {
  const tokens = pointer.split("/").slice(1).map(token => token.replaceAll("~1", "/").replaceAll("~0", "~"));
  let node = document;
  for (const token of tokens.slice(0, -1)) node = node[token];
  node[tokens.at(-1)] = value;
}

/** A seeded edit of a deck: edits, removals, insertions, moves, design and metadata changes. */
export function mutate(deck, seed, { strip = false } = {}) {
  const next = structuredClone(deck);
  const rand = rng(seed);
  if (strip) for (const slide of next.slides) delete slide.id;
  const steps = 1 + rand(4);
  for (let step = 0; step < steps; step++) {
    const kind = rand(8);
    const slides = next.slides;
    const index = rand(slides.length);
    if (kind === 0) {
      const leaves = [];
      stringLeaves(slides[index], `/slides/${index}`, leaves);
      if (leaves.length) setAt(next, leaves[rand(leaves.length)], `Edited ${seed}-${step}`);
    } else if (kind === 1 && slides.length > 2) slides.splice(index, 1);
    else if (kind === 2) slides.splice(rand(slides.length + 1), 0, { id: `added-${seed}-${step}`, title: `Added ${seed}-${step}`, text: `Body ${step}` });
    else if (kind === 3 && slides.length > 2) { const [moved] = slides.splice(index, 1); slides.splice(rand(slides.length + 1), 0, moved); }
    else if (kind === 4) next.name = `${next.name} (${seed}-${step})`;
    else if (kind === 5) next.design = { ...(next.design ?? {}), theme: step % 2 ? "minimal" : "bold" };
    else if (kind === 6) slides[index].notes = `Notes ${seed}-${step}`;
    else if (kind === 7 && slides.length > 1) { const other = rand(slides.length); [slides[index], slides[other]] = [slides[other], slides[index]]; }
  }
  return next;
}
