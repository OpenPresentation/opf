// The table color scale (FR-07): which columns of a table are shaded by value and between which scheme colors. A table is
// `{ columns, rows, colorScale? }`, or `{ dataset, fields?, colorScale? }`. These helpers read the scale as form state and edit it as one
// validated, undoable patch, so the canvas re-shades at once and Undo restores the table. Colors are scheme names only (the scale follows
// the deck's colors); the numbers a column holds decide which columns are offered. A cell's own fill is not part of the scale: a cell with a
// `style.fill` keeps it (see `scaledCell`, which a cell inspector asks to say "Shaded by the color scale"). Nothing here invents text.
import { resolveTableData } from "@openpresentation/opf";
import { SCHEME_COLOR_NAMES } from "@openpresentation/opf/composition";
import { getValueAtPath, splitOpfPath } from "./index.js";
import { checkedDocument, fail, same } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";

/** The scheme colors a scale end may take (the schema's SchemeColorName). */
export const TABLE_SCALE_COLORS = Object.freeze([...SCHEME_COLOR_NAMES]);
/** The colors an absent `colors` means. */
export const TABLE_SCALE_DEFAULTS = Object.freeze({ colors: Object.freeze(["surface", "primary"]) });

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** The table path a selection path points at (`…table`, `…table.rows.0.1`), or undefined. */
export function parseTablePath(path) {
  let parts;
  try {
    parts = splitOpfPath(path);
  } catch {
    return undefined;
  }
  const index = parts.lastIndexOf("table");
  return index >= 1 ? parts.slice(0, index + 1).join(".") : undefined;
}

function tableAt(presentation, tablePath) {
  const table = getValueAtPath(presentation, splitOpfPath(tablePath));
  if (!isObject(table) || !(Array.isArray(table.rows) || typeof table.dataset === "string")) throw fail("table-not-found", "Choose a table (a path ending in .table).", { tablePath });
  return table;
}

const text = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  if (isObject(value)) return text("value" in value ? value.value : value.name ?? value.text);
  return "";
};
const numberOf = (cell) => {
  const value = isObject(cell) && "value" in cell ? cell.value : cell;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

/**
 * The scale as form state: `columns` (every column by header text, with whether it holds a number and whether the scale shades it), `kind`
 * (`none`, `sequential` or `diverging`), `colors` (two or three scheme color names, low to high, the defaults filled in), and `center`, `min`, `max`
 * (undefined while left to the data).
 */
export function readTableColorScale(table, presentation) {
  const resolved = resolveTableData(table, presentation);
  const scale = isObject(table?.colorScale) && Array.isArray(table.colorScale.columns) ? table.colorScale : undefined;
  const shaded = new Set(scale?.columns ?? []);
  const headers = (resolved.columns ?? []).map(text);
  const columns = headers.map((name, index) => ({ name, index, numeric: resolved.rows.some((row) => numberOf(row[index]) !== undefined), shaded: shaded.has(name) }));
  const colors = Array.isArray(scale?.colors) && scale.colors.length >= 2 ? [...scale.colors] : [...TABLE_SCALE_DEFAULTS.colors];
  return {
    columns,
    kind: !scale ? "none" : colors.length === 3 ? "diverging" : "sequential",
    colors,
    center: scale?.center,
    min: scale?.min,
    max: scale?.max,
  };
}

/** Whether a body cell is shaded by the table's scale: the scale names the cell's column, and the cell is a number with no fill of its own. */
export function scaledCell(table, presentation, row, column) {
  const state = readTableColorScale(table, presentation);
  if (!state.columns[column]?.shaded) return false;
  const cell = resolveTableData(table, presentation).rows[row]?.[column];
  return numberOf(cell) !== undefined && !(isObject(cell) && isObject(cell.style) && cell.style.fill != null);
}

const colorName = (value, what) => {
  if (!TABLE_SCALE_COLORS.includes(value)) throw fail("invalid-color-scale", `A color scale ${what} is a color of the deck's color scheme (${TABLE_SCALE_COLORS.join(", ")}).`, { value });
  return value;
};
const finite = (value, what) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw fail("invalid-color-scale", `The color scale's ${what} is a number.`, { value });
  return value;
};

/** The scale a change asks for, from the current one (undefined removes it). */
function desired(table, state, change) {
  if (change === null) return undefined;
  const next = { ...(isObject(table.colorScale) ? table.colorScale : {}) };
  if (change.columns !== undefined) {
    const names = state.columns.filter((column) => column.numeric).map((column) => column.name);
    const list = [...new Set(change.columns)];
    for (const name of list) if (!names.includes(name)) throw fail("invalid-color-scale", `"${name}" is not a column that holds numbers. Columns: ${names.join(", ") || "none"}.`, { column: name });
    if (!list.length) return undefined;
    next.columns = list;
  }
  if (!Array.isArray(next.columns) || !next.columns.length) throw fail("invalid-color-scale", "Name at least one column to shade.", {});
  let colors = Array.isArray(next.colors) ? [...next.colors] : [...TABLE_SCALE_DEFAULTS.colors];
  if (change.colors !== undefined) {
    if (change.colors === null) colors = [...TABLE_SCALE_DEFAULTS.colors];
    else if (!Array.isArray(change.colors) || change.colors.length < 2 || change.colors.length > 3) throw fail("invalid-color-scale", "A color scale takes two colors (sequential) or three (diverging), low to high.", { colors: change.colors });
    else colors = change.colors.map((value) => colorName(value, "color"));
  }
  if (change.kind === "sequential" && colors.length === 3) colors = [colors[0], colors[2]];
  if (change.kind === "diverging" && colors.length === 2) colors = [colors[0], "surface", colors[1]];
  const isDefault = colors.length === 2 && colors[0] === TABLE_SCALE_DEFAULTS.colors[0] && colors[1] === TABLE_SCALE_DEFAULTS.colors[1];
  if (isDefault) delete next.colors;
  else next.colors = colors;
  for (const key of ["center", "min", "max"]) {
    if (change[key] === undefined) continue;
    if (change[key] === null) delete next[key];
    else next[key] = finite(change[key], key);
  }
  if (colors.length !== 3) delete next.center;
  // The schema's key order: the columns, the colors, then the numbers.
  const ordered = {};
  for (const key of ["columns", "colors", "center", "min", "max"]) if (next[key] !== undefined) ordered[key] = next[key];
  return ordered;
}

/**
 * Prepare a color scale change as patches on the table (nothing is applied). `change` is `null` (remove the scale) or an object of
 * `columns` (header names of columns that hold numbers; an empty list removes the scale), `colors` (two or three scheme color names, low to high; `null`
 * returns the default `["surface", "primary"]`), `kind` (`sequential` drops the middle color, `diverging` adds `surface` in the middle) and `center`, `min`, `max`
 * (numbers; `null` leaves the value to the data; `center` goes when the scale has two colors). A color that is not a scheme name is refused. The document is not modified.
 */
export function prepareTableColorScale(presentation, tablePath, change) {
  const before = checkFormat(presentation);
  const table = tableAt(presentation, tablePath);
  const wanted = desired(table, readTableColorScale(table, presentation), change);
  const path = `${tablePath}.colorScale`;
  const present = table.colorScale !== undefined;
  const patches = [];
  if (wanted === undefined) {
    if (present) patches.push({ op: "remove", path });
  } else if (!present) patches.push({ op: "add", path, value: structuredClone(wanted) });
  else if (!same(table.colorScale, wanted)) patches.push({ op: "replace", path, value: structuredClone(wanted) });
  const next = checkedDocument(presentation, patches, before);
  return { action: "table-color-scale", tablePath, changed: patches.length > 0, patches, presentation: next };
}

/** Apply a color scale change to an editor session as one undoable edit. Returns the editor change. */
export function setTableColorScale(editor, tablePath, change, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const prepared = prepareTableColorScale(editor.presentation, tablePath, change);
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const applied = editor.applyPatch(patches, { ...meta, source: meta.source ?? "table-color-scale", action: prepared.action, path: tablePath });
  return { ...applied, ...summary };
}
