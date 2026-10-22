import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { createEditorSession } from "../dist/index.js";
import { applyLayoutToSlide, createLayoutModel, findingLocation, layoutForCatalog, saveLayoutToDeck, sampleDeck, validateLayoutRecord } from "../dist/layout-editor.js";

// RR-99: the state behind the layout editor, with no DOM: commands, live validation by core, the editor's own history, gestures, and the
// deck functions.
const record = () => ({ id: "hero", name: "Hero", direction: "column", regions: [{ name: "title" }, { direction: "row", size: 2, regions: [{ name: "lead" }, { name: "media" }] }, { name: "support" }] });

// Findings locate themselves from the JSON Pointer.
assert.deepEqual(findingLocation("/regions/1/regions/0/size"), { node: [1, 0], field: "size" });
assert.deepEqual(findingLocation("/regions"), { node: [], field: "regions" });
assert.deepEqual(findingLocation("/overflowRegion"), { node: [], field: "overflowRegion" });
assert.deepEqual(findingLocation("/regions/2"), { node: [2], field: null });
assert.deepEqual(validateLayoutRecord(record()), []);
const broken = validateLayoutRecord({ id: "b", name: "B", direction: "row", regions: [{ name: "a" }, { name: "a" }, { name: "c", size: "auto" }] });
assert.deepEqual(broken.map((finding) => [finding.ruleId, finding.node, finding.field]), [["opf/layout-region", [1], "name"], ["opf/layout-template", [2], "size"]]);
assert.deepEqual(broken[0].also, [[0]], "a name used twice marks the earlier region too");

// Commands are single history steps; onChange gets a copy.
const changes = [];
const model = createLayoutModel({ record: record(), onChange: (next) => changes.push(next.regions.length) });
assert.equal(model.canUndo(), false);
assert.equal(model.splitRegion([2], "row"), true);
assert.deepEqual(model.selection, [[2, 1]]);
assert.equal(model.record.regions[2].direction, "row");
assert.equal(model.setTool("insert"), true);
assert.equal(model.setTool("nonsense"), false);
assert.equal(model.remove([[2, 0]]), true);
assert.deepEqual(changes, [3, 3], "onChange runs after each edit");
assert.equal(model.undo(), true);
assert.equal(model.undo(), true);
assert.equal(model.canUndo(), false);
assert.deepEqual(model.record, record());
assert.equal(model.redo(), true);
assert.deepEqual(model.selection, [[2, 1]], "undo and redo restore the selection");
changes.length = 0;

// A refused edit is a notice, never a change or a history step.
model.setRecord(record());
assert.equal(model.remove([[0], [1], [2]]), false);
assert.match(model.notice.message, /at least one region/);
assert.equal(model.notice.kind, "error");
assert.equal(model.canUndo(), false);
assert.deepEqual(changes, []);
model.setReadOnly(true);
assert.equal(model.splitRegion([0], "row"), false);
assert.match(model.notice.message, /read only/);
model.setReadOnly(false);

// Typing coalesces: consecutive edits of one property are one undo step.
model.setProperty([2], "name", "s");
model.setProperty([2], "name", "su");
model.setProperty([2], "name", "sum");
assert.equal(model.record.regions[2].name, "sum");
model.undo();
assert.equal(model.record.regions[2].name, "support", "three keystrokes, one step");
model.setProperty([0], "size", 2);
model.setProperty([2], "size", 3);
model.undo();
assert.equal(model.record.regions[2].size, undefined, "different properties are different steps");
assert.equal(model.record.regions[0].size, 2);

// A gesture is one step, however many records it shows; cancel restores.
model.setRecord(record());
changes.length = 0;
assert.equal(model.beginGesture("Resized"), true);
for (const size of [2.5, 3, 3.5]) model.updateGesture({ ...model.record, regions: [model.record.regions[0], { ...model.record.regions[1], size }, model.record.regions[2]] }, `size ${size}`);
assert.equal(model.record.regions[1].size, 3.5);
assert.equal(model.canUndo(), false, "nothing is recorded while the gesture runs");
assert.deepEqual(changes, [], "and onChange waits");
assert.equal(model.endGesture("Resized to 3.5"), true);
assert.deepEqual(changes, [3]);
assert.equal(model.undo(), true);
assert.equal(model.record.regions[1].size, 2);
assert.equal(model.canUndo(), false, "one drag, one step");
model.beginGesture("x");
model.updateGesture({ ...model.record, name: "Changed" });
model.cancelGesture();
assert.equal(model.record.name, "Hero");
assert.equal(model.beginGesture("y"), true);
assert.equal(model.endGesture(), false, "a gesture that changed nothing records nothing");

// Selection: siblings add, the parent and the first child.
model.select([[1]]);
assert.equal(model.selectChild(), true);
assert.deepEqual(model.selection, [[1, 0]]);
assert.equal(model.selectSibling(1), true);
assert.equal(model.selectSibling(1), false);
assert.equal(model.selectParent(), true);
assert.deepEqual(model.selection, [[1]]);
model.selectAdd([2]);
assert.deepEqual(model.selection, [[1], [2]]);
model.selectAdd([1, 0]);
assert.deepEqual(model.selection, [[1, 0]], "a node from another list replaces the selection");
model.select([[9]]);
assert.deepEqual(model.selection, [], "a path that leads nowhere is not selected");

// Validation follows every edit and undo.
model.setProperty([1, 0], "name", "media");
assert.equal(model.findings.length, 1);
assert.deepEqual(model.findingsFor([1, 0], "name").length, 1, "the earlier region shows it too");
assert.equal(model.findingsWithin([1]).length, 1);
assert.equal(model.findingsWithin([0]).length, 0);
model.undo();
assert.equal(model.findings.length, 0);

// setRecord checks its input and resets the history.
assert.throws(() => model.setRecord({ id: "x" }), TypeError);
assert.throws(() => createLayoutModel({ record: [] }), TypeError);
assert.deepEqual(layoutForCatalog({ $schema: "https://example.org/x", id: "a", name: "A", regions: [{ name: "x" }] }), { id: "a", record: { name: "A", regions: [{ name: "x" }] } });

// The deck functions: one undoable edit each; a layout with an error is not saved; replace edits a layout the deck has.
const deck = { name: "Deck", slides: [{ id: "one", title: "One", text: "Hello" }, { id: "two", title: "Two" }] };
const session = createEditorSession(deck);
const shared = createLayoutModel({ record: record() });
const saved = saveLayoutToDeck(session, shared);
assert.equal(saved.layoutId, "hero");
assert.deepEqual(session.presentation.catalogs.custom.layouts.hero, { name: "Hero", direction: "column", regions: record().regions });
assert.equal(validate(session.presentation, { only: ["format"] }).valid, true);
assert.throws(() => saveLayoutToDeck(session, shared), (error) => error.code === "layout-exists");
shared.setProperty([0], "size", "auto");
shared.setProperty([2], "size", 2);
const replaced = saveLayoutToDeck(session, shared, { replace: true });
assert.equal(session.presentation.catalogs.custom.layouts.hero.regions[2].size, 2);
assert.ok(replaced.layoutId);
session.undo();
assert.equal(session.presentation.catalogs.custom.layouts.hero.regions[2].size, undefined, "the save is one undo step");
const applied = applyLayoutToSlide(session, shared, 1);
assert.equal(applied.slideIndex, 1);
assert.equal(session.presentation.slides[1].layout, "hero");
assert.equal(session.presentation.catalogs.custom.layouts.hero.regions[2].size, 2, "apply saves the current record");
session.undo();
assert.equal(session.presentation.slides[1].layout, undefined, "apply is one undo step");
assert.equal(session.presentation.catalogs.custom.layouts.hero.regions[2].size, undefined);
assert.throws(() => applyLayoutToSlide(session, shared, 5), (error) => error.code === "layout-slide");
shared.setProperty([1, 0], "name", "media");
assert.throws(() => saveLayoutToDeck(session, shared, { replace: true }), (error) => error.code === "layout-invalid" && /used twice/.test(error.message));
assert.throws(() => saveLayoutToDeck({}, shared), (error) => error.code === "invalid-editor");

// Preview's sample deck is a valid deck that uses the layout, with blocks pinned to its body regions.
const sample = sampleDeck({ id: "hero", name: "Hero", direction: "column", regions: [{ name: "title" }, { direction: "row", regions: [{ name: "lead", accepts: ["text", "quote"], flow: "none" }, { name: "media", accepts: ["image"], flow: "none" }] }, { name: "support", accepts: ["table", "chart"], max: 2 }] });
assert.equal(sample.slides[0].layout, "hero");
assert.deepEqual(sample.slides[0].blocks.map((block) => [block.region, Object.keys(block).find((key) => key !== "region")]), [["lead", "text"], ["media", "image"], ["support", "table"], ["support", "chart"]]);
const report = validate(sample, { only: ["format"] });
assert.equal(report.valid, true, JSON.stringify(report.findings));
// Every content kind has a sample that core accepts.
for (const kind of ["text", "list", "image", "video", "chart", "table", "code", "metric", "quote", "timeline", "group"]) {
  const one = sampleDeck({ id: "k", name: "K", regions: [{ name: "only", accepts: [kind], flow: "none" }] });
  const result = validate(one, { only: ["format"] });
  assert.equal(result.valid, true, `${kind}: ${JSON.stringify(result.findings.map((finding) => finding.message))}`);
}

console.log("layout model: commands, history, gestures, findings and deck functions passed");
