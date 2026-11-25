// opf#1438: the HSL gradient stops of an SVG picture in sRGB, shared by the PPTX export (Office's SVG reader paints an HSL stop black) and
// the renderer's PNG path (its rasterizer draws the slash-alpha and number-only forms black or not at all). Both convert the same forms
// to the same colors, so PowerPoint and the PNG preview draw what a browser draws from the SVG as written:
//
//   converted   the CSS Color 4 forms a browser draws: hsl() and hsla(), the legacy comma form (percentages, an optional alpha after a
//               fourth comma) and the modern space form (numbers or percentages, an optional alpha after a slash)
//   kept        a form a browser does not draw (commas mixed with spaces, a comma form without percentages) stays as written
//   alpha       an alpha below one is folded into the stop's stop-opacity, multiplied by the stop-opacity that applies (a style
//               declaration's over the stop's attribute, as in the cascade; a stylesheet rule's own)

const NUMBER = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const LEGACY_HSL = new RegExp(`^hsla?\\(\\s*(${NUMBER})(deg|grad|rad|turn)?\\s*,\\s*(${NUMBER})%\\s*,\\s*(${NUMBER})%\\s*(?:,\\s*(${NUMBER})(%?)\\s*)?\\)$`, 'i');
const MODERN_HSL = new RegExp(`^hsla?\\(\\s*(${NUMBER})(deg|grad|rad|turn)?\\s+(${NUMBER})%?\\s+(${NUMBER})%?\\s*(?:\\/\\s*(${NUMBER})(%?)\\s*)?\\)$`, 'i');
const OPACITY = new RegExp(`^\\s*(${NUMBER})(%?)\\s*$`, 'i');
const UNITS: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };
/** One CSS declaration of a list, with what surrounds it, so a rewrite keeps every other byte. */
const DECLARATION = /(^|;)(\s*)([-\w]+)(\s*:\s*)([^;]*?)(\s*(?:!important)?\s*)(?=;|$)/gi;

/** Reads a stop-color value: the sRGB color and alpha to write for it, or undefined to leave it as written. */
export type StopColorReader = (value: string) => { color: string; alpha: number } | undefined;

/** An HSL stop color: `{color: '#rrggbb', alpha}` for a form a browser draws (see the file comment), else undefined. */
export function hslStopColor(value: string): { color: string; alpha: number } | undefined {
	const match = LEGACY_HSL.exec(value.trim()) ?? MODERN_HSL.exec(value.trim());
	if (!match) return undefined;
	const degrees = Number(match[1]) * (UNITS[(match[2] ?? 'deg').toLowerCase()] ?? 1);
	if (!Number.isFinite(degrees)) return undefined;
	const hue = ((degrees % 360) + 360) % 360;
	const saturation = Math.min(100, Math.max(0, Number(match[3]))) / 100;
	const lightness = Math.min(100, Math.max(0, Number(match[4]))) / 100;
	const amplitude = saturation * Math.min(lightness, 1 - lightness);
	const channel = (offset: number) => {
		const k = (offset + hue / 30) % 12;
		const level = lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(level * 255).toString(16).padStart(2, '0');
	};
	const alpha = match[5] === undefined ? 1 : Math.min(1, Math.max(0, Number(match[5]) / (match[6] ? 100 : 1)));
	if (!Number.isFinite(alpha)) return undefined;
	return { color: '#' + channel(0) + channel(8) + channel(4), alpha };
}

/** A stop-opacity value (a number or a percentage, clamped to 0..1); undefined when it is not one. */
export function stopOpacityValue(value: string | undefined): number | undefined {
	const match = OPACITY.exec(value ?? '');
	return match ? Math.min(1, Math.max(0, Number(match[1]) / (match[2] ? 100 : 1))) : undefined;
}
const opacityText = (value: number) => String(Number(value.toFixed(4)));
const scaleOpacities = (css: string, factor: number) =>
	css.replace(DECLARATION, (whole, lead, space, property, colon, value, tail) => {
		const own = String(property).toLowerCase() === 'stop-opacity' ? stopOpacityValue(value) : undefined;
		return own === undefined ? whole : `${lead}${space}${property}${colon}${opacityText(own * factor)}${tail}`;
	});

/**
 * One declaration list (a style attribute, or the body of a stylesheet rule): its HSL stop-color in sRGB and, when that color carries an
 * alpha below one, the list's stop-opacity multiplied by it (or `inherited` times it added, `inherited` being the opacity the list overrides:
 * a stop's own attribute for its style attribute). `converted` is called for each conversion. Returns the list, the same string when
 * nothing converts.
 */
export function stopDeclarationList(css: string, converted: () => void, inherited = 1, color: StopColorReader = hslStopColor): string {
	let alpha = 1;
	const next = css.replace(DECLARATION, (whole, lead, space, property, colon, value, tail) => {
		if (String(property).toLowerCase() !== 'stop-color') return whole;
		const stop = color(value);
		if (!stop) return whole;
		converted();
		alpha = stop.alpha;
		return `${lead}${space}${property}${colon}${stop.color}${tail}`;
	});
	if (alpha >= 1) return next;
	let scaled = false;
	const withOpacity = next.replace(DECLARATION, (whole, lead, space, property, colon, value, tail) => {
		const own = String(property).toLowerCase() === 'stop-opacity' ? stopOpacityValue(value) : undefined;
		if (own === undefined) return whole;
		scaled = true;
		return `${lead}${space}${property}${colon}${opacityText(own * alpha)}${tail}`;
	});
	if (scaled) return withOpacity;
	const trimmed = next.replace(/\s*;?\s*$/, '');
	return `${trimmed}${trimmed ? ';' : ''}stop-opacity:${opacityText(inherited * alpha)}`;
}

/** A stylesheet: each rule's declaration list (stopDeclarationList). */
export function stopStylesheet(css: string, converted: () => void, color: StopColorReader = hslStopColor): string {
	return /stop-color/i.test(css) ? css.replace(/\{([^{}]*)\}/g, (_, body: string) => `{${stopDeclarationList(body, converted, 1, color)}}`) : css;
}

/**
 * A <stop>'s attributes ([name, value] pairs, values decoded, changed in place and returned): its stop-color attribute and its style
 * attribute's stop-color in sRGB, each alpha folded into the stop-opacity that applies to it (the style's beats the attribute's). A
 * stop-opacity attribute is added at the end when none applies.
 */
export function stopElementAttributes(pairs: [string, string][], converted: () => void, color: StopColorReader = hslStopColor): [string, string][] {
	const at = (key: string) => pairs.findIndex(([name]) => name === key);
	const styleIndex = at('style'), opacityIndex = at('stop-opacity');
	const attributeOpacity = opacityIndex < 0 ? 1 : (stopOpacityValue(pairs[opacityIndex]![1]) ?? 1);
	const style = styleIndex < 0 ? '' : pairs[styleIndex]![1];
	const styleSetsColor = /(?:^|;)\s*stop-color\s*:/i.test(style), styleSetsOpacity = /(?:^|;)\s*stop-opacity\s*:/i.test(style);
	if (styleIndex >= 0) pairs[styleIndex]![1] = stopDeclarationList(style, converted, attributeOpacity, color);
	const colorIndex = at('stop-color');
	const stop = colorIndex < 0 ? undefined : color(pairs[colorIndex]![1]);
	if (!stop) return pairs;
	converted();
	pairs[colorIndex]![1] = stop.color;
	// The style's own stop-color overrides the attribute (its alpha is the style's to fold); the style's stop-opacity is the one that applies.
	if (stop.alpha >= 1 || styleSetsColor) return pairs;
	if (styleSetsOpacity) pairs[styleIndex]![1] = scaleOpacities(pairs[styleIndex]![1], stop.alpha);
	else if (opacityIndex >= 0) pairs[opacityIndex]![1] = opacityText(attributeOpacity * stop.alpha);
	else pairs.push(['stop-opacity', opacityText(stop.alpha)]);
	return pairs;
}

const ATTRIBUTE = /(\s+)([^\s=/>]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;
const decode = (value: string) => value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi, (_, decimal, hex, name) =>
	decimal ? String.fromCodePoint(Number(decimal)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[String(name).toLowerCase()]!);
const encode = (value: string, quote: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&apos;');

/**
 * The text of an SVG document with its HSL gradient stops in sRGB (see the file comment): every <stop> start tag, every other element's
 * style attribute and every <style> element's rules. Text that holds no `hsl` is returned as it is, and so is text with nothing to convert.
 * `keep` leaves the HSL values it accepts as written: a reader that already draws a form keeps that form's bytes.
 */
export function svgHslStopsToSrgb(text: string, { keep }: { keep?: (value: string) => boolean } = {}): string {
	if (!/hsl/i.test(text)) return text;
	let changed = false;
	const converted = () => { changed = true; };
	const color: StopColorReader = keep ? (value) => (keep(value.trim()) ? undefined : hslStopColor(value)) : hslStopColor;
	const tag = (whole: string, name: string, rest: string) => {
		const attributes: { space: string; key: string; equals: string; quote: string; value: string }[] = [];
		for (const match of rest.matchAll(ATTRIBUTE)) attributes.push({ space: match[1]!, key: match[2]!, equals: match[3]!, quote: match[4] !== undefined ? '"' : "'", value: decode(match[4] ?? match[5] ?? '') });
		if (!attributes.some(({ key }) => key === 'style' || key === 'stop-color')) return whole;
		const local = name.slice(name.indexOf(':') + 1);
		const pairs: [string, string][] = attributes.map(({ key, value }) => [key, value]);
		const written = local === 'stop' ? stopElementAttributes(pairs, converted, color) : pairs.map(([key, value]): [string, string] => [key, key === 'style' ? stopDeclarationList(value, converted, 1, color) : value]);
		let index = 0;
		const body = rest.replace(ATTRIBUTE, (match, space: string, key: string, equals: string, double?: string) => {
			const quote = double !== undefined ? '"' : "'";
			const value = written[index++]![1];
			return value === decode(double ?? /=\s*'([^']*)'/.exec(match)?.[1] ?? '') ? match : `${space}${key}${equals}${quote}${encode(value, quote)}${quote}`;
		});
		const added = written.slice(attributes.length).map(([key, value]) => ` ${key}="${encode(value, '"')}"`).join('');
		const close = /\s*\/?>$/.exec(body)?.[0] ?? '';
		return `<${name}${body.slice(0, body.length - close.length)}${added}${close}`;
	};
	let out = text.replace(/<([A-Za-z_][\w.:-]*)(\s(?:"[^"]*"|'[^']*'|[^'">])*\/?>)/g, tag);
	out = out.replace(/(<(?:[A-Za-z_][\w.-]*:)?style\b[^>]*>)([\s\S]*?)(<\/(?:[A-Za-z_][\w.-]*:)?style>)/g, (_, open: string, css: string, close: string) =>
		open + css.replace(/(<!\[CDATA\[)([\s\S]*?)(\]\]>)|([^<]+)/g, (part, cdataOpen?: string, cdata?: string, cdataClose?: string, plain?: string) =>
			cdataOpen ? cdataOpen + stopStylesheet(cdata!, converted, color) + cdataClose : plain !== undefined ? stopStylesheet(plain, converted, color) : part) + close);
	return changed ? out : text;
}
