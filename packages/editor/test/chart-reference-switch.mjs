// Explicit reference lines and the chart-type switch: a type that cannot draw them refuses the switch, or removes exactly the
// references it cannot draw when the caller says so, and reports them. Nothing is dropped silently and every result validates.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { switchDimension } from "../dist/switches.js";

const C = "slides.0.blocks.0.chart";
const data = { columns: ["Quarter", "Revenue", { name: "Margin", format: "0%" }], rows: [["Q1", 12, 0.31], ["Q2", 18, 0.34], ["Q3", 21, 0.36]] };
const deck = (chart) => ({ name: "Reference fixture", design: { theme: "minimal", fontScheme: "aptos" }, slides: [{ id: "chart", title: "Revenue", blocks: [{ chart: { data, ...chart } }] }] });
const session = (chart) => createEditorSession(deck(chart), { rejectInvalid: true });
const errorsOf = (presentation) => validate(presentation, { only: ["format"] }).findings.filter((finding) => finding.severity === "error");
const at = { slideIndex: 0, path: "slides.0.blocks.0" };

// 1. Between types that draw references, the lines stay as written.
{
  const editor = session({ type: "column", referenceLines: [{ value: 15, label: "Plan" }, { value: 20 }] });
  for (const type of ["bar", "line", "area", "stacked-column", "stacked-bar", "stacked-area", "column"]) {
    const change = switchDimension(editor, "charts", type, at);
    assert.equal(change.loss, undefined, type);
    assert.deepEqual(editor.get(`${C}.referenceLines`), [{ value: 15, label: "Plan" }, { value: 20 }], type);
    assert.deepEqual(errorsOf(editor.presentation), [], type);
  }
}

// 2. A type without a single value axis refuses the switch and leaves the document untouched.
{
  const editor = session({ type: "column", referenceLines: [{ value: 15, label: "Plan" }, { value: 20 }] });
  const before = structuredClone(editor.presentation);
  for (const type of ["pie", "scatter", "100pct-stacked-column", "radar"])
    assert.throws(() => switchDimension(editor, "charts", type, at), (error) => error.code === "chart-reference-lines-unsupported" && error.details.count === 2 && error.details.path === `${C}.referenceLines` && /removeReferenceLines: true/.test(error.message) && error.message.includes(type), type);
  assert.deepEqual(editor.presentation, before);
  // The caller's choice removes them in the same undoable step and names them.
  const change = switchDimension(editor, "charts", "pie", { ...at, removeReferenceLines: true });
  assert.equal(editor.get(`${C}.type`), "pie");
  assert.equal(editor.get(`${C}.referenceLines`), undefined);
  assert.equal(change.loss.length, 1);
  assert.match(change.loss[0], /^2 reference lines \(slides\.0\.blocks\.0\.chart\.referenceLines\)/);
  assert.deepEqual(errorsOf(editor.presentation), []);
  editor.undo();
  assert.deepEqual(editor.presentation, before);
}

// 3. Leaving combo: only the references on the secondary axis cannot be drawn; the others stay.
{
  const combo = { type: "combo", line: ["Margin"], secondaryAxis: ["Margin"], referenceLines: [{ value: 15, label: "Plan" }, { value: 0.4, axis: "secondary", label: "Margin floor" }] };
  const editor = session(combo);
  assert.throws(() => switchDimension(editor, "charts", "column", at), (error) => error.code === "chart-reference-lines-unsupported" && error.details.count === 1 && /secondary value axis/.test(error.message));
  const change = switchDimension(editor, "charts", "column", { ...at, removeReferenceLines: true });
  assert.deepEqual(editor.get(`${C}.referenceLines`), [{ value: 15, label: "Plan" }]);
  assert.match(change.loss[0], /^1 reference line /);
  assert.deepEqual(errorsOf(editor.presentation), []);
  // A combo without secondary references switches freely.
  const plain = session({ ...combo, referenceLines: [{ value: 15 }] });
  assert.equal(switchDimension(plain, "charts", "line", at).loss, undefined);
  assert.deepEqual(plain.get(`${C}.referenceLines`), [{ value: 15 }]);
}

// 4. An empty list is no reference: any type takes it.
{
  const editor = session({ type: "column", referenceLines: [] });
  assert.equal(switchDimension(editor, "charts", "pie", at).loss, undefined);
  assert.deepEqual(errorsOf(editor.presentation), []);
}
console.log("chart reference switch: ok");
