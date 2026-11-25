// `opf fill <template> [data] [output]`: a template's variables filled with core's `fill`, one deck per record. The output is a
// file name pattern (RR-75): `{n}` is the record number, `{column}` a slug of that column's value, so
// `opf fill t.opf.md clients.csv decks/qbr-{client}.opf.md` writes one deck per client; --combine writes one deck with every
// record's slides. Without data the template fills from its own values (and their examples with --examples).
import { randomUUID } from "node:crypto";
import path from "node:path";
import { type FilledDeck, fill, validate, variableDeclarations } from "@openpresentation/opf";
import { CLI_CATALOGS } from "./catalogs.js";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { DECK_MEDIA, deckFormatFlag, fenceWarning, outputFormatOf, serialize } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { checkOutput, dataFormatOf, padNumber, readText, saveText } from "./io.js";
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
their example. Every deck passes the format and references check (--fail-on) before anything is written. A value
longer than its variable's maxLength, maxItems or maxLines is reported as a warning (opf/variable-overflow, with the record and
the slide) on stderr and in the report's fill.overflow before anything is written; the decks are still written. A value
for a variable that has translations replaces them (the filled deck would otherwise keep the template's text in the other
languages beside the new value): each removal is listed in the report's fill.translationsRemoved and on stderr. A record
may give a variable's translations itself: { "cta": { "value": "Join us", "translations": { "de": { "value": "Mach mit" } } } }
(JSON data; a date variable's entries are { "format": "d. MMMM yyyy" }). A date's translated formats are not removed. The report
{ command, ok, input, outputs: [{ file, record, ... }], findings, counts, fill } goes to stdout, or stderr for stdout output.

Examples:
  opf fill template.opf.md clients.csv decks/qbr-{client}.opf.md
  opf fill template.opf.json data.json all.opf.json --combine
  opf fill template.opf.json --examples`,
};

/** File names for the decks: the pattern with `{n}` and `{column}` replaced, a repeated name numbered. */
export function fileNames(decks: readonly FilledDeck[], pattern: string): string[] {
	const largest = Math.max(0, ...decks.map((deck) => deck.index));
	const used = new Set<string>();
	const extension = /\.opf\.(json|ya?ml|md)$|\.(json|ya?ml)$/i.exec(pattern)?.[0] ?? "";
	return decks.map((deck) => {
		const name = pattern.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
			if (key === "n") return padNumber(deck.index, largest);
			const value = deck.record[key];
			return value === undefined || value === null || slug(String(value)) === "" ? padNumber(deck.index, largest) : slug(String(value));
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

/**
 * A value longer than its variable's limits (FR-09), for each record, before anything is written: `maxLength` and `maxItems` on the value,
 * `maxLines` where the variable is drawn (composition, so the slide is named). The template is checked with the record's values, as
 * `opf validate` would check it; the decks are still written, because a limit is a warning.
 */
function overflowOf(template: unknown, decks: readonly FilledDeck[]) {
	if (!variableDeclarations(template).some((entry) => entry.maxLength !== undefined || entry.maxLines !== undefined || entry.maxItems !== undefined)) return [];
	return decks.flatMap((deck) =>
		validate(template, { only: ["variable-overflow"], values: deck.record, template: true, catalogs: CLI_CATALOGS })
			.findings.filter((finding) => finding.ruleId === "opf/variable-overflow")
			.map((finding) => ({ record: deck.index, path: finding.path, ...(finding.slide !== undefined ? { slide: finding.slide + 1, ...(finding.slideId ? { slideId: finding.slideId } : {}) } : {}), message: finding.message })),
	);
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
	// A filled deck is a new deck: core drops the template's document id, and this host gives each deck its own (a template without an id gives decks without one).
	const templateHasId = typeof (source.value as { id?: unknown } | null)?.id === "string";
	const withId = (deck: Record<string, unknown>): Record<string, unknown> => {
		if (!templateHasId) return deck;
		const { $schema, ...rest } = deck;
		return { ...($schema === undefined ? {} : { $schema }), id: randomUUID(), ...rest };
	};
	for (const deck of result.decks) deck.presentation = withId(deck.presentation);
	if (result.presentation !== undefined) result.presentation = withId(result.presentation);
	const errors = result.decks.flatMap((deck) =>
		deck.diagnostics
			.filter((entry) => entry.severity === "error")
			.map((entry) => ({ record: deck.index, ...entry, ...(entry.code === "variable-unfilled" ? { message: `Required variable '${entry.id}' has no value. Give it in the data, use --examples, or keep an incomplete result with --partial.` } : {}) })),
	);
	if (errors.length) throw new CliError(`Filling failed: ${errors[0]?.message}`, "fill-failed", 1, { errors });
	const overflow = overflowOf(source.value, result.decks);
	for (const entry of overflow) process.stderr.write(`warning: opf/variable-overflow${result.decks.length > 1 ? ` record ${entry.record}` : ""}${entry.slide !== undefined ? ` slide ${entry.slide}` : ""} ${entry.path}: ${entry.message}\n`);
	for (const entry of result.translationsRemoved ?? []) process.stderr.write(`note: the translations of '${entry.id}' were removed: a value was given for it without translations${result.decks.length > 1 ? ` (records ${entry.records.join(", ")})` : ""}
`);
	const summary = { records: result.decks.length, complete: result.complete, unfilled: result.unfilled, diagnostics: result.diagnostics, ...(overflow.length ? { overflow } : {}), ...(result.translationsRemoved ? { translationsRemoved: result.translationsRemoved } : {}) };
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
