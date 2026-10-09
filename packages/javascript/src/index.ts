// `@openpresentation/opf` in Node, Bun and Deno (RR-70): core, plus the file API. `convert` turns one file into another, the formats
// named by the file names (a deck to PDF, PNG, SVG or PPTX, a PowerPoint file to a deck, one deck form to another), or returns the
// bytes; `open` reads a deck file (or imports a PowerPoint file) and `save` writes one. One namespace import covers an application,
// in every runtime:
//
//   import * as opf from "@openpresentation/opf";
//   await opf.convert("deck.opf.md", "deck.pdf");
//   const deck = await opf.open("deck.opf.md");
//   deck.slides.push({ title: "Q4" });
//   await opf.save(deck, "deck.opf.md");
//
// The package's conditional exports give this build to the `node`, `bun` and `deno` conditions and the browser-safe build
// (./browser.ts, the same names, where `open`, `save` and `convert` reject with `node-only`) to `browser`, `worker`, `workerd`
// and `default`. This file's declarations are the one type surface of both.
//
// Drawing and PowerPoint go through the optional peers @openpresentation/opf-render and @openpresentation/opf-pptx, loaded the
// first time a call needs them; a missing one throws `peer-not-installed` with the install command. The Node engine itself
// (./node/, which reads files and registers the default catalog) is loaded on the first call too, so importing the root costs no
// more than core. Output is deterministic: no network, no system fonts, no clock unless `date` is passed.
import type { Presentation } from "./core.js";
import { OPFApiError, asApiError } from "./api-errors.js";
import type { ConvertFormat, ConvertInput, ConvertOptions, ConvertResult, OpenOptions, SaveOptions, SaveResult } from "./node/conversion.js";
import { OPFValidationError } from "./validator.js";

export * from "./core.js";
export type { ConvertFormat, ConvertInput, ConvertOptions, ConvertResult, ConvertedFile, OpenOptions, SaveOptions, SaveResult } from "./node/conversion.js";
export type { ExportFormat } from "./node/export.js";
export type { FontsHandle } from "./node/peers.js";

/** The Node engine, loaded on the first file call. */
const engine = () => import("./node/conversion.js");

const rethrow = (error: unknown, fallback: string): never => {
	if (error instanceof OPFValidationError) throw error;
	throw asApiError(OPFApiError, error, fallback);
};

/**
 * Convert a file, a deck or the bytes of a `.pptx` file. With an `output` path the format comes from its extension and the
 * files are written: `.pdf`, `.pptx`, `.png` and `.svg` are exported (one PNG or SVG per slide, `slides/deck.png` giving
 * `slides/deck-001.png`, ...; one selected slide is written to `output` itself), `.zip` is one archive of the slides (`format`
 * `png`, the default, or `svg`), and `.opf.md`, `.yaml`/`.yml` or `.json` writes the deck in that form. Without an output path,
 * pass `{ format }`: nothing is written and the files come back with their names and bytes.
 *
 * A `.pptx` input is imported first. Local images resolve next to the input file unless `assetDir` says otherwise; URLs are
 * never fetched. Everything is produced before anything is written, and each file is written atomically, replacing an existing
 * output (`overwrite: false` refuses one with `output-exists`, as the commands do without `--force`). Throws `OPFApiError` for the request and the files (`invalid-option`, `input-not-found`,
 * `input-unreadable`, `invalid-presentation`, `output-exists`, `output-not-file`, `output-unwritable`), `OPFImportError` for the
 * import step and `OPFExportError` for the export step (`peer-not-installed`, `peer-too-old`, `peer-load-failed`,
 * `invalid-presentation`, `no-slides`, `all-slides-hidden`, `export-failed`, `import-failed`).
 *
 * Node only (also Bun and Deno): the browser build of the root rejects with `OPFApiError` `node-only`.
 */
export async function convert(input: ConvertInput, output: string, options?: ConvertOptions): Promise<ConvertResult>;
export async function convert(input: ConvertInput, options: ConvertOptions & { format: ConvertFormat }): Promise<ConvertResult>;
export async function convert(input: ConvertInput, output: string | (ConvertOptions & { format: ConvertFormat }), options: ConvertOptions = {}): Promise<ConvertResult> {
	try {
		if (output !== null && typeof output === "object") return await (await engine()).convertFiles(input, undefined, output);
		if (typeof output !== "string") throw new OPFApiError("convert takes an output file path, or options with a format.", "invalid-option");
		return await (await engine()).convertFiles(input, output, options);
	} catch (error) {
		return rethrow(error, "convert-failed");
	}
}

/**
 * Open a deck: a `.opf.md`, `.yaml`/`.yml` or `.json` file (the form named by the extension), or a PowerPoint file (a `.pptx`
 * path or its bytes), imported. Returns the presentation. A deck file that fails the format and references check throws
 * `OPFValidationError` (its findings located by line and column in the file); a PowerPoint file that cannot be imported throws
 * `OPFImportError`; a missing file throws `OPFApiError` `input-not-found`. Warnings are not returned: `validate` reports them,
 * and `convert("deck.pptx", "deck.opf.yaml")` returns what an import could not keep.
 *
 * Node only (also Bun and Deno): the browser build of the root rejects with `OPFApiError` `node-only`.
 */
export async function open(input: string | Uint8Array | ArrayBuffer, options: OpenOptions = {}): Promise<Presentation> {
	try {
		return await (await engine()).openDeck(input, options);
	} catch (error) {
		return rethrow(error, "input-unreadable");
	}
}

/**
 * Save a deck in the form its file name names (`.opf.md`, `.yaml`/`.yml` or `.json`), atomically, creating folders, replacing
 * the file. It is checked for format and references first and an invalid deck is refused with `OPFValidationError`;
 * `validate: false` writes work in progress, as an editor's autosave does. Returns `{ path, format }`.
 *
 * Node only (also Bun and Deno): the browser build of the root rejects with `OPFApiError` `node-only`.
 */
export async function save(deck: Presentation, path: string, options: SaveOptions = {}): Promise<SaveResult> {
	try {
		return await (await engine()).saveDeck(deck, path, options);
	} catch (error) {
		return rethrow(error, "output-unwritable");
	}
}
