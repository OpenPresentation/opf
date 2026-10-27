import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { gallery } from "@openpresentation/gallery";
import { resolveIdPointer } from "@openpresentation/opf/ids";
import { createEditorSession } from "../dist/index.js";
import { composeSlideGeometry } from "../dist/slide-adapter.js";
import { describeBlock, dropTarget, slideScene } from "../dist/slide-scene.js";

// CE-19: the slide scene model (pure): the node tree of a slide with stable keys, boxes in slide units from the composed geometry,
// containers with tracks, hit chains, the click target and the drop target. The edits are tested in slide-adapter.mjs.
const examples = new URL("../../../examples/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, examples), "utf8"));
const catalogs = [gallery];
const sceneOf = (deck, index) => slideScene(deck, index, { geometry: composeSlideGeometry(deck, index, { catalogs }) });
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, `${message}: ${a} is not ${b}`);
const keys = (list) => list.map((entry) => entry.key);

// --- every slide of the examples corpus gives a well-formed scene -----------------------------------------------------------------
const decks = [
  ...readdirSync(new URL("technical/", examples)).filter((name) => name.endsWith(".opf.json")).map((name) => `technical/${name}`),
  ...readdirSync(new URL("gallery/presentation-types/", examples)).filter((name) => name.endsWith(".opf.json")).slice(0, 8).map((name) => `gallery/presentation-types/${name}`),
];
let slideCount = 0, regionSlides = 0, groupNodes = 0, partNodes = 0;
for (const name of decks) {
  const deck = read(name);
  const withIds = createEditorSession(deck, { catalogs });
  withIds.assignIds();
  for (const document of [deck, withIds.presentation]) {
    document.slides.forEach((slide, index) => {
      const scene = sceneOf(document, index);
      slideCount += 1;
      const seen = new Set();
      for (const node of scene.nodes) {
        assert.ok(!seen.has(node.key), `${name} slide ${index}: the key ${node.key} is unique`);
        seen.add(node.key);
        assert.ok(["slide", "heading", "region", "group", "block", "part", "implicit"].includes(node.kind), `${name}: kind ${node.kind}`);
        assert.equal(typeof node.label, "string");
        assert.ok(Array.isArray(node.findings));
        if (node.parent !== null) {
          const parent = scene.node(node.parent);
          assert.ok(parent, `${name} slide ${index}: the parent of ${node.key} exists`);
          assert.equal(parent.children[node.index], node.key, `${name}: ${node.key} is child ${node.index} of its parent`);
          assert.equal(node.depth, parent.depth + 1);
        }
        if (node.box) for (const value of [node.box.x, node.box.y, node.box.w, node.box.h]) assert.ok(Number.isFinite(value) && value >= -0.01 && value <= 1.01, `${name} slide ${index}: ${node.key} has a box in slide units`);
        // The key is the id path of the node's pointer: it resolves to the same place.
        if (!node.virtual) assert.equal(resolveIdPointer(document, node.key), node.path, `${name}: ${node.key} names ${node.path}`);
        if (node.kind === "group") groupNodes += 1;
        if (node.kind === "part") partNodes += 1;
      }
      if (scene.layout) regionSlides += 1;
      const slideNode = scene.node(scene.slideKey);
      assert.equal(slideNode.kind, "slide");
      assert.equal(slideNode.path, `/slides/${index}`);
      if (document === withIds.presentation) assert.equal(slideNode.key, `/slides/@${slide.id}`, "with ids, the slide key is its id path");
      // Every block of the slide is a node, keyed by id when it has one.
      for (const node of scene.nodes.filter((entry) => entry.kind === "block" || entry.kind === "group")) {
        const block = node.path.split("/").slice(1).reduce((value, token) => value?.[token], document);
        assert.ok(block && typeof block === "object", `${name}: ${node.path} is a block`);
        if (document === withIds.presentation) assert.ok(node.key.endsWith(`@${block.id}`), `${name}: ${node.key} ends with the block id`);
      }
    });
  }
}
assert.ok(slideCount > 150, `the corpus covers many slides (${slideCount})`);
assert.ok(regionSlides > 10 && groupNodes > 0 && partNodes > 0, `the corpus covers layout regions, groups and parts (${regionSlides}, ${groupNodes}, ${partNodes})`);

// --- a known slide: nested groups -------------------------------------------------------------------------------------------------
// dynamic-composition slide 4: a row (2 : 1) of a column group [text, row group [text, text]] and a text.
const dynamic = read("technical/dynamic-composition.opf.json");
const ids = createEditorSession(dynamic, { catalogs });
ids.assignIds();
const deck = ids.presentation;
const nested = sceneOf(deck, 3);
const slide = nested.slideKey;
assert.equal(slide, `/slides/@${deck.slides[3].id}`);
const column = nested.contentChildren(slide)[0], aside = nested.contentChildren(slide)[1];
assert.equal(column.kind, "group");
assert.equal(column.label, "Column · 2");
assert.equal(column.key, `${slide}/blocks/@${deck.slides[3].blocks[0].id}`);
const row = nested.contentChildren(column.key)[1];
assert.equal(row.label, "Row · 2");
const [evidence, action] = nested.contentChildren(row.key);
assert.match(evidence.label, /^Text: Evidence: share the same/);
assert.ok(evidence.label.length <= "Text: ".length + 33, "a label carries at most 32 characters of text");
assert.deepEqual(nested.children(slide).map((node) => node.kind), ["heading", "group", "block"], "headings come first");
assert.equal(nested.node(`${slide}/title`).label, "Title");

// Containers: the slide is a row of two weighted tracks; the column group stacks two rows 1 : 2.
const slideContainer = nested.containerOf(slide);
assert.equal(slideContainer.direction, "row");
assert.deepEqual(slideContainer.tracks.map((track) => track.weight), [2, 1]);
assert.equal(slideContainer.resizable, true);
near(slideContainer.tracks[0].start, column.box.x, "the first track starts where the column group does");
near(slideContainer.tracks[0].length, column.box.w, "and is as wide");
assert.equal(nested.containerOf(column.key).direction, "column");
assert.deepEqual(nested.containerOf(column.key).tracks.map((track) => track.weight), [1, 2]);
assert.equal(nested.flowOf(column.key).path, "slides.3.blocks.0");
assert.equal(nested.containerOf(evidence.key), undefined, "a leaf block is no container");
assert.deepEqual(column.can, { move: true, group: true, delete: true, duplicate: true, resizeTracks: true });
assert.deepEqual(nested.node(`${slide}/title`).can, { move: false, group: false, delete: false, duplicate: false, resizeTracks: false }, "a heading is selected and edited, never moved");

// Hit testing: the chain under a point runs from the slide to the deepest block.
const center = (node) => ({ x: node.box.x + node.box.w / 2, y: node.box.y + node.box.h / 2 });
const chain = nested.hitChain(center(evidence));
assert.deepEqual(keys(chain), [slide, column.key, row.key, evidence.key]);
assert.deepEqual(keys(nested.hitChain(center(nested.node(`${slide}/title`)))), [slide, `${slide}/title`]);
assert.deepEqual(keys(nested.hitChain({ x: 0.01, y: 0.99 })), [slide], "the margin is the slide");
assert.deepEqual(nested.hitChain({ x: 1.5, y: 0.5 }), [], "outside the frame is nothing (the deck)");
// The click target: the deepest node, or one level into the selected container (deep select).
assert.equal(nested.target(chain).key, evidence.key);
assert.equal(nested.target(chain, { primary: slide }).key, column.key, "with the slide selected, a click goes one level in");
assert.equal(nested.target(chain, { primary: column.key }).key, row.key);
assert.equal(nested.target(chain, { primary: row.key }).key, evidence.key);
assert.equal(nested.target(chain, { primary: column.key, shift: true }).key, evidence.key, "Shift keeps the deepest");
assert.equal(nested.target([]), null);

// Survivors: a key that is gone falls back to its nearest existing ancestor.
assert.equal(nested.survivor(`${row.key}/blocks/@gone`), row.key);
assert.equal(nested.survivor(`${slide}/blocks/@gone/blocks/@also`), slide);
assert.equal(nested.survivor("/slides/@nope"), null);

// The drop target: a structural place (container and index), never coordinates.
const before = dropTarget(nested, { x: action.box.x + action.box.w * 0.25, y: center(action).y }, [evidence.key]);
assert.equal(before.target, row.key);
assert.equal(before.index, 1, "the left half of the second text drops before it");
assert.equal(before.into, row.key, "dropping inside a group highlights it");
assert.equal(before.line.orientation, "vertical", "a row's drop line is vertical");
near(before.line.x, action.box.x - nested.containerOf(row.key).gap / 2, "the line sits in the gap before the text");
const after = dropTarget(nested, { x: aside.box.x + aside.box.w * 0.8, y: center(aside).y }, [evidence.key]);
assert.deepEqual([after.target, after.index, after.into], [slide, 2, null], "the right half of the aside drops after it, on the slide");
const intoColumn = dropTarget(nested, { x: center(column).x, y: column.box.y + column.box.h * 0.3 }, [aside.key]);
assert.equal(intoColumn.target, column.key, "the body of a group drops into it");
assert.equal(intoColumn.line.orientation, "horizontal", "a column's drop line is horizontal");
const edge = dropTarget(nested, { x: column.box.x + 0.002, y: center(column).y }, [aside.key]);
assert.deepEqual([edge.target, edge.index], [slide, 0], "the leading edge of a group drops before it, beside it");
assert.equal(dropTarget(nested, { x: 2, y: 2 }, []), null);
const self = dropTarget(nested, center(evidence), [evidence.key]);
assert.equal(self.target, row.key, "a dragged node is never its own target");

// --- implicit content, promoted regions, layout regions, parts ---------------------------------------------------------------------
const promoted = sceneOf(dynamic, 2);
const regionNodes = promoted.contentChildren(promoted.slideKey);
assert.deepEqual(regionNodes.map((node) => [node.kind, node.region, node.promoted]), [["region", "top", true], ["region", "middle", true], ["region", "bottom", true]]);
assert.equal(promoted.containerOf(promoted.slideKey).promoted, true);
const topText = promoted.contentChildren(regionNodes[0].key)[0];
assert.deepEqual([topText.kind, topText.key, topText.field, topText.owner], ["implicit", "/slides/2/top/text", "text", "/slides/2/top"]);
assert.match(topText.label, /^Text \(slide\): First: state the situation\./);

const tour = read("technical/full-feature-tour.opf.json");
const listSlide = sceneOf(tour, 5);
assert.ok(listSlide.layout, "a slide with a template layout lists its regions");
const listRegion = listSlide.contentChildren(listSlide.slideKey).find((node) => node.children.length);
assert.equal(listRegion.virtual, true);
assert.equal(listRegion.key, `${listSlide.slideKey}#${listRegion.region}`);
assert.equal(listRegion.path, listSlide.node(listSlide.slideKey).path, "a layout region has no pointer of its own: its path is the slide's");
const list = listSlide.contentChildren(listRegion.key)[0];
assert.deepEqual([list.kind, list.type], ["implicit", "list"]);
const items = listSlide.children(list.key);
assert.ok(items.length >= 2 && items.every((node) => node.kind === "part"), "list items are parts");
assert.match(items[0].label, /^Item 1: /);
assert.equal(items[0].key, `${list.key}/0`);
const itemChain = listSlide.hitChain(center(items[1]), { parts: true });
assert.deepEqual(keys(itemChain).slice(-2), [list.key, items[1].key], "with parts, the chain reaches the list item");
assert.equal(listSlide.target(itemChain, { deep: true }).key, items[1].key, "Cmd-click selects the part");
assert.equal(listSlide.target(itemChain).key, list.key, "a plain click stops at the block");
assert.ok(!keys(listSlide.hitChain(center(items[1]))).includes(items[1].key), "parts stay out of the plain chain");

const metric = sceneOf(read("technical/block-composition.opf.json"), 0);
const metricBlock = metric.contentChildren(metric.slideKey)[0];
assert.equal(metricBlock.type, "metric");
assert.ok(metric.children(metricBlock.key).some((node) => node.kind === "part" && node.path.startsWith(`${metricBlock.path}/metric/`)), "a metric's value and label are parts");

// A template slide with pinned and unpinned blocks: each region holds what composition bound to it.
const two = {
  $schema: "https://openpresentation.org/schema/opf/v1", name: "Regions",
  slides: [{ id: "r", title: "Two", layout: "two-column", blocks: [{ id: "a", text: "A" }, { id: "b", text: "B", region: "first" }] }],
};
const regions = sceneOf(two, 0);
const [first, second] = regions.contentChildren("/slides/@r");
assert.deepEqual([first.key, second.key], ["/slides/@r#first", "/slides/@r#second"]);
assert.deepEqual(keys(regions.contentChildren(first.key)), ["/slides/@r/blocks/@b"]);
assert.deepEqual(keys(regions.contentChildren(second.key)), ["/slides/@r/blocks/@a"]);
assert.equal(regions.node("/slides/@r/blocks/@b").pin, "first");
assert.ok(first.accepts.includes("text"));
assert.deepEqual(keys(regions.hitChain(center(regions.node("/slides/@r/blocks/@a")))), ["/slides/@r", second.key, "/slides/@r/blocks/@a"]);
const intoRegion = dropTarget(regions, center(first), []);
assert.equal(intoRegion.target, first.key);
assert.equal(intoRegion.into, first.key);

// Findings land on the deepest node that holds their path.
const flagged = slideScene(deck, 3, { geometry: composeSlideGeometry(deck, 3, { catalogs }), findings: [{ path: `${evidence.path}/text`, message: "Too long", severity: "warning" }, { path: "slides.3.notes", message: "Slide level" }] });
assert.deepEqual(flagged.node(evidence.key).findings.map((finding) => finding.message), ["Too long"]);
assert.ok(flagged.node(slide).findings.some((finding) => finding.message === "Slide level"));

// Labels.
assert.equal(describeBlock({ chart: { type: "column", title: "Revenue", data: { columns: ["Q", "R"], rows: [] } } }), "Chart: Revenue");
assert.equal(describeBlock({ table: { columns: ["Quarter", "Revenue"], rows: [] } }), "Table: Quarter, Revenue");
assert.equal(describeBlock({ composition: { mode: "grid" }, blocks: [{ text: "a" }, { text: "b" }, { text: "c" }] }), "Grid · 3");
assert.equal(describeBlock({ blocks: [{ text: "a" }] }), "Group · 1");
assert.equal(describeBlock({ text: [{ text: "Rich " }, { text: "runs", bold: true }] }), "Text: Rich runs");
assert.throws(() => slideScene(deck, 99, { geometry: composeSlideGeometry(deck, 0, { catalogs }) }), RangeError);
assert.throws(() => slideScene(deck, 0, {}), TypeError);

console.log(`slide scene: ${slideCount} slides of ${decks.length} decks`);
