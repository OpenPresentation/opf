// RR-26: list levels, grouping, regions, images between content and design, and slide split and merge as editor
// transactions. Each is one guarded, validated, undoable step that reports what it cannot carry.
import assert from "node:assert/strict";
import { validate } from "@openpresentation/opf";
import { toSvg } from "@openpresentation/opf-render/svg";
import { createEditorSession } from "../dist/index.js";
import {
  groupBlocks,
  listItemIndexForSelection,
  mergeSlides,
  moveImageToContent,
  moveImageToDesign,
  moveSlideRegion,
  placeBlocksInRegions,
  prepareGroupBlocks,
  prepareListShift,
  prepareMergeSlides,
  regionsAsBlocks,
  shiftListItems,
  splitSlideByBlocks,
  splitSlideOnOverflow,
  unpaginateSlides,
  ungroupBlock,
} from "../dist/content-actions.js";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=";
const long = "Keep every word, space, and emoji.\n".repeat(100);
const deck = () => ({
  name: "Content actions",
  design: { theme: "minimal", fontScheme: "aptos" },
  assets: { photo: PIXEL },
  slides: [
    { id: "list", title: "List", blocks: [{ id: "outline", items: ["Plan", "Build", { text: "Ship", description: "June" }, "Review"] }, { id: "note", text: "Note" }] },
    { id: "blocks", title: "Blocks", notes: "Say hi", blocks: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", items: ["C"] }, { id: "d", text: "D" }] },
    { id: "regions", title: "Regions", left: { text: "Left" }, right: { items: ["Right"] } },
    { id: "photo", title: "Photo", blocks: [{ image: { src: "asset:photo", alt: "A pixel" } }, { text: "Body" }] },
    { id: "design", title: "Design", text: "Text", design: { background: { type: "image", src: "asset:photo", alt: "Harbour", fit: "contain", overlay: { color: "dark1", opacity: 0.4 } } } },
    { id: "long", title: "Long", blocks: [{ id: "essay", text: long }, { items: Array.from({ length: 50 }, (_, index) => ({ text: `Point ${index}`, description: "Detail." })) }] },
    { id: "last", title: "Last", text: "End" },
  ],
});
const session = () => createEditorSession(deck(), { rejectInvalid: true });
const undoAll = (editor, original) => {
  while (editor.snapshot().canUndo) editor.undo();
  assert.deepEqual(editor.presentation, original);
};
const refused = (action, pattern) => assert.throws(action, (error) => error.code === "content-action-refused" && pattern.test(error.message));

// --- list levels -------------------------------------------------------------------------------
{
  assert.equal(listItemIndexForSelection("slides.0.blocks.0.items.2", "slides.0.blocks.0"), 2);
  assert.equal(listItemIndexForSelection("slides.0.blocks.0.items.2.text", "slides.0.blocks.0"), 2);
  assert.equal(listItemIndexForSelection("slides.0.blocks.0.bullets.0", "slides.0.blocks.0"), 0);
  assert.equal(listItemIndexForSelection("slides.0.blocks.0", "slides.0.blocks.0"), undefined);
  assert.equal(listItemIndexForSelection("slides.0.blocks.10.items.1", "slides.0.blocks.1"), undefined, "a block path is matched whole");
  const editor = session();
  const original = editor.presentation;
  const demote = shiftListItems(editor, "slides.0.blocks.0", [1], 1);
  assert.deepEqual(editor.get("slides.0.blocks.0.items"), ["Plan", { text: "Build", level: 1 }, { text: "Ship", description: "June" }, "Review"]);
  assert.deepEqual([demote.changed, demote.lossless, demote.levels], [true, true, [0, 1, 0, 0]]);
  assert.equal(demote.patches[0].op, "test", "guarded against a concurrent edit");
  assert.equal(editor.snapshot().undoDepth, 1, "one undo step");
  const promote = shiftListItems(editor, "slides.0.blocks.0", [1], -1);
  assert.deepEqual(editor.presentation, original, "demote then promote returns the same document");
  assert.equal(promote.changed, true);
  const none = shiftListItems(editor, "slides.0.blocks.0", [0], 1);
  assert.equal(none.changed, false);
  assert.match(none.reason, /first item/);
  assert.equal(editor.snapshot().undoDepth, 2, "a refused move adds no history entry");
  refused(() => shiftListItems(editor, "slides.0.blocks.1", [0], 1), /Choose a list block/);
  refused(() => shiftListItems(editor, "slides.0.blocks.0", [9], 1), /exist/);
  const stale = prepareListShift(editor.presentation, "slides.0.blocks.0", [2], 1);
  editor.set("slides.0.blocks.0.items.0", "Changed elsewhere");
  assert.throws(() => editor.applyPatch(stale.patches), (error) => error.code === "patch-test-failed");
  undoAll(editor, original);
  // The preview follows: the nested item draws.
  const before = toSvg(editor.presentation, 1);
  shiftListItems(editor, "slides.0.blocks.0", [1, 2], 1);
  assert.notEqual(toSvg(editor.presentation, 1), before);
}

// --- group and ungroup -------------------------------------------------------------------------
{
  const editor = session();
  const original = editor.presentation;
  const grouped = groupBlocks(editor, "slides.1", [1, 2], { composition: { mode: "row" } });
  assert.deepEqual(editor.get("slides.1.blocks").map((block) => block.id ?? "group"), ["a", "group", "d"]);
  assert.equal(grouped.path, "slides.1.blocks.1");
  assert.equal(grouped.lossless, true);
  assert.equal(editor.snapshot().undoDepth, 1);
  const ungrouped = ungroupBlock(editor, grouped.path);
  assert.deepEqual(ungrouped.loss, ["group arrangement (composition)"]);
  assert.deepEqual(editor.get("slides.1.blocks").map((block) => block.id), ["a", "b", "c", "d"]);
  assert.equal(editor.snapshot().undoDepth, 2);
  undoAll(editor, original);
  refused(() => groupBlocks(editor, "slides.1", [7]), /exist/);
  refused(() => groupBlocks(editor, "nowhere", [0]), /Choose a container/);
  refused(() => ungroupBlock(editor, "slides.1.blocks.0"), /Choose a group/);
  assert.equal(prepareGroupBlocks(editor.presentation, "slides.1", [0, 1]).patches.length, 2);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
}

// --- regions -----------------------------------------------------------------------------------
{
  const editor = session();
  const original = editor.presentation;
  const placed = placeBlocksInRegions(editor, 1, ["top:left", "top:right", "bottom:left", "bottom:right"]);
  assert.deepEqual(Object.keys(editor.get("slides.1")).filter((key) => key.includes(":")), ["top:left", "top:right", "bottom:left", "bottom:right"]);
  assert.equal(placed.lossless, true);
  const back = regionsAsBlocks(editor, 1);
  assert.deepEqual(back.loss, ["region placement"]);
  assert.deepEqual(editor.get("slides.1.blocks").map((block) => block.id), ["a", "b", "c", "d"]);
  undoAll(editor, original);
  const swapped = moveSlideRegion(editor, 2, "left", "right", { swap: true });
  assert.equal(swapped.changed, true);
  assert.deepEqual(editor.get("slides.2.right"), { text: "Left" });
  assert.deepEqual(editor.get("slides.2.left"), { items: ["Right"] });
  refused(() => moveSlideRegion(editor, 2, "left", "right"), /already has content/);
  refused(() => placeBlocksInRegions(editor, 1, ["left"]), /region for each/);
  undoAll(editor, original);
}

// --- images ------------------------------------------------------------------------------------
{
  const editor = session();
  const original = editor.presentation;
  // OPF 0.15: a background keeps the block's alt text (and fit, focus, opacity, overlay); placing an image beside the content is its placement, not a move.
  const promoted = moveImageToDesign(editor, "slides.3.blocks.0", "background");
  assert.deepEqual(editor.get("slides.3.design.background"), { type: "image", src: "asset:photo", alt: "A pixel" });
  assert.deepEqual(editor.get("slides.3.blocks"), [{ text: "Body" }]);
  assert.equal(promoted.lossless, true);
  assert.equal(editor.snapshot().undoDepth, 1);
  const demoted = moveImageToContent(editor, 3, "background");
  assert.deepEqual(editor.get("slides.3.blocks.1"), { image: { src: "asset:photo", alt: "A pixel" } });
  assert.equal(demoted.lossless, true);
  assert.equal(editor.get("slides.3.design"), undefined, "an emptied design object is removed");
  undoAll(editor, original);
  const watermark = moveImageToDesign(editor, "slides.3.blocks.0", "watermark", { opacity: 0.3 });
  assert.deepEqual(editor.get("slides.3.design.watermark"), { src: "asset:photo", opacity: 0.3 });
  assert.equal(watermark.changed, true);
  undoAll(editor, original);
  const backdrop = moveImageToContent(editor, 4, "background", { index: 0 });
  assert.deepEqual(editor.get("slides.4.blocks"), [{ image: { src: "asset:photo", alt: "Harbour" }, fit: "contain", overlay: { color: "dark1", opacity: 0.4 } }, { text: "Text" }]);
  assert.equal(backdrop.changed, true);
  refused(() => moveImageToDesign(editor, "slides.3.blocks.1", "background"), /only an image/);
  refused(() => moveImageToDesign(editor, "slides.3.blocks.0", "slideImage"), /background or watermark/);
  refused(() => moveImageToContent(editor, 3, "background"), /does not set/);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
}

// --- slides ------------------------------------------------------------------------------------
{
  const editor = session();
  const original = editor.presentation;
  const split = splitSlideByBlocks(editor, 1, { at: [2] });
  assert.equal(editor.presentation.slides.length, original.slides.length + 1);
  assert.deepEqual(editor.presentation.slides.slice(1, 3).map((slide) => [slide.id, slide.title, slide.blocks.map((block) => block.id)]), [["blocks", "Blocks", ["a", "b"]], ["blocks--2", "Blocks", ["c", "d"]]]);
  assert.equal(editor.get("slides.1.notes"), "Say hi");
  assert.equal(editor.get("slides.2.notes"), undefined);
  assert.equal(split.slideCount, 2);
  assert.equal(editor.snapshot().undoDepth, 1, "a split is one undo step");
  assert.equal(split.patches.filter((patch) => patch.op === "test").length, 1);
  const merged = mergeSlides(editor, 1, 2);
  assert.deepEqual(editor.presentation.slides[1].blocks.map((block) => block.id), ["a", "b", "c", "d"]);
  assert.deepEqual(merged.loss, ['slide id "blocks--2"']);
  assert.equal(editor.presentation.slides.length, original.slides.length);
  undoAll(editor, original);
  const preview = toSvg(editor.presentation, 2);
  splitSlideByBlocks(editor, 1, { each: true });
  assert.notEqual(toSvg(editor.presentation, 2), preview, "the preview follows the split");
  undoAll(editor, original);
  refused(() => splitSlideByBlocks(editor, 6, { each: true }), /one block/);
  refused(() => mergeSlides(editor, 6, 2), /exist/);
  assert.equal(prepareMergeSlides(editor.presentation, 0, 2).range.deleteCount, 2);
  refused(() => prepareMergeSlides(editor.presentation, 1, 2), /named regions/);
}

// --- split on overflow and un-paginate ---------------------------------------------------------
{
  const editor = session();
  const original = editor.presentation;
  const split = splitSlideOnOverflow(editor, 5);
  assert.equal(split.changed, true);
  assert.ok(split.slideCount > 2);
  assert.equal(editor.presentation.slides.length, original.slides.length - 1 + split.slideCount);
  assert.equal(editor.presentation.slides[0].id, "list");
  assert.equal(editor.presentation.slides.at(-1).id, "last");
  assert.ok(Array.isArray(split.pages) && split.pages.length === split.slideCount);
  assert.equal(editor.snapshot().undoDepth, 1, "a split on overflow is one undo step");
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  assert.equal(editor.presentation.slides.slice(5, 5 + split.slideCount).flatMap((slide) => slide.blocks).filter((block) => block.text !== undefined).map((block) => block.text).join(""), long);
  const back = unpaginateSlides(editor, split.pages);
  assert.equal(editor.presentation.slides.length, original.slides.length);
  assert.equal(editor.get("slides.5.blocks.0.text"), long);
  assert.equal(editor.get("slides.5.blocks.1.items").length, 50);
  assert.equal(back.changed, true);
  const fits = splitSlideOnOverflow(editor, 0);
  assert.equal(fits.changed, false, "a slide that fits is left alone");
  assert.equal(editor.snapshot().undoDepth, 2);
  undoAll(editor, original);
}

console.log("Content actions: list levels, group and ungroup, regions, image to design and back, slide split, merge, split on overflow and un-paginate: guarded patches, loss reports, refusals and one undo step each.");
