// Fonts for render and export. Policy (owner, 2026-09-29): only the renderer's bundled open font pack and the files
// the caller names with --font-dir. System fonts are never loaded: rasterizing and PDF output get explicit font
// files, so the same deck gives the same bytes on every machine.
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { FileCommandError } from "./io.js";
import type { Diagnostic, EmbeddedFace, FontsHandle, Renderer } from "./peers.js";
import type { Reporter } from "./reporter.js";

export interface PreparedFonts {
	/** The fonts handle of opf-render `loadFonts()`: passed as `{ fonts }` to every deck-level call. */
	handle: FontsHandle;
	/** Absolute paths of the --font-dir files, in load order. */
	userFonts: string[];
}

const FONT_FILE = /\.(ttf|otf)$/i;

/** Font files directly inside each directory (no recursion), sorted by name so the load order is the same everywhere. */
export async function listFontDirectories(directories: string[]): Promise<string[]> {
	const files: string[] = [];
	for (const directory of directories) {
		const resolved = path.resolve(directory);
		let names: string[];
		try {
			if (!(await stat(resolved)).isDirectory()) throw new FileCommandError(`--font-dir ${directory} is not a directory.`);
			names = await readdir(resolved);
		} catch (error) {
			if (error instanceof FileCommandError) throw error;
			throw new FileCommandError(`Cannot read --font-dir ${directory}: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}.`);
		}
		const found = names.filter((name) => FONT_FILE.test(name)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		if (!found.length) throw new FileCommandError(`--font-dir ${directory} contains no .ttf or .otf files.`);
		files.push(...found.map((name) => path.join(resolved, name)));
	}
	return files;
}

/**
 * The office pack (Carlito, Intos, the open families font schemes select and the open replacements the font policy
 * routes to, with lazy faces loaded on demand), visual substitution, and Noto script packages for the scripts the
 * deck's text draws when they are installed. `faces` are the --font-dir files, loaded first.
 */
export async function prepareFonts(renderer: Renderer, presentation: unknown, userFonts: string[], reporter: Reporter): Promise<PreparedFonts> {
	try {
		const handle = await renderer.fonts.loadFonts({
			pack: "office",
			substitutionPolicy: "visual",
			scripts: "auto",
			presentation,
			faces: userFonts.map((file) => ({ path: file })),
			onDiagnostic: (diagnostic: Diagnostic) => reporter.add("fonts", scriptDiagnostic(diagnostic)),
		});
		return { handle, userFonts };
	} catch (error) {
		const failure = error as { code?: string; message?: string; details?: Record<string, unknown> };
		throw new FileCommandError(failure.message ?? String(error), 2, {
			code: failure.code ?? "font-preparation-failed",
			...(failure.details?.package ? { package: failure.details.package } : {}),
		});
	}
}

function scriptDiagnostic(diagnostic: Diagnostic): Diagnostic {
	if (diagnostic.code !== "script-font-not-installed") return diagnostic;
	const name = typeof diagnostic.package === "string" ? diagnostic.package : "the Noto script package";
	return { ...diagnostic, message: `${diagnostic.message} Install ${name} next to the CLI (npm install -g ${name}) to draw this script with a bundled open font.` };
}

/**
 * Faces an SVG should carry. Marking every face `embed: "used"` makes the renderer embed a face only when the slide's
 * text names its family, so a slide in one family ships kilobytes of font rather than the whole pack.
 */
export function embeddedFor(handle: FontsHandle, mode: "used" | "none"): (EmbeddedFace & { embed?: "used" })[] {
	return mode === "none" ? [] : handle.embeddedFonts.map((face) => ({ ...face, embed: "used" as const }));
}

/** The substitutions made while rendering, one row per requested family and the face that stood in for it. */
export function substitutionRows(handle: FontsHandle) {
	const rows = new Map<string, { requested: string; resolved: string; compatibility: string }>();
	for (const item of handle.substitutions) {
		if (!item.substitute) continue;
		rows.set(`${item.requestedFamily}\u0000${item.resolvedFamily}`, { requested: item.requestedFamily, resolved: item.resolvedFamily, compatibility: item.compatibility });
	}
	return [...rows.values()].sort((a, b) => (a.requested + a.resolved < b.requested + b.resolved ? -1 : 1));
}
