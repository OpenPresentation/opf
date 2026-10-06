import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { formatPresentation } from "../dist/format.js";
import { OPFYamlError, YAML_SCHEMA_URL, fromYaml, lintYamlSource, parseYamlData, scanYamlComments, toYaml, yamlLocator } from "../dist/yaml.js";

const examplesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples");

function* exampleFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* exampleFiles(full);
    else if (entry.name.endsWith(".opf.json")) yield full;
  }
}

const convert = (source, options) => fromYaml(source, options);
const errors = (source, options) => convert(source, options).diagnostics.filter((d) => d.severity === "error");
const rule = (source, id, options) => convert(source, options).diagnostics.find((d) => d.ruleId === id);
/** Text of the source at a diagnostic location. */
const at = (source, diagnostic) => source.slice(diagnostic.location.offset, diagnostic.location.offset + diagnostic.location.length);
const where = (diagnostic) => [diagnostic.location.line, diagnostic.location.column];

describe("example decks", () => {
  const files = [...exampleFiles(examplesRoot)];

  test("there are 126 example decks", () => {
    assert.equal(files.length, 126);
  });

  test("every example round-trips JSON to YAML to JSON deep-equal, and YAML to JSON to YAML byte for byte", () => {
    for (const file of files) {
      const deck = JSON.parse(readFileSync(file, "utf8"));
      const label = path.relative(examplesRoot, file);
      const { yaml } = toYaml(deck);
      const back = fromYaml(yaml);
      assert.deepEqual(
        back.diagnostics.filter((d) => d.severity === "error"),
        [],
        label,
      );
      assert.deepEqual(back.document, deck, label);
      // The same data in the same canonical key order as the formatter writes.
      assert.equal(JSON.stringify(back.document), formatPresentation(deck, { indent: 0 }).trimEnd(), label);
      assert.equal(toYaml(back.document).yaml, yaml, label);
      assert.equal(toYaml(structuredClone(deck)).yaml, yaml, `${label}: the same deck always gives the same text`);
    }
  });

  test("no example needs aliases, so the strict reader and the alias reader agree", () => {
    const file = files[0];
    const { yaml } = toYaml(JSON.parse(readFileSync(file, "utf8")));
    assert.deepEqual(fromYaml(yaml, { aliases: true }).document, fromYaml(yaml).document);
  });
});

describe("YAML to OPF", () => {
  test("a small deck converts and the result carries only what the YAML says", () => {
    const result = convert("name: Q3 Review\nslides:\n  - title: Hello\n    items:\n      - one\n      - two\n");
    assert.equal(result.valid, true);
    assert.deepEqual(result.document, { name: "Q3 Review", slides: [{ title: "Hello", items: ["one", "two"] }] });
    assert.deepEqual(result.counts, { error: 0, warning: 0, info: 0 });
  });

  test("the result of an unreadable document is an empty object, never a thrown error", () => {
    for (const source of ["", "a: [", "- a", "a: *x", "a: 1\n---\nb: 2\n"]) {
      const result = convert(source);
      assert.equal(result.valid, false, source);
      assert.deepEqual(result.document, {});
    }
    assert.throws(() => fromYaml(42), TypeError);
  });

  test("validate: false skips the OPF lint", () => {
    const source = "slides:\n  - title: 5\n";
    assert.equal(convert(source).valid, false);
    const result = convert(source, { validate: false });
    assert.equal(result.valid, true);
    assert.deepEqual(result.diagnostics, []);
  });

  test("2026-10-01, yes, no, on and off stay strings, and so does 1_000", () => {
    const { document } = convert("slides:\n  - title: 2026-10-01\n    notes: yes\n    text: on\n    subtitle: off\n    tag: no\n    section: 1_000\n");
    assert.deepEqual(document.slides[0], { title: "2026-10-01", notes: "yes", text: "on", subtitle: "off", tag: "no", section: "1_000" });
    assert.equal(convert("name: 12\nslides: []\n").document.name, 12, "a number stays a number (and the schema then rejects it)");
  });

  test("a leading BOM and CRLF line endings are tolerated, and locations skip the BOM", () => {
    const source = "﻿name: Deck\r\nslides:\r\n  - title: 7\r\n";
    const result = convert(source);
    assert.equal(result.document.name, "Deck");
    const found = result.diagnostics.find((d) => d.path === "/slides/0/title");
    assert.deepEqual(where(found), [3, 12]);
    assert.equal(at(source, found), "7");
    assert.deepEqual(convert("﻿name: Deck\nslides:\n  - title: A\n").diagnostics, []);
  });
});

describe("strict dialect", () => {
  test("an empty input, comments only, a list and a scalar are errors", () => {
    assert.deepEqual(where(rule("", "yaml/empty")), [1, 1]);
    assert.ok(rule("# nothing here\n", "yaml/empty"));
    const list = rule("- a\n- b\n", "yaml/not-mapping");
    assert.deepEqual(where(list), [1, 1]);
    assert.ok(rule("just text\n", "yaml/not-mapping"));
  });

  test("several documents are an error, at the second document", () => {
    const source = "name: a\nslides: []\n---\nname: b\n";
    const found = rule(source, "yaml/multiple-documents");
    assert.equal(found.severity, "error");
    assert.deepEqual(where(found), [3, 1]);
    assert.match(found.help, /exactly one document/);
  });

  test("a syntax error carries its line and column", () => {
    const source = "name: a\nslides:\n  - title: [oops\n    text: x\n";
    const found = errors(source).find((d) => d.ruleId === "yaml/syntax");
    assert.ok(found);
    assert.match(found.message, /^YAML:/);
    assert.equal(found.location.line >= 3, true);
  });

  test("a duplicate key is an error at the repeated key", () => {
    const source = "name: a\nslides:\n  - title: x\nname: b\n";
    const found = rule(source, "yaml/duplicate-key");
    assert.deepEqual(where(found), [4, 1]);
    assert.equal(at(source, found), "name");
  });

  test("custom tags and the tags of other schemas are an error", () => {
    const custom = "name: !custom x\nslides: [{title: a}]\n";
    assert.deepEqual(where(rule(custom, "yaml/tag")), [1, 7]);
    const binary = "name: !!binary aGk=\nslides: [{title: a}]\n";
    const tagged = rule(binary, "yaml/tag");
    assert.match(tagged.message, /The tag !!binary is not allowed/);
    assert.equal(at(binary, tagged), "!!binary");
    assert.match(rule(custom, "yaml/tag").message, /The tag !custom is not allowed|Unresolved tag: !custom/);
    assert.ok(rule("slides:\n  - title: a\n    extensions: !!set {x}\n", "yaml/tag"));
    // The core schema's own tags are not custom.
    assert.equal(convert("name: !!str 123\nslides: [{title: a}]\n").document.name, "123");
  });

  test("anchors, aliases and merge keys are an error that points at aliases: true", () => {
    const anchor = "name: &n Deck\nslides: [{title: a}]\n";
    const found = rule(anchor, "yaml/alias");
    assert.deepEqual(where(found), [1, 7]);
    assert.equal(at(anchor, found), "&n");
    assert.match(found.message, /anchor &n/);
    assert.match(found.help, /aliases: true/);
    const alias = rule("a: &n x\nname: *n\nslides: []\n", "yaml/alias");
    assert.ok(alias);
    const merge = rule("<<: {name: x}\nslides: [{title: a}]\n", "yaml/alias");
    assert.deepEqual(where(merge), [1, 1]);
    assert.match(merge.message, /merge key/);
    // A quoted << is an ordinary key, not a merge key.
    assert.equal(rule("'<<': 1\nslides: [{title: a}]\n", "yaml/alias"), undefined);
  });

  test(".inf and .nan are an error that suggests quoting, finite numbers pass", () => {
    const source = "name: Deck\nslides:\n  - title: x\n    extensions:\n      a: .inf\n      b: -.inf\n      c: .nan\n      d: 1e3\n      e: -0.5\n";
    const found = errors(source).filter((d) => d.ruleId === "yaml/number");
    assert.equal(found.length, 3);
    assert.deepEqual(where(found[0]), [5, 10]);
    assert.match(found[0].help, /Quote it/);
    assert.equal(convert("name: Deck\nslides:\n  - title: x\n    extensions:\n      a: \".inf\"\n      d: 1e3\n").valid, true);
  });

  test("a key that is not a string is an error", () => {
    for (const source of ["1: a\nslides: []\n", "true: a\nslides: []\n", "null: a\nslides: []\n", "? [a]\n: b\nslides: []\n"]) assert.ok(rule(source, "yaml/key"), source);
    assert.equal(rule("'1': a\nslides: [{title: x}]\n", "yaml/key"), undefined);
  });

  test("a __proto__ key is data, never a prototype", () => {
    const { document } = convert("name: Deck\nslides:\n  - title: x\n    extensions:\n      __proto__:\n        polluted: true\n");
    assert.equal(Object.hasOwn(document.slides[0].extensions, "__proto__"), true);
    assert.equal({}.polluted, undefined);
    assert.equal(Object.getPrototypeOf(document.slides[0].extensions), Object.prototype);
  });
});

describe("aliases: true", () => {
  const deck = `name: Deck
slides:
  - title: One
    extensions:
      shared: &shared
        owner: ops
        tags: [a, b]
  - title: Two
    extensions:
      shared: *shared
      other:
        <<: *shared
        extra: 1
`;

  test("anchors, aliases and merge keys expand to plain data", () => {
    const result = convert(deck, { aliases: true });
    assert.equal(result.valid, true);
    const [one, two] = result.document.slides;
    assert.deepEqual(one.extensions.shared, { owner: "ops", tags: ["a", "b"] });
    assert.deepEqual(two.extensions.shared, { owner: "ops", tags: ["a", "b"] });
    assert.deepEqual(two.extensions.other, { owner: "ops", tags: ["a", "b"], extra: 1 });
    // The expanded deck is plain data: it writes without any anchor, alias or merge key.
    const { yaml } = toYaml(result.document);
    assert.doesNotMatch(yaml, /[&*]|<</);
  });

  test("without the option the same text is refused at each use", () => {
    const refused = errors(deck).filter((d) => d.ruleId === "yaml/alias");
    assert.deepEqual(refused.map(where), [[5, 15], [10, 15], [12, 9]]);
  });

  test("an alias that nests aliases beyond 100 is refused (exponential expansion)", () => {
    let source = "a: &a [x, x, x, x, x, x, x, x, x, x]\n";
    let previous = "a";
    for (let i = 0; i < 8; i++) {
      const name = String.fromCharCode(98 + i);
      source += `${name}: &${name} [${Array(10).fill(`*${previous}`).join(", ")}]\n`;
      previous = name;
    }
    source += "slides: [{title: x}]\n";
    const found = rule(source, "yaml/alias-limit", { aliases: true });
    assert.ok(found, "the expansion is refused");
    assert.match(found.message, /limit of 100/);
    assert.deepEqual(convert(source, { aliases: true }).document, {});
  });

  test("the cap counts the nodes the aliases expand to: 99 aliases of a scalar pass, 100 do not", () => {
    const many = (count) => `name: Deck\nslides:\n  - title: x\n    extensions:\n      base: &b 1\n${Array.from({ length: count }, (_, i) => `      k${i}: *b`).join("\n")}\n`;
    assert.equal(convert(many(99), { aliases: true }).valid, true);
    assert.ok(rule(many(100), "yaml/alias-limit", { aliases: true }));
  });

  test("an alias inside its own anchor is a cycle error", () => {
    const source = "name: Deck\nslides:\n  - title: x\n    extensions:\n      loop: &loop\n        again: *loop\n";
    const found = rule(source, "yaml/alias-cycle", { aliases: true });
    assert.ok(found);
    assert.deepEqual(where(found), [6, 16]);
    assert.ok(rule("a: &a [*a]\nslides: []\n", "yaml/alias-cycle", { aliases: true }));
  });

  test("keys, tags and numbers are still checked", () => {
    assert.ok(rule("k: &k 1\n*k : x\nslides: []\n", "yaml/key", { aliases: true }));
    assert.ok(rule("a: &a !custom x\nslides: []\n", "yaml/tag", { aliases: true }));
    assert.ok(rule("a: &a .inf\nb: *a\nslides: []\n", "yaml/number", { aliases: true }));
  });

  test("an unresolved alias is an error", () => {
    assert.ok(errors("name: *missing\nslides: []\n", { aliases: true }).length > 0);
  });
});

describe("OPF lint findings are located in the YAML", () => {
  const source = `name: Located
slides:
  - title: Fine
  - title: 5
    items:
      - one
    foo: bar
  - blocks:
      - text: ok
        mystery: true
`;

  test("a schema error points at the value that is wrong", () => {
    const result = convert(source);
    assert.equal(result.valid, false);
    const title = result.diagnostics.find((d) => d.path === "/slides/1/title");
    assert.match(title.ruleId, /^opf\//);
    assert.deepEqual(where(title), [4, 12]);
    assert.equal(at(source, title), "5");
    const extra = result.diagnostics.find((d) => d.path === "/slides/1/foo");
    assert.equal(extra.location.line, 7);
    assert.equal(at(source, extra), "bar");
    const nested = result.diagnostics.find((d) => d.path === "/slides/2/blocks/0/mystery");
    assert.equal(nested.location.line, 10);
  });

  test("a finding with no node of its own falls back to the nearest ancestor", () => {
    const result = convert("name: Empty\nslides: []\n");
    const found = result.diagnostics.find((d) => d.path === "/slides");
    assert.deepEqual(where(found), [2, 1]);
    const missing = convert("name: no slides\n");
    const root = missing.diagnostics.find((d) => d.severity === "error");
    assert.deepEqual(where(root), [1, 1]);
  });

  test("diagnostics are in source order and use the lint shape", () => {
    const result = convert(source);
    const offsets = result.diagnostics.map((d) => d.location.offset);
    assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
    for (const d of result.diagnostics) {
      assert.equal(typeof d.ruleId, "string");
      assert.ok(["error", "warning", "info"].includes(d.severity));
      assert.equal(d.scope, "document");
      assert.equal(typeof d.help, "string");
      for (const key of ["offset", "length", "line", "column"]) assert.equal(Number.isInteger(d.location[key]), true);
    }
    assert.equal(result.counts.error, result.diagnostics.filter((d) => d.severity === "error").length);
  });

  test("yamlLocator finds the same places for a tool's own findings", () => {
    const locate = yamlLocator(source);
    assert.deepEqual([locate("/slides/1/title").line, locate("/slides/1/title").column], [4, 12]);
    assert.equal(locate("/slides/9/title").line, 2, "a missing path falls back to its nearest ancestor");
    assert.equal(yamlLocator("a: [")("/a"), undefined);
  });
});

describe("OPF to YAML", () => {
  test("writes canonical schema key order, two-space block style and no folding", () => {
    const long = "word ".repeat(80).trim();
    const { yaml } = toYaml({ slides: [{ text: long, title: "T", id: "s1" }], name: "Deck", $schema: YAML_SCHEMA_URL });
    assert.equal(yaml.split("\n")[0], `$schema: ${YAML_SCHEMA_URL}`);
    assert.deepEqual(yaml.split("\n").filter((line) => /^\S/.test(line)).map((line) => line.split(":")[0]), ["$schema", "name", "slides"]);
    assert.match(yaml, /\nslides:\n {2}- id: s1\n {4}title: T\n {4}text: word word/);
    assert.ok(yaml.includes(long), "a long line is not folded");
    assert.equal(yaml.endsWith("\n"), true);
    assert.equal(yaml.includes("{"), false, "block style only");
  });

  test("strings that would read as another type are quoted, and read back as the same text", () => {
    const strings = ["yes", "No", "on", "OFF", "y", "n", "2026-10-01", "2026-10-01T10:00:00Z", "123", "-1.5", "1e3", "0x1F", "0o17", "010", "1_000", "12:30", "null", "~", "true", "False", ".inf", ".nan", "=", "<<", "  leading", "trailing  ", "a #b", "# c", "a: b", "- dash", "'single'", '"double"', "", "multi\nline\n", "tab\there", "ünïcode ✓ 日本語", "emoji 🎉"];
    const deck = { name: "Deck", slides: [{ title: "T", items: strings }] };
    const { yaml } = toYaml(deck);
    assert.deepEqual(fromYaml(yaml).document, deck);
    for (const text of ["yes", "2026-10-01", "123", "null", "  leading", "trailing  "]) {
      const line = yaml.split("\n").find((l) => l.trim().replace(/^- /, "").startsWith(`"${text}`) || l.trim().replace(/^- /, "").startsWith(`'${text}`));
      assert.ok(line, `${JSON.stringify(text)} is quoted`);
    }
    assert.match(yaml, /- "yes"/);
    assert.match(yaml, /- "2026-10-01"/);
    assert.match(yaml, /- "123"/);
    assert.match(yaml, /- "null"/);
    assert.match(yaml, /- "# c"/);
    assert.match(yaml, /- "a: b"/);
    assert.match(yaml, /- "  leading"/);
    assert.match(yaml, /- "trailing {2}"/);
    assert.deepEqual(toYaml(fromYaml(yaml).document).yaml, yaml);
  });

  test("keys that look like booleans are quoted too, and numbers stay numbers", () => {
    const deck = { name: "Deck", slides: [{ title: "T", extensions: { yes: 1, on: true, "2026-10-01": "d", plain: 12, ratio: 0.25, big: 1e21, neg: -3, flag: false, nothing: null } }] };
    const { yaml } = toYaml(deck);
    assert.match(yaml, /"yes": 1/);
    assert.match(yaml, /"on": true/);
    assert.match(yaml, /plain: 12/);
    assert.deepEqual(fromYaml(yaml).document, deck);
  });

  test("an invalid deck throws OPFYamlError with code invalid-document", () => {
    for (const bad of [{ slides: "x" }, {}, { slides: [{ title: 5 }] }, null, 42]) {
      assert.throws(
        () => toYaml(bad),
        (error) => error instanceof OPFYamlError && error.code === "invalid-document" && Array.isArray(error.details.issues) && error.name === "OPFYamlError",
      );
    }
  });

  test("a value YAML cannot carry exactly is refused, never written wrongly", () => {
    const deck = { name: "Deck", slides: [{ title: "T", extensions: { lone: "\uD800" } }] };
    try {
      const { yaml } = toYaml(deck);
      assert.deepEqual(fromYaml(yaml).document, deck);
    } catch (error) {
      assert.ok(error instanceof OPFYamlError);
      assert.equal(error.code, "not-representable");
    }
  });

  test("schemaComment prepends the editor modeline with the schema URL", () => {
    const plain = { name: "Deck", slides: [{ title: "T" }] };
    assert.equal(YAML_SCHEMA_URL, "https://openpresentation.org/schema/opf/v1");
    const withDefault = toYaml(plain, { schemaComment: true }).yaml;
    assert.equal(withDefault.split("\n")[0], `# yaml-language-server: $schema=${YAML_SCHEMA_URL}`);
    assert.equal(toYaml(plain).yaml, withDefault.split("\n").slice(1).join("\n"));
    const own = toYaml({ $schema: YAML_SCHEMA_URL, ...plain }, { schemaComment: true }).yaml;
    assert.equal(own.split("\n")[0], `# yaml-language-server: $schema=${YAML_SCHEMA_URL}`);
    assert.equal(own.split("\n")[1], `$schema: ${YAML_SCHEMA_URL}`);
    // The comment is not data: both read back to the deck, and the modeline is found.
    assert.deepEqual(fromYaml(withDefault).document, plain);
    assert.equal(scanYamlComments(withDefault).modeline, `# yaml-language-server: $schema=${YAML_SCHEMA_URL}`);
    assert.equal(scanYamlComments(withDefault).count, 0);
  });

  test("scanYamlComments counts the comments a rewrite would lose", () => {
    assert.equal(scanYamlComments("name: a\n").count, 0);
    assert.equal(scanYamlComments("# top\nname: a # trailing\nslides:\n  # between\n  - title: x\n").count, 3);
    assert.equal(scanYamlComments("﻿# yaml-language-server: $schema=x\nname: a\n").count, 0);
    assert.equal(scanYamlComments("name: 'a # not a comment'\n").count, 0);
  });

  test("a read-write-read cycle is stable for hand-written YAML with comments, quotes and block scalars", () => {
    const handwritten = `# yaml-language-server: $schema=${YAML_SCHEMA_URL}
name: "Quarterly review"   # the deck
slides:
  - title: 'Revenue'
    text: |-
      Line one
      Line two
    items: [a, b, "c: d"]
`;
    const first = fromYaml(handwritten);
    assert.equal(first.valid, true);
    const canonical = toYaml(first.document).yaml;
    assert.deepEqual(fromYaml(canonical).document, first.document);
    assert.equal(toYaml(fromYaml(canonical).document).yaml, canonical);
  });
});

describe("lintYamlSource and parseYamlData", () => {
  test("lintYamlSource reports like lintSource, located in the YAML", () => {
    const report = lintYamlSource("name: Lint\nslides:\n  - title: Target\n    layout: pratner\n");
    assert.equal(report.valid, true);
    assert.equal(report.schemaValid, true);
    assert.equal(report.checks.syntax, "checked");
    const warning = report.diagnostics.find((d) => d.severity === "warning");
    assert.deepEqual([warning.location.line, warning.location.column], [4, 13]);
    const broken = lintYamlSource("name: a\nname: b\n");
    assert.equal(broken.valid, false);
    assert.equal(broken.schemaValid, null);
    assert.equal(broken.checks.schema, "not-run");
    assert.equal(broken.diagnostics[0].ruleId, "yaml/duplicate-key");
    assert.throws(() => lintYamlSource(1), TypeError);
  });

  test("parseYamlData reads any JSON-compatible root in the same dialect", () => {
    assert.deepEqual(parseYamlData("- op: add\n  path: /name\n  value: x\n"), { value: [{ op: "add", path: "/name", value: "x" }], valid: true, diagnostics: [] });
    assert.equal(parseYamlData("a: *x\n").valid, false);
    assert.equal(parseYamlData("a: *x\n").value, null);
    assert.equal(parseYamlData("a: &x 1\nb: *x\n", { aliases: true }).valid, true);
    assert.equal(parseYamlData("").diagnostics[0].ruleId, "yaml/empty");
    assert.equal(parseYamlData("5").valid, true);
  });
});

describe("the guide", () => {
  const guide = readFileSync(path.resolve(examplesRoot, "../docs/yaml.md"), "utf8");
  const blocks = [...guide.matchAll(/```yaml\n([\s\S]*?)```/g)].map((match) => match[1]);

  test("the example deck is valid, canonical and reads back as shown", () => {
    const example = blocks[0];
    const result = fromYaml(example);
    assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
    assert.equal(result.document.name, "Q3 Business Review");
    assert.equal(result.document.slides[1].blocks[0].chart.data.rows[1][1], 18);
    assert.equal(toYaml(result.document, { schemaComment: true }).yaml, example);
  });

  test("the alias example expands as the guide says", () => {
    const aliased = blocks.find((block) => block.includes("&owner"));
    assert.equal(fromYaml(aliased).valid, false);
    const result = fromYaml(aliased, { aliases: true });
    assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
    const [one, two] = result.document.slides;
    assert.deepEqual(one.extensions.owner, { team: "ops", oncall: true });
    assert.deepEqual(two.extensions.other, { team: "ops", oncall: true, extra: 1 });
  });
});
