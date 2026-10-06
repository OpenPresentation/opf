import { catalogs as bundledCatalogs } from './catalogs.js';
import type { CatalogKind } from './catalogs.js';
import { defaultSlideBackground, normalizeHexColor, resolveColorRef, resolveColorRoles } from './color.js';
import {
	DEFAULT_FONT_SCHEME,
	resolveCanvasDimensions,
	resolveFontFamilies,
	resolveFontSchemeReference,
	type FontFamilies,
} from './composition.js';

/**
 * Design resolution and colour maths for `auditPresentation`.
 *
 * The resolution mirrors what the opf-render preview and the PPTX export draw (slide design, then deck
 * design, then theme, then engine default, per field), because an audit that reasons about a different
 * colour than the one on screen is worse than none. Internal module.
 */

// biome-ignore lint/suspicious/noExplicitAny: authored JSON is walked untyped; every read is guarded.
export type Rec = Record<string, any>;
export const rec = (value: unknown): Rec =>
	value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {};

// ---------------------------------------------------------------- colour maths

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => {
	const n = normalizeHexColor(hex) ?? '#000000';
	return [1, 3, 5].map((at) => Number.parseInt(n.slice(at, at + 2), 16)) as Rgb;
};
const toHex = (rgb: readonly number[]): string =>
	`#${rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const linear = (c: number) => {
	const n = c / 255;
	return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
};
const delinear = (c: number) => {
	const v = Math.max(0, Math.min(1, c));
	return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
};

/** `fg` over `bg` at `alpha` (0..1), in sRGB space like every renderer's compositing. */
export function blend(fg: string, bg: string, alpha: number): string {
	const a = Math.max(0, Math.min(1, alpha)),
		f = toRgb(fg),
		b = toRgb(bg);
	return toHex(f.map((c, i) => c * a + (b[i] ?? 0) * (1 - a)));
}

export const relativeLuminance = (hex: string): number => {
	const [r, g, b] = toRgb(hex);
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** WCAG 2.x contrast ratio of two opaque colours, 1..21. */
export function contrastRatio(a: string, b: string): number {
	const x = relativeLuminance(a),
		y = relativeLuminance(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function lab(hex: string): [number, number, number] {
	const [r, g, b] = toRgb(hex).map(linear) as Rgb;
	const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
		y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b,
		z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
	const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
	const fx = f(x),
		fy = f(y),
		fz = f(z);
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** CIE76 colour difference. Crude but monotone and cheap; thresholds are calibrated for it. */
export function colorDifference(a: string, b: string): number {
	const [l1, a1, b1] = lab(a),
		[l2, a2, b2] = lab(b);
	return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const CVD_MATRICES = {
	// Machado, Oliveira and Fernandes (2009), severity 1.0, applied to linear sRGB.
	protanopia: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	deuteranopia: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	tritanopia: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
} as const;
export type VisionModel = keyof typeof CVD_MATRICES | 'greyscale';
export const visionModels: readonly VisionModel[] = ['protanopia', 'deuteranopia', 'tritanopia', 'greyscale'];

/** The colour as seen under a colour-vision deficiency (or printed in greyscale). */
export function simulateVision(hex: string, model: VisionModel): string {
	const rgb = toRgb(hex).map(linear);
	if (model === 'greyscale') {
		const y = 0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0);
		const v = delinear(y);
		return toHex([v, v, v]);
	}
	const m = CVD_MATRICES[model];
	return toHex(m.map((row) => delinear(row[0] * (rgb[0] ?? 0) + row[1] * (rgb[1] ?? 0) + row[2] * (rgb[2] ?? 0))));
}

// ------------------------------------------------------------ catalog lookups

export type Lookup = (kind: CatalogKind, id: string) => Rec | undefined;

export function createLookup(
	document: Rec,
	extra?: Partial<Record<CatalogKind, readonly unknown[]>>,
): Lookup {
	return (kind, id) => {
		const inline = rec(rec(document.catalogs)[kind]).records;
		const found =
			(Array.isArray(inline) ? inline : []).find((r: Rec) => r?.id === id) ??
			(extra?.[kind] ?? []).find((r) => rec(r).id === id) ??
			(bundledCatalogs[kind] as readonly unknown[] | undefined)?.find((r) => rec(r).id === id);
		return found === undefined ? undefined : rec(found);
	};
}

function resolveReference(kind: CatalogKind, reference: unknown, lookup: Lookup): Rec {
	if (typeof reference === 'string') return lookup(kind, reference) ?? {};
	if (reference && typeof reference === 'object' && !Array.isArray(reference)) {
		const id = (reference as Rec).id;
		return { ...(typeof id === 'string' ? lookup(kind, id) : undefined), ...(reference as Rec) };
	}
	return {};
}

// ------------------------------------------------------------- design resolve

export interface BackdropGradient {
	kind: 'gradient';
	angle: number;
	stops: { color: string; position: number }[];
}
export type Backdrop =
	| { kind: 'solid'; color: string }
	| BackdropGradient
	| { kind: 'pattern'; colors: string[] }
	| { kind: 'image'; opacity: number; base: string };

export interface ResolvedDesign {
	theme: Rec;
	colorScheme: Rec;
	fontScheme: Rec;
	fonts: FontFamilies;
	dimensions: { width: number; height: number };
	/** The slide background after design resolution. */
	backdrop: Backdrop;
	/** The preview's choice: light text (`light1`) on a dark background colour, else the `text` role (`dark1`). */
	dark: boolean;
	colors: {
		background: string;
		surface: string;
		text: string;
		mutedText: string;
		primary: string;
		secondary: string;
		accent: string;
	};
	variables: Rec;
	/** A picture used as the slide background (the preview draws it behind everything), with the pointer of its `image` object. */
	backgroundImage?: { source: unknown; fit: 'cover' | 'contain' | 'tile'; path: string };
	/** Where the font scheme reference is written, for diagnostics. */
	fontSchemePath: string;
	unresolvedFontScheme?: string;
}

const PAGE = '#FFFFFF';
const colorFrom = (scheme: Rec, slot: unknown, fallback: string): string =>
	typeof slot === 'string' ? (slot.startsWith('#') ? (normalizeHexColor(slot) ?? fallback) : (normalizeHexColor(scheme[slot]) ?? fallback)) : fallback;

/**
 * The background the preview draws. Like the preview, a solid, gradient-stop or pattern colour is read as a literal hex colour
 * (anything else falls back: white, the scheme's light1 for a stop, the text colour for a pattern's foreground); opacity composites over white.
 */
function backdropOf(definition: unknown, scheme: Rec, text: string, variables: Rec): Backdrop {
	const resolve = (value: unknown, fallback: string) => backgroundColorRef(value, scheme, variables, fallback);
	const canvas = defaultSlideBackground(scheme);
	if (!definition) return { kind: 'solid', color: canvas };
	if (typeof definition === 'string') return { kind: 'solid', color: colorFrom(scheme, definition, canvas) };
	const bg = rec(definition),
		opacity = typeof bg.opacity === 'number' ? Math.max(0, Math.min(1, bg.opacity)) : 1;
	switch (bg.type) {
		case 'theme':
			return { kind: 'solid', color: blend(colorFrom(scheme, bg.slot, canvas), PAGE, opacity) };
		case 'solid':
			return { kind: 'solid', color: blend(resolve(bg.color, PAGE), PAGE, opacity) };
		case 'gradient': {
			const stops = (Array.isArray(rec(bg.gradient).stops) ? rec(bg.gradient).stops : []) as Rec[];
			return {
				kind: 'gradient',
				angle: Number(rec(bg.gradient).angle ?? 0),
				stops: stops.map((stop, index) => ({
					color: blend(resolve(stop.color, canvas), PAGE, opacity),
					position: typeof stop.position === 'number' ? stop.position : index / Math.max(1, stops.length - 1),
				})),
			};
		}
		case 'pattern': {
			const pattern = rec(bg.pattern);
			return {
				kind: 'pattern',
				colors: [
					blend(resolve(pattern.backgroundColor, PAGE), PAGE, opacity),
					blend(resolve(pattern.foregroundColor, text), PAGE, opacity),
				],
			};
		}
		case 'image':
			return { kind: 'image', opacity, base: PAGE };
		default:
			return { kind: 'solid', color: canvas };
	}
}

/**
 * A solid or pattern background colour: a literal, a `var:` variable, or a slot or role that does not depend on the
 * background itself (so the background, surface and text roles resolve through the scheme alone, as in the preview).
 */
function backgroundColorRef(value: unknown, scheme: Rec, variables: Rec, fallback: string): string {
	if (typeof value !== 'string') return fallback;
	const literal = normalizeHexColor(value);
	if (literal) return literal;
	const roles = resolveColorRoles(scheme);
	return resolveColorRef(value.trim(), {
		colorScheme: scheme,
		roles: { primary: roles.primary, secondary: roles.secondary, accent: roles.accent },
		variables,
		fallback,
	});
}

/**
 * The single colour the preview's text-colour choice reads: the resolved slide background of a theme, shortcut, solid or
 * pattern background, else undefined (no background, a picture or a gradient, which has no single colour), where the choice
 * falls back to the scheme's default slide background. Opacity is not applied. A solid or pattern colour is a ColorRef, resolved
 * like the preview does: a literal, a `var:` variable, a slot or a role that does not depend on the background itself.
 */
function decisionColor(definition: unknown, scheme: Rec, variables: Rec): string | undefined {
	if (!definition) return undefined;
	const canvas = defaultSlideBackground(scheme);
	const reference = (value: unknown) => backgroundColorRef(value, scheme, variables, PAGE);
	if (typeof definition === 'string') return colorFrom(scheme, definition, canvas);
	const bg = rec(definition);
	switch (bg.type) {
		case 'theme':
			return colorFrom(scheme, bg.slot, canvas);
		case 'solid':
			return reference(bg.color);
		case 'pattern':
			return reference(rec(bg.pattern).backgroundColor);
		default:
			return undefined;
	}
}

/**
 * Effective design of one slide: the same fields and the same defaults as the opf-render preview, including
 * its choice of text colour from the luminance of the background (a gradient background counts as light, as
 * the preview treats it).
 */
export function resolveDesign(document: Rec, slide: Rec, index: number, lookup: Lookup): ResolvedDesign {
	const deck = rec(document.design),
		own = rec(slide.design);
	const theme = resolveReference('themes', own.theme ?? deck.theme ?? 'minimal', lookup);
	const colorScheme = resolveReference(
		'colorSchemes',
		own.colorScheme ?? deck.colorScheme ?? theme.colorScheme ?? 'cool-horizon',
		lookup,
	);
	const fontPath =
		own.fontScheme !== undefined
			? `/slides/${index}/design/fontScheme`
			: deck.fontScheme !== undefined
				? '/design/fontScheme'
				: own.theme !== undefined
					? `/slides/${index}/design/theme`
					: '/design/theme';
	const font = resolveFontSchemeReference(
		own.fontScheme ?? deck.fontScheme ?? theme.fontScheme ?? DEFAULT_FONT_SCHEME,
		(id) => lookup('fontSchemes', id),
		fontPath,
	);
	let dimensions: ResolvedDesign['dimensions'];
	try {
		dimensions = resolveCanvasDimensions(own.dimensions ?? deck.dimensions ?? theme.dimensions);
	} catch {
		dimensions = resolveCanvasDimensions(undefined);
	}
	const variables = rec(document.variables);
	// The preview derives the dark/light decision from one colour, before any opacity: see decisionColor.
	const roles = resolveColorRoles(colorScheme, { background: decisionColor(own.background ?? deck.background ?? theme.background, colorScheme, variables) });
	const dark = roles.dark;
	const text = roles.text;
	const backdrop = backdropOf(own.background ?? deck.background ?? theme.background, colorScheme, text, variables);
	const definition = rec(own.background ?? deck.background ?? theme.background);
	const backgroundImage: ResolvedDesign['backgroundImage'] =
		definition.type === 'image' && own.background !== undefined
			? { source: rec(definition.image).src, fit: rec(definition.image).fit ?? 'cover', path: `/slides/${index}/design/background/image` }
			: definition.type === 'image' && deck.background !== undefined
				? { source: rec(definition.image).src, fit: rec(definition.image).fit ?? 'cover', path: '/design/background/image' }
				: undefined;
	return {
		theme,
		colorScheme,
		fontScheme: font.scheme,
		fonts: resolveFontFamilies(font.scheme),
		dimensions,
		backdrop,
		dark,
		colors: {
			background: roles.background,
			surface: roles.surface,
			text,
			mutedText: roles.textSecondary,
			primary: roles.primary,
			secondary: roles.secondary,
			accent: roles.accent,
		},
		variables,
		...(backgroundImage ? { backgroundImage } : {}),
		fontSchemePath: fontPath,
		...(font.diagnostic ? { unresolvedFontScheme: font.diagnostic.id } : {}),
	};
}

/** A text/background colour in a content run: the author's ColorRef resolved the way the preview resolves it. */
export function resolveTextColor(reference: unknown, design: ResolvedDesign, fallback: string): string | undefined {
	if (typeof reference !== 'string' || !reference.trim()) return undefined;
	const literal = normalizeHexColor(reference);
	if (literal) return literal;
	return resolveColorRef(reference.trim(), {
		colorScheme: design.colorScheme,
		roles: {
			primary: design.colors.primary,
			secondary: design.colors.secondary,
			accent: design.colors.accent,
			background: design.colors.background,
			surface: design.colors.surface,
			text: design.colors.text,
			textSecondary: design.colors.mutedText,
		},
		variables: design.variables,
		fallback,
	});
}

// --------------------------------------------------------------- backdrops

export interface BackdropSample {
	/** Opaque colours the text can sit on, worst candidates first not guaranteed. */
	colors: string[];
	/** True when the real backdrop depends on picture pixels core does not read, so `colors` bounds it. */
	unknown: boolean;
}

export interface SlideImageLayer {
	/** Overlay colour and opacity over the picture, when the slide image has a full-frame overlay. */
	overlay?: { color: string; opacity: number };
	opacity?: number;
}

const GREY_RAMP = [0, 32, 64, 96, 128, 160, 192, 224, 255].map((v) => toHex([v, v, v]));

/**
 * Backdrop colours under a text box. A gradient is sampled across the box using the preview's own gradient
 * geometry; a pattern contributes both of its colours; a picture is unknown, bounded by a grey ramp through
 * any full-frame overlay (so an overlay dark or opaque enough makes the contrast certain).
 */
export function backdropColors(
	backdrop: Backdrop,
	box: { x: number; y: number; width: number; height: number } | undefined,
	size: { width: number; height: number },
	layer?: SlideImageLayer,
): BackdropSample {
	switch (backdrop.kind) {
		case 'solid':
			return { colors: [backdrop.color], unknown: false };
		case 'pattern':
			return { colors: [...backdrop.colors], unknown: false };
		case 'gradient': {
			const stops = [...backdrop.stops].sort((a, b) => a.position - b.position);
			if (!stops.length) return { colors: [PAGE], unknown: false };
			const angle = (backdrop.angle * Math.PI) / 180,
				c = Math.cos(angle),
				s = Math.sin(angle),
				region = box ?? { x: 0, y: 0, width: size.width, height: size.height };
			const colors = new Set<string>();
			for (let i = 0; i <= 4; i++)
				for (let j = 0; j <= 4; j++) {
					const px = (region.x + (region.width * i) / 4) / size.width,
						py = (region.y + (region.height * j) / 4) / size.height,
						t = Math.max(0, Math.min(1, 0.5 + (px - 0.5) * c + (py - 0.5) * s));
					const after = stops.findIndex((stop) => stop.position >= t);
					if (after <= 0) colors.add(stops[Math.max(0, after)]?.color ?? PAGE);
					else {
						const lo = stops[after - 1]!,
							hi = stops[after]!,
							span = hi.position - lo.position || 1;
						colors.add(blend(hi.color, lo.color, (t - lo.position) / span));
					}
				}
			// Stops outside the sampled range are not under the text, so they are not included.
			return { colors: [...colors], unknown: false };
		}
		case 'image': {
			const opacity = layer?.opacity ?? backdrop.opacity;
			const colors = GREY_RAMP.map((grey) => {
				let color = blend(grey, backdrop.base, opacity);
				if (layer?.overlay) color = blend(layer.overlay.color, color, layer.overlay.opacity);
				return color;
			});
			return { colors, unknown: true };
		}
	}
}

/** Smallest contrast of `text` against every backdrop colour, with the colour that produced it. */
export function worstContrast(text: string, sample: BackdropSample): { ratio: number; against: string } {
	let worst = { ratio: Infinity, against: sample.colors[0] ?? PAGE };
	for (const color of sample.colors) {
		const ratio = contrastRatio(text, color);
		if (ratio < worst.ratio) worst = { ratio, against: color };
	}
	return worst;
}

/** A readable replacement for `preferred` over every backdrop colour: the theme text colour when it passes, else black or white. */
export function readableColor(candidates: readonly string[], sample: BackdropSample, minimum: number): string | undefined {
	for (const candidate of [...candidates, '#000000', '#FFFFFF'])
		if (worstContrast(candidate, sample).ratio >= minimum) return candidate;
	return undefined;
}

/**
 * The series palette opf-render and opf-pptx draw charts with (`CHART_COLORS`), in series order. A host with
 * its own palette passes `AuditOptions.chartPalette`.
 */
export const DEFAULT_CHART_PALETTE: readonly string[] = [
	'#2874A6', '#1B4F72', '#5499C7', '#7BDBB2', '#3AC67A', '#24A89E',
	'#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#0F172A', '#64748B',
];
