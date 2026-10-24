/**
 * The plain-words text of every `opf/*` rule (VALIDATOR-HINTS sections 6 to 8): a function per rule id that writes `{ message, next }` from the finding
 * and the document. Internal module; `describeFinding` (`finding-text.ts`) dispatches here.
 *
 * The table is assembled from `finding-text-format.ts` (format, references, policy) and `finding-text-audit.ts` (accessibility, layout, content). A test
 * checks that every rule of the registry has an entry and that the table has none for a rule that does not exist.
 *
 * Every entry is wrapped so a finding that is not the shape core emits (a hand-built one, a sentence that changed) still gets text: core's own message
 * (American spelling) and a `next` from its help, never an exception and never a missing hint.
 */
import { AUDIT_TEXT } from "./finding-text-audit.js";
import { FORMAT_TEXT } from "./finding-text-format.js";
import { helpAsNext, keep } from "./finding-text-helpers.js";
import type { RuleText } from "./finding-text-util.js";

const GENERIC_NEXT = "check the rule's documentation for how to fix it.";

/** `handler`, falling back to the finding's own message and help when it declines, throws or returns an incomplete text. */
function safe(handler: RuleText): RuleText {
  return (finding, context, helpers) => {
    try {
      const text = handler(finding, context, helpers);
      if (text?.message && text.next) return text;
    } catch {
      // fall through to the plain text
    }
    return { message: keep(finding.message || "This finding has no message"), next: helpAsNext(finding, GENERIC_NEXT) };
  };
}

export const RULE_TEXT: Readonly<Record<string, RuleText>> = Object.freeze(
  Object.fromEntries(Object.entries({ ...FORMAT_TEXT, ...AUDIT_TEXT }).map(([id, handler]) => [id, safe(handler)])),
);
