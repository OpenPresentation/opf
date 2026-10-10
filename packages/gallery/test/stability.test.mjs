// RR-78: the pixel-stability rule of scripts/stability.mjs. A minor or patch release keeps every existing record's drawing
// and every id; a major release may change both. The cases draw the built package against edited copies of itself.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import * as built from "../dist/index.js";
import { allowsChanges, compareReleases, formatResult, loadEngines, previousVersion } from "../scripts/stability.mjs";

let engines;
before(async () => {
  engines = await loadEngines();
});

const release = (version, edit = () => {}) => {
  const gallery = structuredClone(built.gallery);
  const catalogDisplay = structuredClone(built.catalogDisplay);
  edit(gallery, catalogDisplay);
  return { version, module: { gallery, catalogDisplay } };
};
const published = { version: "1.0.0", module: built };

test("the previous release is the highest published stable version at or below the candidate", () => {
  const versions = ["0.0.0-stage", "0.0.1", "1.0.0", "1.1.0", "1.2.0-rc.1", "2.0.0"];
  assert.equal(previousVersion(versions, "1.0.0"), "1.0.0", "an unbumped candidate is held to the release it would replace");
  assert.equal(previousVersion(versions, "1.2.0"), "1.1.0");
  assert.equal(previousVersion(versions, "1.5.3"), "1.1.0");
  assert.equal(previousVersion(["0.0.0-stage", "0.0.1"], "1.0.0"), "0.0.1");
  assert.equal(previousVersion(["0.0.0-stage"], "1.0.0"), undefined);
  assert.equal(allowsChanges("0.0.1", "1.0.0"), true);
  assert.equal(allowsChanges("1.0.0", "1.1.0"), false);
  assert.equal(allowsChanges("1.4.2", "1.4.3"), false);
  assert.equal(allowsChanges("1.9.0", "2.0.0"), true);
});

test("an unchanged release draws every existing record the same", async () => {
  const result = await compareReleases(published, release("1.1.0"), engines);
  assert.equal(result.ok, true, formatResult(result));
  assert.equal(result.kinds.layouts.compared, Object.keys(built.gallery.layouts).length);
  assert.ok(result.renders > 700);
});

test("a minor release that moves an existing layout fails; a major release may", async () => {
  const edit = (gallery) => {
    gallery.layouts["two-column"].composition = { ...gallery.layouts["two-column"].composition, gap: 0.1 };
  };
  const minor = await compareReleases(published, release("1.1.0", edit), engines);
  assert.equal(minor.ok, false);
  assert.deepEqual(minor.kinds.layouts.changed.map((change) => change.id), ["two-column"]);
  assert.match(minor.problems[0], /^layouts\/two-column: slide 1 draws? differently \(\d+ pixels differ/);
  const major = await compareReleases(published, release("2.0.0", edit), engines);
  assert.equal(major.ok, true);
  assert.deepEqual(major.kinds.layouts.changed.map((change) => change.id), ["two-column"]);
});

test("colour and font scheme changes are caught, through the themes that use them too", async () => {
  const colour = await compareReleases(published, release("1.0.1", (gallery) => {
    gallery.colorSchemes["cool-horizon"].accent1 = "#AA0000";
  }), engines);
  assert.ok(colour.kinds.colorSchemes.changed.some((change) => change.id === "cool-horizon"));
  assert.ok(colour.kinds.themes.changed.some((change) => change.id === "minimal"), "the minimal theme uses cool-horizon");
  const font = await compareReleases(published, release("1.1.0", (gallery) => {
    gallery.fontSchemes.aptos.major = "Georgia";
  }), engines);
  assert.equal(font.ok, false);
  assert.ok(font.kinds.fontSchemes.changed.some((change) => change.id === "aptos"), "a family change is a change even when the raster falls back");
});

test("a removed id fails a minor release; a new id and display text never fail", async () => {
  const removed = await compareReleases(published, release("1.1.0", (gallery) => {
    delete gallery.tones.formal;
  }), engines);
  assert.equal(removed.ok, false);
  assert.deepEqual(removed.problems, ["tones/formal: removed"]);
  const added = await compareReleases(published, release("1.1.0", (gallery) => {
    gallery.layouts["two-column-copy"] = structuredClone(gallery.layouts["two-column"]);
    gallery.layouts["two-column"].name = "Two columns";
    gallery.tones.formal = { ...gallery.tones.formal, description: "Reworded." };
  }), engines);
  assert.equal(added.ok, true, formatResult(added));
  assert.deepEqual(added.kinds.layouts.added, ["two-column-copy"]);
  assert.deepEqual(added.content.tones, ["formal"]);
});
