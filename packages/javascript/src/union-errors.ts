import type Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv/dist/2020.js";

/**
 * RR-93: best match for the errors of a oneOf / anyOf. Ajv (allErrors) reports every rejected branch, so one bad value in a union
 * ('padding: 12' in a table cell style, a cell that is a oneOf of five scalar forms and a styled object) used to produce a
 * screenful of "must be string", "must be number", ... Each union error is re-checked branch by branch. The branch whose type or
 * discriminator the value matches (no `type` error at the value, no nested union that fits no form, no `const` on a property such
 * as a `type: "chart"` tag) is the one the author meant, when it is the only one that reaches deepest: its errors replace the union's, and a one-line summary of the other branches rides along as `alternatives`.
 * When no branch matches, or two match equally well, the union's own error stays, with a summary of every branch.
 */
export type UnionError = ErrorObject & { alternatives?: string[] };

const compiled = new WeakMap<object, ValidateFunction>();
const origin = new WeakMap<object, object>();

const isUnion = (error: ErrorObject) => (error.keyword === "oneOf" || error.keyword === "anyOf") && Array.isArray(error.schema);
const key = (error: ErrorObject) => `${error.instancePath}\u0000${error.keyword}\u0000${error.message}\u0000${JSON.stringify(error.params)}`;
const depth = (pointer: string) => (pointer ? pointer.split("/").length - 1 : 0);
const original = (node: unknown): unknown => {
	let current = node;
	while (current && typeof current === "object" && origin.has(current)) current = origin.get(current);
	return current;
};

// A branch's local references ('#/$defs/X') point at the schema it was written in; qualify them so the branch compiles on its own.
function qualify(node: unknown, rootId: string): unknown {
	if (Array.isArray(node)) {
		const copy = node.map((item) => qualify(item, rootId));
		origin.set(copy, node);
		return copy;
	}
	if (node && typeof node === "object") {
		const copy: Record<string, unknown> = {};
		for (const [name, value] of Object.entries(node)) copy[name] = name === "$ref" && typeof value === "string" && value.startsWith("#") ? rootId + value : qualify(value, rootId);
		origin.set(copy, node);
		return copy;
	}
	return node;
}

function branchValidator(ajv: Ajv2020, rootId: string, branch: object): ValidateFunction {
	let validate = compiled.get(branch);
	if (!validate) {
		validate = ajv.compile(qualify(branch, rootId) as object);
		compiled.set(branch, validate);
	}
	return validate;
}

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
export function bestMatchErrors(ajv: Ajv2020, rootId: string, errors: ErrorObject[]): UnionError[] {
	const unions = errors.filter(isUnion);
	if (!unions.length) return errors;
	const analyses: Analysis[] = [];
	for (const union of unions) {
		const analysis = analyze(ajv, rootId, union);
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

function analyze(ajv: Ajv2020, rootId: string, union: ErrorObject): Analysis | undefined {
	const branches = union.schema as unknown[];
	const base = depth(union.instancePath);
	const results: { label: string; errors: ErrorObject[] }[] = [];
	for (const [index, branch] of branches.entries()) {
		if (!branch || typeof branch !== "object") return undefined;
		const validate = branchValidator(ajv, rootId, branch);
		// One branch accepts the value: the union failed for another reason (oneOf with several matches), so leave it as Ajv said.
		if (validate(union.data) === true) return undefined;
		const raw = (validate.errors ?? []).map((error) => ({ ...error, instancePath: union.instancePath + error.instancePath }) as ErrorObject);
		results.push({ label: branchLabel(branch as Record<string, unknown>, index), errors: raw });
	}
	const span = new Set([key(union), ...results.flatMap((result) => result.errors.map(key))]);
	const reduced = results.map((result) => ({ label: result.label, errors: bestMatchErrors(ajv, rootId, result.errors) }));
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
	// The forms that reach deepest are the ones the value was written for; two that tie are both reported (an object that fits neither of two object forms).
	const top = ranked.filter((result) => reach(result.errors) === reach(lead.errors));
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
