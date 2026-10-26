import assert from "node:assert/strict";
import { clickTarget, createSelection } from "../dist/studio-kit/selection.js";

// CE-18, the studio kit's selection model, against the kit API only: a toy tree whose keys are slash paths ("a", "a/b"), not a layout
// record. Select, the sibling-only Shift rule, toggle, ranges, parent, child, sibling, all siblings, pruning and the click target.
const tree = { root: ["a", "b", "c"], a: [], b: ["b/1", "b/2", "b/3"], c: [], "b/1": [], "b/2": ["b/2/x"], "b/3": [], "b/2/x": [] };
const parentOf = (key) => (key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : null);
const listOf = (key) => tree[parentOf(key) ?? "root"];
const adapter = {
  exists: (key) => key in tree && key !== "root",
  parent: parentOf,
  firstChild: (key) => tree[key]?.[0] ?? null,
  sibling: (key, delta) => { const list = listOf(key); return list[list.indexOf(key) + delta] ?? null; },
  first: () => tree.root[0] ?? null,
  siblings: (key) => [...listOf(key)],
};
const events = [];
const sel = createSelection(adapter, { onChange: (event) => events.push(event.source ?? "none") });

// set: existing keys only, a change event, no event when nothing changes.
assert.deepEqual(sel.items, []);
assert.equal(sel.primary, null);
assert.equal(sel.set(["b/1", "ghost"], { source: "canvas" }), true);
assert.deepEqual(sel.items, ["b/1"]);
assert.equal(sel.set(["b/1"]), false, "the same selection is no change");
assert.deepEqual(events, ["canvas"]);

// add: siblings only; a node of another parent replaces the selection; adding a selected one removes it.
assert.equal(sel.add("b/3"), true);
assert.deepEqual(sel.items, ["b/1", "b/3"]);
assert.equal(sel.primary, "b/3", "the last added is the primary");
assert.equal(sel.add("b/1"), true);
assert.deepEqual(sel.items, ["b/3"], "Shift-click on a selected sibling removes it");
assert.equal(sel.add("a"), true);
assert.deepEqual(sel.items, ["a"], "a non-sibling replaces the selection");
assert.equal(sel.toggle("c"), true);
assert.deepEqual(sel.items, ["a", "c"], "top-level nodes are siblings");

// range: every sibling from the primary to the key, in order (the layers' Shift-click).
sel.set(["b/1"]);
assert.equal(sel.range("b/3"), true);
assert.deepEqual(sel.items, ["b/1", "b/2", "b/3"]);
sel.set(["b/3"]);
sel.range("b/1");
assert.deepEqual(sel.items, ["b/3", "b/2", "b/1"], "a backwards range ends on the clicked key");
sel.range("a");
assert.deepEqual(sel.items, ["a"], "a range to another parent selects just that key");

// parent (Esc), child (Enter), sibling (arrows), all siblings (Mod+A).
sel.set(["b/2/x"]);
assert.equal(sel.selectParent(), true);
assert.deepEqual(sel.items, ["b/2"]);
assert.equal(sel.selectChild(), true);
assert.deepEqual(sel.items, ["b/2/x"]);
assert.equal(sel.selectChild(), false, "a leaf has no child");
sel.set(["b/2"]);
sel.selectParent();
sel.selectParent();
assert.deepEqual(sel.items, [], "Esc from a top-level node selects nothing (the document)");
assert.equal(sel.selectParent(), false);
assert.equal(sel.selectSibling(1), true);
assert.deepEqual(sel.items, ["a"], "an arrow with nothing selected selects the first node");
assert.equal(sel.selectSibling(1), true);
assert.deepEqual(sel.items, ["b"]);
sel.set(["c"]);
assert.equal(sel.selectSibling(1), false, "past the end");
sel.set(["b/2"]);
assert.equal(sel.selectSiblings(), true);
assert.deepEqual(sel.items, ["b/1", "b/2", "b/3"]);

// replace and prune: no checks and no event (history restore); prune drops keys that are gone.
const before = events.length;
sel.replace(["b/1", "b/9"]);
assert.deepEqual(sel.items, ["b/1", "b/9"]);
sel.prune();
assert.deepEqual(sel.items, ["b/1"]);
assert.equal(events.length, before, "replace and prune send no change event");
const snap = sel.snapshot();
sel.set(["c"]);
assert.deepEqual(snap, ["b/1"], "a snapshot is a copy");

// Keys can be any value: index paths with an `equals` and a `copy`.
const samePath = (a, b) => a.length === b.length && a.every((part, index) => part === b[index]);
const paths = createSelection({ equals: samePath, copy: (path) => [...path], exists: (path) => path.length > 0, parent: (path) => (path.length > 1 ? path.slice(0, -1) : null), firstChild: () => null, sibling: () => null, first: () => [0] });
const mine = [1, 0];
paths.set([mine]);
mine.push(9);
assert.deepEqual(paths.items, [[1, 0]], "keys are copied on select");
assert.equal(paths.add([1, 1]), true);
assert.deepEqual(paths.items, [[1, 0], [1, 1]]);
assert.equal(paths.add([2]), true);
assert.deepEqual(paths.items, [[2]]);

// clickTarget: the deepest node, or one level into a selected container (not with Shift).
const chain = [{ key: "b", container: true }, { key: "b/2", container: true }, { key: "b/2/x" }];
const options = { isContainer: (node) => Boolean(node.container) };
assert.equal(clickTarget(chain, null, options).key, "b/2/x");
assert.equal(clickTarget(chain, "b", options).key, "b/2", "a click inside the selected container goes one level in");
assert.equal(clickTarget(chain, "b", { ...options, shift: true }).key, "b/2/x");
assert.equal(clickTarget(chain, "b/2/x", options).key, "b/2/x");
assert.equal(clickTarget([], "b", options), null);

console.log("studio kit selection: set, sibling-only add, toggle, range, parent, child, sibling, siblings, prune and click target passed");
