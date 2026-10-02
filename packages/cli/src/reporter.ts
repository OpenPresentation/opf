// The diagnostics reporter shared by render, export and import. It extends the `opf lint` report: same fields
// (`valid`, `schemaValid`, `diagnostics`, `counts`, `checks`, `sha256`, `opfVersion`), same diagnostic shape
// (`ruleId`, `severity`, `path` as a JSON Pointer, `scope`, `message`, `help`), so one consumer reads all of them.
// Renderer, exporter and importer diagnostics are appended with a `render/`, `pptx/`, `pdf/`, `fonts/` or `import/`
// rule prefix. Exit status follows lint: an error always fails, a warning fails under --strict.
import type { LintDiagnostic, LintReport, LintSeverity } from "@openpresentation/opf";
import { pointerOf } from "./io.js";
import type { Diagnostic } from "./peers.js";

export type Source = "render" | "pptx" | "pdf" | "fonts" | "import" | "cli";

/** Codes that only note a harmless substitution or a note about what was embedded; everything else a library reports is a warning. */
const INFO = new Set([
	"font-glyph-fallback",
	"font-substituted",
	"pdf-font-embedded",
	"pdf-font-fallback",
	"svg-image-rasterized",
	"svg-sanitized",
	"script-font-unavailable",
	"media-provenance-omitted",
]);

const HELP: Record<string, string> = {
	"text-overflow": "Shorten the text, or split the slide: add --paginate (measured with the same fonts) or run opf paginate.",
	"small-cell": "Give the table more room or fewer columns, or run opf paginate.",
	"unresolved-asset": "Embed the image as a data URI, or keep the file inside the deck folder (see --asset-dir). URLs are never fetched.",
	"asset-blocked": "Move the file under the deck folder or pass --asset-dir <directory> that contains it.",
	"script-font-not-installed": "Install the Noto script package named in the message next to the CLI, then run the command again.",
	"font-glyph-fallback": "The chosen font lacks these characters; a bundled font draws them. Supply a font with --font-dir to change that.",
	"unresolved-font-scheme": "Use a font-scheme id from opf catalog fontSchemes, or define the record inline.",
	"unresolved-content": "Check the content at this path; it could not be drawn.",
	"chart-data-adapted": "The chart data was reshaped to export a native chart; see the message.",
	"chart-data-unplottable": "Provide inline chart data with at least one numeric column.",
	"content-placeholder": "This content has no PowerPoint form; a placeholder frame stands in for it.",
	"unsupported-image-treatment": "Remove or change the image treatment at this path.",
	"date-needs-value": "Pass --date YYYY-MM-DD. The CLI never reads a clock, so output stays reproducible.",
	"font-unavailable": "Pass --font-dir with the font files, or choose a font the bundled pack covers (opf catalog fontSchemes).",
	"missing-glyph": "Install the script font package named by script-font-not-installed, or supply a covering font with --font-dir.",
	"duplicate-font-face": "A --font-dir face repeats a bundled family, weight and style; remove it or rename the family.",
};

export interface ReportDiagnostic extends Omit<LintDiagnostic, "scope"> {
	scope: "document" | "context";
	[detail: string]: unknown;
}

export class Reporter {
	readonly diagnostics: ReportDiagnostic[] = [];
	private readonly seen = new Set<string>();

	constructor(initial: readonly LintDiagnostic[] = []) {
		for (const item of initial) this.diagnostics.push(item as ReportDiagnostic);
	}

	/** Add a library diagnostic (`code`, `path`, `message` and details). Identical entries are kept once. */
	add(source: Source, diagnostic: Diagnostic, severity?: LintSeverity) {
		const { code, path: where, message, ...details } = diagnostic;
		const entry: ReportDiagnostic = {
			ruleId: `${source}/${code}`,
			severity: severity ?? (INFO.has(code) ? "info" : "warning"),
			path: pointerOf(where ?? ""),
			scope: "document",
			message,
			help: HELP[code] ?? "",
			...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined)),
		};
		const key = JSON.stringify([entry.ruleId, entry.path, entry.message]);
		if (this.seen.has(key)) return;
		this.seen.add(key);
		this.diagnostics.push(entry);
	}

	error(source: Source, code: string, message: string, where = "", details: Record<string, unknown> = {}) {
		this.add(source, { code, path: where, message, ...details }, "error");
	}

	get counts(): Record<LintSeverity, number> {
		const counts = { error: 0, warning: 0, info: 0 };
		for (const item of this.diagnostics) counts[item.severity] += 1;
		return counts;
	}

	get failed() {
		return this.counts.error > 0;
	}
}

/** Convert a thrown library error into a report diagnostic, keeping its code and the path it names. */
export function reportThrown(reporter: Reporter, source: Source, error: unknown) {
	const failure = error as { code?: unknown; message?: string; details?: Record<string, unknown>; path?: unknown };
	const code = typeof failure.code === "string" ? failure.code : "failed";
	const details = failure.details ?? {};
	const where = typeof details.path === "string" ? details.path : typeof failure.path === "string" ? failure.path : "";
	const extra: Record<string, unknown> = {};
	for (const key of ["fontFamily", "character", "family", "package", "script"]) if (details[key] !== undefined) extra[key] = details[key];
	reporter.error(source, code, failure.message ?? String(error), where, extra);
}

export function finishReport(
	base: Pick<LintReport, "valid" | "schemaValid" | "checks">,
	reporter: Reporter,
	strict: boolean,
) {
	const counts = reporter.counts;
	const ok = base.valid && counts.error === 0 && !(strict && counts.warning > 0);
	return { ok, valid: base.valid && counts.error === 0, schemaValid: base.schemaValid, diagnostics: reporter.diagnostics, counts, checks: base.checks };
}
