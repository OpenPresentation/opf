// Slide selections (RR-70): `3`, `"1-3"`, `"1,3-5"`, `"2-"` and `"-3"`, counted from 1. One parser for the opf CLI's `--slides`,
// core's `convert` and the renderer's `toSvg(deck, slides?)`. Browser-safe: it needs no file system.
import { OPFApiError } from "./api-errors.js";

/** A slide selection: one slide number, a list of them, or text such as `"1,3-5"`, `"2-"` (to the end) or `"-3"` (from the start). Slides count from 1. */
export type SlideSelection = number | string | readonly number[];

const isSlideNumber = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1;

/**
 * The slide numbers a selection names in a presentation of `total` slides: one-based, ascending, without repeats. A number or a
 * list of numbers names those slides; text names slides and ranges, separated by commas: `"1,3-5"`, `"2-"` (from 2 to the end)
 * and `"-3"` (from the start to 3). Throws `OPFApiError` `no-slides` when `total` is 0, and `invalid-option` for a malformed
 * selection, a number that is not a whole number from 1, a reversed range or a slide past the end. `label` names the option in
 * the message (`"slides"`; the opf CLI passes `"--slides"`).
 */
export function parseSlideSelection(selection: SlideSelection, total: number, label = "slides"): number[] {
	if (!(total >= 1)) throw new OPFApiError("The presentation has no slides.", "no-slides");
	const listed = typeof selection === "number" ? [selection] : Array.isArray(selection) ? (selection as readonly unknown[]) : undefined;
	if (listed) {
		const bad = listed.find((value) => !isSlideNumber(value));
		if (bad !== undefined || listed.length === 0) throw new OPFApiError(`${label} needs slide numbers counted from 1 (got ${JSON.stringify(bad ?? listed)}).`, "invalid-option");
	} else if (typeof selection !== "string") throw new OPFApiError(`${label} needs a slide number, a list of numbers or text like "1,3-5".`, "invalid-option");
	const spec = listed ? listed.join(",") : (selection as string);
	const chosen = new Set<number>();
	for (const part of spec.split(",")) {
		const text = part.trim();
		const match = /^(\d*)(-?)(\d*)$/.exec(text);
		if (!text || !match || (!match[1] && !match[3])) throw new OPFApiError(`${label} needs numbers like 1,3-5 (got "${spec}").`, "invalid-option");
		const [, from, dash, to] = match as unknown as [string, string, string, string];
		const first = from ? Number(from) : 1;
		const last = dash ? (to ? Number(to) : total) : first;
		if (first < 1 || last < first) throw new OPFApiError(`${label} range "${text}" is not valid (slides count from 1).`, "invalid-option");
		if (last > total) throw new OPFApiError(`${label} ${text} is outside the presentation, which has ${total} slide${total === 1 ? "" : "s"}.`, "invalid-option");
		for (let n = first; n <= last; n++) chosen.add(n);
	}
	return [...chosen].sort((a, b) => a - b);
}
