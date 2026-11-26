// A JSON value as a compact JavaScript expression that builds the same value, for generated reference tables that
// bundles carry (the MCP viewer reaches a client as one JSON-RPC message, where every byte of the script counts).
//
// Two things repeat in such tables: string values (a source URL on a hundred rows) and the key lists of objects (every
// row spells `family`, `licenseClass`, ...). The expression is an immediately invoked arrow function that names each
// repeated string once (`const s0 = "..."`) and builds each repeated object shape with a small function
// (`const o0 = (a, b) => ({ family: a, licenseClass: b })`), so a row is `o0(s0, "x")`. Every object is a fresh object
// literal with its keys in the source's order and every array a fresh array literal: only string values are shared,
// and strings are primitives, so the value built is the same as the plain literal's in every respect (`JSON.stringify`
// of both is identical, and nothing is aliased). `compactModuleExpression` proves that for each table it writes.
//
// Load time: a shape call costs about what the object literal does, but a named string inside an array or a one-off
// object literal turns a constant the engine copies from the literal's template into a store of its own. A table with
// thousands of such references (the preset geometry's path commands) loads measurably slower, so `strings: "arguments"`
// names a string only where it is an argument of a shape call and leaves it written out everywhere else.
//
// The arrow is marked pure, so a bundle that does not use the export drops it as it would a plain literal.

const RESERVED_KEYS = new Set(["__proto__"]);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * A compact expression for `value`. `typed` adds the parameter types a TypeScript module needs; `strings` is "all" to
 * name repeated strings wherever they appear, "arguments" to name them only as arguments of a shape call.
 */
export function compactExpression(value, { typed = true, strings: stringMode = "all" } = {}) {
  if (stringMode !== "all" && stringMode !== "arguments") throw new Error(`compact-literal: unknown strings mode ${JSON.stringify(stringMode)}.`);
  const shapes = new Map();
  const visitShapes = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) visitShapes(item);
    } else if (isPlainObject(node)) {
      const keys = Object.keys(node);
      for (const key of keys) {
        if (RESERVED_KEYS.has(key)) throw new Error(`compact-literal: the key ${JSON.stringify(key)} cannot be written as an object literal key.`);
        visitShapes(node[key]);
      }
      if (keys.length) {
        const id = JSON.stringify(keys);
        shapes.set(id, (shapes.get(id) ?? 0) + 1);
      }
    } else if (node !== null && typeof node !== "string" && typeof node !== "number" && typeof node !== "boolean") {
      throw new Error(`compact-literal: ${typeof node} is not a JSON value.`);
    }
  };
  visitShapes(value);

  // A shape function costs its keys once and three bytes a key for its parameters; keep only those that save bytes.
  const shapeNames = new Map();
  for (const [id, count] of shapes) {
    const keys = JSON.parse(id);
    const keyBytes = keys.reduce((sum, key) => sum + JSON.stringify(key).length, 0);
    if (count >= 2 && (count - 1) * keyBytes > keys.length * 3 + 12 + count) shapeNames.set(id, `o${shapeNames.size}`);
  }
  const shapeOf = (node) => (isPlainObject(node) ? shapeNames.get(JSON.stringify(Object.keys(node))) : undefined);

  // The strings that may be named: everywhere, or only the direct arguments of a shape call.
  const strings = new Map();
  const visitStrings = (node, isArgument) => {
    if (typeof node === "string") {
      if (stringMode === "all" || isArgument) strings.set(node, (strings.get(node) ?? 0) + 1);
    } else if (Array.isArray(node)) {
      for (const item of node) visitStrings(item, false);
    } else if (isPlainObject(node)) {
      const shaped = shapeOf(node) !== undefined;
      for (const key of Object.keys(node)) visitStrings(node[key], shaped);
    }
  };
  visitStrings(value, false);
  // A name costs about two bytes where it is used and its declaration about four more; keep only what saves bytes.
  const stringNames = new Map();
  for (const [text, count] of strings) {
    const literal = JSON.stringify(text).length;
    if (count >= 2 && (count - 1) * literal > 2 * count + 4) stringNames.set(text, `s${stringNames.size}`);
  }

  const write = (node, isArgument) => {
    if (Array.isArray(node)) return `[${node.map((item) => write(item, false)).join(",")}]`;
    if (isPlainObject(node)) {
      const keys = Object.keys(node);
      const shape = shapeOf(node);
      if (shape) return `${shape}(${keys.map((key) => write(node[key], true)).join(",")})`;
      return `{${keys.map((key) => `${JSON.stringify(key)}:${write(node[key], false)}`).join(",")}}`;
    }
    if (typeof node === "string") return ((stringMode === "all" || isArgument) && stringNames.get(node)) || JSON.stringify(node);
    return JSON.stringify(node);
  };

  const body = write(value, false);
  const declarations = [];
  if (stringNames.size) declarations.push(`const ${[...stringNames].map(([text, name]) => `${name}=${JSON.stringify(text)}`).join(",")};`);
  if (shapeNames.size) {
    const type = typed ? ": unknown" : "";
    const builders = [...shapeNames].map(([id, name]) => {
      const keys = JSON.parse(id);
      const params = keys.map((_key, index) => `p${index}`);
      return `${name}=(${params.map((param) => `${param}${type}`).join(",")})=>({${keys.map((key, index) => `${JSON.stringify(key)}:${params[index]}`).join(",")}})`;
    });
    declarations.push(`const ${builders.join(",")};`);
  }
  if (!declarations.length) return body;
  return `/* @__PURE__ */ (()=>{${declarations.join("")}return ${body};})()`;
}

/** The TypeScript type `value as const` has (readonly properties and tuples, literal types), for a compact expression's export. */
export function asConstType(value) {
  if (Array.isArray(value)) return `readonly [${value.map(asConstType).join(", ")}]`;
  if (isPlainObject(value)) return `{ ${Object.keys(value).map((key) => `readonly ${JSON.stringify(key)}: ${asConstType(value[key])};`).join(" ")} }`;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  throw new Error(`compact-literal: ${typeof value} is not a JSON value.`);
}

/**
 * The compact expression for a generated module, after proving that it builds the same value: evaluated here, it must
 * give the same `JSON.stringify` text as `value`, keys in the same order. The generator stops otherwise.
 */
export function compactModuleExpression(value, label, options = {}) {
  const built = new Function(`return ${compactExpression(value, { ...options, typed: false })};`)();
  if (JSON.stringify(built) !== JSON.stringify(value)) throw new Error(`compact-literal: the compact form of ${label} does not build the same value.`);
  return compactExpression(value, options);
}
