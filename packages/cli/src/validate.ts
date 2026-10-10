// `opf validate`: the one checker (format, references, policy, accessibility, layout, content). It reads each file as strict
// JSON text, so syntax errors and duplicate keys come back with line and column, or as YAML or a Markdown deck (by the name or
// --from), with every finding located in the text. RR-75: several files, directories (their *.opf.json, *.opf.yaml, *.opf.yml
// and *.opf.md, sorted) and `-` in one run; the exit status is the worst of them; `--format github` prints workflow annotations.
// `--list-rules` lists what it can report.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { type Finding, type FindingSeverity, type ValidateOptions, type ValidationReport, type ValidationRuleInfo, findValidationRule, validationCategories, validationRules } from "@openpresentation/opf";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { cliCatalogs } from "./catalogs.js";
import { reaches } from "./check.js";
import { checkText, deckFormatFlag, inputFormatOf } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { json, readText, sha256 } from "./io.js";
import { type Host, countsOf, failOnOf } from "./runtime.js";

export const spec: CommandSpec = {
	name: "validate",
	usage: ["opf validate <file|dir|->... [--from <format>] [--config <file>] [--only <list>] [--ignore <list>] [--fail-on <level>] [--format <json|text|github>]", "opf validate --list-rules [--format <json|text>]"],
	summary: "Check decks: format, references, policy, accessibility, layout and content.",
	operands: ["<file|dir|-> (decks, folders of decks, or - for stdin)"],
	positional: [0, Number.POSITIVE_INFINITY],
	values: ["from", "config", "fail-on", "format"],
	repeated: ["only", "ignore"],
	flags: ["list-rules"],
	help: `The one checker. Findings have stable rule ids (opf/text-contrast), a severity, a category and a JSON Pointer path; read from a
file they carry line and column. Only format, references and policy produce errors by default, so "valid" keeps meaning
correct OPF. A folder is searched (sorted, skipping node_modules and dot folders) for *.opf.json, *.opf.yaml, *.opf.yml and
*.opf.md. --only runs just these rules or categories (full ids, bare names or category names, comma-separated or repeated);
--ignore skips them. --fail-on picks the exit threshold (default error). A --config JSON file may hold {catalogs, contracts,
severity, only, ignore, ignorePaths, thresholds, chartPalette}; --only replaces its only and --ignore adds to its ignore.
--format json (the default) prints one input's report { command, ok, input, valid, schemaValid, findings, counts, checks, file,
sha256, ... }, or for several { command, ok, files: [reports], counts }; text prints a line per finding; github prints
::error/::warning/::notice workflow annotations. Exit codes: 0 no finding at or above --fail-on, 1 findings at or above it (or
a file that is not valid JSON, YAML or Markdown), 2 usage, configuration or I/O error; the worst over every file. Validate is
read-only and local; it never fetches images, fonts or catalogs.

Examples:
  opf validate deck.opf.json
  opf validate decks/ --format github --fail-on warning`,
};

const list = (values: string[] | undefined) => (values ?? []).flatMap((value) => value.split(",")).map((entry) => entry.trim()).filter(Boolean);
const row = (rule: ValidationRuleInfo) => `${rule.id.padEnd(34)} ${rule.category.padEnd(14)} ${rule.severity.padEnd(8)} ${rule.cost.padEnd(12)} ${rule.summary}`;
type Located = Finding & { location?: { line: number; column: number } };

/** The human reporter: one line per finding, `file:line:column  severity  rule  message`, a hint under it, a summary at the end. */
export function formatText(report: ValidationReport, file: string): string {
	const lines: string[] = [];
	for (const d of report.findings as Located[]) {
		const where = d.location ? `${file}:${d.location.line}:${d.location.column}` : `${file}:${d.path || "/"}`;
		lines.push(`${where}  ${d.severity.padEnd(7)} ${d.ruleId}  ${d.message}`);
		lines.push(`    ${d.path || "(document)"}${d.slide !== undefined ? `  (slide ${d.slide + 1})` : ""}`);
		if (d.help) lines.push(`    hint: ${d.help}`);
		for (const fix of d.fixes ?? []) lines.push(`    fix: ${fix.title}${fix.safe === false ? " (changes meaning; review)" : ""}`);
	}
	const { error, warning, info } = report.counts;
	const ran = (["syntax", "schema", "references", "policy", "accessibility", "content"] as const).filter((key) => report.checks[key] === "checked");
	if (report.checks.layout !== "not-run") ran.push(`layout (${report.checks.layout})` as never);
	if (report.schemaValid === false) lines.push("", "The document does not pass the schema, so no accessibility, layout or content rule was run.");
	// A blank line separates the findings from the summary; a report with none is just the summary.
	if (lines.length) lines.push("");
	lines.push(`${file}: ${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} (${error} error${error === 1 ? "" : "s"}, ${warning} warning${warning === 1 ? "" : "s"}, ${info} info). Checked: ${ran.join(", ") || "nothing"}.`);
	return `${lines.join("\n")}\n`;
}

/** GitHub workflow commands, one per finding: `::error file=deck.opf.json,line=3,col=5,title=opf/rule::message`. */
export function formatGithub(report: ValidationReport, file: string): string {
	const level: Record<FindingSeverity, string> = { error: "error", warning: "warning", info: "notice" };
	const escapeData = (text: string) => text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
	const escapeProperty = (text: string) => escapeData(text).replace(/:/g, "%3A").replace(/,/g, "%2C");
	return (report.findings as Located[])
		.map((d) => {
			const where = [`file=${escapeProperty(file)}`, ...(d.location ? [`line=${d.location.line}`, `col=${d.location.column}`] : []), `title=${escapeProperty(d.ruleId)}`].join(",");
			const message = `${d.message}${d.location ? "" : ` (at ${d.path || "/"})`}${d.help ? ` Hint: ${d.help}` : ""}`;
			return `::${level[d.severity]} ${where}::${escapeData(message)}\n`;
		})
		.join("");
}

const CONFIG_KEYS = ["catalogs", "contracts", "severity", "only", "ignore", "ignorePaths", "thresholds", "chartPalette"];

function loadConfig(raw: string, file: string): ValidateOptions {
	let value: unknown;
	try {
		value = JSON.parse(raw.replace(/^\uFEFF/, ""));
	} catch {
		throw usage(`Invalid JSON in ${file}.`, "invalid-config");
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw usage("The validate configuration must be a JSON object.", "invalid-config");
	for (const key of Object.keys(value)) if (!CONFIG_KEYS.includes(key)) throw usage(`Unknown validate configuration key ${JSON.stringify(key)}. Keys: ${CONFIG_KEYS.join(", ")}.`, "invalid-config");
	return value as ValidateOptions;
}

function checkNames(names: string[], what: string) {
	for (const name of names) {
		if (!(validationCategories as readonly string[]).includes(name) && !findValidationRule(name)) throw usage(`Unknown rule or category ${JSON.stringify(name)} in ${what}. Run opf validate --list-rules.`, "invalid-value");
	}
}

const DECK_FILE = /\.opf\.(json|ya?ml|md)$/i;

/** The deck files of a folder, recursively, sorted by path; node_modules and dot folders are skipped. */
async function deckFiles(directory: string): Promise<string[]> {
	const found: string[] = [];
	const walk = async (folder: string) => {
		const entries = (await readdir(folder, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
		for (const entry of entries) {
			const file = path.join(folder, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "node_modules" && !entry.name.startsWith(".")) await walk(file);
			} else if (entry.isFile() && DECK_FILE.test(entry.name)) found.push(file);
		}
	};
	await walk(directory);
	return found;
}

/** The inputs: files as given, folders expanded, `-` once. */
async function expand(inputs: string[]): Promise<string[]> {
	const files: string[] = [];
	for (const input of inputs) {
		if (input === "-") {
			files.push(input);
			continue;
		}
		let isDirectory = false;
		try {
			isDirectory = (await stat(input)).isDirectory();
		} catch {
			// A missing file is reported when it is read.
		}
		if (!isDirectory) files.push(input);
		else {
			const found = await deckFiles(input);
			if (!found.length) throw usage(`${input} holds no deck files (*.opf.json, *.opf.yaml, *.opf.yml or *.opf.md).`, "no-input-files", { file: input });
			files.push(...found);
		}
	}
	if (files.filter((file) => file === "-").length > 1) throw usage("stdin can supply only one input.");
	return files;
}

/** Run `opf validate`. Prints the report (or the rule list) and sets the exit code; usage errors are thrown for the caller to print. */
export async function run(args: string[], host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options, repeated } = parsed;
	const format = oneOf("--format", options.format, ["json", "text", "github"] as const) ?? "json";
	if (options["list-rules"]) {
		if (positional.length || Object.keys(options).some((key) => key !== "list-rules" && key !== "format") || Object.keys(repeated).length) throw usage("--list-rules takes no file and no other option except --format.");
		if (format === "github") throw usage("--list-rules prints json or text.", "invalid-value", { option: "--format" });
		process.stdout.write(format === "json" ? json(validationRules) : `${validationRules.map(row).join("\n")}\n`);
		return;
	}
	if (!positional.length) throw usage(`opf validate needs a file, a folder or - for stdin. Usage:\n  ${spec.usage[0]}`, "missing-argument");
	const failOn = failOnOf(options);
	const from = deckFormatFlag("--from", options.from);
	const configFile = options.config === undefined ? undefined : String(options.config);
	if (configFile === "-") throw usage("The validate configuration must be an explicit local JSON file.", "invalid-config");
	const configRaw = configFile ? await readFile(configFile, "utf8").catch((error: unknown) => Promise.reject(usage(`Cannot read ${configFile}: ${(error as Error).message}`, "invalid-config"))) : undefined;
	const settings: ValidateOptions = configRaw ? loadConfig(configRaw, configFile as string) : {};
	// The CLI registers the default catalog after any catalog the configuration names (the first is the host default).
	if (settings.catalogs !== undefined && !Array.isArray(settings.catalogs)) throw usage("The validate configuration's catalogs must be an array of catalogs: { source, <kind>: { <id>: record } }.", "invalid-config");
	settings.catalogs = cliCatalogs(settings.catalogs ?? []);
	const only = list(repeated.only);
	const ignore = list(repeated.ignore);
	checkNames([...only, ...ignore], "--only or --ignore");
	if (repeated.only) settings.only = only;
	if (ignore.length) settings.ignore = [...(settings.ignore ?? []), ...ignore];
	const files = await expand(positional);
	const context = configFile ? { context: { file: path.resolve(configFile), sha256: sha256(configRaw as string) } } : {};

	const reports: Record<string, unknown>[] = [];
	const texts: string[] = [];
	let exit = 0;
	for (const file of files) {
		const label = file === "-" ? "stdin" : path.relative(process.cwd(), path.resolve(file)).split(path.sep).join("/") || file;
		let raw: string;
		let report: ValidationReport;
		try {
			raw = await readText(file);
			try {
				report = checkText(raw, inputFormatOf(file, raw, from), settings).report;
			} catch (error) {
				if (error instanceof TypeError) throw usage(error.message, "invalid-config");
				throw error;
			}
		} catch (error) {
			// One file that cannot be read fails the run (exit 2), and the others are still checked.
			if (files.length === 1 || !(error instanceof CliError)) throw error;
			exit = 2;
			reports.push({ command: "validate", ok: false, input: { file: file === "-" ? "-" : path.resolve(file) }, file: file === "-" ? null : path.resolve(file), code: error.code, error: error.message });
			if (format !== "json") process.stderr.write(`${label}: ${error.message}\n`);
			continue;
		}
		const ok = !reaches(report.findings, failOn);
		if (!ok && exit < 1) exit = 1;
		const input = { file: file === "-" ? "-" : path.resolve(file), sha256: sha256(raw), bytes: Buffer.byteLength(raw) };
		const { findings, counts, ...rest } = report;
		reports.push({ command: "validate", ok, input, outputs: [], findings, counts, ...rest, file: file === "-" ? null : path.resolve(file), sha256: sha256(raw), opfVersion: host.opfVersion, ...context });
		texts.push(format === "github" ? formatGithub(report, label) : formatText(report, label));
	}
	if (format === "json") {
		if (files.length === 1) process.stdout.write(json(reports[0]));
		else {
			const findings = reports.flatMap((report) => (report.findings as Finding[] | undefined) ?? []);
			process.stdout.write(json({ command: "validate", ok: exit === 0, files: reports, counts: countsOf(findings), opfVersion: host.opfVersion }));
		}
	} else process.stdout.write(texts.join(format === "text" && texts.length > 1 ? "\n" : ""));
	process.exitCode = Math.max(Number(process.exitCode ?? 0), exit);
}
