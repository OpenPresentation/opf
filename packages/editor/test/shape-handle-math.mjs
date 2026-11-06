import assert from "node:assert/strict";
import * as engine from "@openpresentation/opf/shape-geometry";
import { effectiveAdjust, handleAxes, handleLayout, keyTarget, solveHandle, toLocal, toSlide } from "../src/shape-handle-math.js";

// SH-06: where a preset's adjust handles are on the slide and which adjust values put a handle under the pointer. Every handle of every one of the
// 187 presets is driven: put at the position of known values it finds a position within half a unit of them, and a pointer far outside the frame
// leaves the values inside the handle's range.
const SIZE = { width: 300, height: 200 };

// toSlide and toLocal are inverses, in a rotated, mirrored frame, and a shape is mirrored before it is rotated.
for (const frame of [
  { x: 40, y: 30, width: 300, height: 200 },
  { x: 40, y: 30, width: 300, height: 200, rotate: 33, flipH: true },
  { x: 0, y: 0, width: 120, height: 400, rotate: -90, flipV: true },
  { x: 10, y: 20, width: 80, height: 80, rotate: 180, flipH: true, flipV: true },
]) {
  for (const point of [{ x: 0, y: 0 }, { x: frame.width, y: frame.height }, { x: frame.width / 3, y: frame.height * 0.8 }]) {
    const back = toLocal(toSlide(point, frame), frame);
    assert.ok(Math.hypot(back.x - point.x, back.y - point.y) < 1e-9, JSON.stringify({ frame, point, back }));
  }
}
const mirrored = toSlide({ x: 0, y: 0 }, { x: 0, y: 0, width: 100, height: 50, flipH: true });
assert.deepEqual([mirrored.x, mirrored.y], [100, 0], "flipH mirrors across the frame's center");
const turned = toSlide({ x: 100, y: 25 }, { x: 0, y: 0, width: 100, height: 50, rotate: 90 });
assert.ok(Math.abs(turned.x - 50) < 1e-9 && Math.abs(turned.y - 75) < 1e-9, "a quarter turn clockwise about the center: the right edge goes to the bottom");
const both = toSlide({ x: 0, y: 0 }, { x: 0, y: 0, width: 100, height: 50, rotate: 90, flipH: true });
assert.ok(Math.abs(both.x - 75) < 1e-9 && Math.abs(both.y - 75) < 1e-9, "mirror first, then rotate");

let seed = 7;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

let handles = 0;
let twoAxis = 0;
for (const preset of engine.PRESET_SHAPES) {
  const known = engine.presetAdjustments(preset, SIZE.width, SIZE.height);
  const layout = handleLayout(engine, preset, { x: 0, y: 0, ...SIZE }, {});
  assert.deepEqual(layout.map((entry) => entry.index), layout.map((_, index) => index), preset);
  for (const entry of layout) {
    handles += 1;
    if (entry.axes.length > 1) twoAxis += 1;
    // 1. A handle where it already is stays: the values are the defaults (to rounding).
    const home = solveHandle(engine, preset, SIZE, {}, entry.index, entry.local);
    assert.ok(home.distance < 0.5, `${preset} handle ${entry.index} stays put: ${home.distance}`);
    // 2. Known values: the handle at (random values in the range, or the default's neighborhood) is found again.
    const chosen = {};
    for (const axis of entry.axes) {
      const spec = known[axis.adjust];
      const low = axis.min === null ? spec.default - 0.4 : Math.min(axis.min, spec.default);
      const high = axis.max === null ? spec.default + 0.4 : Math.max(axis.max, spec.default);
      chosen[axis.adjust] = low + (high - low) * (0.15 + 0.7 * random());
    }
    const target = engine.presetGeometry(preset, SIZE.width, SIZE.height, chosen).handles[entry.index];
    const found = solveHandle(engine, preset, SIZE, {}, entry.index, { x: target.x, y: target.y });
    assert.ok(found.distance < 0.6, `${preset} handle ${entry.index}: ${found.distance} from ${JSON.stringify(chosen)} got ${JSON.stringify(found.values)}`);
    // 3. Whatever the pointer does, the values stay in the range of the handle at the end.
    for (const far of [{ x: 5000, y: -5000 }, { x: -5000, y: 5000 }, { x: 150, y: 100 }]) {
      const pinned = solveHandle(engine, preset, SIZE, {}, entry.index, far);
      for (const axis of entry.axes) {
        const value = pinned.values[axis.adjust];
        assert.ok(Number.isFinite(value), `${preset} ${axis.adjust} is a number`);
        // The range, widened to hold the preset's default (star24, star32 and mathDivide report a range that leaves it out).
        const low = axis.min === null ? null : Math.min(axis.min, known[axis.adjust].default);
        const high = axis.max === null ? null : Math.max(axis.max, known[axis.adjust].default);
        assert.ok((low === null || value >= low - 1e-9) && (high === null || value <= high + 1e-9), `${preset} ${axis.adjust} = ${value} in ${low}..${high}`);
      }
    }
  }
}
assert.ok(handles > 240, `${handles} handles driven`);
assert.ok(twoAxis > 40, `${twoAxis} two-axis handles driven`);

// Units: fractions to four places, degrees to two.
{
  const pie = solveHandle(engine, "pie", SIZE, {}, 0, { x: 150 + 80, y: 100 + 80 });
  assert.equal(Object.keys(pie.values).join(), "adj1");
  assert.ok(pie.values.adj1 > 44 && pie.values.adj1 < 46, `a pie's angle handle at the lower right is about 45 degrees: ${pie.values.adj1}`);
  assert.equal(pie.values.adj1, Math.round(pie.values.adj1 * 100) / 100);
  const arrow = solveHandle(engine, "rightArrow", SIZE, {}, 0, { x: 0, y: 140 });
  assert.equal(arrow.values.adj1, Math.round(arrow.values.adj1 * 10000) / 10000);
}

// A callout's tail is unbounded: a handle dragged well outside the frame follows the pointer.
{
  const far = solveHandle(engine, "wedgeRectCallout", SIZE, {}, 0, { x: 700, y: 450 });
  assert.ok(far.distance < 1, `the tail follows the pointer outside the frame: ${far.distance}`);
  assert.ok(far.values.adj1 > 1.5 && far.values.adj2 > 1.5, JSON.stringify(far.values));
}

// A drag keeps the block's other values: only the handle's axes are solved.
{
  const adjust = { adj1: 0.2, adj2: 0.6 };
  const handle = solveHandle(engine, "rightArrow", SIZE, adjust, 1, { x: 220, y: 0 });
  assert.deepEqual(Object.keys(handle.values), ["adj2"]);
  const state = effectiveAdjust(engine, "rightArrow", SIZE, adjust);
  assert.deepEqual(Object.fromEntries(Object.entries(state).map(([name, entry]) => [name, entry.value])), { adj1: 0.2, adj2: 0.6 });
  assert.equal(effectiveAdjust(engine, "rightArrow", SIZE, {}).adj1.value, 0.5);
}

assert.deepEqual(handleAxes({ kind: "polar", x: 0, y: 0, radius: { adjust: "adj3", min: 0, max: 0.5 }, angle: { adjust: "adj2", min: 0, max: 360 } }).map((axis) => axis.role), ["radius", "angle"]);
assert.deepEqual(keyTarget({ x: 10, y: 10 }, "ArrowRight", 5), { x: 15, y: 10 });
assert.deepEqual(keyTarget({ x: 10, y: 10 }, "ArrowUp", 5), { x: 10, y: 5 });
assert.equal(keyTarget({ x: 10, y: 10 }, "Enter", 5), undefined);

console.log(`shape handle math ok: ${handles} handles of ${engine.PRESET_SHAPES.length} presets`);
