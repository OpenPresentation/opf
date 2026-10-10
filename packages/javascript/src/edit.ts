// `edit` (RR-75): a JSON Patch applied to a deck and the result checked, the verb behind `opf edit`. The input is never changed;
// the patch applies whole or not at all (`OPFPatchError`), and a result that fails the format and references check throws
// `OPFValidationError`, so an edit never leaves an invalid deck. The returned `inverse` undoes the edit.
import type { Catalog } from "./catalog-refs.js";
import type { Finding, JsonPatchOperation } from "./generated/types/finding.js";
import { applyPatchWithInverse } from "./patch.js";
import type { Presentation } from "./types.js";
import { OPFValidationError, validate } from "./validator.js";

export interface EditOptions {
	/** The catalogs the result's references resolve in. In Node the default catalog when omitted, as `opf edit` registers it; in the browser build none. */
	catalogs?: readonly Catalog[];
	/** `false` skips the check of the result (work in progress). Default true. */
	validate?: boolean;
}

export interface EditResult {
	/** The patched deck (a copy). */
	presentation: Presentation;
	/** The warnings and notes of the format and references check (errors throw). */
	findings: Finding[];
	/** The patch that restores the input. */
	inverse: JsonPatchOperation[];
}

/** Apply a JSON Patch (`add`, `remove`, `replace`, `move`, `copy`, `test`) to a deck and check the result's format and references. */
export function edit(deck: unknown, patch: unknown, options: EditOptions = {}): EditResult {
	const result = applyPatchWithInverse(deck, patch);
	const presentation = result.presentation as Presentation;
	if (options.validate === false) return { presentation, findings: [], inverse: result.inverse };
	const report = validate(presentation, { only: ["format", "references"], ...(options.catalogs ? { catalogs: options.catalogs } : {}) });
	if (!report.valid) throw new OPFValidationError(report);
	return { presentation, findings: report.findings, inverse: result.inverse };
}
