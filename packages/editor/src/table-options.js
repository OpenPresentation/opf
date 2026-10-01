// Table style and cell merge (RR-06). A table is `{ columns?, rows }`; a cell is a plain value or a
// styled cell `{ value, style?, colSpan?, rowSpan? }`, and every grid position a merge covers holds
// `null`. These helpers edit that structure as one validated, undoable patch (a test guard on the
// table plus one replace), so the canvas redraws the styled and merged table and Undo restores it.
// Cells are addressed by `{ section: "header" | "body", row, column }`; `row` is ignored for the
// header section. Nothing here invents text: merging cells that hold text refuses unless you pass
// `join: true`, which keeps every word in the merged cell.
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath, validateOpfDocument } from "./index.js";
import { checkedDocument, fail } from "./edit-helpers.js";

/**
 * Table styles. A style is `{ header, banding, borders }`. The renderers' table defaults are a header
 * filled with the scheme's primary color, surface-filled body cells, automatic text contrast and thin
 * theme-colored borders; `theme` leaves each of those alone. Named presets for `setTableStyle`:
 * `theme` (no overrides), `banded`, `grid`, `minimal` (plain header, horizontal rules) and `open`
 * (plain header, no borders).
 */
export const TABLE_STYLE_PRESETS = Object.freeze({
  theme: Object.freeze({ header: "theme", banding: false, borders: "theme" }),
  banded: Object.freeze({ header: "theme", banding: true, borders: "theme" }),
  grid: Object.freeze({ header: "theme", banding: false, borders: "grid" }),
  minimal: Object.freeze({ header: "plain", banding: false, borders: "horizontal" }),
  open: Object.freeze({ header: "plain", banding: false, borders: "none" }),
});
export const TABLE_HEADER_STYLES = Object.freeze(["theme", "plain", "accent"]);
export const TABLE_BORDER_STYLES = Object.freeze(["theme", "none", "horizontal", "grid"]);
// The style fields a table style owns; text color, alignment and padding are never touched.
const STYLE_KEYS = ["fill", "borders"];
const HEADER_FILL = Object.freeze({ plain: "surface", accent: "accent" });
const BAND_FILL = "background";
const RULE_COLOR = "textSecondary";

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isStyled = (cell) => isObject(cell) && Object.hasOwn(cell, "value");
const valueOf = (cell) => (isStyled(cell) ? cell.value : cell);
const isEmptyValue = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.every((run) => (typeof run === "string" ? run === "" : run?.text === "")));
const clone = (value) => structuredClone(value);

/** The table path and cell a selection path points at (`…table.rows.1.2`, `…table.rows.1.2.value`, `…table.columns.0`), or undefined. */
export function parseTableCellPath(path) {
  let parts;
  try {
    parts = splitOpfPath(path);
  } catch {
    return undefined;
  }
  for (let index = parts.length - 2; index >= 1; index -= 1) {
    if (parts[index - 1] !== "table") continue;
    const kind = parts[index];
    const tablePath = parts.slice(0, index).join(".");
    if (kind === "columns" && /^(0|[1-9]\d*)$/.test(parts[index + 1] ?? "")) return { tablePath, cell: { section: "header", row: 0, column: Number(parts[index + 1]) } };
    if (kind === "rows" && /^(0|[1-9]\d*)$/.test(parts[index + 1] ?? "") && /^(0|[1-9]\d*)$/.test(parts[index + 2] ?? ""))
      return { tablePath, cell: { section: "body", row: Number(parts[index + 1]), column: Number(parts[index + 2]) } };
  }
  return undefined;
}

function tableAt(document, tablePath) {
  const parts = splitOpfPath(tablePath);
  const table = getValueAtPath(document, parts);
  if (!isObject(table) || !Array.isArray(table.rows)) throw fail("table-not-found", "Choose a table (a path ending in .table).", { tablePath });
  return { parts, table };
}

function widthOf(table) {
  return Math.max(table.columns?.length ?? 0, ...table.rows.map((row) => row.length));
}

function lineOf(table, cell) {
  if (cell.section === "header") {
    if (!Array.isArray(table.columns)) throw fail("table-cell-not-found", "This table has no header row.", { cell });
    return table.columns;
  }
  const line = table.rows[cell.row];
  if (!Array.isArray(line)) throw fail("table-cell-not-found", `Row ${cell.row + 1} does not exist.`, { cell });
  return line;
}

function cellAt(table, cell) {
  const line = lineOf(table, cell);
  if (!Number.isInteger(cell.column) || cell.column < 0 || cell.column >= line.length) throw fail("table-cell-not-found", `Column ${cell.column + 1} does not exist.`, { cell });
  return line[cell.column];
}

function spans(raw) {
  return { colSpan: isStyled(raw) ? (raw.colSpan ?? 1) : 1, rowSpan: isStyled(raw) ? (raw.rowSpan ?? 1) : 1 };
}

/** Merge anchors of the table as rectangles `{section, row, column, rowSpan, colSpan}`. */
export function tableMerges(table) {
  const merges = [];
  const visit = (line, section, row) =>
    line?.forEach((raw, column) => {
      const { colSpan, rowSpan } = spans(raw);
      if (colSpan > 1 || rowSpan > 1) merges.push({ section, row, column, rowSpan, colSpan });
    });
  visit(table.columns, "header", 0);
  table.rows.forEach((line, row) => visit(line, "body", row));
  return merges;
}

/**
 * The state of one cell for a panel: its value, style, spans, whether it is a merge anchor and, for a
 * covered position, the merge that covers it.
 */
export function describeTableCell(table, cell) {
  const raw = cellAt(table, cell);
  const merge = tableMerges(table).find(
    (entry) => entry.section === cell.section && cell.column >= entry.column && cell.column < entry.column + entry.colSpan && (cell.section === "header" || (cell.row >= entry.row && cell.row < entry.row + entry.rowSpan)),
  );
  const anchor = merge && merge.column === cell.column && (cell.section === "header" || merge.row === cell.row);
  const { colSpan, rowSpan } = spans(raw);
  return {
    ...cell,
    value: valueOf(raw),
    style: isStyled(raw) ? (raw.style ?? {}) : {},
    colSpan,
    rowSpan,
    merged: Boolean(merge),
    anchor: Boolean(anchor),
    covered: Boolean(merge) && !anchor,
    ...(merge && !anchor ? { anchorCell: { section: merge.section, row: merge.row, column: merge.column } } : {}),
    columns: widthOf(table),
    rows: table.rows.length,
  };
}

function plainText(value) {
  return Array.isArray(value) ? value.map((run) => (typeof run === "string" ? run : run.text)).join("") : String(value);
}

function joinedValue(values) {
  const parts = values.filter((value) => !isEmptyValue(value));
  if (parts.some(Array.isArray)) {
    const runs = [];
    parts.forEach((value, index) => {
      if (index > 0) runs.push(" ");
      runs.push(...(Array.isArray(value) ? clone(value) : [String(value)]));
    });
    return runs;
  }
  if (parts.length === 1) return parts[0];
  return parts.map(plainText).join(" ");
}

function withCell(raw, patch) {
  // A styled cell with no style and no spans collapses back to the plain value.
  const merged = isStyled(raw) ? { ...raw } : { value: raw };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || (key === "style" && isObject(value) && !Object.keys(value).length)) delete merged[key];
    else merged[key] = value;
  }
  const keys = Object.keys(merged);
  return keys.length === 1 && keys[0] === "value" ? merged.value : merged;
}

function transaction(document, tablePath, change, extra = {}) {
  const { parts, table } = tableAt(document, tablePath);
  const next = clone(table);
  const info = change(next);
  const pointer = opfPathToJsonPointer(parts);
  const changed = JSON.stringify(table) !== JSON.stringify(next);
  const patches = changed ? [{ op: "test", path: pointer, value: clone(table) }, { op: "replace", path: pointer, value: next }] : [];
  const before = validateOpfDocument(document);
  const result = changed ? checkedDocument(document, patches, before) : document;
  return { ...extra, ...info, tablePath: parts.join("."), document: clone(result), patches, changed };
}

// --- merge and split ---------------------------------------------------------------------------

function unmerge(table, cell) {
  const line = lineOf(table, cell);
  const raw = line[cell.column];
  const { colSpan, rowSpan } = spans(raw);
  if (colSpan === 1 && rowSpan === 1) return false;
  for (let r = 0; r < rowSpan; r += 1)
    for (let c = 0; c < colSpan; c += 1) {
      if (r === 0 && c === 0) continue;
      const target = cell.section === "header" ? table.columns : table.rows[cell.row + r];
      if (Array.isArray(target) && target[cell.column + c] === null) target[cell.column + c] = "";
    }
  line[cell.column] = withCell(raw, { colSpan: undefined, rowSpan: undefined });
  return true;
}

/**
 * Compute the patch that merges a rectangle of cells starting at `cell` (the anchor, top left) into one
 * cell spanning `colSpan` columns and `rowSpan` rows. The anchor keeps its value and style; covered
 * positions become `null`. Throws `merge-would-lose-content` when a covered cell holds text, unless
 * `options.join` is true (the words are joined with a space into the anchor, formatting kept), and
 * `merge-overlap` for a rectangle that crosses another merged cell. A header cell merges across the
 * header only (`rowSpan` 1). Re-merging an anchor first undoes its old merge.
 */
export function prepareTableMerge(document, tablePath, cell, span, options = {}) {
  const colSpan = span.colSpan ?? 1;
  const rowSpan = span.rowSpan ?? 1;
  if (!Number.isInteger(colSpan) || colSpan < 1 || !Number.isInteger(rowSpan) || rowSpan < 1) throw fail("invalid-table-span", "Spans are whole numbers of 1 or more.", { span });
  return transaction(document, tablePath, (table) => {
    const target = { section: cell.section, row: cell.section === "header" ? 0 : cell.row, column: cell.column };
    const existing = describeTableCell(table, target);
    if (existing.covered) throw fail("merge-overlap", "This cell is covered by a merged cell. Select the merged cell itself.", { cell });
    unmerge(table, target);
    if (colSpan === 1 && rowSpan === 1) return { merged: false };
    if (target.section === "header" && rowSpan > 1) throw fail("invalid-table-span", "A header cell cannot span into the body rows.", { span });
    if (target.column + colSpan > widthOf(table)) throw fail("invalid-table-span", `Only ${widthOf(table) - target.column} column(s) are available from this cell.`, { span });
    if (target.section === "body" && target.row + rowSpan > table.rows.length) throw fail("invalid-table-span", `Only ${table.rows.length - target.row} row(s) are available from this cell.`, { span });
    const lines = [];
    for (let r = 0; r < rowSpan; r += 1) lines.push({ row: target.row + r, line: target.section === "header" ? table.columns : table.rows[target.row + r] });
    const covered = [];
    for (const { row, line } of lines)
      for (let c = 0; c < colSpan; c += 1) {
        const column = target.column + c;
        if (row === lines[0].row && c === 0) continue;
        if (column >= line.length) throw fail("invalid-table-span", "The merged region leaves the table.", { span });
        const raw = line[column];
        const entry = describeTableCell(table, { section: target.section, row, column });
        if (entry.merged) throw fail("merge-overlap", `The region crosses a merged cell at row ${row + 1}, column ${column + 1}. Split it first.`, { cell, span });
        covered.push({ line, column, value: valueOf(raw) });
      }
    const filled = covered.filter((entry) => !isEmptyValue(entry.value));
    let anchorValue = valueOf(lineOf(table, target)[target.column]);
    if (filled.length) {
      if (!options.join) throw fail("merge-would-lose-content", "Merging would hide text in the covered cells. Move it first, or merge and keep it by joining the text.", { cell, span, cells: filled.length });
      anchorValue = joinedValue([anchorValue, ...filled.map((entry) => entry.value)]);
    }
    for (const entry of covered) entry.line[entry.column] = null;
    const anchorLine = lineOf(table, target);
    const raw = anchorLine[target.column];
    anchorLine[target.column] = withCell(isStyled(raw) ? { ...raw, value: anchorValue } : anchorValue, { colSpan: colSpan > 1 ? colSpan : undefined, rowSpan: rowSpan > 1 ? rowSpan : undefined });
    return { merged: true, joined: filled.length > 0 };
  }, { action: "merge", cell, span: { colSpan, rowSpan } });
}

/** Compute the patch that splits a merged cell back into single cells (covered positions become empty text). */
export function prepareTableSplit(document, tablePath, cell) {
  return transaction(document, tablePath, (table) => {
    const target = { section: cell.section, row: cell.section === "header" ? 0 : cell.row, column: cell.column };
    const entry = describeTableCell(table, target);
    if (entry.covered) throw fail("table-cell-covered", "This position is covered by a merged cell. Select the merged cell to split it.", { cell });
    return { split: unmerge(table, target) };
  }, { action: "split", cell });
}

// --- cell style and table style ---------------------------------------------------------------

/**
 * Compute the patch that changes the style of the cells. `style` fields merge into each cell's style
 * (fill, color, align, verticalAlign, padding, borders); a `null` field removes it, and `style: null`
 * clears the whole style. Covered (merged) positions are skipped. A cell left with no style or spans
 * becomes a plain value again. Style is appearance only: values and spans are untouched.
 */
export function prepareTableCellStyle(document, tablePath, cells, style) {
  const list = Array.isArray(cells) ? cells : [cells];
  if (!list.length) throw fail("table-cell-not-found", "Choose at least one cell.", {});
  if (style !== null && !isObject(style)) throw fail("invalid-table-style", "A cell style is an object, or null to clear it.", { style });
  return transaction(document, tablePath, (table) => {
    let skipped = 0;
    for (const cell of list) {
      const target = { section: cell.section, row: cell.section === "header" ? 0 : cell.row, column: cell.column };
      const line = lineOf(table, target);
      const raw = cellAt(table, target);
      if (raw === null) {
        skipped += 1;
        continue;
      }
      const current = isStyled(raw) ? { ...(raw.style ?? {}) } : {};
      let nextStyle;
      if (style === null) nextStyle = {};
      else {
        nextStyle = current;
        for (const [key, value] of Object.entries(style)) {
          if (value === null || value === undefined) delete nextStyle[key];
          else nextStyle[key] = clone(value);
        }
      }
      line[target.column] = withCell(raw, { style: nextStyle });
    }
    return { skipped };
  }, { action: "style" });
}

function bordersFor(mode) {
  if (mode === "theme") return undefined;
  const edge = (width) => ({ color: RULE_COLOR, width });
  if (mode === "none") return { top: edge(0), right: edge(0), bottom: edge(0), left: edge(0) };
  if (mode === "horizontal") return { top: edge(1), right: edge(0), bottom: edge(1), left: edge(0) };
  return { top: edge(1), right: edge(1), bottom: edge(1), left: edge(1) };
}

function styleFor(table, style) {
  const width = widthOf(table);
  const result = [];
  const visit = (section, row) => {
    for (let column = 0; column < width; column += 1) {
      const wanted = {};
      if (section === "header" && style.header !== "theme") wanted.fill = HEADER_FILL[style.header];
      if (section === "body" && style.banding && row % 2 === 1) wanted.fill = BAND_FILL;
      const borders = bordersFor(style.borders);
      if (borders) wanted.borders = borders;
      result.push({ cell: { section, row, column }, style: wanted });
    }
  };
  if (Array.isArray(table.columns)) visit("header", 0);
  table.rows.forEach((_, row) => visit("body", row));
  return result;
}

function resolveStyle(preset) {
  const base = typeof preset === "string" ? TABLE_STYLE_PRESETS[preset] : preset;
  if (!base || !isObject(base)) throw fail("invalid-table-style", `Choose a table style: ${Object.keys(TABLE_STYLE_PRESETS).join(", ")}, or { header, banding, borders }.`, { preset });
  const style = { header: base.header ?? "theme", banding: Boolean(base.banding), borders: base.borders ?? "theme" };
  if (!TABLE_HEADER_STYLES.includes(style.header)) throw fail("invalid-table-style", `Header is one of ${TABLE_HEADER_STYLES.join(", ")}.`, { preset });
  if (!TABLE_BORDER_STYLES.includes(style.borders)) throw fail("invalid-table-style", `Borders are one of ${TABLE_BORDER_STYLES.join(", ")}.`, { preset });
  return style;
}

/**
 * Compute the patch that applies a table style: `{ header, banding, borders }` (a missing field means
 * `theme`/false) or a named preset from `TABLE_STYLE_PRESETS`. It sets the header fill, the
 * alternating body-row fill and the cell borders, and clears those fields on every other cell, so
 * `theme` removes a previous style. Text color, alignment, padding, values and merges are kept.
 * Fills use scheme roles (surface, accent, background), so they follow the color scheme and the
 * renderers' automatic text contrast keeps text readable.
 */
export function prepareTableStyle(document, tablePath, preset) {
  const style = resolveStyle(preset);
  return transaction(document, tablePath, (table) => {
    styleTable(table, style);
    return {};
  }, { action: "table-style", style });
}

function styleTable(table, style) {
  for (const { cell, style: wanted } of styleFor(table, style)) {
    const line = lineOf(table, cell);
    const raw = line[cell.column];
    if (raw === null) continue;
    const current = isStyled(raw) ? { ...(raw.style ?? {}) } : {};
    for (const key of STYLE_KEYS) delete current[key];
    line[cell.column] = withCell(raw, { style: { ...current, ...wanted } });
  }
}

/**
 * Apply a table style (a preset name or `{ header, banding, borders }`) to a table object in place, with the same
 * rules as {@link prepareTableStyle}. The table structure operations use it to keep a recognised style
 * (banding, header fill, borders) correct after rows or columns are inserted, deleted, moved or sorted.
 */
export function applyTableStyleToTable(table, preset) {
  const style = resolveStyle(preset);
  styleTable(table, style);
  return style;
}

/**
 * The table's current style: `{ header, banding, borders, preset }`, or "custom" in every field when
 * its fills and borders are not one of the styles this module writes (for example hand-set fills).
 * `preset` is the named preset the style equals, or "custom".
 */
export function readTableStyle(document, tablePath) {
  return readTableStyleOfTable(tableAt(document, tablePath).table);
}

/** {@link readTableStyle} for a table object. */
export function readTableStyleOfTable(table) {
  const matches = (style) =>
    styleFor(table, style).every(({ cell, style: wanted }) => {
      const raw = lineOf(table, cell)[cell.column];
      if (raw === null) return true;
      const current = isStyled(raw) ? (raw.style ?? {}) : {};
      return STYLE_KEYS.every((key) => JSON.stringify(current[key]) === JSON.stringify(wanted[key]));
    });
  for (const header of TABLE_HEADER_STYLES)
    for (const banding of [false, true])
      for (const borders of TABLE_BORDER_STYLES)
        if (matches({ header, banding, borders })) {
          const preset = Object.entries(TABLE_STYLE_PRESETS).find(([, value]) => value.header === header && value.banding === banding && value.borders === borders)?.[0] ?? "custom";
          return { header, banding, borders, preset };
        }
  return { header: "custom", banding: "custom", borders: "custom", preset: "custom" };
}

// Table structure (RR-24): insert, delete, move and sort rows and columns, the header row, cell values.
export * from "./table-structure.js";

// --- session forms ----------------------------------------------------------------------------

function commit(editor, prepared, meta = {}) {
  const { document, patches, ...summary } = prepared;
  void document;
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  if (!prepared.changed) return { ...summary, document: editor.document, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? "table-option", action: prepared.action, path: prepared.tablePath });
  return { ...change, ...summary };
}
function checkEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}
/** Merge cells as one undoable transaction. See {@link prepareTableMerge}. */
export function mergeTableCells(editor, tablePath, cell, span, options = {}) {
  checkEditor(editor);
  const { meta, ...rest } = options;
  return commit(editor, prepareTableMerge(editor.document, tablePath, cell, span, rest), meta);
}
/** Split a merged cell as one undoable transaction. */
export function splitTableCell(editor, tablePath, cell, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareTableSplit(editor.document, tablePath, cell), meta);
}
/** Style cells as one undoable transaction. See {@link prepareTableCellStyle}. */
export function setTableCellStyle(editor, tablePath, cells, style, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareTableCellStyle(editor.document, tablePath, cells, style), meta);
}
/** Apply a table style as one undoable transaction. See {@link prepareTableStyle}. */
export function setTableStyle(editor, tablePath, preset, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareTableStyle(editor.document, tablePath, preset), meta);
}
