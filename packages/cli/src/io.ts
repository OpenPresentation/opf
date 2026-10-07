// Shared plumbing for the commands that produce and read files: render, export and import.
// They live outside index.ts so concurrent command work does not collide; index.ts only dispatches here.
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

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

/** `1,3-5`, `2-` (to the end) and `-3` (from the start), one-based, in ascending order without repeats. */
export function parseSlideSelection(spec: string, total: number): number[] {
	if (total < 1) throw new FileCommandError("The presentation has no slides.", 1);
	const chosen = new Set<number>();
	for (const part of spec.split(",")) {
		const text = part.trim();
		const match = /^(\d*)(-?)(\d*)$/.exec(text);
		if (!text || !match || (!match[1] && !match[3])) throw new FileCommandError(`--slides needs numbers like 1,3-5 (got "${spec}").`);
		const [, from, dash, to] = match as unknown as [string, string, string, string];
		const first = from ? Number(from) : 1;
		const last = dash ? (to ? Number(to) : total) : first;
		if (first < 1 || last < first) throw new FileCommandError(`--slides range "${text}" is not valid (slides count from 1).`);
		if (last > total) throw new FileCommandError(`--slides ${text} is outside the presentation, which has ${total} slide${total === 1 ? "" : "s"}.`);
		for (let n = first; n <= last; n++) chosen.add(n);
	}
	return [...chosen].sort((a, b) => a - b);
}

/** `deck.opf.json` and `deck.pptx` both give `deck`; stdin gives `deck`. */
export function stemOf(input: string) {
	if (input === "-") return "deck";
	return path.basename(input).replace(/\.opf\.json$/i, "").replace(/\.(json|pptx|potx)$/i, "") || "deck";
}

/**
 * The base name of render and export output files: the deck's `filename` (a trailing .pptx, .pdf, .png or .svg is dropped, any
 * case), else the slugified `name`, else the input file's stem. The same rule opf-editor names its downloads by. Characters a file
 * system rejects are replaced, so the name is safe to write.
 */
export function deckStem(deck: unknown, input: string) {
	const root = deck && typeof deck === "object" && !Array.isArray(deck) ? (deck as { filename?: unknown; name?: unknown }) : {};
	const clean = (value: string) =>
		value
			.replace(/[/:*?"<>|\p{Cc}]+/gu, "-")
			.replace(/\s+/g, "-")
			.replace(/-{2,}/g, "-")
			.replace(/^[-.\s]+|[-.\s]+$/g, "");
	const text = (value: unknown) => (typeof value === "string" ? value : "");
	const slug = (value: string) => value.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
	return clean(text(root.filename).trim().replace(/\.(pptx|pdf|png|svg)$/i, "")) || slug(text(root.name)) || stemOf(input);
}

export interface PlannedFile {
	file: string;
	bytes: Uint8Array;
}

/** Fail before writing anything when a destination exists (no --force), is a symlink or is not a regular file. */
export async function checkDestinations(files: string[], overwrite: boolean) {
	for (const file of files) {
		try {
			const stat = await lstat(file);
			if (!overwrite) throw new FileCommandError(`Output already exists: ${file}. Use --force.`, 1);
			if (!stat.isFile()) throw new FileCommandError("Refusing to replace a symlink or non-regular file.", 1);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
}

/** Write each file through a temporary sibling and a rename, so no partial output is ever published under its final name. */
export async function writeFiles(files: PlannedFile[], overwrite: boolean) {
	const unique = new Set(files.map((entry) => path.resolve(entry.file)));
	if (unique.size !== files.length) throw new FileCommandError("Two outputs would write the same file.");
	await checkDestinations([...unique], overwrite);
	const staged: { temporary: string; output: string }[] = [];
	try {
		for (const entry of files) {
			const output = path.resolve(entry.file);
			await mkdir(path.dirname(output), { recursive: true });
			const temporary = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.tmp`);
			await writeFile(temporary, entry.bytes, { flag: "wx" });
			staged.push({ temporary, output });
		}
		for (const item of staged) {
			await rename(item.temporary, item.output);
			item.temporary = "";
		}
	} finally {
		for (const item of staged) if (item.temporary) await unlink(item.temporary).catch(() => undefined);
	}
}

export async function readBytes(file: string): Promise<{ bytes: Uint8Array; name: string }> {
	if (file === "-") return { bytes: new Uint8Array(await readStdin()), name: "stdin" };
	try {
		return { bytes: new Uint8Array(await readFile(file)), name: file };
	} catch (error) {
		throw new FileCommandError(`Cannot read ${file}: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}.`);
	}
}

export function pointerOf(location: string): string {
	if (location === "" || location.startsWith("/")) return location;
	// Renderer and importer paths are dotted (`slides.0.title`); validate uses JSON Pointers.
	return /^[A-Za-z_$][\w$-]*(\.[\w$-]+)*$/.test(location) ? `/${location.split(".").join("/")}` : location;
}
