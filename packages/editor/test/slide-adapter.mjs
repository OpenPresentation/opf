import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gallery } from "@openpresentation/gallery";
import { validate } from "@openpresentation/opf";
import { documentHash } from "@openpresentation/opf/ids";
import { createEditorSession } from "../dist/index.js";
import { createSlideAdapter } from "../dist/slide-adapter.js";
import { snapTrackPair } from "../dist/slide-edits.js";
import { createSelection } from "../dist/studio-kit/selection.js";

// CE-19: the slide adapter over an editor session. Each edit is one validated, undoable patch guarded by expectHash; undo restores the
// exact document (equal documentHash); keys are id paths that survive other edits; gestures preview without writing.
const examples = new URL("../../../examples/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, examples), "utf8"));
const catalogs = [gallery];

function open(deck, slideIndex = 0, extra = {}) {
  const session = createEditorSession(deck, { catalogs, rejectInvalid: true });
  if (extra.ids !== false) session.assignIds();
  const selected = [];
  const events = { selection: [], previews: [], refusals: [] };
  const adapter = createSlideAdapter(session, {
    slideIndex,
    selection: () => [...selected],
    onSelection: (keys, info) => { selected.splice(0, selected.length, ...keys); events.selection.push({ keys, source: info.source }); },
    onPreview: (event) => events.previews.push(event),
    onRefuse: (event) => events.refusals.push(event),
  });
  return { session, adapter, selected, events };
}
const valid = (document, message) => {
  const report = validate(document, { catalogs });
  assert.equal(report.valid, true, `${message}: ${report.findings.filter((finding) => finding.severity === "error").map((finding) => finding.message).join("; ")}`);
};
/** Apply `command` and check: one step, a valid result equal to the prepared one, undo to the exact original, redo to the result. */
function roundTrip(context, command, ...args) {
  const { session, adapter } = context;
  const start = documentHash(session.presentation), depth = session.snapshot().undoDepth;
  const prepared = adapter.prepare(command, ...args.map((arg) => (arg && typeof arg === "object" && !Array.isArray(arg) ? { ...arg } : arg)));
  assert.equal(documentHash(session.presentation), start, `${command}: prepare writes nothing`);
  const result = adapter.apply(command, ...args);
  assert.equal(result.ok, true, `${command}: ${result.reason}`);
  assert.equal(result.changed, true, `${command} changes the document`);
  assert.equal(session.snapshot().undoDepth, depth + 1, `${command} is one undo step`);
  assert.equal(documentHash(session.presentation), documentHash(prepared.presentation), `${command}: the session holds the prepared document`);
  valid(session.presentation, command);
  const after = documentHash(session.presentation);
  assert.equal(adapter.undo(), true);
  assert.equal(documentHash(session.presentation), start, `${command}: undo restores the exact original`);
  assert.equal(adapter.redo(), true);
  assert.equal(documentHash(session.presentation), after, `${command}: redo gives the result again`);
  return result;
}
const nodeOf = (adapter, key) => adapter.scene().node(key);
const content = (adapter, key) => adapter.scene().contentChildren(key ?? adapter.scene().slideKey);

// --- reorder, move into and out of a group ----------------------------------------------------------------------------------------
{
  const context = open(read("technical/block-composition.opf.json"));
  const { adapter, session } = context;
  const slide = adapter.scene().slideKey;
  const [metric, chart, quote, table] = content(adapter).map((node) => node.key);
  // Drag block 2 before block 1 (index 0, counted before removal).
  const moved = roundTrip(context, "move", [chart], slide, 0);
  assert.deepEqual(moved.keys, [chart], "the key of a moved block is the same id path");
  assert.deepEqual(content(adapter).map((node) => node.key), [chart, metric, quote, table]);
  assert.equal(moved.label, "Moved Chart");
  // Several siblings move together, in document order, to the end.
  roundTrip(context, "move", [table, chart], slide, 4);
  assert.deepEqual(content(adapter).map((node) => node.key), [metric, quote, chart, table]);
  // A drop at the same place is a no-op: no step.
  const depth = session.snapshot().undoDepth;
  assert.deepEqual(adapter.trialMove([quote], slide, 1), { ok: true, reason: "", noop: true });
  assert.equal(adapter.apply("move", [quote], slide, 2).changed, false);
  assert.equal(session.snapshot().undoDepth, depth);
  // Group two, move a third into the group, move it out again; the group a move empties goes.
  const grouped = roundTrip(context, "group", [metric, quote]);
  const group = grouped.keys[0];
  assert.equal(nodeOf(adapter, group).kind, "group");
  assert.deepEqual(content(adapter, group).map((node) => node.key), [`${group}/blocks/${metric.split("/").at(-1)}`, `${group}/blocks/${quote.split("/").at(-1)}`]);
  const into = roundTrip(context, "move", [table], group, 1);
  assert.equal(into.keys[0], `${group}/blocks/${table.split("/").at(-1)}`, "a key follows the block into its new container");
  assert.equal(content(adapter, group).length, 3);
  const inner = content(adapter, group).map((node) => node.key);
  roundTrip(context, "move", inner, slide, 0);
  assert.equal(nodeOf(adapter, group), undefined, "moving every block out removes the emptied group");
  assert.equal(content(adapter).length, 4);
  // moveBy and moveInto (the [ ] and Shift+[ ] commands).
  const order = content(adapter).map((node) => node.key);
  roundTrip(context, "moveBy", [order[1]], -1);
  assert.equal(content(adapter)[0].key, order[1]);
  const wrapped = adapter.apply("group", [content(adapter)[2].key, content(adapter)[3].key]).keys[0];
  roundTrip(context, "moveInto", [content(adapter)[1].key], 1);
  assert.equal(content(adapter, wrapped).length, 3, "Shift+] moves into the next sibling group, at its start");
  assert.equal(adapter.apply("moveInto", [content(adapter)[0].key], -1).ok, false, "no group before the first block");
}

// --- refusals: headings, parts, a group into itself, non-siblings ------------------------------------------------------------------
{
  const deck = read("technical/dynamic-composition.opf.json");
  const context = open(deck, 3);
  const { adapter, session, events } = context;
  const slide = adapter.scene().slideKey;
  const [column, aside] = content(adapter);
  const [lead, row] = content(adapter, column.key);
  const start = documentHash(session.presentation);
  assert.deepEqual(adapter.trialMove([`${slide}/title`], slide, 0), { ok: false, reason: "A heading cannot move.", noop: false });
  assert.equal(adapter.trialMove([column.key], row.key, 0).reason, "A group cannot move into itself.");
  assert.equal(adapter.trialMove([lead.key, aside.key], slide, 0).reason, "Multiple selection works within one group. Select siblings.");
  assert.equal(adapter.trialMove([aside.key], lead.key, 0).reason, "Drop into the slide, a group or a region.");
  const refused = adapter.apply("delete", [`${slide}/title`]);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "A heading cannot be deleted; clear its text instead.");
  assert.equal(events.refusals.at(-1).reason, refused.reason);
  assert.equal(documentHash(session.presentation), start, "a refused command changes nothing");
  // A drop from the drop target: the point resolves to a container and an index, and carries the trial's answer.
  const box = row.box;
  const drop = adapter.dropAt({ x: box.x + box.w * 0.9, y: box.y + box.h / 2 }, [aside.key]);
  assert.deepEqual([drop.target, drop.index, drop.ok], [row.key, 2, true]);
  const headingDrop = adapter.dropAt({ x: 0.5, y: 0.15 }, [aside.key]);
  assert.equal(headingDrop.target, slide, "a heading is no drop target; its area drops on the slide");
}

// --- group and ungroup restore the original exactly; ungroup of an existing group ---------------------------------------------------
{
  const deck = read("technical/dynamic-composition.opf.json");
  const context = open(deck, 1);
  const { adapter, session } = context;
  const original = session.presentation;
  const blocks = content(adapter).map((node) => node.key);
  const grouped = roundTrip(context, "group", [blocks[1], blocks[2]]);
  assert.equal(nodeOf(adapter, grouped.keys[0]).label, "Group · 2");
  const ungrouped = roundTrip(context, "ungroup", grouped.keys[0]);
  assert.deepEqual(session.presentation, original, "group then ungroup gives the original document back (deep-equal)");
  assert.deepEqual(ungrouped.keys, [blocks[1], blocks[2]], "ungroup selects the blocks it released");
  adapter.undo();
  adapter.undo();
  assert.deepEqual(session.presentation, original, "and so do two undos");
  assert.equal(adapter.apply("ungroup", blocks[0]).reason, "Select a group to ungroup.");
  // Grouping and ungrouping with a composition.
  const row = adapter.apply("group", [blocks[0], blocks[1]], { composition: { mode: "row" } });
  assert.equal(nodeOf(adapter, row.keys[0]).label, "Row · 2");
}

// --- duplicate and delete: blocks, implicit content, slides ------------------------------------------------------------------------
{
  const context = open(read("technical/block-composition.opf.json"));
  const { adapter, session } = context;
  const before = content(adapter).map((node) => node.key);
  const duplicated = roundTrip(context, "duplicate", [before[0], before[2]]);
  const after = content(adapter).map((node) => node.key);
  assert.equal(after.length, 6);
  assert.deepEqual(duplicated.keys, [after[1], after[4]], "each copy goes right after its original and is selected");
  assert.ok(duplicated.keys.every((key) => !before.includes(key)), "copies get fresh ids");
  const deleted = roundTrip(context, "delete", duplicated.keys);
  assert.deepEqual(content(adapter).map((node) => node.key), before);
  assert.ok(deleted.keys.length === 1 && adapter.scene().node(deleted.keys[0]), "delete selects the nearest remaining block");
  // Slides: duplicate, move and delete by slide key.
  const slides = adapter.slides().map((entry) => entry.key);
  assert.equal(slides.length, 1);
  const copy = roundTrip(context, "duplicate", [slides[0]]);
  assert.equal(adapter.slides().length, 2);
  assert.deepEqual(copy.keys, [adapter.slides()[1].key]);
  roundTrip(context, "moveSlides", [adapter.slides()[1].key], 0);
  assert.equal(adapter.slides()[0].key, copy.keys[0], "moveSlides reorders the slides");
  roundTrip(context, "delete", [copy.keys[0]]);
  assert.equal(adapter.slides().length, 1);
  assert.equal(adapter.apply("delete", [adapter.slides()[0].key]).reason, "A presentation needs at least one slide.");
  void session;
}
{
  // Implicit content (a slide's own fields) becomes blocks inside the same change.
  const deck = {
    $schema: "https://openpresentation.org/schema/opf/v1", name: "Implicit",
    slides: [{ id: "one", title: "One", text: "Lead paragraph.", items: ["First", "Second"] }, { id: "two", title: "Two", blocks: [{ id: "g", blocks: [{ id: "x", text: "X" }, { id: "y", text: "Y" }] }] }],
  };
  const context = open(deck, 0, { ids: false });
  const { adapter, session } = context;
  const [text, list] = content(adapter);
  assert.deepEqual([text.kind, text.key, list.key], ["implicit", "/slides/@one/text", "/slides/@one/items"]);
  const moved = roundTrip(context, "move", [list.key], "/slides/@one", 0);
  assert.deepEqual(moved.keys, ["/slides/@one/blocks/0"], "the converted list is block 0");
  assert.deepEqual(session.presentation.slides[0].blocks, [{ items: ["First", "Second"] }, { text: "Lead paragraph." }]);
  adapter.undo();
  roundTrip(context, "duplicate", [text.key]);
  adapter.undo();
  const removed = roundTrip(context, "delete", [list.key]);
  assert.equal(session.presentation.slides[0].items, undefined);
  assert.deepEqual(removed.keys, ["/slides/@one"]);
  adapter.undo();
  roundTrip(context, "group", [text.key, list.key]);
  assert.equal(session.presentation.slides[0].blocks.length, 1);
  adapter.undo();
  // Copy blocks on slide 1, paste them into a group on slide 2.
  const clip = adapter.copy([text.key, list.key]);
  assert.deepEqual(clip, { kind: "opf-studio-blocks", blocks: [{ text: "Lead paragraph." }, { items: ["First", "Second"] }], count: 2 });
  assert.equal(adapter.setSlide("/slides/@two"), true);
  assert.equal(adapter.slideIndex, 1);
  const pasted = roundTrip(context, "paste", clip, { target: "/slides/@two/blocks/@g", index: 1 });
  assert.deepEqual(pasted.keys, ["/slides/@two/blocks/@g/blocks/1", "/slides/@two/blocks/@g/blocks/2"]);
  assert.deepEqual(session.presentation.slides[1].blocks[0].blocks.map((block) => block.id ?? block.text ?? "list"), ["x", "Lead paragraph.", "list", "y"]);
  // Pasting a block that has an id gives the copy a fresh one.
  const withId = adapter.copy(["/slides/@two/blocks/@g/blocks/@x"]);
  const again = roundTrip(context, "paste", withId);
  const copied = session.presentation.slides[1].blocks.at(-1);
  assert.equal(copied.text, "X");
  assert.notEqual(copied.id, "x", "a pasted block never reuses an id");
  assert.deepEqual(again.keys, [`/slides/@two/blocks/@${copied.id}`]);
}

// --- copy and paste slides (into the same deck and into another) -------------------------------------------------------------------
{
  const source = open(read("technical/dynamic-composition.opf.json"), 0);
  const clip = source.adapter.copy([source.adapter.slides()[3].key]);
  assert.equal(clip.kind, "opf-studio-slides");
  const same = roundTrip(source, "paste", clip);
  assert.equal(source.adapter.slides().length, 5);
  assert.deepEqual(same.keys, [source.adapter.slides()[1].key], "pasted slides go after the current slide");
  const target = open(read("technical/block-composition.opf.json"), 0);
  const other = roundTrip(target, "paste", clip);
  assert.equal(target.adapter.slides().length, 2);
  assert.equal(target.session.presentation.slides[1].title, "Arrange each idea and its supporting details");
  assert.ok(other.keys[0].startsWith("/slides/@"));
}

// --- layout regions: move into a region, accepts and full refusals ------------------------------------------------------------------
{
  const deck = {
    $schema: "https://openpresentation.org/schema/opf/v1", name: "Regions",
    slides: [{ id: "r", title: "Chart and notes", layout: "chart-beside", blocks: [{ id: "c", chart: { type: "column", data: { columns: ["Q", "V"], rows: [["A", 1], ["B", 2]] } } }, { id: "n", text: "Notes" }, { id: "m", blocks: [{ id: "m1", text: "Inner one" }, { id: "m2", text: "Inner two" }] }] }],
  };
  const context = open(deck, 0, { ids: false });
  const { adapter, session } = context;
  const regions = content(adapter);
  const chartRegion = regions.find((node) => node.region === "chart"), notes = regions.find((node) => node.region === "notes");
  assert.ok(chartRegion && notes, "the chart-beside layout has a chart and a notes region");
  assert.deepEqual(content(adapter, chartRegion.key).map((node) => node.key), ["/slides/@r/blocks/@c"]);
  assert.equal(adapter.trialMove(["/slides/@r/blocks/@n"], chartRegion.key, 0).reason, "Region chart accepts only chart.");
  // A block from inside a group moves into the notes region: it becomes a root block pinned to the region.
  const inNotes = content(adapter, notes.key).map((node) => node.key);
  const moved = roundTrip(context, "move", ["/slides/@r/blocks/@m/blocks/@m2"], notes.key, inNotes.length);
  assert.deepEqual(moved.keys, ["/slides/@r/blocks/@m2"]);
  const block = session.presentation.slides[0].blocks.find((entry) => entry.id === "m2");
  assert.equal(block.region, "notes", "a block moved into a region is pinned to it");
  assert.ok(content(adapter, notes.key).some((node) => node.key === "/slides/@r/blocks/@m2"), "and the region shows it");
  // And back into the group: the pin goes.
  roundTrip(context, "move", ["/slides/@r/blocks/@m2"], "/slides/@r/blocks/@m", 0);
  assert.equal(session.presentation.slides[0].blocks[2].blocks[0].region, undefined, "a block inside a group carries no region pin");
  // Moving a region's own block to its own place changes nothing.
  assert.equal(adapter.trialMove(["/slides/@r/blocks/@c"], chartRegion.key, 0).noop, true);
  // A full region refuses (chart takes at most one block).
  const second = adapter.apply("paste", { kind: "opf-studio-blocks", blocks: [{ id: "c2", chart: { type: "bar", data: { columns: ["Q", "V"], rows: [["A", 1]] } } }] }, { target: notes.key });
  assert.equal(second.ok, true, second.reason);
  // An unpinned block yields to a pinned one (the binding displaces it to another region that accepts it)...
  const displaced = adapter.prepare("move", ["/slides/@r/blocks/@c2"], chartRegion.key, 1);
  assert.equal(displaced.changed, true);
  // ...but a region whose blocks are all pinned is full.
  session.set("slides.0.blocks.0.region", "chart", { source: "test" });
  const full = adapter.trialMove(["/slides/@r/blocks/@c2"], chartRegion.key, 1);
  assert.equal(full.ok, false);
  assert.equal(full.reason, "Region chart is full.");
}

// --- track resize: snapped weights, auto becomes grid, equalize, free -------------------------------------------------------------
{
  assert.deepEqual(snapTrackPair([1, 1], 0, 0.66), { a: 2, b: 1 }, "two tracks snap to a small whole ratio");
  assert.deepEqual(snapTrackPair([1, 1, 1], 0, 0.7), { a: 1.5, b: 0.5 }, "with more tracks, halves of the pair's sum");
  assert.deepEqual(snapTrackPair([1, 1], 0, 0.62, { free: true }), { a: 1.24, b: 0.76 }, "Shift drags freely");
  const deck = read("technical/dynamic-composition.opf.json");
  const context = open(deck, 0);
  const { adapter, session } = context;
  const slide = adapter.scene().slideKey;
  assert.deepEqual(adapter.containerOf(slide).tracks.map((track) => track.weight), [2, 1]);
  const resized = roundTrip(context, "resizeTracks", slide, 0, 0.5);
  assert.equal(resized.label, "Resized to 1 : 1");
  assert.deepEqual(session.presentation.slides[0].composition, { mode: "row", weights: [1, 1], overflow: "error" }, "track resize writes composition.weights");
  const equalized = roundTrip(context, "resizeTracks", slide, 0, 0.75);
  assert.equal(equalized.label, "Resized to 3 : 1");
  roundTrip(context, "equalize", slide, 0);
  assert.deepEqual(session.presentation.slides[0].composition.weights, [1, 1]);
  roundTrip(context, "setWeights", slide, [3, 2]);
  assert.deepEqual(adapter.containerOf(slide).tracks.map((track) => track.weight), [3, 2]);
  assert.equal(adapter.apply("setWeights", slide, [1]).reason, "Give 2 weights between 0 and 100.");
  // An automatic arrangement becomes the grid it drew.
  adapter.setSlide(1);
  const auto = adapter.scene().slideKey;
  assert.equal(adapter.containerOf(auto).mode, "auto");
  const columns = adapter.containerOf(auto).tracks.length;
  roundTrip(context, "resizeTracks", auto, 0, 0.6);
  const composition = session.presentation.slides[1].composition;
  assert.equal(composition.mode, "grid");
  assert.equal(composition.columns, columns);
  assert.equal(composition.weights.length, columns);
  // A leaf has no tracks.
  assert.equal(adapter.apply("resizeTracks", content(adapter)[0].key, 0, 0.5).reason, "This has no tracks to resize. Select a row, column or grid.");
}

// --- gestures: drafts never write; the end is one step; cancel restores; expectHash guards ------------------------------------------
{
  const deck = read("technical/dynamic-composition.opf.json");
  const context = open(deck, 0);
  const { adapter, session, events } = context;
  const slide = adapter.scene().slideKey;
  const start = documentHash(session.presentation), depth = session.snapshot().undoDepth;
  assert.equal(adapter.begin("Resized"), true);
  assert.equal(adapter.begin("Again"), false, "one gesture at a time");
  adapter.preview(adapter.prepare("resizeTracks", slide, 0, 0.5), "Resize 1 : 1");
  adapter.preview(adapter.prepare("resizeTracks", slide, 0, 0.25), "Resize 1 : 3");
  assert.equal(documentHash(session.presentation), start, "previews do not write to the document");
  assert.equal(events.previews.length, 2);
  assert.deepEqual(events.previews.at(-1).presentation.slides[0].composition.weights, [1, 3], "the host draws the draft");
  assert.deepEqual(adapter.scene().containerOf(slide).tracks.map((track) => track.weight), [1, 3], "the scene follows the draft");
  assert.equal(adapter.commit("Resized to 1 : 3"), true);
  assert.equal(events.previews.at(-1).presentation, null, "the draft is cleared at the end");
  assert.equal(session.snapshot().undoDepth, depth + 1, "a gesture is one undo step");
  assert.deepEqual(session.presentation.slides[0].composition.weights, [1, 3]);
  assert.deepEqual(adapter.scene().containerOf(slide).tracks.map((track) => track.weight), [1, 3]);
  // Cancel: the document stays as it was.
  const before = documentHash(session.presentation);
  adapter.begin("Resized");
  adapter.preview(adapter.prepare("resizeTracks", slide, 0, 0.5));
  adapter.cancel();
  assert.equal(documentHash(session.presentation), before);
  assert.equal(adapter.gestureActive, false);
  assert.deepEqual(adapter.scene().containerOf(slide).tracks.map((track) => track.weight), [1, 3]);
  // A drag that ends without a draft changes nothing.
  adapter.begin("Moved");
  assert.equal(adapter.commit(), false);
  // expectHash: a change prepared before someone else's edit is refused, and nothing is applied.
  const stale = adapter.prepare("resizeTracks", slide, 0, 0.5);
  session.set("slides.0.title", "Edited elsewhere", { source: "remote" });
  const edited = documentHash(session.presentation);
  adapter.begin("Resized");
  adapter.preview(stale);
  assert.equal(adapter.commit(), false);
  assert.match(events.refusals.at(-1).reason, /changed/);
  assert.equal(documentHash(session.presentation), edited, "the stale draft was not applied");
}

// --- keys stay stable across another patch; selection follows edits, undo and redo -------------------------------------------------
{
  const deck = read("technical/dynamic-composition.opf.json");
  const context = open(deck, 3);
  const { adapter, session, selected, events } = context;
  const [column, aside] = content(adapter);
  const [, row] = content(adapter, column.key);
  const evidence = content(adapter, row.key)[0];
  const label = evidence.label;
  // Someone else inserts a block before the group and reorders the slides: the keys still name the same nodes.
  session.applyPatch([{ op: "add", path: "/slides/3/blocks/0", value: { text: "Inserted by someone else" } }, { op: "move", from: "/slides/0", path: "/slides/2" }], { source: "remote" });
  adapter.setSlide(column.key.split("/blocks")[0]);
  assert.equal(adapter.slideIndex, 3, "the slide key still finds its slide after the reorder");
  for (const key of [column.key, row.key, evidence.key, aside.key]) assert.ok(nodeOf(adapter, key), `${key} survives the other patch`);
  assert.equal(nodeOf(adapter, evidence.key).label, label);
  assert.equal(adapter.pathOf(evidence.key), "/slides/3/blocks/1/blocks/1/blocks/0", "the same key resolves to the block's new index path");
  assert.equal(nodeOf(adapter, column.key).index, 2, "its place moved; its key did not");
  // The kit's selection over the adapter: Esc walks block, group, group, slide, deck; Enter goes into a group.
  const selection = createSelection(adapter.selectionAdapter());
  selection.set([evidence.key]);
  selection.selectParent();
  assert.deepEqual(selection.items, [row.key]);
  selection.selectParent();
  selection.selectParent();
  assert.deepEqual(selection.items, [adapter.scene().slideKey]);
  selection.selectParent();
  assert.deepEqual(selection.items, [], "Esc from the slide selects the deck");
  selection.set([row.key]);
  selection.selectChild();
  assert.deepEqual(selection.items, [evidence.key], "Enter on a group selects its first child");
  selection.add(aside.key);
  assert.deepEqual(selection.items, [aside.key], "Shift on a non-sibling replaces the selection");
  selection.set([adapter.scene().slideKey]);
  selection.selectChild();
  assert.equal(selection.primary, `${adapter.scene().slideKey}/title`, "Enter on the slide selects its first child, the title");
  selection.set([adapter.scene().slideKey]);
  selection.selectSibling(-1);
  assert.equal(selection.primary, adapter.slides()[2].key, "a slide's siblings are the other slides");
  // Undo and redo restore the selection of the edit they cross.
  selected.splice(0, selected.length, evidence.key);
  const grouped = adapter.apply("group", content(adapter, row.key).map((node) => node.key));
  assert.deepEqual(selected, grouped.keys);
  adapter.undo();
  assert.deepEqual(selected, [evidence.key], "undo restores the selection from before the edit");
  assert.equal(events.selection.at(-1).source, "undo");
  adapter.redo();
  assert.deepEqual(selected, grouped.keys, "redo restores the selection after it");
}

// --- without ids, keys are index paths; ensureIds adds ids as one step ------------------------------------------------------------
{
  const context = open(read("technical/block-composition.opf.json"), 0, { ids: false });
  const { adapter, session } = context;
  assert.equal(adapter.scene().slideKey, "/slides/0");
  assert.equal(content(adapter)[1].key, "/slides/0/blocks/1");
  const depth = session.snapshot().undoDepth;
  assert.equal(adapter.ensureIds(), true);
  assert.equal(session.snapshot().undoDepth, depth + 1, "Add ids is one undoable change");
  assert.match(adapter.scene().slideKey, /^\/slides\/@/);
  assert.equal(adapter.ensureIds(), false, "nothing to add the second time");
  assert.equal(adapter.keyOf("/slides/0/blocks/1"), content(adapter)[1].key);
  assert.throws(() => adapter.prepare("teleport"), /Unknown slide command teleport/);
  adapter.destroy();
}

console.log("slide adapter: ok");
