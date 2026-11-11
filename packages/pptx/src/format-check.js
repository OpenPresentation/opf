// The one question the provenance and import code asks core: does this value satisfy the OPF format (the schema, and the
// checks that make a deck structurally usable)? It is core's cheap `format` category: no layout is built, so it is safe on
// every import and export path.
import {validate} from '@openpresentation/opf';

/** Core's `format` report for a deck or a fragment (`findings`, `valid`). */
export const checkFormat = value => validate(value, {only: ['format']});

/** True when the value has no `format` error. */
export const isValidFormat = value => checkFormat(value).valid;

const withoutMarkers = (value, nativeObjects) => Array.isArray(value) ? value.map(entry => withoutMarkers(entry, nativeObjects))
  : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('_opf') || (nativeObjects && !nativeObjects.has(value))).map(([key, entry]) => [key, withoutMarkers(entry, nativeObjects)]))
  : value;

const objectsWithin = value => {
  const objects = new WeakSet();
  const visit = entry => {
    if (entry === null || typeof entry !== 'object' || objects.has(entry)) return;
    objects.add(entry);
    for (const child of Object.values(entry)) visit(child);
  };
  visit(value);
  return objects;
};

/**
 * The `format` report of a document that is still being imported. Until the stored references are applied, its text runs carry the
 * reader's transient markers (`_opfScheme`, `_opfInherited`; run-colors.js reads and removes them). They are not part of the document,
 * and a text run takes no unknown key, so the check reads the document without them. When a candidate mixes native values
 * with stored authored values, nativeSource restricts this exception to objects from the native parser. Unknown keys in a
 * restored record still fail the ordinary schema. Neither the native values nor the candidate are changed by this view.
 */
export const checkImportedFormat = (value, nativeSource) => checkFormat(withoutMarkers(value, nativeSource === undefined ? undefined : objectsWithin(nativeSource)));
