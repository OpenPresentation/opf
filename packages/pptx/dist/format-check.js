// The one question the provenance and import code asks core: does this value satisfy the OPF format (the schema, and the
// checks that make a deck structurally usable)? It is core's cheap `format` category: no layout is built, so it is safe on
// every import and export path.
import {validate} from '@openpresentation/opf';

/** Core's `format` report for a deck or a fragment (`findings`, `valid`). */
export const checkFormat = value => validate(value, {only: ['format']});

/** True when the value has no `format` error. */
export const isValidFormat = value => checkFormat(value).valid;
