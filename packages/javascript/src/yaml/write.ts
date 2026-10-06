// YAML writing for `@openpresentation/opf/yaml` (RR-56): canonical block-style YAML that reads back, in the strict
// dialect and in every YAML 1.1 and 1.2 reader, as exactly the same data. Internal module.
import { Document, isScalar, visit } from "yaml";
import type { Obj } from "../convert/shared.js";

/**
 * Strings a YAML 1.1 reader (PyYAML, Ruby, many editors) would read as something other than text, or that are
 * special in some reader: booleans (`yes`, `on`, `y`), null, numbers in any 1.1 notation, timestamps, sexagesimals
 * and the `=` and `<<` indicators. The core schema reads these as text, but quoting them costs nothing.
 */
const AMBIGUOUS: RegExp[] = [
  /^(?:y|n|yes|no|on|off|true|false|null|~|=|<<)$/i,
  /^[-+]?(?:0[0-7_]+|0b[01_]+|0x[0-9a-f_]+|[0-9][0-9_]*(?:\.[0-9_]*)?(?:e[-+]?[0-9]+)?|\.[0-9_]+(?:e[-+]?[0-9]+)?|\.inf)$/i,
  /^\.nan$/i,
  /^\d{4}-\d{1,2}-\d{1,2}(?:[Tt ].*)?$/,
  /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+(?:\.[0-9_]*)?$/,
];

export const isAmbiguous = (text: string): boolean => AMBIGUOUS.some((pattern) => pattern.test(text));

/** The canonical text of `value` (key order already applied by the caller), or undefined when no style reads back unchanged. */
export function writeCanonicalYaml(value: Obj, reads: (text: string) => unknown): string | undefined {
  const expected = JSON.stringify(value);
  for (const blockQuote of [true, false] as const) {
    const doc = new Document(value, { schema: "core" });
    visit(doc, {
      Scalar(_key, node) {
        if (isScalar(node) && typeof node.value === "string" && isAmbiguous(node.value)) node.type = "QUOTE_DOUBLE";
      },
    });
    const text = doc.toString({ indent: 2, lineWidth: 0, minContentWidth: 0, blockQuote, defaultStringType: "PLAIN", defaultKeyType: "PLAIN" });
    const out = text.endsWith("\n") ? text : `${text}\n`;
    let back: unknown;
    try {
      back = reads(out);
    } catch {
      continue;
    }
    if (JSON.stringify(back) === expected) return out;
  }
  return undefined;
}
