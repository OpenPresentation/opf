// `@openpresentation/opf/node`: OPF files in Node. `convert` turns one file into another, the formats named by the file names
// (a deck to PDF, PNG, SVG or PPTX, a PowerPoint file to a deck, one deck form to another), or returns the bytes; `open` reads
// a deck file (or imports a PowerPoint file) and `save` writes one. The rest of core is re-exported, so one namespace import
// covers an application:
//
//   import * as opf from "@openpresentation/opf/node";
//   await opf.convert("deck.opf.md", "deck.pdf");
//   const deck = await opf.open("deck.opf.md");
//   deck.slides.push({ title: "Q4" });
//   await opf.save(deck, "deck.opf.md");
//
// Drawing and PowerPoint go through the optional peers @openpresentation/opf-render and @openpresentation/opf-pptx, loaded the
// first time a call needs them; a missing one throws `peer-not-installed` with the install command. Output is deterministic:
// no network, no system fonts, no clock unless `date` is passed. This entry is Node-only; the root and every other subpath
// stay free of the file system and run in a browser.
import type { Presentation } from "./index.js";
import { OPFValidationError } from "./validator.js";
import { type ConvertFormat, type ConvertInput, type ConvertOptions, type ConvertResult, type OpenOptions, type SaveOptions, type SaveResult, convertFiles, openDeck, saveDeck } from "./node/conversion.js";
import { OPFApiError, asApiError } from "./node/errors.js";

export * from "./index.js";
export { defaultCatalog } from "./catalog.js";
export { OPFApiError, OPFExportError, OPFImportError } from "./node/errors.js";
export type { ConvertFormat, ConvertInput, ConvertOptions, ConvertResult, ConvertedFile, OpenOptions, SaveOptions, SaveResult } from "./node/conversion.js";
export type { ExportFormat } from "./node/export.js";
export type { FontsHandle } from "./node/peers.js";

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
 * never fetched. Everything is produced before anything is written, and each file is written atomically; an existing output
 * needs `force: true`. Throws `OPFApiError` for the request and the files (`invalid-option`, `input-not-found`,
 * `input-unreadable`, `invalid-presentation`, `output-exists`, `output-not-file`, `output-unwritable`), `OPFImportError` for the
 * import step and `OPFExportError` for the export step (`peer-not-installed`, `peer-too-old`, `peer-load-failed`,
 * `invalid-presentation`, `no-slides`, `all-slides-hidden`, `export-failed`, `import-failed`).
 */
export async function convert(input: ConvertInput, output: string, options?: ConvertOptions): Promise<ConvertResult>;
export async function convert(input: ConvertInput, options: ConvertOptions & { format: ConvertFormat }): Promise<ConvertResult>;
export async function convert(input: ConvertInput, output: string | (ConvertOptions & { format: ConvertFormat }), options: ConvertOptions = {}): Promise<ConvertResult> {
	try {
		if (output !== null && typeof output === "object") return await convertFiles(input, undefined, output);
		if (typeof output !== "string") throw new OPFApiError("convert takes an output file path, or options with a format.", "invalid-option");
		return await convertFiles(input, output, options);
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
 */
export async function open(input: string | Uint8Array | ArrayBuffer, options: OpenOptions = {}): Promise<Presentation> {
	try {
		return await openDeck(input, options);
	} catch (error) {
		return rethrow(error, "input-unreadable");
	}
}

/**
 * Save a deck in the form its file name names (`.opf.md`, `.yaml`/`.yml` or `.json`), atomically, creating folders, replacing
 * the file. It is checked for format and references first and an invalid deck is refused with `OPFValidationError`;
 * `validate: false` writes work in progress, as an editor's autosave does. Returns `{ path, format }`.
 */
export async function save(deck: Presentation, path: string, options: SaveOptions = {}): Promise<SaveResult> {
	try {
		return await saveDeck(deck, path, options);
	} catch (error) {
		return rethrow(error, "output-unwritable");
	}
}
