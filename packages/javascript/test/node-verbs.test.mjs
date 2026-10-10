// RR-75: core's Node build has the CLI's verbs with the CLI's defaults. validate, stats, paginate, embed and edit register the
// default catalog when a call names none, so `opf validate deck` and `validate(deck)` agree; fill and edit are new verbs. The
// browser build (dist/browser.js, what the browser, worker and default conditions resolve to) exports the same names and registers
// no catalog (FA-21): a host passes its own.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import * as node from "../dist/index.js";
import * as browser from "../dist/browser.js";
import { gallery } from "@openpresentation/gallery";

const cli = fileURLToPath(new URL("../../cli/dist/index.js", import.meta.url));
// A deck whose layout resolves only in the default catalog: unresolved (a warning) without it.
const deck = { name: "Verbs", slides: [{ id: "a", title: "Two columns", layout: "two-column" }, { id: "b", title: "Plain", text: "body" }] };
const unresolved = (report) => report.findings.filter((finding) => finding.ruleId === "opf/unresolved-reference");

describe("the Node build's defaults are the CLI's", () => {
  test("validate registers the default catalog unless the call names catalogs", () => {
    assert.deepEqual(unresolved(node.validate(deck)), []);
    assert.equal(unresolved(node.validate(deck, { catalogs: [] })).length, 1, "an explicit empty list registers none");
    assert.equal(unresolved(browser.validate(deck)).length, 1, "the browser build registers none");
    assert.deepEqual(unresolved(browser.validate(deck, { catalogs: [gallery] })), []);
  });

  // The core publish run (npm-publish.yml) runs `pnpm test` without building the CLI first, so its dist can be absent.
  test("opf validate and validate() agree on the same deck", { skip: !existsSync(cli) && "the CLI is not built" }, () => {
    const result = spawnSync(process.execPath, [cli, "validate", "-"], { input: JSON.stringify(deck), encoding: "utf8" });
    if (result.error) return;
    const report = JSON.parse(result.stdout);
    const api = node.validate(deck);
    assert.deepEqual(report.findings.map((finding) => finding.ruleId), api.findings.map((finding) => finding.ruleId));
    assert.deepEqual(report.counts, api.counts);
  });

  test("stats, paginate and embed resolve in the default catalog too", () => {
    assert.equal(node.stats(deck).slides.total, 2);
    assert.equal(node.paginate(deck).presentation.slides.length, 2);
    assert.equal(node.paginate(deck).layout, "estimated", "without a fonts handle the page breaks are estimated");
    const embedded = node.embed(deck);
    assert.ok(embedded.added.some((record) => record.kind === "layouts" && record.id === "two-column"));
    assert.equal(embedded.document.catalogs.default.source, gallery.source);
    assert.deepEqual(browser.embed(deck).added, [], "the browser build has no catalog to embed from");
    assert.ok(browser.embed(deck, { catalogs: [gallery] }).added.length > 0);
  });
});

describe("edit", () => {
  test("applies a JSON Patch, checks the result and returns the inverse; the input never changes", () => {
    const before = structuredClone(deck);
    const result = node.edit(deck, [{ op: "replace", path: "/slides/1/title", value: "Edited" }]);
    assert.equal(result.presentation.slides[1].title, "Edited");
    assert.deepEqual(deck, before);
    assert.deepEqual(node.edit(result.presentation, result.inverse).presentation, deck);
    assert.deepEqual(unresolved(result), []);
    assert.equal(unresolved(browser.edit(deck, [])).length, 1, "the browser build's check has no catalog");
  });

  test("a failing patch throws OPFPatchError; an invalid result throws OPFValidationError unless validate is false", () => {
    assert.throws(() => node.edit(deck, [{ op: "test", path: "/name", value: "Other" }]), node.OPFPatchError);
    assert.throws(() => node.edit(deck, [{ op: "replace", path: "/slides", value: 42 }]), node.OPFValidationError);
    assert.equal(node.edit(deck, [{ op: "replace", path: "/slides", value: 42 }], { validate: false }).presentation.slides, 42);
  });
});

describe("fill", () => {
  const template = { name: "Hello", variables: { who: { type: "text", label: "Who" }, team: { type: "text", value: "Core" } }, slides: [{ id: "s", title: "Hello {{who}}", text: "{{team}}" }] };

  test("one deck per CSV row, JSON object or record; combine joins them", () => {
    const rows = node.fill(template, "who,team\nAda,\nBob,Docs\n");
    assert.deepEqual(rows.decks.map((item) => item.presentation.slides[0].title), ["Hello Ada", "Hello Bob"]);
    assert.deepEqual(rows.decks.map((item) => item.presentation.slides[0].text), ["Core", "Docs"], "a blank cell keeps the declared value");
    assert.deepEqual(rows.decks.map((item) => item.index), [1, 2]);
    assert.equal(rows.complete, true);
    assert.equal(node.fill(template, '{"who":"Cy"}').decks[0].presentation.slides[0].title, "Hello Cy");
    assert.equal(node.fill(template, [{ who: "Di" }, { who: "Ed" }]).decks.length, 2);
    assert.equal(node.fill(template, { who: "Fay" }).decks[0].presentation.slides[0].title, "Hello Fay");
    const combined = node.fill(template, "who\nAda\nBob\n", { combine: true }).presentation;
    assert.deepEqual(combined.slides.map((slide) => slide.id), ["s", "s-2"]);
    assert.deepEqual(node.fillRecords("a\tb\n1\t2\n", { format: "tsv" }), [{ a: "1", b: "2" }]);
  });

  test("an unfilled required variable is an error diagnostic, unless partial; examples fill from the declared example", () => {
    const missing = node.fill(template);
    assert.equal(missing.complete, false);
    assert.ok(missing.diagnostics.some((entry) => entry.severity === "error" && entry.id === "who"));
    assert.equal(node.fill(template, undefined, { partial: true }).diagnostics.some((entry) => entry.severity === "error"), false);
    const withExample = { ...template, variables: { ...template.variables, who: { ...template.variables.who, example: "Grace" } } };
    assert.equal(node.fill(withExample, undefined, { examples: true }).decks[0].presentation.slides[0].title, "Hello Grace");
    assert.throws(() => node.fill(template, "who\n"), node.OPFDataImportError);
    assert.throws(() => node.fill("not a template"), TypeError);
  });

  test("the browser build has the same function", () => {
    assert.equal(browser.fill, node.fill);
    assert.equal(browser.fill(template, { who: "Ada" }).decks[0].presentation.slides[0].title, "Hello Ada");
  });
});

describe("the same names in both builds", () => {
  test("every verb of the CLI is exported by the browser build; only open, save and convert reject there with node-only", async () => {
    for (const name of ["validate", "stats", "paginate", "embed", "edit", "fill", "diff", "merge", "format", "ingest", "parse", "stringify", "open", "save", "convert"]) {
      assert.equal(typeof node[name], "function", `node.${name}`);
      assert.equal(typeof browser[name], "function", `browser.${name}`);
    }
    for (const name of ["open", "save", "convert"]) await assert.rejects(browser[name]("deck.opf.json", "deck.pdf"), (error) => error.code === "node-only", name);
    assert.equal(browser.diff, node.diff);
    assert.equal(browser.merge, node.merge);
  });
});
