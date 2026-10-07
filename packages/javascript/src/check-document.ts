import {
	catalogEntries,
	catalogKinds,
	catalogSchemaNames,
	type CatalogKind,
} from './catalogs.js';
import { schemaEntries, schemas, type SchemaName } from './schemas.js';
import { validateAgainstSchema, type SchemaCheckResult, type ValidationIssue } from './schema-check.js';
import type { JsonPrimitive, JsonSchema } from './json.js';
import { validationDefinition } from './validation-definitions.js';
import { unusedReferenceWarnings } from './annotation-validation.js';
import { describeDurationRange, durationOutsideNarrative, durationRangeInverted, resolveNarrative, unknownBeatReferences } from './narrative-plan.js';
import { chartNumberFixesByCell, unusedDatasets, type ChartNumberFix } from './chart-data.js';
import { isRecord, pathFor, visitContentPayloads } from './content-walk.js';
import { ruleInfo } from './validation-rules.js';
import type { Finding, FindingSeverity, FindingSuggestion } from './generated/types/finding.js';
import type { Contract, ValidateOptions } from './validation-types.js';

/**
 * The format, references and policy checks of `validate`: the schema and semantic issues of the engine as findings,
 * and the checks that need the document's schema walked (catalog ids, assets, datasets, citations) or a host's
 * contracts. Internal module; `validator.ts` decides which of them run.
 */

const own = (value: object, key: string) => Object.hasOwn(value, key);
const object = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const primitive = (value: unknown): value is JsonPrimitive =>
	value === null ||
	typeof value === 'string' ||
	typeof value === 'boolean' ||
	(typeof value === 'number' && Number.isFinite(value));
export const pointer = (parts: readonly (string | number)[]) =>
	parts.length
		? '/' +
			parts
				.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1'))
				.join('/')
		: '';
export function parts(path: string): string[] {
	if (path === '') return [];
	if (!path.startsWith('/') || /~(?![01])/.test(path))
		throw new TypeError(`Invalid contract JSON Pointer: ${path}`);
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
/** Check the shape of the options only this module reads. Unknown option keys are rejected by `validate` itself. */
export function checkDocumentOptions(options: ValidateOptions) {
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
			'Validate catalogs must map known catalog kinds to arrays of loaded records.',
		);
	if (options.contracts !== undefined && !Array.isArray(options.contracts))
		throw new TypeError('Validate contracts must be an array.');
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
				'Invalid contract: provide a path and primitive allowedValues, with optional severity, message and documentation.',
			);
		parts(contract.path);
	}
}

type FindingData = Omit<Finding, 'ruleId' | 'category' | 'severity' | 'scope'> & {
	severity?: FindingSeverity;
	scope?: Finding['scope'];
};
/** A finding of a registered rule: category and default severity come from the registry. */
export function finding(ruleId: string, data: FindingData): Finding {
	const info = ruleInfo(ruleId);
	const { severity, scope, ...rest } = data;
	return { ruleId, severity: severity ?? info.severity, category: info.category, scope: scope ?? 'document', ...rest };
}

/** The rule an engine issue reports under: its semantic code when it names one, else the schema rule. */
export const issueRuleId = (issue: ValidationIssue): string =>
	typeof issue.params.code === 'string' && issue.keyword === 'opf' ? `opf/${issue.params.code}` : 'opf/schema';

/** An engine issue as a finding: the path (an additional property is named), the exact schema definition, and what the schema allows. */
export function issueFinding(
	issue: ValidationIssue,
	ruleId = issueRuleId(issue),
	schemaName: SchemaName = 'presentation',
	prefix = '',
	scope: Finding['scope'] = 'document',
	severity?: FindingSeverity,
): Finding {
	const path =
			prefix +
			(issue.path === '/' ? '' : issue.path) +
			(issue.keyword === 'additionalProperties' &&
			typeof issue.params.additionalProperty === 'string'
				? pointer([issue.params.additionalProperty])
				: ''),
		entry = schemaEntries.find((entry) => entry.name === schemaName);
	if (!entry) throw new TypeError(`Unknown schema ${schemaName}`);
	const precise = validationDefinition(issue);
	const definition =
		precise?.uri ??
		(issue.keyword === 'opf'
			? 'packages/javascript/src/schema-check.ts'
			: issue.schemaPath.startsWith('#')
				? entry.schema.$id + issue.schemaPath
				: issue.schemaPath);
	const lookup = [
		'opf',
		'schema',
		precise?.schemaName ?? schemaName,
		precise?.pointer ??
			(issue.keyword !== 'opf' && issue.schemaPath.startsWith('#')
				? issue.schemaPath.slice(1)
				: ''),
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
	return finding(ruleId, {
		...(severity ? { severity } : {}),
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
	});
}

interface Cursor {
	schema: JsonSchema;
	root: JsonSchema;
	path: string;
	baseSchemas?: Cursor[];
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
	const candidates = alternatives.filter(object).map((schema, index) =>
		active(
			{
				schema: schema as JsonSchema,
				root: resolved.root,
				path: `${resolved.path}/${keyword}/${index}`,
			},
			value,
		),
	);
	const selected = candidates.sort((a, b) => score(b.schema, value) - score(a.schema, value))[0];
	return selected ? { ...selected, baseSchemas: [...(selected.baseSchemas ?? []), resolved] } : resolved;
}
function catalogIn(schema: JsonSchema): CatalogKind | undefined {
	const text = String(schema.description ?? '');
	if (/\bfont-scheme id\b/.test(text)) return 'fontSchemes';
	return catalogKinds.find(
		(kind) =>
			text.includes(`catalogs.${kind}`) ||
			new RegExp(`\\b${kind}['’]? catalog`).test(text),
	);
}

// Recognize the syntactic alternatives in RFC 5646 section 2.1. This only
// distinguishes possible language tags from catalog IDs; it does not check the
// IANA registry, canonicalize spelling, or replace OPF's existing en-UK error.
const languageTagSyntax = new RegExp(
	'^(?:(?:[a-z]{2,3}(?:-[a-z]{3}){0,3}|[a-z]{4}|[a-z]{5,8})' +
		'(?:-[a-z]{4})?(?:-(?:[a-z]{2}|[0-9]{3}))?' +
		'(?:-(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3}))*' +
		'(?:-[0-9a-wy-z](?:-[a-z0-9]{2,8})+)*(?:-x(?:-[a-z0-9]{1,8})+)?' +
		'|x(?:-[a-z0-9]{1,8})+)$',
	'i',
);
const irregularLanguageTags = new Set([
	'en-gb-oed',
	'i-ami',
	'i-bnn',
	'i-default',
	'i-enochian',
	'i-hak',
	'i-klingon',
	'i-lux',
	'i-mingo',
	'i-navajo',
	'i-pwn',
	'i-tao',
	'i-tay',
	'i-tsu',
	'sgn-be-fr',
	'sgn-be-nl',
	'sgn-ch-de',
]);

function childCursor(cursors: Cursor[], key: string): Cursor | undefined {
	for (const keyword of [
		'properties',
		'patternProperties',
		'additionalProperties',
	] as const) {
		for (const cursor of cursors) {
			const declarations = cursor.schema[keyword];
			if (!object(declarations)) continue;
			const name =
				keyword === 'properties'
					? key
					: keyword === 'patternProperties'
						? Object.keys(declarations).find((pattern) =>
								new RegExp(pattern).test(key),
							)
						: undefined;
			const schema =
				keyword === 'additionalProperties'
					? declarations
					: name === undefined
						? undefined
						: declarations[name];
			if (object(schema))
				return {
					schema: schema as JsonSchema,
					root: cursor.root,
					path: `${cursor.path}/${keyword}${name === undefined ? '' : pointer([name])}`,
				};
		}
	}
	return undefined;
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
		const cursors = [selected, ...(selected.baseSchemas ?? []), resolved];
		const arrayCursor = cursors.find(cursor => object(cursor.schema.items));
		if (Array.isArray(entry.value) && arrayCursor)
			entry.value.forEach((value, index) => {
				stack.push({
					value,
					path: [...entry.path, index],
					cursor: {
						schema: arrayCursor.schema.items as JsonSchema,
						root: arrayCursor.root,
						path: `${arrayCursor.path}/items`,
					},
					ancestors,
				});
			});
		else if (object(entry.value))
			for (const [key, value] of Object.entries(entry.value)) {
				if (entry.path.length === 0 && key === 'catalogs') continue;
				// Union branches can add only required fields while the properties
				// remain on the common schema. Retain their actual definition paths.
				const cursor = childCursor(cursors, key);
				if (!cursor) continue;
				stack.push({
					value,
					path: [...entry.path, key],
					cursor,
					ancestors,
				});
			}
	}
	return result;
}
type Catalogs = Map<CatalogKind, Map<string, FindingSuggestion>>;
function catalogContext(
	document: unknown,
	options: ValidateOptions,
	findings: Finding[],
): Catalogs {
	const result: Catalogs = new Map();
	for (const entry of catalogEntries) {
		const kind = entry.kind,
			map = new Map<string, FindingSuggestion>();
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
			findings.push(
				finding('opf/catalog-source', {
					path: `/catalogs/${kind}/source`,
					message: 'External catalog source was not fetched.',
					help: 'This run checks built-in, supplied and inline records only. Load external catalogs in the host and pass their records explicitly to verify that context.',
				}),
			);
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
				const validation = validateAgainstSchema(record, kind);
				for (const issue of validation.errors)
					findings.push(issueFinding(issue, 'opf/catalog-record', schemaName, path, group.scope));
				if (!object(value) || typeof value.id !== 'string') return;
				if (seen.has(value.id))
					findings.push(
						finding('opf/catalog-record', {
							scope: group.scope,
							path: `${path}/id`,
							message: `Duplicate ${kind} record id ${JSON.stringify(value.id)} in this catalog.`,
							help: 'Give distinct records distinct IDs, or combine the intended override explicitly. Preserve their authored content.',
						}),
					);
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


function chartNumberFixPaths(document: unknown): Map<string, ChartNumberFix> {
	const byCell = new Map<string, ChartNumberFix>();
	if (!isRecord(document) || !Array.isArray(document.slides)) return byCell;
	const payload = (node: Record<string, unknown>, path: string): void => {
		if (isRecord(node.chart))
			for (const [cell, fix] of chartNumberFixesByCell(node.chart, document, { path: pathFor(path, 'chart') })) byCell.set(cell, fix);
	};
	document.slides.forEach((slide, index) => {
		if (!isRecord(slide)) return;
		payload(slide, `/slides/${index}`);
		visitContentPayloads(slide, `/slides/${index}`, payload);
	});
	return byCell;
}

const HELP: Record<string, string> = {
	'chart-value-not-numeric':
		'Write chart values as numbers (or strict decimal strings such as "12.5" or "1e6"); put currency, percent and units in the column format ({ "name": "Revenue", "format": "$#,##0" }). The value is plotted as a gap.',
	'chart-mapping-adapted': 'The mapping entry is ignored. Remove it, or name a different column.',
	'chart-highlight-adapted': 'The highlight is adapted by every engine. Name a series or category the chart type can emphasise, or remove the entry.',
	'slide-theme-dimensions': 'A PPTX has one slide size. Set design.dimensions on the deck, or give every slide the same theme dimensions.',
	'code-highlight-out-of-range': 'Marked lines count from 1 by line break in code.source. The entry marks nothing past the last line; change it to a line the code has, or remove it.',
	'code-highlight-range-reversed': 'Write the range with the smaller line number first, or remove it. A reversed range marks nothing.',
	'chart-option-adapted': 'Remove the option, or choose a chart type that can show it; every engine draws the adapted result.',
	'variable-unknown': "Declare the variable in the top-level variables map, or write '\\{{' for literal braces.",
	'variable-unknown-value': 'Remove the supplied value, or declare the variable it belongs to.',
	'variable-unused': 'Reference the variable as {{id}} or var:id where it belongs, or remove its declaration.',
	'variable-reference-unknown': 'Declare the variable in the top-level variables map, or use another colour.',
	'run-color-unrecognized': 'Use a #RRGGBB hex colour, a colour-scheme name or a var: reference to a declared colour variable.',
	'numbering-start-ignored': "Add a 'numbering' field to the payload, or remove 'start'.",
};

/**
 * The engine's issues as findings. Errors are `format` findings (the schema rule, or the semantic rule that names its
 * code); warnings that name a code (data, chart options, variables, numbering, colours) are findings of that rule.
 * The catalog-id warnings are left to `referenceFindings`, which resolves them against the full local context.
 * `enabled` lets a caller skip work for a rule it will not report.
 */
export function engineFindings(document: unknown, engine: SchemaCheckResult, enabled: (ruleId: string) => boolean): Finding[] {
	const findings: Finding[] = [];
	for (const issue of engine.errors) {
		const ruleId = issueRuleId(issue);
		if (enabled(ruleId)) findings.push(issueFinding(issue, ruleId));
	}
	// RR-54: the migration fix of each chart value column whose text cells share one display style, by cell path.
	let numberFixes: Map<string, ChartNumberFix> | undefined;
	for (const issue of engine.warnings) {
		const code = issue.params.code;
		if (typeof code !== 'string') continue;
		const ruleId = `opf/${code}`;
		if (!enabled(ruleId)) continue;
		if (code === 'chart-value-not-numeric') {
			numberFixes ??= chartNumberFixPaths(document);
			const fix = numberFixes.get(issue.path);
			if (fix) {
				findings.push({
					...issueFinding(issue, ruleId, 'presentation', '', 'document', 'warning'),
					help: `Every text value of column ${JSON.stringify(fix.name)} is written in one display style. Store the numbers and give the column the format ${JSON.stringify(fix.format)}, which shows the same text: apply fixes[0] (core suggestChartNumberFix). Until then the value is plotted as a gap.`,
					fixes: [{ id: 'store-chart-numbers', title: `Store ${JSON.stringify(fix.name)} as numbers with the format ${JSON.stringify(fix.format)}`, kind: 'patch', safe: false, patch: fix.patches }],
				});
				continue;
			}
		}
		const found = issueFinding(issue, ruleId, 'presentation', '', 'document', 'warning');
		const help = HELP[code];
		if (help) found.help = help;
		findings.push(found);
	}
	return findings;
}

const VARIABLE_TOKEN = /\\\{\{|\{\{\s*([a-z][a-z0-9-]*)\s*(?:\|[^{}]*)?\}\}/g;

/**
 * `opf/variable-unfilled`. A required variable with no value is an error in a normal deck (the deck cannot be used until it is
 * filled, so every write command rejects it) and a warning in a template. A document that declares no content variables
 * is scanned for `{{token}}` text that nothing will ever fill, a warning; that scan reads the whole document, so it runs
 * only for a document that passes the schema.
 */
export function variableFindings(document: unknown, engine: SchemaCheckResult, schemaValid: boolean): Finding[] {
	const findings: Finding[] = [];
	if (engine.template === true) {
		for (const id of engine.unfilledVariables ?? [])
			findings.push(
				finding('opf/variable-unfilled', {
					path: pointer(['variables', id]),
					message: `Template variable ${JSON.stringify(id)} has no value.`,
					help: 'This document is a template: fill it with its values (opf fill, or resolveVariables) before using it as a deck.',
					severity: 'warning',
				}),
			);
		return findings;
	}
	for (const issue of engine.unfilled)
		findings.push(
			finding('opf/variable-unfilled', {
				path: issue.path,
				message: issue.message,
				help: 'Give the variable a value, fill the deck before use (opf fill, or resolveVariables), or mark the document as a template ("template": true).',
			}),
		);
	if (engine.template !== undefined || !schemaValid) return findings;
	const walk = (value: unknown, path: string[], depth: number) => {
		if (depth > 64) return;
		if (typeof value === 'string') {
			if (value.startsWith('data:') || !value.includes('{{')) return;
			for (const match of value.matchAll(VARIABLE_TOKEN))
				if (match[1])
					findings.push(
						finding('opf/variable-unfilled', {
							path: pointer(path),
							message: `Template variable ${JSON.stringify(match[0])} is still in the text.`,
							help: 'Declare the variable and fill it, or replace the token with the real value.',
							severity: 'warning',
						}),
					);
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((entry, index) => {
				walk(entry, [...path, String(index)], depth + 1);
			});
			return;
		}
		if (value && typeof value === 'object')
			for (const [key, entry] of Object.entries(value)) {
				if (path.length === 0 && ['variables', 'extensions', 'catalogs', 'assets'].includes(key)) continue;
				walk(entry, [...path, key], depth + 1);
			}
	};
	walk(document, [], 0);
	return findings;
}

/** True when the document names an external source for a catalog kind (a URL or package, or an ordered search path of them). */
function hasExternalSource(document: unknown, kind: CatalogKind): boolean {
	if (!object(document) || !object(document.catalogs)) return false;
	const entry = document.catalogs[kind];
	return object(entry) && (typeof entry.source === 'string' || (Array.isArray(entry.source) && entry.source.length > 0));
}

/** Catalog ids, assets, citations and datasets: everything the document points at, resolved without fetching anything. */
export function referenceFindings(document: unknown, engine: SchemaCheckResult, options: ValidateOptions): Finding[] {
	const findings: Finding[] = [];
	const catalogs = catalogContext(document, options, findings),
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
				findings.push(
					finding('opf/asset-reference', {
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
					}),
				);
		}
		if (!field.path || !field.kind) continue;
		const { kind } = field;
		if (
			kind === 'languages' &&
			field.path === '/language' &&
			typeof field.value === 'string' &&
			(languageTagSyntax.test(field.value) ||
				irregularLanguageTags.has(field.value.toLowerCase()))
		)
			continue;
		// These schema forms deliberately allow arbitrary human descriptions.
		if (kind !== 'layouts' && /free-form/i.test(field.description)) continue;
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
		// A custom source may define ids the bundled catalogs do not know about. Unless the host loaded that source's
		// records (`catalogs`), the id cannot be judged; `opf/catalog-source` already says it was not fetched.
		if (!options.catalogs?.[kind]?.length && hasExternalSource(document, kind)) continue;
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
		findings.push(
			finding('opf/catalog-reference', {
				path,
				message: `Unknown ${kind} catalog id ${JSON.stringify(value)} in the available local context.`,
				help:
					kind === 'layouts'
						? 'Choose an available layout or supply the intended custom record. Engine-defined layouts may be valid; preview with the target renderer before changing content.'
						: 'Choose an available record or supply the intended custom catalog context. External references and native rendering are not verified by this check.',
				definition,
				lookup: ['opf', 'catalog', kind],
				suggestions,
			}),
		);
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
					findings.push(
						finding('opf/asset-cycle', {
							path: pointer(['assets', current]),
							message: `Asset references form a cycle: ${[...cycle, current].map((id) => JSON.stringify(id)).join(' → ')}.`,
							help: 'Replace one link with the intended concrete source. Preserve the original asset metadata; no files or URLs were fetched.',
						}),
					);
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
	// The engine only knows the bundled catalogs. Keep its warnings that the local context (inline, loaded) does not explain away.
	for (const issue of engine.warnings) {
		if (typeof issue.params.code === 'string') continue;
		const kind = issue.params.kind as CatalogKind | undefined,
			id = issue.params.id,
			replacedBy = issue.params.replacedBy;
		if (kind === undefined) continue;
		if (typeof replacedBy === 'string' && typeof id === 'string') {
			const target = catalogs.get(kind)?.get(replacedBy);
			findings.push({
				...issueFinding(issue, 'opf/deprecated-catalog-id'),
				message: `Deprecated ${kind} catalog id ${JSON.stringify(id)}; use ${JSON.stringify(replacedBy)} instead.`,
				help: 'The deprecated id still resolves to its original record, so nothing breaks. Switch to the replacement when you next edit this reference.',
				lookup: ['opf', 'catalog', kind],
				...(target ? { suggestions: [target] } : {}),
			});
			continue;
		}
		if (
			seen.has(issue.path) ||
			(typeof id === 'string' && catalogs.get(kind)?.has(id))
		)
			continue;
		const dir = catalogEntries.find((entry) => entry.kind === kind)?.dir;
		findings.push({
			...issueFinding(issue, 'opf/catalog-reference'),
			message: `Unknown ${kind} catalog id ${JSON.stringify(id)} in the available local context.`,
			help: 'Inspect the referenced catalog and supply the intended record if this is a custom context.',
			...(dir ? { definition: `spec/${dir}/index.json` } : {}),
			lookup: ['opf', 'catalog', kind],
		});
	}
	findings.push(...narrativeFindings(document, options));
	// RR-34: a reference no run cites is advisory; cite it or remove it.
	for (const issue of unusedReferenceWarnings(document))
		findings.push(
			finding('opf/unused-reference', {
				path: issue.path,
				message: issue.message,
				help: "Cite the reference from a text, bullet or list item run ({ text, cite: id }) so it is listed in that slide's footnote area, or remove the entry. Nothing is drawn for an uncited reference.",
				definition: schemas.presentation.$id + '#/$defs/Reference',
				lookup: ['opf', 'schema', 'presentation', '/$defs/Reference'],
				validation: issue,
			}),
		);
	// RR-54: a dataset no chart or table references is advisory; reference it or remove it.
	for (const id of unusedDatasets(document))
		findings.push(
			finding('opf/unused-dataset', {
				path: `/datasets/${id.replaceAll('~', '~0').replaceAll('/', '~1')}`,
				message: `Dataset ${JSON.stringify(id)} is never referenced; reference it from a chart ("data": { "dataset": ${JSON.stringify(id)} }) or a table ({ "dataset": ${JSON.stringify(id)} }), or remove it.`,
				help: 'Reference the dataset from chart.data or a table so it is drawn, or remove the entry. Nothing is drawn for an unreferenced dataset.',
				definition: schemas.presentation.$id + '#/$defs/Dataset',
				lookup: ['opf', 'schema', 'presentation', '/$defs/Dataset'],
			}),
		);
	return findings;
}

/** FA-02: the narrative is a pointer; check the slides' beat links and the target duration against the plan. */
function narrativeFindings(document: unknown, options: ValidateOptions): Finding[] {
	const findings: Finding[] = [];
	if (!object(document)) return findings;
	const narrative = resolveNarrative(document, options.catalogs?.narratives);
	if (narrative) {
		const id = String(document.narrative);
		const beatSuggestions = (beat: string): FindingSuggestion[] =>
			narrative.beats
				.slice()
				.sort((a, b) => distance(beat, a) - distance(beat, b) || (a < b ? -1 : a > b ? 1 : 0))
				.slice(0, 5)
				.map((value) => ({ value, label: value, origin: narrative.origin === 'built-in' ? 'built-in' : narrative.origin, definition: `narratives/${id}#/beats` }));
		for (const reference of unknownBeatReferences(document, narrative))
			findings.push(
				finding('opf/unknown-beat', {
					path: reference.path,
					message: `Slide ${reference.slide + 1} names beat ${JSON.stringify(reference.beat)}, which narrative ${JSON.stringify(id)} does not define.`,
					help: `Use one of the narrative's beat ids (${narrative.beats.join(', ')}), add the beat to the narrative record (an inline record in catalogs.narratives.records), or remove the beat link. Nothing is drawn from a beat.`,
					definition: schemas.presentation.$id + '#/$defs/Slide/properties/beat',
					lookup: ['opf', 'catalog', 'narratives'],
					suggestions: beatSuggestions(reference.beat),
				}),
			);
		const outside = durationOutsideNarrative(document, narrative);
		if (outside)
			findings.push(
				finding('opf/duration-outside-narrative', {
					path: '/duration',
					message: `The target duration of ${outside.duration} minutes is outside the ${describeDurationRange(outside.range)} narrative ${JSON.stringify(id)} suits.`,
					help: 'Change the target duration, choose a narrative that suits it, or widen the range of an inline narrative record. The range describes the narrative, so nothing is drawn or exported differently.',
					definition: schemas.presentation.$id + '#/properties/duration',
					lookup: ['opf', 'catalog', 'narratives'],
				}),
			);
	}
	const inlineNarratives = object(document.catalogs) && object(document.catalogs.narratives) ? document.catalogs.narratives.records : undefined;
	if (Array.isArray(inlineNarratives))
		inlineNarratives.forEach((record, index) => {
			if (durationRangeInverted(record))
				findings.push(
					finding('opf/narrative-duration-range', {
						path: `/catalogs/narratives/records/${index}/duration`,
						message: 'The narrative duration range has min greater than max.',
						help: 'Swap the bounds so min is the shortest and max the longest talk length, in minutes.',
						definition: schemas.narrative.$id + '#/properties/duration',
						lookup: ['opf', 'schema', 'narrative', '/properties/duration'],
					}),
				);
		});
	return findings;
}

/** Host policy: every field a contract names must hold one of its allowed values. */
export function contractFindings(document: unknown, contracts: readonly Contract[]): Finding[] {
	const findings: Finding[] = [];
	for (const [index, contract] of contracts.entries()) {
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
				findings.push(
					finding('opf/contract', {
						severity: contract.severity ?? 'error',
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
					}),
				);
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
	return findings;
}
