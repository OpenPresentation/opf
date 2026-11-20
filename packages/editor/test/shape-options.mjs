import assert from "node:assert/strict";
import { createEditorSession } from "../src/index.js";
import { SHAPE_PROPERTY_KEYS, insertShape, loadShapeEngine, prepareShapeInsert, prepareShapeProperties, readShape, readShapeAdjust, searchShapes, setShapeAdjust, setShapePreset, setShapeProperties, shapeBlockPathForSelection, shapeGroups } from "../src/shape-options.js";

// SH-06: the shape commands. Each edit is one undoable patch through the session; empty values remove their key; a refused value changes nothing.
const deck = () => ({ name: "Shapes", slides: [{ id: "a", title: "A" }, { id: "b", title: "B", blocks: [{ shape: "rightArrow", text: "Go" }, { text: "Beside it" }] }] });
await loadShapeEngine();
const session = () => createEditorSession(deck());
const fails = (action, code) => assert.throws(action, (error) => error.code === code, code);

// finding the block
{
  const doc = deck();
  assert.equal(shapeBlockPathForSelection(doc, "slides.1.blocks.0.shape"), "slides.1.blocks.0");
  assert.equal(shapeBlockPathForSelection(doc, "slides.1.blocks.0.text"), "slides.1.blocks.0");
  assert.equal(shapeBlockPathForSelection(doc, "slides.1.blocks.0"), "slides.1.blocks.0");
  assert.equal(shapeBlockPathForSelection(doc, "slides.1.blocks.1.text"), undefined, "a text block is not a shape");
  assert.equal(shapeBlockPathForSelection(doc, "slides.1.title"), undefined);
  assert.deepEqual(readShape(doc, "slides.1.blocks.0.shape"), { path: "slides.1.blocks.0", explicit: true, overlay: false, preset: "rightArrow", custom: false, block: { shape: "rightArrow", text: "Go" } });
  assert.equal(readShape(doc, "slides.1.blocks.1"), undefined);
}

// catalog helpers
{
  assert.equal(searchShapes("speech bubble")[0].name, "wedgeRectCallout");
  assert.equal(shapeGroups().length, 9);
  assert.equal(shapeGroups().reduce((sum, group) => sum + group.shapes.length, 0), 187);
  assert.ok(SHAPE_PROPERTY_KEYS.includes("adjust") && SHAPE_PROPERTY_KEYS.includes("link"));
}

// setShapeProperties: one patch, undo and redo, empty values remove, refusals change nothing
{
  const editor = session();
  const gradient = { gradient: { type: "linear", angle: 45, stops: [{ color: "accent1", position: 0 }, { color: { color: "accent1", darken: 0.4 }, position: 1 }] } };
  const change = setShapeProperties(editor, "slides.1.blocks.0", { fill: gradient, shadow: "soft", rotate: 15, stroke: { color: { color: "accent2", lighten: 0.4 }, width: 3, dash: [4, 2], end: { type: "stealth" } } });
  assert.equal(change.changed, true);
  assert.equal(change.path, "slides.1.blocks.0");
  const block = editor.presentation.slides[1].blocks[0];
  assert.deepEqual([block.fill, block.shadow, block.rotate, block.stroke.dash], [gradient, "soft", 15, [4, 2]]);
  editor.undo();
  assert.deepEqual(editor.presentation.slides[1].blocks[0], { shape: "rightArrow", text: "Go" }, "one undo takes the whole edit back");
  editor.redo();
  assert.equal(editor.presentation.slides[1].blocks[0].rotate, 15);
  // empty values remove their key
  setShapeProperties(editor, "slides.1.blocks.0", { rotate: 0, shadow: null, alt: "  ", decorative: false, hidden: false, link: "", text: "", softEdge: 0 });
  assert.deepEqual(Object.keys(editor.presentation.slides[1].blocks[0]).sort(), ["fill", "shape", "stroke"]);
  // unchanged: no patch, no undo step
  const same = setShapeProperties(editor, "slides.1.blocks.0", { fill: gradient });
  assert.equal(same.changed, false);
  assert.deepEqual(same.patches, []);
  // refusals
  const snapshot = JSON.stringify(editor.presentation);
  fails(() => setShapeProperties(editor, "slides.1.blocks.1", { fill: "accent1" }), "not-a-shape-block");
  fails(() => setShapeProperties(editor, "slides.1.blocks.0", { colour: "red" }), "invalid-shape");
  fails(() => setShapeProperties(editor, "slides.1.blocks.0", { shape: null }), "invalid-shape");
  fails(() => setShapeProperties(editor, "slides.1.blocks.0", { link: "not a url" }), "invalid-opf-edit");
  fails(() => setShapeProperties(editor, "slides.1.blocks.0", { opacity: 4 }), "invalid-opf-edit");
  fails(() => setShapeProperties(editor, "slides.1.blocks.0", { decorative: "yes" }), "invalid-shape");
  assert.equal(JSON.stringify(editor.presentation), snapshot, "a refused edit changes nothing");
  // rotation is wrapped and rounded
  setShapeProperties(editor, "slides.1.blocks.0", { rotate: 725.123 });
  assert.equal(editor.presentation.slides[1].blocks[0].rotate, 5.12);
  // the prepare form touches no session
  const prepared = prepareShapeProperties(editor.presentation, "slides.1.blocks.0", { style: "intense" });
  assert.equal(prepared.changed, true);
  assert.equal(editor.presentation.slides[1].blocks[0].style, undefined);
  assert.equal(prepared.presentation.slides[1].blocks[0].style, "intense");
}

// the preset and its adjust values
{
  const editor = session();
  const adjusted = setShapeAdjust(editor, "slides.1.blocks.0.shape", { adj1: 0.3, adj2: 0.7 }, { size: { width: 300, height: 150 } });
  assert.equal(adjusted.changed, true);
  assert.deepEqual(editor.presentation.slides[1].blocks[0].adjust, { adj1: 0.3, adj2: 0.7 });
  // values merge, null removes one, pinned to the range of the frame
  setShapeAdjust(editor, "slides.1.blocks.0", { adj2: 9 }, { size: { width: 300, height: 150 } });
  assert.equal(editor.presentation.slides[1].blocks[0].adjust.adj2, 2, "pinned to the handle's maximum for a 2:1 frame");
  setShapeAdjust(editor, "slides.1.blocks.0", { adj2: 9 }, { size: { width: 100, height: 100 } });
  assert.equal(editor.presentation.slides[1].blocks[0].adjust.adj2, 1, "the range follows the frame");
  setShapeAdjust(editor, "slides.1.blocks.0", { adj1: null });
  assert.deepEqual(editor.presentation.slides[1].blocks[0].adjust, { adj2: 1 });
  setShapeAdjust(editor, "slides.1.blocks.0", { adj2: null });
  assert.equal(editor.presentation.slides[1].blocks[0].adjust, undefined, "no values left: the key goes");
  fails(() => setShapeAdjust(editor, "slides.1.blocks.0", { adj9: 1 }), "shape-adjust-unknown");
  fails(() => setShapeAdjust(editor, "slides.1.blocks.0", { adj1: "wide" }), "invalid-shape");
  // degrees and four places
  setShapePreset(editor, "slides.1.blocks.0", "pie");
  setShapeAdjust(editor, "slides.1.blocks.0", { adj1: 400.123456, adj2: 12.34567 });
  assert.ok(editor.presentation.slides[1].blocks[0].adjust.adj1 > 359.999 && editor.presentation.slides[1].blocks[0].adjust.adj1 < 360, "an angle is pinned just under a full turn");
  assert.equal(editor.presentation.slides[1].blocks[0].adjust.adj2, 12.35);
  // the shape's own default stays reachable even where the handle's range leaves it out (star24)
  setShapePreset(editor, "slides.1.blocks.0", "star24");
  setShapeAdjust(editor, "slides.1.blocks.0", { adj: 0.375 });
  assert.equal(editor.presentation.slides[1].blocks[0].adjust.adj, 0.375);
  const state = readShapeAdjust(editor.presentation, "slides.1.blocks.0");
  assert.deepEqual(Object.keys(state), ["adj"]);
  assert.equal(state.adj.set, true);
  // changing the preset keeps the adjust names the new one has, in range, and drops the rest
  setShapeProperties(editor, "slides.1.blocks.0", { shape: "roundRect", adjust: { adj: 0.3 } });
  setShapePreset(editor, "slides.1.blocks.0", "snip1Rect");
  assert.deepEqual(editor.presentation.slides[1].blocks[0].adjust, { adj: 0.3 });
  setShapePreset(editor, "slides.1.blocks.0", "ellipse");
  assert.equal(editor.presentation.slides[1].blocks[0].adjust, undefined);
  assert.equal(editor.presentation.slides[1].blocks[0].shape, "ellipse");
  const error = (() => { try { setShapePreset(editor, "slides.1.blocks.0", "rightArow"); } catch (caught) { return caught; } })();
  assert.equal(error.code, "invalid-shape");
  assert.match(error.message, /Did you mean rightArrow\?/);
  // one undo step each
  editor.undo();
  assert.equal(editor.presentation.slides[1].blocks[0].shape, "snip1Rect");
}

// inserting
{
  const editor = session();
  const change = insertShape(editor, { slideIndex: 0, shape: "chevron" });
  assert.equal(change.path, "slides.0.blocks.0");
  assert.deepEqual(editor.presentation.slides[0], { id: "a", title: "A", blocks: [{ shape: "chevron" }] });
  insertShape(editor, { slideIndex: 1, shape: "callout1", index: 1, block: { text: "Note", fill: { color: "accent2", lighten: 0.6 } } });
  assert.deepEqual(editor.presentation.slides[1].blocks.map((entry) => entry.shape ?? "text"), ["rightArrow", "callout1", "text"]);
  assert.equal(editor.presentation.slides[1].blocks[1].text, "Note");
  editor.undo();
  assert.equal(editor.presentation.slides[1].blocks.length, 2, "one undo takes an inserted shape back");
  editor.undo();
  assert.equal(editor.presentation.slides[0].blocks, undefined, "and a slide made of blocks by the insert goes back to how it was");
  fails(() => insertShape(editor, { slideIndex: 0, shape: "nope" }), "invalid-shape");
  assert.throws(() => prepareShapeInsert(editor.presentation, { shape: "rect" }), /slideIndex or a containerPath/);
  assert.equal(prepareShapeInsert(editor.presentation, { slideIndex: 1, shape: "rect" }).path, "slides.1.blocks.2");
}

console.log("shape options ok");
