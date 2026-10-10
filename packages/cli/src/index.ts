#!/usr/bin/env node
// The `opf` command (RR-75: one convert command, one output convention, --from/--to, doctor, multi-file validate, per-command
// help and errors that state the fix). Each command lives in its own module with its spec (usage, flags, help) and `run`; this
// file dispatches, prints `opf --help` and `--version`, and turns every failure into one JSON error report with a `code`.
import { OPFDataImportError, OPFPatchError, OPFValidationError } from "@openpresentation/opf";
import { OPFApiError } from "@openpresentation/opf/internal/engine";
import { type CommandSpec, REMOVED_COMMANDS, nearest, parseArgs, printHelp } from "./args.js";
import * as catalog from "./catalog.js";
import * as convert from "./convert-command.js";
import * as create from "./create.js";
import * as diffMerge from "./diff.js";
import * as doctor from "./doctor.js";
import * as edit from "./edit.js";
import * as embed from "./embed.js";
import { CliError, fromApiError, usage } from "./errors.js";
import * as fill from "./fill.js";
import * as format from "./format.js";
import * as ingest from "./ingest.js";
import { json } from "./io.js";
import * as paginate from "./paginate.js";
import { type Host, countsOf, envelope, printReport } from "./runtime.js";
import { type SkillBundle, SkillsError, manageSkills } from "./skills.js";
import * as stats from "./stats.js";
import * as validate from "./validate.js";
import { OPF_VERSION } from "./version.js";

declare const CLI_VERSION: string;
declare const OPF_SKILLS: SkillBundle;

const host: Host = { cliVersion: CLI_VERSION, opfVersion: OPF_VERSION };

const skillsSpec: CommandSpec = {
	name: "skills",
	usage: ["opf skills <install|update|status> [--agent <universal|codex|claude-code|cursor>] [--global | --directory <skills-directory>]"],
	summary: "Install, update or check the six bundled OPF agent skills.",
	operands: ["<install|update|status>"],
	positional: [1, 1],
	values: ["agent", "directory"],
	flags: ["global"],
	help: `Skills copy locally without symlinks, paid services or telemetry. update refuses locally modified or unmanaged skill folders
and keeps previous managed versions. The report { command, ok, input, outputs, findings, counts, ... } names the folder and
what changed.

Example:
  npx @openpresentation/cli@latest skills install`,
};

async function runSkills(args: string[]): Promise<void> {
	const parsed = parseArgs(skillsSpec, args);
	if (parsed === "help") return printHelp(skillsSpec);
	const { positional, options } = parsed;
	const result = await manageSkills(positional[0] as string, OPF_SKILLS, CLI_VERSION, { agent: options.agent as string | undefined, global: options.global === true, directory: options.directory as string | undefined });
	printReport(envelope("skills", { action: positional[0], ...result }));
}

type Runner = (args: string[], host: Host) => Promise<void>;
const COMMANDS: [CommandSpec, Runner][] = [
	[create.spec, create.run],
	[validate.spec, validate.run],
	[convert.spec, convert.run],
	[edit.spec, edit.run],
	[format.spec, format.run],
	[diffMerge.diffSpec, diffMerge.runDiff],
	[diffMerge.mergeSpec, diffMerge.runMerge],
	[stats.spec, stats.run],
	[paginate.spec, paginate.run],
	[embed.spec, embed.run],
	[fill.spec, fill.run],
	[ingest.spec, ingest.run],
	[doctor.spec, doctor.run],
	[catalog.schemasSpec, catalog.runSchemas],
	[catalog.schemaSpec, catalog.runSchema],
	[catalog.catalogsSpec, catalog.runCatalogs],
	[catalog.catalogSpec, catalog.runCatalog],
	[skillsSpec, (args) => runSkills(args)],
];
const byName = new Map(COMMANDS.map(([spec, runner]) => [spec.name, { spec, runner }]));

const usageText = () => `OPF — local presentation files for agents and scripts (Node >=22)

Commands:
${COMMANDS.map(([spec]) => `  ${spec.name.padEnd(9)} ${spec.summary}`).join("\n")}

Usage:
${COMMANDS.flatMap(([spec]) => spec.usage.map((line) => `  ${line}`)).join("\n")}
  opf --version

opf <command> --help (or -h) prints a command's flags and examples.

Decks are JSON (canonical), YAML (.opf.yaml) or Markdown (.opf.md); the extension names the form. --from json|yaml|md reads
stdin and other names (without it, text starting with { or [ is JSON); --to json|yaml|md picks the form written to stdout.
Every command that writes a deck takes an optional output after its inputs and writes stdout without one; -i (--in-place)
rewrites the input; format, embed and paginate take --check (write nothing, exit 1 when something would change). An existing
output needs --force. --format names a report format only: json (the default), text, github (validate) or patch (diff).
--data-format csv|tsv|json names the data of fill and ingest.

Reports are JSON: { command, ok, input, outputs: [{ file, sha256, bytes, mediaType }], findings, counts, ... } on stdout, or
on stderr when stdout carries a document. Errors are { command, ok: false, code, error, ... } on stderr.
Exit codes: 0 success, 1 an invalid document, findings at or above --fail-on (default error), a conflict or a --check that
found changes, 2 a usage, read, I/O or install problem.

Commands that write a deck check its format and references first; opf validate is the one checker and covers the rest
(accessibility, layout, content). Every command registers the default catalog (the pinned pptx.gallery snapshot).
PDF, PNG, SVG and PPTX need the optional @openpresentation/opf-render (and opf-pptx); opf doctor says what is installed and
prints the one command that installs the rest. Nothing is fetched and system fonts are never loaded.

Install all six bundled OPF agent skills in this project:
  npx @openpresentation/cli@latest skills install`;

/** The error report of a failure, and its exit status. */
function failure(error: unknown, command: string | undefined): { report: Record<string, unknown>; exit: number } {
	const base = command === undefined ? {} : { command };
	const shaped = (cli: CliError) => {
		const findings = Array.isArray(cli.details.findings) ? (cli.details.findings as { severity: "error" | "warning" | "info" }[]) : undefined;
		return { report: { ...base, ok: false, code: cli.code, error: cli.message, ...cli.details, ...(findings && cli.details.counts === undefined ? { counts: countsOf(findings) } : {}) }, exit: cli.exit };
	};
	if (error instanceof CliError) return shaped(error);
	if (error instanceof OPFApiError) return shaped(fromApiError(error));
	if (error instanceof OPFValidationError) return shaped(new CliError(error.message, "invalid-document", 1, { findings: error.report.findings }));
	if (error instanceof OPFPatchError) return shaped(new CliError(error.message, `patch-${error.code}`, 1, { ...(error.path === undefined ? {} : { path: error.path }), ...(error.index === undefined ? {} : { operation: error.index }) }));
	if (error instanceof OPFDataImportError) return shaped(new CliError(error.message, "invalid-data", 1));
	if (error instanceof SkillsError) return shaped(new CliError(error.message, error.code === 2 ? "usage" : "skills-conflict", error.code === 2 ? 2 : 1));
	const code = (error as NodeJS.ErrnoException)?.code;
	if (typeof code === "string" && /^E[A-Z]+$/.test(code)) return shaped(new CliError((error as Error).message, code === "ENOENT" ? "input-not-found" : "io-error", 2));
	return shaped(new CliError(error instanceof Error ? error.message : String(error), "internal-error", 2));
}

async function main(argv: string[]): Promise<string | undefined> {
	const [first, ...rest] = argv;
	if (first === undefined || first === "--help" || first === "-h" || (first === "help" && rest.length === 0)) {
		process.stdout.write(`${usageText()}\n`);
		return undefined;
	}
	if (first === "--version" || first === "-v") {
		if (rest.length) throw usage("--version takes no arguments.");
		process.stdout.write(json({ cli: CLI_VERSION, opf: OPF_VERSION }));
		return undefined;
	}
	if (first === "help") {
		const entry = byName.get(rest[0] as string);
		if (!entry) throw usage(`Unknown command: ${rest[0]}. Run opf --help.`, "unknown-command");
		printHelp(entry.spec);
		return undefined;
	}
	const entry = byName.get(first);
	if (!entry) {
		const removed = REMOVED_COMMANDS[first];
		if (removed) throw usage(removed, "removed-command", { command: first });
		if (first.startsWith("-")) throw usage(`Options follow a command: opf <command> ${first} .... Run opf --help.`, "unknown-option");
		const guess = nearest(first, [...byName.keys()]);
		throw usage(`Unknown command: ${first}.${guess ? ` Did you mean opf ${guess}?` : ""} Run opf --help.`, "unknown-command", guess ? { suggestion: guess } : {});
	}
	await entry.runner(rest, host);
	return first;
}

const command = process.argv[2];
main(process.argv.slice(2)).catch((error: unknown) => {
	const { report, exit } = failure(error, command !== undefined && byName.has(command) ? command : undefined);
	process.stderr.write(json(report));
	process.exitCode = exit;
});
