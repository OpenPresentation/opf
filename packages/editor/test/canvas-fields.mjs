import assert from "node:assert/strict";
import {
  getEditableFields,
  parseCanvasValue,
  createCanvasDraft,
  preserveTextLineEndings,
} from "../dist/canvas-fields.js";
import {
  getValueAtPath,
  applyJsonPatch,
  createEditorSession,
} from "../dist/index.js";
const value = { "sales.us": { "a/b~c": [0, false, null, ""] } };
const { fields, arrays } = getEditableFields(value, "data");
assert.equal(arrays[0].path, "/data/sales.us/a~1b~0c");
assert.deepEqual(
  fields.map((field) => getValueAtPath({ data: value }, field.path)),
  [0, false, null, ""],
);
const patched = applyJsonPatch({ data: value }, [
  { op: "replace", path: fields[0].path, value: 12 },
]);
assert.equal(patched.data["sales.us"]["a/b~c"][0], 12);
assert.equal(value["sales.us"]["a/b~c"][0], 0);
for (const invalid of ["", " ", "Infinity", "NaN"])
  assert.throws(() => parseCanvasValue(invalid, "number"));
assert.equal(parseCanvasValue("-3.5", "number"), -3.5);
for(const source of ['a\r\nb\r\nc\r\n','a\rb\rc\r','a\r\nb\nc\r']) {
  const normalized=source.replace(/\r\n|\r/g,'\n');
  assert.equal(preserveTextLineEndings(source,normalized),source,'Opening and committing a textarea is a byte-preserving no-op');
  assert.equal(preserveTextLineEndings(source,normalized.replace('b','new\tvalue')),source.replace('b','new\tvalue'),'Untouched mixed line endings survive edits');
  assert.equal(parseCanvasValue(normalized,'string',source),source);
}
assert.equal(preserveTextLineEndings('a\r\nb','a\nnew\nb'),'a\r\nnew\r\nb');
assert.equal(preserveTextLineEndings('a\r\nb','ab'),'ab');
assert.equal(preserveTextLineEndings('a\r\nb',''),'');
assert.equal(preserveTextLineEndings('','first\nnext'),'first\nnext');
assert.equal(parseCanvasValue(false, "boolean"), false);
assert.equal(parseCanvasValue("null", "null"), null);
assert.throws(() => parseCanvasValue("", "null"));
const original = {
  slides: [{ title: "Original", table: { rows: [[0, false, null]] } }],
};
const draft = createCanvasDraft(original, "slides.0.title", "Draft");
assert.equal(original.slides[0].title, "Original");
assert.equal(draft.slides[0].title, "Draft");
assert.throws(() =>
  createCanvasDraft(original, "slides.0.title", { unsupported: true }),
);
const editor = createEditorSession(original, { rejectInvalid: true });
editor.set("/slides/0/table/rows/0/0", 5);
editor.undo();
assert.deepEqual(editor.document, original);
console.log(
  "Canvas fields: escaped keys, types, immutable drafts, validation and undo passed.",
);

// FA-11: a timeline event's status is a menu, and a new event does not copy the last event's status.
{
  const { fieldChoices, emptyLike, TIMELINE_STATUS_CHOICES } = await import("../dist/canvas-fields.js");
  assert.deepEqual([...TIMELINE_STATUS_CHOICES], ["done", "current", "planned"]);
  const shorthand = { timeline: [{ when: "Q1", what: "Pilot", status: "done" }] };
  const object = { timeline: { name: "Plan", events: [{ what: "Pilot", status: "current" }] } };
  for (const [slide, path] of [[shorthand, "slides.0.timeline"], [object, "slides.0.timeline"]]) {
    const { fields } = getEditableFields(slide.timeline, path);
    const status = fields.find((field) => field.path.endsWith("/status"));
    assert.deepEqual(fieldChoices(status), ["done", "current", "planned"], path);
    for (const other of fields.filter((field) => field !== status)) assert.equal(fieldChoices(other), undefined, other.path);
  }
  const inBlock = getEditableFields([{ what: "A", status: "planned" }], "slides.0.blocks.1.timeline");
  assert.deepEqual(fieldChoices(inBlock.fields.find((field) => field.path.endsWith("/status"))), ["done", "current", "planned"]);
  // A `status` elsewhere (not a timeline event) stays free text.
  assert.equal(fieldChoices({ path: "/slides/0/status" }), undefined);
  assert.deepEqual(emptyLike({ when: "Q1", what: "Pilot", description: "d", status: "done" }), { when: "", what: "", description: "" });
  assert.deepEqual(emptyLike({ type: "bar", n: 3, ok: true, text: "x" }), { type: "bar", n: 0, ok: false, text: "" });
}
