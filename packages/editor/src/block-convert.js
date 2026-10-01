// Safe content-type conversion for one block (RR-06; replaces the FF-16 "replacement only" decision).
// A conversion moves the block's own text into the new content type and never invents content:
// no value, label, date, number or sentence is added. What a conversion cannot carry (formatting,
// nesting, a code language, a chart type) is reported in `loss` instead of being dropped silently,
// and a pair that has no meaningful mapping is refused. Everything is one `prepareBlockReplace`
// patch, so a conversion is one undoable step with a test guard against concurrent edits.
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { listBlockContainers, prepareBlockReplace } from "./blocks.js";
import { fail } from "./edit-helpers.js";

const CONTENT_KEYS = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"];
const KIND_OF_KEY = { items: "list", bullets: "list" };
const KEY_OF_KIND = { list: "items" };
// Meaningful pairs only. Every pair goes through plain text lines except chart/table.
const TARGETS = Object.freeze({
  text: ["list", "quote", "metric", "code", "timeline"],
  list: ["text", "timeline"],
  quote: ["text"],
  metric: ["text"],
  code: ["text"],
  timeline: ["text", "list"],
  chart: ["table"],
  table: ["chart"],
});
const LABEL = Object.freeze({ text: "Text", list: "List", quote: "Quote", metric: "Metric", code: "Code", timeline: "Timeline", chart: "Chart", table: "Table", image: "Image", video: "Video", group: "Group" });
const NEWLINE = /\r\n|\r|\n/;
const FORMATTING = ["bold", "italic", "underline", "strikethrough", "color", "fontSize", "fontFamily", "link", "superscript", "subscript"];
const MAX_METRIC_VALUE = 24;

/** Every content kind a block can hold, with its display label. */
export const BLOCK_KIND_LABELS = LABEL;
/** The conversion matrix: source kind to the kinds it can convert to. */
export const BLOCK_CONVERSIONS = TARGETS;

const refuse = (message, details) => fail("block-not-convertible", message, details);

// --- text lines -------------------------------------------------------------------------------

const isPlainRun = (run) => typeof run === "string" || (run && typeof run === "object" && !FORMATTING.some((key) => run[key] !== undefined));
const runText = (run) => (typeof run === "string" ? run : run.text);
const runsOf = (value) => (typeof value === "string" ? [value] : Array.isArray(value) ? value : []);

/** TextRun[] split at line breaks, keeping each run's formatting. Empty lines are kept. */
function splitRuns(runs) {
  const lines = [[]];
  for (const run of runs) {
    const parts = runText(run).split(NEWLINE);
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part === "") return;
      lines[lines.length - 1].push(typeof run === "string" ? part : { ...run, text: part });
    });
  }
  return lines;
}
const plainLine = (line) => line.map(runText).join("");
const lineIsPlain = (line) => line.every(isPlainRun);
const lineValue = (line) => (lineIsPlain(line) ? plainLine(line) : line.length === 1 ? [line[0]] : mergeRuns(line));
function mergeRuns(runs) {
  const merged = [];
  for (const run of runs) {
    if (typeof run === "string" && typeof merged.at(-1) === "string") merged[merged.length - 1] += run;
    else merged.push(run);
  }
  return merged;
}
function joinLines(lines) {
  if (lines.every(lineIsPlain)) return lines.map(plainLine).join("\n");
  const runs = [];
  lines.forEach((line, index) => {
    if (index > 0) runs.push("\n");
    runs.push(...line);
  });
  return mergeRuns(runs);
}

function toLines(kind, content) {
  const loss = [];
  const note = (message) => {
    if (!loss.includes(message)) loss.push(message);
  };
  switch (kind) {
    case "text":
      return { lines: splitRuns(runsOf(content)), loss };
    case "list": {
      const lines = [];
      for (const item of content) {
        const level = item && typeof item === "object" && !Array.isArray(item) ? (item.level ?? 0) : 0;
        if (level > 0) note("list nesting levels");
        const runs = item && typeof item === "object" && !Array.isArray(item) ? runsOf(item.text) : runsOf(item);
        lines.push(...splitRuns(runs));
      }
      return { lines, loss };
    }
    case "quote": {
      const quote = typeof content === "string" ? { text: content } : content;
      const lines = splitRuns([quote.text]);
      if (quote.attribution) lines.push([`— ${quote.attribution}`]);
      if (quote.source) lines.push([quote.source]);
      return { lines, loss };
    }
    case "metric": {
      const metric = typeof content === "object" ? content : { value: content };
      const value = `${metric.value}${metric.unit ? (/^[A-Za-z]/.test(metric.unit) ? " " : "") + metric.unit : ""}`;
      const lines = [[value]];
      for (const part of [metric.label, metric.description, metric.delta === undefined ? undefined : String(metric.delta)])
        if (part !== undefined && part !== "") lines.push(...splitRuns([part]));
      if (metric.trend) note("metric trend");
      return { lines, loss };
    }
    case "code": {
      const code = typeof content === "string" ? { source: content } : content;
      if (code.language) note("code language");
      if (code.filename) note("code filename");
      return { lines: splitRuns([code.source]), loss };
    }
    case "timeline": {
      const events = Array.isArray(content) ? content : content.events;
      if (!Array.isArray(content) && content.name) note("timeline name");
      return { lines: events.map((event) => [event.when ? `${event.when}: ${event.what}` : event.what]), loss };
    }
    default:
      throw refuse(`${LABEL[kind] ?? kind} content has no text lines.`, { kind });
  }
}

const nonBlank = (lines, note) => {
  const kept = lines.filter((line) => plainLine(line).trim() !== "");
  if (kept.length !== lines.length) note("blank lines");
  return kept;
};

function fromLines(kind, lines, loss) {
  const note = (message) => {
    if (!loss.includes(message)) loss.push(message);
  };
  const flat = (line) => {
    if (!lineIsPlain(line)) note("text formatting");
    return plainLine(line);
  };
  switch (kind) {
    case "text":
      return { key: "text", value: joinLines(lines) };
    case "list": {
      const kept = nonBlank(lines, note);
      return { key: "items", value: kept.map(lineValue) };
    }
    case "timeline": {
      const kept = nonBlank(lines, note);
      if (!kept.length) throw refuse("A timeline needs at least one event, and this block has no text.", { kind });
      return { key: "timeline", value: kept.map((line) => ({ what: flat(line) })) };
    }
    case "code":
      return { key: "code", value: { source: lines.map(flat).join("\n") } };
    case "quote": {
      let kept = lines;
      const last = lines.length > 1 ? flat(lines.at(-1)) : "";
      const dash = /^[—–]\s*(\S.*)$/.exec(last);
      const quote = {};
      if (dash) {
        kept = lines.slice(0, -1);
        quote.attribution = dash[1];
      }
      return { key: "quote", value: { text: kept.map(flat).join("\n"), ...quote } };
    }
    case "metric": {
      const kept = nonBlank(lines, note);
      if (!kept.length) throw refuse("A metric needs a value, and this block has no text.", { kind });
      const first = flat(kept[0]).trim();
      if (first.length > MAX_METRIC_VALUE)
        throw refuse(`The first line is longer than ${MAX_METRIC_VALUE} characters, which is too long to be a metric value. Shorten it or keep this block as text.`, { kind });
      const metric = { value: /^-?(0|[1-9]\d*)(\.\d+)?$/.test(first) && String(Number(first)) === first ? Number(first) : first };
      if (kept[1]) metric.label = flat(kept[1]);
      if (kept.length > 2) metric.description = kept.slice(2).map(flat).join("\n");
      return { key: "metric", value: metric };
    }
    default:
      throw refuse(`Cannot convert text into ${LABEL[kind] ?? kind}.`, { kind });
  }
}

// --- chart and table ---------------------------------------------------------------------------

function chartToTable(chart) {
  const data = chart?.data;
  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) throw refuse("This chart reads external data. Only a chart with inline columns and rows converts to a table.", {});
  return { key: "table", value: { columns: structuredClone(data.columns), rows: structuredClone(data.rows) }, loss: chart.type ? ["chart type"] : [] };
}

function tableToChart(table) {
  const { columns, rows } = table ?? {};
  if (!Array.isArray(columns) || !columns.length || columns.some((label) => typeof label !== "string" || label === ""))
    throw refuse("A chart needs a plain text label for every column. Add column labels to the table first.", {});
  const body = rows.map((row, rowIndex) => {
    if (row.length !== columns.length) throw refuse(`Row ${rowIndex + 1} does not have ${columns.length} cells.`, { row: rowIndex });
    return row.map((cell, columnIndex) => {
      if (cell !== null && typeof cell === "object") throw refuse("This table has styled, merged or formatted cells. Chart data is plain values; clear them first.", { row: rowIndex, column: columnIndex });
      if (columnIndex === 0) return cell;
      if (cell === null || cell === "") return null;
      if (typeof cell === "number") return cell;
      if (typeof cell === "string" && cell.trim() !== "" && Number.isFinite(Number(cell)) && String(Number(cell)) === cell.trim()) return Number(cell);
      throw refuse(`Row ${rowIndex + 1}, column ${columnIndex + 1} ("${String(cell)}") is not a number, so it cannot be a chart value.`, { row: rowIndex, column: columnIndex });
    });
  });
  if (!body.length) throw refuse("A chart needs at least one row.", {});
  return { key: "chart", value: { type: "column", data: { columns: [...columns], rows: body } }, loss: [] };
}

// --- block lookup ------------------------------------------------------------------------------

/**
 * The single content payload of the block at `path` (an explicit `blocks/N` block, or a slide or
 * region that holds exactly one content field), or undefined when there is none.
 */
export function readBlockContent(document, path) {
  let parts;
  try {
    parts = splitOpfPath(path);
  } catch {
    return undefined;
  }
  const pointer = opfPathToJsonPointer(parts);
  const explicit = parts.at(-2) === "blocks" && /^(0|[1-9][0-9]*)$/.test(parts.at(-1) ?? "");
  const owner = getValueAtPath(document, parts);
  if (!owner || typeof owner !== "object" || Array.isArray(owner)) return undefined;
  if (!explicit) {
    const implicit = listBlockContainers(document, { includeImplicit: true }).find((entry) => entry.path === pointer && entry.implicit);
    if (!implicit || implicit.count !== 1) return undefined;
  }
  if (Array.isArray(owner.blocks)) return undefined;
  const keys = CONTENT_KEYS.filter((key) => owner[key] !== undefined);
  if (keys.length !== 1) return undefined;
  const key = keys[0];
  return { path: parts, explicit, owner, key, kind: KIND_OF_KEY[key] ?? key, content: owner[key] };
}

/** Whether `path` is inside a block and, if so, that block's path. A selection such as slides.0.blocks.1.text maps to slides.0.blocks.1. */
export function blockPathForSelection(document, selectedPath) {
  let parts;
  try {
    parts = splitOpfPath(selectedPath);
  } catch {
    return undefined;
  }
  for (let length = parts.length; length >= 2; length -= 1) {
    const candidate = parts.slice(0, length);
    if (candidate[0] !== "slides") return undefined;
    const found = readBlockContent(document, candidate);
    // A slide or region that holds one payload inline is a block only when the selection is that payload.
    if (found && (found.explicit || parts[length] === found.key)) return candidate.join(".");
  }
  return undefined;
}

function convertedContent(from, content, to) {
  if (from === "chart") return chartToTable(content);
  if (from === "table") return tableToChart(content);
  const loss = [];
  const { lines, loss: sourceLoss } = toLines(from, content);
  loss.push(...sourceLoss);
  const { key, value } = fromLines(to, lines, loss);
  return { key, value, loss };
}

/**
 * The kinds the block at `path` can convert to, each with whether the conversion keeps everything
 * (`lossless`), what it cannot carry (`loss`), or why it is unavailable (`available: false`).
 * Returns [] for a block with no convertible content (image, video, group, several fields).
 */
export function blockConversionTargets(document, path) {
  const found = readBlockContent(document, path);
  if (!found) return [];
  return (TARGETS[found.kind] ?? []).map((kind) => {
    try {
      const { loss } = convertedContent(found.kind, found.content, kind);
      return { kind, label: LABEL[kind], available: true, lossless: loss.length === 0, loss };
    } catch (error) {
      return { kind, label: LABEL[kind], available: false, lossless: false, loss: [], reason: error.message };
    }
  });
}

/**
 * Compute the patch that converts the block at `path` to `kind`, without touching a session.
 * Throws `block-not-convertible` for a pair with no safe mapping or content that does not fit.
 * `prepared.loss` lists what the target cannot carry; `lossless` is true when nothing is lost.
 */
export function prepareBlockConversion(document, path, kind) {
  const found = readBlockContent(document, path);
  if (!found) throw refuse("Choose a block that holds one text, list, quote, metric, code, timeline, chart or table payload.", { path });
  if (found.kind === kind) return { document: structuredClone(document), patches: [], path: found.path.join("."), changed: false, lossless: true, loss: [], from: found.kind, to: kind };
  if (!(TARGETS[found.kind] ?? []).includes(kind))
    throw refuse(`${LABEL[found.kind] ?? found.kind} content cannot be converted to ${LABEL[kind]?.toLowerCase() ?? kind}. ${(TARGETS[found.kind] ?? []).length ? `It converts to: ${TARGETS[found.kind].map((target) => LABEL[target].toLowerCase()).join(", ")}.` : "It has no text to convert."}`, { from: found.kind, to: kind });
  const { key, value, loss } = convertedContent(found.kind, found.content, kind);
  const typed = found.owner.type !== undefined ? { type: kind } : {};
  let block;
  if (found.explicit) {
    block = { ...structuredClone(found.owner) };
    for (const field of [...CONTENT_KEYS, "type"]) delete block[field];
    block = { ...block, ...typed, [key]: value };
  } else block = { ...typed, [key]: value };
  const change = prepareBlockReplace(document, found.path.join("."), block);
  return { document: change.document, patches: change.patches, path: change.path, changed: change.changed, lossless: loss.length === 0, loss, from: found.kind, to: kind };
}

/**
 * Convert one block to another content kind as a single undoable transaction. Returns the session
 * change plus `lossless`, `loss`, `from` and `to`.
 */
export function convertBlock(editor, path, kind, meta = {}) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  const prepared = prepareBlockConversion(editor.document, path, kind);
  const summary = { lossless: prepared.lossless, loss: prepared.loss, from: prepared.from, to: prepared.to, path: prepared.path, changed: prepared.changed };
  if (!prepared.changed) return { ...summary, document: editor.document, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(prepared.patches, { ...meta, source: meta.source ?? "block-conversion", blockPath: prepared.path, from: prepared.from, to: prepared.to });
  return { ...change, ...summary };
}
