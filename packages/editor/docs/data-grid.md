# Data grid (RR-24)

A spreadsheet-like grid for the data behind a chart and for tables, plus table and chart row and column operations. The grid is framework-free DOM, `role="grid"`, and every edit it makes is one validated, undoable session patch, so the host's preview redraws from the same session events it already subscribes to.

Entry points (all additive):

| Import | What it has |
| --- | --- |
| `@openpresentation/opf-editor/data-grid` | `createDataGrid` (the DOM grid), `resolveDataGridTarget`, `describeDataGrid`, the generic `prepare*` and session forms (`setGridCells`, `pasteGridText`, `insertGridRows`, ...), `gridRangeText`, `gridCellIssues`, `chartColumnRoles` |
| `@openpresentation/opf-editor/tables` | the table forms: `insertTableRows`, `deleteTableRows`, `moveTableRows`, `insertTableColumns`, `deleteTableColumns`, `moveTableColumns`, `sortTableRows`, `setTableHeader`, `setTableCells`, `pasteTableText` (and `prepareTable*`) next to the existing style and merge functions |
| `@openpresentation/opf-editor/chart-data` | the chart forms: `setChartCells`, `pasteChartText`, `insertChartRows`, `deleteChartRows`, `moveChartRows`, `insertChartColumns`, `deleteChartColumns`, `moveChartColumns`, `sortChartRows`, `transposeChart`, `renameChartSeries`, `renameChartCategory` (and `prepareChart*`) |
| `@openpresentation/opf-editor/grid-text` | pure text helpers: `parseDelimited`, `toDelimited`, `parseGridNumber`, `formatGridNumber`, `resolveNumberFormat`, `isCanonicalNumber` |

```js
import { createDataGrid } from "@openpresentation/opf-editor/data-grid";

const grid = createDataGrid(container, {
  editor,                                   // a session from createEditorSession
  getSelectedPath: () => selectedPath,      // follow the host's selection into a chart or table
  // path: "slides.2.blocks.0.chart",       // or bind to one chart or table
  numberFormat: "auto",                     // "auto" (the locale), "." or ","
  onTargetChange: (target) => { dock.hidden = !target; },
});
// grid.refresh() when the selection changes; grid.paste(text); grid.destroy()
```

The playground offers an **Edit data** button in the Content tab when a chart or table is selected; it opens the grid over the bottom of the canvas (the slide never moves, so clicks on it keep their targets) and it stays open as the selection moves between charts and tables. A host that deletes or moves rows should keep a vanished cell selection on its chart or table, as the playground does, so the grid does not close under the person using it.

## How chart data maps to the grid

`chart.data` is `{ columns, rows }` (`ChartData` in `opf.schema.json`; the renderer reads it in `charts.js`). The grid shows the header line (`columns`) and then one row per data row:

- The first column holds the categories (the x axis, or the pie slices). Its header is the axis label (`"Quarter"`).
- Every further column is one series, named by its header, in the order the renderer draws them.
- A scatter chart with three or more columns reads x values from the second column (the grid labels the roles under the column letters: "categories", "series", "labels", "x values"). A chart type that needs one column only reads the first.
- Names and categories are text. Series cells are numbers or empty. **An empty series cell is a gap (`null`), never 0.** The renderer draws a gap for `null` and for text it cannot read as a number; the grid marks such text with a `!` and lists it under the grid ("This is not a number, so the chart draws a gap here."), and refuses to write it.
- A chart whose `data` is a source (`{ src }`) has no inline data. The grid says so and shows nothing to edit (external spreadsheet sources are out of scope for this release).

## Number reading (locale-safe)

A grid cell is read in **one number format**, chosen explicitly or taken from the locale, and never guessed per cell:

| Format | Example | Decimal | Grouping |
| --- | --- | --- | --- |
| `"."` | `1,234.56` | point | comma, space, no-break/thin space, apostrophe |
| `","` | `1.234,56` | comma | point, space, no-break/thin space, apostrophe |
| `"auto"` | by `locale` | the locale's decimal separator (`Intl.NumberFormat`), or a point for an unknown locale | |

The format is the grid's **Number format** control (`numberFormat`, `locale`, or `decimal` in the model options). It decides how cells are read, and how chart numbers are written when a cell is edited or copied. A table cell with no number format shows its value as the slide draws it (`String(value)`). A column or cell that has a number format shows its numbers formatted when the cell is not being edited (see "Column names, number formats and datasets").

Accepted: an optional sign, a Unicode minus, accounting parentheses `(1,234)` as negative, one currency symbol (`$ € £ ¥ ₹ ₩ ₽ ₺ ₪ ฿ ₫ ₴ ₦ ₱ ₡`) at either end, grouping in groups of three (one grouping character throughout), the format's decimal separator, `.5`, and an exponent (`1.5e3`). Blank text is *empty* (a gap), not 0.

Refused, with a sentence that says why (shown inline while typing and in the error list of a paste):

- text that is not a number (`abc`, `NaN`, `Infinity`, `0x10`);
- the other format's separators where the digits would change meaning: `1,5` in the `1,234.56` format fails with "It reads as a number in the 1.234,56 format: switch the number format, or retype it with a period for the decimal";
- a percent sign (`45%` is 45 or 0.45; a cell cannot know which): "Enter 45 to mean 45 percent, or 0.45 for a fraction";
- integers beyond 2^53.

`1,234` is `1234` in the `1,234.56` format and `1.234` in the `1.234,56` format. The format decides; nothing guesses.

**Paste:** when a paste has numbers that fail in the current format and read cleanly in the other one, the whole paste is read in the other format and the status says so ("Numbers were read as 1.234,56, because the current format did not fit."). If neither format reads every cell, nothing is written.

A table cell is not a number cell. Typing into a table stores a number only when the text is exactly how JavaScript writes it (`12`, `-3.5`, `1e+21`), so the slide shows what was typed; `011`, `12,5` and `$5` stay text. Header labels are always text.

## Pasting and copying

Paste (`Ctrl+V`, the **Paste text** box, `grid.paste(text)`, `pasteGridText`) reads TSV or CSV:

- A tab means TSV (what Excel and Sheets put on the clipboard). Otherwise the semicolon or comma that splits every line the same way is the delimiter (semicolon first, because comma decimals are common where semicolon CSV is); pass `delimiter` to override.
- RFC 4180 quoting: a field in double quotes may hold the delimiter, line breaks and doubled quotes (Excel quotes a cell with a line break). A quote inside an unquoted field is text. An unclosed quote is refused. A byte-order mark and the final line break are dropped.
- The block overwrites cells from the selected cell and **adds the rows and columns it needs** (new chart columns are unnamed, new cells are gaps; new table cells are empty). A paste that starts in the header continues into the body.
- Pasted empty cells clear (to a gap in a chart); cells a short row does not have are left alone.
- A single value pasted over a selection fills it.
- Every problem is listed and **nothing is applied** (`error.issues` has `{ section, row, column, message }`; the grid marks the cells `aria-invalid`). In a table, a paste that would cover a merged cell's covered positions is refused.
- One paste is one undo step.

Copy (`Ctrl+C`, **Copy as TSV**) writes the selection as TSV with the raw values, chart numbers in the grid's number format (never the column's display format, so a paste reads back what was copied) and a gap as an empty cell; a merged cell copies as its text with empty covered positions, as a spreadsheet does. Cut copies and clears in one step.

## Table rows, columns and the header row

Rows are addressed from 0 in the body; the header row is `{ section: "header", column }`. `at` is the position the first new row or column takes.

| Function | Behaviour |
| --- | --- |
| `insertTableRows(editor, path, at, count = 1)` | New cells are empty (`""`) and take the style of the neighbouring row. A merged cell that spans the position **grows**; its new cells are covered (`null`). |
| `deleteTableRows(editor, path, indices)` | A merged cell that spans a deleted row **shrinks** and keeps its text; if the merged cell's own first row is deleted, the text moves to the next row. The last row cannot be deleted. |
| `moveTableRows(editor, path, from, to, count = 1)` | Moves a block so its first row ends at `to`. A move that would split a merged cell is refused: "Moving rows would break a merged cell ... Split the merged cells first." Rows that hold a whole merge together can move. |
| `insertTableColumns`, `deleteTableColumns`, `moveTableColumns` | The same rules across columns (header cells included). |
| `sortTableRows(editor, path, column, { direction, type, decimal, locale })` | Stable and typed. See below. |
| `setTableHeader(editor, path, enabled, { use })` | On uses the first row as the header (`use: "first-row"`, the default with two or more rows; numbers and yes/no values in it become text, as header labels must be text) or adds an empty one (`use: "new"`). Refused when the first row has a merged cell that spans rows ("a header cannot span into the body"). Off makes the header the first body row; a `DataColumn` header (`{ name, format }`) becomes its name, and the column formats it held have nowhere to go, so they are dropped (the result's `droppedFormats` counts them; Undo restores them). |
| `setTableCells(editor, path, edits)`, `pasteTableText` | `edits` are `{ section, row, column, text }` (or a typed `value`). Rich cells keep their runs' formatting (`updateRichTextInput`); styled cells keep their `style`, `colSpan` and `rowSpan`; a covered cell cannot be edited. |

After every structural change a table style this package wrote (`banded`, `grid`, `minimal`, `open`, `theme`) is reapplied, so banding and header fill stay correct; a custom style is kept by copying the neighbour's cell style to new cells. Ragged rows (shorter than the table is wide) are padded with empty cells when a structural change touches them.

**Merged cells** are checked after every structural change: spans that would leave the table, cross, or cover non-`null` cells are refused with the reason. Nothing is ever hidden: a merge never covers text, and a paste or an edit cannot land on a covered position.

**Column weights:** the OPF `Table` schema has no column width or weight field (cells have style, padding and spans only), so there is nothing to set. Columns share the table's width; this is a schema matter, not an omission of the grid.

## Sorting

`sortTableRows` and `sortChartRows(editor, path, column, { direction = "asc", type = "auto" })` sort the body rows by a column.

- **Stable:** equal keys keep their order, in both directions (descending is not a reversal).
- **Typed** (`type: "auto"`): numbers (a number cell, or text that reads as a number in the grid's number format) sort before ISO dates (`2026-03-01`, optionally with a time) before text. Text compares with `Intl.Collator` (`locale`), ignoring case and accents, with digits inside the text in numeric order (`Item 2` before `Item 10`). `type` can force `"text"`, `"number"` or `"date"`.
- **Empty cells always sort last**, ascending or descending.
- Rows joined by a merged cell that spans rows (`rowSpan`) move together as one block, in their own order; the block's key is its first row's cell.
- Sorting a column already in order changes nothing and records no undo step.

## Chart operations

`transposeChart` swaps categories and series: the first column's values become the series names and each series becomes a row. Gaps stay gaps. A numeric category becomes text (the change reports `relabelled`) and a blank category becomes an unnamed series; transposing twice restores text categories exactly. `renameChartSeries(editor, path, column, name)` and `renameChartCategory(editor, path, row, name)` rename; inserting a series adds an unnamed column (a name is never invented) and the grid opens its name cell. A chart keeps at least one row and one column.

## Column names, number formats and datasets (RR-54)

Core's chart and table data contract ([docs/chart-table-data.md](https://github.com/OpenPresentation/opf/blob/main/docs/chart-table-data.md)) adds named columns with a number format, shared datasets and a series mapping. The grid edits all three, each change one undoable patch, and a document that uses none of them behaves exactly as before.

- **Named columns.** A chart column or table header may be a `DataColumn` `{ name, format? }`. The grid shows the `name`; renaming edits `.name` and keeps the `format`; inserting, deleting, moving and pasting keep every other column's object as it was. Chart numbers follow core's `chartNumber`: a cell is a number or a gap, text that is not a number is refused with the reason, and text already stored in a series cell that `chartNumber` reads as a gap (`"12%"`, `"0x10"`) is flagged as one.
- **Column number format.** The "Format of column …" field under the toolbar sets the number format of the selected column (the `DataColumn.format`, or the `format` of a styled table header). It validates with core's `numberFormatError` and shows the reason inline; Apply or Enter sets it and Clear removes it. A plain string header becomes `{ name, format }` and goes back to a string when the format is cleared. A table needs its header row on. `prepareGridColumnFormat` and `setGridColumnFormat` are the same operation without the DOM; `columnFormatError` is the check. A number in a formatted column is shown as the slide draws it (core's `formatDataNumber`: `12.4` in a `$#,##0.0` column shows `$12.4`) while the cell is not being edited; the cell's title says what is stored, editing shows the raw value in the grid's number format (a decimal comma where the locale uses one), and copy writes the raw value. A chart shows the format only in the columns it plots as numbers (series and X), a table cell's own `format` wins over its column's, and a number whose column has no valid format, text, rich runs and gaps are shown as before, so a document without formats looks exactly as it did. The format is also named in the column's ruler cell. The field follows the selected column but stays on the column it was opened for while you type, so a click on another cell never moves a typed format to that column. On a shared dataset the label says "in the shared dataset": the format belongs to the dataset column and changes it for every item that shows it.
- **Chart columns (mapping).** The "Chart columns" panel of a chart sets the category column, the X column (only for a scatter chart, core's `isXYChartType`) and the plotted series (checkboxes), writing `chart.mapping` by column name. A field that equals the default is not written and the mapping is removed when nothing is left. A column the mapping leaves out has the role "not plotted" and may hold any text. Renaming a mapped column renames it in the mapping, deleting it removes it, and moving or inserting columns leaves the mapping alone. `describeChartMapping`, `prepareChartMapping` and `setChartMapping` are the headless forms.
- **Shared datasets.** A chart (`data: { dataset, fields? }`) or table (`{ dataset, fields? }`) that shows a top-level dataset opens in the grid, and every edit is an edit of `/datasets/<id>`. The status line says "Shared dataset ‘revenue’ — used by 2 items". `fields` selects and orders the columns the grid shows; an edit maps back to the dataset's own column index, each row keeps the columns `fields` hides (also when it moves, sorts or is deleted), a column added goes to the dataset and to `fields`, a column deleted leaves `fields` and stays in the dataset, and moving a column reorders `fields`. Without `fields` the grid edits the whole dataset: a column deleted there leaves the dataset, which is refused (`dataset-column-in-use`) while another item's `fields` or `mapping` names it. Renaming a column updates every `fields` and `mapping` that names it, in the same patch. New columns of a dataset get a distinct placeholder name ("New column", "New column 2") that differs from every column of the dataset, also the ones `fields` hides, because column names must be unique. A dataset column name (and the name of a column of a chart with a `mapping`) is never blank: the paste or edit is refused with the reason. A dataset table always has the dataset's column names as its header; swapping rows and columns of a shared dataset and the header-row switch are refused. "Use a copy of the data" (`prepareDetachDataset`, `detachGridDataset`) gives the chart or table its own inline copy (the `fields` columns, their formats and the dataset's `source`) and leaves the dataset for the other items. A dataset or a `fields` entry the document does not hold shows as a chart or table with no grid and the reason. Table cell styles and merges need an inline table: the table panel and `table-options` refuse a dataset table with `table-dataset-backed`. Styling or merging a `DataColumn` header turns it into the equivalent styled header `{ value: name, format, style }` (a styled header's `format` is the column's format); a header that gains no style stays a `DataColumn`.
- **Import as a dataset.** `prepareDatasetImport(document, content, { id, source })` (`@openpresentation/opf-editor/data`) stores what `createDataContent` returned as `datasets.<id>` and returns the same table or chart holding `{ dataset: id }`, as `opf import-data --dataset` does (an existing id keeps its title, description and source). The playground's Import data dialog offers it as "Store as a shared dataset"; the dataset and the slide are one undo step. The dialog's id starts as the first one the deck does not hold (`data`, `data-2`, ...), so a second import does not replace the first; typing an existing id replaces that dataset's columns and rows and says so.
- **Find and replace** searches the text cells of datasets and the names of `DataColumn` columns, except a chart's names when it has a `mapping`. Chart type compatibility reads the resolved data (dataset, fields and mapping). Switching a chart's type (`switchDimension(editor, "charts", …)`) to one without an X axis removes `mapping.x` (and the whole `mapping` when nothing else is left), so core does not keep a `chart-mapping-adapted` warning the document cannot act on.

These need a core that has the RR-54 data contract (`chartNumber`, `numberFormatError`, `inlineChartData`, `isXYChartType`); with an older core the grid keeps editing documents that use none of it: `supportsChartTableData` is false, the column format field and the Chart columns panel are hidden, `columnFormatError` and `detachGridDataset` report a reason instead of throwing, and numbers are never shown formatted.

## Undo and patches

Every function above is one `editor.applyPatch`, so it is one undo step (`Ctrl+Z` in the grid, or the host's Undo). A cell edit is one guarded `replace` of that cell (`test` then `replace`). A structural change, many cell changes, or a key added or removed (the header row's `columns`) is one guarded replacement of the table or `chart.data`, so Undo restores the object exactly, key order included. A refused change throws an `OPFEditorError` (`code`, `issues`), writes nothing and records no undo step. Every result is validated as OPF (`rejectInvalid` semantics) before it is committed.

`prepare*` forms return `{ document, patches, changed }` without a session, like `prepareTableMerge`.

## Keyboard

| Key | Action |
| --- | --- |
| Arrow keys | Move the active cell (a merged cell is one stop). `Shift` extends the selection. |
| `Home` / `End`, `Ctrl+Home` / `Ctrl+End`, `PageUp` / `PageDown` | Row start or end, grid start or end, ten rows. |
| `Enter`, `F2` | Edit the active cell. |
| Any character | Start editing with that character replacing the text. |
| `Enter` / `Shift+Enter` (editing) | Commit and move down / up. |
| `Tab` / `Shift+Tab` (editing) | Commit and move right / left. Outside an edit `Tab` leaves the grid (no keyboard trap). |
| `Alt+Enter` (editing) | A line break in the cell. |
| `Escape` | Cancel the edit. |
| `Delete`, `Backspace` | Clear the selection (one undo step). |
| `Ctrl+C`, `Ctrl+X`, `Ctrl+V` | Copy as TSV, cut, paste. |
| `Ctrl+A`, `Ctrl+Space`, `Shift+Space` | Select all, the column, the row. |
| `Ctrl+Z`, `Ctrl+Y` (`Ctrl+Shift+Z`) | Undo, redo. |

The toolbar (`role="toolbar"`, one tab stop, arrow keys, `Home`, `End`) has row and column insert, delete and move, sort, swap rows and columns (charts), the header row (tables), copy as TSV and the number format. Disabled buttons use `aria-disabled` so they keep focus.

## Accessibility

`role="grid"` with `aria-rowcount`/`aria-colcount`, `aria-rowindex`/`aria-colindex`, `aria-multiselectable`, `aria-selected` on selected cells, `aria-colspan`/`aria-rowspan` on merged cells (covered positions are not drawn), column headers (`A`, `B`, ... with the chart role) and row headers (`Header`, `1`, `2`, ...), one cell in the tab order, `aria-invalid` on cells that failed, a polite `role="status"` region for what happened and an assertive `role="alert"` region for refusals, an `aria-describedby` help line, a labelled editor (`Edit Row 2, column B`), a visible focus outline that holds in forced-colors mode, and a scrolling area that reflows at phone widths. A gap is announced as "Empty, a gap in the chart". The playground test (`npm run test:data-grid-browser`) checks the roles, names, tab stops, contrast (4.5:1 for cell, header, ruler and button text), forced colors and a 360 px reflow.

## Decisions (open to veto)

1. **Helpers stay in the editor.** The pure helpers (`grid-text`, the table and chart operations) are in opf-editor rather than core's `@openpresentation/opf/convert`: that module is content conversion (list to table, split and merge slides), not data editing, and core's `parseTabularData` is a strict importer (header row required, rectangular rows, no locale), which is the wrong contract for pasted cells. If core later grows a spreadsheet-data module, these move there without an API change.
2. **One number format per grid, no per-cell guessing**, with the paste fallback above; percent signs are refused rather than divided by 100.
3. **Typing stores text unless it is a canonical number** in a table, so the slide always shows what was typed.
4. **Header toggle on uses the first row** (PowerPoint's behaviour) with an explicit "new empty header" alternative; header labels become text.
5. **Merged rows and columns are never split silently.** Moves that would split a merge are refused with the reason; inserts grow and deletes shrink the merge.
6. **No column weights**, because the schema has none.
7. **A new chart series is unnamed**, never "Series 2".
