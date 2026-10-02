import { type Node, parseTree } from 'jsonc-parser';
import { catalogs as bundledCatalogs } from './catalogs.js';
import { OPFCompositionError, composeSlide, type LayoutDiagnostic, type SlideComposition } from './composition.js';
import { lintSource } from './lint.js';
import { resolveScriptFonts } from './script-fonts.js';
import { validatePresentation } from './validator.js';
import { accessibilityRules } from './audit-rules-a11y.js';
import type { AuditContext, AuditRule, FindingInput, SlideContext } from './audit-context.js';
import { pointer, slidePayloads, splitPointer, textValues } from './audit-content.js';
import { DEFAULT_CHART_PALETTE, type Rec, createLookup, rec, resolveDesign } from './audit-design.js';
import { designRules } from './audit-rules-design.js';
import type {
	AuditDiagnostic,
	AuditOptions,
	AuditReport,
	AuditRuleInfo,
	AuditSeverity,
	AuditThresholds,
} from './audit-types.js';
import type { LintLocation } from './lint.js';

export type {
	AuditCategory,
	AuditDiagnostic,
	AuditFix,
	AuditOptions,
	AuditPatchOperation,
	AuditReport,
	AuditRuleInfo,
	AuditSeverity,
	AuditThresholds,
} from './audit-types.js';
export { DEFAULT_CHART_PALETTE } from './audit-design.js';

/**
 * Design and accessibility audit of a presentation: contrast, overflow, minimum type size, alt text,
 * reading order, titles, fonts, links, charts, placeholders and more. Read-only and deterministic; no
 * network, clock or model. Each rule has a stable `audit/<name>` id (see docs/audit.md).
 */

export const DEFAULT_AUDIT_THRESHOLDS: Readonly<AuditThresholds> = Object.freeze({
	contrastNormal: 4.5,
	contrastLarge: 3,
	minFontSizePt: 11,
	maxWordsPerSlide: 120,
	maxFontFamilies: 3,
	minImagePpi: 96,
	titlePositionTolerance: 0.01,
	minSeriesColorDifference: 10,
});

const rules: readonly AuditRule[] = [...accessibilityRules, ...designRules];
const infos: AuditRuleInfo[] = rules.flatMap((entry) => [entry.info, ...(entry.also ?? [])]);

/** Every rule the audit can report, with its default severity, rationale and approximations, in report order. */
export const auditRules: readonly AuditRuleInfo[] = Object.freeze(infos.map((info) => Object.freeze({ ...info })));

const DOCS = 'https://github.com/OpenPresentation/opf/blob/main/docs/audit.md';
const severities: readonly string[] = ['error', 'warning', 'info'];

/** The rule a full id (`audit/text-contrast`) or bare name (`text-contrast`) names, or undefined. */
export function findAuditRule(name: string): AuditRuleInfo | undefined {
	return auditRules.find((info) => info.id === name || info.name === name);
}

function ruleFor(name: string, what: string): AuditRuleInfo {
	const found = findAuditRule(name);
	if (!found) throw new TypeError(`Unknown audit rule ${JSON.stringify(name)} in ${what}. Known rules: ${auditRules.map((info) => info.id).join(', ')}.`);
	return found;
}

interface Resolved {
	enabled: (info: AuditRuleInfo) => boolean;
	severity: (info: AuditRuleInfo) => AuditSeverity | undefined;
	ignorePaths: { rule: string | '*'; path: string[] }[];
	thresholds: AuditThresholds;
}

function resolveOptions(options: AuditOptions): Resolved {
	const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
	if (!object(options)) throw new TypeError('Audit options must be an object.');
	const allowed = ['rules', 'ignore', 'only', 'ignorePaths', 'thresholds', 'catalogs', 'textMeasurement', 'chartPalette'];
	for (const key of Object.keys(options)) if (!allowed.includes(key)) throw new TypeError(`Unknown audit option ${JSON.stringify(key)}. Options: ${allowed.join(', ')}.`);
	const severity = new Map<string, AuditSeverity | 'off'>();
	if (options.rules !== undefined) {
		if (!object(options.rules)) throw new TypeError('Audit rules must map rule ids to a severity or "off".');
		for (const [name, value] of Object.entries(options.rules)) {
			if (typeof value !== 'string' || (value !== 'off' && !severities.includes(value))) throw new TypeError(`Audit rule ${JSON.stringify(name)}: severity must be error, warning, info or off.`);
			severity.set(ruleFor(name, 'rules').id, value as AuditSeverity | 'off');
		}
	}
	const list = (value: unknown, what: string) => {
		if (value === undefined) return undefined;
		if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) throw new TypeError(`Audit ${what} must be an array of rule ids.`);
		return new Set(value.map((name) => ruleFor(name, what).id));
	};
	const ignore = list(options.ignore, 'ignore'),
		only = list(options.only, 'only');
	const ignorePaths: Resolved['ignorePaths'] = [];
	if (options.ignorePaths !== undefined) {
		if (!Array.isArray(options.ignorePaths)) throw new TypeError('Audit ignorePaths must be an array of {rule, path}.');
		for (const entry of options.ignorePaths) {
			if (!object(entry) || typeof entry.rule !== 'string' || typeof entry.path !== 'string' || (entry.path !== '' && !entry.path.startsWith('/')))
				throw new TypeError('Each audit ignorePaths entry needs a rule id (or "*") and a JSON Pointer path.');
			ignorePaths.push({ rule: entry.rule === '*' ? '*' : ruleFor(entry.rule, 'ignorePaths').id, path: splitPointer(entry.path) });
		}
	}
	const thresholds = { ...DEFAULT_AUDIT_THRESHOLDS } as AuditThresholds;
	if (options.thresholds !== undefined) {
		if (!object(options.thresholds)) throw new TypeError('Audit thresholds must be an object.');
		for (const [key, value] of Object.entries(options.thresholds)) {
			if (!(key in DEFAULT_AUDIT_THRESHOLDS)) throw new TypeError(`Unknown audit threshold ${JSON.stringify(key)}. Thresholds: ${Object.keys(DEFAULT_AUDIT_THRESHOLDS).join(', ')}.`);
			if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`Audit threshold ${key} must be a positive number.`);
			(thresholds as unknown as Record<string, number>)[key] = value;
		}
	}
	if (options.chartPalette !== undefined && (!Array.isArray(options.chartPalette) || !options.chartPalette.every((color) => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color))))
		throw new TypeError('Audit chartPalette must be an array of #RRGGBB colours.');
	return {
		enabled: (info) => severity.get(info.id) !== 'off' && !ignore?.has(info.id) && (!only || only.has(info.id)),
		severity: (info) => {
			const value = severity.get(info.id);
			return value === 'off' ? undefined : value;
		},
		ignorePaths,
		thresholds,
	};
}

const measurementFor = (options: AuditOptions, index: number) =>
	typeof options.textMeasurement === 'function' ? options.textMeasurement(index) : options.textMeasurement;

const slideCompositionOptions = (document: Rec, slide: Rec, index: number, count: number, design: ReturnType<typeof resolveDesign>, layout: Rec | undefined, options: AuditOptions) => {
	const merged = { ...rec(document.design), ...rec(slide.design) };
	return {
		...design.dimensions,
		layout,
		presentation: document,
		slideIndex: index,
		slideNumber: index + 1,
		slideCount: count,
		fonts: design.fonts,
		contentAlignment: merged.contentAlignment,
		titleAlignment: merged.titleAlignment,
		contentBox: merged.contentBox,
		textMeasurement: measurementFor(options, index),
		socialPlatforms: bundledCatalogs.socialPlatforms as never,
		// Core never consults a clock; a fixed date only lets `date: true` furniture be measured.
		date: '2000-01-01',
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

function buildSlides(document: Rec, options: AuditOptions): SlideContext[] {
	const lookup = createLookup(document, options.catalogs);
	const slides = (Array.isArray(document.slides) ? document.slides : []) as Rec[];
	return slides.map((slide, index) => {
		const design = resolveDesign(document, slide, index, lookup);
		const layout = typeof slide.layout === 'string' ? lookup('layouts', slide.layout) : undefined;
		const path = pointer('slides', index);
		const context: SlideContext = {
			index,
			slide,
			path,
			...(typeof slide.id === 'string' ? { id: slide.id } : {}),
			design,
			...(layout ? { layout } : {}),
			layoutDiagnostics: [],
			measurement: measurementFor(options, index),
			payloads: slidePayloads(slide, path),
			texts: textValues(slide, path),
			rtl: false,
		};
		try {
			context.rtl = resolveScriptFonts(document, { slideIndex: index }).rtl === true;
		} catch {
			// A language that cannot be resolved leaves the deck left to right, like the renderer.
		}
		const compose = (input: Rec, withLayout: Rec | undefined): SlideComposition =>
			composeSlide(input, slideCompositionOptions(document, input, index, slides.length, design, withLayout, options) as never);
		let composition: SlideComposition | undefined;
		try {
			composition = compose(slide, layout);
			context.layoutDiagnostics.push(...composition.diagnostics.map((diagnostic: LayoutDiagnostic) => ({ diagnostic, strict: false })));
		} catch (error) {
			if (error instanceof OPFCompositionError) {
				context.layoutDiagnostics.push(...error.diagnostics.map((diagnostic) => ({ diagnostic, strict: true })));
				try {
					composition = compose(relax(slide), layout ? relax(layout) : undefined);
				} catch (second) {
					context.layoutError = second instanceof Error ? second.message : String(second);
				}
			} else context.layoutError = error instanceof Error ? error.message : String(error);
		}
		if (composition) context.composition = composition;
		return context;
	});
}

function locator(source: string) {
	const tree = parseTree(source.startsWith('﻿') ? ` ${source.slice(1)}` : source, [], { disallowComments: true, allowTrailingComma: false });
	const lineStarts = [0];
	for (let i = 0; i < source.length; i++) {
		if (source[i] === '\r') {
			if (source[i + 1] === '\n') i++;
			lineStarts.push(i + 1);
		} else if (source[i] === '\n') lineStarts.push(i + 1);
	}
	const at = (offset: number, length: number): LintLocation => {
		let lo = 0,
			hi = lineStarts.length;
		while (lo + 1 < hi) {
			const mid = (lo + hi) >> 1;
			if ((lineStarts[mid] ?? 0) <= offset) lo = mid;
			else hi = mid;
		}
		return { offset, length, line: lo + 1, column: offset - (lineStarts[lo] ?? 0) + 1 };
	};
	return (path: string): LintLocation | undefined => {
		let node: Node | undefined = tree;
		const found: Node[] = [];
		for (const part of splitPointer(path)) {
			const next: Node | undefined =
				node?.type === 'array'
					? node.children?.[Number(part)]
					: node?.type === 'object'
						? node.children?.find((property) => property.children?.[0]?.value === part)?.children?.[1]
						: undefined;
			if (!next) break;
			node = next;
			found.push(next);
		}
		// A finding about a missing field is located at the object that lacks it.
		const target = found.length === splitPointer(path).length ? node : found[found.length - 1] ?? tree;
		return target ? at(target.offset, target.length) : undefined;
	};
}

function emptyReport(options: AuditOptions, thresholds: AuditThresholds): AuditReport {
	return {
		valid: true,
		documentValid: true,
		diagnostics: [],
		counts: { error: 0, warning: 0, info: 0 },
		rulesRun: [],
		slideCount: 0,
		thresholds,
		checks: { textMeasurement: options.textMeasurement !== undefined ? 'provided' : 'estimated', backgroundPixels: 'not-read', imageBytes: 'embedded-only', nativeExport: 'not-checked' },
	};
}

function auditObject(document: unknown, options: AuditOptions, locate?: (path: string) => LintLocation | undefined): AuditReport {
	const resolved = resolveOptions(options);
	const report = emptyReport(options, resolved.thresholds);
	const { diagnostics, counts } = report;
	const validation = validatePresentation(document);
	if (!validation.valid) {
		report.documentValid = false;
		for (const issue of validation.errors.slice(0, 50))
			diagnostics.push({
				ruleId: 'audit/invalid-document',
				severity: 'error',
				category: 'content',
				scope: 'document',
				path: issue.path === '/' ? '' : issue.path,
				message: `The document does not pass schema validation, so it was not audited: ${issue.message}`,
				help: 'Fix the document first (see `opf lint`), then audit again.',
				...(locate ? { location: locate(issue.path === '/' ? '' : issue.path) } : {}),
			});
		for (const diagnostic of diagnostics) counts[diagnostic.severity]++;
		report.valid = counts.error === 0;
		return report;
	}
	const doc = document as Rec;
	const slides = buildSlides(doc, options);
	const order = new Map(infos.map((info, index) => [info.id, index]));
	const context: AuditContext = {
		document: doc,
		slides,
		thresholds: resolved.thresholds,
		options,
		lookup: createLookup(doc, options.catalogs),
		chartPalette: options.chartPalette ?? DEFAULT_CHART_PALETTE,
		report(info: AuditRuleInfo, finding: FindingInput): AuditDiagnostic {
			const severity = resolved.severity(info) ?? finding.severity ?? info.severity;
			const diagnostic: AuditDiagnostic = {
				ruleId: info.id,
				severity,
				category: info.category,
				scope: 'document',
				path: finding.path,
				message: finding.message,
				help: finding.help,
				definition: `${DOCS}#${info.id.replace('/', '')}`,
				...(finding.slide ? { slide: finding.slide.index, ...(finding.slide.id ? { slideId: finding.slide.id } : {}) } : {}),
				...(finding.measured ? { measured: finding.measured } : {}),
				...(finding.fixes?.length ? { fixes: finding.fixes } : {}),
				...(finding.suggestions ? { suggestions: finding.suggestions } : {}),
			};
			if (!resolved.enabled(info)) return diagnostic;
			const parts = splitPointer(finding.path);
			const ignored = resolved.ignorePaths.some((entry) => (entry.rule === '*' || entry.rule === info.id) && entry.path.every((part, index) => parts[index] === part));
			if (!ignored) diagnostics.push(diagnostic);
			return diagnostic;
		},
	};
	const rulesRun: string[] = [];
	for (const entry of rules) {
		const all = [entry.info, ...(entry.also ?? [])];
		if (!all.some((info) => resolved.enabled(info))) continue;
		rulesRun.push(...all.filter((info) => resolved.enabled(info)).map((info) => info.id));
		entry.run(context);
	}
	diagnostics.sort((a, b) => (a.slide ?? -1) - (b.slide ?? -1) || (order.get(a.ruleId) ?? 0) - (order.get(b.ruleId) ?? 0) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
	if (locate) for (const diagnostic of diagnostics) {
		const location = locate(diagnostic.path);
		if (location) diagnostic.location = location;
	}
	for (const diagnostic of diagnostics) counts[diagnostic.severity]++;
	report.valid = counts.error === 0;
	report.rulesRun = rulesRun;
	report.slideCount = slides.length;
	return report;
}

/**
 * Audit a parsed presentation. A document that fails schema validation is not audited; its validation
 * errors come back as `audit/invalid-document` findings. Findings have lint's report shape (rule id,
 * severity, JSON Pointer path, message, help) plus `slide`, `measured` and suggested `fixes`.
 */
export function auditPresentation(document: unknown, options: AuditOptions = {}): AuditReport {
	return auditObject(document, options);
}

/** Audit JSON source text. Findings carry original-source UTF-16 ranges and one-based line/column, like `lintSource`. */
export function auditSource(source: string, options: AuditOptions = {}): AuditReport {
	const syntax = lintSource(source);
	if (syntax.schemaValid === null) {
		const report = emptyReport(options, resolveOptions(options).thresholds);
		report.documentValid = false;
		for (const diagnostic of syntax.diagnostics)
			report.diagnostics.push({
				ruleId: 'audit/invalid-document',
				severity: 'error',
				category: 'content',
				scope: 'document',
				path: diagnostic.path,
				message: `The source is not valid JSON, so it was not audited: ${diagnostic.message}`,
				help: diagnostic.help,
				...(diagnostic.location ? { location: diagnostic.location } : {}),
			});
		report.counts = { error: report.diagnostics.length, warning: 0, info: 0 };
		report.valid = false;
		return report;
	}
	return auditObject(JSON.parse(source.replace(/^﻿/, '')), options, locator(source));
}
