// Conversions that read or write a table: list, timeline, text and a set of metric blocks. Each returns the
// new content field and records what it cannot carry. Internal module.
import { type Json, type Loss, type Obj, type Run, hasFormatting, isRecord, plainOf, refuse, runsOf } from "./shared.js";

export interface TableOptions {
  /** Timeline and metrics to table: write the column headings (default true). A table without headings cannot be read back by role. */
  headings?: boolean;
  /** Table to timeline: the column index of each role, overriding the heading names. */
  columns?: { when?: number; what?: number; description?: number };
  /** Text to table: the cell delimiter when the text is not a tab or pipe table, for example "," or ";". */
  delimiter?: string;
  /** Text to table with tabs or a delimiter: read the first row as the column headings. Pipe tables use their separator row. */
  header?: boolean;
}

// --- cells -------------------------------------------------------------------------------------

export interface CellInfo {
  value: Json;
  styled: boolean;
  merged: boolean;
  /** RR-54: the cell (or DataColumn header) carries a number format. */
  formatted?: boolean;
}
export function cellOf(raw: Json): CellInfo {
  if (isRecord(raw) && Object.hasOwn(raw, "value")) {
    return { value: raw.value, styled: isRecord(raw.style) && Object.keys(raw.style).length > 0, merged: (raw.colSpan ?? 1) > 1 || (raw.rowSpan ?? 1) > 1, formatted: typeof raw.format === "string" };
  }
  // RR-54: a DataColumn header ({ name, format }) reads as its name.
  if (isRecord(raw) && typeof raw.name === "string") return { value: raw.name, styled: false, merged: false, formatted: typeof raw.format === "string" };
  return { value: raw, styled: false, merged: false };
}
/** A cell value as list or timeline text: a string, or the runs when the cell is rich. */
export function valueText(value: Json): string | Run[] {
  if (Array.isArray(value)) return value as Run[];
  if (value === null || value === undefined) return "";
  return String(value);
}
export const valuePlain = (value: Json): string => (Array.isArray(value) ? plainOf(value) : value === null || value === undefined ? "" : String(value));
export const valueEmpty = (value: Json): boolean => valuePlain(value).trim() === "";

/** Scan a table's cells: styled cells are reported, merged cells are refused unless `allowMerged`. */
function readCells(table: Obj, loss: Loss, purpose: string, allowMerged = false): { columns: Json[] | undefined; rows: Json[][] } {
  const rows = table?.rows;
  if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row))) throw refuse("This table has no rows to convert.");
  const all = [...(Array.isArray(table.columns) ? [table.columns] : []), ...rows];
  for (const row of all) {
    for (const raw of row) {
      const cell = cellOf(raw);
      if (cell.merged) {
        if (!allowMerged) throw refuse(`This table has merged cells, which ${purpose} cannot carry. Split the merged cells first.`);
        loss.note("merged cells");
      }
      if (cell.styled) loss.note("cell styles");
      if (cell.formatted) loss.note("number formats");
    }
  }
  return { columns: Array.isArray(table.columns) ? table.columns.map((cell: Json) => cellOf(cell).value) : undefined, rows: rows.map((row: Json[]) => row.map((cell) => cellOf(cell).value)) };
}

// --- list <-> table ----------------------------------------------------------------------------

export function listToTable(items: Json[], loss: Loss): Json {
  const entries = items.map((item) => {
    const object = isRecord(item);
    if (object && (item.level ?? 0) > 0) loss.note("list nesting levels");
    const text = object ? item.text : item;
    return { text: valueText(text), description: object && item.description !== undefined && plainOf(item.description) !== "" ? valueText(item.description) : undefined };
  });
  if (!entries.length) throw refuse("A table needs at least one row, and this list has no items.");
  const described = entries.some((entry) => entry.description !== undefined);
  return { rows: entries.map((entry) => (described ? [entry.text, entry.description ?? null] : [entry.text])) };
}

export function tableToList(table: Obj, loss: Loss): Json {
  const { columns, rows } = readCells(table, loss, "a list");
  if (!rows.length) throw refuse("A list needs at least one item, and this table has no rows.");
  if (columns) loss.note("column headings");
  const width = Math.max(columns?.length ?? 0, ...rows.map((row) => row.length));
  if (width > 2) loss.note("table columns beyond the second (joined into the description)");
  return rows.map((row) => {
    const text = valueText(row[0]);
    const rest = row.slice(1).filter((value) => !valueEmpty(value));
    if (!rest.length) return text;
    let description: string | Run[];
    if (rest.length === 1) description = valueText(rest[0]);
    else if (rest.some(Array.isArray)) description = rest.flatMap((value, index) => [...(index ? [", "] : []), ...runsOf(valueText(value))]);
    else description = rest.map(valuePlain).join(", ");
    return { text, description };
  });
}

// --- timeline <-> table ------------------------------------------------------------------------

export function timelineToTable(timeline: Json, options: TableOptions, loss: Loss): Json {
  const events: Obj[] = Array.isArray(timeline) ? timeline : timeline.events;
  if (!Array.isArray(timeline)) {
    if (timeline.name) loss.note("timeline name");
    if (timeline.description) loss.note("timeline description");
  }
  const hasWhen = events.some((event) => event.when);
  const hasDescription = events.some((event) => event.description);
  const columns = [...(hasWhen ? ["When"] : []), "What", ...(hasDescription ? ["Description"] : [])];
  const rows = events.map((event) => [...(hasWhen ? [event.when ?? null] : []), event.what, ...(hasDescription ? [event.description ?? null] : [])]);
  return { ...(options.headings === false ? {} : { columns }), rows };
}

const WHEN_HEADINGS = ["when", "date", "dates", "time", "year", "month", "quarter", "period", "deadline", "due", "due date", "start", "timeline"];
const WHAT_HEADINGS = ["what", "event", "events", "milestone", "milestones", "title", "name", "step", "task", "activity", "initiative", "item", "phase", "stage", "deliverable"];
const DESCRIPTION_HEADINGS = ["description", "details", "detail", "notes", "note", "summary", "comment", "comments"];
const heading = (value: Json): string => valuePlain(value).trim().toLowerCase().replace(/:$/, "");

/** Which column holds each role, from the heading names (or the caller's explicit indexes). Roles can only be read from headings. */
function rolesFrom(columns: Json[] | undefined, names: Record<string, readonly string[]>, explicit: Record<string, number | undefined> | undefined): Record<string, number> {
  const roles: Record<string, number> = {};
  for (const [role, index] of Object.entries(explicit ?? {})) if (index !== undefined) roles[role] = index;
  if (columns) {
    columns.forEach((value, index) => {
      const label = heading(value);
      for (const [role, list] of Object.entries(names)) if (roles[role] === undefined && list.includes(label) && !Object.values(roles).includes(index)) roles[role] = index;
    });
  }
  return roles;
}

/** A heading the converter does not recognise carries its own words; assigning its column a role drops them. */
function noteRenamedHeadings(columns: Json[] | undefined, roles: Record<string, number>, names: Record<string, readonly string[]>, loss: Loss): void {
  if (!columns) return;
  for (const [role, index] of Object.entries(roles)) {
    const label = heading(columns[index]);
    if (label !== "" && !(names[role] ?? []).includes(label)) loss.note(`column heading "${valuePlain(columns[index])}"`);
  }
}

export function tableToTimeline(table: Obj, options: TableOptions, loss: Loss): Json {
  const { columns, rows } = readCells(table, loss, "a timeline");
  if (!columns && !options.columns) throw refuse('A timeline reads its columns by their headings. Add a heading row that names a "When", a "What" and optionally a "Description" column.');
  const roles = rolesFrom(columns, { when: WHEN_HEADINGS, what: WHAT_HEADINGS, description: DESCRIPTION_HEADINGS }, options.columns);
  const width = Math.max(columns?.length ?? 0, ...rows.map((row) => row.length));
  if (roles.what === undefined) {
    const free = Array.from({ length: width }, (_, index) => index).filter((index) => !Object.values(roles).includes(index));
    if (free.length === 1) roles.what = free[0]!;
  }
  if (roles.what === undefined) throw refuse('No column holds the event text. Name one column "What" or "Event" (headings it understands: when, date, what, event, milestone, description, details).');
  if (!rows.length) throw refuse("A timeline needs at least one event, and this table has no rows.");
  const used = new Set(Object.values(roles));
  columns?.forEach((value, index) => {
    if (!used.has(index) && rows.some((row) => !valueEmpty(row[index]))) loss.note(`column "${valuePlain(value)}"`);
  });
  noteRenamedHeadings(columns, roles, { when: WHEN_HEADINGS, what: WHAT_HEADINGS, description: DESCRIPTION_HEADINGS }, loss);
  const flat = (value: Json): string => {
    if (hasFormatting(value)) loss.note("text formatting");
    return valuePlain(value);
  };
  const events = rows.map((row) => {
    const event: Obj = {};
    if (roles.when !== undefined && !valueEmpty(row[roles.when])) event.when = flat(row[roles.when]);
    event.what = flat(row[roles.what!]);
    if (roles.description !== undefined && !valueEmpty(row[roles.description])) event.description = flat(row[roles.description]);
    return event;
  });
  return events;
}

// --- metric blocks <-> table -------------------------------------------------------------------

const COLUMN_LABELS = { label: "Label", value: "Value", unit: "Unit", delta: "Delta", trend: "Trend", description: "Description" } as const;
const METRIC_HEADINGS = {
  label: ["label", "metric", "name", "kpi", "measure", "indicator"],
  value: ["value", "amount", "number", "result", "actual", "current"],
  unit: ["unit", "units"],
  delta: ["delta", "change", "growth", "difference", "vs", "vs."],
  trend: ["trend", "direction"],
  description: ["description", "details", "detail", "notes", "note", "context"],
} as const;

export function metricsToTable(blocks: Json[], options: TableOptions, loss: Loss): Json {
  if (!blocks.length) throw refuse("This group has no blocks.");
  const metrics = blocks.map((block, index) => {
    const keys = isRecord(block) ? Object.keys(block).filter((key) => key !== "id" && key !== "extensions" && key !== "type") : [];
    if (keys.length !== 1 || keys[0] !== "metric") throw refuse(`Block ${index + 1} is not a metric. A group converts to a table only when every block in it is a metric.`, { block: index });
    if (block.id !== undefined || block.extensions !== undefined) loss.note("block ids and extensions");
    return isRecord(block.metric) ? block.metric : { value: block.metric };
  });
  const present = (field: keyof typeof COLUMN_LABELS): boolean => field === "value" || metrics.some((metric) => metric[field] !== undefined && metric[field] !== "");
  const fields = (Object.keys(COLUMN_LABELS) as (keyof typeof COLUMN_LABELS)[]).filter(present);
  return {
    ...(options.headings === false ? {} : { columns: fields.map((field) => COLUMN_LABELS[field]) }),
    rows: metrics.map((metric) => fields.map((field) => (metric[field] === undefined || metric[field] === "" ? null : metric[field]))),
  };
}

export function tableToMetrics(table: Obj, loss: Loss): Json[] {
  const { columns, rows } = readCells(table, loss, "a set of metrics");
  if (!columns) throw refuse('Metrics read their columns by their headings. Add a heading row that names a "Value" column, and optionally "Label", "Unit", "Delta", "Trend" and "Description".');
  const roles = rolesFrom(columns, METRIC_HEADINGS, undefined);
  if (roles.value === undefined) throw refuse('No column holds the metric value. Name one column "Value" (headings it understands: value, amount, number, result, label, unit, delta, change, trend, description).');
  if (!rows.length) throw refuse("A set of metrics needs at least one row, and this table has no rows.");
  const used = new Set(Object.values(roles));
  columns.forEach((value, index) => {
    if (!used.has(index) && rows.some((row) => !valueEmpty(row[index]))) loss.note(`column "${valuePlain(value)}"`);
  });
  noteRenamedHeadings(columns, roles, METRIC_HEADINGS, loss);
  const text = (value: Json): string => {
    if (hasFormatting(value)) loss.note("text formatting");
    return valuePlain(value);
  };
  return rows.map((row, rowIndex) => {
    const raw = row[roles.value!];
    if (valueEmpty(raw)) throw refuse(`Row ${rowIndex + 1} has no value, so it cannot be a metric.`, { row: rowIndex });
    const metric: Obj = { value: typeof raw === "number" ? raw : text(raw) };
    if (roles.label !== undefined && !valueEmpty(row[roles.label])) metric.label = text(row[roles.label]);
    if (roles.unit !== undefined && !valueEmpty(row[roles.unit])) metric.unit = text(row[roles.unit]);
    if (roles.delta !== undefined && !valueEmpty(row[roles.delta])) metric.delta = typeof row[roles.delta] === "number" ? row[roles.delta] : text(row[roles.delta]);
    if (roles.trend !== undefined && !valueEmpty(row[roles.trend])) {
      const trend = text(row[roles.trend]).trim().toLowerCase();
      if (trend === "up" || trend === "down" || trend === "flat") metric.trend = trend;
      else loss.note("trend values other than up, down or flat");
    }
    if (roles.description !== undefined && !valueEmpty(row[roles.description])) metric.description = text(row[roles.description]);
    return { metric };
  });
}

// --- table <-> text ----------------------------------------------------------------------------

const escapePipe = (text: string): string => text.replaceAll("\\", "\\\\").replaceAll("|", "\\|");
const SEPARATOR_ROW = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;

export function tableToTextLines(table: Obj, loss: Loss): string[] {
  const { columns, rows } = readCells(table, loss, "text", true);
  if (!rows.length && !columns) throw refuse("This table is empty.");
  const cell = (value: Json): string => {
    if (hasFormatting(value)) loss.note("text formatting");
    const text = valuePlain(value);
    if (/[\r\n]/.test(text)) loss.note("line breaks inside cells");
    return text.replace(/\s*(?:\r\n|\r|\n)\s*/g, " ");
  };
  if (columns) {
    const width = Math.max(columns.length, ...rows.map((row) => row.length));
    const fill = (row: Json[]): string[] => Array.from({ length: width }, (_, index) => cell(row[index]));
    const line = (cells: string[]): string => `| ${cells.map(escapePipe).join(" | ")} |`;
    return [line(fill(columns)), line(Array.from({ length: width }, () => "---")), ...rows.map((row) => line(fill(row)))];
  }
  // Tabs: a cell that contains a tab cannot be written without changing it.
  return rows.map((row) => {
    const line = row
      .map((value) => {
        const text = cell(value);
        if (text.includes("\t")) throw refuse("A cell contains a tab, which cannot be written to tab-separated text.");
        return text;
      })
      .join("\t");
    if (line.trim() === "" && !line.includes("\t")) loss.note("empty rows (a blank line is dropped when the text is read back)");
    return line;
  });
}

function splitPipes(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < line.length; index++) {
    const char = line[index]!;
    if (char === "\\" && (line[index + 1] === "|" || line[index + 1] === "\\")) {
      current += line[index + 1];
      index++;
    } else if (char === "|") {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  if (cells[0]!.trim() === "") cells.shift();
  if (cells.length && cells.at(-1)!.trim() === "") cells.pop();
  return cells.map((cell) => cell.trim());
}

/** Read plain lines as a table: a Markdown pipe table (its separator row marks the headings), tab-separated rows, or rows split at `options.delimiter`. */
export function textLinesToTable(lines: string[], options: TableOptions): Obj {
  const separator = options.delimiter ?? "\t";
  // A line of only separators is a row of empty cells, not a blank line.
  const kept = lines.filter((line) => line.trim() !== "" || (separator !== "" && line.includes(separator)));
  if (!kept.length) throw refuse("This text is empty.");
  const rectangular = (rows: string[][], header: boolean): Obj => {
    const width = rows[0]!.length;
    const bad = rows.findIndex((row) => row.length !== width);
    if (bad >= 0) throw refuse(`Line ${bad + 1} has ${rows[bad]!.length} cells but the first line has ${width}. Every line needs the same number of cells.`, { line: bad });
    if (header && rows.length < 1) throw refuse("A heading row needs at least one line.");
    return header ? { columns: rows[0], rows: rows.slice(1) } : { rows };
  };
  if (!options.delimiter && kept.length >= 2 && SEPARATOR_ROW.test(kept[1]!) && kept[0]!.includes("|")) {
    const rows = [kept[0]!, ...kept.slice(2)].map(splitPipes);
    const result = rectangular(rows, true);
    if (splitPipes(kept[1]!).length !== rows[0]!.length) throw refuse("The separator row of this Markdown table does not match its heading row.");
    return result;
  }
  const delimiter = options.delimiter ?? "\t";
  if (delimiter.length === 0 || /[\r\n]/.test(delimiter)) throw refuse("Choose a delimiter that is not empty and not a line break.");
  if (kept.some((line) => !line.includes(delimiter))) throw refuse(`This text has no table structure. A table needs tab-separated lines, a Markdown pipe table, or a delimiter you name${options.delimiter ? ` (every line must contain "${options.delimiter}")` : ""}.`);
  return rectangular(kept.map((line) => line.split(delimiter)), options.header === true);
}

