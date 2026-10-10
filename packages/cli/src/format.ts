// `opf format <file>... [output]`: canonical key order and layout, in the form the file already has (RR-75: `opf convert` changes
// forms). JSON gets the formatter's layout; YAML gets the canonical YAML (schema key order, two-space block style) and loses its
// comments; Markdown gets the canonical Markdown of the dialect (`toMarkdown(fromMarkdown(text))`).
import { format } from "@openpresentation/opf/format";
import { OPFMarkdownError } from "@openpresentation/opf/markdown";
import { OPFYamlError } from "@openpresentation/opf/yaml";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { DECK_MEDIA, type DeckFormat, deckFormatFlag, fenceWarning, namedFormatOf, nameOf, serialize } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { checkOutput, samePath, saveText } from "./io.js";
import { type Host, envelope, inputFact, outputFact, printReport, readDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "format",
	usage: ["opf format <file|-> [output|-] [--indent <0-8>] [--eol <lf|crlf|preserve>] [--from <format>] [--force]", "opf format <file>... (-i | --check) [--indent <0-8>] [--eol <lf|crlf|preserve>] [--from <format>]"],
	summary: "Rewrite decks in canonical key order and layout, keeping their form.",
	operands: ["<file> (a deck, or - for stdin)"],
	positional: [1, Number.POSITIVE_INFINITY],
	values: ["indent", "eol", "from"],
	flags: ["in-place", "check", "force"],
	help: `One file goes to stdout, or to the output (which must name the same form: opf convert changes forms). Several files need -i
(rewrite each that changes) or --check (write nothing; exit 1 when any file would change, listed in unformatted). --indent
sets JSON's indent (default 2); YAML and Markdown have one layout. --eol picks the line ending (lf, the default, crlf, or
preserve). Rewriting a YAML file does not keep its comments (a warning names the file). The report { command, ok, input,
outputs, findings, counts } goes to stdout, or to stderr when stdout carries the deck.

Examples:
  opf format --check decks/*.opf.json
  opf format -i deck.opf.yaml`,
};

export async function run(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options } = parsed;
	const inPlace = options["in-place"] === true;
	const check = options.check === true;
	if (inPlace && check) throw usage("Use -i or --check, not both.");
	let files = positional;
	let output: string | undefined;
	if (!inPlace && !check) {
		if (positional.length > 2) throw usage("Several files need -i (rewrite them) or --check (report the ones that would change).");
		[files, output] = [[positional[0] as string], positional[1]];
	}
	if ((inPlace || check) && options.force) throw usage(`${inPlace ? "-i" : "--check"} takes no --force.`);
	if (files.includes("-") && (files.length > 1 || inPlace)) throw usage("stdin can be formatted alone, and not in place.");
	if ((output === undefined || output === "-") && options.force) throw usage("--force replaces an output file; stdout needs none.");
	let indent: number | undefined;
	if (options.indent !== undefined) {
		if (!/^[0-8]$/.test(String(options.indent))) throw usage("--indent needs an integer from 0 to 8.", "invalid-value", { option: "--indent" });
		indent = Number(options.indent);
	}
	const eol = oneOf("--eol", options.eol, ["lf", "crlf", "preserve"] as const) ?? "lf";
	const from = deckFormatFlag("--from", options.from);
	const results: Array<{ file: string; text: string; raw: string; changed: boolean; format: DeckFormat }> = [];
	for (const file of files) {
		const source = await readDeck(file, { from, rewrite: !check && (inPlace || (output !== undefined && output !== "-")) });
		const lineEnding = eol === "preserve" ? (source.raw.includes("\r\n") ? "crlf" : "lf") : eol;
		let text: string;
		if (source.format === "json") text = format(source.value, { indent, eol: lineEnding });
		else {
			if (indent !== undefined) throw usage("--indent applies to JSON; YAML and Markdown are written in one layout.", "option-not-applicable", { option: "--indent" });
			try {
				text = serialize(source.value, source.format, { modeline: source.yaml?.modeline });
			} catch (error) {
				if (error instanceof OPFYamlError || error instanceof OPFMarkdownError) throw new CliError(`Cannot format ${nameOf(file)}: ${error.message}`, "invalid-document", 1, { details: error.details });
				throw error;
			}
			if (lineEnding === "crlf") text = text.replaceAll("\n", "\r\n");
			const fences = source.format === "markdown" && !check ? fenceWarning(text, source, file === "-" ? "the output" : file) : undefined;
			if (fences) process.stderr.write(fences);
		}
		results.push({ file, text, raw: source.raw, changed: text !== source.raw, format: source.format });
	}
	const inputs = results.map((result) => inputFact(result.file, result.raw));
	const unformatted = results.filter((result) => result.changed).map((result) => result.file);
	if (check) {
		printReport(envelope("format", { ok: unformatted.length === 0, input: inputs, checked: results.length, formatted: results.length - unformatted.length, unformatted }));
		if (unformatted.length) process.exitCode = 1;
		return;
	}
	if (inPlace) {
		const outputs = [];
		for (const result of results)
			if (result.changed) {
				await saveText(result.file, result.text, true, { file: result.file, raw: result.raw });
				outputs.push(outputFact(result.file, result.text, DECK_MEDIA[result.format]));
			}
		printReport(envelope("format", { input: inputs, outputs, rewritten: unformatted, unchanged: results.filter((result) => !result.changed).map((result) => result.file) }));
		return;
	}
	const only = results[0] as (typeof results)[number];
	const target = output ?? "-";
	if (target !== "-") {
		const named = namedFormatOf(target);
		if (named && named !== only.format) throw usage(`opf format keeps the form: ${target} names ${named === "markdown" ? "Markdown" : named.toUpperCase()}, ${nameOf(only.file)} is ${only.format === "markdown" ? "Markdown" : only.format.toUpperCase()}. Use opf convert to change forms.`, "invalid-output-name");
		const sameFile = only.file !== "-" && samePath(only.file, target);
		// The input under another name (another case on Windows and macOS) is rewritten as itself.
		await checkOutput(target, options.force === true || sameFile);
		await saveText(target, only.text, options.force === true || sameFile, sameFile ? { file: only.file, raw: only.raw } : undefined);
	} else process.stdout.write(only.text);
	printReport(envelope("format", { input: inputs[0], outputs: [outputFact(target, only.text, DECK_MEDIA[only.format])], changed: only.changed }), target === "-");
}
