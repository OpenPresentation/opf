// `opf fill <template> [data] [output]`: a template's variables filled with core's `fill`, one deck per record. The output is a
// file name pattern (RR-75): `{n}` is the record number, `{column}` a slug of that column's value, so
// `opf fill t.opf.md clients.csv decks/qbr-{client}.opf.md` writes one deck per client; --combine writes one deck with every
// record's slides. Without data the template fills from its own values (and their examples with --examples).
import path from "node:path";
import { type FilledDeck, fill } from "@openpresentation/opf";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { DECK_MEDIA, deckFormatFlag, fenceWarning, outputFormatOf, serialize } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { checkOutput, dataFormatOf, readText, saveText } from "./io.js";
import { type Host, type OutputFact, checked, destinationOf, envelope, failOnOf, inputFact, outputFact, printReport, readDeck, writeDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "fill",
	usage: ["opf fill <template|-> <data|-> [output|pattern] [--data-format <csv|tsv|json>] [--delimiter <c>] [--no-header]", "         [--combine] [--partial] [--examples] [--from <format>] [--to <format>] [--force] [--fail-on <level>]", "opf fill <template|-> [--examples] [--partial] [--to <format>]"],
	summary: "Fill a template's variables from data: one deck per record, or one combined deck.",
	operands: ["<template> (a deck with variables, or - for stdin)"],
	positional: [1, 3],
	values: ["data-format", "delimiter", "from", "to", "fail-on"],
	flags: ["no-header", "combine", "partial", "examples", "force"],
	help: `The second argument is always the data (- reads it from stdin), whatever its name; the third is the output. Data is CSV,
TSV or JSON (by its extension, --data-format, or JSON when it starts with { or [): one record per row or per object of an
array, or one JSON object. The output is a deck name or a file name pattern: {n} is the record number (padded), {column} a
slug of that column's value, and a repeated name gets -2, -3. Several records need a pattern with { } or --combine (one deck
with every record's slides); without an output the deck goes to stdout. A template alone fills from its own values (and
their examples with --examples), to stdout. Blank cells keep the variable's
declared value. An unfilled required variable fails (exit 1) unless --partial; --examples fills unfilled variables from
their example. Every deck passes the format and references check (--fail-on) before anything is written. The report
{ command, ok, input, outputs: [{ file, record, ... }], findings, counts, fill } goes to stdout, or stderr for stdout output.

Examples:
  opf fill template.opf.md clients.csv decks/qbr-{client}.opf.md
  opf fill template.opf.json data.json all.opf.json --combine
  opf fill template.opf.json --examples`,
};

/** File names for the decks: the pattern with `{n}` and `{column}` replaced, a repeated name numbered. */
export function fileNames(decks: readonly FilledDeck[], pattern: string): string[] {
	const width = String(decks.length).length;
	const used = new Set<string>();
	const extension = /\.opf\.(json|ya?ml|md)$|\.(json|ya?ml)$/i.exec(pattern)?.[0] ?? "";
	return decks.map((deck) => {
		const name = pattern.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
			if (key === "n") return String(deck.index).padStart(width, "0");
			const value = deck.record[key];
			return value === undefined || value === null || slug(String(value)) === "" ? String(deck.index).padStart(width, "0") : slug(String(value));
		});
		let file = name;
		const key = (text: string) => (process.platform === "win32" || process.platform === "darwin" ? path.resolve(text).toLowerCase() : path.resolve(text));
		for (let suffix = 2; used.has(key(file)); suffix++) file = `${name.slice(0, name.length - extension.length)}-${suffix}${extension}`;
		used.add(key(file));
		return file;
	});
}

function slug(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80)
		.replace(/-+$/, "");
}

export async function run(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options } = parsed;
	// The second argument is always the data (`-` for stdin), the third the output; nothing is guessed from a name.
	const [template, data, output] = positional as [string, string | undefined, string | undefined];
	const failOn = failOnOf(options);
	const from = deckFormatFlag("--from", options.from);
	const to = deckFormatFlag("--to", options.to);
	const dataFormat = oneOf("--data-format", options["data-format"], ["csv", "tsv", "json"] as const);
	if (data === undefined && (dataFormat || options.delimiter !== undefined || options["no-header"])) throw usage("--data-format, --delimiter and --no-header describe the data; give the data file as the second argument.", "option-not-applicable");
	if (template === "-" && data === "-") throw usage("stdin can supply only one input: give the template or the data as a file.");
	const source = await readDeck(template, { from });
	const raw = data === undefined ? undefined : await readText(data);
	const format = raw === undefined ? undefined : (dataFormat ?? (data === undefined ? undefined : dataFormatOf(data)) ?? (/^[\s\uFEFF]*[[{]/.test(raw) ? "json" : "csv"));
	const result = fill(source.value, raw, { ...(format ? { format } : {}), ...(options.delimiter !== undefined ? { delimiter: String(options.delimiter) } : {}), header: !options["no-header"], partial: options.partial === true, examples: options.examples === true, combine: options.combine === true });
	const errors = result.decks.flatMap((deck) =>
		deck.diagnostics
			.filter((entry) => entry.severity === "error")
			.map((entry) => ({ record: deck.index, ...entry, ...(entry.code === "variable-unfilled" ? { message: `Required variable '${entry.id}' has no value. Give it in the data, use --examples, or keep an incomplete result with --partial.` } : {}) })),
	);
	if (errors.length) throw new CliError(`Filling failed: ${errors[0]?.message}`, "fill-failed", 1, { errors });
	const summary = { records: result.decks.length, complete: result.complete, unfilled: result.unfilled, diagnostics: result.diagnostics };
	const inputs = [inputFact(template, source.raw), ...(data !== undefined && raw !== undefined ? [inputFact(data, raw)] : [])];

	if (options.combine || result.decks.length === 1) {
		if (output !== undefined && output !== "-" && /\{[^{}]+\}/.test(output) && options.combine) throw usage("--combine writes one deck: give a file name without { }.");
		const deck = options.combine ? (result.presentation as Record<string, unknown>) : (result.decks[0] as FilledDeck).presentation;
		const named = output !== undefined && output !== "-" && !options.combine ? (fileNames(result.decks, output)[0] as string) : output;
		await writeDeck("fill", deck, destinationOf("fill", template, named, options), { source, to, failOn, input: inputs, extra: { fill: summary } });
		return;
	}
	if (output === undefined || output === "-") throw usage(`${result.decks.length} records give ${result.decks.length} decks: give a file name pattern with {n} or {column} (decks/deck-{n}.opf.json), or --combine for one deck.`, "missing-argument");
	if (!/\{[^{}]+\}/.test(output)) throw usage(`${result.decks.length} records give ${result.decks.length} decks, but ${output} names one file: put {n} or a {column} in it (${output.replace(/(\.opf)?\.[^./\\]+$/, "-{n}$&")}), or pass --combine.`, "invalid-output-name");
	// Every deck is checked and every name is free before anything is written.
	const files = fileNames(result.decks, output);
	const checks = result.decks.map((deck) => checked("fill", deck.presentation, failOn));
	for (const file of files) await checkOutput(file, options.force === true);
	const outputs: OutputFact[] = [];
	for (const [offset, deck] of result.decks.entries()) {
		const file = files[offset] as string;
		const kind = outputFormatOf(file, to, source);
		const text = serialize(deck.presentation, kind);
		const fences = kind === "markdown" ? fenceWarning(text, source, file) : undefined;
		if (fences) process.stderr.write(fences);
		await saveText(file, text, options.force === true);
		outputs.push(outputFact(file, text, DECK_MEDIA[kind], { record: deck.index }));
	}
	printReport(envelope("fill", { input: inputs, outputs, findings: checks.flatMap((check) => check.findings), fill: summary }));
}
