// File helpers of the Node engine: output names and atomic writes (a temporary sibling, then a rename). The opf CLI uses the
// same functions through `@openpresentation/opf/internal/engine`. Slide selections are browser-safe, in ../slide-selection.ts.
import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { OPFApiError } from "../api-errors.js";

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

/**
 * A number written with leading zeros to the width of the largest number written, so the names sort as text: 1 to 9 give `1` to
 * `9`, 10 to 99 give `01` to `99`, 100 and up give `001`. One rule for `{n}` in an output pattern, for the numbered names of
 * slide files and zip entries, and for `opf fill`'s record numbers.
 */
export function padNumber(value: number, largest: number): string {
	return String(value).padStart(String(largest).length, "0");
}

const PLACEHOLDER = /\{([^{}]*)\}/g;

/** The `{key}` placeholders in an output path, in order. */
export function outputKeys(output: string): string[] {
	return [...output.matchAll(PLACEHOLDER)].map((match) => match[1] as string);
}

/**
 * Check the `{...}` placeholders of an output path. `perSlide` is true for a .png or .svg output (one file per slide), where `{n}`
 * (the slide number) is the one placeholder and any other `{key}` is refused (`invalid-option`). A single-file output (.pdf,
 * .pptx, .zip, a deck form) refuses `{n}`, since there is nothing to number. Returns whether the path is a pattern to expand.
 */
export function checkOutputPattern(output: string, perSlide: boolean): boolean {
	const keys = outputKeys(output);
	if (!perSlide) {
		if (keys.includes("n")) throw new OPFApiError(`{n} numbers the files of a .png or .svg output, one per slide; ${output} is a single file. Name the file without {n}.`, "invalid-option", { details: { path: output } });
		return false;
	}
	const unknown = keys.find((key) => key !== "n");
	if (unknown !== undefined) throw new OPFApiError(`Unknown {${unknown}} in the output ${output}: the only placeholder is {n}, the slide number.`, "invalid-option", { details: { path: output, key: unknown } });
	return keys.length > 0;
}

/** The output path with `{n}` replaced by the slide number, padded to the width of `largest`. */
export function expandOutputPattern(output: string, slide: number, largest: number): string {
	return output.replace(PLACEHOLDER, () => padNumber(slide, largest));
}

export interface PlannedFile {
	file: string;
	bytes: Uint8Array;
}

/**
 * Fail before writing anything when a destination exists (the commands without --force; `convert` with `overwrite: false`), is a symlink or is
 * not a regular file: `output-exists` and `output-not-file`, which the commands report at exit 1. `flags` false words the
 * message for the library API.
 */
export async function checkDestinations(files: string[], overwrite: boolean, flags = true) {
	for (const file of files) {
		try {
			const stat = await lstat(file);
			if (!overwrite) throw new OPFApiError(`Output already exists: ${file}. ${flags ? "Use --force." : "Pass overwrite: true (the default) to replace it."}`, "output-exists", { details: { path: file } });
			if (!stat.isFile()) throw new OPFApiError(`Refusing to replace a symlink or non-regular file${flags ? "" : `: ${file}`}.`, "output-not-file", { details: { path: file } });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
}

/** Write each file through a temporary sibling and a rename, so no partial output is ever published under its final name. */
export async function writeFiles(files: PlannedFile[], overwrite: boolean, flags = true) {
	const unique = new Set(files.map((entry) => path.resolve(entry.file)));
	if (unique.size !== files.length) throw new OPFApiError("Two outputs would write the same file.", "invalid-option");
	await checkDestinations([...unique], overwrite, flags);
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

export function pointerOf(location: string): string {
	if (location === "" || location.startsWith("/")) return location;
	// Renderer and importer paths are dotted (`slides.0.title`); validate uses JSON Pointers.
	return /^[A-Za-z_$][\w$-]*(\.[\w$-]+)*$/.test(location) ? `/${location.split(".").join("/")}` : location;
}

