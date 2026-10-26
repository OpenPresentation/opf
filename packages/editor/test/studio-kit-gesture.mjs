import assert from "node:assert/strict";
import { createGesture, createHistory } from "../dist/studio-kit/gesture.js";

// CE-18, the studio kit's gesture history, against the kit API only: a toy document (a number) whose drag previews drafts and lands as
// one history step, a cancel that restores the start, and the snapshot history with coalescing, a limit and append.
let clock = 1000;
const history = createHistory({ limit: 4, coalesceMs: 1500, now: () => clock });
const doc = { value: 0, previews: [], commits: [] };
history.reset({ value: 0 });
const gesture = createGesture({
  snapshot: () => ({ value: doc.value }),
  preview(draft, message) { doc.value = draft; doc.previews.push([draft, message]); },
  commit(start, { label, message }) {
    if (start.value === doc.value) return false;
    history.push({ value: doc.value });
    doc.commits.push([label, message]);
    return true;
  },
  restore(start) { doc.value = start.value; },
});

// begin, drafts, end: one step, the end message or the label.
assert.equal(gesture.active, false);
assert.equal(gesture.update(5), false, "no draft without a gesture");
assert.equal(gesture.begin("Resized"), true);
assert.equal(gesture.begin("Again"), false, "one gesture at a time");
assert.equal(gesture.label, "Resized");
gesture.update(1, "Resize 1 : 2");
gesture.update(2, "Resize 2 : 1");
assert.equal(history.size, 1, "drafts are not history");
assert.equal(gesture.end("Resized to 2 : 1"), true);
assert.equal(gesture.active, false);
assert.deepEqual(doc.previews, [[1, "Resize 1 : 2"], [2, "Resize 2 : 1"]]);
assert.deepEqual(doc.commits, [["Resized", "Resized to 2 : 1"]]);
assert.equal(history.size, 2);
assert.equal(gesture.end(), false, "nothing to end");

// A gesture that changes nothing is no step; the label is the default message.
gesture.begin("Moved");
gesture.update(2);
assert.equal(gesture.end(), false);
assert.equal(history.size, 2);

// Cancel restores the start.
gesture.begin("Resized");
gesture.update(9);
assert.equal(gesture.cancel(), true);
assert.equal(doc.value, 2);
assert.equal(gesture.cancel(), false);
// reset forgets a gesture without restoring (the document was replaced under it).
gesture.begin("Resized");
gesture.update(7);
gesture.reset();
assert.equal(gesture.active, false);
assert.equal(doc.value, 7);
doc.value = 2;

// History: undo and redo move between snapshots; a new step drops the redo branch.
assert.equal(history.canUndo(), true);
assert.deepEqual(history.go(-1), { value: 0 });
assert.equal(history.canUndo(), false);
assert.equal(history.go(-1), null);
assert.equal(history.canRedo(), true);
assert.equal(history.go(1).value, 2);
history.go(-1);
history.push({ value: 3 });
assert.equal(history.canRedo(), false, "a new step drops the redo branch");
assert.equal(history.size, 2);

// Coalescing: the same key within the window replaces the head; after the window, or with another key, it is a new step.
history.push({ value: 4 }, "field:name");
clock += 500;
history.push({ value: 5 }, "field:name");
assert.equal(history.size, 3, "typing in one field is one step");
assert.equal(history.head.value, 5);
clock += 2000;
history.push({ value: 6 }, "field:name");
assert.equal(history.size, 4, "after the window it is a new step");
history.push({ value: 7 }, "field:size");
assert.equal(history.head.value, 7);

// The limit keeps the newest steps.
assert.equal(history.size, 4, "at most `limit` steps");
const values = [];
while (history.canUndo()) values.push(history.go(-1).value);
assert.deepEqual(values, [6, 5, 3], "the oldest step was dropped (5 is the coalesced field step)");

// reset starts over; append adds after the current step (a load that keeps history).
history.reset({ value: 10 });
history.append({ value: 11 });
assert.equal(history.index, 1);
assert.equal(history.go(-1).value, 10);
history.append({ value: 12 });
assert.equal(history.size, 2, "append drops the redo branch");
assert.equal(history.head.value, 12);

console.log("studio kit gesture history: drafts, one step per gesture, cancel, reset, undo and redo, coalescing, limit and append passed");
