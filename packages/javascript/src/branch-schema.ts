/**
 * RR-93, CE-01: a `oneOf` / `anyOf` branch validated on its own. A branch's local references ('#/$defs/X') point at the schema
 * it was written in; `qualifyBranch` makes them absolute so the branch compiles as a schema of its own. The copy remembers the
 * node it came from, so an error found in the copy reports the schema object `validate` knows (`original`).
 * scripts/validators-codegen.mjs has the same function and qualifies the branches it precompiles the same way.
 */
const origin = new WeakMap<object, object>();

export function qualifyBranch(node: unknown, rootId: string): unknown {
	if (Array.isArray(node)) {
		const copy = node.map((item) => qualifyBranch(item, rootId));
		origin.set(copy, node);
		return copy;
	}
	if (node && typeof node === "object") {
		const copy: Record<string, unknown> = {};
		for (const [name, value] of Object.entries(node)) copy[name] = name === "$ref" && typeof value === "string" && value.startsWith("#") ? rootId + value : qualifyBranch(value, rootId);
		origin.set(copy, node);
		return copy;
	}
	return node;
}

/** The schema node a qualified copy was made from, or the node itself. */
export const original = (node: unknown): unknown => {
	let current = node;
	while (current && typeof current === "object" && origin.has(current)) current = origin.get(current);
	return current;
};
