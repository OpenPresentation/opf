import {
	getNodePath,
	parseTree,
	printParseErrorCode,
	type Node,
	type ParseError,
} from 'jsonc-parser';
import {
	catalogEntries,
	catalogKinds,
	catalogSchemaNames,
	type CatalogKind,
} from './catalogs.js';
import { schemaEntries, schemas, type SchemaName } from './schemas.js';
import {
	validateCatalogRecord,
	validatePresentation,
	type ValidationIssue,
} from './validator.js';
import type { JsonPrimitive, JsonSchema } from './json.js';

export type LintSeverity = 'error' | 'warning' | 'info';
export interface LintLocation {
	offset: number;
	length: number;
	line: number;
	column: number;
}
export interface LintSuggestion {
	value: JsonPrimitive;
	label: string;
	origin: 'schema' | 'built-in' | 'loaded' | 'document' | 'contract';
	definition: string;
}
export interface LintDiagnostic {
	ruleId: string;
	severity: LintSeverity;
	/** JSON Pointer into the document, or the explicitly supplied lint context. */
	path: string;
	scope: 'document' | 'context';
	message: string;
	help: string;
	definition?: string;
	lookup?: string[];
	suggestions?: LintSuggestion[];
	/** Full validation issue retained, including errors inside union alternatives. */
	validation?: ValidationIssue;
	/** Original-source UTF-16 offsets and one-based line/column. */
	location?: LintLocation;
}
export interface LintContract {
	/** JSON Pointer pattern; a complete '*' segment matches one path segment. */
	path: string;
	allowedValues: JsonPrimitive[];
	severity?: LintSeverity;
	message?: string;
	documentation?: string;
}
export interface LintOptions {
	/** Records already loaded by the host. This API never fetches catalog URLs. */
	catalogs?: Partial<Record<CatalogKind, readonly unknown[]>>;
	/** Explicit host policy. Document metadata is never interpreted as policy. */
	contracts?: readonly LintContract[];
}
export interface LintReport {
	valid: boolean;
	schemaValid: boolean | null;
	diagnostics: LintDiagnostic[];
	counts: Record<LintSeverity, number>;
	checks: {
		syntax: 'checked' | 'not-applicable';
		schema: 'checked' | 'not-run';
		catalogReferences: 'local-context' | 'not-run';
		assetReferences: 'registry-only' | 'not-run';
		contracts: 'checked' | 'not-run';
		layout: 'not-checked';
		fonts: 'not-checked';
		nativeExport: 'not-checked';
	};
}

const own = (value: object, key: string) => Object.hasOwn(value, key);
const object = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const primitive = (value: unknown): value is JsonPrimitive =>
	value === null ||
	typeof value === 'string' ||
	typeof value === 'boolean' ||
	(typeof value === 'number' && Number.isFinite(value));
const pointer = (parts: readonly (string | number)[]) =>
	parts.length
		? '/' +
			parts
				.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1'))
				.join('/')
		: '';
function parts(path: string): string[] {
	if (path === '') return [];
	if (!path.startsWith('/') || /~(?![01])/.test(path))
		throw new TypeError(`Invalid lint contract JSON Pointer: ${path}`);
	return path
		.slice(1)
		.split('/')
		.map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
}
function at(value: unknown, path: string): unknown {
	return parts(path).reduce<unknown>(
		(current, key) =>
			object(current) || Array.isArray(current)
				? own(current, key)
					? (current as Record<string, unknown>)[key]
					: undefined
				: undefined,
		value,
	);
}
function optionsChecked(options: LintOptions) {
	if (
		!object(options) ||
		Object.keys(options).some((key) => !['catalogs', 'contracts'].includes(key))
	)
		throw new TypeError('Lint options accept only catalogs and contracts.');
	if (
		options.catalogs !== undefined &&
		(!object(options.catalogs) ||
			Object.entries(options.catalogs).some(
				([kind, records]) =>
					!catalogKinds.includes(kind as CatalogKind) ||
					!Array.isArray(records),
			))
	)
		throw new TypeError(
			'Lint catalogs must map known catalog kinds to arrays of loaded records.',
		);
	if (options.contracts !== undefined && !Array.isArray(options.contracts))
		throw new TypeError('Lint contracts must be an array.');
	for (const contract of options.contracts ?? []) {
		if (
			!object(contract) ||
			Object.keys(contract).some(
				(key) =>
					![
						'path',
						'allowedValues',
						'severity',
						'message',
						'documentation',
					].includes(key),
			) ||
			typeof contract.path !== 'string' ||
			!Array.isArray(contract.allowedValues) ||
			!contract.allowedValues.every(primitive) ||
			(contract.severity !== undefined &&
				(typeof contract.severity !== 'string' ||
					!['error', 'warning', 'info'].includes(contract.severity))) ||
			(contract.message !== undefined &&
				typeof contract.message !== 'string') ||
			(contract.documentation !== undefined &&
				typeof contract.documentation !== 'string')
		)
			throw new TypeError(
				'Invalid lint contract: provide a path and primitive allowedValues, with optional severity, message and documentation.',
			);
		parts(contract.path);
	}
}
function report(
	diagnostics: LintDiagnostic[],
	schemaValid: boolean | null,
	syntax: LintReport['checks']['syntax'],
): LintReport {
	const counts = { error: 0, warning: 0, info: 0 };
	for (const diagnostic of diagnostics) counts[diagnostic.severity]++;
	return {
		valid: counts.error === 0,
		schemaValid,
		diagnostics,
		counts,
		checks: {
			syntax,
			schema: schemaValid === null ? 'not-run' : 'checked',
			catalogReferences: schemaValid === null ? 'not-run' : 'local-context',
			assetReferences: schemaValid === null ? 'not-run' : 'registry-only',
			contracts: schemaValid === null ? 'not-run' : 'checked',
			layout: 'not-checked',
			fonts: 'not-checked',
			nativeExport: 'not-checked',
		},
	};
}
function schemaDiagnostic(
	issue: ValidationIssue,
	schemaName: SchemaName = 'presentation',
	prefix = '',
	scope: LintDiagnostic['scope'] = 'document',
): LintDiagnostic {
	const path =
			prefix +
			(issue.path === '/' ? '' : issue.path) +
			(issue.keyword === 'additionalProperties' &&
			typeof issue.params.additionalProperty === 'string'
				? pointer([issue.params.additionalProperty])
				: ''),
		entry = schemaEntries.find((entry) => entry.name === schemaName);
	if (!entry) throw new TypeError(`Unknown schema ${schemaName}`);
	const definition = issue.schemaPath.startsWith('#')
		? entry.schema.$id + issue.schemaPath
		: issue.schemaPath;
	const lookup = [
		'opf',
		'schema',
		schemaName,
		issue.schemaPath.startsWith('#') ? issue.schemaPath.slice(1) : '',
	];
	let help =
		'Inspect this schema constraint and preserve unrelated content. Errors inside oneOf/anyOf branches may describe alternatives; retain the intended form.';
	if (issue.keyword === 'required')
		help = `Add the required ${JSON.stringify(issue.params.missingProperty)} field in this object, using the intended schema form.`;
	else if (issue.keyword === 'additionalProperties')
		help = `Review ${JSON.stringify(issue.params.additionalProperty)} against this object's schema. Preserve custom metadata in document.extensions where appropriate; do not delete authored content to clear this error.`;
	else if (issue.keyword === 'enum')
		help =
			'Choose one of this schema branch’s allowed values; inspect the other alternatives if the field uses another form.';
	else if (issue.keyword === 'opf')
		help =
			'Resolve the reported structural conflict while preserving every content field. Preview the result after editing.';
	const allowed = Array.isArray(issue.params.allowedValues)
		? issue.params.allowedValues.filter(primitive)
		: [];
	return {
		ruleId: 'opf/schema',
		severity: 'error',
		path,
		scope,
		message: issue.message,
		help,
		definition,
		lookup,
		validation: issue,
		...(allowed.length
			? {
					suggestions: allowed.map((value) => ({
						value,
						label: String(value),
						origin: 'schema' as const,
						definition,
					})),
				}
			: {}),
	};
}

interface Cursor {
	schema: JsonSchema;
	root: JsonSchema;
	path: string;
}
function resolve(cursor: Cursor, seen = new Set<string>()): Cursor {
	const ref = cursor.schema.$ref;
	if (typeof ref !== 'string') return cursor;
	const id = String(cursor.root.$id ?? '') + ref;
	if (seen.has(id)) return { ...cursor, schema: {} };
	seen.add(id);
	const [base, fragment = ''] = ref.split('#'),
		root = base
			? schemaEntries.find((entry) => entry.schema.$id === base)?.schema
			: cursor.root;
	if (!root) return { ...cursor, schema: {} };
	const target = at(root, fragment);
	if (!object(target)) return { ...cursor, schema: {} };
	const resolved = resolve(
		{ schema: target as JsonSchema, root, path: fragment },
		seen,
	);
	const { $ref, ...rest } = cursor.schema;
	return { ...resolved, schema: { ...resolved.schema, ...rest } };
}
function score(schema: JsonSchema, value: unknown): number {
	const type = schema.type;
	if (
		typeof type === 'string' &&
		(type === 'array'
			? !Array.isArray(value)
			: type === 'object'
				? !object(value)
				: type === 'null'
					? value !== null
					: type === 'integer'
						? !Number.isInteger(value)
						: typeof value !== type)
	)
		return -10000;
	if (own(schema, 'const')) return schema.const === value ? 100 : -10000;
	let result = 1;
	if (object(value) && object(schema.properties))
		for (const [key, child] of Object.entries(schema.properties))
			if (own(value, key) && object(child))
				result += own(child, 'const')
					? child.const === value[key]
						? 100
						: -1000
					: 1;
	if (Array.isArray(schema.required))
		for (const key of schema.required)
			if (typeof key === 'string' && (!object(value) || !own(value, key)))
				result -= 2;
	return result;
}
function active(cursor: Cursor, value: unknown): Cursor {
	const resolved = resolve(cursor),
		alternatives = resolved.schema.oneOf ?? resolved.schema.anyOf;
	if (!Array.isArray(alternatives)) return resolved;
	const keyword = resolved.schema.oneOf ? 'oneOf' : 'anyOf';
	const candidates = alternatives
		.filter(object)
		.map((schema, index) =>
			active(
				{
					schema: schema as JsonSchema,
					root: resolved.root,
					path: `${resolved.path}/${keyword}/${index}`,
				},
				value,
			),
		);
	return (
		candidates.sort(
			(a, b) => score(b.schema, value) - score(a.schema, value),
		)[0] ?? resolved
	);
}
function catalogIn(schema: JsonSchema): CatalogKind | undefined {
	const text = String(schema.description ?? '');
	return catalogKinds.find(
		(kind) =>
			text.includes(`catalogs.${kind}`) ||
			new RegExp(`\\b${kind}['’]? catalog`).test(text),
	);
}
interface Field {
	path: string;
	value: unknown;
	cursor: Cursor;
	kind?: CatalogKind;
	description: string;
	assetReference: boolean;
}
function fields(document: unknown): Field[] {
	const result: Field[] = [],
		stack = [
			{
				value: document,
				path: [] as (string | number)[],
				cursor: {
					schema: schemas.presentation,
					root: schemas.presentation,
					path: '',
				} as Cursor,
				ancestors: [] as unknown[],
			},
		];
	while (stack.length) {
		const entry = stack.pop();
		if (!entry) break;
		if (entry.ancestors.includes(entry.value)) continue;
		const resolved = resolve(entry.cursor),
			selected = active(entry.cursor, entry.value),
			description = String(resolved.schema.description ?? '');
		// A sibling description can override Asset's description without changing
		// its resource semantics. Follow the resolved schema, including union forms.
		const assetReference = [resolved, selected].some(
			(cursor) =>
				(cursor.root.$id === schemas.presentation.$id &&
					(cursor.path === '/$defs/Asset' ||
						cursor.path === '/$defs/Asset/oneOf/0' ||
						cursor.path === '/$defs/Watermark/properties/src')) ||
				String(cursor.schema.description ?? '').includes('asset:') ||
				(Array.isArray(cursor.schema.examples) &&
					cursor.schema.examples.some(
						(example) =>
							typeof example === 'string' && example.startsWith('asset:'),
					)),
		);
		result.push({
			path: pointer(entry.path),
			value: entry.value,
			cursor: resolved,
			kind: catalogIn(resolved.schema),
			description,
			assetReference,
		});
		const ancestors = [...entry.ancestors, entry.value];
		if (Array.isArray(entry.value) && object(selected.schema.items))
			entry.value.forEach((value, index) => {
				stack.push({
					value,
					path: [...entry.path, index],
					cursor: {
						schema: selected.schema.items as JsonSchema,
						root: selected.root,
						path: `${selected.path}/items`,
					},
					ancestors,
				});
			});
		else if (object(entry.value))
			for (const [key, value] of Object.entries(entry.value)) {
				if (entry.path.length === 0 && key === 'catalogs') continue;
				const properties = object(selected.schema.properties)
						? selected.schema.properties
						: {},
					patterns = object(selected.schema.patternProperties)
						? selected.schema.patternProperties
						: {};
				const pattern = Object.keys(patterns).find((pattern) =>
					new RegExp(pattern).test(key),
				);
				const schema =
					properties[key] ??
					(pattern ? patterns[pattern] : selected.schema.additionalProperties);
				if (!object(schema)) continue;
				const path = own(properties, key)
					? `${selected.path}/properties/${pointer([key]).slice(1)}`
					: pattern
						? `${selected.path}/patternProperties/${pointer([pattern]).slice(1)}`
						: `${selected.path}/additionalProperties`;
				stack.push({
					value,
					path: [...entry.path, key],
					cursor: { schema: schema as JsonSchema, root: selected.root, path },
					ancestors,
				});
			}
	}
	return result;
}
type Catalogs = Map<CatalogKind, Map<string, LintSuggestion>>;
function catalogContext(
	document: unknown,
	options: LintOptions,
	diagnostics: LintDiagnostic[],
): Catalogs {
	const result: Catalogs = new Map();
	for (const entry of catalogEntries) {
		const kind = entry.kind,
			map = new Map<string, LintSuggestion>();
		result.set(kind, map);
		for (const record of entry.records)
			map.set(record.id, {
				value: record.id,
				label: String(
					(record as unknown as Record<string, unknown>).name ?? record.id,
				),
				origin: 'built-in',
				definition: `spec/${entry.dir}/${entry.index.records.find((item) => item.id === record.id)?.file ?? `${record.id}.json`}`,
			});
		const local =
			object(document) &&
			object(document.catalogs) &&
			object(document.catalogs[kind])
				? (document.catalogs[kind] as Record<string, unknown>)
				: {};
		if (local.source !== undefined)
			diagnostics.push({
				ruleId: 'opf/catalog-source',
				severity: 'info',
				scope: 'document',
				path: `/catalogs/${kind}/source`,
				message: 'External catalog source was not fetched.',
				help: 'This lint run checks built-in, supplied and inline records only. Load external catalogs in the host and pass their records explicitly to verify that context.',
			});
		for (const group of [
			{
				records: options.catalogs?.[kind] ?? [],
				origin: 'loaded' as const,
				scope: 'context' as const,
				path: `/catalogs/${kind}`,
			},
			{
				records: Array.isArray(local.records) ? local.records : [],
				origin: 'document' as const,
				scope: 'document' as const,
				path: `/catalogs/${kind}/records`,
			},
		]) {
			const seen = new Set<string>();
			group.records.forEach((value, index) => {
				const path = `${group.path}/${index}`,
					schemaName = catalogSchemaNames[kind],
					record = object(value)
						? { $schema: schemas[schemaName].$id, ...value }
						: value;
				const validation = validateCatalogRecord(kind, record);
				for (const issue of validation.errors)
					diagnostics.push({
						...schemaDiagnostic(issue, schemaName, path, group.scope),
						ruleId: 'opf/catalog-record',
					});
				if (!object(value) || typeof value.id !== 'string') return;
				if (seen.has(value.id))
					diagnostics.push({
						ruleId: 'opf/catalog-record',
						severity: 'error',
						scope: group.scope,
						path: `${path}/id`,
						message: `Duplicate ${kind} record id ${JSON.stringify(value.id)} in this catalog.`,
						help: 'Give distinct records distinct IDs, or combine the intended override explicitly. Preserve their authored content.',
					});
				seen.add(value.id);
				if (!validation.valid) {
					map.delete(value.id);
					return;
				}
				map.set(value.id, {
					value: value.id,
					label: typeof value.name === 'string' ? value.name : value.id,
					origin: group.origin,
					definition: `${group.scope}#${path}`,
				});
			});
		}
	}
	return result;
}
function distance(a: string, b: string): number {
	// Bound suggestion scoring, not document validation; IDs still remain exact.
	a = a.slice(0, 128);
	b = b.slice(0, 128);
	let row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 0; i < a.length; i++) {
		const next = [i + 1];
		for (let j = 0; j < b.length; j++)
			next.push(
				Math.min(
					(next[j] ?? Infinity) + 1,
					(row[j + 1] ?? Infinity) + 1,
					(row[j] ?? Infinity) + (a[i] === b[j] ? 0 : 1),
				),
			);
		row = next;
	}
	return row[b.length] ?? Math.max(a.length, b.length);
}

/** Read-only lint with actionable schema, local catalog and explicit policy context. */
export function lintPresentation(
	document: unknown,
	options: LintOptions = {},
): LintReport {
	optionsChecked(options);
	const validation = validatePresentation(document),
		diagnostics = validation.errors.map((issue) => schemaDiagnostic(issue));
	const catalogs = catalogContext(document, options, diagnostics),
		seen = new Set<string>();
	const assetValues =
		object(document) && object(document.assets) ? document.assets : {};
	for (const field of fields(document)) {
		if (
			typeof field.value === 'string' &&
			field.value.startsWith('asset:') &&
			field.assetReference
		) {
			const id = field.value.slice(6);
			if (!own(assetValues, id))
				diagnostics.push({
					ruleId: 'opf/asset-reference',
					severity: 'error',
					scope: 'document',
					path: field.path,
					message: `Asset ${JSON.stringify(id)} is missing from the document registry.`,
					help: 'Supply the intended asset in document.assets or choose the correct existing asset ID. External files and URLs are not fetched or verified.',
					definition: schemas.presentation.$id + '#/$defs/Assets',
					lookup: ['opf', 'schema', 'presentation', '/$defs/Assets'],
					suggestions: Object.keys(assetValues)
						.sort(
							(a, b) =>
								distance(id, a) - distance(id, b) ||
								(a < b ? -1 : a > b ? 1 : 0),
						)
						.slice(0, 5)
						.map((id) => ({
							value: `asset:${id}`,
							label: id,
							origin: 'document',
							definition: `document#${pointer(['assets', id])}`,
						})),
				});
		}
		if (!field.path || !field.kind) continue;
		const { kind } = field;
		// These schema forms deliberately allow arbitrary human descriptions.
		if (kind !== 'layouts' && /free-form/i.test(field.description)) continue;
		if (
			kind === 'narratives' &&
			object(field.value) &&
			Array.isArray(field.value.beats)
		)
			continue;
		const value = object(field.value) ? field.value.id : field.value,
			path = object(field.value) ? `${field.path}/id` : field.path;
		if (
			typeof value !== 'string' ||
			!value ||
			/^(?:https?:|pkg:)/i.test(value) ||
			catalogs.get(kind)?.has(value) ||
			seen.has(path)
		)
			continue;
		seen.add(path);
		const suggestions = [...(catalogs.get(kind)?.values() ?? [])]
			.sort(
				(a, b) =>
					distance(value, String(a.value)) - distance(value, String(b.value)) ||
					(String(a.value) < String(b.value)
						? -1
						: String(a.value) > String(b.value)
							? 1
							: 0),
			)
			.slice(0, 5);
		const definition = String(field.cursor.root.$id) + `#${field.cursor.path}`;
		diagnostics.push({
			ruleId: 'opf/catalog-reference',
			severity: 'warning',
			scope: 'document',
			path,
			message: `Unknown ${kind} catalog id ${JSON.stringify(value)} in the available local context.`,
			help:
				kind === 'layouts'
					? 'Choose an available layout or supply the intended custom record. Engine-defined layouts may be valid; preview with the target renderer before changing content.'
					: 'Choose an available record or supply the intended custom catalog context. External references and native rendering are not verified by this check.',
			definition,
			lookup: ['opf', 'catalog', kind],
			suggestions,
		});
	}
	const reportedCycles = new Set<string>();
	for (const id of Object.keys(assetValues)) {
		const chain: string[] = [],
			seenIds = new Set<string>();
		let current: string | undefined = id;
		while (current !== undefined && own(assetValues, current)) {
			if (seenIds.has(current)) {
				const cycle = chain.slice(chain.indexOf(current));
				if (!cycle.some((id) => reportedCycles.has(id))) {
					for (const id of cycle) reportedCycles.add(id);
					diagnostics.push({
						ruleId: 'opf/asset-cycle',
						severity: 'error',
						scope: 'document',
						path: pointer(['assets', current]),
						message: `Asset references form a cycle: ${[...cycle, current].map((id) => JSON.stringify(id)).join(' → ')}.`,
						help: 'Replace one link with the intended concrete source. Preserve the original asset metadata; no files or URLs were fetched.',
					});
				}
				break;
			}
			seenIds.add(current);
			chain.push(current);
			const value: unknown = assetValues[current],
				source = object(value) ? value.src : value;
			current =
				typeof source === 'string' && source.startsWith('asset:')
					? source.slice(6)
					: undefined;
		}
	}
	// Retain any existing reference warning not covered by the schema walk.
	for (const issue of validation.warnings) {
		const kind = issue.params.kind as CatalogKind,
			id = issue.params.id;
		if (
			seen.has(issue.path) ||
			(typeof id === 'string' && catalogs.get(kind)?.has(id))
		)
			continue;
		diagnostics.push({
			...schemaDiagnostic(issue),
			ruleId: 'opf/catalog-reference',
			severity: 'warning',
			help: 'Inspect the referenced catalog and supply the intended record if this is a custom context.',
		});
	}
	for (const [index, contract] of (options.contracts ?? []).entries()) {
		const pattern = parts(contract.path),
			stack = [{ value: document, path: [] as string[], depth: 0 }];
		while (stack.length) {
			const entry = stack.pop();
			if (!entry) break;
			if (entry.depth === pattern.length) {
				if (
					contract.allowedValues.some((value) => Object.is(value, entry.value))
				)
					continue;
				const path = pointer(entry.path),
					definition = contract.documentation ?? `context#/contracts/${index}`,
					values = {
						path,
						value: JSON.stringify(entry.value),
						allowed: contract.allowedValues
							.map((value) => JSON.stringify(value))
							.join(', '),
						file: definition,
					};
				const message = (
					contract.message ??
					'This value is outside the allowed values for {{path}}.'
				).replace(
					/\{\{(path|value|allowed|file)\}\}/g,
					(_, key: keyof typeof values) => values[key] ?? '',
				);
				diagnostics.push({
					ruleId: 'opf/contract',
					severity: contract.severity ?? 'error',
					scope: 'document',
					path,
					message,
					help: `Use one of the configured values: ${values.allowed}. This is an explicit host policy; no source was changed.`,
					definition,
					suggestions: contract.allowedValues.map((value) => ({
						value,
						label: String(value),
						origin: 'contract',
						definition,
					})),
				});
			} else if (object(entry.value) || Array.isArray(entry.value)) {
				const key = pattern[entry.depth];
				for (const [name, value] of Object.entries(entry.value))
					if (key === '*' || key === name)
						stack.push({
							value,
							path: [...entry.path, name],
							depth: entry.depth + 1,
						});
			}
		}
	}
	return report(diagnostics, validation.valid, 'not-applicable');
}

/** Lint strict JSON source without normalizing whitespace or duplicate keys. */
export function lintSource(
	source: string,
	options: LintOptions = {},
): LintReport {
	optionsChecked(options);
	const errors: ParseError[] = [],
		tree = parseTree(
			source.startsWith('\uFEFF') ? ' ' + source.slice(1) : source,
			errors,
			{
				disallowComments: true,
				allowTrailingComma: false,
				allowEmptyContent: false,
			},
		);
	const lineStarts = [0];
	for (let i = 0; i < source.length; i++) {
		if (source[i] === '\r') {
			if (source[i + 1] === '\n') i++;
			lineStarts.push(i + 1);
		} else if (source[i] === '\n') lineStarts.push(i + 1);
	}
	const location = (offset: number, length: number): LintLocation => {
		let lo = 0,
			hi = lineStarts.length;
		while (lo + 1 < hi) {
			const mid = (lo + hi) >> 1;
			if ((lineStarts[mid] ?? 0) <= offset) lo = mid;
			else hi = mid;
		}
		return {
			offset,
			length,
			line: lo + 1,
			column: offset - (lineStarts[lo] ?? 0) + 1,
		};
	};
	if (errors.length || !tree)
		return report(
			errors.map((error) => ({
				ruleId: 'json/syntax',
				severity: 'error',
				scope: 'document',
				path: '',
				message: printParseErrorCode(error.error),
				help: 'Repair the JSON syntax at this source range. No content or whitespace has been rewritten.',
				location: location(error.offset, error.length),
			})),
			null,
			'checked',
		);
	const diagnostics: LintDiagnostic[] = [],
		stack: Node[] = [tree];
	while (stack.length) {
		const node = stack.pop();
		if (!node) break;
		if (node.type === 'object') {
			const keys = new Set<string>();
			for (const property of node.children ?? []) {
				const key = property.children?.[0];
				if (!key) continue;
				if (keys.has(key.value))
					diagnostics.push({
						ruleId: 'json/duplicate-key',
						severity: 'error',
						scope: 'document',
						path: pointer(getNodePath(key)),
						message: `Duplicate JSON property ${JSON.stringify(key.value)}.`,
						help: 'Resolve the duplicate explicitly, preserving the intended content from both occurrences. JSON.parse would otherwise hide an earlier value.',
						location: location(key.offset, key.length),
					});
				keys.add(key.value);
			}
		}
		stack.push(...(node.children ?? []));
	}
	const result = lintPresentation(
		JSON.parse(source.replace(/^\uFEFF/, '')),
		options,
	);
	for (const diagnostic of result.diagnostics) {
		if (diagnostic.scope === 'document') {
			let node: Node | undefined = tree;
			for (const part of parts(diagnostic.path))
				node =
					node?.type === 'array'
						? node.children?.[Number(part)]
						: node?.type === 'object'
							? node.children?.find(
									(property) => property.children?.[0]?.value === part,
								)?.children?.[1]
							: undefined;
			if (node) diagnostic.location = location(node.offset, node.length);
		}
		diagnostics.push(diagnostic);
	}
	return report(diagnostics, result.schemaValid, 'checked');
}
