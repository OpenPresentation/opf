export class PatchError extends Error {}
// JSON numeric equality treats -0 and 0 as equal; object member order is irrelevant.
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => own(right, key) && equal(left[key], right[key]));
}
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export function tokens(pointer: unknown): string[] {
  if (typeof pointer !== "string" || (pointer !== "" && !pointer.startsWith("/")) || /~(?![01])/u.test(pointer)) {
    throw new PatchError("Expected a JSON Pointer (empty string or /path with ~0 and ~1 escapes).");
  }
  return pointer === "" ? [] : pointer.slice(1).split("/").map(key => key.replace(/~1/g, "/").replace(/~0/g, "~"));
}
function index(key: string, length: number, append = false): number {
  if (append && key === "-") return length;
  if (!/^(0|[1-9][0-9]*)$/.test(key)) throw new PatchError(`Invalid array index: ${key}`);
  const value = Number(key);
  if (!Number.isSafeInteger(value) || value >= length + (append ? 1 : 0)) throw new PatchError(`Array index out of bounds: ${key}`);
  return value;
}
export function lookup(document: unknown, parts: string[]): unknown {
  let value = document;
  for (const key of parts) {
    if (!value || typeof value !== "object") throw new PatchError(`Missing parent for ${key}`);
    if (Array.isArray(value)) value = value[index(key, value.length)];
    else {
      if (!own(value, key)) throw new PatchError(`Missing property: ${key}`);
      value = (value as Record<string, unknown>)[key];
    }
  }
  return value;
}
function change(document: unknown, parts: string[], mode: "add" | "replace" | "remove", value?: unknown): unknown {
  if (!parts.length) return mode === "remove" ? undefined : structuredClone(value);
  const parent = lookup(document, parts.slice(0, -1)), key = parts.at(-1)!;
  if (!parent || typeof parent !== "object") throw new PatchError("Target parent must be an object or array.");
  if (Array.isArray(parent)) {
    const at = index(key, parent.length, mode === "add");
    if (mode === "add") parent.splice(at, 0, structuredClone(value));
    else if (mode === "remove") parent.splice(at, 1);
    else parent[at] = structuredClone(value);
  } else {
    if (mode !== "add" && !own(parent, key)) throw new PatchError(`Missing property: ${key}`);
    if (mode === "remove") delete (parent as Record<string, unknown>)[key];
    // Define own data properties, including __proto__, without invoking prototype setters.
    else Object.defineProperty(parent, key, { value: structuredClone(value), enumerable: true, configurable: true, writable: true });
  }
  return document;
}

/** Apply an RFC 6902 transaction to a clone; callers validate before saving. */
export function applyPatch(document: unknown, patch: unknown): unknown {
  if (!Array.isArray(patch)) throw new PatchError("A JSON Patch must be an array of operations.");
  let result = structuredClone(document);
  for (const [i, operation] of patch.entries()) {
    try {
      if (!operation || typeof operation !== "object" || Array.isArray(operation)) throw new PatchError("Expected an operation object.");
      const parts = tokens(operation.path);
      switch (operation.op) {
        case "add": case "replace": case "test": {
          if (!own(operation, "value")) throw new PatchError(`${operation.op} requires value.`);
          if (operation.op === "test") {
            if (!equal(lookup(result, parts), operation.value)) throw new PatchError(`Test failed at ${operation.path}`);
          } else result = change(result, parts, operation.op, operation.value);
          break;
        }
        case "remove": result = change(result, parts, "remove"); break;
        case "move": case "copy": {
          const from = tokens(operation.from), value = structuredClone(lookup(result, from));
          if (operation.op === "move") {
            if (parts.length > from.length && from.every((key, j) => parts[j] === key)) throw new PatchError("Cannot move a value into its descendant.");
            if (equal(from, parts)) break;
            result = change(result, from, "remove");
          }
          result = change(result, parts, "add", value);
          break;
        }
        default: throw new PatchError(`Unknown operation: ${String(operation.op)}`);
      }
    } catch (error) {
      throw new PatchError(`Operation ${i}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}
