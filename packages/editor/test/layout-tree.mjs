import assert from "node:assert/strict";
import { gallery } from "@openpresentation/gallery";
import { composeLayoutAreas, layoutTemplateIssues } from "@openpresentation/opf/composition";
import {
  LayoutOperationError, deleteNodes, duplicateNodes, equalizePair, inheritedAnchor, insertRegion, layoutBoxes, listAt, moveIntoSibling, moveNodes, nodeAt,
  nodes, nudgePair, pathOfName, reorderNode, resizeSizes, setLayoutProperty, setPairSizes, setProperty, splitRegion, toggleHeading, unwrapNode, wrapNodes,
} from "../dist/layout-tree.js";

// RR-99: the pure tree operations behind the layout editor. Every operation returns a new record that core still accepts, or refuses
// with a LayoutOperationError and changes nothing.
const base = (extra = {}) => ({ id: "t", name: "T", direction: "column", regions: [{ name: "title" }, { direction: "row", regions: [{ name: "first" }, { name: "second" }] }], ...extra });
const valid = (record, message = "") => assert.deepEqual(layoutTemplateIssues(record), [], `core accepts the record ${message}`);
const refused = (fn, pattern) => assert.throws(fn, (error) => error instanceof LayoutOperationError && pattern.test(error.message));
const names = (record) => nodes(record).filter(({ entry }) => entry.name).map(({ entry }) => entry.name);

valid(base());

// --- split ---------------------------------------------------------------------------------------------------------------
{
  const input = base();
  const snapshot = structuredClone(input);
  // A region in a row, split as a column: a split holds it and the new region; the original keeps its name.
  const column = splitRegion(input, [1, 0], "column");
  assert.deepEqual(input, snapshot, "the input record is never changed");
  assert.deepEqual(column.record.regions[1].regions[0], { direction: "column", regions: [{ name: "first" }, { name: "region-1" }] });
  assert.deepEqual(column.selection, [[1, 0, 1]], "the new region is selected");
  valid(column.record, "after a column split");
  // The same axis as the list: a sibling that shares the original's size.
  const row = splitRegion(input, [1, 0], "row");
  assert.deepEqual(row.record.regions[1].regions.map((entry) => [entry.name, entry.size]), [["first", 0.5], ["region-1", 0.5], ["second", undefined]]);
  assert.deepEqual(row.selection, [[1, 1]]);
  valid(row.record);
  // The title is auto in a column; splitting it into a row keeps the wrapper auto.
  const title = splitRegion(input, [0], "row");
  assert.deepEqual(title.record.regions[0], { direction: "row", size: "auto", regions: [{ name: "title" }, { name: "region-1" }] });
  valid(title.record, "after splitting the title into a row");
  // The size moves to the split: a region of size 2 split across keeps its share.
  const sized = splitRegion({ ...base(), regions: [{ name: "a", size: 2 }, { name: "b" }] }, [0], "row");
  assert.equal(sized.record.regions[0].size, 2);
  assert.equal(sized.record.regions[0].regions[0].size, undefined);
  valid(sized.record);
  // Depth: a region at level 3 cannot be split across; a split of the same axis still works.
  const deep = { name: "D", id: "d", direction: "row", regions: [{ direction: "column", regions: [{ direction: "row", regions: [{ name: "x" }, { name: "y" }] }] }] };
  valid(deep);
  refused(() => splitRegion(deep, [0, 0, 0], "column"), /nest at most 3/);
  valid(splitRegion(deep, [0, 0, 0], "row").record);
  refused(() => splitRegion(input, [1], "row"), /not a split/);
  refused(() => splitRegion(input, [9], "row"), /Choose a region/);
  // The number of entries: twelve is the most.
  const full = { id: "f", name: "F", direction: "row", regions: Array.from({ length: 12 }, (_, i) => ({ name: `r${String.fromCharCode(97 + i)}` })) };
  valid(full);
  refused(() => splitRegion(full, [0], "row"), /at most 12/);
  refused(() => insertRegion(full, [], 3), /at most 12/);
}

// --- insert and headings --------------------------------------------------------------------------------------------------
{
  const input = base();
  const inserted = insertRegion(input, [1], 1);
  assert.deepEqual(inserted.record.regions[1].regions.map((entry) => entry.name), ["first", "region-1", "second"]);
  assert.deepEqual(inserted.selection, [[1, 1]]);
  valid(inserted.record);
  const end = insertRegion(input, [], 99);
  assert.equal(end.record.regions.at(-1).name, "region-1", "an index past the end appends");
  // Names stay free: region-1 is taken, so the next is region-2.
  assert.equal(insertRegion(inserted.record, [], 0).record.regions[0].name, "region-2");
  // Headings: without a title, the title row is implicit; the tool adds and removes it.
  const noTitle = { id: "n", name: "N", direction: "column", regions: [{ name: "body" }] };
  const withTitle = toggleHeading(noTitle, "title");
  assert.deepEqual(withTitle.record.regions.map((entry) => entry.name), ["title", "body"]);
  valid(withTitle.record);
  const withSubtitle = toggleHeading(withTitle.record, "subtitle");
  assert.deepEqual(withSubtitle.record.regions.map((entry) => entry.name), ["title", "subtitle", "body"]);
  valid(withSubtitle.record);
  assert.deepEqual(toggleHeading(noTitle, "subtitle").record.regions.map((entry) => entry.name), ["title", "subtitle", "body"], "a subtitle brings its title");
  // Removing the title removes the subtitle; a lone region stays.
  assert.deepEqual(toggleHeading(withSubtitle.record, "title").record.regions.map((entry) => entry.name), ["body"]);
  valid(toggleHeading(withSubtitle.record, "title").record);
  assert.deepEqual(toggleHeading(withSubtitle.record, "subtitle").record.regions.map((entry) => entry.name), ["title", "body"]);
  refused(() => toggleHeading({ ...noTitle, regions: [{ name: "title" }] }, "title"), /at least one region/);
  // A row gets the title on top of the whole row.
  const row = { id: "r", name: "R", direction: "row", regions: [{ name: "a" }, { name: "b" }] };
  const rowTitle = toggleHeading(row, "title").record;
  assert.deepEqual(rowTitle, { id: "r", name: "R", direction: "column", regions: [{ name: "title" }, { direction: "row", regions: [{ name: "a" }, { name: "b" }] }] });
  valid(rowTitle);
  // ...unless a split below would nest too deep: then the title joins the row.
  const nested = { id: "r", name: "R", direction: "row", regions: [{ direction: "column", regions: [{ direction: "row", regions: [{ name: "a" }, { name: "b" }] }] }] };
  valid(nested);
  assert.equal(toggleHeading(nested, "title").record.direction, "row");
  valid(toggleHeading(nested, "title").record);
}

// --- wrap and unwrap ------------------------------------------------------------------------------------------------------
{
  const input = base();
  const wrapped = wrapNodes(input, [[0]], "row");
  assert.deepEqual(wrapped.record.regions[0], { direction: "row", size: "auto", regions: [{ name: "title" }] }, "a one-child split is valid");
  assert.deepEqual(wrapped.selection, [[0]]);
  valid(wrapped.record);
  // Two siblings wrap together; the split takes their joint share.
  const siblings = { id: "w", name: "W", direction: "row", regions: [{ name: "a", size: 2 }, { name: "b" }, { name: "c", size: 3 }] };
  const together = wrapNodes(siblings, [[1], [0]], "column");
  assert.deepEqual(together.record.regions.map((entry) => entry.name ?? entry.direction), ["column", "c"]);
  assert.equal(together.record.regions[0].size, 3);
  assert.deepEqual(together.record.regions[0].regions.map((entry) => [entry.name, entry.size]), [["a", undefined], ["b", undefined]], "sizes of the other axis do not carry over");
  valid(together.record);
  const sameAxis = wrapNodes(siblings, [[0], [1]], "row");
  assert.deepEqual(sameAxis.record.regions[0].regions.map((entry) => entry.size), [2, undefined], "the same axis keeps the shares");
  refused(() => wrapNodes(input, [[0], [1, 0]], "row"), /same list/);
  refused(() => wrapNodes({ id: "d", name: "D", direction: "row", regions: [{ direction: "column", regions: [{ direction: "row", regions: [{ name: "x" }] }] }] }, [[0]], "row"), /nest at most 3/);
  // Unwrap: the children take the split's place, keeping its share between them.
  const unwrapped = unwrapNode(input, [1]);
  assert.deepEqual(unwrapped.record.regions.map((entry) => entry.name), ["title", "first", "second"]);
  assert.deepEqual(unwrapped.selection, [[1], [2]]);
  valid(unwrapped.record);
  const share = unwrapNode({ id: "u", name: "U", direction: "column", regions: [{ name: "a" }, { direction: "row", size: 2, regions: [{ name: "b", size: 3 }, { name: "c", size: 1 }] }] }, [1]).record;
  assert.deepEqual(share.regions.map((entry) => entry.size), [undefined, 1.5, 0.5], "the split's size 2 is shared 3 : 1 between its children");
  valid(share);
  // The split's anchor passes to the children before the split goes.
  const anchored = unwrapNode({ id: "u", name: "U", direction: "column", regions: [{ direction: "row", anchor: "middle", regions: [{ name: "a" }, { name: "b", anchor: "bottom" }] }] }, [0]).record;
  assert.deepEqual(anchored.regions.map((entry) => entry.anchor), ["middle", "bottom"]);
  // A row unwrapped into a row: auto sizes are gone.
  refused(() => unwrapNode(input, [0]), /Only a split/);
  valid(unwrapNode({ id: "u", name: "U", direction: "row", regions: [{ direction: "column", regions: [{ name: "title" }, { name: "a" }] }, { name: "b" }] }, [0]).record, "a title unwrapped into a row");
}

// --- delete and collapse ---------------------------------------------------------------------------------------------------
{
  const input = base();
  // A split left with one child collapses into it, and the child takes the split's size.
  const sized = { id: "c", name: "C", direction: "column", regions: [{ name: "title" }, { direction: "row", size: 2, regions: [{ name: "first", accepts: ["text"] }, { name: "second" }] }] };
  const collapsed = deleteNodes(sized, [[1, 1]]);
  assert.deepEqual(collapsed.record.regions[1], { name: "first", size: 2, accepts: ["text"] });
  assert.deepEqual(collapsed.selection, [[1]], "the region that took the split's place is selected");
  valid(collapsed.record);
  // The anchor of the collapsed split passes down.
  const anchored = deleteNodes({ ...sized, regions: [sized.regions[0], { ...sized.regions[1], anchor: "middle" }] }, [[1, 1]]);
  assert.equal(anchored.record.regions[1].anchor, "middle");
  // Deleting a whole split, and a region between two siblings.
  assert.deepEqual(deleteNodes(input, [[1]]).record.regions, [{ name: "title" }]);
  const three = { id: "t", name: "T", direction: "row", regions: [{ name: "a" }, { name: "b" }, { name: "c" }] };
  const gone = deleteNodes(three, [[1]]);
  assert.deepEqual(gone.record.regions.map((entry) => entry.name), ["a", "c"]);
  assert.deepEqual(gone.selection, [[1]]);
  assert.deepEqual(deleteNodes(three, [[2]]).selection, [[1]], "deleting the last selects the one before");
  assert.deepEqual(deleteNodes(three, [[0], [2]]).record.regions.map((entry) => entry.name), ["b"]);
  refused(() => deleteNodes({ id: "t", name: "T", regions: [{ name: "a" }] }, [[0]]), /at least one region/);
  // Chained collapse: deleting the only sibling of a nested split removes the split.
  const chain = { id: "c", name: "C", direction: "column", regions: [{ name: "a" }, { direction: "row", regions: [{ direction: "column", regions: [{ name: "b" }, { name: "c" }] }, { name: "d" }] }] };
  valid(chain);
  const afterB = deleteNodes(chain, [[1, 0, 0]]).record;
  assert.deepEqual(afterB.regions[1].regions, [{ name: "c" }, { name: "d" }]);
  valid(afterB);
  // overflowRegion pointing at a deleted region goes.
  assert.equal(deleteNodes({ ...three, overflowRegion: "b" }, [[1]]).record.overflowRegion, undefined);
  // An auto title that moves into a row is no longer auto.
  const title = deleteNodes({ id: "t", name: "T", direction: "row", regions: [{ direction: "column", regions: [{ name: "title" }, { name: "a" }] }, { name: "b" }] }, [[0, 1]]);
  valid(title.record, "after the collapse of a split that held a title");
}

// --- duplicate -------------------------------------------------------------------------------------------------------------
{
  const input = base();
  const copy = duplicateNodes(input, [[1, 0]]);
  assert.deepEqual(copy.record.regions[1].regions.map((entry) => entry.name), ["first", "first-2", "second"]);
  assert.deepEqual(copy.selection, [[1, 1]]);
  valid(copy.record);
  assert.equal(duplicateNodes(copy.record, [[1, 0]]).record.regions[1].regions[1].name, "first-3");
  // A split is copied with its regions renamed.
  const whole = duplicateNodes(input, [[1]]);
  assert.deepEqual(names(whole.record), ["title", "first", "second", "first-2", "second-2"]);
  valid(whole.record);
  refused(() => duplicateNodes(input, [[0]]), /unique/);
  refused(() => duplicateNodes({ id: "d", name: "D", regions: [{ name: "title" }, { direction: "row", regions: [{ name: "a" }] }] }, [[0], [1]]), /unique/);
}

// --- move and reorder ------------------------------------------------------------------------------------------------------
{
  const input = { id: "m", name: "M", direction: "column", regions: [{ name: "title" }, { direction: "row", regions: [{ name: "a" }, { name: "b" }, { name: "c" }] }, { name: "d" }] };
  valid(input);
  // Reorder inside a list; an index past the original means "after".
  assert.deepEqual(moveNodes(input, [[1, 0]], [1], 3).record.regions[1].regions.map((entry) => entry.name), ["b", "c", "a"]);
  assert.deepEqual(moveNodes(input, [[1, 2]], [1], 0).record.regions[1].regions.map((entry) => entry.name), ["c", "a", "b"]);
  assert.deepEqual(moveNodes(input, [[1, 0]], [1], 0).record, input, "dropping a region where it is changes nothing");
  assert.deepEqual(moveNodes(input, [[1, 0]], [1], 1).record, input, "dropping it just after itself changes nothing");
  // Between splits: a region moves out of the row to the top level.
  const out = moveNodes(input, [[1, 1]], [], 3);
  assert.deepEqual(out.record.regions.map((entry) => entry.name ?? "row"), ["title", "row", "d", "b"]);
  assert.deepEqual(out.selection, [[3]]);
  valid(out.record);
  // ...and in: d moves into the row, between a and b.
  const into = moveNodes(input, [[2]], [1], 1);
  assert.deepEqual(into.record.regions[1].regions.map((entry) => entry.name), ["a", "d", "b", "c"]);
  assert.deepEqual(into.selection, [[1, 1]]);
  // A split cannot move into itself.
  refused(() => moveNodes(input, [[1]], [1], 0), /itself/);
  // Moving the second-to-last child out of a split collapses what is left.
  const pair = { id: "p", name: "P", direction: "column", regions: [{ name: "a" }, { direction: "row", regions: [{ name: "b" }, { name: "c" }] }] };
  const emptied = moveNodes(pair, [[1, 0]], [], 0);
  assert.deepEqual(emptied.record.regions.map((entry) => entry.name), ["b", "a", "c"], "the lone child c takes the split's place");
  valid(emptied.record);
  // Auto does not survive a move into a row.
  const auto = moveNodes({ id: "a", name: "A", direction: "column", regions: [{ name: "x", size: "auto" }, { direction: "row", regions: [{ name: "y" }, { name: "z" }] }] }, [[0]], [1], 0);
  valid(auto.record, "after an auto region moved into a row");
  // Depth: a split holding a split cannot move into a level-2 list.
  const tall = { id: "t", name: "T", direction: "column", regions: [{ direction: "row", regions: [{ name: "a" }, { direction: "column", regions: [{ name: "b" }, { name: "c" }] }] }, { direction: "row", regions: [{ name: "d" }, { name: "e" }] }] };
  valid(tall);
  refused(() => moveNodes(tall, [[0]], [1], 0), /nest at most 3/);
  // Keyboard reorder.
  assert.deepEqual(reorderNode(input, [1, 0], 1).record.regions[1].regions.map((entry) => entry.name), ["b", "a", "c"]);
  assert.deepEqual(reorderNode(input, [1, 0], -1).record.regions.map((entry) => entry.name ?? "row"), ["title", "a", "row", "d"], "at the start of a split, earlier leaves it");
  assert.deepEqual(reorderNode(input, [1, 2], 1).record.regions.map((entry) => entry.name ?? "row"), ["title", "row", "c", "d"], "at the end, later leaves it");
  refused(() => reorderNode(input, [0], -1), /first/);
  refused(() => reorderNode(input, [2], 1), /last/);
  assert.deepEqual(moveIntoSibling(input, [2], -1).record.regions[1].regions.map((entry) => entry.name), ["a", "b", "c", "d"], "into the split before: at its end");
  assert.equal(moveIntoSibling(input, [0], 1).record.regions[0].regions[0].name, "title", "a region next to a split moves into it, at its start");
  refused(() => moveIntoSibling(input, [1], 1), /not a split/);
}

// --- properties ------------------------------------------------------------------------------------------------------------
{
  const input = base();
  assert.equal(setProperty(input, [1, 0], "name", "lead").record.regions[1].regions[0].name, "lead");
  assert.equal(setProperty({ ...input, overflowRegion: "first" }, [1, 0], "name", "lead").record.overflowRegion, "lead", "renaming follows overflowRegion");
  assert.equal(setProperty(input, [1, 0], "size", 3).record.regions[1].regions[0].size, 3);
  assert.equal(setProperty(setProperty(input, [1, 0], "size", 3).record, [1, 0], "size", 1).record.regions[1].regions[0].size, undefined, "a size of 1 is left out");
  refused(() => setProperty(input, [1, 0], "size", "auto"), /only in a column/);
  assert.equal(setProperty(input, [1], "size", "auto").record.regions[1].size, "auto");
  refused(() => setProperty(input, [1, 0], "size", 0), /above 0/);
  refused(() => setProperty(input, [1, 0], "size", 101), /up to 100/);
  assert.deepEqual(setProperty(input, [1, 0], "accepts", ["table", "text"]).record.regions[1].regions[0].accepts, ["text", "table"], "kinds keep the vocabulary's order");
  assert.equal(setProperty(setProperty(input, [1, 0], "accepts", ["text"]).record, [1, 0], "accepts", []).record.regions[1].regions[0].accepts, undefined, "none selected means all: the key goes");
  assert.equal(setProperty(input, [1, 0], "max", 4).record.regions[1].regions[0].max, 4);
  refused(() => setProperty(input, [1, 0], "max", 13), /1 to 12/);
  assert.equal(setProperty(input, [1, 0], "bleed", true).record.regions[1].regions[0].bleed, true);
  assert.equal(setProperty(input, [1, 0], "listColumns", "auto").record.regions[1].regions[0].listColumns, "auto");
  refused(() => setProperty(input, [0], "role", "primary"), /heading region/);
  refused(() => setProperty(input, [0], "anchor", "top"), /anchor/);
  refused(() => setProperty(input, [1, 0], "direction", "row"), /Only a split/);
  // The split's direction: a row's autos go.
  const col = { id: "s", name: "S", direction: "column", regions: [{ direction: "column", regions: [{ name: "title" }, { name: "a", size: "auto" }] }] };
  valid(col);
  valid(setProperty(col, [0], "direction", "row").record, "after a column split became a row");
  assert.equal(setProperty(col, [0], "direction", "row").record.regions[0].regions[1].size, undefined);
  // The record.
  assert.equal(setLayoutProperty(input, "anchor", "middle").record.anchor, "middle");
  assert.deepEqual(Object.keys(setLayoutProperty(input, "anchor", "middle").record), ["id", "name", "direction", "anchor", "regions"], "keys keep the record's order");
  assert.equal(setLayoutProperty(input, "overflowRegion", "second").record.overflowRegion, "second");
  assert.equal(setLayoutProperty(setLayoutProperty(input, "direction", "row").record, "direction", "column").record.direction, "column");
  const rows = setLayoutProperty({ id: "r", name: "R", direction: "column", regions: [{ name: "a", size: "auto" }, { name: "b" }] }, "direction", "row").record;
  valid(rows);
  // The anchor a region shows as inherited.
  assert.deepEqual(inheritedAnchor({ ...input, anchor: "bottom" }, [1, 0]), { value: "bottom", from: "layout" });
  assert.deepEqual(inheritedAnchor({ ...input, anchor: "bottom", regions: [{ direction: "row", anchor: "middle", regions: [{ name: "a" }] }] }, [0, 0]), { value: "middle", from: "split" });
  assert.deepEqual(inheritedAnchor(input, [1, 0]), { value: undefined, from: "default" });
}

// --- resizing --------------------------------------------------------------------------------------------------------------
{
  const pair = { id: "z", name: "Z", direction: "row", regions: [{ name: "a" }, { name: "b" }] };
  // Alone in the list: the nearest whole ratio.
  assert.deepEqual(resizeSizes(pair, [], 0, 0.5), { a: 1, b: 1, label: "1 : 1" });
  assert.deepEqual(resizeSizes(pair, [], 0, 0.66), { a: 2, b: 1, label: "2 : 1" });
  assert.deepEqual(resizeSizes(pair, [], 0, 0.76), { a: 3, b: 1, label: "3 : 1" });
  assert.deepEqual(resizeSizes(pair, [], 0, 0.4), { a: 2, b: 3, label: "2 : 3" });
  assert.deepEqual(resizeSizes(pair, [], 0, 0.04), { a: 1, b: 11, label: "1 : 11" });
  assert.deepEqual(resizeSizes(pair, [], 0, 0.333, { free: true }), { a: 0.333, b: 0.667, label: "0.333 : 0.667" });
  // With other siblings the pair keeps its joint size and snaps to halves.
  const three = { id: "z", name: "Z", direction: "row", regions: [{ name: "a", size: 2 }, { name: "b", size: 2 }, { name: "c" }] };
  assert.deepEqual(resizeSizes(three, [], 0, 0.76), { a: 3, b: 1, label: "3 : 1" });
  assert.deepEqual(resizeSizes(three, [], 0, 0.62), { a: 2.5, b: 1.5, label: "2.5 : 1.5" });
  assert.deepEqual(resizeSizes(three, [], 0, 1), { a: 3.5, b: 0.5, label: "3.5 : 0.5" }, "neither side vanishes");
  // Auto is not a share.
  const auto = { id: "z", name: "Z", direction: "column", regions: [{ name: "title" }, { name: "a" }, { name: "b" }] };
  assert.equal(resizeSizes(auto, [], 0, 0.5), null);
  assert.notEqual(resizeSizes(auto, [], 1, 0.5), null);
  const set = setPairSizes(three, [], 0, 3, 1);
  assert.deepEqual(set.record.regions.map((entry) => entry.size), [3, undefined, undefined]);
  assert.equal(set.selection, null, "resizing keeps the selection");
  valid(set.record);
  assert.deepEqual(equalizePair(three, [], 0).record.regions.map((entry) => entry.size), [2, 2, undefined], "an unequal pair becomes equal at its joint size");
  assert.deepEqual(equalizePair(setPairSizes(pair, [], 0, 3, 1).record, [], 0).record.regions.map((entry) => entry.size), [undefined, undefined], "alone, 1 : 1");
  assert.deepEqual(nudgePair(three, [], 0, 1).record.regions.map((entry) => entry.size), [2.5, 1.5, undefined]);
  assert.deepEqual(nudgePair(three, [], 0, -1, true).record.regions.map((entry) => entry.size), [undefined, 3, undefined]);
  assert.deepEqual(nudgePair(nudgePair(pair, [], 0, 1).record, [], 0, 1).record.regions.map((entry) => entry.size), [1.5, 0.5], "the sum stays, and neither side goes below half a share");
  refused(() => equalizePair(auto, [], 0), /auto/);
}

// --- geometry --------------------------------------------------------------------------------------------------------------
{
  // The boxes agree with the engine's: shares in proportion, a gap between, inside the content box.
  const record = { id: "g", name: "G", direction: "row", regions: [{ name: "a", size: 2 }, { name: "b" }] };
  const geometry = layoutBoxes(record);
  const [a, b] = geometry.nodes;
  const core = composeLayoutAreas(record, { width: 1280, height: 720 });
  const [ca, cb] = core.areas.map((area) => area.box ?? area);
  assert.ok(Math.abs(a.w / b.w - ca.width / cb.width) < 1e-6, "widths are in the engine's proportion");
  assert.ok(Math.abs((b.x - a.x - a.w) - 24 / core.contentBox.width) < 1e-6, "the gap is the engine's gap");
  assert.ok(geometry.implicitTitle && a.y > geometry.implicitTitle.h && Math.abs(a.y + a.h - 1) < 1e-9, "no title region: the band for the implicit title sits on top, the regions below it");
  assert.equal(geometry.dividers.length, 1);
  assert.equal(geometry.dividers[0].draggable, true);
  assert.equal(geometry.slots.filter((slot) => slot.depth === 1).length, 3, "a slot before, between and after");
  const withTitle = layoutBoxes(base());
  assert.equal(withTitle.implicitTitle, null);
  const titleBox = withTitle.nodes.find(({ entry }) => entry.name === "title");
  const rowBox = withTitle.nodes.find(({ entry }) => entry.direction === "row");
  assert.ok(titleBox.h < rowBox.h, "an auto title is shorter than the row that takes the rest");
  assert.ok(Math.abs(titleBox.h + rowBox.h + (rowBox.y - titleBox.y - titleBox.h) - 1) < 1e-9, "the column fills the box");
  assert.equal(withTitle.dividers.find((divider) => divider.listPath.length === 0).draggable, false, "a divider beside an auto size is not a share");
  // Every box lies inside the unit box, and a split's box holds its children.
  for (const layout of Object.values(gallery.layouts)) {
    const placed = layoutBoxes(layout);
    for (const box of placed.nodes) assert.ok(box.x >= -1e-9 && box.y >= -1e-9 && box.x + box.w <= 1 + 1e-9 && box.y + box.h <= 1 + 1e-9 && box.w > 0 && box.h > 0, `${layout.name}: ${box.path}`);
  }
}

// --- every operation keeps a core-valid record valid ---------------------------------------------------------------------------
{
  let seed = 20261020;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(random() * list.length)];
  const KINDS = ["text", "list", "image", "chart", "table", "metric", "quote"];
  let applied = 0, refusedCount = 0;
  const records = [...Object.entries(gallery.layouts).map(([id, layout]) => ({ id, ...layout })), { id: "blank", name: "Blank", direction: "column", regions: [{ name: "title" }, { name: "content" }] }];
  for (const start of records) {
    let record = structuredClone(start);
    valid(record, start.id);
    for (let step = 0; step < 80; step++) {
      const all = nodes(record);
      const node = pick(all);
      const siblings = listAt(record, node.listPath);
      const operations = [
        () => splitRegion(record, node.path, pick(["row", "column"])),
        () => insertRegion(record, node.listPath, Math.floor(random() * (siblings.length + 1))),
        () => wrapNodes(record, [node.path], pick(["row", "column"])),
        () => unwrapNode(record, node.path),
        () => deleteNodes(record, [node.path]),
        () => duplicateNodes(record, [node.path]),
        () => moveNodes(record, [node.path], pick([[], ...all.filter(({ entry }) => entry.regions).map(({ path }) => path)]), Math.floor(random() * 5)),
        () => reorderNode(record, node.path, pick([-1, 1])),
        () => moveIntoSibling(record, node.path, pick([-1, 1])),
        () => toggleHeading(record, pick(["title", "subtitle"])),
        () => setProperty(record, node.path, "size", pick([1, 2, 3, 0.5, "auto"])),
        () => setProperty(record, node.path, "accepts", [pick(KINDS), pick(KINDS)]),
        () => setProperty(record, node.path, "anchor", pick(["top", "middle", "bottom", undefined])),
        () => setProperty(record, node.path, "direction", pick(["row", "column"])),
        () => setProperty(record, node.path, "name", `n${step}x${Math.floor(random() * 1000)}`),
        () => setLayoutProperty(record, "direction", pick(["row", "column"])),
        () => equalizePair(record, node.listPath, Math.max(0, Math.min(node.index, siblings.length - 2))),
        () => nudgePair(record, node.listPath, Math.max(0, Math.min(node.index, siblings.length - 2)), pick([-1, 1])),
      ];
      let outcome;
      const operation = pick(operations);
      try { outcome = operation(); } catch (error) {
        if (error instanceof LayoutOperationError) { refusedCount++; continue; }
        // Operations on a node that cannot take the property (a split's accepts, a heading's anchor) are refused with a message, never a crash.
        throw error;
      }
      applied++;
      assert.deepEqual(layoutTemplateIssues(outcome.record), [], `${start.id} step ${step}: core accepts the result of ${operation} on ${JSON.stringify(node.path)} in ${JSON.stringify(record.regions)}`);
      for (const path of outcome.selection ?? []) assert.ok(nodeAt(outcome.record, path), `${start.id} step ${step}: the selection points at a node`);
      assert.equal(new Set(names(outcome.record)).size, names(outcome.record).length, "names stay unique");
      record = outcome.record;
    }
  }
  assert.ok(applied > 600 && refusedCount > 100, `the walk both applied (${applied}) and refused (${refusedCount}) operations`);
  assert.ok(pathOfName({ regions: [{ name: "x" }] }, "x"));
}

console.log("layout tree operations: split, wrap, unwrap, move, delete-collapse, resize and geometry stay core-valid");
