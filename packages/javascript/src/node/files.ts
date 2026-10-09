// File helpers of the Node engine (`@openpresentation/opf/node`): slide selections, output names, and atomic writes (a
// temporary sibling, then a rename). The opf CLI uses the same functions through `@openpresentation/opf/node/engine`.
import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { OPFApiError } from "./errors.js";

/** `1,3-5`, `2-` (to the end) and `-3` (from the start), one-based, in ascending order without repeats. */
export function parseSlideSelection(spec: string, total: number, label = "--slides"): number[] {
	if (total < 1) throw new OPFApiError("The presentation has no slides.", "no-slides");
	const chosen = new Set<number>();
	for (const part of spec.split(",")) {
		const text = part.trim();
		const match = /^(\d*)(-?)(\d*)$/.exec(text);
		if (!text || !match || (!match[1] && !match[3])) throw new OPFApiError(`${label} needs numbers like 1,3-5 (got "${spec}").`, "invalid-option");
		const [, from, dash, to] = match as unknown as [string, string, string, string];
		const first = from ? Number(from) : 1;
		const last = dash ? (to ? Number(to) : total) : first;
		if (first < 1 || last < first) throw new OPFApiError(`${label} range "${text}" is not valid (slides count from 1).`, "invalid-option");
		if (last > total) throw new OPFApiError(`${label} ${text} is outside the presentation, which has ${total} slide${total === 1 ? "" : "s"}.`, "invalid-option");
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

/**
 * Fail before writing anything when a destination exists (without --force, the `force` option of the API), is a symlink or is
 * not a regular file: `output-exists` and `output-not-file`, which the commands report at exit 1. `flags` false words the
 * message for the library API.
 */
export async function checkDestinations(files: string[], overwrite: boolean, flags = true) {
	for (const file of files) {
		try {
			const stat = await lstat(file);
			if (!overwrite) throw new OPFApiError(`Output already exists: ${file}. ${flags ? "Use --force." : "Pass force: true to replace it."}`, "output-exists", { details: { path: file } });
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

