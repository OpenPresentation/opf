import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validatePresentation } from "../dist/index.js";
import { assertValid, validate } from "../dist/validator.js";

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

describe("basic presentation validation entry points", () => {
  test("well-formed presentation validates via validatePresentation", () => {
    const docResult = validatePresentation(doc);
    assert.equal(docResult.valid, true, JSON.stringify(docResult.errors, null, 2));
  });

  test("well-formed presentation validates via validate(doc, 'presentation')", () => {
    assert.equal(validate(doc, "presentation").valid, true);
  });

  test("well-formed presentation passes assertValid without throwing", () => {
    assert.doesNotThrow(() => assertValid(doc));
  });
});

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

describe("presentation shapes that must validate", () => {
  test("Root Payload", () => {
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
  });

  test("Array Metadata", () => {
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
  });

  test("Slide Design", () => {
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
  });

  test("Inline Language", () => {
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
  });

  test("Inline Audience Purpose Tone", () => {
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
  });

  test("Columns", () => {
    assertPresentationValid({
      name: "Columns",
      slides: [{
        title: "Market Shift",
        left: { text: "Signal" },
        "center+right": { items: ["Demand moved upmarket", "Procurement cycles shortened"] },
      }],
    });
  });

  test("Rows", () => {
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
  });

  test("Chart And Table Objects", () => {
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
  });

  test("Chart Data Source", () => {
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
  });

  test("Grid", () => {
    assertPresentationValid({
      name: "Grid",
      slides: [{
        title: "Operating Model",
        "top:left": { text: "Inputs" },
        "top:center+right": { text: "Processing" },
        "middle+bottom:left+center+right": { items: ["Queue", "Route", "Resolve"] },
      }],
    });
  });

  test("Blocks", () => {
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
  });

  test("Rich Text", () => {
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
  });

  test("Bullets", () => {
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
  });

  test("Media Source String Forms", () => {
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
  });

  test("Code Block", () => {
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
  });

  test("Metric Quote Timeline", () => {
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
  });

  test("Implicit Text List Blocks", () => {
    assertPresentationValid({
      name: "Implicit Text List Blocks",
      slides: [{ text: "A", items: ["B"] }],
    });
  });

  test("Implicit Text Bullets List Blocks", () => {
    assertPresentationValid({
      name: "Implicit Text Bullets List Blocks",
      slides: [{ text: "A", bullets: ["B"], items: ["C"] }],
    });
  });

  test("Implicit Mixed Content Blocks", () => {
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
  });

  test("Singular Audience Text", () => {
    assertPresentationValid({
      name: "Singular Audience Text",
      audience: "Biology Students and Wildlife Enthusiasts",
      slides: [{ title: "Slide Title" }],
    });
  });

});

describe("presentation shapes that must be rejected", () => {
  test("Overlap", () => {
    assertPresentationInvalid({
      name: "Overlap",
      slides: [{ left: { text: "A" }, "left+center": { text: "B" } }],
    }, "overlap");
  });

  test("Bad Span", () => {
    assertPresentationInvalid({
      name: "Bad Span",
      slides: [{ "left+right": { text: "A" } }],
    }, "must NOT have additional properties");
  });

  test("Root Title (root-level \"title\" field is rejected)", () => {
    assertPresentationInvalid({
      title: "Root Title",
      slides: [{ title: "Slide Title" }],
    }, "must NOT have additional properties");
  });

  test("Unknown Slide Field", () => {
    assertPresentationInvalid({
      name: "Unknown Slide Field",
      slides: [{ title: "Slide Title", group: "Old group" }],
    }, "must NOT have additional properties");
  });

  test("Mixed Root And Regions", () => {
    assertPresentationInvalid({
      name: "Mixed Root And Regions",
      slides: [{ items: ["Root"], left: { text: "Region" } }],
    }, "cannot be mixed");
  });

  test("Missing List Items", () => {
    assertPresentationInvalid({
      name: "Missing List Items",
      slides: [{ type: "list" }],
    }, "requires 'items'");
  });

  test("Missing Image Source", () => {
    assertPresentationInvalid({
      name: "Missing Image Source",
      slides: [{ type: "image" }],
    }, "requires 'image'");
  });

  test("Missing Video Source", () => {
    assertPresentationInvalid({
      name: "Missing Video Source",
      slides: [{ type: "video" }],
    }, "requires 'video'");
  });

  test("Missing Chart Payload", () => {
    assertPresentationInvalid({
      name: "Missing Chart Payload",
      slides: [{ type: "chart" }],
    }, "requires 'chart'");
  });

  test("Missing Chart Data", () => {
    assertPresentationInvalid({
      name: "Missing Chart Data",
      slides: [{ chart: { type: "line" } }],
    }, "must have required property 'data'");
  });

  test("Old Chart Data Shape Rejected", () => {
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
  });

  test("Missing Table Payload", () => {
    assertPresentationInvalid({
      name: "Missing Table Payload",
      slides: [{ type: "table" }],
    }, "requires 'table'");
  });

  test("Removed Loose Chart Fields", () => {
    assertPresentationInvalid({
      name: "Removed Loose Chart Fields",
      slides: [{ chartType: "line", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12]] } }],
    }, "must NOT have additional properties");
  });

  test("Removed Loose Table Fields", () => {
    assertPresentationInvalid({
      name: "Removed Loose Table Fields",
      slides: [{ columns: ["Metric", "Value"], rows: [["Revenue", "$12M"]] }],
    }, "must NOT have additional properties");
  });

  test("Removed Table Headers Field", () => {
    assertPresentationInvalid({
      name: "Removed Table Headers Field",
      slides: [{ table: { headers: ["Metric", "Value"], rows: [["Revenue", "$12M"]] } }],
    }, "must NOT have additional properties");
  });

  test("Removed Chart Data Asset Field", () => {
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
  });

  test("Image Array Rejected", () => {
    assertPresentationInvalid({
      name: "Image Array Rejected",
      slides: [{ type: "image", image: ["asset:before", "asset:after"] }],
    }, "must be string");
  });

  test("Video Array Rejected", () => {
    assertPresentationInvalid({
      name: "Video Array Rejected",
      slides: [{ type: "video", video: ["./media/demo.webm", "./media/demo.mp4"] }],
    }, "must be string");
  });

  test("Missing Asset Src", () => {
    assertPresentationInvalid({
      name: "Missing Asset Src",
      slides: [{ type: "image", image: { alt: "Missing source" } }],
    }, "must have required property 'src'");
  });

  test("Removed Asset Type Field", () => {
    assertPresentationInvalid({
      name: "Removed Asset Type Field",
      assets: {
        "product-shot": { type: "image", src: "./assets/product-shot.png" },
      },
      slides: [{ type: "image", image: "asset:product-shot" }],
    }, "must NOT have additional properties");
  });

  test("Missing List Item Text", () => {
    assertPresentationInvalid({
      name: "Missing List Item Text",
      slides: [{ items: [{ description: "Missing text" }] }],
    }, "must have required property 'text'");
  });

  test("Bullet Description Rejected", () => {
    assertPresentationInvalid({
      name: "Bullet Description Rejected",
      slides: [{ bullets: [{ text: "Bullet", description: "Not allowed" }] }],
    }, "must NOT have additional properties");
  });

  test("Removed Runs Field", () => {
    assertPresentationInvalid({
      name: "Removed Runs Field",
      slides: [{ title: "Summary", runs: [{ text: "Rich text" }] }],
    }, "must NOT have additional properties");
  });

  test("Removed Src Field", () => {
    assertPresentationInvalid({
      name: "Removed Src Field",
      slides: [{ title: "Old Image", src: "asset:product-shot" }],
    }, "must NOT have additional properties");
  });

  test("Renamed Design Overrides", () => {
    assertPresentationInvalid({
      name: "Renamed Design Overrides",
      slides: [{ title: "Old Design", designOverrides: { background: "#111827" } }],
    }, "must NOT have additional properties");
  });

  test("Removed Loose Code Language Field", () => {
    assertPresentationInvalid({
      name: "Removed Loose Code Language Field",
      slides: [{ title: "Old Code", code: "print('hello')", language: "python" }],
    }, "must NOT have additional properties");
  });

  test("Missing Code Source", () => {
    assertPresentationInvalid({
      name: "Missing Code Source",
      slides: [{ title: "Code", code: { language: "python", filename: "decision.py" } }],
    }, "must have required property 'source'");
  });

  test("Missing Metric Payload", () => {
    assertPresentationInvalid({
      name: "Missing Metric Payload",
      slides: [{ type: "metric" }],
    }, "requires 'metric'");
  });

  test("Missing Metric Value", () => {
    assertPresentationInvalid({
      name: "Missing Metric Value",
      slides: [{ metric: { label: "Revenue" } }],
    }, "must have required property 'value'");
  });

  test("Removed Loose Metric Fields", () => {
    assertPresentationInvalid({
      name: "Removed Loose Metric Fields",
      slides: [{ title: "Metric", value: "42%", label: "Cycle reduction", trend: "up" }],
    }, "must NOT have additional properties");
  });

  test("Missing Quote Payload", () => {
    assertPresentationInvalid({
      name: "Missing Quote Payload",
      slides: [{ type: "quote" }],
    }, "requires 'quote'");
  });

  test("Missing Quote Text", () => {
    assertPresentationInvalid({
      name: "Missing Quote Text",
      slides: [{ quote: { attribution: "Customer" } }],
    }, "must have required property 'text'");
  });

  test("Removed Loose Quote Fields", () => {
    assertPresentationInvalid({
      name: "Removed Loose Quote Fields",
      slides: [{ quote: "Proof point.", attribution: "Customer", source: "Interview" }],
    }, "must NOT have additional properties");
  });

  test("Missing Timeline Payload", () => {
    assertPresentationInvalid({
      name: "Missing Timeline Payload",
      slides: [{ type: "timeline" }],
    }, "requires 'timeline'");
  });

  test("Missing Timeline Event What", () => {
    assertPresentationInvalid({
      name: "Missing Timeline Event What",
      slides: [{ timeline: [{ when: "Q1", description: "Missing event label" }] }],
    }, "must have required property 'what'");
  });

  test("Removed Loose Events Field", () => {
    assertPresentationInvalid({
      name: "Removed Loose Events Field",
      slides: [{ events: [{ when: "Q1", what: "Pilot" }] }],
    }, "must NOT have additional properties");
  });

  test("Removed Placeholder Type", () => {
    assertPresentationInvalid({
      name: "Removed Placeholder Type",
      slides: [{ type: "placeholder" }],
    }, "must be equal to one of the allowed values");
  });

  test("Removed Prompt Field", () => {
    assertPresentationInvalid({
      name: "Removed Prompt Field",
      slides: [{ title: "Old Prompt", left: { prompt: "Create a list." } }],
    }, "must NOT have additional properties");
  });

  test("Removed Expected Type Field", () => {
    assertPresentationInvalid({
      name: "Removed Expected Type Field",
      slides: [{ title: "Old Expected Type", expectedType: "list" }],
    }, "must NOT have additional properties");
  });

  test("Removed Group Type", () => {
    assertPresentationInvalid({
      name: "Removed Group Type",
      slides: [{ type: "group", blocks: [{ text: "Child" }] }],
    }, "must be equal to one of the allowed values");
  });

  test("Removed Children Field", () => {
    assertPresentationInvalid({
      name: "Removed Children Field",
      slides: [{ title: "Old composition", children: [{ text: "Child" }] }],
    }, "must NOT have additional properties");
  });

  test("Nested Blocks Field", () => {
    assertPresentationValid({
      name: "Nested Blocks Field",
      slides: [{title: "Nested Blocks", blocks: [{blocks: [{text: "Nested child"}]}]}],
    });
  });

  test("Removed Shape Type", () => {
    assertPresentationInvalid({
      name: "Removed Shape Type",
      slides: [{ type: "shape", shape: "triangle" }],
    }, "must be equal to one of the allowed values");
  });

  test("Removed Shape Field", () => {
    assertPresentationInvalid({
      name: "Removed Shape Field",
      slides: [{ shape: "triangle" }],
    }, "must NOT have additional properties");
  });

  test("Explicit Type Mixed Payload Kinds", () => {
    assertPresentationInvalid({
      name: "Explicit Type Mixed Payload Kinds",
      slides: [{ type: "text", text: "A", quote: "B" }],
    }, "incompatible");
  });

  test("Region Mixed Payload Kinds", () => {
    assertPresentationInvalid({
      name: "Region Mixed Payload Kinds",
      slides: [{ left: { text: "A", items: ["B"] } }],
    }, "incompatible");
  });

  test("Incomplete Language", () => {
    assertPresentationInvalid({
      name: "Incomplete Language",
      language: { name: "Custom Language" },
      slides: [{ title: "Slide Title" }],
    }, "must match a schema in anyOf");
  });

  test("Incomplete Audience", () => {
    assertPresentationInvalid({
      name: "Incomplete Audience",
      audience: [{ technicalFluency: "high" }],
      slides: [{ title: "Slide Title" }],
    }, "must match a schema in anyOf");
  });

  test("Incomplete Purpose", () => {
    assertPresentationInvalid({
      name: "Incomplete Purpose",
      purpose: { outcome: "Approve the plan" },
      slides: [{ title: "Slide Title" }],
    }, "must match a schema in anyOf");
  });

  test("Incomplete Tone", () => {
    assertPresentationInvalid({
      name: "Incomplete Tone",
      tone: { voiceCues: ["Be crisp."] },
      slides: [{ title: "Slide Title" }],
    }, "must match a schema in anyOf");
  });

  test("Invalid UK English Tag", () => {
    assertPresentationInvalid({
      name: "Invalid UK English Tag",
      language: "en-UK",
      slides: [{ title: "Slide Title" }],
    }, "Use 'en-GB' for UK English");
  });

  test("Fractional Duration", () => {
    assertPresentationInvalid({
      name: "Fractional Duration",
      duration: 10.5,
      slides: [{ title: "Slide Title" }],
    }, "must be integer");
  });

});

describe("catalog-id warning behavior", () => {
  test("unknown narrative id warns but does not invalidate", () => {
    const unknownNarrativeDoc = {
      name: "Unknown Narrative",
      narrative: "definitely-not-a-narrative",
      slides: [{ title: "Slide Title" }],
    };
    const unknownNarrativeResult = validatePresentation(unknownNarrativeDoc);
    assert.equal(unknownNarrativeResult.valid, true, "unknown catalog ids must warn, never error");
    assert.ok(
      unknownNarrativeResult.warnings.some(
        (warning) => warning.path === "/narrative" && warning.message.includes("unknown narratives catalog id"),
      ),
      JSON.stringify(unknownNarrativeResult.warnings, null, 2),
    );
    assert.doesNotThrow(() => assertValid(unknownNarrativeDoc), "warnings must not throw in assertValid");
  });

  test("known narrative id produces no warnings", () => {
    assert.equal(validatePresentation({
      name: "Known Narrative",
      narrative: "classic-story",
      slides: [{ title: "Slide Title" }],
    }).warnings.length, 0);
  });

  test("object-form narrative with unknown id is a custom inline narrative, not a broken reference", () => {
    // Object form with an unknown id is a fully custom inline narrative, not a broken reference.
    assert.equal(validatePresentation({
      name: "Custom Inline Narrative",
      narrative: { id: "my-own-arc", beats: [{ id: "hook", name: "Hook" }] },
      slides: [{ title: "Slide Title" }],
    }).warnings.length, 0);
  });

  test("unknown design references warn at their respective paths", () => {
    const unknownDesignResult = validatePresentation({
      name: "Unknown Design References",
      design: { theme: "no-such-theme", colorScheme: { id: "no-such-scheme", accent1: "#112233" } },
      slides: [
        { title: "Slide Title", design: { fontScheme: "no-such-fonts" } },
      ],
    });
    assert.equal(unknownDesignResult.valid, true);
    assert.ok(unknownDesignResult.warnings.some((warning) => warning.path === "/design/theme"));
    assert.ok(unknownDesignResult.warnings.some((warning) => warning.path === "/design/colorScheme/id"));
    assert.ok(unknownDesignResult.warnings.some((warning) => warning.path === "/slides/0/design/fontScheme"));
  });

  test("unknown chart type id warns at the chart type path", () => {
    const unknownChartTypeResult = validatePresentation({
      name: "Unknown Chart Type",
      slides: [{
        title: "Slide Title",
        left: { chart: { type: "no-such-chart", data: { columns: ["A", "B"], rows: [["x", 1]] } } },
      }],
    });
    assert.equal(unknownChartTypeResult.valid, true);
    assert.ok(
      unknownChartTypeResult.warnings.some(
        (warning) => warning.path === "/slides/0/left/chart/type" && warning.message.includes("unknown chartTypes catalog id"),
      ),
      JSON.stringify(unknownChartTypeResult.warnings, null, 2),
    );
  });

  test("inline catalog record legitimizes an id the bundled catalogs don't know", () => {
    // Inline catalog records and custom sources legitimize ids the bundled catalogs don't know.
    assert.equal(validatePresentation({
      name: "Inline Catalog Record",
      design: { colorScheme: "my-brand" },
      catalogs: { colorSchemes: { records: [{ id: "my-brand", accent1: "#0F4C81" }] } },
      slides: [{ title: "Slide Title" }],
    }).warnings.length, 0);
  });

  test("custom catalog source legitimizes an id the bundled catalogs don't know", () => {
    assert.equal(validatePresentation({
      name: "Custom Catalog Source",
      narrative: "internal-arc",
      catalogs: { narratives: { source: "https://catalogs.example.com/narratives" } },
      slides: [{ title: "Slide Title" }],
    }).warnings.length, 0);
  });
});
