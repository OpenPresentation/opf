import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  audience,
  audiences,
  catalogEntries,
  catalogs,
  languages,
  presentation,
  purposes,
  specFileEntries,
  specFilePaths,
  socialPlatform,
  socialPlatforms,
  validateCatalogRecord,
  validatePresentation,
} from "../dist/index.js";
import { specFileEntries as focusedSpecFileEntries } from "../dist/spec-files.js";
import { tones } from "../dist/catalogs.js";
import { validate, assertValid } from "../dist/validator.js";
import {
  examples,
  galleries,
  exampleCategories,
  getExample,
  getGallery,
  getExamplesByGallery,
  getExamplesByCategory,
} from "../dist/examples.js";
import { docs, getDoc } from "../dist/docs.js";
import { repoReadme } from "../dist/repo-readme.js";

assert.equal(presentation.$id, "https://openpresentation.org/schema/opf/v1");
assert.equal(audience.$id, "https://openpresentation.org/schema/opf-audience/v1");
assert.equal(socialPlatform.$id, "https://openpresentation.org/schema/opf-social-platform/v1");
assert.ok(audiences.length > 0);
assert.ok(tones.length > 0);
assert.ok(socialPlatforms.length > 0);
assert.equal(catalogs.audiences.length, audiences.length);
assert.equal(catalogs.socialPlatforms.length, socialPlatforms.length);
assert.ok(catalogs.chartTypes.length > 0);
const removedUnitedKingdomChartId = ["united", "kindom"].join("-");
assert.ok(catalogs.chartTypes.some((record) => record.id === "united-kingdom"));
assert.equal(catalogs.chartTypes.some((record) => record.id === removedUnitedKingdomChartId), false);
assert.equal(catalogEntries.find((entry) => entry.kind === "chartTypes")?.schemaName, "chartType");
assert.ok(catalogEntries.find((entry) => entry.kind === "chartTypes")?.files.includes("united-kingdom.json"));
assert.equal(catalogEntries.find((entry) => entry.kind === "chartTypes")?.files.includes(`${removedUnitedKingdomChartId}.json`), false);
assert.equal(catalogEntries.find((entry) => entry.kind === "socialPlatforms")?.schemaName, "socialPlatform");
assert.ok(purposes.length > 0);
assert.ok(languages.some((record) => record.id === "english-us" && record.bcp47 === "en-US"));
assert.ok(languages.some((record) => record.id === "english-gb" && record.bcp47 === "en-GB"));
assert.equal(focusedSpecFileEntries.length, specFileEntries.length);
assert.ok(specFilePaths.includes("openapi.yaml"));
assert.ok(specFilePaths.includes("schemas/opf.schema.json"));
assert.ok(specFilePaths.includes("catalogs/layouts/index.json"));
assert.equal(specFileEntries.find((entry) => entry.path === "openapi.yaml")?.kind, "openapi");
assert.equal(specFileEntries.find((entry) => entry.path === "openapi.yaml")?.mediaType, "application/yaml");
assert.equal(
  specFileEntries.find((entry) => entry.path === "openapi.yaml")?.packagePath,
  "@openpresentation/opf/spec/openapi.yaml",
);
assert.ok(existsSync(new URL("../dist/spec/openapi.yaml", import.meta.url)));
assert.ok(existsSync(new URL("../dist/spec/schemas/opf.schema.json", import.meta.url)));
assert.ok(existsSync(new URL("../dist/spec/catalogs/layouts/index.json", import.meta.url)));
assert.match(readFileSync(new URL("../dist/spec/openapi.yaml", import.meta.url), "utf8"), /^openapi:/m);

const doc = {
  name: "Smoke Test",
  organization: { id: "acme", name: "Acme Corp" },
  speaker: { id: "alice", name: "Alice Chen" },
  author: "Test Author",
  audience: ["executives"],
  language: "en-US",
  takeaway: "Remember this result",
  duration: 10,
  slides: [{ title: "Smoke Test", items: ["First", "Second"] }],
};

const docResult = validatePresentation(doc);
assert.equal(docResult.valid, true, JSON.stringify(docResult.errors, null, 2));
assert.equal(validate(doc, "presentation").valid, true);
assert.doesNotThrow(() => assertValid(doc));

function assertPresentationValid(value) {
  const result = validatePresentation(value);
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
}

function assertPresentationInvalid(value, messageIncludes) {
  const result = validatePresentation(value);
  assert.equal(result.valid, false, "expected presentation to be invalid");
  if (messageIncludes) {
    assert.ok(
      result.errors.some((error) => error.message.includes(messageIncludes)),
      JSON.stringify(result.errors, null, 2),
    );
  }
}

assertPresentationValid({
  name: "Root Payload",
  slides: [{
    section: "Overview",
    title: "Summary",
    items: [
      "First",
      ["Second with ", { text: "emphasis", bold: true }],
      {
        text: "Third",
        description: "Optional supporting detail.",
        level: 1,
      },
    ],
  }],
});

assertPresentationValid({
  name: "Array Metadata",
  organization: [
    { id: "acme", name: "Acme Corp", role: "primary" },
    { id: "partner", name: "Partner Co", role: "partner" },
  ],
  speaker: [
    { id: "alice", name: "Alice Chen", organizationId: "acme" },
    { id: "bob", name: "Bob Lee", organizationId: "partner" },
  ],
  author: ["Alice Chen", "Bob Lee"],
  takeaway: ["First point", "Second point"],
  slides: [{ title: "Metadata", text: "Array forms are supported." }],
});

assertPresentationValid({
  name: "Slide Design",
  slides: [{
    id: "s1",
    type: "text",
    title: "Designed Slide",
    design: {
      background: "#111827",
    },
    text: "Slide-level design overrides deck design.",
  }],
});

assertPresentationValid({
  name: "Inline Language",
  language: {
    bcp47: "ar-SA",
    name: "Arabic (Saudi Arabia)",
    direction: "rtl",
    script: "Arab",
  },
  slides: [{ title: "Language Metadata", text: "Hello" }],
});

assertPresentationValid({
  name: "Inline Audience Purpose Tone",
  audience: [
    "board",
    {
      id: "executives",
      attentionBudgetMinutes: 20,
    },
  ],
  purpose: {
    id: "decide",
    outcome: "Approve the Q4 hiring plan",
  },
  tone: {
    id: "formal",
    voiceCues: ["Use precise, concise language."],
  },
  slides: [{ title: "Decision", text: "Approve the plan." }],
});

assertPresentationValid({
  name: "Columns",
  slides: [{
    title: "Market Shift",
    left: { text: "Signal" },
    "center+right": { items: ["Demand moved upmarket", "Procurement cycles shortened"] },
  }],
});

assertPresentationValid({
  name: "Rows",
  slides: [{
    title: "Performance",
    "top+middle": {
      type: "chart",
      chart: {
        type: "line",
        data: {
          columns: ["Quarter", "Latency"],
          rows: [
            ["Q1", 10],
            ["Q2", 6],
          ],
        },
      },
    },
    bottom: { text: "Latency improved quarter over quarter." },
  }],
});

assertPresentationValid({
  name: "Chart And Table Objects",
  slides: [
    {
      title: "Revenue Trend",
      chart: {
        type: "line",
        data: {
          columns: ["Quarter", "Revenue", "Costs"],
          rows: [
            ["Q1", 12, 8],
            ["Q2", 18, 11],
          ],
        },
      },
    },
    {
      title: "Pipeline",
      table: {
        columns: ["Stage", "Count", "Value"],
        rows: [
          ["Qualified", 42, "$1.2M"],
          ["Proposal", 18, "$840K"],
        ],
      },
    },
  ],
});

assertPresentationValid({
  name: "Chart Data Source",
  assets: {
    "revenue-csv": { src: "./data/revenue.csv", format: "csv" },
  },
  slides: [{
    title: "Revenue From Asset",
    chart: {
      type: "column",
      data: {
        src: "asset:revenue-csv",
        columns: ["Quarter", "Revenue"],
      },
    },
  }],
});

assertPresentationValid({
  name: "Grid",
  slides: [{
    title: "Operating Model",
    "top:left": { text: "Inputs" },
    "top:center+right": { text: "Processing" },
    "middle+bottom:left+center+right": { items: ["Queue", "Route", "Resolve"] },
  }],
});

assertPresentationValid({
  name: "Blocks",
  slides: [{
    title: "Customer Feedback",
    blocks: [
      {
        table: {
          columns: ["Theme", "Mentions"],
          rows: [["Speed", 42]],
        },
      },
      {
        quote: {
          text: "The new workflow cut review time in half.",
          attribution: "Operations Lead",
        },
      },
    ],
  }],
});

assertPresentationValid({
  name: "Rich Text",
  slides: [{
    title: "Summary",
    text: [
      "Revenue grew ",
      { text: "42%", bold: true, color: "#16A34A" },
      " year over year.",
    ],
  }],
});

assertPresentationValid({
  name: "Bullets",
  slides: [{
    title: "Bullet Shape",
    bullets: [
      "Plain bullet",
      ["Rich ", { text: "bullet", bold: true }],
      { text: "Nested bullet", level: 1 },
    ],
  }],
});

assertPresentationValid({
  name: "Media Source String Forms",
  assets: {
    "product-shot": "./assets/product-shot.png",
    "demo-video": {
      src: "./media/demo.mp4",
      mediaType: "video/mp4",
      title: "Product demo",
    },
  },
  design: {
    logo: { src: "asset:product-shot", alt: "Product screenshot" },
    watermark: { src: "asset:product-shot", opacity: 0.08 },
    slideImage: { src: "asset:product-shot", position: "background" },
  },
  slides: [
    { title: "Image Asset Ref", type: "image", image: "asset:product-shot" },
    { title: "Image HTTPS URL", image: "https://www.someurl.com/my-image.png" },
    { title: "Image Relative Path", image: "./assets/product-shot.png" },
    { title: "Image Local Absolute Path", image: "/Users/example/assets/product-shot.png" },
    { title: "Image Data URI", image: "data:image/png;base64,iVBORw0KGgo=" },
    { title: "Image Object", image: { src: "asset:product-shot", alt: "Product screenshot" } },
    { title: "Video Asset Ref", type: "video", video: "asset:demo-video" },
    { title: "Video HTTPS URL", video: "https://cdn.example.com/media/demo.mp4" },
    { title: "Video Relative Path", video: "./media/demo.mp4" },
    { title: "Video Local Absolute Path", video: "/Users/example/media/demo.mp4" },
    { title: "Video Data URI", video: "data:video/mp4;base64,AAAA" },
    { title: "Video Object", video: { src: "asset:demo-video", title: "Demo clip" } },
  ],
});

assertPresentationValid({
  name: "Code Block",
  slides: [
    {
      title: "Decision Rule",
      code: {
        source: "if risk > threshold:\n    escalate(owner)\nelse:\n    approve(change)",
        language: "python",
        filename: "decision.py",
      },
    },
    {
      title: "String Shorthand",
      code: "console.log('hello');",
    },
  ],
});

assertPresentationValid({
  name: "Metric Quote Timeline",
  slides: [
    {
      title: "Metric",
      type: "metric",
      metric: {
        value: "42%",
        label: "Cycle reduction",
        description: "Median reduction across customer review workflows.",
        trend: "up",
      },
    },
    { title: "Metric Shorthand", metric: 98.7 },
    {
      title: "Quote",
      type: "quote",
      quote: {
        text: "This changed our workflow.",
        attribution: "VP Operations",
        source: "Customer interview",
      },
    },
    { title: "Quote Shorthand", quote: "Simple proof point." },
    {
      title: "Timeline",
      type: "timeline",
      timeline: [
        { when: "Q1", what: "Pilot" },
        { when: "Q2", what: "Rollout" },
      ],
    },
    {
      title: "Timeline Object",
      timeline: {
        name: "Regional Rollout",
        description: "Major milestones for the rollout.",
        events: [
          { when: "Q1", what: "Pilot", description: "Launch with one operations team." },
          { when: "Q2", what: "Rollout", description: "Expand to all regions." },
        ],
      },
    },
  ],
});

assertPresentationInvalid({
  name: "Overlap",
  slides: [{ left: { text: "A" }, "left+center": { text: "B" } }],
}, "overlap");

assertPresentationInvalid({
  name: "Bad Span",
  slides: [{ "left+right": { text: "A" } }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  title: "Root Title",
  slides: [{ title: "Slide Title" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Unknown Slide Field",
  slides: [{ title: "Slide Title", group: "Old group" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Mixed Root And Regions",
  slides: [{ items: ["Root"], left: { text: "Region" } }],
}, "cannot be mixed");

assertPresentationInvalid({
  name: "Missing List Items",
  slides: [{ type: "list" }],
}, "requires 'items'");

assertPresentationInvalid({
  name: "Missing Image Source",
  slides: [{ type: "image" }],
}, "requires 'image'");

assertPresentationInvalid({
  name: "Missing Video Source",
  slides: [{ type: "video" }],
}, "requires 'video'");

assertPresentationInvalid({
  name: "Missing Chart Payload",
  slides: [{ type: "chart" }],
}, "requires 'chart'");

assertPresentationInvalid({
  name: "Missing Chart Data",
  slides: [{ chart: { type: "line" } }],
}, "must have required property 'data'");

assertPresentationInvalid({
  name: "Old Chart Data Shape Rejected",
  slides: [{
    chart: {
      type: "line",
      data: {
        labels: ["Q1"],
        datasets: [{ label: "Revenue", values: [12] }],
      },
    },
  }],
}, "must have required property 'columns'");

assertPresentationInvalid({
  name: "Missing Table Payload",
  slides: [{ type: "table" }],
}, "requires 'table'");

assertPresentationInvalid({
  name: "Removed Loose Chart Fields",
  slides: [{ chartType: "line", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] } }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Loose Table Fields",
  slides: [{ columns: ["Metric", "Value"], rows: [["Revenue", "$12M"]] }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Table Headers Field",
  slides: [{ table: { headers: ["Metric", "Value"], rows: [["Revenue", "$12M"]] } }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Chart Data Asset Field",
  slides: [{
    chart: {
      type: "column",
      data: {
        asset: "revenue-csv",
        columns: ["Quarter", "Revenue"],
      },
    },
  }],
}, "must have required property 'src'");

assertPresentationInvalid({
  name: "Image Array Rejected",
  slides: [{ type: "image", image: ["asset:before", "asset:after"] }],
}, "must be string");

assertPresentationInvalid({
  name: "Video Array Rejected",
  slides: [{ type: "video", video: ["./media/demo.webm", "./media/demo.mp4"] }],
}, "must be string");

assertPresentationInvalid({
  name: "Missing Asset Src",
  slides: [{ type: "image", image: { alt: "Missing source" } }],
}, "must have required property 'src'");

assertPresentationInvalid({
  name: "Removed Asset Type Field",
  assets: {
    "product-shot": { type: "image", src: "./assets/product-shot.png" },
  },
  slides: [{ type: "image", image: "asset:product-shot" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Missing List Item Text",
  slides: [{ items: [{ description: "Missing text" }] }],
}, "must have required property 'text'");

assertPresentationInvalid({
  name: "Bullet Description Rejected",
  slides: [{ bullets: [{ text: "Bullet", description: "Not allowed" }] }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Runs Field",
  slides: [{ title: "Summary", runs: [{ text: "Rich text" }] }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Src Field",
  slides: [{ title: "Old Image", src: "asset:product-shot" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Renamed Design Overrides",
  slides: [{ title: "Old Design", designOverrides: { background: "#111827" } }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Loose Code Language Field",
  slides: [{ title: "Old Code", code: "print('hello')", language: "python" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Missing Code Source",
  slides: [{ title: "Code", code: { language: "python", filename: "decision.py" } }],
}, "must have required property 'source'");

assertPresentationInvalid({
  name: "Missing Metric Payload",
  slides: [{ type: "metric" }],
}, "requires 'metric'");

assertPresentationInvalid({
  name: "Missing Metric Value",
  slides: [{ metric: { label: "Revenue" } }],
}, "must have required property 'value'");

assertPresentationInvalid({
  name: "Removed Loose Metric Fields",
  slides: [{ title: "Metric", value: "42%", label: "Cycle reduction", trend: "up" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Missing Quote Payload",
  slides: [{ type: "quote" }],
}, "requires 'quote'");

assertPresentationInvalid({
  name: "Missing Quote Text",
  slides: [{ quote: { attribution: "Customer" } }],
}, "must have required property 'text'");

assertPresentationInvalid({
  name: "Removed Loose Quote Fields",
  slides: [{ quote: "Proof point.", attribution: "Customer", source: "Interview" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Missing Timeline Payload",
  slides: [{ type: "timeline" }],
}, "requires 'timeline'");

assertPresentationInvalid({
  name: "Missing Timeline Event What",
  slides: [{ timeline: [{ when: "Q1", description: "Missing event label" }] }],
}, "must have required property 'what'");

assertPresentationInvalid({
  name: "Removed Loose Events Field",
  slides: [{ events: [{ when: "Q1", what: "Pilot" }] }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Placeholder Type",
  slides: [{ type: "placeholder" }],
}, "must be equal to one of the allowed values");

assertPresentationInvalid({
  name: "Removed Prompt Field",
  slides: [{ title: "Old Prompt", left: { prompt: "Create a list." } }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Expected Type Field",
  slides: [{ title: "Old Expected Type", expectedType: "list" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Group Type",
  slides: [{ type: "group", blocks: [{ text: "Child" }] }],
}, "must be equal to one of the allowed values");

assertPresentationInvalid({
  name: "Removed Children Field",
  slides: [{ title: "Old composition", children: [{ text: "Child" }] }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Nested Blocks Field",
  slides: [{
    title: "Nested Blocks",
    blocks: [
      {
        blocks: [{ text: "Nested child" }],
      },
    ],
  }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Removed Shape Type",
  slides: [{ type: "shape", shape: "triangle" }],
}, "must be equal to one of the allowed values");

assertPresentationInvalid({
  name: "Removed Shape Field",
  slides: [{ shape: "triangle" }],
}, "must NOT have additional properties");

assertPresentationValid({
  name: "Implicit Text List Blocks",
  slides: [{ text: "A", items: ["B"] }],
});

assertPresentationValid({
  name: "Implicit Text Bullets List Blocks",
  slides: [{ text: "A", bullets: ["B"], items: ["C"] }],
});

assertPresentationValid({
  name: "Implicit Mixed Content Blocks",
  slides: [{
    text: "A",
    items: ["B"],
    chart: {
      type: "line",
      data: {
        columns: ["Quarter", "Revenue"],
        rows: [["Q1", 12]],
      },
    },
    quote: "C",
  }],
});

assertPresentationInvalid({
  name: "Explicit Type Mixed Payload Kinds",
  slides: [{ type: "text", text: "A", quote: "B" }],
}, "incompatible");

assertPresentationInvalid({
  name: "Region Mixed Payload Kinds",
  slides: [{ left: { text: "A", items: ["B"] } }],
}, "incompatible");

assertPresentationInvalid({
  name: "Incomplete Language",
  language: { name: "Custom Language" },
  slides: [{ title: "Slide Title" }],
}, "must match a schema in anyOf");

assertPresentationInvalid({
  name: "Incomplete Audience",
  audience: [{ technicalFluency: "high" }],
  slides: [{ title: "Slide Title" }],
}, "must match a schema in anyOf");

assertPresentationValid({
  name: "Singular Audience Text",
  audience: "Biology Students and Wildlife Enthusiasts",
  slides: [{ title: "Slide Title" }],
});

assertPresentationInvalid({
  name: "Incomplete Purpose",
  purpose: { outcome: "Approve the plan" },
  slides: [{ title: "Slide Title" }],
}, "must match a schema in anyOf");

assertPresentationInvalid({
  name: "Incomplete Tone",
  tone: { voiceCues: ["Be crisp."] },
  slides: [{ title: "Slide Title" }],
}, "must match a schema in anyOf");

assertPresentationInvalid({
  name: "Invalid UK English Tag",
  language: "en-UK",
  slides: [{ title: "Slide Title" }],
}, "Use 'en-GB' for UK English");

assertPresentationInvalid({
  name: "Fractional Duration",
  duration: 10.5,
  slides: [{ title: "Slide Title" }],
}, "must be integer");

for (const entry of catalogEntries) {
  assert.ok(entry.records.length > 0, `${entry.kind} should have records`);
  const result = validateCatalogRecord(entry.kind, entry.records[0]);
  assert.equal(result.valid, true, `${entry.kind}: ${JSON.stringify(result.errors, null, 2)}`);
}

const invalidLanguageResult = validateCatalogRecord("languages", {
  $schema: "https://openpresentation.org/schema/opf-language/v1",
  id: "english-uk",
  name: "English (UK)",
  bcp47: "en-UK",
});
assert.equal(invalidLanguageResult.valid, false, "expected en-UK language catalog record to be invalid");
assert.ok(
  invalidLanguageResult.errors.some((error) => error.message.includes("Use 'en-GB' for UK English")),
  JSON.stringify(invalidLanguageResult.errors, null, 2),
);

const require = createRequire(import.meta.url);
const rawPresentation = require("../dist/spec/schemas/opf.schema.json");
assert.equal(rawPresentation.$id, presentation.$id);

assert.ok(examples.length > 0, "expected at least one example deck");
assert.ok(galleries.length > 0, "expected at least one gallery");
assert.ok(exampleCategories.includes("gallery"));
for (const example of examples) {
  assert.equal(typeof example.slug, "string");
  assert.ok(example.file.startsWith("examples/"));
  assert.equal(typeof example.category, "string");
  assert.ok(example.deck && typeof example.deck === "object");
  const result = validatePresentation(example.deck);
  assert.equal(
    result.valid,
    true,
    `Example ${example.slug} failed validation: ${JSON.stringify(result.errors, null, 2)}`,
  );
}
for (const gallery of galleries) {
  assert.ok(gallery.slug.length > 0);
  assert.ok(gallery.dir.startsWith("examples/gallery/"));
  assert.ok(gallery.examples.length > 0, `gallery ${gallery.slug} is empty`);
}
const firstGallery = galleries[0];
const firstGalleryExamples = getExamplesByGallery(firstGallery.slug);
assert.equal(firstGalleryExamples.length, firstGallery.examples.length);
assert.ok(getGallery(firstGallery.slug));
assert.equal(getGallery("definitely-does-not-exist"), undefined);
const firstExample = examples[0];
assert.equal(getExample(firstExample.slug)?.slug, firstExample.slug);
assert.ok(getExamplesByCategory("gallery").length > 0);

assert.ok(docs.length > 0, "expected at least one doc");
for (const doc of docs) {
  assert.equal(typeof doc.slug, "string");
  assert.ok(doc.file.startsWith("docs/"));
  assert.ok(doc.title.length > 0, `doc ${doc.slug} missing title`);
  assert.ok(doc.markdown.length > 0, `doc ${doc.slug} missing markdown`);
}
const docSlugs = docs.map((doc) => doc.slug);
assert.ok(docSlugs.includes("schema-reference"));
assert.equal(getDoc("schema-reference")?.slug, "schema-reference");
assert.equal(getDoc("missing-doc"), undefined);
assert.ok(!docSlugs.includes("BACKLOG"));

assert.equal(typeof repoReadme, "string");
assert.ok(repoReadme.length > 100, "expected repo README to ship");
assert.match(repoReadme, /open presentation format/i);
