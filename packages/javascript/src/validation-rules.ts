import type { ValidationRule } from './rule-context.js';
import { accessibilityRules } from './rules-accessibility.js';
import { languageTagRules } from './rules-language.js';
import { layoutContentRules } from './rules-layout-content.js';

/**
 * The rule registry's implementations: the accessibility, layout and content rules that run a check, in report order.
 * The metadata of every rule (id, category, severity, rationale, standard) lives in `validation-rule-info.ts`, which does
 * not import them; everything it exports is re-exported here, so a host that runs `validate` imports from either.
 */
export {
	DEFAULT_VALIDATION_THRESHOLDS,
	findValidationRule,
	ruleDocumentation,
	ruleInfo,
	validationRules,
} from './validation-rule-info.js';

/** The rule implementations of the accessibility, layout and content categories, in report order. */
export const ruleImplementations: readonly ValidationRule[] = [...accessibilityRules, ...layoutContentRules, ...languageTagRules];
