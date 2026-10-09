// The typed errors of the file API (`open`, `save`, `convert`) and of `parseSlideSelection` (RR-70: browser-safe, exported by
// both builds of the root, where the browser build throws `node-only` from the file functions). A caller branches on `code`, never on the message; `findings` holds the
// located findings a failed run produced (the same shape `validate` reports), `details` the code's own facts (a package name,
// a range, a path). The opf CLI turns these into its JSON error report and exit code.
import type { Finding } from "./core.js";

/** The base class: thrown for the request and the files (`node-only` in the browser build, `invalid-option`, `input-not-found`, `input-unreadable`, `invalid-presentation`, `output-exists`, `output-not-file`, `output-unwritable`). */
export class OPFApiError extends Error {
	readonly code: string;
	readonly details: Record<string, unknown>;
	readonly findings: Finding[];

	constructor(message: string, code: string, extra: { details?: Record<string, unknown>; findings?: Finding[]; cause?: unknown } = {}) {
		super(message, extra.cause === undefined ? undefined : { cause: extra.cause });
		this.name = new.target.name;
		this.code = code;
		this.details = extra.details ?? {};
		this.findings = extra.findings ?? [];
	}
}

/** Thrown by the export step of `convert`: `peer-not-installed`, `peer-too-old`, `peer-load-failed`, `invalid-option`, `invalid-presentation`, `no-slides`, `all-slides-hidden`, `font-failed`, `export-failed`. */
export class OPFExportError extends OPFApiError {}

/** Thrown by the import step of `convert` and by `open` for a PowerPoint file: `peer-not-installed`, `peer-too-old`, `peer-load-failed`, `invalid-option`, `invalid-presentation`, `import-failed`. */
export class OPFImportError extends OPFApiError {}

/** The error as `Class`, whatever was thrown below: an error of that class is returned as it is, another API error keeps its code, details and findings. */
export function asApiError<T extends OPFApiError>(Class: new (message: string, code: string, extra?: { details?: Record<string, unknown>; findings?: Finding[]; cause?: unknown }) => T, error: unknown, fallbackCode: string): T {
	if (error instanceof Class) return error;
	if (error instanceof OPFApiError) return new Class(error.message, error.code, { details: error.details, findings: error.findings, cause: error });
	const failure = error as { code?: unknown; message?: string };
	return new Class(failure?.message ?? String(error), typeof failure?.code === "string" ? failure.code : fallbackCode, { cause: error });
}
