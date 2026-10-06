import { intrinsicImageSize } from './image-aspect.js';
import type { AuditRule } from './audit-context.js';
import { rule } from './audit-context.js';
import { countWords, plainText, pointer, pointerOfDotted, runsOf, slidePayloads, splitPointer } from './audit-content.js';
import { type Rec, rec } from './audit-design.js';
import { resolveNarrative, unreferencedBeats } from './narrative-plan.js';

const PX_TO_PT = 0.75;
const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

// ------------------------------------------------------------------ layout

const overflowRule = rule(
	'text-overflow',
	'design',
	'warning',
	'Text or a table does not fit its space at the smallest allowed size.',
	'Core composition shrinks text to the readable minimum and then reports what still does not fit. Overflowing text is clipped or runs over other content in the preview and in PowerPoint.',
	{
		approximations:
			'Uses composeSlide at the deck\'s slide size with the fonts of the resolved font scheme. Without a host-supplied text measurement (AuditOptions.textMeasurement) widths are core\'s portable estimate, which can differ from the real font by a few percent; pass the renderer\'s measurement for font-exact results. Content in a composition that sets overflow: "error" is reported as an error, as the author asked.',
	},
);
const smallCellRule = rule(
	'small-cell',
	'design',
	'info',
	'A content cell is too small for comfortable reading.',
	'Cells narrower than about 100 px or shorter than 60 px (at 720 px slide height) leave no room for readable content.',
	{ approximations: 'The composeSlide threshold, in reference pixels scaled to the slide size.' },
);
const unresolvedRule = rule(
	'unresolved-content',
	'design',
	'warning',
	'Content cannot be drawn as authored.',
	'composeSlide reports content it cannot place or an effect it does not support (for example a picture bullet without a logo, a date field without a date, or an unsupported image treatment). The preview and the export fall back.',
);
const layoutFailedRule = rule(
	'layout-failed',
	'design',
	'warning',
	'The slide layout could not be computed.',
	'Composition threw for a slide that passed schema validation, so geometry-based rules (contrast, overflow, reading order, resolution) were skipped for it.',
);
const minFontRule = rule(
	'min-font-size',
	'design',
	'warning',
	'Text is drawn smaller than the readable minimum.',
	'Small type is unreadable from the back of a room and on a phone. The engine\'s own default floor is 12 pt (16 px); anything much below that was lowered on purpose or by a composition that could not fit the text.',
	{
		standard: 'Common presentation guidance (12 pt minimum for body text; 18 pt or more is easier to read from a distance).',
		thresholds: ['minFontSizePt'],
		approximations: 'Sizes are those composeSlide fitted, expressed on the 13.33 x 7.5 in reference slide (96 px per inch, so 1 px is 0.75 pt; a smaller canvas scales type down with it) and explicit run fontSize values in points. Per payload, the smallest part (a metric label or a quote attribution) is reported. Table cell text (default 11.25 pt), code and header/footer furniture are not checked.',
	},
);

const layoutRules: AuditRule[] = [
	{
		info: overflowRule,
		also: [smallCellRule, unresolvedRule, layoutFailedRule, minFontRule],
		run(context) {
			// Diagnostics about deck-level settings (header, footer, design) repeat on every slide; report each once.
			const deckLevel = new Set<string>();
			for (const slide of context.slides) {
				if (slide.layoutError)
					context.report(layoutFailedRule, { path: slide.path, slide, message: `Layout failed: ${slide.layoutError}`, help: 'Fix the composition settings or content structure named in the message; geometry-based audit rules were skipped for this slide.' });
				for (const { diagnostic, strict } of slide.layoutDiagnostics) {
					const path = pointerOfDotted(diagnostic.path);
					if (!path.startsWith('/slides/')) {
						const key = `${diagnostic.code}|${path}|${diagnostic.message}`;
						if (deckLevel.has(key)) continue;
						deckLevel.add(key);
					}
					if (diagnostic.code === 'text-overflow')
						context.report(overflowRule, { path, slide, message: diagnostic.message, help: 'Shorten the text, give it more space (fewer blocks, a different composition) or split the slide (paginate); raising the readable minimum makes it worse.', severity: strict ? 'error' : undefined });
					else if (diagnostic.code === 'small-cell')
						context.report(smallCellRule, { path, slide, message: diagnostic.message, help: 'Use fewer blocks on the slide or a layout with larger cells.' });
					else context.report(unresolvedRule, { path, slide: path.startsWith('/slides/') ? slide : undefined, message: diagnostic.message, help: 'Supply what the message asks for, or remove the setting that cannot be honoured.' });
				}
				for (const tv of slide.texts)
					for (const run of runsOf(tv))
						if (typeof run.style.fontSize === 'number' && run.style.fontSize < context.thresholds.minFontSizePt)
							context.report(minFontRule, {
								path: `${run.path}/fontSize`,
								slide,
								message: `Text run is set to ${run.style.fontSize} pt, below the ${context.thresholds.minFontSizePt} pt minimum.`,
								help: 'Remove the size override so the text uses the fitted size, or raise it.',
								measured: { sizePt: run.style.fontSize, minimumPt: context.thresholds.minFontSizePt },
								fixes: [{ id: 'focus-font-size', label: 'Edit the size', kind: 'focus', safe: true, focus: { path: `${run.path}/fontSize`, field: 'fontSize' } }],
							});
				const composition = slide.composition;
				if (!composition) continue;
				// Fitted sizes are canvas-relative: divide by the canvas scale to compare them with the 13.33 x 7.5 in reference slide.
				const scale = Math.min(composition.width, composition.height) / 720;
				const limitPx = context.thresholds.minFontSizePt / PX_TO_PT;
				const small = (path: string, sizes: (number | undefined)[], label: string) => {
					const known = sizes.filter((size): size is number => size !== undefined);
					const sizePx = known.length ? Math.min(...known) / scale : undefined;
					if (sizePx === undefined || sizePx >= limitPx - 1e-6) return;
					context.report(minFontRule, {
						path,
						slide,
						message: `${label} is drawn at ${round(sizePx * PX_TO_PT)} pt${scale === 1 ? '' : ' (reference slide size)'}, below the ${context.thresholds.minFontSizePt} pt minimum.`,
						help: 'Shorten the text or give it more room so it can be drawn larger; check composition.minFontSize and run fontSize settings that force small type.',
						measured: { sizePt: round(sizePx * PX_TO_PT, 2), minimumPt: context.thresholds.minFontSizePt },
					});
				};
				for (const item of composition.items) {
					if (item.field === 'code' || item.field === 'table' || item.type === 'code' || item.type === 'table') continue;
					const layout = item.quoteLayout ?? item.metricLayout ?? item.timelineLayout;
					if (layout) small(pointerOfDotted(item.path), (layout.parts as readonly Rec[]).map((part) => (part.visible === false ? undefined : part.fit?.fontSize)), 'The smallest text');
					else small(pointerOfDotted(item.path), [item.text?.fontSize], item.field === 'title' ? 'Title' : 'Text');
				}
			}
		},
	},
];

// -------------------------------------------------------------------- fonts

const outsideRule = rule(
	'font-outside-scheme',
	'design',
	'warning',
	'Text uses a font family that is not in the deck\'s font scheme.',
	'The font scheme is the deck\'s font choice. A run that names another family will not follow a font-scheme change, may be missing on the viewer\'s machine, and breaks the deck\'s typographic consistency.',
	{ approximations: 'Compares the run\'s fontFamily (case-insensitively) with the heading, body, code and accent families of the slide\'s resolved font scheme and the scheme\'s major/minor fonts. Families that the host substitutes are still different names here.' },
);
const countRule = rule(
	'font-family-count',
	'design',
	'info',
	'The deck uses more font families than the recommended maximum.',
	'More than two or three families (heading, body, plus code where used) makes a deck look unplanned and increases the font bytes a viewer needs.',
	{ thresholds: ['maxFontFamilies'], approximations: 'Counts the distinct heading and body families of every slide\'s resolved scheme, the code family on slides with code, the accent family on slides with a tag, and every run fontFamily.' },
);
const fontRules: AuditRule[] = [
	{
		info: outsideRule,
		run(context) {
			for (const slide of context.slides) {
				const allowed = new Set(
					[slide.design.fonts.heading, slide.design.fonts.body, slide.design.fonts.code, slide.design.fonts.accent, slide.design.fontScheme.major, slide.design.fontScheme.minor]
						.filter((family): family is string => typeof family === 'string')
						.map((family) => family.toLowerCase()),
				);
				const reported = new Set<string>();
				for (const tv of slide.texts)
					for (const run of runsOf(tv)) {
						const family = run.style.fontFamily;
						if (typeof family !== 'string' || !family.trim() || allowed.has(family.trim().toLowerCase()) || reported.has(family.toLowerCase())) continue;
						reported.add(family.toLowerCase());
						context.report(outsideRule, {
							path: `${run.path}/fontFamily`,
							slide,
							message: `Text uses ${JSON.stringify(family)}, which is not in the font scheme (${[...new Set([slide.design.fonts.heading, slide.design.fonts.body])].join(' / ')}).`,
							help: 'Remove the fontFamily override to use the scheme font, or change the deck\'s font scheme so the family is part of it.',
							fixes: [{ id: 'remove-font-family', label: 'Use the scheme font', kind: 'patch', safe: false, patch: [{ op: 'remove', path: `${run.path}/fontFamily` }] }],
						});
					}
			}
		},
	},
	{
		info: countRule,
		run(context) {
			const families = new Map<string, string>();
			const add = (family: unknown) => {
				if (typeof family === 'string' && family.trim()) families.set(family.trim().toLowerCase(), family.trim());
			};
			for (const slide of context.slides) {
				add(slide.design.fonts.heading);
				add(slide.design.fonts.body);
				if (slide.payloads.some((p) => p.node.code !== undefined)) add(slide.design.fonts.code);
				if (typeof slide.slide.tag === 'string' || Array.isArray(slide.slide.tag)) add(slide.design.fonts.accent);
				for (const tv of slide.texts) for (const run of runsOf(tv)) add(run.style.fontFamily);
			}
			if (families.size <= context.thresholds.maxFontFamilies) return;
			context.report(countRule, {
				path: '/design',
				message: `The deck uses ${families.size} font families (${[...families.values()].join(', ')}); the recommended maximum is ${context.thresholds.maxFontFamilies}.`,
				help: 'Use one heading and one body family, add a code family only where code appears, and remove run-level fontFamily overrides.',
				measured: { families: families.size, maximum: context.thresholds.maxFontFamilies },
			});
		},
	},
];

// ------------------------------------------------------------- consistency

const titlePositionRule = rule(
	'title-position',
	'design',
	'info',
	'Titles of slides with the same layout sit in different places.',
	'A title that jumps between slides of one layout looks like a mistake when the deck is clicked through. Slides of one layout should hold their titles still.',
	{
		thresholds: ['titlePositionTolerance'],
		approximations: 'Compares the composed title box origin of slides that share a layout id, a header presence and a slide-image position; covers (no body content) are skipped because their heading group is centred on purpose. The reference is the most common position, ties going to the earliest slide.',
	},
);
const titleRules: AuditRule[] = [
	{
		info: titlePositionRule,
		run(context) {
			const groups = new Map<string, { slide: (typeof context.slides)[number]; x: number; y: number }[]>();
			for (const slide of context.slides) {
				const composition = slide.composition;
				const title = composition?.items.find((item) => item.field === 'title');
				if (!composition || !title) continue;
				if (!composition.items.some((item) => !['title', 'subtitle', 'tag'].includes(item.field))) continue;
				const key = [slide.layout?.id ?? (typeof slide.slide.layout === 'string' ? slide.slide.layout : '(inferred)'), (composition.furniture?.headerBottom ?? 0) > 0, composition.slideImage?.position ?? '-'].join('|');
				const list = groups.get(key) ?? [];
				list.push({ slide, x: title.box.x / composition.width, y: title.box.y / composition.height });
				groups.set(key, list);
			}
			const tolerance = context.thresholds.titlePositionTolerance;
			for (const [key, members] of groups) {
				if (members.length < 2) continue;
				const counts: { x: number; y: number; n: number }[] = [];
				for (const member of members) {
					const near = counts.find((c) => Math.abs(c.x - member.x) <= tolerance && Math.abs(c.y - member.y) <= tolerance);
					if (near) near.n++;
					else counts.push({ x: member.x, y: member.y, n: 1 });
				}
				const reference = counts.reduce((best, c) => (c.n > best.n ? c : best));
				for (const member of members)
					if (Math.abs(member.x - reference.x) > tolerance || Math.abs(member.y - reference.y) > tolerance)
						context.report(titlePositionRule, {
							path: `${member.slide.path}/title`,
							slide: member.slide,
							message: `The title is ${round(Math.abs(member.x - reference.x) * 100)}% (across) and ${round(Math.abs(member.y - reference.y) * 100)}% (down) away from where other "${key.split('|')[0]}" slides place it.`,
							help: 'Slides of one layout should hold the title in the same place: check the header, the slide image, the layout and composition overrides on this slide.',
							measured: { offsetX: round(member.x - reference.x, 3), offsetY: round(member.y - reference.y, 3) },
						});
			}
		},
	},
];

const wordRule = rule(
	'slide-word-count',
	'design',
	'info',
	'A slide holds a lot of text.',
	'Slides that carry a page of prose are read instead of presented, and are hard to scan on a screen reader or a phone. Split them or move detail to notes.',
	{ thresholds: ['maxWordsPerSlide'], approximations: 'Counts word-like segments (Unicode word boundaries, so Chinese and Japanese count by word) in the title, subtitle, tag, text, lists, tables, quotes, metrics and timelines. Code and speaker notes are excluded.' },
);
const wordRules: AuditRule[] = [
	{
		info: wordRule,
		run(context) {
			for (const slide of context.slides) {
				const words = slide.texts.reduce((sum, tv) => sum + countWords(plainText(tv.value)), 0);
				if (words <= context.thresholds.maxWordsPerSlide) continue;
				context.report(wordRule, {
					path: slide.path,
					slide,
					message: `Slide ${slide.index + 1} has ${words} words; more than ${context.thresholds.maxWordsPerSlide} is hard to read as a slide.`,
					help: 'Cut it to the points that matter, split it over several slides, or move the detail into speaker notes or a handout.',
					measured: { words, maximum: context.thresholds.maxWordsPerSlide },
				});
			}
		},
	},
];

// ------------------------------------------------------------------- images

const resolutionRule = rule(
	'image-resolution',
	'design',
	'warning',
	'An image has too few pixels for the size it is shown at.',
	'An image stretched beyond its pixel size looks blurry or blocky on a projector or a high-density screen.',
	{
		thresholds: ['minImagePpi'],
		approximations:
			'Only embedded data: images (and asset: references to them) have readable pixel sizes; URLs and files are never fetched, so they are not checked. The displayed size is the composed box (cropped images are measured as the cover scale, fitted ones as the contain scale). Effective ppi is the image pixels per inch of the 96 px/inch reference slide. SVG is vector and exempt.',
	},
);
const resolutionRules: AuditRule[] = [
	{
		info: resolutionRule,
		run(context) {
			const assets = context.document.assets;
			const seen = new Set<string>();
			const check = (path: string, value: unknown, box: { width: number; height: number }, cover: boolean, slide: (typeof context.slides)[number] | undefined) => {
				if (seen.has(path)) return;
				seen.add(path);
				const size = intrinsicImageSize(value, assets);
				if (!size || size.svg || box.width <= 0 || box.height <= 0) return;
				const scale = cover ? Math.max(box.width / size.width, box.height / size.height) : Math.min(box.width / size.width, box.height / size.height);
				const ppi = 96 / scale;
				if (ppi >= context.thresholds.minImagePpi) return;
				context.report(resolutionRule, {
					path,
					slide,
					message: `The ${size.width}x${size.height} px image is shown ${round(box.width / 96)} x ${round(box.height / 96)} in, about ${round(ppi, 0)} pixels per inch; ${context.thresholds.minImagePpi} are needed to look sharp.`,
					help: 'Use a larger source image, or show it smaller. Re-exporting a small image at a higher size does not add detail.',
					measured: { widthPx: size.width, heightPx: size.height, ppi: round(ppi, 0), minimumPpi: context.thresholds.minImagePpi },
				});
			};
			for (const slide of context.slides) {
				const composition = slide.composition;
				if (composition) {
					const fill = composition.design.imageFill;
					for (const item of composition.items) if (item.field === 'image') check(pointerOfDotted(item.path), item.value, item.box, fill === 'crop', slide);
					if (composition.slideImage) check(pointerOfDotted(composition.slideImage.sourcePath), composition.slideImage.value, composition.slideImage.box, composition.slideImage.fill === 'crop', slide);
				}
				const background = slide.design.backgroundImage;
				if (background && background.fit !== 'tile') check(background.path, rec({ src: background.source }), slide.design.dimensions, background.fit === 'cover', background.path.startsWith('/slides/') ? slide : undefined);
			}
		},
	},
];

// ------------------------------------------------------------------ content

const placeholderRule = rule(
	'placeholder-text',
	'content',
	'warning',
	'Placeholder text was left in the deck.',
	'"Lorem ipsum", "Click to add title", "TBD" and bracketed prompts are scaffolding. Shipping them reads as unfinished work.',
	{ approximations: 'Case-insensitive patterns for lorem ipsum, template prompts ("Click to add...", "Your title here", "[Insert ...]", a bare "Title" or "Text"), and the markers TBD, TBC, TODO, FIXME and XXX in capitals. A deliberate use of the words is flagged too; disable the rule for that slide with ignorePaths.' },
);
const emptyTextRule = rule(
	'empty-text',
	'content',
	'info',
	'A text field is present but empty.',
	'An empty title, text block or list item draws nothing, and leaves a hole in the outline and for assistive technology.',
);
const emptySlideRule = rule(
	'empty-slide',
	'content',
	'warning',
	'A slide has no content at all.',
	'A slide with no title, no content and no picture is almost always an accident of editing. (A deliberately blank slide can use the blank layout.)',
);
const unusedBeatRule = rule(
	'unused-beat',
	'content',
	'info',
	'A beat of the narrative has no slide that references it.',
	'The narrative is the plan and the slides are the product. When some slides name a beat (slides[].beat) and a beat of the plan has none, the deck skips a step of the story or the plan is out of date.',
	{
		approximations:
			'Resolved offline like every catalog reference: the inline catalogs.narratives.records of the document, then records passed in AuditOptions.catalogs, then the bundled catalog. A narrative given as a URL or a pkg: reference, or an id no local source defines, is not checked. A deck in which no slide references any beat is not checked either, because it has not linked its slides to the plan. A slide that lists several beats covers each of them.',
	},
);
const PLACEHOLDERS: { pattern: RegExp; label: string }[] = [
	{ pattern: /lorem ipsum|dolor sit amet|consectetur adipiscing/i, label: 'lorem ipsum' },
	{ pattern: /\b(click|tap) to (add|edit|enter)\b|\b(add|enter|insert|type) (a |your |the )?(title|subtitle|text|heading|caption|content|name|description)( here)?\s*$/i, label: 'a template prompt' },
	{ pattern: /\b(your|the) (title|subtitle|name|company|text|logo|content) (goes )?here\b|\b(title|subtitle|text|heading|content|description) (goes )?here\b/i, label: 'a template prompt' },
	{ pattern: /\[(insert|add|your|enter|name|title|date|company|tbd|tbc|todo|placeholder)[^\]]{0,40}\]/i, label: 'a bracketed prompt' },
	{ pattern: /\b(TBD|TBC|TODO|FIXME)\b|\bXXX+\b|\?\?\?/, label: 'a TBD/TODO marker' },
	{ pattern: /^\s*(title|subtitle|heading|text|slide title|new slide|untitled( slide| presentation)?|presentation title|sample text|placeholder)\s*$/i, label: 'a template default' },
];
const VARIABLE_TOKEN = /\\\{\{|\{\{\s*([a-z][a-z0-9-]*)\s*(?:\|[^{}]*)?\}\}/g;

const contentRules: AuditRule[] = [
	{
		info: placeholderRule,
		run(context) {
			for (const slide of context.slides)
				for (const tv of slide.texts) {
					const text = plainText(tv.value);
					const hit = PLACEHOLDERS.find(({ pattern }) => pattern.test(text));
					if (!hit) continue;
					context.report(placeholderRule, {
						path: tv.path,
						slide,
						message: `Text looks like ${hit.label}: ${JSON.stringify(text.length > 60 ? `${text.slice(0, 57)}...` : text)}.`,
						help: 'Replace it with the real content, or delete the element.',
						fixes: [{ id: 'focus-text', label: 'Edit the text', kind: 'focus', safe: true, focus: { path: tv.path, field: 'text' } }],
					});
				}
		},
	},
	{
		info: emptyTextRule,
		run(context) {
			for (const slide of context.slides)
				for (const tv of slide.texts) {
					if (['table', 'table-header', 'list-description'].includes(tv.role)) continue;
					if (plainText(tv.value).trim() !== '') continue;
					context.report(emptyTextRule, {
						path: tv.path,
						slide,
						message: `The ${tv.role === 'list' ? 'list item' : tv.role === 'body' ? 'text' : tv.role} is empty.`,
						help: 'Write the text, or remove the field so the slide does not carry an empty element.',
						fixes: [{ id: 'focus-text', label: 'Edit the text', kind: 'focus', safe: true, focus: { path: tv.path, field: 'text' } }],
					});
				}
		},
	},
	{
		info: unusedBeatRule,
		run(context) {
			const narrative = resolveNarrative(context.document, context.options.catalogs?.narratives);
			if (!narrative) return;
			const id = String(context.document.narrative);
			for (const { beat, index } of unreferencedBeats(context.document, narrative))
				context.report(unusedBeatRule, {
					path: '/narrative',
					message: `Beat ${JSON.stringify(beat)} (${index + 1} of ${narrative.beats.length}) of narrative ${JSON.stringify(id)} has no slide that references it.`,
					help: `Add a slide with "beat": ${JSON.stringify(beat)}, or list the beat on the slide that covers it. If the deck deliberately skips the beat, ignore this finding.`,
					measured: { beat, position: index + 1, beats: narrative.beats.length },
				});
		},
	},
	{
		info: emptySlideRule,
		run(context) {
			for (const slide of context.slides) {
				if (slide.slide.layout === 'blank') continue;
				const has = (value: unknown) => value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '') && !(Array.isArray(value) && value.length === 0);
				const hasText = slide.texts.some((tv) => plainText(tv.value).trim() !== '');
				const hasObject = slidePayloads(slide.slide, slide.path).some((p) => ['image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline'].some((field) => has(p.node[field])));
				const hasSlideImage = has(rec(slide.slide.design).slideImage);
				if (hasText || hasObject || hasSlideImage) continue;
				context.report(emptySlideRule, { path: slide.path, slide, message: `Slide ${slide.index + 1} has no title and no content.`, help: 'Add content, delete the slide, or give it the blank layout if it is intentionally empty.' });
			}
		},
	},
];

// ---------------------------------------------------------------- variables

const variableRule = rule(
	'unfilled-variable',
	'content',
	'warning',
	'A template variable was never filled in.',
	'`{{name}}` tokens, `var:` colour references to undeclared variables and declared variables without a value are template scaffolding. In a finished deck they show up literally, or fall back to a default colour.',
	{
		approximations:
			'Feature-detected from the document alone: `{{id}}` / `{{id|format}}` tokens (the RR-32 template syntax; `\\{{` escapes) in any string outside `variables`, `extensions` and `catalogs`; `var:<id>` references with no declaration in `variables`; and declared non-colour variables with no value that are not `required: false`. A template (`template: true`) reports its tokens as findings too: ignore the rule for a template on purpose, or fill it first. Core\'s `resolveVariables` (RR-32) is the authority once it is released; this check needs no import of it.',
	},
);
const variableRules: AuditRule[] = [
	{
		info: variableRule,
		run(context) {
			const doc = context.document;
			const declared = rec(doc.variables);
			const found: { path: string; message: string }[] = [];
			const walk = (value: unknown, path: string[], depth: number) => {
				if (depth > 64) return;
				if (typeof value === 'string') {
					if (value.startsWith('data:')) return;
					const reference = /^var:([a-z][a-z0-9-]*)$/.exec(value);
					if (reference && !(reference[1] as string in declared)) found.push({ path: pointer(...path), message: `Colour reference ${JSON.stringify(value)} names a variable that is not declared in variables.` });
					for (const match of value.matchAll(VARIABLE_TOKEN))
						if (match[1]) found.push({ path: pointer(...path), message: `Template variable ${JSON.stringify(match[0])} is still in the text.` });
					return;
				}
				if (Array.isArray(value)) {
					value.forEach((entry, index) => {
						walk(entry, [...path, String(index)], depth + 1);
					});
					return;
				}
				if (value && typeof value === 'object')
					for (const [key, entry] of Object.entries(value)) {
						if (path.length === 0 && ['variables', 'extensions', 'catalogs', 'assets'].includes(key)) continue;
						walk(entry, [...path, key], depth + 1);
					}
			};
			walk(doc, [], 0);
			for (const [id, entry] of Object.entries(declared)) {
				const declaration = rec(entry);
				if (typeof entry === 'object' && entry !== null && declaration.type !== undefined && declaration.type !== 'color' && declaration.value === undefined && declaration.required !== false)
					found.push({ path: pointer('variables', id), message: `Variable ${JSON.stringify(id)} (${String(declaration.type)}) has no value.` });
			}
			const slides = context.slides;
			for (const finding of found) {
				const parts = splitPointer(finding.path);
				const slide = parts[0] === 'slides' ? slides[Number(parts[1])] : undefined;
				context.report(variableRule, {
					path: finding.path,
					slide,
					message: finding.message,
					help: doc.template === true ? 'This document is a template: fill it with its values (opf fill, or resolveVariables) before auditing, or ignore this rule for templates.' : 'Fill the variable (or declare it), or replace the token with the real value.',
				});
			}
		},
	},
];

export const designRules: AuditRule[] = [
	...layoutRules,
	...fontRules,
	...titleRules,
	...wordRules,
	...resolutionRules,
	...contentRules,
	...variableRules,
];
