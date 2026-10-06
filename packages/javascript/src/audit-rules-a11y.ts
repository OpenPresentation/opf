import { chartPaletteForFill } from './color.js';
import { type ComposedItem, type LayoutBox, type TextMeasurement, textWidthMeasurer } from './composition.js';
import { readingRows, visualReadingOrder } from './reading-order.js';
import { tableGrid } from './table.js';
import { resolveChartData } from './chart-data.js';
import type { AuditDiagnostic, AuditFix } from './audit-types.js';
import { type AuditContext, type AuditRule, type SlideContext, rule } from './audit-context.js';
import {
	altOf,
	assetRefs,
	plainText,
	pointer,
	pointerOfDotted,
	runsOf,
	slidePayloads,
	sourceOfAsset,
	splitPointer,
	textValues,
} from './audit-content.js';
import {
	type BackdropSample,
	type Rec,
	backdropColors,
	colorDifference,
	readableColor,
	rec,
	resolveTextColor,
	simulateVision,
	visionModels,
	worstContrast,
} from './audit-design.js';

// ----------------------------------------------------------------- contrast

const PX_TO_PT = 0.75;

interface TextSample {
	path: string;
	/** Opaque text colour. */
	color: string;
	/** Rendered size in reference pixels (96 per inch). */
	sizePx: number;
	bold: boolean;
	backdrop: BackdropSample;
	source: 'default' | 'override';
	/** The JSON Pointer of the colour value an override lives in, when the sample is an override. */
	colorPath?: string;
	label: string;
}

const isLarge = (sizePx: number, bold: boolean) => {
	const pt = sizePx * PX_TO_PT;
	return pt >= 18 || (bold && pt >= 14);
};

function slideBackdrop(context: SlideContext, box?: { x: number; y: number; width: number; height: number }): BackdropSample {
	const { design, composition } = context;
	const image = composition?.slideImage;
	if (image?.position === 'background') {
		// A background picture is unknown pixels; a full-frame overlay bounds the colour underneath. An edge-banded overlay covers only part of the frame.
		const overlay = image.overlay && image.overlay.box.width >= composition!.width * 0.99 && image.overlay.box.height >= composition!.height * 0.99
			? { color: resolveTextColor(image.overlay.color, design, '#000000') ?? '#000000', opacity: image.overlay.opacity }
			: undefined;
		return backdropColors({ kind: 'image', opacity: image.opacity ?? 1, base: design.backdrop.kind === 'solid' ? design.backdrop.color : '#FFFFFF' }, box, design.dimensions, { overlay });
	}
	return backdropColors(design.backdrop, box, design.dimensions);
}

/** The part of a text item's box its lines actually cover (alignment respected), so a gradient is sampled under the ink, not the empty box. */
function inkBox(item: ComposedItem, measurement: TextMeasurement | undefined): LayoutBox {
	const fit = item.text;
	if (!fit || !Array.isArray(fit.lines) || !fit.lines.length || !item.textStyle || item.quoteLayout || item.metricLayout || item.timelineLayout) return item.box;
	try {
		const measure = textWidthMeasurer(item.textStyle, measurement);
		const width = Math.min(item.box.width, Math.max(...fit.lines.map((line) => measure(line, fit.fontSize))));
		const height = Math.min(item.box.height, fit.lines.length * fit.lineHeight);
		const x = item.alignment === 'center' ? item.box.x + (item.box.width - width) / 2 : item.alignment === 'right' ? item.box.x + item.box.width - width : item.box.x;
		return { x, y: item.box.y, width, height };
	} catch {
		return item.box;
	}
}

function collectSamples(context: SlideContext): TextSample[] {
	const measurement = context.measurement;
	const { design, composition } = context;
	if (!composition) return [];
	const samples: TextSample[] = [];
	const surface: BackdropSample = { colors: [design.colors.surface], unknown: false };
	const scale = Math.min(design.dimensions.width, design.dimensions.height) / 720;
	for (const item of composition.items) {
		if (['chart', 'image', 'video', 'code'].includes(item.field) || item.type === 'chart' || item.type === 'image' || item.type === 'video' || item.type === 'code') continue;
		const backdrop = item.frameBox ? surface : slideBackdrop(context, inkBox(item, measurement));
		const itemPath = pointerOfDotted(item.path);
		const heading = item.field === 'title' || item.field === 'subtitle' || item.field === 'tag';
		const baseSize = (item.text?.fontSize ?? 25 * scale) / scale;
		const bold = item.field === 'title';
		const label = item.field === 'title' ? 'Title' : item.field === 'subtitle' ? 'Subtitle' : item.field === 'tag' ? 'Tag' : 'Text';
		if (item.field === 'table') {
			const grid = tableGrid(item.value, item.path);
			for (const row of grid.rows)
				for (const cell of row) {
					const fillRef = resolveTextColor(cell.style.fill, design, '');
					const fill = fillRef || (cell.header ? design.colors.primary : design.colors.surface);
					const cellBackdrop: BackdropSample = { colors: [fill], unknown: false };
					const cellPath = pointerOfDotted(cell.valuePath);
					const stylePath = pointerOfDotted(cell.path) + '/style/color';
					if (cell.style.color != null) {
						const color = resolveTextColor(cell.style.color, design, design.colors.text);
						if (color) samples.push({ path: stylePath, color, sizePx: 15, bold: cell.header, backdrop: cellBackdrop, source: 'override', colorPath: stylePath, label: 'Table cell text' });
					}
					if (Array.isArray(cell.value))
						cell.value.forEach((run: unknown, index: number) => {
							const colorRef = rec(run).color;
							if (typeof colorRef !== 'string') return;
							const color = resolveTextColor(colorRef, design, design.colors.text);
							if (color) samples.push({ path: `${cellPath}/${index}/color`, color, sizePx: rec(run).fontSize ? Number(rec(run).fontSize) / PX_TO_PT : 15, bold: Boolean(rec(run).bold) || cell.header, backdrop: cellBackdrop, source: 'override', colorPath: `${cellPath}/${index}/color`, label: 'Table cell text' });
						});
				}
			continue;
		}
		const parts: { path: string; sizePx: number; color: string; label: string }[] = [];
		const layoutOf = item.quoteLayout ?? item.metricLayout ?? item.timelineLayout;
		if (layoutOf)
			for (const part of layoutOf.parts as readonly Rec[]) {
				if (!part.fit || part.visible === false) continue;
				const role = String(part.role ?? '');
				parts.push({
					path: typeof part.path === 'string' && part.path.startsWith('slides.') ? pointerOfDotted(part.path) : itemPath,
					sizePx: part.fit.fontSize / scale,
					color: role === 'footer' ? design.colors.mutedText : role === 'value' && item.metricLayout ? design.colors.primary : design.colors.text,
					label: item.field === 'quote' ? (role === 'footer' ? 'Quote attribution' : 'Quote') : item.field === 'metric' ? (role === 'value' ? 'Metric value' : 'Metric label') : 'Timeline text',
				});
			}
		else parts.push({ path: itemPath, sizePx: baseSize, color: design.colors.text, label: heading || item.field === 'text' ? label : item.field === 'items' || item.field === 'bullets' ? 'List text' : label });
		for (const part of parts) samples.push({ path: part.path, color: part.color, sizePx: part.sizePx, bold, backdrop, source: 'default', label: part.label });
		// Explicit run colours in rich text, list entries and similar.
		const owners = textValues({ [item.field]: item.value }, '');
		for (const owner of owners) {
			if (typeof owner.value === 'string') continue;
			// Re-root: owners are paths inside a synthetic slide; rebuild against the item's pointer.
			const relative = splitPointer(owner.path).slice(1);
			const base = pointer(...splitPointer(itemPath), ...relative);
			for (const run of runsOf({ ...owner, path: base })) {
				if (typeof run.style.color !== 'string') continue;
				const color = resolveTextColor(run.style.color, design, design.colors.text);
				if (!color) continue;
				const size = typeof run.style.fontSize === 'number' ? run.style.fontSize / PX_TO_PT : baseSize;
				samples.push({ path: `${run.path}/color`, color, sizePx: size, bold: Boolean(run.style.bold) || bold, backdrop, source: 'override', colorPath: `${run.path}/color`, label: 'Coloured text' });
			}
		}
	}
	// Header and footer text is drawn in the muted text colour at the slide edge.
	for (const part of composition.furniture?.parts ?? [])
		if (part.type === 'text')
			samples.push({ path: pointerOfDotted(part.sourcePath ?? part.path), color: design.colors.mutedText, sizePx: ((part as { fit?: { fontSize: number } }).fit?.fontSize ?? 13 * scale) / scale, bold: false, backdrop: slideBackdrop(context, part.box), source: 'default', label: part.kind === 'header' ? 'Header text' : 'Footer text' });
	return samples;
}

const contrastRule = rule(
	'text-contrast',
	'accessibility',
	'warning',
	'Text colour has too little contrast against the background it sits on.',
	'Low-contrast text is hard or impossible to read for people with low vision, colour-vision differences, glare on a projector or a poor display. WCAG sets 4.5:1 for normal text and 3:1 for large text.',
	{
		standard: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA',
		thresholds: ['contrastNormal', 'contrastLarge'],
		approximations:
			'Computed on sRGB colours with the WCAG relative-luminance formula, against the background the preview draws: a solid or theme colour, the card surface, a table cell fill, every colour a gradient takes under the text box (sampled on a 5x5 grid, angle respected), or both colours of a pattern. Anti-aliasing, text shadows and font weight are not modelled. Text colour is the preview\'s (the scheme\'s text role or dark1 on a light background and light1 on a dark one, chosen from the background luminance, where a gradient or picture background uses the scheme\'s default background colour), so a default can fail on a dark gradient. A link with no colour of its own is measured in the scheme\'s hyperlink colour.',
	},
);
const onImageRule = rule(
	'text-on-image',
	'accessibility',
	'info',
	'Text sits on a background picture whose pixels cannot be measured.',
	'Contrast over a photograph depends on the photograph. Without a full-frame overlay that guarantees readability for every possible image, the result cannot be certified from the document.',
	{
		standard: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum), level AA',
		thresholds: ['contrastNormal', 'contrastLarge'],
		approximations:
			'Core never reads picture pixels. The picture is bounded by a grey ramp from black to white, composited through the image opacity and a full-frame design.slideImage.overlay; the text passes only when every step of that ramp passes. An edge-banded overlay is not counted.',
	},
);

const contrastRules: AuditRule[] = [
	{
		info: contrastRule,
		also: [onImageRule],
		run(context) {
			const { thresholds } = context;
			for (const slide of context.slides) {
				const aggregated = new Map<string, { diagnostic: AuditDiagnostic; extra: number }>();
				const imageReported = { done: false };
				for (const sample of collectSamples(slide)) {
					const large = isLarge(sample.sizePx, sample.bold),
						needed = large ? thresholds.contrastLarge : thresholds.contrastNormal;
					const worst = worstContrast(sample.color, sample.backdrop);
					if (worst.ratio >= needed) continue;
					if (sample.backdrop.unknown) {
						if (!imageReported.done) {
							imageReported.done = true;
							context.report(onImageRule, {
								path: sample.path,
								slide,
								message: `${sample.label} sits on a background picture. Contrast cannot be guaranteed from the document (against the lightest or darkest possible pixels it is as low as ${worst.ratio.toFixed(1)}:1; ${needed}:1 is needed at this size).`,
								help: 'Add a full-frame overlay to design.slideImage (overlay colour and an opacity high enough that text passes on any picture), use a solid or gradient background behind text, or place text on a card.',
								measured: { ratio: round(worst.ratio), needed, textColor: sample.color },
							});
						}
						continue;
					}
					const key = `${sample.source === 'default' ? 'default' : sample.path}|${sample.color}|${worst.against}|${large}`;
					const known = aggregated.get(key);
					if (known && sample.source === 'default') {
						known.extra++;
						continue;
					}
					const fixes: AuditFix[] = [];
					if (sample.colorPath) {
						const preferred = readableColor([slide.design.colors.text], sample.backdrop, needed);
						if (preferred !== undefined) {
							const value = preferred.toUpperCase() === slide.design.colors.text.toUpperCase() ? 'text' : preferred;
							fixes.push({ id: 'use-readable-color', label: value === 'text' ? 'Use the slide text colour' : `Use ${preferred}`, kind: 'patch', safe: true, patch: [{ op: 'replace', path: sample.colorPath, value }] });
						}
					}
					const diagnostic = context.report(contrastRule, {
						path: sample.path,
						slide,
						message: `${sample.label} colour ${sample.color} on ${worst.against} has a contrast ratio of ${worst.ratio.toFixed(2)}:1; ${needed}:1 is needed for ${large ? 'large' : 'normal'} text.`,
						help:
							sample.source === 'override'
								? 'Pick a colour with enough contrast against the background, or remove this colour override so the theme chooses a readable text colour.'
								: 'The theme text colour is unreadable on this background. Change the slide or deck background, the colour scheme (dark1/light1), or give the text an explicit readable colour.',
						measured: { ratio: round(worst.ratio), needed, large, sizePt: round(sample.sizePx * PX_TO_PT), textColor: sample.color, backgroundColor: worst.against },
						fixes,
					});
					if (sample.source === 'default') aggregated.set(key, { diagnostic, extra: 0 });
				}
				for (const { diagnostic, extra } of aggregated.values())
					if (extra) {
						diagnostic.message += ` ${extra} more text element${extra === 1 ? '' : 's'} on this slide ${extra === 1 ? 'has' : 'have'} the same problem.`;
						if (diagnostic.measured) diagnostic.measured.alsoAffected = extra;
					}
			}
		},
	},
];

const round = (value: number) => Math.round(value * 100) / 100;

// ----------------------------------------------------------------- alt text

const altRule = rule(
	'missing-alt-text',
	'accessibility',
	'warning',
	'A picture has no alt text and is not marked decorative.',
	'People using a screen reader get nothing for a picture without alternative text. A picture that is purely decorative should say so with an empty alt (alt: ""), which is an explicit, reviewed choice instead of an omission.',
	{
		standard: 'WCAG 2.2 SC 1.1.1 Non-text Content, level A',
		approximations:
			'Checks the alt field of images, video, the slide image, logos (design.logo and each LogoSet variant, organization.logo), header/footer images, quote photos and speaker photos, following asset: references to the assets registry. Whether the text describes the picture well is not judged here (see audit/poor-alt-text). Charts carry `chart.alt` and are checked by audit/chart-text-alternative. Background images and watermarks are decorative by definition and are not checked.',
	},
);
const poorAltRule = rule(
	'poor-alt-text',
	'accessibility',
	'info',
	'Alt text is a file name, a URL, a generic word or very long.',
	'Alt text such as "image", "IMG_2041.png" or a 400-character paragraph does not do the job of describing a picture: it is read out and adds noise without information.',
	{ standard: 'WCAG 2.2 SC 1.1.1 Non-text Content, level A', approximations: 'Pattern checks only: file extensions and camera-style names, a bare generic word, a URL, a leading "image of", and more than 250 characters. Chart alt text (chart.alt) is checked too: a bare chart word, a URL, a leading "chart of" or more than 250 characters. It cannot tell whether a plausible sentence is accurate.' },
);

const GENERIC_ALT = /^(image|picture|photo|photograph|graphic|img|icon|figure|screenshot|untitled|alt|alt text|logo)$/i;
const FILE_ALT = /(\.(png|jpe?g|gif|svg|webp|bmp|tiff?|heic|avif)$)|^(img|dsc|image|screenshot|screen shot|photo|pic)[ _-]?\d+/i;
const GENERIC_CHART_ALT = /^((a|an|the)\s+)?([a-z-]+\s+){0,2}(chart|graph|plot|diagram|figure)$/i;
const kindLabel = (kind: string) =>
	({ chart: 'Chart', image: 'Image', video: 'Video', 'slide-image': 'Slide image', logo: 'Logo', furniture: 'Header/footer image', speaker: 'Speaker photo', 'quote-photo': 'Quote photo', organization: 'Organization logo' })[kind] ?? 'Picture';

function altFixes(path: string, value: unknown): AuditFix[] {
	const decorative: AuditFix =
		typeof value === 'string'
			? { id: 'mark-decorative', label: 'Mark as decorative (empty alt)', kind: 'patch', safe: false, patch: [{ op: 'replace', path, value: { src: value, alt: '' } }] }
			: { id: 'mark-decorative', label: 'Mark as decorative (empty alt)', kind: 'patch', safe: false, patch: [{ op: 'add', path: `${path}/alt`, value: '' }] };
	return [{ id: 'focus-alt', label: 'Write alt text', kind: 'focus', safe: true, focus: { path, field: 'alt', value } }, decorative];
}

const altRules: AuditRule[] = [
	{
		info: altRule,
		run(context) {
			const seen = new Set<string>();
			context.slides.forEach((slide, index) => {
				for (const ref of assetRefs(context.document, slide.slide, slide.path, index === 0)) {
					if (seen.has(ref.path)) continue;
					seen.add(ref.path);
					let alt = altOf(ref.value, context.document.assets);
					if (ref.kind === 'video' && !alt) alt = typeof rec(ref.value).title === 'string' ? rec(ref.value).title : undefined;
					if (alt !== undefined && alt.trim() !== '') continue;
					if (alt === '') continue; // explicit decorative opt-out
					const hasText = alt !== undefined;
					const organization = ref.kind === 'organization' || ref.kind === 'logo' ? rec(Array.isArray(context.document.organization) ? context.document.organization[0] : context.document.organization).name : undefined;
					context.report(altRule, {
						path: ref.path,
						slide: ref.path.startsWith('/slides/') ? slide : undefined,
						message: `${kindLabel(ref.kind)} has ${hasText ? 'blank' : 'no'} alt text.`,
						help: `Describe what the ${ref.kind === 'logo' || ref.kind === 'organization' ? 'logo shows' : 'picture shows or why it is here'}${typeof organization === 'string' ? ` (for a logo, the organization name, ${organization}, is usually right)` : ''}, or set alt to "" if it is purely decorative.`,
						fixes: altFixes(ref.path, ref.value),
					});
				}
			});
		},
	},
	{
		info: poorAltRule,
		run(context) {
			const seen = new Set<string>();
			context.slides.forEach((slide, index) => {
				for (const ref of assetRefs(context.document, slide.slide, slide.path, index === 0)) {
					if (seen.has(ref.path)) continue;
					seen.add(ref.path);
					const alt = altOf(ref.value, context.document.assets)?.trim();
					if (!alt) continue;
					const source = sourceOfAsset(ref.value);
					const problem =
						GENERIC_ALT.test(alt) ? 'is a generic word' : FILE_ALT.test(alt) ? 'looks like a file name' : /^(https?:\/\/|data:|www\.)/i.test(alt) || (source && alt === source) ? 'is a URL' : /^(image|picture|photo|graphic) of\b/i.test(alt) ? 'starts with "image of", which a screen reader already announces' : alt.length > 250 ? `is ${alt.length} characters long; aim for a sentence or two` : undefined;
					if (!problem) continue;
					context.report(poorAltRule, {
						path: `${ref.path}${typeof ref.value === 'object' ? '/alt' : ''}`,
						slide: ref.path.startsWith('/slides/') ? slide : undefined,
						message: `${kindLabel(ref.kind)} alt text ${JSON.stringify(alt.length > 60 ? `${alt.slice(0, 57)}...` : alt)} ${problem}.`,
						help: 'Write what a person who cannot see the picture needs to know, in plain words and without a leading "image of".',
						fixes: [{ id: 'focus-alt', label: 'Edit alt text', kind: 'focus', safe: true, focus: { path: ref.path, field: 'alt', value: ref.value } }],
					});
				}
				for (const payload of slidePayloads(slide.slide, slide.path)) {
					const chart = rec(payload.node.chart);
					const alt = typeof chart.alt === 'string' ? chart.alt.trim() : '';
					if (!alt) continue;
					const problem = GENERIC_ALT.test(alt) || GENERIC_CHART_ALT.test(alt) ? 'is a generic word, not what the data shows' : /^(https?:\/\/|data:|www\.)/i.test(alt) ? 'is a URL' : /^(image|picture|photo|graphic|chart|graph) of\b/i.test(alt) ? 'starts with "chart of" or "image of", which a screen reader already announces' : alt.length > 250 ? `is ${alt.length} characters long; aim for a sentence or two` : undefined;
					if (!problem) continue;
					const path = `${payload.path}/chart/alt`;
					if (seen.has(path)) continue;
					seen.add(path);
					context.report(poorAltRule, {
						path,
						slide,
						message: `Chart alt text ${JSON.stringify(alt.length > 60 ? `${alt.slice(0, 57)}...` : alt)} ${problem}.`,
						help: 'State what the chart shows: its point and the key numbers, in a sentence or two.',
						fixes: [{ id: 'focus-alt', label: 'Edit alt text', kind: 'focus', safe: true, focus: { path: `${payload.path}/chart`, field: 'alt', value: chart.alt } }],
					});
				}
			});
		},
	},
];

// -------------------------------------------------------------- slide titles

const missingTitleRule = rule(
	'missing-slide-title',
	'accessibility',
	'warning',
	'A slide has no title.',
	'Slide titles are how people using a screen reader, an outline view or keyboard navigation find and tell slides apart; PowerPoint\'s own accessibility checker reports a missing title too.',
	{ standard: 'WCAG 2.2 SC 2.4.2 Page Titled and SC 2.4.6 Headings and Labels, level AA (PowerPoint: "Missing slide title")', approximations: 'Only the slide-level title field counts. Text that merely looks like a heading inside a block does not.' },
);
const duplicateTitleRule = rule(
	'duplicate-slide-title',
	'accessibility',
	'info',
	'Two slides have the same title.',
	'Identical titles make slides indistinguishable in an outline or a screen reader\'s slide list.',
	{ approximations: 'Titles are compared case-insensitively with whitespace collapsed. Slides that continue one another are not exempt; give a continuation a distinct title such as "(continued)".' },
);
const titleRules: AuditRule[] = [
	{
		info: missingTitleRule,
		run(context) {
			for (const slide of context.slides) {
				const title = slide.slide.title;
				if (typeof title === 'string' && title.trim() !== '') continue;
				context.report(missingTitleRule, {
					path: slide.path,
					slide,
					message: `Slide ${slide.index + 1} has no title.`,
					help: 'Give the slide a short, specific title. If the design has no room for a visible title, keep it short; the title also names the slide for assistive technology.',
					fixes: [{ id: 'focus-title', label: 'Write a title', kind: 'focus', safe: true, focus: { path: `${slide.path}/title`, field: 'title' } }],
				});
			}
		},
	},
	{
		info: duplicateTitleRule,
		run(context) {
			const first = new Map<string, number>();
			for (const slide of context.slides) {
				const title = typeof slide.slide.title === 'string' ? slide.slide.title.trim().replace(/\s+/g, ' ').toLowerCase() : '';
				if (!title) continue;
				const earlier = first.get(title);
				if (earlier === undefined) first.set(title, slide.index);
				else
					context.report(duplicateTitleRule, {
						path: `${slide.path}/title`,
						slide,
						message: `Slide ${slide.index + 1} has the same title as slide ${earlier + 1}: ${JSON.stringify(String(slide.slide.title).trim())}.`,
						help: 'Make the titles distinct so each slide can be told apart in an outline or by assistive technology.',
						fixes: [{ id: 'focus-title', label: 'Edit the title', kind: 'focus', safe: true, focus: { path: `${slide.path}/title`, field: 'title' } }],
					});
			}
		},
	},
];

// -------------------------------------------------------------- reading order

const readingOrderRule = rule(
	'reading-order',
	'accessibility',
	'warning',
	'The order content is read differs from the order it appears on the slide.',
	'Screen readers, keyboard focus and PowerPoint\'s selection pane follow the composed order. When it differs from the visual order (top to bottom, then start to end of the reading direction), the slide is read out of sequence.',
	{
		standard: 'WCAG 2.2 SC 1.3.2 Meaningful Sequence, level A (PowerPoint: "Check reading order")',
		approximations:
			'Compares the composed content order with a visual order recomputed from the composed boxes: items whose vertical centres fall in the same row are ordered along the reading direction (a right-to-left deck is checked by rows only), rows from top to bottom. Headings are expected first. Free-form overlap is not analysed.',
	},
);

const readingOrderRules: AuditRule[] = [
	{
		info: readingOrderRule,
		run(context) {
			for (const slide of context.slides) {
				const composition = slide.composition;
				if (!composition) continue;
				const body = composition.items.filter((item) => !['title', 'subtitle', 'tag'].includes(item.field));
				const title = composition.items.find((item) => item.field === 'title');
				if (title && body.some((item) => item.box.y + item.box.height <= title.box.y + 1)) {
					const above = body.find((item) => item.box.y + item.box.height <= title.box.y + 1)!;
					context.report(readingOrderRule, {
						path: pointerOfDotted(above.path),
						slide,
						message: `Content ${JSON.stringify(shortField(above.path))} is drawn above the title but is read after it.`,
						help: 'Move the title above the content or change the layout so the title is the first thing on the slide.',
					});
				}
				if (body.length < 2) continue;
				const visual = visualOrder(body, slide.rtl);
				const composed = body.map((item) => item.path);
				const index = composed.findIndex((path, i) => path !== visual[i]);
				if (index < 0) continue;
				const name = (path: string) => shortField(path);
				context.report(readingOrderRule, {
					path: pointerOfDotted(composed[index]!),
					slide,
					message: `Reading order differs from visual order: ${JSON.stringify(name(composed[index]!))} is read at ${ordinal(index)} but appears at ${ordinal(visual.indexOf(composed[index]!))}. Composed order: ${composed.map(name).join(', ')}; visual order: ${visual.map(name).join(', ')}.`,
					help: 'Reorder the blocks (or rename promoted regions) so the composed order follows the visual order, or use blocks with an explicit composition instead of region keys.',
					measured: { firstMismatch: index, composed: composed.length },
				});
			}
		},
	},
];

function visualOrder(items: readonly { path: string; box: { x: number; y: number; width: number; height: number } }[], rtl: boolean): string[] {
	// The same ordering composeSlide uses for promoted regions. A right-to-left deck's boxes may be mirrored (or, before the
	// mirroring lands, not), so only the row order is checked there: each row keeps its composed order.
	if (rtl) return readingRows(items).flatMap((row) => row.map((item) => item.path));
	return visualReadingOrder(items).map((item) => item.path);
}
const shortField = (path: string) => path.replace(/^slides\.\d+\./, '');
const ordinal = (index: number) => `position ${index + 1}`;

// ----------------------------------------------------------------- link text

const linkRule = rule(
	'link-text',
	'accessibility',
	'warning',
	'Link text does not say where the link goes.',
	'People who scan links out of context (a screen reader\'s links list, a link tab order) hear only the text. "click here", "read more" or a long raw URL tells them nothing about the destination.',
	{ standard: 'WCAG 2.2 SC 2.4.4 Link Purpose (In Context), level A; PowerPoint: "Hyperlink text is not meaningful"', approximations: 'Matches a short list of generic phrases in English (after lower-casing and removing punctuation), blank link text, and raw URLs longer than 40 characters. Adjacent runs sharing one link are read as one link.' },
);
const GENERIC_LINKS = new Set(['click here', 'click', 'here', 'link', 'this link', 'this', 'read more', 'more', 'learn more', 'see more', 'more info', 'more information', 'details', 'download', 'url', 'website', 'web site', 'page', 'this page', 'visit', 'go']);
const linkRules: AuditRule[] = [
	{
		info: linkRule,
		run(context) {
			for (const slide of context.slides)
				for (const tv of slide.texts) {
					if (typeof tv.value === 'string') continue;
					const runs = runsOf(tv);
					for (let i = 0; i < runs.length; i++) {
						const run = runs[i]!;
						const link = run.style.link;
						if (typeof link !== 'string') continue;
						let text = run.text;
						let last = i;
						while (runs[last + 1] && runs[last + 1]!.style.link === link) text += runs[++last]!.text;
						const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
						const problem = !text.trim() ? 'is blank' : GENERIC_LINKS.has(normalized) ? 'is generic' : /^(https?:\/\/|www\.)\S{30,}$/i.test(text.trim()) ? 'is a long raw URL' : undefined;
						i = last;
						if (!problem) continue;
						context.report(linkRule, {
							path: run.path,
							slide,
							message: `Link text ${JSON.stringify(text.trim().slice(0, 50))} ${problem}; the destination is ${link.length > 60 ? `${link.slice(0, 57)}...` : link}.`,
							help: 'Use text that names the destination or action, for example "Q3 financial results (PDF)", instead of "click here".',
							fixes: [{ id: 'focus-link', label: 'Edit the text', kind: 'focus', safe: true, focus: { path: run.valuePath, field: 'link', value: link } }],
						});
					}
				}
		},
	},
];

// ------------------------------------------------------- charts and language

const chartColorRule = rule(
	'chart-color-only',
	'accessibility',
	'info',
	'Chart series may be indistinguishable without colour vision.',
	'OPF charts have no data labels or patterns, so series are told apart by colour alone (and legend order). Colours that look alike to someone with colour-vision deficiency, or when printed in greyscale, make series impossible to tell apart.',
	{
		standard: 'WCAG 2.2 SC 1.4.1 Use of Color, level A',
		thresholds: ['minSeriesColorDifference'],
		approximations:
			'Uses the engine\'s series palette (AuditOptions.chartPalette; default the opf-render/opf-pptx palette, adjusted for the card surface like the preview does) in series order: series i takes colour i, pie/doughnut/treemap/funnel slices take colours per category. Pairs are compared by CIE76 distance after simulating protanopia, deuteranopia, tritanopia (Machado 2009, severity 1) and greyscale. Single-series charts and chart types without a series legend are skipped.',
	},
);
const chartAltRule = rule(
	'chart-text-alternative',
	'accessibility',
	'info',
	'A chart has no text alternative, or is marked decorative.',
	'A chart conveys a message; people who cannot see it need the message and ideally the numbers in text. The chart\'s alt field is that text alternative (the preview exposes it as the chart\'s accessible name and the PowerPoint export writes it as the frame\'s alternative text); a sentence or table beside the chart also serves. An empty alt marks a chart decorative, which is reported as info so the choice is reviewed: a chart rarely carries no message.',
	{ standard: 'WCAG 2.2 SC 1.1.1 Non-text Content, level A', approximations: 'A chart passes when chart.alt has text. Without alt, it passes when the slide has any other text, list, table, quote or metric content besides title and tag, or a subtitle. It does not judge whether alt or that text states the chart\'s point (see audit/poor-alt-text for generic alt text). alt: \"\" is reported as a decorative chart, whatever else is on the slide.' },
);

const chartSkip = /(histogram|box|pareto|waterfall|world|map)/;
const perCategory = /(pie|doughnut|treemap|funnel)/;

const chartRules: AuditRule[] = [
	{
		info: chartColorRule,
		run(context) {
			for (const slide of context.slides)
				for (const payload of slidePayloads(slide.slide, slide.path)) {
					const chart = rec(payload.node.chart);
					// RR-54: inline data, a dataset reference and the series mapping resolve to [category, (x,) ...series].
					const resolved = resolveChartData(chart, context.document);
					if (!resolved.ok) continue;
					const data = { columns: resolved.columns.filter((_, index) => !(resolved.hasX && index === 1)), rows: resolved.rows };
					const type = String(chart.type ?? '').toLowerCase();
					if (chartSkip.test(type)) continue;
					const slices = perCategory.test(type);
					const count = slices ? data.rows.length : data.columns.length - 1;
					if (count < 2) continue;
					const surface = slide.design.colors.surface;
					const palette = chartPaletteForFill(surface, context.chartPalette);
					if (!palette.length) continue;
					const used = Array.from({ length: Math.min(count, 24) }, (_, i) => palette[i % palette.length]!);
					const pairs: { a: number; b: number; model: string; difference: number }[] = [];
					for (let a = 0; a < used.length; a++)
						for (let b = a + 1; b < used.length; b++) {
							let worst = { model: 'normal vision', difference: colorDifference(used[a]!, used[b]!) };
							for (const model of visionModels) {
								const difference = colorDifference(simulateVision(used[a]!, model), simulateVision(used[b]!, model));
								if (difference < worst.difference) worst = { model, difference };
							}
							if (worst.difference < context.thresholds.minSeriesColorDifference) pairs.push({ a, b, ...worst });
						}
					const cycles = count > palette.length;
					if (!pairs.length && !cycles) continue;
					pairs.sort((x, y) => x.difference - y.difference);
					const names = slices ? data.rows.map((row: unknown[]) => String(row?.[0] ?? '')) : data.columns.slice(1).map(String);
					const describe = (p: (typeof pairs)[number]) => `${JSON.stringify(names[p.a] ?? `#${p.a + 1}`)} and ${JSON.stringify(names[p.b] ?? `#${p.b + 1}`)} (${p.model}, difference ${p.difference.toFixed(1)})`;
					context.report(chartColorRule, {
						path: `${payload.path === slide.path ? slide.path : payload.path}/chart`,
						slide,
						message: `${slices ? 'Slices' : 'Series'} may be hard to tell apart without colour: ${pairs.slice(0, 3).map(describe).join('; ')}${cycles ? `${pairs.length ? '; ' : ''}${count} ${slices ? 'slices' : 'series'} exceed the ${palette.length}-colour palette, so colours repeat` : ''}.`,
						help: 'Show fewer series per chart (split into two charts), state the key values in the slide text or a table next to the chart, or choose a chart type whose categories sit on an axis instead of in a legend.',
						measured: { series: count, confusablePairs: pairs.length, minDifference: pairs[0] ? round(pairs[0].difference) : null },
					});
				}
		},
	},
	{
		info: chartAltRule,
		run(context) {
			for (const slide of context.slides) {
				const payloads = slidePayloads(slide.slide, slide.path).filter((p) => !p.node.blocks && !p.node.composition || p.root);
				const charts = payloads.filter((p) => p.node.chart !== undefined);
				if (!charts.length) continue;
				const textual = (p: { node: Rec }) => ['text', 'items', 'bullets', 'table', 'quote', 'metric', 'timeline'].some((field) => p.node[field] !== undefined && p.node[field] !== '' && !(Array.isArray(p.node[field]) && p.node[field].length === 0));
				const textBeside = payloads.some(textual) || (typeof slide.slide.subtitle === 'string' && slide.slide.subtitle.trim() !== '');
				const where = (chart: (typeof charts)[number]) => (charts.length > 1 ? `chart ${charts.indexOf(chart) + 1} on slide ${slide.index + 1}` : `chart on slide ${slide.index + 1}`);
				const focusAlt = (chart: (typeof charts)[number]): AuditFix => ({ id: 'focus-alt', label: 'Write alt text', kind: 'focus', safe: true, focus: { path: `${chart.path}/chart`, field: 'alt', value: rec(chart.node.chart).alt } });
				let reported = false;
				for (const chart of charts) {
					const alt = rec(chart.node.chart).alt;
					if (typeof alt === 'string' && alt.trim() !== '') continue;
					if (alt === '') {
						context.report(chartAltRule, {
							path: `${chart.path}/chart/alt`,
							slide,
							message: `The ${where(chart)} is marked decorative (empty alt), so assistive technology skips it.`,
							help: 'Keep the empty alt only if the chart adds nothing the slide text does not already say. Otherwise describe what it shows: its point and the key numbers.',
							fixes: [focusAlt(chart)],
						});
						continue;
					}
					if (textBeside || reported) continue;
					reported = true;
					context.report(chartAltRule, {
						path: `${chart.path}/chart`,
						slide,
						message: `The ${where(chart)} has no alt text and no text beside it that states what it shows.`,
						help: "Set chart.alt to a sentence with the chart's point and key numbers, or add a subtitle, text block or table with them, so the message does not depend on seeing the chart.",
						fixes: [focusAlt(chart), { id: 'focus-subtitle', label: 'Write a subtitle', kind: 'focus', safe: true, focus: { path: `${slide.path}/subtitle`, field: 'text' } }],
					});
				}
			}
		},
	},
];

const languageRule = rule(
	'missing-language',
	'accessibility',
	'info',
	'The presentation does not declare its language.',
	'Screen readers and text-to-speech choose pronunciation and hyphenation from the declared language; spell checkers and translation tools use it too.',
	{ standard: 'WCAG 2.2 SC 3.1.1 Language of Page, level A', approximations: 'Only the presentation-level `language` is checked, not the language of individual runs (OPF has no per-run language).' },
);
const languageRules: AuditRule[] = [
	{
		info: languageRule,
		run(context) {
			if (context.document.language !== undefined) return;
			context.report(languageRule, {
				path: '',
				message: 'The presentation has no language set.',
				help: 'Set `language` to a language id from the languages catalog or a BCP 47 tag, for example "en-US".',
				fixes: [{ id: 'focus-language', label: 'Set the language', kind: 'focus', safe: true, focus: { path: '/language', field: 'language' } }],
			});
		},
	},
];

export const accessibilityRules: AuditRule[] = [
	...contrastRules,
	...altRules,
	...titleRules,
	...readingOrderRules,
	...linkRules,
	...chartRules,
	...languageRules,
];

export type { AuditContext, SlideContext };
export { plainText };
