// `opf diff <a> <b>` and `opf merge <base> <ours> <theirs> [output]`: what changed between two decks, and a three-way merge with
// conflict reporting, through core's `diff` and `merge`.
import { diff, formatDiffReport, merge } from "@openpresentation/opf/diff";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { deckFormatFlag } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { json, samePath, saveText } from "./io.js";
import { type Host, destinationOf, envelope, failOnOf, inputFact, printReport, readDeck, writeDeck } from "./runtime.js";

/** An optional 0..1 option value. */
function ratio(value: string | true | undefined, name = "--threshold"): number | undefined {
	if (value === undefined) return undefined;
	const number = Number(value);
	if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(number) || number < 0 || number > 1) throw usage(`${name} needs a number from 0 to 1.`, "invalid-value", { option: name });
	return number;
}

export const diffSpec: CommandSpec = {
	name: "diff",
	usage: ["opf diff <a|-> <b|-> [--format <text|json|patch>] [--exit-code] [--threshold <0-1>] [--from <format>]"],
	summary: "Show what changed between two decks.",
	operands: ["<a> (a deck, or - for stdin)", "<b> (a deck, or - for stdin)"],
	positional: [2, 2],
	values: ["format", "threshold", "from"],
	flags: ["exit-code"],
	help: `Slides match by id, then by content (--threshold, default 0.5); the report lists added, removed and moved slides and field,
design and metadata changes. --format text (the default) is for people; json is the report { command, ok, input, outputs,
findings, counts, equal, summary, slides, changes, patch }; patch is only the JSON Patch from A to B. --exit-code exits 1 when
they differ.

Examples:
  opf diff before.opf.json after.opf.json
  opf diff a.opf.md b.opf.md --format patch > patch.json`,
};

export async function runDiff(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(diffSpec, args);
	if (parsed === "help") return printHelp(diffSpec);
	const { positional, options } = parsed;
	const [fileA, fileB] = positional as [string, string];
	if (fileA === "-" && fileB === "-") throw usage("stdin can supply only one input: give one of the decks as a file.");
	const format = oneOf("--format", options.format, ["text", "json", "patch"] as const) ?? "text";
	const from = deckFormatFlag("--from", options.from);
	const a = await readDeck(fileA, { from });
	const b = await readDeck(fileB, { from });
	const result = diff(a.value, b.value, { threshold: ratio(options.threshold) });
	if (format === "patch") process.stdout.write(json(result.patch));
	else if (format === "json") printReport(envelope("diff", { input: [inputFact(fileA, a.raw), inputFact(fileB, b.raw)], equal: result.equal, summary: result.summary, slides: result.slides, changes: result.changes, patch: result.patch }));
	else process.stdout.write(formatDiffReport(result));
	if (options["exit-code"] && !result.equal) process.exitCode = 1;
}

export const mergeSpec: CommandSpec = {
	name: "merge",
	usage: ["opf merge <base> <ours> <theirs> [output|-] [-i] [--prefer <ours|theirs>] [--report <file>] [--threshold <0-1>]", "          [--from <format>] [--to <format>] [--force] [--fail-on <level>]"],
	summary: "Merge two edits of a base deck; conflicts are listed.",
	operands: ["<base>", "<ours>", "<theirs>"],
	positional: [3, 4],
	values: ["prefer", "report", "threshold", "from", "to", "fail-on"],
	flags: ["in-place", "force"],
	help: `Non-overlapping changes merge. Conflicts are listed and nothing is written (exit 1) unless --prefer takes a side (the
conflicts are still reported). The merged deck goes to stdout, the output, or back to <ours> with -i; --report also writes the
merge summary as JSON. The report { command, ok, input, outputs, findings, counts, merge } goes to stdout, or stderr for stdout.

Examples:
  opf merge base.opf.json ours.opf.json theirs.opf.json merged.opf.json
  opf merge base.opf.yaml ours.opf.yaml theirs.opf.yaml -i --prefer theirs`,
};

export async function runMerge(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(mergeSpec, args);
	if (parsed === "help") return printHelp(mergeSpec);
	const { positional, options } = parsed;
	const [baseFile, oursFile, theirsFile, output] = positional as [string, string, string, string | undefined];
	if (positional.slice(0, 3).filter((file) => file === "-").length > 1) throw usage("stdin can supply only one input.");
	const prefer = oneOf("--prefer", options.prefer, ["ours", "theirs"] as const);
	const failOn = failOnOf(options);
	const from = deckFormatFlag("--from", options.from);
	const to = deckFormatFlag("--to", options.to);
	const destination = destinationOf("merge", oursFile, output, options);
	const report = options.report === undefined ? undefined : String(options.report);
	if (report !== undefined && (report === "-" || (destination.file !== "-" && samePath(report, destination.file)))) throw usage("--report needs a file of its own: not -, and not the merged output.", "invalid-value", { option: "--report" });
	const rewrite = destination.file !== "-";
	const base = await readDeck(baseFile, { from, rewrite });
	const ours = await readDeck(oursFile, { from, rewrite });
	const theirs = await readDeck(theirsFile, { from, rewrite });
	const result = merge(base.value, ours.value, theirs.value, { prefer, threshold: ratio(options.threshold) });
	const summary = { clean: result.clean, conflicts: result.conflicts, applied: result.applied, ...(result.clean ? {} : { resolvedWith: prefer ?? null }) };
	// The summary file is a scratch artifact, so it may replace an earlier one.
	if (report !== undefined) await saveText(report, json(summary), true);
	const inputs = [inputFact(baseFile, base.raw), inputFact(oursFile, ours.raw), inputFact(theirsFile, theirs.raw)];
	if (!result.clean && prefer === undefined) {
		// Never write a deck that silently took one side: report and stop.
		const count = result.conflicts.length;
		throw new CliError(`The merge has ${count} conflict${count === 1 ? "" : "s"}; nothing was written. Resolve them, or pass --prefer ours|theirs to take a side (the conflicts are still reported).`, "merge-conflict", 1, { command: "merge", input: inputs, merge: summary });
	}
	await writeDeck("merge", result.merged, destination, { source: ours, inputFile: oursFile, to, failOn, input: inputs, extra: { merge: summary } });
}

