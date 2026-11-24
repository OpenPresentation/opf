// One test of whether an embedded catalog record fails its companion schema, shared by the validator's content references
// (check-document.ts: an embedded record that fails is reported as such, and a layout "auto" that resolves only to one is still the
// removed layout) and the 0.35 cell-key repair (schema-fixes.ts: whether a slide's layout "auto" is a real layout), so the two agree.
import { catalogSchemaNames } from './catalog-schemas.js';
import { resolveReference, type CatalogKind, type CatalogOptions } from './catalog-refs.js';
import { validateAgainstSchema } from './schema-check.js';
import { schemas } from './schemas.js';

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Validate one record against its companion schema as a published file would be, with the identity it is keyed by. */
export function recordIssues(kind: CatalogKind, id: string, value: unknown) {
	const schemaName = catalogSchemaNames[kind];
	return validateAgainstSchema(object(value) ? { $schema: schemas[schemaName].$id, id, ...value } : value, kind);
}

/** An embedded record the document's catalogs hold that fails its schema. A record that names its own `$schema` or `id` is the document schema's to report, as before, and counts as valid here. */
export function embeddedRecordInvalid(kind: CatalogKind, id: string, record: unknown): boolean {
	if (object(record) && (Object.hasOwn(record, '$schema') || Object.hasOwn(record, 'id'))) return false;
	return !recordIssues(kind, id, record).valid;
}

/** Whether `reference` resolves to a record that is not an embedded record failing its schema (a registered record always counts). */
export function resolvesToValidRecord(document: unknown, kind: CatalogKind, reference: unknown, options: CatalogOptions & { group?: string } = {}): boolean {
	const found = resolveReference(document, kind, reference, options);
	return !!found && !(found.origin === 'document' && embeddedRecordInvalid(kind, found.id, found.record));
}
