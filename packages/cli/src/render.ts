// `opf render` and `opf export`: per-slide SVG and PNG, PDF and PPTX from an OPF document, through the optional
// peers opf-render and opf-pptx (see peers.ts). The command reads the document, checks its format and references with
// `validate` (the check of `opf validate`), prepares the bundled fonts, renders, and prints one JSON report. Nothing is
// written when the document is invalid, a render error occurred or a finding reaches --fail-on.
import { type Fonts, paginate } from "@openpresentation/opf";
import path from "node:path";
import { createImageResolver } from "./assets.js";
import { checkText, inputFormatOf } from "./deck.js";
import { embeddedFor, listFontDirectories, prepareFonts, substitutionRows } from "./fonts.js";
import {
	FileCommandError,
	type PlannedFile,
	arity,
	json,
	parseOptions,
	parseSlideSelection,
	readBytes,
	sha256,
	deckStem,
	writeFiles,
} from "./io.js";
import { type Diagnostic, type PptxModule, type Renderer, PPTX_PACKAGE, RENDER_PACKAGE, loadPptx, loadRenderer } from "./peers.js";
import { FAIL_ON_MESSAGE, WRITE_CHECK, parseFailOn } from "./check.js";
import { Reporter, finishReport, reportThrown } from "./reporter.js";
import { createZip } from "./zip.js";

export interface Host {
	cliVersion: string;
	opfVersion: string;
}

type Format = "svg" | "png" | "pdf" | "pptx";
const RASTER_FORMATS = ["svg", "png"] as const;
const SPEC = {
	values: ["slides", "format", "scale", "out", "date", "asset-dir", "svg-fonts", "fail-on"],
	repeated: ["font-dir"],
	flags: ["force", "json", "paginate", "include-hidden"],
};
const EXPORT_SPEC = { ...SPEC, values: [...SPEC.values, "pdf-mode", "chartex", "provenance", "image-format"] };

const oneOf = <T extends string>(name: string, value: string | boolean | undefined, allowed: readonly T[], fallback?: T): T | undefined => {
	if (value === undefined) return fallback;
	if (typeof value !== "string" || !allowed.includes(value as T)) throw new FileCommandError(`${name} must be one of: ${allowed.join(", ")}.`);
	return value as T;
};

function checkDate(value: string | boolean | undefined) {
	if (value === undefined) return undefined;
	const text = String(value);
	const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : undefined;
	if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new FileCommandError("--date must be a real calendar date, YYYY-MM-DD.");
	return text;
}

function checkScale(value: string | boolean | undefined) {
	if (value === undefined) return 1;
	const scale = Number(value);
	if (!Number.isFinite(scale) || scale < 0.1 || scale > 8) throw new FileCommandError("--scale must be a number from 0.1 to 8 (1 draws the 1280 x 720 reference slide at 1280 x 720 pixels).");
	return scale;
}

const svgSize = (svg: string) => {
	const tag = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
	const width = Number(/\bwidth="([\d.]+)"/.exec(tag)?.[1]);
	const height = Number(/\bheight="([\d.]+)"/.exec(tag)?.[1]);
	return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : {};
};
const pngSize = (bytes: Uint8Array) => (bytes.length > 24 ? { width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) } : {});

const TINY = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30" viewBox="0 0 40 30"><rect width="40" height="30" fill="#000"/></svg>';
/** Does the installed renderer write vector PDF, and what does it write by default? A page-sized image in the file means raster. */
async function probePdf(renderer: Renderer) {
	const isRaster = async (options: Record<string, unknown>) => {
		try {
			return Buffer.from(await renderer.render.module.svgToPdf(TINY, options)).includes("/Subtype /Image");
		} catch {
			return undefined;
		}
	};
	const vector = await isRaster({ mode: "vector" });
	return { supportsVector: vector === false, defaultMode: (await isRaster({})) === false ? "vector" : "raster" } as const;
}

interface Prepared {
	deck: Record<string, unknown>;
	raw: string;
}

export async function runRenderCommand(command: "render" | "export", args: string[], host: Host) {
	try {
		await run(command, args, host);
	} catch (error) {
		const failure = error instanceof FileCommandError ? error : new FileCommandError(error instanceof Error ? error.message : String(error));
		process.stderr.write(json({ error: failure.message, ...failure.extra }));
		process.exitCode = failure.code;
	}
}

async function run(command: "render" | "export", args: string[], host: Host) {
	const { positional, options, repeated } = parseOptions(args, command === "render" ? SPEC : EXPORT_SPEC);
	arity(positional, 1);
	const input = positional[0] as string;
	const out = options.out === undefined ? undefined : String(options.out);

	// Format. `render` is svg or png; `export` also pdf and pptx, and infers the format from --out when it can.
	const allowed = command === "render" ? RASTER_FORMATS : ([...RASTER_FORMATS, "pdf", "pptx"] as const);
	let format = oneOf<Format>("--format", options.format, allowed);
	if (!format && command === "render") format = "svg";
	if (!format && out) {
		const extension = path.extname(out).slice(1).toLowerCase();
		if ((allowed as readonly string[]).includes(extension)) format = extension as Format;
	}
	if (!format) throw new FileCommandError("opf export needs --format pptx|pdf|png|svg (or an --out file ending in .pptx, .pdf, .png or .svg).");
	if (options["pdf-mode"] !== undefined && format !== "pdf") throw new FileCommandError("--pdf-mode applies to --format pdf.");
	if ((options.chartex !== undefined || options.provenance !== undefined || options["image-format"] !== undefined) && format !== "pptx")
		throw new FileCommandError("--chartex, --provenance and --image-format apply to --format pptx.");
	if (options.scale !== undefined && format !== "png" && format !== "pdf") throw new FileCommandError("--scale applies to --format png (and raster PDF).");
	if (options["include-hidden"] && format === "pptx") throw new FileCommandError("--include-hidden applies to per-slide image and PDF output; the PPTX keeps a hidden slide as a hidden slide.");
	if (options.slides !== undefined && format === "pptx") throw new FileCommandError("--slides is not available for pptx: the whole presentation is exported.");
	if (options["svg-fonts"] !== undefined && format !== "svg") throw new FileCommandError("--svg-fonts applies to --format svg.");
	const pdfMode = oneOf("--pdf-mode", options["pdf-mode"], ["vector", "raster"] as const);
	const chartex = oneOf("--chartex", options.chartex, ["auto", "native", "fallback"] as const);
	const provenance = oneOf("--provenance", options.provenance, ["full", "references-only", "none"] as const);
	const imageFormat = oneOf("--image-format", options["image-format"], ["compatible", "preserve"] as const);
	const svgFonts = oneOf("--svg-fonts", options["svg-fonts"], ["used", "none"] as const, "used") as "used" | "none";
	const scale = checkScale(options.scale);
	const date = checkDate(options.date);
	const failOn = parseFailOn(options["fail-on"]);
	if (!failOn) throw new FileCommandError(FAIL_ON_MESSAGE);

	// Peers load before the document is read, so a missing install is reported at once.
	const renderer = await loadRenderer();
	const pptx = format === "pptx" ? await loadPptx() : undefined;
	const userFonts = await listFontDirectories(repeated["font-dir"] ?? []);

	const { bytes } = await readBytes(input);
	const raw = Buffer.from(bytes).toString("utf8"); // keeps a BOM, like opf validate, so hashes and offsets agree
	const { report: check, deck: checkedDeck } = checkText(raw, inputFormatOf(input), WRITE_CHECK);
	const reporter = new Reporter(check.findings);
	const inputSha = sha256(raw);
	const assetRoot = path.resolve(options["asset-dir"] === undefined ? (input === "-" ? "." : path.dirname(input)) : String(options["asset-dir"]));
	const identity = {
		input: { file: input === "-" ? "-" : path.resolve(input), sha256: inputSha },
		sha256: inputSha,
		opfVersion: host.opfVersion,
		cli: host.cliVersion,
		renderer: { package: RENDER_PACKAGE, version: renderer.render.version },
		...(pptx ? { pptx: { package: PPTX_PACKAGE, version: pptx.version } } : {}),
	};
	const toStdout = out === "-";
	const report = (extra: Record<string, unknown>, outputs: unknown[], written: boolean) => {
		const finished = finishReport(check, reporter, failOn);
		const body = { command, format, ok: finished.ok, valid: finished.valid, schemaValid: finished.schemaValid, written, ...identity, ...extra, outputs, findings: finished.findings, counts: finished.counts, checks: { ...finished.checks, layout: "measured", fonts: "checked", nativeExport: format === "pptx" ? "checked" : "not-checked" } };
		(toStdout && written ? process.stderr : process.stdout).write(json(body));
		if (!finished.ok) process.exitCode = 1;
		return finished.ok;
	};

	if (!check.valid) {
		report({}, [], false);
		return;
	}
	const prepared: Prepared = { deck: checkedDeck as Prepared["deck"], raw };
	let deck: unknown = prepared.deck;
	const resolver = createImageResolver(assetRoot, reporter);
	const fonts = await prepareFonts(renderer, deck, userFonts, reporter);
	const fontSummary = () => ({
		pack: "office",
		substitutionPolicy: "visual",
		userFonts: fonts.userFonts,
		substitutions: substitutionRows(fonts.registry),
		...(fonts.registry.scriptSelection ? { scripts: fonts.registry.scriptSelection } : {}),
	});

	let pagination: Record<string, unknown> | undefined;
	if (options.paginate) {
		try {
			const result = paginate(deck, { fonts: fonts.options as Fonts });
			deck = result.presentation;
			pagination = { pages: result.pages };
		} catch (error) {
			reportThrown(reporter, "render", error);
			report({ fonts: fontSummary() }, [], false);
			return;
		}
	}
	const slideCount = (deck as { slides?: unknown[] }).slides?.length ?? 0;
	// Per-slide output and PDF skip hidden slides (the presenter's sequence) unless --include-hidden; slides named with --slides
	// are exactly the slides written, hidden or not. The slide numbers in file names and reports stay the document's own.
	const isHidden = (number: number) => (deck as { slides?: { hidden?: unknown }[] }).slides?.[number - 1]?.hidden === true;
	const everySlide = Array.from({ length: slideCount }, (_, index) => index + 1);
	const selected =
		format === "pptx"
			? []
			: options.slides !== undefined
				? parseSlideSelection(String(options.slides), slideCount)
				: options["include-hidden"]
					? everySlide
					: everySlide.filter((number) => !isHidden(number));
	const skippedHidden = format === "pptx" || options.slides !== undefined || options["include-hidden"] ? [] : everySlide.filter(isHidden);
	if (format !== "pptx" && !selected.length)
		throw new FileCommandError(skippedHidden.length ? "Every slide is hidden. Use --include-hidden to write them, or --slides to name slides." : "The presentation has no slides.", 1);
	const onRender = (diagnostic: Diagnostic) => reporter.add("render", diagnostic);
	const planned: { file: string; bytes: Uint8Array; entry: Record<string, unknown> }[] = [];
	const finish = async (extra: Record<string, unknown>) => {
		const outputs = planned.map((item) => ({ file: item.file === "-" ? "-" : path.resolve(item.file), ...item.entry, sha256: sha256(item.bytes), bytes: item.bytes.length }));
		const finished = finishReport(check, reporter, failOn);
		if (!finished.ok) {
			report({ fonts: fontSummary(), ...(pagination ? { pagination } : {}), ...extra }, outputs.map((item) => ({ ...item, planned: true })), false);
			return;
		}
		if (toStdout) {
			if (planned.length !== 1) throw new FileCommandError("--out - needs exactly one output; choose one slide with --slides or a file format.");
			process.stdout.write(planned[0]?.bytes as Uint8Array);
			report({ fonts: fontSummary(), ...(pagination ? { pagination } : {}), ...extra }, outputs, true);
			return;
		}
		await writeFiles(planned.map((item) => ({ file: item.file, bytes: item.bytes }) as PlannedFile), !!options.force);
		report({ fonts: fontSummary(), ...(pagination ? { pagination } : {}), ...extra }, outputs, true);
	};

	const stem = deckStem(prepared.deck, input);
	const rasterOptions = { fontFiles: fonts.options.fontFiles, useBundledFonts: false, loadSystemFonts: false };
	const svgOptions = (embedded: unknown[], index: number) => ({
		textMeasurement: fonts.options.textMeasurement,
		embeddedFonts: embedded,
		slideIndex: index,
		imageResolver: resolver.forSvg,
		onDiagnostic: onRender,
		...(date ? { date } : {}),
	});

	const generate = async (): Promise<Record<string, unknown>> => {
		if (format === "pptx") {
			const module = (pptx as { module: PptxModule }).module;
			const bytes = await module.toPptx(deck, {
				textMeasurement: fonts.options.textMeasurement,
				imageResolver: resolver.forPptx,
				// The PNG fallback of an SVG picture is drawn by the same renderer the preview uses, so SVG pictures export
				// whichever way opf-pptx would find opf-render. Without text it needs no fonts; with text it uses the bundled pack.
				svgRasterizer: async (svg: string, size: { scale: number; text?: boolean }) =>
					new Uint8Array(
						await renderer.render.module.svgToPng(svg, {
							scale: size.scale,
							background: "rgba(0, 0, 0, 0)",
							useBundledFonts: size.text === true,
							loadSystemFonts: false,
							...(fonts.userFonts.length ? { fontFiles: fonts.userFonts } : {}),
						}),
					),
				onDiagnostic: (diagnostic: Diagnostic) => reporter.add("pptx", diagnostic),
				...(chartex ? { chartex } : {}),
				...(provenance ? { provenance: provenance === "none" ? false : provenance } : {}),
				...(imageFormat ? { imageFormat } : {}),
				...(date ? { date } : {}),
			});
			planned.push({ file: out ?? `${stem}.pptx`, bytes, entry: { mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" } });
			return {};
		}

		const svgs: { slide: number; id: unknown; svg: string }[] = [];
		const embedded = format === "svg" ? embeddedFor(fonts.options, svgFonts) : [];
		for (const number of selected) {
			const svg = renderer.render.module.renderSvg(deck, svgOptions(embedded, number - 1));
			svgs.push({ slide: number, id: (deck as { slides: { id?: unknown }[] }).slides[number - 1]?.id, svg });
		}
		const width = Math.max(3, String(slideCount).length);
		const name = (slide: number, extension: string) => `${stem}-${String(slide).padStart(width, "0")}.${extension}`;

		if (format === "pdf") {
			const probe = await probePdf(renderer);
			if (pdfMode === "vector" && !probe.supportsVector)
				throw new FileCommandError(`--pdf-mode vector needs an @openpresentation/opf-render that writes vector PDF; the installed ${renderer.render.version} writes one image per page. Update ${RENDER_PACKAGE}.`, 2, { code: "peer-too-old", package: RENDER_PACKAGE });
			const mode = pdfMode ?? probe.defaultMode;
			const title = typeof prepared.deck.name === "string" ? prepared.deck.name : undefined;
			const bytes = await renderer.render.module.svgToPdf(
				svgs.map((item) => item.svg),
				{ ...rasterOptions, scale, ...(pdfMode ? { mode: pdfMode } : {}), ...(mode === "vector" && title ? { metadata: { title } } : {}), onDiagnostic: (diagnostic: Diagnostic) => reporter.add("pdf", diagnostic) },
			);
			planned.push({ file: out ?? `${stem}.pdf`, bytes, entry: { mediaType: "application/pdf", pages: svgs.length, slides: selected } });
			return { pdf: { mode, vectorSupported: probe.supportsVector }, skippedHidden };
		}

		// svg or png: one file per slide in a directory, a single file, or a zip.
		const extension = format;
		const mediaType = format === "svg" ? "image/svg+xml" : "image/png";
		const items: { slide: number; id: unknown; bytes: Uint8Array; entry: Record<string, unknown> }[] = [];
		for (const item of svgs) {
			if (format === "svg") {
				const bytes = new TextEncoder().encode(item.svg);
				items.push({ slide: item.slide, id: item.id, bytes, entry: { slide: item.slide, id: item.id, mediaType, ...svgSize(item.svg) } });
			} else {
				const bytes = await renderer.render.module.svgToPng(item.svg, { ...rasterOptions, scale });
				items.push({ slide: item.slide, id: item.id, bytes, entry: { slide: item.slide, id: item.id, mediaType, ...pngSize(bytes) } });
			}
		}
		const target = out;
		const toFile = target !== undefined && (target === "-" || path.extname(target).toLowerCase() === `.${extension}`);
		if (toFile) {
			if (items.length !== 1) throw new FileCommandError(`--out ${target} names one file but ${items.length} slides were selected. Choose one slide with --slides, or give a directory or a .zip.`);
			const only = items[0] as (typeof items)[number];
			planned.push({ file: target, bytes: only.bytes, entry: only.entry });
		} else if (target !== undefined && path.extname(target).toLowerCase() === ".zip") {
			const bytes = createZip(items.map((item) => ({ name: name(item.slide, extension), bytes: item.bytes })));
			planned.push({ file: target, bytes, entry: { mediaType: "application/zip", entries: items.map((item) => name(item.slide, extension)) } });
		} else {
			const directory = target ?? `${stem}-slides`;
			for (const item of items) planned.push({ file: path.join(directory, name(item.slide, extension)), bytes: item.bytes, entry: item.entry });
		}
		return { skippedHidden };
	};
	let extra: Record<string, unknown>;
	try {
		extra = await generate();
	} catch (error) {
		if (error instanceof FileCommandError) throw error;
		reportThrown(reporter, format === "pptx" ? "pptx" : "render", error);
		report({ fonts: fontSummary(), ...(pagination ? { pagination } : {}) }, [], false);
		return;
	}
	await finish(extra);
}
