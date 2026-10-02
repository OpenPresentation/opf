// Content actions (RR-26): list levels, grouping, regions, images between content and design, and slide
// split and merge, as editor transactions. The pure transforms live in core (`@openpresentation/opf/convert`);
// each action here finds its target in the document, calls the transform, turns the result into a guarded patch
// (`test` of what was read, then `replace`, or per-slide `remove` and `add`), validates the document and, in the
// apply form, applies it as ONE undoable step. Every prepare function returns `{ document, patches, changed,
// lossless, loss, path }` without touching a session; a refusal throws `content-action-refused`.
import {
  OPFConversionError,
  blocksToRegions,
  demoteImage,
  mergeSlides as mergeSlidesCore,
  moveRegion,
  promoteImage,
  regionsToBlocks,
  shiftListLevels,
  splitSlide,
  splitSlideOnOverflow as splitSlideOnOverflowCore,
  unpaginate,
  unwrapGroup,
  wrapBlocks,
} from "@openpresentation/opf/convert";
import { applyJsonPatch, getValueAtPath, opfPathToJsonPointer, splitOpfPath, validateOpfDocument } from "./index.js";
import { readBlockContent } from "./block-convert.js";
import { checkedDocument, fail } from "./edit-helpers.js";

const refuse = (message, details) => fail("content-action-refused", message, details);

/** Run a core transform; a refusal becomes the editor's `content-action-refused`. */
function core(action) {
  try {
    return action();
  } catch (error) {
    if (error instanceof OPFConversionError) throw refuse(error.message, { ...error.details, coreCode: error.code });
    throw error;
  }
}

function requireEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}

function slideParts(document, path, what) {
  let parts;
  try {
    parts = splitOpfPath(path);
  } catch {
    parts = undefined;
  }
  if (!parts || parts[0] !== "slides" || !/^(0|[1-9][0-9]*)$/.test(parts[1] ?? "") || !document?.slides?.[Number(parts[1])]) throw refuse(`Choose ${what} on a slide.`, { path });
  return { slideIndex: Number(parts[1]), relative: parts.slice(2), parts };
}

const asNumbers = (path) => path.map((part) => (/^(0|[1-9][0-9]*)$/.test(String(part)) ? Number(part) : part));
const toDocumentPath = (slideIndex, relative) => ["slides", String(slideIndex), ...(relative ?? []).map(String)].join(".");

/** Replace one value (a slide, a block, a list) as `test` + `replace`, validated like every other edit. */
function replacePatches(document, parts, next) {
  const pointer = opfPathToJsonPointer(parts);
  return [
    { op: "test", path: pointer, value: structuredClone(getValueAtPath(document, parts)) },
    { op: "replace", path: pointer, value: next },
  ];
}
// `validate: false` skips the whole-document check, for a dry run that only needs the loss report (core has already
// validated the changed slide); applying always validates.
function finish(document, patches, extra, validate = true) {
  if (!validate) return { document: applyJsonPatch(document, patches), patches, ...extra };
  const before = validateOpfDocument(document);
  return { document: checkedDocument(document, patches, before), patches, ...extra };
}
function apply(editor, prepared, meta, source) {
  if (!prepared.changed) return { ...prepared, document: editor.document, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(prepared.patches, { ...meta, source: meta.source ?? source, path: prepared.path });
  const extra = Object.fromEntries(["levels", "range", "slideCount", "pages"].filter((key) => prepared[key] !== undefined).map((key) => [key, prepared[key]]));
  return { ...change, changed: true, lossless: prepared.lossless, loss: prepared.loss, path: prepared.path, ...extra };
}
const unchanged = (document, path, reason) => ({ document: structuredClone(document), patches: [], path, changed: false, lossless: true, loss: [], ...(reason ? { reason } : {}) });

// --- list levels -------------------------------------------------------------------------------

/** The index of the list item a selection points at (`slides.0.blocks.1.items.2.text` gives 2), or undefined. */
export function listItemIndexForSelection(selectedPath, blockPath) {
  if (typeof selectedPath !== "string" || typeof blockPath !== "string") return undefined;
  const match = new RegExp(`^${blockPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.items|\\.bullets)\\.(0|[1-9][0-9]*)(?:\\.|$)`).exec(selectedPath);
  return match ? Number(match[1]) : undefined;
}

/**
 * Compute the patch that moves the list items at `indices` of the list block at `blockPath` one level in
 * (`delta` 1, Tab) or out (`delta` -1, Shift+Tab). A level never exceeds one more than the item above, the first
 * item cannot be nested, and items under a moved item move with it (`options.withChildren`, default true).
 * `changed` is false, with a `reason`, when nothing can move.
 */
export function prepareListShift(document, blockPath, indices, delta, options = {}) {
  const found = readBlockContent(document, blockPath);
  if (!found || found.kind !== "list") throw refuse("Choose a list block.", { path: blockPath });
  const result = core(() => shiftListLevels(found.owner, indices, delta, options));
  const path = found.path.join(".");
  if (!result.changed) return unchanged(document, path, result.reason);
  return finish(document, replacePatches(document, found.path, result.payload), { path, changed: true, lossless: result.lossless, loss: result.loss, levels: result.levels }, options.validate !== false);
}
/** Nest or un-nest list items as one undoable step. Returns the session change plus `changed`, `reason`, `levels`, `lossless` and `loss`. */
export function shiftListItems(editor, blockPath, indices, delta, options = {}, meta = {}) {
  requireEditor(editor);
  return apply(editor, prepareListShift(editor.document, blockPath, indices, delta, options), meta, "list-level");
}

// --- structure inside one slide ----------------------------------------------------------------

/** One slide-level transform as a guarded replace of that slide. */
function slideAction(document, slideIndex, transform, targetPath, validate = true) {
  const slide = document.slides[slideIndex];
  const result = core(() => transform(slide));
  const path = result.path ? toDocumentPath(slideIndex, result.path) : (targetPath ?? `slides.${slideIndex}`);
  if (!result.changed) return unchanged(document, path);
  const patches = replacePatches(document, ["slides", String(slideIndex)], result.slide);
  return finish(document, patches, { path, changed: true, lossless: result.lossless, loss: result.loss }, validate);
}

/** Wrap the blocks at `indices` of the container at `containerPath` (a slide `slides.0`, a group or a region group) in a new group. */
export function prepareGroupBlocks(document, containerPath, indices, options = {}) {
  const { slideIndex, relative } = slideParts(document, containerPath, "a container");
  return slideAction(document, slideIndex, (slide) => wrapBlocks(slide, indices, { container: asNumbers(relative), ...(options.composition ? { composition: options.composition } : {}) }), undefined, options.validate !== false);
}
/** Replace the group at `groupPath` by its blocks. What the group carried (composition, id) is reported in `loss`. */
export function prepareUngroupBlock(document, groupPath, options = {}) {
  const { slideIndex, relative } = slideParts(document, groupPath, "a group");
  return slideAction(document, slideIndex, (slide) => unwrapGroup(slide, asNumbers(relative)), undefined, options.validate !== false);
}
/** Place every block of a slide in its own named region: `regions[i]` is block i's region (`left`, `right`, `top:left`, ...). */
export function prepareBlocksToRegions(document, slideIndex, regions, options = {}) {
  slideParts(document, `slides.${slideIndex}`, "a slide");
  return slideAction(document, slideIndex, (slide) => blocksToRegions(slide, regions), undefined, options.validate !== false);
}
/** Turn the named regions of a slide into ordinary blocks in reading order. The regions' placement is reported in `loss`. */
export function prepareRegionsToBlocks(document, slideIndex, options = {}) {
  slideParts(document, `slides.${slideIndex}`, "a slide");
  return slideAction(document, slideIndex, (slide) => regionsToBlocks(slide), undefined, options.validate !== false);
}
/** Move the content of region `from` to region `to`, or swap them when `to` is taken and `options.swap` is true. */
export function prepareMoveRegion(document, slideIndex, from, to, options = {}) {
  slideParts(document, `slides.${slideIndex}`, "a slide");
  return slideAction(document, slideIndex, (slide) => moveRegion(slide, from, to, options), undefined, options.validate !== false);
}
/** Move the image block at `blockPath` into the slide's design as `slideImage`, `background` or `watermark`. */
export function prepareImageToDesign(document, blockPath, target, options = {}) {
  const { slideIndex, relative } = slideParts(document, blockPath, "an image block");
  return slideAction(document, slideIndex, (slide) => promoteImage(slide, asNumbers(relative), target, options), `slides.${slideIndex}`, options.validate !== false);
}
/** Move a slide's own `slideImage`, `background` image or `watermark` back into its content as an image block. */
export function prepareImageToContent(document, slideIndex, source, options = {}) {
  slideParts(document, `slides.${slideIndex}`, "a slide");
  return slideAction(document, slideIndex, (slide) => demoteImage(slide, source, options), undefined, options.validate !== false);
}

export const groupBlocks = (editor, containerPath, indices, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareGroupBlocks(editor.document, containerPath, indices, options), meta, "group-blocks"));
export const ungroupBlock = (editor, groupPath, meta = {}) => (requireEditor(editor), apply(editor, prepareUngroupBlock(editor.document, groupPath), meta, "ungroup-block"));
export const placeBlocksInRegions = (editor, slideIndex, regions, meta = {}) => (requireEditor(editor), apply(editor, prepareBlocksToRegions(editor.document, slideIndex, regions), meta, "blocks-to-regions"));
export const regionsAsBlocks = (editor, slideIndex, meta = {}) => (requireEditor(editor), apply(editor, prepareRegionsToBlocks(editor.document, slideIndex), meta, "regions-to-blocks"));
export const moveSlideRegion = (editor, slideIndex, from, to, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareMoveRegion(editor.document, slideIndex, from, to, options), meta, "move-region"));
export const moveImageToDesign = (editor, blockPath, target, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareImageToDesign(editor.document, blockPath, target, options), meta, "image-to-design"));
export const moveImageToContent = (editor, slideIndex, source, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareImageToContent(editor.document, slideIndex, source, options), meta, "image-to-content"));

// --- slides ------------------------------------------------------------------------------------

/**
 * Per-slide patches for replacing `range.deleteCount` slides from `range.start` by `slides`: a `test` for every
 * replaced slide, a `replace` for each one that changed, `remove` for the surplus old slides and `add` for the
 * surplus new ones, so a split or merge stays one guarded, undoable transaction without rewriting the other slides.
 */
function slidePatches(document, range, slides) {
  const old = document.slides.slice(range.start, range.start + range.deleteCount);
  const patches = old.map((slide, offset) => ({ op: "test", path: `/slides/${range.start + offset}`, value: structuredClone(slide) }));
  const common = Math.min(old.length, slides.length);
  for (let offset = 0; offset < common; offset++) if (JSON.stringify(old[offset]) !== JSON.stringify(slides[offset])) patches.push({ op: "replace", path: `/slides/${range.start + offset}`, value: structuredClone(slides[offset]) });
  for (let offset = old.length - 1; offset >= common; offset--) patches.push({ op: "remove", path: `/slides/${range.start + offset}` });
  for (let offset = common; offset < slides.length; offset++) patches.push({ op: "add", path: `/slides/${range.start + offset}`, value: structuredClone(slides[offset]) });
  return patches;
}
function slidesAction(document, result, extra = {}) {
  const path = `slides.${result.range.start}`;
  if (!result.changed) return unchanged(document, path, "Nothing to change.");
  return finish(document, slidePatches(document, result.range, result.slides), { path, changed: true, lossless: result.lossless, loss: result.loss, range: result.range, slideCount: result.slides.length, ...extra });
}

/** Split a slide by its blocks (`options.at`: block indexes where a new slide starts, or `options.each`). See core's `splitSlide`. */
export function prepareSplitSlide(document, slideIndex, options = {}) {
  return slidesAction(document, core(() => splitSlide(document, slideIndex, options)));
}
/** Split a slide that overflows into pages with the existing pagination (`options`: text measurement, fonts, as for `paginatePresentation`). `pages` maps the new slides back for `prepareUnpaginate`. */
export function prepareSplitSlideOnOverflow(document, slideIndex, options = {}) {
  const result = core(() => splitSlideOnOverflowCore(document, slideIndex, options));
  return slidesAction(document, result, { pages: result.pages });
}
/** Merge `count` consecutive slides from `start`. The first slide's id, headings and design win; what is dropped is reported in `loss`. */
export function prepareMergeSlides(document, start, count = 2) {
  return slidesAction(document, core(() => mergeSlidesCore(document, start, count)));
}
/** Put the continuation slides of a pagination back into one slide each. `pages` is the mapping `splitSlideOnOverflow` or `paginatePresentation` returned. */
export function prepareUnpaginate(document, pages, options = {}) {
  return slidesAction(document, core(() => unpaginate(document, pages, options)));
}

export const splitSlideByBlocks = (editor, slideIndex, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareSplitSlide(editor.document, slideIndex, options), meta, "split-slide"));
export const splitSlideOnOverflow = (editor, slideIndex, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareSplitSlideOnOverflow(editor.document, slideIndex, options), meta, "split-slide-overflow"));
export const mergeSlides = (editor, start, count = 2, meta = {}) => (requireEditor(editor), apply(editor, prepareMergeSlides(editor.document, start, count), meta, "merge-slides"));
export const unpaginateSlides = (editor, pages, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareUnpaginate(editor.document, pages, options), meta, "unpaginate-slides"));
