import type { CatalogKind } from './catalogs.js';
import type { TextMeasurement } from './composition.js';
import type { LintDiagnostic, LintSeverity } from './lint.js';

/** Same three levels as `lintSource`. */
export type AuditSeverity = LintSeverity;
export type AuditCategory = 'accessibility' | 'design' | 'content';

/** One JSON Patch operation (RFC 6902 subset) a quick fix applies. Paths are JSON Pointers into the audited document. */
export interface AuditPatchOperation {
	op: 'add' | 'replace' | 'remove';
	path: string;
	value?: unknown;
}

/**
 * A suggested repair. Core never applies it: a host shows it and applies it through its own undoable edit path.
 * `focus` fixes only name the field the author must fill in; `patch` fixes are small, deterministic and leave
 * every unrelated field untouched.
 */
export interface AuditFix {
	/** Stable id within one diagnostic, such as `focus-alt` or `inherit-text-color`. */
	id: string;
	label: string;
	kind: 'patch' | 'focus';
	/** True when applying the fix cannot change the meaning of the content (a colour switched to a readable one, a field focused). */
	safe: boolean;
	patch?: AuditPatchOperation[];
	/** For `focus`: the JSON Pointer of the field to edit and a hint of what it is. */
	focus?: { path: string; field: 'alt' | 'title' | 'text' | 'link' | 'language' | 'fontSize'; value?: unknown };
}

export interface AuditDiagnostic extends LintDiagnostic {
	/** `audit/<rule>`; ids are stable across releases. */
	ruleId: string;
	/** Zero-based slide index when the finding belongs to one slide. */
	slide?: number;
	slideId?: string;
	category: AuditCategory;
	/** Measured values behind the finding (ratios, sizes, counts), for reporters and tests. */
	measured?: Record<string, number | string | boolean | null>;
	fixes?: AuditFix[];
}

export interface AuditThresholds {
	/** Minimum WCAG contrast ratio for normal text. WCAG 2.x AA: 4.5. */
	contrastNormal: number;
	/** Minimum ratio for large text (at least 18 pt, or 14 pt bold). WCAG 2.x AA: 3. */
	contrastLarge: number;
	/** Smallest rendered text size, in points, before `audit/min-font-size` reports. */
	minFontSizePt: number;
	/** Words on one slide above which `audit/slide-word-count` reports. */
	maxWordsPerSlide: number;
	/** Distinct font families across the deck above which `audit/font-family-count` reports. */
	maxFontFamilies: number;
	/** Minimum effective pixels per inch of an embedded raster image at its displayed size. */
	minImagePpi: number;
	/** Largest title offset between slides of the same layout, as a fraction of the slide width/height. */
	titlePositionTolerance: number;
	/** Smallest CIE76 colour difference between two chart series (after colour-vision simulation) before they count as confusable. */
	minSeriesColorDifference: number;
}

export interface AuditOptions {
	/** Per-rule severity, or `off`. Keys are full ids (`audit/text-contrast`) or the bare name (`text-contrast`). */
	rules?: Record<string, AuditSeverity | 'off'>;
	/** Rules not to run (full ids or bare names). */
	ignore?: readonly string[];
	/** When set, run only these rules (full ids or bare names). */
	only?: readonly string[];
	/**
	 * Suppress a rule below a JSON Pointer prefix, for one accepted exception, for example
	 * `{rule: 'audit/text-contrast', path: '/slides/3'}`. A prefix matches whole path segments.
	 */
	ignorePaths?: readonly { rule: string; path: string }[];
	thresholds?: Partial<AuditThresholds>;
	/** Loaded catalog records, consulted after the document's own `catalogs` and before the bundled ones. */
	catalogs?: Partial<Record<CatalogKind, readonly unknown[]>>;
	/**
	 * The host's measured fonts. Without it composition uses core's portable estimate; see docs/audit.md.
	 * A function receives the zero-based slide index, so a host can supply a script-aware measurement per slide.
	 */
	textMeasurement?: TextMeasurement | ((slideIndex: number) => TextMeasurement | undefined);
	/** Chart series palette (opaque `#RRGGBB`), in the engine's order. Default: the palette opf-render and opf-pptx use. */
	chartPalette?: readonly string[];
}

export interface AuditRuleInfo {
	/** Stable `audit/<name>` id. */
	id: string;
	name: string;
	category: AuditCategory;
	/** Default severity. */
	severity: AuditSeverity;
	summary: string;
	/** Why the rule exists. */
	rationale: string;
	/** The accessibility or design standard it follows, when there is one. */
	standard?: string;
	/** What the check cannot see or approximates. */
	approximations?: string;
	/** Threshold names (`AuditThresholds`) the rule reads. */
	thresholds?: (keyof AuditThresholds)[];
}

export interface AuditReport {
	/** True when no finding has severity `error` (the same meaning as lint's `valid`). */
	valid: boolean;
	/** False when the document failed schema validation, so no design rule was run. */
	documentValid: boolean;
	diagnostics: AuditDiagnostic[];
	counts: Record<AuditSeverity, number>;
	/** Rule ids that ran, in registry order. */
	rulesRun: string[];
	slideCount: number;
	thresholds: AuditThresholds;
	checks: {
		/** `estimated` unless the host supplied `textMeasurement`. */
		textMeasurement: 'estimated' | 'provided';
		/** Text contrast is computed against solid, gradient and pattern backgrounds; picture pixels are never read. */
		backgroundPixels: 'not-read';
		/** Image resolution reads only embedded `data:` images; URLs are never fetched. */
		imageBytes: 'embedded-only';
		nativeExport: 'not-checked';
	};
}
