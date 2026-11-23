// `opf fix <input> [output]` (OPF 0.35): the safe fixes of a deck's findings applied, round after round, until none is left (core's
// `fix`): the repair checks' by default, the audits' too with --audits. A fix not marked safe is never applied: its finding stays in the
// report with its fixes for a person to choose. Each fix applied says whether it can change how a slide draws. --check exits 1 when a
// safe fix would be applied. The deck is written with the fixes even when findings remain; the exit status says whether any reaches
// --fail-on.
import path from "node:path";
import { type AppliedFix, FIX_REPAIR_CATEGORIES, type Finding, type FindingSeverity, type FixResult, ensureIcons, fix, isSafePatch } from "@openpresentation/opf";
import { Reporter, assetRoot, iconSourceReader, measuringFonts } from "@openpresentation/opf/internal/engine";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { CLI_CATALOGS } from "./catalogs.js";
import { reaches } from "./check.js";
import { deckFormatFlag, nameOf } from "./deck.js";
import { type Host, type Report, destinationOf, envelope, failOnOf, inputFact, printReport, readDeck, writeDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "fix",
	usage: ["opf fix <input|-> [output|-] [-i | --check] [--audits] [--from <format>] [--to <format>] [--force] [--fail-on <level>] [--format <json|text>]"],
	summary: "Apply the safe fixes of a deck's findings until none is left.",
	operands: ["<input> (a deck, or - for stdin)"],
	positional: [1, 2],
	values: ["from", "to", "fail-on", "format"],
	flags: ["in-place", "check", "force", "audits"],
	help: `Validates the deck as opf validate does and applies each finding's fix that is marked safe, then validates again, since an
error in the deck's own keys hides the later checks; it stops when no safe fix is left (at most 10 rounds). A safe fix loses no
content and writes valid OPF: use-max-1, remove:listColumns, rename-layout, rename-region, use-current-record on a stale
copy of a built-in layout, ... The fixes bring the deck to the 0.35 form and the 0.35 engine draws it: a fix that can change
how a slide draws (rename-layout from agenda-split, use-current-record, remove:contentDirection, cells-to-layout-blocks)
says so (changesDrawing), and the text report marks it "changes the drawing". By default only the checks that repair the
document apply their fixes (format, references, policy, layout); --audits applies the audits' safe fixes too (accessibility,
content), and without it the report lists them in audits. A fix that is not marked safe (such as a new text color) is never
applied, and a fix you write
yourself (set the language, write alt text) is never counted: its finding stays in the report, with its fixes, for you to
choose. The deck goes to stdout, the output, or back to the input with -i (an input with nothing to fix is not rewritten). It
is written with the fixes even when findings remain. --check writes nothing and exits 1 when a safe fix would be applied.
Exit 1 also when findings at or above --fail-on (default error) remain or the rounds ran out.
The report { command, ok, input, outputs, findings, counts, valid, checks, fix: { applied: [{ round, ruleId, path, fix,
title, changesDrawing }], rounds, stopped, changesDrawing, unsafe, audits } } lists each fix applied, how many of them change
the drawing, the findings that remain, in unsafe those that carry only fixes to review and in audits those whose safe fixes
only --audits applies. It goes to stdout, or stderr when stdout carries the deck; --format text prints it as lines.

Examples:
  opf fix deck.opf.json -i
  opf fix deck.opf.yaml --check --format text
  opf fix deck.opf.json -i --audits`,
};

/** A remaining finding that carries patch fixes, none of them safe: what a person has to choose. */
interface UnsafeOnly {
	ruleId: string;
	path: string;
	fixes: string[];
}

const unsafeOnly = (findings: readonly Finding[]): UnsafeOnly[] =>
	findings.flatMap((finding) => {
		const patches = (finding.fixes ?? []).filter((entry) => (entry.kind ?? "patch") === "patch" && entry.patch?.length);
		return patches.length && !patches.some(isSafePatch) ? [{ ruleId: finding.ruleId, path: finding.path, fixes: patches.map((entry) => entry.id ?? entry.title) }] : [];
	});

/** Whether a finding is an audit's (outside the repair checks): its safe fixes are applied only with --audits. */
const isAudit = (finding: Finding) => !(FIX_REPAIR_CATEGORIES as readonly string[]).includes(finding.category);

/** A remaining audit finding with a safe patch fix: what --audits would apply. */
const auditOnly = (findings: readonly Finding[]): UnsafeOnly[] =>
	findings.flatMap((finding) => {
		const safe = isAudit(finding) ? (finding.fixes ?? []).filter(isSafePatch) : [];
		return safe.length ? [{ ruleId: finding.ruleId, path: finding.path, fixes: safe.map((entry) => entry.id ?? entry.title) }] : [];
	});

const DRAWING = "  (changes the drawing)";

const plural = (count: number, word: string, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

/** The report as lines: each fix applied (or, with --check, to apply), then each finding left with its fixes, then a summary. */
export function formatFixText(report: Report, label: string, check = false): string {
	const details = report.fix as { applied: Omit<AppliedFix, "patch">[]; rounds: number; stopped: FixResult["stopped"]; audits?: UnsafeOnly[] };
	const lines: string[] = [];
	for (const entry of details.applied) lines.push(`${label}:${entry.path || "/"}  ${check ? "to fix" : "fixed "}  ${entry.ruleId}  ${entry.fix}: ${entry.title}${entry.changesDrawing ? DRAWING : ""}`);
	for (const finding of report.findings) {
		lines.push(`${label}:${finding.path || "/"}  ${finding.severity.padEnd(7)} ${finding.ruleId}  ${finding.message}`);
		const audit = details.audits !== undefined && isAudit(finding);
		for (const entry of finding.fixes ?? [])
			lines.push(`    fix: ${entry.id ?? entry.title}: ${entry.title}${entry.kind === "focus" ? " (you write it)" : !isSafePatch(entry) ? " (not safe; review)" : audit ? " (an audit's: --audits applies it)" : ""}${isSafePatch(entry) && entry.changesDrawing ? DRAWING : ""}`);
	}
	if (lines.length) lines.push("");
	const { error, warning, info } = report.counts;
	const drawing = details.applied.filter((entry) => entry.changesDrawing).length;
	lines.push(
		`${label}: ${check ? "would apply" : "applied"} ${plural(details.applied.length, "safe fix", "safe fixes")}${details.applied.length ? ` in ${plural(details.rounds, "round")}` : ""}${drawing ? ` (${drawing} ${drawing === 1 ? "changes" : "change"} the drawing)` : ""}; ${plural(report.findings.length, "finding")} left (${plural(error, "error")}, ${plural(warning, "warning")}, ${info} info).`,
	);
	if (details.audits?.length) lines.push(`    ${plural(details.audits.length, "audit finding")} ${details.audits.length === 1 ? "has" : "have"} a safe fix that --audits applies.`);
	if (details.stopped === "max-rounds") lines.push(`    The findings still carried safe fixes after ${plural(details.rounds, "round")}; run opf fix again.`);
	if (details.stopped === "no-progress") lines.push("    The safe fixes left do not apply to the deck, or undo each other; apply them by hand.");
	return `${lines.join("\n")}\n`;
}

export async function run(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options } = parsed;
	const [input, output] = positional as [string, string | undefined];
	const failOn: FindingSeverity = failOnOf(options);
	const from = deckFormatFlag("--from", options.from);
	const to = deckFormatFlag("--to", options.to);
	const reportFormat = oneOf("--format", options.format, ["json", "text"] as const) ?? "json";
	const destination = destinationOf("fix", input, output, options);
	const source = await readDeck(input, { from, rewrite: destination.file !== "-" && !destination.check });
	// The icon sets the deck names, and their SVG files from the folder convert reads, so a renamed icon is reported with its fix.
	let iconRoot: string | undefined;
	try {
		iconRoot = assetRoot(input === "-" ? process.cwd() : path.dirname(path.resolve(input)), true);
	} catch {
		iconRoot = undefined;
	}
	await ensureIcons(source.value, { catalogs: CLI_CATALOGS, ...(iconRoot ? { readSource: iconSourceReader(iconRoot) } : {}) });
	// The fixes do not need measured text; once they are applied, the remaining findings are checked with the fonts opf convert draws with
	// (as opf validate does) when @openpresentation/opf-render is installed, and any safe fix that measuring reveals is applied too.
	const audits = options.audits === true;
	let result = fix(source.value, { catalogs: CLI_CATALOGS, audits });
	if (result.stopped === "stable") {
		const measuring = await measuringFonts(result.document, { reporter: new Reporter(), flags: true, catalogs: CLI_CATALOGS, reportInvalidDocument: true });
		try {
			if (measuring.fonts) {
				const measured = fix(result.document, { catalogs: CLI_CATALOGS, fonts: measuring.fonts, audits });
				result = { ...measured, applied: [...result.applied, ...measured.applied.map((entry) => ({ ...entry, round: entry.round + result.rounds }))], rounds: result.rounds + measured.rounds };
			}
		} finally {
			measuring.release();
		}
	}
	const applied = result.applied.map(({ patch: _patch, ...entry }) => entry);
	const changed = applied.length > 0;
	const extra = {
		valid: result.report.valid,
		checks: result.report.checks,
		fix: { applied, rounds: result.rounds, stopped: result.stopped, changesDrawing: applied.filter((entry) => entry.changesDrawing).length, unsafe: unsafeOnly(result.findings), ...(audits ? {} : { audits: auditOnly(result.findings) }) },
	};
	const label = input === "-" ? "stdin" : nameOf(input);
	const print = (report: Report, toStderr: boolean) => {
		if (reportFormat === "json") printReport(report, toStderr);
		else (toStderr ? process.stderr : process.stdout).write(formatFixText(report, label, destination.check));
	};
	const settled = result.stopped === "stable" && !reaches(result.findings, failOn);
	if (destination.check) {
		print(envelope("fix", { ok: !changed, input: inputFact(input, source.raw), findings: result.findings, ...extra }), false);
		if (changed) process.exitCode = 1;
		return;
	}
	if (destination.inPlace && !changed) {
		// Nothing to fix: the input is left as it is (not reformatted).
		print(envelope("fix", { ok: settled, input: inputFact(input, source.raw), findings: result.findings, ...extra }), false);
		if (!settled) process.exitCode = 1;
		return;
	}
	await writeDeck("fix", result.document, destination, { source, inputFile: input, to, failOn, input: inputFact(input, source.raw), extra, validated: { findings: result.findings, ok: settled }, print });
	if (!settled) process.exitCode = 1;
}
