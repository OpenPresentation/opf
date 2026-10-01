// Helpers shared by the dimension switches, the design options, the block conversions and the
// table options: the error constructor, structural equality and the design-key patch rules.
import { OPFEditorError, applyJsonPatch, getValueAtPath, opfPathToJsonPointer, validateOpfDocument } from "./index.js";

export function fail(code, message, details) {
  return new OPFEditorError(code, message, details);
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

/** Structural equality that ignores object key order. */
export function same(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

// Set (value) or remove (null) design keys at deck or slide scope.
export function designPatches(document, base, entries) {
  const design = getValueAtPath(document, base.length ? [...base, "design"] : ["design"]);
  const at = (key) => opfPathToJsonPointer([...base, "design", key]);
  const set = Object.entries(entries).filter(([, value]) => value !== undefined && value !== null);
  if (!design || typeof design !== "object" || Array.isArray(design))
    return set.length ? [{ op: "add", path: opfPathToJsonPointer([...base, "design"]), value: structuredClone(Object.fromEntries(set)) }] : [];
  const patches = [];
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) continue;
    const present = Object.hasOwn(design, key);
    if (value === null) {
      if (present) patches.push({ op: "remove", path: at(key) });
    } else if (!present) patches.push({ op: "add", path: at(key), value: structuredClone(value) });
    else if (!same(design[key], value)) patches.push({ op: "replace", path: at(key), value: structuredClone(value) });
  }
  return patches;
}

/**
 * Validate a candidate patch the way every switch does: the result must be valid OPF unless the
 * input document was already invalid (then nothing new may be reported as the cause).
 */
export function checkedDocument(document, patches, before) {
  const next = patches.length ? applyJsonPatch(document, patches) : document;
  if (patches.length) {
    const validation = validateOpfDocument(next);
    if (!validation.valid && before.valid)
      throw fail("invalid-opf-edit", validation.errors[0]?.message ?? "This change produces an invalid document.", { issues: validation.errors, patches });
  }
  return next;
}
