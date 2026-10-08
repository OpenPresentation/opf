import type { LayoutDiagnostic, SlideComposition, TextMeasurement } from './composition.js';
import type { Finding, FindingFix, FindingSeverity, FindingSuggestion } from './generated/types/finding.js';
import type { Payload, TextValue } from './rule-content.js';
import type { Rec, ResolvedDesign } from './rule-design.js';
import type {
	ValidateOptions,
	ValidationCategory,
	ValidationRuleCost,
	ValidationRuleInfo,
	ValidationThresholds,
} from './validation-types.js';

/**
 * One slide as the rules read it. Everything but the identity is computed on first read, so a run that never reads
 * `composition` (or `design`, or `rtl`) never pays for it: `validate(deck, { only: ['accessibility'] })` builds no layout
 * unless a rule of that category needs one.
 */
export interface RuleSlide {
	index: number;
	slide: Rec;
	/** JSON Pointer of the slide, `/slides/N`. */
	path: string;
	id?: string;
	readonly design: ResolvedDesign;
	readonly layout?: Rec;
	/** Absent when composition itself failed (`layoutError`). */
	readonly composition?: SlideComposition;
	/** composeSlide diagnostics (and strict-overflow failures, which are errors by the author's own setting). */
	readonly layoutDiagnostics: { diagnostic: LayoutDiagnostic; strict: boolean }[];
	readonly layoutError?: string;
	/** The text measurement composition used for this slide, when the host supplied one. */
	readonly measurement?: TextMeasurement;
	readonly payloads: Payload[];
	readonly texts: TextValue[];
	readonly rtl: boolean;
}

export interface FindingInput {
	path: string;
	message: string;
	help: string;
	slide?: RuleSlide;
	measured?: Finding['measured'];
	fixes?: FindingFix[];
	/** Severity for this finding when the rule is not reconfigured. */
	severity?: FindingSeverity;
	suggestions?: FindingSuggestion[];
}

export interface ValidationContext {
	document: Rec;
	slides: RuleSlide[];
	thresholds: ValidationThresholds;
	options: ValidateOptions;
	chartPalette: readonly string[];
	report(rule: ValidationRuleInfo, finding: FindingInput): Finding;
}

export interface ValidationRule {
	info: ValidationRuleInfo;
	/** Further rules this implementation can report; it runs when any of them is enabled. */
	also?: ValidationRuleInfo[];
	run(context: ValidationContext): void;
}

export const rule = (
	id: string,
	category: ValidationCategory,
	severity: FindingSeverity,
	summary: string,
	rationale: string,
	extra: Pick<ValidationRuleInfo, 'standard' | 'approximations' | 'thresholds'> & { cost?: ValidationRuleCost } = {},
): ValidationRuleInfo => ({ id: `opf/${id}`, name: id, category, severity, cost: extra.cost ?? 'structure', summary, rationale, ...extra });
