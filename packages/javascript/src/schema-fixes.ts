/**
 * Quick fixes for the schema findings that have an unambiguous repair, as RFC 6902 patches the host applies through its own undoable edit path
 * (`Finding.fixes`, kind `patch`): add a required property, change an enum value to the nearest allowed one, rename an unknown property to its near
 * miss, move it under `extensions`, wrap a string in a list, write a number as text, add the first slide. Never applied by core.
 *
 * Internal module: `validate` attaches them to `opf/schema` findings that carry no fixes of their own, and removedKeyRepair to the
 * findings of keys and values OPF 0.35 removed.
 */
import type { Finding, FindingFix, JsonPatchOperation } from "./generated/types/finding.js";
import { isRecord, nearest, pointerOf, readAt, segmentsOf } from "./finding-text-util.js";
import { starterValue } from "./finding-text.js";
import { schemaAtPath, schemaVariants } from "./schema-navigation.js";
import { REMOVED_DESIGN_KEYS } from "./design-hints.js";

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
      // The near misses first (an alias such as middle to center, an edit distance of two), then the values in the order the schema lists them.
      const values = [...new Set([...nearest(current, allowed, MAX_CHANGES).close, ...allowed])].slice(0, MAX_CHANGES);
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

/**
 * OPF 0.35: a removed design key (`contentDirection`, `chartPrimary`; REMOVED_DESIGN_KEYS) in a deck, slide, theme or layout `design`, a
 * layout region's removed `flow: "none"` or its removed `listColumns`: what replaced it, as the finding's help, and the safe fix (delete
 * the key; `none` becomes `max: 1`).
 * For `opf/schema` and `opf/catalog-record` findings, the document's own and its embedded records; undefined for any other finding.
 */
/** OPF 0.35: what replaced a layout region's `listColumns` (removedKeyRepair). */
export const REMOVED_LIST_COLUMNS = "OPF 0.35 removed the region key listColumns. Delete it: a list of more than 6 entries flows into up to three columns in any region without an arrangement (or with the numbered one) when that sets it at least as large as one column; a list payload's own columns (1, 2, 3 or \"auto\") still chooses.";
export function removedKeyRepair(finding: Finding, document: unknown): { help: string; fixes: FindingFix[] } | undefined {
  const validation = finding.validation;
  if (!validation || (finding.ruleId !== "opf/schema" && finding.ruleId !== "opf/catalog-record")) return undefined;
  const segments = segmentsOf(finding.path);
  if (validation.keyword === "additionalProperties") {
    const name = segments.at(-1) ?? "";
    if (name === "listColumns" && segments.at(-3) === "regions" && readAt(document, segments) !== undefined) return { help: REMOVED_LIST_COLUMNS, fixes: [patch("remove:listColumns", "Delete listColumns", [{ op: "remove", path: finding.path }], true)] };
    if (segments.at(-2) !== "design" || !Object.hasOwn(REMOVED_DESIGN_KEYS, name) || readAt(document, segments) === undefined) return undefined;
    return { help: REMOVED_DESIGN_KEYS[name]!, fixes: [patch(`remove:${name}`, `Delete design.${name}`, [{ op: "remove", path: finding.path }], true)] };
  }
  if (validation.keyword === "enum" && segments.at(-1) === "flow" && segments.at(-3) === "regions" && readAt(document, segments) === "none") {
    const parent = segments.slice(0, -1), region = readAt(document, parent);
    const help = 'OPF 0.35 removed flow "none": a region of one block says "max": 1 (blocks no region had room for still join it), and its flow is "auto", "grid", "row" or "column".';
    if (!isRecord(region) || (region.max !== undefined && region.max !== 1)) return { help, fixes: [] };
    return { help, fixes: [patch("use-max-1", "Write max 1 (a region of one block)", [{ op: "remove", path: finding.path }, { op: "add", path: pointerOf([...parent, "max"]), value: 1 }], true)] };
  }
  return undefined;
}
