import {
	CODE_NOMINAL_SIZE,
	type ComposedItem,
	LIST_NOMINAL_SIZE,
	type LayoutBox,
	PROSE_NOMINAL_SIZE,
	QUOTE_NOMINAL_SIZE,
	type SlideComposition,
	TABLE_NOMINAL_SIZE,
	layoutTable,
} from './composition.js';
import { quoteLanguage, quoteMarksFor } from './quote-marks.js';
import type { RuleSlide, ValidationRule } from './rule-context.js';
import { plainText, pointerOfDotted, runsOf } from './rule-content.js';
import { type Rec, rec } from './rule-design.js';
import {
	CENTERED_BODY_CHARACTERS,
	CENTERED_BODY_LINES,
	CENTERED_NOTE_CHARACTERS,
	MONOTONY_RUN,
	SHRUNK_RATIO,
	TIGHT_GAP_INCHES,
	TIGHT_MARGIN_INCHES,
	centeredBodyRule,
	layoutMonotonyRule,
	straightQuotesRule,
	textShrunkRule,
	tightSpacingRule,
} from './validation-rule-info.js';

/**
 * LH-19 and LH-31: info findings read from the composed geometry (fitted sizes, alignment, boxes) and from the slide sequence. None of them
 * changes what is drawn; each states a number the layout computed and the threshold it was compared with. Internal module.
 */

const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
/** Reference pixels per inch: the 13.33 x 7.5 in reference slide is 1280 x 720. */
const PX_PER_INCH = 96;
/** Fitted sizes and boxes are canvas pixels; dividing by this compares them with the 720 px reference slide. */
const canvasScale = (composition: SlideComposition) => Math.min(composition.width, composition.height) / 720;
const HEADINGS = new Set(['title', 'subtitle', 'tag']);
/** The bare id of a layout reference (`default:list` and `list` are the same record of the default catalog). */
const layoutId = (slide: Rec): string | undefined => (typeof slide.layout === 'string' && slide.layout ? slide.layout.slice(slide.layout.indexOf(':') + 1) : undefined);
/** Layout records whose slides open, divide or close a deck: never body slides, and they draw their headings centred on purpose. */
const FRAMING_LAYOUTS = new Set(['cover', 'section', 'closing']);

/** True when a value (a string, runs, list entries, table cells) sets an explicit run `fontSize`, which the fit honours as the author's choice. */
function setsRunSize(value: unknown, depth = 0): boolean {
	if (depth > 6 || value === null || typeof value !== 'object') return false;
	if (Array.isArray(value)) return value.some((entry) => setsRunSize(entry, depth + 1));
	const object = value as Rec;
	if (typeof object.fontSize === 'number') return true;
	return ['text', 'description', 'rows', 'columns', 'value'].some((key) => setsRunSize(object[key], depth + 1));
}

// ------------------------------------------------------------------ text-shrunk

/** The type role's starting size in reference pixels (WI-4): what composition asks for before it fits the text down. */
const ROLE_SIZE: Readonly<Record<string, number>> = { text: PROSE_NOMINAL_SIZE, items: LIST_NOMINAL_SIZE, bullets: LIST_NOMINAL_SIZE, table: TABLE_NOMINAL_SIZE, quote: QUOTE_NOMINAL_SIZE, code: CODE_NOMINAL_SIZE };

/** The fitted body size of an item, or undefined when it has none, overflows (opf/text-overflow reports that) or the layout cannot be read. */
function fittedSize(item: ComposedItem, slide: RuleSlide, document: Rec): number | undefined {
	const body = (parts: readonly { role: string; fit?: { fontSize: number; overflow: boolean } }[] | undefined) => {
		const fit = parts?.find((part) => part.role === 'body')?.fit;
		return fit && !fit.overflow ? fit.fontSize : undefined;
	};
	if (item.field === 'quote') return body(item.quoteLayout?.parts);
	if (item.field === 'code') return body(item.codeLayout?.parts);
	if (item.field === 'table') {
		try {
			const table = layoutTable(item.value, item.box, { scale: canvasScale(slide.composition!), minFontSize: item.composition.minFontSize, fontFamily: slide.design.fonts.body, textMeasurement: slide.measurement, path: item.path, presentation: document });
			if (table.overflow) return undefined;
			const sizes = table.rows.flatMap((row) => row.cells.filter((cell) => !cell.header).map((cell) => cell.fit.fontSize));
			return sizes.length ? Math.min(...sizes) : undefined;
		} catch {
			return undefined;
		}
	}
	return item.text && !item.text.overflow ? item.text.fontSize : undefined;
}

const textShrunk: ValidationRule = {
	info: textShrunkRule,
	run(context) {
		for (const slide of context.slides) {
			const composition = slide.composition;
			if (!composition) continue;
			const scale = canvasScale(composition);
			let worst: { item: ComposedItem; size: number; role: number; ratio: number } | undefined;
			let count = 0;
			for (const item of composition.items) {
				const role = ROLE_SIZE[item.field];
				if (role === undefined || HEADINGS.has(item.field) || setsRunSize(item.value)) continue;
				const size = fittedSize(item, slide, context.document);
				if (size === undefined) continue;
				const ratio = size / (role * scale);
				if (ratio >= SHRUNK_RATIO - 1e-6) continue;
				count++;
				if (!worst || ratio < worst.ratio) worst = { item, size, role, ratio };
			}
			if (!worst) continue;
			const sizePx = round(worst.size / scale);
			const others = count > 1 ? ` ${count - 1} more block${count === 2 ? '' : 's'} on this slide ${count === 2 ? 'is' : 'are'} also below ${SHRUNK_RATIO * 100}% of the role size.` : '';
			context.report(textShrunkRule, {
				path: pointerOfDotted(worst.item.path),
				slide,
				message: `The ${worst.item.field === 'items' || worst.item.field === 'bullets' ? 'list' : worst.item.field} is fitted at ${sizePx} px, ${Math.round(worst.ratio * 100)}% of its ${worst.role} px starting size (reference slide); the slide is likely too dense.${others}`,
				help: 'Split the slide (opf paginate), move detail to the speaker notes, or shorten the text so it can be drawn nearer its role size.',
				measured: { sizePx, rolePx: worst.role, ratio: round(worst.ratio, 2), minimumRatio: SHRUNK_RATIO, blocks: count },
			});
		}
	},
};

// ------------------------------------------------------------------ centered-body

/** Text of a text or list payload, for its length. */
function itemText(item: ComposedItem): string {
	const value = item.value;
	if (typeof value === 'string' || (Array.isArray(value) && item.field === 'text')) return plainText(value as string | readonly unknown[]);
	if (!Array.isArray(value)) return '';
	return value
		.map((entry) => {
			if (typeof entry === 'string' || Array.isArray(entry)) return plainText(entry as string | readonly unknown[]);
			const text = rec(entry).text, description = rec(entry).description;
			return [text, description].map((part) => (typeof part === 'string' || Array.isArray(part) ? plainText(part as string | readonly unknown[]) : '')).join(' ');
		})
		.join('\n');
}

const centeredBody: ValidationRule = {
	info: centeredBodyRule,
	run(context) {
		for (const slide of context.slides) {
			const composition = slide.composition;
			if (!composition) continue;
			const body = composition.items.filter((item) => !HEADINGS.has(item.field));
			const framing = FRAMING_LAYOUTS.has(layoutId(slide.slide) ?? '');
			// A lone text block (alone on the slide, or alone in its layout region, such as the note of the metrics record) is a statement
			// or a note: the statement, metrics, cover, section and closing records centre it on purpose, so it may run one line longer.
			const lone = (item: ComposedItem) => body.length === 1 || (item.region !== undefined && body.filter((other) => other.region === item.region).length === 1);
			let worst: { item: ComposedItem; lines: number; characters: number } | undefined;
			let count = 0;
			for (const item of body) {
				if (item.alignment !== 'center' || !['text', 'items', 'bullets'].includes(item.field) || !item.text) continue;
				const lines = item.text.lines.length, characters = itemText(item).trim().length;
				// A short note wraps in a narrow cell without being running text.
				if (characters <= CENTERED_NOTE_CHARACTERS) continue;
				if (item.field === 'text' && lone(item) ? framing || lines <= CENTERED_BODY_LINES + 1 : lines <= CENTERED_BODY_LINES && characters <= CENTERED_BODY_CHARACTERS) continue;
				count++;
				if (!worst || lines > worst.lines) worst = { item, lines, characters };
			}
			if (!worst) continue;
			const { item, lines, characters } = worst;
			const others = count > 1 ? ` ${count - 1} more long centred block${count === 2 ? ' is' : 's are'} on this slide.` : '';
			context.report(centeredBodyRule, {
				path: pointerOfDotted(item.path),
				slide,
				message: `A centred ${item.field === 'text' ? 'paragraph' : 'list'} of ${lines} line${lines === 1 ? '' : 's'} (${characters} characters); every line starts at a different place, which is harder to read.${others}`,
				help: 'Align body text to the start (contentAlignment "left" on the slide or block design), or shorten it to a statement of one or two lines.',
				measured: { lines, characters, maximumLines: CENTERED_BODY_LINES, maximumCharacters: CENTERED_BODY_CHARACTERS, blocks: count },
			});
		}
	},
};

// ------------------------------------------------------------------ tight-spacing

interface Spaced {
	path: string;
	box: LayoutBox;
	exempt: boolean;
}
/** The parent of a block path: `slides.0.blocks.1.blocks.2` -> `slides.0.blocks.1`. A payload field (`slides.0.blocks.1.text`) belongs to its block. */
const blockPath = (item: ComposedItem): string => {
	const parts = item.path.split('.');
	return parts.length > 2 && /^\d+$/.test(parts.at(-2) ?? '') ? parts.slice(0, -1).join('.') : item.path;
};
const parentPath = (path: string): string => path.split('.').slice(0, -2).join('.');

/** Distance between two boxes that face each other across one axis; undefined when they overlap or only meet corner to corner. */
function facingGap(a: LayoutBox, b: LayoutBox): number | undefined {
	const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
	const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
	if (across > 0 && down > 0) return undefined;
	if (across > 0) return Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height);
	if (down > 0) return Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width);
	return undefined;
}

const tightSpacing: ValidationRule = {
	info: tightSpacingRule,
	run(context) {
		for (const slide of context.slides) {
			const composition = slide.composition;
			if (!composition) continue;
			const scale = canvasScale(composition);
			const gapLimit = TIGHT_GAP_INCHES * PX_PER_INCH * scale, marginLimit = TIGHT_MARGIN_INCHES * PX_PER_INCH * scale;
			const bled = new Set((composition.regions ?? []).filter((region) => region.bleed).map((region) => region.name));
			// The visible extent: a card's frame, a picture's frame, else the cell. Headings sit in the title area, furniture in its bands.
			const spaced: Spaced[] = composition.items
				.filter((item) => !HEADINGS.has(item.field))
				.map((item) => ({ path: blockPath(item), box: item.frameBox ?? item.image?.box ?? item.box, exempt: (item.region !== undefined && bled.has(item.region)) || item.image?.placement !== undefined }));
			for (const group of composition.groups) spaced.push({ path: group.path, box: group.box, exempt: false });
			let margin: { entry: Spaced; distance: number } | undefined;
			for (const entry of spaced) {
				if (entry.exempt) continue;
				const { x, y, width, height } = entry.box;
				const distance = Math.min(x, y, composition.width - x - width, composition.height - y - height);
				if (distance < marginLimit - 0.01 && (!margin || distance < margin.distance)) margin = { entry, distance };
			}
			let gap: { a: Spaced; b: Spaced; distance: number } | undefined;
			const siblings = new Map<string, Spaced[]>();
			for (const entry of spaced) siblings.set(parentPath(entry.path), [...(siblings.get(parentPath(entry.path)) ?? []), entry]);
			// Only a gap the author set is reported: the slide's (or its layout record's) composition.gap, or a group's own. Without one the
			// engine's default applies, 1/30 of the container's shorter side, which in a short nested group is a few pixels (a default of the
			// engine, not of the deck).
			const groupGap = new Map(composition.groups.map((group) => [group.path, group.composition.gap]));
			const authoredGap = (parent: string) => (groupGap.has(parent) ? groupGap.get(parent) : composition.composition.gap) !== undefined;
			for (const [parent, list] of siblings) {
				if (!authoredGap(parent)) continue;
				for (let i = 0; i < list.length; i++)
					for (let j = i + 1; j < list.length; j++) {
						if (list[i]!.exempt || list[j]!.exempt) continue;
						const distance = facingGap(list[i]!.box, list[j]!.box);
						if (distance !== undefined && distance < gapLimit - 0.01 && (!gap || distance < gap.distance)) gap = { a: list[i]!, b: list[j]!, distance };
					}
			}
			const inches = (px: number) => round(px / scale / PX_PER_INCH, 2);
			if (gap)
				context.report(tightSpacingRule, {
					path: pointerOfDotted(gap.b.path),
					slide,
					message: `Two blocks are ${inches(gap.distance)} in apart (${pointerOfDotted(gap.a.path)} and ${pointerOfDotted(gap.b.path)}); at least ${TIGHT_GAP_INCHES} in keeps them apart as separate ideas.`,
					help: 'Raise composition.gap, use fewer blocks or nested groups on the slide, or split it (opf paginate).',
					measured: { gapInches: inches(gap.distance), minimumGapInches: TIGHT_GAP_INCHES },
				});
			if (margin)
				context.report(tightSpacingRule, {
					path: pointerOfDotted(margin.entry.path),
					slide,
					message: `A block is ${inches(margin.distance)} in from the slide edge; at least ${TIGHT_MARGIN_INCHES} in keeps content clear of the edge, where projectors and screens crop.`,
					help: 'Raise composition.padding or the design contentBox inset; for a picture meant to reach the edge, place it on the edge (placement) or use a bleed region.',
					measured: { marginInches: inches(margin.distance), minimumMarginInches: TIGHT_MARGIN_INCHES },
				});
		}
	},
};

// ------------------------------------------------------------------ layout-monotony

/** A slide with body content: anything besides the title, subtitle and tag. */
const hasBody = (slide: RuleSlide): boolean => slide.payloads.some((payload) => ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'blocks'].some((field) => {
	const value = payload.node[field];
	return value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0) && !(typeof value === 'string' && value.trim() === '');
}));

const layoutMonotony: ValidationRule = {
	info: layoutMonotonyRule,
	run(context) {
		let run: RuleSlide[] = [];
		const flush = () => {
			if (run.length >= MONOTONY_RUN) {
				const first = run[0]!, last = run.at(-1)!, layout = String(first.slide.layout);
				context.report(layoutMonotonyRule, {
					path: `${first.path}/layout`,
					slide: first,
					message: `Slides ${first.index + 1} to ${last.index + 1} (${run.length} in a row) all use the layout ${JSON.stringify(layout)}.`,
					help: 'Vary the structure the content asks for (a comparison, a chart, a statement, a picture), or merge or split slides so the sequence does not repeat one arrangement.',
					measured: { layout, slides: run.length, first: first.index + 1, last: last.index + 1, minimumRun: MONOTONY_RUN },
				});
			}
			run = [];
		};
		for (const slide of context.slides) {
			// A hidden slide is not presented: it neither counts nor breaks a run.
			if (slide.slide.hidden === true) continue;
			const id = layoutId(slide.slide);
			if (!id || FRAMING_LAYOUTS.has(id) || !hasBody(slide)) {
				flush();
				continue;
			}
			if (run.length && layoutId(run[0]!.slide) !== id) flush();
			run.push(slide);
		}
		flush();
	},
};

// ------------------------------------------------------------------ straight-quotes

/** The roles of prose a reader sees; table cells, metrics and timeline labels hold data, identifiers and measurements. */
const PROSE_ROLES = new Set(['title', 'subtitle', 'tag', 'body', 'list', 'list-description', 'quote', 'quote-footer']);
const LETTER = /[\p{L}\p{N}]/u;
/** What may stand before an opening quotation mark: a space, an opening bracket or a dash. */
const OPENING = /[\s([{—–-]/u;

/**
 * The straight marks in `text` that are used as quotation marks. Kept narrow so the finding has few false positives: a `"` after a
 * digit is an inch mark (12"); a `'` between letters or digits is an apostrophe (don't, O'Brien, rock'n'roll), after a digit a foot mark
 * (5'), and at the start of a word before a digit an elision ('90s). A lone `'` at a word's end is a plural possessive (the students');
 * single quotes count only as an opening mark at the start of a word with a closing mark at the end of a later word.
 */
function straightQuoteMarks(text: string): { double: number; single: number } {
	let double = 0, single = 0, open = false;
	for (let i = 0; i < text.length; i++) {
		const char = text[i], before = text[i - 1] ?? '', after = text[i + 1] ?? '';
		if (char === '"') {
			if (!/\d/.test(before)) double++;
		} else if (char === "'") {
			const wordAfter = LETTER.test(after), opens = before === '' || OPENING.test(before);
			if ((LETTER.test(before) && wordAfter) || /\d/.test(before)) continue;
			if (opens && wordAfter && !/\d/.test(after)) open = true;
			else if (!opens && !wordAfter && open) {
				single += 2;
				open = false;
			}
		}
	}
	return { double, single };
}

/** `text` with its straight double quotes turned into the language's marks: an opening mark at the start of a word, a closing one elsewhere. */
function curlDoubleQuotes(text: string, marks: { open: string; close: string }): string {
	return text.replace(/(^|.)"/gsu, (whole, before: string) => (/\d/.test(before) ? whole : `${before}${before === '' || OPENING.test(before) ? marks.open : marks.close}`));
}

const straightQuotes: ValidationRule = {
	info: straightQuotesRule,
	run(context) {
		for (const slide of context.slides) {
			const marks = quoteMarksFor(quoteLanguage(context.document, slide.index));
			// A language with no typographic pair of its own draws ASCII quotes; there is nothing better to suggest.
			if (marks.open === '"') continue;
			for (const tv of slide.texts) {
				if (!PROSE_ROLES.has(tv.role)) continue;
				let double = 0, single = 0;
				const fixes: { op: 'replace'; path: string; value: string }[] = [];
				for (const run of runsOf(tv)) {
					if (run.style.code === true) continue;
					const found = straightQuoteMarks(run.text);
					double += found.double;
					single += found.single;
					if (found.double) fixes.push({ op: 'replace', path: run.index === -1 ? run.path : `${run.path}${typeof tv.value !== 'string' && typeof tv.value[run.index] === 'string' ? '' : '/text'}`, value: curlDoubleQuotes(run.text, marks) });
				}
				if (!double && !single) continue;
				const kinds = [double ? `${double} straight double quote${double === 1 ? '' : 's'} (")` : '', single ? `${single} straight single quotes (')` : ''].filter(Boolean).join(' and ');
				const text = plainText(tv.value);
				context.report(straightQuotesRule, {
					path: tv.path,
					slide,
					message: `Text has ${kinds}: ${JSON.stringify(text.length > 60 ? `${text.slice(0, 57)}...` : text)}.`,
					help: `Use the typographic quotation marks of the deck's language (${marks.open}...${marks.close}).${tv.role === 'quote' ? ' A quote payload adds its own marks around the whole quote.' : ''}`,
					measured: { double, single, open: marks.open, close: marks.close },
					...(!single && fixes.length ? { fixes: [{ id: 'use-typographic-quotes', title: `Use ${marks.open}${marks.close}`, kind: 'patch' as const, safe: false, patch: fixes }] } : {}),
				});
			}
		}
	},
};

/** In report order: layout (text-shrunk, centered-body, tight-spacing, layout-monotony), then content (straight-quotes). */
export const layoutFindingRules: ValidationRule[] = [textShrunk, centeredBody, tightSpacing, layoutMonotony, straightQuotes];
