import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  OPFRenderError,
  renderSvg,
  renderSvgDeck,
  resolvePresentation,
  svgToPdf,
  svgToPng
} from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplesCorpus = resolveExamplesCorpus();

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

const png = await svgToPng(first, { scale: 0.5 });
const repeatPng = await svgToPng(first, { scale: 0.5 });
assert.deepEqual(png, repeatPng, "svgToPng must be byte-stable for the same input and scale");
assert.equal(Buffer.from(png.subarray(0, 8)).toString("hex"), "89504e470d0a1a0a");

const pdfSlides = renderSvgDeck(minimalDeck).slice(0, 2);
const pdf = await svgToPdf(pdfSlides, { scale: 0.25 });
const repeatPdf = await svgToPdf(pdfSlides, { scale: 0.25 });
assert.deepEqual(pdf, repeatPdf, "svgToPdf must be byte-stable for the same input and scale");
assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("utf8"), "%PDF-");
const { PDFDocument } = await import("pdf-lib");
const loadedPdf = await PDFDocument.load(pdf);
assert.equal(loadedPdf.getPageCount(), 2, "svgToPdf must emit one page per SVG");

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
if (examplesCorpus) {
  const files = listOpfExamples(examplesCorpus.dir);
  if (examplesCorpus.required) {
    assert.ok(files.length > 0, `OPF_EXAMPLES_DIR ${examplesCorpus.dir} must contain .opf.json examples`);
  }

  for (const file of files) {
    const deck = JSON.parse(readFileSync(file, "utf8"));
    const svgs = renderSvgDeck(deck, { trace: true });
    const repeat = renderSvgDeck(deck, { trace: true });
    assert.deepEqual(svgs, repeat, `${path.relative(examplesCorpus.dir, file)} must render deterministically`);
    assert.equal(svgs.length, deck.slides.length, `${file} must emit one SVG per slide`);
    for (const svg of svgs) {
      assert.match(svg, /^<svg /);
      assert.match(svg, /data-opf-path=/);
    }
    corpusCount += 1;
  }
}

console.log(`opf-render smoke passed (${corpusCount} OPF corpus deck(s) rendered).`);

function resolveExamplesCorpus() {
  const hasExplicitDir = Object.prototype.hasOwnProperty.call(process.env, "OPF_EXAMPLES_DIR");
  if (hasExplicitDir) {
    const configured = process.env.OPF_EXAMPLES_DIR?.trim();
    assert.ok(configured, "OPF_EXAMPLES_DIR must not be empty when set");
    const explicit = path.resolve(configured);
    assert.ok(existsSync(explicit), `OPF_EXAMPLES_DIR does not exist: ${explicit}`);
    assert.ok(statSync(explicit).isDirectory(), `OPF_EXAMPLES_DIR must be a directory: ${explicit}`);
    return { dir: explicit, required: true };
  }

  const sibling = path.resolve(root, "../opf/examples");
  return existsSync(sibling) ? { dir: sibling, required: false } : null;
}

function listOpfExamples(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listOpfExamples(absolute));
    if (entry.isFile() && entry.name.endsWith(".opf.json")) files.push(absolute);
  }
  return files.sort();
}
