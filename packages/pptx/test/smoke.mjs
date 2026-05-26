import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { OPFPptxError, runtimePolicy, toPptx } from "../dist/index.js";

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
assert.match(text(entries["docProps/core.xml"]), /1980-01-01T00:00:00Z/);
assert.match(text(entries["ppt/slides/slide1.xml"]), /Editable Text/);

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

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function text(bytes) {
  return new TextDecoder().decode(bytes);
}
