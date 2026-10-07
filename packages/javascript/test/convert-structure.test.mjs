import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  OPFConversionError,
  blocksToRegions,
  demoteImage,
  demoteListItems,
  moveRegion,
  promoteImage,
  promoteListItems,
  regionsToBlocks,
  shiftListLevels,
  unwrapGroup,
  wrapBlocks,
} from "../dist/convert.js";
import { check } from './support/validation.mjs';


const refused = (action, pattern) =>
  assert.throws(
    action,
    (error) => error instanceof OPFConversionError && error.code === "not-convertible" && pattern.test(error.message),
  );
const valid = (slide) => check({ slides: [slide] }).valid;

describe("list levels", () => {
  const outline = { items: ["A", { text: "B", level: 1 }, { text: "C", level: 2 }, "D", { text: "E", description: "e", level: 1 }] };

  test("demote nests an item one level under the item above and moves its children with it", () => {
    const result = demoteListItems({ items: ["A", "B", { text: "C", level: 1 }, "D"] }, [1]);
    assert.deepEqual(result.payload.items, ["A", { text: "B", level: 1 }, { text: "C", level: 2 }, "D"]);
    assert.deepEqual(result.levels, [0, 1, 2, 0]);
    assert.equal(result.lossless, true);
    const alone = demoteListItems({ items: ["A", "B", { text: "C", level: 1 }, "D"] }, [1], { withChildren: false });
    assert.deepEqual(alone.levels, [0, 1, 1, 0]);
  });

  test("a level never exceeds the item above plus one, and the first item cannot be nested", () => {
    const first = demoteListItems({ items: ["A", "B"] }, [0]);
    assert.equal(first.changed, false);
    assert.match(first.reason, /first item/);
    const deep = demoteListItems(outline, [2]);
    assert.equal(deep.changed, false);
    assert.match(deep.reason, /one level below/);
    const clamped = demoteListItems({ items: ["A", { text: "B", level: 1 }, "C"] }, [2]);
    assert.deepEqual(clamped.levels, [0, 1, 1]);
  });

  test("promote lowers a level, keeps descriptions, collapses level 0 back to the plain form", () => {
    const result = promoteListItems(outline, [4]);
    assert.deepEqual(result.payload.items.at(-1), { text: "E", description: "e" });
    const top = promoteListItems(outline, [1]);
    assert.deepEqual(top.payload.items.slice(0, 3), ["A", "B", { text: "C", level: 1 }]);
    const none = promoteListItems(outline, [0, 3]);
    assert.equal(none.changed, false);
    assert.match(none.reason, /top level/);
  });

  test("several selected items each shift one step, bullets work, inputs are validated", () => {
    const result = demoteListItems({ bullets: ["A", "B", "C", "D"] }, [1, 2, 3]);
    assert.deepEqual(result.levels, [0, 1, 1, 1]);
    assert.deepEqual(result.payload.bullets, ["A", { text: "B", level: 1 }, { text: "C", level: 1 }, { text: "D", level: 1 }]);
    refused(() => shiftListLevels({ items: ["A"] }, [5], 1), /exist/);
    refused(() => shiftListLevels({ items: ["A"] }, [0], 0), /level change/);
    refused(() => shiftListLevels({ text: "A" }, [0], 1), /one list/);
    const before = structuredClone(outline);
    demoteListItems(outline, [3]);
    assert.deepEqual(outline, before);
  });

  test("promote then demote restores the list", () => {
    const list = { items: ["A", { text: "B", level: 1 }, { text: "C", level: 1 }, "D"] };
    const promoted = promoteListItems(list, [2]);
    assert.deepEqual(demoteListItems(promoted.payload, [2]).payload, list);
  });
});

describe("group and ungroup", () => {
  const slide = { title: "Plan", blocks: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", items: ["C"] }, { id: "d", text: "D" }] };

  test("wrap puts the selected blocks in a group where the first was, with an optional composition", () => {
    const result = wrapBlocks(slide, [1, 2], { composition: { mode: "row" } });
    assert.deepEqual(result.path, ["blocks", 1]);
    assert.deepEqual(result.slide.blocks.map((block) => block.id ?? "group"), ["a", "group", "d"]);
    assert.deepEqual(result.slide.blocks[1], { blocks: [slide.blocks[1], slide.blocks[2]], composition: { mode: "row" } });
    assert.equal(result.lossless, true);
    assert.ok(valid(result.slide));
    const spread = wrapBlocks(slide, [3, 0]);
    assert.deepEqual(spread.slide.blocks.map((block) => block.id ?? "group"), ["group", "b", "c"]);
    assert.deepEqual(spread.slide.blocks[0].blocks.map((block) => block.id), ["a", "d"]);
  });

  test("wrap works inside a group and on a slide that holds its content inline", () => {
    const nested = wrapBlocks({ blocks: [{ blocks: [{ text: "1" }, { text: "2" }, { text: "3" }] }] }, [0, 1], { container: ["blocks", 0] });
    assert.deepEqual(nested.path, ["blocks", 0, "blocks", 0]);
    assert.equal(nested.slide.blocks[0].blocks.length, 2);
    const inline = wrapBlocks({ title: "T", text: "A", items: ["B"] }, [0, 1]);
    assert.deepEqual(inline.slide, { title: "T", blocks: [{ blocks: [{ text: "A" }, { items: ["B"] }] }] });
    refused(() => wrapBlocks(slide, [], {}), /exist/);
    refused(() => wrapBlocks(slide, [9]), /exist/);
    refused(() => wrapBlocks({ left: { text: "A" } }, [0], { container: ["left"] }), /single payload/);
  });

  test("unwrap splices the children into the parent and reports what the group carried", () => {
    const grouped = { blocks: [{ text: "A" }, { id: "g", composition: { mode: "column" }, blocks: [{ text: "B" }, { text: "C" }] }, { text: "D" }] };
    const result = unwrapGroup(grouped, ["blocks", 1]);
    assert.deepEqual(result.slide.blocks.map((block) => block.text), ["A", "B", "C", "D"]);
    assert.deepEqual(result.loss, ["group arrangement (composition)", "group id"]);
    assert.deepEqual(result.path, ["blocks", 1]);
    const plain = unwrapGroup({ blocks: [{ blocks: [{ text: "B" }] }] }, ["blocks", 0]);
    assert.equal(plain.lossless, true);
    assert.deepEqual(plain.slide, { blocks: [{ text: "B" }] });
    refused(() => unwrapGroup(grouped, ["blocks", 0]), /Choose a group/);
    refused(() => unwrapGroup({ left: { blocks: [{ text: "A" }] } }, ["left"]), /Convert the regions to blocks/);
  });

  test("wrap then unwrap restores the slide", () => {
    const wrapped = wrapBlocks(slide, [1, 2]);
    assert.deepEqual(unwrapGroup(wrapped.slide, wrapped.path).slide, slide);
  });
});

describe("blocks and regions", () => {
  test("blocks to regions places each block in its own region and back, losing only the placement", () => {
    const slide = { title: "T", blocks: [{ text: "A" }, { items: ["B"] }, { text: "C" }] };
    const result = blocksToRegions(slide, ["left", "top:right", "bottom:right"]);
    assert.deepEqual(result.slide, { title: "T", left: { text: "A" }, "top:right": { items: ["B"] }, "bottom:right": { text: "C" } });
    assert.equal(result.lossless, true);
    const back = regionsToBlocks(result.slide);
    assert.deepEqual(back.slide.blocks.map((block) => block.text ?? block.items), ["A", ["B"], "C"]);
    assert.deepEqual(back.loss, ["region placement"]);
    assert.deepEqual(regionsToBlocks({ right: { text: "R" }, left: { text: "L" }, bottom: { text: "B" } }).slide.blocks.map((block) => block.text), ["L", "R", "B"]);
  });

  test("regions are refused when they overlap, are unknown, or the counts differ", () => {
    const slide = { blocks: [{ text: "A" }, { text: "B" }] };
    refused(() => blocksToRegions(slide, ["left", "left+center"]), /overlaps/);
    refused(() => blocksToRegions(slide, ["left", "top"]), /overlaps/);
    refused(() => blocksToRegions(slide, ["left", "nowhere"]), /not a region/);
    refused(() => blocksToRegions(slide, ["left"]), /region for each/);
    refused(() => blocksToRegions({ left: { text: "A" } }, ["left"]), /already uses/);
    refused(() => regionsToBlocks({ blocks: [{ text: "A" }] }), /no named regions/);
    assert.deepEqual(blocksToRegions({ text: "A" }, ["center"]).slide, { center: { text: "A" } });
  });

  test("moveRegion moves or swaps the content of regions", () => {
    const slide = { title: "T", left: { text: "L" }, right: { text: "R" } };
    assert.deepEqual(Object.keys(moveRegion(slide, "left", "center").slide), ["title", "center", "right"]);
    refused(() => moveRegion(slide, "left", "right"), /already has content/);
    const swapped = moveRegion(slide, "left", "right", { swap: true });
    assert.deepEqual(swapped.slide, { title: "T", right: { text: "L" }, left: { text: "R" } });
    refused(() => moveRegion(slide, "left", "top:right"), /overlaps/);
    refused(() => moveRegion(slide, "bottom", "top"), /no "bottom" region/);
    assert.equal(moveRegion(slide, "left", "left").changed, false);
  });
});

describe("images between content and design", () => {
  const slide = { title: "T", blocks: [{ image: { src: "a.png", alt: "An A", title: "Cover" } }, { text: "Body" }] };

  test("promote to slide image, background and watermark", () => {
    const image = promoteImage(slide, ["blocks", 0], "slideImage", { position: "left" });
    assert.deepEqual(image.slide.design.slideImage, { src: "a.png", position: "left", alt: "An A" });
    assert.deepEqual(image.slide.blocks, [{ text: "Body" }]);
    assert.deepEqual(image.loss, ["image title"]);
    assert.equal(promoteImage(slide, ["blocks", 0], "slideImage").slide.design.slideImage.position, "right");
    const background = promoteImage(slide, ["blocks", 0], "background");
    assert.deepEqual(background.slide.design.background, { type: "image", image: { src: "a.png", fit: "cover" } });
    assert.deepEqual(background.loss, ["image alt text", "image title"]);
    const watermark = promoteImage({ blocks: [{ image: "w.png" }, { text: "x" }] }, ["blocks", 0], "watermark", { opacity: 0.2 });
    assert.deepEqual(watermark.slide.design.watermark, { src: "w.png", opacity: 0.2 });
    assert.equal(watermark.lossless, true);
    assert.ok(valid(watermark.slide));
  });

  test("promote handles a slide image, a region, a nested group and prunes what it empties", () => {
    const root = promoteImage({ title: "T", image: "a.png", design: { theme: "minimal" } }, [], "slideImage");
    assert.deepEqual(root.slide, { title: "T", design: { theme: "minimal", slideImage: { src: "a.png", position: "right" } } });
    const region = promoteImage({ left: { image: "a.png" }, right: { text: "R" } }, ["left"], "background");
    assert.deepEqual(Object.keys(region.slide), ["right", "design"]);
    const nested = promoteImage({ blocks: [{ blocks: [{ image: "a.png" }] }, { text: "x" }] }, ["blocks", 0, "blocks", 0], "slideImage");
    assert.deepEqual(nested.slide.blocks, [{ text: "x" }]);
    const only = promoteImage({ blocks: [{ id: "i", image: "a.png" }] }, ["blocks", 0], "slideImage");
    assert.equal(only.slide.blocks, undefined);
    assert.deepEqual(only.loss, ["block id"]);
  });

  test("promote is refused for a non-image, an existing slot or a bad option", () => {
    refused(() => promoteImage(slide, ["blocks", 1], "slideImage"), /only an image/);
    refused(() => promoteImage({ ...slide, design: { background: { type: "image", image: { src: "b.png" } } } }, ["blocks", 0], "background"), /already sets/);
    assert.equal(promoteImage({ ...slide, design: { background: { type: "image", image: { src: "b.png" } } } }, ["blocks", 0], "background", { replace: true }).changed, true);
    refused(() => promoteImage(slide, ["blocks", 0], "watermark", { opacity: 2 }), /between 0 and 1/);
    refused(() => promoteImage(slide, ["blocks", 0], "slideImage", { position: "middle" }), /Choose a position/);
  });

  test("demote puts the image back as a block and reports the placement it cannot keep", () => {
    const withDesign = { title: "T", text: "Body", design: { theme: "minimal", slideImage: { src: "a.png", position: "left", alt: "An A", fit: "fit" } } };
    const result = demoteImage(withDesign, "slideImage");
    assert.deepEqual(result.slide, { title: "T", design: { theme: "minimal" }, blocks: [{ text: "Body" }, { image: { src: "a.png", alt: "An A" } }] });
    assert.deepEqual(result.loss, ["image position and framing"]);
    assert.deepEqual(result.path, ["blocks", 1]);
    const first = demoteImage(withDesign, "slideImage", { index: 0 });
    assert.deepEqual(first.slide.blocks[0], { image: { src: "a.png", alt: "An A" } });
    const background = demoteImage({ text: "x", design: { background: { type: "image", image: { src: "b.png", fit: "tile" }, opacity: 0.5 } } }, "background");
    assert.deepEqual(background.slide.blocks.at(-1), { image: "b.png" });
    assert.deepEqual(background.loss, ["background fit and opacity"]);
    assert.equal(background.slide.design, undefined);
    const watermark = demoteImage({ design: { watermark: { src: "w.png", opacity: 0.1 } } }, "watermark");
    assert.deepEqual(watermark.slide, { image: "w.png" });
    assert.deepEqual(watermark.loss, ["watermark opacity"]);
    assert.equal(demoteImage({ text: "x", design: { slideImage: "s.png" } }, "slideImage").lossless, true);
  });

  test("demote is refused when there is nothing to move or no room", () => {
    refused(() => demoteImage({ text: "x" }, "slideImage"), /does not set/);
    refused(() => demoteImage({ text: "x", design: { slideImage: { position: "left" } } }, "slideImage"), /only configures placement/);
    refused(() => demoteImage({ text: "x", design: { background: { type: "solid", color: "#fff" } } }, "background"), /not an image/);
    refused(() => demoteImage({ left: { text: "x" }, design: { slideImage: "a.png" } }, "slideImage"), /free region/);
    const region = demoteImage({ left: { text: "x" }, design: { slideImage: "a.png" } }, "slideImage", { region: "right" });
    assert.deepEqual(region.slide, { left: { text: "x" }, right: { image: "a.png" } });
  });

  test("promote then demote restores the slide when the image has only a source", () => {
    const original = { title: "T", blocks: [{ text: "Body" }, { image: "a.png" }] };
    const promoted = promoteImage(original, ["blocks", 1], "slideImage");
    const back = demoteImage(promoted.slide, "slideImage");
    assert.deepEqual(back.slide.blocks, original.blocks);
  });
});
