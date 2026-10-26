import type { ValidateFunction } from "ajv/dist/2020.js";
import type { SchemaName } from "./schemas.js";

/**
 * CE-01: what `validate` needs from the JSON Schema validator, so the package can ship two of them. `schema-engine-ajv.ts` runs
 * Ajv, which compiles each schema to JavaScript with `new Function` the first time it is used (Node, Bun, Deno).
 * `schema-engine-precompiled.ts` serves validators that were generated at build time (scripts/validators-codegen.mjs) and
 * never compiles anything: Cloudflare Workers, Vercel Edge and a page under a strict Content-Security-Policy refuse code
 * generation from strings. The `#schema-engine` import in package.json `imports` picks one by export condition (`workerd`,
 * `worker` and `edge-light` get the precompiled one), so a host needs no alias; a host whose bundler resolves the `node` build
 * for a worker imports `@openpresentation/opf/precompiled` once instead. Both give the same verdicts and the same verbose
 * errors (test/precompiled-validators.test.mjs).
 */
export interface SchemaEngine {
	/** The validator of a registered schema. Its `errors` are Ajv's verbose errors, whose `parentSchema` is the object in `schemas`. */
	root(name: SchemaName): ValidateFunction;
	/** The validator of one named definition of a registered schema, or undefined when the engine has none by that name. */
	definition(name: SchemaName, definition: string): ValidateFunction | undefined;
	/**
	 * The validator of one branch of a `oneOf` or `anyOf` (the object in `schemas`, from an error's `schema` array), with the
	 * branch's local references qualified by `rootId` so it validates on its own; undefined when the engine has none for it.
	 */
	branch(branch: object, rootId: string): ValidateFunction | undefined;
}

let installed: SchemaEngine | undefined;

/** The engine `@openpresentation/opf/precompiled` installed, which wins over the one the export conditions chose. */
export const installedSchemaEngine = (): SchemaEngine | undefined => installed;

/** Makes `engine` the one `validate` uses in this process, whatever the export conditions chose. */
export function installSchemaEngine(engine: SchemaEngine): void {
	installed = engine;
}
