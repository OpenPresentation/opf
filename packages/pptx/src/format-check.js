// The one question the provenance and import code asks core: does this value satisfy the OPF format (the schema, and the
// checks that make a deck structurally usable)? It is core's cheap `format` category: no layout is built, so it is safe on
// every import and export path.
import {validate} from '@openpresentation/opf';

/** Core's `format` report for a deck or a fragment (`findings`, `valid`). */
export const checkFormat = value => validate(value, {only: ['format']});

/** True when the value has no `format` error. */
export const isValidFormat = value => checkFormat(value).valid;

const withoutMarkers = value => Array.isArray(value) ? value.map(withoutMarkers)
  : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('_opf')).map(([key, entry]) => [key, withoutMarkers(entry)]))
  : value;

/**
 * The `format` report of a document that is still being imported. Until the stored references are applied, its text runs carry the
 * reader's transient markers (`_opfScheme`, `_opfInherited`; run-colors.js reads and removes them). They are not part of the document,
 * and a text run takes no unknown key, so the check reads the document without them.
 */
export const checkImportedFormat = value => checkFormat(withoutMarkers(value));
