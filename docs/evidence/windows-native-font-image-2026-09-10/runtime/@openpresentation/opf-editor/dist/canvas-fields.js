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
export function parseCanvasValue(text, type, original) {
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
  return type === 'string' && typeof original === 'string' ? preserveTextLineEndings(original,String(text)) : text;
}

/** Textareas normalize line endings; retain unchanged source bytes around an edit. */
export function preserveTextLineEndings(original, input) {
  const normalized=original.replace(/\r\n|\r/g,'\n'),next=input.replace(/\r\n|\r/g,'\n');
  if(normalized===next)return original;
  let prefix=0,suffix=0;
  while(prefix<normalized.length&&prefix<next.length&&normalized[prefix]===next[prefix])prefix++;
  while(suffix<normalized.length-prefix&&suffix<next.length-prefix&&normalized[normalized.length-1-suffix]===next[next.length-1-suffix])suffix++;
  const offsets=[0];
  for(let i=0;i<original.length;i++){if(original[i]==='\r'&&original[i+1]==='\n')i++;offsets.push(i+1);}
  const ending=/\r\n|\r|\n/.exec(original)?.[0]??'\n';
  return original.slice(0,offsets[prefix])+next.slice(prefix,next.length-suffix).replaceAll('\n',ending)+original.slice(offsets[normalized.length-suffix]);
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
