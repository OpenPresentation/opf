// Tree operations on an OPF layout record (RR-99): the record's `regions` list of regions and splits, edited as pure functions.
// Every operation takes a record and returns `{ record, selection }` (a new record; the input is never changed, and `selection` is
// the list of node paths to select afterwards) or throws a `LayoutOperationError` whose message says why the edit is refused.
// A node path is the list of indexes from the record's own list down: `[]` is the record, `[1, 0]` is `regions[1].regions[0]`.
// The operations keep a valid record valid: names stay unique, sizes stay legal (`auto` only in a column), a list stays within the
// depth and entry limits of core, and a split left with one child collapses into it. Geometry (`layoutBoxes`) places the same tree
// in a unit box for the canvas. No DOM, no network.
import { layoutTemplateIssues } from "@openpresentation/opf/composition";
import { LAYOUT_ANCHORS, LAYOUT_DIRECTIONS, LAYOUT_MAX_DEPTH, LAYOUT_MAX_ENTRIES, LAYOUT_REGION_KINDS } from "./layout-templates.js";

export class LayoutOperationError extends Error {
  constructor(message, code = "layout-operation") {
    super(message);
    this.name = "LayoutOperationError";
    this.code = code;
  }
}
const refuse = (message, code) => { throw new LayoutOperationError(message, code); };

export const HEADING_NAMES = Object.freeze(["title", "subtitle"]);
/** Rules a body region can carry, in the order the record writes them. */
export const REGION_KEYS = Object.freeze(["accepts", "role", "flow", "max", "bleed", "listColumns", "anchor", "empty"]);
const RECORD_ORDER = ["$schema", "id", "name", "summary", "direction", "anchor", "regions", "overflowRegion", "design", "composition"];
const OTHER = { row: "column", column: "row" };

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
export const isSplit = (entry) => isObject(entry) && entry.name === undefined;
export const isHeading = (entry) => isObject(entry) && HEADING_NAMES.includes(entry.name);
export const isRegion = (entry) => isObject(entry) && entry.name !== undefined;
export const clone = (value) => structuredClone(value);
export const samePath = (a, b) => a.length === b.length && a.every((part, index) => part === b[index]);
export const isPrefix = (prefix, path) => prefix.length <= path.length && prefix.every((part, index) => part === path[index]);
export const pathKey = (path) => path.join(".");
export const compareLength = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };

/** The entries of the record's list (`[]`) or of the split at `path`. */
export function listAt(record, path) {
  let list = record.regions;
  for (const index of path) {
    const entry = list?.[index];
    if (!isSplit(entry)) return undefined;
    list = entry.regions;
  }
  return Array.isArray(list) ? list : undefined;
}
/** The region or split at `path` (undefined for `[]` and for a path that leads nowhere). */
export function nodeAt(record, path) {
  if (!path.length) return undefined;
  return listAt(record, path.slice(0, -1))?.[path[path.length - 1]];
}
/** `row` or `column`: how the list that holds the node at `path` lays its entries out (the record's `direction` for a top-level node). */
export function parentDirection(record, path) {
  return listDirection(record, path.slice(0, -1));
}
/** How the list at `listPath` (`[]` is the record's own) lays its entries out. */
export function listDirection(record, listPath) {
  if (!listPath.length) return record.direction === "row" ? "row" : "column";
  const split = nodeAt(record, listPath);
  return split?.direction === "row" ? "row" : "column";
}
/** The list level of a list: the record's own list is level 1, a split's list level 2, and so on. */
export const listLevel = (listPath) => listPath.length + 1;
/** The levels a node adds below its own list: 0 for a region, 1 plus the deepest child for a split. */
export function height(entry) {
  if (!isSplit(entry)) return 0;
  return 1 + Math.max(0, ...(entry.regions ?? []).map(height));
}
/** Every node, depth first in reading order: `{ entry, path, listPath, index, depth }` (depth 1 is the record's own list). */
export function nodes(record) {
  const out = [];
  const walk = (list, listPath) => {
    (Array.isArray(list) ? list : []).forEach((entry, index) => {
      const path = [...listPath, index];
      out.push({ entry, path, listPath, index, depth: path.length });
      if (isSplit(entry)) walk(entry.regions, path);
    });
  };
  walk(record.regions, []);
  return out;
}
/** The names of the regions, headings included. */
export const regionNames = (record) => nodes(record).filter(({ entry }) => isRegion(entry)).map(({ entry }) => entry.name);
/** The path of the region called `name`, or undefined. */
export const pathOfName = (record, name) => nodes(record).find(({ entry }) => isRegion(entry) && entry.name === name)?.path;
export const hasHeading = (record, name) => regionNames(record).includes(name);

function freeName(record, taken = []) {
  const used = new Set([...regionNames(record), ...taken]);
  for (let n = 1; ; n++) if (!used.has(`region-${n}`)) return `region-${n}`;
}
function copyName(name, used) {
  const base = name.replace(/-\d+$/, "");
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** The size an entry has: its own, else `auto` for a heading in a column, else 1. */
export function effectiveSize(entry, direction) {
  if (entry.size !== undefined) return entry.size;
  return isHeading(entry) && direction === "column" ? "auto" : 1;
}
const writeSize = (entry, size, direction) => {
  if (typeof size === "number") size = Math.min(100, Math.max(0.01, size));
  const normal = isHeading(entry) ? effectiveSize({ name: entry.name }, direction) : 1;
  if (size === undefined || size === normal) delete entry.size; else entry.size = size;
};
/** Rewrite a key of an entry in the order a record writes them. */
export function orderEntry(entry) {
  const keys = isSplit(entry) ? ["direction", "size", "anchor", "regions"] : ["name", "size", ...REGION_KEYS];
  const out = {};
  for (const key of keys) if (entry[key] !== undefined) out[key] = entry[key];
  for (const key of Object.keys(entry)) if (!(key in out)) out[key] = entry[key];
  return out;
}
export function orderRecord(record) {
  const out = {};
  for (const key of RECORD_ORDER) if (record[key] !== undefined) out[key] = record[key];
  for (const key of Object.keys(record)) if (!(key in out)) out[key] = record[key];
  return out;
}
const replaceEntry = (list, index, entry) => { list[index] = orderEntry(entry); return list[index]; };
/** Put an entry's keys in record order without making a new object (so a reference to it stays good). */
function orderInPlace(entry) {
  const ordered = orderEntry(entry);
  for (const key of Object.keys(entry)) delete entry[key];
  return Object.assign(entry, ordered);
}

/** After an edit: `auto` is legal only in a column, so a list laid out as a row gives its entries a numeric size. */
function stripAutoInRows(record) {
  const walk = (list, direction) => {
    for (const entry of list ?? []) {
      if (direction === "row" && entry.size === "auto") delete entry.size;
      if (isSplit(entry)) walk(entry.regions, entry.direction === "row" ? "row" : "column");
    }
  };
  walk(record.regions, record.direction === "row" ? "row" : "column");
}
/**
 * An operation's result. With `before` (the record the edit started from) the result is also refused when it makes core's compile fail
 * where it did not, which is a grid of more than 12 rows or columns: a layout the engine could not draw.
 */
function result(record, selection, before) {
  if (before) {
    const known = new Set(layoutTemplateIssues(before).map((issue) => `${issue.code} ${issue.message}`));
    const fresh = layoutTemplateIssues(record).find((issue) => issue.code === "layout-template" && !known.has(`${issue.code} ${issue.message}`));
    if (fresh) refuse("That would compile to more than 12 rows or columns. Use fewer cuts.", "layout-tracks");
  }
  return { record, selection };
}
const countIn = (list) => Array.isArray(list) ? list.length : 0;

// --- anchor: written once on the record or a split, inherited by the regions under it -------------------------------------

/** The anchor a node inherits (never its own): `{ value, from }`, `from` being "split", "layout" or "default" (top, when nothing sets one). */
export function inheritedAnchor(record, path) {
  let value = record.anchor, from = value === undefined ? "default" : "layout";
  let list = record.regions;
  for (const index of path.slice(0, -1)) {
    const split = list?.[index];
    if (!isSplit(split)) break;
    if (split.anchor !== undefined) { value = split.anchor; from = "split"; }
    list = split.regions;
  }
  return { value, from };
}
function pushAnchor(split, children) {
  if (split.anchor === undefined) return;
  for (const child of children) if (!isHeading(child) && child.anchor === undefined) child.anchor = split.anchor;
}

// --- structure edits ------------------------------------------------------------------------------------------------------

/**
 * Split the region at `path` along `axis` ("row": two side by side, "column": two stacked). The original keeps its name and rules; the new
 * region is called `region-N`. In a list that already runs along `axis` the new region is a sibling that shares the original's size;
 * otherwise a split of `axis` holds both.
 */
export function splitRegion(record, path, axis) {
  if (!LAYOUT_DIRECTIONS.includes(axis)) refuse("Choose row or column.");
  const next = clone(record);
  const node = nodeAt(next, path);
  if (!node) refuse("Choose a region to split.");
  if (isSplit(node)) refuse("Choose a region to split, not a split. Select a region inside it.");
  const listPath = path.slice(0, -1), index = path[path.length - 1];
  const list = listAt(next, listPath), direction = listDirection(next, listPath);
  const fresh = { name: freeName(next) };
  if (direction === axis) {
    if (list.length >= LAYOUT_MAX_ENTRIES) refuse(`A list holds at most ${LAYOUT_MAX_ENTRIES} regions and splits.`, "layout-entries");
    const size = effectiveSize(node, direction);
    if (typeof size === "number") {
      const half = Math.max(0.01, Math.round(size / 2 * 1000) / 1000);
      writeSize(node, half, direction);
      fresh.size = half;
      if (fresh.size === 1) delete fresh.size;
      replaceEntry(list, index, node);
    }
    list.splice(index + 1, 0, orderEntry(fresh));
    return result(next, [[...listPath, index + 1]], record);
  }
  if (listLevel(listPath) + 1 > LAYOUT_MAX_DEPTH) refuse(`Regions nest at most ${LAYOUT_MAX_DEPTH} levels deep.`, "layout-depth");
  const size = effectiveSize(node, direction);
  const wrapper = { direction: axis, regions: [node, fresh] };
  if (size !== 1) wrapper.size = size;
  delete node.size;
  stripAutoInRows({ direction: axis, regions: wrapper.regions });
  list[index] = orderEntry({ ...wrapper, regions: wrapper.regions.map(orderEntry) });
  return result(next, [[...path, 1]], record);
}

/** Insert a new region called `region-N` into the list at `listPath`, before `index`. */
export function insertRegion(record, listPath, index, entry) {
  const next = clone(record);
  const list = listAt(next, listPath);
  if (!list) refuse("Choose a list to insert into.");
  if (list.length >= LAYOUT_MAX_ENTRIES) refuse(`A list holds at most ${LAYOUT_MAX_ENTRIES} regions and splits.`, "layout-entries");
  const at = Math.max(0, Math.min(index, list.length));
  list.splice(at, 0, orderEntry(entry ? clone(entry) : { name: freeName(next) }));
  return result(next, [[...listPath, at]], record);
}

/** Add or remove the `title` or `subtitle` heading region. Removing a title removes the subtitle too. */
export function toggleHeading(record, name) {
  if (!HEADING_NAMES.includes(name)) refuse("Choose title or subtitle.");
  const found = pathOfName(record, name);
  if (found) return deleteNodes(record, [found]);
  const next = clone(record);
  if (name === "subtitle" && !hasHeading(next, "title")) {
    const withTitle = toggleHeading(next, "title").record;
    return toggleHeading(withTitle, "subtitle");
  }
  if (name === "title") {
    if (next.direction !== "row") {
      next.regions.unshift({ name: "title" });
      if (next.regions.length > LAYOUT_MAX_ENTRIES) refuse(`A list holds at most ${LAYOUT_MAX_ENTRIES} regions and splits.`, "layout-entries");
      return result(next, [[0]], record);
    }
    // A row: the title goes on top of the whole row when the row's regions can sit one level lower, else it joins the row.
    if (next.regions.every((entry) => 2 + height(entry) <= LAYOUT_MAX_DEPTH)) {
      next.direction = "column";
      next.regions = [{ name: "title" }, { direction: "row", regions: next.regions }];
      return result(next, [[0]], record);
    }
    if (next.regions.length >= LAYOUT_MAX_ENTRIES) refuse(`A list holds at most ${LAYOUT_MAX_ENTRIES} regions and splits.`, "layout-entries");
    next.regions.unshift({ name: "title" });
    return result(next, [[0]], record);
  }
  const titlePath = pathOfName(next, "title");
  const list = listAt(next, titlePath.slice(0, -1));
  if (list.length >= LAYOUT_MAX_ENTRIES) refuse(`A list holds at most ${LAYOUT_MAX_ENTRIES} regions and splits.`, "layout-entries");
  const at = titlePath[titlePath.length - 1] + 1;
  list.splice(at, 0, { name: "subtitle" });
  return result(next, [[...titlePath.slice(0, -1), at]], record);
}

const sameParent = (paths) => paths.every((path) => samePath(path.slice(0, -1), paths[0].slice(0, -1)));
const sortedPaths = (paths) => [...paths].sort(compareLength);

/** Wrap the sibling nodes at `paths` in one new split of `axis`. */
export function wrapNodes(record, paths, axis) {
  if (!LAYOUT_DIRECTIONS.includes(axis)) refuse("Choose row or column.");
  if (!paths.length) refuse("Choose a region to wrap.");
  if (!sameParent(paths)) refuse("Only siblings in the same list can be wrapped together.");
  const next = clone(record);
  const ordered = sortedPaths(paths);
  const listPath = ordered[0].slice(0, -1), list = listAt(next, listPath), direction = listDirection(next, listPath);
  const entries = ordered.map((path) => nodeAt(next, path));
  if (entries.some((entry) => !entry)) refuse("Choose a region to wrap.");
  if (listLevel(listPath) + 1 + Math.max(...entries.map(height)) > LAYOUT_MAX_DEPTH) refuse(`Regions nest at most ${LAYOUT_MAX_DEPTH} levels deep.`, "layout-depth");
  const sizes = entries.map((entry) => effectiveSize(entry, direction));
  const numeric = sizes.filter((size) => typeof size === "number");
  const size = numeric.length ? Math.round(numeric.reduce((sum, value) => sum + value, 0) * 1000) / 1000 : "auto";
  const first = ordered[0][ordered[0].length - 1];
  const wrapper = { direction: axis, regions: entries.map((entry) => { const copy = clone(entry); if (axis !== direction) delete copy.size; return orderEntry(copy); }) };
  if (size !== 1) wrapper.size = size;
  stripAutoInRows({ direction: axis, regions: wrapper.regions });
  for (const path of [...ordered].reverse()) list.splice(path[path.length - 1], 1);
  list.splice(first, 0, orderEntry(wrapper));
  return result(next, [[...listPath, first]], record);
}

/** Replace the split at `path` with its children, which keep their share of the split's length. */
export function unwrapNode(record, path) {
  const next = clone(record);
  const split = nodeAt(next, path);
  if (!split) refuse("Choose a split to unwrap.");
  if (!isSplit(split)) refuse("Only a split can be unwrapped.");
  const listPath = path.slice(0, -1), index = path[path.length - 1];
  const list = listAt(next, listPath), direction = listDirection(next, listPath);
  const children = split.regions ?? [];
  if (list.length - 1 + children.length > LAYOUT_MAX_ENTRIES) refuse(`A list holds at most ${LAYOUT_MAX_ENTRIES} regions and splits.`, "layout-entries");
  const own = effectiveSize(split, direction), inner = split.direction === "row" ? "row" : "column";
  const childSizes = children.map((child) => effectiveSize(child, inner));
  const total = childSizes.filter((size) => typeof size === "number").reduce((sum, value) => sum + value, 0);
  if (typeof own === "number" && total > 0) {
    const factor = own / total;
    children.forEach((child, at) => { if (typeof childSizes[at] === "number") writeSize(child, Math.round(childSizes[at] * factor * 1000) / 1000, direction); });
  } else if (own === "auto" && children.length === 1) writeSize(children[0], "auto", direction);
  pushAnchor(split, children);
  list.splice(index, 1, ...children.map(orderEntry));
  stripAutoInRows(next);
  return result(next, children.map((_, at) => [...listPath, index + at]), record);
}

/** Where the node `target` is, as `{ list, index, listPath }` (searching by identity). */
function locate(record, target) {
  const walk = (list, listPath) => {
    for (let index = 0; index < list.length; index++) {
      if (list[index] === target) return { list, index, listPath };
      if (isSplit(list[index])) { const found = walk(list[index].regions ?? [], [...listPath, index]); if (found) return found; }
    }
    return undefined;
  };
  return walk(record.regions, []);
}
const pathOf = (record, target) => { const found = locate(record, target); return found ? [...found.listPath, found.index] : undefined; };

/**
 * Remove an emptied split, and collapse a split left with one child into that child (which takes the split's size and the anchor it
 * passed down). `exempt` is a list that must stay as it is (the list being inserted into).
 */
function tidy(record, split, exempt) {
  const found = locate(record, split);
  if (!found || split === exempt) return;
  const children = split.regions ?? [];
  if (children.length === 0) {
    found.list.splice(found.index, 1);
    const parent = found.listPath.length ? nodeAt(record, found.listPath) : undefined;
    if (parent) tidy(record, parent, exempt);
    return;
  }
  if (children.length === 1) {
    const only = children[0];
    pushAnchor(split, [only]);
    writeSize(only, effectiveSize(split, listDirection(record, found.listPath)), listDirection(record, found.listPath));
    found.list[found.index] = orderInPlace(only);
    stripAutoInRows(record);
  }
}

/** Remove the nodes at `paths`. A split left with one child collapses into it; deleting a title removes the subtitle too. */
export function deleteNodes(record, paths) {
  if (!paths.length) refuse("Choose a region to delete.");
  const next = clone(record);
  const targets = sortedPaths(paths).map((path) => nodeAt(next, path));
  if (targets.some((entry) => !entry)) refuse("Choose a region to delete.");
  const doomed = new Set(targets);
  if (targets.some((entry) => nameSet(entry).includes("title"))) for (const { entry } of nodes(next)) if (entry.name === "subtitle") doomed.add(entry);
  // A list keeps at least one entry at the top level.
  const remaining = next.regions.filter((entry) => !doomed.has(entry));
  if (!remaining.length) refuse("A layout keeps at least one region.", "layout-empty");
  const parents = new Set();
  let last;
  for (const entry of doomed) {
    const found = locate(next, entry);
    if (!found) continue;
    const parent = found.listPath.length ? nodeAt(next, found.listPath) : undefined;
    if (parent) parents.add(parent);
    found.list.splice(found.index, 1);
    if (!last || compareLength([...found.listPath, found.index], last.at) > 0) last = { list: found.list, index: found.index, at: [...found.listPath, found.index], parent };
  }
  // What takes the place of the last node removed (its next sibling, else the one before, else its split) is selected afterwards.
  const neighbor = last && (last.list[last.index] ?? last.list[last.index - 1] ?? last.parent);
  for (const parent of parents) tidy(next, parent);
  if (!next.regions.length) refuse("A layout keeps at least one region.", "layout-empty");
  const doomedNames = new Set([...doomed].flatMap((entry) => nameSet(entry)));
  if (doomedNames.has(next.overflowRegion)) delete next.overflowRegion;
  stripAutoInRows(next);
  const at = neighbor ? pathOf(next, neighbor) : undefined;
  return result(next, at ? [at] : []);
}
function nameSet(entry) {
  if (isSplit(entry)) return (entry.regions ?? []).flatMap(nameSet);
  return [entry.name];
}

/** Copy the nodes at `paths` next to the originals. Names get `-2`, `-3`; heading regions are unique and cannot be copied. */
export function duplicateNodes(record, paths) {
  if (!paths.length) refuse("Choose a region to duplicate.");
  const next = clone(record);
  const ordered = sortedPaths(paths);
  const originals = ordered.map((path) => nodeAt(next, path));
  if (originals.some((entry) => !entry)) refuse("Choose a region to duplicate.");
  const used = new Set(regionNames(next));
  const copies = originals.map((entry) => {
    const copy = clone(entry);
    const rename = (node) => {
      if (isSplit(node)) { for (const child of node.regions ?? []) rename(child); return; }
      if (isHeading(node)) refuse("The title and subtitle regions are unique, so they cannot be duplicated.");
      node.name = copyName(node.name, used);
      used.add(node.name);
    };
    rename(copy);
    return copy;
  });
  const touched = new Map();
  for (const entry of originals) { const found = locate(next, entry); touched.set(found.list, (touched.get(found.list) ?? 0) + 1); }
  for (const [list, count] of touched) if (list.length + count > LAYOUT_MAX_ENTRIES) refuse(`A list holds at most ${LAYOUT_MAX_ENTRIES} regions and splits.`, "layout-entries");
  const selection = [];
  // Insert from the last to the first so earlier indexes stay valid.
  for (let at = originals.length - 1; at >= 0; at--) {
    const found = locate(next, originals[at]);
    found.list.splice(found.index + 1, 0, copies[at]);
  }
  for (const copy of copies) selection.push(pathOf(next, copy));
  return result(next, selection, record);
}

/** Move the nodes at `paths` into the list at `targetListPath` (`[]` is the record's), to position `index` of that list. */
export function moveNodes(record, paths, targetListPath, index) {
  if (!paths.length) refuse("Choose a region to move.");
  const next = clone(record);
  const ordered = sortedPaths(paths);
  const moved = ordered.map((path) => nodeAt(next, path));
  if (moved.some((entry) => !entry)) refuse("Choose a region to move.");
  const target = listAt(next, targetListPath);
  if (!target) refuse("Choose a list to move into.");
  if (paths.some((path) => isPrefix(path, targetListPath))) refuse("A split cannot move into itself.");
  const level = listLevel(targetListPath);
  if (moved.some((entry) => level + height(entry) > LAYOUT_MAX_DEPTH)) refuse(`Regions nest at most ${LAYOUT_MAX_DEPTH} levels deep.`, "layout-depth");
  const targetSplit = targetListPath.length ? nodeAt(next, targetListPath) : undefined;
  const incoming = moved.filter((entry) => !target.includes(entry)).length;
  if (target.length + incoming > LAYOUT_MAX_ENTRIES) refuse(`A list holds at most ${LAYOUT_MAX_ENTRIES} regions and splits.`, "layout-entries");
  // Where the entries come from, so emptied splits can be tidied afterwards.
  const parents = new Set();
  let before = 0;
  for (const entry of moved) {
    const found = locate(next, entry);
    if (found.list === target && found.index < index) before++;
    if (found.listPath.length) parents.add(nodeAt(next, found.listPath));
    found.list.splice(found.index, 1);
  }
  const at = Math.max(0, Math.min(index - before, target.length));
  target.splice(at, 0, ...moved);
  for (const parent of parents) tidy(next, parent, targetSplit);
  stripAutoInRows(next);
  const selection = moved.map((entry) => pathOf(next, entry)).filter(Boolean);
  const same = JSON.stringify(next) === JSON.stringify(record);
  return same ? result(record, paths) : result(next, selection, record);
}

/**
 * Move a node one place earlier (`delta` -1) or later (+1) among its siblings. At the end of a list inside a split it leaves the split,
 * landing just before or after it.
 */
export function reorderNode(record, path, delta) {
  const listPath = path.slice(0, -1), index = path[path.length - 1];
  const list = listAt(record, listPath);
  if (!list || !list[index]) refuse("Choose a region to move.");
  const to = index + delta;
  if (to >= 0 && to < list.length) return moveNodes(record, [path], listPath, delta > 0 ? to + 1 : to);
  if (!listPath.length) refuse(delta < 0 ? "Already first." : "Already last.", "layout-edge");
  const outer = listPath.slice(0, -1), at = listPath[listPath.length - 1];
  return moveNodes(record, [path], outer, delta < 0 ? at : at + 1);
}

/** Move a node into the split that is its next (`delta` +1) or previous (-1) sibling: to the start of its list, or the end. */
export function moveIntoSibling(record, path, delta) {
  const listPath = path.slice(0, -1), index = path[path.length - 1];
  const list = listAt(record, listPath);
  const sibling = list?.[index + delta];
  if (!sibling) refuse(delta < 0 ? "Already first." : "Already last.", "layout-edge");
  if (!isSplit(sibling)) refuse("The next sibling is not a split.");
  const siblingPath = [...listPath, index + delta];
  return moveNodes(record, [path], siblingPath, delta > 0 ? 0 : countIn(sibling.regions));
}

// --- properties ------------------------------------------------------------------------------------------------------------

const REGION_ENUMS = {
  role: ["primary", "secondary", "media", "supporting"],
  flow: ["none", "grid", "column", "auto"],
  anchor: LAYOUT_ANCHORS,
  empty: ["collapse", "keep"],
  listColumns: ["auto", 1],
};
export const parseSize = (value) => {
  if (value === "auto") return "auto";
  const number = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(number) && number > 0 && number <= 100 ? Math.round(number * 1000) / 1000 : undefined;
};

/**
 * Set (or with `undefined`, remove) one property of the region or split at `path`: `name`, `size`, `direction` (a split), `anchor`, or a
 * region rule (`accepts`, `role`, `flow`, `max`, `bleed`, `listColumns`, `empty`). A value that is not allowed is refused.
 */
export function setProperty(record, path, key, value) {
  const next = clone(record);
  const node = nodeAt(next, path);
  if (!node) refuse("Choose a region or split.");
  const direction = parentDirection(next, path);
  const split = isSplit(node);
  if (key === "name") {
    if (split) refuse("A split has no name.");
    if (typeof value !== "string") refuse("A region name is text.");
    if (isHeading(node) && value !== node.name) refuse("The title and subtitle regions keep their names. Remove the region to drop the heading.");
    if (HEADING_NAMES.includes(value) && value !== node.name) refuse("Use the heading tool to add a title or subtitle region.");
    const old = node.name;
    node.name = value;
    if (next.overflowRegion === old) next.overflowRegion = value;
  } else if (key === "size") {
    if (value === undefined) delete node.size;
    else if (value === "auto") {
      if (direction !== "column") refuse("Auto is available only in a column.", "layout-auto");
      node.size = "auto";
    } else {
      const size = parseSize(value);
      if (size === undefined) refuse("A size is a number above 0 and up to 100, or auto.", "layout-size");
      writeSize(node, size, direction);
    }
  } else if (key === "direction") {
    if (!split) refuse("Only a split has a direction.");
    if (!LAYOUT_DIRECTIONS.includes(value)) refuse("Choose row or column.");
    node.direction = value;
  } else if (key === "anchor") {
    if (isHeading(node)) refuse("A heading region does not take an anchor.");
    if (value !== undefined && !LAYOUT_ANCHORS.includes(value)) refuse("Choose top, middle or bottom.");
    if (value === undefined) delete node.anchor; else node.anchor = value;
  } else if (split || isHeading(node)) {
    refuse(split ? "A split has a direction, a size and an anchor." : `${node.name} is a heading region and takes only a size.`);
  } else if (key === "accepts") {
    const kinds = LAYOUT_REGION_KINDS.filter((kind) => (value ?? []).includes(kind));
    if (kinds.length) node.accepts = kinds; else delete node.accepts;
  } else if (key === "max") {
    if (value === undefined || value === "") delete node.max;
    else {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 || number > 12) refuse("The most blocks a region holds is a whole number from 1 to 12.");
      node.max = number;
    }
  } else if (key === "bleed") {
    if (value) node.bleed = true; else delete node.bleed;
  } else if (REGION_ENUMS[key]) {
    if (value === undefined) delete node[key];
    else if (!REGION_ENUMS[key].includes(value)) refuse(`Choose a valid ${key}.`);
    else node[key] = value;
  } else refuse(`${key} is not an editable property.`);
  if (key === "direction" && value === "row") stripAutoInRows(next);
  const holder = listAt(next, path.slice(0, -1));
  replaceEntry(holder, path[path.length - 1], node);
  return result(next, [path], key === "direction" ? record : undefined);
}

/** Set (or with `undefined`, remove) a property of the record itself: `id`, `name`, `summary`, `direction`, `anchor`, `overflowRegion`. */
export function setLayoutProperty(record, key, value) {
  const next = clone(record);
  if (key === "direction") {
    if (!LAYOUT_DIRECTIONS.includes(value)) refuse("Choose row or column.");
    next.direction = value;
    if (value === "row") stripAutoInRows(next);
  } else if (key === "anchor") {
    if (value !== undefined && !LAYOUT_ANCHORS.includes(value)) refuse("Choose top, middle or bottom.");
    if (value === undefined) delete next.anchor; else next.anchor = value;
  } else if (key === "id" || key === "name" || key === "summary" || key === "overflowRegion") {
    if (value === undefined || value === "") { if (key === "id" || key === "name") next[key] = ""; else delete next[key]; } else next[key] = String(value);
  } else if (key === "design") {
    if (value === undefined) delete next.design; else next.design = clone(value);
  } else refuse(`${key} is not an editable property of the layout.`);
  return result(orderRecord(next), null, key === "direction" ? record : undefined);
}

/** Remove one design hint (`design.<key>`) from the record. */
export function removeDesignHint(record, key) {
  const next = clone(record);
  if (isObject(next.design)) { delete next.design[key]; if (!Object.keys(next.design).length) delete next.design; }
  return result(next, null);
}

// --- resizing --------------------------------------------------------------------------------------------------------------

const round3 = (value) => Math.round(value * 1000) / 1000;
/** The whole-number ratio p : q with p + q at most 12 that is nearest the fraction `f` (the smallest total wins a tie). */
function niceRatio(f) {
  let best = { p: 1, q: 1, error: Infinity };
  for (let total = 2; total <= 12; total++) for (let p = 1; p < total; p++) {
    const error = Math.abs(p / total - f);
    if (error < best.error - 1e-9) best = { p, q: total - p, error };
  }
  return best;
}
const trim = (value) => String(round3(value));
export const ratioLabel = (a, b) => `${trim(a)} : ${trim(b)}`;

/**
 * The sizes siblings `index` and `index + 1` of the list at `listPath` take when the divider between them sits at `fraction` (0 to 1) of
 * their joint length. With other siblings the pair keeps its joint size and snaps to whole numbers and halves; alone in the list it
 * snaps to the nearest whole-number ratio (1 : 1, 2 : 1, 3 : 2 ...). `free` (Shift) skips snapping. Returns null for a pair that has
 * an `auto` side, which is not a share.
 */
export function resizeSizes(record, listPath, index, fraction, { free = false } = {}) {
  const list = listAt(record, listPath);
  const direction = listDirection(record, listPath);
  if (!list?.[index] || !list[index + 1]) return null;
  const a = effectiveSize(list[index], direction), b = effectiveSize(list[index + 1], direction);
  if (typeof a !== "number" || typeof b !== "number") return null;
  const others = list.reduce((sum, entry, at) => { if (at === index || at === index + 1) return sum; const size = effectiveSize(entry, direction); return sum + (typeof size === "number" ? size : 0); }, 0);
  const f = Math.max(0, Math.min(1, fraction));
  const total = a + b;
  if (others > 0) {
    const step = 0.5;
    if (free) { const first = Math.max(0.01, Math.min(total - 0.01, round3(f * total))); return { a: first, b: round3(total - first), label: ratioLabel(first, round3(total - first)) }; }
    if (total < 2 * step) return { a, b, label: ratioLabel(a, b) };
    const first = Math.max(step, Math.min(total - step, Math.round(f * total / step) * step));
    return { a: round3(first), b: round3(total - first), label: ratioLabel(first, total - first) };
  }
  if (free) { const first = Math.max(0.01, Math.min(0.99, round3(f))); return { a: first, b: round3(1 - first), label: ratioLabel(first, 1 - first) }; }
  const { p, q } = niceRatio(f);
  return { a: p, b: q, label: ratioLabel(p, q) };
}

/** Give siblings `index` and `index + 1` those sizes (a size of 1 in a body region is left out, as a record writes it). */
export function setPairSizes(record, listPath, index, a, b) {
  const next = clone(record);
  const list = listAt(next, listPath);
  const direction = listDirection(next, listPath);
  if (!list?.[index] || !list[index + 1]) refuse("Choose two siblings to resize.");
  writeSize(list[index], round3(a), direction);
  writeSize(list[index + 1], round3(b), direction);
  list[index] = orderEntry(list[index]);
  list[index + 1] = orderEntry(list[index + 1]);
  return result(next, null);
}

/** Make siblings `index` and `index + 1` equal. With other siblings they keep their joint size; alone they become 1 : 1. */
export function equalizePair(record, listPath, index) {
  const list = listAt(record, listPath);
  const direction = listDirection(record, listPath);
  if (!list?.[index] || !list[index + 1]) refuse("Choose two siblings to resize.");
  const a = effectiveSize(list[index], direction), b = effectiveSize(list[index + 1], direction);
  if (typeof a !== "number" || typeof b !== "number") refuse("A pair with an auto size has no ratio to equalize.", "layout-auto");
  const others = list.some((entry, at) => at !== index && at !== index + 1 && typeof effectiveSize(entry, direction) === "number");
  const half = others ? round3((a + b) / 2) : 1;
  return setPairSizes(record, listPath, index, half, half);
}

/** The step a divider takes with an arrow key: `step` of the pair's joint size (0.5 or 1), keeping the sum. */
export function nudgePair(record, listPath, index, steps, big = false) {
  const list = listAt(record, listPath);
  const direction = listDirection(record, listPath);
  if (!list?.[index] || !list[index + 1]) refuse("Choose two siblings to resize.");
  const a = effectiveSize(list[index], direction), b = effectiveSize(list[index + 1], direction);
  if (typeof a !== "number" || typeof b !== "number") refuse("A pair with an auto size cannot be resized.", "layout-auto");
  const step = big ? 1 : 0.5;
  const first = Math.max(step, Math.min(a + b - step, round3(a + steps * step)));
  return setPairSizes(record, listPath, index, first, round3(a + b - first));
}

// --- geometry --------------------------------------------------------------------------------------------------------------

const AUTO_SHARE = 0.18;
const IMPLICIT_TITLE = 0.14;
/**
 * Place the tree in a unit box. Returns `nodes` (a box per region and split, in reading order), `dividers` (the gap between two
 * siblings, with the sizes it moves), `slots` (the places a region can be inserted) and `implicitTitle` (the top band the engine adds when
 * there is no title region). `aspect` is the box's width over its height; `gap` is the gap as a fraction of its width (the defaults are
 * the engine's content box and gap on a 1280 x 720 slide). An `auto` size
 * takes a fixed share, since the real height depends on the content.
 */
export function layoutBoxes(record, { aspect = 1164.8 / 604.8, gap = 24 / 1164.8, autoShare = AUTO_SHARE } = {}) {
  const out = { nodes: [], dividers: [], slots: [], implicitTitle: null };
  const gx = gap, gy = gap * aspect;
  let root = { x: 0, y: 0, w: 1, h: 1 };
  if (!hasHeading(record, "title")) {
    out.implicitTitle = { x: 0, y: 0, w: 1, h: IMPLICIT_TITLE };
    root = { x: 0, y: IMPLICIT_TITLE + gy, w: 1, h: 1 - IMPLICIT_TITLE - gy };
  }
  const place = (list, listPath, direction, box) => {
    const entries = Array.isArray(list) ? list : [];
    const row = direction === "row";
    const length = row ? box.w : box.h, gutter = row ? gx : gy;
    const available = Math.max(0, length - gutter * (entries.length - 1));
    const sizes = entries.map((entry) => { const size = effectiveSize(entry, direction); return size === "auto" && row ? 1 : size; });
    const autos = sizes.filter((size) => size === "auto").length;
    const totalNumeric = sizes.reduce((sum, size) => sum + (typeof size === "number" ? size : 0), 0);
    const autoLength = autos ? (totalNumeric > 0 ? Math.min(autoShare * length, available * 0.5 / autos) : available / autos) : 0;
    const share = available - autoLength * autos;
    let cursor = row ? box.x : box.y;
    const boxes = entries.map((entry, index) => {
      const size = sizes[index];
      const span = size === "auto" ? autoLength : totalNumeric > 0 ? share * size / totalNumeric : 0;
      const placed = row ? { x: cursor, y: box.y, w: span, h: box.h } : { x: box.x, y: cursor, w: box.w, h: span };
      cursor += span + gutter;
      return placed;
    });
    // Slots: before the first entry, in each gap, and after the last.
    for (let at = 0; at <= entries.length; at++) {
      const edge = at === 0 ? (row ? box.x : box.y) : at === entries.length ? (row ? box.x + box.w : box.y + box.h) : (row ? boxes[at - 1].x + boxes[at - 1].w + gutter / 2 : boxes[at - 1].y + boxes[at - 1].h + gutter / 2);
      out.slots.push({ listPath, index: at, direction, ...(row ? { x: edge, y: box.y, w: 0, h: box.h } : { x: box.x, y: edge, w: box.w, h: 0 }), depth: listPath.length + 1 });
    }
    entries.forEach((entry, index) => {
      const path = [...listPath, index];
      const placed = boxes[index];
      out.nodes.push({ path, entry, kind: isSplit(entry) ? "split" : "region", ...placed, depth: path.length, direction });
      if (index < entries.length - 1) {
        const next = boxes[index + 1];
        const divider = row ? { x: placed.x + placed.w, y: box.y, w: next.x - placed.x - placed.w, h: box.h } : { x: box.x, y: placed.y + placed.h, w: box.w, h: next.y - placed.y - placed.h };
        const pair = [sizes[index], sizes[index + 1]];
        out.dividers.push({ listPath, index, direction, ...divider, draggable: pair.every((size) => typeof size === "number"), depth: path.length, pairStart: row ? placed.x : placed.y, pairLength: row ? next.x + next.w - placed.x : next.y + next.h - placed.y, a: sizes[index], b: sizes[index + 1] });
      }
      if (isSplit(entry)) place(entry.regions, path, entry.direction === "row" ? "row" : "column", placed);
    });
  };
  place(record.regions, [], record.direction === "row" ? "row" : "column", root);
  return out;
}
