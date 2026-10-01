import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { composeSlide } from "../dist/composition.js";
import { examples } from "../dist/examples.js";
import { validatePresentation } from "../dist/index.js";
import { OPFMarkdownError, markdownToOpf, opfToMarkdown } from "../dist/markdown.js";
import { paginatePresentation } from "../dist/pagination.js";

const markdownExamples = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples/markdown");

const convert = (source, options) => markdownToOpf(source, options);
const slides = (source, options) => {
  const result = convert(source, options);
  assert.deepEqual(
    result.diagnostics.filter((d) => d.severity === "error"),
    [],
    source,
  );
  return result.document.slides;
};
const one = (source, options) => slides(source, options)[0];
const errors = (source, options) => convert(source, options).diagnostics.filter((d) => d.severity === "error");
const rule = (source, id, options) => convert(source, options).diagnostics.find((d) => d.ruleId === id);
/** Text of the source at a diagnostic location. */
const at = (source, diagnostic) => source.slice(diagnostic.location.offset, diagnostic.location.offset + diagnostic.location.length);

describe("deck structure", () => {
  test("front matter is the deck, --- separates slides, # and ## are title and subtitle", () => {
    const result = convert("---\nname: Demo\nlanguage: en-US\ndesign:\n  theme: classic\nvariables:\n  risk: \"#B42318\"\n---\n\n# One\n\n## First\n\nHello\n\n---\n\n# Two\n");
    assert.equal(result.valid, true);
    assert.deepEqual(result.document, {
      name: "Demo",
      language: "en-US",
      design: { theme: "classic" },
      variables: { risk: "#B42318" },
      slides: [{ title: "One", subtitle: "First", text: "Hello" }, { title: "Two" }],
    });
  });

  test("a deck without front matter starts with its first slide; CRLF, CR and a BOM read the same", () => {
    const lf = "# A\n\nText\n\n---\n\n# B\n";
    const expected = slides(lf);
    assert.equal(expected.length, 2);
    assert.deepEqual(slides(lf.replaceAll("\n", "\r\n")), expected);
    assert.deepEqual(slides(lf.replaceAll("\n", "\r")), expected);
    assert.deepEqual(slides(`﻿${lf}`), expected);
  });

  test("a --- line inside a fence, an HTML comment or speaker notes' fence does not split", () => {
    const result = slides("# A\n\n```text\none\n---\ntwo\n```\n\n<!-- a comment\n---\nstill a comment -->\n\n---\n\n# B");
    assert.equal(result.length, 2);
    assert.deepEqual(result[0].code, { source: "one\n---\ntwo", language: "text" });
  });

  test("empty segments are skipped; an empty slide in the middle warns, <!-- slide --> keeps one", () => {
    const result = convert("# One\n\n---\n\n---\n\n# Three\n\n---\n");
    assert.deepEqual(result.document.slides.map((s) => s.title), ["One", "Three"]);
    assert.equal(result.diagnostics.find((d) => d.ruleId === "markdown/empty-slide")?.severity, "warning");
    assert.deepEqual(slides("<!-- slide -->\n\n---\n\n# B"), [{}, { title: "B" }]);
  });

  test("outline input starts a slide at every # heading when split is headings", () => {
    const outline = "# One\n- a\n- b\nNote: first notes\n# Two\n## Sub\nText\n";
    assert.deepEqual(slides(outline, { split: "headings" }), [
      { title: "One", items: ["a", "b"], notes: "first notes" },
      { title: "Two", subtitle: "Sub", text: "Text" },
    ]);
    // In the default mode the second # is a second title.
    assert.ok(rule("# One\n- a\n# Two", "markdown/duplicate-title"));
  });

  test("defaults fill deck properties the front matter does not set", () => {
    assert.equal(convert("# A", { defaults: { name: "Fallback" } }).document.name, "Fallback");
    assert.equal(convert("---\nname: Mine\n---\n# A", { defaults: { name: "Fallback" } }).document.name, "Mine");
  });

  test("the result carries only what the Markdown says (no $schema or name is added)", () => {
    assert.deepEqual(convert("# A").document, { slides: [{ title: "A" }] });
  });
});

describe("blocks", () => {
  test("paragraphs, soft breaks, hard breaks and one block per paragraph", () => {
    assert.deepEqual(one("one\ntwo\\\nthree\n\nsecond"), { blocks: [{ text: "one two\nthree" }, { text: "second" }] });
    assert.deepEqual(one("single"), { text: "single" });
  });

  test("lists nest by indentation, descriptions follow an item, as=bullets stores bullets", () => {
    assert.deepEqual(one("- one\n  : its description\n- two\n  - nested\n    - deeper\n- three"), {
      items: [{ text: "one", description: "its description" }, "two", { text: "nested", level: 1 }, { text: "deeper", level: 2 }, "three"],
    });
    assert.deepEqual(one("<!-- block: as=bullets -->\n- a\n- b"), { bullets: ["a", "b"] });
    assert.deepEqual(one("* a\n+ b\n- c").blocks, [{ items: ["a"] }, { items: ["b"] }, { items: ["c"] }]);
  });

  test("numbers in a list are dropped with a warning", () => {
    const result = convert("1. one\n2. two");
    assert.deepEqual(result.document.slides[0], { items: ["one", "two"] });
    assert.equal(result.diagnostics[0].ruleId, "markdown/numbered-list");
    assert.equal(result.valid, true);
  });

  test("block quotes take attribution and source from trailing dash lines (the conversions' rules)", () => {
    assert.deepEqual(one("> Plain quote"), { quote: "Plain quote" });
    assert.deepEqual(one("> Words\n> more words\n> — Ada Lovelace"), { quote: { text: "Words more words", attribution: "Ada Lovelace" } });
    assert.deepEqual(one("> Words\n> -- Ada, Analyst\n> — Notes, 1843"), { quote: { text: "Words", attribution: "Ada, Analyst", source: "Notes, 1843" } });
    assert.deepEqual(one("> First\n>\n> Second\n> ~ Ada").quote, { text: "First\n\nSecond", attribution: "Ada" });
    // A dashed list is a list, not an attribution.
    assert.deepEqual(one("> - a\n> - b").quote, "- a - b");
  });

  test("fenced code keeps its text, language and file name", () => {
    assert.deepEqual(one("```python title=\"a.py\"\nprint(1)\n\n```"), { code: { source: "print(1)\n", language: "python", filename: "a.py" } });
    assert.deepEqual(one("```\nplain\n```"), { code: "plain" });
    assert.deepEqual(one("````md\n```js\nx\n```\n````"), { code: { source: "```js\nx\n```", language: "md" } });
    assert.deepEqual(one("~~~sh\nls\n~~~"), { code: { source: "ls", language: "sh" } });
  });

  test("pipe tables: the header row gives columns, cells are text (as in the data import), empty cells are null, an empty header gives none", () => {
    assert.deepEqual(one("| Name | Qty |\n| --- | ---: |\n| A | 1 |\n| B | 2.5 |\n| C |  |"), {
      table: { columns: ["Name", "Qty"], rows: [["A", "1"], ["B", "2.5"], ["C", null]] },
    });
    assert.deepEqual(one("|  |  |\n| --- | --- |\n| a | b |"), { table: { rows: [["a", "b"]] } });
    assert.deepEqual(one("| a |\n| - |\n| x \\| y |").table.rows, [["x | y"]]);
    assert.deepEqual(one("| a |\n| - |\n| 007 |").table.rows, [["007"]]);
  });

  test("a short or long table row warns and is padded", () => {
    const result = convert("| a | b |\n| - | - |\n| 1 |\n| 1 | 2 | 3 |");
    assert.deepEqual(result.document.slides[0].table.rows, [["1", null], ["1", "2", "3"]]);
    assert.equal(result.diagnostics.filter((d) => d.ruleId === "markdown/table-ragged").length, 2);
  });

  test("images take alt text and title; video is an image line with as=video", () => {
    assert.deepEqual(one("![A cat](cat.png \"Mia\")"), { image: { src: "cat.png", alt: "A cat", title: "Mia" } });
    assert.deepEqual(one("![](cat.png)"), { image: "cat.png" });
    assert.deepEqual(one("![x](<my file (1).png>)").image, { src: "my file (1).png", alt: "x" });
    assert.deepEqual(one("<!-- block: as=video -->\n![Clip](clip.mp4)"), { video: { src: "clip.mp4", alt: "Clip" } });
  });

  test("chart fences read CSV (quoted fields are text) or JSON, with a type after the word chart", () => {
    assert.deepEqual(one("```chart column\nQuarter,Revenue\nQ1,12\n\"2024\",18.5\n```").chart, { type: "column", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["2024", 18.5]] } });
    assert.deepEqual(one("```chart pie\nA,B,C\n\"x, y\",,true\n```").chart.data.rows, [["x, y", null, true]]);
    // The first column is the category labels and stays text; the other columns are typed.
    assert.deepEqual(one("```chart line\nYear,Sales\n2024,5\n2025,6.5\n```").chart.data.rows, [["2024", 5], ["2025", 6.5]]);
    assert.deepEqual(one("```chart bar\n{\"columns\":[\"a\"],\"rows\":[[1]]}\n```").chart, { type: "bar", data: { columns: ["a"], rows: [[1]] } });
    assert.deepEqual(one("```chart column\n{\"src\":\"data.csv\",\"columns\":[\"a\"]}\n```", {}).chart.data, { src: "data.csv", columns: ["a"] });
  });

  test("metric fences are key: value lines; a bare number is a number, a quoted value is text", () => {
    assert.deepEqual(one("```metric\nvalue: 42%\nlabel: Conversion\ndelta: +3 pts\ntrend: up\n```").metric, { value: "42%", label: "Conversion", delta: "+3 pts", trend: "up" });
    assert.deepEqual(one("```metric\nvalue: 42\n```").metric, 42);
    assert.deepEqual(one("```metric\nvalue: \"42\"\nunit: %\nlabel: \"A: b\"\n```").metric, { value: "42", label: "A: b", unit: "%" });
  });

  test("timeline fences take 'when — what' lines, the conversions' date rules, indented descriptions and a name", () => {
    assert.deepEqual(one("```timeline name=\"Plan\"\nNow — Do it\n  detail\n2026 Q1: Pilot\nQ2 2026 - Launch\nNo date\n```").timeline, {
      name: "Plan",
      events: [{ when: "Now", what: "Do it", description: "detail" }, { when: "2026 Q1", what: "Pilot" }, { when: "Q2 2026", what: "Launch" }, { what: "No date" }],
    });
  });

  test("Note: starts speaker notes that run to the end of the slide", () => {
    assert.deepEqual(one("# T\n\nNote: first line\nsecond\n\n# not a title\n- not a list"), { title: "T", notes: "first line\nsecond\n\n# not a title\n- not a list" });
    assert.deepEqual(one("Notes: with the s"), { notes: "with the s" });
    assert.equal(one("Note\\: not notes").text, "Note: not notes");
  });

  test("a level 3 or deeper heading becomes a bold paragraph with a warning", () => {
    const result = convert("### Side note");
    assert.deepEqual(result.document.slides[0], { text: [{ text: "Side note", bold: true }] });
    assert.equal(result.diagnostics[0].ruleId, "markdown/heading-demoted");
  });

  test("slide and block options come from HTML comments; ordinary comments are ignored", () => {
    assert.deepEqual(one("<!-- slide: id=cover layout=title section=\"Part 1\" tag=NEW hidden beat=a beat=b -->\n<!-- just a note -->\n# T"), {
      id: "cover", layout: "title", section: "Part 1", tag: "NEW", hidden: true, beat: ["a", "b"], title: "T",
    });
    assert.deepEqual(one("<!-- slide: hidden=false type=text -->\ntext"), { type: "text", text: "text", hidden: false });
    assert.deepEqual(one("<!-- block: id=b1 type=text -->\nhello\n\nworld"), { blocks: [{ id: "b1", type: "text", text: "hello" }, { text: "world" }] });
  });

  test("region=... places a block in a promoted region; opf-block and opf-slide embed YAML", () => {
    assert.deepEqual(one("# T\n\n<!-- block: region=top:left -->\nA\n\n<!-- block: id=r type=chart region=center+right -->\n```chart line\nx,y\n1,2\n```"), {
      title: "T", "top:left": { text: "A" }, "center+right": { id: "r", type: "chart", chart: { type: "line", data: { columns: ["x", "y"], rows: [["1", 2]] } } },
    });
    assert.deepEqual(one("```opf-block\nid: g\ntype: group\nblocks:\n  - text: a\n```\n\n```opf-slide\ncomposition:\n  mode: grid\nextensions:\n  x: 1\n```"), {
      blocks: [{ id: "g", type: "group", blocks: [{ text: "a" }] }], composition: { mode: "grid" }, extensions: { x: 1 },
    });
  });
});

describe("inline text", () => {
  const text = (source) => one(source).text;

  test("bold, italic, strike, underline, super and subscript, links and spans", () => {
    assert.deepEqual(text("**b** *i* _i2_ __b2__ ~~s~~ <u>u</u> x<sup>2</sup> H<sub>2</sub>O"), [
      { text: "b", bold: true }, " ", { text: "i", italic: true }, " ", { text: "i2", italic: true }, " ", { text: "b2", bold: true }, " ",
      { text: "s", strikethrough: true }, " ", { text: "u", underline: true }, " x", { text: "2", superscript: true }, " H", { text: "2", subscript: true }, "O",
    ]);
    assert.deepEqual(text("[a](https://x.y/z_1) and <https://auto.link> and [b](<a b>)"), [
      { text: "a", link: "https://x.y/z_1" }, " and ", { text: "https://auto.link", link: "https://auto.link" }, " and ", { text: "b", link: "a b" },
    ]);
    assert.deepEqual(text("[red]{color=#FF0000 size=24 font=\"Open Sans\" bold}"), [{ text: "red", bold: true, color: "#FF0000", fontSize: 24, fontFamily: "Open Sans" }]);
  });

  test("nesting merges into one run per style and ***both*** is bold italic", () => {
    assert.deepEqual(text("***both*** **a *b* c**"), [{ text: "both", bold: true, italic: true }, " ", { text: "a ", bold: true }, { text: "b", bold: true, italic: true }, { text: " c", bold: true }]);
    assert.deepEqual(text("[**bold link**](u)"), [{ text: "bold link", bold: true, link: "u" }]);
  });

  test("escapes make characters literal; intraword underscores and spaced stars are text; there is no inline code or entity", () => {
    assert.equal(text("\\*not\\* \\[x\\] snake_case_name 2 * 3 * 4 a\\\\b `code` &amp;"), "*not* [x] snake_case_name 2 * 3 * 4 a\\b `code` &amp;");
    assert.equal(text("2*(3+4)*5"), "2*(3+4)*5");
    assert.equal(text("unclosed **bold and [link"), "unclosed **bold and [link");
  });

  test("a bad span attribute is an error with a location", () => {
    const source = "text [x]{color=red size=big nope}";
    const error = errors(source)[0];
    assert.equal(error.ruleId, "markdown/span-attributes");
    assert.equal(error.location.line, 1);
  });

  test("title, quote and cell text is plain: formatting is dropped with a warning", () => {
    const result = convert("# **Big** news\n\n> *quoted*");
    assert.deepEqual(result.document.slides[0], { title: "Big news", quote: "quoted" });
    assert.equal(result.diagnostics.filter((d) => d.ruleId === "markdown/formatting-dropped").length, 2);
  });
});

describe("errors carry line and column in the lint shape", () => {
  test("every diagnostic has the lint fields and a location that points at the source", () => {
    const source = "# One\n\n<!-- slide: bogus=1 -->\n\n```chart\nA\n```\n";
    const result = convert(source);
    assert.equal(result.valid, false);
    assert.ok(result.counts.error >= 2);
    for (const d of result.diagnostics) {
      for (const key of ["ruleId", "severity", "path", "scope", "message", "help", "location"]) assert.ok(key in d, `${key} in ${JSON.stringify(d)}`);
      assert.deepEqual(Object.keys(d.location).sort(), ["column", "length", "line", "offset"]);
    }
    const options = rule(source, "markdown/options-unknown-key");
    assert.deepEqual([options.location.line, options.location.column], [3, 1]);
    assert.equal(at(source, options), "<!-- slide: bogus=1 -->");
    const chart = rule(source, "markdown/chart-type");
    assert.deepEqual([chart.location.line, chart.location.column], [5, 1]);
    assert.ok(result.diagnostics.every((d, i, all) => i === 0 || all[i - 1].location.offset <= d.location.offset));
  });

  test("front matter errors point inside the YAML", () => {
    const source = "---\nname: Demo\ndesign: [unclosed\n---\n# A";
    const error = errors(source).find((d) => d.ruleId === "markdown/front-matter");
    assert.ok(error);
    assert.equal(error.location.line, 4);
    assert.match(error.message, /^YAML:/);
    const unterminated = rule("---\nname: x\n# A", "markdown/front-matter-unterminated");
    assert.deepEqual([unterminated.location.line, unterminated.location.column], [1, 1]);
    assert.ok(rule("---\nslides: []\n---\n# A", "markdown/front-matter-slides"));
    assert.ok(rule("---\n- a\n- b\n---\n# A", "markdown/front-matter-not-mapping"));
    assert.ok(rule("---\na: &x 1\nb: *x\n---\n# A", "markdown/front-matter"));
  });

  test("an unterminated fence, a duplicate title, an empty deck and bad embedded YAML are errors", () => {
    assert.ok(rule("# A\n\n```js\nnever closed", "markdown/fence-unterminated"));
    assert.ok(rule("# A\n\n# B", "markdown/duplicate-title"));
    assert.ok(rule("# A\n\n## B\n\n## C", "markdown/duplicate-subtitle"));
    assert.ok(rule("", "markdown/no-slides"));
    assert.ok(rule("```opf-block\ntext: [\n```", "markdown/opf-block"));
    assert.ok(rule("<!-- slide: id=a -->\n<!-- slide: id=b -->\nx", "markdown/options-duplicate"));
    assert.ok(rule("<!-- block: id=a -->", "markdown/options-orphan"));
    assert.ok(rule("<!-- slide: type=text -->\n```opf-slide\ntype: text\n```", "markdown/slide-property-conflict"));
    assert.ok(rule("```metric\nlabel: x\n```", "markdown/metric-block"));
    assert.ok(rule("```chart bar\n{not json}\n```", "markdown/chart-data"));
    assert.ok(rule("```timeline\n  orphan description\n```", "markdown/timeline-description"));
  });

  test("OPF validation errors are mapped back to the Markdown that produced them", () => {
    const source = "# A\n\n---\n\n<!-- slide: type=bogus -->\n# B\n";
    const bad = convert(source).diagnostics.find((d) => d.ruleId.startsWith("opf/") && d.severity === "error");
    assert.ok(bad, "lint error present");
    assert.equal(bad.path, "/slides/1/type");
    assert.equal(bad.location.line, 5);
    assert.equal(at(source, bad), "<!-- slide: type=bogus -->");
    const table = convert("# A\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n```chart bar\n{\"src\":\"asset:missing\"}\n```").diagnostics.find((d) => d.ruleId === "opf/asset-reference");
    assert.equal(table.location.line, 7);
  });

  test("validate:false skips the OPF lint, a non-string input throws", () => {
    assert.equal(convert("<!-- slide: type=bogus -->\n# A", { validate: false }).valid, true);
    assert.throws(() => markdownToOpf(42), TypeError);
  });
});

describe("OPF to Markdown", () => {
  test("writes front matter, slides and blocks in the canonical form", () => {
    const { markdown, report } = opfToMarkdown({
      name: "Deck",
      slides: [
        { id: "a", layout: "title", title: "One", subtitle: "Sub", text: ["Some ", { text: "bold", bold: true }, " and ", { text: "red", color: "#FF0000" }], notes: "n1\nn2" },
        { title: "Two", items: ["x", { text: "y", level: 1 }], quote: { text: "Q", attribution: "A" } },
      ],
    });
    assert.equal(
      markdown,
      "---\nname: Deck\n---\n\n<!-- slide: id=a layout=title -->\n# One\n\n## Sub\n\nSome **bold** and [red]{color=#FF0000}\n\nNote: n1\nn2\n\n---\n\n# Two\n\n- x\n  - y\n\n> Q\n> — A\n",
    );
    assert.deepEqual(report, { lossless: true, native: true, embedded: [], loss: [] });
  });

  test("text that looks like Markdown is escaped and reads back unchanged", () => {
    const awkward = ["# not a heading", "- not a bullet", "1. not a number", "> not a quote", "| not a table", "Note: not notes", "---", "```", "![not](image)", "<!-- not a comment -->", "*a* _b_ ~~c~~ [d](e) <u>f</u>", "back\\slash and trail\\", "two\nlines", "snake_case"];
    for (const text of awkward) {
      const { markdown, report } = opfToMarkdown({ slides: [{ text }] });
      assert.equal(report.native, true, `${JSON.stringify(text)} should stay native`);
      assert.deepEqual(markdownToOpf(markdown).document.slides[0].text, text, markdown);
    }
  });

  test("two lists in a row alternate markers so they stay two blocks", () => {
    const deck = { slides: [{ blocks: [{ items: ["a"] }, { items: ["b"] }, { bullets: ["c"] }] }] };
    const { markdown } = opfToMarkdown(deck);
    assert.equal(markdown, "- a\n\n* b\n\n<!-- block: as=bullets -->\n- c\n");
    assert.deepEqual(markdownToOpf(markdown).document, deck);
  });

  test("what the dialect cannot express natively is embedded as YAML and survives", () => {
    const deck = {
      design: { theme: "classic" },
      slides: [
        { title: "T", design: { background: "light2" }, composition: { mode: "grid" }, blocks: [{ blocks: [{ text: "a" }, { text: "b" }] }, { table: { rows: [[{ value: "x", style: { fill: "#EEEEEE" } }]] } }] },
        { text: "x", extensions: { owner: "ops" } },
      ],
    };
    const { markdown, report } = opfToMarkdown(deck);
    assert.equal(report.lossless, true);
    assert.equal(report.native, false);
    assert.deepEqual(report.embedded.map((e) => e.path).sort(), ["/slides/0/blocks/0", "/slides/0/blocks/1", "/slides/0/composition", "/slides/0/design", "/slides/1/extensions"]);
    assert.match(markdown, /```opf-block/);
    assert.match(markdown, /```opf-slide/);
    const back = markdownToOpf(markdown);
    assert.equal(back.valid, true);
    assert.deepEqual(back.document, deck);
  });

  test("unsupported: drop leaves those parts out and reports them as loss", () => {
    const { markdown, report } = opfToMarkdown({ slides: [{ title: "T", design: { background: "light2" }, blocks: [{ blocks: [{ text: "a" }] }, { text: "keep" }] }] }, { unsupported: "drop" });
    assert.equal(markdown, "# T\n\nkeep\n");
    assert.equal(report.lossless, false);
    assert.deepEqual(report.loss.map((entry) => entry.split(":")[0]).sort(), ["/slides/0/blocks/0", "/slides/0/design"]);
    assert.deepEqual(report.embedded, []);
  });

  test("a chart whose first column is not text is written as JSON and stays a chart block", () => {
    const deck = { slides: [{ chart: { type: "scatter", data: { columns: ["x", "y"], rows: [[1, 2], [3, 4]] } } }] };
    const { markdown, report } = opfToMarkdown(deck);
    assert.equal(report.native, true);
    assert.match(markdown, /```chart scatter\n\{/);
    assert.deepEqual(markdownToOpf(markdown).document, deck);
    // With text categories the CSV form is used, and a category that looks like a number is not quoted.
    const years = { slides: [{ chart: { type: "line", data: { columns: ["Year", "Sales"], rows: [["2024", 5], ["2025", 6.5]] } } }] };
    assert.equal(opfToMarkdown(years).markdown, "```chart line\nYear,Sales\n2024,5\n2025,6.5\n```\n");
    assert.deepEqual(markdownToOpf(opfToMarkdown(years).markdown).document, years);
  });

  test("a leading --- line whose block holds only comments warns that the slide was not read", () => {
    const result = convert("---\n# Not a deck property\n---\n# Real title\n");
    assert.deepEqual(result.document.slides, [{ title: "Real title" }]);
    assert.equal(result.diagnostics.find((d) => d.ruleId === "markdown/front-matter-comments")?.severity, "warning");
  });

  test("an empty slide keeps a slide marker, and content that cannot be written natively falls back one part at a time", () => {
    assert.equal(opfToMarkdown({ slides: [{}] }).markdown, "<!-- slide -->\n");
    const { report } = opfToMarkdown({ slides: [{ title: "multi\nline", text: " padded", notes: "a\n---\nb" }] });
    assert.deepEqual(report.embedded.map((e) => e.path).sort(), ["/slides/0/notes", "/slides/0/text", "/slides/0/title"]);
  });

  test("a document that is not valid OPF is refused with OPFMarkdownError", () => {
    assert.throws(() => opfToMarkdown({ slides: "no" }), (error) => error instanceof OPFMarkdownError && error.code === "invalid-document" && error.details.issues.length > 0);
  });

  test("the front matter keeps every deck property, in order, as plain YAML", () => {
    const deck = { $schema: "https://openpresentation.org/schema/opf/v1", name: "N: with colon", description: "line one\nline two", tags: ["a", "b"], duration: 5, language: { id: "english-us" }, slides: [{ title: "x" }] };
    const { markdown } = opfToMarkdown(deck);
    assert.deepEqual(markdownToOpf(markdown).document, deck);
    assert.deepEqual(Object.keys(markdownToOpf(markdown).document), Object.keys(deck));
  });
});

describe("round trips", () => {
  test("the dialect examples are valid, canonical and compose", () => {
    const files = readdirSync(markdownExamples).filter((name) => name.endsWith(".md"));
    assert.ok(files.length >= 2);
    for (const name of files) {
      const source = readFileSync(path.join(markdownExamples, name), "utf8");
      const split = name.startsWith("outline") ? "headings" : "rules";
      const result = convert(source, { split });
      assert.deepEqual(result.diagnostics, [], name);
      assert.equal(validatePresentation(result.document).valid, true, name);
      const pages = paginatePresentation(result.document).presentation.slides;
      assert.ok(pages.length >= result.document.slides.length, name);
      for (const slide of pages) assert.ok(composeSlide(slide).items.length > 0, `${name}: ${slide.title}`);
      const again = opfToMarkdown(result.document);
      assert.equal(again.report.native, true, name);
      if (split === "rules") assert.equal(again.markdown, source, `${name} is canonical`);
      // Whatever the input, the canonical form converts back to the same deck and to itself.
      assert.deepEqual(convert(again.markdown).document, result.document, name);
      assert.equal(opfToMarkdown(convert(again.markdown).document).markdown, again.markdown, name);
    }
  });

  test("the quarterly review maps to the deck its Markdown says", () => {
    const deck = convert(readFileSync(path.join(markdownExamples, "quarterly-review.md"), "utf8")).document;
    assert.equal(deck.name, "Q3 Business Review");
    assert.deepEqual(deck.slides.map((s) => s.id), ["cover", "highlights", "revenue", "kpis", "risk", "decisions", "roadmap", "compare", "gate", "appendix"]);
    assert.deepEqual(deck.slides[2].blocks.map((block) => Object.keys(block)[0]), ["chart", "text"]);
    assert.equal(deck.slides[3].blocks.length, 3);
    assert.equal(deck.slides[9].hidden, true);
    assert.deepEqual(deck.slides[7].left, { bullets: ["One on-call rotation per region", "Quarterly capacity reviews"] });
  });

  test("the examples in the guide and in the skill reference convert as shown", () => {
    const repo = path.resolve(markdownExamples, "../..");
    const guide = readFileSync(path.join(repo, "docs/markdown.md"), "utf8");
    const shown = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(guide)[1]);
    assert.deepEqual(convert(/````md\n([\s\S]*?)\n````/.exec(guide)[1]).document, shown);
    const skill = readFileSync(path.join(repo, "skills/opf-author/references/markdown.md"), "utf8");
    const result = convert(/````md\n([\s\S]*?)\n````/.exec(skill)[1]);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.document.slides.length, 2);
  });

  // Every text, number and block kind of a deck, independent of how the content is arranged on the slide.
  const CONTENT = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"];
  const REGION = /^(?:top|middle|bottom)|^(?:left|center|right)/;
  function facts(deck) {
    const kinds = [];
    const leaves = [];
    const walk = (value, label) => {
      if (typeof value === "string") leaves.push(`s:${value}`);
      else if (typeof value === "number" || typeof value === "boolean") leaves.push(`${typeof value}:${value}`);
      else if (Array.isArray(value)) {
        // A run list reads as its concatenated text plus its formatting.
        if (value.some((item) => typeof item === "object" && item !== null) && value.every((item) => typeof item === "string" || (item && typeof item === "object" && typeof item.text === "string" && !("level" in item) && !("description" in item)))) {
          leaves.push(`runs:${value.map((item) => (typeof item === "string" ? item : item.text)).join("")}`);
          for (const item of value) if (typeof item === "object") leaves.push(`fmt:${JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => key !== "text")))}`);
        } else for (const item of value) walk(item, label);
      } else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) if (!(key === "level" && item === 0)) walk(item, key);
    };
    for (const slide of deck.slides) {
      const blocks = [];
      const collect = (payload) => {
        if (payload.blocks) payload.blocks.forEach(collect);
        else for (const key of CONTENT) if (payload[key] !== undefined) blocks.push(key);
      };
      collect(slide);
      for (const key of Object.keys(slide)) if (REGION.test(key) && typeof slide[key] === "object" && !Array.isArray(slide[key])) collect(slide[key]);
      kinds.push(blocks.sort().join(","));
      walk(slide, "");
    }
    return { kinds, leaves: leaves.sort() };
  }

  test("property: every example deck survives OPF to Markdown to OPF with all text and block kinds", () => {
    assert.equal(examples.length, 126);
    let nativeSlides = 0;
    let total = 0;
    const reasons = new Map();
    for (const { slug, deck } of examples) {
      const { markdown, report } = opfToMarkdown(deck);
      const back = convert(markdown);
      assert.deepEqual(back.diagnostics.filter((d) => d.severity === "error"), [], slug);
      assert.equal(validatePresentation(back.document).valid, true, slug);
      assert.deepEqual(facts(back.document), facts(deck), `${slug}: text and block kinds`);
      assert.deepEqual({ ...back.document, slides: undefined }, { ...deck, slides: undefined }, `${slug}: deck properties`);
      assert.equal(back.document.slides.length, deck.slides.length, slug);
      // The Markdown is a fixed point of the conversion.
      assert.equal(opfToMarkdown(back.document).markdown, markdown, `${slug}: canonical`);
      assert.equal(report.lossless, true);
      const embeddedSlides = new Set(report.embedded.map((entry) => entry.path.split("/").slice(0, 3).join("/")));
      nativeSlides += deck.slides.length - embeddedSlides.size;
      total += deck.slides.length;
      for (const entry of report.embedded) reasons.set(entry.reason.replace(/"[^"]*"/g, '"key"'), (reasons.get(entry.reason.replace(/"[^"]*"/g, '"key"')) ?? 0) + 1);
    }
    // Lossy parts are reported, not hidden: these are the only reasons the examples need YAML.
    for (const reason of reasons.keys()) assert.match(reason, /^(?:video content|table content|text content|"key" has no Markdown form|a block with several fields)/, reason);
    assert.ok(nativeSlides / total > 0.9, `${nativeSlides} of ${total} slides are plain Markdown`);
  });

  test("for slides with nothing embedded the round trip returns the same slide, apart from shorthand collapsed to one form", () => {
    let exact = 0;
    for (const { slug, deck } of examples) {
      const back = convert(opfToMarkdown(deck).markdown).document;
      deck.slides.forEach((slide, index) => {
        const got = back.slides[index];
        if (JSON.stringify(Object.keys(got).sort()) === JSON.stringify(Object.keys(slide).sort())) {
          for (const key of Object.keys(slide)) if (!["blocks"].includes(key)) {
            // Only run lists and string shorthands may differ in form; compare what they say.
            if (JSON.stringify(got[key]) === JSON.stringify(slide[key])) continue;
            assert.equal(typeof got[key], typeof slide[key], `${slug} #${index} ${key}`);
          }
          exact++;
        }
      });
    }
    assert.ok(exact > 600, `${exact} slides keep their keys`);
  });

  test("a template round trips: placeholders and var: fields are ordinary text, template and variables are front matter", () => {
    const template = JSON.parse(readFileSync(path.resolve(markdownExamples, "../../docs/fixtures/template-quarterly-review.opf.json"), "utf8"));
    const { markdown, report } = opfToMarkdown(template);
    assert.match(markdown, /^---\n(?:.*\n)*?template: true\n/);
    assert.match(markdown, /\{\{client\}\}/);
    const back = convert(markdown);
    assert.deepEqual(back.diagnostics.filter((d) => d.severity === "error"), []);
    assert.equal(back.document.template, true);
    assert.deepEqual(back.document.variables, template.variables);
    assert.deepEqual(facts(back.document), facts(template));
    assert.equal(report.lossless, true);
  });

  test("conversion is deterministic and offline", () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error("conversion must not fetch");
    };
    try {
      const source = readFileSync(path.join(markdownExamples, "quarterly-review.md"), "utf8");
      assert.deepEqual(convert(source), convert(source));
      const deck = convert(source).document;
      assert.equal(opfToMarkdown(deck).markdown, opfToMarkdown(structuredClone(deck)).markdown);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("the input document is never changed", () => {
    const deck = structuredClone(examples.find((example) => example.slug.includes("full-feature-tour")).deck);
    const before = structuredClone(deck);
    opfToMarkdown(deck);
    assert.deepEqual(deck, before);
  });
});

describe("robustness", () => {
  // A seeded generator: the same strings every run.
  let seed = 20260930;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const pieces = ["a", "b", "Z", "1", "2", ".", ",", ";", ":", "!", "?", "-", "+", "*", "_", "~", "[", "]", "(", ")", "<", ">", "\\", "|", "#", "`", "\"", "'", "&", "{", "}", "=", "/", " ", "é", "—", "$", "%", "Note", "---", "```", "1.", "- ", "> ", "# ", "![", "<!--", "**", "__", "~~", "<u>", "<br>", " : "];
  const make = (max) => {
    let out = "";
    for (let i = 0, n = 1 + Math.floor(random() * max); i < n; i++) out += pieces[Math.floor(random() * pieces.length)];
    return out.replace(/\s+/g, " ").trim() || "x";
  };

  test("random plain strings in text, lists, quotes, titles, cells and timelines write natively and read back exactly", () => {
    let embedded = 0;
    let total = 0;
    for (let i = 0; i < 1500; i++) {
      const s = make(12);
      const t = make(6);
      const slide = [
        { text: s },
        { items: [s, { text: t, level: 1 }] },
        { quote: { text: s, attribution: t } },
        { title: s, subtitle: t },
        { table: { columns: [s, "b"], rows: [[t, s]] } },
        { timeline: [{ when: "2024", what: s }, { what: t }] },
        { text: `${s}\n${t}` },
        { metric: { value: s, label: t } },
      ][i % 8];
      const { markdown, report } = opfToMarkdown({ slides: [slide] });
      const back = convert(markdown);
      assert.deepEqual(back.diagnostics.filter((d) => d.severity === "error"), [], markdown);
      total++;
      if (!report.native) embedded++;
      // Whether native or embedded, the text is the text that went in.
      const got = back.document.slides[0];
      for (const key of Object.keys(slide)) assert.deepEqual(got[key], slide[key], markdown);
    }
    // Only strings the dialect cannot carry (cells that read as numbers, "a : b" timeline events, a trailing "#") fall back to YAML.
    assert.ok(embedded / total < 0.15, `${embedded} of ${total} embedded`);
  });

  test("pathological input finishes quickly and never throws", () => {
    const started = performance.now();
    for (const source of ["*".repeat(20000), "[".repeat(5000), "**a ".repeat(3000), "_a ".repeat(3000), `${"- x\n".repeat(5000)}`, "| a |\n| - |\n" + "| x |\n".repeat(5000), "<!--".repeat(2000), "```".repeat(3000), "[a](".repeat(2000), "> ".repeat(5000), `${"[".repeat(3000)}x${"](y)".repeat(3000)}`]) {
      const result = convert(source);
      assert.ok(Array.isArray(result.diagnostics));
    }
    assert.ok(performance.now() - started < 5000, "bounded time");
  });
});
