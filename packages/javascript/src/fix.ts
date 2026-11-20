// `fix` (OPF 0.35): apply every safe fix a deck's findings carry, the verb behind `opf fix`. A finding's `fixes` may include a
// JSON Patch marked `safe` (FindingFix: it cannot change what the content says or how it looks beyond the repair), such as
// `use-max-1`, `remove:listColumns`, `rename-layout`, `rename-region` or `use-current-record` on an unedited 0.34 copy. `fix`
// validates, applies one safe fix per finding, and validates again, round after round, until no safe fix is left: an error in
// the deck's own keys stops the accessibility, layout and content checks, so later findings (and their fixes) appear only once
// it is fixed. A fix that is not marked safe is never applied; its finding stays in `findings`. The input is never changed.
import type { Finding, FindingFix, JsonPatchOperation } from "./generated/types/finding.js";
import { OPFPatchError, applyPatch, documentHash, parsePointer } from "./patch.js";
import type { Presentation } from "./types.js";
import type { ValidateOptions, ValidationReport } from "./validation-types.js";
import { createValidator } from "./validator.js";

/** How many validate-and-fix rounds `fix` runs at most when `maxRounds` is not given. */
export const DEFAULT_FIX_ROUNDS = 10;

export interface FixOptions extends ValidateOptions {
	/** The most rounds of fixes (each followed by a validation). Default `DEFAULT_FIX_ROUNDS`. */
	maxRounds?: number;
}

/** One safe fix `fix` applied. */
export interface AppliedFix {
	/** The round it was applied in, from 1. */
	round: number;
	/** The finding it repaired: its rule and JSON Pointer, as validate reported them in that round. */
	ruleId: string;
	path: string;
	/** The fix's `id` (its title when it has none) and title. */
	fix: string;
	title: string;
	/** The JSON Patch that was applied. */
	patch: JsonPatchOperation[];
}

export interface FixResult {
	/** The fixed deck (a copy). */
	document: Presentation;
	/** The safe fixes applied, in order. */
	applied: AppliedFix[];
	/** The findings of the fixed deck: the last validation's. */
	findings: Finding[];
	/** The last validation's report (the fixed deck's). */
	report: ValidationReport;
	/** How many rounds applied fixes. */
	rounds: number;
	/**
	 * Why it stopped: `stable` when no safe fix is left; `max-rounds` when the findings still carried safe fixes after `maxRounds`
	 * rounds; `no-progress` when the safe fixes left no longer apply, or return the deck to a state it had.
	 */
	stopped: "stable" | "max-rounds" | "no-progress";
}

type Patch = FindingFix & { patch: JsonPatchOperation[] };
const isSafePatch = (fix: FindingFix): fix is Patch => fix.safe === true && (fix.kind ?? "patch") === "patch" && Array.isArray(fix.patch) && fix.patch.length > 0;

/** The pointers an operation writes. Adding or removing an array element shifts its siblings, so it writes the whole array. */
function written(operation: JsonPatchOperation): string[] {
	const at = (pointer: string, structural: boolean) => {
		const tokens = parsePointer(pointer);
		const last = tokens.at(-1);
		return structural && last !== undefined && /^(\d+|-)$/.test(last) ? pointer.slice(0, pointer.lastIndexOf("/")) : pointer;
	};
	if (operation.op === "test") return [];
	const structural = operation.op === "add" || operation.op === "remove" || operation.op === "move" || operation.op === "copy";
	return [at(operation.path, structural), ...(operation.op === "move" ? [at(operation.from, true)] : [])];
}

/** Two pointers overlap when one is the other or lies inside it. */
const overlaps = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const depth = (paths: readonly string[]) => Math.min(...paths.map((pointer) => parsePointer(pointer).length));

interface Candidate {
	finding: Finding;
	fix: Patch;
	paths: string[];
	depth: number;
}

/**
 * The fixes of one round: for each finding, its safe patch fix that writes the shallowest part of the deck (a record-wide fix such
 * as `use-current-record` repairs every key the per-key fixes would), shallowest first.
 */
function candidates(findings: readonly Finding[]): Candidate[] {
	const chosen: Candidate[] = [];
	for (const finding of findings) {
		let best: Candidate | undefined;
		for (const fix of finding.fixes ?? []) {
			if (!isSafePatch(fix)) continue;
			const paths = fix.patch.flatMap(written);
			if (!paths.length) continue;
			const candidate = { finding, fix, paths, depth: depth(paths) };
			if (!best || candidate.depth < best.depth) best = candidate;
		}
		if (best) chosen.push(best);
	}
	return chosen.sort((a, b) => a.depth - b.depth);
}

/**
 * Apply the safe fixes of a deck's findings until none is left: validate, apply one safe fix per finding (fixes whose patches
 * write overlapping parts of the deck wait for the next round, which validates again), and repeat, at most `maxRounds` times.
 * Fixes not marked `safe`, and `focus` fixes, are never applied. Takes a parsed deck (not text); the input is never changed.
 * Validation takes `options` as `validate` does (in Node the default catalog is registered when `catalogs` is omitted). Load the
 * icon sets the deck names first (`ensureIcons`), so a renamed icon is reported with its fix.
 */
export function fix(document: unknown, options: FixOptions = {}): FixResult {
	const { maxRounds = DEFAULT_FIX_ROUNDS, ...validateOptions } = options;
	if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new TypeError("fix: maxRounds must be a positive integer.");
	const validator = createValidator();
	let working = structuredClone(document);
	const applied: AppliedFix[] = [];
	const seen = new Set([documentHash(working)]);
	let rounds = 0;
	for (;;) {
		const report = validator.validate(working, validateOptions);
		const pending = candidates(report.findings);
		const result = (stopped: FixResult["stopped"]): FixResult => ({ document: working as Presentation, applied, findings: report.findings, report, rounds, stopped });
		if (!pending.length) return result("stable");
		if (rounds === maxRounds) return result("max-rounds");
		const touched: string[] = [];
		let changed = false;
		for (const { finding, fix: chosen, paths } of pending) {
			if (paths.some((path) => touched.some((done) => overlaps(path, done)))) continue;
			try {
				working = applyPatch(working, chosen.patch);
			} catch (error) {
				// The patch no longer fits the deck (an earlier fix of this round changed what it addressed): the next round decides.
				if (error instanceof OPFPatchError) continue;
				throw error;
			}
			touched.push(...paths);
			changed = true;
			applied.push({ round: rounds + 1, ruleId: finding.ruleId, path: finding.path, fix: chosen.id ?? chosen.title, title: chosen.title, patch: structuredClone(chosen.patch) });
		}
		if (!changed) return result("no-progress");
		rounds += 1;
		const hash = documentHash(working);
		if (seen.has(hash)) {
			const last = validator.validate(working, validateOptions);
			return { document: working as Presentation, applied, findings: last.findings, report: last, rounds, stopped: "no-progress" };
		}
		seen.add(hash);
	}
}
