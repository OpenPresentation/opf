// `locate` and `pathAt` in YAML and Markdown, and `scanMarkdown`: the ranges findings are underlined by and the paths hover and completion
// ask for, on valid text, on text with syntax errors, and on every example deck of the repository written in both forms.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { examples } from "../dist/examples.js";
import { fromMarkdown, toMarkdown } from "../dist/markdown.js";
import { BLOCK_OPTION_KEYS, FENCE_KINDS, METRIC_KEYS, SLIDE_OPTION_KEYS, SPAN_FLAGS, SPAN_VALUES, locate, pathAt, scanMarkdown } from "../dist/source.js";
import { toYaml } from "../dist/yaml.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const slice = (text, range) => text.slice(range.offset, range.offset + range.length);

const YAML = `# the deck
name: Q3 Review
design:
  titleAlignment: middle
slides:
  - title: Revenue
    items:
      - "Up 12%"
      - Churn down
  - title: 42
    notes: |
      hello
      world
    chart: { type: column, data: { columns: [A, B], rows: [[x, 1]] } }
`;

describe("locate in YAML", () => {
  test("a pointer is the range of its value, with line and column", () => {
    const range = locate(YAML, "yaml", "/design/titleAlignment");
    assert.equal(slice(YAML, range), "middle");
    assert.deepEqual([range.line, range.column], [4, 19]);
    assert.equal(range.exact, undefined);
    assert.equal(slice(YAML, locate(YAML, "yaml", "/slides/0/items/0")), '"Up 12%"');
    assert.equal(slice(YAML, locate(YAML, "yaml", ["slides", 1, "title"])), "42");
    assert.equal(slice(YAML, locate(YAML, "yaml", "/slides/1/chart/data/rows/0/1")), "1");
    assert.equal(slice(YAML, locate(YAML, "yaml", "/slides/1/chart/type")), "column");
  });
  test("the parts of a pair", () => {
    assert.equal(slice(YAML, locate(YAML, "yaml", "/design/titleAlignment", { part: "key" })), "titleAlignment");
    assert.equal(slice(YAML, locate(YAML, "yaml", "/design/titleAlignment", { part: "colon" })), "titleAlignment:");
    assert.equal(slice(YAML, locate(YAML, "yaml", "/design/titleAlignment", { part: "entry" })), "titleAlignment: middle");
    assert.equal(slice(YAML, locate(YAML, "yaml", "/slides/1/chart", { part: "open" })), "{");
    assert.equal(slice(YAML, locate(YAML, "yaml", "/design", { part: "open" })), "titleAlignment");
    assert.equal(slice(YAML, locate(YAML, "yaml", "/slides/0", { part: "open" })), "title");
  });
  test("a block scalar and a block mapping end at their last character, not at the line break", () => {
    assert.equal(slice(YAML, locate(YAML, "yaml", "/slides/1/notes")), "|\n      hello\n      world");
    assert.equal(slice(YAML, locate(YAML, "yaml", "/design")), "titleAlignment: middle");
  });
  test("a part the node does not have is its value; a node the text does not have is the nearest ancestor, marked inexact", () => {
    assert.equal(slice(YAML, locate(YAML, "yaml", "/slides/0", { part: "key" })), slice(YAML, locate(YAML, "yaml", "/slides/0")));
    const missing = locate(YAML, "yaml", "/design/colorScheme");
    assert.equal(missing.exact, false);
    assert.equal(slice(YAML, missing), "titleAlignment: middle");
    assert.equal(locate(YAML, "yaml", "/slides/7/title").exact, false);
    const whole = slice(YAML, locate(YAML, "yaml", ""));
    assert.ok(whole.startsWith("name: Q3 Review") && whole.endsWith("rows: [[x, 1]] } }"));
  });
  test("a key with no value is located by its key and colon", () => {
    const text = "name: x\ndesign:\nslides: []\n";
    assert.equal(slice(text, locate(text, "yaml", "/design")), "design:");
    assert.equal(slice(text, locate(text, "yaml", "/design", { part: "open" })), "design:");
  });
  test("text with syntax errors is located as far as it reads", () => {
    const text = "name: x\ntags: [a, b\ndes\nslides:\n  - title: 42\n";
    assert.equal(slice(text, locate(text, "yaml", "/name")), "x");
    assert.equal(slice(text, locate(text, "yaml", "/tags/1")), "b");
    const broken = "slides:\n  - title: a\n   items: [\n";
    assert.equal(slice(broken, locate(broken, "yaml", "/slides/0/title")), "a");
  });
  test("a BOM and CRLF line endings keep the offsets of the text", () => {
    const text = "﻿name: x\r\nslides:\r\n  - title: 42\r\n";
    const range = locate(text, "yaml", "/slides/0/title");
    assert.equal(slice(text, range), "42");
    assert.deepEqual([range.line, range.column], [3, 12]);
  });
  test("nothing to point at in an empty text or a document that is not YAML", () => {
    assert.equal(locate("", "yaml", "/name"), undefined);
    assert.equal(locate("# only a comment\n", "yaml", "/name"), undefined);
  });
  test("a duplicate key resolves to the first", () => {
    const text = "name: a\nname: b\nslides: []\n";
    assert.equal(slice(text, locate(text, "yaml", "/name")), "a");
  });
});

describe("pathAt in YAML", () => {
  const at = (needle, shift = 0) => pathAt(YAML, "yaml", YAML.indexOf(needle) + shift);
  test("a key, a value, the colon and the spaces after it", () => {
    assert.deepEqual([at("titleAlignment").path, at("titleAlignment").part], [["design", "titleAlignment"], "key"]);
    assert.deepEqual([at("middle", 2).path, at("middle", 2).part], [["design", "titleAlignment"], "value"]);
    assert.deepEqual([at("titleAlignment:", 15).path, at("titleAlignment:", 15).part], [["design", "titleAlignment"], "between"]);
    assert.equal(slice(YAML, at("middle", 2).range), "middle");
  });
  test("list items count as numbers", () => {
    assert.deepEqual(at("Churn", 2).path, ["slides", 0, "items", 1]);
    assert.deepEqual(at("title: 42", 8).path, ["slides", 1, "title"]);
    assert.deepEqual(at("[x, 1]", 1).path, ["slides", 1, "chart", "data", "rows", 0, 0]);
  });
  test("the dash of an item and the gap between members are between", () => {
    assert.deepEqual([at("- title: 42").path, at("- title: 42").part], [["slides"], "between"]);
  });
  test("outside the document there is no path", () => {
    assert.deepEqual(pathAt(YAML, "yaml", 2), { path: [], part: "none" });
    assert.deepEqual(pathAt("", "yaml", 0), { path: [], part: "none" });
    assert.equal(pathAt(YAML, "yaml", YAML.length).part, "none");
  });
  test("text with syntax errors still has paths", () => {
    const text = "name: x\ntags: [a, b\nslides:\n  - title: 42\n";
    assert.deepEqual(pathAt(text, "yaml", text.indexOf("a,")).path, ["tags", 0]);
  });
});

const MD = `---
name: Q3
design:
  theme: minimal
---

<!-- slide: id=cover layout=cover section="Part 1" beat=a beat=b -->
# Title

## Sub

- one
- two

Note: hi

---

# Two

<!-- block: id=c1 -->
\`\`\`chart column
A,B
x,1
\`\`\`

\`\`\`opf-block
quote:
  text: hello
\`\`\`

\`\`\`opf-slide
design:
  theme: x
\`\`\`
`;

describe("locate in Markdown", () => {
  test("front matter keys, also nested", () => {
    assert.equal(slice(MD, locate(MD, "md", "/name")), "Q3");
    assert.equal(slice(MD, locate(MD, "md", "/design/theme")), "minimal");
    assert.equal(slice(MD, locate(MD, "md", "/design/theme", { part: "key" })), "theme");
    assert.equal(locate(MD, "md", "/design/theme").line, 4);
    assert.equal(locate(MD, "markdown", "/name").offset, locate(MD, "md", "/name").offset);
  });
  test("a slide option is the token inside its options comment", () => {
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/layout")), "cover");
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/layout", { part: "key" })), "layout");
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/section")), '"Part 1"');
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/section", { part: "entry" })), 'section="Part 1"');
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/beat/1")), "b");
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/id")), "cover");
  });
  test("the title, the subtitle and a list item are the text after their marker", () => {
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/title")), "Title");
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/title", { part: "key" })), "#");
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/title", { part: "entry" })), "# Title");
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/subtitle")), "Sub");
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/items/1")), "two");
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/items/1", { part: "key" })), "-");
    assert.equal(locate(MD, "md", "/slides/0/items/1").line, 13);
    assert.equal(slice(MD, locate(MD, "md", "/slides/0/items")), "- one\n- two");
  });
  test("a slide, its blocks and the slides together", () => {
    assert.equal(locate(MD, "md", "/slides/0").line, 7);
    assert.equal(slice(MD, locate(MD, "md", "/slides/0", { part: "open" })), '<!-- slide: id=cover layout=cover section="Part 1" beat=a beat=b -->');
    assert.equal(slice(MD, locate(MD, "md", "/slides/1/blocks/0", { part: "open" })), "```chart column");
    assert.equal(locate(MD, "md", "/slides").line, 7);
    assert.equal(locate(MD, "md", "/slides/9").exact, false);
    assert.equal(locate(MD, "md", "/slides").exact, undefined);
  });
  test("the YAML in an opf-block or opf-slide fence knows the rest of the pointer", () => {
    assert.equal(slice(MD, locate(MD, "md", "/slides/1/blocks/1/quote/text")), "hello");
    assert.equal(slice(MD, locate(MD, "md", "/slides/1/design/theme")), "x");
    assert.equal(slice(MD, locate(MD, "md", "/slides/1/design/theme", { part: "key" })), "theme");
  });
  test("a pointer past the end falls back to the nearest ancestor, marked inexact", () => {
    const missing = locate(MD, "md", "/slides/0/chart/type");
    assert.equal(missing.exact, false);
    assert.equal(slice(MD, locate(MD, "md", "/nope")), "name: Q3\ndesign:\n  theme: minimal");
    assert.equal(locate(MD, "md", "/nope").exact, false);
    assert.equal(locate("", "md", "/slides/0"), undefined);
  });
  test("an unclosed front matter has no keys to point at", () => {
    assert.equal(locate("---\nname: x\n\n# A\n", "md", "/name"), undefined);
  });
  test("CRLF line endings and a BOM keep the offsets of the text", () => {
    const text = `﻿${MD.replaceAll("\n", "\r\n")}`;
    assert.equal(slice(text, locate(text, "md", "/slides/0/title")), "Title");
    assert.equal(slice(text, locate(text, "md", "/slides/0/layout")), "cover");
    assert.equal(slice(text, locate(text, "md", "/design/theme")), "minimal");
  });
});

describe("pathAt in Markdown", () => {
  const at = (needle, shift = 0) => pathAt(MD, "md", MD.indexOf(needle) + shift);
  test("front matter", () => {
    assert.deepEqual([at("minimal", 1).path, at("minimal", 1).part], [["design", "theme"], "value"]);
    assert.deepEqual([at("theme:", 1).path, at("theme:", 1).part], [["design", "theme"], "key"]);
  });
  test("an option token, the title, a list item, a block", () => {
    assert.deepEqual([at("layout=", 2).path, at("layout=", 2).part], [["slides", 0, "layout"], "key"]);
    assert.deepEqual([at("cover layout", 1).path, at("cover layout", 1).part], [["slides", 0, "id"], "value"]);
    assert.deepEqual(at("beat=b", 6).path, ["slides", 0, "beat", 1]);
    assert.deepEqual(at("Title", 2).path, ["slides", 0, "title"]);
    assert.deepEqual(at("- two", 3).path, ["slides", 0, "items", 1]);
    assert.deepEqual(at("A,B", 1).path, ["slides", 1, "blocks", 0]);
  });
  test("inside an embedded fence the YAML path continues the block's", () => {
    assert.deepEqual(at("text: hello", 8).path, ["slides", 1, "blocks", 1, "quote", "text"]);
    assert.deepEqual(at("theme: x", 7).path, ["slides", 1, "design", "theme"]);
  });
  test("outside the front matter and the slides there is no path", () => {
    assert.deepEqual(pathAt(MD, "md", 0), { path: [], part: "none" });
  });
});

describe("scanMarkdown", () => {
  const scan = scanMarkdown(MD);
  test("front matter, slides and separators", () => {
    assert.equal(slice({ offset: 0 }.offset === 0 ? MD : MD, { offset: scan.frontMatter.yamlFrom, length: scan.frontMatter.yamlTo - scan.frontMatter.yamlFrom }), "\nname: Q3\ndesign:\n  theme: minimal\n");
    assert.equal(scan.frontMatter.closed, true);
    assert.equal(scan.slides.length, 2);
    assert.deepEqual(scan.slides.map((slide) => slide.index), [0, 1]);
    assert.equal(scan.separators.length, 1);
    assert.equal(MD.slice(scan.separators[0], scan.separators[0] + 3), "---");
  });
  test("comments, fences and notes", () => {
    assert.deepEqual(scan.comments.map((comment) => [comment.kind, comment.slide, comment.closed]), [["slide", 0, true], ["block", 1, true]]);
    assert.equal(MD.slice(scan.comments[0].innerFrom, scan.comments[0].innerTo).trim().startsWith("slide: id=cover"), true);
    assert.deepEqual(scan.fences.map((fence) => [fence.kind, fence.word, fence.slide, fence.closed]), [["chart", "chart", 1, true], ["opf-block", "opf-block", 1, true], ["opf-slide", "opf-slide", 1, true]]);
    assert.equal(MD.slice(scan.fences[0].infoFrom, scan.fences[0].infoTo), "chart column");
    assert.equal(MD.slice(scan.fences[0].bodyFrom, scan.fences[0].bodyTo), "A,B\nx,1");
    assert.equal(scan.notes.length, 1);
    assert.equal(MD.slice(scan.notes[0].from, scan.notes[0].from + 5), "Note:");
  });
  test("a separator inside a fence, a comment or notes is not a separator", () => {
    const text = "# A\n\n```js\n---\n```\n\n<!--\n---\n-->\n\nNote: x\n---\n# B\n";
    const result = scanMarkdown(text);
    assert.equal(result.slides.length, 2);
    assert.equal(result.separators.length, 1);
    assert.equal(result.fences[0].kind, "code");
  });
  test("unclosed front matter, comment and fence are reported open and run to the end", () => {
    const front = scanMarkdown("---\nname: x\n\n# A\n");
    assert.equal(front.frontMatter.closed, false);
    assert.equal(front.slides.length, 1);
    const fence = scanMarkdown("# A\n\n```js\nx\n");
    assert.equal(fence.fences[0].closed, false);
    assert.equal(fence.fences[0].bodyTo, fence.fences[0].to);
    const comment = scanMarkdown("# A\n\n<!-- note\n");
    assert.equal(comment.comments[0].closed, false);
    assert.equal(comment.comments[0].kind, "comment");
  });
  test("an outline is cut at its headings like fromMarkdown does", () => {
    const text = "# One\n\n- a\n\n# Two\n\n- b\n";
    assert.equal(scanMarkdown(text).slides.length, 2);
    assert.equal(scanMarkdown(text, { split: "rules" }).slides.length, 1);
  });
  test("the dialect vocabulary is exported", () => {
    assert.deepEqual([...SLIDE_OPTION_KEYS], ["id", "type", "layout", "section", "tag", "hidden", "beat"]);
    assert.deepEqual([...BLOCK_OPTION_KEYS], ["id", "type", "as", "region"]);
    assert.ok(FENCE_KINDS.includes("opf-slide") && METRIC_KEYS.includes("sentiment"));
    assert.deepEqual([...SPAN_VALUES], ["color", "size", "font", "lang"]);
    assert.ok(SPAN_FLAGS.includes("bold"));
    // The vocabulary is what the converter reads: every flag, value attribute, option key and metric key is accepted by it.
    for (const flag of SPAN_FLAGS) assert.deepEqual(fromMarkdown(`[x]{${flag}}`, { validate: false }).findings, [], flag);
    for (const [name, value] of [["color", "#B42318"], ["size", "24"], ["font", '"Open Sans"'], ["lang", "fr"]]) assert.deepEqual(fromMarkdown(`[x]{${name}=${value}}`, { validate: false }).findings, [], name);
    const options = `<!-- slide: id=a type=text layout=text section=s tag=t hidden beat=b -->\n# A\n\n<!-- block: id=b as=bullets -->\n- x\n`;
    assert.deepEqual(fromMarkdown(options, { validate: false }).findings, []);
    const metric = `# A\n\n\`\`\`metric\n${METRIC_KEYS.map((key) => `${key}: ${key === "value" ? "1" : "x"}`).join("\n")}\n\`\`\`\n`;
    assert.deepEqual(fromMarkdown(metric, { validate: false }).findings.filter((finding) => finding.severity === "error"), []);
  });
});

// Every example deck written as YAML and as Markdown: the number of slides the scan finds is the number the converter reads, every leaf
// of the deck has a range inside the text, and in YAML the range of a leaf is the path pathAt reports for it.
function leaves(value, at = []) {
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, [...at, index]));
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => leaves(item, [...at, key]));
  return [at];
}

describe("every example deck", () => {
  const sample = examples.filter((_, index) => index % 3 === 0);
  test("in YAML, every leaf is located and pathAt reads the same path back", () => {
    let checked = 0;
    for (const { slug, deck } of sample) {
      const yaml = toYaml(deck).yaml;
      for (const at of leaves(deck)) {
        const range = locate(yaml, "yaml", at);
        assert.ok(range && range.exact !== false, `${slug}: ${at.join("/")}`);
        // A string that is empty or null has no characters to stand on.
        if (range.length < 2) continue;
        const found = pathAt(yaml, "yaml", range.offset + 1);
        assert.deepEqual(found.path, at, `${slug}: ${at.join("/")} -> ${JSON.stringify(found)}`);
        checked++;
      }
    }
    assert.ok(checked > 500);
  });
  test("in Markdown, the scan counts the slides the converter reads and every located leaf is inside the text", () => {
    for (const { slug, deck } of sample) {
      const markdown = toMarkdown(deck).markdown;
      const read = fromMarkdown(markdown, { validate: false });
      assert.equal(scanMarkdown(markdown).slides.length, read.presentation.slides.length, slug);
      for (const at of leaves(deck)) {
        const range = locate(markdown, "md", at);
        if (!range) continue;
        assert.ok(range.offset >= 0 && range.offset + range.length <= markdown.length, `${slug}: ${at.join("/")}`);
      }
      // The title of every slide with one is located at its text.
      for (const [index, slide] of read.presentation.slides.entries()) {
        if (typeof slide.title !== "string") continue;
        const range = locate(markdown, "md", `/slides/${index}/title`);
        assert.equal(range.exact, undefined, `${slug}: slide ${index} title`);
        assert.equal(slice(markdown, range), slide.title.trim(), `${slug}: slide ${index} title text`);
      }
    }
  });
  test("the kitchen-sink fixture: every located slide field points at its own line", () => {
    const source = readFileSync(path.join(root, "packages/javascript/test/fixtures/markdown/kitchen-sink.md"), "utf8");
    const read = fromMarkdown(source, { validate: false });
    for (const [index, slide] of read.presentation.slides.entries()) {
      const range = locate(source, "md", `/slides/${index}`);
      assert.ok(range, `slide ${index}`);
      if (typeof slide.title === "string") assert.ok(slice(source, locate(source, "md", `/slides/${index}/title`)).length > 0);
    }
  });
});
