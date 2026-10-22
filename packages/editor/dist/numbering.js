// List numbering (RR-33): the headless model behind the numbering control. A list payload (`items` or `bullets`) can
// carry `numbering`: a style name, a { style, start, suffix } object, or an array with one entry per list level. Every
// write goes through the session as a validated JSON Patch edit, so each change is one undoable edit. Importing this
// module needs no DOM.
import { listNumbers } from "@openpresentation/opf/composition";
import { OPFEditorError, getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";

/** The number styles and how each draws, in the order a picker lists them. */
export const NUMBERING_STYLE_OPTIONS = Object.freeze([
  { value: "arabic", label: "1, 2, 3", sample: "1" },
  { value: "roman-upper", label: "I, II, III", sample: "I" },
  { value: "roman-lower", label: "i, ii, iii", sample: "i" },
  { value: "alpha-upper", label: "A, B, C", sample: "A" },
  { value: "alpha-lower", label: "a, b, c", sample: "a" },
]);
/** The suffixes: the text drawn after the number. */
export const NUMBERING_SUFFIX_OPTIONS = Object.freeze([
  { value: "period", label: "1.", sample: "." },
  { value: "paren", label: "1)", sample: ")" },
  { value: "paren-both", label: "(1)", sample: "()" },
]);
/** Largest list depth a native paragraph can carry, and so the most level entries `numbering` holds. */
export const MAX_NUMBERING_LEVELS = 9;
/** Largest start (and counted number) a native auto-number can hold. */
export const MAX_NUMBERING_START = 32767;

const DEFAULT_LEVEL = Object.freeze({ style: "arabic", start: 1, suffix: "period" });
const STYLES = NUMBERING_STYLE_OPTIONS.map((option) => option.value);
const SUFFIXES = NUMBERING_SUFFIX_OPTIONS.map((option) => option.value);
const FIELDS = ["items", "bullets"];
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function fail(code, message, details) {
  return new OPFEditorError(code, message, details);
}

function checkEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") {
    throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  }
}

/**
 * Where a list lives for a path that points at it or into it: `slides.0.items`, `slides.0.items.2` or
 * `slides.0.left.items.1.text` all resolve to the payload that owns the list. Returns undefined when the path is not
 * inside a list.
 */
export function listPayloadAt(presentation, path) {
  let segments;
  try {
    segments = splitOpfPath(path);
  } catch {
    return undefined;
  }
  for (let index = 0; index < segments.length; index++) {
    if (!FIELDS.includes(segments[index])) continue;
    const next = segments[index + 1];
    if (next !== undefined && !/^\d+$/.test(next)) continue;
    const payloadPath = segments.slice(0, index);
    const payload = payloadPath.length ? getValueAtPath(presentation, payloadPath) : presentation;
    if (!isObject(payload) || !Array.isArray(payload[segments[index]])) continue;
    const entry = next === undefined ? undefined : Number(next);
    return { payloadPath: payloadPath.join("."), field: segments[index], path: [...payloadPath, segments[index]].join("."), payload, entry };
  }
  return undefined;
}

const isRegionKey = (key) => /^(?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*(?::(?:left|center|right)(?:\+(?:left|center|right))*)?|(?:left|center|right)(?:\+(?:left|center|right))*)$/.test(key);

/** Every list (`items` or `bullets`) of a slide: its path, label, entry count and whether it is numbered. */
export function findNumberableLists(presentation, slideIndex) {
  const slide = presentation?.slides?.[slideIndex];
  if (!isObject(slide)) return [];
  const found = [];
  const visit = (payload, base, label, depth = 0) => {
    if (!isObject(payload) || depth > 32) return;
    for (const field of FIELDS) {
      if (Array.isArray(payload[field])) found.push({ path: `${base}.${field}`, payloadPath: base, field, label: found.some((entry) => entry.label === label) ? `${label} (${field})` : label, count: payload[field].length, numbered: payload.numbering !== undefined });
    }
    if (Array.isArray(payload.blocks)) payload.blocks.forEach((block, index) => visit(block, `${base}.blocks.${index}`, `${label} › Block ${index + 1}`, depth + 1));
  };
  const base = `slides.${slideIndex}`;
  visit(slide, base, `Slide ${slideIndex + 1}`);
  for (const key of Object.keys(slide)) if (isRegionKey(key)) visit(slide[key], `${base}.${key}`, `Slide ${slideIndex + 1} › ${key}`);
  return found;
}

function resolveLevels(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.map((entry) => (typeof entry === "string"
    ? { ...DEFAULT_LEVEL, style: entry }
    : { style: entry?.style ?? DEFAULT_LEVEL.style, start: entry?.start ?? DEFAULT_LEVEL.start, suffix: entry?.suffix ?? DEFAULT_LEVEL.suffix }));
}

const sameLevel = (a, b) => a.style === b.style && a.start === b.start && a.suffix === b.suffix;

function levelEntry({ style, start, suffix }) {
  const fields = { ...(style !== "arabic" ? { style } : {}), ...(start !== 1 ? { start } : {}), ...(suffix !== "period" ? { suffix } : {}) };
  const names = Object.keys(fields);
  if (!names.length) return "arabic";
  return names.length === 1 && names[0] === "style" ? style : fields;
}

/**
 * The shortest `numbering` value for a list of per-level settings: one entry when every level matches (a style name when
 * only the style is not the default, else an object holding just the non-default fields), otherwise an array with the
 * redundant trailing entries dropped (the last entry repeats for deeper levels).
 */
export function numberingValue(levels) {
  const list = levels.map((level) => ({ ...DEFAULT_LEVEL, ...level }));
  if (!list.length) throw fail("invalid-numbering", "Numbering needs at least one level.");
  if (list.length > MAX_NUMBERING_LEVELS) throw fail("invalid-numbering", `Numbering holds at most ${MAX_NUMBERING_LEVELS} levels.`);
  for (const [index, level] of list.entries()) {
    if (!STYLES.includes(level.style)) throw fail("invalid-numbering", `Level ${index + 1}: unknown style '${level.style}'.`, { level: index });
    if (!SUFFIXES.includes(level.suffix)) throw fail("invalid-numbering", `Level ${index + 1}: unknown suffix '${level.suffix}'.`, { level: index });
    if (!Number.isInteger(level.start) || level.start < 1 || level.start > MAX_NUMBERING_START) throw fail("invalid-numbering", `Level ${index + 1}: start must be a whole number from 1 to ${MAX_NUMBERING_START}.`, { level: index });
  }
  while (list.length > 1 && sameLevel(list.at(-1), list.at(-2))) list.pop();
  const entries = list.map(levelEntry);
  return entries.length === 1 ? entries[0] : entries;
}

const maxLevelOf = (items) => items.reduce((max, item) => Math.max(max, isObject(item) && Number.isInteger(item.level) ? item.level : 0), 0);

/**
 * The numbering state of the list a path points at: whether it is numbered, its settings per level (one entry when the
 * numbering applies to every level), the number of levels the list uses, the markers it draws and which entry (if any)
 * the path selects with that entry's own `start`.
 */
export function numberingState(presentation, path) {
  const target = listPayloadAt(presentation, path);
  if (!target) return undefined;
  const { payload, field, entry } = target;
  const items = payload[field];
  const numbering = payload.numbering;
  const numbered = numbering !== undefined;
  const levels = numbered ? resolveLevels(numbering) : [{ ...DEFAULT_LEVEL }];
  const depth = Math.min(MAX_NUMBERING_LEVELS, maxLevelOf(items) + 1);
  let markers = [];
  if (numbered) {
    try {
      markers = listNumbers(items, numbering).map((number) => ({ index: number.index, level: number.level, text: number.text, value: number.value, adapted: number.adapted }));
    } catch {
      markers = [];
    }
  }
  const selected = entry === undefined ? undefined : items[entry];
  return {
    path: target.path,
    payloadPath: target.payloadPath,
    field,
    count: items.length,
    numbered,
    perLevel: levels.length > 1,
    levels,
    depth,
    value: numbering,
    markers,
    entry: entry === undefined || selected === undefined ? undefined : { index: entry, start: isObject(selected) ? selected.start : undefined, marker: markers[entry]?.text },
  };
}

function numberingPointer(target) {
  return opfPathToJsonPointer(target.payloadPath ? `${target.payloadPath}.numbering` : "numbering");
}

/**
 * Number a list, change how it is numbered, or turn numbering off, as one undoable validated edit. `value` is a
 * `numbering` value (see {@link numberingValue}), or `undefined` / `null` to remove it; turning numbering off also removes
 * the entry `start` values, which mean nothing without it. `path` addresses the list or anything inside it.
 */
export function setNumbering(editor, path, value, meta = {}) {
  checkEditor(editor);
  const target = listPayloadAt(editor.presentation, path);
  if (!target) throw fail("not-a-list", "Select a list (items or bullets) to number.", { path });
  const patches = [];
  const present = Object.hasOwn(target.payload, "numbering");
  if (value === undefined || value === null) {
    if (!present) return { presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
    patches.push({ op: "remove", path: numberingPointer(target) });
    target.payload[target.field].forEach((item, index) => {
      if (isObject(item) && item.start !== undefined) patches.push({ op: "remove", path: opfPathToJsonPointer(`${target.path}.${index}.start`) });
    });
  } else {
    patches.push({ op: present ? "replace" : "add", path: numberingPointer(target), value: structuredClone(value) });
  }
  return editor.applyPatch(patches, { source: "list-numbering", rejectInvalid: true, ...meta });
}

/**
 * Restart the numbering at an entry: the entry shows `start`, and the entries after it continue from it. `undefined` / `null`
 * removes the restart. A plain entry (a string or runs) becomes the object form to carry it. One undoable validated edit.
 */
export function setEntryStart(editor, itemPath, start, meta = {}) {
  checkEditor(editor);
  const target = listPayloadAt(editor.presentation, itemPath);
  if (!target || target.entry === undefined) throw fail("not-an-entry", "Select a list entry to restart its numbering.", { path: itemPath });
  if (target.payload.numbering === undefined) throw fail("not-numbered", "Number the list first; an entry start has no effect on a bulleted list.", { path: itemPath });
  const item = target.payload[target.field][target.entry];
  const pointer = opfPathToJsonPointer(`${target.path}.${target.entry}`);
  const patches = [];
  if (start === undefined || start === null) {
    if (isObject(item) && item.start !== undefined) patches.push({ op: "remove", path: `${pointer}/start` });
  } else {
    if (!Number.isInteger(start) || start < 1 || start > MAX_NUMBERING_START) throw fail("invalid-numbering", `An entry start is a whole number from 1 to ${MAX_NUMBERING_START}.`, { start });
    if (isObject(item)) patches.push({ op: item.start === undefined ? "add" : "replace", path: `${pointer}/start`, value: start });
    else patches.push({ op: "replace", path: pointer, value: { text: structuredClone(item), start } });
  }
  if (!patches.length) return { presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  return editor.applyPatch(patches, { source: "list-numbering-start", rejectInvalid: true, ...meta });
}
