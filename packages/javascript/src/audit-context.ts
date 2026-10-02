import type { LayoutDiagnostic, SlideComposition, TextMeasurement } from './composition.js';
import type { AuditCategory, AuditDiagnostic, AuditFix, AuditOptions, AuditRuleInfo, AuditSeverity, AuditThresholds } from './audit-types.js';
import type { Payload, TextValue } from './audit-content.js';
import type { Lookup, Rec, ResolvedDesign } from './audit-design.js';

export interface SlideContext {
	index: number;
	slide: Rec;
	/** JSON Pointer of the slide, `/slides/N`. */
	path: string;
	id?: string;
	design: ResolvedDesign;
	layout?: Rec;
	/** Absent when composition itself failed (`layoutError`). */
	composition?: SlideComposition;
	/** composeSlide diagnostics (and strict-overflow failures, which are errors by the author's own setting). */
	layoutDiagnostics: { diagnostic: LayoutDiagnostic; strict: boolean }[];
	layoutError?: string;
	/** The text measurement composition used for this slide, when the host supplied one. */
	measurement?: TextMeasurement;
	payloads: Payload[];
	texts: TextValue[];
	rtl: boolean;
}

export interface FindingInput {
	path: string;
	message: string;
	help: string;
	slide?: SlideContext;
	measured?: AuditDiagnostic['measured'];
	fixes?: AuditFix[];
	/** Severity for this finding when the rule is not reconfigured (for example a strict overflow the author declared an error). */
	severity?: AuditSeverity;
	suggestions?: AuditDiagnostic['suggestions'];
}

export interface AuditContext {
	document: Rec;
	slides: SlideContext[];
	thresholds: AuditThresholds;
	options: AuditOptions;
	lookup: Lookup;
	chartPalette: readonly string[];
	report(rule: AuditRuleInfo, finding: FindingInput): AuditDiagnostic;
}

export interface AuditRule {
	info: AuditRuleInfo;
	/** Further rules this implementation can report; it runs when any of them is enabled. */
	also?: AuditRuleInfo[];
	run(context: AuditContext): void;
}

export const rule = (
	id: string,
	category: AuditCategory,
	severity: AuditSeverity,
	summary: string,
	rationale: string,
	extra: Pick<AuditRuleInfo, 'standard' | 'approximations' | 'thresholds'> = {},
): AuditRuleInfo => ({ id: `audit/${id}`, name: id, category, severity, summary, rationale, ...extra });
