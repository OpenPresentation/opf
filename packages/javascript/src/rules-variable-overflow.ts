import { type Rec, rec } from './rule-design.js';
import type { RuleSlide, ValidationContext, ValidationRule } from './rule-context.js';
import { pointerOfDotted } from './rule-content.js';
import { variableOverflowRule } from './validation-rule-info.js';
import { buildSlides } from './rule-slides.js';
import { coerceVariableValue, instantiateForValidation, isTemplate, listVariables, resolveVariables, variableDeclarations, type VariableDeclaration, type VariableUse } from './variables.js';

/**
 * `opf/variable-overflow` (FR-09): a variable's value is longer than its declaration allows. `maxLength` (characters as a reader sees
 * them) and `maxItems` are read on the value; `maxLines` is read from composition at each place the variable is drawn, because the line
 * count depends on the width of the box there. A warning: the deck still draws. Internal module.
 */

const plain = (value: unknown): string =>
	typeof value === 'string' ? value : Array.isArray(value) ? value.map((run) => (typeof run === 'string' ? run : typeof rec(run).text === 'string' ? (rec(run).text as string) : '')).join('') : '';

/** The value the validation view draws for a variable: a value given to the check, the declared value, then the example; undefined when none (a type sample is not measured). */
function drawnValue(declaration: VariableDeclaration, values: Record<string, unknown>): unknown {
	if (Object.hasOwn(values, declaration.id) && values[declaration.id] !== null && values[declaration.id] !== undefined) {
		const coerced = coerceVariableValue(declaration.kind, values[declaration.id]);
		if (coerced.ok) return coerced.value;
	}
	return declaration.value ?? declaration.example;
}

interface EntryLayout {
	textPath?: string;
	descriptionPath?: string;
	text: { lines: string[] };
	description?: { lines: string[] };
}

/** The lines the composed slide draws at a place: the item whose path it is (or contains it), or the list entry that is drawn there. */
function composedLines(slide: RuleSlide, place: string): string[] | undefined {
	const composition = slide.composition;
	if (!composition) return undefined;
	let best: string[][] = [];
	let bestDepth = -1;
	const offer = (path: string, lines: readonly string[] | undefined) => {
		if (!lines || lines.length === 0) return;
		const at = pointerOfDotted(path);
		if (at !== place && !place.startsWith(`${at}/`)) return;
		if (at.length > bestDepth) {
			bestDepth = at.length;
			best = [];
		}
		if (at.length === bestDepth) best.push([...lines]);
	};
	for (const item of composition.items) {
		const text = item.text as unknown as { lines?: string[]; listEntries?: EntryLayout[] } | undefined;
		if (!text) continue;
		if (text.listEntries) {
			for (const entry of text.listEntries) {
				if (entry.textPath) offer(entry.textPath, entry.text.lines);
				if (entry.descriptionPath && entry.description) offer(entry.descriptionPath, entry.description.lines);
			}
			continue;
		}
		offer(item.path, text.lines);
	}
	return best.length ? best.flat() : undefined;
}

/**
 * How many of the block's drawn lines carry the variable's own characters: the lines that intersect the value's text in the block
 * (whitespace and case aside). A value that cannot be found in the drawn text (it was reshaped by the layout) is not measured.
 */
function linesOfValue(lines: readonly string[], value: string, occurrence: number): number | undefined {
	const squash = (text: string) => text.replace(/\s+/gu, '').toLowerCase();
	const needle = squash(value);
	if (!needle) return undefined;
	const spans: { start: number; end: number }[] = [];
	let at = 0;
	for (const line of lines) {
		const length = squash(line).length;
		spans.push({ start: at, end: at + length });
		at += length;
	}
	const hay = lines.map(squash).join('');
	let start = -1;
	for (let found = 0, from = 0; found <= occurrence; found++) {
		start = hay.indexOf(needle, from);
		if (start < 0) return undefined;
		from = start + needle.length;
	}
	const end = start + needle.length;
	return spans.filter((span) => span.end > span.start && span.start < end && span.end > start).length;
}

const slideOf = (path: string): number | undefined => {
	const match = /^\/slides\/(\d+)(?:\/|$)/.exec(path);
	return match ? Number(match[1]) : undefined;
};

/** The numbers of a `maxLength` or `maxItems` message, for `measured`. */
function measuredOf(message: string): Record<string, number> | undefined {
	const found = /has (\d+) (characters|items); its (maxLength|maxItems) is (\d+)/.exec(message);
	return found ? { [found[2] as string]: Number(found[1]), [found[3] as string]: Number(found[4]) } : undefined;
}

function overflow(context: ValidationContext): void {
	const document = context.document;
	const declared = variableDeclarations(document).filter((entry) => entry.maxLength !== undefined || entry.maxLines !== undefined || entry.maxItems !== undefined);
	if (!declared.length) return;
	const values = (context.options.values ?? {}) as Record<string, unknown>;
	const template = context.options.template ?? isTemplate(document);

	// maxLength and maxItems: on the value, once, at the declaration.
	for (const entry of resolveVariables(document, values, { template, partial: true }).diagnostics) {
		if (entry.code !== 'variable-overflow') continue;
		const measured = measuredOf(entry.message);
		context.report(variableOverflowRule, {
			path: entry.path,
			message: entry.message,
			help: 'Shorten the value, or raise the limit in the declaration if the layout has the room.',
			...(measured ? { measured: measured as never } : {}),
		});
	}

	// maxLines: where the variable is drawn, on the deck as it would be drawn with its values.
	const limited = declared.filter((entry) => entry.kind === 'text' && entry.maxLines !== undefined);
	if (!limited.length) return;
	const uses = new Map<string, VariableUse[]>();
	for (const info of listVariables(document, values)) if (info.uses.length && info.maxLines !== undefined && info.kind === 'text') uses.set(info.id, info.uses);
	if (!uses.size) return;
	const view = instantiateForValidation(document as Record<string, unknown>, values, template).presentation as Rec;
	const drawn = buildSlides(view, context.options);
	const seen = new Map<string, number>();
	for (const declaration of limited) {
		const value = drawnValue(declaration, values);
		if (value === undefined || declaration.maxLines === undefined) continue;
		const text = plain(value);
		for (const use of uses.get(declaration.id) ?? []) {
			const index = slideOf(use.path);
			if (index === undefined) continue;
			const slide = drawn[index];
			const source = context.slides[index];
			if (!slide || !source) continue;
			const key = `${declaration.id}\u0000${use.path}`;
			const occurrence = seen.get(key) ?? 0;
			seen.set(key, occurrence + 1);
			const lines = composedLines(slide, use.path);
			if (!lines) continue;
			const taken = linesOfValue(lines, text, occurrence);
			if (taken === undefined || taken <= declaration.maxLines) continue;
			context.report(variableOverflowRule, {
				path: use.path,
				slide: source,
				message: `'${declaration.id}' takes ${taken} lines here; its maxLines is ${declaration.maxLines}.`,
				help: 'Shorten the value, widen the place it is drawn in, or raise maxLines in the declaration if the slide has the room.',
				measured: { lines: taken, maxLines: declaration.maxLines } as never,
			});
		}
	}
}

const variableOverflow: ValidationRule = { info: variableOverflowRule, run: overflow };

export const variableOverflowRules: ValidationRule[] = [variableOverflow];
