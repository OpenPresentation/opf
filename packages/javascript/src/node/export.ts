// The one export engine: a checked OPF presentation to per-slide SVG and PNG, a PDF or a PPTX through the optional peers
// opf-render and opf-pptx (see peers.ts). `convert` of `@openpresentation/opf` (conversion.ts) and the CLI's
// `opf convert` run `runExport`: the command adds what is about files and flags (reading
// the document, the located check, the output, atomic writes, the JSON report, exit codes), the function adds nothing but a check.
//
// Output is deterministic: no network, no system fonts, no clock unless `date` is given, bundled fonts plus the files the
// caller names, so the same presentation gives the same bytes on every machine.
import { statSync } from "node:fs";
import path from "node:path";
import { type Catalog, type Fonts, paginate } from "../core.js";
import { createImageResolver } from "./assets.js";
import { DEFAULT_CATALOGS } from "./catalogs.js";
import { OPFApiError } from "../api-errors.js";
import { embeddedFor, leaseSharedFonts, listFontDirectories, prepareFonts, substitutionRows } from "./fonts.js";
import { type SlideSelection, parseSlideSelection } from "../slide-selection.js";
import { deckStem, padNumber } from "./files.js";
import { type Diagnostic, type FontsHandle, PPTX_PACKAGE, type Peer, type PptxModule, RENDER_PACKAGE, type Renderer, loadPptx, loadRenderer, missingPeerFrom } from "./peers.js";
import { Reporter, reportThrown } from "./reporter.js";
import { createZip } from "./zip.js";

export type ExportFormat = "svg" | "png" | "pdf" | "pptx";
export const EXPORT_FORMATS: readonly ExportFormat[] = ["svg", "png", "pdf", "pptx"];
/** How an SVG carries its text (RR-74): the faces the slide uses embedded (`fonts`, the default), none (`system`) or glyph outlines (`paths`). */
export type ExportText = "fonts" | "system" | "paths";
export const EXPORT_TEXT: readonly ExportText[] = ["fonts", "system", "paths"];

/** A fonts object that loads nothing: an SVG picture without text needs no faces, so its PNG fallback skips the font files. */
const NO_FONTS = { fontFiles: [], useBundledFonts: false, loadSystemFonts: false } as const;

export interface ExportOptions {
	/** What to write. `svg` and `png` give one file per slide (or one zip), `pdf` and `pptx` one file. */
	format: ExportFormat;
	/**
	 * The fonts: a prepared handle (`loadFonts()` of `@openpresentation/opf-render/fonts-node`), reused across calls, or a folder or
	 * folders of `.ttf` and `.otf` files to load before the bundled pack (not recursive). Omitted: the bundled open font pack.
	 */
	fonts?: FontsHandle | string | readonly string[];
	/** The catalogs the presentation's references resolve in. Omitted: core's default catalog. */
	catalogs?: readonly Catalog[];
	/** The slides to write, one-based: a number, numbers or a selection such as `"1,3-5"` (`parseSlideSelection`). Omitted: every slide that is not hidden. Not for `pptx`. */
	slides?: SlideSelection;
	/** Write hidden slides too (`svg`, `png`, `pdf`). */
	includeHidden?: boolean;
	/** Split overflowing slides with the same fonts before drawing, as `opf paginate` does. */
	paginate?: boolean;
	/** Pixel scale of `png` and of a raster `pdf` (0.1 to 8; 1 draws the 1280 x 720 reference slide at 1280 x 720 pixels). */
	scale?: number;
	/** `pdf`: draw each slide as a picture (`true`) instead of selectable vector text (the default). */
	raster?: boolean;
	/**
	 * `svg`: how the text is carried. `fonts` (the default) embeds the faces the slide's text uses; `system` embeds none, for a page that
	 * already has the fonts; `paths` draws the text as glyph outlines, so the file needs no font.
	 */
	text?: ExportText;
	/** `pptx`: native charts (`native`), pictures (`picture`) or opf-pptx's choice (`auto`, the default). */
	charts?: "auto" | "native" | "picture";
	/** `pptx`: what the file records about where media came from. */
	provenance?: "full" | "references-only" | "none";
	/** `pptx`: keep images as they are (`preserve`) or convert them for older PowerPoint (`compatible`). */
	images?: "compatible" | "preserve";
	/** `YYYY-MM-DD`, for date fields that show today's date. Nothing reads a clock: without it such a field reports `date-needs-value`. */
	date?: string;
	/** The directory a presentation's relative image paths resolve against. Omitted: no local file is read (data URIs and remote references work as the engines handle them). */
	assetDir?: string;
	/** `svg` and `png`: one zip of the slides instead of one file per slide. */
	zip?: boolean;
	/** The base name of the files (`name-1.png` for slide 1, padded to the largest slide number written; `name.pdf`). Omitted: the presentation's `filename`, else its slugified `name`, else `deck`. */
	name?: string;
}

export interface ExportFile {
	/** The file name: `options.name`, else the presentation's `filename`, else its slugified `name`, else `deck`, then `-1.png` for slide 1 and so on, padded to the largest slide number written. */
	name: string;
	/** The media type. */
	type: string;
	bytes: Uint8Array;
	/** `svg` and `png`: the slide number (one-based) and its id. */
	slide?: number;
	id?: string;
	/** `svg` and `png`: the picture's size in pixels. */
	width?: number;
	height?: number;
	/** `pdf`: the number of pages and the slide numbers they show. */
	pages?: number;
	slides?: number[];
	/** `zip`: the names of the entries. */
	entries?: string[];
}

export interface ExportFontSummary {
	pack: "office";
	substitutionPolicy: "visual";
	/** The `fonts` folder files, in load order. */
	userFonts: string[];
	substitutions: { requested: string; resolved: string; compatibility: string }[];
	scripts?: unknown;
}

export interface ExportRun {
	files: ExportFile[];
	fonts?: ExportFontSummary;
	pagination?: { pages: unknown };
	pdf?: { mode: "vector" | "raster" };
	skippedHidden: number[];
	/** Set when drawing or paginating threw: the reporter holds the error finding and `files` is empty. */
	failure?: { code: string; message: string };
}

/** What a caller that has already done some of the work passes in, so the engine does not repeat it. */
export interface ExportContext {
	reporter: Reporter;
	renderer?: Renderer;
	pptx?: Peer<PptxModule>;
	/** Absolute font file paths already listed from the `fonts` folders. */
	userFonts?: string[];
	/** Name options as the command line does (`--slides`, `--fonts`, `--asset-dir`) in the messages of errors the engine throws. */
	flags?: boolean;
}

const invalid = (message: string) => new OPFApiError(message, "invalid-option");
const oneOf = <T extends string>(name: string, value: unknown, allowed: readonly T[]): T | undefined => {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || !allowed.includes(value as T)) throw invalid(`${name} must be one of: ${allowed.join(", ")}.`);
	return value as T;
};

/** `YYYY-MM-DD` and a real calendar date, or undefined. `label` names the option in the message (`--date` for the command, `date` for the function). */
export function checkDate(value: unknown, label = "date"): string | undefined {
	if (value === undefined) return undefined;
	const text = String(value);
	const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : undefined;
	if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw invalid(`${label} must be a real calendar date, YYYY-MM-DD.`);
	return text;
}

/** A scale from 0.1 to 8, 1 when absent. */
export function checkScale(value: unknown, label = "scale"): number {
	if (value === undefined) return 1;
	const scale = Number(value);
	if (typeof value === "boolean" || !Number.isFinite(scale) || scale < 0.1 || scale > 8) throw invalid(`${label} must be a number from 0.1 to 8 (1 draws the 1280 x 720 reference slide at 1280 x 720 pixels).`);
	return scale;
}

/** The 0.17 option names, which 0.18 removed without aliases (RR-74): a call that still passes one is refused, naming the new option, rather than silently drawing the default. */
const RENAMED = {
	svgFonts: "text (\"fonts\", \"system\" or \"paths\")",
	pdfMode: "raster (true for a picture PDF)",
	chartex: "charts (\"auto\", \"native\" or \"picture\")",
	imageFormat: "images",
	fontDirs: "fonts (a folder or a list of folders)",
	filename: "name",
} as const;

/** Throws `invalid-option` when `options` uses a name 0.18 renamed. */
export function checkRenamedOptions(options: object): void {
	for (const [old, replacement] of Object.entries(RENAMED)) if (old in options) throw invalid(`${old} was renamed ${replacement} in 0.18.`);
}

/** The options of a call as the engine reads them: checked, with defaults, and `fonts` split into the handle or the folders. */
export interface ResolvedExportOptions extends Omit<ExportOptions, "fonts" | "text" | "scale"> {
	format: ExportFormat;
	text: ExportText;
	scale: number;
	/** `fonts`, when it is a prepared handle. */
	fonts?: FontsHandle;
	/** `fonts`, when it names folders. */
	fontFolders: string[];
}

const isHandle = (value: unknown): value is FontsHandle => !!value && typeof value === "object" && !Array.isArray(value);

/** The options of a call, checked against each other. Throws `invalid-option` (an OPFApiError) for a value out of range or an option that does not apply to the format. */
export function resolveExportOptions(options: ExportOptions): ResolvedExportOptions {
	if (!options || typeof options !== "object") throw invalid("An export needs options with a format: svg, png, pdf or pptx.");
	checkRenamedOptions(options);
	const format = oneOf("format", options.format, EXPORT_FORMATS);
	if (!format) throw invalid("An export needs options.format: svg, png, pdf or pptx.");
	if (options.raster !== undefined && typeof options.raster !== "boolean") throw invalid("raster must be true or false.");
	const charts = oneOf("charts", options.charts, ["auto", "native", "picture"] as const);
	const provenance = oneOf("provenance", options.provenance, ["full", "references-only", "none"] as const);
	const images = oneOf("images", options.images, ["compatible", "preserve"] as const);
	const text = oneOf("text", options.text, EXPORT_TEXT);
	if (options.raster && format !== "pdf") throw invalid("raster applies to format pdf.");
	if ((charts !== undefined || provenance !== undefined || images !== undefined) && format !== "pptx") throw invalid("charts, provenance and images apply to format pptx.");
	if (options.scale !== undefined && format !== "png" && format !== "pdf") throw invalid("scale applies to format png (and raster pdf).");
	if (options.includeHidden && format === "pptx") throw invalid("includeHidden applies to per-slide image and PDF output; the PPTX keeps a hidden slide as a hidden slide.");
	if (options.slides !== undefined && format === "pptx") throw invalid("slides is not available for pptx: the whole presentation is exported.");
	if (text !== undefined && format !== "svg") throw invalid("text applies to format svg.");
	if (options.zip && format !== "svg" && format !== "png") throw invalid("zip applies to format svg and png.");
	if (options.slides !== undefined && typeof options.slides !== "string" && !(typeof options.slides === "number" && Number.isInteger(options.slides) && options.slides >= 1) && !(Array.isArray(options.slides) && options.slides.every((n) => Number.isInteger(n) && n >= 1))) throw invalid("slides must be a slide number, an array of slide numbers counted from 1, or a selection such as \"1,3-5\".");
	const scale = checkScale(options.scale);
	checkDate(options.date);
	const { fonts, ...rest } = options;
	if (fonts !== undefined && typeof fonts !== "string" && !isHandle(fonts) && !(Array.isArray(fonts) && fonts.every((folder) => typeof folder === "string"))) throw invalid("fonts must be a fonts handle (loadFonts() of @openpresentation/opf-render/fonts-node), a folder of font files or a list of folders.");
	const folders = typeof fonts === "string" ? [fonts] : Array.isArray(fonts) ? [...(fonts as readonly string[])] : [];
	return { ...rest, format, text: text ?? "fonts", scale, ...(isHandle(fonts) ? { fonts } : {}), fontFolders: folders };
}

function assetRoot(directory: string | undefined, flags = false): string | undefined {
	if (directory === undefined) return undefined;
	const resolved = path.resolve(directory);
	try {
		if (!statSync(resolved).isDirectory()) throw new Error("not a directory");
	} catch (error) {
		throw invalid(`${flags ? "--asset-dir" : "assetDir"} ${directory} is not a readable directory (${(error as NodeJS.ErrnoException).code ?? (error as Error).message}).`);
	}
	return resolved;
}

const svgSize = (svg: string) => {
	const tag = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
	const width = Number(/\bwidth="([\d.]+)"/.exec(tag)?.[1]);
	const height = Number(/\bheight="([\d.]+)"/.exec(tag)?.[1]);
	return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : {};
};
const pngSize = (bytes: Uint8Array) => (bytes.length > 24 ? { width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) } : {});

const MEDIA = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", zip: "application/zip" } as const;

/**
 * Draw a presentation that has already passed the format and references check (`ctx.reporter` holds that check's findings).
 * Diagnostics from fonts, layout, the SVG, PDF and PPTX writers are added to `ctx.reporter`. Throws an `OPFApiError` for an
 * option, a missing or old peer, a font directory or a selection that names no slide; a failure while drawing is returned in
 * `failure` after the reporter has the error finding.
 */
export async function runExport(presentation: unknown, options: ResolvedExportOptions, ctx: ExportContext): Promise<ExportRun> {
	const { format, scale } = options;
	const reporter = ctx.reporter;
	const catalogs = options.catalogs ?? DEFAULT_CATALOGS;
	const date = checkDate(options.date);
	const renderer = ctx.renderer ?? (await loadRenderer());
	const pptx = format === "pptx" ? (ctx.pptx ?? (await loadPptx())) : undefined;
	const userFonts = options.fonts ? [] : (ctx.userFonts ?? (await listFontDirectories(options.fontFolders, ctx.flags ? "--fonts" : "fonts")));

	const resolver = createImageResolver(assetRoot(options.assetDir, ctx.flags), reporter, ctx.flags ? "pass --asset-dir" : "pass assetDir");
	// RR-59: a standalone SVG (text "fonts") carries the installed script faces its text draws; raster, PDF and PPTX read
	// them from the font files, so they skip the script data URLs. Without `fonts`, a deck the process's shared handle serves
	// unchanged borrows it (the pack is prepared once per process); any other deck gets a handle of its own.
	const embedScripts = format === "svg" && options.text === "fonts";
	const lease = options.fonts ? undefined : await leaseSharedFonts(renderer, presentation, userFonts, reporter, embedScripts);
	try {
		const handle: FontsHandle = options.fonts ?? lease?.handle ?? (await prepareFonts(renderer, presentation, userFonts, reporter, embedScripts)).handle;
		return await drawWith(presentation, handle, options, ctx, { reporter, catalogs, date, renderer, ...(pptx ? { pptx } : {}), userFonts, resolver });
	} finally {
		lease?.release();
	}
}

interface DrawEnvironment {
	reporter: Reporter;
	catalogs: readonly Catalog[];
	date: string | undefined;
	renderer: Renderer;
	pptx?: Peer<PptxModule>;
	userFonts: string[];
	resolver: ReturnType<typeof createImageResolver>;
}

async function drawWith(presentation: unknown, handle: FontsHandle, options: ResolvedExportOptions, ctx: ExportContext, environment: DrawEnvironment): Promise<ExportRun> {
	const { format, scale } = options;
	const { reporter, catalogs, date, renderer, pptx, userFonts, resolver } = environment;
	let deck: unknown = presentation;
	const fontSummary = (): ExportFontSummary => ({
		pack: "office",
		substitutionPolicy: "visual",
		userFonts,
		substitutions: substitutionRows(handle),
		...(handle.registry?.scriptSelection ? { scripts: handle.registry.scriptSelection } : {}),
	});

	let pagination: { pages: unknown } | undefined;
	if (options.paginate) {
		try {
			const result = paginate(deck, { fonts: handle as Fonts, catalogs });
			deck = result.presentation;
			pagination = { pages: result.pages };
		} catch (error) {
			reportThrown(reporter, "render", error);
			return { files: [], fonts: fontSummary(), skippedHidden: [], failure: failureOf(error) };
		}
	}
	const slideCount = (deck as { slides?: unknown[] }).slides?.length ?? 0;
	// Per-slide output and PDF skip hidden slides (the presenter's sequence) unless includeHidden; slides named with `slides`
	// are exactly the slides written, hidden or not. The slide numbers in file names stay the document's own.
	const isHidden = (number: number) => (deck as { slides?: { hidden?: unknown }[] }).slides?.[number - 1]?.hidden === true;
	const everySlide = Array.from({ length: slideCount }, (_, index) => index + 1);
	const slidesLabel = ctx.flags ? "--slides" : "slides";
	const named = options.slides === undefined ? undefined : parseSlideSelection(options.slides, slideCount, slidesLabel);
	const selected = format === "pptx" ? [] : named ?? (options.includeHidden ? everySlide : everySlide.filter((number) => !isHidden(number)));
	const skippedHidden = format === "pptx" || named || options.includeHidden ? [] : everySlide.filter(isHidden);
	if (format !== "pptx" && !selected.length)
		throw new OPFApiError(skippedHidden.length ? (ctx.flags ? "Every slide is hidden. Use --include-hidden to write them, or --slides to name slides." : "Every slide is hidden. Use includeHidden to write them, or slides to name slides.") : "The presentation has no slides.", skippedHidden.length ? "all-slides-hidden" : "no-slides");

	const stem = deckStem(options.name === undefined ? deck : { filename: options.name }, "-");
	const run = (extra: Partial<ExportRun> & { files: ExportFile[] }): ExportRun => ({ fonts: fontSummary(), ...(pagination ? { pagination } : {}), skippedHidden, ...extra });
	try {
		if (format === "pptx") {
			const module = (pptx as NonNullable<typeof pptx>).module;
			const bytes = await module.toPptx(deck, {
				fonts: handle,
				imageResolver: resolver.forPptx,
				// The PNG fallback of an SVG picture is drawn by the same renderer the preview uses, with the same fonts handle,
				// so SVG pictures export whichever way opf-pptx would find opf-render. A picture without text needs no faces.
				svgRasterizer: async (svg: string, size: { scale: number; text: boolean }) => new Uint8Array(await renderer.render.module.toPng(svg, { scale: size.scale, background: "rgba(0, 0, 0, 0)", fonts: size.text ? handle : NO_FONTS })),
				onDiagnostic: (diagnostic: Diagnostic) => reporter.add("pptx", diagnostic),
				catalogs,
				// opf-pptx still names its option `chartex` and its picture choice `fallback`.
				...(options.charts ? { chartex: options.charts === "picture" ? "fallback" : options.charts } : {}),
				...(options.provenance ? { provenance: options.provenance === "none" ? false : options.provenance } : {}),
				...(options.images ? { imageFormat: options.images } : {}),
				...(date ? { date } : {}),
			});
			return run({ files: [{ name: `${stem}.pptx`, type: MEDIA.pptx, bytes }], skippedHidden: [] });
		}

		// One fonts handle for every call: layout and SVG read its measurement and the faces to embed, PNG and PDF its font files.
		// `text: "paths"` draws the glyph outlines from the handle itself (the renderer needs the whole handle), so it lists no faces;
		// `text: "system"` embeds none. The default embeds the faces the slide's text uses.
		const embedded = format === "svg" ? embeddedFor(handle, options.text) : [];
		const svgOptions = {
			fonts: options.text === "paths" && format === "svg" ? handle : { textMeasurement: handle.textMeasurement, embeddedFonts: embedded },
			...(format === "svg" && options.text !== "fonts" ? { text: options.text } : {}),
			imageResolver: resolver.forSvg,
			onDiagnostic: (diagnostic: Diagnostic) => reporter.add("render", diagnostic),
			catalogs,
			...(date ? { date } : {}),
		};
		const svgs: { slide: number; id: string | undefined; svg: string }[] = [];
		for (const number of selected) {
			const svg = renderer.render.module.toSvg(deck, number, svgOptions);
			svgs.push({ slide: number, id: (deck as { slides: { id?: string }[] }).slides[number - 1]?.id, svg });
		}
		// Padded to the width of the largest slide number written (`deck-1.png` for a short deck, `deck-01.png` from ten slides).
		const largest = Math.max(...selected);
		const name = (slide: number, extension: string) => `${stem}-${padNumber(slide, largest)}.${extension}`;

		if (format === "pdf") {
			const mode = options.raster ? "raster" : "vector";
			const title = typeof (deck as { name?: unknown }).name === "string" ? ((deck as { name: string }).name as string) : undefined;
			const bytes = await renderer.render.module.toPdf(
				svgs.map((item) => item.svg),
				{ fonts: handle, scale, ...(options.raster ? { raster: true } : {}), ...(mode === "vector" && title ? { metadata: { title } } : {}), onDiagnostic: (diagnostic: Diagnostic) => reporter.add("pdf", diagnostic) },
			);
			return run({ files: [{ name: `${stem}.pdf`, type: MEDIA.pdf, bytes, pages: svgs.length, slides: selected }], pdf: { mode } });
		}

		// svg or png: one file per slide, or one zip.
		const items: ExportFile[] = [];
		for (const item of svgs) {
			if (format === "svg") {
				const bytes = new TextEncoder().encode(item.svg);
				items.push({ name: name(item.slide, "svg"), type: MEDIA.svg, bytes, slide: item.slide, ...(item.id === undefined ? {} : { id: item.id }), ...svgSize(item.svg) });
			} else {
				const bytes = await renderer.render.module.toPng(item.svg, { fonts: handle, scale });
				items.push({ name: name(item.slide, "png"), type: MEDIA.png, bytes, slide: item.slide, ...(item.id === undefined ? {} : { id: item.id }), ...pngSize(bytes) });
			}
		}
		if (options.zip) {
			const bytes = createZip(items.map((item) => ({ name: item.name, bytes: item.bytes })));
			return run({ files: [{ name: `${stem}.zip`, type: MEDIA.zip, bytes, entries: items.map((item) => item.name) }] });
		}
		return run({ files: items });
	} catch (error) {
		if (error instanceof OPFApiError) throw error;
		// A converter or font package the renderer loads lazily is not installed: the same error as a missing peer, not a drawing failure.
		const missing = missingPeerFrom(error);
		if (missing) throw missing;
		reportThrown(reporter, format === "pptx" ? "pptx" : "render", error);
		return { files: [], fonts: fontSummary(), ...(pagination ? { pagination } : {}), skippedHidden: [], failure: failureOf(error) };
	}
}

const failureOf = (error: unknown) => {
	const failure = error as { code?: unknown; message?: string };
	return { code: typeof failure?.code === "string" ? failure.code : "failed", message: failure?.message ?? String(error) };
};

export const VERSIONS = (renderer: Renderer, pptx?: Peer<PptxModule>) => ({
	renderer: { package: RENDER_PACKAGE, version: renderer.render.version },
	...(pptx ? { pptx: { package: PPTX_PACKAGE, version: pptx.version } } : {}),
});
