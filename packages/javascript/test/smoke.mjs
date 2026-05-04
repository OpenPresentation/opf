import assert from "node:assert/strict";
import { createRequire } from "node:module";

import {
  audience,
  audiences,
  catalogEntries,
  catalogs,
  languages,
  presentation,
  purposes,
  validateCatalogRecord,
  validatePresentation,
} from "../dist/index.js";
import { tones } from "../dist/catalogs.js";
import { validate, assertValid } from "../dist/validator.js";

assert.equal(presentation.$id, "https://pptx.dev/schema/opf/v1");
assert.equal(audience.$id, "https://pptx.dev/schema/opf-audience/v1");
assert.ok(audiences.length > 0);
assert.ok(tones.length > 0);
assert.equal(catalogs.audiences.length, audiences.length);
assert.ok(purposes.length > 0);
assert.ok(languages.some((record) => record.id === "english-us" && record.bcp47 === "en-US"));
assert.ok(languages.some((record) => record.id === "english-gb" && record.bcp47 === "en-GB"));

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
        headers: ["Stage", "Count", "Value"],
        rows: [
          ["Qualified", 42, "$1.2M"],
          ["Proposal", 18, "$840K"],
        ],
      },
    },
  ],
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
  slides: [
    { title: "Image Asset Ref", type: "image", image: "asset:product-shot" },
    { title: "Image HTTPS URL", image: "https://www.someurl.com/my-image.png" },
    { title: "Image Relative Path", image: "./assets/product-shot.png" },
    { title: "Image Local Absolute Path", image: "/Users/example/assets/product-shot.png" },
    { title: "Image Data URI", image: "data:image/png;base64,iVBORw0KGgo=" },
    { title: "Video Asset Ref", type: "video", video: "asset:demo-video" },
    { title: "Video HTTPS URL", video: "https://cdn.example.com/media/demo.mp4" },
    { title: "Video Relative Path", video: "./media/demo.mp4" },
    { title: "Video Local Absolute Path", video: "/Users/example/media/demo.mp4" },
    { title: "Video Data URI", video: "data:video/mp4;base64,AAAA" },
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
      events: [
        { date: "Q1", title: "Pilot" },
        { date: "Q2", title: "Rollout" },
      ],
    },
  ],
});

assertPresentationValid({
  name: "Prompt Without Placeholder Type",
  slides: [{
    title: "Generate Follow-Up",
    "left+center+right": {
      prompt: "Create three concise next steps.",
      expectedType: "list",
    },
  }],
});

assertPresentationValid({
  name: "Generated Code Prompt",
  slides: [{
    title: "Generate Parser",
    left: {
      prompt: "Create a small TypeScript parser example.",
      expectedType: "code",
    },
  }],
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
  slides: [{ headers: ["Metric", "Value"], rows: [["Revenue", "$12M"]] }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Image Array Rejected",
  slides: [{ type: "image", image: ["asset:before", "asset:after"] }],
}, "must be string");

assertPresentationInvalid({
  name: "Video Array Rejected",
  slides: [{ type: "video", video: ["./media/demo.webm", "./media/demo.mp4"] }],
}, "must be string");

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
  name: "Missing Timeline Events",
  slides: [{ type: "timeline" }],
}, "requires 'events'");

assertPresentationInvalid({
  name: "Removed Placeholder Type",
  slides: [{ type: "placeholder", prompt: "Create a list.", expectedType: "list" }],
}, "must be equal to one of the allowed values");

assertPresentationInvalid({
  name: "Removed Group Type",
  slides: [{ type: "group", children: [{ text: "Child" }] }],
}, "must be equal to one of the allowed values");

assertPresentationInvalid({
  name: "Removed Shape Type",
  slides: [{ type: "shape", shape: "triangle" }],
}, "must be equal to one of the allowed values");

assertPresentationInvalid({
  name: "Removed Shape Field",
  slides: [{ shape: "triangle" }],
}, "must NOT have additional properties");

assertPresentationInvalid({
  name: "Mixed Payload Kinds",
  slides: [{ text: "A", items: ["B"] }],
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

assertPresentationInvalid({
  name: "Old Singular Audience",
  audience: "executives",
  slides: [{ title: "Slide Title" }],
}, "must be array");

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
  $schema: "https://pptx.dev/schema/opf-language/v1",
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
const rawPresentation = require("../dist/spec/presentation.schema.json");
assert.equal(rawPresentation.$id, presentation.$id);
