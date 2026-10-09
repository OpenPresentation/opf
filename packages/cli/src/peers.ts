// opf-render and opf-pptx are optional peer dependencies: the CLI stays small (no native image or PDF engines, no
// font packs) and a deck that is only validated, linted or edited never needs them. They are loaded the first time a
// command needs them, from the CLI's own install location first (a global install, an npx run with several --package
// flags, a project dependency) and from the working directory second (a project that has them installed while the CLI
// is global). Nothing is ever fetched.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { OPFApiError } from "./errors.js";

export const RENDER_PACKAGE = "@openpresentation/opf-render";
export const PPTX_PACKAGE = "@openpresentation/opf-pptx";
/** Peer ranges. The CLI checks the features it calls rather than the version, so a newer release in range keeps working. */
export const PEER_RANGES = { [RENDER_PACKAGE]: "^0.16.0", [PPTX_PACKAGE]: "^0.16.0" } as const;

export interface Diagnostic {
	code: string;
	path?: string;
	message: string;
	[detail: string]: unknown;
}
export interface EmbeddedFace {
	family: string;
	weight: number;
	italic?: boolean;
	dataUrl: string;
}
/** What the renderer's deck-level functions read from `{ fonts }` (opf-render `RenderFonts`). */
export interface RenderFonts {
	textMeasurement?: unknown;
	embeddedFonts?: readonly EmbeddedFace[];
	fontFiles?: readonly string[];
	useBundledFonts?: boolean;
	loadSystemFonts?: boolean;
}
export interface FontRegistry {
	scriptSelection?: { detected: string[]; scripts: string[]; unavailable: string[]; packages?: string[]; notInstalled?: string[]; uncovered?: string[] };
}
/** The handle `loadFonts()` of opf-render `/fonts-node` returns: pass it as `{ fonts }` to every deck-level call. */
export interface FontsHandle extends RenderFonts {
	textMeasurement: unknown;
	embeddedFonts: EmbeddedFace[];
	fontFiles: string[];
	useBundledFonts: false;
	loadSystemFonts: false;
	registry: FontRegistry;
	substitutions: { requestedFamily: string; resolvedFamily: string; compatibility: string; substitute: boolean }[];
}
export interface RenderModule {
	renderSlideSvg(presentation: unknown, index: number, options?: Record<string, unknown>): string;
	svgToPng(svg: string, options?: Record<string, unknown>): Promise<Uint8Array>;
	svgToPdf(svgs: string | string[], options?: Record<string, unknown>): Promise<Uint8Array>;
}
export interface FontsNodeModule {
	loadFonts(options?: Record<string, unknown>): Promise<FontsHandle>;
}
export interface PptxModule {
	toPptx(presentation: unknown, options?: Record<string, unknown>): Promise<Uint8Array>;
	/** Without `signals` the presentation itself; with `signals: true`, `{ presentation, signals }`. */
	fromPptx(input: Uint8Array, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
}
export interface Peer<T> {
	module: T;
	version: string;
	name: string;
}

/**
 * What the renderer needs besides itself (RR-63): its converters and every font package are optional peers of opf-render, so a host
 * installs only the ones its outputs use. The versions are the ones the renderer is tested with (its `peerDependencies`).
 */
export const RENDER_EXTRAS = {
	/** The faces of the office pack, which the CLI and `exportDeck` always load (every format). */
	fonts: ["@expo-google-fonts/roboto@0.4.3", "@expo-google-fonts/roboto-mono@0.4.2", "@expo-google-fonts/caladea@0.4.2", "@expo-google-fonts/arimo@0.4.3", "@expo-google-fonts/tinos@0.4.2", "@expo-google-fonts/cousine@0.4.3", "@expo-google-fonts/gelasio@0.4.1", "@expo-google-fonts/noto-sans@0.4.2"],
	/** PNG output (and raster fallbacks): the SVG rasterizer, and sharp for WebP and rotated JPEG pictures. */
	png: ["@resvg/resvg-js@^2.6.2", "sharp@^0.35.5"],
	/** PDF: vector mode (the default) needs nothing for text; raster mode needs pdf-lib; pictures in a vector PDF need sharp. */
	pdfRaster: ["pdf-lib@^1.17.1"],
	pdfPictures: ["sharp@^0.35.5"],
} as const;

const renderHint = () =>
	`  ${RENDER_PACKAGE} also needs its optional peers, by output:\n` +
	`    every format (fonts):  npm install ${RENDER_EXTRAS.fonts.join(" ")}\n` +
	`    png:                   npm install ${RENDER_EXTRAS.png.join(" ")}\n` +
	`    pdf:                   npm install ${RENDER_EXTRAS.pdfRaster.join(" ")}  (raster mode), ${RENDER_EXTRAS.pdfPictures.join(" ")}  (when the deck has pictures)\n` +
	`    svg:                   fonts only`;

const hint = (name: string) =>
	`${name} is not installed. It is an optional peer of @openpresentation/cli, loaded only by the commands (and by exportDeck and importDeck of @openpresentation/cli/api) that need it. Install it next to the CLI:\n` +
	`  npm install -g ${name}@${PEER_RANGES[name as keyof typeof PEER_RANGES]}      (global CLI)\n` +
	`  npm install ${name}@${PEER_RANGES[name as keyof typeof PEER_RANGES]}      (project that depends on the CLI or imports @openpresentation/cli/api)\n` +
	`  npx -p @openpresentation/cli -p @openpresentation/opf-render -p @openpresentation/opf-pptx opf <command> ...      (one run)` +
	(name === RENDER_PACKAGE ? `\n${renderHint()}` : "");

function bases(): string[] {
	// Resolution starts at the CLI's own file, then at the working directory.
	return [import.meta.url, pathToFileURL(path.join(process.cwd(), "noop.js")).href];
}

function locate(specifier: string): string | undefined {
	for (const base of bases()) {
		try {
			return createRequire(base).resolve(specifier);
		} catch (error) {
			// MODULE_NOT_FOUND: try the next base. A package without that export is also "not found".
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== "MODULE_NOT_FOUND" && code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
		}
	}
	return undefined;
}

const cache = new Map<string, Peer<unknown>>();

async function loadPeer<T>(name: string, subpath = ""): Promise<Peer<T>> {
	const key = `${name}${subpath}`;
	const cached = cache.get(key);
	if (cached) return cached as Peer<T>;
	const manifestPath = locate(`${name}/package.json`);
	const entry = locate(`${name}${subpath}`);
	if (!manifestPath || !entry) throw new OPFApiError(hint(name), "peer-not-installed", { details: { package: name, range: PEER_RANGES[name as keyof typeof PEER_RANGES] } });
	let module: T;
	try {
		module = (await import(pathToFileURL(entry).href)) as T;
	} catch (error) {
		throw new OPFApiError(`${name} is installed at ${path.dirname(manifestPath)} but did not load: ${(error as Error).message}`, "peer-load-failed", { details: { package: name }, cause: error });
	}
	const version = (JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string }).version ?? "unknown";
	const peer = { module, version, name };
	cache.set(key, peer);
	return peer;
}

function requireFeature(peer: Peer<unknown>, names: string[]) {
	const missing = names.filter((name) => typeof (peer.module as Record<string, unknown>)[name] !== "function");
	if (missing.length)
		throw new OPFApiError(`${peer.name}@${peer.version} does not provide ${missing.join(", ")}. Install ${peer.name}@${PEER_RANGES[peer.name as keyof typeof PEER_RANGES]}.`, "peer-too-old", { details: { package: peer.name } });
}

/**
 * The missing-peer error for a renderer failure that says a package it loads lazily is absent (RR-63): `converter-missing` (pdf-lib,
 * @resvg/resvg-js, sharp) or `font-resource-unavailable` naming font packages. The renderer's message, with its install command, is kept;
 * `details` has `package` (or `packages`), `range`, `install` and `purpose` where the renderer gave them. A converter that is installed but
 * did not load is `peer-load-failed`. Undefined for any other error.
 */
export function missingPeerFrom(error: unknown): OPFApiError | undefined {
	let current = error as { code?: unknown; message?: string; details?: Record<string, unknown>; cause?: unknown } | undefined;
	for (let depth = 0; current && typeof current === "object" && depth < 4; depth++, current = current.cause as typeof current) {
		const details = current.details ?? {};
		const fontPackages = current.code === "font-resource-unavailable" && (Array.isArray(details.packages) || typeof details.package === "string");
		if (current.code !== "converter-missing" && !fontPackages) continue;
		const kept = Object.fromEntries(["package", "packages", "range", "install", "purpose"].filter((key) => details[key] !== undefined).map((key) => [key, details[key]]));
		return new OPFApiError(current.message ?? String(current.code), details.installed === true ? "peer-load-failed" : "peer-not-installed", { details: kept, cause: error });
	}
	return undefined;
}

export interface Renderer {
	render: Peer<RenderModule>;
	fonts: FontsNodeModule;
}

export async function loadRenderer(): Promise<Renderer> {
	const render = await loadPeer<RenderModule>(RENDER_PACKAGE);
	requireFeature(render, ["renderSlideSvg", "svgToPng", "svgToPdf"]);
	const fonts = await loadPeer<FontsNodeModule>(RENDER_PACKAGE, "/fonts-node");
	requireFeature(fonts, ["loadFonts"]);
	return { render, fonts: fonts.module };
}

export async function loadPptx(): Promise<Peer<PptxModule>> {
	const pptx = await loadPeer<PptxModule>(PPTX_PACKAGE);
	// `inventoryTypefaces` is the 0.14 name of `inventoryPptxTypefaces`: the check that tells the 0.14 API (`{ fonts }`, `{ presentation, signals }`) from the 0.13 one.
	requireFeature(pptx, ["toPptx", "fromPptx", "inventoryTypefaces"]);
	return pptx;
}
