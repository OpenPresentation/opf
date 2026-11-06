// `opf-mcp`: the OPF MCP server over stdio. A thin wrapper: the server definition is ./server.ts; this adds the transport and, because
// it runs under Node, the measured layout check `opf validate` makes (the fonts of @openpresentation/opf-render when it is installed;
// otherwise core's estimate, and the report's hint says so). Stdout carries the protocol and nothing else; diagnostics go to stderr.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type ValidateOptions, type ValidationReport, ensureIcons } from "@openpresentation/opf";
import { Reporter, measuringFonts, readDeckReport } from "@openpresentation/opf/internal/engine";
import { type DeckFormat, type ReadFontFile, createOpfServer } from "./index.js";

declare const MCP_VERSION: string;

/** The versions the server reports: this package's, and the core it runs on. */
export interface StdioHost {
	version?: string;
	opfVersion?: string;
}

/** Deck text checked as `opf validate` checks it: layout measured with the fonts `opf convert` draws with when opf-render is installed. */
export async function checkDeckText(raw: string, format: DeckFormat, options: ValidateOptions): Promise<ValidationReport> {
	const read = readDeckReport(raw, { format, validate: false }).presentation;
	// LH-14: the icon sets the deck names load first (the gallery loads each on first use), so an unknown icon name is reported.
	await ensureIcons(read, { catalogs: options.catalogs });
	const measuring = await measuringFonts(read, { reporter: new Reporter(), flags: true });
	try {
		const { presentation: _deck, format: _format, ...report } = readDeckReport(raw, { format, validate: measuring.fonts ? { ...options, fonts: measuring.fonts } : options });
		if (measuring.estimated && report.checks.layout === "estimated") {
			const named = (measuring.estimated.details as { package?: string } | undefined)?.package ?? "@openpresentation/opf-render";
			return { ...report, hint: `Layout was estimated: ${named} is not installed, so text was measured with core's portable estimate rather than the fonts opf convert draws with. To measure it, install it: npm install ${named}` } as ValidationReport;
		}
		return report;
	} finally {
		measuring.release();
	}
}

/** The file name the deck view asks for an eager Office face by (scripts/build-app.mjs names them the same way). */
const embeddedFontFile = (face: { family: string; weight: number; italic?: boolean }) => `embedded/${face.family.replace(/[^A-Za-z0-9]+/g, "-")}-${face.weight}-${face.italic ? "italic" : "normal"}.ttf`;

type FontsNode = typeof import("@openpresentation/opf-render/fonts-node");

/**
 * The font files of the installed @openpresentation/opf-render, for the deck view's read_font_file: only the files the renderer's
 * own manifests name (the Office pack's eager faces, its vendored faces under fonts/, the script packages), never a path built from
 * the request. Undefined when the renderer is not installed; the view then draws with Roboto and names the substitution.
 */
export function installedFontFiles(): ReadFontFile {
	let loaded: Promise<{ fonts: FontsNode; root: string; office: Awaited<ReturnType<FontsNode["loadFonts"]>> } | undefined> | undefined;
	const load = () =>
		(loaded ??= (async () => {
			try {
				const fonts = (await import("@openpresentation/opf-render/fonts-node")) as FontsNode;
				const root = path.dirname(createRequire(import.meta.url).resolve("@openpresentation/opf-render/package.json"));
				return { fonts, root, office: await fonts.loadFonts({ pack: "office" }) };
			} catch {
				return undefined;
			}
		})());
	return async (file) => {
		const render = await load();
		if (!render) return undefined;
		if (file.startsWith("embedded/")) {
			const face = render.office.registry.embeddedFonts.find((item) => embeddedFontFile(item) === file);
			return face ? new Uint8Array(Buffer.from(face.dataUrl.slice(face.dataUrl.indexOf(",") + 1), "base64")) : undefined;
		}
		if (file.startsWith("fonts/")) {
			const face = render.office.registry.lazyFonts.find((item) => item.file === file);
			return face ? new Uint8Array(await readFile(path.join(render.root, face.file))) : undefined;
		}
		if (file.startsWith("script-fonts/")) {
			const [, short, ...rest] = file.split("/");
			const pkg = render.fonts.scriptFontPackages("all").find((item) => item.name.split("/").pop() === short);
			const face = pkg?.faces.find((item) => item.file === rest.join("/"));
			if (!pkg || !face) return undefined;
			try {
				const directory = path.dirname(createRequire(path.join(render.root, "package.json")).resolve(`${pkg.name}/package.json`));
				return new Uint8Array(await readFile(path.join(directory, face.file)));
			} catch {
				return undefined;
			}
		}
		return undefined;
	};
}

/** Serve MCP on stdin and stdout until the client closes stdin. */
export async function runStdio(host: StdioHost = {}): Promise<void> {
	const opfVersion = host.opfVersion ?? (createRequire(import.meta.url)("@openpresentation/opf/package.json") as { version: string }).version;
	const server = createOpfServer({ version: host.version ?? MCP_VERSION, opfVersion, checkText: checkDeckText, deckApp: { readFontFile: installedFontFiles() } });
	// The client closing stdin ends the session; with nothing left open the process exits on its own.
	process.stdin.once("close", () => void server.close());
	await server.connect(new StdioServerTransport());
}
