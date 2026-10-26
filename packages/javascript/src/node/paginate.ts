// Measured pagination for `opf paginate` (RR-75): the page breaks `convert` with `paginate: true` chooses, with the same fonts
// (opf-render's office pack, prepared once per process and shared, plus any `fonts` folders). Without opf-render or its font
// packages the command still paginates with core's portable estimate and says so (`layout: "estimated"`, and the reason).
import { type Catalog, type Fonts, type PresentationPaginationResult, paginate } from "../core.js";
import { OPFApiError } from "../api-errors.js";
import { defaultCatalogs } from "./catalogs.js";
import { leaseSharedFonts, listFontDirectories, prepareFonts } from "./fonts.js";
import { loadRenderer } from "./peers.js";
import type { Reporter } from "./reporter.js";

export interface PaginateDeckOptions {
	/** Folders of `.ttf` and `.otf` files, loaded before the bundled pack (as `--fonts`). They need opf-render. */
	fontFolders?: readonly string[];
	catalogs?: readonly Catalog[];
	/** Receives the font diagnostics. */
	reporter: Reporter;
	/** Name options as the command's flags in messages. */
	flags?: boolean;
}

export interface PaginatedDeck {
	result: PresentationPaginationResult;
	/** Why the layout is estimated: the missing or too old peer (`peer-not-installed`, `peer-too-old`) that measuring needs. */
	estimated?: OPFApiError;
}

/**
 * Paginate with measured text when opf-render and its fonts load, else with core's estimate (and `estimated` saying why). With
 * `fontFolders` the fonts are required, so a missing renderer throws. Throws `OPFPaginationError` when content cannot fit.
 */
export async function paginateDeck(deck: unknown, options: PaginateDeckOptions): Promise<PaginatedDeck> {
	const catalogs = options.catalogs ?? defaultCatalogs();
	const measuring = await measuringFonts(deck, options);
	try {
		return { result: paginate(deck, { ...(measuring.fonts ? { fonts: measuring.fonts } : {}), catalogs }), ...(measuring.estimated ? { estimated: measuring.estimated } : {}) };
	} finally {
		measuring.release();
	}
}

export interface MeasuringFontsOptions {
	/** Folders of `.ttf` and `.otf` files, loaded before the bundled pack (as `--fonts`). They need opf-render. */
	fontFolders?: readonly string[];
	/** Receives the font diagnostics. */
	reporter: Reporter;
	/** Name options as the command's flags in messages. */
	flags?: boolean;
}

export interface MeasuringFonts {
	/** The fonts `opf convert` draws `deck` with; absent when the layout can only be estimated. */
	fonts?: Fonts;
	/** Why there are no fonts: the missing or too old peer (`peer-not-installed`, `peer-too-old`) that measuring needs. */
	estimated?: OPFApiError;
	/** Returns a shared handle; call it when the measurement is done. */
	release(): void;
}

/**
 * The fonts the CLI measures a deck with (`opf paginate`, `opf validate`; WI-1, P24): opf-render's office pack, prepared once per
 * process and shared, plus any `fontFolders`, as `opf convert` draws. Without opf-render (or with one too old) the result has no
 * fonts and says why in `estimated`. With `fontFolders` the fonts are required, so a missing renderer throws.
 */
export async function measuringFonts(deck: unknown, options: MeasuringFontsOptions): Promise<MeasuringFonts> {
	const folders = options.fontFolders ?? [];
	try {
		const renderer = await loadRenderer();
		const userFonts = await listFontDirectories([...folders], options.flags ? "--fonts" : "fonts");
		const lease = await leaseSharedFonts(renderer, deck, userFonts, options.reporter);
		const handle = lease?.handle ?? (await prepareFonts(renderer, deck, userFonts, options.reporter)).handle;
		return { fonts: handle as Fonts, release: () => lease?.release() };
	} catch (error) {
		if (error instanceof OPFApiError && (error.code === "peer-not-installed" || error.code === "peer-too-old") && !folders.length) return { estimated: error, release: () => {} };
		throw error;
	}
}
