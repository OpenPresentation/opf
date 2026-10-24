/**
 * Quick fixes for the schema findings that have an unambiguous repair, as RFC 6902 patches the host applies through its own undoable edit path
 * (`Finding.fixes`, kind `patch`): add a required property, change an enum value to the nearest allowed one, rename an unknown property to its near
 * miss, move it under `extensions`, wrap a string in a list, write a number as text, add the first slide. Never applied by core.
 *
 * Internal module: `validate` attaches them to `opf/schema` findings that carry no fixes of their own.
 */
import type { Finding, FindingFix, JsonPatchOperation } from "./generated/types/finding.js";
import { isRecord, nearest, pointerOf, readAt, segmentsOf } from "./finding-text-util.js";
import { starterValue } from "./finding-text.js";
import { schemaAtPath, schemaVariants } from "./schema-navigation.js";

/** The most "Change to ..." fixes one enum finding carries. */
const MAX_CHANGES = 5;

const patch = (id: string, title: string, operations: JsonPatchOperation[], safe = false): FindingFix => ({ id, title, kind: "patch", safe, patch: operations });

const allowsKey = (document: unknown, segments: string[], key: string): boolean => {
  try {
    return schemaVariants(schemaAtPath(document, segments)).some((variant) => Object.hasOwn((variant.properties ?? {}) as object, key));
  } catch {
    return false;
  }
};

/** The fixes of one `opf/schema` finding for `document`; empty when there is no unambiguous repair. */
export function schemaFixes(finding: Finding, document: unknown): FindingFix[] {
  const validation = finding.validation;
  if (finding.ruleId !== "opf/schema" || !validation) return [];
  const segments = segmentsOf(finding.path);
  const params = validation.params as Record<string, unknown>;
  switch (validation.keyword) {
    case "required": {
      const property = String(params.missingProperty ?? "");
      if (!property || !isRecord(readAt(document, segments)) || Object.hasOwn(readAt(document, segments) as object, property)) return [];
      const value = starterValue(document, segments, property);
      if (value === undefined) return [];
      return [patch(`add:${property}`, `Add \`${property}\``, [{ op: "add", path: pointerOf([...segments, property]), value }])];
    }
    case "enum": {
      const allowed = Array.isArray(params.allowedValues) ? (params.allowedValues as unknown[]) : [];
      if (!allowed.length || readAt(document, segments) === undefined) return [];
      const current = readAt(document, segments);
      const ranked = nearest(current, allowed, MAX_CHANGES);
      const values = [...new Set([...ranked.close, ...ranked.all])].slice(0, MAX_CHANGES);
      return values.map((value) => patch(`change-to:${String(value)}`, `Change to ${String(value)}`, [{ op: "replace", path: finding.path, value }]));
    }
    case "additionalProperties": {
      const name = String(params.additionalProperty ?? segments.at(-1) ?? "");
      const parent = segments.slice(0, -1);
      const owner = readAt(document, parent);
      if (!name || !isRecord(owner) || !Object.hasOwn(owner, name)) return [];
      const fixes: FindingFix[] = [];
      for (const suggestion of finding.suggestions ?? []) {
        const target = String(suggestion.value);
        if (!Object.hasOwn(owner, target)) fixes.push(patch(`rename-to:${target}`, `Rename to ${target}`, [{ op: "move", from: finding.path, path: pointerOf([...parent, target]) }]));
      }
      if (allowsKey(document, parent, "extensions") && name !== "extensions") {
        const existing = owner.extensions;
        if (existing === undefined) fixes.push(patch("move-to-extensions", "Move into extensions", [{ op: "add", path: pointerOf([...parent, "extensions"]), value: {} }, { op: "move", from: finding.path, path: pointerOf([...parent, "extensions", name]) }]));
        else if (isRecord(existing) && !Object.hasOwn(existing, name)) fixes.push(patch("move-to-extensions", "Move into extensions", [{ op: "move", from: finding.path, path: pointerOf([...parent, "extensions", name]) }]));
      }
      return fixes;
    }
    case "type": {
      const current = readAt(document, segments);
      if (current === undefined) return [];
      if (params.type === "array" && (typeof current === "string" || isRecord(current))) return [patch("wrap-in-list", "Wrap in a list", [{ op: "replace", path: finding.path, value: [current] }], typeof current === "string")];
      if (params.type === "string" && (typeof current === "number" || typeof current === "boolean")) return [patch("convert-to-string", "Convert to string", [{ op: "replace", path: finding.path, value: String(current) }], true)];
      return [];
    }
    case "oneOf":
    case "anyOf": {
      const current = readAt(document, segments);
      const forms = (validation.alternatives ?? []).map((entry) => String(entry).split(":")[0]?.trim());
      if (forms.includes("string") && (typeof current === "number" || typeof current === "boolean")) return [patch("convert-to-string", "Convert to string", [{ op: "replace", path: finding.path, value: String(current) }], true)];
      return [];
    }
    case "minItems":
      if (finding.path === "/slides" && Array.isArray(readAt(document, segments)) && params.limit === 1) return [patch("add-slide", "Add a slide", [{ op: "add", path: "/slides/0", value: { title: "Slide title" } }])];
      return [];
    default:
      return [];
  }
}
