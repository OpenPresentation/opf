// The pixel-stability rule of scripts/stability.mjs. A minor or patch release keeps every existing record's drawing and
// every id; a major release may change both, and a major release that changes the record schema (CATALOG_SCHEMA) is a
// new baseline. The cases draw the built package against edited copies of itself.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import * as built from "../dist/index.js";
import { SNAPSHOT_KINDS } from "../scripts/catalog-snapshot.mjs";
import { layoutDeck, templateDeck } from "../scripts/fixtures.mjs";
import { allowsChanges, catalogSchemaOf, compareReleases, formatResult, loadEngines, previousVersion } from "../scripts/stability.mjs";

let engines;
before(async () => {
  engines = await loadEngines();
});

const release = (version, edit = () => {}, catalogSchema = built.CATALOG_SCHEMA) => {
  const gallery = structuredClone(built.gallery);
  const catalogDisplay = structuredClone(built.catalogDisplay);
  edit(gallery, catalogDisplay);
  return { version, module: { gallery, catalogDisplay, CATALOG_SCHEMA: catalogSchema } };
};
const published = { version: "2.0.0", module: built };

test("the previous release is the highest published stable version at or below the candidate", () => {
  const versions = ["0.0.0-stage", "0.0.1", "1.0.0", "1.1.0", "1.2.0-rc.1", "2.0.0", "2.1.0"];
  assert.equal(previousVersion(versions, "2.0.0"), "2.0.0", "an unbumped candidate is held to the release it would replace");
  assert.equal(previousVersion(["0.0.0-stage", "0.0.1", "1.0.0"], "2.0.0"), "1.0.0", "2.0.0 is compared with the last 1.x release");
  assert.equal(previousVersion(versions, "2.2.0"), "2.1.0");
  assert.equal(previousVersion(versions, "2.1.3"), "2.1.0");
  assert.equal(previousVersion(["0.0.0-stage", "0.0.1"], "2.0.0"), "0.0.1");
  assert.equal(previousVersion(["0.0.0-stage"], "1.0.0"), undefined);
  assert.equal(allowsChanges("1.0.0", "2.0.0"), true);
  assert.equal(allowsChanges("2.0.0", "2.1.0"), false);
  assert.equal(allowsChanges("2.4.2", "2.4.3"), false);
  assert.equal(allowsChanges("2.9.0", "3.0.0"), true);
  assert.equal(catalogSchemaOf(built), 3);
  assert.equal(catalogSchemaOf({ gallery: {} }), 1, "a release from before the CATALOG_SCHEMA export is schema 1");
});

test("a template's fixture fills every region (three blocks in a flowing region, one in a none region), then empties them", () => {
  const deck = templateDeck("hero", built.gallery.layouts.hero);
  assert.equal(deck.slides.length, 2);
  const [filled, empty] = deck.slides;
  assert.deepEqual(filled.blocks.map((block) => block.region), ["lead", "media", "support", "support", "support"]);
  assert.ok("image" in filled.blocks[1]);
  assert.equal(empty.blocks, undefined);
  assert.equal(empty.layout, "hero");
  const people = templateDeck("team", built.gallery.layouts.team).slides[0].blocks;
  assert.ok(people.every((block) => Array.isArray(block.blocks)), "a region whose first accepted kind is group gets picture-and-text groups");
  assert.equal(layoutDeck("section", built.gallery.layouts.section).slides[0].blocks, undefined);
  assert.equal(layoutDeck("x", { placeholders: [{ type: "title" }, { type: "chart" }] }).slides.length, 1, "a 1.x record keeps its one-slide fixture");
});

test("an unchanged release draws every existing record the same", async () => {
  const result = await compareReleases(published, release("2.1.0"), engines);
  assert.equal(result.ok, true, formatResult(result));
  assert.equal(result.baseline, false);
  assert.equal(result.kinds.layouts.compared, Object.keys(built.gallery.layouts).length);
  assert.ok(result.renders > 200);
});

test("a minor release that moves an existing layout fails; a major release may", async () => {
  const edit = (gallery) => {
    gallery.layouts["two-column"].columns = [2, 1];
  };
  const minor = await compareReleases(published, release("2.1.0", edit), engines);
  assert.equal(minor.ok, false);
  assert.deepEqual(minor.kinds.layouts.changed.map((change) => change.id), ["two-column"]);
  assert.match(minor.problems[0], /^layouts\/two-column: slides? 1(, 2)? draws? differently \(\d+ pixels differ/);
  const major = await compareReleases(published, release("3.0.0", edit), engines);
  assert.equal(major.ok, true);
  assert.deepEqual(major.kinds.layouts.changed.map((change) => change.id), ["two-column"]);
});

test("a changed region is caught on the filled slide, and a collapse change on the empty one", async () => {
  const flow = await compareReleases(published, release("2.0.1", (gallery) => {
    gallery.layouts.metrics.regions.metrics.flow = "column";
  }), engines);
  assert.equal(flow.ok, false);
  assert.deepEqual(flow.kinds.layouts.changed.map((change) => [change.id, change.slides]), [["metrics", [1]]]);
  const keep = await compareReleases(published, release("2.0.1", (gallery) => {
    gallery.layouts.metrics.regions.note.empty = "keep";
  }), engines);
  assert.equal(keep.ok, false);
  assert.ok(keep.kinds.layouts.changed.some((change) => change.id === "metrics" && change.slides.includes(2)), formatResult(keep));
});

test("colour and font scheme changes are caught, through the themes that use them too", async () => {
  const colour = await compareReleases(published, release("2.0.1", (gallery) => {
    gallery.colorSchemes["cool-horizon"].accent1 = "#AA0000";
  }), engines);
  assert.ok(colour.kinds.colorSchemes.changed.some((change) => change.id === "cool-horizon"));
  assert.ok(colour.kinds.themes.changed.some((change) => change.id === "minimal"), "the minimal theme uses cool-horizon");
  const font = await compareReleases(published, release("2.1.0", (gallery) => {
    gallery.fontSchemes.aptos.major = "Georgia";
  }), engines);
  assert.equal(font.ok, false);
  assert.ok(font.kinds.fontSchemes.changed.some((change) => change.id === "aptos"), "a family change is a change even when the raster falls back");
});

test("a removed id fails a minor release; a new id and display text never fail", async () => {
  const removed = await compareReleases(published, release("2.1.0", (gallery) => {
    delete gallery.tones.formal;
  }), engines);
  assert.equal(removed.ok, false);
  assert.deepEqual(removed.problems, ["tones/formal: removed"]);
  const added = await compareReleases(published, release("2.1.0", (gallery) => {
    gallery.layouts["two-column-copy"] = structuredClone(gallery.layouts["two-column"]);
    gallery.layouts["two-column"].name = "Two columns side by side";
    gallery.tones.formal = { ...gallery.tones.formal, description: "Reworded." };
  }), engines);
  assert.equal(added.ok, true, formatResult(added));
  assert.deepEqual(added.kinds.layouts.added, ["two-column-copy"]);
  assert.deepEqual(added.content.tones, ["formal"]);
});

test("2.0.0 is a new baseline over 1.x: a record schema change needs a major release, which may replace every layout", async () => {
  // A 1.x release: schema 1, with 1.x placeholder records (two-column is also a 2.0.0 id; chart-1x is not).
  const v1Layouts = {
    "two-column": { name: "Two_Column", placeholders: [{ type: "title" }, { type: "list" }, { type: "list" }], composition: { mode: "row", gap: 0.06 } },
    "chart-1x": { name: "Chart 1x", placeholders: [{ type: "title" }, { type: "chart" }] },
  };
  const previous = release("1.0.0", (gallery) => {
    gallery.layouts = structuredClone(v1Layouts);
  }, 1);
  const schemaTwo = { ...published, module: { ...published.module, CATALOG_SCHEMA: 2 } };
  const baseline = await compareReleases(previous, schemaTwo, engines);
  assert.equal(baseline.ok, true, formatResult(baseline));
  assert.equal(baseline.baseline, true);
  assert.deepEqual(baseline.schema, { previous: 1, candidate: 2 });
  assert.deepEqual(baseline.kinds.layouts.removed, ["chart-1x"]);
  assert.equal(baseline.kinds.layouts.added.length, Object.keys(built.gallery.layouts).length - 1);
  assert.match(formatResult(baseline), /new baseline: CATALOG_SCHEMA 1 -> 2/);

  const notMajor = await compareReleases(previous, { ...schemaTwo, version: "1.1.0" }, engines);
  assert.equal(notMajor.ok, false);
  assert.ok(notMajor.problems.includes("CATALOG_SCHEMA 1 -> 2: a record schema change needs a major release"), notMajor.problems.join("\n"));
  assert.ok(notMajor.problems.includes("layouts/chart-1x: removed"));
});


test("array area rows require catalog contract 3 and a major release without changing layout URI generation", async () => {
  const previous = release("2.0.0", () => {}, 2);
  const candidate = release("3.0.0", () => {}, 3);
  const result = await compareReleases(previous, candidate, engines);
  assert.equal(result.ok, true, formatResult(result));
  assert.deepEqual(result.schema, { previous: 2, candidate: 3 });
  assert.equal(result.baseline, true);
  const minor = await compareReleases(previous, { ...candidate, version: "2.1.0" }, engines);
  assert.equal(minor.ok, false);
  assert.ok(minor.problems.includes("CATALOG_SCHEMA 2 -> 3: a record schema change needs a major release"));
  const layoutKind = SNAPSHOT_KINDS.find(({ kind }) => kind === "layouts");
  assert.equal(layoutKind.recordSchemaId, "https://openpresentation.org/schema/opf-layout/v2");
  for (const layout of Object.values(built.gallery.layouts)) {
    assert.ok(layout.areas.every((row) => Array.isArray(row)));
  }
});
