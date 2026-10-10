// `opf paginate <input> [output]`: overflowing slides split into continuation slides. With @openpresentation/opf-render installed
// the breaks are measured with the fonts `opf convert --paginate` draws with (the shared office pack, prepared once per process,
// plus --fonts); without it core's portable estimate chooses them, and the report says `layout: "estimated"` and how to measure
// (RR-75). --check exits 1 when a slide would split.
import { type CommandSpec, parseArgs, printHelp } from "./args.js";
import { CLI_CATALOGS } from "./catalogs.js";
import { deckFormatFlag } from "./deck.js";
import { installHint } from "./install.js";
import { Reporter, paginateDeck } from "@openpresentation/opf/internal/engine";
import { type Host, checked, destinationOf, envelope, failOnOf, inputFact, printReport, readDeck, writeDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "paginate",
	usage: ["opf paginate <input|-> [output|-] [-i | --check] [--fonts <dir>]... [--from <format>] [--to <format>] [--force] [--fail-on <level>]"],
	summary: "Split overflowing slides into continuation slides.",
	operands: ["<input> (a deck, or - for stdin)"],
	positional: [1, 2],
	values: ["from", "to", "fail-on"],
	repeated: ["fonts"],
	flags: ["in-place", "check", "force"],
	help: `The page breaks are measured with the fonts opf convert draws with when @openpresentation/opf-render is installed
(layout: "measured"; --fonts adds folders of .ttf and .otf files). Without it they are estimated (layout: "estimated") and the
report's hint names the command that installs it. The deck goes to stdout, the output, or back to the input with -i. --check
writes nothing and exits 1 when any slide would split (overflow lists them). The report { command, ok, input, outputs,
findings, counts, layout, pages } goes to stdout, or stderr when stdout carries the deck.

Examples:
  opf paginate deck.opf.md -i
  opf paginate deck.opf.json --check`,
};

export async function run(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options, repeated } = parsed;
	const [input, output] = positional as [string, string | undefined];
	const failOn = failOnOf(options);
	const from = deckFormatFlag("--from", options.from);
	const to = deckFormatFlag("--to", options.to);
	const destination = destinationOf("paginate", input, output, options);
	const source = await readDeck(input, { from, rewrite: destination.file !== "-" && !destination.check });
	checked("paginate", source.value, failOn);
	const reporter = new Reporter();
	const { result, estimated } = await paginateDeck(source.value, { fontFolders: repeated.fonts ?? [], catalogs: CLI_CATALOGS, reporter, flags: true });
	const before = (source.value as { slides?: unknown[] }).slides?.length ?? 0;
	const split = [...new Set(result.pages.map((page) => page.sourceSlideIndex))].filter((index) => result.pages.filter((page) => page.sourceSlideIndex === index).length > 1);
	const hint = estimated ? installHint("svg")?.install : undefined;
	const extra = {
		layout: result.layout,
		...(estimated ? { hint: `The page breaks were estimated: ${estimated.details.package ?? "@openpresentation/opf-render"} is not installed. For measured breaks (the ones opf convert --paginate draws) install it${hint ? `: ${hint}` : "."}` } : {}),
		slides: { before, after: result.presentation.slides.length },
		overflow: split.map((index) => ({ slide: index + 1, pages: result.pages.filter((page) => page.sourceSlideIndex === index).length })),
		pages: result.pages,
	};
	const input_ = inputFact(input, source.raw);
	if (destination.check) {
		const ok = split.length === 0;
		printReport(envelope("paginate", { ok, input: input_, findings: reporter.findings, ...extra }));
		if (!ok) process.exitCode = 1;
		return;
	}
	await writeDeck("paginate", result.presentation, destination, { source, inputFile: input, to, failOn, input: input_, findings: reporter.findings, extra });
}
