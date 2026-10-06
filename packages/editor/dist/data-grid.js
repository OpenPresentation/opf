// The data grid (RR-24): a spreadsheet-like DOM grid bound to a chart's inline data or to a table. It reads the document through
// the session, and every edit (a cell, a paste, a row or column operation) commits one validated patch, so Undo and Redo move by
// one step and the host's preview redraws from the same session events. Framework-free: `createDataGrid(container, options)`
// builds the DOM, `refresh()` re-reads the selection, `destroy()` removes everything.
//
// Semantics: a `role="grid"` table whose cells are `gridcell`s with `aria-rowindex`/`aria-colindex`, merged table cells
// drawn with real spans (`aria-colspan`, `aria-rowspan`), selected cells marked `aria-selected`, and one cell in the tab order.
// Keyboard: arrows move (Shift extends), Home/End, Ctrl+Home/End, PageUp/PageDown, Enter or F2 edits, typing replaces the text,
// Enter/Shift+Enter and Tab/Shift+Tab commit and move, Escape cancels, Delete clears, Ctrl+C/X/V copy, cut and paste TSV, Ctrl+A selects
// all, Ctrl+Z / Ctrl+Y undo and redo. Outside an edit Tab leaves the grid. Row and column operations are in the toolbar.
//
// RR-54: a header may be a DataColumn (the grid shows its name and keeps its number format); the column format field sets or
// clears the selected column's format; a chart's "Chart columns" panel sets the category, X and series columns (`chart.mapping`);
// and a chart or table that shows a shared dataset edits the dataset (the status line says how many items share it).
import {
  columnFormatError,
  columnLabel,
  deleteGridColumns,
  deleteGridRows,
  describeAddress,
  describeChartMapping,
  describeDataGrid,
  detachGridDataset,
  gridCellIssues,
  insertGridColumns,
  insertGridRows,
  moveGridColumns,
  moveGridRows,
  pasteGridText,
  resolveDataGridTarget,
  setChartMapping,
  setGridCells,
  setGridColumnFormat,
  setGridHeader,
  sortGridRows,
  supportsChartTableData,
  transposeGridData,
} from "./grid-model.js";
import { NUMBER_FORMATS, parseDelimited, resolveNumberFormat, toDelimited } from "./grid-text.js";

export * from "./grid-model.js";

let instances = 0;
const STYLE_ID = "opf-data-grid-style";
const CSS = `
.opf-grid{--g-border:#d9d6e2;--g-ruler:#f3f2f7;--g-text:#2b2833;--g-muted:#6a6573;--g-select:#e8e4fb;--g-focus:#5b4fc4;--g-error:#a02525;--g-warn:#8a5a00;--g-gap:#8b8696;font:12px/1.45 system-ui,sans-serif;color:var(--g-text)}
.opf-grid[hidden],.opf-grid [hidden]{display:none!important}
.opf-grid-title{display:flex;gap:8px;align-items:baseline;margin:0 0 6px}.opf-grid-title strong{font-size:12px}.opf-grid-path{font:10px ui-monospace,monospace;color:var(--g-muted);overflow-wrap:anywhere}
.opf-grid-toolbar{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:0 0 6px}
.opf-grid-toolbar button,.opf-grid-toolbar select{font:inherit;min-height:28px;border:1px solid var(--g-border);border-radius:4px;background:#fff;color:inherit;padding:2px 8px}
.opf-grid-toolbar button{cursor:pointer}.opf-grid-toolbar button:hover{background:#f1effa}
.opf-grid-toolbar [aria-disabled=true]{opacity:.45;cursor:default}.opf-grid-toolbar [aria-disabled=true]:hover{background:#fff}
.opf-grid-toolbar .opf-grid-sep{width:1px;align-self:stretch;background:var(--g-border);margin:0 2px}
.opf-grid-toolbar label{display:inline-flex;gap:4px;align-items:center;font-size:11px;color:var(--g-muted)}
.opf-grid-toolbar label.opf-grid-check{color:inherit}
.opf-grid button:focus-visible,.opf-grid select:focus-visible,.opf-grid textarea:focus-visible,.opf-grid summary:focus-visible,.opf-grid input:focus-visible{outline:2px solid var(--g-focus);outline-offset:1px}
.opf-grid-scroll{overflow:auto;max-height:var(--opf-grid-max-height,320px);border:1px solid var(--g-border);border-radius:4px;background:#fff}
.opf-grid table{border-collapse:separate;border-spacing:0;min-width:100%;table-layout:auto}
.opf-grid th,.opf-grid td{border-right:1px solid var(--g-border);border-bottom:1px solid var(--g-border);padding:3px 6px;vertical-align:top;font-weight:400;text-align:left;min-width:64px;max-width:240px;white-space:pre-wrap;overflow-wrap:anywhere}
.opf-grid thead th{position:sticky;top:0;z-index:2;background:var(--g-ruler);font-size:11px;color:var(--g-muted);font-weight:600;text-align:center}
.opf-grid tbody th{position:sticky;left:0;z-index:1;background:var(--g-ruler);font-size:10px;color:var(--g-muted);min-width:44px;max-width:64px;text-align:center;cursor:pointer}
.opf-grid thead th:first-child{left:0;z-index:3;cursor:pointer}
.opf-grid-role{display:block;font-weight:400;font-size:9px}
.opf-grid td{cursor:cell;position:relative;background:#fff;user-select:none;-webkit-user-select:none}.opf-grid td textarea{user-select:text;-webkit-user-select:text}
.opf-grid td.opf-grid-header{font-weight:600;background:#faf9fd}
.opf-grid td.opf-grid-number{text-align:right;font-variant-numeric:tabular-nums}
.opf-grid td.opf-grid-gap::before{content:"gap";color:var(--g-gap);font-style:italic;font-size:10px}
.opf-grid td[aria-selected=true]{background:var(--g-select)}
.opf-grid td.opf-grid-active{outline:2px solid var(--g-focus);outline-offset:-2px}
.opf-grid td[aria-invalid=true]{box-shadow:inset 0 0 0 2px var(--g-error)}
.opf-grid td.opf-grid-warn::after{content:"!";position:absolute;top:1px;right:3px;color:var(--g-warn);font-weight:700;font-size:10px}
.opf-grid td.opf-grid-merged{background-image:linear-gradient(135deg,transparent 92%,#cfc9e8 92%)}
.opf-grid td.opf-grid-editing{padding:0}
.opf-grid td textarea{display:block;width:100%;min-height:100%;box-sizing:border-box;margin:0;border:0;padding:3px 6px;font:inherit;resize:none;background:#fff;overflow:hidden}
.opf-grid-notes{margin:6px 0 0;padding-left:18px;font-size:11px;color:var(--g-warn)}.opf-grid-notes:empty{display:none}
.opf-grid-status{margin:6px 0 0;font-size:11px;color:#3d5e47;min-height:1.2em}.opf-grid-error{margin:6px 0 0;font-size:11px;color:var(--g-error)}.opf-grid-error:empty{display:none}
.opf-grid details{margin:6px 0 0;font-size:11px}.opf-grid details summary{cursor:pointer}.opf-grid details textarea{display:block;width:100%;box-sizing:border-box;min-height:64px;margin:4px 0;font:11px ui-monospace,monospace}
.opf-grid-help{margin:6px 0 0;font-size:10px;color:var(--g-muted)}
.opf-grid-dataset,.opf-grid-format{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 6px;font-size:11px;color:var(--g-muted)}
.opf-grid-dataset[hidden],.opf-grid-format[hidden],.opf-grid-mapping[hidden]{display:none!important}
.opf-grid-dataset strong{color:var(--g-text)}
.opf-grid-dataset button,.opf-grid-format button,.opf-grid-format input,.opf-grid-mapping select{font:inherit;min-height:28px;border:1px solid var(--g-border);border-radius:4px;background:#fff;color:inherit;padding:2px 8px}
.opf-grid-dataset button,.opf-grid-format button{cursor:pointer}.opf-grid-dataset button:hover,.opf-grid-format button:hover{background:#f1effa}
.opf-grid-format [aria-disabled=true]{opacity:.45;cursor:default}
.opf-grid-format input{width:150px}.opf-grid-format input[aria-invalid=true]{border-color:var(--g-error)}
.opf-grid-format-error{color:var(--g-error)}.opf-grid-format-error:empty{display:none}
.opf-grid-mapping{margin:6px 0 0;font-size:11px}.opf-grid-mapping label{display:inline-flex;gap:4px;align-items:center;margin:0 10px 4px 0}
.opf-grid-mapping fieldset{border:1px solid var(--g-border);border-radius:4px;margin:4px 0 0;padding:4px 8px}.opf-grid-mapping legend{font-size:11px;color:var(--g-muted)}
.opf-grid-mapping p{margin:4px 0 0;color:var(--g-muted)}
@media (forced-colors:active){.opf-grid td.opf-grid-active{outline:3px solid Highlight}.opf-grid td[aria-selected=true]{outline:1px solid Highlight}.opf-grid td[aria-invalid=true]{outline:2px solid LinkText}}
`;

// A printable character starts an edit (a plain space does not: it is how a person scrolls or presses a focused control).
const KEYS_PRINTABLE = (event) => event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey;
const messageOf = (error) => error?.issues?.[0]?.message ?? error?.message ?? String(error);
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Mount the grid into `container`. Options: `editor` (a session), `path` (a chart or table path to bind to) or `getSelectedPath()`
 * (the grid follows the host's selection into a chart or table; call `refresh()` when it changes), `numberFormat` ("auto", ".", ","),
 * `locale` (for "auto"), `maxHeight` (CSS length of the scrolling area), `onChange(change)`, `onStatus(message, { error })`
 * and `onTargetChange(target | undefined)`. Returns `{ element, refresh, focus, destroy, target, numberFormat, setNumberFormat }`.
 */
export function createDataGrid(container, options = {}) {
  const editor = options.editor;
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw new TypeError("createDataGrid needs an editor session.");
  if (!container || typeof container.appendChild !== "function") throw new TypeError("createDataGrid needs a container element.");
  const doc = container.ownerDocument;
  const uid = `opf-grid-${++instances}`;
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.append(style);
  }

  const h = (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === false || value === null) continue;
      if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, "");
      else node.setAttribute(key, String(value));
    }
    for (const child of children.flat()) if (child !== undefined && child !== null && child !== false) node.append(child);
    return node;
  };

  // --- state ---------------------------------------------------------------------------------
  let destroyed = false;
  let target; // { kind, path, editable, reason }
  let grid; // describeDataGrid result
  let signature = "";
  let numberFormat = options.numberFormat ?? "auto";
  const selection = { anchor: { u: 0, c: 0 }, focus: { u: 0, c: 0 } };
  let editing = null; // { u, c, text, caret }
  let dragging = false;
  let invalid = new Map();
  let hadFocus = false;
  // Replacing the table removes a focused editor, which fires blur: that blur is not the person leaving the cell.
  let rebuilding = false;

  const decimal = () => resolveNumberFormat(numberFormat, options.locale ?? doc.documentElement?.lang ?? doc.defaultView?.navigator?.language).decimal;
  const opts = () => ({ decimal: decimal() });
  const getPath = () => options.path ?? options.getSelectedPath?.();

  // --- skeleton --------------------------------------------------------------------------------
  const root = h("div", { class: "opf-grid", "data-opf-component": "data-grid", hidden: true });
  const titleText = h("strong", {});
  const pathText = h("span", { class: "opf-grid-path" });
  const toolbar = h("div", { class: "opf-grid-toolbar", role: "toolbar", "aria-label": "Data grid actions", "aria-orientation": "horizontal" });
  const unavailable = h("p", { class: "opf-grid-help", role: "note" });
  const tbody = h("tbody", {});
  const thead = h("thead", {});
  const table = h("table", { role: "grid", "aria-multiselectable": "true", "aria-readonly": "false" }, thead, tbody);
  const scroll = h("div", { class: "opf-grid-scroll" }, table);
  const notes = h("ul", { class: "opf-grid-notes", "aria-label": "Data notes" });
  const statusEl = h("p", { class: "opf-grid-status", role: "status", "aria-live": "polite" });
  const errorEl = h("p", { class: "opf-grid-error", role: "alert" });
  const help = h("p", { class: "opf-grid-help", id: `${uid}-help` }, "Arrow keys move, Enter or F2 edits, Escape cancels, Delete clears. Paste TSV or CSV from a spreadsheet with Ctrl+V; Ctrl+C copies the selection as TSV.");
  const pasteArea = h("textarea", { id: `${uid}-paste`, rows: 4, spellcheck: "false", placeholder: "Paste cells copied from Excel or Sheets, or CSV text" });
  const pasteButton = h("button", { type: "button", "aria-disabled": "false" }, "Paste at selected cell");
  const pasteBox = h("details", { class: "opf-grid-paste" }, h("summary", {}, "Paste text"), h("label", { for: `${uid}-paste` }, "Text from a spreadsheet or CSV file"), pasteArea, pasteButton);
  table.setAttribute("aria-describedby", help.id);
  // A shared dataset: which one, how many items use it, and a way to stop sharing.
  const datasetText = h("span", { "data-role": "dataset-note" });
  const detachButton = h("button", { type: "button", "data-action": "detach-dataset", title: "Give this item its own copy of the data. The shared dataset stays for the other items." }, "Use a copy of the data");
  const datasetRow = h("div", { class: "opf-grid-dataset", role: "note", hidden: true }, datasetText, detachButton);
  // The number format of the selected column.
  const formatInput = h("input", { type: "text", id: `${uid}-format`, "data-role": "column-format", list: `${uid}-formats`, autocomplete: "off", spellcheck: "false", placeholder: "General" });
  const formatList = h("datalist", { id: `${uid}-formats` }, ["#,##0", "#,##0.0", "#,##0.00", "0%", "0.0%", "$#,##0", "$#,##0.00", "0.00"].map((value) => h("option", { value })));
  const formatLabel = h("label", { for: formatInput.id }, "Column format");
  const formatApply = h("button", { type: "button", "data-action": "apply-format", "aria-disabled": "false" }, "Apply");
  const formatClear = h("button", { type: "button", "data-action": "clear-format", "aria-disabled": "false" }, "Clear");
  const formatError = h("span", { class: "opf-grid-format-error", role: "alert", "data-role": "format-error" });
  const formatRow = h("div", { class: "opf-grid-format", hidden: true }, formatLabel, formatInput, formatList, formatApply, formatClear, formatError);
  // A chart's category, X and series columns.
  const mappingBody = h("div", { "data-role": "mapping-body" });
  const mappingBox = h("details", { class: "opf-grid-mapping", hidden: true }, h("summary", {}, "Chart columns"), mappingBody);
  root.append(h("div", { class: "opf-grid-title" }, titleText, pathText), unavailable, datasetRow, toolbar, formatRow, scroll, mappingBox, notes, help, pasteBox, statusEl, errorEl);
  container.append(root);
  scroll.style.setProperty("--opf-grid-max-height", options.maxHeight ?? "320px");

  const say = (message) => {
    errorEl.textContent = "";
    statusEl.textContent = message;
    options.onStatus?.(message, { error: false });
  };
  const complain = (message) => {
    statusEl.textContent = "";
    errorEl.textContent = message;
    options.onStatus?.(message, { error: true });
  };

  // --- toolbar -----------------------------------------------------------------------------------
  const buttons = new Map();
  const addButton = (name, label, handler, title) => {
    const button = h("button", { type: "button", "data-action": name, title: title ?? label, "aria-disabled": "false" }, label);
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") return;
      handler();
    });
    buttons.set(name, button);
    return button;
  };
  const sep = () => h("span", { class: "opf-grid-sep", role: "separator" });
  const formatSelect = h("select", { "aria-label": "Number format", "data-role": "number-format" });
  const headerBox = h("input", { type: "checkbox", id: `${uid}-header` });
  const headerLabel = h("label", { class: "opf-grid-check", for: `${uid}-header` }, headerBox, "Header row");
  toolbar.append(
    addButton("insert-row-above", "Insert row above", () => rowOp("insert-above")),
    addButton("insert-row-below", "Insert row below", () => rowOp("insert-below")),
    addButton("delete-rows", "Delete rows", () => rowOp("delete")),
    addButton("move-row-up", "Move row up", () => rowOp("up")),
    addButton("move-row-down", "Move row down", () => rowOp("down")),
    sep(),
    addButton("insert-column-left", "Insert column left", () => columnOp("insert-left")),
    addButton("insert-column-right", "Insert column right", () => columnOp("insert-right")),
    addButton("delete-columns", "Delete columns", () => columnOp("delete")),
    addButton("move-column-left", "Move column left", () => columnOp("left")),
    addButton("move-column-right", "Move column right", () => columnOp("right")),
    sep(),
    addButton("sort-ascending", "Sort A to Z", () => sort("asc"), "Sort the rows by the selected column, ascending"),
    addButton("sort-descending", "Sort Z to A", () => sort("desc"), "Sort the rows by the selected column, descending"),
    addButton("transpose", "Swap rows and columns", () => transpose(), "Swap categories and series"),
    headerLabel,
    sep(),
    addButton("copy", "Copy as TSV", () => copyToClipboard()),
    h("label", {}, "Number format", formatSelect),
  );
  formatSelect.append(
    h("option", { value: "auto" }, `Automatic (${resolveNumberFormat("auto", options.locale ?? doc.documentElement?.lang ?? doc.defaultView?.navigator?.language).label})`),
    h("option", { value: "." }, `${NUMBER_FORMATS["."].label} (decimal point)`),
    h("option", { value: "," }, `${NUMBER_FORMATS[","].label} (decimal comma)`),
  );
  formatSelect.value = numberFormat;
  formatSelect.addEventListener("change", () => {
    numberFormat = formatSelect.value;
    rebuild();
    say(`Numbers are read and shown as ${NUMBER_FORMATS[decimal()].label}.`);
  });
  headerBox.addEventListener("change", () => {
    const enabled = headerBox.checked;
    attempt(() => setGridHeader(editor, target.path, enabled, {}), () => (enabled ? "The first row is now the header row." : "The header row is now an ordinary row."), () => {
      headerBox.checked = !enabled;
    });
  });
  toolbar.addEventListener("keydown", (event) => {
    const items = [...toolbar.querySelectorAll("button")].filter((button) => !button.hidden);
    const index = items.indexOf(doc.activeElement);
    if (index < 0 || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  });
  toolbar.addEventListener("focusin", (event) => {
    if (event.target.tagName !== "BUTTON") return;
    for (const button of toolbar.querySelectorAll("button")) button.tabIndex = button === event.target ? 0 : -1;
  });
  for (const button of toolbar.querySelectorAll("button")) button.tabIndex = button.dataset.action === "insert-row-above" ? 0 : -1;

  pasteButton.addEventListener("click", () => {
    if (!pasteArea.value) return complain("Paste some text into the box first.");
    if (pasteText(pasteArea.value)) pasteArea.value = "";
  });

  // --- selection geometry ---------------------------------------------------------------------
  const cellAt = (u, c) => grid?.lines[u]?.[c];
  const anchorOf = (u, c) => {
    const cell = cellAt(u, c);
    return cell?.covered ? cellAt(cell.owner.line, cell.owner.column) : cell;
  };
  const off = () => (grid?.hasHeader ? 1 : 0);

  function expand(rect) {
    let next = { ...rect };
    let changed = true;
    while (changed) {
      changed = false;
      for (const line of grid.lines)
        for (const cell of line) {
          if (cell.covered || (cell.rowSpan === 1 && cell.colSpan === 1)) continue;
          const merge = { top: cell.line, left: cell.column, bottom: cell.line + cell.rowSpan - 1, right: cell.column + cell.colSpan - 1 };
          const touches = !(merge.bottom < next.top || merge.top > next.bottom || merge.right < next.left || merge.left > next.right);
          const inside = merge.top >= next.top && merge.left >= next.left && merge.bottom <= next.bottom && merge.right <= next.right;
          if (touches && !inside) {
            next = { top: Math.min(next.top, merge.top), left: Math.min(next.left, merge.left), bottom: Math.max(next.bottom, merge.bottom), right: Math.max(next.right, merge.right) };
            changed = true;
          }
        }
    }
    return next;
  }
  const rect = () =>
    expand({
      top: Math.min(selection.anchor.u, selection.focus.u),
      bottom: Math.max(selection.anchor.u, selection.focus.u),
      left: Math.min(selection.anchor.c, selection.focus.c),
      right: Math.max(selection.anchor.c, selection.focus.c),
    });
  const addr = (u, c) => (grid.hasHeader && u === 0 ? { section: "header", row: 0, column: c } : { section: "body", row: u - off(), column: c });
  const clampCell = (u, c) => ({ u: Math.max(0, Math.min(grid.lines.length - 1, u)), c: Math.max(0, Math.min(grid.columnCount - 1, c)) });
  function setSelection(anchor, focus, { scroll: scrollIt = true } = {}) {
    if (!grid) return;
    const a = anchorOf(anchor.u, anchor.c);
    const f = anchorOf(focus.u, focus.c);
    selection.anchor = { u: a.line, c: a.column };
    selection.focus = { u: f.line, c: f.column };
    paint();
    if (scrollIt) cellNode(f.line, f.column)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  const activeCell = () => anchorOf(selection.focus.u, selection.focus.c);

  // --- rendering -----------------------------------------------------------------------------------
  const cellNode = (u, c) => tbody.querySelector(`td[data-line="${u}"][data-column="${c}"]`);

  function renderRuns(node, runs) {
    for (const run of runs) {
      if (typeof run === "string") node.append(run);
      else {
        const span = h("span", {}, run.text);
        if (run.bold) span.style.fontWeight = "700";
        if (run.italic) span.style.fontStyle = "italic";
        const decoration = [run.underline ? "underline" : "", run.strikethrough ? "line-through" : ""].filter(Boolean).join(" ");
        if (decoration) span.style.textDecoration = decoration;
        if (run.superscript) span.style.verticalAlign = "super";
        if (run.subscript) span.style.verticalAlign = "sub";
        if (run.superscript || run.subscript) span.style.fontSize = "0.8em";
        node.append(span);
      }
    }
  }

  function buildTable() {
    thead.replaceChildren();
    tbody.replaceChildren();
    notes.replaceChildren();
    const roles = grid.columnRoles;
    const rulerRow = h("tr", { role: "row", "aria-rowindex": 1 });
    const corner = h("th", { role: "columnheader", scope: "col", "aria-label": "Select all cells", "data-ruler": "corner", "aria-colindex": 1 }, "");
    rulerRow.append(corner);
    for (let c = 0; c < grid.columnCount; c += 1) {
      const role = roles[c];
      const role_ = role === "category" ? "categories" : role === "series" ? "series" : role === "x" ? "x values" : role === "label" ? "labels" : role === "other" ? "not plotted" : "";
      const format = grid.columnFormats?.[c];
      const hint = [role_, format ? `format ${format}` : ""].filter(Boolean).join(" · ");
      const th = h("th", { role: "columnheader", scope: "col", "aria-colindex": c + 2, "data-ruler": "column", "data-column": c, "aria-label": `Column ${columnLabel(c)}${hint ? `, ${hint}` : ""}` }, columnLabel(c), hint ? h("span", { class: "opf-grid-role" }, hint) : null);
      rulerRow.append(th);
    }
    thead.append(rulerRow);
    table.setAttribute("aria-rowcount", String(grid.lines.length + 1));
    table.setAttribute("aria-colcount", String(grid.columnCount + 1));
    table.setAttribute("aria-label", `${target.kind === "chart" ? "Chart" : "Table"} data`);
    grid.lines.forEach((line, u) => {
      const header = grid.hasHeader && u === 0;
      const tr = h("tr", { role: "row", "aria-rowindex": u + 2 }, h("th", { role: "rowheader", scope: "row", "data-ruler": "row", "data-line": u, "aria-colindex": 1 }, header ? "Header" : String(u - off() + 1)));
      for (const cell of line) {
        if (cell.covered) continue;
        const merged = cell.rowSpan > 1 || cell.colSpan > 1;
        const numeric = target.kind === "chart" && !header && roles[cell.column] !== "category" && roles[cell.column] !== "label" && roles[cell.column] !== "other";
        const classes = ["opf-grid-cell"];
        if (header) classes.push("opf-grid-header");
        if (numeric) classes.push("opf-grid-number");
        if (merged) classes.push("opf-grid-merged");
        if (cell.warning) classes.push("opf-grid-warn");
        const gap = target.kind === "chart" && !header && cell.text === "" && numeric;
        if (gap) classes.push("opf-grid-gap");
        const td = h("td", {
          role: "gridcell",
          class: classes.join(" "),
          tabindex: -1,
          "data-line": u,
          "data-column": cell.column,
          "aria-colindex": cell.column + 2,
          "aria-selected": "false",
          "aria-readonly": "false",
          colspan: cell.colSpan > 1 ? cell.colSpan : undefined,
          rowspan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
          "aria-colspan": cell.colSpan > 1 ? cell.colSpan : undefined,
          "aria-rowspan": cell.rowSpan > 1 ? cell.rowSpan : undefined,
          "aria-label": gap ? "Empty, a gap in the chart" : undefined,
          title: cell.warning,
        });
        if (cell.runs) renderRuns(td, cell.runs);
        else if (cell.display !== undefined) {
          // The number as the slide draws it; the raw value is what editing and copying use.
          td.textContent = cell.display;
          td.classList.add("opf-grid-formatted");
          if (!cell.warning) td.title = `Stored as ${cell.text}`;
        } else td.textContent = cell.text;
        tr.append(td);
      }
      tbody.append(tr);
    });
    for (const warning of grid.warnings.slice(0, 20)) notes.append(h("li", {}, warning.message));
    if (grid.warnings.length > 20) notes.append(h("li", {}, `${grid.warnings.length - 20} more.`));
  }

  function paint() {
    if (!grid) return;
    const r = rect();
    const active = activeCell();
    for (const td of tbody.querySelectorAll("td")) {
      const u = Number(td.dataset.line);
      const c = Number(td.dataset.column);
      const selected = u >= r.top && u <= r.bottom && c >= r.left && c <= r.right;
      td.setAttribute("aria-selected", String(selected));
      td.classList.toggle("opf-grid-active", Boolean(active) && active.line === u && active.column === c);
      td.tabIndex = active && active.line === u && active.column === c ? 0 : -1;
      if (invalid.has(`${u}:${c}`)) td.setAttribute("aria-invalid", "true");
      else td.removeAttribute("aria-invalid");
    }
    updateToolbar(r);
  }

  function updateToolbar(r) {
    const start = off();
    const hasBody = r.bottom >= start;
    const top = Math.max(r.top, start);
    const count = hasBody ? r.bottom - top + 1 : 0;
    const first = top - start;
    const columns = r.right - r.left + 1;
    const disabled = {
      "insert-row-above": !hasBody,
      "insert-row-below": false,
      "delete-rows": !hasBody || count >= grid.rowCount,
      "move-row-up": !hasBody || first <= 0,
      "move-row-down": !hasBody || first + count >= grid.rowCount,
      "insert-column-left": false,
      "insert-column-right": false,
      "delete-columns": columns >= grid.columnCount,
      "move-column-left": r.left <= 0,
      "move-column-right": r.right >= grid.columnCount - 1,
      "sort-ascending": grid.rowCount < 2,
      "sort-descending": grid.rowCount < 2,
      transpose: target.kind !== "chart" || grid.columnCount < 2,
    };
    for (const [name, button] of buttons) button.setAttribute("aria-disabled", String(Boolean(disabled[name])));
    const shared = Boolean(target.dataset);
    buttons.get("transpose").hidden = target.kind !== "chart" || shared;
    // The toolbar stays one tab stop even when the button that held it is hidden for this kind of content.
    const visible = [...toolbar.querySelectorAll("button")].filter((button) => !button.hidden);
    if (!visible.some((button) => button.tabIndex === 0) && visible.length) visible[0].tabIndex = 0;
    headerLabel.hidden = target.kind !== "table" || shared;
    headerBox.checked = grid.hasHeader;
    updateFormatRow();
    const nameRows = count > 1 ? `${count} rows` : "row";
    buttons.get("delete-rows").textContent = count > 1 ? `Delete ${count} rows` : "Delete rows";
    buttons.get("insert-row-above").setAttribute("aria-label", `Insert ${nameRows === "row" ? "row" : nameRows} above`);
    buttons.get("insert-row-below").setAttribute("aria-label", `Insert ${nameRows === "row" ? "row" : nameRows} below`);
    buttons.get("delete-columns").textContent = columns > 1 ? `Delete ${columns} columns` : "Delete columns";
  }

  // --- model sync --------------------------------------------------------------------------------
  function resolveTarget() {
    const path = getPath();
    if (!path) return undefined;
    return resolveDataGridTarget(editor.document, path);
  }

  function rebuild() {
    if (destroyed) return;
    rebuilding = true;
    try {
      rebuildTable();
    } finally {
      rebuilding = false;
    }
  }

  function rebuildTable() {
    const next = target;
    root.hidden = !next;
    if (!next) {
      grid = undefined;
      return;
    }
    titleText.textContent = next.kind === "chart" ? "Chart data" : "Table data";
    pathText.textContent = next.path;
    unavailable.hidden = next.editable !== false ? true : false;
    scroll.hidden = toolbar.hidden = notes.hidden = pasteBox.hidden = help.hidden = next.editable === false;
    if (next.editable === false) {
      unavailable.textContent = next.reason;
      datasetRow.hidden = formatRow.hidden = mappingBox.hidden = true;
      grid = undefined;
      return;
    }
    grid = describeDataGrid(editor.document, next.path, opts());
    buildTable();
    buildDatasetRow();
    buildMapping();
    const clamped = clampCell(selection.focus.u, selection.focus.c);
    const anchor = clampCell(selection.anchor.u, selection.anchor.c);
    const f = anchorOf(clamped.u, clamped.c);
    const a = anchorOf(anchor.u, anchor.c);
    selection.focus = { u: f.line, c: f.column };
    selection.anchor = { u: a.line, c: a.column };
    paint();
    if (editing && cellAt(editing.u, editing.c) && !cellAt(editing.u, editing.c).covered) mountEditor(editing.u, editing.c, editing.text, editing.caret);
    else editing = null;
    if (hadFocus && !editing) cellNode(selection.focus.u, selection.focus.c)?.focus({ preventScroll: true });
  }

  function dataSignature() {
    if (!target || target.editable === false) return "";
    try {
      return JSON.stringify([target.path, editor.get(target.path), target.dataset ? editor.document.datasets?.[target.dataset.id] : undefined, numberFormat]);
    } catch {
      return "";
    }
  }

  function sync({ force = false } = {}) {
    if (destroyed) return;
    hadFocus = root.contains(doc.activeElement) && doc.activeElement.closest?.("td,textarea") != null;
    const next = resolveTarget();
    const changedTarget = JSON.stringify(next) !== JSON.stringify(target);
    const previousPath = target?.path;
    target = next;
    if (changedTarget) {
      if (next?.path !== previousPath) {
        selection.anchor = { u: 0, c: 0 };
        selection.focus = { u: 0, c: 0 };
        invalid = new Map();
        editing = null;
        statusEl.textContent = "";
        errorEl.textContent = "";
      }
      options.onTargetChange?.(next);
    }
    const sig = dataSignature();
    if (!force && !changedTarget && sig === signature && grid) return;
    signature = sig;
    rebuild();
  }
  const unsubscribe = editor.subscribe(() => sync());

  // --- shared dataset, number format, mapping (RR-54) -----------------------------------------------
  function buildDatasetRow() {
    const info = target?.dataset;
    datasetRow.hidden = !info;
    if (!info) return;
    const used = info.count === 1 ? "used by 1 item" : `used by ${info.count} items`;
    datasetText.replaceChildren("Shared dataset \u2018", h("strong", {}, info.id), `\u2019 \u2014 ${used}.${info.fields ? ` Showing ${info.fields.join(", ")}.` : ""} Edits change the dataset for every item that uses it.`);
    datasetRow.setAttribute("aria-label", `Shared dataset ${info.id}, ${used}`);
  }

  const formatColumn = () => activeCell()?.column ?? 0;
  // The column the field is for. It follows the selected column, but not while someone types in the field: a click on another cell
  // moves the selection before the field's change event fires, and the format typed for one column must not land on the next.
  let formatBound = 0;
  function updateFormatRow() {
    const visible = Boolean(grid?.hasHeader) && target?.editable !== false && supportsChartTableData;
    formatRow.hidden = !visible;
    if (!visible) return;
    if (doc.activeElement !== formatInput) {
      formatBound = formatColumn();
      formatInput.value = grid.columnFormats?.[formatBound] ?? "";
      formatInput.removeAttribute("aria-invalid");
      formatError.textContent = "";
    }
    const column = formatBound;
    const name = grid.columnNames?.[column];
    formatLabel.textContent = `Format of column ${columnLabel(column)}${name ? ` (${name})` : ""}${target?.dataset ? " in the shared dataset" : ""}`;
    formatClear.setAttribute("aria-disabled", String(grid.columnFormats?.[column] === undefined));
  }
  formatInput.addEventListener("input", () => {
    const error = columnFormatError(formatInput.value);
    formatError.textContent = error ?? "";
    if (error) formatInput.setAttribute("aria-invalid", "true");
    else formatInput.removeAttribute("aria-invalid");
  });
  function applyFormat(value) {
    const column = formatBound;
    const error = columnFormatError(value);
    if (error) {
      formatInput.setAttribute("aria-invalid", "true");
      formatError.textContent = error;
      return;
    }
    formatError.textContent = "";
    formatInput.removeAttribute("aria-invalid");
    if ((grid.columnFormats?.[column] ?? "") === value) return;
    const cleared = value === "";
    attempt(() => setGridColumnFormat(editor, target.path, column, cleared ? null : value, {}), cleared ? `Column ${columnLabel(column)} shows numbers as they are.` : `Column ${columnLabel(column)} shows numbers as ${value}.`, (failure) => {
      formatError.textContent = messageOf(failure);
    });
  }
  formatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFormat(formatInput.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      formatInput.value = grid?.columnFormats?.[formatBound] ?? "";
      formatError.textContent = "";
      formatInput.removeAttribute("aria-invalid");
    }
  });
  formatInput.addEventListener("change", () => applyFormat(formatInput.value));
  formatApply.addEventListener("click", () => applyFormat(formatInput.value));
  formatClear.addEventListener("click", () => {
    if (formatClear.getAttribute("aria-disabled") === "true") return;
    formatInput.value = "";
    applyFormat("");
  });
  detachButton.addEventListener("click", () => {
    if (!target?.dataset) return;
    const id = target.dataset.id;
    attempt(() => detachGridDataset(editor, target.path, {}), `This ${target.kind} now has its own copy of dataset \u2018${id}\u2019.`);
  });

  function buildMapping() {
    mappingBody.replaceChildren();
    mappingBox.hidden = !grid || target?.kind !== "chart" || !supportsChartTableData;
    if (mappingBox.hidden) return;
    let view;
    try {
      view = describeChartMapping(editor.document, target.path);
    } catch {
      mappingBox.hidden = true;
      return;
    }
    const names = view.columns.map((column) => column.name);
    const selectOf = (label, value, onChange, allowed) => {
      const select = h("select", { "aria-label": label }, names.map((name, index) => (allowed(index) ? h("option", { value: name }, name || `(column ${columnLabel(index)})`) : null)));
      select.value = value;
      select.addEventListener("change", () => onChange(select.value));
      return h("label", {}, label, select);
    };
    const category = names.indexOf(view.category);
    mappingBody.append(selectOf(view.xy ? "Label column" : "Category column", view.category, (name) => setMapping({ category: name }, `The category column is now ${JSON.stringify(name)}.`), () => true));
    if (view.xy) mappingBody.append(selectOf("X column", view.x ?? "", (name) => setMapping({ x: name }, `The X column is now ${JSON.stringify(name)}.`), (index) => index !== category));
    const plotted = new Set(view.series);
    const boxes = view.columns.map((column, index) => {
      if (column.name === view.category || column.name === view.x) return null;
      const input = h("input", { type: "checkbox", value: column.name, checked: plotted.has(column.name) || undefined });
      input.checked = plotted.has(column.name);
      input.addEventListener("change", () => {
        const wanted = [...view.series.filter((name) => name !== column.name), ...(input.checked ? [column.name] : [])];
        // Series that run in column order stay in column order; series someone arranged keep their order and a column switched on goes after them.
        const inColumnOrder = view.series.every((name, at) => at === 0 || names.indexOf(view.series[at - 1]) < names.indexOf(name));
        const ordered = inColumnOrder ? names.filter((name) => wanted.includes(name)) : [...view.series.filter((name) => wanted.includes(name)), ...names.filter((name) => wanted.includes(name) && !view.series.includes(name))];
        setMapping({ series: ordered }, input.checked ? `${column.name || `Column ${columnLabel(index)}`} is now plotted.` : `${column.name || `Column ${columnLabel(index)}`} is no longer plotted.`, () => {
          input.checked = !input.checked;
        });
      });
      return h("label", {}, input, column.name || `(column ${columnLabel(index)})`);
    });
    mappingBody.append(h("fieldset", {}, h("legend", {}, "Series (plotted columns)"), boxes));
    mappingBody.append(h("p", {}, view.authored ? "This chart has its own column mapping. Choosing the default columns removes it." : "Default: the first column labels the categories and every other column is a series."));
  }
  function setMapping(wanted, message, onFail) {
    attempt(() => setChartMapping(editor, target.path, wanted, {}), message, (failure) => {
      onFail?.(failure);
      buildMapping();
    });
  }

  // --- editing --------------------------------------------------------------------------------------
  function mountEditor(u, c, text, caret) {
    const node = cellNode(u, c);
    const cell = cellAt(u, c);
    if (!node || !cell) return;
    editing = { u, c, text, caret };
    const area = h("textarea", { rows: 1, spellcheck: "false", "aria-label": `Edit ${describeAddress(addr(u, c))}`, "data-role": "cell-editor" });
    area.value = text;
    node.replaceChildren(area);
    node.classList.add("opf-grid-editing");
    const fit = () => {
      area.style.height = "auto";
      area.style.height = `${area.scrollHeight}px`;
    };
    area.addEventListener("input", () => {
      editing.text = area.value;
      fit();
      checkLive(area, u, c);
    });
    area.addEventListener("keydown", (event) => editorKeydown(event, area, u, c));
    area.addEventListener("blur", () => {
      // Focus left the cell (a click elsewhere): save a valid edit, otherwise put the old value back and say why.
      if (rebuilding || !editing || editing.u !== u || editing.c !== c || !area.isConnected) return;
      if (!commitEdit({ blur: true })) {
        editing = null;
        rebuild();
      }
    });
    fit();
    area.focus();
    const end = caret ?? text.length;
    area.setSelectionRange(end, end);
    checkLive(area, u, c);
  }

  function checkLive(area, u, c) {
    const issues = gridCellIssues(editor.document, target.path, [{ ...addr(u, c), text: area.value }], opts());
    if (issues.length) {
      area.setAttribute("aria-invalid", "true");
      complain(issues[0].message);
    } else {
      area.removeAttribute("aria-invalid");
      errorEl.textContent = "";
    }
  }

  function startEdit(u, c, replacement) {
    const cell = anchorOf(u, c);
    if (!cell || editing) return;
    invalid = new Map();
    selection.anchor = selection.focus = { u: cell.line, c: cell.column };
    paint();
    mountEditor(cell.line, cell.column, replacement ?? cell.text, replacement === undefined ? undefined : replacement.length);
  }

  function endEdit() {
    editing = null;
    rebuild();
  }

  function commitEdit({ blur = false } = {}) {
    if (!editing) return true;
    const { u, c } = editing;
    const area = cellNode(u, c)?.querySelector("textarea");
    const text = area ? area.value : editing.text;
    const cell = cellAt(u, c);
    if (text === cell.text) {
      editing = null;
      rebuild();
      return true;
    }
    const draft = editing;
    editing = null;
    try {
      setGridCells(editor, target.path, [{ ...addr(u, c), text }], opts());
      invalid = new Map();
      say(`${describeAddress(addr(u, c))} changed. Undo restores the previous value.`);
      options.onChange?.({ action: "set-cells" });
      return true;
    } catch (error) {
      invalid = new Map([[`${u}:${c}`, messageOf(error)]]);
      complain(blur ? `${messageOf(error)} The old value was kept.` : messageOf(error));
      if (!blur) {
        editing = draft;
        rebuild();
        cellNode(u, c)?.setAttribute("aria-invalid", "true");
      }
      return false;
    }
  }

  function moveAfterEdit(du, dc) {
    const cell = activeCell();
    const next = stepFrom(cell, du, dc);
    setSelection(next, next);
    cellNode(next.u, next.c)?.focus({ preventScroll: true });
  }

  function editorKeydown(event, area, u, c) {
    event.stopPropagation();
    // Enter or Tab that confirms an input method's composition is not a command.
    if (event.isComposing) return;
    if (event.key === "Enter" && event.altKey) {
      event.preventDefault();
      const { selectionStart: start, selectionEnd: end } = area;
      area.value = `${area.value.slice(0, start)}\n${area.value.slice(end)}`;
      area.setSelectionRange(start + 1, start + 1);
      area.dispatchEvent(new Event("input"));
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const backwards = event.shiftKey;
      selection.anchor = selection.focus = { u, c };
      if (!commitEdit()) return;
      if (event.key === "Enter") moveAfterEdit(backwards ? -1 : 1, 0);
      else moveAfterEdit(0, backwards ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      editing = null;
      errorEl.textContent = "";
      rebuild();
      cellNode(u, c)?.focus({ preventScroll: true });
      say("Edit cancelled.");
    }
  }

  // --- operations ------------------------------------------------------------------------------------
  function attempt(action, message, onFail) {
    try {
      const change = action();
      invalid = new Map();
      say(`${typeof message === "function" ? message(change) : message} Undo restores the previous data.`);
      options.onChange?.(change);
      return change;
    } catch (error) {
      complain(messageOf(error));
      onFail?.(error);
      return undefined;
    }
  }

  const markIssues = (error) => {
    invalid = new Map();
    for (const issue of error?.issues ?? []) {
      if (!issue || issue.column === undefined) continue;
      const u = issue.section === "header" ? 0 : (issue.row ?? 0) + off();
      invalid.set(`${u}:${issue.column}`, issue.message);
    }
    paint();
  };

  function bodyRange() {
    const r = rect();
    const start = off();
    const top = Math.max(r.top, start);
    return { r, first: top - start, count: Math.max(0, r.bottom - top + 1), hasBody: r.bottom >= start };
  }

  function rowOp(kind) {
    const { r, first, count, hasBody } = bodyRange();
    const n = Math.max(1, count);
    let action;
    let message;
    let next;
    if (kind === "insert-above") {
      action = () => insertGridRows(editor, target.path, first, n, opts());
      message = `Inserted ${plural(n, "row")} above.`;
      next = { top: first + off(), bottom: first + off() + n - 1 };
    } else if (kind === "insert-below") {
      const at = hasBody ? first + count : 0;
      action = () => insertGridRows(editor, target.path, at, n, opts());
      message = `Inserted ${plural(n, "row")} below.`;
      next = { top: at + off(), bottom: at + off() + n - 1 };
    } else if (kind === "delete") {
      const indices = Array.from({ length: count }, (_, i) => first + i);
      action = () => deleteGridRows(editor, target.path, indices, opts());
      message = `Deleted ${plural(count, "row")}.`;
      const at = Math.min(first, grid.rowCount - count - 1);
      next = { top: Math.max(0, at) + off(), bottom: Math.max(0, at) + off() };
    } else {
      const to = kind === "up" ? first - 1 : first + 1;
      action = () => moveGridRows(editor, target.path, first, to, count, opts());
      message = `Moved ${plural(count, "row")} ${kind === "up" ? "up" : "down"}.`;
      next = { top: to + off(), bottom: to + off() + count - 1 };
    }
    // The toolbar keeps the focus; the selection follows the rows that were inserted, moved or are now where the deleted ones were.
    if (attempt(action, message)) setSelection({ u: next.top, c: r.left }, { u: next.bottom, c: r.right }, { scroll: false });
  }

  function columnOp(kind) {
    const r = rect();
    const count = r.right - r.left + 1;
    let action;
    let message;
    let next;
    if (kind === "insert-left") {
      action = () => insertGridColumns(editor, target.path, r.left, count, opts());
      message = `Inserted ${plural(count, "column")} to the left.`;
      next = { left: r.left, right: r.left + count - 1 };
    } else if (kind === "insert-right") {
      action = () => insertGridColumns(editor, target.path, r.right + 1, count, opts());
      message = `Inserted ${plural(count, "column")} to the right.`;
      next = { left: r.right + 1, right: r.right + count };
    } else if (kind === "delete") {
      const indices = Array.from({ length: count }, (_, i) => r.left + i);
      action = () => deleteGridColumns(editor, target.path, indices, opts());
      message = `Deleted ${plural(count, "column")}.`;
      const at = Math.min(r.left, grid.columnCount - count - 1);
      next = { left: Math.max(0, at), right: Math.max(0, at) };
    } else {
      const to = kind === "left" ? r.left - 1 : r.left + 1;
      action = () => moveGridColumns(editor, target.path, r.left, to, count, opts());
      message = `Moved ${plural(count, "column")} ${kind === "left" ? "left" : "right"}.`;
      next = { left: to, right: to + count - 1 };
    }
    if (attempt(action, message)) {
      setSelection({ u: r.top, c: next.left }, { u: r.bottom, c: next.right }, { scroll: false });
      // A new chart series starts unnamed: put the cursor in its name cell so it can be named at once.
      if ((kind === "insert-left" || kind === "insert-right") && target.kind === "chart") startEdit(0, next.left);
    }
  }

  function sort(direction) {
    const column = activeCell().column;
    attempt(() => sortGridRows(editor, target.path, column, { direction, ...opts() }), (change) => (change.sorted === false ? `Column ${columnLabel(column)} is already in that order.` : `Sorted by column ${columnLabel(column)}, ${direction === "asc" ? "A to Z" : "Z to A"}.`));
  }

  function transpose() {
    const change = attempt(() => transposeGridData(editor, target.path, {}), (done) => `Swapped categories and series.${done.relabelled ? ` ${plural(done.relabelled, "category label")} became text.` : ""}`);
    if (change) setSelection({ u: 0, c: 0 }, { u: 0, c: 0 }, { scroll: false });
  }

  function clearSelection() {
    const r = rect();
    const edits = [];
    for (let u = r.top; u <= r.bottom; u += 1)
      for (let c = r.left; c <= r.right; c += 1) {
        const cell = cellAt(u, c);
        if (!cell || cell.covered) continue;
        edits.push({ ...addr(u, c), text: "" });
      }
    if (!edits.length) return;
    attempt(() => setGridCells(editor, target.path, edits, opts()), `${plural(edits.length, "cell")} cleared.`);
  }

  // --- clipboard -----------------------------------------------------------------------------------------
  function selectionText() {
    const r = rect();
    const rows = [];
    for (let u = r.top; u <= r.bottom; u += 1) rows.push(grid.lines[u].slice(r.left, r.right + 1).map((cell) => cell.text));
    return { text: toDelimited(rows, { delimiter: "\t" }), rows: rows.length, columns: r.right - r.left + 1 };
  }

  // Copy the selection as TSV with the async clipboard (falling back to a hidden textarea where it is unavailable or refused); `then` runs after a copy that worked.
  function copyToClipboard(then) {
    const { text, rows, columns } = selectionText();
    const done = () => {
      say(`Copied ${plural(rows, "row")} by ${plural(columns, "column")} as tab-separated text.`);
      then?.();
    };
    const fallback = () => {
      const previous = doc.activeElement;
      const area = h("textarea", { "aria-hidden": "true", tabindex: -1 });
      area.style.cssText = "position:fixed;opacity:0;left:-9999px";
      area.value = text;
      doc.body.append(area);
      area.select();
      let ok = false;
      try {
        ok = doc.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
      previous?.focus?.({ preventScroll: true });
      if (ok) done();
      else complain("The browser blocked copying. Select the cells and press Ctrl+C.");
    };
    if (doc.defaultView?.navigator?.clipboard?.writeText) doc.defaultView.navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  function pasteText(text) {
    let rows;
    try {
      rows = parseDelimited(text).rows;
    } catch (error) {
      complain(messageOf(error));
      return false;
    }
    if (!rows.length) {
      complain("There is nothing to paste.");
      return false;
    }
    const r = rect();
    invalid = new Map();
    const single = rows.length === 1 && rows[0].length === 1;
    const multi = r.top !== r.bottom || r.left !== r.right;
    try {
      let change;
      if (single && multi) {
        const edits = [];
        for (let u = r.top; u <= r.bottom; u += 1)
          for (let c = r.left; c <= r.right; c += 1) {
            const cell = cellAt(u, c);
            if (cell && !cell.covered) edits.push({ ...addr(u, c), text: rows[0][0] });
          }
        change = setGridCells(editor, target.path, edits, opts());
        say(`Filled ${plural(edits.length, "cell")}. Undo restores the previous data.`);
      } else {
        change = pasteGridText(editor, target.path, addr(r.top, r.left), rows, opts());
        const width = rows.reduce((most, row) => Math.max(most, row.length), 0);
        const note = change.decimal !== decimal() ? ` Numbers were read as ${NUMBER_FORMATS[change.decimal].label}, because the current format did not fit.` : "";
        say(`Pasted ${plural(rows.length, "row")} by ${plural(width, "column")}.${note} Undo restores the previous data.`);
        setSelection({ u: r.top, c: r.left }, { u: Math.min(r.top + rows.length - 1, grid.lines.length - 1), c: Math.min(r.left + width - 1, grid.columnCount - 1) });
      }
      options.onChange?.(change);
      return true;
    } catch (error) {
      complain(messageOf(error));
      markIssues(error);
      return false;
    }
  }

  // --- navigation -----------------------------------------------------------------------------------------
  function stepFrom(cell, du, dc) {
    let u = cell.line;
    let c = cell.column;
    if (du > 0) u = cell.line + cell.rowSpan - 1 + du;
    else if (du < 0) u = cell.line + du;
    if (dc > 0) c = cell.column + cell.colSpan - 1 + dc;
    else if (dc < 0) c = cell.column + dc;
    return clampCell(u, c);
  }

  function navigate(event) {
    const cell = activeCell();
    const extend = event.shiftKey;
    let next;
    const ctrl = event.ctrlKey || event.metaKey;
    switch (event.key) {
      case "ArrowDown": next = stepFrom(cell, 1, 0); break;
      case "ArrowUp": next = stepFrom(cell, -1, 0); break;
      case "ArrowRight": next = stepFrom(cell, 0, 1); break;
      case "ArrowLeft": next = stepFrom(cell, 0, -1); break;
      case "Home": next = ctrl ? { u: 0, c: 0 } : { u: cell.line, c: 0 }; break;
      case "End": next = ctrl ? { u: grid.lines.length - 1, c: grid.columnCount - 1 } : { u: cell.line, c: grid.columnCount - 1 }; break;
      case "PageDown": next = clampCell(cell.line + 10, cell.column); break;
      case "PageUp": next = clampCell(cell.line - 10, cell.column); break;
      default: return false;
    }
    event.preventDefault();
    // When extending, the moving corner is the focus and the anchor stays; otherwise both move.
    if (extend) setSelection(selection.anchor, next);
    else setSelection(next, next);
    cellNode(next.u, next.c)?.focus({ preventScroll: true });
    cellNode(next.u, next.c)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    return true;
  }

  table.addEventListener("keydown", (event) => {
    if (editing || !grid) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const lower = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (ctrl && !event.altKey) {
      if (lower === "a") {
        event.preventDefault();
        setSelection({ u: 0, c: 0 }, { u: grid.lines.length - 1, c: grid.columnCount - 1 });
        return;
      }
      if (lower === "z" || lower === "y") {
        event.preventDefault();
        event.stopPropagation();
        const change = lower === "y" || event.shiftKey ? editor.redo() : editor.undo();
        say(change ? (lower === "y" || event.shiftKey ? "Redone." : "Undone.") : "Nothing to undo.");
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        const cell = activeCell();
        setSelection({ u: 0, c: cell.column }, { u: grid.lines.length - 1, c: cell.column });
        return;
      }
      if (lower === "c" || lower === "x") {
        // Browsers differ in firing copy for a focused cell that holds no selection, so the keys do the copy themselves.
        event.preventDefault();
        event.stopPropagation();
        copyToClipboard(lower === "x" ? clearSelection : undefined);
        return;
      }
    }
    if (event.key === " " && event.shiftKey) {
      event.preventDefault();
      const cell = activeCell();
      setSelection({ u: cell.line, c: 0 }, { u: cell.line, c: grid.columnCount - 1 });
      return;
    }
    if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      const cell = activeCell();
      startEdit(cell.line, cell.column);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      clearSelection();
      return;
    }
    if (event.key === "Escape") return;
    if (navigate(event)) return;
    if (KEYS_PRINTABLE(event)) {
      event.preventDefault();
      const cell = activeCell();
      startEdit(cell.line, cell.column, event.key);
    }
  });

  // The grid owns the clipboard while focus is in it: hosts that copy and paste OPF at page level must not also act.
  table.addEventListener("copy", (event) => {
    if (editing || !grid) return;
    event.preventDefault();
    event.stopPropagation();
    const { text, rows, columns } = selectionText();
    event.clipboardData?.setData("text/plain", text);
    say(`Copied ${plural(rows, "row")} by ${plural(columns, "column")} as tab-separated text.`);
  });
  table.addEventListener("cut", (event) => {
    if (editing || !grid) return;
    event.preventDefault();
    event.stopPropagation();
    const { text } = selectionText();
    event.clipboardData?.setData("text/plain", text);
    clearSelection();
  });
  table.addEventListener("paste", (event) => {
    if (editing || !grid) return;
    event.preventDefault();
    event.stopPropagation();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    pasteText(text);
  });

  // --- pointer ------------------------------------------------------------------------------------------------
  const cellFromEvent = (event) => {
    const td = event.target.closest?.("td[data-line]");
    return td ? { u: Number(td.dataset.line), c: Number(td.dataset.column) } : undefined;
  };
  table.addEventListener("mousedown", (event) => {
    if (!grid || event.button !== 0) return;
    const ruler = event.target.closest?.("th[data-ruler]");
    if (ruler) {
      event.preventDefault();
      if (editing) commitEdit();
      const kind = ruler.dataset.ruler;
      const last = { u: grid.lines.length - 1, c: grid.columnCount - 1 };
      if (kind === "corner") setSelection({ u: 0, c: 0 }, last);
      else if (kind === "column") {
        const c = Number(ruler.dataset.column);
        setSelection(event.shiftKey ? selection.anchor : { u: 0, c }, { u: last.u, c });
        if (event.shiftKey) selection.anchor = { u: 0, c: selection.anchor.c };
      } else {
        const u = Number(ruler.dataset.line);
        setSelection(event.shiftKey ? selection.anchor : { u, c: 0 }, { u, c: last.c });
        if (event.shiftKey) selection.anchor = { u: selection.anchor.u, c: 0 };
      }
      paint();
      (cellNode(selection.focus.u, selection.focus.c) ?? table).focus?.({ preventScroll: true });
      return;
    }
    const hit = cellFromEvent(event);
    if (!hit) return;
    if (editing) {
      if (editing.u === hit.u && editing.c === hit.c) return;
      if (!commitEdit()) {
        event.preventDefault();
        return;
      }
    }
    dragging = true;
    invalid = new Map();
    setSelection(event.shiftKey ? selection.anchor : hit, hit, { scroll: false });
    // A host that was editing text elsewhere (the slide canvas) saves it when this click takes the focus, and may move the focus back as it does.
    const wanted = { ...selection.focus };
    setTimeout(() => {
      if (destroyed || editing || !grid || root.contains(doc.activeElement)) return;
      cellNode(wanted.u, wanted.c)?.focus({ preventScroll: true });
    }, 0);
  });
  table.addEventListener("mouseover", (event) => {
    if (!dragging) return;
    const hit = cellFromEvent(event);
    if (hit) setSelection(selection.anchor, hit, { scroll: false });
  });
  const endDrag = () => {
    dragging = false;
  };
  doc.addEventListener("mouseup", endDrag);
  table.addEventListener("dblclick", (event) => {
    const hit = cellFromEvent(event);
    if (hit && grid) startEdit(hit.u, hit.c);
  });
  table.addEventListener("focusin", (event) => {
    const node = event.target.closest?.("td[data-line]");
    if (!node || editing) return;
    const u = Number(node.dataset.line);
    const c = Number(node.dataset.column);
    const active = activeCell();
    if (!active || active.line !== u || active.column !== c) setSelection({ u, c }, { u, c }, { scroll: false });
  });

  // --- public ---------------------------------------------------------------------------------------------------
  sync({ force: true });

  return {
    element: root,
    /** Re-read the host's selection (and the document). Call it when the selection or slide changes. */
    refresh: () => sync(),
    /** Focus the active cell. */
    focus() {
      if (grid) cellNode(selection.focus.u, selection.focus.c)?.focus();
    },
    /** The chart or table the grid is bound to, `{ kind, path }`, or undefined. */
    get target() {
      return target ? { ...target } : undefined;
    },
    get numberFormat() {
      return numberFormat;
    },
    /** "auto", "." or ",": how chart numbers are read and shown. */
    setNumberFormat(format) {
      if (!["auto", ".", ","].includes(format)) throw new TypeError('The number format is "auto", "." or ",".');
      numberFormat = format;
      formatSelect.value = format;
      sync({ force: true });
    },
    /** Paste TSV or CSV text at the selected cell, as the clipboard paste does. Returns whether it applied. */
    paste: (text) => (grid ? pasteText(String(text)) : false),
    destroy() {
      destroyed = true;
      unsubscribe();
      doc.removeEventListener("mouseup", endDrag);
      root.remove();
    },
  };
}
