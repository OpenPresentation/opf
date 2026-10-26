// CE-19: the structural edits of the slide scene, as prepared changes. Each `prepareScene*` function reads the document and a scene of
// it (`slide-scene.js`), and returns `{ presentation, patches, changed, paths, label }` without touching a session: `patches` turn the
// document into `presentation` (validated with core), `paths` are the index pointers to select afterwards. A refusal throws an
// `OPFEditorError` whose message says why ("A heading cannot move."), which the drag shows on its drop line. Where the editor already
// has the operation it is reused (block insert, duplicate and remove; group and ungroup; track resize; slide move, duplicate, remove and
// import); the multi-block move, the move into a layout region and the implicit-content conversion are here.
//
// D2: slides stay auto-layout. Every move resolves to a container and an index; no edit writes a position.
import { resolveSlideContext } from "@openpresentation/opf";
import { bindRegions } from "@openpresentation/opf/composition";
import { formatPointer, jsonEqual, parsePointer, readPointer } from "@openpresentation/opf/patch";
import { resolveIdPointer } from "@openpresentation/opf/ids";
import { applyJsonPatch, createValuePatch } from "./index.js";
import { checkFormat, errorFindings, firstErrorMessage } from "./checks.js";
import { fail } from "./edit-helpers.js";
import { prepareBlockDuplicate, prepareBlockInsert, prepareBlockRemove } from "./blocks.js";
import { prepareGroupBlocks, prepareUngroupBlock } from "./content-actions.js";
import { prepareTrackResize } from "./layout.js";
import { prepareDuplicateSlides, prepareMoveSlides, prepareRemoveSlides } from "./slides.js";
import { collectReservedPresentationIds, remapSlideTreeIds } from "./presentation-ids.js";
import { prepareOpfImport } from "./transfer.js";
import { prepareSave } from "./catalogs.js";
import { CONTENT_FIELDS, contentFieldsOf, isPromotedRegion } from "./slide-scene.js";

/** The error a refused studio edit throws (`code` `studio-refused`); its message is the reason to show. */
export const refuse = (message, details) => fail("studio-refused", message, details);
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const valueAt = (document, pointer) => { const found = readPointer(document, pointer); return found.found ? found.value : undefined; };
const parentPointer = (pointer) => formatPointer(parsePointer(pointer).slice(0, -2));
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const KIND_WORDS = { text: "text", list: "list", image: "image", video: "video", chart: "chart", table: "table", code: "code", metric: "metric", quote: "quote", timeline: "timeline", group: "group" };
const HEADING_REFUSALS = { move: "move", group: "be grouped", delete: "be deleted; clear its text instead", duplicate: "be duplicated", copy: "be copied as a block" };
const wordList = (list) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);

/** The validated result of `patches` on `presentation`: a valid deck must stay valid (a deck that was already invalid is not blamed on the edit). */
function validated(presentation, patches, catalogs) {
  const next = applyJsonPatch(presentation, patches);
  const options = catalogs ? { catalogs } : {};
  const report = checkFormat(next, options);
  if (!report.valid && checkFormat(presentation, options).valid)
    throw fail("invalid-opf-edit", firstErrorMessage(report, "This change produces an invalid document."), { issues: errorFindings(report), patches });
  return next;
}
const unchanged = (presentation, extra = {}) => ({ presentation, patches: [], changed: false, paths: [], noop: true, ...extra });

// --- nodes -------------------------------------------------------------------------------------------------------------------------

/** The scene nodes of `keys`, checked for a structural `action` ("move", "group", ...): siblings only, in document order. */
function siblings(scene, keys, action) {
  const list = [...new Set(keys ?? [])].map((key) => {
    const node = scene.node(key);
    if (!node) throw refuse("Select something on this slide first.", { key });
    return node;
  });
  if (!list.length) throw refuse("Select something on this slide first.");
  for (const node of list) {
    if (node.kind === "heading") throw refuse(`A heading cannot ${HEADING_REFUSALS[action] ?? action}.`, { key: node.key });
    if (node.kind === "part") throw refuse(`Select the whole block to ${action} it.`, { key: node.key });
    if (node.kind === "region") throw refuse(node.virtual ? "A region belongs to the slide's layout. Edit the layout to change it." : "A promoted region keeps its place on the slide grid.", { key: node.key });
    if (node.kind === "slide") throw refuse(`Use the slide list to ${action} slides.`, { key: node.key });
  }
  if (list.some((node) => node.parent !== list[0].parent)) throw refuse("Multiple selection works within one group. Select siblings.");
  const parent = scene.node(list[0].parent);
  const order = scene.contentChildren(parent.key).map((node) => node.key);
  return list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

/** Turn an owner's implicit content fields into its `blocks` (core's rule: a single payload keeps the owner's `type`). */
function explicitOwner(owner) {
  if (Array.isArray(owner.blocks)) return owner.blocks;
  const keys = contentFieldsOf(owner);
  owner.blocks = keys.map((key) => ({ ...(keys.length === 1 && owner.type ? { type: owner.type } : {}), [key]: owner[key] }));
  for (const key of [...CONTENT_FIELDS, "type"]) delete owner[key];
  return owner.blocks;
}

// Walk a slide's block tree: every block, group and promoted region object with its parent (`array` and `owner`, or `key` for a region).
function parents(slide) {
  const map = new Map();
  const walk = (owner, depth) => {
    if (!Array.isArray(owner.blocks) || depth > 32) return;
    for (const block of owner.blocks) if (isObject(block)) { map.set(block, { owner }); walk(block, depth + 1); }
  };
  walk(slide, 0);
  for (const key of Object.keys(slide)) if (isPromotedRegion(key) && isObject(slide[key])) { map.set(slide[key], { owner: slide, key }); walk(slide[key], 0); }
  return map;
}
// The index pointer of `target` (an object of the working slide) by identity, or null.
function locate(slide, slidePointer, target) {
  const walk = (owner, tokens, depth) => {
    if (!Array.isArray(owner.blocks) || depth > 32) return null;
    for (let at = 0; at < owner.blocks.length; at += 1) {
      const block = owner.blocks[at], here = [...tokens, "blocks", String(at)];
      if (block === target) return here;
      if (isObject(block)) { const found = walk(block, here, depth + 1); if (found) return found; }
    }
    return null;
  };
  const base = parsePointer(slidePointer);
  if (target === slide) return formatPointer(base);
  const root = walk(slide, base, 0);
  if (root) return formatPointer(root);
  for (const key of Object.keys(slide)) {
    if (!isPromotedRegion(key) || !isObject(slide[key])) continue;
    if (slide[key] === target) return formatPointer([...base, key]);
    const found = walk(slide[key], [...base, key], 0);
    if (found) return formatPointer(found);
  }
  return null;
}

/**
 * A working copy of the scene's slide in which the owners in `convert` (pointers) hold explicit blocks, with `objectOf(node)` for the
 * object of a block or implicit node in it. Returns the copy, its slide, the identity map of parents and the converted owners.
 */
function workingCopy(presentation, scene, convert) {
  const work = structuredClone(presentation);
  const slide = work.slides[scene.slideIndex];
  const converted = [];
  for (const pointer of new Set(convert)) {
    const owner = valueAt(work, pointer);
    if (isObject(owner) && !Array.isArray(owner.blocks) && contentFieldsOf(owner).length) { explicitOwner(owner); converted.push(pointer); }
  }
  const objectOf = (node) => {
    if (node.kind === "implicit") return valueAt(work, node.owner)?.blocks?.[node.blockIndex];
    return valueAt(work, node.path);
  };
  return { work, slide, objectOf, converted, parentMap: parents(slide) };
}
// Remove `object` from its blocks array; then remove every group (and promoted region, and the slide's own `blocks`) the removal empties,
// except `keep`, the container the objects move into.
function detach(slide, parentMap, object, pruned, keep) {
  const info = parentMap.get(object);
  if (!info) return;
  const list = info.owner.blocks;
  list.splice(list.indexOf(object), 1);
  if (list.length || info.owner === keep) return;
  const owner = info.owner;
  if (owner === slide) { delete slide.blocks; pruned.push(slide); return; }
  const up = parentMap.get(owner);
  if (up?.key) { delete slide[up.key]; pruned.push(slide); return; }
  pruned.push(up?.owner ?? slide);
  detach(slide, parentMap, owner, pruned, keep);
}
// One patch for the change inside the working slide: a replace of the deepest object that holds every changed owner (of its `blocks`
// when nothing else of it changed), so a reorder inside a group touches that group only.
function slidePatch(presentation, work, scene, owners) {
  const slidePointer = scene.node(scene.slideKey).path;
  const tokens = owners.map((pointer) => parsePointer(pointer));
  let common = tokens[0] ?? parsePointer(slidePointer);
  for (const list of tokens.slice(1)) { let at = 0; while (at < common.length && at < list.length && common[at] === list[at]) at += 1; common = common.slice(0, at); }
  // An owner pointer is an object (slide, group, region): trim back to one, never into a `blocks` array.
  while (common.length > 2 && common.at(-1) === "blocks") common = common.slice(0, -1);
  if (common.length < 2) common = parsePointer(slidePointer);
  const pointer = formatPointer(common);
  const before = valueAt(presentation, pointer), after = valueAt(work, pointer);
  const { blocks: oldBlocks, ...oldRest } = before ?? {}, { blocks: newBlocks, ...newRest } = after ?? {};
  if (Array.isArray(oldBlocks) && Array.isArray(newBlocks) && jsonEqual(oldRest, newRest)) return [{ op: "replace", path: `${pointer}/blocks`, value: newBlocks }];
  return [{ op: "replace", path: pointer, value: after }];
}

// --- move --------------------------------------------------------------------------------------------------------------------------

/**
 * Move the sibling nodes `keys` (blocks, groups, implicit content) to `index` of the content children of the container `targetKey` (the
 * slide, a group, a promoted region or a layout region). `index` counts the children before the move, as a drop gap does. The moved
 * nodes keep their order and land together. A group the move empties is removed; implicit content becomes blocks first; a block moved
 * into a group or promoted region loses its layout region pin; a block moved into a layout region is pinned to it (and must be accepted
 * there). A move that changes nothing returns `changed: false` with `noop: true`.
 */
export function prepareSceneMove(presentation, scene, keys, targetKey, index, options = {}) {
  const sources = siblings(scene, keys, "move");
  const target = scene.node(targetKey);
  if (!target || !["slide", "group", "region"].includes(target.kind)) throw refuse("Drop into the slide, a group or a region.");
  for (const source of sources) for (let at = target; at; at = scene.node(at.parent)) if (at.key === source.key) throw refuse("A group cannot move into itself.");
  const content = scene.contentChildren(target.key);
  if (!Number.isInteger(index) || index < 0 || index > content.length) throw refuse("The drop place is out of range.", { index });
  if (target.kind === "slide" && target.container?.promoted) throw refuse("Drop into one of the slide's regions.");
  if (target.kind === "region" && target.virtual) return regionMove(presentation, scene, sources, target, index, options);
  if (target.kind === "slide" && scene.layout) throw refuse("Drop into one of the layout's regions.");

  const sourceOwners = sources.map((node) => (node.kind === "implicit" ? node.owner : parentPointer(node.path)));
  const targetOwner = target.path; // the slide, a group or a promoted region: the object that holds the blocks
  const { work, slide, objectOf, converted, parentMap } = workingCopy(presentation, scene, [...sources.filter((node) => node.kind === "implicit").map((node) => node.owner), targetOwner]);
  const objects = sources.map(objectOf);
  if (objects.some((object) => !isObject(object))) throw refuse("This content cannot move. Convert it to blocks first.");
  const owner = valueAt(work, targetOwner);
  const list = Array.isArray(owner?.blocks) ? owner.blocks : explicitOwner(owner);
  const moved = new Set(objects);
  let at = index;
  while (at < list.length && moved.has(list[at])) at += 1;
  const anchor = list[at];
  const order = [...list];
  const pruned = [];
  for (const object of objects) detach(slide, parentMap, object, pruned, owner);
  const into = owner.blocks;
  into.splice(anchor ? into.indexOf(anchor) : into.length, 0, ...objects);
  // The same order in the same container is no move (and does not convert implicit content for nothing).
  if (!pruned.length && into.length === order.length && into.every((object, place) => object === order[place])) return unchanged(presentation, { paths: sources.map((node) => node.path) });
  if (target.kind !== "slide") for (const object of objects) delete object.region;
  if (jsonEqual(work.slides[scene.slideIndex], presentation.slides[scene.slideIndex])) return unchanged(presentation, { paths: sources.map((node) => node.path) });
  const changedOwners = converted.length || pruned.length ? [scene.node(scene.slideKey).path] : [...sourceOwners, targetOwner];
  const patches = slidePatch(presentation, work, scene, changedOwners);
  const next = validated(presentation, patches, options.catalogs);
  const paths = objects.map((object) => locate(slide, scene.node(scene.slideKey).path, object));
  return { presentation: next, patches, changed: true, paths, label: `Moved ${sources.length === 1 ? sources[0].label.split(":")[0] : plural(sources.length, "block")}` };
}

// A move into a layout region: the blocks become root blocks pinned to the region, placed in the slide's `blocks` beside the region's
// other blocks so the region shows them at `index`.
function regionMove(presentation, scene, sources, region, index, options) {
  const accepts = region.accepts ?? [];
  for (const source of sources) {
    const kind = source.kind === "group" ? "group" : source.type;
    if (accepts.length && !accepts.includes(kind)) throw refuse(`Region ${region.region} accepts only ${wordList(accepts.map((entry) => KIND_WORDS[entry] ?? entry))}.`, { region: region.region, kind });
  }
  const slidePointer = scene.node(scene.slideKey).path;
  const { work, slide, objectOf, parentMap } = workingCopy(presentation, scene, [slidePointer, ...sources.filter((node) => node.kind === "implicit").map((node) => node.owner)]);
  const objects = sources.map(objectOf);
  if (objects.some((object) => !isObject(object))) throw refuse("This content cannot move. Convert it to blocks first.");
  const moved = new Set(objects);
  const members = scene.contentChildren(region.key).map(objectOf);
  let at = index;
  while (at < members.length && moved.has(members[at])) at += 1;
  const anchor = members[at];
  const remaining = members.filter((object) => object && !moved.has(object));
  // With no other block in the region, the moved blocks stay where they were in the slide's order (after the root group they left).
  const rootOf = (object) => { let at = object; while (parentMap.get(at) && parentMap.get(at).owner !== slide) at = parentMap.get(at).owner; return at; };
  const roots = slide.blocks ?? [];
  const firstRoot = rootOf(objects[0]);
  const after = roots.slice(roots.indexOf(firstRoot) + 1).find((object) => !moved.has(object));
  const pruned = [];
  for (const object of objects) detach(slide, parentMap, object, pruned, slide);
  slide.blocks ??= [];
  // Dropping a region's own blocks back in their place changes nothing (it does not pin blocks the region already holds).
  const place0 = anchor && slide.blocks.includes(anchor) ? slide.blocks.indexOf(anchor) : remaining.length && slide.blocks.includes(remaining.at(-1)) ? slide.blocks.indexOf(remaining.at(-1)) + 1 : null;
  if (sources.every((node) => node.parent === region.key) && !remaining.length) return unchanged(presentation, { paths: sources.map((node) => node.path) });
  if (sources.every((node) => node.parent === region.key) && place0 !== null) {
    const trial = [...slide.blocks];
    trial.splice(place0, 0, ...objects);
    if (jsonEqual(trial, presentation.slides[scene.slideIndex].blocks)) return unchanged(presentation, { paths: sources.map((node) => node.path) });
  }
  for (const object of objects) object.region = region.region;
  const place = anchor && slide.blocks.includes(anchor) ? slide.blocks.indexOf(anchor)
    : remaining.length && slide.blocks.includes(remaining.at(-1)) ? slide.blocks.indexOf(remaining.at(-1)) + 1
    : moved.has(firstRoot) ? (after && slide.blocks.includes(after) ? slide.blocks.indexOf(after) : slide.blocks.length)
    : slide.blocks.includes(firstRoot) ? slide.blocks.indexOf(firstRoot) + 1 : slide.blocks.length;
  slide.blocks.splice(place, 0, ...objects);
  if (jsonEqual(work.slides[scene.slideIndex], presentation.slides[scene.slideIndex])) return unchanged(presentation, { paths: sources.map((node) => node.path) });
  const patches = slidePatch(presentation, work, scene, [slidePointer]);
  const next = validated(presentation, patches, options.catalogs);
  const paths = objects.map((object) => locate(slide, slidePointer, object));
  // The binding decides: each moved block must land in the region as a pinned block (the region may be full).
  const context = resolveSlideContext(next, scene.slideIndex, { catalogs: options.catalogs });
  const binding = bindRegions(next.slides[scene.slideIndex], context.options.layout, { slideIndex: scene.slideIndex });
  const bound = binding.regions?.find((entry) => entry.name === region.region);
  for (const path of paths) {
    const dotted = parsePointer(path).join(".");
    if (!bound?.blocks?.some((block) => block.path === dotted && block.pinned)) throw refuse(`Region ${region.region} is full.`, { region: region.region });
  }
  return { presentation: next, patches, changed: true, paths, label: `Moved ${sources.length === 1 ? sources[0].label.split(":")[0] : plural(sources.length, "block")} to ${region.region}` };
}

/** Move the siblings `keys` one place earlier (`delta` -1) or later (1) in their container. Past either end nothing changes. */
export function prepareSceneMoveBy(presentation, scene, keys, delta, options = {}) {
  const sources = siblings(scene, keys, "move");
  const parent = scene.node(sources[0].parent);
  const content = scene.contentChildren(parent.key);
  const first = content.findIndex((node) => node.key === sources[0].key), last = content.findIndex((node) => node.key === sources.at(-1).key);
  const index = delta < 0 ? first - 1 : last + 2;
  if (index < 0 || index > content.length) return unchanged(presentation, { paths: sources.map((node) => node.path) });
  return prepareSceneMove(presentation, scene, keys, parent.key, index, options);
}

/** Move the siblings `keys` into the group just before them (`delta` -1, at its end) or just after them (1, at its start). */
export function prepareSceneMoveInto(presentation, scene, keys, delta, options = {}) {
  const sources = siblings(scene, keys, "move");
  const content = scene.contentChildren(sources[0].parent);
  const at = delta < 0 ? content.findIndex((node) => node.key === sources[0].key) - 1 : content.findIndex((node) => node.key === sources.at(-1).key) + 1;
  const group = content[at];
  if (!group || group.kind !== "group") throw refuse(delta < 0 ? "There is no group just before this." : "There is no group just after this.");
  return prepareSceneMove(presentation, scene, keys, group.key, delta < 0 ? scene.contentChildren(group.key).length : 0, options);
}

// --- group and ungroup -------------------------------------------------------------------------------------------------------------

/**
 * Wrap the siblings `keys` in a new group in their place (core's `wrapBlocks`). In a layout region, the group takes the blocks' region pin.
 * When the slide has an id (the deck uses ids), the group gets a free `group-N` id, so its key is stable.
 */
export function prepareSceneGroup(presentation, scene, keys, options = {}) {
  const sources = siblings(scene, keys, "group");
  const parent = scene.node(sources[0].parent);
  const container = parent.kind === "region" && parent.virtual ? scene.node(scene.slideKey).path : parent.path;
  const prepared = prepareGroupBlocks(presentation, container, sources.map((node) => node.blockIndex), { validate: false, ...(options.composition ? { composition: options.composition } : {}) });
  const path = parsePointer(prepared.path.startsWith("/") ? prepared.path : formatPointer(prepared.path.split(".")));
  const slidePointer = scene.node(scene.slideKey).path;
  const slide = structuredClone(prepared.patches.at(-1).value);
  const group = valueAt(slide, formatPointer(path.slice(2)));
  const pins = new Set(sources.map((node) => node.pin));
  if (parent.virtual && pins.size === 1 && [...pins][0]) {
    group.region = [...pins][0];
    for (const block of group.blocks) delete block.region;
  }
  // A deck that uses ids (its slide has one) gives the new group one too, so its key survives later reorders (`group-N`, unused).
  if (typeof presentation.slides[scene.slideIndex].id === "string" && group.id === undefined) {
    const taken = new Set(collectReservedPresentationIds(presentation));
    let number = 1;
    while (taken.has(`group-${number}`)) number += 1;
    group.id = `group-${number}`;
  }
  const patches = [{ op: "replace", path: slidePointer, value: slide }];
  const next = validated(presentation, patches, options.catalogs);
  return { presentation: next, patches, changed: true, paths: [formatPointer(path)], label: `Grouped ${plural(sources.length, "block")}`, lossless: prepared.lossless, loss: prepared.loss, ...(group.id ? { id: group.id } : {}) };
}

/** Replace the group `key` by its blocks (core's `unwrapGroup`). A pinned root group passes its region pin to its blocks. */
export function prepareSceneUngroup(presentation, scene, key, options = {}) {
  const node = scene.node(key);
  if (!node || node.kind !== "group") throw refuse("Select a group to ungroup.");
  const prepared = prepareUngroupBlock(presentation, node.path, { validate: false });
  const tokens = parsePointer(node.path);
  const slidePointer = scene.node(scene.slideKey).path;
  const slide = structuredClone(prepared.patches.at(-1).value);
  const group = valueAt(presentation, node.path);
  const count = group.blocks.length, start = Number(tokens.at(-1));
  const list = valueAt(slide, formatPointer(tokens.slice(2, -1)));
  if (typeof group.region === "string") for (const block of list.slice(start, start + count)) block.region ??= group.region;
  const patches = [{ op: "replace", path: slidePointer, value: slide }];
  const next = validated(presentation, patches, options.catalogs);
  const paths = Array.from({ length: count }, (_, at) => formatPointer([...tokens.slice(0, -1), String(start + at)]));
  return { presentation: next, patches, changed: true, paths, label: "Ungrouped", lossless: prepared.lossless, loss: prepared.loss };
}

// --- duplicate and delete ----------------------------------------------------------------------------------------------------------

// Convert the owner of implicit `nodes` to blocks as one guarded change; returns the converted document, its patches and each node's block pointer.
function asBlocks(presentation, nodes) {
  const owners = [...new Set(nodes.filter((node) => node.kind === "implicit").map((node) => node.owner))];
  let current = presentation;
  const patches = [];
  for (const pointer of owners) {
    const next = structuredClone(valueAt(current, pointer));
    explicitOwner(next);
    const step = [{ op: "test", path: pointer, value: structuredClone(valueAt(current, pointer)) }, { op: "replace", path: pointer, value: next }];
    current = applyJsonPatch(current, step);
    patches.push(...step);
  }
  return { presentation: current, patches, pointerOf: (node) => (node.kind === "implicit" ? `${node.owner}/blocks/${node.blockIndex}` : node.path) };
}

/** Duplicate the siblings `keys`: each copy goes right after its original, with fresh ids. Slide keys duplicate slides. */
export function prepareSceneDuplicate(presentation, scene, keys, options = {}) {
  const slideIndices = slideIndicesOf(presentation, scene, keys);
  if (slideIndices) {
    const prepared = prepareDuplicateSlides(presentation, slideIndices, options);
    return { ...prepared, paths: prepared.selection.map((index) => `/slides/${index}`), label: slideIndices.length === 1 ? "Duplicated slide" : `Duplicated ${slideIndices.length} slides` };
  }
  const sources = siblings(scene, keys, "duplicate");
  const converted = asBlocks(presentation, sources);
  let current = converted.presentation;
  const patches = [...converted.patches];
  const pointers = sources.map(converted.pointerOf);
  for (const pointer of [...pointers].reverse()) {
    const step = prepareBlockDuplicate(current, pointer);
    current = step.presentation;
    patches.push(...step.patches);
  }
  const next = validated(presentation, patches, options.catalogs);
  const paths = pointers.map((pointer, order) => {
    const tokens = parsePointer(pointer);
    return formatPointer([...tokens.slice(0, -1), String(Number(tokens.at(-1)) + order + 1)]);
  });
  return { presentation: next, patches, changed: true, paths, label: `Duplicated ${sources.length === 1 ? sources[0].label.split(":")[0] : plural(sources.length, "block")}` };
}

/** Delete the siblings `keys`. A group they empty goes too; a slide is never left without its frame. Slide keys delete slides. */
export function prepareSceneDelete(presentation, scene, keys, options = {}) {
  const slideIndices = slideIndicesOf(presentation, scene, keys);
  if (slideIndices) {
    const prepared = prepareRemoveSlides(presentation, slideIndices);
    return { ...prepared, paths: prepared.selection.map((index) => `/slides/${index}`), label: slideIndices.length === 1 ? "Deleted slide" : `Deleted ${slideIndices.length} slides` };
  }
  const sources = siblings(scene, keys, "delete");
  let current = presentation, selection = null;
  const patches = [];
  for (const node of [...sources].reverse()) {
    if (node.kind === "implicit") {
      // The field goes, with the owner's `type` when it named this content, and a promoted region left with no content goes whole.
      const owner = valueAt(current, node.owner);
      const rest = contentFieldsOf(owner).filter((field) => field !== node.field);
      const ownerTokens = parsePointer(node.owner);
      const region = ownerTokens.length === 3 && isPromotedRegion(ownerTokens[2]);
      const typed = typeof owner.type === "string" && (!rest.length || owner.type === node.type || (owner.type === "text" && node.field === "bullets"));
      const step = region && !rest.length ? [{ op: "remove", path: node.owner }] : [{ op: "remove", path: node.path }, ...(typed ? [{ op: "remove", path: `${node.owner}/type` }] : [])];
      current = applyJsonPatch(current, step);
      patches.push(...step);
      selection = region && !rest.length ? formatPointer(ownerTokens.slice(0, 2)) : node.owner;
      continue;
    }
    const step = prepareBlockRemove(current, node.path);
    current = step.presentation;
    patches.push(...step.patches);
    selection = step.path;
  }
  const next = validated(presentation, patches, options.catalogs);
  return { presentation: next, patches, changed: true, paths: selection ? [selection] : [], label: `Deleted ${sources.length === 1 ? sources[0].label.split(":")[0] : plural(sources.length, "block")}` };
}

// --- track resize ------------------------------------------------------------------------------------------------------------------

const round3 = (value) => Math.round(value * 1000) / 1000;
function niceRatio(fraction) {
  let best = { p: 1, q: 1, error: Infinity };
  for (let total = 2; total <= 12; total += 1) for (let p = 1; p < total; p += 1) {
    const error = Math.abs(p / total - fraction);
    if (error < best.error - 1e-9) best = { p, q: total - p, error };
  }
  return best;
}
/** "2 : 1": the ratio two track weights read as. */
export const ratioLabel = (a, b) => `${round3(a)} : ${round3(b)}`;
/**
 * The weights the tracks `boundary` and `boundary + 1` take when the divider between them sits at `fraction` (0 to 1) of the pair, as
 * Layout Studio snaps them: with two tracks the nearest small whole ratio (2 : 1, 3 : 2, up to twelfths); with more, halves of the pair's
 * sum, so the other tracks keep their share. `free` (Shift) turns snapping off.
 */
export function snapTrackPair(weights, boundary, fraction, { free = false } = {}) {
  const a = weights[boundary], b = weights[boundary + 1];
  const f = Math.max(0, Math.min(1, fraction));
  const total = a + b, others = weights.length - 2;
  if (free) {
    const first = Math.max(total * 0.05, Math.min(total * 0.95, round3(f * total)));
    return { a: first, b: round3(total - first) };
  }
  if (!others) { const { p, q } = niceRatio(Math.max(0.05, Math.min(0.95, f))); return { a: p, b: q }; }
  if (total < 1) return { a, b };
  const first = Math.max(0.5, Math.min(total - 0.5, Math.round((f * total) / 0.5) * 0.5));
  return { a: round3(first), b: round3(total - first) };
}

// The effective weights of a container's composed flow, one per track.
function flowWeights(flow) {
  const tracks = flow.composition?.mode === "column" ? flow.rows : flow.columns;
  return Array.from({ length: tracks.length }, (_, index) => flow.composition?.weights?.[index] ?? 1);
}
// Write `weights` as the container's composition: `prepareTrackResize` checks the flow (2 to 12 tracks, no reserved slots) and turns an
// automatic arrangement into the explicit grid it drew; the weights are then the exact snapped values.
function prepareWeights(presentation, scene, key, weights, label, options) {
  const node = scene.node(key);
  const flow = scene.flowOf(key);
  if (!node || !flow) throw refuse("This has no tracks to resize. Select a row, column or grid.");
  let base;
  try {
    base = prepareTrackResize(presentation, flow, 0, weights[0] / (weights[0] + weights[1]));
  } catch (error) {
    if (error instanceof RangeError) throw refuse(error.message);
    throw error;
  }
  const composition = { ...base.composition, weights: weights.map(round3) };
  const container = valueAt(presentation, formatPointer(flow.path.split(".")));
  if (jsonEqual(container?.composition, composition)) return unchanged(presentation, { paths: [node.path], weights: composition.weights, label });
  const patches = [base.patches[0], ...createValuePatch(presentation, [...flow.path.split("."), "composition"], composition)];
  const next = validated(presentation, patches, options.catalogs);
  return { presentation: next, patches, changed: true, paths: [node.path], weights: composition.weights, label };
}

/**
 * Resize the tracks of the container `key` (a slide, group or promoted region with a row, column, grid or automatic arrangement): the
 * divider between track `boundary` and the next moves to `fraction` of the pair, snapped (`snapTrackPair`). This writes the container's
 * `composition.weights` (columns in a row or grid, rows in a column); an automatic arrangement becomes the grid it drew.
 */
export function prepareSceneTrackResize(presentation, scene, key, boundary, fraction, options = {}) {
  const flow = scene.flowOf(key);
  if (!flow) throw refuse("This has no tracks to resize. Select a row, column or grid.");
  const weights = flowWeights(flow);
  if (!Number.isInteger(boundary) || boundary < 0 || boundary >= weights.length - 1) throw refuse("Choose a divider between two tracks.");
  const { a, b } = snapTrackPair(weights, boundary, fraction, options);
  weights[boundary] = a;
  weights[boundary + 1] = b;
  return prepareWeights(presentation, scene, key, weights, `Resized to ${ratioLabel(a, b)}`, options);
}
/** Give the tracks on both sides of divider `boundary` of container `key` the same weight (a double-click or Enter on the divider). */
export function prepareSceneEqualize(presentation, scene, key, boundary, options = {}) {
  const flow = scene.flowOf(key);
  if (!flow) throw refuse("This has no tracks to resize. Select a row, column or grid.");
  const weights = flowWeights(flow);
  if (!Number.isInteger(boundary) || boundary < 0 || boundary >= weights.length - 1) throw refuse("Choose a divider between two tracks.");
  const half = weights.length === 2 ? 1 : (weights[boundary] + weights[boundary + 1]) / 2;
  weights[boundary] = half;
  weights[boundary + 1] = half;
  return prepareWeights(presentation, scene, key, weights, "Equalized", options);
}
/** Set every track weight of container `key` (positive numbers up to 100, one per track). */
export function prepareSceneWeights(presentation, scene, key, weights, options = {}) {
  const flow = scene.flowOf(key);
  if (!flow) throw refuse("This has no tracks to resize. Select a row, column or grid.");
  const count = flowWeights(flow).length;
  if (!Array.isArray(weights) || weights.length !== count || weights.some((weight) => !Number.isFinite(weight) || weight <= 0 || weight > 100)) throw refuse(`Give ${count} weights between 0 and 100.`);
  return prepareWeights(presentation, scene, key, [...weights], `Resized to ${weights.map(round3).join(" : ")}`, options);
}

// --- slides ------------------------------------------------------------------------------------------------------------------------

// The slide indices of `keys` when every key names a slide (`/slides/@id` or `/slides/2`), else null.
function slideIndicesOf(presentation, scene, keys) {
  const list = [...new Set(keys ?? [])];
  if (!list.length || !list.every((key) => typeof key === "string" && !key.includes("#") && parsePointer(key).length === 2 && parsePointer(key)[0] === "slides")) return null;
  return list.map((key) => {
    let pointer;
    try { pointer = resolveIdPointer(presentation, key); } catch { throw refuse("That slide no longer exists.", { key }); }
    const index = Number(parsePointer(pointer)[1]);
    if (!presentation.slides?.[index]) throw refuse("That slide no longer exists.", { key });
    return index;
  }).sort((a, b) => a - b);
}

/** Move the slides `keys` to the gap `to` of the original order (0 first, the slide count last), keeping their order. */
export function prepareSceneMoveSlides(presentation, scene, keys, to, options = {}) {
  const indices = slideIndicesOf(presentation, scene, keys);
  if (!indices) throw refuse("Select slides to move them.");
  const prepared = prepareMoveSlides(presentation, indices, to, options);
  return { ...prepared, paths: (prepared.selection ?? indices).map((index) => `/slides/${index}`), label: indices.length === 1 ? "Moved slide" : `Moved ${indices.length} slides` };
}

// --- clipboard ---------------------------------------------------------------------------------------------------------------------

/**
 * What the clipboard holds for `keys`: slide keys copy those slides as a self-contained deck (its catalog records embedded, so it pastes
 * into another deck too), anything else copies the sibling blocks (implicit content as blocks, without layout region pins).
 */
export function copyScene(presentation, scene, keys, options = {}) {
  const slideIndices = slideIndicesOf(presentation, scene, keys);
  if (slideIndices) {
    const document = prepareSave({ ...presentation, slides: slideIndices.map((index) => presentation.slides[index]) }, { catalogs: options.catalogs }).document;
    return { kind: "opf-studio-slides", presentation: document, count: slideIndices.length };
  }
  const sources = siblings(scene, keys, "copy");
  const blocks = sources.map((node) => {
    const value = node.kind === "implicit" ? { [node.field]: structuredClone(valueAt(presentation, node.path)) } : structuredClone(valueAt(presentation, node.path));
    delete value.region;
    return value;
  });
  return { kind: "opf-studio-blocks", blocks, count: blocks.length };
}

// Patches from `before` to `after` where `after` inserted `count` slides at `at`: each changed top-level key, then each slide.
function insertPatches(before, after, at, count) {
  const patches = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === "slides" || jsonEqual(before[key], after[key])) continue;
    patches.push(after[key] === undefined ? { op: "remove", path: formatPointer([key]) } : { op: Object.hasOwn(before, key) ? "replace" : "add", path: formatPointer([key]), value: after[key] });
  }
  for (let offset = 0; offset < count; offset += 1) patches.push({ op: "add", path: `/slides/${at + offset}`, value: after.slides[at + offset] });
  return jsonEqual(applyJsonPatch(before, patches), after) ? patches : [{ op: "replace", path: "", value: after }];
}

/**
 * Paste a clipboard from `copyScene`. Slides go after slide `options.slideIndex` (default the scene's slide), with catalog records,
 * assets and datasets brought along and renamed where they differ (the transfer import). Blocks go to `index` (default the end) of the
 * content children of the container `options.target` (default the slide; a layout region pins them to it), with fresh ids.
 */
export function prepareScenePaste(presentation, scene, clip, options = {}) {
  if (clip?.kind === "opf-studio-slides") {
    const after = options.slideIndex ?? scene.slideIndex;
    const imported = prepareOpfImport(presentation, { presentation: clip.presentation }, { mode: "insert", slideIndex: after, catalogs: options.catalogs });
    const count = imported.presentation.slides.length - presentation.slides.length;
    const patches = insertPatches(presentation, imported.presentation, after + 1, count);
    const next = validated(presentation, patches, options.catalogs);
    return { presentation: next, patches, changed: count > 0, paths: Array.from({ length: count }, (_, offset) => `/slides/${after + 1 + offset}`), label: count === 1 ? "Pasted slide" : `Pasted ${count} slides`, renamed: imported.renamed, addedGroups: imported.addedGroups };
  }
  if (clip?.kind !== "opf-studio-blocks" || !Array.isArray(clip.blocks) || !clip.blocks.length) throw refuse("There is nothing to paste.");
  const target = scene.node(options.target ?? scene.slideKey);
  if (!target || !["slide", "group", "region"].includes(target.kind)) throw refuse("Paste into the slide, a group or a region.");
  if (target.kind === "slide" && (target.container?.promoted || scene.layout)) throw refuse("Paste into one of the slide's regions.");
  const content = scene.contentChildren(target.key);
  const index = options.index ?? content.length;
  if (!Number.isInteger(index) || index < 0 || index > content.length) throw refuse("The paste place is out of range.", { index });
  const copies = structuredClone(clip.blocks);
  remapSlideTreeIds({ blocks: copies }, new Set(collectReservedPresentationIds(presentation)));
  let container = target.path, at = index;
  if (target.kind === "region" && target.virtual) {
    // A layout region: the copies become root blocks pinned to it, beside its other blocks.
    for (const copy of copies) copy.region = target.region;
    const members = content;
    container = scene.node(scene.slideKey).path;
    const blocks = valueAt(presentation, `${container}/blocks`);
    const rootIndex = (node) => (node.kind === "implicit" ? node.blockIndex : Number(parsePointer(node.path).at(-1)));
    at = members[index] ? rootIndex(members[index]) : members.length ? rootIndex(members.at(-1)) + 1 : Array.isArray(blocks) ? blocks.length : contentFieldsOf(valueAt(presentation, container)).length;
  } else for (const copy of copies) delete copy.region;
  let current = presentation;
  const patches = [];
  copies.forEach((copy, offset) => {
    const step = prepareBlockInsert(current, container, copy, at + offset);
    current = step.presentation;
    patches.push(...step.patches);
  });
  const next = validated(presentation, patches, options.catalogs);
  const paths = copies.map((_, offset) => `${container}/blocks/${at + offset}`);
  return { presentation: next, patches, changed: true, paths, label: copies.length === 1 ? "Pasted block" : `Pasted ${copies.length} blocks` };
}
