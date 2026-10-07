// Slide management (RR-21): add, duplicate, remove, move, hide and section slides as one validated, undoable
// change each. Every operation has a `prepare*` form that computes the JSON Patch from a document without
// touching a session (a dry run: `changed`, `patches` and the resulting `presentation`), and an apply form that
// commits that patch through the session as ONE transaction, so a single Undo restores the deck exactly and
// the preview, thumbnails and PPTX export follow from the document.
//
// Model. OPF has no section objects: a slide carries an optional `section` label and consecutive slides with
// the same label form a section (see `listSections`). Slides without a label form an unnamed run. `hidden`
// is a boolean on the slide. Slide order is the `slides` array, so a move is a remove plus an add of the same
// slide (removing and re-adding keeps every other slide's patch path stable).
import { checkedDocument, fail, same } from "./edit-helpers.js";
import { collectReservedPresentationIds, remapSlideTreeIds } from "./presentation-ids.js";
import { prepareDimensionSwitch } from "./switches.js";
import { checkFormat } from "./checks.js";

const isIndex = (value) => Number.isInteger(value) && value >= 0;
const clone = (value) => structuredClone(value);

function requireEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}
function requireSlides(presentation) {
  if (!presentation || typeof presentation !== "object" || !Array.isArray(presentation.slides)) throw fail("invalid-input", "Slide management needs an OPF document with a slides array.");
  return presentation.slides;
}
/** Validate and sort a list of slide indices; a single index is accepted too. */
function selectionOf(presentation, indices, what = "Choose at least one slide.") {
  const slides = requireSlides(presentation);
  const list = [...new Set(Array.isArray(indices) ? indices : [indices])];
  if (!list.length) throw fail("no-slides-chosen", what);
  for (const index of list) if (!isIndex(index) || index >= slides.length) throw fail("slide-index-out-of-range", `Slide ${index} does not exist.`, { slideIndex: index });
  return list.sort((a, b) => a - b);
}
const sectionOf = (slide) => (typeof slide?.section === "string" && slide.section.trim() !== "" ? slide.section : undefined);

function unchanged(presentation, extra = {}) {
  return { presentation: clone(presentation), patches: [], changed: false, selection: [], ...extra };
}
/** Validate the candidate the way every switch does (a valid deck must stay valid) and package the result. */
function finish(presentation, patches, extra) {
  if (!patches.length) return unchanged(presentation, extra);
  const before = checkFormat(presentation);
  const next = checkedDocument(presentation, patches, before);
  return { presentation: next, patches, changed: true, ...extra };
}
function apply(editor, prepared, meta, action) {
  requireEditor(editor);
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta?.source ?? "slides", action });
  return { ...change, ...summary };
}

// --- reading ---------------------------------------------------------------------------------------

/**
 * The sections of the deck, in order: maximal runs of consecutive slides that share a `section` label. A run
 * of slides with no label is reported with `name: undefined` (`unnamed: true`). `index` is the position in
 * the returned list, the id every section operation takes.
 */
export function listSections(presentation) {
  const slides = requireSlides(presentation);
  const sections = [];
  slides.forEach((slide, slideIndex) => {
    const name = sectionOf(slide);
    const last = sections.at(-1);
    if (last && last.name === name) last.count += 1;
    else sections.push({ index: sections.length, name, unnamed: name === undefined, start: slideIndex, count: 1 });
  });
  return sections;
}
/** Whether any slide carries a section label (a deck with none shows no section headers). */
export function hasSections(presentation) {
  return requireSlides(presentation).some((slide) => sectionOf(slide) !== undefined);
}
/** The section (from `listSections`) that holds a slide. */
export function sectionForSlide(presentation, slideIndex) {
  return listSections(presentation).find((section) => slideIndex >= section.start && slideIndex < section.start + section.count);
}
/** The title shown for a slide in navigators and outlines. */
export function slideTitle(slide) {
  // A title is a string or TextRun[] (FA-10): either shows as its plain text.
  const title = typeof slide?.title === "string" ? slide.title : Array.isArray(slide?.title) ? slide.title.map((run) => (typeof run === "string" ? run : (run?.text ?? ""))).join("") : "";
  return title.trim() ? title : "";
}
/** One row per slide for pickers and navigators: `{ index, id, title, hidden, section, layout }`. */
export function slideSummaries(presentation) {
  return requireSlides(presentation).map((slide, index) => ({ index, id: slide.id, title: slideTitle(slide), hidden: slide.hidden === true, section: sectionOf(slide), layout: slide.layout }));
}

// --- patches ---------------------------------------------------------------------------------------

const slidePointer = (index) => `/slides/${index}`;
/** Set or clear one slide field with the narrowest patch (`add`, `replace` or `remove`); undefined clears. */
function fieldPatch(slide, index, key, value) {
  const present = Object.hasOwn(slide, key);
  const path = `${slidePointer(index)}/${key}`;
  if (value === undefined) return present ? [{ op: "remove", path }] : [];
  if (!present) return [{ op: "add", path, value }];
  return same(slide[key], value) ? [] : [{ op: "replace", path, value }];
}
function withSection(slide, name) {
  const next = clone(slide);
  if (name === undefined || name === null || name === "") delete next.section;
  else next.section = name;
  return next;
}
/**
 * Patches that put `moved` (old indices) at their final places. `order` lists every old index in its new
 * order, `values` maps a moved old index to the slide value to write. Moved slides are removed (highest first,
 * so lower paths stay valid) and re-added at their final index in ascending order.
 */
function permutationPatches(moved, order, values) {
  const patches = [];
  for (const index of [...moved].sort((a, b) => b - a)) patches.push({ op: "remove", path: slidePointer(index) });
  order.forEach((old, position) => {
    if (moved.has(old)) patches.push({ op: "add", path: slidePointer(position), value: values.get(old) });
  });
  return patches;
}

// --- add -------------------------------------------------------------------------------------------

function newSlideId(presentation) {
  const used = new Set(collectReservedPresentationIds(presentation));
  let number = presentation.slides.length + 1;
  while (used.has(`slide-${number}`)) number += 1;
  return `slide-${number}`;
}

/**
 * Compute adding a slide. Options: `at` (the index the slide takes, default the end), `layout` (a layouts
 * catalog id; the layout's placeholders are added as empty slots, exactly like switching a slide's layout),
 * `title`, `text`, `id`, `section` (default: the section of the slide before it), `slide` (a ready slide to
 * insert, for hosts that build their own), `catalogs`/`record` for catalog lookup (as `prepareDimensionSwitch`).
 */
export function prepareAddSlide(presentation, options = {}) {
  const slides = requireSlides(presentation);
  const at = options.at === undefined ? slides.length : options.at;
  if (!isIndex(at) || at > slides.length) throw fail("slide-index-out-of-range", "Add the slide at an index from 0 to the slide count.", { at });
  const id = options.id ?? options.slide?.id ?? newSlideId(presentation);
  let slide = options.slide ? clone(options.slide) : { id };
  if (!options.slide) {
    if (options.title !== undefined) slide.title = String(options.title);
    else if (!options.layout) slide.title = "New slide";
    if (options.text !== undefined) slide.text = String(options.text);
    else if (!options.layout && options.title === undefined) slide.text = "Write your next idea here.";
  } else if (options.id) slide.id = id;
  const inherited = options.section === undefined ? sectionOf(slides[at - 1] ?? slides[at]) : options.section;
  slide = withSection(slide, inherited);
  if (options.layout) {
    // Switch the layout on a scratch copy to reuse the placeholder rules and the catalog lookup.
    const scratch = { ...clone(presentation), slides: [...clone(slides)] };
    scratch.slides.splice(at, 0, slide);
    const switched = prepareDimensionSwitch(scratch, "layouts", options.layout, { slideIndex: at, catalogs: options.catalogs, record: options.record });
    const catalogOps = switched.patches.filter((patch) => !patch.path.startsWith("/slides/"));
    slide = switched.presentation.slides[at];
    const patches = [...catalogOps, { op: "add", path: slidePointer(at), value: slide }];
    return finish(presentation, patches, { action: "add", index: at, id: slide.id, selection: [at], layout: options.layout });
  }
  return finish(presentation, [{ op: "add", path: slidePointer(at), value: slide }], { action: "add", index: at, id: slide.id, selection: [at] });
}
/** Add a slide (see `prepareAddSlide`) as one undoable step. The change reports `index`, `id` and `selection`. */
export function addSlide(editor, options = {}, meta) {
  requireEditor(editor);
  return apply(editor, prepareAddSlide(editor.presentation, options), meta, "add");
}

// --- duplicate -------------------------------------------------------------------------------------

/**
 * Compute duplicating slides. The copies go right after the last selected slide, in order, with fresh ids for
 * the slide and any content it identifies (`slide-2` becomes `slide-2-2`, as when pagination copies slides).
 * Copies join the section of the slide they follow unless `options.section` is `"keep"`.
 */
export function prepareDuplicateSlides(presentation, indices, options = {}) {
  const list = selectionOf(presentation, indices, "Choose at least one slide to duplicate.");
  const slides = presentation.slides;
  const at = list.at(-1) + 1;
  const ids = new Set(collectReservedPresentationIds(presentation));
  const section = options.section === "keep" ? undefined : sectionOf(slides[at - 1]);
  const copies = list.map((index) => {
    let copy = clone(slides[index]);
    remapSlideTreeIds(copy, ids);
    if (options.section !== "keep") copy = withSection(copy, section);
    return copy;
  });
  const patches = copies.map((copy, offset) => ({ op: "add", path: slidePointer(at + offset), value: copy }));
  return finish(presentation, patches, { action: "duplicate", selection: copies.map((_, offset) => at + offset), range: { start: at, count: copies.length }, ids: copies.map((copy) => copy.id) });
}
export function duplicateSlides(editor, indices, options = {}, meta) {
  requireEditor(editor);
  return apply(editor, prepareDuplicateSlides(editor.presentation, indices, options), meta, "duplicate");
}

// --- remove ----------------------------------------------------------------------------------------

/**
 * Compute deleting slides. A deck keeps at least one slide, so deleting every slide throws
 * `cannot-remove-all-slides`. `selection` is the slide to show next (the one that moves into the first
 * removed position, or the last slide).
 */
export function prepareRemoveSlides(presentation, indices) {
  const list = selectionOf(presentation, indices, "Choose at least one slide to delete.");
  const slides = presentation.slides;
  if (list.length >= slides.length) throw fail("cannot-remove-all-slides", "A presentation needs at least one slide.", { count: slides.length });
  const patches = [...list].reverse().map((index) => ({ op: "remove", path: slidePointer(index) }));
  const remaining = slides.length - list.length;
  return finish(presentation, patches, { action: "remove", removed: list, selection: [Math.min(list[0], remaining - 1)] });
}
export function removeSlides(editor, indices, meta) {
  requireEditor(editor);
  return apply(editor, prepareRemoveSlides(editor.presentation, indices), meta, "remove");
}

// --- move ------------------------------------------------------------------------------------------

/**
 * Compute moving slides. `to` is the drop gap in the ORIGINAL order: 0 puts the slides first, the slide count
 * last, 3 between slides 2 and 3. The moved slides keep their order and land together. `options.section`
 * decides their section: `"adopt"` (default) takes the section of the slide just before the gap (or the
 * first slide's when moving to the start), `"keep"` leaves labels alone, a string sets that section and
 * `null` clears it.
 */
export function prepareMoveSlides(presentation, indices, to, options = {}) {
  const list = selectionOf(presentation, indices, "Choose at least one slide to move.");
  const slides = presentation.slides;
  if (!isIndex(to) || to > slides.length) throw fail("slide-index-out-of-range", "Move to a gap from 0 to the slide count.", { to });
  const chosen = new Set(list);
  const rest = slides.map((_, index) => index).filter((index) => !chosen.has(index));
  const position = to - list.filter((index) => index < to).length;
  const order = [...rest.slice(0, position), ...list, ...rest.slice(position)];
  const mode = rest.length ? (options.section === undefined ? "adopt" : options.section) : "keep";
  let target;
  if (mode === "keep") target = undefined;
  else if (mode === "adopt") target = { name: sectionOf(slides[rest[position - 1] ?? rest[position]]) };
  else target = { name: mode === null ? undefined : String(mode) };
  const values = new Map(list.map((index) => [index, target ? withSection(slides[index], target.name) : slides[index]]));
  const sameOrder = order.every((old, at) => old === at);
  const sameValues = list.every((index) => same(values.get(index), slides[index]));
  if (sameOrder && sameValues) return unchanged(presentation, { action: "move", selection: list });
  // A pure relabel keeps the order: patch the labels in place instead of remove and add.
  const moved = new Set(list);
  const patches = sameOrder
    ? list.flatMap((index) => fieldPatch(slides[index], index, "section", sectionOf(values.get(index))))
    : permutationPatches(moved, order, values);
  const selection = list.map((old) => order.indexOf(old));
  return finish(presentation, patches, { action: "move", selection, order });
}
export function moveSlides(editor, indices, to, options = {}, meta) {
  requireEditor(editor);
  return apply(editor, prepareMoveSlides(editor.presentation, indices, to, options), meta, "move");
}

/**
 * Compute moving slides by `delta` positions (negative up). A contiguous selection moves as a block and a
 * scattered one moves each slide past its neighbour, like Alt+Arrow in a list. Moving past the first or last
 * slide changes nothing (`changed` is false).
 */
export function prepareMoveSlidesBy(presentation, indices, delta, options = {}) {
  const list = selectionOf(presentation, indices, "Choose at least one slide to move.");
  const count = presentation.slides.length;
  if (!Number.isInteger(delta) || delta === 0) return unchanged(presentation, { action: "move", selection: list });
  const step = Math.sign(delta);
  const order = presentation.slides.map((_, index) => index);
  const selected = new Set(list);
  for (let turn = 0; turn < Math.abs(delta); turn += 1) {
    const sequence = step < 0 ? [...order.keys()] : [...order.keys()].reverse();
    let moved = false;
    for (const at of sequence) {
      const neighbour = at + step;
      if (neighbour < 0 || neighbour >= count || !selected.has(order[at]) || selected.has(order[neighbour])) continue;
      [order[at], order[neighbour]] = [order[neighbour], order[at]];
      moved = true;
    }
    if (!moved) break;
  }
  if (order.every((old, at) => old === at)) return unchanged(presentation, { action: "move", selection: list });
  const slides = presentation.slides;
  const mode = options.section === undefined ? "adopt" : options.section;
  // A moved slide adopts the section of the nearest slide that did not move: the one before it in the new order,
  // else the one after it.
  const adopted = (at) => {
    for (let back = at - 1; back >= 0; back -= 1) if (!selected.has(order[back])) return sectionOf(slides[order[back]]);
    for (let ahead = at + 1; ahead < order.length; ahead += 1) if (!selected.has(order[ahead])) return sectionOf(slides[order[ahead]]);
    return undefined;
  };
  const values = new Map(list.map((index) => {
    const name = mode === "keep" ? sectionOf(slides[index]) : mode === "adopt" ? adopted(order.indexOf(index)) : mode === null ? undefined : String(mode);
    return [index, withSection(slides[index], name)];
  }));
  return finish(presentation, permutationPatches(selected, order, values), { action: "move", selection: list.map((old) => order.indexOf(old)), order });
}
export function moveSlidesBy(editor, indices, delta, options = {}, meta) {
  requireEditor(editor);
  return apply(editor, prepareMoveSlidesBy(editor.presentation, indices, delta, options), meta, "move");
}

// --- hide ------------------------------------------------------------------------------------------

/**
 * Compute hiding (`hidden` true) or showing (false) slides. A hidden slide stays in the document and the
 * navigator but is skipped when presenting; showing removes the `hidden` field instead of writing `false`.
 * Without `hidden`, the slides toggle together: all hidden become shown, otherwise all become hidden.
 */
export function prepareSetHidden(presentation, indices, hidden) {
  const list = selectionOf(presentation, indices, "Choose at least one slide.");
  const slides = presentation.slides;
  const value = hidden === undefined ? !list.every((index) => slides[index].hidden === true) : Boolean(hidden);
  const patches = list.flatMap((index) => fieldPatch(slides[index], index, "hidden", value ? true : undefined));
  // A stored `hidden: false` counts as shown; showing it removes the field, hiding replaces it.
  return finish(presentation, patches, { action: value ? "hide" : "show", hidden: value, selection: list });
}
export function setHidden(editor, indices, hidden, meta) {
  requireEditor(editor);
  const prepared = prepareSetHidden(editor.presentation, indices, hidden);
  return apply(editor, prepared, meta, prepared.action);
}

// --- sections --------------------------------------------------------------------------------------

function sectionAt(presentation, sectionIndex) {
  const section = listSections(presentation)[sectionIndex];
  if (!section) throw fail("section-index-out-of-range", `Section ${sectionIndex} does not exist.`, { sectionIndex });
  return section;
}
const cleanName = (name) => (typeof name === "string" ? name.trim() : name);

/**
 * Compute giving slides a section label (`name`), or clearing it (`null`). The slides keep their order, so
 * labelling a middle slide splits its section in two runs; use `prepareAddSection` to start a section.
 */
export function prepareSetSection(presentation, indices, name) {
  const list = selectionOf(presentation, indices, "Choose at least one slide.");
  const label = name === null || name === undefined ? undefined : cleanName(name);
  if (label === "") throw fail("invalid-section-name", "A section needs a name. Use null to remove the section from a slide.");
  const patches = list.flatMap((index) => fieldPatch(presentation.slides[index], index, "section", label));
  return finish(presentation, patches, { action: "section", section: label, selection: list });
}
export function setSection(editor, indices, name, meta) {
  requireEditor(editor);
  return apply(editor, prepareSetSection(editor.presentation, indices, name), meta, "section");
}

/**
 * Compute starting a section at a slide: that slide and the slides after it up to the end of its current
 * section take `name` (PowerPoint's "Add section", whose header sits above the chosen slide).
 */
export function prepareAddSection(presentation, slideIndex, name) {
  const slides = requireSlides(presentation);
  if (!isIndex(slideIndex) || slideIndex >= slides.length) throw fail("slide-index-out-of-range", `Slide ${slideIndex} does not exist.`, { slideIndex });
  const label = cleanName(name);
  if (typeof label !== "string" || label === "") throw fail("invalid-section-name", "Give the section a name.");
  const current = sectionOf(slides[slideIndex]);
  const end = (() => {
    let at = slideIndex;
    while (at + 1 < slides.length && sectionOf(slides[at + 1]) === current) at += 1;
    return at;
  })();
  const indices = Array.from({ length: end - slideIndex + 1 }, (_, offset) => slideIndex + offset);
  const patches = indices.flatMap((index) => fieldPatch(slides[index], index, "section", label));
  return finish(presentation, patches, { action: "add-section", section: label, selection: indices });
}
export function addSection(editor, slideIndex, name, meta) {
  requireEditor(editor);
  return apply(editor, prepareAddSection(editor.presentation, slideIndex, name), meta, "add-section");
}

/** Compute renaming a section (an index from `listSections`) for all of its slides. */
export function prepareRenameSection(presentation, sectionIndex, name) {
  const section = sectionAt(presentation, sectionIndex);
  const label = cleanName(name);
  if (typeof label !== "string" || label === "") throw fail("invalid-section-name", "Give the section a name.");
  const indices = Array.from({ length: section.count }, (_, offset) => section.start + offset);
  const patches = indices.flatMap((index) => fieldPatch(presentation.slides[index], index, "section", label));
  return finish(presentation, patches, { action: "rename-section", section: label, selection: indices });
}
export function renameSection(editor, sectionIndex, name, meta) {
  requireEditor(editor);
  return apply(editor, prepareRenameSection(editor.presentation, sectionIndex, name), meta, "rename-section");
}

/**
 * Compute removing a section. Its slides stay and join the section before it (the first section's slides
 * lose their label). With `deleteSlides: true` the slides are deleted too (not allowed when they are every
 * slide of the deck).
 */
export function prepareRemoveSection(presentation, sectionIndex, options = {}) {
  const sections = listSections(presentation);
  const section = sectionAt(presentation, sectionIndex);
  const indices = Array.from({ length: section.count }, (_, offset) => section.start + offset);
  if (options.deleteSlides) return { ...prepareRemoveSlides(presentation, indices), action: "remove-section" };
  const previous = sections[sectionIndex - 1];
  const label = previous?.name;
  const patches = indices.flatMap((index) => fieldPatch(presentation.slides[index], index, "section", label));
  return finish(presentation, patches, { action: "remove-section", section: label, selection: indices });
}
export function removeSection(editor, sectionIndex, options = {}, meta) {
  requireEditor(editor);
  return apply(editor, prepareRemoveSection(editor.presentation, sectionIndex, options), meta, "remove-section");
}

/**
 * Compute moving a whole section to the gap `to` among the sections (0 to the section count, in the
 * original order of `listSections`). The slides keep their labels.
 */
export function prepareMoveSection(presentation, sectionIndex, to) {
  const sections = listSections(presentation);
  const section = sectionAt(presentation, sectionIndex);
  if (!isIndex(to) || to > sections.length) throw fail("section-index-out-of-range", "Move to a gap from 0 to the section count.", { to });
  const gap = to === sections.length ? presentation.slides.length : sections[to].start;
  const indices = Array.from({ length: section.count }, (_, offset) => section.start + offset);
  const prepared = prepareMoveSlides(presentation, indices, gap, { section: "keep" });
  return { ...prepared, action: "move-section", section: section.name };
}
export function moveSection(editor, sectionIndex, to, meta) {
  requireEditor(editor);
  return apply(editor, prepareMoveSection(editor.presentation, sectionIndex, to), meta, "move-section");
}

/** Every slide operation as a name to its `prepare` function, for hosts that map a command id to a change. */
export const SLIDE_OPERATIONS = Object.freeze({
  add: prepareAddSlide,
  duplicate: prepareDuplicateSlides,
  remove: prepareRemoveSlides,
  move: prepareMoveSlides,
  moveBy: prepareMoveSlidesBy,
  setHidden: prepareSetHidden,
  setSection: prepareSetSection,
  addSection: prepareAddSection,
  renameSection: prepareRenameSection,
  removeSection: prepareRemoveSection,
  moveSection: prepareMoveSection,
});
