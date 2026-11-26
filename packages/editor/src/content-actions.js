// Content actions (RR-26): list levels, grouping, regions, images between content and design (background or watermark), and slide
// split and merge, as editor transactions. The pure transforms live in core (`@openpresentation/opf/convert`);
// each action here finds its target in the document, calls the transform, turns the result into a guarded patch
// (`test` of what was read, then `replace`, or per-slide `remove` and `add`), validates the document and, in the
// apply form, applies it as ONE undoable step. Every prepare function returns `{ presentation, patches, changed,
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
import { resolveMetric } from "@openpresentation/opf";
import { applyJsonPatch, getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { readBlockContent } from "./block-convert.js";
import { checkedDocument, fail } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";

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

function slideParts(presentation, path, what) {
  let parts;
  try {
    parts = splitOpfPath(path);
  } catch {
    parts = undefined;
  }
  if (!parts || parts[0] !== "slides" || !/^(0|[1-9][0-9]*)$/.test(parts[1] ?? "") || !presentation?.slides?.[Number(parts[1])]) throw refuse(`Choose ${what} on a slide.`, { path });
  return { slideIndex: Number(parts[1]), relative: parts.slice(2), parts };
}

const asNumbers = (path) => path.map((part) => (/^(0|[1-9][0-9]*)$/.test(String(part)) ? Number(part) : part));
const toDocumentPath = (slideIndex, relative) => ["slides", String(slideIndex), ...(relative ?? []).map(String)].join(".");

/** Replace one value (a slide, a block, a list) as `test` + `replace`, validated like every other edit. */
function replacePatches(presentation, parts, next) {
  const pointer = opfPathToJsonPointer(parts);
  return [
    { op: "test", path: pointer, value: structuredClone(getValueAtPath(presentation, parts)) },
    { op: "replace", path: pointer, value: next },
  ];
}
// `validate: false` skips the whole-document check, for a dry run that only needs the loss report (core has already
// validated the changed slide); applying always validates.
function finish(presentation, patches, extra, validate = true) {
  if (!validate) return { presentation: applyJsonPatch(presentation, patches), patches, ...extra };
  const before = checkFormat(presentation);
  return { presentation: checkedDocument(presentation, patches, before), patches, ...extra };
}
function apply(editor, prepared, meta, source) {
  if (!prepared.changed) return { ...prepared, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(prepared.patches, { ...meta, source: meta.source ?? source, path: prepared.path });
  const extra = Object.fromEntries(["levels", "range", "slideCount", "pages"].filter((key) => prepared[key] !== undefined).map((key) => [key, prepared[key]]));
  return { ...change, changed: true, lossless: prepared.lossless, loss: prepared.loss, path: prepared.path, ...extra };
}
const unchanged = (presentation, path, reason) => ({ presentation: structuredClone(presentation), patches: [], path, changed: false, lossless: true, loss: [], ...(reason ? { reason } : {}) });

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
export function prepareListShift(presentation, blockPath, indices, delta, options = {}) {
  const found = readBlockContent(presentation, blockPath);
  if (!found || found.kind !== "list") throw refuse("Choose a list block.", { path: blockPath });
  const result = core(() => shiftListLevels(found.owner, indices, delta, options));
  const path = found.path.join(".");
  if (!result.changed) return unchanged(presentation, path, result.reason);
  return finish(presentation, replacePatches(presentation, found.path, result.payload), { path, changed: true, lossless: result.lossless, loss: result.loss, levels: result.levels }, options.validate !== false);
}
/** Nest or un-nest list items as one undoable step. Returns the session change plus `changed`, `reason`, `levels`, `lossless` and `loss`. */
export function shiftListItems(editor, blockPath, indices, delta, options = {}, meta = {}) {
  requireEditor(editor);
  return apply(editor, prepareListShift(editor.presentation, blockPath, indices, delta, options), meta, "list-level");
}

// --- a metric's trend (LH-123) -----------------------------------------------------------------

/** The trends a metric can show, as the schema's `Metric.trend` has them; the drawn arrow points up, down or right (flat). */
export const METRIC_TRENDS = Object.freeze(["up", "down", "flat"]);

/**
 * The trend of the metric block at `blockPath` for a form: `{ path, trend, scalar }`, where `path` is the metric's own path, `trend` its
 * trend (undefined when it has none) and `scalar` whether the metric is a bare value (setting a trend then makes it `{ value, trend }`).
 * Undefined for a block that is not a metric.
 */
export function readMetricTrend(presentation, blockPath) {
  const found = readBlockContent(presentation, blockPath);
  if (!found || found.kind !== "metric") return undefined;
  const metric = found.owner.metric;
  const object = Boolean(metric) && typeof metric === "object" && !Array.isArray(metric);
  return { path: [...found.path, "metric"].join("."), trend: object && METRIC_TRENDS.includes(metric.trend) ? metric.trend : undefined, scalar: !object };
}

/**
 * Compute the patch that sets a metric's trend (`up`, `down` or `flat`), or removes it with `null`. A bare value (`metric: 42`) becomes
 * `{ value: 42, trend }`. `changed` is false when the metric already has that trend.
 */
export function prepareMetricTrend(presentation, blockPath, trend) {
  const found = readMetricTrend(presentation, blockPath);
  if (!found) throw refuse("Choose a metric block to set its trend.", { path: blockPath });
  if (trend !== null && !METRIC_TRENDS.includes(trend)) throw fail("invalid-metric-trend", `A metric's trend is one of ${METRIC_TRENDS.join(", ")}, or null to remove it.`, { trend });
  const parts = found.path.split(".");
  const pointer = opfPathToJsonPointer([...parts, ...(found.scalar ? [] : ["trend"])]);
  const metric = getValueAtPath(presentation, parts);
  let patches;
  if (found.scalar) patches = trend === null ? [] : [{ op: "replace", path: pointer, value: { value: metric, trend } }];
  else if (trend === null) patches = metric.trend === undefined ? [] : [{ op: "remove", path: pointer }];
  else patches = metric.trend === trend ? [] : [{ op: metric.trend === undefined ? "add" : "replace", path: pointer, value: trend }];
  return finish(presentation, patches, { path: found.path, changed: patches.length > 0, lossless: true, loss: [], trend });
}
/** Set (or, with `null`, remove) a metric's trend as one undoable step. Returns the session change plus `changed` and `trend`. */
export function setMetricTrend(editor, blockPath, trend, meta = {}) {
  requireEditor(editor);
  const prepared = prepareMetricTrend(editor.presentation, blockPath, trend);
  const result = apply(editor, prepared, meta, "metric-trend");
  return { ...result, trend };
}

// --- a metric computed from data (FR-06) ---------------------------------------------------

/** The aggregates a metric's link takes, as the schema's `DataLink.aggregate` has them. */
export const METRIC_AGGREGATES = Object.freeze(["sum", "mean", "min", "max", "count", "first", "last"]);
/** The directions of change that can be good news: `Metric.better`. */
export const METRIC_BETTER = Object.freeze(["up", "down"]);
/** The comparisons of a metric's change (`MetricDelta`): none, the previous row, a baseline filter, a fixed number, a column that holds the change. */
export const METRIC_CHANGES = Object.freeze(["none", "previous", "baseline", "value", "column"]);

/**
 * FR-07, part 3: the gauge a metric starts with when the editor turns it on: `min` 0 and `max` the next round number above the value (1 for a
 * value from 0 to 1; 80 for 72; 2000 for 1284). An editor convenience only: the format never guesses a range. `value` is the number the
 * metric shows (its computed or written value); without one the range is 0 to 1.
 */
export function defaultMetricGauge(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return { max: 1 };
  if (value <= 1) return { max: 1 };
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const max = Math.ceil(value / magnitude) * magnitude;
  return { max: max > value ? max : max + magnitude };
}

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const columnNameOf = (column) => (typeof column === "string" ? column : isObject(column) && typeof column.name === "string" ? column.name : "");

/** The deck's datasets for a Data section: `[{ id, title, columns: [{ name, type?, role?, format? }] }]`, the `measure` columns first. */
export function metricDatasets(presentation) {
  const sets = isObject(presentation?.datasets) ? presentation.datasets : {};
  return Object.entries(sets).map(([id, dataset]) => {
    const columns = (Array.isArray(dataset?.columns) ? dataset.columns : []).map((column) => ({
      name: columnNameOf(column),
      ...(isObject(column) && typeof column.type === "string" ? { type: column.type } : {}),
      ...(isObject(column) && typeof column.role === "string" ? { role: column.role } : {}),
      ...(isObject(column) && typeof column.format === "string" ? { format: column.format } : {}),
    }));
    const measures = columns.filter((column) => column.role === "measure");
    return { id, ...(typeof dataset?.title === "string" ? { title: dataset.title } : {}), columns: [...measures, ...columns.filter((column) => column.role !== "measure")] };
  });
}

/** The kind of change a link computes: one of METRIC_CHANGES. */
export function metricChangeKind(link) {
  const delta = isObject(link) ? link.delta : undefined;
  if (!isObject(delta)) return "none";
  if (delta.field !== undefined) return "column";
  if (delta.compare === "previous") return "previous";
  if (isObject(delta.compare) && "filter" in delta.compare) return "baseline";
  if (isObject(delta.compare) && "value" in delta.compare) return "value";
  return "none";
}

/**
 * What the metric block at `blockPath` reads from data, for a form: `{ path, scalar, link, better, format, datasets, resolved, value,
 * delta, stale, diagnostics }`. `resolved` says whether the link computes (the computed numbers are drawn; `value` and `delta` say
 * which: `{ text, number, ... }`); `stale` lists the written numbers that differ from the computed ones, each with the fix that writes
 * the computed number. Undefined for a block that is not a metric.
 */
export function readMetricData(presentation, blockPath, options = {}) {
  const found = readBlockContent(presentation, blockPath);
  if (!found || found.kind !== "metric") return undefined;
  const metric = found.owner.metric;
  const object = isObject(metric);
  const path = [...found.path, "metric"].join(".");
  const language = options.language ?? (typeof presentation?.language === "string" ? presentation.language : undefined);
  const resolved = object ? resolveMetric(metric, presentation, { path: opfPathToJsonPointer([...found.path, "metric"]), ...(language ? { language } : {}) }) : undefined;
  return {
    path,
    scalar: !object,
    link: object && isObject(metric.data) ? metric.data : undefined,
    better: object ? metric.better : undefined,
    format: object ? metric.format : undefined,
    gauge: object && isObject(metric.gauge) ? metric.gauge : undefined,
    number: resolved?.value?.isNumber ? resolved.value.number : typeof metric === "number" ? metric : undefined,
    datasets: metricDatasets(presentation),
    resolved: resolved?.resolved === true,
    value: resolved?.resolved ? resolved.value : undefined,
    delta: resolved?.resolved ? resolved.delta : undefined,
    stale: (resolved?.diagnostics ?? []).filter((entry) => entry.code === "metric-data-stale").map((entry) => ({ field: entry.path.endsWith("/delta") ? "delta" : "value", message: entry.message, fix: entry.fix })),
    diagnostics: resolved?.diagnostics ?? [],
  };
}

/**
 * Compute the patches that set a metric's link (`data`), the direction that is good (`better`) and its number `format`: `change` is
 * `{ data?, better?, format? }`, where a key set to `null` removes it and an absent key is left as it is. A bare value (`metric: 42`)
 * becomes `{ value: 42, ... }`. The link, `better` and `format` stay through every other edit of the metric.
 */
export function prepareMetricData(presentation, blockPath, change) {
  const found = readMetricData(presentation, blockPath);
  if (!found) throw refuse("Choose a metric block to link it to data.", { path: blockPath });
  if (!isObject(change)) throw fail("invalid-metric-data", "A change is { data?, better?, format? }.", { change });
  if (change.better != null && !METRIC_BETTER.includes(change.better)) throw fail("invalid-metric-better", `A metric's better is one of ${METRIC_BETTER.join(", ")}, or null to remove it.`, { better: change.better });
  const parts = found.path.split(".");
  const metric = getValueAtPath(presentation, parts);
  if (change.gauge != null && (!isObject(change.gauge) || typeof change.gauge.max !== "number")) throw fail("invalid-metric-gauge", "A gauge is { min?, max, bands?, target? } with a number max, or null to remove it.", { gauge: change.gauge });
  const keys = ["data", "better", "format", "gauge"].filter((key) => change[key] !== undefined);
  let patches;
  if (found.scalar) {
    const set = keys.filter((key) => change[key] !== null);
    patches = set.length ? [{ op: "replace", path: opfPathToJsonPointer(parts), value: { value: metric, ...Object.fromEntries(set.map((key) => [key, structuredClone(change[key])])) } }] : [];
  } else {
    patches = keys.flatMap((key) => {
      const pointer = opfPathToJsonPointer([...parts, key]);
      if (change[key] === null) return metric[key] === undefined ? [] : [{ op: "remove", path: pointer }];
      return JSON.stringify(metric[key]) === JSON.stringify(change[key]) ? [] : [{ op: metric[key] === undefined ? "add" : "replace", path: pointer, value: structuredClone(change[key]) }];
    });
  }
  return finish(presentation, patches, { path: found.path, changed: patches.length > 0, lossless: true, loss: [] });
}
/** Set (or, with `null`, remove) a metric's `data`, `better`, `format` and `gauge` as one undoable step. */
export function setMetricData(editor, blockPath, change, meta = {}) {
  requireEditor(editor);
  return apply(editor, prepareMetricData(editor.presentation, blockPath, change), meta, "metric-data");
}

/** Compute the patches that write the computed numbers into the metric's written `value` and `delta` (the safe fix of `metric-data-stale`). */
export function prepareMetricUpdate(presentation, blockPath) {
  const found = readMetricData(presentation, blockPath);
  if (!found) throw refuse("Choose a metric block to update its written numbers.", { path: blockPath });
  const patches = found.stale.flatMap((entry) => entry.fix?.patch ?? []);
  return finish(presentation, patches, { path: found.path, changed: patches.length > 0, lossless: true, loss: [] });
}
/** Write the computed numbers into the metric's written `value` and `delta` as one undoable step (the editor's Update button). */
export function updateMetricData(editor, blockPath, meta = {}) {
  requireEditor(editor);
  return apply(editor, prepareMetricUpdate(editor.presentation, blockPath), meta, "metric-update");
}

// --- structure inside one slide ----------------------------------------------------------------

/** One slide-level transform as a guarded replace of that slide. */
function slideAction(presentation, slideIndex, transform, targetPath, validate = true) {
  const slide = presentation.slides[slideIndex];
  const result = core(() => transform(slide));
  const path = result.path ? toDocumentPath(slideIndex, result.path) : (targetPath ?? `slides.${slideIndex}`);
  if (!result.changed) return unchanged(presentation, path);
  const patches = replacePatches(presentation, ["slides", String(slideIndex)], result.slide);
  return finish(presentation, patches, { path, changed: true, lossless: result.lossless, loss: result.loss }, validate);
}

/** Wrap the blocks at `indices` of the container at `containerPath` (a slide `slides.0` or a group) in a new group. */
export function prepareGroupBlocks(presentation, containerPath, indices, options = {}) {
  const { slideIndex, relative } = slideParts(presentation, containerPath, "a container");
  return slideAction(presentation, slideIndex, (slide) => wrapBlocks(slide, indices, { container: asNumbers(relative), ...(options.composition ? { composition: options.composition } : {}) }), undefined, options.validate !== false);
}
/** Replace the group at `groupPath` by its blocks. What the group carried (composition, id) is reported in `loss`. */
export function prepareUngroupBlock(presentation, groupPath, options = {}) {
  const { slideIndex, relative } = slideParts(presentation, groupPath, "a group");
  return slideAction(presentation, slideIndex, (slide) => unwrapGroup(slide, asNumbers(relative)), undefined, options.validate !== false);
}
/** Place every block of a slide in a cell of its grid: `regions[i]` is block i's cell, written as its `region` (`start`, `end`, `top:start`, ...; OPF 0.35). */
export function prepareBlocksToRegions(presentation, slideIndex, regions, options = {}) {
  slideParts(presentation, `slides.${slideIndex}`, "a slide");
  return slideAction(presentation, slideIndex, (slide) => blocksToRegions(slide, regions), undefined, options.validate !== false);
}
/** Take the blocks of a slide out of their cells, in reading order of the cells. The cells' placement is reported in `loss`. */
export function prepareRegionsToBlocks(presentation, slideIndex, options = {}) {
  slideParts(presentation, `slides.${slideIndex}`, "a slide");
  return slideAction(presentation, slideIndex, (slide) => regionsToBlocks(slide), undefined, options.validate !== false);
}
/** Move the blocks of cell `from` to cell `to`, or swap them when `to` is taken and `options.swap` is true. */
export function prepareMoveRegion(presentation, slideIndex, from, to, options = {}) {
  slideParts(presentation, `slides.${slideIndex}`, "a slide");
  return slideAction(presentation, slideIndex, (slide) => moveRegion(slide, from, to, options), undefined, options.validate !== false);
}
/** Move the image block at `blockPath` into the slide's design as its `background` or `watermark` (core's `promoteImage`). */
export function prepareImageToDesign(presentation, blockPath, target, options = {}) {
  const { slideIndex, relative } = slideParts(presentation, blockPath, "an image block");
  return slideAction(presentation, slideIndex, (slide) => promoteImage(slide, asNumbers(relative), target, options), `slides.${slideIndex}`, options.validate !== false);
}
/** Move a slide's own `background` image or `watermark` back into its content as an image block (core's `demoteImage`). */
export function prepareImageToContent(presentation, slideIndex, source, options = {}) {
  slideParts(presentation, `slides.${slideIndex}`, "a slide");
  return slideAction(presentation, slideIndex, (slide) => demoteImage(slide, source, options), undefined, options.validate !== false);
}

export const groupBlocks = (editor, containerPath, indices, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareGroupBlocks(editor.presentation, containerPath, indices, options), meta, "group-blocks"));
export const ungroupBlock = (editor, groupPath, meta = {}) => (requireEditor(editor), apply(editor, prepareUngroupBlock(editor.presentation, groupPath), meta, "ungroup-block"));
export const placeBlocksInRegions = (editor, slideIndex, regions, meta = {}) => (requireEditor(editor), apply(editor, prepareBlocksToRegions(editor.presentation, slideIndex, regions), meta, "blocks-to-regions"));
export const regionsAsBlocks = (editor, slideIndex, meta = {}) => (requireEditor(editor), apply(editor, prepareRegionsToBlocks(editor.presentation, slideIndex), meta, "regions-to-blocks"));
export const moveSlideRegion = (editor, slideIndex, from, to, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareMoveRegion(editor.presentation, slideIndex, from, to, options), meta, "move-region"));
export const moveImageToDesign = (editor, blockPath, target, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareImageToDesign(editor.presentation, blockPath, target, options), meta, "image-to-design"));
export const moveImageToContent = (editor, slideIndex, source, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareImageToContent(editor.presentation, slideIndex, source, options), meta, "image-to-content"));

// --- slides ------------------------------------------------------------------------------------

/**
 * Per-slide patches for replacing `range.deleteCount` slides from `range.start` by `slides`: a `test` for every
 * replaced slide, a `replace` for each one that changed, `remove` for the surplus old slides and `add` for the
 * surplus new ones, so a split or merge stays one guarded, undoable transaction without rewriting the other slides.
 */
function slidePatches(presentation, range, slides) {
  const old = presentation.slides.slice(range.start, range.start + range.deleteCount);
  const patches = old.map((slide, offset) => ({ op: "test", path: `/slides/${range.start + offset}`, value: structuredClone(slide) }));
  const common = Math.min(old.length, slides.length);
  for (let offset = 0; offset < common; offset++) if (JSON.stringify(old[offset]) !== JSON.stringify(slides[offset])) patches.push({ op: "replace", path: `/slides/${range.start + offset}`, value: structuredClone(slides[offset]) });
  for (let offset = old.length - 1; offset >= common; offset--) patches.push({ op: "remove", path: `/slides/${range.start + offset}` });
  for (let offset = common; offset < slides.length; offset++) patches.push({ op: "add", path: `/slides/${range.start + offset}`, value: structuredClone(slides[offset]) });
  return patches;
}
function slidesAction(presentation, result, extra = {}) {
  const path = `slides.${result.range.start}`;
  if (!result.changed) return unchanged(presentation, path, "Nothing to change.");
  return finish(presentation, slidePatches(presentation, result.range, result.slides), { path, changed: true, lossless: result.lossless, loss: result.loss, range: result.range, slideCount: result.slides.length, ...extra });
}

/** Split a slide by its blocks (`options.at`: block indexes where a new slide starts, or `options.each`). See core's `splitSlide`. */
export function prepareSplitSlide(presentation, slideIndex, options = {}) {
  return slidesAction(presentation, core(() => splitSlide(presentation, slideIndex, options)));
}
/** Split a slide that overflows into pages with the existing pagination (`options`: text measurement, fonts, as for core `paginate`). `pages` maps the new slides back for `prepareUnpaginate`. */
export function prepareSplitSlideOnOverflow(presentation, slideIndex, options = {}) {
  const result = core(() => splitSlideOnOverflowCore(presentation, slideIndex, options));
  return slidesAction(presentation, result, { pages: result.pages });
}
/** Merge `count` consecutive slides from `start`. The first slide's id, headings and design win; what is dropped is reported in `loss`. */
export function prepareMergeSlides(presentation, start, count = 2) {
  return slidesAction(presentation, core(() => mergeSlidesCore(presentation, start, count)));
}
/** Put the continuation slides of a pagination back into one slide each. `pages` is the mapping `splitSlideOnOverflow` or core `paginate` returned. */
export function prepareUnpaginate(presentation, pages, options = {}) {
  return slidesAction(presentation, core(() => unpaginate(presentation, pages, options)));
}

export const splitSlideByBlocks = (editor, slideIndex, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareSplitSlide(editor.presentation, slideIndex, options), meta, "split-slide"));
export const splitSlideOnOverflow = (editor, slideIndex, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareSplitSlideOnOverflow(editor.presentation, slideIndex, options), meta, "split-slide-overflow"));
export const mergeSlides = (editor, start, count = 2, meta = {}) => (requireEditor(editor), apply(editor, prepareMergeSlides(editor.presentation, start, count), meta, "merge-slides"));
export const unpaginateSlides = (editor, pages, options = {}, meta = {}) => (requireEditor(editor), apply(editor, prepareUnpaginate(editor.presentation, pages, options), meta, "unpaginate-slides"));
