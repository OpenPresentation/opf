// `opf embed <input> [output]`: every catalog record the deck references copied into it, once, so it renders the same with no
// catalog registered. --check exits 1 when the deck is not self-contained yet (something would be embedded).
import { embed } from "@openpresentation/opf";
import { type CommandSpec, parseArgs, printHelp } from "./args.js";
import { CLI_CATALOGS } from "./catalogs.js";
import { deckFormatFlag } from "./deck.js";
import { type Host, checked, destinationOf, envelope, failOnOf, inputFact, printReport, readDeck, writeDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "embed",
	usage: ["opf embed <input|-> [output|-] [-i | --check] [--from <format>] [--to <format>] [--force] [--fail-on <level>]"],
	summary: "Copy the catalog records a deck references into it, so it renders with no catalog registered.",
	operands: ["<input> (a deck, or - for stdin)"],
	positional: [1, 2],
	values: ["from", "to", "fail-on"],
	flags: ["in-place", "check", "force"],
	help: `Each record goes into the group it resolves in (catalogs.default for the default catalog), with the records it references.
Records the deck already embeds are kept, except copies of built-in layouts from before OPF 0.35 that fail the 0.35 layout
schema: each is made valid without changing what it draws (an unedited 0.34 copy takes the current record, and its slides' pins
the 0.35 region names; another copy gets the safe fix of each removed key) and listed in embed.refreshed. Other invalid content
is refused. Remote media and data assets are not inlined. The deck goes to stdout, the output, or back to the input with -i.
--check writes nothing and exits 1 when something would be embedded or refreshed. The report { command, ok, input, outputs,
findings, counts, embed: { added, refreshed, unresolved } } goes to stdout, or stderr when stdout carries the deck.

Examples:
  opf embed deck.opf.json -i
  opf embed deck.opf.json --check`,
};

export async function run(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options } = parsed;
	const [input, output] = positional as [string, string | undefined];
	const failOn = failOnOf(options);
	const from = deckFormatFlag("--from", options.from);
	const to = deckFormatFlag("--to", options.to);
	const destination = destinationOf("embed", input, output, options);
	const source = await readDeck(input, { from, rewrite: destination.file !== "-" && !destination.check });
	const result = embed(source.value, { catalogs: CLI_CATALOGS });
	// OPF 0.35: embed made the stale copies of built-in layouts valid; the deck is then checked as it will be written (writeDeck).
	if (!result.refreshed.length) checked("embed", source.value, failOn);
	const extra = { embed: { added: result.added, refreshed: result.refreshed, unresolved: result.unresolved } };
	if (destination.check) {
		const ok = result.added.length === 0 && result.refreshed.length === 0;
		printReport(envelope("embed", { ok, input: inputFact(input, source.raw), ...extra }));
		if (!ok) process.exitCode = 1;
		return;
	}
	await writeDeck("embed", result.document, destination, { source, inputFile: input, to, failOn, input: inputFact(input, source.raw), extra });
}
