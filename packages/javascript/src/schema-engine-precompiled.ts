import type { ValidateFunction } from "ajv/dist/2020.js";

import { branchValidators, definitionValidators, rootValidators } from "./generated/precompiled-validators.js";
import type { SchemaEngine } from "./schema-engine.js";
import { schemas, type SchemaName } from "./schemas.js";

/**
 * The precompiled build of the schema engine (CE-01): the `workerd`, `worker`, `edge-light` and `browser` conditions of
 * `#schema-engine`. The validators are Ajv's standalone output, generated at build time by scripts/validators-codegen.mjs from the
 * same schemas, options and formats as `schema-engine-ajv.ts`; nothing here compiles code, so it runs where `new Function` is
 * refused. An error's `parentSchema` is the object in `schemas`, as in the Ajv build.
 */
let branches: WeakMap<object, ValidateFunction> | undefined;

/** The branch objects of the schemas, found by the place the generator recorded, on first use. */
function branchTable(): WeakMap<object, ValidateFunction> {
	if (branches) return branches;
	const table = new WeakMap<object, ValidateFunction>();
	for (const { schema, pointer, validate } of branchValidators) {
		let node: unknown = schemas[schema as SchemaName];
		for (const step of pointer) node = (node as Record<string | number, unknown> | undefined)?.[step];
		if (node && typeof node === "object") table.set(node, validate as ValidateFunction);
	}
	branches = table;
	return table;
}

const engine: SchemaEngine = {
	root: (name) => rootValidators[name] as ValidateFunction,
	definition: (name, definition) => (definitionValidators as Record<string, unknown>)[`${name}#/$defs/${definition}`] as ValidateFunction | undefined,
	branch: (branch) => branchTable().get(branch),
};

export const schemaEngine = (): SchemaEngine => engine;
