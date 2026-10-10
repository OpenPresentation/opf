// The one error type of the commands (RR-75). Every failure the CLI prints carries a `code`, a message that states the fix, and
// the exit status: 2 for a usage, read, I/O or environment problem, 1 for a document, a finding at --fail-on or a conflict.
import { OPFApiError } from "@openpresentation/opf/internal/engine";

export class CliError extends Error {
	constructor(
		message: string,
		/** A stable code: `usage`, `unknown-option`, `removed-command`, `output-exists`, `invalid-document`, an engine's code, ... */
		readonly code: string,
		/** The exit status. */
		readonly exit: 1 | 2 = 2,
		/** More fields of the error report (`findings`, `counts`, `package`, `install`, ...). */
		readonly details: Record<string, unknown> = {},
	) {
		super(message);
	}
}

/** A usage error: exit 2 with `code` (default `usage`). */
export const usage = (message: string, code = "usage", details: Record<string, unknown> = {}) => new CliError(message, code, 2, details);

/** Codes of the engines whose failure is about the document, not the request: exit 1. */
const DOCUMENT_CODES = new Set(["invalid-presentation", "no-slides", "all-slides-hidden", "export-failed", "import-failed", "output-exists", "output-not-file"]);

/** An engine error (`OPFApiError` and its subclasses) as the command's error, with its code and details. */
export function fromApiError(error: OPFApiError): CliError {
	const details: Record<string, unknown> = { ...(error.details ?? {}) };
	if (error.findings?.length) details.findings = error.findings;
	return new CliError(error.message, error.code, DOCUMENT_CODES.has(error.code) ? 1 : 2, details);
}
