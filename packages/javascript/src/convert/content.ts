// Content-type conversion for one payload (a block, a region payload, a slide holding one content field, or
// a group of metric blocks). Pure and deterministic: no content is invented, what a target cannot carry is
// reported in `loss`, a pair with no meaningful mapping is refused with a reason, and the result is
// validated as OPF. Internal module; the public surface is `../convert.ts`.
import {
  CONTENT_KEYS,
  type ConversionReport,
  type Json,
  Loss,
  type Obj,
  OPFConversionError,
  type Run,
  assertValidOwner,
  clone,
  contentKeysOf,
  hasFormatting,
  isRecord,
  isSlideLike,
  joinLines,
  lineIsPlain,
  linePlain,
  lineValue,
  plainOf,
  refuse,
  report,
  runsOf,
  splitRuns,
} from "./shared.js";
import {
  type TableOptions,
  listToTable,
  metricsToTable,
  tableToList,
  tableToMetrics,
  tableToTextLines,
  tableToTimeline,
  textLinesToTable,
  timelineToTable,
} from "./tables.js";
import { chartNumber, inlineTableData, isDatasetRef } from "../chart-data.js";
import { fenceCode, levelsFromIndents, parseCodeFence, parseListLine, parseQuoteLines, splitWhen } from "./text-lines.js";

export type ContentKind = "text" | "list" | "quote" | "metric" | "code" | "timeline" | "chart" | "table" | "image" | "video" | "group" | "metrics";

/** Display label of every content kind. `metrics` is the target "a group of metric blocks". */
export const CONTENT_KIND_LABELS: Readonly<Record<ContentKind, string>> = Object.freeze({
  text: "Text",
  list: "List",
  quote: "Quote",
  metric: "Metric",
  code: "Code",
  timeline: "Timeline",
  chart: "Chart",
  table: "Table",
  image: "Image",
  video: "Video",
  group: "Group",
  metrics: "Metric blocks",
});

/**
 * The conversion matrix: source kind to the kinds it converts to. A conversion never invents content; what
 * the target cannot carry is reported. `group` is a group whose blocks are all metrics; `metrics` is that
 * group as a target.
 */
export const CONTENT_CONVERSIONS: Readonly<Record<string, readonly ContentKind[]>> = Object.freeze({
  text: ["list", "quote", "metric", "code", "timeline", "table"],
  list: ["text", "timeline", "table"],
  quote: ["text"],
  metric: ["text"],
  code: ["text"],
  timeline: ["text", "list", "table"],
  chart: ["table"],
  table: ["chart", "list", "timeline", "text", "metrics"],
  group: ["table"],
});

export interface ConvertOptions extends TableOptions {
  /** RR-54: the document the payload belongs to. A dataset-backed chart or table needs it (its `datasets`) to convert to another kind or to validate. */
  document?: unknown;
  /** Text to timeline: also read `label: text` with any short label as the date (default: only date-like labels). */
  looseWhen?: boolean;
  /** Code to text: `auto` (default) writes a fenced block when the code has a language or file name so nothing is lost; `never` writes the bare source and reports the loss. */
  fences?: "auto" | "never";
}

export interface ContentInfo {
  /** The content field (`items` and `bullets` are both "list"; a group holds `blocks`). */
  key: string;
  kind: ContentKind;
  content: Json;
}

const KIND_OF_KEY: Record<string, ContentKind> = { items: "list", bullets: "list", blocks: "group" };
const TYPE_OF_KIND: Partial<Record<ContentKind, string>> = { text: "text", list: "list", quote: "quote", metric: "metric", code: "code", timeline: "timeline", chart: "chart", table: "table", metrics: "group" };

/**
 * The single content payload of an object (a block or a slide or region holding one content field), or
 * undefined when it holds none or several. A payload with `blocks` is a `group`.
 */
export function readContent(payload: unknown): ContentInfo | undefined {
  if (!isRecord(payload)) return undefined;
  if (Array.isArray(payload.blocks)) return contentKeysOf(payload).length ? undefined : { key: "blocks", kind: "group", content: payload.blocks };
  const keys = contentKeysOf(payload);
  if (keys.length !== 1) return undefined;
  const key = keys[0]!;
  return { key, kind: KIND_OF_KEY[key] ?? (key as ContentKind), content: payload[key] };
}

// --- text lines ------------------------------------------------------------------------------

const MAX_METRIC_VALUE = 24;
const INDENT = "  ";
const indentRuns = (runs: Run[], level: number): Run[] => (level > 0 ? [INDENT.repeat(level), ...runs] : runs);

function toLines(kind: ContentKind, content: Json, options: ConvertOptions, loss: Loss): Run[][] {
  switch (kind) {
    case "text":
      return splitRuns(runsOf(content));
    case "list": {
      const lines: Run[][] = [];
      let previous = -1;
      for (const item of content as Json[]) {
        const object = isRecord(item);
        const level = object ? (item.level ?? 0) : 0;
        if (level > previous + 1) loss.note("list nesting levels (renumbered to follow the previous item)");
        previous = level;
        const itemLines = splitRuns(object ? runsOf(item.text) : runsOf(item));
        for (const line of itemLines) lines.push(indentRuns(line, level));
        if (object && item.description !== undefined && plainOf(item.description) !== "") {
          loss.note("list item descriptions (kept as indented lines)");
          for (const line of splitRuns(runsOf(item.description))) lines.push(indentRuns(line, level + 1));
        }
      }
      return lines;
    }
    case "quote": {
      const quote = typeof content === "string" ? { text: content } : content;
      const lines = splitRuns(runsOf(quote.text));
      // A text quote has one attribution line, `— Name, Title`: the role joins the attribution after a comma.
      const credit = [quote.attribution, quote.role].filter(Boolean).join(", ");
      if (quote.photo !== undefined) loss.note("quote photo");
      if (credit) lines.push([`— ${credit}`]);
      if (quote.source) lines.push([credit ? `— ${quote.source}` : quote.source]);
      return lines;
    }
    case "metric": {
      const metric = isRecord(content) ? content : { value: content };
      const value = `${metric.value}${metric.unit ? (/^[A-Za-z]/.test(metric.unit) ? " " : "") + metric.unit : ""}`;
      const lines: Run[][] = [[value]];
      for (const part of [metric.label, metric.description, metric.delta === undefined ? undefined : String(metric.delta)]) if (part !== undefined && part !== "") lines.push(...splitRuns([part]));
      if (metric.trend) loss.note("metric trend");
      if (metric.sentiment) loss.note("metric sentiment");
      return lines;
    }
    case "code": {
      const code = typeof content === "string" ? { source: content } : content;
      if ((code.language || code.filename) && options.fences !== "never") return fenceCode(code.source, code.language, code.filename).map((line) => [line]);
      if (code.language) loss.note("code language");
      if (code.filename) loss.note("code filename");
      return splitRuns([code.source]);
    }
    case "timeline": {
      const events: Json[] = Array.isArray(content) ? content : content.events;
      if (!Array.isArray(content)) {
        if (content.name) loss.note("timeline name");
        if (content.description) loss.note("timeline description");
      }
      if (events.some((event) => event.status)) loss.note("timeline event status");
      const lines: Run[][] = [];
      for (const event of events) {
        lines.push([event.when ? `${event.when}: ${event.what}` : event.what]);
        if (event.description) for (const line of String(event.description).split(/\r\n|\r|\n/)) lines.push([`${INDENT}${line}`]);
      }
      return lines;
    }
    default:
      throw refuse(`${CONTENT_KIND_LABELS[kind] ?? kind} content has no text lines.`, { kind });
  }
}

const isBlank = (line: Run[]): boolean => linePlain(line).trim() === "";
function nonBlank(lines: Run[][], loss: Loss): Run[][] {
  const kept = lines.filter((line) => !isBlank(line));
  if (kept.length !== lines.length) loss.note("blank lines");
  return kept;
}

interface Field {
  key: string;
  value: Json;
}

function fromLines(kind: ContentKind, lines: Run[][], options: ConvertOptions, loss: Loss): Field {
  const flat = (line: Run[]): string => {
    if (!lineIsPlain(line)) loss.note("text formatting");
    return linePlain(line);
  };
  switch (kind) {
    case "text":
      return { key: "text", value: joinLines(lines) };
    case "list": {
      const kept = nonBlank(lines, loss);
      const parsed = kept.map(parseListLine);
      if (parsed.some((entry) => entry.numbered)) loss.note("list numbering");
      const levels = levelsFromIndents(parsed.map((entry) => entry.indent));
      return {
        key: "items",
        value: parsed.map((entry, index) => {
          const value = lineValue(entry.line);
          return levels[index] ? { text: value, level: levels[index] } : value;
        }),
      };
    }
    case "timeline": {
      const kept = nonBlank(lines, loss);
      if (!kept.length) throw refuse("A timeline needs at least one event, and this block has no text.", { kind });
      const events: Obj[] = [];
      for (const line of kept) {
        const text = flat(line);
        if (events.length && /^[ \t]/.test(text)) {
          const detail = text.trim();
          events.at(-1)!.description = events.at(-1)!.description ? `${events.at(-1)!.description}\n${detail}` : detail;
          continue;
        }
        const split = splitWhen(text, options.looseWhen);
        events.push(split ? { when: split.when, what: split.what } : { what: text });
      }
      return { key: "timeline", value: events };
    }
    case "code": {
      const plain = lines.map(flat);
      const fence = parseCodeFence(plain);
      return { key: "code", value: fence ? { source: fence.source, ...(fence.language ? { language: fence.language } : {}), ...(fence.filename ? { filename: fence.filename } : {}) } : { source: plain.join("\n") } };
    }
    case "quote": {
      const plain = lines.map(flat);
      const parsed = parseQuoteLines(plain);
      let body = parsed.text;
      while (body.length > 1 && body.at(-1)!.trim() === "" && parsed.attribution !== undefined) {
        body = body.slice(0, -1);
        loss.note("blank lines");
      }
      return { key: "quote", value: { text: body.join("\n"), ...(parsed.attribution !== undefined ? { attribution: parsed.attribution } : {}), ...(parsed.source !== undefined ? { source: parsed.source } : {}) } };
    }
    case "metric": {
      const kept = nonBlank(lines, loss);
      if (!kept.length) throw refuse("A metric needs a value, and this block has no text.", { kind });
      const first = flat(kept[0]!).trim();
      if (first.length > MAX_METRIC_VALUE) throw refuse(`The first line is longer than ${MAX_METRIC_VALUE} characters, which is too long to be a metric value. Shorten it or keep this block as text.`, { kind });
      const metric: Obj = { value: /^-?(0|[1-9]\d*)(\.\d+)?$/.test(first) && String(Number(first)) === first ? Number(first) : first };
      if (kept[1]) metric.label = flat(kept[1]);
      if (kept.length > 2) metric.description = kept.slice(2).map(flat).join("\n");
      return { key: "metric", value: metric };
    }
    default:
      throw refuse(`Cannot convert text into ${CONTENT_KIND_LABELS[kind]?.toLowerCase() ?? kind}.`, { kind });
  }
}

// --- direct pairs ------------------------------------------------------------------------------

function listToTimeline(items: Json[], options: ConvertOptions, loss: Loss): Field {
  if (!items.length) throw refuse("A timeline needs at least one event, and this list has no items.");
  const events = items.map((item) => {
    const object = isRecord(item);
    if (object && (item.level ?? 0) > 0) loss.note("list nesting levels");
    const text = object ? item.text : item;
    if (hasFormatting(text) || (object && hasFormatting(item.description))) loss.note("text formatting");
    const plain = plainOf(text);
    const split = splitWhen(plain, options.looseWhen);
    const event: Obj = split ? { when: split.when, what: split.what } : { what: plain };
    if (object && item.description !== undefined && plainOf(item.description) !== "") event.description = plainOf(item.description);
    return event;
  });
  return { key: "timeline", value: events };
}

function timelineToList(timeline: Json, loss: Loss): Field {
  const events: Json[] = Array.isArray(timeline) ? timeline : timeline.events;
  if (!Array.isArray(timeline)) {
    if (timeline.name) loss.note("timeline name");
    if (timeline.description) loss.note("timeline description");
  }
  if (events.some((event) => event.status)) loss.note("timeline event status");
  return {
    key: "items",
    value: events.map((event) => {
      const text = event.when ? `${event.when}: ${event.what}` : event.what;
      return event.description ? { text, description: event.description } : text;
    }),
  };
}

function chartToTable(chart: Json, loss: Loss): Field {
  const data = chart?.data;
  if (chart?.mapping !== undefined) loss.note("series mapping");
  // RR-54: a chart that plots a dataset becomes a table of the same dataset (and fields).
  if (isDatasetRef(data)) {
    if (chart.type) loss.note("chart type");
    return { key: "table", value: { dataset: data.dataset, ...(Array.isArray(data.fields) ? { fields: clone(data.fields) } : {}) } };
  }
  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) throw refuse("This chart has no inline columns and rows. Only a chart with inline columns and rows, or a dataset, converts to a table.");
  if (chart.type) loss.note("chart type");
  if (data.source !== undefined) loss.note("data source");
  return { key: "table", value: { columns: clone(data.columns), rows: clone(data.rows) } };
}

function tableToChart(table: Json): Field {
  // RR-54: a dataset table becomes a chart of the same dataset (and fields).
  if (isDatasetRef(table)) return { key: "chart", value: { type: "column", data: { dataset: table.dataset, ...(Array.isArray(table.fields) ? { fields: clone(table.fields) } : {}) } } };
  const { columns, rows } = table ?? {};
  // A DataColumn header ({ name, format }) keeps its format as the chart column's.
  const label = (column: unknown): unknown => (isRecord(column) && !Object.hasOwn(column, "value") && typeof column.name === "string" ? column.name : column);
  if (!Array.isArray(columns) || !columns.length || columns.some((column: unknown) => typeof label(column) !== "string" || label(column) === "")) throw refuse("A chart needs a plain text label for every column. Add column labels to the table first.");
  const body = rows.map((row: Json[], rowIndex: number) => {
    if (row.length !== columns.length) throw refuse(`Row ${rowIndex + 1} does not have ${columns.length} cells.`, { row: rowIndex });
    return row.map((cell, columnIndex) => {
      if (cell !== null && typeof cell === "object") throw refuse("This table has styled, merged or formatted cells. Chart data is plain values; clear them first.", { row: rowIndex, column: columnIndex });
      if (columnIndex === 0) return cell;
      if (cell === null || cell === "") return null;
      if (typeof cell === "number") return cell;
      // RR-54: the one strict chart number rule.
      const number = chartNumber(cell);
      if (number !== null) return number;
      throw refuse(`Row ${rowIndex + 1}, column ${columnIndex + 1} ("${String(cell)}") is not a number, so it cannot be a chart value.`, { row: rowIndex, column: columnIndex });
    });
  });
  if (!body.length) throw refuse("A chart needs at least one row.");
  return { key: "chart", value: { type: "column", data: { columns: clone(columns), rows: body } } };
}

function convertField(from: ContentKind, to: ContentKind, content: Json, options: ConvertOptions, loss: Loss): Field {
  if (from === "chart") return chartToTable(content, loss);
  if (from === "group") return { key: "table", value: metricsToTable(content, options, loss) };
  if (from === "table") {
    switch (to) {
      case "chart":
        return tableToChart(content);
      case "list":
        return { key: "items", value: tableToList(content, loss) };
      case "timeline":
        return { key: "timeline", value: tableToTimeline(content, options, loss) };
      case "text":
        return fromLines("text", tableToTextLines(content, loss).map((line) => [line]), options, loss);
      case "metrics":
        return { key: "blocks", value: tableToMetrics(content, loss) };
      default:
        break;
    }
  }
  if (from === "list" && to === "table") return { key: "table", value: listToTable(content, loss) };
  if (from === "list" && to === "timeline") return listToTimeline(content, options, loss);
  if (from === "timeline" && to === "table") return { key: "table", value: timelineToTable(content, options, loss) };
  if (from === "timeline" && to === "list") return timelineToList(content, loss);
  if (from === "text" && to === "table") {
    const lines = splitRuns(runsOf(content));
    const plain = lines.map((line) => {
      if (!lineIsPlain(line)) loss.note("text formatting");
      return linePlain(line);
    });
    return { key: "table", value: textLinesToTable(plain, options) };
  }
  return fromLines(to, toLines(from, content, options, loss), options, loss);
}

export interface ConvertedContent extends ConversionReport {
  /** The new payload: the old one with its content field replaced (its `id`, `extensions` and any slide fields are kept). */
  payload: Obj;
  from: ContentKind;
  to: ContentKind;
  /** The content field the payload now holds (`blocks` for a group of metrics). */
  key: string;
  /** False when the payload already has the requested kind (then `payload` is a copy of the input). */
  changed: boolean;
}

/**
 * Convert the content of one payload to another kind. The payload is a block (`{ text }`), a slide or region
 * that holds one content field, or a group of metric blocks (`{ blocks: [{ metric }, ...] }`, to `table`).
 * Throws `OPFConversionError` (`not-convertible`) for a pair without a mapping or content that does not fit,
 * with a message that says why. The result is validated as OPF.
 */
export function convertContent(payload: unknown, to: ContentKind, options: ConvertOptions = {}): ConvertedContent {
  const info = readContent(payload);
  if (!info) throw refuse("Choose a payload that holds one text, list, quote, metric, code, timeline, chart or table, or a group of metric blocks.");
  const owner = payload as Obj;
  if (info.kind === to) return { payload: clone(owner), from: info.kind, to, key: info.key, changed: false, lossless: true, loss: [] };
  const targets = CONTENT_CONVERSIONS[info.kind] ?? [];
  if (!targets.includes(to)) {
    const label = CONTENT_KIND_LABELS[info.kind] ?? info.kind;
    throw refuse(`${label} content cannot be converted to ${CONTENT_KIND_LABELS[to]?.toLowerCase() ?? to}. ${targets.length ? `It converts to: ${targets.map((target) => CONTENT_KIND_LABELS[target].toLowerCase()).join(", ")}.` : "It has no text to convert."}`, { from: info.kind, to });
  }
  const loss = new Loss();
  // RR-54: a dataset table converts to anything but a chart from its inline copy, which needs the document.
  let content = info.content;
  if (info.kind === "table" && to !== "chart" && isDatasetRef(content)) {
    content = inlineTableData(content, options.document);
    if (isDatasetRef(content)) throw refuse(`This table shows dataset '${content.dataset}'. Pass the document (options.document) so its rows can be converted.`);
    loss.note("dataset reference (the rows are copied)");
  }
  const { key, value } = convertField(info.kind, to, content, options, loss);
  const out: Obj = {};
  for (const [name, entry] of Object.entries(owner)) {
    if ((CONTENT_KEYS as readonly string[]).includes(name) || name === "type" || name === "blocks") continue;
    if (name === "composition" && info.kind === "group" && !isSlideLike(owner)) {
      loss.note("group arrangement (composition)");
      continue;
    }
    out[name] = clone(entry);
  }
  if (owner.type !== undefined) out.type = TYPE_OF_KIND[to] ?? to;
  out[key] = value;
  assertValidOwner(out, isRecord(options.document) ? options.document : {});
  return { payload: out, from: info.kind, to, key, changed: true, ...report(loss.list) };
}

export interface ContentConversionTarget extends ConversionReport {
  kind: ContentKind;
  label: string;
  /** False when the content does not fit this target; `reason` says why. */
  available: boolean;
  reason?: string;
}

/**
 * The kinds the payload can convert to, each with whether the conversion keeps everything (`lossless`),
 * what it cannot carry (`loss`), or why it is unavailable (`available: false`). Returns [] for a payload
 * with no convertible content (an image, a video, a group that is not a set of metrics, several fields).
 */
export function contentConversionTargets(payload: unknown, options: ConvertOptions = {}): ContentConversionTarget[] {
  const info = readContent(payload);
  if (!info) return [];
  // A group is only convertible as a set of metrics; any other group has nothing to offer.
  if (info.kind === "group" && !(info.content as Json[]).every((block) => isRecord(block) && block.metric !== undefined && Object.keys(block).every((key) => key === "metric" || key === "id" || key === "extensions" || key === "type"))) return [];
  return (CONTENT_CONVERSIONS[info.kind] ?? []).map((kind) => {
    const label = CONTENT_KIND_LABELS[kind];
    try {
      const result = convertContent(payload, kind, options);
      return { kind, label, available: true, lossless: result.lossless, loss: result.loss };
    } catch (error) {
      if (!(error instanceof OPFConversionError)) throw error;
      return { kind, label, available: false, lossless: false, loss: [], reason: error.message };
    }
  });
}

