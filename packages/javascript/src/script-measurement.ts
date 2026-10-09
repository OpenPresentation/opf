import type { Catalog } from './catalog-refs.js';
import type { FontFamilies, TextMeasurement, TextStyle } from './composition.js';
import { resolveScriptFonts, type ResolvedScriptFonts, type ScriptFontSlots, type ScriptMeasurementProfile } from './script-fonts.js';

/**
 * The script-aware measurement of one slide (opf#485). A host measurement measures a string in the one face its style
 * names, so Arabic text in a Latin title face is a missing glyph. The engines never measure that way: the renderer
 * plans each script run of a string in its script slot's face (the slide's `resolveScriptFonts` profile, and a run
 * language's own profile for a run with `TextRun.lang`), and the exporter does the same. A host measurement that can
 * plan (`forScripts`, the renderer's `loadFonts()` measurement) is asked for exactly that plan here, so core's layout
 * checks measure what preview and export draw. A measurement without `forScripts` is returned unchanged. Internal
 * module.
 */

export interface SlideScriptMeasurementOptions {
	catalogs?: readonly Catalog[];
	/** The slide's role families (the resolved font scheme's), which name the latin slots. */
	fontFamilies: Pick<FontFamilies, 'heading' | 'body'>;
	/** The slide's font scheme is a serif scheme. */
	serif: boolean;
}

/** The profile a planner reads: a slot that repeats the latin family (`latin`, `schemeFamily`) names the slide's role family. */
function scriptProfile(presentation: unknown, slideIndex: number, options: SlideScriptMeasurementOptions, language?: string): ScriptMeasurementProfile {
	let resolved: ResolvedScriptFonts | undefined;
	try {
		resolved = resolveScriptFonts(presentation, { slideIndex, ...(options.catalogs !== undefined ? { catalogs: options.catalogs } : {}), ...(language === undefined ? {} : { language }) });
	} catch {
		// A language that cannot be resolved plans every script in the design font, like the renderer.
		resolved = undefined;
	}
	const slots = (role: 'heading' | 'body'): ScriptFontSlots => {
		const latin = options.fontFamilies[role];
		const slot = (key: 'eastAsian' | 'complexScript') => (!resolved || resolved.sources[key] === 'latin' || resolved.sources[key] === 'schemeFamily' ? latin : (resolved[role][key] ?? latin));
		return { latin, eastAsian: slot('eastAsian'), complexScript: slot('complexScript') };
	};
	return {
		heading: slots('heading'),
		body: slots('body'),
		...(resolved?.supplement ? { supplement: resolved.supplement } : {}),
		script: resolved?.script ?? 'Zzzz',
		...(resolved ? { scriptRole: resolved.scriptRole, bcp47: resolved.bcp47, lang: resolved.lang, languageSource: resolved.languageSource, direction: resolved.direction } : {}),
		rtl: resolved?.rtl === true,
		serif: options.serif,
	};
}

export function slideScriptMeasurement(presentation: unknown, slideIndex: number, measurement: TextMeasurement, options: SlideScriptMeasurementOptions): TextMeasurement {
	const forScripts = measurement.forScripts;
	if (typeof forScripts !== 'function') return measurement;
	const deckProfile = scriptProfile(presentation, slideIndex, options);
	const deck = forScripts.call(measurement, deckProfile);
	// A run whose own language (`style.lang`) differs from the slide's is planned with that language's slots (the
	// Japanese face for Han text in a Chinese deck, the Arabic slot for an ar-SA run in an en-US deck).
	const languages = new Map<string, TextMeasurement | undefined>();
	const forLanguage = (lang: string | undefined): TextMeasurement | undefined => {
		if (typeof lang !== 'string' || !lang) return undefined;
		if (!languages.has(lang)) {
			let own: TextMeasurement | undefined;
			try {
				const profile = scriptProfile(presentation, slideIndex, options, lang);
				own = profile.languageSource === 'option' && profile.bcp47?.toLowerCase() !== deckProfile.bcp47?.toLowerCase() ? forScripts.call(measurement, profile) : undefined;
			} catch {
				own = undefined;
			}
			languages.set(lang, own);
		}
		return languages.get(lang);
	};
	const pick = (style: TextStyle) => forLanguage(style?.lang) ?? deck;
	const scripted: TextMeasurement = { ...deck, measure: (text, size, style) => pick(style).measure(text, size, style) };
	// A provider's methods may live on its prototype, which the spread drops: call them on their own receiver.
	if (typeof deck.resolveStyle === 'function') scripted.resolveStyle = (style) => (deck.resolveStyle as NonNullable<TextMeasurement['resolveStyle']>).call(deck, style);
	if (typeof deck.outlineBounds === 'function')
		scripted.outlineBounds = (text, size, style) => {
			const own = pick(style);
			return typeof own.outlineBounds === 'function' ? own.outlineBounds(text, size, style) : (deck.outlineBounds as NonNullable<TextMeasurement['outlineBounds']>).call(deck, text, size, style);
		};
	return scripted;
}
