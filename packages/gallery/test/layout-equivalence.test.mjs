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
import { bodyRegions } from "../../../scripts/gallery-stability-fixtures.mjs";
import { OPFLayoutTemplateError, REGION_KINDS, layoutRegion, layoutTemplate } from "@openpresentation/opf/composition";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const old = JSON.parse(readFileSync(path.join(root, "test", "fixtures", "layouts-4.0.0.json"), "utf8"));
const { records } = await readSnapshotKind(path.join(root, "catalog"), "layouts");
// WI-2 (whole-group placement): four records were redrawn on purpose (their grid is an all-auto stack the 4.0.0 form could not
// express) and one record is new. They are tested by single-message-layouts.test.mjs; every other record must still compile to
// exactly its 4.0.0 grid.
const REDESIGNED = new Set(["statement", "closing", "quote", "comparison"]);
const sameAsBefore = (record) => !ADDED.has(record.id) && !REDESIGNED.has(record.id);
const RULE_ORDER = ["accepts", "role", "flow", "max", "bleed", "listColumns", "anchor", "empty"];
/** Kinds a record accepts beyond its 4.0.0 rule (appended, in this order): a deliberate widening, never a silent one. */
const ACCEPTS_ADDED = { "team/people": ["list"] }; // WI-6: a name with its role and description is one `items` entry
/** Records that did not exist in 4.0.0: they have no grid to be equal to. */
const ADDED = new Set(["three-column", "agenda-split"]);
/** The generic column layouts take any content: their regions list every kind, which no other record does (WI-3). */
const EVERY_KIND = new Set(["two-column", "three-column"]);
/** Every content kind the regions accept, written out so editors can name the keys of a region (WI-3). */
const EVERY = ["text", "list", "quote", "code", "image", "video", "chart", "table", "metric", "timeline", "group"];
/** WI-3: rules changed after 4.0.0, per record and region (declared in changes/). */
const CHANGED = {
  "two-column": { first: { accepts: EVERY }, second: { accepts: EVERY } },
  "image-beside": { media: { anchor: "middle" } },
  logos: { logos: { anchor: "middle" } },
};

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
    const rule = { ...before.regions[region.name], ...CHANGED[record.id]?.[region.name] };
    rule.accepts = [...rule.accepts, ...(ACCEPTS_ADDED[`${record.id}/${region.name}`] ?? [])];
    // A key the 4.0.0 record wrote must be equal; a key it left out must be the engine default, never an inherited value.
    const defaults = layoutRegion(region.name, { accepts: rule.accepts, role: rule.role, flow: rule.flow });
    for (const key of RULE_ORDER) assert.deepEqual(region[key], rule[key] ?? defaults[key], `${record.id}/${region.name}.${key}`);
  }
  return compiled;
}

test("the fixture is the 28 gallery 4.0.0 layouts, and the records since are the added ones", () => {
  assert.deepEqual(records.filter((record) => !ADDED.has(record.id)).map((record) => record.id), Object.keys(old));
  assert.equal(records.length, 28 + ADDED.size);
});

for (const record of records) {
  test(`${record.id}: the region list compiles to the 4.0.0 grid and rules`, { skip: !sameAsBefore(record) && "added or redesigned (WI-2, WI-3), see single-message-layouts.test.mjs" }, () => {
    assertSameGrid(record, old[record.id]);
  });

  test(`${record.id}: the 4.0.0 grid keys are gone, and reading order is the old region order`, () => {
    for (const key of ["areas", "columns", "rows"]) assert.equal(key in record, false, `${record.id} still has ${key}`);
    assert.ok(Array.isArray(record.regions), "regions is the ordered array");
    assert.ok(["row", "column"].includes(record.direction), "the direction is written");
    if (!ADDED.has(record.id)) assert.deepEqual(bodyRegions(record).map(([name]) => name), Object.keys(old[record.id].regions), "fixture decks keep their block order");
    const walk = (list, depth) => {
      assert.ok(depth <= 3 && list.length >= 1 && list.length <= 12);
      for (const entry of list) if (entry.regions) walk(entry.regions, depth + 1);
    };
    walk(record.regions, 1);
  });
}

test("rules are kept exactly: nothing but `accepts` is inherited or dropped, and `accepts` is the full set only in the generic columns", () => {
  for (const record of records) {
    if (sameAsBefore(record)) assertSameGrid(record, old[record.id]);
    const written = (list) => list.flatMap((entry) => (entry.regions ? written(entry.regions) : [entry]));
    for (const entry of written(record.regions)) {
      if (entry.name === "title" || entry.name === "subtitle") assert.deepEqual(Object.keys(entry).filter((key) => key !== "name" && key !== "size"), [], `${record.id}/${entry.name}: a heading takes only size`);
      else if (EVERY_KIND.has(record.id)) assert.deepEqual([...entry.accepts].sort(), [...REGION_KINDS].sort(), `${record.id}/${entry.name} accepts every kind`);
      else assert.ok(entry.accepts && entry.accepts.length < REGION_KINDS.length, `${record.id}/${entry.name} has no reason to omit accepts`);
    }
  }
});

