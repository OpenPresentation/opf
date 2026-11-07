// The deck view's fonts from a site that already serves the OPF preview fonts, for a hosted server (the openpresentation.org
// Worker reads them through its ASSETS binding). Edge-safe: no Node builtin, nothing but the `fetch` the host passes.
//
// The site layout is the one `prepare-opf-fonts.mjs` of the OpenPresentation site writes (contract openpresentation-site-fonts/v1):
//   <base>manifest.json                 { contract, renderer, base: [{ family, weight, italic, file, sha256 }] }, the eager faces
//   <base>base/<package>/<file>         the eager Office faces (the manifest names each file)
//   <base>lazy/fonts/<family>/<file>    the renderer's vendored faces, at their package-relative path
//   <base>scripts/<package>/<file>      the script faces, at the renderer's scriptBaseUrl layout
// The view asks read_font_file for `embedded/<Family>-<weight>-<style>.ttf`, `fonts/...` and `script-fonts/<package>/...`; each
// maps to one of those paths, and the renderer in the view checks every file against its own pinned SHA-256 before it uses it.
import type { ReadFontFile } from "./server.js";

/** The file name the deck view asks for an eager Office face by (scripts/build-app.mjs and opf-mcp name them the same way). */
export const deckFontFile = (face: { family: string; weight: number; italic?: boolean }): string => `embedded/${face.family.replace(/[^A-Za-z0-9]+/g, "-")}-${face.weight}-${face.italic ? "italic" : "normal"}.ttf`;

/** A relative font path with no `..`, no empty and no hidden segment, ending in .ttf or .otf. */
const SAFE_PATH = /^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:ttf|otf)$/;

export interface SiteFontsOptions {
	/** Reads a file the site serves, by its path on the site (`/opf-fonts/lazy/fonts/intos/Intos-Regular.ttf`): in a Worker, `env.ASSETS.fetch`. */
	fetch: (path: string) => Promise<Response>;
	/** Where the fonts are on the site. Default `/opf-fonts/`. */
	base?: string;
}

interface SiteFontManifest {
	contract?: string;
	base?: { family: string; weight: number; italic?: boolean; file: string }[];
}

/** read_font_file over a site's preview fonts (see the layout above). A file the site does not serve reads as undefined. */
export function siteFontFiles(options: SiteFontsOptions): ReadFontFile {
	const base = (options.base ?? "/opf-fonts/").replace(/\/?$/, "/");
	const read = async (path: string): Promise<Uint8Array | undefined> => {
		const response = await options.fetch(base + path);
		if (!response.ok) return undefined;
		return new Uint8Array(await response.arrayBuffer());
	};
	let manifest: Promise<Map<string, string>> | undefined;
	const embedded = () =>
		(manifest ??= (async () => {
			const response = await options.fetch(`${base}manifest.json`);
			if (!response.ok) throw new Error(`${base}manifest.json: HTTP ${response.status}`);
			const site = (await response.json()) as SiteFontManifest;
			return new Map((site.base ?? []).filter((face) => SAFE_PATH.test(face.file)).map((face) => [deckFontFile(face), face.file]));
		})().catch((error: unknown) => {
			manifest = undefined;
			throw error;
		}));
	return async (file) => {
		if (file.startsWith("embedded/")) {
			const path = (await embedded()).get(file);
			return path ? read(path) : undefined;
		}
		if (file.startsWith("fonts/") && SAFE_PATH.test(file)) return read(`lazy/${file}`);
		if (file.startsWith("script-fonts/")) {
			const rest = file.slice("script-fonts/".length);
			return SAFE_PATH.test(rest) && rest.includes("/") ? read(`scripts/${rest}`) : undefined;
		}
		return undefined;
	};
}
