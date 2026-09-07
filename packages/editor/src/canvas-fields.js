import {
  applyJsonPatch,
  createValuePatch,
  validateOpfDocument,
  splitOpfPath,
  opfPathToJsonPointer,
} from "./index.js";
/** Scalar fields and collection paths use JSON Pointer to preserve arbitrary object keys. */
export function getEditableFields(value, path) {
  const fields = [],
    arrays = [],
    root = splitOpfPath(path);
  const walk = (value, segments, labels) => {
    const path = opfPathToJsonPointer(segments),
      label = labels.join(" · ") || root.at(-1) || "Value";
    if (Array.isArray(value)) {
      arrays.push({ path, label, length: value.length });
      value.forEach((child, index) =>
        walk(
          child,
          [...segments, String(index)],
          [...labels, String(index + 1)],
        ),
      );
    } else if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value))
        walk(child, [...segments, key], [...labels, key]);
    else
      fields.push({
        path,
        label,
        type: value === null ? "null" : typeof value,
        value,
      });
  };
  walk(value, root, []);
  return { fields, arrays };
}
export function parseCanvasValue(text, type) {
  if (type === "number") {
    if (!String(text).trim() || !Number.isFinite(Number(text)))
      throw new Error("Enter a finite number.");
    return Number(text);
  }
  if (type === "boolean") return text === true || text === "true";
  if (type === "null") {
    if (text === "null") return null;
    throw new Error("This field must be null.");
  }
  return text;
}
export function createCanvasDraft(document, path, value) {
  const draft = applyJsonPatch(
    document,
    createValuePatch(document, path, value),
  );
  const validation = validateOpfDocument(draft);
  if (!validation.valid)
    throw new Error(
      validation.errors[0]?.message ?? "This change is not valid OPF.",
    );
  return draft;
}
