import type { FontFamilies, TextMeasurement } from './composition.js';
import { fontPolicyFor } from './font-policy.js';
import { isSymbolEncodedFamily } from './symbol-font-encodings.js';

/**
 * The role families a slide composes with when a host measures text (WI-1, P24): each role family resolves once through
 * the host's measurement (heading at weight 700, the others at 400), and composition then asks for the family the host
 * draws. With the renderer's fonts, Aptos Display becomes Intos Display, its open replacement, and a run at a weight that
 * face does not have (a metric value at 800, a quote at 600) draws its nearest weight, which the registry records as a
 * visual substitution. This is the resolution `toSvg` composes with, so `validate` and `paginate` measure the same slide
 * the renderer draws instead of failing on a weight the replacement lacks. Two kinds of family keep their own name, as
 * in the renderer: a family that names its weight (Arial Black, Segoe UI Semibold) resolves again on every run to its
 * replacement's encoded weight, and a symbol-encoded family (Symbol, Wingdings) keeps its encoding for the script planner.
 * Without a measurement that resolves styles the families are returned unchanged, and a family the host cannot resolve
 * keeps its name, so a run that uses it fails with the host's error and a slide that never draws it is not affected.
 */
export function resolveDrawnFontFamilies<T extends Partial<FontFamilies>>(families: T, measurement: TextMeasurement | undefined): T {
	const resolve = measurement?.resolveStyle;
	if (typeof resolve !== 'function') return families;
	const drawn: Record<string, unknown> = { ...families };
	for (const role of ['heading', 'body', 'code', 'accent'] as const) {
		const named = families[role];
		if (typeof named !== 'string' || !named) continue;
		let resolved: string;
		try {
			resolved = resolve.call(measurement, { fontFamily: named, fontWeight: role === 'heading' ? 700 : 400 }).fontFamily;
		} catch {
			// The host cannot draw this family: keep its name, so only a run that uses it fails, with the host's error.
			continue;
		}
		const keepsName = isSymbolEncodedFamily(named) || (fontPolicyFor(named)?.replacement?.weight !== undefined && resolved.toLowerCase() !== named.toLowerCase());
		drawn[role] = keepsName ? named : resolved;
	}
	return drawn as T;
}
