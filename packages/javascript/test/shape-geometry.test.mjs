import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

import {
  PRESET_SHAPES,
  adjustFromDrawingML,
  adjustToDrawingML,
  customGeometry,
  evaluateGuideFormula,
  flattenShapePath,
  isPresetShape,
  presetAdjustments,
  presetGeometry,
} from "../dist/shape-geometry.js";

// SH-01: the 187 DrawingML preset shapes from spec/reference/preset-geometry.json, evaluated to SVG path data. The
// outlines were compared with PowerPoint's own drawing of the same native a:prstGeom (two sizes, two adjust values,
// filled and stroked): every preset matches within 1 pixel at 96 dpi; see docs/shapes.md.
const source = JSON.parse(readFileSync(new URL("../../../spec/reference/preset-geometry.json", import.meta.url), "utf8"));
const schema = JSON.parse(readFileSync(new URL("../../../spec/reference/preset-geometry.schema.json", import.meta.url), "utf8"));
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;

const SIZES = [
  [200, 200],
  [320, 90],
  [70, 260],
  [1, 1],
  [0, 0],
  [0, 120],
  [12192000, 6858000],
];
const finite = (value) => typeof value === "number" && Number.isFinite(value);

function adjustSets(name, width, height) {
  const info = presetAdjustments(name, width, height);
  const sets = [undefined, {}];
  for (const pick of ["min", "max", "mid", "below", "above"]) {
    const set = {};
    for (const [guide, entry] of Object.entries(info)) {
      const span = entry.unit === "degrees" ? 360 : 1;
      const min = entry.min ?? entry.default - span;
      const max = entry.max ?? entry.default + span;
      set[guide] = { min, max, mid: (min + max) / 2, below: min - span, above: max + span }[pick];
    }
    sets.push(set);
  }
  return sets;
}

function outlines(geometry, filledOnly) {
  return geometry.paths.filter((path) => !filledOnly || path.fill !== "none").flatMap((path) => flattenShapePath(path.commands, 48));
}

function distanceToOutline(point, lines) {
  let best = Infinity;
  for (const line of lines)
    for (let index = 0; index < line.length - 1; index++) {
      const a = line[index];
      const b = line[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
      best = Math.min(best, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
    }
  return best;
}

function inside(point, lines) {
  let winding = 0;
  for (const raw of lines) {
    const line = raw.length && (raw[0].x !== raw.at(-1).x || raw[0].y !== raw.at(-1).y) ? [...raw, raw[0]] : raw;
    for (let index = 0; index < line.length - 1; index++) {
      const a = line[index];
      const b = line[index + 1];
      const side = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y);
      if (a.y <= point.y) {
        if (b.y > point.y && side > 0) winding++;
      } else if (b.y <= point.y && side < 0) winding--;
    }
  }
  return winding !== 0;
}

describe("preset geometry reference data", () => {
  test("the table validates against its schema and holds the 187 ST_ShapeType presets with its source and license", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    assert.equal(validate(source), true, JSON.stringify(validate.errors?.slice(0, 5)));
    assert.equal(Object.keys(source.shapes).length, 187);
    assert.equal(source.source.license, "Apache-2.0");
    assert.match(source.source.url, /^https:\/\/raw\.githubusercontent\.com\/apache\/poi\/REL_5_5_1\//);
    assert.deepEqual(PRESET_SHAPES, Object.keys(source.shapes));
    for (const name of ["rect", "roundRect", "ellipse", "triangle", "chevron", "rightArrow", "wedgeRectCallout", "flowChartDecision", "cloud", "gear9", "chartPlus", "lineInv"])
      assert.ok(isPresetShape(name), name);
    assert.equal(isPresetShape("Rect"), false);
    assert.equal(isPresetShape("rectangle"), false);
    assert.equal(Object.isFrozen(PRESET_SHAPES), true);
  });

  test("the two errata are applied and recorded", () => {
    assert.deepEqual(source.shapes.pie.rect, ["il", "it", "ir", "ib"]);
    assert.deepEqual(source.shapes.curvedLeftArrow.cxnLst[2], ["cd2", "l", "y6"]);
    assert.deepEqual(
      source.errata.map((entry) => entry.shape),
      ["pie", "curvedLeftArrow"],
    );
  });
});

describe("guide formulas", () => {
  const guides = { w: 200, h: 100, a: 3, b: 4, z: 0, neg: -5 };
  const cases = [
    ["val 25000", 25000],
    ["val a", 3],
    ["*/ w a b", 150],
    ["+- w a b", 199],
    ["+/ w a b", 50.75],
    ["?: a w h", 200],
    ["?: z w h", 100],
    ["?: neg w h", 100],
    ["abs neg", 5],
    ["at2 a b", 53.13010235415598 * 60000],
    ["at2 b z", 0],
    ["cat2 w a b", 120],
    ["sat2 w a b", 160],
    ["cos w 5400000", 0],
    ["cos w 0", 200],
    ["sin w 5400000", 200],
    ["sin w 10800000", 0],
    ["tan w 2700000", 200],
    ["max a b", 4],
    ["min a b", 3],
    ["mod a b z", 5],
    ["pin a w b", 4],
    ["pin a z b", 3],
    ["pin a a b", 3],
    ["sqrt w", Math.sqrt(200)],
    ["*/ w a z", 0],
  ];
  for (const [formula, expected] of cases)
    test(formula, () => {
      const value = evaluateGuideFormula(formula, guides);
      assert.ok(Math.abs(value - expected) < 1e-6 * Math.max(1, Math.abs(expected)), `${formula} = ${value}, expected ${expected}`);
    });

  test("a map works as the guide table, and unknown guides and operators throw", () => {
    assert.equal(evaluateGuideFormula("+- x 1 0", new Map([["x", 2]])), 3);
    assert.throws(() => evaluateGuideFormula("+- nope 1 0", {}), /unknown guide 'nope'/);
    assert.throws(() => evaluateGuideFormula("pow 2 3", {}), /unknown operator/);
  });
});

describe("every preset evaluates", () => {
  test("all 187 presets give finite paths, text rectangles, connection sites and handles across sizes and adjust values", () => {
    let evaluations = 0;
    for (const name of PRESET_SHAPES)
      for (const [width, height] of SIZES)
        for (const adjust of adjustSets(name, width, height)) {
          const geometry = presetGeometry(name, width, height, adjust);
          evaluations++;
          assert.ok(geometry.paths.length > 0, name);
          for (const path of geometry.paths) {
            assert.doesNotMatch(path.d, /NaN|Infinity|undefined/, `${name} ${width}x${height} ${JSON.stringify(adjust)}`);
            assert.match(path.d, /^M/, name);
            assert.ok(["norm", "none", "lighten", "lightenLess", "darken", "darkenLess"].includes(path.fill), name);
            assert.equal(typeof path.stroke, "boolean");
            for (const command of path.commands) for (const value of command.slice(1)) assert.ok(finite(value), `${name} ${command}`);
          }
          for (const value of Object.values(geometry.textRect)) assert.ok(finite(value), `${name} text`);
          for (const site of geometry.connectionSites) assert.ok(finite(site.x) && finite(site.y) && finite(site.angle), `${name} site`);
          for (const handle of geometry.handles) assert.ok(finite(handle.x) && finite(handle.y), `${name} handle`);
        }
    assert.ok(evaluations > 187 * SIZES.length * 2);
  });

  test("geometry scales with the size: the presets have no absolute lengths", () => {
    for (const name of PRESET_SHAPES) {
      const small = presetGeometry(name, 160, 90);
      const large = presetGeometry(name, 160 * 9525, 90 * 9525);
      small.paths.forEach((path, index) => {
        const big = large.paths[index].commands;
        path.commands.forEach((command, commandIndex) => {
          for (let k = 1; k < command.length; k++) assert.ok(Math.abs(command[k] * 9525 - big[commandIndex][k]) < 1e-3 * 9525, `${name} path ${index}`);
        });
      });
      assert.ok(Math.abs(small.textRect.width * 9525 - large.textRect.width) < 1, name);
    }
  });

  test("text rectangles lie in the shape's frame and, for closed shapes, start inside the filled outline", () => {
    // The standard puts these text rectangles over a hole or an open area of the outline (a frame's opening, a pie's
    // center, an arc's chord); PowerPoint uses them as they are.
    const overOpenArea = new Set([
      "bentArrow", "blockArc", "circularArrow", "cornerTabs", "curvedDownArrow", "curvedLeftArrow", "curvedRightArrow", "curvedUpArrow", "donut",
      "flowChartCollate", "frame", "halfFrame", "leftCircularArrow", "leftRightCircularArrow", "line", "lineInv", "mathEqual", "pie", "plaqueTabs",
      "squareTabs", "swooshArrow", "uturnArrow",
    ]);
    for (const name of PRESET_SHAPES)
      for (const [width, height] of [
        [200, 200],
        [300, 120],
        [100, 260],
      ]) {
        const geometry = presetGeometry(name, width, height);
        const { x, y, width: w, height: h } = geometry.textRect;
        assert.ok(w >= 0 && h >= 0, `${name}: text rectangle of negative size`);
        assert.ok(x >= -1e-6 && y >= -1e-6 && x + w <= width + 1e-6 && y + h <= height + 1e-6, `${name} ${width}x${height}: text rectangle outside the frame`);
        const filled = outlines(geometry, true);
        // Connectors and lines have no filled outline.
        if (overOpenArea.has(name) || filled.length === 0) continue;
        assert.ok(inside({ x: x + w / 2, y: y + h / 2 }, filled), `${name} ${width}x${height}: text center outside the outline`);
      }
  });

  test("connection sites lie on the outline", () => {
    // The standard places these sites at guide points beside the drawn outline: blockArc's and the gears' sites sit on
    // their construction circles, squareTabs' at the slide-corner tabs' inner corners, and the clouds' and
    // flowChartMultidocument's within a few units of their curves.
    const offOutline = new Map([
      ["blockArc", 0.26],
      ["gear6", 0.1],
      ["gear9", 0.25],
      ["squareTabs", 0.71],
      ["cloud", 0.006],
      ["cloudCallout", 0.025],
      ["flowChartMultidocument", 0.016],
    ]);
    for (const name of PRESET_SHAPES)
      for (const [width, height] of [
        [200, 200],
        [300, 120],
        [100, 260],
      ]) {
        const geometry = presetGeometry(name, width, height);
        const lines = outlines(geometry, false);
        const tolerance = (offOutline.get(name) ?? 0.0025) * Math.max(width, height);
        for (const site of geometry.connectionSites)
          assert.ok(distanceToOutline(site, lines) <= tolerance, `${name} ${width}x${height}: site ${site.x},${site.y} is ${distanceToOutline(site, lines)} from the outline`);
      }
  });
});

describe("the agreed API", () => {
  test("rect, roundRect, ellipse, triangle, chevron and rightArrow", () => {
    assert.equal(presetGeometry("rect", 200, 100).paths[0].d, "M0 0 L200 0 L200 100 L0 100 Z");
    assert.equal(
      presetGeometry("roundRect", 200, 100, { adj: 0.25 }).paths[0].d,
      "M0 25 A25 25 0 0 1 25 0 L175 0 A25 25 0 0 1 200 25 L200 75 A25 25 0 0 1 175 100 L25 100 A25 25 0 0 1 0 75 Z",
    );
    assert.equal(presetGeometry("ellipse", 200, 100).paths[0].d, "M0 50 A100 50 0 0 1 100 0 A100 50 0 0 1 200 50 A100 50 0 0 1 100 100 A100 50 0 0 1 0 50 Z");
    assert.equal(presetGeometry("triangle", 100, 80).paths[0].d, "M0 80 L50 0 L100 80 Z");
    assert.equal(presetGeometry("chevron", 200, 100).paths[0].d, "M0 0 L150 0 L200 50 L150 100 L0 100 L50 50 Z");
    const arrow = presetGeometry("rightArrow", 200, 100);
    assert.equal(arrow.paths[0].d, "M0 25 L150 25 L150 0 L200 50 L150 100 L150 75 L0 75 Z");
    assert.deepEqual(arrow.paths.map(({ fill, stroke }) => ({ fill, stroke })), [{ fill: "norm", stroke: true }]);
    assert.deepEqual(arrow.textRect, { x: 0, y: 25, width: 175, height: 50 });
    assert.deepEqual(arrow.connectionSites, [
      { x: 150, y: 0, angle: 270 },
      { x: 0, y: 50, angle: 180 },
      { x: 150, y: 100, angle: 90 },
      { x: 200, y: 50, angle: 0 },
    ]);
    assert.deepEqual(arrow.handles, [
      { kind: "xy", x: 0, y: 25, vertical: { adjust: "adj1", min: 0, max: 1 } },
      { kind: "xy", x: 150, y: 0, horizontal: { adjust: "adj2", min: 0, max: 2 } },
    ]);
  });

  test("presetAdjustments gives defaults and handle ranges in OPF units", () => {
    assert.deepEqual(presetAdjustments("rightArrow", 200, 100), {
      adj1: { default: 0.5, min: 0, max: 1, unit: "fraction" },
      adj2: { default: 0.5, min: 0, max: 2, unit: "fraction" },
    });
    assert.deepEqual(presetAdjustments("rect"), {});
    const pie = presetAdjustments("pie");
    assert.deepEqual(pie.adj2, { default: 270, min: 0, max: 359.999983333, unit: "degrees" });
    const hexagon = presetAdjustments("hexagon");
    assert.equal(hexagon.adj.unit, "fraction");
    assert.deepEqual(hexagon.vf, { default: 1.1547, min: null, max: null, unit: "fraction" }, "a factor no handle moves");
    assert.equal(presetAdjustments("accentCallout1").adj1.min, null, "an unbounded handle range is null");
    assert.throws(() => presetAdjustments("rectangle"), /Unknown preset shape 'rectangle'/);
  });

  test("adjust values convert to and from DrawingML, writing the whole avLst once any value is given", () => {
    assert.deepEqual(adjustToDrawingML("rightArrow", undefined), {});
    assert.deepEqual(adjustToDrawingML("rightArrow", {}), {});
    assert.deepEqual(adjustToDrawingML("rightArrow", { unknown: 1 }), {});
    assert.deepEqual(adjustToDrawingML("rightArrow", { adj1: 0.25 }), { adj1: 25000, adj2: 50000 });
    assert.deepEqual(adjustToDrawingML("pie", { adj1: 45 }), { adj1: 2700000, adj2: 16200000 });
    // PowerPoint refuses an avLst that names a hexagon's adj without its vf factor.
    assert.deepEqual(adjustToDrawingML("hexagon", { adj: 0.3 }), { adj: 30000, vf: 115470 });
    assert.deepEqual(adjustToDrawingML("star5", { adj: 0.2 }), { adj: 20000, hf: 105146, vf: 110557 });
    assert.deepEqual(adjustFromDrawingML("pie", { adj1: 2700000, adj2: 16200000 }), { adj1: 45, adj2: 270 });
    assert.deepEqual(adjustFromDrawingML("rightArrow", { adj1: 25000, other: 3 }), { adj1: 0.25 });
    for (const name of PRESET_SHAPES) {
      const info = presetAdjustments(name);
      const defaults = Object.fromEntries(Object.entries(info).map(([guide, entry]) => [guide, entry.default]));
      assert.deepEqual(adjustFromDrawingML(name, adjustToDrawingML(name, defaults)), Object.keys(defaults).length ? defaults : {}, name);
    }
  });

  test("an adjust value moves the outline, and the preset's own guides pin a value outside its range", () => {
    assert.notEqual(presetGeometry("chevron", 200, 100, { adj: 0.2 }).paths[0].d, presetGeometry("chevron", 200, 100).paths[0].d);
    assert.equal(presetGeometry("rightArrow", 200, 100, { adj1: 7 }).paths[0].d, presetGeometry("rightArrow", 200, 100, { adj1: 1 }).paths[0].d);
    assert.equal(presetGeometry("rightArrow", 200, 100, { adj1: -1 }).paths[0].d, presetGeometry("rightArrow", 200, 100, { adj1: 0 }).paths[0].d);
  });

  test("arcTo uses the visual angle: a quarter of a wide ellipse starts on its major axis and ends on its minor axis", () => {
    // pie from 0° to 90° on a 200 by 100 ellipse: the arc ends straight below the center, as PowerPoint draws it.
    const pie = presetGeometry("pie", 200, 100, { adj1: 0, adj2: 90 });
    assert.equal(pie.paths[0].d, "M200 50 A100 50 0 0 1 100 100 L100 50 Z");
    // At 45° the visual angle's point is where the ray at 45° meets the ellipse, not the parametric (cos 45°, sin 45°).
    const wedge = presetGeometry("pie", 200, 100, { adj1: 0, adj2: 45 });
    const end = wedge.paths[0].commands.at(-3);
    const offset = 1 / Math.sqrt(1 / 100 ** 2 + 1 / 50 ** 2); // x = y on the ellipse x²/100² + y²/50² = 1
    assert.ok(Math.abs(end.at(-2) - (100 + offset)) < 1e-6 && Math.abs(end.at(-1) - (50 + offset)) < 1e-6, String(end));
    // Negative sweeps draw counterclockwise; the path's w and h scale arcs with the rest of the path.
    assert.match(presetGeometry("leftCircularArrow", 200, 200).paths[0].d, / 0 0 0 /);
    assert.doesNotMatch(presetGeometry("flowChartTerminator", 200, 100).paths[0].d, /NaN/);
  });

  test("errors name the problem", () => {
    assert.throws(() => presetGeometry("Chevron", 10, 10), RangeError);
    assert.throws(() => presetGeometry("rect", -1, 10), /finite and not negative/);
    assert.throws(() => presetGeometry("rect", Number.NaN, 10), /finite and not negative/);
  });
});

describe("custom outlines", () => {
  test("SVG path data in a 0 to 1 box scales to the size", () => {
    const geometry = customGeometry("M0 0 L1 0 L0.5 1 Z", 200, 100);
    assert.equal(geometry.paths[0].d, "M0 0 L200 0 L100 100 Z");
    assert.deepEqual(geometry.paths[0].commands, [["M", 0, 0], ["L", 200, 0], ["L", 100, 100], ["Z"]]);
    assert.equal(geometry.paths[0].fill, "norm");
    assert.equal(geometry.paths[0].stroke, true);
    assert.deepEqual(geometry.textRect, { x: 0, y: 0, width: 200, height: 100 });
    assert.deepEqual(geometry.connectionSites, [
      { x: 100, y: 0, angle: 270 },
      { x: 0, y: 50, angle: 180 },
      { x: 100, y: 100, angle: 90 },
      { x: 200, y: 50, angle: 0 },
    ]);
    assert.deepEqual(geometry.handles, []);
  });

  test("a viewBox, relative commands, shorthand curves and arcs", () => {
    const box = customGeometry({ d: "M10 10 h80 v80 H10 z", viewBox: "10 10 80 80" }, 100, 50);
    assert.equal(box.paths[0].d, "M0 0 L100 0 L100 50 L0 50 Z");
    assert.equal(customGeometry({ d: "M0,0 l10,0 l0,10z", viewBox: [0, 0, 10, 10] }, 10, 10).paths[0].d, "M0 0 L10 0 L10 10 Z");
    const smooth = customGeometry("M0 0 C0.2 0 0.3 0.5 0.5 0.5 S1 1 1 1 Q1 0 0.5 0 T0 0", 100, 100).paths[0].commands;
    assert.deepEqual(smooth[2], ["C", 70, 50, 100, 100, 100, 100]);
    assert.deepEqual(smooth[4], ["Q", 0, 0, 0, 0]);
    // A circle drawn with two arcs (flags without separators) becomes cubic Béziers that stay on the circle.
    const circle = customGeometry({ d: "M0 5a5 5 0 1010 0a5 5 0 10-10 0z", viewBox: "0 0 10 10" }, 100, 100);
    assert.ok(circle.paths[0].commands.every((command) => command[0] !== "A"));
    for (const point of flattenShapePath(circle.paths[0].commands, 12).flat()) assert.ok(Math.abs(Math.hypot(point.x - 50, point.y - 50) - 50) < 0.05, JSON.stringify(point));
  });

  test("bad path data and viewBoxes throw", () => {
    assert.throws(() => customGeometry("", 10, 10), SyntaxError);
    assert.throws(() => customGeometry("L0 0", 10, 10), /start with/);
    assert.throws(() => customGeometry("M0 0 L1", 10, 10), /groups of 2/);
    assert.throws(() => customGeometry("M0 0 X1 1", 10, 10), /Unexpected 'X'/);
    assert.throws(() => customGeometry({ d: "M0 0", viewBox: "0 0 0 10" }, 10, 10), /viewBox/);
  });
});
