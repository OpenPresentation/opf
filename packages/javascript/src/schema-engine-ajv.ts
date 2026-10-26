import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { qualifyBranch } from "./branch-schema.js";
import { installedSchemaEngine, type SchemaEngine } from "./schema-engine.js";
import { schemas, type SchemaName } from "./schemas.js";

/**
 * The Ajv build of the schema engine: Node, Bun and Deno (the `default` of `#schema-engine`). Ajv compiles each schema to
 * JavaScript with `new Function` on first use, so the first `validate` of a process pays for it, and a host that refuses code
 * generation cannot run it: those hosts get `schema-engine-precompiled.ts` through the package's export conditions.
 * The Ajv options equal `ajvOptions` in scripts/validators-codegen.mjs.
 */
let ajv: Ajv2020 | undefined;
const branches = new WeakMap<object, ValidateFunction>();

function getAjv(): Ajv2020 {
	if (ajv) return ajv;
	const instance = new Ajv2020({ allErrors: true, verbose: true, strict: false, allowUnionTypes: true });
	addFormats(instance);
	for (const schema of Object.values(schemas)) instance.addSchema(schema);
	ajv = instance;
	return instance;
}

const engine: SchemaEngine = {
	root(name: SchemaName) {
		const schema = schemas[name];
		return getAjv().getSchema(schema.$id as string) ?? getAjv().compile(schema);
	},
	definition(name: SchemaName, definition: string) {
		return getAjv().getSchema(`${schemas[name].$id as string}#/$defs/${definition}`);
	},
	branch(branch: object, rootId: string) {
		let validate = branches.get(branch);
		if (!validate) {
			validate = getAjv().compile(qualifyBranch(branch, rootId) as object);
			branches.set(branch, validate);
		}
		return validate;
	},
};

export const schemaEngine = (): SchemaEngine => installedSchemaEngine() ?? engine;
