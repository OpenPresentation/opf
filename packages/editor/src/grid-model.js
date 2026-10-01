// The data model behind the data grid (RR-24): one table-shaped view of a chart's inline data and of a
// table, and every edit to it as one validated, undoable patch.
//
// A chart is `{ type, data: { columns, rows } }`: `columns` are labels, `rows` are arrays aligned to them. The
// first column holds the categories (the x axis, or the slice names) and every further column is one series,
// named by its column label, in the order the renderer draws them. (A scatter chart reads its x values from the
// second column when it has three or more; a chart type that needs one column only reads the first.) A table is
// `{ columns?, rows }` whose cells are plain values, rich runs or styled cells with spans, as table-options.js
// describes.
//
// Both are read as "lines": the header line (when there is one) followed by the body rows. The operations below
// change lines and columns, keep merged cells whole or refuse with a reason, and return a `{ document, patches,
// changed }` description like table-options.js does. Nothing here touches a DOM.
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath, validateOpfDocument } from "./index.js";
import { checkedDocument, fail } from "./edit-helpers.js";
import { richTextContent, updateRichTextInput } from "./rich-text.js";
import { formatGridNumber, isCanonicalNumber, parseDelimited, parseGridNumber, resolveNumberFormat, toDelimited } from "./grid-text.js";
import { applyTableStyleToTable, readTableStyleOfTable } from "./table-options.js";

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isStyled = (cell) => isObject(cell) && Object.hasOwn(cell, "value");
const valueOf = (cell) => (isStyled(cell) ? cell.value : cell);
const clone = (value) => structuredClone(value);
const spansOf = (raw) => ({ rs: isStyled(raw) ? (raw.rowSpan ?? 1) : 1, cs: isStyled(raw) ? (raw.colSpan ?? 1) : 1 });

/** Spreadsheet column letters: 0 is A, 25 is Z, 26 is AA. */
export function columnLabel(index) {
  let label = "";
  let n = index + 1;
  while (n > 0) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

const decimalOf = (options = {}) => (options.decimal === "," || options.decimal === "." ? options.decimal : resolveNumberFormat(options.numberFormat ?? ".", options.locale).decimal);

// --- locating ----------------------------------------------------------------------------------

/**
 * Find the data a path points at. A chart path ends in `chart` (or `chart.data`) and a table path in `table`.
 * Throws `grid-target-not-found`, `table-not-found` or `chart-data-source` (a chart that reads its data from a source
 * has no inline data to edit).
 */
export function locateGridData(document, path) {
  let parts;
  try {
    parts = Array.isArray(path) ? [...path] : splitOpfPath(path);
  } catch {
    throw fail("grid-target-not-found", "Choose a chart or a table.", { path });
  }
  if (parts.at(-1) === "data" && parts.at(-2) === "chart") parts = parts.slice(0, -1);
  const owner = getValueAtPath(document, parts);
  if (parts.at(-1) === "chart") {
    if (!isObject(owner) || !isObject(owner.data)) throw fail("grid-target-not-found", "This chart has no data.", { path });
    const data = owner.data;
    if (!Array.isArray(data.columns) || !Array.isArray(data.rows))
      throw fail("chart-data-source", "This chart reads its data from a source (src), not from inline columns and rows. The data grid edits inline chart data.", { path });
    return { kind: "chart", parts, dataParts: [...parts, "data"], data, chartType: typeof owner.type === "string" ? owner.type : undefined };
  }
  if (parts.at(-1) === "table") {
    if (!isObject(owner) || !Array.isArray(owner.rows)) throw fail("table-not-found", "Choose a table (a path ending in .table).", { path });
    return { kind: "table", parts, dataParts: parts, data: owner };
  }
  throw fail("grid-target-not-found", "Choose a chart or a table (a path ending in .chart or .table).", { path });
}

/**
 * The chart or table a selection path belongs to: `{ kind, path }` for `…chart`, `…chart.data.rows.1.0`, `…table`,
 * `…table.rows.1.2.value`, and so on. A chart whose data comes from a source is `{ kind: "chart", path, editable: false,
 * reason }`. Returns undefined when the path is not inside a chart or table.
 */
export function resolveDataGridTarget(document, selectedPath) {
  let parts;
  try {
    parts = splitOpfPath(selectedPath);
  } catch {
    return undefined;
  }
  for (let index = parts.length - 1; index >= 1; index -= 1) {
    if (parts[index] !== "chart" && parts[index] !== "table") continue;
    const head = parts.slice(0, index + 1);
    try {
      const found = locateGridData(document, head);
      return { kind: found.kind, path: head.join(".") };
    } catch (error) {
      if (error.code === "chart-data-source") return { kind: "chart", path: head.join("."), editable: false, reason: error.message };
    }
  }
  return undefined;
}

// --- lines -------------------------------------------------------------------------------------

function toModel(found) {
  const { kind, data } = found;
  const hasHeader = kind === "chart" ? true : Array.isArray(data.columns);
  const lines = [...(hasHeader ? [clone(data.columns)] : []), ...clone(data.rows).map((row) => (Array.isArray(row) ? row : [row]))];
  const model = { kind, hasHeader, lines, width: 0, chartType: found.chartType };
  model.width = widthOf(model);
  return model;
}

function fromModel(model, original) {
  const rest = Object.fromEntries(Object.entries(original).filter(([key]) => key !== "columns" && key !== "rows"));
  const out = {};
  if (model.hasHeader) out.columns = model.lines[0];
  out.rows = model.lines.slice(model.hasHeader ? 1 : 0);
  return { ...out, ...rest };
}

const widthOf = (model) => model.lines.reduce((most, line) => Math.max(most, line.length), 0);
const offset = (model) => (model.hasHeader ? 1 : 0);
const bodyCount = (model) => model.lines.length - offset(model);
const filler = (model, u) => (model.kind === "chart" && !(model.hasHeader && u === 0) ? null : "");

function padLines(model) {
  model.width = widthOf(model);
  model.lines.forEach((line, u) => {
    while (line.length < model.width) line.push(filler(model, u));
  });
}

const addressOf = (model, u) => (model.hasHeader && u === 0 ? { section: "header", row: 0 } : { section: "body", row: u - offset(model) });

function lineIndex(model, address) {
  if (address.section === "header") {
    if (!model.hasHeader) throw fail("grid-cell-not-found", "This table has no header row.", { cell: address });
    return 0;
  }
  if (!Number.isInteger(address.row) || address.row < 0) throw fail("grid-cell-not-found", "Choose an existing row.", { cell: address });
  return address.row + offset(model);
}

/** A cell's description for messages: "Header, column B" or "Row 3, column A". */
export function describeAddress(address) {
  return `${address.section === "header" ? "Header" : `Row ${address.row + 1}`}, column ${columnLabel(address.column)}`;
}

// --- merges ------------------------------------------------------------------------------------

function rectsOf(model) {
  const out = [];
  model.lines.forEach((line, u) =>
    line.forEach((raw, c) => {
      const { rs, cs } = spansOf(raw);
      if (rs > 1 || cs > 1) out.push({ u, c, rs, cs });
    }),
  );
  return out;
}

function ownersOf(model) {
  const owners = new Map();
  for (const rect of rectsOf(model))
    for (let y = rect.u; y < rect.u + rect.rs; y += 1)
      for (let x = rect.c; x < rect.c + rect.cs; x += 1) if (y !== rect.u || x !== rect.c) owners.set(`${y}:${x}`, rect);
  return owners;
}

function withSpans(raw, rs, cs) {
  const merged = isStyled(raw) ? { ...raw } : { value: raw };
  if (rs > 1) merged.rowSpan = rs;
  else delete merged.rowSpan;
  if (cs > 1) merged.colSpan = cs;
  else delete merged.colSpan;
  const keys = Object.keys(merged);
  return keys.length === 1 && keys[0] === "value" ? merged.value : merged;
}

/** Problems in the merged cells of a model: a span that leaves the grid, crosses another, or covers a cell that is not null. */
function mergeProblems(model) {
  const problems = [];
  const claimed = new Set();
  for (const rect of rectsOf(model)) {
    const where = describeAddress({ ...addressOf(model, rect.u), column: rect.c });
    if (rect.u + rect.rs > model.lines.length || rect.c + rect.cs > model.width) problems.push(`The merged cell at ${where} would leave the table.`);
    if (model.hasHeader && rect.u === 0 && rect.rs > 1) problems.push(`The merged header cell at ${where} would span into the body.`);
    for (let y = rect.u; y < rect.u + rect.rs; y += 1)
      for (let x = rect.c; x < rect.c + rect.cs; x += 1) {
        if (y === rect.u && x === rect.c) continue;
        const key = `${y}:${x}`;
        if (claimed.has(key)) problems.push(`Merged cells overlap at ${describeAddress({ ...addressOf(model, y), column: x })}.`);
        claimed.add(key);
        if (model.lines[y]?.[x] !== null) problems.push(`The merged cell at ${where} would cover text at ${describeAddress({ ...addressOf(model, y), column: x })}.`);
      }
  }
  return problems;
}

function assertMerges(model, before, what) {
  const problems = mergeProblems(model);
  if (problems.length > before) throw fail("table-merge-conflict", `${what} would break a merged cell. ${problems[0]} Split the merged cells first.`, { problems });
}

// --- cell text ---------------------------------------------------------------------------------

/**
 * The text a cell shows. A table cell shows exactly what the slide draws (a number as JavaScript writes it); a chart
 * cell shows its number in the grid's number format. Rich runs show their text, gaps and covered cells are "".
 */
export function cellText(raw, kind, decimal = ".") {
  const value = valueOf(raw);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return richTextContent(value);
  if (typeof value === "number") return kind === "chart" ? formatGridNumber(value, { decimal }) : String(value);
  return String(value);
}

const looksNumeric = (value) => typeof value === "number" ? Number.isFinite(value) : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
const isScatter = (type) => typeof type === "string" && /^(scatter|bubble)/.test(type);

/** What each column of a chart is for: "category" (column A), "series", and for a scatter chart with three or more columns "label" and "x". */
export function chartColumnRoles(columnCount, chartType) {
  if (columnCount <= 1) return Array(columnCount).fill("series");
  if (isScatter(chartType) && columnCount >= 3) return ["label", "x", ...Array(columnCount - 2).fill("series")];
  return ["category", ...Array(columnCount - 1).fill("series")];
}

const isNumericColumn = (model, column) => model.kind === "chart" && !["category", "label"].includes(chartColumnRoles(model.width, model.chartType)[column] ?? "series");

// --- describing --------------------------------------------------------------------------------

/**
 * Describe a chart or table as a grid for display: `lines` (the header line first when `hasHeader`) of cells
 * `{ line, column, section, row, text, rich, runs, rowSpan, colSpan, covered, owner, warning, style }`. A covered
 * cell has `covered: true` and its anchor in `owner`; its `text` is "". `warnings` lists data problems the document
 * already has (text in a series column the renderer draws as a gap, an empty or repeated series name, a missing category).
 */
export function describeDataGrid(document, path, options = {}) {
  const found = locateGridData(document, path);
  const decimal = decimalOf(options);
  const model = toModel(found);
  padLines(model);
  const owners = ownersOf(model);
  const roles = model.kind === "chart" ? chartColumnRoles(model.width, model.chartType) : [];
  const warnings = [];
  const names = new Map();
  const lines = model.lines.map((line, u) =>
    line.map((raw, column) => {
      const address = addressOf(model, u);
      const owner = owners.get(`${u}:${column}`);
      const { rs, cs } = spansOf(raw);
      const value = valueOf(raw);
      const cell = {
        line: u,
        column,
        section: address.section,
        row: address.row,
        text: owner ? "" : cellText(raw, model.kind, decimal),
        rich: Array.isArray(value),
        rowSpan: rs,
        colSpan: cs,
        covered: Boolean(owner),
      };
      if (Array.isArray(value)) cell.runs = value;
      if (isStyled(raw) && raw.style) cell.style = raw.style;
      if (owner) cell.owner = { line: owner.u, column: owner.c };
      if (model.kind === "chart") {
        let warning;
        if (u === 0) {
          const name = String(value ?? "");
          if (column > 0 || model.width === 1) {
            if (name.trim() === "") warning = "This series has no name.";
            else if (names.has(name)) warning = `Another series is also named "${name}".`;
            names.set(name, column);
          }
        } else if (roles[column] === "category" || roles[column] === "label") {
          if (roles[column] === "category" && (value === null || value === undefined || value === "")) warning = "This row has no category label.";
        } else if (typeof value === "boolean") warning = "A yes/no value is not a number, so the chart draws a gap here.";
        else if (value !== null && value !== undefined && !(typeof value === "number" || looksNumeric(value)) && String(value).trim() !== "")
          warning = "This is not a number, so the chart draws a gap here.";
        if (warning) {
          cell.warning = warning;
          warnings.push({ section: address.section, row: address.row, column, message: `${describeAddress({ ...address, column })}: ${warning}` });
        }
      }
      return cell;
    }),
  );
  return {
    kind: model.kind,
    path: found.parts.join("."),
    chartType: found.chartType,
    hasHeader: model.hasHeader,
    rowCount: bodyCount(model),
    columnCount: model.width,
    columnRoles: roles,
    lines,
    warnings,
    merges: rectsOf(model).map((rect) => ({ ...addressOf(model, rect.u), column: rect.c, rowSpan: rect.rs, colSpan: rect.cs })),
  };
}

// --- patches -----------------------------------------------------------------------------------

const MAX_FINE_PATCHES = 48;

function diffInto(parts, before, after, ops) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    before.forEach((entry, index) => diffInto([...parts, String(index)], entry, after[index], ops));
    return;
  }
  if (isObject(before) && isObject(after)) {
    for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) ops.push({ op: "remove", parts: [...parts, key], before: before[key] });
    for (const key of Object.keys(after)) {
      if (!Object.hasOwn(before, key)) ops.push({ op: "add", parts: [...parts, key], value: after[key] });
      else diffInto([...parts, key], before[key], after[key], ops);
    }
    return;
  }
  ops.push({ op: "replace", parts, before, value: after });
}

/**
 * The smallest patch from `before` to `after` at `parts`: one guarded `replace` per changed cell (a single cell edit
 * is one operation), or one guarded replacement of the whole value when many things changed, the shape did or a key was added or removed.
 */
export function gridPatches(parts, before, after) {
  const ops = [];
  diffInto(parts, before, after, ops);
  if (!ops.length) return [];
  // Adding or removing a key (the header row's `columns`) is one guarded replacement, so Undo restores the object with its keys in their old order.
  if (ops.length > MAX_FINE_PATCHES || ops.some((entry) => entry.op !== "replace")) {
    const pointer = opfPathToJsonPointer(parts);
    return [{ op: "test", path: pointer, value: clone(before) }, { op: "replace", path: pointer, value: clone(after) }];
  }
  const patches = [];
  for (const entry of ops) {
    const pointer = opfPathToJsonPointer(entry.parts);
    if (entry.op !== "add") patches.push({ op: "test", path: pointer, value: clone(entry.before) });
    patches.push(entry.op === "remove" ? { op: "remove", path: pointer } : { op: entry.op, path: pointer, value: clone(entry.value) });
  }
  return patches;
}

function transact(document, path, action, mutate, extra = {}) {
  const found = locateGridData(document, path);
  if (extra.kind && extra.kind !== found.kind) throw fail("grid-wrong-kind", `This operation works on a ${extra.kind}, and the path points at a ${found.kind}.`, { path });
  const model = toModel(found);
  const problemsBefore = mergeProblems(model).length;
  const info = mutate(model, found) ?? {};
  const style = info.restyle && found.kind === "table" ? readTableStyleOfTable(found.data) : undefined;
  if (info.touchesStructure) assertMerges(model, problemsBefore, info.what ?? "This change");
  if (style && style.preset !== "custom") padLines(model);
  const after = fromModel(model, found.data);
  if (style && style.preset !== "custom") applyTableStyleToTable(after, style.preset);
  const patches = gridPatches(found.dataParts, found.data, after);
  const changed = patches.length > 0;
  const before = validateOpfDocument(document);
  const result = changed ? checkedDocument(document, patches, before) : document;
  // `restyle`, `touchesStructure` and `what` steer this function only; the rest of what the operation reports is the caller's.
  const { restyle: _restyle, touchesStructure: _structure, what: _what, ...summary } = info;
  return { action, ...summary, kind: found.kind, path: found.parts.join("."), document: clone(result), patches, changed };
}

// --- row and column structure ------------------------------------------------------------------

function referenceCell(model, line, column) {
  const raw = line?.[column];
  if (model.kind !== "table" || !isStyled(raw) || !raw.style) return "";
  return Object.keys(raw.style).length ? { value: "", style: clone(raw.style) } : "";
}

function insertRows(model, at, count) {
  if (!Number.isInteger(at) || at < 0 || at > bodyCount(model)) throw fail("grid-row-out-of-range", `A row can be inserted at positions 1 to ${bodyCount(model) + 1}.`, { at });
  padLines(model);
  const u = at + offset(model);
  const crossing = rectsOf(model).filter((rect) => rect.u < u && u < rect.u + rect.rs);
  const reference = u - 1 >= offset(model) ? model.lines[u - 1] : u < model.lines.length ? model.lines[u] : undefined;
  const fresh = Array.from({ length: count }, () => Array.from({ length: model.width }, (_, column) => (model.kind === "chart" ? null : referenceCell(model, reference, column))));
  model.lines.splice(u, 0, ...fresh);
  for (const rect of crossing) {
    model.lines[rect.u][rect.c] = withSpans(model.lines[rect.u][rect.c], rect.rs + count, rect.cs);
    for (let i = 0; i < count; i += 1) for (let x = rect.c; x < rect.c + rect.cs; x += 1) model.lines[u + i][x] = null;
  }
}

function deleteRow(model, u) {
  for (const rect of rectsOf(model)) {
    if (!(rect.u <= u && u < rect.u + rect.rs) || rect.rs === 1) continue;
    const anchor = model.lines[rect.u][rect.c];
    if (rect.u < u) model.lines[rect.u][rect.c] = withSpans(anchor, rect.rs - 1, rect.cs);
    // The merge's first row is deleted: the merged cell keeps its text and moves to the next row.
    else model.lines[u + 1][rect.c] = withSpans(anchor, rect.rs - 1, rect.cs);
  }
  model.lines.splice(u, 1);
}

function deleteRows(model, indices) {
  const unique = [...new Set(indices)].sort((a, b) => b - a);
  if (!unique.length) throw fail("grid-row-out-of-range", "Choose at least one row.", {});
  for (const index of unique) if (!Number.isInteger(index) || index < 0 || index >= bodyCount(model)) throw fail("grid-row-out-of-range", `Row ${index + 1} does not exist.`, { index });
  if (unique.length >= bodyCount(model)) throw fail("grid-last-row", `${model.kind === "chart" ? "A chart" : "A table"} keeps at least one row.`, {});
  padLines(model);
  for (const index of unique) deleteRow(model, index + offset(model));
}

function insertColumns(model, at, count) {
  padLines(model);
  if (!Number.isInteger(at) || at < 0 || at > model.width) throw fail("grid-column-out-of-range", `A column can be inserted at positions 1 to ${model.width + 1}.`, { at });
  const crossing = rectsOf(model).filter((rect) => rect.c < at && at < rect.c + rect.cs);
  const reference = at - 1 >= 0 ? at - 1 : at < model.width ? at : -1;
  model.lines.forEach((line, u) => {
    const fresh = Array.from({ length: count }, () => (model.kind === "chart" || (model.hasHeader && u === 0) ? filler(model, u) : referenceCell(model, line, reference)));
    line.splice(at, 0, ...fresh);
  });
  for (const rect of crossing) {
    model.lines[rect.u][rect.c] = withSpans(model.lines[rect.u][rect.c], rect.rs, rect.cs + count);
    for (let y = rect.u; y < rect.u + rect.rs; y += 1) for (let i = 0; i < count; i += 1) model.lines[y][at + i] = null;
  }
  model.width += count;
}

function deleteColumn(model, x) {
  for (const rect of rectsOf(model)) {
    if (!(rect.c <= x && x < rect.c + rect.cs) || rect.cs === 1) continue;
    const anchor = model.lines[rect.u][rect.c];
    if (rect.c < x) model.lines[rect.u][rect.c] = withSpans(anchor, rect.rs, rect.cs - 1);
    else model.lines[rect.u][x + 1] = withSpans(anchor, rect.rs, rect.cs - 1);
  }
  for (const line of model.lines) line.splice(x, 1);
  model.width -= 1;
}

function deleteColumns(model, indices) {
  padLines(model);
  const unique = [...new Set(indices)].sort((a, b) => b - a);
  if (!unique.length) throw fail("grid-column-out-of-range", "Choose at least one column.", {});
  for (const index of unique) if (!Number.isInteger(index) || index < 0 || index >= model.width) throw fail("grid-column-out-of-range", `Column ${columnLabel(index)} does not exist.`, { index });
  if (unique.length >= model.width) throw fail("grid-last-column", `${model.kind === "chart" ? "A chart" : "A table"} keeps at least one column.`, {});
  for (const index of unique) deleteColumn(model, index);
}

function moveBlock(array, from, count, to) {
  const moved = array.splice(from, count);
  array.splice(to, 0, ...moved);
}

function moveRows(model, from, count, to) {
  const max = bodyCount(model);
  if (![from, count, to].every(Number.isInteger) || count < 1 || from < 0 || from + count > max || to < 0 || to + count > max)
    throw fail("grid-row-out-of-range", "That move leaves the table.", { from, count, to });
  if (from === to) return;
  moveBlock(model.lines, from + offset(model), count, to + offset(model));
}

function moveColumns(model, from, count, to) {
  padLines(model);
  if (![from, count, to].every(Number.isInteger) || count < 1 || from < 0 || from + count > model.width || to < 0 || to + count > model.width)
    throw fail("grid-column-out-of-range", "That move leaves the table.", { from, count, to });
  if (from === to) return;
  for (const line of model.lines) moveBlock(line, from, count, to);
}

// --- sorting -----------------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function sortKey(raw, decimal, type) {
  const value = valueOf(raw);
  const text = cellText(raw, "table", decimal);
  if (value === null || value === undefined || text.trim() === "") return { rank: 3, text };
  if (typeof value === "number") return type === "text" ? { rank: 2, text } : { rank: 0, n: value, text };
  if (typeof value === "string") {
    if (type === "auto" || type === "number") {
      const parsed = parseGridNumber(value, { decimal });
      if (parsed.value !== undefined) return { rank: 0, n: parsed.value, text };
    }
    if ((type === "auto" || type === "date") && ISO_DATE.test(text.trim())) {
      const time = Date.parse(text.trim().replace(" ", "T"));
      if (Number.isFinite(time)) return { rank: 1, n: time, text };
    }
  }
  return { rank: 2, text };
}

function sortRows(model, column, options) {
  const { direction = "asc", type = "auto", locale } = options;
  if (direction !== "asc" && direction !== "desc") throw fail("invalid-sort", "Sort ascending or descending.", { direction });
  if (!["auto", "text", "number", "date"].includes(type)) throw fail("invalid-sort", "Sort as auto, text, number or date.", { type });
  padLines(model);
  if (!Number.isInteger(column) || column < 0 || column >= model.width) throw fail("grid-column-out-of-range", "Choose a column to sort by.", { column });
  const decimal = decimalOf(options);
  const start = offset(model);
  const count = bodyCount(model);
  if (count < 2) return { sorted: false };
  const owners = ownersOf(model);
  const rects = rectsOf(model);
  // Rows joined by a merged cell that spans rows move as one block, in their own order.
  const joined = new Array(model.lines.length).fill(0).map((_, index) => index);
  const find = (index) => (joined[index] === index ? index : (joined[index] = find(joined[index])));
  for (const rect of rects) for (let y = rect.u + 1; y < rect.u + rect.rs; y += 1) joined[find(y)] = find(rect.u);
  const blocks = [];
  for (let u = start; u < model.lines.length; u += 1) {
    const last = blocks.at(-1);
    if (last && find(last.rows[0]) === find(u)) last.rows.push(u);
    else blocks.push({ rows: [u] });
  }
  const effective = (u) => {
    const raw = model.lines[u][column];
    if (raw !== null) return raw;
    const owner = owners.get(`${u}:${column}`);
    return owner ? model.lines[owner.u][owner.c] : null;
  };
  const keys = blocks.map((block) => sortKey(effective(block.rows[0]), decimal, type));
  const collator = new Intl.Collator(locale || undefined, { numeric: true, sensitivity: "base" });
  const sign = direction === "desc" ? -1 : 1;
  const order = blocks.map((_, index) => index).sort((a, b) => {
    const left = keys[a];
    const right = keys[b];
    if (left.rank === 3 || right.rank === 3) return left.rank === right.rank ? a - b : left.rank === 3 ? 1 : -1;
    let result;
    if (left.rank !== right.rank) result = left.rank - right.rank;
    else if (left.rank === 2) result = collator.compare(left.text, right.text);
    else result = left.n - right.n;
    return result === 0 ? a - b : sign * result;
  });
  const moved = order.some((index, position) => index !== position);
  if (!moved) return { sorted: false };
  const body = order.flatMap((index) => blocks[index].rows.map((u) => model.lines[u]));
  model.lines.splice(start, count, ...body);
  return { sorted: true, touchesStructure: true, what: "Sorting" };
}

// --- header ------------------------------------------------------------------------------------

function setHeader(model, enabled, options) {
  if (model.kind !== "table") throw fail("grid-wrong-kind", "Only a table has a header row to turn on or off. A chart's first line always names its series.", {});
  if (enabled === model.hasHeader) return {};
  padLines(model);
  if (enabled) {
    const use = options.use ?? (model.lines.length >= 2 ? "first-row" : "new");
    if (use !== "first-row" && use !== "new") throw fail("invalid-header-source", "Use the first row, or add a new empty header row.", { use });
    if (use === "first-row") {
      if (model.lines.length < 2) throw fail("table-header-needs-rows", "A table needs a second row to keep as its body. Add a new empty header row instead.", {});
      if (rectsOf(model).some((rect) => rect.u === 0 && rect.rs > 1)) throw fail("table-header-merge", "The first row has merged cells that span rows, and a header cannot span into the body. Split them first.", {});
      // A header label is text, runs or a styled cell: numbers and yes/no values become their text.
      model.lines[0] = model.lines[0].map((raw) => {
        const value = valueOf(raw);
        if (typeof value !== "number" && typeof value !== "boolean") return raw;
        return isStyled(raw) ? { ...raw, value: String(value) } : String(value);
      });
    } else model.lines.unshift(Array.from({ length: model.width }, () => ""));
    model.hasHeader = true;
    return { header: true, use, restyle: true, touchesStructure: true, what: "A header row" };
  }
  model.hasHeader = false;
  return { header: false, restyle: true };
}

// --- transpose ---------------------------------------------------------------------------------

function transposeChart(model) {
  if (model.kind !== "chart") throw fail("grid-wrong-kind", "Only chart data can be transposed.", {});
  padLines(model);
  if (model.width < 2) throw fail("chart-transpose-empty", "Transposing needs at least one series column besides the categories.", {});
  const [names, ...rows] = model.lines;
  let relabelled = 0;
  const categories = rows.map((row) => {
    const category = row[0];
    if (category === null || category === undefined) return "";
    if (typeof category !== "string") relabelled += 1;
    return String(category);
  });
  const lines = [[names[0], ...categories], ...names.slice(1).map((name, index) => [name, ...rows.map((row) => row[index + 1] ?? null)])];
  model.lines = lines;
  model.width = widthOf(model);
  return { rowsBefore: rows.length, columnsBefore: names.length, relabelled };
}

// --- cell edits --------------------------------------------------------------------------------

function growTo(model, lines, width) {
  padLines(model);
  while (model.lines.length < lines) model.lines.push(Array.from({ length: model.width }, () => (model.kind === "chart" ? null : "")));
  while (model.width < width) {
    model.lines.forEach((line, u) => line.push(filler(model, u)));
    model.width += 1;
  }
}

function newRaw(model, raw, text, decimal, address) {
  const value = valueOf(raw);
  // Text that is already what the cell shows is left alone: a number kept as text stays text, runs keep their styling.
  const shown = cellText(raw, model.kind, decimal);
  if (Array.isArray(value)) {
    if (text.replace(/\r\n?/g, "\n") === shown.replace(/\r\n?/g, "\n")) return { skip: true };
    return { raw: isStyled(raw) ? { ...raw, value: updateRichTextInput(value, text) } : updateRichTextInput(value, text) };
  }
  if (text === shown) return { skip: true };
  let next;
  if (model.kind === "table") {
    if (model.hasHeader && address.section === "header") next = text;
    else next = text === "" ? "" : isCanonicalNumber(text) ? Number(text) : text;
  } else if (address.section === "header") next = text;
  else if (isNumericColumn(model, address.column)) {
    const parsed = parseGridNumber(text, { decimal });
    if (parsed.error) return { error: parsed.error };
    next = parsed.empty ? null : parsed.value;
    if (next === null && (value === null || value === undefined)) return { skip: true };
  } else next = text === "" ? null : text;
  return { raw: isStyled(raw) ? { ...raw, value: next } : next };
}

function applyEdits(model, edits, decimal, owners) {
  const issues = [];
  for (const edit of edits) {
    const address = { section: edit.section, row: edit.row ?? 0, column: edit.column };
    try {
      const u = lineIndex(model, address);
      if (!Number.isInteger(address.column) || address.column < 0 || address.column >= model.width || u >= model.lines.length) throw fail("grid-cell-not-found", `${describeAddress(address)} does not exist.`, { cell: address });
      if (owners.has(`${u}:${address.column}`)) throw fail("table-cell-covered", `${describeAddress(address)} is covered by a merged cell. Edit the merged cell, or split it first.`, { cell: address });
      const line = model.lines[u];
      while (line.length <= address.column) line.push(filler(model, u));
      const raw = line[address.column];
      if (Object.hasOwn(edit, "value")) {
        const value = edit.value;
        if (model.kind === "chart" && !(value === null || ["string", "number", "boolean"].includes(typeof value))) throw fail("invalid-grid-value", "A chart cell is text, a number, true or false, or empty.", { cell: address });
        if (typeof value === "number" && !Number.isFinite(value)) throw fail("invalid-grid-value", "A cell cannot hold Infinity or NaN.", { cell: address });
        model.lines[u][address.column] = isStyled(raw) ? { ...raw, value } : value;
        continue;
      }
      if (typeof edit.text !== "string") throw fail("invalid-grid-value", "Give the cell's new text.", { cell: address });
      const outcome = newRaw(model, raw, edit.text, decimal, address);
      if (outcome.error) issues.push({ ...address, message: `${describeAddress(address)}: ${outcome.error}` });
      else if (!outcome.skip) model.lines[u][address.column] = outcome.raw;
    } catch (error) {
      issues.push({ ...address, message: error.message });
    }
  }
  return issues;
}

function refuse(issues) {
  const first = issues[0];
  const extra = issues.length > 1 ? ` (${issues.length - 1} more cell${issues.length > 2 ? "s" : ""} have problems too.)` : "";
  return fail("invalid-grid-values", `${first.message}${extra}`, { issues });
}

function setCells(model, edits, options) {
  if (!Array.isArray(edits) || !edits.length) throw fail("invalid-grid-value", "Give at least one cell edit.", {});
  const issues = applyEdits(model, edits, decimalOf(options), ownersOf(model));
  if (issues.length) throw refuse(issues);
  return { cells: edits.length };
}

function pasteRows(model, anchor, matrix, options) {
  if (!Array.isArray(matrix) || !matrix.length) throw fail("invalid-grid-value", "There is nothing to paste.", {});
  const first = decimalOf(options);
  const attempt = (decimal) => {
    const trial = { ...model, lines: clone(model.lines) };
    const u0 = lineIndex(trial, anchor);
    const width = matrix.reduce((most, row) => Math.max(most, row.length), 0);
    growTo(trial, u0 + matrix.length, anchor.column + width);
    const owners = ownersOf(trial);
    const edits = [];
    matrix.forEach((row, r) => {
      const address = addressOf(trial, u0 + r);
      for (let c = 0; c < row.length; c += 1) edits.push({ section: address.section, row: address.row, column: anchor.column + c, text: row[c] ?? "" });
    });
    const issues = applyEdits(trial, edits, decimal, owners);
    return { trial, issues, cells: edits.length };
  };
  let result = attempt(first);
  let decimal = first;
  if (result.issues.length && model.kind === "chart") {
    // Pasted from a spreadsheet in the other number format: read the whole paste that way when that clears every problem.
    const other = first === "." ? "," : ".";
    const second = attempt(other);
    if (!second.issues.length) {
      result = second;
      decimal = other;
    }
  }
  if (result.issues.length) throw refuse(result.issues);
  model.lines = result.trial.lines;
  model.width = result.trial.width;
  return { cells: result.cells, decimal, rows: matrix.length, restyle: true, touchesStructure: model.kind === "table", what: "Pasting" };
}

/**
 * The problems `edits` would have, without applying or validating the document (cheap enough to run on every keystroke): a list of
 * `{ section, row, column, message }`, empty when every edit is fine.
 */
export function gridCellIssues(document, path, edits, options = {}) {
  const model = toModel(locateGridData(document, path));
  return applyEdits(model, edits, decimalOf(options), ownersOf(model));
}

// --- prepare* ----------------------------------------------------------------------------------

const countOf = (count) => {
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw fail("invalid-count", "Insert between 1 and 1000 at a time.", { count });
  return count;
};
const kindOf = (options) => (options?.kind ? { kind: options.kind } : {});

/** Set cells from text (or typed `value`s): `edits` are `{ section, row, column, text | value }`. One patch; every problem is listed in `error.issues` and nothing is applied. */
export function prepareGridCells(document, path, edits, options = {}) {
  return transact(document, path, "set-cells", (model) => setCells(model, edits, options), kindOf(options));
}

/**
 * Paste rows of text at a cell. `source` is TSV/CSV text or an array of rows of strings. The block overwrites cells from `anchor`
 * (`{ section, row, column }`) and adds the rows and columns it needs. Chart numbers are read in the number format of
 * `options` (`decimal`, or `numberFormat` and `locale`); when that fails and the other format reads all of the paste, that is used and
 * reported as `decimal`. A table paste over a merged cell's covered positions is refused. One patch.
 */
export function preparePaste(document, path, anchor, source, options = {}) {
  const rows = typeof source === "string" ? parseDelimited(source, { delimiter: options.delimiter }).rows : source;
  return transact(document, path, "paste", (model) => pasteRows(model, anchor, rows, options), kindOf(options));
}

/** Insert `count` empty rows so the first is body row `at` (0 is above the first row; the row count appends). A merged cell that spans the position grows. */
export function prepareInsertRows(document, path, at, count = 1, options = {}) {
  return transact(document, path, "insert-rows", (model) => {
    insertRows(model, at, countOf(count));
    return { at, count, restyle: true, touchesStructure: true, what: "Inserting rows" };
  }, kindOf(options));
}

/** Delete the body rows at `indices`. A merged cell that spans a deleted row shrinks and keeps its text. The last row cannot be deleted. */
export function prepareDeleteRows(document, path, indices, options = {}) {
  return transact(document, path, "delete-rows", (model) => {
    deleteRows(model, indices);
    return { indices: [...indices], restyle: true, touchesStructure: true, what: "Deleting rows" };
  }, kindOf(options));
}

/** Move `count` rows starting at body row `from` so the first is at `to`. Refused with the reason when it would split a merged cell. */
export function prepareMoveRows(document, path, from, to, count = 1, options = {}) {
  return transact(document, path, "move-rows", (model) => {
    moveRows(model, from, count, to);
    return { from, to, count, restyle: true, touchesStructure: true, what: "Moving rows" };
  }, kindOf(options));
}

/** Insert `count` empty columns so the first is column `at`. A merged cell that spans the position grows. */
export function prepareInsertColumns(document, path, at, count = 1, options = {}) {
  return transact(document, path, "insert-columns", (model) => {
    insertColumns(model, at, countOf(count));
    return { at, count, restyle: true, touchesStructure: true, what: "Inserting columns" };
  }, kindOf(options));
}

/** Delete the columns at `indices`. A merged cell that spans a deleted column shrinks and keeps its text. The last column cannot be deleted. */
export function prepareDeleteColumns(document, path, indices, options = {}) {
  return transact(document, path, "delete-columns", (model) => {
    deleteColumns(model, indices);
    return { indices: [...indices], restyle: true, touchesStructure: true, what: "Deleting columns" };
  }, kindOf(options));
}

/** Move `count` columns starting at `from` so the first is at `to`. Refused with the reason when it would split a merged cell. */
export function prepareMoveColumns(document, path, from, to, count = 1, options = {}) {
  return transact(document, path, "move-columns", (model) => {
    moveColumns(model, from, count, to);
    return { from, to, count, restyle: true, touchesStructure: true, what: "Moving columns" };
  }, kindOf(options));
}

/**
 * Sort the body rows by a column, stably. Types: "auto" (default) puts numbers (read in the number format) before ISO dates
 * before text, "text" compares everything as text with numbers inside the text in numeric order, "number" and "date" read that type only. Empty cells
 * always sort last, in either direction. Rows joined by a merged cell that spans rows move as one block. Equal keys keep their order.
 */
export function prepareSortRows(document, path, column, options = {}) {
  return transact(document, path, "sort-rows", (model) => ({ ...sortRows(model, column, options), column, direction: options.direction ?? "asc", restyle: true }), kindOf(options));
}

/** Turn a table's header row on or off. On uses the first row as the header (`use: "first-row"`, the default when there are two or more rows) or adds a new empty one (`use: "new"`). */
export function prepareSetHeader(document, path, enabled, options = {}) {
  return transact(document, path, "set-header", (model) => setHeader(model, Boolean(enabled), options), { kind: "table" });
}

/** Swap a chart's categories and series: the first column's values become the series names and the series become the rows. */
export function prepareTranspose(document, path) {
  return transact(document, path, "transpose", (model) => transposeChart(model), { kind: "chart" });
}

// --- copy --------------------------------------------------------------------------------------

/**
 * The text of a range of cells, ready to paste into a spreadsheet: rows of `describeDataGrid` cell text joined as TSV (or
 * another `delimiter`). `range` is `{ from, to }` of `{ section, row, column }` addresses; omit it for the whole grid. A merged cell's text is
 * in its first position and its covered positions are empty, as a spreadsheet copies them.
 */
export function gridRangeText(document, path, range, options = {}) {
  const grid = describeDataGrid(document, path, options);
  const find = (address) => {
    const u = address.section === "header" ? 0 : address.row + (grid.hasHeader ? 1 : 0);
    if (address.section === "header" && !grid.hasHeader) throw fail("grid-cell-not-found", "This table has no header row.", { cell: address });
    return { u, c: address.column };
  };
  const from = range ? find(range.from) : { u: 0, c: 0 };
  const to = range ? find(range.to) : { u: grid.lines.length - 1, c: grid.columnCount - 1 };
  const rows = [];
  for (let u = Math.min(from.u, to.u); u <= Math.max(from.u, to.u); u += 1) {
    if (!grid.lines[u]) throw fail("grid-cell-not-found", "The range leaves the grid.", { range });
    rows.push(grid.lines[u].slice(Math.min(from.c, to.c), Math.max(from.c, to.c) + 1).map((cell) => cell.text));
  }
  return toDelimited(rows, { delimiter: options.delimiter ?? "\t" });
}

// --- session forms -----------------------------------------------------------------------------

function commit(editor, prepared, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const { document, patches, ...summary } = prepared;
  void document;
  if (!prepared.changed) return { ...summary, document: editor.document, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? "data-grid", action: prepared.action, path: prepared.path });
  return { ...change, ...summary };
}

const run = (editor, prepare, options = {}) => {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  return commit(editor, prepare(editor.document), options.meta);
};

/** Set cells as one undoable transaction. See {@link prepareGridCells}. */
export const setGridCells = (editor, path, edits, options = {}) => run(editor, (document) => prepareGridCells(document, path, edits, options), options);
/** Paste text or rows as one undoable transaction. See {@link preparePaste}. */
export const pasteGridText = (editor, path, anchor, source, options = {}) => run(editor, (document) => preparePaste(document, path, anchor, source, options), options);
export const insertGridRows = (editor, path, at, count = 1, options = {}) => run(editor, (document) => prepareInsertRows(document, path, at, count, options), options);
export const deleteGridRows = (editor, path, indices, options = {}) => run(editor, (document) => prepareDeleteRows(document, path, indices, options), options);
export const moveGridRows = (editor, path, from, to, count = 1, options = {}) => run(editor, (document) => prepareMoveRows(document, path, from, to, count, options), options);
export const insertGridColumns = (editor, path, at, count = 1, options = {}) => run(editor, (document) => prepareInsertColumns(document, path, at, count, options), options);
export const deleteGridColumns = (editor, path, indices, options = {}) => run(editor, (document) => prepareDeleteColumns(document, path, indices, options), options);
export const moveGridColumns = (editor, path, from, to, count = 1, options = {}) => run(editor, (document) => prepareMoveColumns(document, path, from, to, count, options), options);
export const sortGridRows = (editor, path, column, options = {}) => run(editor, (document) => prepareSortRows(document, path, column, options), options);
export const setGridHeader = (editor, path, enabled, options = {}) => run(editor, (document) => prepareSetHeader(document, path, enabled, options), options);
export const transposeGridData = (editor, path, options = {}) => run(editor, (document) => prepareTranspose(document, path), options);
