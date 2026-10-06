import { visitContentPayloads } from './content-walk.js';
import { type Rec, rec } from './audit-design.js';

/**
 * Typed walks over a slide's content for the audit rules. Everything returns JSON Pointer paths so a finding
 * can be located in the source and patched without translation. Internal module.
 */

export const pointer = (...parts: (string | number)[]): string =>
	parts.length ? '/' + parts.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/') : '';

/** Composition paths (`slides.0.blocks.1.text`) as JSON Pointers. */
export const pointerOfDotted = (path: string): string =>
	'/' + path.split('.').map((part) => part.replaceAll('~', '~0').replaceAll('/', '~1')).join('/');

export interface Payload {
	/** JSON Pointer of the payload object (the slide itself for the root payload). */
	path: string;
	node: Rec;
	root: boolean;
}

const BODY_FIELDS = ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline'] as const;
export const bodyFields = BODY_FIELDS;

/** Root payload, then every block (recursively) and promoted-region payload of a slide. */
export function slidePayloads(slide: Rec, slidePath: string): Payload[] {
	const out: Payload[] = [{ path: slidePath, node: slide, root: true }];
	visitContentPayloads(slide, slidePath, (node, path) => out.push({ path, node, root: false }));
	return out;
}

export type TextRole =
	| 'title'
	| 'subtitle'
	| 'tag'
	| 'body'
	| 'list'
	| 'list-description'
	| 'table-header'
	| 'table'
	| 'quote'
	| 'quote-footer'
	| 'metric'
	| 'timeline';

/** One authored text value: a string or a TextRun array, at a path. */
export interface TextValue {
	path: string;
	value: string | readonly unknown[];
	role: TextRole;
	/** Pointer of the owning payload. */
	payload: string;
	field: string;
}

const isText = (value: unknown): value is string | readonly unknown[] => typeof value === 'string' || Array.isArray(value);

export function textValues(slide: Rec, slidePath: string): TextValue[] {
	const out: TextValue[] = [];
	for (const field of ['title', 'subtitle', 'tag'] as const)
		if (typeof slide[field] === 'string') out.push({ path: pointer(...splitPointer(slidePath), field), value: slide[field], role: field, payload: slidePath, field });
	for (const payload of slidePayloads(slide, slidePath)) {
		const node = payload.node,
			at = (...tail: (string | number)[]) => pointer(...splitPointer(payload.path), ...tail);
		const push = (path: string, value: unknown, role: TextRole, field: string) => {
			if (isText(value)) out.push({ path, value, role, payload: payload.path, field });
		};
		push(at('text'), node.text, 'body', 'text');
		for (const field of ['items', 'bullets'] as const)
			if (Array.isArray(node[field]))
				node[field].forEach((entry: unknown, index: number) => {
					if (isText(entry)) push(at(field, index), entry, 'list', field);
					else if (entry && typeof entry === 'object') {
						push(at(field, index, 'text'), (entry as Rec).text, 'list', field);
						push(at(field, index, 'description'), (entry as Rec).description, 'list-description', field);
					}
				});
		const table = rec(node.table);
		if (Array.isArray(table.columns))
			table.columns.forEach((cell: unknown, c: number) => {
				const styled = rec(cell);
				// RR-54: a DataColumn header ({ name, format }) shows its name.
				if (!Object.hasOwn(styled, 'value') && typeof styled.name === 'string') push(at('table', 'columns', c, 'name'), styled.name, 'table-header', 'table');
				else {
					const value = Object.hasOwn(styled, 'value') ? styled.value : cell;
					push(at('table', 'columns', c, ...(Object.hasOwn(styled, 'value') ? ['value'] : [])), value, 'table-header', 'table');
				}
			});
		if (Array.isArray(table.rows))
			table.rows.forEach((row: unknown, r: number) => {
				if (!Array.isArray(row)) return;
				row.forEach((cell: unknown, c: number) => {
					const styled = rec(cell);
					const value = Object.hasOwn(styled, 'value') ? styled.value : cell;
					push(at('table', 'rows', r, c, ...(Object.hasOwn(styled, 'value') ? ['value'] : [])), value, 'table', 'table');
				});
			});
		const quote = node.quote;
		if (typeof quote === 'string') push(at('quote'), quote, 'quote', 'quote');
		else if (quote && typeof quote === 'object') {
			push(at('quote', 'text'), quote.text, 'quote', 'quote');
			push(at('quote', 'attribution'), quote.attribution, 'quote-footer', 'quote');
			push(at('quote', 'role'), quote.role, 'quote-footer', 'quote');
			push(at('quote', 'source'), quote.source, 'quote-footer', 'quote');
		}
		const metric = node.metric;
		if (typeof metric === 'string') push(at('metric'), metric, 'metric', 'metric');
		else if (metric && typeof metric === 'object')
			for (const key of ['value', 'label', 'unit', 'delta']) {
				const value = metric[key];
				if (typeof value === 'string') push(at('metric', key), value, 'metric', 'metric');
			}
		const timeline = node.timeline,
			events = Array.isArray(timeline) ? timeline : Array.isArray(rec(timeline).events) ? rec(timeline).events : [];
		if (typeof rec(timeline).name === 'string') push(at('timeline', 'name'), rec(timeline).name, 'timeline', 'timeline');
		events.forEach((event: Rec, index: number) => {
			const base = Array.isArray(timeline) ? ['timeline', index] : ['timeline', 'events', index];
			push(at(...base, 'when'), event?.when, 'timeline', 'timeline');
			push(at(...base, 'what'), event?.what, 'timeline', 'timeline');
		});
	}
	return out;
}

export function splitPointer(path: string): string[] {
	return path === '' ? [] : path.slice(1).split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
}

export const plainText = (value: string | readonly unknown[]): string =>
	typeof value === 'string'
		? value
		: value.map((run) => (typeof run === 'string' ? run : typeof rec(run).text === 'string' ? rec(run).text : '')).join('');

export interface Run {
	path: string;
	text: string;
	style: Rec;
	/** Index within the owning runs array; -1 for a plain string value. */
	index: number;
	valuePath: string;
}

/** The runs of a text value; a plain string is one unstyled run. */
export function runsOf(tv: TextValue): Run[] {
	if (typeof tv.value === 'string') return [{ path: tv.path, text: tv.value, style: {}, index: -1, valuePath: tv.path }];
	return tv.value.map((run, index) => ({
		path: pointer(...splitPointer(tv.path), index),
		text: typeof run === 'string' ? run : typeof rec(run).text === 'string' ? rec(run).text : '',
		style: typeof run === 'string' ? {} : rec(run),
		index,
		valuePath: tv.path,
	}));
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'word' }) : undefined;
/** Words in a string: UAX #29 word segments where `Intl.Segmenter` exists (so CJK counts by word), else whitespace runs. */
export function countWords(text: string): number {
	if (segmenter) {
		let count = 0;
		for (const part of segmenter.segment(text)) if (part.isWordLike) count++;
		return count;
	}
	return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export interface AssetRef {
	path: string;
	value: unknown;
	kind: 'image' | 'video' | 'slide-image' | 'logo' | 'furniture' | 'speaker' | 'organization' | 'quote-photo';
}

/** Alt text of an asset value: its own `alt`, else the registry entry an `asset:<id>` source points to. */
export function altOf(value: unknown, assets: unknown): string | undefined {
	const own = typeof value === 'object' && value !== null ? (value as Rec).alt : undefined;
	if (typeof own === 'string') return own;
	let source = typeof value === 'string' ? value : rec(value).src;
	for (let hop = 0; typeof source === 'string' && source.startsWith('asset:') && hop < 8; hop++) {
		const entry = rec(assets)[source.slice(6)];
		if (typeof rec(entry).alt === 'string') return rec(entry).alt;
		source = typeof entry === 'string' ? entry : rec(entry).src;
	}
	return undefined;
}
export const sourceOfAsset = (value: unknown): string | undefined => {
	const source = typeof value === 'string' ? value : rec(value).src;
	return typeof source === 'string' ? source : undefined;
};

const LOGO_VARIANTS = ['default', 'light', 'dark', 'stacked', 'stackedLight', 'stackedDark', 'icon', 'iconLight', 'iconDark', 'wordmark', 'wordmarkLight', 'wordmarkDark'];

/** Every picture a viewer meets as content or branding that should carry (possibly empty, decorative) alt text. */
export function assetRefs(document: Rec, slide: Rec, slidePath: string, includeDeck: boolean): AssetRef[] {
	const out: AssetRef[] = [];
	for (const payload of slidePayloads(slide, slidePath)) {
		const at = (...tail: string[]) => pointer(...splitPointer(payload.path), ...tail);
		if (payload.node.image !== undefined) out.push({ path: at('image'), value: payload.node.image, kind: 'image' });
		if (payload.node.video !== undefined) out.push({ path: at('video'), value: payload.node.video, kind: 'video' });
		if (rec(payload.node.quote).photo !== undefined) out.push({ path: at('quote', 'photo'), value: rec(payload.node.quote).photo, kind: 'quote-photo' });
	}
	const designRefs = (design: Rec, base: string) => {
		const slideImage = design.slideImage;
		if (slideImage && (typeof slideImage === 'string' || typeof slideImage.src === 'string'))
			out.push({ path: `${base}/slideImage`, value: slideImage, kind: 'slide-image' });
		const logo = design.logo;
		if (typeof logo === 'string' || (logo && typeof logo.src === 'string')) out.push({ path: `${base}/logo`, value: logo, kind: 'logo' });
		else if (logo && typeof logo === 'object')
			for (const variant of LOGO_VARIANTS)
				if (logo[variant] !== undefined) out.push({ path: `${base}/logo/${variant}`, value: logo[variant], kind: 'logo' });
		for (const kind of ['header', 'footer'])
			for (const zone of ['left', 'center', 'right']) {
				const item = rec(rec(design[kind])[zone]);
				if (item.image !== undefined) out.push({ path: `${base}/${kind}/${zone}/image`, value: item.image, kind: 'furniture' });
			}
	};
	designRefs(rec(slide.design), `${slidePath}/design`);
	if (includeDeck) {
		designRefs(rec(document.design), '/design');
		const organizations = Array.isArray(document.organization) ? document.organization : document.organization ? [document.organization] : [];
		organizations.forEach((organization: Rec, index: number) => {
			if (organization?.logo !== undefined)
				out.push({
					path: Array.isArray(document.organization) ? `/organization/${index}/logo` : '/organization/logo',
					value: organization.logo,
					kind: 'organization',
				});
		});
		const speakers = Array.isArray(document.speaker) ? document.speaker : document.speaker ? [document.speaker] : [];
		speakers.forEach((speaker: Rec, index: number) => {
			if (speaker?.photo !== undefined)
				out.push({ path: Array.isArray(document.speaker) ? `/speaker/${index}/photo` : '/speaker/photo', value: speaker.photo, kind: 'speaker' });
		});
	}
	return out;
}
