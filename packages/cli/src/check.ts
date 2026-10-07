// What every command shares about checking a document: the failure threshold of `--fail-on` (it replaces the old
// `--strict` on every command) and the check the write, render, export and import commands run before they write.
import { type FindingSeverity, type ValidateOptions } from "@openpresentation/opf";

/** The values of `--fail-on`: fail on findings at or above this severity. */
export const FAIL_ON_LEVELS = ["error", "warning", "info"] as const;

/** The check a command that writes a document runs first: format and references, so a contrast warning never blocks a write. */
export const WRITE_CHECK: ValidateOptions = { only: ["format", "references"] };

const rank: Record<FindingSeverity, number> = { error: 3, warning: 2, info: 1 };

/** The `--fail-on` level of a parsed option value (default `error`), or `undefined` when the value is not one of the levels. */
export function parseFailOn(value: string | boolean | undefined): FindingSeverity | undefined {
	if (value === undefined) return "error";
	return typeof value === "string" && (FAIL_ON_LEVELS as readonly string[]).includes(value) ? (value as FindingSeverity) : undefined;
}

/** True when any finding is at or above the level. */
export const reaches = (findings: readonly { severity: FindingSeverity }[], level: FindingSeverity): boolean => findings.some((finding) => rank[finding.severity] >= rank[level]);

export const FAIL_ON_MESSAGE = `--fail-on must be one of: ${FAIL_ON_LEVELS.join(", ")}.`;
