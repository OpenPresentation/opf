// `opf edit <file> --patch <patch>`: a JSON Patch applied with core's `edit` (the input never changes, the patch applies whole or
// not at all), the result checked, then written: stdout, an output file, or the input itself with -i.
import { OPFValidationError, edit } from "@openpresentation/opf";
import { type CommandSpec, parseArgs, printHelp } from "./args.js";
import { CLI_CATALOGS } from "./catalogs.js";
import { deckFormatFlag } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { sha256 } from "./io.js";
import { type Host, destinationOf, documentFailure, failOnOf, inputFact, readDeck, writeDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "edit",
	usage: ["opf edit <file|-> [output|-] --patch <patch|-> [-i] [--expect-sha256 <hash>] [--from <format>] [--to <format>] [--force] [--fail-on <level>]"],
	summary: "Apply a JSON Patch to a deck, check the result, and write it.",
	operands: ["<file> (a deck, or - for stdin)"],
	positional: [1, 2],
	values: ["patch", "expect-sha256", "from", "to", "fail-on"],
	flags: ["in-place", "force"],
	help: `The patch is JSON or YAML (add, remove, replace, move, copy, test) and applies whole or not at all; the result must pass
the format and references check (findings at or above --fail-on, default error, write nothing; exit 1). The result goes to
stdout, to the output, or back to the input with -i (atomically; with --expect-sha256 only when the input still has that
digest). The report { command, ok, input, outputs, findings, counts, inverse } goes to stdout, or stderr when stdout carries the
deck; inverse is the patch that undoes the edit.

Examples:
  opf edit deck.opf.json --patch patch.json -i
  opf edit deck.opf.yaml --patch - deck.next.opf.yaml < patch.yaml`,
};

export async function run(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options } = parsed;
	const [input, output] = positional as [string, string | undefined];
	if (options.patch === undefined) throw usage("opf edit needs --patch <patch.json|patch.yaml|->.", "missing-value", { option: "--patch" });
	const expected = options["expect-sha256"];
	if (expected !== undefined && !/^[a-fA-F0-9]{64}$/.test(String(expected))) throw usage("--expect-sha256 needs a SHA-256 hex digest (64 hex digits).", "invalid-value", { option: "--expect-sha256" });
	const failOn = failOnOf(options);
	const from = deckFormatFlag("--from", options.from);
	const to = deckFormatFlag("--to", options.to);
	const destination = destinationOf("edit", input, output, options);
	if (input === "-" && options.patch === "-") throw usage("stdin can supply only one input: give the deck or the patch as a file.");
	const source = await readDeck(input, { from, rewrite: destination.file !== "-" });
	if (expected !== undefined && sha256(source.raw) !== String(expected).toLowerCase()) throw new CliError("The input does not have the --expect-sha256 digest: it changed since it was read. Read it again before editing.", "hash-mismatch", 1);
	const patch = await readDeck(String(options.patch), { kind: "patch" });
	let result: ReturnType<typeof edit>;
	try {
		result = edit(source.value, patch.value, { catalogs: CLI_CATALOGS, validate: false });
	} catch (error) {
		if (error instanceof OPFValidationError) throw documentFailure("edit", error.message, error.report.findings);
		throw error;
	}
	await writeDeck("edit", result.presentation, destination, { source, inputFile: input, to, failOn, input: inputFact(input, source.raw), extra: { inverse: result.inverse } });
}
