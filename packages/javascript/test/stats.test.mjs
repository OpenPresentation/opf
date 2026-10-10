import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { stats as statsOf } from "../dist/index.js";
import { defaultCatalog } from "../dist/catalog.js";
import { examples } from "../dist/examples.js";

// The decks name gallery records; the host registers the default catalog.
const stats = (input, options = {}) => statsOf(input, { catalogs: [defaultCatalog], ...options });

const PNG = "data:image/png;base64,iVBORw0KGgo=";

const deck = () => ({
  name: "Facts",
  description: "A deck",
  language: "en-US",
  duration: 10,
  author: ["Ada"],
  tags: ["a", "b"],
  takeaway: ["One", "Two"],
  audience: ["executive", { id: "custom-audience", name: "Custom" }],
  purpose: "decide",
  tone: { id: "formal" },
  narrative: { id: "story", name: "Story", beats: [{ id: "b1", name: "Open" }, { id: "b2", name: "Close" }] },
  organization: [{ id: "acme", name: "Acme", role: "primary", logo: { full: { onLight: "asset:dark-logo", onDark: "https://cdn.example.com/logo.png" }, icon: "./logo.svg" } }],
  speaker: { id: "ada", name: "Ada L", title: "CEO", organizationId: "acme", photo: PNG },
  design: {
    theme: "minimal",
    colorScheme: "cool-horizon",
    fontScheme: "roboto",
    dimensions: { widthInches: 10, heightInches: 5 },
    watermark: "asset:wm",
    background: { type: "image", src: "./bg.jpg" },
    header: { left: { image: "var:organization.logo.icon" }, right: { text: "Confidential" } },
    footer: { center: { text: "{{slide.number}}", date: true } },
  },
  variables: {
    brand: "#112233",
    who: { type: "text", value: "Ada" },
    when: { type: "date" },
    note: { type: "text", required: false },
    spare: { type: "number", value: 1 },
  },
  references: [{ id: "r1", text: "Source one" }, { id: "r2", text: "Source two" }],
  datasets: {
    sales: { title: "Sales", columns: ["Q", "Rev"], rows: [["Q1", 1], ["Q2", 2]], source: { src: "./sales.csv" } },
    costs: { columns: ["Q", "Cost"], rows: [["Q1", 1]] },
  },
  assets: {
    "dark-logo": { src: PNG, alt: "Logo" },
    wm: "./wm.png",
    remote: "https://cdn.example.com/x.png",
    pic: { src: "./pic.png", alt: "A picture" },
  },
  catalogs: { custom: { themes: { x: { name: "X" } } } },
  extensions: { vendor: { a: 1 } },
  slides: [
    { id: "s1", title: "Hello there world", layout: "title", section: "Intro", notes: "These are four words" },
    {
      id: "s2", title: "Body", layout: "text-1x", section: "Intro", hidden: true,
      text: ["Plain ", { text: "linked", link: "https://x.dev", fontFamily: "Inter" }, { text: " cited", cite: ["r1", "r2"] }],
      image: { src: "./a.png", alt: "Chart of growth" },
      caption: "Figure 1",
    },
    {
      id: "s3", section: "Main", design: { fontScheme: "aptos", header: false, footer: { left: { text: "x" } }, background: "./s.jpg" },
      blocks: [
        { image: "asset:pic" },
        { image: { src: "./decor.png", alt: "" } },
        { image: "./noalt.png" },
        { blocks: [{ bullets: ["One two", { text: "Three" }] }, { code: { source: "const a = 1;", language: "ts" } }] },
      ],
      left: { chart: { type: "column", data: { columns: ["A", "B"], rows: [["x", 1]], source: { src: "./c.csv" } } } },
      right: { chart: { type: "pie", data: { dataset: "sales" } } },
      "bottom": { table: { dataset: "sales" } },
    },
    {
      id: "s4", section: "Main", notes: "Closing {{who}}",
      table: { columns: ["Region", "Revenue"], rows: [["N", 1], ["S", 2], ["E", 3]] },
      quote: { text: "To be or not", attribution: "Bard" },
      metric: { value: "42", label: "Answers" },
      timeline: { name: "Plan", events: [{ when: "Q1", what: "Start", description: "Go now" }] },
      video: "https://cdn.example.com/v.mp4",
    },
    { title: "Late section", section: "Intro", text: "Back", notes: "  " },
  ],
});

describe("stats: deck facts", () => {
  test("reports deck, people and design references as authored", () => {
    const result = stats(deck());
    assert.deepEqual(result.deck.slideSize, { preset: null, widthInches: 10, heightInches: 5, aspectRatio: 2, source: "design" });
    assert.equal(result.deck.name, "Facts");
    assert.equal(result.deck.description, true);
    assert.deepEqual(result.deck.language, { id: "en-US", inline: false });
    assert.equal(result.deck.template, false);
    assert.deepEqual(result.deck.author, ["Ada"]);
    assert.deepEqual(result.deck.tags, ["a", "b"]);
    assert.equal(result.deck.takeaways, 2);
    assert.equal(result.deck.declaredMinutes, 10);
    assert.deepEqual(result.deck.design, { theme: { id: "minimal", inline: false }, colorScheme: { id: "cool-horizon", inline: false }, fontScheme: { id: "roboto", inline: false } });
    assert.deepEqual(result.deck.audience, [{ id: "executive", inline: false }, { id: "custom-audience", inline: true }]);
    assert.deepEqual(result.deck.purpose, { id: "decide", inline: false });
    assert.deepEqual(result.deck.tone, { id: "formal", inline: true });
    assert.deepEqual(result.deck.narrative, { id: "story", inline: true, beats: 2 });
    assert.deepEqual(result.people.organizations, [{ id: "acme", name: "Acme", role: "primary", hasLogo: true }]);
    assert.deepEqual(result.people.speakers, [{ id: "ada", name: "Ada L", title: "CEO", organizationId: "acme", hasPhoto: true }]);
  });

  test("slide size comes from the design, the theme or the default, with the preset when named", () => {
    assert.deepEqual(stats({ slides: [] }).deck.slideSize, { preset: "widescreen", widthInches: 13.3333, heightInches: 7.5, aspectRatio: 1.778, source: "default" });
    assert.equal(stats({ design: { theme: "minimal" }, slides: [] }).deck.slideSize.source, "theme");
    const a4 = stats({ design: { dimensions: "a4" }, slides: [] }).deck.slideSize;
    assert.equal(a4.preset, "a4");
    assert.equal(a4.source, "design");
    assert.equal(stats({ design: { theme: "no-such-theme" }, slides: [] }).deck.slideSize.source, "default");
    assert.equal(stats({ design: { dimensions: { preset: "4:3" } }, slides: [] }).deck.slideSize.preset, "4:3");
  });
});

describe("stats: structure", () => {
  const result = stats(deck());

  test("counts slides, titles, hidden slides, layouts and consecutive sections", () => {
    assert.equal(result.slides.total, 5);
    assert.deepEqual(result.slides.hidden, [{ index: 1, id: "s2" }]);
    assert.equal(result.slides.withTitle, 3);
    assert.equal(result.slides.withoutTitle, 2);
    assert.deepEqual(result.slides.sections, [
      { name: "Intro", slides: 2, firstSlide: 0 },
      { name: "Main", slides: 2, firstSlide: 2 },
      { name: "Intro", slides: 1, firstSlide: 4 },
    ]);
    assert.equal(result.slides.unsectioned, 0);
    assert.deepEqual(result.slides.layouts, { title: 1, "text-1x": 1 });
    assert.equal(result.slides.withoutLayout, 3);
    assert.equal(result.slides.withOwnDesign, 1);
  });

  test("counts payload kinds across roots, blocks, regions and groups", () => {
    assert.deepEqual(result.payloads, {
      text: 2, items: 0, bullets: 1, quote: 1, metric: 1, code: 1, timeline: 1, chart: 2, table: 2, image: 4, video: 1,
      blocks: 6, regions: 3, groups: 1, maxDepth: 2,
    });
  });

  test("a deck without slides reports zeros", () => {
    const empty = stats({ slides: [] });
    assert.equal(empty.slides.total, 0);
    assert.deepEqual(empty.words.perSlide, { min: 0, max: 0, mean: 0 });
    assert.equal(empty.payloads.maxDepth, 0);
  });
});

describe("stats: words, notes, speaking time", () => {
  test("counts content and notes words separately; speaking time is an estimate from the notes", () => {
    const result = stats(deck(), { perSlide: true });
    assert.equal(result.perSlide[0].words.content, 3);
    assert.equal(result.perSlide[0].words.notes, 4);
    assert.equal(result.words.notes, 4 + 2);
    assert.equal(result.words.total, result.words.content + result.words.notes);
    assert.equal(result.speakingTime.basis, "estimate");
    assert.equal(result.speakingTime.wordsPerMinute, 130);
    assert.equal(result.speakingTime.notesWords, 6);
    assert.equal(result.speakingTime.minutes, 0);
    assert.equal(result.speakingTime.declaredMinutes, 10);
    assert.equal(stats({ slides: [{ notes: "word ".repeat(260) }] }, { wordsPerMinute: 130 }).speakingTime.minutes, 2);
    assert.equal(stats({ slides: [{ notes: "word ".repeat(130) }] }, { perSlide: true }).perSlide[0].speakingSeconds, 60);
  });

  test("a table counts its cells, a timeline its events, a list item its description", () => {
    const result = stats({ slides: [{ table: { columns: ["A b", "C"], rows: [["d e", 5]] }, timeline: [{ when: "Q1", what: "Start now", description: "More text" }], items: [{ text: "List item", description: "its detail" }] }] });
    // columns 3 ("A b", "C" is one) + row 3 ("d e", 5) + timeline 5 (Q1, Start now, More text) + item 4 (List item, its detail)
    assert.equal(result.words.content, 3 + 3 + 5 + 4);
  });

  test("scripts without spaces count one unit per character, whatever the runtime's ICU data", () => {
    assert.equal(stats({ slides: [{ title: "日本語のテキスト" }] }).words.content, 8);
    assert.equal(stats({ slides: [{ title: "don't stop 3.5 well-known" }] }).words.content, 4);
  });

  test("notes coverage lists the slides without notes; whitespace is not a note", () => {
    const result = stats(deck());
    assert.deepEqual(result.notes.withNotes, 2);
    assert.deepEqual(result.notes.withoutNotes, [{ index: 1, id: "s2" }, { index: 2, id: "s3" }, { index: 4, id: null }]);
  });
});

describe("stats: images, assets, charts, tables, datasets", () => {
  const result = stats(deck());

  test("classifies alt text through the asset registry; decorative is an explicit empty alt", () => {
    assert.deepEqual(result.images.content, { total: 4, withAlt: 2, decorative: 1, missingAlt: 1 });
    assert.equal(result.images.logos, 3);
    assert.deepEqual(result.images.watermarks, { deck: true, slides: 0 });
    assert.deepEqual(result.images.backgrounds, { deck: true, slides: 1 });
    assert.equal(result.images.headerFooter, 1);
    assert.equal(result.images.speakerPhotos, 1);
    assert.equal(result.images.videos, 1);
  });

  test("classifies assets as references, embedded, files and remote, and sizes embedded data", () => {
    assert.deepEqual(result.assets.registry, { entries: 4, embedded: 1, files: 2, remote: 1 });
    assert.equal(result.assets.uses.total, result.assets.uses.references + result.assets.uses.embedded + result.assets.uses.files + result.assets.uses.remote);
    assert.ok(result.assets.uses.references >= 2 && result.assets.uses.embedded >= 1 && result.assets.uses.files >= 3 && result.assets.uses.remote >= 2);
    // The speaker photo and the registry logo are each the 8 bytes of a PNG signature.
    assert.equal(result.assets.embeddedBytes, 16);
  });

  test("counts charts by type and data kind, tables with rows and columns, datasets with sources", () => {
    assert.deepEqual(result.charts, { total: 2, byType: { column: 1, pie: 1 }, data: { inline: 1, dataset: 1, source: 0 } });
    assert.equal(result.tables.total, 2);
    assert.equal(result.tables.datasetBacked, 1);
    assert.deepEqual(result.tables.items.map((item) => [item.slide, item.rows, item.columns, item.dataset]), [[2, 2, 2, "sales"], [3, 3, 2, null]]);
    assert.equal(result.tables.rows, 5);
    assert.equal(result.tables.columns, 4);
    assert.deepEqual(result.datasets, {
      count: 2,
      withSource: 1,
      items: [
        { id: "sales", title: "Sales", columns: 2, rows: 2, source: "./sales.csv", referencedBy: 2 },
        { id: "costs", title: null, columns: 2, rows: 1, source: null, referencedBy: 0 },
      ],
    });
  });
});

describe("stats: citations, variables, header/footer, fonts, colours", () => {
  const result = stats(deck());

  test("counts references, cited ids, citation runs, footnotes, captions and links", () => {
    assert.deepEqual(result.citations, { references: 2, cited: ["r1", "r2"], citations: 1, footnotes: 0, captions: 1, links: 1 });
  });

  test("reports declared, required, filled and unused variables; values count as filled", () => {
    assert.deepEqual(result.variables.byKind, { color: 1, date: 1, number: 1, text: 2 });
    assert.equal(result.variables.declared, 5);
    assert.equal(result.variables.required, 4);
    assert.equal(result.variables.optional, 1);
    assert.deepEqual(result.variables.unfilled, ["when", "note"]);
    assert.deepEqual(result.variables.unfilledRequired, ["when"]);
    assert.deepEqual(result.variables.unused, ["brand", "when", "note", "spare"]);
    assert.deepEqual(stats(deck(), { values: { when: "2026-01-01" } }).variables.unfilledRequired, []);
    assert.deepEqual(result.colors.variables, [{ id: "brand", value: "#112233", uses: 0 }]);
  });

  test("describes header and footer at deck level and per slide", () => {
    assert.deepEqual(result.headerFooter.header, { configured: true, suppressed: false, zones: ["left", "right"], fields: ["image", "text"] });
    assert.deepEqual(result.headerFooter.footer, { configured: true, suppressed: false, zones: ["center"], fields: ["text", "date"] });
    assert.deepEqual(result.headerFooter.slides, { headerOverrides: 0, headerSuppressed: 1, footerOverrides: 1, footerSuppressed: 0 });
  });

  test("names every font family: schemes in effect and run overrides", () => {
    assert.deepEqual(result.fonts.schemeIds, ["aptos", "roboto"]);
    assert.deepEqual(result.fonts.runOverrides, ["Inter"]);
    assert.ok(result.fonts.families.includes("Roboto") && result.fonts.families.includes("Aptos") && result.fonts.families.includes("Inter"));
    assert.deepEqual(result.fonts.unresolvedSchemeIds, []);
    assert.deepEqual(stats({ design: { fontScheme: "no-such" }, slides: [] }).fonts.unresolvedSchemeIds, ["no-such"]);
  });

  test("lists extension keys and the catalog groups the deck embeds records in", () => {
    assert.deepEqual(result.extensions, ["vendor"]);
    assert.deepEqual(result.catalogs, { custom: { source: null, records: { themes: 1 } } });
  });
});

describe("stats: contract", () => {
  test("per-slide rows only with perSlide, in slide order with a stable shape", () => {
    assert.equal("perSlide" in stats(deck()), false);
    const rows = stats(deck(), { perSlide: true }).perSlide;
    assert.deepEqual(rows.map((row) => row.index), [0, 1, 2, 3, 4]);
    assert.deepEqual(Object.keys(rows[1]), ["index", "id", "title", "layout", "section", "hidden", "payloads", "words", "hasNotes", "speakingSeconds", "images", "charts", "tables", "citations"]);
    assert.deepEqual(rows[1].payloads, ["text", "image"]);
  });

  test("is pure and deterministic: same key order, no mutation, no clock", () => {
    const input = deck();
    const before = structuredClone(input);
    const first = JSON.stringify(stats(input, { perSlide: true }));
    assert.deepEqual(input, before);
    assert.equal(JSON.stringify(stats(structuredClone(input), { perSlide: true })), first);
    assert.deepEqual(Object.keys(stats(input)), ["deck", "people", "slides", "payloads", "words", "notes", "speakingTime", "images", "charts", "tables", "datasets", "citations", "variables", "assets", "headerFooter", "fonts", "colors", "extensions", "catalogs"]);
  });

  test("reads what is there: invalid decks and unknown ids neither throw nor need layouts or fonts", () => {
    assert.doesNotThrow(() => stats({ slides: [{ layout: "no-such-layout", unknown: 1, title: 5, text: { weird: true }, blocks: [null, 3, { blocks: "x" }] }, null, "slide"], design: { theme: 7, header: "x" } }));
    assert.doesNotThrow(() => stats({}));
    assert.throws(() => stats(null), TypeError);
    assert.throws(() => stats([]), TypeError);
    assert.throws(() => stats({ slides: [] }, { wordsPerMinute: 0 }), RangeError);
  });

  test("a template reports itself and its unfilled variables", () => {
    const result = stats({ template: true, variables: { title: { type: "text", example: "Hi" } }, slides: [{ title: "{{title}}" }] });
    assert.equal(result.deck.template, true);
    assert.deepEqual(result.variables.unfilledRequired, ["title"]);
    assert.deepEqual(result.variables.unused, []);
  });
});

describe("stats: every bundled example", () => {
  test("runs on all examples, stays JSON-serializable and cheap", () => {
    const start = performance.now();
    for (const example of examples) {
      const result = stats(example.deck, { perSlide: true });
      assert.equal(result.slides.total, example.deck.slides.length, example.slug);
      assert.equal(result.perSlide.length, example.deck.slides.length, example.slug);
      assert.deepEqual(JSON.parse(JSON.stringify(result)), result, example.slug);
      assert.equal(result.words.total, result.words.content + result.words.notes, example.slug);
      assert.equal(result.images.content.total, result.images.content.withAlt + result.images.content.decorative + result.images.content.missingAlt, example.slug);
      assert.equal(Object.values(result.slides.layouts).reduce((sum, count) => sum + count, 0) + result.slides.withoutLayout, result.slides.total, example.slug);
    }
    // 126 decks take well under 100 ms; the bound only catches a structural regression (composition or fonts sneaking in).
    assert.ok(performance.now() - start < 3000, "stats must stay structural");
  });
});
