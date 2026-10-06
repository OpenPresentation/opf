// The data model behind the data grid (RR-24): one table-shaped view of a chart's inline data and of a
// table, and every edit to it as one validated, undoable patch.
//
// A chart is `{ type, data: { columns, rows }, mapping? }`: `columns` are labels (a string, or a `DataColumn`
// `{ name, format? }`), `rows` are arrays aligned to them. By default the first column holds the categories (the x axis, or
// the slice names) and every further column is one series, named by its column label, in the order the renderer draws them.
// (A scatter chart reads its x values from the second column; a chart type that needs one column only reads the first.)
// `mapping` names the category, X and series columns instead. A table is `{ columns?, rows }` whose cells are plain values,
// rich runs or styled cells with spans, as table-options.js describes.
//
// RR-54: a chart (`data: { dataset, fields? }`) or table (`{ dataset, fields? }`) may take its data from a shared top-level
// dataset. The grid then edits `/datasets/<id>` through the `fields` selection: edits map back to the dataset's own column
// indices, a column added while `fields` is set goes to the dataset and to `fields`, and a deleted column leaves `fields` (the
// dataset keeps it). Renaming a column keeps every `fields` and `mapping` that names it in step.
//
// Both are read as "lines": the header line (when there is one) followed by the body rows. The operations below
// change lines and columns, keep merged cells whole or refuse with a reason, and return a `{ document, patches,
// changed }` description like table-options.js does. Nothing here touches a DOM.
import * as core from "@openpresentation/opf";
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath, validateOpfDocument } from "./index.js";
import { checkedDocument, fail, same } from "./edit-helpers.js";
import { datasetUsage, isDatasetRef, walkDatasetItems } from "./dataset-refs.js";
import { richTextContent, updateRichTextInput } from "./rich-text.js";
import { formatGridNumber, isCanonicalNumber, parseDelimited, parseGridNumber, resolveNumberFormat, toDelimited } from "./grid-text.js";
import { applyTableStyleToTable, readTableStyleOfTable } from "./table-options.js";

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isStyled = (cell) => isObject(cell) && Object.hasOwn(cell, "value");
// A header may be a DataColumn `{ name, format? }`: its text is `name`.
const isColumnObject = (cell) => isObject(cell) && Object.hasOwn(cell, "name") && !Object.hasOwn(cell, "value");
const valueOf = (cell) => (isStyled(cell) ? cell.value : isColumnObject(cell) ? cell.name : cell);
const withValue = (raw, value) => (isStyled(raw) ? { ...raw, value } : isColumnObject(raw) ? { ...raw, name: value === null || value === undefined ? "" : String(value) } : value);
const formatOf = (raw) => ((isStyled(raw) || isColumnObject(raw)) && typeof raw.format === "string" ? raw.format : undefined);
const clone = (value) => structuredClone(value);
const columnNameOf = (column) => (typeof column === "string" ? column : isObject(column) && typeof column.name === "string" ? column.name : "");
// A body row remembers which dataset row it came from, so a row that moves, sorts or is deleted keeps the columns `fields` hides.
const LINE_ORIGIN = Symbol("opf.grid.row");
const cloneLines = (lines) =>
  lines.map((line) => {
    const copy = clone(line);
    if (line[LINE_ORIGIN] !== undefined) copy[LINE_ORIGIN] = line[LINE_ORIGIN];
    return copy;
  });
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

const datasetsOf = (document) => (isObject(document) && isObject(document.datasets) ? document.datasets : {});

/** The dataset a chart or table reference points at, and the dataset columns its `fields` select (by index). */
function datasetOf(document, ref, path, refParts) {
  const id = ref.dataset;
  const datasets = datasetsOf(document);
  const data = Object.hasOwn(datasets, id) ? datasets[id] : undefined;
  if (!isObject(data) || !Array.isArray(data.columns) || !Array.isArray(data.rows))
    throw fail("dataset-unavailable", `This item uses the shared dataset '${id}', which the document does not hold.`, { path, dataset: id });
  const names = data.columns.map(columnNameOf);
  const fields = Array.isArray(ref.fields) ? ref.fields : undefined;
  let indices = names.map((_, index) => index);
  if (fields) {
    indices = fields.map((field) => names.indexOf(field));
    const missing = fields.find((_, index) => indices[index] < 0);
    if (missing !== undefined) throw fail("dataset-unavailable", `This item selects the column ${JSON.stringify(missing)}, which dataset '${id}' does not have.`, { path, dataset: id, field: missing });
  }
  return { data, dataset: { id, fields, indices, refParts, ref } };
}

/**
 * Find the data a path points at. A chart path ends in `chart` (or `chart.data`) and a table path in `table`.
 * Throws `grid-target-not-found`, `table-not-found`, `chart-data-source` (a chart that reads its data from a source
 * has no inline data to edit) or `dataset-unavailable` (the shared dataset or one of its `fields` is missing).
 * A chart or table that takes its data from a dataset (RR-54) is located at the dataset: `data` is the dataset, `dataParts`
 * is `["datasets", id]` and `dataset` is `{ id, fields, indices, refParts, ref }` (`indices` maps each shown column to the
 * dataset's own column).
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
    const chartType = typeof owner.type === "string" ? owner.type : undefined;
    if (isDatasetRef(data)) {
      const found = datasetOf(document, data, path, [...parts, "data"]);
      return { kind: "chart", parts, dataParts: ["datasets", data.dataset], data: found.data, chartType, owner, dataset: found.dataset };
    }
    if (!Array.isArray(data.columns) || !Array.isArray(data.rows))
      throw fail("chart-data-source", "This chart reads its data from a source (src), not from inline columns and rows. The data grid edits inline chart data.", { path });
    return { kind: "chart", parts, dataParts: [...parts, "data"], data, chartType, owner };
  }
  if (parts.at(-1) === "table") {
    if (isObject(owner) && isDatasetRef(owner) && !Array.isArray(owner.rows)) {
      const found = datasetOf(document, owner, path, parts);
      return { kind: "table", parts, dataParts: ["datasets", owner.dataset], data: found.data, owner, dataset: found.dataset };
    }
    if (!isObject(owner) || !Array.isArray(owner.rows)) throw fail("table-not-found", "Choose a table (a path ending in .table).", { path });
    return { kind: "table", parts, dataParts: parts, data: owner, owner };
  }
  throw fail("grid-target-not-found", "Choose a chart or a table (a path ending in .chart or .table).", { path });
}

/**
 * The chart or table a selection path belongs to: `{ kind, path }` for `…chart`, `…chart.data.rows.1.0`, `…table`,
 * `…table.rows.1.2.value`, and so on. A chart whose data comes from a source (or from a dataset the document lacks) is
 * `{ kind: "chart", path, editable: false, reason }`. A chart or table that takes its data from a shared dataset also has
 * `dataset: { id, fields, count, items }` (`items` are the paths of every chart and table that uses the dataset).
 * Returns undefined when the path is not inside a chart or table.
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
      const target = { kind: found.kind, path: head.join(".") };
      if (found.dataset) {
        const items = datasetUsage(document, found.dataset.id).map((entry) => entry.path);
        target.dataset = { id: found.dataset.id, ...(found.dataset.fields ? { fields: [...found.dataset.fields] } : {}), count: items.length, items };
      }
      return target;
    } catch (error) {
      if (error.code === "chart-data-source" || error.code === "dataset-unavailable") return { kind: parts[index], path: head.join("."), editable: false, reason: error.message };
    }
  }
  return undefined;
}

// --- lines -------------------------------------------------------------------------------------

function toModel(found) {
  const { kind, data, dataset } = found;
  const hasHeader = kind === "chart" || Boolean(dataset) ? true : Array.isArray(data.columns);
  let lines;
  if (dataset) {
    // The dataset as the item shows it: only the columns `fields` selects, in that order. Each body row remembers its dataset row.
    const pick = (row) => dataset.indices.map((index) => (Array.isArray(row) && index < row.length ? clone(row[index]) : null));
    lines = [clone(dataset.indices.map((index) => data.columns[index])), ...data.rows.map((row, r) => Object.assign(pick(row), { [LINE_ORIGIN]: r }))];
  } else lines = [...(hasHeader ? [clone(data.columns)] : []), ...clone(data.rows).map((row) => (Array.isArray(row) ? row : [row]))];
  const mapping = kind === "chart" && isObject(found.owner?.mapping) ? clone(found.owner.mapping) : undefined;
  // `datasetNames` are every column of the shared dataset, also the ones `fields` hides: a new column's name must differ from them.
  const model = { kind, hasHeader, lines, width: 0, chartType: found.chartType, dataset, mapping, colOrigin: [], origNames: [], datasetNames: dataset ? data.columns.map(columnNameOf) : [] };
  model.width = widthOf(model);
  // Where each column came from, so renames, deletions and moves can be followed after an operation (null: a new column).
  model.colOrigin = Array.from({ length: model.width }, (_, index) => index);
  model.origNames = namesOfModel(model);
  return model;
}

/** The header texts of a model (the column names `fields` and `mapping` address). */
function namesOfModel(model) {
  return model.hasHeader ? Array.from({ length: model.width }, (_, column) => String(valueOf(model.lines[0]?.[column]) ?? "")) : [];
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
// Column names must be unique where a dataset, `fields` or a chart `mapping` addresses them, so a new column of such a
// target gets a distinct placeholder name instead of "".
const needsNames = (model) => Boolean(model.dataset) || model.mapping !== undefined;
function uniqueName(model, taken = []) {
  const used = new Set([...namesOfModel(model), ...model.datasetNames, ...taken]);
  let n = 1;
  while (used.has(n === 1 ? "New column" : `New column ${n}`)) n += 1;
  return n === 1 ? "New column" : `New column ${n}`;
}
// What a new, empty cell holds: a chart's and a dataset's cells are null (a gap), a table's are "".
const emptyCell = (model) => (model.kind === "chart" || model.dataset ? null : "");
const filler = (model, u) => (model.hasHeader && u === 0 ? (needsNames(model) ? uniqueName(model) : "") : emptyCell(model));

function padLines(model) {
  model.width = widthOf(model);
  model.lines.forEach((line, u) => {
    while (line.length < model.width) line.push(filler(model, u));
  });
  while (model.colOrigin.length < model.width) model.colOrigin.push(null);
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

const isScatter = (type) => typeof type === "string" && /^(scatter|bubble)/.test(type);

// RR-54: core's strict chart number and XY test. A core that predates them (the installed range still allows one) keeps the
// editor working on documents that use none of the new fields: numbers and scatter-like type ids read as the editor always read them.
const chartNumber = (value) =>
  typeof core.chartNumber === "function" ? core.chartNumber(value) : typeof value === "number" ? (Number.isFinite(value) ? value : null) : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
/** Whether the installed core has the RR-54 chart and table data contract (number formats, datasets, `chartNumber`); an older core edits documents that use none of it. */
export const supportsChartTableData = ["chartNumber", "numberFormatError", "inlineChartData", "inlineTableData", "isXYChartType"].every((name) => typeof core[name] === "function");
const isXYType = (type) => (typeof core.isXYChartType === "function" ? core.isXYChartType(type) : isScatter(type));

/**
 * A number as the slide draws it: the column's format (a table body cell's own format wins) through core's `formatDataNumber`, or undefined when
 * the cell is not a number, has no valid format, or the format changes nothing. A chart cell is read by `chartNumber`, as the renderer does, and
 * only in a column the chart plots as numbers; a table cell is formatted only when it holds a number. The cell's `text` (the raw value) is never
 * replaced: editing and copying use it.
 */
function displayText(model, raw, column, role, text) {
  if (!supportsChartTableData || typeof core.formatDataNumber !== "function") return undefined;
  const format = (model.kind === "table" ? formatOf(raw) : undefined) ?? (model.hasHeader ? formatOf(model.lines[0]?.[column]) : undefined);
  if (format === undefined || core.numberFormatError(format) !== undefined) return undefined;
  const value = valueOf(raw);
  let number = null;
  if (model.kind === "chart") number = isNumericRole(role) && (typeof value === "number" || typeof value === "string") ? chartNumber(value) : null;
  else if (typeof value === "number" && Number.isFinite(value)) number = value;
  if (number === null) return undefined;
  const shown = core.formatDataNumber(number, format);
  return shown === text ? undefined : shown;
}

/**
 * The default X column of an XY chart (core's rule): the second column, or the first when the category is the second, and only
 * with three or more columns. With two, the second column is the one series, plotted against row numbers.
 */
const defaultX = (category, count) => (count > 2 ? (category === 1 ? 0 : 1) : undefined);

/**
 * The columns a chart plots, by index: `{ category, x, series }`. `mapping` names them (`{ category?, x?, series? }`); a missing or
 * unknown name falls back to core's positional default. `x` is only set for an XY chart.
 */
function mappingColumns(count, xy, mapping, names) {
  const known = (name) => (typeof name === "string" ? names.indexOf(name) : -1);
  const map = isObject(mapping) ? mapping : {};
  let category = known(map.category);
  if (category < 0) category = 0;
  let x;
  if (xy) {
    x = known(map.x);
    if (x < 0 || x === category) x = defaultX(category, count);
    if (x !== undefined && (x >= count || x === category)) x = undefined;
  }
  let series;
  if (Array.isArray(map.series)) {
    series = [];
    for (const name of map.series) {
      const index = known(name);
      if (index >= 0 && index !== category && index !== x && !series.includes(index)) series.push(index);
    }
  } else series = Array.from({ length: count }, (_, index) => index).filter((index) => index !== category && index !== x);
  // An X column needs a series beside it; otherwise core plots it as the series against row numbers.
  if (x !== undefined && !series.length) {
    series = [x];
    x = undefined;
  }
  return { category, x, series };
}

/**
 * What each column of a chart is for: "category" (column A), "series", and for a scatter chart with three or more columns
 * "label" and "x". With a `mapping` (and the column `names` it addresses) the roles follow it: "category" (the label column of a
 * chart with no X axis), "label" and "x" for an XY chart, "series" for a plotted column and "other" for a column nothing plots.
 */
export function chartColumnRoles(columnCount, chartType, mapping, names) {
  if (isObject(mapping) && Array.isArray(names) && columnCount > 0) {
    const xy = isXYType(chartType);
    const { category, x, series } = mappingColumns(columnCount, xy, mapping, names);
    const roles = Array(columnCount).fill("other");
    for (const index of series) roles[index] = "series";
    roles[category] = xy ? "label" : "category";
    if (x !== undefined) roles[x] = "x";
    return roles;
  }
  if (columnCount <= 1) return Array(columnCount).fill("series");
  if (isScatter(chartType) && columnCount >= 3) return ["label", "x", ...Array(columnCount - 2).fill("series")];
  return ["category", ...Array(columnCount - 1).fill("series")];
}

const rolesOf = (model) => (model.kind === "chart" ? chartColumnRoles(model.width, model.chartType, model.mapping, namesOfModel(model)) : []);
const isNumericRole = (role) => role === undefined || role === "series" || role === "x";

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
  const roles = rolesOf(model);
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
      if (!owner && address.section === "body") {
        const display = displayText(model, raw, column, roles[column], cell.text);
        if (display !== undefined) cell.display = display;
      }
      if (address.section === "header" && formatOf(raw) !== undefined) cell.format = formatOf(raw);
      if (owner) cell.owner = { line: owner.u, column: owner.c };
      if (model.kind === "chart") {
        let warning;
        if (u === 0) {
          const name = String(value ?? "");
          if (roles[column] !== "category" && roles[column] !== "label") {
            if (name.trim() === "") warning = "This series has no name.";
            else if (names.has(name)) warning = `Another series is also named "${name}".`;
            names.set(name, column);
          }
        } else if (roles[column] === "category" || roles[column] === "label") {
          if (roles[column] === "category" && (value === null || value === undefined || value === "")) warning = "This row has no category label.";
        } else if (roles[column] === "other") {
          // A column the chart does not plot may hold anything.
        } else if (typeof value === "boolean") warning = "A yes/no value is not a number, so the chart draws a gap here.";
        else if (value !== null && value !== undefined && chartNumber(value) === null && String(value).trim() !== "") warning = "This is not a number, so the chart draws a gap here.";
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
    columnFormats: Array.from({ length: model.width }, (_, column) => (model.hasHeader ? formatOf(model.lines[0]?.[column]) : undefined)),
    ...(model.hasHeader ? { columnNames: namesOfModel(model) } : {}),
    ...(found.dataset ? { dataset: { id: found.dataset.id, ...(found.dataset.fields ? { fields: [...found.dataset.fields] } : {}), items: datasetUsage(document, found.dataset.id).map((entry) => entry.path) } } : {}),
    ...(model.mapping ? { mapping: clone(model.mapping) } : {}),
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

/** Like {@link gridPatches}, and also for a value that is added (`before` is undefined) or removed (`after` is undefined). */
function valuePatches(parts, before, after) {
  if (before === undefined && after === undefined) return [];
  const pointer = opfPathToJsonPointer(parts);
  if (before === undefined) return [{ op: "add", path: pointer, value: clone(after) }];
  if (after === undefined) return [{ op: "test", path: pointer, value: clone(before) }, { op: "remove", path: pointer }];
  return gridPatches(parts, before, after);
}

// --- following columns across an operation -------------------------------------------------------

/** The column renames an operation made: a Map from the old name to the new one, for the columns that survived with another name. */
function renamesOf(model) {
  const names = namesOfModel(model);
  const renames = new Map();
  model.colOrigin.forEach((origin, column) => {
    if (origin === null || origin === undefined) return;
    const from = model.origNames[origin];
    const to = names[column];
    if (from !== undefined && to !== undefined && from !== to) renames.set(from, to);
  });
  return renames;
}

/**
 * A chart `mapping` after an operation: a renamed column keeps its role, a column that no longer exists leaves the mapping
 * (an emptied `series` is dropped, which restores "every other column"). A name the data never had is left alone. Returns
 * undefined when nothing is left.
 */
function reconcileMapping(mapping, renames, before, after) {
  if (!isObject(mapping)) return mapping;
  const keep = (name) => {
    const next = renames.has(name) ? renames.get(name) : name;
    if (after.includes(next)) return next;
    return before.includes(name) ? undefined : name;
  };
  const out = {};
  for (const key of ["category", "x"]) {
    if (typeof mapping[key] !== "string") continue;
    const name = keep(mapping[key]);
    if (name !== undefined) out[key] = name;
  }
  if (Array.isArray(mapping.series)) {
    const series = mapping.series.map(keep).filter((name) => name !== undefined);
    if (series.length) out.series = series;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The changes to an inline chart or table: its data object, and the chart's `mapping` when a rename or deletion touches it. */
function inlineChanges(found, model, style) {
  const after = fromModel(model, found.data);
  if (style && style.preset !== "custom") applyTableStyleToTable(after, style.preset);
  const changes = [{ parts: found.dataParts, before: found.data, after }];
  if (found.kind === "chart" && found.owner.mapping !== undefined) {
    const next = reconcileMapping(found.owner.mapping, renamesOf(model), model.origNames, namesOfModel(model));
    if (!same(found.owner.mapping, next)) changes.push({ parts: [...found.parts, "mapping"], before: found.owner.mapping, after: next });
  }
  return changes;
}

/**
 * The changes to a chart or table that shows a dataset: the dataset itself (the shown columns mapped back to its own column
 * indices, each row to the dataset row it came from, so columns `fields` hides keep their data), the item's `fields` and `mapping`,
 * and the `fields` and `mapping` of every other item that shares the dataset when a column is renamed. A column that
 * `fields` selects leaves only `fields` when deleted; without `fields` it leaves the dataset, which another item's `fields` or
 * `mapping` that names it forbids.
 */
function datasetChanges(document, found, model) {
  const { dataset, data } = found;
  padLines(model);
  const header = model.lines[0];
  const names = namesOfModel(model);
  const body = model.lines.slice(1);
  const origin = model.colOrigin;
  let columns;
  let rows;
  if (!dataset.fields) {
    columns = header.map((raw) => raw);
    rows = body.map((line) => line.map((raw) => raw));
  } else {
    const survivors = new Map();
    origin.forEach((o, column) => {
      if (o !== null && o !== undefined) survivors.set(dataset.indices[o], column);
    });
    columns = data.columns.map((column, index) => (survivors.has(index) ? header[survivors.get(index)] : column));
    const position = new Map();
    origin.forEach((o, column) => {
      if (o !== null && o !== undefined) position.set(column, dataset.indices[o]);
      else {
        position.set(column, columns.length);
        columns.push(header[column]);
      }
    });
    rows = body.map((line) => {
      const source = line[LINE_ORIGIN] !== undefined && Array.isArray(data.rows[line[LINE_ORIGIN]]) ? [...data.rows[line[LINE_ORIGIN]]] : [];
      while (source.length < columns.length) source.push(null);
      line.forEach((raw, column) => {
        source[position.get(column)] = raw;
      });
      return source;
    });
  }
  const renames = renamesOf(model);
  const others = [];
  const ownPath = found.parts.join(".");
  walkDatasetItems(document, (entry) => {
    if (entry.id === dataset.id && entry.parts.join(".") !== ownPath) others.push(entry);
  });
  if (!dataset.fields) {
    const gone = model.origNames.filter((_, index) => !origin.includes(index));
    for (const name of gone) {
      const users = others.filter((entry) => (Array.isArray(entry.ref.fields) && entry.ref.fields.includes(name)) || (isObject(entry.item.mapping) && [entry.item.mapping.category, entry.item.mapping.x, ...(entry.item.mapping.series ?? [])].includes(name)));
      if (users.length)
        throw fail("dataset-column-in-use", `The column ${JSON.stringify(name)} is used by ${users.length === 1 ? "another chart or table" : `${users.length} other charts and tables`} that share the dataset '${dataset.id}'. Remove it there first, or use a copy of the data here.`, { column: name, items: users.map((entry) => entry.parts.join(".")) });
    }
  }
  const changes = [{ parts: found.dataParts, before: data, after: { ...data, columns, rows } }];
  if (dataset.fields) changes.push({ parts: [...dataset.refParts, "fields"], before: dataset.ref.fields, after: names });
  if (found.kind === "chart" && found.owner.mapping !== undefined) {
    const next = reconcileMapping(found.owner.mapping, renames, model.origNames, names);
    if (!same(found.owner.mapping, next)) changes.push({ parts: [...found.parts, "mapping"], before: found.owner.mapping, after: next });
  }
  if (renames.size) {
    for (const entry of others) {
      if (Array.isArray(entry.ref.fields) && entry.ref.fields.some((name) => renames.has(name)))
        changes.push({ parts: [...entry.refParts, "fields"], before: entry.ref.fields, after: entry.ref.fields.map((name) => (renames.has(name) ? renames.get(name) : name)) });
      if (entry.kind === "chart" && isObject(entry.item.mapping)) {
        const mapping = entry.item.mapping;
        const rename = (name) => (renames.has(name) ? renames.get(name) : name);
        const next = { ...mapping };
        if (typeof mapping.category === "string") next.category = rename(mapping.category);
        if (typeof mapping.x === "string") next.x = rename(mapping.x);
        if (Array.isArray(mapping.series)) next.series = mapping.series.map(rename);
        if (!same(mapping, next)) changes.push({ parts: [...entry.parts, "mapping"], before: mapping, after: next });
      }
    }
  }
  return changes;
}

function transact(document, path, action, mutate, extra = {}) {
  const found = locateGridData(document, path);
  if (extra.kind && extra.kind !== found.kind) throw fail("grid-wrong-kind", `This operation works on a ${extra.kind}, and the path points at a ${found.kind}.`, { path });
  const model = toModel(found);
  const problemsBefore = mergeProblems(model).length;
  const info = mutate(model, found) ?? {};
  const style = info.restyle && found.kind === "table" && !found.dataset ? readTableStyleOfTable(found.data) : undefined;
  if (info.touchesStructure) assertMerges(model, problemsBefore, info.what ?? "This change");
  if (style && style.preset !== "custom") padLines(model);
  const changes = found.dataset ? datasetChanges(document, found, model) : inlineChanges(found, model, style);
  const patches = changes.flatMap((entry) => valuePatches(entry.parts, entry.before, entry.after));
  const changed = patches.length > 0;
  const before = validateOpfDocument(document);
  const result = changed ? checkedDocument(document, patches, before) : document;
  // `restyle`, `touchesStructure` and `what` steer this function only; the rest of what the operation reports is the caller's.
  const { restyle: _restyle, touchesStructure: _structure, what: _what, ...summary } = info;
  return { action, ...summary, kind: found.kind, path: found.parts.join("."), ...(found.dataset ? { dataset: found.dataset.id } : {}), document: clone(result), patches, changed };
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
  const fresh = Array.from({ length: count }, () => Array.from({ length: model.width }, (_, column) => (model.kind === "chart" || model.dataset ? null : referenceCell(model, reference, column))));
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
  // New columns of a dataset (or of a chart with a mapping) are named at once: names must stay unique.
  const named = [];
  if (model.hasHeader && needsNames(model)) for (let i = 0; i < count; i += 1) named.push(uniqueName(model, named));
  model.lines.forEach((line, u) => {
    const fresh = Array.from({ length: count }, (_, i) => (model.hasHeader && u === 0 && needsNames(model) ? named[i] : model.kind === "chart" || model.dataset || (model.hasHeader && u === 0) ? filler(model, u) : referenceCell(model, line, reference)));
    line.splice(at, 0, ...fresh);
  });
  model.colOrigin.splice(at, 0, ...Array(count).fill(null));
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
  model.colOrigin.splice(x, 1);
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
  moveBlock(model.colOrigin, from, count, to);
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
  if (model.dataset) throw fail("grid-dataset-shared", `A table that shows the dataset '${model.dataset.id}' always has a header row: the dataset's column names.`, { dataset: model.dataset.id });
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
  // A DataColumn header (`{ name, format }`) is not a body cell: it becomes its name. Its column format has nowhere to go and is dropped.
  const dropped = model.lines[0].filter((raw) => isColumnObject(raw) && formatOf(raw) !== undefined).length;
  model.lines[0] = model.lines[0].map((raw) => (isColumnObject(raw) ? raw.name : raw));
  model.hasHeader = false;
  return { header: false, restyle: true, ...(dropped ? { droppedFormats: dropped } : {}) };
}

// --- transpose ---------------------------------------------------------------------------------

function transposeChart(model) {
  if (model.kind !== "chart") throw fail("grid-wrong-kind", "Only chart data can be transposed.", {});
  if (model.dataset) throw fail("grid-dataset-shared", `Swapping categories and series would reshape the shared dataset '${model.dataset.id}' for every chart and table that uses it. Use a copy of the data first.`, { dataset: model.dataset.id });
  padLines(model);
  if (model.width < 2) throw fail("chart-transpose-empty", "Transposing needs at least one series column besides the categories.", {});
  const [headers, ...rows] = model.lines;
  // A column's number format belongs to its numbers: the old series names become category labels, as text.
  const names = headers.map((cell) => String(valueOf(cell) ?? ""));
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
  // Every column is new: a mapping that named the old columns no longer applies.
  model.colOrigin = Array(model.width).fill(null);
  return { rowsBefore: rows.length, columnsBefore: names.length, relabelled };
}

// --- cell edits --------------------------------------------------------------------------------

function growTo(model, lines, width) {
  padLines(model);
  while (model.lines.length < lines) model.lines.push(Array.from({ length: model.width }, () => emptyCell(model)));
  while (model.width < width) {
    model.lines.forEach((line, u) => line.push(filler(model, u)));
    model.width += 1;
    model.colOrigin.push(null);
  }
}

// The column names of a shared dataset (and of a chart with a mapping) are how `fields` and `mapping` address columns: never blank.
const blankNameError = (model, address, text) =>
  address.section === "header" && model.hasHeader && needsNames(model) && String(text ?? "").trim() === ""
    ? `A column name cannot be empty here: ${model.dataset ? "the shared dataset" : "the chart's column mapping"} addresses columns by name.`
    : undefined;

function newRaw(model, raw, text, decimal, address, roles) {
  const value = valueOf(raw);
  const blank = blankNameError(model, address, text);
  if (blank) return { error: blank };
  // Text that is already what the cell shows is left alone: a number kept as text stays text, runs keep their styling.
  const shown = cellText(raw, model.kind, decimal);
  if (Array.isArray(value)) {
    if (text.replace(/\r\n?/g, "\n") === shown.replace(/\r\n?/g, "\n")) return { skip: true };
    return { raw: withValue(raw, updateRichTextInput(value, text)) };
  }
  if (text === shown) return { skip: true };
  let next;
  if (model.kind === "table") {
    if (model.hasHeader && address.section === "header") next = text;
    else next = text === "" ? "" : isCanonicalNumber(text) ? Number(text) : text;
  } else if (address.section === "header") next = text;
  else if (isNumericRole(roles[address.column])) {
    // A chart number is read in the grid's number format and kept as a number. Text that is not a number is refused with
    // a reason; it is never stored as a guess (core's chartNumber would draw it as a gap).
    const parsed = parseGridNumber(text, { decimal });
    if (parsed.error) return { error: parsed.error };
    next = parsed.empty ? null : parsed.value;
    if (next === null && (value === null || value === undefined)) return { skip: true };
  } else if (roles[address.column] === "other") next = text === "" ? null : isCanonicalNumber(text) ? Number(text) : text;
  else next = text === "" ? null : text;
  return { raw: withValue(raw, next) };
}

function applyEdits(model, edits, decimal, owners) {
  const issues = [];
  const roles = rolesOf(model);
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
        if (model.dataset && address.section === "header" && typeof value !== "string") throw fail("invalid-grid-value", "A dataset column name is text.", { cell: address });
        const blank = blankNameError(model, address, value);
        if (blank && !(valueOf(raw) === "" && value === "")) throw fail("invalid-grid-value", blank, { cell: address });
        model.lines[u][address.column] = withValue(raw, value);
        continue;
      }
      if (typeof edit.text !== "string") throw fail("invalid-grid-value", "Give the cell's new text.", { cell: address });
      const outcome = newRaw(model, raw, edit.text, decimal, address, roles);
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
    const trial = { ...model, lines: cloneLines(model.lines), colOrigin: [...model.colOrigin] };
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
  model.colOrigin = result.trial.colOrigin;
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

// --- number format of a column (RR-54) ---------------------------------------------------------

/** Why `format` is not a valid number format ("#,##0", "0.0%", "$#,##0.00"), or undefined when it is valid or empty (empty clears the format). */
export function columnFormatError(format) {
  if (format === undefined || format === null || format === "") return undefined;
  if (!supportsChartTableData) return "This version of OPF has no number formats; update @openpresentation/opf.";
  return core.numberFormatError(format);
}

/** The header `raw` with `format` set, or cleared (`undefined`). A string header becomes `{ name, format }` and goes back to a string when the format is cleared. */
function withColumnFormat(raw, format) {
  if (isColumnObject(raw)) {
    const next = { ...raw };
    if (format === undefined) delete next.format;
    else next.format = format;
    return Object.keys(next).length === 1 ? next.name : next;
  }
  if (isStyled(raw)) {
    const next = { ...raw };
    if (format === undefined) delete next.format;
    else next.format = format;
    return Object.keys(next).length === 1 ? next.value : next;
  }
  if (format === undefined) return raw;
  if (Array.isArray(raw)) return { value: raw, format };
  return { name: raw === null || raw === undefined ? "" : String(raw), format };
}

function setColumnFormat(model, column, format) {
  if (!model.hasHeader) throw fail("grid-no-header", "This table has no header row, so there is no column heading to hold a number format. Turn on the header row first.", {});
  padLines(model);
  if (!Number.isInteger(column) || column < 0 || column >= model.width) throw fail("grid-column-out-of-range", "Choose a column.", { column });
  if (format !== undefined && format !== null && typeof format !== "string") throw fail("number-format-invalid", 'A number format is text such as "#,##0" or "0.0%".', { format });
  const next = typeof format === "string" && format !== "" ? format : undefined;
  const error = columnFormatError(next);
  if (error) throw fail("number-format-invalid", error, { format: next });
  if (ownersOf(model).has(`0:${column}`)) throw fail("table-cell-covered", `${describeAddress({ section: "header", row: 0, column })} is covered by a merged cell. Choose the merged heading.`, { column });
  model.lines[0][column] = withColumnFormat(model.lines[0][column], next);
  return { column, format: next ?? null };
}

/** Set or clear (`null` or "") the number format of column `column` (its header cell). A string header becomes `{ name, format }` and returns to a string when the format is cleared. Refused with the reason when the format is invalid or the table has no header row. */
export function prepareGridColumnFormat(document, path, column, format, options = {}) {
  return transact(document, path, "set-column-format", (model) => setColumnFormat(model, column, format), kindOf(options));
}

// --- chart mapping (RR-54) -----------------------------------------------------------------------

/**
 * The columns a chart plots and how they got that role: `{ path, xy, columns: [{ name, format?, role }], category, x?, series,
 * authored? }`. `category`, `x` and `series` are column names (the mapping's, or core's positional default); `xy` is true for a chart
 * with an X axis (scatter); `authored` is the chart's own `mapping`, when it has one. Roles are "category", "label", "x", "series"
 * and "other" (a column nothing plots).
 */
export function describeChartMapping(document, path) {
  const found = locateGridData(document, path);
  if (found.kind !== "chart") throw fail("grid-wrong-kind", "Only a chart has a series mapping.", { path });
  const model = toModel(found);
  padLines(model);
  const names = namesOfModel(model);
  const xy = isXYType(found.chartType);
  const { category, x, series } = mappingColumns(names.length, xy, model.mapping, names);
  const roles = chartColumnRoles(names.length, found.chartType, { ...(model.mapping ?? {}) }, names);
  return {
    path: found.parts.join("."),
    xy,
    columns: names.map((name, index) => ({ name, ...(formatOf(model.lines[0][index]) ? { format: formatOf(model.lines[0][index]) } : {}), role: roles[index] })),
    category: names[category],
    ...(x === undefined ? {} : { x: names[x] }),
    series: series.map((index) => names[index]),
    ...(model.mapping ? { authored: clone(model.mapping) } : {}),
  };
}

/**
 * Set a chart's category, X and series columns by name. `wanted` is `{ category?, x?, series? }`; what it leaves out keeps its
 * current value. A field that equals the default (the first column is the category, the second the X column, every other column a
 * series, in order) is not written, and `chart.mapping` is removed when nothing is left. One patch.
 */
export function prepareChartMapping(document, path, wanted = {}) {
  const found = locateGridData(document, path);
  if (found.kind !== "chart") throw fail("grid-wrong-kind", "Only a chart has a series mapping.", { path });
  const model = toModel(found);
  padLines(model);
  const names = namesOfModel(model);
  const xy = isXYType(found.chartType);
  const current = mappingColumns(names.length, xy, model.mapping, names);
  const pick = (name, what) => {
    const index = typeof name === "string" ? names.indexOf(name) : -1;
    if (index < 0) throw fail("chart-mapping-unknown-column", `The ${what} column ${JSON.stringify(name)} is not a column of this chart's data. Choose ${names.map((entry) => JSON.stringify(entry)).join(", ")}.`, { column: name });
    return index;
  };
  if (wanted.x !== undefined && !xy) throw fail("chart-mapping-x-unsupported", `A '${found.chartType ?? "chart"}' chart has no X axis, so it has no X column. Only a scatter chart does.`, { x: wanted.x });
  const category = wanted.category !== undefined ? pick(wanted.category, "category") : current.category;
  let x;
  if (xy) x = wanted.x !== undefined ? pick(wanted.x, "X") : current.x === category || current.x === undefined ? defaultX(category, names.length) : current.x;
  if (xy && x === category) throw fail("chart-mapping-conflict", "The X column and the category column must be different columns.", { category: names[category] });
  if (xy && x !== undefined && x >= names.length) throw fail("chart-mapping-conflict", "An XY chart needs a column for X besides the category.", {});
  const defaultSeries = names.map((_, index) => index).filter((index) => index !== category && index !== x);
  // Without its own `series`, a chart plots every other column: that follows a new category or X column.
  let series = wanted.series !== undefined ? wanted.series.map((name) => pick(name, "series")) : Array.isArray(model.mapping?.series) ? current.series : defaultSeries;
  series = series.filter((index, position) => index !== category && index !== x && series.indexOf(index) === position);
  if (!series.length) throw fail("chart-mapping-no-series", "Choose at least one series column to plot.", {});
  const next = {};
  if (category !== 0) next.category = names[category];
  if (xy && x !== undefined && x !== defaultX(category, names.length)) next.x = names[x];
  if (series.length !== defaultSeries.length || series.some((index, position) => index !== defaultSeries[position])) next.series = series.map((index) => names[index]);
  const after = Object.keys(next).length ? next : undefined;
  const before = validateOpfDocument(document);
  const patches = valuePatches([...found.parts, "mapping"], found.owner.mapping, after);
  const changed = patches.length > 0;
  const result = changed ? checkedDocument(document, patches, before) : document;
  return { action: "set-mapping", kind: "chart", path: found.parts.join("."), mapping: after ? clone(after) : null, document: clone(result), patches, changed };
}

// --- shared datasets (RR-54) -----------------------------------------------------------------------

/**
 * Replace a chart's or table's dataset reference with its own inline copy of the data (the columns `fields` selects, formats and
 * the dataset's `source` kept). The dataset stays in the document for the other items. One patch; after it the item's edits no longer
 * reach the shared dataset.
 */
export function prepareDetachDataset(document, path) {
  const found = locateGridData(document, path);
  if (!found.dataset) throw fail("grid-not-dataset", "This chart or table does not use a shared dataset.", { path });
  if (!supportsChartTableData) throw fail("grid-core-too-old", "This version of OPF cannot copy a shared dataset; update @openpresentation/opf.", { path });
  const inline = found.kind === "chart" ? core.inlineChartData(found.owner, document).data : core.inlineTableData(found.owner, document);
  const pointer = opfPathToJsonPointer(found.dataset.refParts);
  const patches = [{ op: "test", path: pointer, value: clone(found.dataset.ref) }, { op: "replace", path: pointer, value: clone(inline) }];
  const result = checkedDocument(document, patches, validateOpfDocument(document));
  return { action: "detach-dataset", kind: found.kind, path: found.parts.join("."), dataset: found.dataset.id, document: clone(result), patches, changed: true };
}

export { datasetUsage };

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
/** Set (or clear, with `null` or "") the number format of a column's header as one undoable transaction. Throws `number-format-invalid` with the reason. See {@link columnFormatError}. */
export const setGridColumnFormat = (editor, path, column, format, options = {}) => run(editor, (document) => prepareGridColumnFormat(document, path, column, format, options), options);
/** Set a chart's category, X and series columns as one undoable transaction. See {@link prepareChartMapping}. */
export const setChartMapping = (editor, path, wanted, options = {}) => run(editor, (document) => prepareChartMapping(document, path, wanted), options);
/** Give a chart or table its own copy of a shared dataset's data, as one undoable transaction. See {@link prepareDetachDataset}. */
export const detachGridDataset = (editor, path, options = {}) => run(editor, (document) => prepareDetachDataset(document, path), options);
