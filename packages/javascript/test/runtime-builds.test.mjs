// RR-70: one import for every runtime. `@openpresentation/opf` resolves to the Node build under the `node`, `bun` and `deno`
// conditions and to the browser-safe build under `browser`, `worker`, `workerd` and `default`. Both export the same names; the
// browser build's `open`, `save` and `convert` reject with `OPFApiError` `node-only`. `/node` and `/node/engine` are gone, and the
// CLI's engine is `./internal/engine`, resolvable under the `node` condition only. The bundles for the browser and worker conditions
// are checked by scripts/check-browser-safe.mjs; `parseSlideSelection` (browser-safe, at the root of both builds) is tested here.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

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
  test("export the same names, sharing every class and function but the file API", () => {
    assert.deepEqual(Object.keys(browserBuild).sort(), Object.keys(nodeBuild).sort());
    for (const name of Object.keys(nodeBuild)) {
      if (["open", "save", "convert"].includes(name)) assert.notEqual(browserBuild[name], nodeBuild[name], name);
      else assert.equal(browserBuild[name], nodeBuild[name], name);
    }
    for (const name of ["open", "save", "convert", "OPFApiError", "OPFExportError", "OPFImportError", "parseSlideSelection", "parse", "stringify", "validate"]) assert.equal(typeof nodeBuild[name], "function", name);
    assert.equal(nodeBuild.defaultCatalog, undefined, "the default catalog stays at @openpresentation/opf/catalog (FA-21)");
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
