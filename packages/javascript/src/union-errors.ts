import type { ErrorObject } from "ajv/dist/2020.js";

import { original } from "./branch-schema.js";
import { relatedName } from "./catalog-refs.js";
import { distance } from "./finding-text-util.js";
import type { SchemaEngine } from "./schema-engine.js";
import { schemaEntries } from "./schemas.js";

/**
 * RR-93: best match for the errors of a oneOf / anyOf. Ajv (allErrors) reports every rejected branch, so one bad value in a union
 * ('padding: 12' in a table cell style, a cell that is a oneOf of five scalar forms and a styled object) used to produce a
 * screenful of "must be string", "must be number", ... Each union error is re-checked branch by branch. The branch whose type or
 * discriminator the value matches (no `type` error at the value, no nested union that fits no form, no `const` on a property such
 * as a `type: "chart"` tag) is the one the author meant, when it is the only one that reaches deepest: its errors replace the union's, and a one-line summary of the other branches rides along as `alternatives`.
 * When no branch matches, or two match equally well, the union's own error stays, with a summary of every branch.
 *
 * An object written in the wrong shape (a table column `{ key, label }`, a list item `{ label, value, delta }`) matches the type of
 * the object forms but none of their fields. Each form's errors would say "must have `value`", "must have `name`" and one "not a
 * field" per key, which describe forms the author never meant. Such an object is one error at its own path (its params are
 * `ForeignObjectParams`): the forms it may take, in short, and, when one content kind declares all of its fields, that kind (`metric`).
 * `collapseRepeats` then reports the same mistake in several entries of one array once, at the first entry.
 */
export type UnionError = ErrorObject & { alternatives?: string[] };

/** The extra `params` of a union error that stands for an object no form of the union has fields for. */
export interface ForeignObjectParams {
	/** The object's own keys, as written. */
	properties: string[];
	/** The content kinds (`metric`) whose object form declares every one of those keys and needs no other. */
	belongsTo?: string[];
	/** Further entries of the same array with the same mistake (`collapseRepeats`). */
	alsoAt?: string[];
}

/**
 * The declared names `typed` plausibly respells, for "did you mean" on a property: within two edits (one for a name of three characters
 * or fewer), compared case-insensitively, and related by `relatedName` (a shared word or first three letters, the same letters, or half the
 * letter pairs). The edit distance alone offered `level` for `label`; those two are different words, so there is no suggestion.
 */
export function respellings(typed: string, declared: string[]): string[] {
	const limit = typed.length <= 3 ? 1 : 2;
	return declared
		.map((name) => ({ name, away: distance(typed, name) }))
		.filter(({ name, away }) => name !== typed && away <= limit && relatedName(typed, name))
		.sort((a, b) => a.away - b.away || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		.map(({ name }) => name);
}

const isUnion = (error: ErrorObject) => (error.keyword === "oneOf" || error.keyword === "anyOf") && Array.isArray(error.schema);
const key = (error: ErrorObject) => `${error.instancePath}\u0000${error.keyword}\u0000${error.message}\u0000${JSON.stringify(error.params)}`;
const depth = (pointer: string) => (pointer ? pointer.split("/").length - 1 : 0);
function branchLabel(branch: Record<string, unknown>, index: number): string {
	if (typeof branch.$ref === "string") return branch.$ref.slice(branch.$ref.lastIndexOf("/") + 1);
	if (typeof branch.type === "string") return branch.type;
	if (Array.isArray(branch.type)) return branch.type.join("|");
	if ("const" in branch) return JSON.stringify(branch.const);
	return `option ${index + 1}`;
}

function describe(errors: ErrorObject[], base: number): string {
	const types = [...new Set(errors.filter((error) => depth(error.instancePath) === base && error.keyword === "type").flatMap((error) => [error.params.type].flat()))];
	if (types.length) return `must be ${types.join(" or ")}`;
	const shallow = [...errors].filter((error) => !isUnion(error) || errors.every(isUnion)).sort((a, b) => depth(a.instancePath) - depth(b.instancePath))[0];
	if (!shallow) return "does not match";
	const rest = shallow.instancePath.split("/").slice(base + 1).join("/");
	return depth(shallow.instancePath) === base || !rest ? (shallow.message ?? "does not match") : `${shallow.message} at /${rest}`;
}

interface Analysis {
	union: ErrorObject;
	span: Set<string>;
	replacement: ErrorObject[];
}

/** Collapse the oneOf / anyOf errors of a verbose Ajv error list into the best-matching branch (see the file comment). */
export function bestMatchErrors(engine: SchemaEngine, rootId: string, errors: ErrorObject[]): UnionError[] {
	const unions = errors.filter(isUnion);
	if (!unions.length) return errors;
	const analyses: Analysis[] = [];
	for (const union of unions) {
		const analysis = analyze(engine, rootId, union);
		if (analysis) analyses.push(analysis);
	}
	if (!analyses.length) return errors;
	// A union inside another's span is handled when the outer one is reduced.
	const within = (inner: Analysis, other: Analysis) => other !== inner && [...inner.span].every((entry) => other.span.has(entry)) && (other.span.size > inner.span.size || errors.indexOf(other.union) > errors.indexOf(inner.union));
	const outer = analyses.filter((analysis) => !analyses.some((other) => within(analysis, other)));
	const replaced = new Map(outer.map((analysis) => [analysis.union, analysis]));
	const drop = new Set(outer.flatMap((analysis) => [...analysis.span]));
	const result: ErrorObject[] = [];
	for (const error of errors) {
		const analysis = replaced.get(error);
		if (analysis) result.push(...analysis.replacement);
		else if (!drop.has(key(error))) result.push(error);
	}
	return result;
}

function analyze(engine: SchemaEngine, rootId: string, union: ErrorObject): Analysis | undefined {
	const branches = union.schema as unknown[];
	const base = depth(union.instancePath);
	const results: { label: string; errors: ErrorObject[]; branch: Record<string, unknown> }[] = [];
	for (const [index, branch] of branches.entries()) {
		if (!branch || typeof branch !== "object") return undefined;
		const validate = engine.branch(branch, rootId);
		// An engine without a validator for this branch (a branch the schemas do not hold) leaves the union as Ajv said.
		if (!validate) return undefined;
		// One branch accepts the value: the union failed for another reason (oneOf with several matches), so leave it as Ajv said.
		if (validate(union.data) === true) return undefined;
		const raw = (validate.errors ?? []).map((error) => ({ ...error, instancePath: union.instancePath + error.instancePath }) as ErrorObject);
		results.push({ label: branchLabel(branch as Record<string, unknown>, index), errors: raw, branch: branch as Record<string, unknown> });
	}
	const span = new Set([key(union), ...results.flatMap((result) => result.errors.map(key))]);
	const reduced = results.map((result) => ({ label: result.label, branch: result.branch, errors: bestMatchErrors(engine, rootId, result.errors) }));
	const mismatch = (error: ErrorObject) => {
		const level = depth(error.instancePath) - base;
		return (level === 0 && (error.keyword === "type" || isUnion(error))) || (level === 1 && error.keyword === "const");
	};
	const matched = reduced.filter((result) => result.errors.length && !result.errors.some(mismatch));
	const reach = (errors: ErrorObject[]) => Math.min(...errors.map((error) => depth(error.instancePath)));
	const ranked = [...matched].sort((a, b) => reach(b.errors) - reach(a.errors));
	const summary = (list: typeof reduced) => list.map((result) => `${result.label}: ${describe(result.errors, base)}`);
	const named = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} or ${list.at(-1)}` : (list[0] ?? ""));
	const lead = ranked[0];
	if (!lead) {
		// No form fits the value's type. A union of plain types (a cell that is a string, number, boolean, null or runs) is better named than counted.
		const rootTypes = reduced.map((result) => result.errors.filter((error) => depth(error.instancePath) === base && error.keyword === "type"));
		const plain = rootTypes.every((list, index) => list.length === reduced[index]?.errors.length && list.length > 0);
		const types = [...new Set(rootTypes.flatMap((list) => list.flatMap((error) => [error.params.type].flat())))].map(String);
		return { union, span, replacement: [{ ...union, message: plain ? `must be ${named(types)}` : union.message, alternatives: summary(reduced) } as UnionError] };
	}
	// The forms that reach deepest are the ones the value was written for; of those, an object was written for the ones that declare the
	// most of its keys (`{ name, label }` is a data column with a stray `label`, not a styled cell). Two that still tie are both reported.
	let top = ranked.filter((result) => reach(result.errors) === reach(lead.errors));
	const keys = isObject(union.data) ? Object.keys(union.data) : [];
	const rejected = (errors: ErrorObject[]) => new Set(errors.filter((error) => error.keyword === "additionalProperties" && error.instancePath === union.instancePath).map((error) => String(error.params.additionalProperty)));
	const accepted = (errors: ErrorObject[]) => {
		const unknown = rejected(errors);
		return keys.filter((name) => !unknown.has(name)).length;
	};
	const most = Math.max(...top.map((result) => accepted(result.errors)));
	if (keys.length && most > 0) top = top.filter((result) => accepted(result.errors) === most);
	// None of the object's keys is a field of any form, nor a respelling of one: the object is in a shape this place does not take.
	const declared = (errors: ErrorObject[]) => errors.flatMap((error) => (error.keyword === "additionalProperties" && error.instancePath === union.instancePath && isObject(error.parentSchema) && isObject(error.parentSchema.properties) ? Object.keys(error.parentSchema.properties) : []));
	if (keys.length && most === 0 && top.every((result) => !keys.some((name) => respellings(name, declared(result.errors)).length))) {
		const belongsTo = homesOf(rootId, keys);
		const params: ForeignObjectParams = { properties: keys, ...(belongsTo.length ? { belongsTo } : {}) };
		const alternatives = reduced.map((result) => formOf(result.label, result.branch, rootId));
		return { union, span, replacement: [{ ...union, params: { ...union.params, ...params }, message: foreignMessage(params), alternatives } as UnionError] };
	}
	const others = reduced.filter((result) => !top.includes(result));
	// Forms that each fail on one thing of the same kind ("a date or a date-time", "an id or a name") read as one error.
	const single = (result: (typeof reduced)[number]) => {
		const only = result.errors[0];
		return result.errors.length === 1 && only && depth(only.instancePath) === base ? only : undefined;
	};
	const singles = top.map(single);
	const keyword = singles[0]?.keyword;
	if (top.length > 1 && (keyword === "format" || keyword === "required") && singles.every((error) => error?.keyword === keyword)) {
		const values = singles.map((error) => JSON.stringify(keyword === "format" ? error?.params.format : error?.params.missingProperty).replace(/^"|"$/g, keyword === "format" ? '"' : "'"));
		const message = keyword === "format" ? `must match format ${named(values)}` : `must have required property ${named(values)}`;
		return { union, span, replacement: [{ ...singles[0], message, alternatives: summary(top) } as UnionError] };
	}
	const chosen = top.flatMap((result) => result.errors).map((error, index) => {
		const mapped = { ...error, parentSchema: original(error.parentSchema), schema: original(error.schema) } as UnionError;
		if (index === 0 && others.length) mapped.alternatives = summary(others);
		return mapped;
	});
	return { union, span, replacement: chosen };
}

type Node = Record<string, unknown>;
const isObject = (value: unknown): value is Node => value !== null && typeof value === "object" && !Array.isArray(value);
const quoted = (names: string[], joiner: string) => {
	const list = names.map((name) => JSON.stringify(name));
	return list.length > 1 ? `${list.slice(0, -1).join(", ")} ${joiner} ${list.at(-1)}` : (list[0] ?? "");
};

/** A local `$ref` of the schema `rootId` names, followed to its definition; other nodes as they are. */
function resolved(node: unknown, rootId: string): Node | undefined {
	if (!isObject(node)) return undefined;
	if (typeof node.$ref !== "string") return node;
	const [base, fragment = ""] = node.$ref.split("#");
	const root = schemaEntries.find((entry) => entry.schema.$id === (base || rootId))?.schema;
	let target: unknown = root;
	for (const token of fragment.split("/").slice(1)) target = isObject(target) ? target[token.replaceAll("~1", "/").replaceAll("~0", "~")] : undefined;
	return isObject(target) ? resolved(target, rootId) : undefined;
}

/** An object form's fields in short, required ones first: `{ value, style, colspan, rowspan, … }`. */
function fieldsOf(schema: Node): string | undefined {
	if (!isObject(schema.properties)) return undefined;
	const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
	const names = [...new Set([...required, ...Object.keys(schema.properties)])];
	return `{ ${names.slice(0, 4).join(", ")}${names.length > 4 ? ", …" : ""} }`;
}

/** One form of a union for `alternatives`: its label, and its fields when it is an object (`DataColumn: { name, format }`). */
function formOf(label: string, branch: Node, rootId: string): string {
	const schema = resolved(branch, rootId);
	const fields = schema ? fieldsOf(schema) : undefined;
	if (fields) return `${label}: ${fields}`;
	const items = schema?.type === "array" ? resolved(schema.items, rootId) : undefined;
	const item = isObject(schema?.items) && typeof schema.items.$ref === "string" ? branchLabel(schema.items, 0) : typeof items?.type === "string" ? items.type : undefined;
	return item ? `${label}: a list of ${item}` : label;
}

const homes = new Map<string, { kind: string; properties: string[]; required: string[] }[]>();
/**
 * The content kinds (`metric`, `quote`, `table`, ... from the `type` vocabulary of a content payload) whose object form declares every one
 * of `keys` and requires none it lacks: `{ label, value, delta }` is a metric. Empty for a schema without content payloads.
 */
function homesOf(rootId: string, keys: string[]): string[] {
	let forms = homes.get(rootId);
	if (!forms) {
		forms = [];
		const payload = resolved({ $ref: "#/$defs/ContentPayload" }, rootId);
		const properties = isObject(payload?.properties) ? payload.properties : {};
		const kinds = isObject(properties.type) && Array.isArray(properties.type.enum) ? properties.type.enum.map(String) : [];
		for (const kind of kinds) {
			const field = resolved(properties[kind], rootId);
			const branches = [field, ...(Array.isArray(field?.oneOf) ? field.oneOf : []), ...(Array.isArray(field?.anyOf) ? field.anyOf : [])];
			for (const branch of branches) {
				const schema = resolved(branch, rootId);
				if (schema && isObject(schema.properties)) forms.push({ kind, properties: Object.keys(schema.properties), required: Array.isArray(schema.required) ? schema.required.map(String) : [] });
			}
		}
		homes.set(rootId, forms);
	}
	return [...new Set(forms.filter((form) => keys.every((name) => form.properties.includes(name)) && form.required.every((name) => keys.includes(name))).map((form) => form.kind))];
}

function foreignMessage(params: ForeignObjectParams): string {
	const home = params.belongsTo?.length ? ` (${params.properties.length > 1 ? "those are fields" : "that is a field"} of ${quoted(params.belongsTo, "or")})` : "";
	const indexes = (params.alsoAt ?? []).map((path) => path.slice(path.lastIndexOf("/") + 1));
	const also = indexes.length ? `; the same in entr${indexes.length > 1 ? "ies" : "y"} ${indexes.length > 1 ? `${indexes.slice(0, -1).join(", ")} and ${indexes.at(-1)}` : indexes[0]} of this list` : "";
	return `none of its forms has ${quoted(params.properties, "or")}${home}${also}`;
}

const isForeign = (error: ErrorObject) => isUnion(error) && Array.isArray(error.params.properties);
/**
 * The same wrong shape in several entries of one array (four table columns written `{ key, label }`) is one mistake: one error at the
 * first entry, naming every key and the other entries (`alsoAt`), instead of one per entry. Entries with another mistake stay apart.
 */
export function collapseRepeats(errors: UnionError[]): UnionError[] {
	const first = new Map<string, UnionError>();
	const result: UnionError[] = [];
	for (const error of errors) {
		const entry = isForeign(error) ? /^(.*)\/\d+$/.exec(error.instancePath) : null;
		if (!entry) {
			result.push(error);
			continue;
		}
		const params = error.params as ForeignObjectParams;
		const group = `${entry[1]}\u0000${error.schemaPath}\u0000${JSON.stringify(params.belongsTo ?? [])}`;
		const lead = first.get(group);
		if (!lead) {
			const copy = { ...error, params: { ...error.params } };
			first.set(group, copy);
			result.push(copy);
			continue;
		}
		const merged = lead.params as ForeignObjectParams;
		merged.properties = [...new Set([...merged.properties, ...params.properties])];
		merged.alsoAt = [...(merged.alsoAt ?? []), error.instancePath];
		lead.message = foreignMessage(merged);
	}
	return result;
}
