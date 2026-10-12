// RR-60, RR-62: one reader and one writer for a deck in JSON, YAML or Markdown (`parse`, `stringify`), chosen by option or file name.
// `parse` returns the deck and throws on errors; the reader behind it, which reports instead (`readDeckReport`, exported only for
// the CLI from `@openpresentation/opf/internal/engine`), is tested here for the located findings.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { DECK_FORMATS, OPFMarkdownError, OPFValidationError, deckFormatOf, parse, stringify as writeDeck } from "../dist/index.js";
import { readDeckReport as readDeck } from "../dist/node-engine.js";
import * as deckModule from "../dist/deck.js";
import { gallery } from "@openpresentation/gallery";
import { OPFYamlError } from "../dist/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.resolve(here, "../../../examples");
const quarterly = readFileSync(path.join(examples, "markdown/quarterly-review.opf.md"), "utf8");

const BOM = String.fromCharCode(0xfeff);
const deck = {
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "Q3 Review",
  language: "en-US",
  slides: [
    { id: "one", title: "Revenue grew", items: ["Faster onboarding", "yes"] },
    { id: "two", title: "2026-10-01", text: "Kickoff" },
  ],
};

describe("the exports", () => {
  test("the root and ./deck export the same bindings", () => {
    for (const name of ["parse", "stringify", "deckFormatOf", "DECK_FORMATS"]) assert.equal(deckModule[name], { parse, stringify: writeDeck, deckFormatOf, DECK_FORMATS }[name], name);
    for (const name of ["readDeck", "writeDeck", "readDeckReport"]) assert.equal(deckModule[name], undefined, `${name} is not exported`);
    assert.deepEqual([...DECK_FORMATS], ["json", "yaml", "markdown"]);
  });

  test("the module uses no Node API, so it runs in a browser", () => {
    const source = readFileSync(path.join(here, "../src/deck.ts"), "utf8");
    assert.doesNotMatch(source, /from ["']node:|require\(|process\./);
  });
});

describe("format detection", () => {
  test("a file name says the format: .opf.md is Markdown, .yaml and .yml are YAML, anything else is JSON", () => {
    const cases = {
      "deck.opf.md": "markdown", "DECK.OPF.MD": "markdown", "dir/sub/deck.Opf.Md": "markdown",
      "deck.yaml": "yaml", "deck.opf.yaml": "yaml", "deck.YML": "yaml", "a/b.yml": "yaml",
      "deck.json": "json", "deck.opf.json": "json", "deck": "json", "": "json",
      "deck.md": "json", "notes.markdown": "json", "opf.md": "json", "deck.opf.md.txt": "json",
    };
    for (const [name, format] of Object.entries(cases)) assert.equal(deckFormatOf(name), format, name);
    assert.equal(deckFormatOf(undefined), "json");
  });

  test("an explicit format wins over the file name, and the file name over nothing", () => {
    const md = "# One\n";
    assert.equal(readDeck(md, { filename: "deck.opf.md" }).format, "markdown");
    assert.equal(readDeck(md, { format: "markdown", filename: "deck.json" }).format, "markdown");
    assert.equal(readDeck(JSON.stringify(deck), { format: "json", filename: "deck.opf.md" }).format, "json");
    assert.equal(readDeck("name: X\nslides:\n  - title: A\n", { filename: "deck.yml" }).format, "yaml");
  });

  test("a plain .md name is not a deck, and content is never sniffed", () => {
    // No format and no .opf.md name: the text is JSON, so Markdown and YAML text are JSON syntax errors that name the converter.
    for (const [text, filename] of [["# One\n", undefined], ["# One\n", "notes.md"], ["name: X\nslides:\n  - title: A\n", undefined]]) {
      const result = readDeck(text, { filename });
      assert.equal(result.format, "json");
      assert.equal(result.valid, false);
      assert.ok(result.findings.length > 0 && result.findings.every((found) => found.ruleId === "opf/json-syntax"));
    }
    // JSON text read as Markdown is a Markdown deck whose first slide is that text, not a JSON deck.
    assert.notDeepEqual(readDeck(JSON.stringify(deck), { format: "markdown" }).presentation, deck);
  });

  test("an unknown format and text that is not a string are TypeErrors", () => {
    assert.throws(() => readDeck("{}", { format: "toml" }), (error) => error instanceof TypeError && /unknown format "toml"/.test(error.message));
    assert.throws(() => readDeck(deck), TypeError);
    assert.throws(() => readDeck("{}", { catalogs: "default" }), TypeError);
    assert.throws(() => writeDeck(deck, { format: "xml" }), TypeError);
  });
});

describe("readDeck across the three formats", () => {
  test("the same deck reads the same from JSON, YAML and Markdown, with the same report shape", () => {
    for (const format of DECK_FORMATS) {
      const text = writeDeck(deck, { format });
      const result = readDeck(text, { format });
      assert.equal(result.format, format);
      assert.equal(result.valid, true, `${format}: ${JSON.stringify(result.findings)}`);
      assert.equal(result.schemaValid, true, format);
      assert.deepEqual(result.presentation, deck, format);
      assert.deepEqual(result.counts, { error: 0, warning: 0, info: 0 }, format);
      assert.equal(result.checks.syntax, "checked", format);
      assert.equal(result.checks.references, "checked", format);
    }
  });

  test("writeDeck and readDeck round trip: each format's text reads back and writes back to itself", () => {
    const decks = [deck, readDeck(quarterly, { format: "markdown" }).presentation];
    for (const original of decks)
      for (const format of DECK_FORMATS) {
        const text = writeDeck(original, { format });
        const back = readDeck(text, { format }).presentation;
        assert.deepEqual(back, original, format);
        assert.equal(writeDeck(back, { format }), text, format);
      }
  });

  test("the Markdown example deck reads by its name and writes back to its own text", () => {
    const result = readDeck(quarterly, { filename: "quarterly-review.opf.md", catalogs: [gallery] });
    assert.equal(result.format, "markdown");
    assert.equal(result.valid, true);
    assert.deepEqual(result.findings, []);
    assert.equal(writeDeck(result.presentation, { filename: "x.opf.md" }), quarterly);
  });

  test("the catalogs option feeds the references check of every format", () => {
    for (const format of DECK_FORMATS) {
      const text = writeDeck(readDeck(quarterly, { format: "markdown" }).presentation, { format });
      const without = readDeck(text, { format });
      const withDefault = readDeck(text, { format, catalogs: [gallery] });
      assert.ok(without.counts.warning > 0, `${format}: references to a catalog nothing registered`);
      assert.equal(withDefault.counts.warning, 0, format);
      // `validate` options that name no catalogs get the option; ones that do keep their own.
      assert.equal(readDeck(text, { format, catalogs: [gallery], validate: { only: ["references"] } }).counts.warning, 0, format);
      assert.ok(readDeck(text, { format, catalogs: [gallery], validate: { only: ["references"], catalogs: [] } }).counts.warning > 0, format);
    }
  });

  test("validate: false reads without checking the deck", () => {
    const invalid = { name: "X", language: 5, slides: [{ title: "A" }] };
    for (const format of DECK_FORMATS) {
      const text = format === "json" ? JSON.stringify(invalid) : format === "yaml" ? "name: X\nlanguage: 5\nslides:\n  - title: A\n" : "---\nname: X\nlanguage: 5\n---\n\n# A\n";
      const checked = readDeck(text, { format });
      assert.equal(checked.valid, false, format);
      assert.equal(checked.schemaValid, false, format);
      const unchecked = readDeck(text, { format, validate: false });
      assert.equal(unchecked.valid, true, format);
      assert.equal(unchecked.schemaValid, null, format);
      assert.deepEqual(unchecked.findings, [], format);
      assert.equal(unchecked.presentation.name, "X", format);
    }
  });
});

describe("located findings", () => {
  const invalid = {
    json: '{\n  "name": "X",\n  "language": 5,\n  "slides": [{ "title": "A" }]\n}\n',
    yaml: "name: X\nlanguage: 5\nslides:\n  - title: A\n",
    markdown: "---\nname: X\nlanguage: 5\n---\n\n# A\n",
  };

  test("a validation finding is located at the text of the field it names, in every format", () => {
    const lines = { json: 3, yaml: 2, markdown: 3 };
    for (const format of DECK_FORMATS) {
      const result = readDeck(invalid[format], { format });
      const found = result.findings.find((entry) => entry.path === "/language");
      assert.ok(found, format);
      assert.equal(found.location.line, lines[format], format);
      const text = invalid[format];
      assert.equal(text.slice(found.location.offset, found.location.offset + found.location.length).includes("5") || found.location.length === 0 || format === "markdown", true, format);
      assert.ok(found.location.column >= 1, format);
    }
  });

  test("a JSON syntax error is opf/json-syntax with line and column; the deck is empty and nothing else ran", () => {
    const result = readDeck('{\n  "name": "X",\n  "slides": [\n', { filename: "deck.json" });
    assert.equal(result.valid, false);
    assert.equal(result.schemaValid, null);
    assert.deepEqual(result.presentation, {});
    const first = result.findings[0];
    assert.equal(first.ruleId, "opf/json-syntax");
    assert.equal(first.severity, "error");
    assert.ok(first.location.line >= 3 && first.location.column >= 1);
    assert.equal(result.checks.schema, "not-run");
  });

  test("JSON duplicate keys are located; a BOM is accepted", () => {
    const result = readDeck(BOM + '{"name": "A", "name": "B", "slides": [{"title": "A"}]}');
    assert.ok(result.findings.some((found) => found.ruleId === "opf/duplicate-key" && found.location.line === 1));
    assert.equal(readDeck(`${BOM}${JSON.stringify(deck)}`).presentation.name, "Q3 Review");
  });

  test("a YAML syntax error is yaml/<rule> with line and column and stops the OPF check", () => {
    const result = readDeck("name: X\nname: Y\nslides: []\n", { filename: "deck.opf.yaml" });
    assert.equal(result.valid, false);
    const first = result.findings[0];
    assert.equal(first.ruleId, "yaml/duplicate-key");
    assert.equal(first.location.line, 2);
    assert.equal(result.schemaValid, null);
  });

  test("a Markdown error is markdown/<rule> with line and column, and the report still has the validate shape", () => {
    const result = readDeck("---\nname: X\n\n# Title\n", { filename: "deck.opf.md" });
    assert.equal(result.valid, false);
    const first = result.findings[0];
    assert.equal(first.ruleId, "markdown/front-matter-unterminated");
    assert.equal(first.severity, "error");
    assert.deepEqual([first.location.line, first.location.column], [1, 1]);
    assert.equal(typeof result.checks, "object");
    assert.equal(typeof result.presentation, "object");
  });

  test("a Markdown warning does not make the deck invalid", () => {
    const result = readDeck("# One\n\n---\n\n---\n\n# Two\n", { format: "markdown" });
    assert.equal(result.valid, true);
    assert.ok(result.findings.some((found) => found.ruleId === "markdown/empty-slide" && found.severity === "warning"));
    assert.equal(result.presentation.slides.length, 2);
  });
});

describe("stringify", () => {
  test("writes each format from the format option or the file name", () => {
    assert.equal(writeDeck(deck), `${JSON.stringify(deck, null, 2)}\n`);
    assert.equal(writeDeck(deck, { filename: "deck.opf.json" }), writeDeck(deck, { format: "json" }));
    assert.match(writeDeck(deck, { filename: "deck.opf.yaml" }), /^\$schema: https:\/\/openpresentation\.org\/schema\/opf\/v1\nname: Q3 Review\n/);
    assert.match(writeDeck(deck, { filename: "deck.opf.md" }), /^---\n\$schema: [^\n]+\nname: Q3 Review\nlanguage: en-US\n---\n\n<!-- slide: id=one -->\n# Revenue grew\n/);
    assert.equal(writeDeck(deck, { format: "markdown", filename: "deck.json" }), writeDeck(deck, { filename: "deck.opf.md" }));
  });

  test("schemaComment starts a YAML file with the modeline", () => {
    assert.match(writeDeck(deck, { format: "yaml", schemaComment: true }), /^# yaml-language-server: \$schema=https:\/\/openpresentation\.org\/schema\/opf\/v1\n/);
    assert.doesNotMatch(writeDeck(deck, { format: "yaml" }), /yaml-language-server/);
  });

  test("YAML and Markdown refuse a document that is not valid OPF; JSON writes what it is given", () => {
    assert.throws(() => writeDeck({ slides: "no" }, { format: "yaml" }), OPFYamlError);
    assert.throws(() => writeDeck({ slides: "no" }, { format: "markdown" }), (error) => error instanceof OPFMarkdownError && error.code === "invalid-document");
    assert.equal(writeDeck({ slides: "no" }), '{\n  "slides": "no"\n}\n');
  });

  test("content Markdown has no syntax for is embedded in a fence and survives the round trip", () => {
    const styled = { ...deck, slides: [{ id: "one", title: "Styled", design: { colorScheme: "forest-green" } }] };
    const text = writeDeck(styled, { format: "markdown" });
    assert.match(text, /```opf-slide/);
    const back = readDeck(text, { format: "markdown" });
    assert.equal(back.valid, true, JSON.stringify(back.findings));
    assert.deepEqual(back.presentation, styled);
  });
});

describe("parse", () => {
  test("returns the deck, the same from every format, by format option or file name", () => {
    for (const format of DECK_FORMATS) {
      assert.deepEqual(parse(writeDeck(deck, { format }), { format }), deck, format);
      assert.deepEqual(parse(writeDeck(deck, { format }), { filename: `deck.opf.${format === "markdown" ? "md" : format}` }), deck, format);
    }
    assert.equal(parse(quarterly, { filename: "quarterly-review.opf.md", catalogs: [gallery] }).name, readDeck(quarterly, { format: "markdown" }).presentation.name);
  });

  test("throws OPFValidationError for syntax, schema and reference errors, with findings located by line and column", () => {
    const cases = [
      ['{\n  "name": "X",\n  "slides": [\n', "deck.json", "opf/json-syntax"],
      ["name: X\nname: Y\nslides: []\n", "deck.opf.yaml", "yaml/duplicate-key"],
      ["---\nname: X\n\n# Title\n", "deck.opf.md", "markdown/front-matter-unterminated"],
      ["name: X\nlanguage: 5\nslides:\n  - title: A\n", "deck.yaml", undefined],
    ];
    for (const [text, filename, ruleId] of cases) {
      assert.throws(
        () => parse(text, { filename }),
        (error) => {
          assert.ok(error instanceof OPFValidationError, filename);
          assert.equal(error.report.valid, false, filename);
          const first = error.findings[0];
          if (ruleId) assert.equal(first.ruleId, ruleId, filename);
          assert.ok(first.location.line >= 1 && first.location.column >= 1, filename);
          return true;
        },
      );
    }
    // A reference to a catalog group the deck does not declare is an error.
    assert.throws(() => parse('{"slides":[{"title":"A","layout":"nowhere:two-column"}]}'), OPFValidationError);
  });

  test("warnings do not throw: validate reports them", () => {
    assert.equal(parse("# One\n\n---\n\n---\n\n# Two\n", { format: "markdown" }).slides.length, 2);
  });

  test("text that is not a string and an unknown format are TypeErrors", () => {
    assert.throws(() => parse(deck), TypeError);
    assert.throws(() => parse("{}", { format: "toml" }), (error) => error instanceof TypeError && /^parse: unknown format/.test(error.message));
  });
});
