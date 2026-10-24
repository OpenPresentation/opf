/**
 * The plain-words text of the YAML and Markdown readers' findings (`yaml/*`, `markdown/*`; VALIDATOR-HINTS sections 9 and 10). Internal module;
 * `describeFinding` (`finding-text.ts`) dispatches here.
 */
import type { RuleText } from "./finding-text-util.js";

export const SOURCE_TEXT: Readonly<Record<string, RuleText>> = {};
import type { ExplainEntry } from "./finding-text-util.js";

/** What `explain` says about the readers' rules (`yaml/syntax`, `markdown/fence-unterminated`, ...), keyed by finding `ruleId`. */
export const SOURCE_EXPLAIN: Readonly<Record<string, ExplainEntry>> = {};
