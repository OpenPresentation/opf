import assert from "node:assert/strict";
import { boxesAt, dividerKeyAction, inside, ratioLabel } from "../dist/studio-kit/overlay.js";

// CE-18, the parts of the studio kit's overlay that need no DOM, against the kit API only: hit-testing boxes in unit coordinates, the
// divider keyboard and the ratio label. test/studio-kit-browser.mjs paints the overlay (keyed boxes, badges, dividers, drop line, ratio,
// guide and markers) in a page.
const boxes = [
  { key: "row", depth: 1, x: 0, y: 0, w: 1, h: 1 },
  { key: "left", depth: 2, x: 0, y: 0, w: 0.5, h: 1 },
  { key: "right", depth: 2, x: 0.5, y: 0, w: 0.5, h: 1 },
  { key: "inner", depth: 3, x: 0.6, y: 0.1, w: 0.2, h: 0.2 },
];
assert.equal(inside(boxes[1], { x: 0.5, y: 0.5 }), true, "the edge is inside");
assert.equal(inside(boxes[1], { x: 0.5004, y: 0.5 }), false);
assert.equal(inside(boxes[1], { x: 0.5004, y: 0.5 }, 0.0005), true, "with slack");
assert.deepEqual(boxesAt([...boxes].reverse(), { x: 0.7, y: 0.2 }).map((box) => box.key), ["row", "right", "inner"], "outermost first, whatever the input order");
assert.deepEqual(boxesAt(boxes, { x: 0.7, y: 0.2 }, { skip: (box) => box.key === "inner" }).map((box) => box.key), ["row", "right"], "skip leaves the dragged boxes out");
assert.deepEqual(boxesAt(boxes, { x: 1.2, y: 0.2 }), []);

// The divider keyboard: arrows across the line nudge (Shift: a big step), Enter equalizes, modifiers and other keys do nothing.
const key = (name, extra = {}) => ({ key: name, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...extra });
assert.deepEqual(dividerKeyAction(key("ArrowRight"), "vertical"), { type: "nudge", step: 1, big: false });
assert.deepEqual(dividerKeyAction(key("ArrowLeft", { shiftKey: true }), "vertical"), { type: "nudge", step: -1, big: true });
assert.equal(dividerKeyAction(key("ArrowUp"), "vertical"), null, "a vertical line moves left and right");
assert.deepEqual(dividerKeyAction(key("ArrowDown"), "horizontal"), { type: "nudge", step: 1, big: false });
assert.deepEqual(dividerKeyAction(key("Enter"), "horizontal"), { type: "equalize" });
assert.equal(dividerKeyAction(key("ArrowRight", { ctrlKey: true }), "vertical"), null);
assert.equal(dividerKeyAction(key("ArrowRight", { altKey: true }), "vertical"), null);
assert.equal(dividerKeyAction(key("Tab"), "vertical"), null);

assert.equal(ratioLabel(2, 1), "2 : 1");
assert.equal(ratioLabel(1 / 3, 2 / 3), "0.333 : 0.667");

console.log("studio kit overlay: hit-testing, divider keyboard and ratio label passed");
