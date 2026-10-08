import type { Catalog } from './catalog-refs.js';
import type { TextMeasurement } from './composition.js';
import type { FindingReport, FindingSeverity } from './generated/types/finding.js';
import type { JsonPrimitive } from './json.js';
import type { VariableValues } from './variables.js';

/**
 * The six questions core's `validate` asks. `format`, `references` and `policy` can produce errors by default;
 * `accessibility`, `layout` and `content` report warnings and info unless a host promotes them.
 */
export type ValidationCategory = 'format' | 'references' | 'policy' | 'accessibility' | 'layout' | 'content';

/** Every category, in report order. */
export const validationCategories: readonly ValidationCategory[] = Object.freeze([
	'format',
	'references',
	'policy',
	'accessibility',
	'layout',
	'content',
]);

/**
 * What a rule needs, which decides what it costs: `syntax` reads the JSON text, `structure` reads the document
 * alone, `composition` builds slide compositions (text fitting and geometry), the expensive part.
 */
export type ValidationRuleCost = 'syntax' | 'structure' | 'composition';

export interface ValidationRuleInfo {
	/** Stable `opf/<name>` id. */
	id: string;
	name: string;
	category: ValidationCategory;
	/** Default severity. Some findings of a rule differ from it and say so: see the rule's description. */
	severity: FindingSeverity;
	cost: ValidationRuleCost;
	summary: string;
	/** Why the rule exists. */
	rationale: string;
	/** The accessibility, format or print-preflight standard it follows, when there is one. */
	standard?: string;
	/** What the check cannot see or approximates. */
	approximations?: string;
	/** Threshold names (`ValidationThresholds`) the rule reads. */
	thresholds?: (keyof ValidationThresholds)[];
}

export interface ValidationThresholds {
	/** Minimum WCAG contrast ratio for normal text. WCAG 2.x AA: 4.5. */
	contrastNormal: number;
	/** Minimum ratio for large text (at least 18 pt, or 14 pt bold). WCAG 2.x AA: 3. */
	contrastLarge: number;
	/** Smallest rendered text size, in points, before `opf/min-font-size` reports. */
	minFontSizePt: number;
	/** Minimum effective pixels per inch of an embedded raster image at its displayed size. */
	minImagePpi: number;
	/** Smallest CIE76 colour difference between two chart series (after colour-vision simulation) before they count as confusable. */
	minSeriesColorDifference: number;
}

/** Explicit host policy: the values a field may take. Document metadata is never interpreted as policy. */
export interface Contract {
	/** JSON Pointer pattern; a complete '*' segment matches one path segment. */
	path: string;
	allowedValues: JsonPrimitive[];
	/** Default `error`. */
	severity?: FindingSeverity;
	message?: string;
	documentation?: string;
}

/**
 * What the layout rules read from a fonts handle (the object `loadFonts()` of the renderer returns): the host's
 * measured text widths. Without one, composition uses core's portable estimate. A function receives the zero-based
 * slide index, so a host can supply a script-aware measurement per slide.
 */
export interface ValidateFonts {
	textMeasurement?: TextMeasurement | ((slideIndex: number) => TextMeasurement | undefined);
}

export interface ValidateOptions {
	/**
	 * Run only these rules or categories: full ids (`opf/text-contrast`), bare names (`text-contrast`) or category
	 * names (`format`). `only: ['format']` costs what the schema check costs and builds no layout.
	 */
	only?: readonly string[];
	/** Rules or categories not to run (same names). */
	ignore?: readonly string[];
	/** Severity per rule or category, or `off`. A rule beats its category. Promotes or demotes; it never skips the check's cost. */
	severity?: Record<string, FindingSeverity | 'off'>;
	/**
	 * Suppress a rule (or `*`, or a category) below a JSON Pointer prefix, for one accepted exception, for example
	 * `{ rule: 'opf/text-contrast', path: '/slides/3' }`. A prefix matches whole path segments.
	 */
	ignorePaths?: readonly { rule: string; path: string }[];
	/** Catalogs the host registered, matched by source; the first is the host default for an omitted catalogs.default. Nothing is fetched. */
	catalogs?: readonly Catalog[];
	/** Host policy (category `policy`). */
	contracts?: readonly Contract[];
	thresholds?: Partial<ValidationThresholds>;
	/** The host's fonts. The layout rules use `fonts.textMeasurement`; see `ValidateFonts`. */
	fonts?: ValidateFonts;
	/** Chart series palette (opaque `#RRGGBB`), in the engine's order. Default: the palette opf-render and opf-pptx use. */
	chartPalette?: readonly string[];
	/** Check as a template (true) or a normal deck (false), overriding the root `template` marker. */
	template?: boolean;
	/** Values to fill variables with before checking, keyed by variable id. */
	values?: VariableValues;
}

export interface ValidationChecks {
	/** `checked` for text input (JSON syntax and duplicate keys), `not-applicable` for a parsed document. */
	syntax: 'checked' | 'not-applicable';
	schema: 'checked' | 'not-run';
	/** Content references, assets, datasets and citations, resolved against the document's catalogs groups and the registered catalogs. Nothing is fetched. */
	references: 'checked' | 'not-run';
	policy: 'checked' | 'not-run';
	accessibility: 'checked' | 'not-run';
	content: 'checked' | 'not-run';
	/**
	 * `not-run` when no layout rule ran, `estimated` when text widths are core's portable estimate, `measured` when the host
	 * passed `fonts.textMeasurement`.
	 */
	layout: 'not-run' | 'estimated' | 'measured';
	/** Text contrast is computed against solid, gradient and pattern backgrounds; picture pixels are never read. */
	backgroundPixels: 'not-read';
	/** Image resolution reads only embedded `data:` images; URLs are never fetched. */
	imageBytes: 'embedded-only';
	nativeExport: 'not-checked';
}

export interface ValidationReport extends FindingReport {
	/**
	 * Whether the document passes the schema and the semantic format checks. `null` when the text was not JSON, so no
	 * schema check could run. A required variable with no value does not make a document schema-invalid.
	 */
	schemaValid: boolean | null;
	checks: ValidationChecks;
	/** Documents that declare content variables or are templates: whether they were checked as a template. */
	template?: boolean;
	/** Documents that declare content variables or are templates: the required variables that have no value. */
	unfilledVariables?: string[];
}
