import { OPFCompositionError, composeSlide, resolveFontFamilies, type LayoutDiagnostic, type SlideComposition, type TextMeasurement } from './composition.js';
import type { RuleSlide } from './rule-context.js';
import { pointer, slidePayloads, textValues } from './rule-content.js';
import { type Rec, resolveDesign } from './rule-design.js';
import { resolveScriptFonts } from './script-fonts.js';
import { slideScriptMeasurement } from './script-measurement.js';
import { resolveSlideContext } from './slide-context.js';
import type { ValidateOptions } from './validation-types.js';

/**
 * The slides the accessibility, layout and content rules read. Every derived part is computed on first use and
 * memoised, so composition (the expensive part, about 80 percent of a full run) happens only when a rule that
 * needs geometry runs. The composition options come from `resolveSlideContext`, the one resolution every engine
 * uses. Internal module.
 */

const measurementFor = (options: ValidateOptions, index: number): TextMeasurement | undefined => {
	const measurement = options.fonts?.textMeasurement;
	return typeof measurement === 'function' ? measurement(index) : measurement;
};

const lazy = <T>(compute: () => T): (() => T) => {
	let done = false;
	let value: T;
	return () => {
		if (!done) {
			value = compute();
			done = true;
		}
		return value;
	};
};

/** The same slide with every `overflow: "error"` relaxed, so geometry still exists when a strict composition fails. */
function relax<T>(value: T): T {
	const copy = JSON.parse(JSON.stringify(value)) as unknown;
	const walk = (node: unknown) => {
		if (Array.isArray(node)) return node.forEach(walk);
		if (node && typeof node === 'object') {
			const object = node as Rec;
			if (object.overflow === 'error') object.overflow = 'warn';
			for (const child of Object.values(object)) walk(child);
		}
	};
	walk(copy);
	return copy as T;
}

interface Composed {
	composition?: SlideComposition;
	layoutDiagnostics: { diagnostic: LayoutDiagnostic; strict: boolean }[];
	layoutError?: string;
}

export function buildSlides(document: Rec, options: ValidateOptions): RuleSlide[] {
	const slides = (Array.isArray(document.slides) ? document.slides : []) as Rec[];
	return slides.map((slide, index) => {
		const path = pointer('slides', index);
		// Core never consults a clock; a fixed date only lets `date: true` furniture be measured.
		const baseContext = lazy(() => resolveSlideContext(document, index, { catalogs: options.catalogs, date: '2000-01-01' }));
		// The host's measurement, planned per script run with the slide's script fonts as the engines measure it (opf#485).
		const measurement = lazy(() => {
			const host = measurementFor(options, index);
			if (!host) return undefined;
			const { resolved } = baseContext();
			return slideScriptMeasurement(document, index, host, { catalogs: options.catalogs, fontFamilies: resolveFontFamilies(resolved.fontScheme), serif: resolved.fontScheme.type === 'serif' });
		});
		const resolved = lazy(() => {
			const textMeasurement = measurement();
			const slideContext = baseContext();
			return textMeasurement ? { ...slideContext, options: { ...slideContext.options, textMeasurement } } : slideContext;
		});
		const design = lazy(() => resolveDesign(document, index, resolved()));
		const layout = lazy(() => resolved().options.layout as Rec | undefined);
		const composed = lazy((): Composed => {
			const result: Composed = { layoutDiagnostics: [] };
			const compose = (input: Rec, withLayout: Rec | undefined): SlideComposition => composeSlide(input, { ...resolved().options, layout: withLayout } as never);
			try {
				result.composition = compose(resolved().slide, layout());
				result.layoutDiagnostics.push(...result.composition.diagnostics.map((diagnostic: LayoutDiagnostic) => ({ diagnostic, strict: false })));
			} catch (error) {
				if (error instanceof OPFCompositionError) {
					result.layoutDiagnostics.push(...error.diagnostics.map((diagnostic) => ({ diagnostic, strict: true })));
					try {
						const relaxedLayout = layout();
						result.composition = compose(relax(resolved().slide), relaxedLayout ? relax(relaxedLayout) : undefined);
					} catch (second) {
						result.layoutError = second instanceof Error ? second.message : String(second);
					}
				} else result.layoutError = error instanceof Error ? error.message : String(error);
			}
			return result;
		});
		const payloads = lazy(() => slidePayloads(slide, path));
		const texts = lazy(() => textValues(slide, path));
		const rtl = lazy(() => {
			try {
				return resolveScriptFonts(document, { slideIndex: index }).rtl === true;
			} catch {
				// A language that cannot be resolved leaves the deck left to right, like the renderer.
				return false;
			}
		});
		const context = { index, slide, path, ...(typeof slide.id === 'string' ? { id: slide.id } : {}) };
		return Object.defineProperties(context, {
			design: { get: design, enumerable: true },
			layout: { get: layout, enumerable: true },
			composition: { get: () => composed().composition, enumerable: true },
			layoutDiagnostics: { get: () => composed().layoutDiagnostics, enumerable: true },
			layoutError: { get: () => composed().layoutError, enumerable: true },
			measurement: { get: measurement, enumerable: true },
			payloads: { get: payloads, enumerable: true },
			texts: { get: texts, enumerable: true },
			rtl: { get: rtl, enumerable: true },
		}) as unknown as RuleSlide;
	});
}
