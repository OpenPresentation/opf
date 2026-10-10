// `fill` (RR-75): a template (a deck with variables) and data to decks, the verb behind `opf fill`. One deck per record: a CSV
// or TSV row, an object of a JSON array, or one JSON object; `combine` joins them into one deck. Pure: no files, no catalogs,
// no clock. The deck is not checked here: `validate` (or `opf fill`, which runs the format and references check) does that.
import { OPFDataImportError, parseTabularData } from "./data.js";
import { type ResolveVariablesOptions, type VariableDiagnostic, resolveVariables } from "./variables.js";

/** The values of one deck, keyed by variable id. */
export type FillRecord = Record<string, unknown>;

export interface FillOptions extends Pick<ResolveVariablesOptions, "partial" | "examples"> {
	/** The form of text data: `csv`, `tsv` or `json`. Omitted: `json` when the text starts with `{` or `[`, else `csv`. */
	format?: "csv" | "tsv" | "json";
	/** CSV: the field separator (default `,`; TSV uses a tab). */
	delimiter?: string;
	/** CSV and TSV: the first row names the columns (default true). */
	header?: boolean;
	/** Join the decks into one: the first deck's fields, then the slides of every deck in order (a repeated slide id gets the record number). */
	combine?: boolean;
}

export interface FilledDeck {
	/** The record's position, from 1. */
	index: number;
	record: FillRecord;
	presentation: Record<string, unknown>;
	diagnostics: VariableDiagnostic[];
	/** The variables that kept no value. */
	unfilled: string[];
	complete: boolean;
}

export interface FillResult {
	/** One deck per record, in order. */
	decks: FilledDeck[];
	/** With `combine`: the one deck. */
	presentation?: Record<string, unknown>;
	/** Every deck has a value for every variable. */
	complete: boolean;
	unfilled: string[];
	/** The warnings and errors of every deck, one entry per code, variable and path, with the records it hit. An `error` (a required variable with no value, unless `partial`) means the deck is not usable as it is. */
	diagnostics: (VariableDiagnostic & { records: number[] })[];
}

const isRecord = (value: unknown): value is FillRecord => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The records of text data. JSON keeps rich values (text runs, lists, image objects): an object is one record and an array of
 * objects one record each. CSV, TSV and tabular JSON (`{ columns, rows }` or a row matrix) give one record per row, keyed by the
 * header, with blank cells left unprovided. Throws `OPFDataImportError` for data that has no records.
 */
export function fillRecords(raw: string, options: Pick<FillOptions, "format" | "delimiter" | "header"> = {}): FillRecord[] {
	const format = options.format ?? (/^[\s\uFEFF]*[[{]/.test(raw) ? "json" : "csv");
	if (format === "json") {
		let value: unknown;
		try {
			value = JSON.parse(raw.replace(/^\uFEFF/, ""));
		} catch {
			throw new OPFDataImportError("Invalid JSON data.");
		}
		if (isRecord(value) && !("columns" in value && "rows" in value)) return [value];
		if (Array.isArray(value) && value.length && value.every(isRecord)) return value;
		if (Array.isArray(value) && !value.length) throw new OPFDataImportError("Data contains no records.");
	}
	const table = parseTabularData(raw, { format, header: options.header, delimiter: options.delimiter });
	if (!table.rows.length) throw new OPFDataImportError("Data contains no records.");
	return table.rows.map((row) => Object.fromEntries(table.columns.map((column, index) => [column, row[index] === "" ? null : row[index]])));
}

/**
 * Fill a template: `data` is text (CSV, TSV or JSON), one record or a list of records; omitted, one deck is filled from the
 * variables' own values (and their examples with `examples`). Each deck is the template resolved with one record
 * (`resolveVariables`), no longer marked as a template. Throws `OPFDataImportError` for data without records and a `TypeError`
 * for a template that is not an object.
 */
export function fill(template: unknown, data?: string | FillRecord | readonly FillRecord[], options: FillOptions = {}): FillResult {
	if (!isRecord(template)) throw new TypeError("fill expects a template object.");
	const records: FillRecord[] = data === undefined ? [{}] : typeof data === "string" ? fillRecords(data, options) : Array.isArray(data) ? [...data] : [data as FillRecord];
	if (!records.length) throw new OPFDataImportError("Data contains no records.");
	if (!records.every(isRecord)) throw new OPFDataImportError("Each record must be an object keyed by variable id.");
	const decks = records.map((record, offset) => ({ index: offset + 1, record, ...resolveVariables(template, record, { template: false, partial: options.partial === true, examples: options.examples === true }) }));
	return {
		decks: decks.map(({ index, record, presentation, diagnostics, unfilled, complete }) => ({ index, record, presentation: presentation as Record<string, unknown>, diagnostics, unfilled, complete })),
		...(options.combine ? { presentation: combine(decks as unknown as FilledDeck[]) } : {}),
		complete: decks.every((deck) => deck.complete),
		unfilled: [...new Set(decks.flatMap((deck) => deck.unfilled))],
		diagnostics: summarize(decks as unknown as FilledDeck[]),
	};
}

/** The slides of several filled decks in one deck: the first deck gives every deck-level field, a repeated slide id gets the record number appended, and assets merge (first one wins). */
function combine(decks: FilledDeck[]): Record<string, unknown> {
	const first = decks[0] as FilledDeck;
	const seen = new Set<string>();
	const slides: unknown[] = [];
	const assets: Record<string, unknown> = {};
	for (const deck of decks) {
		for (const slide of Array.isArray(deck.presentation.slides) ? deck.presentation.slides : []) {
			if (isRecord(slide) && typeof slide.id === "string") {
				let id = slide.id;
				if (seen.has(id)) {
					id = `${slide.id}-${deck.index}`;
					for (let suffix = 2; seen.has(id); suffix++) id = `${slide.id}-${deck.index}-${suffix}`;
				}
				seen.add(id);
				slides.push(id === slide.id ? slide : { ...slide, id });
			} else slides.push(slide);
		}
		if (isRecord(deck.presentation.assets)) for (const [key, value] of Object.entries(deck.presentation.assets)) if (!(key in assets)) assets[key] = value;
	}
	return { ...first.presentation, ...(Object.keys(assets).length ? { assets } : {}), slides };
}

/** Warnings and errors across decks, one entry per code, variable and path, with the records it hit. */
function summarize(decks: FilledDeck[]): (VariableDiagnostic & { records: number[] })[] {
	const merged = new Map<string, VariableDiagnostic & { records: number[] }>();
	for (const deck of decks) {
		for (const diagnostic of deck.diagnostics) {
			if (diagnostic.severity === "info") continue;
			const key = `${diagnostic.code}\u0000${diagnostic.id}\u0000${diagnostic.path}`;
			const entry = merged.get(key);
			if (entry) entry.records.push(deck.index);
			else merged.set(key, { ...diagnostic, records: [deck.index] });
		}
	}
	return [...merged.values()];
}
