import { catalogSchemaNames, type CatalogRecordKind } from './catalog-schemas.js';
import {
	checkDocumentOptions,
	contractFindings,
	engineFindings,
	issueFinding,
	issueRuleId,
	referenceFindings,
	variableFindings,
} from './check-document.js';
import { parseSource, type ParsedSource } from './check-source.js';
import type { Finding, FindingSeverity } from './generated/types/finding.js';
import type { Rec } from './rule-design.js';
import { splitPointer } from './rule-content.js';
import type { FindingInput, ValidationContext } from './rule-context.js';
import { validateAgainstSchema, type SchemaCheckResult } from './schema-check.js';
import { buildSlides } from './rule-slides.js';
import type { Presentation } from './types.js';
import {
	DEFAULT_VALIDATION_THRESHOLDS,
	findValidationRule,
	ruleImplementations,
	validationRules,
} from './validation-rules.js';
import {
	validationCategories,
	type ValidateOptions,
	type ValidationCategory,
	type ValidationChecks,
	type ValidationReport,
	type ValidationRuleInfo,
	type ValidationThresholds,
} from './validation-types.js';
import { DEFAULT_CHART_PALETTE } from './rule-design.js';

export { DEFAULT_CHART_PALETTE } from './rule-design.js';
export { DEFAULT_VALIDATION_THRESHOLDS, findValidationRule, validationRules } from './validation-rules.js';
export { validationCategories } from './validation-types.js';
export type {
	Contract,
	ValidateFonts,
	ValidateOptions,
	ValidationCategory,
	ValidationChecks,
	ValidationReport,
	ValidationRuleCost,
	ValidationRuleInfo,
	ValidationThresholds,
} from './validation-types.js';
export { promotedRegionKeys } from './schema-check.js';

/**
 * `validate(input, options?)`: one checker for an OPF presentation. It reads a parsed presentation or strict JSON text and
 * returns one list of findings, each with a stable `opf/<rule>` id, a severity and one of six categories:
 *
 * - `format`: is it well-formed OPF (JSON syntax, duplicate keys, schema and semantic rules);
 * - `references`: does everything it points at resolve (catalog ids, assets, citations, datasets);
 * - `policy`: does it follow the host's `contracts`;
 * - `accessibility`: WCAG 2.2 and PowerPoint accessibility checker rules;
 * - `layout`: will it present as authored (fit, minimum size, image resolution, fonts);
 * - `content`: is anything left unfinished (placeholder text, empty slides, non-numeric chart cells).
 *
 * Only `format`, `references` and `policy` produce errors by default, so `valid` keeps meaning "correct OPF". The check is read-only, local and deterministic: it fetches nothing,
 * reads no clock and calls no model. It is lazy: `only: ['format']` runs the schema check and builds no layout.
 */

const SEVERITIES: readonly string[] = ['error', 'warning', 'info'];
const OPTION_KEYS = ['only', 'ignore', 'severity', 'ignorePaths', 'catalogs', 'contracts', 'thresholds', 'fonts', 'chartPalette', 'template', 'values'];
const DOCS = 'https://github.com/OpenPresentation/opf/blob/main/docs/validate.md';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export class OPFValidationError extends Error {
	/** The full report that failed. */
	readonly report: ValidationReport;
	/** The error-severity findings of the report. */
	readonly findings: Finding[];

	constructor(report: ValidationReport) {
		const errors = report.findings.filter((entry) => entry.severity === 'error');
		const first = errors[0];
		super(first ? `OPF validation failed at ${first.path || '/'}: ${first.message}` : 'OPF validation failed');
		this.name = 'OPFValidationError';
		this.report = report;
		this.findings = errors;
	}
}

interface Names {
	rules: Set<string>;
	categories: Set<ValidationCategory>;
}

interface Resolved {
	options: ValidateOptions;
	enabled(info: ValidationRuleInfo): boolean;
	/** True when the rule was switched off by name (`ignore`, or severity `off`) rather than left out by `only`. */
	off(info: ValidationRuleInfo): boolean;
	severity(info: ValidationRuleInfo): FindingSeverity | undefined;
	ignored(info: ValidationRuleInfo, path: string[]): boolean;
	thresholds: ValidationThresholds;
	chartPalette: readonly string[];
}

function ruleFor(name: string, what: string): ValidationRuleInfo | ValidationCategory {
	if ((validationCategories as readonly string[]).includes(name)) return name as ValidationCategory;
	const found = findValidationRule(name);
	if (!found) throw new TypeError(`Unknown validation rule or category ${JSON.stringify(name)} in ${what}. Categories: ${validationCategories.join(', ')}. Rules: ${validationRules.map((info) => info.id).join(', ')}.`);
	return found;
}

function names(list: unknown, what: string): Names | undefined {
	if (list === undefined) return undefined;
	if (!Array.isArray(list) || !list.every((entry) => typeof entry === 'string')) throw new TypeError(`Validate ${what} must be an array of rule ids or category names.`);
	const result: Names = { rules: new Set(), categories: new Set() };
	for (const name of list) {
		const found = ruleFor(name, what);
		if (typeof found === 'string') result.categories.add(found);
		else result.rules.add(found.id);
	}
	return result;
}

function resolveOptions(options: ValidateOptions): Resolved {
	if (!isObject(options)) throw new TypeError('Validate options must be an object.');
	for (const key of Object.keys(options)) if (!OPTION_KEYS.includes(key)) throw new TypeError(`Unknown validate option ${JSON.stringify(key)}. Options: ${OPTION_KEYS.join(', ')}.`);
	checkDocumentOptions(options);
	const only = names(options.only, 'only');
	const ignore = names(options.ignore, 'ignore');
	const severity = new Map<string, FindingSeverity | 'off'>();
	if (options.severity !== undefined) {
		if (!isObject(options.severity)) throw new TypeError('Validate severity must map rule ids or category names to a severity or "off".');
		for (const [name, value] of Object.entries(options.severity)) {
			if (typeof value !== 'string' || (value !== 'off' && !SEVERITIES.includes(value))) throw new TypeError(`Validate severity for ${JSON.stringify(name)} must be error, warning, info or off.`);
			const found = ruleFor(name, 'severity');
			severity.set(typeof found === 'string' ? found : found.id, value as FindingSeverity | 'off');
		}
	}
	const ignorePaths: { match: (info: ValidationRuleInfo) => boolean; path: string[] }[] = [];
	if (options.ignorePaths !== undefined) {
		if (!Array.isArray(options.ignorePaths)) throw new TypeError('Validate ignorePaths must be an array of {rule, path}.');
		for (const entry of options.ignorePaths) {
			if (!isObject(entry) || typeof entry.rule !== 'string' || typeof entry.path !== 'string' || (entry.path !== '' && !entry.path.startsWith('/')))
				throw new TypeError('Each validate ignorePaths entry needs a rule id, category name or "*", and a JSON Pointer path.');
			const found = entry.rule === '*' ? '*' : ruleFor(entry.rule, 'ignorePaths');
			ignorePaths.push({
				match: (info) => found === '*' || (typeof found === 'string' ? found === info.category : found.id === info.id),
				path: splitPointer(entry.path),
			});
		}
	}
	const thresholds = { ...DEFAULT_VALIDATION_THRESHOLDS } as ValidationThresholds;
	if (options.thresholds !== undefined) {
		if (!isObject(options.thresholds)) throw new TypeError('Validate thresholds must be an object.');
		for (const [key, value] of Object.entries(options.thresholds)) {
			if (!(key in DEFAULT_VALIDATION_THRESHOLDS)) throw new TypeError(`Unknown validate threshold ${JSON.stringify(key)}. Thresholds: ${Object.keys(DEFAULT_VALIDATION_THRESHOLDS).join(', ')}.`);
			if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`Validate threshold ${key} must be a positive number.`);
			(thresholds as unknown as Record<string, number>)[key] = value;
		}
	}
	if (options.fonts !== undefined) {
		if (!isObject(options.fonts)) throw new TypeError('Validate fonts must be a fonts object with a textMeasurement.');
		const measurement = options.fonts.textMeasurement;
		if (measurement !== undefined && typeof measurement !== 'function' && !isObject(measurement)) throw new TypeError('Validate fonts.textMeasurement must be a text measurement, or a function of the slide index.');
	}
	if (options.chartPalette !== undefined && (!Array.isArray(options.chartPalette) || !options.chartPalette.every((color) => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color))))
		throw new TypeError('Validate chartPalette must be an array of #RRGGBB colours.');
	if (options.template !== undefined && typeof options.template !== 'boolean') throw new TypeError('Validate template must be true or false.');
	if (options.values !== undefined && !isObject(options.values)) throw new TypeError('Validate values must be an object keyed by variable id.');
	const level = (info: ValidationRuleInfo) => severity.get(info.id) ?? severity.get(info.category);
	const off = (info: ValidationRuleInfo) => level(info) === 'off' || !!ignore?.rules.has(info.id) || !!ignore?.categories.has(info.category);
	return {
		options,
		off,
		enabled: (info) => !off(info) && (!only || only.rules.has(info.id) || only.categories.has(info.category)),
		severity: (info) => {
			const value = level(info);
			return value === 'off' ? undefined : value;
		},
		ignored: (info, path) => ignorePaths.some((entry) => entry.match(info) && entry.path.every((part, index) => path[index] === part)),
		thresholds,
		chartPalette: options.chartPalette ?? DEFAULT_CHART_PALETTE,
	};
}

const order = new Map(validationRules.map((info, index) => [info.id, index]));
const categoryOrder = (category: string) => {
	const index = (validationCategories as readonly string[]).indexOf(category);
	return index < 0 ? validationCategories.length : index;
};

const auditInfos = ruleImplementations.flatMap((entry) => [entry.info, ...(entry.also ?? [])]);
const isLayoutRule = (info: ValidationRuleInfo) => info.category === 'layout' && info.cost === 'composition';

function slideOf(path: string): number | undefined {
	const match = /^\/slides\/(\d+)(?:\/|$)/.exec(path);
	return match ? Number(match[1]) : undefined;
}

function counts(findings: readonly Finding[]) {
	const result = { error: 0, warning: 0, info: 0 };
	for (const entry of findings) result[entry.severity]++;
	return result;
}

/** What each check did not do, in the report. Fixed facts of this checker; see docs/validate.md. */
const FIXED = { backgroundPixels: 'not-read', imageBytes: 'embedded-only', nativeExport: 'not-checked' } as const;

function syntaxReport(parsed: ParsedSource, run: Resolved): ValidationReport {
	const findings: Finding[] = [];
	for (const entry of parsed.syntax) {
		const info = findValidationRule(entry.ruleId);
		if (info && run.off(info)) continue;
		const severity = info ? run.severity(info) : undefined;
		findings.push(severity ? { ...entry, severity } : entry);
	}
	const checks: ValidationChecks = {
		syntax: 'checked',
		schema: 'not-run',
		references: 'not-run',
		policy: 'not-run',
		accessibility: 'not-run',
		content: 'not-run',
		layout: 'not-run',
		...FIXED,
	};
	const tally = counts(findings);
	return { valid: tally.error === 0, schemaValid: null, findings, counts: tally, checks };
}

function validateDocument(document: unknown, run: Resolved, parsed?: ParsedSource): ValidationReport {
	const engine = validateAgainstSchema(document, 'presentation', { template: run.options.template, values: run.options.values, ...(run.options.catalogs ? { catalogs: run.options.catalogs } : {}) });
	const schemaValid = engine.errors.length === 0;
	const slides = isObject(document) && Array.isArray(document.slides) ? document.slides : [];
	const auditWanted = auditInfos.some((info) => run.enabled(info));
	// A document the schema rejects is never audited. Say why instead of reporting nothing: its format errors are reported
	// whenever a rule that needed a valid document was asked for, unless the host switched them off.
	const explainFormat = !schemaValid && auditWanted;
	const enabledRule = (info: ValidationRuleInfo | undefined) => (info ? run.enabled(info) || (explainFormat && info.category === 'format' && !run.off(info)) : true);
	const findings: Finding[] = [];

	// format: the engine's errors and the coded warnings of every category (cheap; the schema check runs in any case).
	findings.push(...engineFindings(document, engine, (ruleId) => enabledRule(findValidationRule(ruleId))));
	if (enabledRule(findValidationRule('opf/variable-unfilled'))) findings.push(...variableFindings(document, engine, schemaValid));
	if (parsed) {
		findings.push(...parsed.duplicates.filter((entry) => enabledRule(findValidationRule(entry.ruleId))));
	}

	// references: a walk of the schema over the document; skipped unless a references rule is wanted.
	const referencesWanted = validationRules.some((info) => info.category === 'references' && run.enabled(info));
	if (referencesWanted) {
		findings.push(...referenceFindings(document, engine, run.options).filter((entry) => enabledRule(findValidationRule(entry.ruleId))));
	}

	// policy: the host's contracts.
	const contracts = run.options.contracts ?? [];
	const contractRule = findValidationRule('opf/contract');
	const policyRan = contracts.length > 0 && !!contractRule && enabledRule(contractRule);
	if (policyRan && contractRule) {
		findings.push(...contractFindings(document, contracts));
	}

	// accessibility, layout, content: only for a document that passes the format check; composition is built on first use.
	const auditRan = new Set<string>();
	if (schemaValid && auditWanted) {
		const doc = document as Rec;
		const context: ValidationContext = {
			document: doc,
			slides: buildSlides(doc, run.options),
			thresholds: run.thresholds,
			options: run.options,
			chartPalette: run.chartPalette,
			report(info: ValidationRuleInfo, input: FindingInput): Finding {
				const severity = run.severity(info) ?? input.severity ?? info.severity;
				const entry: Finding = {
					ruleId: info.id,
					severity,
					category: info.category,
					scope: 'document',
					path: input.path,
					message: input.message,
					help: input.help,
					definition: `${DOCS}#${info.id.replace('/', '')}`,
					...(input.slide ? { slide: input.slide.index, ...(input.slide.id ? { slideId: input.slide.id } : {}) } : {}),
					...(input.measured ? { measured: input.measured } : {}),
					...(input.fixes?.length ? { fixes: input.fixes } : {}),
					...(input.suggestions ? { suggestions: input.suggestions } : {}),
				};
				if (run.enabled(info)) findings.push(entry);
				return entry;
			},
		};
		for (const entry of ruleImplementations) {
			const all = [entry.info, ...(entry.also ?? [])];
			if (!all.some((info) => run.enabled(info))) continue;
			for (const info of all) if (run.enabled(info)) auditRan.add(info.id);
			entry.run(context);
		}
	}

	// Finish: severity overrides, exceptions by path, slide numbers, source ranges, order.
	const finished: Finding[] = [];
	for (const entry of findings) {
		const info = findValidationRule(entry.ruleId);
		const override = info ? run.severity(info) : undefined;
		const next: Finding = override && override !== entry.severity ? { ...entry, severity: override } : entry;
		if (info && run.ignored(info, splitPointer(next.path))) continue;
		const index = slideOf(next.path);
		if (next.slide === undefined && index !== undefined && next.scope !== 'context') {
			const id = isObject(slides[index]) ? (slides[index] as Rec).id : undefined;
			next.slide = index;
			if (typeof id === 'string') next.slideId = id;
		}
		if (parsed && next.location === undefined && next.scope !== 'context') {
			const location = parsed.locate(next.path);
			if (location) next.location = location;
		}
		finished.push(next);
	}
	finished.sort(
		(a, b) =>
			(a.slide ?? -1) - (b.slide ?? -1) ||
			categoryOrder(a.category) - categoryOrder(b.category) ||
			(order.get(a.ruleId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.ruleId) ?? Number.MAX_SAFE_INTEGER),
	);

	const tally = counts(finished);
	const ranCategory = (category: ValidationCategory) => auditInfos.some((info) => info.category === category && auditRan.has(info.id));
	const layoutRan = auditInfos.some((info) => isLayoutRule(info) && auditRan.has(info.id));
	const checks: ValidationChecks = {
		syntax: parsed ? 'checked' : 'not-applicable',
		schema: 'checked',
		references: referencesWanted ? 'checked' : 'not-run',
		policy: policyRan ? 'checked' : 'not-run',
		accessibility: ranCategory('accessibility') ? 'checked' : 'not-run',
		content: ranCategory('content') ? 'checked' : 'not-run',
		layout: layoutRan || ranCategory('layout') ? (run.options.fonts?.textMeasurement !== undefined ? 'measured' : 'estimated') : 'not-run',
		...FIXED,
	};
	return {
		valid: tally.error === 0,
		schemaValid,
		findings: finished,
		counts: tally,
		checks,
		...(engine.template !== undefined ? { template: engine.template, unfilledVariables: engine.unfilledVariables } : {}),
	};
}

/**
 * Check a presentation. `input` is a parsed presentation (an object) or the text of one, which is read as strict JSON and nothing
 * else: syntax errors and duplicate keys come back with line and column, and findings carry the range of the value they are
 * about. YAML and Markdown go through `fromYaml` and `fromMarkdown`, which call this for you.
 *
 * Never throws for a bad document, only for bad options (a `TypeError` naming the unknown rule, threshold or option, so a
 * typo cannot silently disable a check).
 */
export function validate(input: unknown, options: ValidateOptions = {}): ValidationReport {
	const run = resolveOptions(options);
	if (typeof input === 'string') {
		const parsed = parseSource(input);
		return parsed.syntax.length ? syntaxReport(parsed, run) : validateDocument(parsed.value, run, parsed);
	}
	return validateDocument(input, run);
}

/**
 * Throw `OPFValidationError` (carrying the `report`) unless `validate(value, options)` is valid; afterwards TypeScript
 * knows `value` is a `Presentation`. It takes a parsed value, not text. Pass `{ only: ['format'] }` for the cheap check.
 */
export function assertValid(value: unknown, options: ValidateOptions = {}): asserts value is Presentation {
	if (typeof value === 'string') throw new TypeError('assertValid takes a parsed presentation. Use validate(text) for JSON text.');
	const report = validate(value, options);
	if (!report.valid) throw new OPFValidationError(report);
}

/**
 * Check one published catalog record file (an audience, theme, layout, font scheme, chart type and so on) against its
 * companion schema, `$schema` and `id` included. The report has the same shape as `validate`'s; every finding is `format`.
 * A record a document embeds is checked by `validate`, keyed by its id and without `$schema`.
 */
export function validateCatalogRecord(kind: CatalogRecordKind, value: unknown): ValidationReport {
	const kinds = Object.keys(catalogSchemaNames);
	if (!kinds.includes(kind)) throw new TypeError(`Unknown catalog kind ${JSON.stringify(kind)}. Kinds: ${kinds.join(', ')}.`);
	const engine: SchemaCheckResult = validateAgainstSchema(value, kind);
	const findings: Finding[] = engine.errors.map((issue) => issueFinding(issue, issueRuleId(issue), engine.schemaName));
	const tally = counts(findings);
	const checks: ValidationChecks = {
		syntax: 'not-applicable',
		schema: 'checked',
		references: 'not-run',
		policy: 'not-run',
		accessibility: 'not-run',
		content: 'not-run',
		layout: 'not-run',
		...FIXED,
	};
	return { valid: tally.error === 0, schemaValid: engine.valid, findings, counts: tally, checks };
}

export function assertValidCatalogRecord(kind: CatalogRecordKind, value: unknown): void {
	const report = validateCatalogRecord(kind, value);
	if (!report.valid) throw new OPFValidationError(report);
}
