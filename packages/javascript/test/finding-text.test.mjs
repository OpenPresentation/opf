// Plain-words problem text (artifacts/source-editor/VALIDATOR-HINTS.md): describeFinding for the schema keywords, the pattern phrases, the YAML syntax
// analyzer and the Markdown reader's findings, and the patch fixes validate attaches to schema findings.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validate } from "../dist/index.js";
import { fromMarkdown } from "../dist/markdown.js";
import { fromYaml } from "../dist/yaml.js";
import { schemas } from "../dist/schemas.js";
import { PATTERN_PHRASES, analyzeYamlSyntax, applyTextEdits, describeFinding } from "../dist/source.js";

const schemaFindings = (document, options = {}) => validate(document, { only: ["format"], ...options }).findings.filter((found) => found.ruleId === "opf/schema");
const said = (document, keyword, format = "json") => {
  const found = schemaFindings(document).find((entry) => entry.validation.keyword === keyword);
  assert.ok(found, `the document has a ${keyword} finding`);
  return { found, ...describeFinding(found, { document, format }) };
};

describe("schema keywords in plain words", () => {
  test("enum: the values, the value that is there and a guess", () => {
    const { message, next } = said({ slides: [{ title: "a" }], design: { titleAlignment: "middle" } }, "enum");
    assert.equal(message, "`titleAlignment` must be left, center or right, but is `middle`.");
    assert.equal(next, "did you mean `center`?");
  });
  test("enum with more than five values counts them and points at the list", () => {
    const { message, next } = said({ slides: [{ title: "a", type: "zzzzzzzzzzzz" }] }, "enum");
    assert.match(message, /^`type` must be one of \d+ values \(/);
    assert.match(next, /Ctrl\+Space/);
  });
  test("required: the object, the property and what to add (JSON and YAML flavors)", () => {
    const json = said({ name: "x" }, "required");
    assert.equal(json.message, "The deck is missing `slides`.");
    assert.equal(json.next, 'add "slides": [ { "title": "…" } ].');
    const yaml = said({ name: "x" }, "required", "yaml");
    assert.equal(yaml.next, "add `slides:` with at least one `- title: …`.");
    const organization = said({ slides: [{ title: "a" }], organization: { id: "acme" } }, "required");
    assert.equal(organization.message, "`organization` is missing `name`.");
  });
  test("type: what it is and what to write", () => {
    const list = said({ slides: [{ items: "One" }] }, "type");
    assert.equal(list.message, "`items` should be a list, but it is text (`One`).");
    assert.equal(list.next, 'write ["One"].');
    const union = said({ slides: [{ title: 42 }] }, "oneOf");
    assert.match(union.message, /^`title` should be text or a list, but it is a number \(`42`\)\.$/);
  });
  test("additionalProperties: not a property of, did you mean, extensions", () => {
    const { message, next } = said({ slids: [{ title: "a" }] }, "additionalProperties");
    assert.equal(message, "`slids` is not a property of the deck.");
    assert.equal(next, "did you mean `slides`? To keep custom data, put it under `extensions`.");
  });
  test("minItems, an empty layout and a bad hex color", () => {
    assert.equal(said({ slides: [] }, "minItems").message, "`slides` needs at least 1 item.");
    const layout = said({ slides: [{ title: "a", layout: "" }] }, "pattern");
    assert.equal(layout.message, "`layout` is empty.");
    assert.match(layout.next, /^press Ctrl\+Space for the available ids \(an id such as `pillars` or `acme:hero`\), or remove it to let OPF pick\.$/);
    const wrong = said({ slides: [{ title: "a", layout: "My Layout" }] }, "pattern");
    assert.equal(wrong.message, "`layout` must be a layout id such as `pillars` or `acme:hero` (lowercase letters, digits and hyphens), but it is `My Layout`.");
    const color = said({ slides: [{ title: "a" }], design: { colorScheme: { accent1: "#12" } } }, "pattern");
    assert.equal(color.message, "`accent1` must be a hex color like `#1F4E79` (3, 6 or 8 hex digits), but is `#12`.");
    assert.equal(color.next, "write the color as #RRGGBB.");
  });
  test("the chord and the count of records come from the caller", () => {
    const found = schemaFindings({ slides: [{ title: "a", layout: "" }] })[0];
    const { next } = describeFinding(found, { chord: "Cmd+I", catalogCount: () => 28 });
    assert.equal(next, "press Cmd+I for the 28 layouts, or remove it to let OPF pick.");
  });
  test("a finding of another producer keeps its sentence and the first sentence of its help", () => {
    const text = describeFinding({ ruleId: "pptx.dev/narrative-gap", severity: "warning", category: "narrative", path: "", message: "The story has a gap.", help: "Add a slide about the problem. Then move on." });
    assert.deepEqual(text, { message: "The story has a gap.", next: "add a slide about the problem." });
  });
  test("describeFinding never throws on odd input", () => {
    assert.doesNotThrow(() => describeFinding({ ruleId: "opf/schema", severity: "error", category: "format", path: "/x/0/y", message: "m", validation: { keyword: "enum", schemaPath: "#", path: "/x", message: "m", params: {} } }));
    assert.doesNotThrow(() => describeFinding({ ruleId: "markdown/fence-unterminated", severity: "error", category: "format", path: "", message: "m" }));
  });
});

describe("pattern phrases", () => {
  const patterns = new Set();
  const walk = (node, key) => {
    if (Array.isArray(node)) for (const entry of node) walk(entry);
    else if (node && typeof node === "object") for (const [name, value] of Object.entries(node)) walk(value, name);
    else if (key === "pattern" && typeof node === "string") patterns.add(node);
  };
  for (const entry of Object.values(schemas)) walk(entry.schema ?? entry);
  test("every pattern of the published schemas has a phrase", () => {
    assert.ok(patterns.size >= 15);
    const missing = [...patterns].filter((pattern) => !PATTERN_PHRASES[pattern]);
    assert.deepEqual(missing, []);
  });
  test("a phrase names what to write, and its pattern is a real regular expression", () => {
    for (const [pattern, phrase] of Object.entries(PATTERN_PHRASES)) {
      assert.doesNotThrow(() => new RegExp(pattern), pattern);
      assert.match(phrase.what, /^an? |^the /, pattern);
      assert.match(phrase.next, /\.$/, pattern);
    }
  });
});

describe("YAML syntax in plain words", () => {
  const problem = (text, index = 0) => analyzeYamlSyntax(text)[index];
  const fixed = (text, title, index = 0) => {
    const found = problem(text, index);
    const fix = found.fixes.find((entry) => entry.title === title);
    assert.ok(fix, `${title} is offered for ${JSON.stringify(text)} (has ${found.fixes.map((entry) => entry.title).join(", ")})`);
    return applyTextEdits(text, fix.edits);
  };
  test("a tab for indentation, with the line and the repair", () => {
    const text = "name: x\nslides:\n\t- title: a\n";
    assert.equal(problem(text).message, "Line 3 is indented with a tab. YAML needs spaces.");
    assert.equal(fixed(text, "Convert tabs to spaces"), "name: x\nslides:\n  - title: a\n");
    const two = "a:\n\tb: 1\n\tc: 2\n";
    assert.deepEqual(problem(two).fixes.map((entry) => entry.title), ["Convert tabs to spaces on this line", "Convert tabs to spaces in the file"]);
    assert.equal(fixed(two, "Convert tabs to spaces in the file"), "a:\n  b: 1\n  c: 2\n");
  });
  test("a quote that is never closed is reported where it opens", () => {
    const text = 'name: "x\nslides: []\n';
    const found = problem(text);
    assert.equal(found.message, "The double quote opened on line 1 is never closed.");
    assert.deepEqual([found.range.line, found.range.column], [1, 7]);
    assert.equal(fixed(text, "Insert closing quote"), 'name: "x"\nslides: []\n');
    assert.equal(fixed("a: 'it\nb: 1\n", "Insert closing quote"), "a: 'it'\nb: 1\n");
  });
  test("a flow list or map that is never closed", () => {
    assert.equal(problem("tags: [a, b\nslides: []\n").message, "The list that starts with `[` on line 1 is never closed.");
    assert.equal(fixed("tags: [a, b\nslides: []\n", "Insert ]"), "tags: [a, b]\nslides: []\n");
    assert.equal(fixed("tags: {a: 1\nslides: []\n", "Insert }"), "tags: {a: 1}\nslides: []\n");
    assert.equal(fixed("tags: [a, # c\n  b\nslides: []\n", "Insert ]"), "tags: [a, # c\n  b]\nslides: []\n");
  });
  test("a half-typed key, a colon in a value, a list item under a value", () => {
    assert.equal(problem("name: x\ndes\nslides: []\n").message, "`des` isn't a complete `key: value` line.");
    assert.equal(fixed("name: x\ndes\nslides: []\n", "Add a colon"), "name: x\ndes: \nslides: []\n");
    assert.equal(fixed("name: x\ndes\nslides: []\n", "Remove the line"), "name: x\nslides: []\n");
    assert.equal(problem("title: Revenue: up\n").message, "A value can't contain `: ` unless it is quoted.");
    assert.equal(fixed("title: Revenue: up # c\n", "Quote the value"), 'title: "Revenue: up" # c\n');
    assert.equal(problem("name: x\n- a\n").message, "This list item sits under a value that isn't a list.");
  });
  test("a duplicate key names both lines and removes either", () => {
    const text = "name: x\nname: y\nslides: []\n";
    assert.equal(problem(text).message, "`name` appears twice at this level (lines 1 and 2). The first value is ignored.");
    assert.equal(fixed(text, "Remove the first"), "name: y\nslides: []\n");
    assert.equal(fixed(text, "Remove the second"), "name: x\nslides: []\n");
    assert.deepEqual(problem(text).related.map((range) => range.line), [1]);
  });
  test("misaligned lines, text after a list, a bad escape", () => {
    assert.equal(fixed("slides:\n  - title: a\n   items: 1\n", "Align with the line above"), "slides:\n  - title: a\n    items: 1\n");
    assert.equal(problem("tags: [a, b] x\n").message, "Unexpected text `x` after the value ends.");
    assert.equal(fixed("a: \"\\q\"\n", "Double the backslash"), 'a: "\\\\q"\n');
    assert.equal(fixed("a: @x\n", "Quote the value"), 'a: "@x"\n');
  });
  test("an empty document, a list at the top, several documents", () => {
    assert.equal(problem("").message, "The document is empty (or everything in it is a comment).");
    assert.equal(fixed("", "Insert minimal deck"), "slides:\n  - title: Title\n");
    assert.equal(fixed("# only\n", "Insert minimal deck"), "# only\nslides:\n  - title: Title\n");
    assert.equal(problem("- title: a\n- title: b\n").message, "The top level must be `key: value` lines, but this is a list.");
    assert.equal(fixed("- title: a\n- title: b\n", "Wrap as `slides:`"), "slides:\n  - title: a\n  - title: b\n");
    assert.equal(fixed("a: 1\n---\nb: 2\n", "Remove the extra `---`"), "a: 1\nb: 2\n");
  });
  test("text the reader accepts has no problems; a cascade is one problem", () => {
    assert.deepEqual(analyzeYamlSyntax("name: x\nslides: []\n"), []);
    assert.equal(analyzeYamlSyntax("name: x\n- a\n").length, 1);
    assert.equal(analyzeYamlSyntax('a: [ "x ]\n').length, 1);
  });
  test("fromYaml reports the same sentences with the help as the next step", () => {
    const found = fromYaml("name: x\nslides:\n\t- title: a\n").findings[0];
    assert.equal(found.ruleId, "yaml/syntax");
    assert.equal(found.message, "Line 3 is indented with a tab. YAML needs spaces.");
    assert.deepEqual(describeFinding(found), { message: found.message, next: "replace the tab with spaces (two for each level of indentation)." });
  });
  test("offsets skip a byte-order mark and CRLF counts as one line break", () => {
    const text = "\uFEFFname: x\r\nslides:\r\n\t- title: a\r\n";
    const found = problem(text);
    assert.equal(found.range.line, 3);
    assert.equal(applyTextEdits(text, found.fixes[0].edits), "\uFEFFname: x\r\nslides:\r\n  - title: a\r\n");
  });
});

describe("Markdown findings in plain words", () => {
  const first = (text, rule) => {
    const found = fromMarkdown(text).findings.find((entry) => entry.ruleId === rule);
    assert.ok(found, `${rule} for ${JSON.stringify(text)}`);
    return { found, ...describeFinding(found) };
  };
  test("front matter and the YAML inside it", () => {
    assert.match(first("---\nname: x\n\n# A\n", "markdown/front-matter-unterminated").next, /^add a line with only `---`/);
    const colon = first("---\nname x\n---\n# A\n", "markdown/front-matter-not-mapping");
    assert.equal(colon.message, "`name x` needs a colon and a value.");
    assert.equal(colon.found.location.line, 2);
    const tab = first("---\nname: x\nslides:\n\t- a\n---\n# A\n", "markdown/front-matter");
    assert.match(tab.message, /indented with a tab/);
    assert.match(first("---\nname: x\nslides: []\n---\n# A\n", "markdown/front-matter-slides").message, /can't hold `slides`/);
  });
  test("options comments suggest the near key", () => {
    const found = first("# A\n<!-- slide: layot=cover -->\n", "markdown/options-unknown-key");
    assert.deepEqual(found.found.suggestions.map((entry) => entry.value), ["layout"]);
    assert.equal(found.message, "`layot` is not a slide option.");
    assert.match(found.next, /^did you mean `layout`\? The keys are id, type, layout/);
    assert.match(first("# A\n<!-- slide: hidden=maybe -->\n", "markdown/options-value").next, /hidden=true/);
  });
  test("comments and fences say where they opened", () => {
    assert.equal(first("# A\n\n<!-- note\n", "markdown/comment-unterminated").message, "The `<!--` on line 3 has no `-->`.");
    const fence = first("# A\n\n```js\nx\n", "markdown/fence-unterminated");
    assert.equal(fence.message, "The ``` fence opened on line 3 is never closed.");
    assert.equal(fence.next, "add a line with ``` to close it.");
  });
  test("a chart without a type offers the types", () => {
    const found = first("# A\n\n```chart\n```\n", "markdown/chart-type");
    assert.deepEqual(found.found.suggestions.map((entry) => entry.value), ["column", "bar", "line", "pie"]);
    assert.match(found.next, /```chart column/);
  });
  test("an empty document and a numbered list", () => {
    assert.match(first("", "markdown/no-slides").next, /^write a `# Title` line/);
    assert.equal(first("# A\n\n1. one\n2. two\n", "markdown/numbered-list").message, "Numbers in a list aren't kept: the list becomes bullets.");
  });
});

describe("patch fixes of schema findings", () => {
  const fixes = (document, keyword) => schemaFindings(document).find((found) => found.validation.keyword === keyword)?.fixes ?? [];
  test("enum: the nearest values, as replace patches", () => {
    const document = { slides: [{ title: "a" }], design: { titleAlignment: "middle" } };
    const list = fixes(document, "enum");
    assert.deepEqual(list.map((fix) => fix.title), ["Change to center", "Change to left", "Change to right"]);
    assert.deepEqual(list[0].patch, [{ op: "replace", path: "/design/titleAlignment", value: "center" }]);
    assert.equal(list[0].kind, "patch");
  });
  test("required: the property with a starter value", () => {
    const [fix] = fixes({ name: "x" }, "required");
    assert.equal(fix.title, "Add `slides`");
    assert.deepEqual(fix.patch, [{ op: "add", path: "/slides", value: [{ title: "Slide title" }] }]);
    const [name] = fixes({ slides: [{ title: "a" }], organization: { id: "acme" } }, "required");
    assert.deepEqual(name.patch.map((operation) => operation.path), ["/organization/name"]);
  });
  test("additionalProperties: rename, or move under extensions", () => {
    const titles = fixes({ slids: [{ title: "a" }] }, "additionalProperties").map((fix) => fix.title);
    assert.deepEqual(titles, ["Rename to slides", "Move into extensions"]);
    // A near miss whose right name is taken is not offered as a rename.
    assert.deepEqual(fixes({ slides: [{ title: "a" }], slids: [] }, "additionalProperties").map((fix) => fix.title), ["Move into extensions"]);
    const foo = fixes({ slides: [{ title: "a" }], foo: 1 }, "additionalProperties");
    assert.deepEqual(foo.map((fix) => fix.title), ["Move into extensions"]);
    const move = foo[0];
    assert.deepEqual(move.patch.map((operation) => operation.op), ["add", "move"]);
  });
  test("type: wrap a string in a list, write a number as text", () => {
    assert.deepEqual(fixes({ slides: [{ items: "One" }] }, "type")[0].patch, [{ op: "replace", path: "/slides/0/items", value: ["One"] }]);
    const number = schemaFindings({ slides: [{ title: "a", id: 42 }] }).find((found) => found.validation.keyword === "type");
    assert.equal(schemaFindings({ slides: [{ title: 42 }] })[0].fixes[0].title, "Convert to string");
    assert.equal(number.fixes[0].title, "Convert to string");
    assert.deepEqual(number.fixes[0].patch, [{ op: "replace", path: "/slides/0/id", value: "42" }]);
  });
  test("minItems: add the first slide", () => {
    assert.deepEqual(fixes({ slides: [] }, "minItems")[0].patch, [{ op: "add", path: "/slides/0", value: { title: "Slide title" } }]);
  });
  test("every patch fix leaves a document the schema accepts, or fewer findings", () => {
    const document = { slides: [{ title: "a" }], design: { titleAlignment: "middle" } };
    const [fix] = fixes(document, "enum");
    const next = structuredClone(document);
    next.design.titleAlignment = fix.patch[0].value;
    assert.deepEqual(schemaFindings(next), []);
  });
});
