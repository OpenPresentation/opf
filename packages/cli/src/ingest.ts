// `opf ingest`: turn CSV, TSV or JSON rows into a table or chart. The output is a pure function of the inputs:
// no clock, no randomness, and no dependence on the working directory (RR-62).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ingest, CHART_TYPES, type ImportedChartType } from "@openpresentation/opf";
import { applyPatch, parsePointer } from "@openpresentation/opf/patch";
import type { CliContext } from "./context.js";
import { isDeckFormatFlag } from "./deck.js";
import { dataFormatOf, samePath } from "./io.js";

export const INGEST_USAGE = `  opf ingest <data.csv|data.json|-> --as <table|chart> [--format <csv|tsv|json>]
           [--into <deck>] [--path </slides/0/table>] [--output <file|-> | --in-place]
           [--category <column>] [--series <JSON-array>] [--columns <JSON-array>]
           [--chart-type <id>] [--no-header] [--delimiter <character>] [--title <text>]
           [--id <slideId>] [--dataset <id>] [--date <YYYY-MM-DD>] [--format yaml|markdown] [--force] [--fail-on <level>]`;

const FLAGS = ["as", "format", "into", "path", "output", "in-place", "category", "series", "columns", "chart-type", "no-header", "delimiter", "title", "id", "dataset", "date", "force", "fail-on"];

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * The slide id for imported data: `data-` and eight hex digits of a SHA-256 over the source text and the options that
 * shape the import, so the same import always gets the same id and different data or options get different ones.
 * A BOM and CRLF line endings are normalised first so a checkout's line endings do not change the id.
 */
export function importSlideId(raw: string, settings: Record<string, unknown>): string {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
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
function checkDate(cli: CliContext, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const text = typeof value === "string" ? value : "";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : undefined;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw cli.fail("--date must be a real calendar date, YYYY-MM-DD.");
  return text;
}

export async function ingestCommand(args: string[], cli: CliContext): Promise<void> {
  const { positional, options } = cli.parse(args, FLAGS); cli.arity(positional, 1);
  const input = positional[0] as string;
  if (options.as !== "table" && options.as !== "chart") throw cli.fail("ingest requires --as table or --as chart.");
  if (options.path && !options.into) throw cli.fail("--path requires --into <deck>.");
  if (options["in-place"] && (!options.into || options.into === "-" || options.output !== undefined || options.force)) throw cli.fail("--in-place requires a file --into and cannot combine with --output or --force.");
  if (options.into === "-" && input === "-") throw cli.fail("stdin can supply only one input.");
  if (options.id !== undefined && (typeof options.id !== "string" || options.id === "")) throw cli.fail("--id requires a slide id.");
  if (options.id !== undefined && options.path) throw cli.fail("--id names a new slide; it cannot combine with --path, which replaces the table or chart in an existing slide.");
  const date = checkDate(cli, options.date);
  if (date !== undefined && options.dataset === undefined) throw cli.fail("--date records when a dataset's data was retrieved, so it requires --dataset <id>.");
  const list = (key: string): string[] | undefined => {
    if (options[key] === undefined) return undefined;
    let value: unknown; try { value = JSON.parse(String(options[key])); } catch { throw cli.fail(`--${key} requires a JSON array of column names.`); }
    if (!Array.isArray(value) || !value.every(item => typeof item === "string")) throw cli.fail(`--${key} requires a JSON array of column names.`);
    return value;
  };
  // --format yaml or markdown names the output; csv, tsv and json name the data.
  const outFlag = isDeckFormatFlag(options.format) ? String(options.format) : undefined;
  const named = dataFormatOf(input);
  const format = (outFlag ? undefined : options.format) ?? (named === "csv" ? undefined : named);
  if (format !== undefined && !["csv", "tsv", "json"].includes(String(format))) throw cli.fail("Unknown data format.");
  // OPF 0.15: chart types are an engine vocabulary; an unknown one would only surface as an invalid deck later.
  const chartType = options["chart-type"] === undefined ? undefined : String(options["chart-type"]);
  if (chartType !== undefined && !CHART_TYPES.includes(chartType)) throw cli.fail(`Unknown chart type: ${chartType}. Run opf catalog chart-types for the ids.`);
  const raw = input === "-" ? await cli.stdin() : await readFile(input, "utf8");
  const columns = list("columns"), series = list("series");
  const imported = ingest(raw, { as: options.as, format: format as "csv" | "tsv" | "json" | undefined, header: !options["no-header"], delimiter: options.delimiter as string | undefined, columns, category: options.category as string | undefined, series, chartType: chartType as ImportedChartType | undefined });
  // RR-54: --dataset <id> writes the data into the top-level datasets map (replacing that dataset's columns and rows,
  // keeping its title, description and source) and references it from the table or chart.
  const datasetId = options.dataset === undefined ? undefined : String(options.dataset);
  if (datasetId !== undefined && (options.dataset === true || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(datasetId))) throw cli.fail('--dataset requires an id of letters, digits, ".", "_" or "-".');
  const data = "table" in imported ? imported.table : imported.chart.data;
  const content = datasetId === undefined ? imported : "table" in imported ? { table: { dataset: datasetId } } : { chart: { type: imported.chart.type, data: { dataset: datasetId } } };
  const output = options["in-place"] ? String(options.into) : String(options.output ?? "-");
  // The deck file the data goes into, else the one written. Written to stdout there is none, and a path reads from the working directory.
  const deckFile = options.into !== undefined && options.into !== "-" ? String(options.into) : output !== "-" ? output : undefined;
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
  const source = options.into ? await cli.readDeck(String(options.into), true) : undefined;
  const title = options.title ?? "Imported data";
  // Everything that shapes the imported content, so the same import always names its slide the same way.
  const settings = { as: options.as, format, header: !options["no-header"], delimiter: options.delimiter, columns, category: options.category, series, chartType, dataset: datasetId };
  let document: unknown;
  if (source) {
    if (options.path) {
      const parts = parsePointer(options.path as string);
      if (parts.at(-1) !== options.as) throw cli.fail("--path must end in /table or /chart matching --as.");
      document = applyPatch(withDataset(source.value), [{ op: "add", path: options.path as string, value: "table" in content ? content.table : content.chart }]);
    } else {
      const slides = isRecord(source.value) && Array.isArray(source.value.slides) ? source.value.slides : [];
      const taken = new Set(slides.flatMap((slide: unknown) => isRecord(slide) && typeof slide.id === "string" ? [slide.id] : []));
      let id: string;
      if (options.id !== undefined) {
        id = String(options.id);
        if (taken.has(id)) throw cli.fail(`The deck already has a slide with id "${id}". Choose another --id, or omit it to derive one.`, 1);
      } else id = freeSlideId(importSlideId(raw, settings), taken);
      document = applyPatch(withDataset(source.value), [{ op: "add", path: "/slides/-", value: { id, title, ...content } }]);
    }
  } else document = withDataset({ slides: [{ id: options.id !== undefined ? String(options.id) : "data-1", title, ...content }] });
  const sameFile = source && options.into !== "-" && output !== "-" && samePath(String(options.into), output);
  await cli.emit(document, output, options, sameFile ? { file: String(options.into), raw: source.raw } : undefined, {}, source, outFlag ?? null);
}
