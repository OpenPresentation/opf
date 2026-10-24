/**
 * The plain-words text of every `opf/*` rule (VALIDATOR-HINTS sections 6 to 8): a function per rule id that writes `{ message, next }` from the finding
 * and the document. Internal module; `describeFinding` (`finding-text.ts`) dispatches here.
 */
import type { RuleText } from "./finding-text-util.js";

export const RULE_TEXT: Readonly<Record<string, RuleText>> = {};
