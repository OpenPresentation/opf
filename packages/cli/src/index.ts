import { readFile, writeFile, lstat, link, rename, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { createDataContent, OPFDataImportError, paginatePresentation, catalogEntries, schemaEntries, validatePresentation } from "@openpresentation/opf";
import { applyPatch, lookup, tokens, PatchError } from "./patch.js";

declare const CLI_VERSION: string;
declare const OPF_VERSION: string;
const usage = `OPF — local presentation files for agents (Node 20+)
  opf create [output.opf.json|-] [--title <text>] [--from <file|->] [--force]
  opf validate <file|-> [--strict]
  opf edit <file|-> --patch <patch.json|-> [--output <file|-> | --in-place]
           [--dry-run] [--expect-sha256 <hash>] [--force] [--strict]
  opf import-data <data.csv|data.json|-> --as <table|chart> [--format <csv|tsv|json>]
           [--into <deck>] [--path </slides/0/table>] [--output <file|-> | --in-place]
           [--category <column>] [--series <JSON-array>] [--columns <JSON-array>]
           [--chart-type <id>] [--no-header] [--delimiter <character>] [--title <text>]
           [--force] [--strict]
  opf paginate <input|-> <output|-> [--force] [--strict]
  opf schemas
  opf schema [name] [JSON-Pointer]
  opf catalogs
  opf catalog <kind> [id]
  opf --version

JSON reports; '-' reads stdin or writes a document to stdout. Diagnostics for
stdout documents go to stderr. Existing files require --force or --in-place.
Edits apply JSON Patch (add/remove/replace/move/copy/test), validate the whole
result, and save atomically. --dry-run emits the result without saving.
Exit codes: 0 success, 1 invalid document/patch/conflict, 2 usage/JSON/I/O error.
Validation checks structure and references, not visual fidelity.`;
class CliError extends Error {
  constructor(message: string, readonly code = 2, readonly details?: unknown) { super(message); }
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const print = (value: unknown) => process.stdout.write(json(value));
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const valueOptions = new Set(["title", "from", "patch", "output", "expect-sha256", "as", "format", "into", "path", "category", "series", "columns", "chart-type", "delimiter"]);
function parse(args: string[], allowed: string[]) {
  const positional: string[] = [], options: Record<string, string | boolean> = Object.create(null);
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--" && !literal) { literal = true; continue; }
    if (!literal && arg.startsWith("--")) {
      const key = arg.slice(2);
      if (!allowed.includes(key) || key in options) throw new CliError(`Unknown or duplicate option: ${arg}`);
      if (valueOptions.has(key)) {
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
async function save(file: string, document: unknown, overwrite: boolean, original?: { file: string; raw: string }) {
  const output = path.resolve(file), temporary = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.tmp`);
  let mode: number | undefined;
  try {
    const stat = await lstat(output);
    if (!overwrite) throw new CliError(`Output already exists: ${file}. Use --force.`, 1);
    if (!stat.isFile()) throw new CliError("Refusing to replace a symlink or non-regular file.", 1);
    mode = stat.mode;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  try {
    await writeFile(temporary, json(document), { flag: "wx", mode });
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
async function main(argv: string[]) {
  if (!argv.length || (argv.length === 1 && ["help", "--help", "-h"].includes(argv[0]))) { console.log(usage); return; }
  if (argv.length === 1 && argv[0] === "--version") { print({ cli: CLI_VERSION, opf: OPF_VERSION }); return; }
  const [command, ...args] = argv;
  if (args.length === 1 && args[0] === "--help") { console.log(usage); return; }
  if (command === "create") {
    const { positional, options } = parse(args, ["title", "from", "force", "strict"]); arity(positional, 0, 1);
    if (options.from && options.title !== undefined) throw new CliError("Use --from or --title, not both.");
    const document = options.from ? (await readJson(String(options.from))).value : {
      $schema: "https://openpresentation.org/schema/opf/v1", name: options.title ?? "Untitled presentation",
      slides: [{ id: "slide-1", title: options.title ?? "Untitled presentation" }],
    };
    await emit(document, positional[0] ?? "-", options); return;
  }
  if (command === "validate") {
    const { positional, options } = parse(args, ["strict"]); arity(positional, 1);
    const { raw, value } = await readJson(positional[0]), result = validatePresentation(value);
    print({ ...result, sha256: hash(raw) });
    if (!result.valid || (options.strict && result.warnings.length)) process.exitCode = 1;
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
  if (command === "import-data") {
    const { positional, options } = parse(args, ["as", "format", "into", "path", "output", "in-place", "category", "series", "columns", "chart-type", "no-header", "delimiter", "title", "force", "strict"]); arity(positional, 1);
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
    const content = createDataContent(raw, {as: options.as, format: format as 'csv'|'tsv'|'json'|undefined, header: !options['no-header'], delimiter: options.delimiter as string|undefined, columns:list('columns'), category:options.category as string|undefined, series:list('series'), chartType:options['chart-type'] as string|undefined});
    const source = options.into ? await readJson(String(options.into)) : undefined;
    let document: unknown;
    if (source) {
      if (options.path) {
        const parts = tokens(options.path);
        if (parts.at(-1) !== options.as) throw new CliError('--path must end in /table or /chart matching --as.');
        document = applyPatch(source.value, [{op:'add',path:options.path,value:'table' in content ? content.table : content.chart}]);
      } else document = applyPatch(source.value, [{op:'add',path:'/slides/-',value:{id:`data-${randomUUID()}`,title:options.title ?? 'Imported data',...content}}]);
    } else document = {slides:[{id:'data-1',title:options.title ?? 'Imported data',...content}]};
    const output = options['in-place'] ? String(options.into) : String(options.output ?? '-');
    const sameFile = source && options.into !== '-' && output !== '-' && path.resolve(String(options.into)) === path.resolve(output);
    await emit(document, output, options, sameFile ? {file:String(options.into),raw:source.raw} : undefined); return;
  }
  if (command === "paginate") {
    const { positional, options } = parse(args, ["force", "strict"]); arity(positional, 2);
    const source = await readJson(positional[0]); checked(source.value, !!options.strict);
    const result = paginatePresentation(source.value);
    await emit(result.presentation, positional[1], options, undefined, { pages: result.pages }); return;
  }
  if (command === "schemas") { arity(args, 0); print(schemaEntries.map(entry => ({ name: entry.name, file: entry.file, id: entry.schema.$id }))); return; }
  if (command === "catalogs") { arity(args, 0); print(catalogEntries.map(entry => ({ kind: entry.kind, count: entry.records.length }))); return; }
  if (command === "schema") {
    arity(args, 0, 2); const entry = schemaEntries.find(entry => entry.name === (args[0] ?? "presentation"));
    if (!entry) throw new CliError("Unknown schema. Run opf schemas.");
    print(lookup(entry.schema, tokens(args[1] ?? ""))); return;
  }
  if (command === "catalog") {
    arity(args, 1, 2); const entry = catalogEntries.find(entry => entry.kind === args[0]);
    if (!entry) throw new CliError("Unknown catalog. Run opf catalogs.");
    const result = args[1] === undefined ? entry.records : entry.records.find(record => record.id === args[1]);
    if (!result) throw new CliError(`Unknown ${args[0]} id: ${args[1]}`);
    print(result); return;
  }
  throw new CliError(`Unknown command: ${command}. Run opf --help.`);
}
main(process.argv.slice(2)).catch((error: unknown) => {
  const code = error instanceof PatchError || error instanceof OPFDataImportError ? 1 : error instanceof CliError ? error.code : 2;
  process.stderr.write(json({ error: error instanceof Error ? error.message : String(error), ...(error instanceof CliError && error.details ? { validation: error.details } : {}) }));
  process.exitCode = code;
});
