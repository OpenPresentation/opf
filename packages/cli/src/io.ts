// Files and streams for every command: reading an input (a path or `-` for stdin), writing text atomically, and the facts a
// report gives about a file (SHA-256, size).
import { createHash, randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { link, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CliError } from "./errors.js";

export { type PlannedFile, deckStem, parseSlideSelection, pointerOf, stemOf, writeFiles } from "@openpresentation/opf/internal/engine";

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
export const byteLength = (value: string | Uint8Array) => (typeof value === "string" ? Buffer.byteLength(value) : value.length);

let stdinTaken = false;

/** All of stdin. A command reads it at most once: a second `-` is a usage error. */
export async function readStdin(): Promise<Buffer> {
	if (stdinTaken) throw new CliError("stdin can supply only one input.", "usage");
	stdinTaken = true;
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

/** A file's bytes, or stdin's for `-`. A missing file is `input-not-found` (exit 2). */
export async function readBytes(file: string): Promise<Uint8Array> {
	if (file === "-") return new Uint8Array(await readStdin());
	try {
		return new Uint8Array(await readFile(file));
	} catch (error) {
		const reason = (error as NodeJS.ErrnoException).code ?? (error as Error).message;
		const missing = reason === "ENOENT" || reason === "ENOTDIR";
		throw new CliError(`Cannot read ${file}: ${missing ? "no such file" : reason}.`, missing ? "input-not-found" : "input-unreadable", 2, { file });
	}
}

/** A file's text (UTF-8, a BOM kept), or stdin's for `-`. */
export async function readText(file: string): Promise<string> {
	return Buffer.from(await readBytes(file)).toString("utf8");
}

/** Refuse an existing output unless `overwrite` (exit 1, `output-exists`), and a symlink or non-regular file always. Run before anything is printed or written. */
export async function checkOutput(file: string, overwrite: boolean): Promise<void> {
	try {
		const stat = await lstat(path.resolve(file));
		if (!stat.isFile()) throw new CliError(`Refusing to replace ${file}: it is a symlink, a directory or another non-regular file.`, "output-not-file", 1, { file });
		if (!overwrite) throw new CliError(`Output already exists: ${file}. Use --force to replace it.`, "output-exists", 1, { file });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}

/**
 * Write text atomically (a temporary sibling, then a rename or a link), creating folders. `overwrite` must be true to replace an
 * existing file; `original` refuses the write when the input changed since it was read (an edit in place).
 */
export async function saveText(file: string, text: string | Uint8Array, overwrite: boolean, original?: { file: string; raw: string }): Promise<void> {
	const output = path.resolve(file);
	const temporary = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.tmp`);
	let mode: number | undefined;
	try {
		const stat = await lstat(output);
		if (!stat.isFile()) throw new CliError(`Refusing to replace ${file}: it is a symlink, a directory or another non-regular file.`, "output-not-file", 1, { file });
		if (!overwrite) throw new CliError(`Output already exists: ${file}. Use --force to replace it.`, "output-exists", 1, { file });
		mode = stat.mode;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	await mkdir(path.dirname(output), { recursive: true });
	try {
		await writeFile(temporary, text, { flag: "wx", mode });
		if (original && (await readFile(original.file, "utf8")) !== original.raw) throw new CliError("The input changed while it was being edited; read it again and retry.", "input-changed", 1, { file: original.file });
		if (overwrite) await rename(temporary, output);
		else {
			// A link publishes a complete file without replacing an output created concurrently.
			try {
				await link(temporary, output);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new CliError(`Output already exists: ${file}.`, "output-exists", 1, { file });
				throw error;
			}
		}
	} finally {
		await unlink(temporary).catch((error) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}
