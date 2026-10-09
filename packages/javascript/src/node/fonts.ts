// Fonts for render and export. Policy (owner, 2026-09-29): only the renderer's bundled open font pack and the files
// the caller names with --font-dir. System fonts are never loaded: rasterizing and PDF output get explicit font
// files, so the same deck gives the same bytes on every machine. The pack is loaded once per process for the decks it
// serves unchanged (leaseSharedFonts), so a library caller that converts many decks does not reload it every time.
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { OPFApiError } from "./errors.js";
import { type Diagnostic, type EmbeddedFace, type FontsHandle, type Renderer, missingPeerFrom } from "./peers.js";
import type { Reporter } from "./reporter.js";

export interface PreparedFonts {
	/** The fonts handle of opf-render `loadFonts()`: passed as `{ fonts }` to every deck-level call. */
	handle: FontsHandle;
	/** Absolute paths of the --font-dir files, in load order. */
	userFonts: string[];
}

const FONT_FILE = /\.(ttf|otf)$/i;

/** Font files directly inside each directory (no recursion), sorted by name so the load order is the same everywhere. */
export async function listFontDirectories(directories: string[], label = "--font-dir"): Promise<string[]> {
	const files: string[] = [];
	for (const directory of directories) {
		const resolved = path.resolve(directory);
		let names: string[];
		try {
			if (!(await stat(resolved)).isDirectory()) throw new OPFApiError(`${label} ${directory} is not a directory.`, "invalid-option");
			names = await readdir(resolved);
		} catch (error) {
			if (error instanceof OPFApiError) throw error;
			throw new OPFApiError(`Cannot read ${label} ${directory}: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}.`, "invalid-option");
		}
		const found = names.filter((name) => FONT_FILE.test(name)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		if (!found.length) throw new OPFApiError(`${label} ${directory} contains no .ttf or .otf files.`, "invalid-option");
		files.push(...found.map((name) => path.join(resolved, name)));
	}
	return files;
}

/**
 * The office pack (Carlito, Intos, the open families font schemes select and the open replacements the font policy
 * routes to, with lazy faces loaded on demand), visual substitution, and Noto script packages for the scripts the
 * deck's text draws when they are installed. `faces` are the --font-dir files, loaded first.
 */
export async function prepareFonts(renderer: Renderer, presentation: unknown, userFonts: string[], reporter: Reporter, embedScriptFonts = false): Promise<PreparedFonts> {
	try {
		const handle = await renderer.fonts.loadFonts({
			pack: "office",
			substitutionPolicy: "visual",
			scripts: "auto",
			embedScriptFonts,
			presentation,
			faces: userFonts.map((file) => ({ path: file })),
			onDiagnostic: (diagnostic: Diagnostic) => reporter.add("fonts", scriptDiagnostic(diagnostic)),
		});
		return { handle, userFonts };
	} catch (error) {
		const missing = missingPeerFrom(error);
		if (missing) throw missing;
		const failure = error as { code?: string; message?: string; details?: Record<string, unknown> };
		throw new OPFApiError(failure.message ?? String(error), failure.code ?? "font-preparation-failed", {
			details: failure.details?.package ? { package: failure.details.package } : {},
			cause: error,
		});
	}
}

/** A fonts handle lent to one export. `release` returns it; until then no other export uses the shared handle. */
export interface FontsLease {
	handle: FontsHandle;
	release(): void;
}

interface SharedEntry {
	ready: Promise<{ handle: FontsHandle; diagnostics: Diagnostic[] }>;
	/** Settles when the export that holds the handle releases it: exports on one shared handle run one at a time. */
	queue: Promise<void>;
}

/** The deck the shared handle is prepared for: no text, so no script faces and no glyph fallback. */
const NEUTRAL_DECK = { slides: [] };
const shared = new Map<string, SharedEntry>();

/**
 * The default fonts handle of this process, prepared once (the office pack plus `userFonts`, keyed by that file list and
 * `embedScriptFonts`) and lent to one export at a time, so the substitutions it records are the export's own. It is lent
 * only for a deck that draws no script beyond Latin, Greek and Cyrillic and needs no glyph-fallback face: for such a deck
 * a handle prepared for it and the shared one hold the same faces, so the bytes are the same. Any other deck, or a
 * renderer without `autoScriptSelection`, gets undefined and the caller prepares a handle of its own (`prepareFonts`).
 */
export async function leaseSharedFonts(renderer: Renderer, presentation: unknown, userFonts: string[], reporter: Reporter, embedScriptFonts = false): Promise<FontsLease | undefined> {
	const select = (renderer.fonts as { autoScriptSelection?: (presentation: unknown) => { detected?: unknown[]; scripts?: unknown[]; unavailable?: unknown[] } }).autoScriptSelection;
	if (typeof select !== "function") return undefined;
	const selection = select(presentation);
	if (selection.detected?.length || selection.scripts?.length || selection.unavailable?.length) return undefined;
	const key = JSON.stringify([userFonts, embedScriptFonts]);
	let entry = shared.get(key);
	if (!entry) {
		// The diagnostics of the one preparation (already worded by prepareFonts), repeated into each export's report.
		const diagnostics: Diagnostic[] = [];
		const sink = { add: (_source: string, diagnostic: Diagnostic) => void diagnostics.push(diagnostic) } as unknown as Reporter;
		const ready = prepareFonts(renderer, NEUTRAL_DECK, userFonts, sink, embedScriptFonts).then((prepared) => ({ handle: prepared.handle, diagnostics }));
		const created: SharedEntry = { ready, queue: Promise.resolve() };
		entry = created;
		shared.set(key, created);
		// A failed preparation (a missing font package) is not kept: the next call tries again and reports the same error.
		ready.catch(() => {
			if (shared.get(key) === created) shared.delete(key);
		});
	}
	const { handle, diagnostics } = await entry.ready;
	let release!: () => void;
	const previous = entry.queue;
	entry.queue = new Promise<void>((resolve) => {
		release = resolve;
	});
	await previous;
	const pending = (handle as { pending?: (presentation: unknown) => string[] }).pending;
	if (typeof pending === "function" && pending.call(handle, presentation).length) {
		release();
		return undefined;
	}
	(handle.registry as { clearSubstitutions?: () => void } | undefined)?.clearSubstitutions?.();
	for (const diagnostic of diagnostics) reporter.add("fonts", diagnostic);
	return { handle, release };
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
