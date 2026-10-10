// One argument parser for every command (RR-75): options are declared per command, `-h`/`--help` and the short `-i` work
// everywhere, `--name=value` works for a value option, `--` ends the options, and every mistake is a usage error (exit 2) that
// states the fix: a missing or extra argument names the command's usage, an unknown option suggests the nearest one, and a
// flag or command removed in 0.18 names what replaced it.
import { usage } from "./errors.js";

export interface CommandSpec {
	/** The command, as typed: `convert`, `catalog`, ... */
	name: string;
	/** The usage lines, each starting `opf <name>`. */
	usage: string[];
	/** One line for `opf --help`. */
	summary: string;
	/** The rest of `opf <name> --help`. */
	help: string;
	/** Options that take one value. */
	values?: readonly string[];
	/** Options that take a value and may repeat. */
	repeated?: readonly string[];
	/** Options without a value. */
	flags?: readonly string[];
	/** The positional arguments: at least `min`, at most `max`. */
	positional: [min: number, max: number];
	/** What the positional arguments are, for a message about a missing one: `<input>`, `<output>`. */
	operands?: string[];
}

export interface Parsed {
	positional: string[];
	options: Record<string, string | true>;
	repeated: Record<string, string[]>;
}

/** Single-letter options every command that has the long one accepts. */
const SHORT: Record<string, string> = { i: "in-place", h: "help" };

/** Options removed in 0.18, and what to do instead. */
export const REMOVED_OPTIONS: Record<string, string> = {
	out: "--out was removed in 0.18: give the output as the last argument (opf convert deck.opf.json deck.pdf), or omit it for stdout.",
	output: "--output was removed in 0.18: give the output as the last argument, or omit it for stdout; -i rewrites the input.",
	"out-dir": "--out-dir was removed in 0.18: give a file name pattern as the output (opf fill template.opf.json data.csv decks/deck-{n}.opf.json).",
	"input-format": "--input-format was renamed --from in 0.18: --from json|yaml|md.",
	json: "--json was removed in 0.18: reports are JSON already.",
	"dry-run": "--dry-run was removed in 0.18: omit the output to print the result on stdout and write nothing.",
	name: "--name was removed in 0.18: opf fill's output is the file name pattern (opf fill template.opf.json data.csv decks/deck-{n}.opf.json).",
	data: "--data was removed in 0.18: give the data file as the second argument (opf fill template.opf.json data.csv out-{n}.opf.json).",
	"svg-fonts": "--svg-fonts was renamed --text in 0.18: --text fonts|system|paths.",
	"pdf-mode": "--pdf-mode was renamed --raster in 0.18: --raster draws each PDF page as a picture.",
	chartex: "--chartex was renamed --charts in 0.18: --charts auto|native|picture.",
	"image-format": "--image-format was renamed --images in 0.18: --images compatible|preserve.",
	"font-dir": "--font-dir was renamed --fonts in 0.18: --fonts <directory> (repeatable).",
	strict: "--strict was removed: use --fail-on warning.",
};

/** Commands removed in 0.18 (and earlier), and what replaced them. */
export const REMOVED_COMMANDS: Record<string, string> = {
	render: "opf render was removed in 0.18: use opf convert deck.opf.json slides/deck.svg (or .png; one file per slide beside the output).",
	export: "opf export was removed in 0.18: use opf convert deck.opf.json deck.pdf (or .pptx, .png, .svg, .zip).",
	import: "opf import was removed in 0.18: use opf convert deck.pptx deck.opf.json (or .opf.yaml, .opf.md).",
	"from-md": "opf from-md was removed in 0.18: use opf convert deck.md deck.opf.json (a plain .md input is read as OPF Markdown).",
	"to-md": "opf to-md was removed in 0.18: use opf convert deck.opf.json deck.opf.md.",
	"from-yaml": "opf from-yaml was removed in 0.18: use opf convert deck.opf.yaml deck.opf.json.",
	"to-yaml": "opf to-yaml was removed in 0.18: use opf convert deck.opf.json deck.opf.yaml.",
	"import-data": "opf import-data was renamed opf ingest in 0.18.",
	lint: "opf lint was removed: use opf validate.",
	audit: "opf audit was removed: use opf validate.",
};

/** The edit distance of two short strings. */
function distance(a: string, b: string): number {
	const row = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		let previous = row[0] as number;
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const kept = row[j] as number;
			row[j] = Math.min((row[j] as number) + 1, (row[j - 1] as number) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
			previous = kept;
		}
	}
	return row[b.length] as number;
}

/** The nearest of `names` to `typed`, when it is close enough to be a typo (or one starts with the other). */
export function nearest(typed: string, names: readonly string[]): string | undefined {
	let best: string | undefined;
	let score = Infinity;
	for (const name of names) {
		const value = name.startsWith(typed) || typed.startsWith(name) ? Math.abs(name.length - typed.length) * 0.5 : distance(typed, name);
		if (value < score) [best, score] = [name, value];
	}
	return best !== undefined && score <= Math.max(1, Math.floor(Math.max(typed.length, best.length) / 3)) ? best : undefined;
}

const usageLine = (spec: CommandSpec) => spec.usage.map((line) => `  ${line}`).join("\n");

/** Parse a command's arguments. Returns `"help"` when `-h` or `--help` was given. */
export function parseArgs(spec: CommandSpec, args: readonly string[]): Parsed | "help" {
	const values = spec.values ?? [];
	const repeatedNames = spec.repeated ?? [];
	const flags = spec.flags ?? [];
	const known = [...values, ...repeatedNames, ...flags];
	const parsed: Parsed = { positional: [], options: Object.create(null), repeated: Object.create(null) };
	let literal = false;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] as string;
		if (literal || arg === "-" || !arg.startsWith("-")) {
			parsed.positional.push(arg);
			continue;
		}
		if (arg === "--") {
			literal = true;
			continue;
		}
		let key: string;
		let inline: string | undefined;
		if (arg.startsWith("--")) {
			const equals = arg.indexOf("=");
			key = equals > 2 ? arg.slice(2, equals) : arg.slice(2);
			inline = equals > 2 ? arg.slice(equals + 1) : undefined;
		} else {
			const letter = arg.slice(1);
			const long = SHORT[letter];
			if (!long || (long !== "help" && !known.includes(long))) throw usage(`Unknown option ${arg} for opf ${spec.name}. Run opf ${spec.name} --help.`, "unknown-option", { option: arg });
			key = long;
		}
		if (key === "help") return "help";
		if (!known.includes(key)) {
			const removed = REMOVED_OPTIONS[key];
			if (removed) throw usage(removed, "removed-option", { option: `--${key}` });
			if (key === "format" && !known.includes("format")) throw usage(`--format names a report format only (json, text, github, patch); opf ${spec.name} has none. Use --to json|yaml|md for the form of a deck${spec.name === "fill" || spec.name === "ingest" ? ", and --data-format csv|tsv|json for the data" : ""}.`, "unknown-option", { option: arg });
			if (key === "from" && spec.name === "create") throw usage("opf create --from was removed in 0.18: use opf convert <input> <output> to copy a deck into another form.", "removed-option", { option: "--from" });
			const guess = nearest(key, known);
			throw usage(`Unknown option --${key} for opf ${spec.name}.${guess ? ` Did you mean --${guess}?` : ""} Run opf ${spec.name} --help.`, "unknown-option", { option: `--${key}`, ...(guess ? { suggestion: `--${guess}` } : {}) });
		}
		const takesValue = values.includes(key) || repeatedNames.includes(key);
		if (!takesValue) {
			if (inline !== undefined) throw usage(`--${key} takes no value.`, "invalid-value", { option: `--${key}` });
			if (key in parsed.options) throw usage(`--${key} is given twice.`, "duplicate-option", { option: `--${key}` });
			parsed.options[key] = true;
			continue;
		}
		const value = inline ?? args[++index];
		if (value === undefined || (inline === undefined && value.startsWith("--"))) throw usage(`--${key} needs a value. Run opf ${spec.name} --help.`, "missing-value", { option: `--${key}` });
		if (repeatedNames.includes(key)) parsed.repeated[key] = [...(parsed.repeated[key] ?? []), value];
		else if (key in parsed.options) throw usage(`--${key} is given twice.`, "duplicate-option", { option: `--${key}` });
		else parsed.options[key] = value;
	}
	const [min, max] = spec.positional;
	const count = parsed.positional.length;
	if (count < min) {
		const missing = spec.operands?.[count];
		throw usage(`opf ${spec.name} needs ${missing ?? `${min} argument${min === 1 ? "" : "s"}`}. Usage:\n${usageLine(spec)}`, "missing-argument");
	}
	if (count > max) throw usage(`opf ${spec.name} takes at most ${max} argument${max === 1 ? "" : "s"}; got ${count} (${parsed.positional.slice(max).join(" ")} is extra). Usage:\n${usageLine(spec)}`, "extra-argument");
	return parsed;
}

/** Print `opf <name> --help`. */
export const printHelp = (spec: CommandSpec): void => void process.stdout.write(helpText(spec));

/** The text of `opf <name> --help`. */
export const helpText = (spec: CommandSpec) => `Usage:\n${usageLine(spec)}\n\n${spec.summary}\n\n${spec.help}\n`;

/** One of `allowed`, or a usage error naming them. */
export function oneOf<T extends string>(flag: string, value: string | true | undefined, allowed: readonly T[]): T | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || !allowed.includes(value as T)) {
		const guess = typeof value === "string" ? nearest(value, allowed) : undefined;
		throw usage(`${flag} must be one of: ${allowed.join(", ")}.${guess ? ` Did you mean ${guess}?` : ""}`, "invalid-value", { option: flag });
	}
	return value as T;
}
