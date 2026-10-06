// The canonical form of OPF content that the Markdown dialect writes and reads. `canonContent` returns the value a
// round trip produces (shorthands collapsed, adjacent runs merged), or undefined when the content has a part the
// dialect cannot carry in its own syntax (styled table cells, extra keys). Internal module.
import { FORMATTING, type Obj, type Run, isPlainRun, isRecord, runText } from "../convert/shared.js";

const FORMAT_KEYS = FORMATTING as readonly string[];

/** One TextRun without false flags, or undefined when it has keys the dialect cannot write. */
function canonRun(run: unknown): Run | undefined {
  if (typeof run === "string") return run;
  if (!isRecord(run) || typeof run.text !== "string") return undefined;
  const out: Obj = { text: run.text };
  for (const [key, value] of Object.entries(run)) {
    if (key === "text") continue;
    if (!FORMAT_KEYS.includes(key)) return undefined;
    if (value === false || value === undefined) continue;
    out[key] = value;
  }
  return Object.keys(out).length === 1 ? out.text : out;
}

const sameFormat = (a: Obj, b: Obj): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete("text");
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
};

/** String or TextRun[] with adjacent equal-format runs merged and empty runs removed. */
export function canonText(value: unknown): string | Run[] | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const merged: Run[] = [];
  for (const raw of value) {
    const run = canonRun(raw);
    if (run === undefined) return undefined;
    if (runText(run) === "") continue;
    const last = merged.at(-1);
    if (last !== undefined) {
      if (typeof last === "string" && typeof run === "string") {
        merged[merged.length - 1] = last + run;
        continue;
      }
      if (typeof last === "object" && typeof run === "object" && sameFormat(last, run)) {
        merged[merged.length - 1] = { ...last, text: last.text + run.text };
        continue;
      }
    }
    merged.push(run);
  }
  if (merged.length === 0) return "";
  if (merged.every(isPlainRun)) return merged.map(runText).join("");
  return merged;
}

function canonItem(item: unknown): unknown {
  if (typeof item === "string" || Array.isArray(item)) return canonText(item);
  if (!isRecord(item)) return undefined;
  for (const key of Object.keys(item)) if (key !== "text" && key !== "level" && key !== "description") return undefined;
  const text = canonText(item.text);
  if (text === undefined) return undefined;
  const level = item.level === undefined ? 0 : item.level;
  if (!Number.isInteger(level) || (level as number) < 0) return undefined;
  const description = item.description === undefined ? undefined : canonText(item.description);
  if (item.description !== undefined && description === undefined) return undefined;
  if (level === 0 && description === undefined) return text;
  const out: Obj = { text };
  if (description !== undefined) out.description = description;
  if (level !== 0) out.level = level;
  return out;
}

const levelOf = (item: unknown): number => (isRecord(item) && typeof item.level === "number" ? item.level : 0);

function canonItems(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items: unknown[] = [];
  let previous = -1;
  for (const raw of value) {
    const item = canonItem(raw);
    if (item === undefined) return undefined;
    const level = levelOf(item);
    // Nesting is read from indentation: the first item is at level 0 and a level rises by at most one.
    if (level > previous + 1 || (previous < 0 && level !== 0)) return undefined;
    // Plain text items hold one line each.
    previous = level;
    items.push(item);
  }
  return items;
}

const only = (value: Obj, keys: readonly string[]): boolean => Object.keys(value).every((key) => keys.includes(key));

function canonQuote(value: unknown): unknown {
  if (typeof value === "string") return value;
  if (!isRecord(value) || !only(value, ["text", "attribution", "source"]) || typeof value.text !== "string") return undefined;
  for (const key of ["attribution", "source"]) if (value[key] !== undefined && typeof value[key] !== "string") return undefined;
  // A source with no attribution has no line to stand on.
  if (value.source !== undefined && value.attribution === undefined) return undefined;
  if (value.attribution === undefined) return value.text;
  const out: Obj = { text: value.text, attribution: value.attribution };
  if (value.source !== undefined) out.source = value.source;
  return out;
}

function canonCode(value: unknown): unknown {
  if (typeof value === "string") return value;
  if (!isRecord(value) || !only(value, ["source", "language", "filename"]) || typeof value.source !== "string") return undefined;
  for (const key of ["language", "filename"]) if (value[key] !== undefined && (typeof value[key] !== "string" || value[key] === "")) return undefined;
  if (value.language === undefined && value.filename === undefined) return value.source;
  const out: Obj = { source: value.source };
  if (value.language !== undefined) out.language = value.language;
  if (value.filename !== undefined) out.filename = value.filename;
  return out;
}

function canonMetric(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "number") return value;
  if (!isRecord(value) || !only(value, ["value", "label", "description", "unit", "delta", "trend"])) return undefined;
  if (typeof value.value !== "string" && typeof value.value !== "number") return undefined;
  const out: Obj = { value: value.value };
  for (const key of ["label", "description", "unit", "delta", "trend"]) {
    const entry = value[key];
    if (entry === undefined) continue;
    if (typeof entry !== "string" && !(key === "delta" && typeof entry === "number")) return undefined;
    out[key] = entry;
  }
  return Object.keys(out).length === 1 ? out.value : out;
}

function canonAsset(value: unknown): unknown {
  if (typeof value === "string") return value;
  if (!isRecord(value) || !only(value, ["src", "alt", "title"]) || typeof value.src !== "string") return undefined;
  for (const key of ["alt", "title"]) if (value[key] !== undefined && typeof value[key] !== "string") return undefined;
  const out: Obj = { src: value.src };
  if (value.alt !== undefined) out.alt = value.alt;
  if (value.title !== undefined) out.title = value.title;
  return Object.keys(out).length === 1 ? out.src : out;
}

function canonCell(cell: unknown): unknown {
  // Table cells are text, as in the data import: a number or a boolean cell has no Markdown form.
  if (cell === null) return cell;
  if (typeof cell === "string" || Array.isArray(cell)) return canonText(cell);
  return undefined;
}

function canonTable(value: unknown): unknown {
  if (!isRecord(value) || !only(value, ["columns", "rows"]) || !Array.isArray(value.rows)) return undefined;
  const out: Obj = {};
  if (value.columns !== undefined) {
    if (!Array.isArray(value.columns) || value.columns.length === 0) return undefined;
    const columns = value.columns.map((cell) => (cell === null ? null : typeof cell === "string" || Array.isArray(cell) ? canonText(cell) : undefined));
    if (columns.includes(undefined) || columns.every((cell) => cell === null || cell === "")) return undefined;
    out.columns = columns;
  }
  const rows: unknown[][] = [];
  for (const row of value.rows) {
    if (!Array.isArray(row)) return undefined;
    const cells = row.map(canonCell);
    if (cells.includes(undefined)) return undefined;
    rows.push(cells);
  }
  out.rows = rows;
  return out;
}

function canonChart(value: unknown): unknown {
  if (!isRecord(value) || !only(value, ["type", "data"]) || typeof value.type !== "string" || !isRecord(value.data)) return undefined;
  const data = value.data;
  if (Array.isArray(data.columns) && Array.isArray(data.rows) && only(data, ["columns", "rows"])) {
    if (!data.columns.every((column) => typeof column === "string") || data.columns.length === 0 || data.rows.length === 0) return undefined;
    for (const row of data.rows) if (!Array.isArray(row) || !row.every((cell) => cell === null || ["string", "number", "boolean"].includes(typeof cell))) return undefined;
    return { type: value.type, data: { columns: data.columns, rows: data.rows } };
  }
  if (typeof data.src === "string" && only(data, ["src", "sheet", "range", "columns"])) return { type: value.type, data };
  return undefined;
}

function canonEvent(event: unknown): unknown {
  if (!isRecord(event) || !only(event, ["when", "what", "description", "status"]) || typeof event.what !== "string") return undefined;
  for (const key of ["when", "description"]) if (event[key] !== undefined && typeof event[key] !== "string") return undefined;
  if (event.status !== undefined && !["done", "current", "planned"].includes(event.status as string)) return undefined;
  const out: Obj = {};
  if (event.when !== undefined) out.when = event.when;
  out.what = event.what;
  if (event.description !== undefined) out.description = event.description;
  if (event.status !== undefined) out.status = event.status;
  return out;
}

function canonTimeline(value: unknown): unknown {
  const events = Array.isArray(value) ? value : isRecord(value) && only(value, ["name", "description", "events"]) ? value.events : undefined;
  if (!Array.isArray(events) || events.length === 0) return undefined;
  const canon = events.map(canonEvent);
  if (canon.includes(undefined)) return undefined;
  if (Array.isArray(value)) return canon;
  for (const key of ["name", "description"]) if ((value as Obj)[key] !== undefined && typeof (value as Obj)[key] !== "string") return undefined;
  const { name, description } = value as Obj;
  if (name === undefined && description === undefined) return canon;
  const out: Obj = {};
  if (name !== undefined) out.name = name;
  if (description !== undefined) out.description = description;
  out.events = canon;
  return out;
}

/** The kinds the dialect has its own syntax for, in the order of CONTENT_KEYS. */
export function canonContent(key: string, value: unknown): unknown {
  switch (key) {
    case "text":
      return canonText(value);
    case "items":
    case "bullets":
      return canonItems(value);
    case "quote":
      return canonQuote(value);
    case "code":
      return canonCode(value);
    case "metric":
      return canonMetric(value);
    case "image":
    case "video":
      return canonAsset(value);
    case "table":
      return canonTable(value);
    case "chart":
      return canonChart(value);
    case "timeline":
      return canonTimeline(value);
    default:
      return undefined;
  }
}
