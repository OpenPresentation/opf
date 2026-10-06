// OPF to Markdown: every part the dialect has syntax for is written natively and verified by reading it back; any
// other part is embedded as YAML (`opf-slide`, `opf-block`) or, when embedding is off, dropped and reported. Internal module.
import { type Obj, type Run, isRecord, runText, same } from "../convert/shared.js";
import { fenceCode } from "../convert/text-lines.js";
import { canonContent, canonText } from "./canon.js";
import { escapeInline, serializeRuns } from "./inline.js";
import { parseSlideText } from "./parse.js";
import { OPFMarkdownError, csvField, scalarText, writeYaml } from "./support.js";

export interface EmbeddedPart {
  /** JSON Pointer into the OPF document. */
  path: string;
  reason: string;
}
export interface LostPart {
  path: string;
  message: string;
}

const CONTENT = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline"] as const;
const isContent = (key: string): boolean => (CONTENT as readonly string[]).includes(key);
const ROWS = "(?:top|middle|bottom|top\\+middle|middle\\+bottom|top\\+middle\\+bottom)";
const COLUMNS = "(?:left|center|right|left\\+center|center\\+right|left\\+center\\+right)";
/** The promoted region keys of a slide: a row band, a column band, or both as `rows:columns`. */
const REGION = new RegExp(`^(?:${ROWS}(?::${COLUMNS})?|${COLUMNS})$`);
const NATIVE_SLIDE = new Set(["id", "type", "layout", "section", "tag", "hidden", "beat", "title", "subtitle", "notes", "blocks", ...CONTENT]);

/** Longest fence-safe marker for a body of lines. */
function fenceFor(body: string[], char = "`"): string {
  let longest = 2;
  for (const line of body) for (const run of line.matchAll(char === "`" ? /`+/g : /~+/g)) longest = Math.max(longest, run[0].length);
  return char.repeat(longest + 1);
}

const fenced = (info: string, body: string[]): string[] => {
  const fence = fenceFor(body);
  return [`${fence}${info}`, ...body, fence];
};

const optionValue = (value: string): string | undefined => {
  if (value.includes("--") || /[\r\n]/.test(value)) return undefined;
  return /^[A-Za-z0-9_][A-Za-z0-9_.:+/@#-]*$/.test(value) && value !== "true" && value !== "false" ? value : JSON.stringify(value);
};

const oneLine = (value: unknown): value is string => typeof value === "string" && value !== "" && !/[\r\n]/.test(value) && value === value.trim();

// --- native blocks -----------------------------------------------------------------------------

/** Lines of one list. */
function listLines(items: unknown[], marker: string): string[] | undefined {
  const lines: string[] = [];
  for (const raw of items) {
    const item = raw as Obj | string | unknown[];
    const text = isRecord(item) && !Array.isArray(item) ? item.text : item;
    const level = isRecord(item) && !Array.isArray(item) && typeof item.level === "number" ? item.level : 0;
    const rows = serializeRuns(text);
    if (!rows || rows.length !== 1) return undefined;
    const indent = "  ".repeat(level);
    lines.push(rows[0] === "" ? `${indent}${marker}` : `${indent}${marker} ${rows[0]}`);
    if (isRecord(item) && !Array.isArray(item) && item.description !== undefined) {
      const description = serializeRuns(item.description);
      if (!description || description.length !== 1 || description[0] === "") return undefined;
      lines.push(`${indent}  : ${description[0]}`);
    }
  }
  return lines;
}

function destination(url: string): string | undefined {
  if (!url || /[\r\n<>]/.test(url)) return undefined;
  return /^[^\s()]+$/.test(url) ? url : `<${url}>`;
}

function imageLines(value: unknown): string[] | undefined {
  const asset = typeof value === "string" ? { src: value } : (value as Obj);
  const dest = destination(String(asset.src));
  if (dest === undefined) return undefined;
  const alt = asset.alt === undefined ? "" : String(asset.alt);
  if (/[\r\n]/.test(alt)) return undefined;
  let title = "";
  if (asset.title !== undefined) {
    if (/[\r\n]/.test(String(asset.title))) return undefined;
    title = ` "${String(asset.title).replace(/[\\"]/g, "\\$&")}"`;
  }
  return [`![${escapeInline(alt)}](${dest}${title})`];
}

function tableLines(table: Obj): string[] | undefined {
  const rows = table.rows as unknown[][];
  const columns = table.columns as unknown[] | undefined;
  const width = columns ? columns.length : Math.max(0, ...rows.map((row) => row.length));
  if (!width) return undefined;
  const cell = (value: unknown): string | undefined => {
    if (value === null) return "";
    if (typeof value === "number") return String(value);
    const rows = serializeRuns(value, "cell");
    return rows?.[0]?.replaceAll("|", "\\|");
  };
  const render = (cells: unknown[]): string | undefined => {
    const out = cells.map(cell);
    return out.includes(undefined) ? undefined : `| ${out.join(" | ")} |`;
  };
  const header = render(columns ?? Array.from({ length: width }, () => null));
  const body = rows.map(render);
  if (header === undefined || body.includes(undefined)) return undefined;
  return [header, `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...(body as string[])];
}

/** Chart data as JSON with one row per line. */
function chartJson(data: Obj): string[] {
  const entries = Object.entries(data).map(([key, value]): string[] =>
    key === "rows" && Array.isArray(value) ? ['  "rows": [', ...value.map((row, index) => `    ${JSON.stringify(row)}${index < value.length - 1 ? "," : ""}`), "  ]"] : [`  ${JSON.stringify(key)}: ${JSON.stringify(value)}`],
  );
  return ["{", ...entries.flatMap((lines, index) => lines.map((line, at) => (at === lines.length - 1 && index < entries.length - 1 ? `${line},` : line))), "}"];
}

/** CSV when the data reads back from it, then JSON. The first column is category text, so it is not quoted for looking like a number. */
function chartCandidates(chart: Obj): string[][] {
  if (!/^\S+$/.test(chart.type)) return [];
  const data = chart.data as Obj;
  // FA-09: alt rides in the fence info; a backtick would end a backtick fence's info string, so such a chart is embedded instead.
  if (typeof chart.alt === "string" && chart.alt.includes("`")) return [];
  const info = `chart ${chart.type}${typeof chart.alt === "string" ? ` alt=${JSON.stringify(chart.alt)}` : ""}`;
  const json = fenced(info, chartJson(data));
  if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
    const body = [(data.columns as unknown[]).map((column) => csvField(column, true)).join(","), ...(data.rows as unknown[][]).map((row) => row.map((value, index) => csvField(value, index === 0)).join(","))];
    return [fenced(info, body), json];
  }
  return [json];
}

const TIMELINE_STATUS_MARKS: Obj = { done: "[x] ", current: "[>] ", planned: "[ ] " };

function timelineLines(timeline: unknown): string[] | undefined {
  const events = (Array.isArray(timeline) ? timeline : (timeline as Obj).events) as Obj[];
  const meta = Array.isArray(timeline) ? {} : (timeline as Obj);
  const info = ["timeline", ...["name", "description"].filter((key) => meta[key] !== undefined).map((key) => `${key}=${JSON.stringify(meta[key])}`)].join(" ");
  const body: string[] = [];
  for (const event of events) {
    for (const key of ["when", "what", "description"]) if (typeof event[key] === "string" && (/[\r\n]/.test(event[key]) || event[key] !== event[key].trim() || event[key] === "")) return undefined;
    const line = event.when === undefined ? event.what : `${event.when} — ${event.what}`;
    // Text that already starts like a status mark cannot be told apart from one, so it stays embedded JSON.
    if (event.status === undefined && /^\[[x> ]\]\s+\S/.test(line)) return undefined;
    body.push(event.status === undefined ? line : `${TIMELINE_STATUS_MARKS[event.status as string]}${line}`);
    if (event.description !== undefined) body.push(`  ${event.description}`);
  }
  return fenced(info, body);
}

function metricLines(metric: unknown): string[] | undefined {
  const value = typeof metric === "object" ? (metric as Obj) : { value: metric };
  const body: string[] = [];
  for (const key of ["value", "label", "description", "unit", "delta", "trend", "sentiment"]) if (value[key] !== undefined) body.push(`${key}: ${scalarText(value[key])}`);
  return fenced("metric", body);
}

/** The paragraphs of a rich quote text: the runs cut at every blank line, each piece keeping its formatting. */
function splitParagraphs(runs: Run[]): Run[][] {
  const out: Run[][] = [[]];
  for (const run of runs) {
    runText(run).split("\n\n").forEach((part, index) => {
      if (index > 0) out.push([]);
      if (part !== "") out.at(-1)!.push(typeof run === "string" ? part : { ...run, text: part });
    });
  }
  return out;
}

function quoteLines(quote: unknown): string[] | undefined {
  const value = typeof quote === "string" ? { text: quote } : (quote as Obj);
  const lines: string[] = [];
  const paragraphs: (string | Run[])[] = Array.isArray(value.text) ? splitParagraphs(value.text as Run[]) : String(value.text).split("\n\n");
  for (const [index, paragraph] of paragraphs.entries()) {
    const rows = serializeRuns(paragraph);
    if (!rows) return undefined;
    if (index > 0) lines.push(">");
    for (const row of rows) lines.push(row === "" ? ">" : `> ${row}`);
  }
  for (const key of ["attribution", "source"]) {
    if (value[key] === undefined) continue;
    if (!oneLine(value[key])) return undefined;
    lines.push(`> — ${escapeInline(value[key])}`);
  }
  return lines;
}

/** The ways one block can be written natively, best first. */
function nativeCandidates(key: string, canon: unknown, marker: string): string[][] {
  if (key === "chart") return chartCandidates(canon as Obj);
  const lines = nativeLines(key, canon, marker);
  return lines?.length ? [lines] : [];
}

/** The lines of one natively written block, or undefined when its content has no native form. */
function nativeLines(key: string, canon: unknown, marker: string): string[] | undefined {
  switch (key) {
    case "text": {
      if (canon === "") return undefined;
      return serializeRuns(canon);
    }
    case "items":
    case "bullets":
      return listLines(canon as unknown[], marker);
    case "quote":
      return quoteLines(canon);
    case "code": {
      const code = typeof canon === "string" ? { source: canon } : (canon as Obj);
      const language = code.language as string | undefined;
      if (language !== undefined && (!/^[A-Za-z0-9_+#.-]+$/.test(language) || ["chart", "metric", "timeline", "opf-slide", "opf-block"].includes(language))) return undefined;
      return fenceCode(code.source as string, language, code.filename as string | undefined);
    }
    case "metric":
      return metricLines(canon);
    case "image":
    case "video":
      return imageLines(canon);
    case "table":
      return tableLines(canon as Obj);
    case "timeline":
      return timelineLines(canon);
    default:
      return undefined;
  }
}

// --- one slide ---------------------------------------------------------------------------------

interface Component {
  /** Lines of the component, ready to be separated from the next by a blank line. */
  lines: string[];
}

interface BlockSpec {
  key: string;
  value: unknown;
  id?: unknown;
  type?: unknown;
  region?: string;
}

function blockOptionsLine(spec: BlockSpec, as: string | undefined): string | undefined {
  const parts: string[] = [];
  for (const [key, value] of [["id", spec.id], ["type", spec.type], ["as", as], ["region", spec.region]] as const) {
    if (value === undefined) continue;
    const text = typeof value === "string" ? optionValue(value) : undefined;
    if (text === undefined) return undefined;
    parts.push(`${key}=${text}`);
  }
  return parts.length ? `<!-- block: ${parts.join(" ")} -->` : "";
}

/** A block written natively with its options, verified by reading it back; undefined when it cannot be. */
function nativeBlock(spec: BlockSpec, marker: string): string[] | undefined {
  const canon = canonContent(spec.key, spec.value);
  if (canon === undefined) return undefined;
  const as = spec.key === "bullets" ? "bullets" : spec.key === "video" ? "video" : undefined;
  const logical = spec.key === "bullets" ? "items" : spec.key === "video" ? "image" : spec.key;
  const options = blockOptionsLine(spec, as);
  if (options === undefined) return undefined;
  for (const lines of nativeCandidates(logical, canon, marker)) {
    const all = options ? [options, ...lines] : lines;
    const { slide, clean } = parseSlideText(all.join("\n"));
    if (!slide || !clean) continue;
    const target = spec.region !== undefined ? (slide[spec.region] as Obj | undefined) : spec.id !== undefined || spec.type !== undefined ? (slide.blocks as Obj[] | undefined)?.[0] : slide;
    if (target && same(target[spec.key], canon)) return all;
  }
  return undefined;
}

function embed(value: Obj): string[] | undefined {
  const text = writeYaml(value);
  return text === undefined ? undefined : fenced("opf-block", text.trimEnd().split("\n"));
}

/** Lines of one slide, the parts embedded, and the parts lost (when embedding is off). */
export function emitSlide(slide: Obj, index: number, mode: "embed" | "drop"): { lines: string[]; embedded: EmbeddedPart[]; loss: LostPart[] } {
  const path = `/slides/${index}`;
  const embedded: EmbeddedPart[] = [];
  const loss: LostPart[] = [];
  const extras: Obj = {};
  const sections: Component[] = [];
  /** What reading the written Markdown back must give. */
  const exp: Obj = {};
  const expBlocks: Obj[] = [];
  const handle = (where: string, reason: string, keep: () => void): void => {
    if (mode === "embed") {
      embedded.push({ path: where, reason });
      keep();
    } else loss.push({ path: where, message: reason });
  };

  // Options comment.
  const options: [string, string][] = [];
  const optionFields: [string, unknown][] = [["id", slide.id], ["type", slide.type], ["beat", slide.beat], ["layout", slide.layout], ["section", slide.section], ["tag", slide.tag]];
  const failed: string[] = [];
  for (const [key, value] of optionFields) {
    if (value === undefined) continue;
    if (key === "beat" && Array.isArray(value) && value.length >= 2 && value.every((entry) => typeof entry === "string")) {
      // Several beats are written as repeated beat= pairs.
      const texts = value.map(optionValue);
      if (texts.every((entry) => entry !== undefined)) options.push(...texts.map((entry): [string, string] => ["beat", entry!]));
      else failed.push(key);
      continue;
    }
    const text = typeof value === "string" ? optionValue(value) : undefined;
    if (text === undefined) failed.push(key);
    else options.push([key, text]);
  }
  if (slide.hidden === true) options.push(["hidden", "true"]);
  else if (slide.hidden === false) options.push(["hidden", "false"]);
  else if (slide.hidden !== undefined) failed.push("hidden");
  const optionsText = options.map(([key, text]) => (key === "hidden" && text === "true" ? "hidden" : `${key}=${text}`)).join(" ");
  const optionsLine = options.length ? `<!-- slide: ${optionsText} -->` : "";
  if (optionsLine) {
    const { slide: back, clean } = parseSlideText(optionsLine);
    const expected: Obj = {};
    for (const [key] of options) expected[key] = slide[key];
    if (!back || !clean || !same(back, expected)) {
      for (const [key] of options) failed.push(key);
      options.length = 0;
    }
  }
  for (const key of new Set(failed)) handle(`${path}/${key}`, `slide option ${key} has no <!-- slide: --> form`, () => (extras[key] = slide[key]));
  const kept = options.length ? `<!-- slide: ${options.map(([key, text]) => (key === "hidden" && text === "true" ? "hidden" : `${key}=${text}`)).join(" ")} -->` : "";
  if (kept) {
    sections.push({ lines: [kept] });
    for (const [key] of options) exp[key] = slide[key];
  }

  // Title and subtitle.
  for (const [key, mark] of [["title", "#"], ["subtitle", "##"]] as const) {
    const value = slide[key];
    if (value === undefined) continue;
    // A string, or a TextRun[] whose formatting the dialect can write, as a single # / ## line.
    const canon = canonText(value);
    const row = canon === undefined ? undefined : typeof canon === "string" ? (oneLine(canon) ? escapeInline(canon) : undefined) : serializeRuns(canon)?.length === 1 ? serializeRuns(canon)![0] : undefined;
    if (canon !== undefined && row) {
      // A trailing run of # would read as a closing sequence: escape its first #.
      const line = `${mark} ${row.replace(/(^|\s)(#+)$/, "$1\\$2")}`;
      const { slide: back, clean } = parseSlideText(line);
      if (back && clean && same(back[key], canon)) {
        sections.push({ lines: [line] });
        exp[key] = canon;
        continue;
      }
    }
    handle(`${path}/${key}`, `the ${key} has no single-line Markdown form`, () => (extras[key] = value));
  }

  // Content.
  const specs: { spec: BlockSpec; where: string; payload?: Obj }[] = [];
  const handledRegions = new Set<string>();
  if (Array.isArray(slide.blocks)) {
    slide.blocks.forEach((block: unknown, i: number) => {
      const where = `${path}/blocks/${i}`;
      if (!isRecord(block)) return;
      const keys = Object.keys(block).filter((key) => key !== "id" && key !== "type");
      const only = keys.length === 1 && isContent(keys[0]!) ? keys[0]! : undefined;
      specs.push({ spec: { key: only ?? "", value: only ? block[only] : undefined, id: block.id, type: block.type }, where, payload: block });
    });
    for (const key of CONTENT) if (slide[key] !== undefined) extras[key] = slide[key];
  } else {
    for (const key of CONTENT) if (slide[key] !== undefined) specs.push({ spec: { key, value: slide[key] }, where: `${path}/${key}` });
  }
  for (const [key, value] of Object.entries(slide)) {
    if (!REGION.test(key) || !isRecord(value)) continue;
    const rest = Object.keys(value).filter((entry) => entry !== "id" && entry !== "type");
    const only = rest.length === 1 && isContent(rest[0]!) ? rest[0]! : undefined;
    if (only === undefined) continue;
    handledRegions.add(key);
    specs.push({ spec: { key: only, value: value[only], id: value.id, type: value.type, region: key }, where: `${path}/${key}`, payload: value });
  }
  let marker = "-";
  for (const { spec, where, payload } of specs) {
    const lines = spec.key ? nativeBlock(spec, marker) : undefined;
    if (lines) {
      sections.push({ lines });
      const written = { ...(spec.id !== undefined ? { id: spec.id } : {}), ...(spec.type !== undefined ? { type: spec.type } : {}), [spec.key]: canonContent(spec.key, spec.value) };
      if (spec.region !== undefined) exp[spec.region] = written;
      else expBlocks.push(written);
      const list = spec.key === "items" || spec.key === "bullets";
      marker = list ? (marker === "-" ? "*" : "-") : "-";
      continue;
    }
    marker = "-";
    handle(where, spec.key ? `${spec.key} content has a part with no Markdown form` : "a block with several fields or a nested group has no Markdown form", () => {
      // A region cannot be set inside an opf-block fence, so the whole region goes to the opf-slide block.
      if (spec.region !== undefined) {
        extras[spec.region] = slide[spec.region];
        return;
      }
      const payloadValue: Obj = payload ?? { [spec.key]: spec.value };
      const lines = embed(payloadValue);
      if (!lines) throw new OPFMarkdownError("not-representable", `The block at ${where} holds a value that YAML cannot carry exactly.`, { path: where });
      sections.push({ lines });
      if (spec.region !== undefined) exp[spec.region] = structuredClone(payloadValue);
      else expBlocks.push(structuredClone(payloadValue));
    });
  }

  // Notes.
  let notesLines: string[] | undefined;
  if (slide.notes !== undefined) {
    const notes = slide.notes;
    if (typeof notes === "string" && notes !== "" && !/\r/.test(notes)) {
      const rows = notes.split("\n");
      const candidate = [`Note: ${rows[0]}`, ...rows.slice(1)];
      const { slide: back, clean } = parseSlideText(candidate.join("\n"));
      if (back && clean && back.notes === notes) {
        notesLines = candidate;
        exp.notes = notes;
      }
    }
    if (!notesLines) handle(`${path}/notes`, "the speaker notes have no Note: form (blank edges, a --- line or a carriage return)", () => (extras.notes = notes));
  }

  // Everything else: composition, design, extensions, region keys.
  for (const [key, value] of Object.entries(slide)) if (!NATIVE_SLIDE.has(key) && !handledRegions.has(key)) handle(`${path}/${key}`, `${JSON.stringify(key)} has no Markdown form`, () => (extras[key] = value));
  if (Object.keys(extras).length) {
    const text = writeYaml(extras);
    if (text === undefined) throw new OPFMarkdownError("not-representable", `The slide at ${path} holds a value that YAML cannot carry exactly.`, { path });
    sections.push({ lines: fenced("opf-slide", text.trimEnd().split("\n")) });
    Object.assign(exp, structuredClone(extras));
  }
  const [only] = expBlocks;
  const onlyKey = only && Object.keys(only).length === 1 ? Object.keys(only)[0] : undefined;
  if (expBlocks.length === 1 && onlyKey !== undefined && isContent(onlyKey)) exp[onlyKey] = only![onlyKey];
  else if (expBlocks.length) exp.blocks = expBlocks;
  if (notesLines) sections.push({ lines: notesLines });
  if (!sections.length) sections.push({ lines: ["<!-- slide -->"] });
  // The slide options comment sits directly above whatever follows it.
  const lines = sections.flatMap((section, i) => (i === 0 || (i === 1 && kept) ? section.lines : ["", ...section.lines]));

  // Guard: the slide must read back as what was written.
  if (mode === "embed") {
    const { slide: back, clean } = parseSlideText(lines.join("\n"));
    if (!back || !clean || !same(back, exp)) throw new OPFMarkdownError("not-representable", `The slide at ${path} does not read back from its Markdown.`, { path, expected: exp, actual: back });
  }
  return { lines, embedded, loss };
}
