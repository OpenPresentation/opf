// RR-105: a drag cannot author an overlay far beyond the slide: it sizes a shape up to OVERLAY_DRAG_MAX slide widths or heights, the
// format's own limit of 8 (one constant with the schema and typed input), and a shape already larger keeps its size when it is moved.
import assert from "node:assert/strict";
import { OVERLAY_DRAG_MAX, draggedFrame, prepareOverlayFrame } from "../src/shape-overlays.js";

const W = 1280, H = 720;
assert.equal(OVERLAY_DRAG_MAX, 8, "the schema's limit: 8 slide widths, as docs/shapes.md allows shapes that bleed off the slide");
// An ordinary frame is unchanged: fractions of the slide, rounded to four places.
assert.deepEqual(draggedFrame({ x: 128, y: 72, width: 320, height: 180 }, { W, H }), { x: 0.1, y: 0.1, width: 0.25, height: 0.25 });
// A handle dragged a million pixels is held at the ceiling, in both directions; a position may still cross the edge.
assert.deepEqual(draggedFrame({ x: -64, y: 36, width: 1e6, height: 1e7 }, { W, H }), { x: -0.05, y: 0.05, width: 8, height: 8 });
// A shape that bleeds off the slide, below the ceiling, drags as far as the pointer goes.
assert.equal(draggedFrame({ x: 0, y: 0, width: 3 * W, height: 2.5 * H }, { W, H }).width, 3);
// Tiny frames keep the floor.
assert.deepEqual(draggedFrame({ x: 0, y: 0, width: 1, height: 1 }, { W, H, min: 0.01 }), { x: 0, y: 0, width: 0.01, height: 0.01 });
// A shape larger than the ceiling (a document that skipped validation) is moved, or dragged smaller, without being cut down to it.
const giant = { x: 0, y: 0, width: 10 * W, height: 9 * H };
assert.deepEqual(draggedFrame({ ...giant, x: 50 }, { W, H, current: giant }), { x: 0.0391, y: 0, width: 10, height: 9 });
assert.equal(draggedFrame({ ...giant, width: 20 * W }, { W, H, current: giant }).width, 10, "it cannot grow past what it was");
assert.equal(draggedFrame({ ...giant, width: 2 * W }, { W, H, current: giant }).width, 2, "but it can shrink");
// A right-to-left slide counts x from the right edge.
assert.equal(draggedFrame({ x: 0, y: 0, width: 640, height: 360 }, { W, H, rtl: true }).x, 0.5);

// Typed input stops at the same limit.
const deck = { slides: [{ title: "Slide", shapes: [{ shape: "ellipse", x: 0.1, y: 0.1, width: 0.2, height: 0.2 }] }] };
const typed = prepareOverlayFrame(deck, "slides.0.shapes.0", { width: 50, height: 6 });
assert.equal(typed.presentation.slides[0].shapes[0].width, 8);
assert.equal(typed.presentation.slides[0].shapes[0].height, 6);
console.log("overlay drag: sized up to eight slide widths, as typed sizes are; larger authored shapes unchanged");
