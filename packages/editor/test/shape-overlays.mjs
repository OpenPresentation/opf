import assert from "node:assert/strict";
import { createEditorSession } from "../src/index.js";
import { setShapeProperties } from "../src/shape-options.js";
import { CONNECTOR_ROUTES, OVERLAY_LAYER_MOVES, connectShapes, detachOverlay, insertOverlayShape, listConnectionEnds, moveOverlayLayer, overlayPathForSelection, prepareConnect, readOverlay, removeOverlay, setConnector, setOverlayFrame } from "../src/shape-overlays.js";

// SH-06 part B: overlay shapes and connectors as one undoable step each: insert, move and resize (fractions, or an anchored shape keeps its `at`),
// restack (array order), remove, connect two blocks or overlays (ends without an id get one), change a connector.
const deck = () => ({
  name: "Overlays",
  slides: [
    {
      id: "s",
      title: "Slide",
      blocks: [{ id: "alpha", text: "Alpha" }, { text: "Beta" }],
      shapes: [
        { id: "note", shape: "wedgeRectCallout", text: "Hi", x: 0.1, y: 0.5, width: 0.2, height: 0.12 },
        { id: "badge", shape: "ellipse", at: { block: "alpha", edge: "top", offset: 8, width: 40, height: 40 } },
        { connector: { from: "alpha", to: "note" }, stroke: { width: 2 } },
      ],
    },
    { id: "plain", title: "Plain", text: "Only text" },
  ],
});
const session = () => createEditorSession(deck());
const fails = (action, code) => assert.throws(action, (error) => error.code === code, code);

// reading
{
  const doc = deck();
  assert.equal(overlayPathForSelection(doc, "slides.0.shapes.0.text"), "slides.0.shapes.0");
  assert.equal(overlayPathForSelection(doc, "slides.0.shapes.9"), undefined);
  assert.equal(overlayPathForSelection(doc, "slides.0.blocks.0"), undefined);
  assert.deepEqual([readOverlay(doc, "slides.0.shapes.0").kind, readOverlay(doc, "slides.0.shapes.0").placement], ["shape", "fractions"]);
  assert.deepEqual([readOverlay(doc, "slides.0.shapes.1").kind, readOverlay(doc, "slides.0.shapes.1").placement], ["shape", "at"]);
  assert.deepEqual([readOverlay(doc, "slides.0.shapes.2").kind, readOverlay(doc, "slides.0.shapes.2").placement, readOverlay(doc, "slides.0.shapes.2").count], ["connector", "none", 3]);
  assert.deepEqual(listConnectionEnds(doc, 0).map((end) => [end.kind, end.id ?? null]), [["block", "alpha"], ["block", null], ["shape", "note"], ["shape", "badge"]], "blocks and overlay shapes, not connectors");
  assert.deepEqual(CONNECTOR_ROUTES, ["straight", "elbow", "curved"]);
  assert.deepEqual(OVERLAY_LAYER_MOVES, ["front", "forward", "backward", "back"]);
}

// inserting, with undo
{
  const editor = session();
  const change = insertOverlayShape(editor, { slideIndex: 0, shape: "star5", center: { x: 0.8, y: 0.3 } });
  assert.equal(change.path, "slides.0.shapes.3");
  const added = editor.presentation.slides[0].shapes[3];
  assert.equal(added.shape, "star5");
  assert.ok(Math.abs(added.width - 0.2) < 1e-9 && Math.abs((added.height * 720) / (added.width * 1280) - 1) < 0.01, "a star keeps its square proportions on a 16:9 slide");
  assert.ok(added.x > 0.6 && added.y > 0.1 && added.x + added.width <= 1);
  editor.undo();
  assert.equal(editor.presentation.slides[0].shapes.length, 3);
  // a slide with no overlays gets the array
  insertOverlayShape(editor, { slideIndex: 1, shape: "rect", frame: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 }, block: { text: "Note" } });
  assert.deepEqual(editor.presentation.slides[1].shapes, [{ shape: "rect", x: 0.1, y: 0.1, width: 0.3, height: 0.2, text: "Note" }]);
  editor.undo();
  assert.equal(editor.presentation.slides[1].shapes, undefined);
  fails(() => insertOverlayShape(editor, { slideIndex: 0, shape: "nope" }), "invalid-overlay");
  fails(() => insertOverlayShape(editor, { slideIndex: 7, shape: "rect" }), "invalid-overlay");
}

// move and resize: fractions, kept on the slide
{
  const editor = session();
  setOverlayFrame(editor, "slides.0.shapes.0.shape", { x: 0.4, y: 0.3 });
  assert.deepEqual(Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, editor.presentation.slides[0].shapes[0][key]])), { x: 0.4, y: 0.3, width: 0.2, height: 0.12 });
  setOverlayFrame(editor, "slides.0.shapes.0", { x: 5, y: -3 });
  assert.deepEqual([editor.presentation.slides[0].shapes[0].x, editor.presentation.slides[0].shapes[0].y], [0.8, 0], "kept on the slide");
  setOverlayFrame(editor, "slides.0.shapes.0", { width: 0.5 });
  assert.equal(editor.presentation.slides[0].shapes[0].x, 0.5, "a wider shape is pulled back onto the slide");
  setOverlayFrame(editor, "slides.0.shapes.0", { x: 0.12345678 });
  assert.equal(editor.presentation.slides[0].shapes[0].x, 0.1235, "four places");
  const same = setOverlayFrame(editor, "slides.0.shapes.0", { x: 0.1235 });
  assert.equal(same.changed, false);
  editor.undo();
  assert.equal(editor.presentation.slides[0].shapes[0].x, 0.5);
  fails(() => setOverlayFrame(editor, "slides.0.shapes.0", { offset: 3 }), "invalid-overlay");
  fails(() => setOverlayFrame(editor, "slides.0.shapes.0", { z: 1 }), "invalid-overlay");
  fails(() => setOverlayFrame(editor, "slides.0.shapes.2", { x: 0.1 }), "not-an-overlay");
  fails(() => setOverlayFrame(editor, "slides.0.blocks.0", { x: 0.1 }), "not-an-overlay");
}

// an attached shape keeps its anchor; detaching frees it
{
  const editor = session();
  setOverlayFrame(editor, "slides.0.shapes.1", { offset: 20, width: 60, height: 60 });
  assert.deepEqual(editor.presentation.slides[0].shapes[1].at, { block: "alpha", edge: "top", offset: 20, width: 60, height: 60 });
  fails(() => setOverlayFrame(editor, "slides.0.shapes.1", { x: 0.2 }), "overlay-anchored");
  detachOverlay(editor, "slides.0.shapes.1", { x: 0.7, y: 0.2, width: 0.05, height: 0.09 });
  assert.deepEqual(editor.presentation.slides[0].shapes[1], { id: "badge", shape: "ellipse", x: 0.7, y: 0.2, width: 0.05, height: 0.09 });
  editor.undo();
  assert.equal(editor.presentation.slides[0].shapes[1].at.offset, 20, "one undo reattaches it");
  fails(() => detachOverlay(editor, "slides.0.shapes.0", { x: 0, y: 0, width: 0.1, height: 0.1 }), "invalid-overlay");
}

// stacking is the array order
{
  const editor = session();
  const names = () => editor.presentation.slides[0].shapes.map((entry) => entry.id ?? "connector");
  assert.deepEqual(names(), ["note", "badge", "connector"]);
  assert.equal(moveOverlayLayer(editor, "slides.0.shapes.0", "forward").path, "slides.0.shapes.1");
  assert.deepEqual(names(), ["badge", "note", "connector"]);
  moveOverlayLayer(editor, "slides.0.shapes.1", "front");
  assert.deepEqual(names(), ["badge", "connector", "note"]);
  moveOverlayLayer(editor, "slides.0.shapes.2", "back");
  assert.deepEqual(names(), ["note", "badge", "connector"]);
  moveOverlayLayer(editor, "slides.0.shapes.2", "backward");
  assert.deepEqual(names(), ["note", "connector", "badge"]);
  assert.equal(moveOverlayLayer(editor, "slides.0.shapes.2", "front").changed, false, "already on top");
  assert.equal(moveOverlayLayer(editor, "slides.0.shapes.0", "back").changed, false);
  editor.undo();
  editor.undo();
  assert.deepEqual(names(), ["badge", "connector", "note"], "undo restores the order a step at a time");
  fails(() => moveOverlayLayer(editor, "slides.0.shapes.0", "sideways"), "invalid-overlay");
}

// removing a shape takes the connectors on it
{
  const editor = session();
  const change = removeOverlay(editor, "slides.0.shapes.0");
  assert.deepEqual(change.removed, ["slides.0.shapes.0", "slides.0.shapes.2"], "the callout and the connector that ended on it");
  assert.deepEqual(editor.presentation.slides[0].shapes.map((entry) => entry.id), ["badge"]);
  removeOverlay(editor, "slides.0.shapes.0");
  assert.equal(editor.presentation.slides[0].shapes, undefined, "an empty shapes array goes");
  editor.undo();
  editor.undo();
  assert.equal(editor.presentation.slides[0].shapes.length, 3);
  const connectorOnly = session();
  removeOverlay(connectorOnly, "slides.0.shapes.2");
  assert.equal(connectorOnly.presentation.slides[0].shapes.length, 2);
}

// connecting: ids are given, one undo takes everything back
{
  const editor = session();
  const change = connectShapes(editor, { slideIndex: 0, from: "slides.0.blocks.1.text", to: "slides.0.shapes.1.shape", route: "elbow", stroke: { end: { type: "triangle" } } });
  assert.equal(change.path, "slides.0.shapes.3");
  const slide = editor.presentation.slides[0];
  assert.equal(slide.blocks[1].id, "beta", "the block with no id gets one, from its text");
  assert.deepEqual(slide.shapes[3], { connector: { from: "beta", to: "badge", route: "elbow" }, stroke: { end: { type: "triangle" } } });
  editor.undo();
  assert.equal(editor.presentation.slides[0].blocks[1].id, undefined, "one undo takes the ids and the connector back");
  assert.equal(editor.presentation.slides[0].shapes.length, 3);
  // straight is the default and is not written
  connectShapes(editor, { slideIndex: 0, from: "slides.0.blocks.0", to: "slides.0.blocks.1" });
  assert.deepEqual(editor.presentation.slides[0].shapes[3].connector, { from: "alpha", to: "beta" });
  // an overlay with no id gets one too
  const noId = createEditorSession({ name: "x", slides: [{ title: "a", blocks: [{ text: "One" }], shapes: [{ shape: "star5", x: 0.5, y: 0.5, width: 0.1, height: 0.1 }] }] });
  connectShapes(noId, { slideIndex: 0, from: "slides.0.blocks.0", to: "slides.0.shapes.0" });
  assert.equal(noId.presentation.slides[0].shapes[0].id, "star5");
  assert.equal(noId.presentation.slides[0].blocks[0].id, "one");
  // a slide that has no shapes gets the array
  const plain = createEditorSession({ name: "x", slides: [{ title: "a", blocks: [{ text: "One" }, { text: "Two" }] }] });
  connectShapes(plain, { slideIndex: 0, from: "slides.0.blocks.0", to: "slides.0.blocks.1", route: "curved" });
  assert.deepEqual(plain.presentation.slides[0].shapes, [{ connector: { from: "one", to: "two", route: "curved" } }]);
  // refusals
  fails(() => connectShapes(editor, { slideIndex: 0, from: "slides.0.blocks.0", to: "slides.0.blocks.0" }), "invalid-overlay");
  fails(() => connectShapes(editor, { slideIndex: 0, from: "slides.0.blocks.0", to: "slides.0.shapes.2" }), "invalid-overlay");
  fails(() => connectShapes(editor, { slideIndex: 0, from: "slides.0.blocks.0", to: "slides.1.title" }), "invalid-overlay");
  fails(() => connectShapes(editor, { slideIndex: 0, from: "slides.0.blocks.0", to: "slides.0.blocks.1", route: "zigzag" }), "invalid-overlay");
  assert.throws(() => prepareConnect(editor.presentation, { from: "a", to: "b" }), /slideIndex/);
}

// changing a connector and its line
{
  const editor = session();
  setConnector(editor, "slides.0.shapes.2", { route: "curved", fromSite: 1, toSite: 3 });
  assert.deepEqual(editor.presentation.slides[0].shapes[2].connector, { from: "alpha", to: "note", route: "curved", fromSite: 1, toSite: 3 });
  setConnector(editor, "slides.0.shapes.2.stroke", { route: "straight", fromSite: null });
  assert.deepEqual(editor.presentation.slides[0].shapes[2].connector, { from: "alpha", to: "note", toSite: 3 });
  setConnector(editor, "slides.0.shapes.2", { to: "slides.0.shapes.1" });
  assert.equal(editor.presentation.slides[0].shapes[2].connector.to, "badge");
  fails(() => setConnector(editor, "slides.0.shapes.2", { route: "wavy" }), "invalid-overlay");
  fails(() => setConnector(editor, "slides.0.shapes.2", { fromSite: -1 }), "invalid-overlay");
  fails(() => setConnector(editor, "slides.0.shapes.0", { route: "elbow" }), "not-an-overlay");
  // its line and accessibility keys go through setShapeProperties; a shape's keys are refused
  setShapeProperties(editor, "slides.0.shapes.2", { stroke: { width: 3, end: { type: "stealth" } }, alt: "Alpha to the callout" });
  assert.deepEqual(editor.presentation.slides[0].shapes[2].stroke, { width: 3, end: { type: "stealth" } });
  assert.equal(editor.presentation.slides[0].shapes[2].alt, "Alpha to the callout");
  fails(() => setShapeProperties(editor, "slides.0.shapes.2", { fill: "accent1" }), "not-a-shape-block");
  // a shape's keys go through the same command on an overlay shape
  setShapeProperties(editor, "slides.0.shapes.0.shape", { fill: "accent2", rotate: 10 });
  assert.deepEqual([editor.presentation.slides[0].shapes[0].fill, editor.presentation.slides[0].shapes[0].rotate], ["accent2", 10]);
}

console.log("shape overlays ok");
