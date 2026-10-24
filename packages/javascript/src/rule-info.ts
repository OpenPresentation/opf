import type { FindingSeverity } from './generated/types/finding.js';
import type { ValidationCategory, ValidationRuleCost, ValidationRuleInfo } from './validation-types.js';

/** The factory of a rule's metadata (`ValidationRuleInfo`). Types only, so the rule tables can import it without any checker code. */
export const rule = (
	id: string,
	category: ValidationCategory,
	severity: FindingSeverity,
	summary: string,
	rationale: string,
	extra: Pick<ValidationRuleInfo, 'standard' | 'approximations' | 'thresholds'> & { cost?: ValidationRuleCost } = {},
): ValidationRuleInfo => ({ id: `opf/${id}`, name: id, category, severity, cost: extra.cost ?? 'structure', summary, rationale, ...extra });
