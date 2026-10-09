import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {OPFRenderError, toSvg, resolvePresentation, toPdf, toPng} from "../dist/index.js";
// FA-23: the renderer registers no catalog. Documents that name gallery records (the example corpus, the `text-2x` layout
// below) render through the harness, which registers the gallery snapshot the way a host does.
import * as host from "./catalog-harness.mjs";

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

const first = toSvg(minimalDeck, 1, { trace: true });
const second = toSvg(minimalDeck, 1, { trace: true });
assert.equal(first, second, "toSvg must be byte-stable for the same input");
assert.match(first, /^<svg /);
assert.match(first, /data-opf-path="slides\.0"/);
assert.match(first, /Minimal OPF Deck/);
assert.equal(toSvg(minimalDeck, 1).includes("data-opf-path"), false, "trace output must be optional");
assert.equal(toSvg(minimalDeck).length, 3);

const png = await toPng(first, { scale: 0.5 });
const repeatPng = await toPng(first, { scale: 0.5 });
assert.deepEqual(png, repeatPng, "toPng must be byte-stable for the same input and scale");
assert.equal(Buffer.from(png.subarray(0, 8)).toString("hex"), "89504e470d0a1a0a");

const pdfSlides = toSvg(minimalDeck).slice(0, 2);
const pdf = await toPdf(pdfSlides, { scale: 0.25 });
const repeatPdf = await toPdf(pdfSlides, { scale: 0.25 });
assert.deepEqual(pdf, repeatPdf, "toPdf must be byte-stable for the same input and scale");
assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("utf8"), "%PDF-");
const { PDFDocument } = await import("pdf-lib");
const loadedPdf = await PDFDocument.load(pdf);
assert.equal(loadedPdf.getPageCount(), 2, "toPdf must emit one page per SVG");

const resolved = resolvePresentation(minimalDeck);
assert.equal(resolved.slides.length, 3);
// A slide with no layout composes with no layout record (core resolveSlideContext), whatever its content.
assert.equal(resolved.slides[1].layout, undefined);

// OPF 0.15: a document embeds its own records in catalog groups (`custom` here), keyed by id; they resolve with no host catalog.
const inlineCatalogDeck = {
  name: "Inline Catalog Resolution",
  catalogs: {
    custom: {
      layouts: {
        "custom-title-text": {
          name: "Custom Title Text",
          placeholders: [{ type: "title" }, { type: "text" }]
        }
      }
    }
  },
  slides: [
    {
      layout: "custom-title-text",
      title: "Custom layout",
      text: "Embedded layout records resolve without a host catalog."
    }
  ]
};
assert.match(toSvg(inlineCatalogDeck, 1, { trace: true }), /custom-title-text|Custom layout/);
assert.equal(resolvePresentation(inlineCatalogDeck).slides[0].layout?.name, "Custom Title Text", "the embedded custom layout is the slide's layout");

assert.throws(
  () => toSvg({ slides: "not an array" }, 1),
  (error) => {
    assert.ok(error instanceof OPFRenderError);
    assert.equal(error.code, "invalid-opf");
    assert.ok(Array.isArray(error.findings));
    assert.ok(error.findings.length > 0);
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
    const svgs = host.toSvg(deck, { trace: true });
    const repeat = host.toSvg(deck, { trace: true });
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

// Dynamic composition must preserve content and expose actionable diagnostics.
const dynamic = { slides: [{ title: "Visible title", layout: "text-2x", blocks: [
  { text: "First" }, { text: "Second" }, { text: "Third" }, { text: "Fourth" }
] }] };
const geometry = host.resolvePresentation(dynamic).slides[0].geometry;
assert.equal(geometry.items.length, 5);
assert.match(host.toSvg(dynamic, 1), /Visible title/);
assert.equal(resolvePresentation({ slides: [{ text: "Contrast" }], design: { background: "#000" } }).slides[0].design.colors.text, "#FFFFFF");
assert.deepEqual(resolvePresentation({ slides: [{ text: "Portrait" }], design: { dimensions: { widthInches: 7.5, heightInches: 40 / 3 } } }).slides[0].design.dimensions, { width: 720, height: 1280 });
const overflowMessages = [];
const overflowing = toSvg({ slides: [{ text: "Preserve this sentence. ".repeat(1000) }] }, 1, { onDiagnostic: value => overflowMessages.push(value) });
assert.match(overflowing, /data-opf-overflow="true"/);
assert.equal(overflowMessages.filter(value => value.code === "text-overflow").length, 1);
assert.throws(() => toSvg({ slides: [{ image: "https://example.com/image.png" }] }, 1, { strictAssets: true }));

assert.match(toSvg(minimalDeck, 1), /font-family="[^"]*, sans-serif"/);

const nestedDiagnostics = [];
const nestedSvg = toSvg({ slides: [{ blocks: [{ composition: {minFontSize: 24}, blocks: [{text: 'Nested overflow text. '.repeat(1000)}] }] }] }, 1, { trace: true, onDiagnostic: issue => nestedDiagnostics.push(issue) });
assert.match(nestedSvg, /slides.0.blocks.0.blocks.0.text/);
assert.match(nestedSvg, /font-size="24"/);
assert.ok(nestedDiagnostics.some(issue => issue.path === 'slides.0.blocks.0.blocks.0.text'));
