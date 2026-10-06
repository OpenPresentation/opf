import { readFile, writeFile, lstat, link, rename, unlink, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { createDataContent, OPFDataImportError, paginatePresentation, bundlePresentation, catalogEntries, schemaEntries, validatePresentation, lintSource, type LintOptions } from "@openpresentation/opf";
import { applyPatch, getAtPointer, parsePointer, PatchError } from "@openpresentation/opf/patch";
import { diffCommand } from "./diff.js";
import { mergeCommand } from "./merge.js";
import { formatCommand } from "./format.js";
import { statsCommand } from "./stats.js";
import type { CliContext } from "./context.js";
import {manageSkills, SkillsError, type SkillBundle} from './skills.js';
import {markdownCommand, MARKDOWN_USAGE, MARKDOWN_HELP} from './markdown.js';
import {runRenderCommand} from './render.js';
import {runImportCommand} from './import.js';
import {runAudit} from './audit.js';
import {combineDecks, deckNames, fillRecords, recordsFromData, summarizeDiagnostics, type FillRecord} from './fill.js';

declare const CLI_VERSION: string;
declare const OPF_VERSION: string;
declare const OPF_SKILLS: SkillBundle;
const usage = `OPF — local presentation files for agents (Node 24)
  opf create [output.opf.json|-] [--title <text>] [--from <file|->] [--force]
  opf validate <file|-> [--strict]
  opf lint <file|-> [--config <local-json-file>] [--strict]
  opf audit <file|-> [--json] [--rule <id>] [--ignore <id>] [--fail-on <error|warning|info|never>] [--config <file>]
           (design and accessibility checks; opf audit --help, --list-rules)
  opf edit <file|-> --patch <patch.json|-> [--output <file|-> | --in-place]
           [--dry-run] [--expect-sha256 <hash>] [--force] [--strict]
  opf diff <a|-> <b|-> [--format <text|json|patch>] [--exit-code] [--threshold <0-1>]
  opf merge <base> <ours> <theirs> [--output <file|-> | --in-place] [--force] [--prefer <ours|theirs>]
           [--report <file>] [--dry-run] [--threshold <0-1>] [--strict]
  opf format <file|->... [--check | --in-place | --output <file|->]
           [--indent <0-8>] [--eol <lf|crlf|preserve>]
  opf stats <file|-> [--format <json|text>] [--per-slide]
  opf import-data <data.csv|data.json|-> --as <table|chart> [--format <csv|tsv|json>]
           [--into <deck>] [--path </slides/0/table>] [--output <file|-> | --in-place]
           [--category <column>] [--series <JSON-array>] [--columns <JSON-array>]
           [--chart-type <id>] [--no-header] [--delimiter <character>] [--title <text>]
           [--dataset <id>] [--force] [--strict]
  opf fill <template.opf.json|-> [--data <values.json|data.csv|data.tsv|->] [--format <csv|tsv|json>]
           [--delimiter <character>] [--no-header] [--output <file|-> | --out-dir <dir> [--name <pattern>]
           | --combine --output <file|->] [--partial] [--examples] [--force] [--strict]
  opf paginate <input|-> <output|-> [--force] [--strict]
  opf bundle <input|-> <output|-> [--force] [--strict]
${MARKDOWN_USAGE}
  opf render <file|-> [--slides <1,3-5>] [--format <svg|png>] [--scale <0.1-8>] [--out <directory|file|->]
           [--paginate] [--date <YYYY-MM-DD>] [--font-dir <directory>]... [--asset-dir <directory>] [--force] [--strict] [--json]
  opf export <file|-> [--format <pptx|pdf|png|svg>] [--out <file|directory|.zip|->] [--slides <1,3-5>]
           [--pdf-mode <vector|raster>] [--chartex <auto|native|fallback>] [--provenance <full|references-only|none>]
           [--image-format <compatible|preserve>] [--scale <0.1-8>] [--svg-fonts <used|none>] [--paginate]
           [--date <YYYY-MM-DD>] [--font-dir <directory>]... [--asset-dir <directory>] [--force] [--strict] [--json]
  opf import <deck.pptx|-> [--out <file|->] [--signals <signals.json>] [--force] [--strict] [--json]
  opf schemas
  opf schema [name] [JSON-Pointer]
  opf catalogs
  opf catalog <kind> [id] [--all]
  opf skills <install|update|status> [--agent <universal|codex|claude-code|cursor>]
             [--global | --directory <skills-directory>]
  opf --version

JSON reports; '-' reads stdin or writes a document to stdout. Diagnostics for
stdout documents go to stderr. Existing files require --force or --in-place.
Edits apply JSON Patch (add/remove/replace/move/copy/test), validate the whole
result, and save atomically. --dry-run emits the result without saving.
Exit codes: 0 success, 1 invalid document/patch/conflict, 2 usage/JSON/I/O error.
Validation checks structure and references, not visual fidelity.
Diff matches slides by id, then content, and reports adds, removes, moves and
field/design/metadata changes plus a JSON Patch from A to B (--exit-code exits 1
when they differ). Merge combines two edits of a base; non-overlapping changes
merge, conflicts are listed (exit 1, nothing written) unless --prefer picks a
side. Format rewrites a file with canonical key order and layout; --check
exits 1 if any file would change.
Stats reports neutral facts about a deck (structure, words, notes, images, charts, tables, datasets,
citations, variables, assets, fonts, an estimated speaking time) without validating, composing or loading
fonts; it never rates anything. --per-slide adds a row per slide.
Bundle inlines the bundled catalog records a document references (kinds with a
custom source are left untouched) so the file resolves every catalog reference
offline. Remote media and data assets are not inlined.
Fill resolves a template's variables ({{id}} tokens and var:id references) with one
record per data row (CSV/TSV/JSON array) or one JSON object: one deck per record
with --out-dir (names from --name, default deck-{n}; {n} is the index and {column}
a slug of that column's value), one combined deck with --combine, or a single deck.
Blank cells use the variable's declared value. An unfilled required variable fails
unless --partial; --examples fills unfilled variables from their example.
Lint adds source locations, contextual suggestions and explicit host contracts.
Lint syntax/schema/policy errors exit 1; --strict also rejects warnings.
Render, export and import write files through the optional peers @openpresentation/opf-render
and @openpresentation/opf-pptx (install them next to the CLI; the error names the command to run).
They lint the document first, print the lint report shape (diagnostics, counts) plus the written
files with SHA-256 digests, never load system fonts and never fetch URLs; --strict writes nothing
when there are warnings. Existing outputs require --force.
Audit reports design and accessibility findings (contrast, overflow, alt text, reading order,
fonts, ...) with stable rule ids; it exits 1 for findings at or above --fail-on (default error).

${MARKDOWN_HELP}

Install all six bundled OPF agent skills in this project:
  npx @openpresentation/cli@latest skills install
Skills copy locally without symlinks, paid services or telemetry. Updates refuse
locally modified/unmanaged skill folders and keep previous managed versions.`;
class CliError extends Error {
  constructor(message: string, readonly code = 2, readonly details?: unknown) { super(message); }
}
const isDeprecated = (record: object) => "deprecation" in record && !!(record as { deprecation?: unknown }).deprecation;
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const print = (value: unknown) => process.stdout.write(json(value));
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const valueOptions = new Set(["title", "from", "patch", "output", "expect-sha256", "as", "format", "into", "path", "category", "series", "columns", "chart-type", "delimiter", "agent", "directory", "config", "data", "out-dir", "name"]);
const extraValueOptions = new Set(["prefer", "threshold", "report", "indent", "eol", "dataset"]);
function parse(args: string[], allowed: string[]) {
  const positional: string[] = [], options: Record<string, string | boolean> = Object.create(null);
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--" && !literal) { literal = true; continue; }
    if (!literal && arg.startsWith("--")) {
      const key = arg.slice(2);
      if (!allowed.includes(key) || key in options) throw new CliError(`Unknown or duplicate option: ${arg}`);
      if (valueOptions.has(key) || extraValueOptions.has(key)) {
        const value = args[++i];
        if (value === undefined || value.startsWith("--")) throw new CliError(`${arg} needs a value.`);
        options[key] = value;
      } else options[key] = true;
    } else positional.push(arg);
  }
  return { positional, options };
}
function arity(args: string[], min: number, max = min) {
  if (args.length < min || args.length > max) throw new CliError("Incorrect arguments. Run opf --help.");
}
async function stdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
async function readJson(file: string) {
  const raw = file === "-" ? await stdin() : await readFile(file, "utf8");
  try { return { raw, value: JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown }; }
  catch { throw new CliError(`Invalid JSON in ${file === "-" ? "stdin" : file}.`); }
}
function checked(value: unknown, strict = false) {
  const result = validatePresentation(value);
  if (!result.valid || (strict && result.warnings.length)) throw new CliError("Document validation failed.", 1, result);
  return result;
}
async function save(file: string, document: unknown, overwrite: boolean, original?: { file: string; raw: string }) { await saveText(file, json(document), overwrite, original); }
async function saveText(file: string, text: string, overwrite: boolean, original?: { file: string; raw: string }) {
  const output = path.resolve(file), temporary = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.tmp`);
  let mode: number | undefined;
  try {
    const stat = await lstat(output);
    if (!overwrite) throw new CliError(`Output already exists: ${file}. Use --force.`, 1);
    if (!stat.isFile()) throw new CliError("Refusing to replace a symlink or non-regular file.", 1);
    mode = stat.mode;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  try {
    await writeFile(temporary, text, { flag: "wx", mode });
    if (original && await readFile(original.file, "utf8") !== original.raw) throw new CliError("Input changed while editing; reread it and retry.", 1);
    if (overwrite) await rename(temporary, output);
    else {
      // A link publishes a complete file without replacing an output created concurrently.
      try { await link(temporary, output); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new CliError(`Output already exists: ${file}.`, 1); throw error; }
    }
  } finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}
async function emit(document: unknown, output: string, options: Record<string, string | boolean>, original?: { file: string; raw: string }, extra = {}) {
  const validation = checked(document, !!options.strict);
  if (output === "-" || options["dry-run"]) {
    print(document);
    process.stderr.write(json({ valid: true, warnings: validation.warnings, dryRun: !!options["dry-run"], ...extra }));
  } else {
    await save(output, document, !!options.force || !!options["in-place"], original);
    print({ valid: true, output: path.resolve(output), sha256: hash(json(document)), warnings: validation.warnings, ...extra });
  }
}
const cli: CliContext = { parse, arity, readJson, stdin, emit, saveText, print, hash, json, fail: (message, code = 2, details) => new CliError(message, code, details) };
async function main(argv: string[]) {
  if (!argv.length || (argv.length === 1 && ["help", "--help", "-h"].includes(argv[0]))) { console.log(usage); return; }
  if (argv.length === 1 && argv[0] === "--version") { print({ cli: CLI_VERSION, opf: OPF_VERSION }); return; }
  const [command, ...args] = argv;
  if (command === 'audit') { await runAudit(args); return; }
  if (args.length === 1 && args[0] === "--help") { console.log(usage); return; }
  if (command === 'from-md' || command === 'to-md') { await markdownCommand(command, args); return; }
  if (command === 'skills') {
    const {positional,options}=parse(args,['agent','global','directory']);arity(positional,1);
    print(await manageSkills(positional[0],OPF_SKILLS,CLI_VERSION,{agent:options.agent as string|undefined,global:!!options.global,directory:options.directory as string|undefined}));return;
  }
  if (command === 'render' || command === 'export') { await runRenderCommand(command, args, {cliVersion: CLI_VERSION, opfVersion: OPF_VERSION}); return; }
  if (command === 'import') { await runImportCommand(args, {cliVersion: CLI_VERSION, opfVersion: OPF_VERSION}); return; }
  if (command === "create") {
    const { positional, options } = parse(args, ["title", "from", "force", "strict"]); arity(positional, 0, 1);
    if (options.from && options.title !== undefined) throw new CliError("Use --from or --title, not both.");
    const document = options.from ? (await readJson(String(options.from))).value : {
      $schema: "https://openpresentation.org/schema/opf/v1", name: options.title ?? "Untitled presentation",
      slides: [{ id: "slide-1", title: options.title ?? "Untitled presentation" }],
    };
    await emit(document, positional[0] ?? "-", options, undefined, {agentSkills:'npx @openpresentation/cli@latest skills install'}); return;
  }
  if (command === "validate") {
    const { positional, options } = parse(args, ["strict"]); arity(positional, 1);
    const { raw, value } = await readJson(positional[0]), result = validatePresentation(value);
    print({ ...result, sha256: hash(raw) });
    if (!result.valid || (options.strict && result.warnings.length)) process.exitCode = 1;
    return;
  }
  if (command === 'lint') {
    const { positional, options } = parse(args, ['config', 'strict']);
    arity(positional, 1);
    const input = positional[0];
    if (!input) throw new CliError('Lint requires a file or stdin (-).');
    if (options.config === '-') throw new CliError('Lint configuration must be an explicit local JSON file.');
    const raw = input === '-' ? await stdin() : await readFile(input, 'utf8');
    const config = options.config ? await readJson(String(options.config)) : undefined;
    const result = lintSource(raw, config?.value as LintOptions | undefined);
    print({
      ...result, sha256: hash(raw), opfVersion: OPF_VERSION,
      ...(config ? { context: { file: path.resolve(String(options.config)), sha256: hash(config.raw) } } : {}),
    });
    if (!result.valid || (options.strict && result.counts.warning)) process.exitCode = 1;
    return;
  }
  if (command === "edit") {
    const { positional, options } = parse(args, ["patch", "output", "in-place", "dry-run", "expect-sha256", "force", "strict"]); arity(positional, 1);
    const input = positional[0];
    if (!options.patch) throw new CliError("edit requires --patch <file|->.");
    if (input === "-" && (options.patch === "-" || options["in-place"])) throw new CliError("stdin can supply only one input and cannot be edited in place.");
    if (options["in-place"] && (options.output !== undefined || options.force)) throw new CliError("--in-place cannot be combined with --output or --force.");
    const source = await readJson(input);
    if (options["expect-sha256"] !== undefined) {
      if (!/^[a-fA-F0-9]{64}$/.test(String(options["expect-sha256"]))) throw new CliError("--expect-sha256 needs a SHA-256 hex digest.");
      if (hash(source.raw) !== String(options["expect-sha256"]).toLowerCase()) throw new CliError("Input hash mismatch; reread the file before editing.", 1);
    }
    const document = applyPatch(source.value, (await readJson(String(options.patch))).value);
    const output = options["in-place"] ? input : String(options.output ?? "-");
    const sameFile = input !== "-" && output !== "-" && path.resolve(input) === path.resolve(output);
    await emit(document, output, options, sameFile ? { file: input, raw: source.raw } : undefined); return;
  }
  if (command === "diff") { await diffCommand(args, cli); return; }
  if (command === "merge") { await mergeCommand(args, cli); return; }
  if (command === "format") { await formatCommand(args, cli); return; }
  if (command === "stats") { await statsCommand(args, cli); return; }
  if (command === "import-data") {
    const { positional, options } = parse(args, ["as", "format", "into", "path", "output", "in-place", "category", "series", "columns", "chart-type", "no-header", "delimiter", "title", "dataset", "force", "strict"]); arity(positional, 1);
    if (options.as !== 'table' && options.as !== 'chart') throw new CliError('import-data requires --as table or --as chart.');
    if (options.path && !options.into) throw new CliError('--path requires --into <deck>.');
    if (options["in-place"] && (!options.into || options.into === '-' || options.output !== undefined || options.force)) throw new CliError('--in-place requires a file --into and cannot combine with --output or --force.');
    if (options.into === '-' && positional[0] === '-') throw new CliError('stdin can supply only one input.');
    const list = (key: string): string[] | undefined => {
      if (options[key] === undefined) return undefined;
      let value: unknown; try { value = JSON.parse(String(options[key])); } catch { throw new CliError(`--${key} requires a JSON array of column names.`); }
      if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new CliError(`--${key} requires a JSON array of column names.`);
      return value;
    };
    const format = options.format ?? (positional[0].endsWith('.json') ? 'json' : positional[0].endsWith('.tsv') ? 'tsv' : undefined);
    if (format !== undefined && !['csv','tsv','json'].includes(String(format))) throw new CliError('Unknown data format.');
    const raw = positional[0] === '-' ? await stdin() : await readFile(positional[0], 'utf8');
    const imported = createDataContent(raw, {as: options.as, format: format as 'csv'|'tsv'|'json'|undefined, header: !options['no-header'], delimiter: options.delimiter as string|undefined, columns:list('columns'), category:options.category as string|undefined, series:list('series'), chartType:options['chart-type'] as string|undefined});
    // RR-54: --dataset <id> writes the data into the top-level datasets map (replacing that dataset's columns and rows,
    // keeping its title, description and source) and references it from the table or chart.
    const datasetId = options.dataset === undefined ? undefined : String(options.dataset);
    if (datasetId !== undefined && (options.dataset === true || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(datasetId))) throw new CliError('--dataset requires an id of letters, digits, ".", "_" or "-".');
    const data = 'table' in imported ? imported.table : imported.chart.data;
    const content = datasetId === undefined ? imported : 'table' in imported ? {table:{dataset:datasetId}} : {chart:{type:imported.chart.type,data:{dataset:datasetId}}};
    const withDataset = (deck: unknown): unknown => {
      if (datasetId === undefined) return deck;
      const record = deck && typeof deck === 'object' && !Array.isArray(deck) ? deck as Record<string, unknown> : {};
      const datasets = record.datasets && typeof record.datasets === 'object' && !Array.isArray(record.datasets) ? record.datasets as Record<string, unknown> : {};
      const previous = datasets[datasetId] && typeof datasets[datasetId] === 'object' ? datasets[datasetId] as Record<string, unknown> : {};
      const origin = positional[0] === '-' ? undefined : {src: positional[0].split(path.sep).join('/'), retrieved: new Date().toISOString().slice(0, 10)};
      // A column that keeps its name keeps its number format. The source describes the new origin only: its other
      // fields (sheet, range, description) survive a re-import of the same file, and data from stdin has none.
      const formats = new Map((Array.isArray(previous.columns) ? previous.columns : []).flatMap((column: unknown) => column && typeof column === 'object' && typeof (column as {name?: unknown}).name === 'string' && typeof (column as {format?: unknown}).format === 'string' ? [[(column as {name: string}).name, (column as {format: string}).format] as const] : []));
      const columns = data.columns.map(name => formats.has(name) ? {name, format: formats.get(name)!} : name);
      const before = previous.source && typeof previous.source === 'object' ? previous.source as Record<string, unknown> : {};
      const {source: _source, ...kept} = previous;
      const entry = {...kept, columns, rows: data.rows, ...(origin ? {source: before.src === origin.src ? {...before, ...origin} : origin} : {})};
      return {...record, datasets: {...datasets, [datasetId]: entry}};
    };
    const source = options.into ? await readJson(String(options.into)) : undefined;
    let document: unknown;
    if (source) {
      if (options.path) {
        const parts = parsePointer(options.path);
        if (parts.at(-1) !== options.as) throw new CliError('--path must end in /table or /chart matching --as.');
        document = applyPatch(withDataset(source.value), [{op:'add',path:options.path,value:'table' in content ? content.table : content.chart}]);
      } else document = applyPatch(withDataset(source.value), [{op:'add',path:'/slides/-',value:{id:`data-${randomUUID()}`,title:options.title ?? 'Imported data',...content}}]);
    } else document = withDataset({slides:[{id:'data-1',title:options.title ?? 'Imported data',...content}]});
    const output = options['in-place'] ? String(options.into) : String(options.output ?? '-');
    const sameFile = source && options.into !== '-' && output !== '-' && path.resolve(String(options.into)) === path.resolve(output);
    await emit(document, output, options, sameFile ? {file:String(options.into),raw:source.raw} : undefined); return;
  }
  if (command === "fill") {
    const { positional, options } = parse(args, ["data", "format", "delimiter", "no-header", "output", "out-dir", "name", "combine", "partial", "examples", "force", "strict"]); arity(positional, 1);
    if (options["out-dir"] !== undefined && (options.output !== undefined || options.combine)) throw new CliError("--out-dir cannot be combined with --output or --combine.");
    if (options.name !== undefined && options["out-dir"] === undefined) throw new CliError("--name requires --out-dir.");
    if (options.combine && options.output === undefined) throw new CliError("--combine requires --output <file|->.");
    if (positional[0] === "-" && options.data === "-") throw new CliError("stdin can supply only one input.");
    const template = (await readJson(positional[0])).value;
    let records: FillRecord[] = [{}];
    if (options.data !== undefined) {
      const data = String(options.data), raw = data === "-" ? await stdin() : await readFile(data, "utf8");
      const format = options.format ?? (data.endsWith(".json") ? "json" : data.endsWith(".tsv") ? "tsv" : data.endsWith(".csv") ? "csv" : /^[\s\uFEFF]*[\[{]/.test(raw) ? "json" : "csv");
      if (!["csv", "tsv", "json"].includes(String(format))) throw new CliError("Unknown data format.");
      records = recordsFromData(raw, format as "csv" | "tsv" | "json", { delimiter: options.delimiter as string | undefined, header: !options["no-header"] });
    }
    const decks = fillRecords(template, records, { template: false, partial: !!options.partial, examples: !!options.examples });
    const errors = decks.flatMap(deck => deck.diagnostics.filter(entry => entry.severity === "error").map(entry => ({ record: deck.index, ...entry })));
    if (errors.length) throw new CliError(`Filling failed: ${errors[0]?.message}`, 1, { errors });
    const fill = { records: decks.length, complete: decks.every(deck => deck.complete), unfilled: [...new Set(decks.flatMap(deck => deck.unfilled))], diagnostics: summarizeDiagnostics(decks) };
    if (options["out-dir"] !== undefined) {
      const dir = path.resolve(String(options["out-dir"])), names = deckNames(decks, options.name as string | undefined);
      const checks = decks.map(deck => checked(deck.presentation, !!options.strict));
      await mkdir(dir, { recursive: true });
      const outputs = [];
      for (const [offset, deck] of decks.entries()) {
        const output = path.join(dir, `${names[offset]}.opf.json`);
        await save(output, deck.presentation, !!options.force);
        outputs.push({ record: deck.index, output, sha256: hash(json(deck.presentation)), warnings: checks[offset]!.warnings });
      }
      print({ valid: true, outputs, ...fill }); return;
    }
    if (!options.combine && decks.length > 1) throw new CliError("Several records need --out-dir <dir> (one deck each) or --combine --output <file> (one deck).");
    await emit(options.combine ? combineDecks(decks) : decks[0]!.presentation, String(options.output ?? "-"), options, undefined, { fill }); return;
  }
  if (command === "paginate") {
    const { positional, options } = parse(args, ["force", "strict"]); arity(positional, 2);
    const source = await readJson(positional[0]); checked(source.value, !!options.strict);
    const result = paginatePresentation(source.value);
    await emit(result.presentation, positional[1], options, undefined, { pages: result.pages }); return;
  }
  if (command === "bundle") {
    const { positional, options } = parse(args, ["force", "strict"]); arity(positional, 2);
    const source = await readJson(positional[0]); checked(source.value, !!options.strict);
    const result = bundlePresentation(source.value);
    await emit(result.presentation, positional[1], options, undefined, { bundle: result.report }); return;
  }
  if (command === "schemas") { arity(args, 0); print(schemaEntries.map(entry => ({ name: entry.name, file: entry.file, id: entry.schema.$id }))); return; }
  if (command === "catalogs") {
    arity(args, 0);
    print(catalogEntries.map(entry => {
      const deprecated = entry.records.filter(isDeprecated).length;
      return { kind: entry.kind, count: entry.records.length - deprecated, ...(deprecated ? { deprecated } : {}) };
    }));
    return;
  }
  if (command === "schema") {
    arity(args, 0, 2); const entry = schemaEntries.find(entry => entry.name === (args[0] ?? "presentation"));
    if (!entry) throw new CliError("Unknown schema. Run opf schemas.");
    print(getAtPointer(entry.schema, args[1] ?? "")); return;
  }
  if (command === "catalog") {
    const { positional, options } = parse(args, ["all"]); arity(positional, 1, 2);
    const entry = catalogEntries.find(entry => entry.kind === positional[0]);
    if (!entry) throw new CliError("Unknown catalog. Run opf catalogs.");
    // Deprecated records stay resolvable by exact id but are left out of the
    // default listing; --all includes them.
    const records = entry.records;
    const result = positional[1] === undefined
      ? (options.all ? records : records.filter(record => !isDeprecated(record)))
      : records.find(record => record.id === positional[1]);
    if (!result) throw new CliError(`Unknown ${positional[0]} id: ${positional[1]}`);
    print(result); return;
  }
  throw new CliError(`Unknown command: ${command}. Run opf --help.`);
}
main(process.argv.slice(2)).catch((error: unknown) => {
  const code = error instanceof PatchError || error instanceof OPFDataImportError ? 1 : error instanceof CliError || error instanceof SkillsError ? error.code : 2;
  process.stderr.write(json({ error: error instanceof Error ? error.message : String(error), ...(error instanceof CliError && error.details ? { validation: error.details } : {}) }));
  process.exitCode = code;
});
