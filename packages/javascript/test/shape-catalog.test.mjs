import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { PRESET_SHAPES, presetGeometry } from "../dist/shape-geometry.js";
import { SHAPE_CATALOG, SHAPE_CATEGORIES, searchShapeCatalog, shapeCatalogEntry, shapeThumbnail, shapeThumbnailSvg, shapesInCategory } from "../dist/shape-catalog.js";

// SH-06: the shape catalog groups the 187 presets as PowerPoint's Insert > Shapes gallery does, and
// searches by DrawingML name and common words.
describe("shape catalog", () => {
  test("lists every preset once, in a gallery group", () => {
    assert.equal(SHAPE_CATALOG.length, 187);
    assert.deepEqual([...SHAPE_CATALOG.map((entry) => entry.name)].sort(), [...PRESET_SHAPES].sort());
    const groups = SHAPE_CATEGORIES.map((category) => category.id);
    assert.deepEqual(groups, ["lines", "rectangles", "basic", "blockArrows", "equations", "flowchart", "starsBanners", "callouts", "actionButtons"]);
    assert.deepEqual(SHAPE_CATEGORIES.map((category) => category.title), ["Lines", "Rectangles", "Basic Shapes", "Block Arrows", "Equation Shapes", "Flowchart", "Stars and Banners", "Callouts", "Action Buttons"]);
    for (const entry of SHAPE_CATALOG) assert.ok(groups.includes(entry.category), entry.name);
    // The order is the gallery's: the groups in turn.
    const order = SHAPE_CATALOG.map((entry) => groups.indexOf(entry.category));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    assert.deepEqual(shapesInCategory("equations").map((entry) => entry.name), ["mathPlus", "mathMinus", "mathMultiply", "mathDivide", "mathEqual", "mathNotEqual"]);
    assert.equal(shapesInCategory("flowchart").length, 29);
    assert.equal(shapesInCategory("actionButtons").length, 12);
    assert.equal(shapeCatalogEntry("chevron")?.category, "blockArrows");
    assert.equal(shapeCatalogEntry("nope"), undefined);
  });

  test("searches by DrawingML name and common words", () => {
    const names = (query, options) => searchShapeCatalog(query, options).map((result) => result.entry.name);
    assert.equal(names("rightArrow")[0], "rightArrow");
    assert.equal(names("right arrow")[0], "rightArrow");
    assert.equal(names("wedgeEllipseCallout")[0], "wedgeEllipseCallout");
    assert.equal(names("round rect callout")[0], "wedgeRoundRectCallout");
    assert.equal(names("circle")[0], "ellipse");
    assert.equal(names("speech bubble").slice(0, 3).join(), "wedgeRectCallout,wedgeRoundRectCallout,wedgeEllipseCallout");
    assert.equal(names("cylinder")[0], "can");
    assert.ok(names("cylinder").includes("flowChartMagneticDisk"));
    assert.equal(names("star 5")[0], "star5");
    assert.equal(names("five point star")[0], "star5");
    assert.equal(names("decision")[0], "flowChartDecision");
    assert.equal(names("start end")[0], "flowChartTerminator");
    assert.equal(names("cog").sort().join(), "gear6,gear9");
    // Common words: arrow, callout, star, flowchart.
    assert.ok(names("arrow").length >= 30 && ["rightArrow", "chevron", "homePlate", "straightConnector1", "circularArrow", "rightArrowCallout"].every((name) => names("arrow").includes(name)));
    assert.equal(names("callout").length, 23);
    assert.ok(names("star").length >= 12);
    assert.equal(names("flowchart").length, 29);
    // Plurals match, every word must match, and nothing matches nonsense.
    assert.deepEqual(names("arrows"), names("arrow"));
    assert.deepEqual(names("star triangle"), []);
    assert.deepEqual(names("zzzzzz"), []);
    // A group restricts; an empty query lists the gallery in its order.
    assert.ok(names("arrow", { category: "blockArrows" }).every((name) => shapeCatalogEntry(name).category === "blockArrows"));
    assert.equal(names("").length, 187);
    assert.equal(names("", { category: "lines" }).length, 11);
    assert.deepEqual(names("star", { limit: 3 }).length, 3);
    // A whole-name match ranks above a prefix.
    assert.equal(names("pie")[0], "pie");
    assert.equal(names("hexagon")[0], "hexagon");
  });

  test("a thumbnail draws a preset from its geometry and holds a tail that reaches past the frame", () => {
    const geometry = presetGeometry("rightArrow", 120, 60);
    const thumb = shapeThumbnail(geometry, 120, 60);
    assert.equal(thumb.viewBox, "0 0 120 60");
    assert.equal(thumb.paths.length, 1);
    assert.equal(thumb.paths[0].fill, "solid");
    const callout = shapeThumbnail(presetGeometry("wedgeRectCallout", 120, 80), 120, 80);
    const [x, y, width, height] = callout.viewBox.split(" ").map(Number);
    assert.ok(y + height > 80 && x >= 0 && width >= 120, callout.viewBox);
    const svg = shapeThumbnailSvg(geometry, 120, 60);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 120 60"/);
    assert.ok(!/<script|href=|on[a-z]+=/i.test(svg));
    // Every preset draws a thumbnail with finite numbers.
    for (const name of PRESET_SHAPES) {
      const drawn = shapeThumbnail(presetGeometry(name, 96, 64), 96, 64);
      assert.ok(drawn.paths.length > 0 && drawn.viewBox.split(" ").every((part) => Number.isFinite(Number(part))), name);
    }
  });
});
