import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  OPFRenderError,
  renderSvg,
  renderSvgDeck,
  resolvePresentation
} from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const formatRepoExamples = path.resolve(root, "../opf/examples");

const minimalDeck = {
  name: "Minimal OPF Deck",
  slides: [
    { title: "Minimal OPF Deck" },
    {
      title: "What This Shows",
      items: ["A title slide", "A simple list slide", "A closing slide"]
    },
    {
      title: "Next Steps",
      text: "Use this as a small valid OPF starting point."
    }
  ]
};

const first = renderSvg(minimalDeck, { trace: true });
const second = renderSvg(minimalDeck, { trace: true });
assert.equal(first, second, "renderSvg must be byte-stable for the same input");
assert.match(first, /^<svg /);
assert.match(first, /data-opf-path="slides\.0"/);
assert.match(first, /Minimal OPF Deck/);
assert.equal(renderSvg(minimalDeck).includes("data-opf-path"), false, "trace output must be optional");
assert.equal(renderSvgDeck(minimalDeck).length, 3);

const resolved = resolvePresentation(minimalDeck);
assert.equal(resolved.slides.length, 3);
assert.equal(resolved.slides[1].layout.id, "list-1x");

const inlineCatalogDeck = {
  name: "Inline Catalog Resolution",
  catalogs: {
    layouts: {
      records: [
        {
          "$schema": "https://openpresentation.org/schema/opf-layout/v1",
          id: "custom-title-text",
          name: "Custom Title Text",
          placeholders: [{ type: "title" }, { type: "text" }]
        }
      ]
    }
  },
  slides: [
    {
      layout: "custom-title-text",
      title: "Custom layout",
      text: "Inline layout records resolve before bundled catalogs."
    }
  ]
};
assert.match(renderSvg(inlineCatalogDeck, { trace: true }), /custom-title-text|Custom layout/);

assert.throws(
  () => renderSvg({ slides: "not an array" }),
  (error) => {
    assert.ok(error instanceof OPFRenderError);
    assert.equal(error.code, "invalid-opf");
    assert.ok(Array.isArray(error.issues));
    assert.ok(error.issues.length > 0);
    return true;
  }
);

let corpusCount = 0;
if (existsSync(formatRepoExamples)) {
  for (const file of listOpfExamples(formatRepoExamples)) {
    const deck = JSON.parse(readFileSync(file, "utf8"));
    const svgs = renderSvgDeck(deck, { trace: true });
    const repeat = renderSvgDeck(deck, { trace: true });
    assert.deepEqual(svgs, repeat, `${path.relative(formatRepoExamples, file)} must render deterministically`);
    assert.equal(svgs.length, deck.slides.length, `${file} must emit one SVG per slide`);
    for (const svg of svgs) {
      assert.match(svg, /^<svg /);
      assert.match(svg, /data-opf-path=/);
    }
    corpusCount += 1;
  }
}

console.log(`opf-render smoke passed (${corpusCount} OPF corpus deck(s) rendered).`);

function listOpfExamples(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listOpfExamples(absolute));
    if (entry.isFile() && entry.name.endsWith(".opf.json")) files.push(absolute);
  }
  return files.sort();
}
