// The typed errors of `@openpresentation/cli/api`. A caller branches on `code`, never on the message; `findings` holds the
// located findings a failed run produced (the same shape `validate` reports), `details` the code's own facts (a package name,
// a range). The CLI commands turn these into their JSON error report and exit code (render.ts, import.ts).
import type { Finding } from "@openpresentation/opf";

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

/** Thrown by `exportDeck`: `peer-not-installed`, `peer-too-old`, `peer-load-failed`, `invalid-option`, `invalid-presentation`, `no-slides`, `all-slides-hidden`, `font-failed`, `export-failed`. */
export class OPFExportError extends OPFApiError {}

/** Thrown by `importDeck`: `peer-not-installed`, `peer-too-old`, `peer-load-failed`, `invalid-option`, `invalid-presentation`, `import-failed`. */
export class OPFImportError extends OPFApiError {}

/** The error as `Class`, whatever was thrown below: an error of that class is returned as it is, another API error keeps its code, details and findings. */
export function asApiError<T extends OPFApiError>(Class: new (message: string, code: string, extra?: { details?: Record<string, unknown>; findings?: Finding[]; cause?: unknown }) => T, error: unknown, fallbackCode: string): T {
	if (error instanceof Class) return error;
	if (error instanceof OPFApiError) return new Class(error.message, error.code, { details: error.details, findings: error.findings, cause: error });
	const failure = error as { code?: unknown; message?: string };
	return new Class(failure?.message ?? String(error), typeof failure?.code === "string" ? failure.code : fallbackCode, { cause: error });
}
