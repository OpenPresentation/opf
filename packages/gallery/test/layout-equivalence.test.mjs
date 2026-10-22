// FA-33: layout records are one ordered list of regions. Every record compiles (with the rules of the FA-33 spec) to exactly
// the grid its 4.0.0 form had, so the geometry, and with it every drawing, is unchanged.
//
// The expected grids are test/fixtures/layouts-4.0.0.json, generated once from `git show v4.0.0:catalog/layouts/<id>.json`
// (areas, columns, rows and the regions map). The compile is core's own `layoutTemplate` (@openpresentation/opf/composition).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readSnapshotKind } from "../scripts/catalog-snapshot.mjs";
import { bodyRegions } from "../scripts/fixtures.mjs";
import { OPFLayoutTemplateError, REGION_KINDS, layoutRegion, layoutTemplate } from "@openpresentation/opf/composition";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const old = JSON.parse(readFileSync(path.join(root, "test", "fixtures", "layouts-4.0.0.json"), "utf8"));
const { records } = await readSnapshotKind(path.join(root, "catalog"), "layouts");
const RULE_ORDER = ["accepts", "role", "flow", "max", "bleed", "listColumns", "anchor", "empty"];

/** Track weights as shares of their numeric total (core compiles to relative numbers; `auto` stays `auto`). */
const shares = (weights) => {
  const total = weights.reduce((sum, weight) => (weight === "auto" ? sum : sum + weight), 0);
  return weights.map((weight) => (weight === "auto" ? weight : weight / total));
};
const assertShares = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, `${label}: track count`);
  actual.forEach((value, i) => {
    if (expected[i] === "auto") assert.equal(value, "auto", `${label}[${i}]`);
    else assert.ok(typeof value === "number" && Math.abs(value - expected[i]) < 1e-12, `${label}[${i}]: ${value} vs ${expected[i]}`);
  });
};
/** The 4.0.0 grid against core's compile of the region list: cells, track shares and the region rules. */
function assertSameGrid(record, before) {
  const compiled = layoutTemplate(record);
  assert.deepEqual(compiled.grid, before.areas, `${record.id}: areas`);
  assertShares(shares(compiled.columns), shares(before.columns ?? before.areas[0].map(() => 1)), `${record.id}: columns`);
  assertShares(shares(compiled.rows), shares(before.rows ?? before.areas.map(() => 1)), `${record.id}: rows`);
  assert.deepEqual(compiled.regions.map((region) => region.name), Object.keys(before.regions), `${record.id}: reading order`);
  for (const region of compiled.regions) {
    const rule = before.regions[region.name];
    // A key the 4.0.0 record wrote must be equal; a key it left out must be the engine default, never an inherited value.
    const defaults = layoutRegion(region.name, { accepts: rule.accepts, role: rule.role, flow: rule.flow });
    for (const key of RULE_ORDER) assert.deepEqual(region[key], rule[key] ?? defaults[key], `${record.id}/${region.name}.${key}`);
  }
  return compiled;
}

test("the fixture is the 28 gallery 4.0.0 layouts", () => {
  assert.deepEqual(records.map((record) => record.id), Object.keys(old));
  assert.equal(records.length, 28);
});

for (const record of records) {
  test(`${record.id}: the region list compiles to the 4.0.0 grid and rules`, () => {
    assertSameGrid(record, old[record.id]);
  });

  test(`${record.id}: the 4.0.0 grid keys are gone, and reading order is the old region order`, () => {
    for (const key of ["areas", "columns", "rows"]) assert.equal(key in record, false, `${record.id} still has ${key}`);
    assert.ok(Array.isArray(record.regions), "regions is the ordered array");
    assert.ok(["row", "column"].includes(record.direction), "the direction is written");
    assert.deepEqual(bodyRegions(record).map(([name]) => name), Object.keys(old[record.id].regions), "fixture decks keep their block order");
    const walk = (list, depth) => {
      assert.ok(depth <= 3 && list.length >= 1 && list.length <= 12);
      for (const entry of list) if (entry.regions) walk(entry.regions, depth + 1);
    };
    walk(record.regions, 1);
  });
}

test("rules are kept exactly: nothing but `accepts` is inherited or dropped, and `accepts` is never the full set", () => {
  for (const record of records) {
    assertSameGrid(record, old[record.id]);
    const written = (list) => list.flatMap((entry) => (entry.regions ? written(entry.regions) : [entry]));
    for (const entry of written(record.regions)) {
      if (entry.name === "title" || entry.name === "subtitle") assert.deepEqual(Object.keys(entry).filter((key) => key !== "name" && key !== "size"), [], `${record.id}/${entry.name}: a heading takes only size`);
      else assert.ok(entry.accepts && entry.accepts.length < REGION_KINDS.length, `${record.id}/${entry.name} has no reason to omit accepts`);
    }
  }
});

test("an anchor is written once at the record when every body region shares it, and the records that nest are the seven known", () => {
  assert.deepEqual(records.filter((record) => record.anchor).map((record) => [record.id, record.anchor]), [["statement", "middle"], ["quote", "middle"]]);
  for (const record of records.filter((entry) => entry.anchor)) assert.ok(bodyRegions(record).every(([, rule]) => rule.anchor === "middle"));
  const nested = records.filter((record) => JSON.stringify(record.regions).includes('"direction"')).map((record) => record.id);
  // Five nest only because the title stays an explicit heading region above a row of two; comparison and hero are 2D beyond it.
  assert.deepEqual(nested.sort(), ["chart-beside", "code", "comparison", "hero", "image-beside", "table-beside", "two-column"]);
});

test("the compile rejects a tree the spec forbids", () => {
  const issues = (record) => {
    try {
      layoutTemplate(record);
    } catch (error) {
      assert.ok(error instanceof OPFLayoutTemplateError);
      return error.issues.map((issue) => issue.code);
    }
    return [];
  };
  assert.deepEqual(issues({ direction: "row", regions: [{ name: "a", size: "auto" }] }), ["layout-template"]);
  assert.deepEqual(issues({ direction: "column", regions: [{ name: "a" }, { name: "a" }] }), ["layout-region"]);
  const { regions } = layoutTemplate({ direction: "column", anchor: "middle", regions: [{ name: "a", anchor: "top", accepts: ["text"] }, { name: "b" }] });
  assert.deepEqual(regions.map(({ name, accepts, anchor }) => ({ name, accepts, anchor })), [
    { name: "a", accepts: ["text"], anchor: "top" },
    { name: "b", accepts: [...REGION_KINDS], anchor: "middle" },
  ]);
});
