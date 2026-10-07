import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { unzipSync, zipSync } from "fflate";
import { legacyVendorOutput } from "../dist/vendor-compat.js";
import PptxGenJS from "../vendor/pptxgenjs/pptxgen.es.js";
import { validatePresentation } from "@openpresentation/opf";
import { fromPptx, OPFPptxError, runtimePolicy, toPptx } from "../dist/index.js";

const deck = {
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "OPF PPTX Smoke",
  author: "OpenPresentation",
  description: "Smoke fixture for deterministic OPF to PPTX export.",
  design: {
    colorScheme: "cool-horizon",
    fontScheme: "aptos",
    background: "light1"
  },
  slides: [
    {
      title: "Editable Text",
      subtitle: "Title and list payloads become PowerPoint text boxes.",
      items: [
        "Deterministic ZIP entries",
        { text: "Structured OPF validation errors", level: 1 },
        "No network or LibreOffice runtime dependency"
      ],
      notes: "Smoke notes"
    },
    {
      title: "Inline Data",
      chart: {
        type: "column",
        data: {
          columns: ["Quarter", "Revenue", "Cost"],
          rows: [
            ["Q1", 12, 7],
            ["Q2", 18, 9],
            ["Q3", 22, 11]
          ]
        }
      }
    },
    {
      title: "Table",
      table: {
        columns: ["Field", "Value"],
        rows: [
          ["Format", "OPF"],
          ["Export", "PPTX"]
        ]
      }
    }
  ]
};

const first = await toPptx(deck);
const second = await toPptx(JSON.stringify(deck));

assert.ok(first instanceof Uint8Array);
assert.ok(first.length > 0);
assert.equal(hash(first), hash(second), "toPptx must be byte-stable for the same OPF input");

const entries = unzipSync(first);
assert.ok(entries["[Content_Types].xml"]);
assert.ok(entries["ppt/presentation.xml"]);
assert.ok(entries["ppt/slides/slide1.xml"]);
assert.ok(entries["ppt/slides/slide2.xml"]);
assert.ok(entries["ppt/charts/chart1.xml"]);
for (const [, part] of text(entries['[Content_Types].xml']).matchAll(/<Override\b[^>]*\bPartName="([^"]+)"/g)) {
  assert.ok(entries[part.slice(1)], `Content type refers to a missing package part: ${part}`);
}
assert.match(text(entries["docProps/core.xml"]), /1980-01-01T00:00:00Z/);
assert.match(text(entries["ppt/slides/slide1.xml"]), /Editable Text/);

const imported = await fromPptx(first);
const importedValidation = validatePresentation(imported);
assert.equal(importedValidation.valid, true, JSON.stringify(importedValidation.errors));
assert.equal(imported.name, deck.name);
assert.equal(imported.author, deck.author);
assert.equal(imported.description, deck.description);
assert.equal(imported.slides.length, deck.slides.length);
assert.equal(imported.slides[0].title, deck.slides[0].title);
assert.equal(imported.slides[0].subtitle, deck.slides[0].subtitle);
assert.deepEqual((imported.slides[0].items ?? imported.slides[0].blocks?.[0]?.items), [
  [{text:"Deterministic ZIP entries",fontSize:18.75,fontFamily:"Aptos",color:"#000000"}],
  {text:[{text:"Structured OPF validation errors",fontSize:18.75,fontFamily:"Aptos",color:"#000000"}],level:1},
  [{text:"No network or LibreOffice runtime dependency",fontSize:18.75,fontFamily:"Aptos",color:"#000000"}]
]);
assert.equal(imported.slides[0].notes, "Smoke notes");
assert.equal((imported.slides[1].chart ?? imported.slides[1].blocks?.[0]?.chart).data.columns[1], "Revenue");
assert.deepEqual((imported.slides[2].table ?? imported.slides[2].blocks?.[0]?.table).columns.map(cell => cell.value.map(run => run.text).join('')), ["Field", "Value"]);
assert.ok((imported.slides[2].table ?? imported.slides[2].blocks?.[0]?.table).columns.every(cell => cell.value[0].bold === true && cell.value[0].color === '#FFFFFF'), 'Native header formatting is imported');

const roundTrip = await toPptx(imported);
const roundTripEntries = unzipSync(roundTrip);
assert.ok(roundTripEntries["ppt/slides/slide1.xml"]);
assert.match(text(roundTripEntries["ppt/slides/slide1.xml"]), /Editable Text/);

const complexBytes = await makeComplexPptx();
const complexImport = await fromPptx(complexBytes);
assert.equal(validatePresentation(complexImport).valid, true);
assert.equal(complexImport.slides[0].title, "Complex PPTX");
assert.ok(
  complexImport.slides[0].blocks.some((block) => /PowerPoint shape:/.test(block.text)),
  "Non-text PowerPoint shapes should fall back to editable OPF blocks"
);

assert.equal(runtimePolicy.requiredNetworkCalls, false);
assert.equal(runtimePolicy.requiredLibreOfficeDependency, false);

await assert.rejects(
  () => toPptx({ slides: [] }),
  (error) => error instanceof OPFPptxError && error.code === "invalid-opf"
);

await assert.rejects(
  () => toPptx({
    slides: [
      {
        title: "Remote asset",
        image: "https://example.com/image.png"
      }
    ]
  }, { strictAssets: true }),
  (error) => error instanceof OPFPptxError && error.code === "unsupported-asset"
);

await assert.rejects(
  () => fromPptx(new TextEncoder().encode("not a pptx")),
  (error) => error instanceof OPFPptxError && error.code === "invalid-pptx"
);

async function makeComplexPptx() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const slide = pptx.addSlide();
  slide.addText("Complex PPTX", { x: 0.5, y: 0.35, w: 7, h: 0.6, fontSize: 28, bold: true });
  slide.addShape("rect", {
    x: 1,
    y: 2,
    w: 3,
    h: 1.2,
    fill: { color: "FFAA00" },
    line: { color: "C2410C" }
  });
  // pptxgenjs-plus writes an empty p:txBody into a shape without text; a non-text shape has none (vendor-compat.js).
  return zipSync(legacyVendorOutput(unzipSync(await pptx.write({ outputType: "uint8array" }))));
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function text(bytes) {
  return new TextDecoder().decode(bytes);
}

await assert.rejects(() => toPptx({ slides: [{ text: "Crowded. ".repeat(4000), composition: { overflow: "error" } }] }));
// A slide's own design cannot set dimensions (FA-07); a slide-level theme with another size still stops the export.
await assert.rejects(() => toPptx({ slides: [{ text: "Custom canvas", design: { dimensions: { widthInches: 4, heightInches: 9 } } }] }), error => error.code === "invalid-opf");
await assert.rejects(() => toPptx({
  catalogs: { themes: { records: [{ $schema: "https://openpresentation.org/schema/opf-theme/v1", id: "tall-canvas", name: "Tall canvas", dimensions: { widthInches: 4, heightInches: 9 } }] } },
  slides: [{ text: "Custom canvas", design: { theme: "tall-canvas" } }]
}), error => error.code === "mixed-slide-dimensions");
await assert.rejects(() => toPptx({ slides: [{ layout: "unknown-layout", text: "Needs a definition" }] }), error => error.code === "catalog-resolution-failed");
