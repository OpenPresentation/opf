// Shared plumbing for the commands that produce and read files: render, export and import.
// They live outside index.ts so concurrent command work does not collide; index.ts only dispatches here.
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { OPFApiError } from "@openpresentation/opf/node/engine";

export { type PlannedFile, checkDestinations, deckStem, parseSlideSelection, pointerOf, stemOf, writeFiles } from "@openpresentation/opf/node/engine";

/** Exit 2 is a usage, I/O or environment problem; exit 1 is a document, diagnostic or conflict problem. */
export class FileCommandError extends Error {
	constructor(
		message: string,
		readonly code = 2,
		readonly extra: Record<string, unknown> = {},
	) {
		super(message);
	}
}

/**
 * Whether two paths name the same file (RR-66). Comparing resolved strings misses a file named in another case on a
 * case-insensitive file system (Windows, and macOS by default: `deck.json` and `Deck.json`), so two existing paths are compared
 * by file identity; a path that does not exist yet is compared by its resolved text, without case on Windows.
 */
export function samePath(a: string, b: string): boolean {
	const left = path.resolve(a),
		right = path.resolve(b);
	if (left === right) return true;
	try {
		const one = statSync(left, { bigint: true }),
			two = statSync(right, { bigint: true });
		// Some network file systems report no file id (0): compare the text then.
		if (one.ino !== 0n && two.ino !== 0n) return one.dev === two.dev && one.ino === two.ino;
	} catch {
		// A path that does not exist (yet): compare the text.
	}
	return process.platform === "win32" && left.toLowerCase() === right.toLowerCase();
}

/** The data format a file name stands for (`.json`, `.tsv`, `.csv`, any case: `DATA.TSV` is TSV), else undefined. */
export function dataFormatOf(file: string): "json" | "tsv" | "csv" | undefined {
	const extension = path.extname(file).toLowerCase();
	return extension === ".json" ? "json" : extension === ".tsv" ? "tsv" : extension === ".csv" ? "csv" : undefined;
}

export const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export interface OptionSpec {
	/** Options that take one value. */
	values: string[];
	/** Options that take a value and may repeat. */
	repeated?: string[];
	/** Options without a value. */
	flags: string[];
}

/** Same rules as the other commands: unknown or duplicate options and a missing value are usage errors; `--` ends options. */
export function parseOptions(args: string[], spec: OptionSpec) {
	const positional: string[] = [];
	const options: Record<string, string | boolean> = Object.create(null);
	const repeated: Record<string, string[]> = Object.create(null);
	let literal = false;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i] as string;
		if (arg === "--" && !literal) {
			literal = true;
			continue;
		}
		if (!literal && arg.startsWith("--")) {
			const key = arg.slice(2);
			const isValue = spec.values.includes(key);
			const isRepeated = spec.repeated?.includes(key) ?? false;
			if (!isValue && !isRepeated && !spec.flags.includes(key)) throw new FileCommandError(`Unknown or duplicate option: ${arg}`);
			if (isValue || isRepeated) {
				const value = args[++i];
				if (value === undefined || value.startsWith("--")) throw new FileCommandError(`${arg} needs a value.`);
				if (isRepeated) repeated[key] = [...(repeated[key] ?? []), value];
				else if (key in options) throw new FileCommandError(`Unknown or duplicate option: ${arg}`);
				else options[key] = value;
			} else if (key in options) throw new FileCommandError(`Unknown or duplicate option: ${arg}`);
			else options[key] = true;
		} else positional.push(arg);
	}
	return { positional, options, repeated };
}

export function arity(args: string[], min: number, max = min) {
	if (args.length < min || args.length > max) throw new FileCommandError("Incorrect arguments. Run opf --help.");
}

export async function readStdin(): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

export async function readBytes(file: string): Promise<{ bytes: Uint8Array; name: string }> {
	if (file === "-") return { bytes: new Uint8Array(await readStdin()), name: "stdin" };
	try {
		return { bytes: new Uint8Array(await readFile(file)), name: file };
	} catch (error) {
		throw new FileCommandError(`Cannot read ${file}: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}.`);
	}
}

/** An API error of the engines as the command's failure: exit 1 for a state of the document, 2 for the request or the environment; the error report names the code unless it is a plain usage error. */
export function commandError(error: OPFApiError): FileCommandError {
	const document = ["invalid-presentation", "no-slides", "all-slides-hidden", "export-failed", "import-failed", "output-exists", "output-not-file"].includes(error.code);
	const plain = ["invalid-option", "no-slides", "all-slides-hidden", "output-exists", "output-not-file"].includes(error.code);
	return new FileCommandError(error.message, document ? 1 : 2, plain ? {} : { code: error.code, ...error.details });
}
