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
  slides: [{ section: "Overview", title: "Summary", items: ["First", "Second", "Third"] }],
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
      chartType: "line",
      data: {
        labels: ["Q1", "Q2"],
        datasets: [{ label: "Latency", values: [10, 6] }],
      },
    },
    bottom: { text: "Latency improved quarter over quarter." },
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
  name: "Metric Quote Timeline",
  slides: [
    { title: "Metric", type: "metric", value: "42%", label: "Cycle reduction", trend: "up" },
    { title: "Quote", type: "quote", quote: "This changed our workflow.", attribution: "VP Operations" },
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
  name: "Missing Metric Value",
  slides: [{ type: "metric", label: "Revenue" }],
}, "requires 'value'");

assertPresentationInvalid({
  name: "Missing Quote Text",
  slides: [{ type: "quote", attribution: "Customer" }],
}, "requires 'quote'");

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
