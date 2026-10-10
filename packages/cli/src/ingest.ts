// `opf ingest`: turn CSV, TSV or JSON rows into a table or chart. The output is a pure function of the inputs:
// no clock, no randomness, and no dependence on the working directory (RR-62).
import { createHash } from "node:crypto";
import path from "node:path";
import { ingest, CHART_TYPES, type ImportedChartType } from "@openpresentation/opf";
import { applyPatch, parsePointer } from "@openpresentation/opf/patch";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { deckFormatFlag } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { dataFormatOf, readText } from "./io.js";
import { type Host, type Options, destinationOf, failOnOf, inputFact, readDeck, writeDeck } from "./runtime.js";

export const spec: CommandSpec = {
  name: "ingest",
  usage: [
    "opf ingest <data|-> [output|-] --as <table|chart> [--data-format <csv|tsv|json>] [--into <deck> [-i] [--path <pointer>]]",
    "         [--category <column>] [--series <JSON-array>] [--columns <JSON-array>] [--chart-type <id>] [--no-header]",
    "         [--delimiter <c>] [--title <text>] [--id <slideId>] [--dataset <id>] [--date <YYYY-MM-DD>] [--from <format>] [--to <format>] [--force] [--fail-on <level>]",
  ],
  summary: "Turn CSV, TSV or JSON rows into a table or chart slide, alone or added to a deck.",
  operands: ["<data> (a .csv, .tsv or .json file, or - for stdin)"],
  positional: [1, 2],
  values: ["as", "data-format", "into", "path", "category", "series", "columns", "chart-type", "delimiter", "title", "id", "dataset", "date", "from", "to", "fail-on"],
  flags: ["in-place", "no-header", "force"],
  help: `The data's form comes from its extension or --data-format (JSON when it starts with { or [). Without --into the result is a
new one-slide deck; with --into the slide is added to that deck (--from reads it), or --path replaces the table or chart at a
JSON Pointer. --dataset <id> stores the rows in the deck's datasets and references them (--date records when they were
retrieved). The result goes to stdout, the output, or back to the --into deck with -i. The same inputs always give the same
slide id and the same bytes. The report { command, ok, input, outputs, findings, counts } goes to stdout, or stderr for stdout.

Examples:
  opf ingest revenue.csv --as chart --into deck.opf.json -i --chart-type line
  opf ingest rows.json table.opf.json --as table --data-format json`,
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * The slide id for imported data: `data-` and eight hex digits of a SHA-256 over the source text and the options that
 * shape the import, so the same import always gets the same id and different data or options get different ones.
 * A BOM and CRLF line endings are normalised first so a checkout's line endings do not change the id.
 */
export function importSlideId(raw: string, settings: Record<string, unknown>): string {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  return `data-${createHash("sha256").update(text).update("\0").update(JSON.stringify(settings)).digest("hex").slice(0, 8)}`;
}

/** `base`, else `base-2`, `base-3`, ... the first id no slide in the deck already has. */
export function freeSlideId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * The source path as the deck file sees it: relative to the deck's folder with `/` separators, so the same deck and data
 * file give the same text on Windows, macOS and Linux and from any working directory. A source on another Windows drive
 * has no relative form and stays absolute (also with `/`). With no deck file (stdout) the folder is the working directory.
 */
export function deckRelativeSrc(deckFile: string | undefined, dataFile: string): string {
  const from = deckFile === undefined ? process.cwd() : path.dirname(path.resolve(deckFile));
  return path.relative(from, path.resolve(dataFile)).split(path.sep).join("/");
}

/** `YYYY-MM-DD` that is a real calendar date. */
function checkDate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const text = typeof value === "string" ? value : "";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : undefined;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw usage("--date must be a real calendar date, YYYY-MM-DD.", "invalid-value", { option: "--date" });
  return text;
}

export async function run(args: string[], _host: Host): Promise<void> {
  const parsed = parseArgs(spec, args);
  if (parsed === "help") return printHelp(spec);
  const { positional, options } = parsed;
  const [input, output] = positional as [string, string | undefined];
  if (options.as === undefined) throw usage("opf ingest needs --as table or --as chart.", "missing-value", { option: "--as" });
  if (options.as !== "table" && options.as !== "chart") throw usage("--as must be table or chart.", "invalid-value", { option: "--as" });
  if (options.path && !options.into) throw usage("--path needs --into <deck>: it names a place in that deck.", "option-not-applicable", { option: "--path" });
  if (options["in-place"] && (options.into === undefined || options.into === "-")) throw usage("-i rewrites the --into deck: give --into <file>.", "option-not-applicable", { option: "-i" });
  if (options.from !== undefined && options.into === undefined) throw usage("--from reads the --into deck; the data's form is --data-format.", "option-not-applicable", { option: "--from" });
  if (options.into === "-" && input === "-") throw usage("stdin can supply only one input: give the data or the --into deck as a file.");
  const failOn = failOnOf(options);
  const from = deckFormatFlag("--from", options.from);
  const to = deckFormatFlag("--to", options.to);
  const destination = destinationOf("ingest", options.into === undefined ? "-" : String(options.into), output, options as Options);
  if (options.id !== undefined && (typeof options.id !== "string" || options.id === "")) throw usage("--id needs a slide id.", "invalid-value", { option: "--id" });
  if (options.id !== undefined && options.path) throw usage("--id names a new slide; it cannot combine with --path, which replaces the table or chart in an existing slide.");
  const date = checkDate(options.date);
  if (date !== undefined && options.dataset === undefined) throw usage("--date records when a dataset's data was retrieved, so it needs --dataset <id>.", "option-not-applicable", { option: "--date" });
  const list = (key: string): string[] | undefined => {
    if (options[key] === undefined) return undefined;
    let value: unknown; try { value = JSON.parse(String(options[key])); } catch { throw usage(`--${key} needs a JSON array of column names.`, "invalid-value", { option: `--${key}` }); }
    if (!Array.isArray(value) || !value.every(item => typeof item === "string")) throw usage(`--${key} needs a JSON array of column names.`, "invalid-value", { option: `--${key}` });
    return value;
  };
  // The data's form: --data-format, else its extension (a .csv name is the default, so it adds nothing to the slide id).
  const named = dataFormatOf(input);
  const format = oneOf("--data-format", options["data-format"], ["csv", "tsv", "json"] as const) ?? (named === "csv" ? undefined : named);
  // OPF 0.15: chart types are an engine vocabulary; an unknown one would only surface as an invalid deck later.
  const chartType = options["chart-type"] === undefined ? undefined : String(options["chart-type"]);
  if (chartType !== undefined && !CHART_TYPES.includes(chartType)) throw usage(`Unknown chart type: ${chartType}. Run opf catalog chart-types for the ids.`, "invalid-value", { option: "--chart-type" });
  const raw = await readText(input);
  const columns = list("columns"), series = list("series");
  const imported = ingest(raw, { as: options.as, format: format as "csv" | "tsv" | "json" | undefined, header: !options["no-header"], delimiter: options.delimiter as string | undefined, columns, category: options.category as string | undefined, series, chartType: chartType as ImportedChartType | undefined });
  // RR-54: --dataset <id> writes the data into the top-level datasets map (replacing that dataset's columns and rows,
  // keeping its title, description and source) and references it from the table or chart.
  const datasetId = options.dataset === undefined ? undefined : String(options.dataset);
  if (datasetId !== undefined && (options.dataset === true || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(datasetId))) throw usage('--dataset needs an id of letters, digits, ".", "_" or "-".', "invalid-value", { option: "--dataset" });
  const data = "table" in imported ? imported.table : imported.chart.data;
  const content = datasetId === undefined ? imported : "table" in imported ? { table: { dataset: datasetId } } : { chart: { type: imported.chart.type, data: { dataset: datasetId } } };
  // The deck file the data goes into, else the one written. Written to stdout there is none, and a path reads from the working directory.
  const deckFile = options.into !== undefined && options.into !== "-" ? String(options.into) : destination.file !== "-" ? destination.file : undefined;
  const withDataset = (deck: unknown): unknown => {
    if (datasetId === undefined) return deck;
    const record = isRecord(deck) ? deck : {};
    const datasets = isRecord(record.datasets) ? record.datasets : {};
    const previous = isRecord(datasets[datasetId]) ? datasets[datasetId] as Record<string, unknown> : {};
    // `retrieved` only ever comes from --date, never from the clock, and a re-import never keeps the old date, which described the old data.
    const origin = input === "-" ? undefined : { src: deckRelativeSrc(deckFile, input), ...(date === undefined ? {} : { retrieved: date }) };
    // A column that keeps its name keeps its number format. The source describes the new origin only: its other
    // fields (sheet, range, description) survive a re-import of the same file, and data from stdin has none.
    const formats = new Map((Array.isArray(previous.columns) ? previous.columns : []).flatMap((column: unknown) => isRecord(column) && typeof column.name === "string" && typeof column.format === "string" ? [[column.name, column.format] as const] : []));
    const newColumns = data.columns.map(name => { const format = formats.get(name); return format === undefined ? name : { name, format }; });
    const before = isRecord(previous.source) ? previous.source : {};
    const { retrieved: _stale, ...beforeKept } = before;
    const { source: _source, ...kept } = previous;
    const entry = { ...kept, columns: newColumns, rows: data.rows, ...(origin ? { source: before.src === origin.src ? { ...beforeKept, ...origin } : origin } : {}) };
    return { ...record, datasets: { ...datasets, [datasetId]: entry } };
  };
  const source = options.into ? await readDeck(String(options.into), { from, rewrite: destination.file !== "-" }) : undefined;
  const title = options.title ?? "Imported data";
  // Everything that shapes the imported content, so the same import always names its slide the same way.
  const settings = { as: options.as, format, header: !options["no-header"], delimiter: options.delimiter, columns, category: options.category, series, chartType, dataset: datasetId };
  let document: unknown;
  if (source) {
    if (options.path) {
      const parts = parsePointer(options.path as string);
      if (parts.at(-1) !== options.as) throw usage("--path must end in /table or /chart, matching --as.", "invalid-value", { option: "--path" });
      document = applyPatch(withDataset(source.value), [{ op: "add", path: options.path as string, value: "table" in content ? content.table : content.chart }]);
    } else {
      const slides = isRecord(source.value) && Array.isArray(source.value.slides) ? source.value.slides : [];
      const taken = new Set(slides.flatMap((slide: unknown) => isRecord(slide) && typeof slide.id === "string" ? [slide.id] : []));
      let id: string;
      if (options.id !== undefined) {
        id = String(options.id);
        if (taken.has(id)) throw new CliError(`The deck already has a slide with id "${id}". Choose another --id, or omit it to derive one.`, "duplicate-id", 1, { id });
      } else id = freeSlideId(importSlideId(raw, settings), taken);
      document = applyPatch(withDataset(source.value), [{ op: "add", path: "/slides/-", value: { id, title, ...content } }]);
    }
  } else document = withDataset({ slides: [{ id: options.id !== undefined ? String(options.id) : "data-1", title, ...content }] });
  const inputs = [inputFact(input, raw), ...(source && options.into !== undefined ? [inputFact(String(options.into), source.raw)] : [])];
  await writeDeck("ingest", document, destination, { source, inputFile: options.into === undefined ? undefined : String(options.into), to, failOn, input: inputs.length === 1 ? (inputs[0] as ReturnType<typeof inputFact>) : inputs });
}
