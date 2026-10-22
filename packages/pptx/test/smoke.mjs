import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { unzipSync, zipSync } from "fflate";
import { legacyVendorOutput } from "../dist/vendor-compat.js";
import PptxGenJS from "../vendor/pptxgenjs/pptxgen.es.js";
import { validate } from "@openpresentation/opf";
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
const importedValidation = validate(imported, {only: ['format']});
assert.equal(importedValidation.valid, true, JSON.stringify(importedValidation.findings));
assert.equal(imported.name, deck.name);
assert.equal(imported.author, deck.author);
assert.equal(imported.description, deck.description);
assert.equal(imported.slides.length, deck.slides.length);
assert.equal(imported.slides[0].title, deck.slides[0].title);
assert.equal(imported.slides[0].subtitle, deck.slides[0].subtitle);
// opf-pptx#212: the list's own size, family and colour stay inherited (OPF_SLIDE_V1 listRuns), so the items return as authored.
assert.deepEqual((imported.slides[0].items ?? imported.slides[0].blocks?.[0]?.items), [
  "Deterministic ZIP entries",
  {text:"Structured OPF validation errors",level:1},
  "No network or LibreOffice runtime dependency"
]);
assert.equal(imported.slides[0].notes, "Smoke notes");
assert.equal((imported.slides[1].chart ?? imported.slides[1].blocks?.[0]?.chart).data.columns[1], "Revenue");
assert.deepEqual((imported.slides[2].table ?? imported.slides[2].blocks?.[0]?.table), deck.slides[2].table, 'Unchanged full-provenance tables retain their authored cells and style absence');
const observed = await fromPptx(await toPptx(deck, {provenance: false}));
const observedTable = observed.slides[2].table ?? observed.slides[2].blocks?.[0]?.table;
assert.deepEqual(observedTable.columns.map(cell => cell.value.map(run => run.text).join('')), ["Field", "Value"]);
assert.ok(observedTable.columns.every(cell => cell.value[0].bold === true && cell.value[0].color === 'light1'), 'Native header formatting and theme references are imported without authored provenance');

const roundTrip = await toPptx(imported);
const roundTripEntries = unzipSync(roundTrip);
assert.ok(roundTripEntries["ppt/slides/slide1.xml"]);
assert.match(text(roundTripEntries["ppt/slides/slide1.xml"]), /Editable Text/);

const complexBytes = await makeComplexPptx();
const complexImport = await fromPptx(complexBytes);
assert.equal(validate(complexImport, {only: ['format']}).valid, true);
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
  catalogs: { custom: { themes: { "tall-canvas": { name: "Tall canvas", dimensions: { widthInches: 4, heightInches: 9 } } } } },
  slides: [{ text: "Custom canvas", design: { theme: "tall-canvas" } }]
}), error => error.code === "mixed-slide-dimensions");
{
  // A layout reference that resolves nowhere: the slide is composed automatically and core's diagnostic says so.
  const unknown = [];
  assert.ok((await toPptx({ slides: [{ layout: "unknown-layout", text: "Needs a definition" }] }, { onDiagnostic: item => unknown.push(item) })).length > 0);
  assert.deepEqual(unknown.filter(item => item.code === "unresolved-reference").map(({ path, reference, fallback }) => ({ path, reference, fallback })), [{ path: "slides.0.layout", reference: "unknown-layout", fallback: "automatic" }]);
}
