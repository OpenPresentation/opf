// `opf validate`: the one checker (format, references, policy, accessibility, layout, content). It reads the file as strict
// JSON text, so syntax errors and duplicate keys come back with line and column, or as YAML (a name ending .yaml/.yml, or
// --input-format yaml), with every finding located in the YAML, and prints the `validate` report as JSON or as one line
// per finding. `--list-rules` lists what it can report.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Finding, type ValidateOptions, type ValidationReport, type ValidationRuleInfo, findValidationRule, validationCategories, validationRules } from "@openpresentation/opf";
import { FAIL_ON_MESSAGE, parseFailOn, reaches } from "./check.js";
import { cliCatalogs } from "./catalogs.js";
import { checkText, inputFormatOf } from "./deck.js";

declare const OPF_VERSION: string;

export const VALIDATE_USAGE = `  opf validate <file|-> [--config <local-json-file>] [--only <list>] [--ignore <list>]
           [--fail-on <error|warning|info>] [--format <json|text>]
  opf validate --list-rules [--format <json|text>]`;

const usage = `${VALIDATE_USAGE}

The one checker for an OPF presentation: format (JSON syntax, duplicate keys, schema), references (catalog references,
assets, citations, datasets), policy (host contracts), accessibility, layout and content. Findings have stable rule ids
(opf/text-contrast), a severity, a category and a JSON Pointer path; with a file they carry line and column. Only format,
references and policy produce errors by default, so "valid"
keeps meaning correct OPF.
--only runs just these rules or categories (full ids, bare names or category names, comma-separated); --ignore skips them.
--fail-on picks the exit threshold (default error). A config file may hold {catalogs, contracts, severity, only, ignore,
ignorePaths, thresholds, chartPalette}; --only replaces the file's only and --ignore adds to its ignore.
Exit codes: 0 no finding at or above --fail-on, 1 findings at or above it (or a file that is not valid JSON or YAML), 2 usage,
configuration or I/O error. Validate is read-only and local; it never fetches images, fonts or catalogs.
A file ending .yaml or .yml (or stdin with --input-format yaml) is read as YAML; findings are located in it.`;

class ValidateUsageError extends Error {}

const valueFlags = new Set(["config", "only", "ignore", "fail-on", "format"]);
const booleanFlags = new Set(["list-rules"]);
// A list may be repeated as well as comma-separated: --only a --only b is --only a,b.
const repeatable = new Set(["only", "ignore"]);

interface Parsed {
	file?: string;
	flags: Map<string, string>;
}

function parse(args: string[]): Parsed {
	const flags = new Map<string, string>();
	const positional: string[] = [];
	let literal = false;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i] as string;
		if (arg === "--" && !literal) {
			literal = true;
			continue;
		}
		if (!literal && arg.startsWith("--")) {
			const key = arg.slice(2);
			if (flags.has(key) && !repeatable.has(key)) throw new ValidateUsageError(`Duplicate option: ${arg}`);
			if (booleanFlags.has(key)) flags.set(key, "");
			else if (valueFlags.has(key)) {
				const value = args[++i];
				if (value === undefined || value.startsWith("--")) throw new ValidateUsageError(`${arg} needs a value.`);
				flags.set(key, flags.has(key) ? `${flags.get(key)},${value}` : value);
			} else throw new ValidateUsageError(`Unknown option: ${arg}. Run opf validate --help.`);
		} else positional.push(arg);
	}
	if (positional.length > 1) throw new ValidateUsageError("Incorrect arguments. Run opf validate --help.");
	return { file: positional[0], flags };
}

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const list = (value: string | undefined) => (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);

async function stdin() {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks).toString("utf8");
}

const row = (rule: ValidationRuleInfo) => `${rule.id.padEnd(34)} ${rule.category.padEnd(14)} ${rule.severity.padEnd(8)} ${rule.cost.padEnd(12)} ${rule.summary}`;

/** The human reporter: one line per finding, `file:line:column  severity  rule  message`, a hint under it, a summary at the end. */
export function formatText(report: ValidationReport, file: string): string {
	const lines: string[] = [];
	for (const d of report.findings as (Finding & { location?: { line: number; column: number } })[]) {
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
	lines.push("", `${file}: ${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} (${error} error${error === 1 ? "" : "s"}, ${warning} warning${warning === 1 ? "" : "s"}, ${info} info). Checked: ${ran.join(", ") || "nothing"}.`);
	return `${lines.join("\n")}\n`;
}

const CONFIG_KEYS = ["catalogs", "contracts", "severity", "only", "ignore", "ignorePaths", "thresholds", "chartPalette"];

function loadConfig(raw: string, file: string): ValidateOptions {
	let value: unknown;
	try {
		value = JSON.parse(raw.replace(/^﻿/, ""));
	} catch {
		throw new ValidateUsageError(`Invalid JSON in ${file}.`);
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ValidateUsageError("The validate configuration must be a JSON object.");
	for (const key of Object.keys(value)) if (!CONFIG_KEYS.includes(key)) throw new ValidateUsageError(`Unknown validate configuration key ${JSON.stringify(key)}. Keys: ${CONFIG_KEYS.join(", ")}.`);
	return value as ValidateOptions;
}

function checkNames(names: string[], what: string) {
	for (const name of names) {
		if (!(validationCategories as readonly string[]).includes(name) && !findValidationRule(name)) throw new ValidateUsageError(`Unknown rule or category ${JSON.stringify(name)} in ${what}. Run opf validate --list-rules.`);
	}
}

/** Run `opf validate`. Prints the report (or the rule list) and sets the exit code; usage errors are thrown for the caller to print. */
export async function runValidate(args: string[]): Promise<void> {
	if (args.length === 1 && ["--help", "-h", "help"].includes(args[0] as string)) {
		console.log(usage);
		return;
	}
	const { file, flags } = parse(args);
	const format = flags.get("format") ?? "json";
	if (format !== "json" && format !== "text") throw new ValidateUsageError("--format must be json or text.");
	if (flags.has("list-rules")) {
		if (file !== undefined || [...flags.keys()].some((key) => key !== "list-rules" && key !== "format")) throw new ValidateUsageError("--list-rules takes no file and no other option except --format.");
		process.stdout.write(format === "json" ? `${JSON.stringify(validationRules, null, 2)}\n` : `${validationRules.map(row).join("\n")}\n`);
		return;
	}
	if (file === undefined) throw new ValidateUsageError("validate requires a file or stdin (-). Run opf validate --help.");
	const failOn = parseFailOn(flags.get("fail-on"));
	if (!failOn) throw new ValidateUsageError(FAIL_ON_MESSAGE);
	const configFile = flags.get("config");
	if (configFile === "-") throw new ValidateUsageError("The validate configuration must be an explicit local JSON file.");
	const configRaw = configFile ? await readFile(configFile, "utf8").catch((error: unknown) => { throw new ValidateUsageError(`Cannot read ${configFile}: ${(error as Error).message}`); }) : undefined;
	const options: ValidateOptions = configRaw ? loadConfig(configRaw, configFile as string) : {};
	// The CLI registers the default catalog after any catalog the configuration names (the first is the host default).
	if (options.catalogs !== undefined && !Array.isArray(options.catalogs)) throw new ValidateUsageError("The validate configuration's catalogs must be an array of catalogs: { source, <kind>: { <id>: record } }.");
	options.catalogs = cliCatalogs(options.catalogs ?? []);
	const only = list(flags.get("only")), ignore = list(flags.get("ignore"));
	checkNames([...only, ...ignore], "--only or --ignore");
	if (flags.has("only")) options.only = only;
	if (ignore.length) options.ignore = [...(options.ignore ?? []), ...ignore];
	const raw = file === "-" ? await stdin() : await readFile(file, "utf8").catch((error: unknown) => { throw new ValidateUsageError(`Cannot read ${file}: ${(error as Error).message}`); });
	let report: ValidationReport;
	try {
		report = checkText(raw, inputFormatOf(file), options).report;
	} catch (error) {
		if (error instanceof TypeError) throw new ValidateUsageError(error.message);
		throw error;
	}
	const label = file === "-" ? "stdin" : path.relative(process.cwd(), path.resolve(file)) || file;
	if (format === "json") {
		const body = { ...report, file: file === "-" ? null : path.resolve(file), sha256: hash(raw), opfVersion: OPF_VERSION, ...(configFile ? { context: { file: path.resolve(configFile), sha256: hash(configRaw as string) } } : {}) };
		process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
	} else process.stdout.write(formatText(report, label));
	if (reaches(report.findings, failOn)) process.exitCode = 1;
}

export { ValidateUsageError };
