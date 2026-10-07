// Safe content-type conversion for one block (RR-06; RR-26 moved the converters into core).
// The pure converters live in `@openpresentation/opf/convert`: a conversion moves the block's own text into
// the new content type and never invents content, what a conversion cannot carry is reported in `loss`
// instead of being dropped silently, and a pair that has no meaningful mapping is refused. This module is the
// transaction around them: it finds the block, turns the converted payload into one guarded patch, validates
// the document, and applies it as one undoable step.
import { CONTENT_CONVERSIONS, CONTENT_KIND_LABELS, OPFConversionError, contentConversionTargets, convertContent, readContent } from "@openpresentation/opf/convert";
import { applyJsonPatch, getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { listBlockContainers } from "./blocks.js";
import { fail } from "./edit-helpers.js";
import { firstErrorMessage, errorFindings, checkFormat } from "./checks.js";

/** Every content kind a block can hold, with its display label. */
export const BLOCK_KIND_LABELS = CONTENT_KIND_LABELS;
/** The conversion matrix: source kind to the kinds it can convert to (core's `CONTENT_CONVERSIONS`). */
export const BLOCK_CONVERSIONS = CONTENT_CONVERSIONS;

const refuse = (message, details) => fail("block-not-convertible", message, details);
const CHOOSE = "Choose a block that holds one text, list, quote, metric, code, timeline, chart or table payload, or a group of metric blocks.";

/** Run a core conversion; a refusal becomes the editor's `block-not-convertible`. */
function convertOwner(owner, kind, options) {
  try {
    return convertContent(owner, kind, options);
  } catch (error) {
    if (error instanceof OPFConversionError) throw refuse(error.message, { ...error.details, kind });
    throw error;
  }
}

/**
 * The single content payload of the block at `path` (an explicit `blocks/N` block, or a slide or
 * region that holds exactly one content field), or a group of metric blocks (a `blocks` array in a
 * slide, region or group). Returns undefined when there is none.
 */
export function readBlockContent(presentation, path) {
  let parts;
  try {
    parts = splitOpfPath(path);
  } catch {
    return undefined;
  }
  const pointer = opfPathToJsonPointer(parts);
  const explicit = parts.at(-2) === "blocks" && /^(0|[1-9][0-9]*)$/.test(parts.at(-1) ?? "");
  const owner = getValueAtPath(presentation, parts);
  if (!owner || typeof owner !== "object" || Array.isArray(owner)) return undefined;
  if (Array.isArray(owner.blocks)) {
    // Only a set of metrics converts as a group; any other group has nothing to offer.
    if (!contentConversionTargets(owner).length) return undefined;
    return { path: parts, explicit, owner, key: "blocks", kind: "group", content: owner.blocks };
  }
  if (!explicit) {
    const implicit = listBlockContainers(presentation, { includeImplicit: true }).find((entry) => entry.path === pointer && entry.implicit);
    if (!implicit || implicit.count !== 1) return undefined;
  }
  const info = readContent(owner);
  if (!info) return undefined;
  return { path: parts, explicit, owner, key: info.key, kind: info.kind, content: info.content };
}

/** Whether `path` is inside a block and, if so, that block's path. A selection such as slides.0.blocks.1.text maps to slides.0.blocks.1. */
export function blockPathForSelection(presentation, selectedPath) {
  let parts;
  try {
    parts = splitOpfPath(selectedPath);
  } catch {
    return undefined;
  }
  for (let length = parts.length; length >= 2; length -= 1) {
    const candidate = parts.slice(0, length);
    if (candidate[0] !== "slides") return undefined;
    const found = readBlockContent(presentation, candidate);
    // A slide or region that holds one payload inline is a block only when the selection is that payload.
    if (found && found.kind !== "group" && (found.explicit || parts[length] === found.key)) return candidate.join(".");
  }
  return undefined;
}

/**
 * The nearest group of metric blocks around a selection (`slides.0.blocks.2.metric` finds `slides.0` when the
 * slide's blocks are all metrics), or undefined. A group of metrics converts to a table as a whole.
 */
export function metricGroupForSelection(presentation, selectedPath) {
  let parts;
  try {
    parts = splitOpfPath(selectedPath);
  } catch {
    return undefined;
  }
  if (parts[0] !== "slides") return undefined;
  for (let length = parts.length; length >= 2; length -= 1) {
    const candidate = parts.slice(0, length);
    const found = readBlockContent(presentation, candidate);
    if (found?.kind === "group") return candidate.join(".");
  }
  return undefined;
}

/**
 * The kinds the block at `path` can convert to, each with whether the conversion keeps everything
 * (`lossless`), what it cannot carry (`loss`), or why it is unavailable (`available: false`).
 * Returns [] for a block with no convertible content (image, video, a group that is not a set of metrics, several fields).
 * `options` are core's conversion options (`looseWhen`, `fences`, `headings`, `columns`, `delimiter`, `header`).
 */
export function blockConversionTargets(presentation, path, options = {}) {
  const found = readBlockContent(presentation, path);
  // RR-54: a table that shows a shared dataset needs the document's datasets to convert to anything but a chart.
  return found ? contentConversionTargets(found.owner, { presentation: presentation, ...options }) : [];
}

/**
 * Compute the patch that converts the block at `path` to `kind`, without touching a session.
 * Throws `block-not-convertible` for a pair with no safe mapping or content that does not fit.
 * `prepared.loss` lists what the target cannot carry; `lossless` is true when nothing is lost.
 */
export function prepareBlockConversion(presentation, path, kind, options = {}) {
  const found = readBlockContent(presentation, path);
  if (!found) throw refuse(CHOOSE, { path });
  const pointer = opfPathToJsonPointer(found.path);
  const from = found.kind;
  const result = convertOwner(found.owner, kind, { presentation: presentation, ...options });
  if (!result.changed) return { presentation: structuredClone(presentation), patches: [], path: found.path.join("."), changed: false, lossless: true, loss: [], from, to: kind };
  const patches = [
    { op: "test", path: pointer, value: structuredClone(found.owner) },
    { op: "replace", path: pointer, value: result.payload },
  ];
  const next = applyJsonPatch(presentation, patches);
  const validation = checkFormat(next);
  if (!validation.valid) throw fail("invalid-opf-edit", firstErrorMessage(validation, "The converted block is not valid OPF."), { issues: errorFindings(validation), patches });
  return { presentation: next, patches, path: found.path.join("."), changed: true, lossless: result.lossless, loss: result.loss, from, to: kind };
}

/**
 * Convert one block to another content kind as a single undoable transaction. Returns the session
 * change plus `lossless`, `loss`, `from` and `to`.
 */
export function convertBlock(editor, path, kind, meta = {}, options = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const prepared = prepareBlockConversion(editor.presentation, path, kind, options);
  const summary = { lossless: prepared.lossless, loss: prepared.loss, from: prepared.from, to: prepared.to, path: prepared.path, changed: prepared.changed };
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(prepared.patches, { ...meta, source: meta.source ?? "block-conversion", blockPath: prepared.path, from: prepared.from, to: prepared.to });
  return { ...change, ...summary };
}
