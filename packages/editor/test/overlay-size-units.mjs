// Overlay frames in the editor: a free shape may be larger than the slide subject to finite representable geometry, and an attached shape is sized by a
// fraction of its target (width, height) or by reference pixels (widthPx, heightPx); setting one unit removes the other.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { setOverlayFrame, prepareOverlayDetach } from "../dist/shape-overlays.js";

const deck = (shapes) => ({ name: "Overlay fixture", design: { theme: "minimal", fontScheme: "aptos" }, slides: [{ id: "s", title: "Launch plan", blocks: [{ id: "note", text: "Three regions go live in March." }], shapes }] });
const session = (shapes) => createEditorSession(deck(shapes), { rejectInvalid: true });
const errorsOf = (presentation) => validate(presentation, { only: ["format"] }).findings.filter((finding) => finding.severity === "error");
const S = "slides.0.shapes.0";

// 1. A free shape grows past the slide without an arbitrary multiple cap.
{
  const editor = session([{ shape: "ellipse", x: 0.1, y: 0.1, width: 0.3, height: 0.3 }]);
  setOverlayFrame(editor, S, { x: -0.3, y: -0.5, width: 1.2, height: 1.6 });
  assert.deepEqual([editor.get(`${S}.x`), editor.get(`${S}.y`), editor.get(`${S}.width`), editor.get(`${S}.height`)], [-0.3, -0.5, 1.2, 1.6]);
  setOverlayFrame(editor, S, { width: 20 });
  assert.equal(editor.get(`${S}.width`), 20);
  assert.deepEqual(errorsOf(editor.presentation), []);
  assert.throws(() => setOverlayFrame(editor, S, { widthPx: 160 }), (error) => /attached to a block/.test(error.message));
}

// 2. An attached shape: fractions of the target, or pixels under their own keys.
{
  const editor = session([{ shape: "rect", at: { block: "note", edge: "top", width: 0.4 } }]);
  setOverlayFrame(editor, S, { width: 1.08, height: 1.08 });
  assert.deepEqual(editor.get(`${S}.at`), { block: "note", edge: "top", width: 1.08, height: 1.08 });
  // Pixels replace the fraction for that side only.
  setOverlayFrame(editor, S, { widthPx: 160 });
  assert.deepEqual(editor.get(`${S}.at`), { block: "note", edge: "top", height: 1.08, widthPx: 160 });
  setOverlayFrame(editor, S, { heightPx: 64, offset: 8 });
  assert.deepEqual(editor.get(`${S}.at`), { block: "note", edge: "top", widthPx: 160, heightPx: 64, offset: 8 });
  // And back: a fraction removes the pixel size.
  setOverlayFrame(editor, S, { width: 0.5 });
  assert.deepEqual(editor.get(`${S}.at`), { block: "note", edge: "top", heightPx: 64, offset: 8, width: 0.5 });
  assert.deepEqual(errorsOf(editor.presentation), []);
  assert.throws(() => setOverlayFrame(editor, S, { width: 0.5, widthPx: 100 }), (error) => /not both/.test(error.message));
  // A target fraction has no arbitrary cap; reference pixels retain their existing bound.
  setOverlayFrame(editor, S, { width: 50, heightPx: 5000 });
  assert.equal(editor.get(`${S}.at.width`), 50);
  assert.equal(editor.get(`${S}.at.heightPx`), 1280);
  assert.deepEqual(errorsOf(editor.presentation), []);
  editor.undo();
  assert.equal(editor.get(`${S}.at.width`), 0.5);
}

// 3. Freeing a shape that was drawn larger than the slide keeps its size.
{
  const presentation = deck([{ shape: "rect", at: { block: "note", edge: "center", width: 2 } }]);
  const prepared = prepareOverlayDetach(presentation, S, { x: -0.2, y: 0.3, width: 1.4, height: 0.2 });
  assert.deepEqual(prepared.patches.filter((patch) => patch.op === "add").map((patch) => patch.value), [-0.2, 0.3, 1.4, 0.2]);
}
console.log("overlay size units: ok");
