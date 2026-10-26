import assert from "node:assert/strict";
import { rowDropMode, treeKeyAction } from "../dist/studio-kit/tree.js";

// CE-18, the parts of the studio kit's layers tree that need no DOM, against the kit API only: what each key does on a focused item (the
// WAI-ARIA tree pattern) and where a dragged row lands. test/studio-kit-browser.mjs builds a tree in a page and drives it by keyboard.
const items = ["root", "a", "a1", "a2", "b"];
const key = (name, extra = {}) => ({ key: name, shiftKey: false, ...extra });
assert.deepEqual(treeKeyAction(key("ArrowDown"), "a", items), { type: "focus", target: "a1" });
assert.deepEqual(treeKeyAction(key("ArrowDown"), "b", items), { type: "focus", target: "b" }, "the last item stays");
assert.deepEqual(treeKeyAction(key("ArrowUp"), "root", items), { type: "focus", target: "root" });
assert.deepEqual(treeKeyAction(key("Home"), "a2", items), { type: "focus", target: "root" });
assert.deepEqual(treeKeyAction(key("End"), "a", items), { type: "focus", target: "b" });

// ArrowRight: expand a collapsed item, go into an expanded one, nothing on a leaf.
assert.deepEqual(treeKeyAction(key("ArrowRight"), "a", items, { expandable: true, expanded: false }), { type: "expand" });
assert.deepEqual(treeKeyAction(key("ArrowRight"), "a", items, { expandable: true, expanded: true, firstChild: "a1" }), { type: "focus", target: "a1" });
assert.deepEqual(treeKeyAction(key("ArrowRight"), "a", items, { expandable: true, expanded: true }), { type: "focus", target: null }, "an empty container keeps the key");
assert.equal(treeKeyAction(key("ArrowRight"), "a1", items, { expandable: false }), null);

// ArrowLeft: collapse an expanded item that can collapse, else go to the parent; the root has neither.
assert.deepEqual(treeKeyAction(key("ArrowLeft"), "a", items, { expandable: true, expanded: true, collapsible: true, parent: "root" }), { type: "collapse" });
assert.deepEqual(treeKeyAction(key("ArrowLeft"), "a1", items, { parent: "a" }), { type: "focus", target: "a" });
assert.equal(treeKeyAction(key("ArrowLeft"), "root", items, { expandable: true, expanded: true, collapsible: false, parent: null }), null);

// Enter and Space activate; the menu key and Shift+F10 open the menu where there is one.
assert.deepEqual(treeKeyAction(key("Enter"), "a", items), { type: "activate" });
assert.deepEqual(treeKeyAction(key(" "), "a", items), { type: "activate" });
assert.deepEqual(treeKeyAction(key("ContextMenu"), "a", items, { menu: true }), { type: "menu" });
assert.deepEqual(treeKeyAction(key("F10", { shiftKey: true }), "a", items, { menu: true }), { type: "menu" });
assert.equal(treeKeyAction(key("F10"), "a", items, { menu: true }), null);
assert.equal(treeKeyAction(key("ContextMenu"), "root", items, { menu: false }), null);
assert.equal(treeKeyAction(key("x"), "a", items), null);

// Drop places: the root always takes the drop; a container takes it in its middle 40%; else above or below the row.
assert.equal(rowDropMode(0.1, { root: true }), "into");
assert.equal(rowDropMode(0.5, { container: true }), "into");
assert.equal(rowDropMode(0.3, { container: true }), "into");
assert.equal(rowDropMode(0.29, { container: true }), "before");
assert.equal(rowDropMode(0.71, { container: true }), "after");
assert.equal(rowDropMode(0.49), "before");
assert.equal(rowDropMode(0.5), "after");

console.log("studio kit tree: keyboard (focus, expand, collapse, activate, menu) and drop places passed");
