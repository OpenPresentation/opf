// RR-70: one import for every runtime. `@openpresentation/opf` resolves to the Node build under the `node`, `bun` and `deno`
// conditions and to the browser-safe build under `browser`, `worker`, `workerd` and `default`. Both export the same names; the
// browser build's `open`, `save` and `convert` reject with `OPFApiError` `node-only`. `/node` and `/node/engine` are gone, and the
// CLI's engine is `./internal/engine`, resolvable under the `node` condition only. The bundles for the browser and worker conditions
// are checked by scripts/check-browser-safe.mjs; `parseSlideSelection` (browser-safe, at the root of both builds) is tested here.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { gallery } from "@openpresentation/gallery";
import { galleryIconSets } from "@openpresentation/gallery/icon-sets";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const nodeBuild = await import("../dist/index.js");
const browserBuild = await import("../dist/browser.js");

const rejectsNodeOnly = async (promise, name, hint) => {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof browserBuild.OPFApiError, "an OPFApiError");
    assert.equal(error.name, "OPFApiError");
    assert.equal(error.code, "node-only");
    assert.equal(error.details.function, name);
    assert.match(error.message, new RegExp(`^\`${name}\` `));
    assert.match(error.message, hint);
    return true;
  });
};

describe("the exports map", () => {
  test("the root has a Node build and a browser-safe build, with types first", () => {
    const root = manifest.exports["."];
    assert.deepEqual(Object.keys(root), ["types", "bun", "deno", "workerd", "worker", "browser", "node", "default"]);
    assert.equal(root.types, "./dist/index.d.ts");
    for (const condition of ["bun", "deno", "node"]) assert.equal(root[condition], "./dist/index.js", condition);
    for (const condition of ["workerd", "worker", "browser", "default"]) assert.equal(root[condition], "./dist/browser.js", condition);
    assert.equal(manifest.main, "./dist/index.js");
    assert.equal(manifest.types, "./dist/index.d.ts");
  });

  test("/node and /node/engine are removed; the CLI engine resolves under the node condition only", () => {
    assert.equal(manifest.exports["./node"], undefined);
    assert.equal(manifest.exports["./node/engine"], undefined);
    assert.deepEqual(manifest.exports["./internal/engine"], { types: "./dist/node-engine.d.ts", node: "./dist/node-engine.js" });
  });

  test("Node resolves the package name to the Node build", async () => {
    const resolved = await import("@openpresentation/opf");
    assert.equal(resolved.open, nodeBuild.open);
    assert.equal(resolved.convert, nodeBuild.convert);
    assert.notEqual(resolved.open, browserBuild.open);
    await assert.rejects(resolved.open("no-such-deck.opf.md"), { name: "OPFApiError", code: "input-not-found" });
    const engine = await import("@openpresentation/opf/internal/engine");
    assert.equal(engine.OPFApiError, nodeBuild.OPFApiError, "the CLI engine shares core's classes");
    assert.equal(engine.parseSlideSelection, nodeBuild.parseSlideSelection);
  });
});

describe("the two builds", () => {
  test("export the same names, sharing every class and function but the file API and the verbs with the CLI's default catalog", () => {
    assert.deepEqual(Object.keys(browserBuild).sort(), Object.keys(nodeBuild).sort());
    // RR-75/RR-117: Node validate and each createValidator session register the same default catalog, unlike browser core.
    // Other public classes/functions still share exact identity; the factory wrapper only forwards defaults and its one core cache.
    for (const name of Object.keys(nodeBuild)) {
      if (["open", "save", "convert", "validate", "createValidator", "stats", "paginate", "continueOverfull", "embed", "edit"].includes(name)) assert.notEqual(browserBuild[name], nodeBuild[name], name);
      else assert.equal(browserBuild[name], nodeBuild[name], name);
    }
    for (const name of ["open", "save", "convert", "OPFApiError", "OPFExportError", "OPFImportError", "parseSlideSelection", "parse", "stringify", "validate"]) assert.equal(typeof nodeBuild[name], "function", name);
    for (const name of ["defaultCatalog", "gallery"]) assert.equal(nodeBuild[name], undefined, `${name}: the catalog is @openpresentation/gallery's (RR-78); the root exports no records (FA-21)`);
  });

  test("the browser build's file functions reject with node-only and name the browser-safe alternative", async () => {
    const deck = { slides: [{ title: "Browser" }] };
    await rejectsNodeOnly(browserBuild.open("deck.opf.md"), "open", /parse\(text, \{ filename \}\)/);
    await rejectsNodeOnly(browserBuild.open(new Uint8Array(4)), "open", /needs Node/);
    await rejectsNodeOnly(browserBuild.save(deck, "deck.opf.md"), "save", /stringify\(deck, \{ filename \}\)/);
    await rejectsNodeOnly(browserBuild.convert("deck.opf.md", "deck.pdf"), "convert", /reads and writes files/);
    await rejectsNodeOnly(browserBuild.convert(deck, { format: "svg" }), "convert", /in-memory convert\(deck, \{ format \}\).*\/export-browser/);
  });
});

describe("parseSlideSelection", () => {
  const { parseSlideSelection, OPFApiError } = browserBuild;
  const invalid = (selection, total, pattern) =>
    assert.throws(
      () => parseSlideSelection(selection, total),
      (error) => error instanceof OPFApiError && error.code === "invalid-option" && pattern.test(error.message),
      JSON.stringify(selection),
    );

  test("is in both builds and in the CLI engine", () => {
    assert.equal(nodeBuild.parseSlideSelection, parseSlideSelection);
  });

  test("reads numbers, lists and text selections, one-based, ascending, without repeats", () => {
    assert.deepEqual(parseSlideSelection(3, 5), [3]);
    assert.deepEqual(parseSlideSelection("3", 5), [3]);
    assert.deepEqual(parseSlideSelection("1-3", 5), [1, 2, 3]);
    assert.deepEqual(parseSlideSelection("1,3-5", 5), [1, 3, 4, 5]);
    assert.deepEqual(parseSlideSelection("4-", 5), [4, 5]);
    assert.deepEqual(parseSlideSelection("-2", 5), [1, 2]);
    assert.deepEqual(parseSlideSelection(" 5 , 1-2 , 2 ", 5), [1, 2, 5]);
    assert.deepEqual(parseSlideSelection([4, 2, 2], 5), [2, 4]);
  });

  test("refuses out-of-range and malformed selections with invalid-option", () => {
    invalid(6, 5, /outside the presentation, which has 5 slides/);
    invalid("2-9", 5, /outside the presentation/);
    invalid("2", 1, /which has 1 slide\./);
    invalid(0, 5, /slide numbers counted from 1 \(got 0\)/);
    invalid(-3, 5, /slide numbers counted from 1/);
    invalid(2.5, 5, /slide numbers counted from 1/);
    invalid([1, 0], 5, /slide numbers counted from 1 \(got 0\)/);
    invalid([], 5, /slide numbers counted from 1/);
    invalid("", 5, /needs numbers like 1,3-5/);
    invalid("a", 5, /needs numbers like 1,3-5 \(got "a"\)/);
    invalid("1,,2", 5, /needs numbers like 1,3-5/);
    invalid("-", 5, /needs numbers like 1,3-5/);
    invalid("3-1", 5, /range "3-1" is not valid \(slides count from 1\)/);
    invalid("0", 5, /range "0" is not valid/);
    invalid(null, 5, /needs a slide number, a list of numbers or text/);
  });

  test("names the option it reads in the message, and refuses an empty presentation with no-slides", () => {
    assert.throws(() => parseSlideSelection("x", 3, "--slides"), /^OPFApiError: --slides needs numbers/);
    assert.throws(() => parseSlideSelection(1, 0), { name: "OPFApiError", code: "no-slides" });
  });
});


describe("session validator entrypoint defaults", () => {
  const defaults = [gallery, galleryIconSets];
  const document = () => ({ name: "Entrypoint consistency", design: { theme: "minimal" }, slides: [{ id: "first", title: "First topic", layout: "two-column", blocks: [{ text: "A readable first body." }, { text: "A separate second body." }] }] });
  const referenceOnly = { only: ["format", "references"] };
  const unresolved = report => report.findings.filter(finding => finding.ruleId === "opf/unresolved-reference");

  test("Node sessions use the same real gallery defaults as Node cold validation; browser sessions remain unregistered", () => {
    const value = document(), checker = nodeBuild.createValidator(), browser = browserBuild.createValidator();
    const cold = nodeBuild.validate(value, referenceOnly);
    assert.equal(cold.schemaValid, true);
    assert.deepEqual(unresolved(cold), [], "actual minimal/two-column gallery references resolve in Node");
    assert.deepEqual(checker.validate(value, referenceOnly), cold);
    assert.deepEqual(checker.validate(structuredClone(value), referenceOnly), cold);
    assert.deepEqual(browser.validate(value, { ...referenceOnly, catalogs: defaults }), cold, "explicit registration makes browser diagnostics exactly match Node");
    const unregistered = browserBuild.validate(value, referenceOnly);
    assert.ok(unresolved(unregistered).some(finding => finding.path === "/slides/0/layout"));
    assert.ok(unresolved(unregistered).some(finding => finding.path === "/design/theme"));
    assert.deepEqual(browser.validate(value, referenceOnly), unregistered);
    assert.deepEqual(checker.validate(value, { ...referenceOnly, catalogs: [] }), unregistered, "explicit [] opts out of Node defaults on that call");
    assert.deepEqual(checker.validate(value, referenceOnly), cold, "an earlier opt-out cannot replace later default registration");
    value.catalogs = { default: false };
    assert.deepEqual(checker.validate(value, referenceOnly), browserBuild.validate(value, { ...referenceOnly, catalogs: defaults }));
    assert.ok(unresolved(checker.validate(value, referenceOnly)).some(finding => finding.path === "/slides/0/layout"), "document-level default:false remains authoritative");
  });

  test("explicit custom catalogs are respected per call, without an implicit gallery fallback", () => {
    const catalog = { source: "https://example.test/validator-catalog", layouts: { custom: { name: "Custom", direction: "column", regions: [{ name: "title" }, { name: "body", accepts: ["text"], role: "primary", flow: "none" }] } } };
    const value = { slides: [{ title: "Custom layout", layout: "custom", text: "Real caller-owned catalog content." }] };
    const options = { ...referenceOnly, catalogs: [catalog] }, checker = nodeBuild.createValidator(), browser = browserBuild.createValidator();
    const cold = browserBuild.validate(value, options);
    assert.equal(cold.schemaValid, true);
    assert.deepEqual(unresolved(cold), []);
    assert.deepEqual(checker.validate(value, options), cold);
    assert.deepEqual(browser.validate(value, options), cold);
    assert.ok(unresolved(checker.validate(value, referenceOnly)).some(finding => finding.path === "/slides/0/layout"), "default gallery cannot resolve an unregistered custom record");
    assert.deepEqual(checker.validate(value, options), cold, "returning to an explicit catalog is isolated from the prior call");
    const galleryDeck = document();
    assert.ok(unresolved(checker.validate(galleryDeck, options)).some(finding => finding.path === "/slides/0/layout"), "explicit custom catalogs do not silently append the default gallery");
    assert.deepEqual(checker.validate(galleryDeck, options), browserBuild.validate(galleryDeck, options));
  });

  test("both public factories preserve cold/warm reports and forward independent cache/clear lifecycles", () => {
    for (const [label, factory, cold, options] of [["node", nodeBuild.createValidator, nodeBuild.validate, {}], ["browser", browserBuild.createValidator, browserBuild.validate, { catalogs: defaults }]]) {
      const value = document(), first = factory(), sibling = factory();
      assert.equal(first.cache.entries, 0, label);
      const expected = cold(value, options);
      assert.deepEqual(first.validate(value, options), expected, label + " cold");
      assert.ok(first.cache.entries > 0 && first.cache.bytes > 0, label + " retains actual derived composition");
      assert.equal(sibling.cache.entries, 0, label + " separate session starts empty");
      assert.deepEqual(first.validate(structuredClone(value), options), expected, label + " warm");
      assert.deepEqual(first.validate(JSON.stringify(value, null, 3), options), cold(JSON.stringify(value, null, 3), options), label + " source ranges");
      sibling.validate(value, options);
      const siblingBefore = sibling.cache;
      first.clear();
      assert.equal(first.cache.entries, 0, label + " public clear forwards to the retained core cache");
      assert.equal(first.cache.bytes, 0, label + " public cache getter remains live after clear");
      assert.deepEqual(sibling.cache, siblingBefore, label + " clear is session-local");
      assert.ok(sibling.cache.entries > 0, label + " sibling cache survives");
      assert.deepEqual(first.validate(value, options), expected, label + " after clear");
      assert.throws(() => first.validate(value, { ...options, catalogs: null }), error => error instanceof nodeBuild.OPFCatalogsOptionError && error instanceof browserBuild.OPFCatalogsOptionError && error.code === "invalid-catalogs", label + " shares canonical source errors");
      assert.equal(first.cache.entries, 0, label + " rejected options clear that session");
      assert.ok(sibling.cache.entries > 0, label + " failed sibling cannot clear another session");
      assert.deepEqual(first.validate(value, options), expected, label + " after refusal");
    }
  });
});
