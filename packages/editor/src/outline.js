// Outline model and edits (RR-21). The outline is the deck as text: one row per slide title, with the slide's text, bullets and
// subtitle beneath it and a read-only chip for content that is not text (a chart, a table, an image). Every edit is one validated
// patch and one undo step, like the slide operations in `slides.js`.
//
// Rows. `readOutline` returns `{ rows }`. A row is `{ key, kind, slideIndex, level, text, path, editable, ... }`:
//   slide     the slide title (`path` is `slides.N.title`; a slide with no title still has a row)
//   subtitle  the slide subtitle
//   text      a text payload that is a plain string
//   item      one list item or bullet; `listPath` and `itemIndex` locate it and `level` is 1 plus its nesting level
//   other     content that is not text, shown by its kind (`label`), never edited here
// Text that carries formatting (a run array) is shown flattened and is not editable in the outline, so nothing is flattened away.
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath, validateOpfDocument } from "./index.js";
import { checkedDocument, fail } from "./edit-helpers.js";
import { visitContentPayloads } from "./presentation-ids.js";
import { prepareAddSlide, prepareMoveSlidesBy } from "./slides.js";

const clone = (value) => structuredClone(value);
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const OTHER_LABELS = { image: "Image", video: "Video", chart: "Chart", table: "Table", code: "Code", metric: "Metric", quote: "Quote", timeline: "Timeline" };
const LIST_KEYS = ["items", "bullets"];

const flatten = (value) => (typeof value === "string" ? value : Array.isArray(value) ? value.map((run) => (typeof run === "string" ? run : (run?.text ?? ""))).join("") : "");
/** The text, level and editability of one list item or bullet. */
function itemParts(item) {
  if (isObject(item)) return { text: flatten(item.text), level: Number.isInteger(item.level) ? item.level : 0, plain: typeof item.text === "string", object: true };
  return { text: flatten(item), level: 0, plain: typeof item === "string", object: false };
}
const itemTextPath = (listPath, index, item) => (isObject(item) ? `${listPath}.${index}.text` : `${listPath}.${index}`);

function walkPayload(node, path, slideIndex, rows) {
  for (const key of LIST_KEYS) {
    if (!Array.isArray(node[key])) continue;
    const listPath = `${path}.${key}`;
    node[key].forEach((item, itemIndex) => {
      const parts = itemParts(item);
      rows.push({ key: `item:${listPath}.${itemIndex}`, kind: "item", slideIndex, level: 1 + parts.level, text: parts.text, path: itemTextPath(listPath, itemIndex, item), listPath, itemIndex, editable: parts.plain });
    });
  }
  if (node.text !== undefined && (typeof node.text === "string" || Array.isArray(node.text)))
    rows.push({ key: `text:${path}.text`, kind: "text", slideIndex, level: 1, text: flatten(node.text), path: `${path}.text`, editable: typeof node.text === "string" });
  for (const [field, label] of Object.entries(OTHER_LABELS))
    if (node[field] !== undefined) rows.push({ key: `other:${path}.${field}`, kind: "other", slideIndex, level: 1, text: "", path: `${path}.${field}`, label, editable: false });
}

/**
 * Read the deck as outline rows (see the file header). `rows` follow document order: for each slide its title, subtitle, the
 * slide's own text and list, then every block and region in order.
 */
export function readOutline(document) {
  if (!document || !Array.isArray(document.slides)) throw fail("invalid-input", "The outline needs an OPF document with a slides array.");
  const rows = [];
  document.slides.forEach((slide, slideIndex) => {
    const base = `slides.${slideIndex}`;
    // FA-10: a title or subtitle may be TextRun[]: the row shows its plain text and is edited as runs elsewhere (a text row writes a string).
    const title = flatten(slide?.title);
    rows.push({ key: `slide:${base}`, kind: "slide", slideIndex, level: 0, text: title, path: `${base}.title`, editable: slide?.title === undefined || typeof slide.title === "string", hidden: slide?.hidden === true, section: typeof slide?.section === "string" ? slide.section : undefined, id: slide?.id });
    if (typeof slide?.subtitle === "string" || Array.isArray(slide?.subtitle)) rows.push({ key: `subtitle:${base}.subtitle`, kind: "subtitle", slideIndex, level: 1, text: flatten(slide.subtitle), path: `${base}.subtitle`, editable: typeof slide.subtitle === "string" });
    if (!isObject(slide)) return;
    walkPayload(slide, base, slideIndex, rows);
    visitContentPayloads(slide, base, (payload, path) => walkPayload(payload, path, slideIndex, rows));
  });
  return { rows };
}

// --- text ------------------------------------------------------------------------------------------

/** Compute editing the text of a row (a title, subtitle, text paragraph or list item); a row that is not plain text throws. */
export function prepareSetOutlineText(document, row, text) {
  if (!row?.editable) throw fail("outline-row-not-editable", "This text carries formatting or is not text. Edit it on the slide.", { path: row?.path });
  const value = String(text);
  const current = getValueAtPath(document, splitOpfPath(row.path));
  if (current === value || (current === undefined && value === "")) return { document: clone(document), patches: [], changed: false, selection: [row.slideIndex] };
  const pointer = opfPathToJsonPointer(row.path);
  const patches = [{ op: current === undefined ? "add" : "replace", path: pointer, value }];
  return finish(document, patches, { action: "outline-text", selection: [row.slideIndex] });
}
export function setOutlineText(editor, row, text, meta) {
  return apply(editor, prepareSetOutlineText(editor.document, row, text), meta, "outline-text");
}

// --- list levels -----------------------------------------------------------------------------------

function listAt(document, row) {
  const list = getValueAtPath(document, splitOpfPath(row.listPath));
  if (!Array.isArray(list) || list[row.itemIndex] === undefined) throw fail("outline-row-not-found", "That list item is no longer there.", { path: row.listPath });
  return list;
}
/** Write a nesting level on an item, collapsing back to the plain string form at level 0 when nothing else is carried. */
function withLevel(item, level) {
  if (!isObject(item)) return level > 0 ? { text: item, level } : item;
  const next = { ...item };
  if (level > 0) next.level = level;
  else delete next.level;
  return Object.keys(next).length === 1 && typeof next.text === "string" ? next.text : next;
}
/** The index just after the item at `index` and everything nested beneath it. */
function blockEnd(levels, index) {
  let end = index + 1;
  while (end < levels.length && levels[end] > levels[index]) end += 1;
  return end;
}

/**
 * Compute nesting a list item in (`delta` 1) or out (`delta` -1). Items nested beneath it move with it. A level is at most one more
 * than the item above, and the first item cannot be nested. Un-nesting an item that is already at the top level is
 * `prepareOutlinePromote`'s job (it becomes a slide); here it reports `changed: false` with a `reason`.
 */
export function prepareShiftOutlineItem(document, row, delta) {
  const list = listAt(document, row);
  const levels = list.map((item) => itemParts(item).level);
  const index = row.itemIndex;
  const none = (reason) => ({ document: clone(document), patches: [], changed: false, reason, selection: [row.slideIndex] });
  if (delta > 0 && (index === 0 || levels[index] > levels[index - 1])) return none(index === 0 ? "The first item cannot be nested." : "This item is already one level in from the item above.");
  if (delta < 0 && levels[index] === 0) return none("This item is already at the top level.");
  const end = blockEnd(levels, index);
  const next = list.map((item, at) => (at >= index && at < end ? withLevel(item, Math.max(0, levels[at] + delta)) : item));
  const patches = [{ op: "replace", path: opfPathToJsonPointer(row.listPath), value: next }];
  return finish(document, patches, { action: delta > 0 ? "outline-demote" : "outline-promote", selection: [row.slideIndex], focus: `item:${row.listPath}.${index}` });
}

// --- item order ------------------------------------------------------------------------------------

/**
 * Compute moving a list item (with the items nested under it) one place up (`delta` -1) or down (1) among the items at its level
 * and under the same parent. At the first or last place nothing changes (`changed` is false).
 */
export function prepareMoveOutlineItem(document, row, delta) {
  const list = listAt(document, row);
  const levels = list.map((item) => itemParts(item).level);
  const index = row.itemIndex, end = blockEnd(levels, index);
  const none = { document: clone(document), patches: [], changed: false, selection: [row.slideIndex] };
  let order, focusIndex;
  if (delta < 0) {
    // The previous sibling starts at the nearest earlier item on the same level, provided no shallower item lies between.
    let at = index - 1;
    while (at >= 0 && levels[at] > levels[index]) at -= 1;
    if (at < 0 || levels[at] !== levels[index]) return none;
    order = [...list.slice(0, at), ...list.slice(index, end), ...list.slice(at, index), ...list.slice(end)];
    focusIndex = at;
  } else {
    if (end >= list.length || levels[end] !== levels[index]) return none;
    const siblingEnd = blockEnd(levels, end);
    order = [...list.slice(0, index), ...list.slice(end, siblingEnd), ...list.slice(index, end), ...list.slice(siblingEnd)];
    focusIndex = index + (siblingEnd - end);
  }
  const patches = [{ op: "replace", path: opfPathToJsonPointer(row.listPath), value: order }];
  return finish(document, patches, { action: "outline-move", selection: [row.slideIndex], focus: `item:${row.listPath}.${focusIndex}` });
}

// --- insert and delete -----------------------------------------------------------------------------

/** Compute adding an empty list item right after the item at `row` and everything nested under it, at the same level. */
export function prepareInsertOutlineItem(document, row, text = "") {
  const list = listAt(document, row);
  const levels = list.map((item) => itemParts(item).level);
  const end = blockEnd(levels, row.itemIndex);
  const item = levels[row.itemIndex] > 0 ? { text, level: levels[row.itemIndex] } : text;
  return finish(document, [{ op: "add", path: `${opfPathToJsonPointer(row.listPath)}/${end}`, value: item }], { action: "outline-insert", selection: [row.slideIndex], focus: `item:${row.listPath}.${end}` });
}
/** Compute adding the first bullet under a slide: it goes in the slide's own list, or creates one. */
export function prepareAddOutlineBullet(document, slideIndex, text = "") {
  const slide = document.slides?.[slideIndex];
  if (!isObject(slide)) throw fail("slide-index-out-of-range", `Slide ${slideIndex} does not exist.`, { slideIndex });
  const key = LIST_KEYS.find((candidate) => Array.isArray(slide[candidate]));
  const base = `/slides/${slideIndex}`;
  if (key) return finish(document, [{ op: "add", path: `${base}/${key}/${slide[key].length}`, value: text }], { action: "outline-insert", selection: [slideIndex], focus: `item:slides.${slideIndex}.${key}.${slide[key].length}` });
  if (Array.isArray(slide.blocks) || slide.type !== undefined) throw fail("outline-row-not-supported", "Add a list to this slide from the Content panel; its content is arranged in blocks.", { slideIndex });
  return finish(document, [{ op: "add", path: `${base}/items`, value: [text] }], { action: "outline-insert", selection: [slideIndex], focus: `item:slides.${slideIndex}.items.0` });
}
/** Compute deleting a list item together with the items nested under it. */
export function prepareRemoveOutlineItem(document, row) {
  const list = listAt(document, row);
  const levels = list.map((item) => itemParts(item).level);
  const end = blockEnd(levels, row.itemIndex);
  const patches = [];
  for (let at = end - 1; at >= row.itemIndex; at -= 1) patches.push({ op: "remove", path: `${opfPathToJsonPointer(row.listPath)}/${at}` });
  const survivors = list.length - (end - row.itemIndex);
  // An empty `items` array is not a useful list: drop it with its last item.
  const removeList = survivors === 0 && row.listPath.split(".").length === 3;
  const finalPatches = removeList ? [{ op: "remove", path: opfPathToJsonPointer(row.listPath) }] : patches;
  const focus = survivors ? `item:${row.listPath}.${Math.max(0, row.itemIndex - 1)}` : `slide:slides.${row.slideIndex}`;
  return finish(document, finalPatches, { action: "outline-remove", selection: [row.slideIndex], focus });
}

// --- promote and demote across slides --------------------------------------------------------------

/**
 * Compute promoting a top-level list item to a slide: the item becomes the title of a new slide right after its own, and the items that
 * follow it in the same list move to that slide (PowerPoint's outline does the same). Items above it stay.
 */
export function prepareOutlinePromote(document, row) {
  const list = listAt(document, row);
  const title = itemParts(list[row.itemIndex]);
  if (title.level !== 0) throw fail("outline-row-not-supported", "Only a top-level item becomes a slide.", { path: row.path });
  if (!title.plain) throw fail("outline-row-not-editable", "This item carries formatting. Edit it on the slide.", { path: row.path });
  const following = list.slice(row.itemIndex + 1);
  const added = prepareAddSlide(document, { at: row.slideIndex + 1, title: title.text });
  const slide = clone(added.document.slides[row.slideIndex + 1]);
  const key = row.listPath.endsWith(".bullets") ? "bullets" : "items";
  if (following.length) slide[key] = clone(following);
  const pointer = opfPathToJsonPointer(row.listPath);
  const rootList = row.listPath.split(".").length === 3;
  // Take the item and everything after it out of the old list (the whole list goes when nothing is left above the item).
  const removal = row.itemIndex === 0 && rootList
    ? [{ op: "remove", path: pointer }]
    : Array.from({ length: list.length - row.itemIndex }, (_, offset) => ({ op: "remove", path: `${pointer}/${list.length - 1 - offset}` }));
  const patches = [...removal, { op: "add", path: `/slides/${row.slideIndex + 1}`, value: slide }];
  return finish(document, patches, { action: "outline-promote-slide", selection: [row.slideIndex + 1], focus: `slide:slides.${row.slideIndex + 1}`, newSlideIndex: row.slideIndex + 1 });
}

const MERGEABLE = new Set(["id", "title", "text", "items", "bullets", "section", "hidden"]);
/**
 * Compute demoting a slide: its title becomes a top-level bullet of the previous slide and its own text and bullets nest one level
 * beneath it. Only a plain slide qualifies: one with a title and at most text or a list (no blocks, regions, notes, design or layout),
 * after a slide that has a list of its own or no body. Anything else throws `outline-row-not-supported` so nothing is dropped.
 */
export function prepareOutlineDemoteSlide(document, slideIndex) {
  const slides = document.slides;
  const slide = slides?.[slideIndex];
  if (!isObject(slide)) throw fail("slide-index-out-of-range", `Slide ${slideIndex} does not exist.`, { slideIndex });
  if (slideIndex === 0) throw fail("outline-row-not-supported", "The first slide has no slide before it to join.", { slideIndex });
  const extra = Object.keys(slide).filter((key) => !MERGEABLE.has(key));
  if (extra.length) throw fail("outline-row-not-supported", `This slide also has ${extra.join(", ")}, which would be lost. Merge it from the slide menu or move that content first.`, { slideIndex, keys: extra });
  if (typeof slide.title !== "string" || slide.title === "" || (slide.text !== undefined && typeof slide.text !== "string")) throw fail("outline-row-not-supported", "Only a slide with a plain title and plain text can join the slide before it.", { slideIndex });
  const previous = slides[slideIndex - 1];
  const body = ["text", "items", "bullets", "blocks", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"].filter((key) => previous[key] !== undefined);
  const listKey = LIST_KEYS.find((key) => Array.isArray(previous[key]));
  if (body.length && !(listKey && body.length === 1) && !(listKey && body.length === 2 && previous.text !== undefined))
    throw fail("outline-row-not-supported", "The slide before this one has content that is not a list, so this slide cannot become a bullet there.", { slideIndex });
  const key = listKey ?? "items";
  const nested = LIST_KEYS.flatMap((field) => (Array.isArray(slide[field]) ? slide[field] : [])).map((item) => withLevel(item, itemParts(item).level + 1));
  const added = [slide.title, ...(typeof slide.text === "string" && slide.text ? [{ text: slide.text, level: 1 }] : []), ...nested];
  const base = `/slides/${slideIndex - 1}`;
  const patches = [{ op: "remove", path: `/slides/${slideIndex}` }, listKey ? { op: "replace", path: `${base}/${key}`, value: [...previous[key], ...added] } : { op: "add", path: `${base}/${key}`, value: added }];
  return finish(document, patches, { action: "outline-demote-slide", selection: [slideIndex - 1], focus: `item:slides.${slideIndex - 1}.${key}.${(previous[key]?.length ?? 0)}` });
}

// --- slides ----------------------------------------------------------------------------------------

/** Compute moving a slide (the whole slide: its text moves with its title) by `delta` places; see `prepareMoveSlidesBy`. */
export function prepareMoveOutlineSlide(document, slideIndex, delta) {
  const prepared = prepareMoveSlidesBy(document, [slideIndex], delta);
  return prepared.changed ? { ...prepared, focus: `slide:slides.${prepared.selection[0]}` } : prepared;
}
/** Compute adding a slide right after `slideIndex`, with an empty title for the outline to type into. */
export function prepareInsertOutlineSlide(document, slideIndex) {
  return { ...prepareAddSlide(document, { at: slideIndex + 1, title: "" }), action: "outline-insert-slide", focus: `slide:slides.${slideIndex + 1}` };
}

// --- apply -----------------------------------------------------------------------------------------

function finish(document, patches, extra) {
  if (!patches.length) return { document: clone(document), patches: [], changed: false, ...extra };
  const before = validateOpfDocument(document);
  return { document: checkedDocument(document, patches, before), patches, changed: true, ...extra };
}
function requireEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}
function apply(editor, prepared, meta, action) {
  requireEditor(editor);
  const { document, patches, ...summary } = prepared;
  void document;
  if (!prepared.changed) return { ...summary, document: editor.document, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta?.source ?? "outline", action });
  return { ...change, ...summary };
}

/** Apply any prepared outline change as one undoable step. */
export function applyOutlineChange(editor, prepared, meta) {
  return apply(editor, prepared, meta, prepared.action ?? "outline");
}
