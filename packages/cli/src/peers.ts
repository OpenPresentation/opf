// opf-render and opf-pptx are optional peer dependencies: the CLI stays small (no native image or PDF engines, no
// font packs) and a deck that is only validated, linted or edited never needs them. They are loaded the first time a
// command needs them, from the CLI's own install location first (a global install, an npx run with several --package
// flags, a project dependency) and from the working directory second (a project that has them installed while the CLI
// is global). Nothing is ever fetched.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileCommandError } from "./io.js";

export const RENDER_PACKAGE = "@openpresentation/opf-render";
export const PPTX_PACKAGE = "@openpresentation/opf-pptx";
/** Peer ranges. The CLI checks the features it calls rather than the version, so a newer release in range keeps working. */
export const PEER_RANGES = { [RENDER_PACKAGE]: "^0.11.9", [PPTX_PACKAGE]: "^0.11.9" } as const;

export interface Diagnostic {
	code: string;
	path?: string;
	message: string;
	[detail: string]: unknown;
}
export interface FontOptions {
	textMeasurement: unknown;
	embeddedFonts: { family: string; weight: number; italic?: boolean; dataUrl: string }[];
	fontFiles: string[];
	useBundledFonts: false;
	loadSystemFonts: false;
}
export interface FontRegistry {
	substitutions: { requestedFamily: string; resolvedFamily: string; compatibility: string; substitute: boolean }[];
	scriptSelection?: { detected: string[]; scripts: string[]; unavailable: string[]; packages?: string[]; notInstalled?: string[]; uncovered?: string[] };
}
export interface RenderModule {
	renderSvg(input: unknown, options?: Record<string, unknown>): string;
	svgToPng(svg: string, options?: Record<string, unknown>): Promise<Uint8Array>;
	svgToPdf(svgs: string | string[], options?: Record<string, unknown>): Promise<Uint8Array>;
}
export interface FontsNodeModule {
	prepareNodeFonts(options?: Record<string, unknown>): Promise<{ registry: FontRegistry; options: FontOptions }>;
}
export interface PptxModule {
	toPptx(input: unknown, options?: Record<string, unknown>): Promise<Uint8Array>;
	fromPptx(input: Uint8Array, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
	/** Present from opf-pptx 0.11.9: `fromPptx(bytes, {signals: true})` resolves to `{document, signals}`. */
	SIGNALS_VERSION?: number;
}
export interface Peer<T> {
	module: T;
	version: string;
	name: string;
}

const hint = (name: string) =>
	`${name} is not installed. It is an optional peer of @openpresentation/cli, loaded only by the commands that need it. Install it next to the CLI:\n` +
	`  npm install -g ${name}@${PEER_RANGES[name as keyof typeof PEER_RANGES]}      (global CLI)\n` +
	`  npm install -D ${name}@${PEER_RANGES[name as keyof typeof PEER_RANGES]}      (project that depends on the CLI)\n` +
	`  npx -p @openpresentation/cli -p @openpresentation/opf-render -p @openpresentation/opf-pptx opf <command> ...      (one run)`;

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
	if (!manifestPath || !entry) throw new FileCommandError(hint(name), 2, { code: "peer-not-installed", package: name, range: PEER_RANGES[name as keyof typeof PEER_RANGES] });
	let module: T;
	try {
		module = (await import(pathToFileURL(entry).href)) as T;
	} catch (error) {
		throw new FileCommandError(`${name} is installed at ${path.dirname(manifestPath)} but did not load: ${(error as Error).message}`, 2, { code: "peer-load-failed", package: name });
	}
	const version = (JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string }).version ?? "unknown";
	const peer = { module, version, name };
	cache.set(key, peer);
	return peer;
}

function requireFeature(peer: Peer<unknown>, names: string[]) {
	const missing = names.filter((name) => typeof (peer.module as Record<string, unknown>)[name] !== "function");
	if (missing.length)
		throw new FileCommandError(`${peer.name}@${peer.version} does not provide ${missing.join(", ")}. Install ${peer.name}@${PEER_RANGES[peer.name as keyof typeof PEER_RANGES]}.`, 2, { code: "peer-too-old", package: peer.name });
}

export interface Renderer {
	render: Peer<RenderModule>;
	fonts: FontsNodeModule;
}

export async function loadRenderer(): Promise<Renderer> {
	const render = await loadPeer<RenderModule>(RENDER_PACKAGE);
	requireFeature(render, ["renderSvg", "svgToPng", "svgToPdf"]);
	const fonts = await loadPeer<FontsNodeModule>(RENDER_PACKAGE, "/fonts-node");
	requireFeature(fonts, ["prepareNodeFonts"]);
	return { render, fonts: fonts.module };
}

export async function loadPptx(): Promise<Peer<PptxModule>> {
	const pptx = await loadPeer<PptxModule>(PPTX_PACKAGE);
	requireFeature(pptx, ["toPptx", "fromPptx"]);
	return pptx;
}
