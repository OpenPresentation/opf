// RR-31: the editor's patch, undo and redo behaviour on top of core's single
// RFC 6902 module (@openpresentation/opf/patch).
import assert from "node:assert/strict";
import * as corePatch from "@openpresentation/opf/patch";
import {
  OPFEditorError,
  applyJsonPatch,
  createEditorSession,
  createValuePatch,
  getValueAtPath,
  hasValueAtPath,
  invertJsonPatch,
  opfPathToJsonPointer,
  splitOpfPath
} from "../dist/index.js";

const deck = () => ({
  $schema: "https://openpresentation.org/schema/opf/v1",
  name: "Patch deck",
  slides: [
    { id: "a", title: "A", bullets: ["x", "y", "z"] },
    { id: "b", title: "B" },
    { id: "c", title: "C" }
  ]
});
const ids = presentation => presentation.slides.map(slide => slide.id);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const throwsCode = (fn, code) => {
  assert.throws(fn, error => error instanceof OPFEditorError && error.code === code, `expected ${code}`);
  checks++;
};

// The editor and the CLI use the same implementation: the editor's results equal core's.
{
  const patch = [{ op: "replace", path: "/slides/0/title", value: "A2" }, { op: "move", from: "/slides/2", path: "/slides/0" }, { op: "copy", from: "/slides/1/title", path: "/name" }];
  equal(applyJsonPatch(deck(), patch), corePatch.applyPatch(deck(), patch), "editor applyJsonPatch equals core applyPatch");
  equal(invertJsonPatch(deck(), patch), corePatch.invertPatch(deck(), patch), "editor invertJsonPatch equals core invertPatch");
}

// move and copy are supported (they were not before RR-31) and undo exactly.
{
  const editor = createEditorSession(deck());
  const events = [];
  editor.subscribe(event => events.push(event));
  const change = editor.applyPatch([{ op: "move", from: "/slides/2", path: "/slides/0" }, { op: "copy", from: "/slides/0", path: "/slides/-" }], { source: "test" });
  equal(ids(editor.presentation), ["c", "a", "b", "c"]);
  equal(change.patches.map(patch => patch.op), ["move", "copy"]);
  equal(change.inversePatches.map(patch => patch.op), ["remove", "remove", "add"], "the inverse runs in reverse order: undo the copy, then the move (remove and add)");
  equal(events.length, 1);
  equal(events[0].type, "patch");
  equal(events[0].meta, { source: "test" });
  equal(events[0].inversePatches, change.inversePatches);
  check(editor.canUndo && !editor.canRedo, "one undo step for the whole transaction");
  equal(editor.snapshot().undoDepth, 1);
  const undone = editor.undo();
  equal(ids(editor.presentation), ["a", "b", "c"]);
  equal(undone.patches, change.inversePatches);
  equal(undone.redoPatches, change.patches);
  equal(events[1].type, "undo");
  check(!editor.canUndo && editor.canRedo, "redo available after undo");
  const redone = editor.redo();
  equal(ids(editor.presentation), ["c", "a", "b", "c"]);
  equal(redone.patches, change.patches);
  equal(events[2].type, "redo");
  editor.undo();
  equal(editor.presentation, deck(), "undo restores the exact original document");
  equal(editor.undo(), null);
}

// A failing patch changes nothing, emits nothing and leaves undo alone.
{
  const editor = createEditorSession(deck());
  let events = 0;
  editor.subscribe(() => { events++; });
  throwsCode(() => editor.applyPatch([{ op: "replace", path: "/slides/0/title", value: "never" }, { op: "test", path: "/slides/1/id", value: "stale" }]), "patch-test-failed");
  equal(editor.presentation, deck());
  equal(events, 0);
  check(!editor.canUndo, "a failed patch records no history");
  throwsCode(() => editor.applyPatch([{ op: "replace", path: "/missing", value: 1 }]), "patch-path-missing");
  throwsCode(() => editor.applyPatch([{ op: "add", path: "/missing/child", value: 1 }]), "patch-parent-missing");
  throwsCode(() => editor.applyPatch([{ op: "add", path: "/slides/9", value: {} }]), "invalid-array-index");
  throwsCode(() => editor.applyPatch([{ op: "replace", path: "/slides/01", value: {} }]), "invalid-array-index");
  throwsCode(() => editor.applyPatch([{ op: "bogus", path: "" }]), "unsupported-patch-operation");
  throwsCode(() => editor.applyPatch([{ op: "move", path: "/a" }]), "invalid-patch-operation");
  throwsCode(() => editor.applyPatch([{ op: "move", from: "/slides", path: "/slides/0/bullets" }]), "patch-invalid-move");
  throwsCode(() => editor.applyPatch({}), "invalid-patch");
  throwsCode(() => editor.applyPatch([{ op: "test", path: "/name" }]), "invalid-patch-operation");
  throwsCode(() => editor.applyPatch([{ op: "add", path: "no-slash-is-dotted-so-fine", value: 1 }, { op: "test", path: "/x~2", value: 1 }]), "invalid-json-pointer");
  equal(editor.presentation, deck());
}

// Errors carry the operation index and path in details.
{
  try {
    applyJsonPatch(deck(), [{ op: "replace", path: "/name", value: "ok" }, { op: "remove", path: "/nope" }]);
    assert.fail("expected an error");
  } catch (error) {
    check(error instanceof OPFEditorError, "OPFEditorError");
    equal(error.code, "patch-path-missing");
    equal(error.path, "/nope");
    equal(error.details.index, 1);
  }
}

// Test-only patches are guards: no history, no event.
{
  const editor = createEditorSession(deck());
  let events = 0;
  editor.subscribe(() => { events++; });
  const change = editor.applyPatch([{ op: "test", path: "/slides/0/id", value: "a" }]);
  equal(change.inversePatches, []);
  equal(events, 0);
  check(!editor.canUndo, "a test-only patch records no undo step");
}

// Guards and edits in one transaction, and rejectInvalid keeps the document.
{
  const editor = createEditorSession(deck(), { rejectInvalid: true });
  editor.applyPatch([{ op: "test", path: "/slides/1/id", value: "b" }, { op: "replace", path: "/slides/1/title", value: "B2" }]);
  equal(editor.get("slides.1.title"), "B2");
  throwsCode(() => editor.applyPatch([{ op: "replace", path: "/slides", value: "not an array" }]), "invalid-opf-edit");
  equal(editor.get("slides.1.title"), "B2");
  editor.undo();
  equal(editor.get("slides.1.title"), "B");
}

// Several transactions undo and redo in order; a new edit clears redo.
{
  const editor = createEditorSession(deck());
  editor.set("slides.0.title", "A1");
  editor.applyPatch([{ op: "add", path: "/slides/1/subtitle", value: "S" }]);
  editor.applyPatch([{ op: "remove", path: "/slides/0/bullets/1" }, { op: "add", path: "/slides/0/bullets/-", value: "w" }]);
  equal(editor.get("slides.0.bullets"), ["x", "z", "w"]);
  editor.undo();
  equal(editor.get("slides.0.bullets"), ["x", "y", "z"]);
  editor.undo();
  check(!hasValueAtPath(editor.presentation, "slides.1.subtitle"), "added optional field is removed by undo");
  editor.redo();
  equal(editor.get("slides.1.subtitle"), "S");
  editor.applyPatch([{ op: "replace", path: "/name", value: "N" }]);
  check(!editor.canRedo, "a new edit clears redo");
  while (editor.canUndo) editor.undo();
  equal(editor.presentation, deck());
}

// Path helpers share core's pointer rules; dotted OPF paths still work.
{
  equal(splitOpfPath("slides.0.title"), ["slides", "0", "title"]);
  equal(splitOpfPath("/a~1b/~0c"), ["a/b", "~c"]);
  equal(opfPathToJsonPointer(["a.b", "c/d"]), "/a.b/c~1d");
  equal(opfPathToJsonPointer("slides.0.title"), corePatch.pointerFromPath("slides.0.title"));
  equal(opfPathToJsonPointer(""), "");
  throwsCode(() => splitOpfPath("/bad~2"), "invalid-json-pointer");
  throwsCode(() => splitOpfPath(5), "invalid-path");
  equal(getValueAtPath(deck(), "slides.0.bullets.1"), "y");
  equal(getValueAtPath(deck(), "slides.9.title", "fallback"), "fallback");
  equal(getValueAtPath(deck(), "slides.0.bullets.-", "fallback"), "fallback");
  equal(createValuePatch(deck(), "slides.0.title", "T"), [{ op: "replace", path: "/slides/0/title", value: "T" }]);
  equal(createValuePatch(deck(), "slides.0.subtitle", "T"), [{ op: "add", path: "/slides/0/subtitle", value: "T" }]);
}

// Keys with dots, slashes and __proto__ are data.
{
  const editor = createEditorSession(deck());
  editor.applyPatch([{ op: "add", path: "/extensions", value: {} }, { op: "add", path: "/extensions/a.b~1c", value: 1 }, { op: "add", path: "/extensions/__proto__", value: { safe: true } }]);
  equal(Object.getPrototypeOf(editor.presentation.extensions), Object.prototype);
  equal(editor.get(["extensions", "a.b/c"]), 1);
  check(!({}).safe, "no prototype pollution");
  editor.undo();
  equal(editor.presentation, deck());
}

// Inverse patches of random edits restore the document (undo is exact).
{
  let seed = 31;
  const rand = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
  for (let round = 0; round < 100; round++) {
    const editor = createEditorSession(deck());
    const steps = 1 + rand(5);
    for (let step = 0; step < steps; step++) {
      const count = editor.presentation.slides.length;
      const kinds = [
        [{ op: "move", from: `/slides/${rand(count)}`, path: `/slides/${rand(count)}` }],
        [{ op: "copy", from: `/slides/${rand(count)}`, path: "/slides/-" }],
        [{ op: "add", path: `/slides/${rand(count + 1)}`, value: { id: `n${round}-${step}`, title: "N" } }],
        count > 1 ? [{ op: "remove", path: `/slides/${rand(count)}` }] : [],
        [{ op: "replace", path: `/slides/${rand(count)}/title`, value: `T${step}` }]
      ];
      const patch = kinds[rand(kinds.length)];
      if (patch.length) editor.applyPatch(patch);
    }
    const after = editor.presentation;
    while (editor.canUndo) editor.undo();
    equal(editor.presentation, deck(), `round ${round}`);
    while (editor.canRedo) editor.redo();
    equal(editor.presentation, after, `round ${round} redo`);
  }
}

console.log(`Editor patch: core RFC 6902 module, move/copy, ${checks} checks of undo/redo exactness, events, error codes, path helpers and guards pass.`);
