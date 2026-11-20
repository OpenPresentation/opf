// `fix` (OPF 0.35): apply the safe fixes of a deck's findings, the verb behind `opf fix`. A finding's `fixes` may include a JSON
// Patch marked `safe` (FindingFix: it loses no content, what it writes is valid, and it changes nothing beyond the repair but what
// `changesDrawing` says), such as `use-max-1`, `remove:listColumns`, `rename-layout`, `rename-region` or `use-current-record` on an
// unedited 0.34 copy. By default `fix` applies the fixes of the checks that repair the document (FIX_REPAIR_CATEGORIES: format,
// references, policy and layout); the audits' fixes (accessibility, content and any other producer's category) only with `audits`.
// It validates, applies one safe fix per finding, and validates again, round after round, until no safe fix is left: an error in the
// deck's own keys stops the accessibility, layout and content checks, so later findings (and their fixes) appear only once it is
// fixed. A fix that is not marked safe, and a `focus` fix, is never applied; its finding stays in `findings`. Each applied fix says
// whether it can change how a slide draws (`changesDrawing`). The input is never changed.
import type { Finding, FindingFix, JsonPatchOperation } from "./generated/types/finding.js";
import { OPFPatchError, applyPatch, documentHash, parsePointer } from "./patch.js";
import type { Presentation } from "./types.js";
import type { ValidateOptions, ValidationCategory, ValidationReport } from "./validation-types.js";
import { createValidator } from "./validator.js";
import { layoutCellsMove } from "./layout-cells.js";

/** How many validate-and-fix rounds `fix` runs at most when `maxRounds` is not given. */
export const DEFAULT_FIX_ROUNDS = 10;

/**
 * The checks whose safe fixes `fix` applies by default: those that repair the document (is it well-formed OPF, does every reference
 * resolve, does it keep the host's policy, does every pin name a region). The others are audits (accessibility, content, and the
 * categories of other producers such as `narrative`): advice on how the deck reads or looks, applied only with `audits: true`.
 */
export const FIX_REPAIR_CATEGORIES: readonly ValidationCategory[] = Object.freeze(["format", "references", "policy", "layout"]);

export interface FixOptions extends ValidateOptions {
	/** The most rounds of fixes (each followed by a validation). Default `DEFAULT_FIX_ROUNDS`. */
	maxRounds?: number;
	/**
	 * Apply the safe fixes of the audits too (findings outside FIX_REPAIR_CATEGORIES: accessibility, content, ...). Default false: a
	 * migration repairs the document and never restyles its content. The findings are reported either way.
	 */
	audits?: boolean;
}

/** Whether `fix` applies a finding's safe fixes: a repair check's always, any other with `audits`. */
const fixesInScope = (finding: Pick<Finding, "category">, audits = false): boolean => audits || (FIX_REPAIR_CATEGORIES as readonly string[]).includes(finding.category);

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
	/**
	 * True when the fix can change how a slide draws (FindingFix `changesDrawing`): the fixed deck keeps every word and is valid, but does
	 * not keep the drawing of the release that wrote it, such as `rename-layout` from `agenda-split` (its title column narrows from half the
	 * width to two fifths) or `remove:contentDirection`. False when it draws as before.
	 */
	changesDrawing: boolean;
	/** The JSON Patch that was applied (with the removal of a `design` object the fixes of its round emptied). */
	patch: JsonPatchOperation[];
}

/**
 * OPF 0.35: a slide that placed content in the cells of its grid with 0.34's slide keys and also named a `layout`. Through 0.34 the cells
 * composed it and the layout gave it only its design (alignment, boxes, bullets, image fit, color variant) and composition defaults. The
 * safe fix removes `layout`, names the cells on blocks and writes what the layout gave on the slide, when the slide then draws exactly
 * as before; otherwise the slide is left with its finding for a person to choose (remove the layout, or keep it and let the blocks bind
 * to its regions).
 */
export interface LayoutWithCells {
	/** The slide's index. */
	slide: number;
	/** The layout reference the slide had. */
	layout: string;
	/** True when `fix` rewrote the slide: `layout` removed, the cells named on blocks. */
	rewritten: boolean;
	/** What the rewrite wrote on the slide to keep the layout's contribution (`design.contentAlignment`, `design.variant`, ...). */
	kept?: string[];
	/** Why the slide was left as it is (its fixes are not safe). */
	reason?: string;
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
	/** The slides that had both a `layout` and 0.34 cell keys (LayoutWithCells): each rewritten, or left with the reason. Empty when none. */
	layoutWithCells: LayoutWithCells[];
}

const SLIDE_LAYOUT = /^\/slides\/(\d+)\/layout$/;

/** The slides with a layout and 0.34 cell keys: those the applied fixes rewrote, then those the findings still carry unsafe fixes for. */
function layoutWithCells(original: unknown, document: unknown, applied: readonly AppliedFix[], findings: readonly Finding[], options: ValidateOptions): LayoutWithCells[] {
	const slidesOf = (deck: unknown) => (deck && typeof deck === "object" && Array.isArray((deck as { slides?: unknown }).slides) ? ((deck as { slides: unknown[] }).slides) : []);
	const layoutOf = (deck: unknown, index: number) => {
		const slide = slidesOf(deck)[index];
		const value = slide && typeof slide === "object" ? (slide as { layout?: unknown }).layout : undefined;
		return typeof value === "string" ? value : undefined;
	};
	const entries = new Map<number, LayoutWithCells>();
	for (const entry of applied) {
		if (entry.fix !== "cells-to-blocks") continue;
		const removed = entry.patch.map((operation) => (operation.op === "remove" ? SLIDE_LAYOUT.exec(operation.path) : null)).find(Boolean);
		if (!removed) continue;
		const index = Number(removed[1]), layout = layoutOf(original, index) ?? "";
		const prefix = `/slides/${index}/`;
		const kept = entry.patch.flatMap((operation) => {
			if (operation.op !== "add" || !operation.path.startsWith(prefix)) return [];
			const [key, name] = parsePointer(operation.path).slice(2);
			if (key !== "design" && key !== "composition") return [];
			return name !== undefined ? [`${key}.${name}`] : Object.keys((operation.value ?? {}) as object).map((field) => `${key}.${field}`);
		});
		entries.set(index, { slide: index, layout, rewritten: true, ...(kept.length ? { kept } : {}) });
	}
	for (const finding of findings) {
		if (!(finding.fixes ?? []).some((entry) => entry.id === "cells-to-blocks" && entry.safe !== true)) continue;
		const index = finding.slide ?? Number(/^\/slides\/(\d+)\//.exec(finding.path)?.[1]);
		const layout = Number.isInteger(index) ? layoutOf(document, index) : undefined;
		if (layout === undefined || entries.has(index)) continue;
		const move = layoutCellsMove(document, index, { catalogs: options.catalogs });
		entries.set(index, { slide: index, layout, rewritten: false, reason: move?.reason ?? "its content cannot move into blocks as it is (the slide also has root content or blocks)" });
	}
	return [...entries.values()].sort((a, b) => a.slide - b.slide);
}

type Patch = FindingFix & { patch: JsonPatchOperation[] };
/**
 * A fix `fix` can apply: marked safe and a JSON Patch. A `focus` fix (`focus-language`, `focus-alt`: a field a person writes) is never
 * applied nor counted, whatever its `safe`; neither is a fix with no operations.
 */
export const isSafePatch = (fix: FindingFix): fix is Patch => fix.safe === true && (fix.kind ?? "patch") === "patch" && Array.isArray(fix.patch) && fix.patch.length > 0;

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
function candidates(findings: readonly Finding[], audits: boolean): Candidate[] {
	const chosen: Candidate[] = [];
	for (const finding of findings) {
		if (!fixesInScope(finding, audits)) continue;
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

/** The `design` objects a patch's `remove` operations may empty: the parent of each removed key whose parent is a `design`. */
const designParents = (patch: readonly JsonPatchOperation[]): string[] =>
	patch.flatMap((operation) => (operation.op === "remove" && parsePointer(operation.path).at(-2) === "design" ? [operation.path.slice(0, operation.path.lastIndexOf("/"))] : []));

const readPointer = (root: unknown, pointer: string): unknown =>
	parsePointer(pointer).reduce<unknown>((value, key) => (value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), root);
const isEmptyObject = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length;

/**
 * Apply the safe fixes of a deck's findings until none is left: validate, apply one safe fix per finding (fixes whose patches
 * write overlapping parts of the deck wait for the next round, which validates again), and repeat, at most `maxRounds` times.
 * Only the fixes of the repair checks (FIX_REPAIR_CATEGORIES) are applied unless `audits` is true. Fixes not marked `safe`, and
 * `focus` fixes, are never applied. A `design` object that a round's fixes emptied (two removed keys of one slide) is removed with
 * them. Each applied fix says whether it can change how a slide draws (`changesDrawing`). Takes a parsed deck (not text); the input
 * is never changed.
 * Validation takes `options` as `validate` does (in Node the default catalog is registered when `catalogs` is omitted). Load the
 * icon sets the deck names first (`ensureIcons`), so a renamed icon is reported with its fix.
 */
export function fix(document: unknown, options: FixOptions = {}): FixResult {
	const { maxRounds = DEFAULT_FIX_ROUNDS, audits = false, ...validateOptions } = options;
	if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new TypeError("fix: maxRounds must be a positive integer.");
	const validator = createValidator();
	let working = structuredClone(document);
	const applied: AppliedFix[] = [];
	const seen = new Set([documentHash(working)]);
	let rounds = 0;
	for (;;) {
		const report = validator.validate(working, validateOptions);
		const pending = candidates(report.findings, audits);
		const result = (stopped: FixResult["stopped"]): FixResult => ({ document: working as Presentation, applied, findings: report.findings, report, rounds, stopped, layoutWithCells: layoutWithCells(document, working, applied, report.findings, validateOptions) });
		if (!pending.length) return result("stable");
		if (rounds === maxRounds) return result("max-rounds");
		const touched: string[] = [];
		let changed = false;
		for (const { finding, fix: chosen, paths } of pending) {
			if (paths.some((path) => touched.some((done) => overlaps(path, done)))) continue;
			// A design object this patch empties, which held keys before it, goes with them (the fixes of one round may delete two of its keys).
			const parents = [...new Set(designParents(chosen.patch))].filter((pointer) => !isEmptyObject(readPointer(working, pointer)));
			const patch: JsonPatchOperation[] = structuredClone(chosen.patch);
			try {
				working = applyPatch(working, chosen.patch);
				const removals = parents.filter((pointer) => isEmptyObject(readPointer(working, pointer))).map((pointer) => ({ op: "remove" as const, path: pointer }));
				if (removals.length) {
					working = applyPatch(working, removals);
					patch.push(...removals);
				}
			} catch (error) {
				// The patch no longer fits the deck (an earlier fix of this round changed what it addressed): the next round decides.
				if (error instanceof OPFPatchError) continue;
				throw error;
			}
			touched.push(...paths, ...patch.slice(chosen.patch.length).map((operation) => operation.path));
			changed = true;
			applied.push({ round: rounds + 1, ruleId: finding.ruleId, path: finding.path, fix: chosen.id ?? chosen.title, title: chosen.title, changesDrawing: chosen.changesDrawing === true, patch });
		}
		if (!changed) return result("no-progress");
		rounds += 1;
		const hash = documentHash(working);
		if (seen.has(hash)) {
			const last = validator.validate(working, validateOptions);
			return { document: working as Presentation, applied, findings: last.findings, report: last, rounds, stopped: "no-progress", layoutWithCells: layoutWithCells(document, working, applied, last.findings, validateOptions) };
		}
		seen.add(hash);
	}
}
