// OPF 0.15: core registers no catalog, and a library (renderer, editor, exporter) resolves only what its host registers.
// The ecosystem checks that hand a deck to an engine without registering a catalog (browser pages, installed consumers)
// give it the records it names first, as a saved deck carries them: `withRecords(deck)` embeds every gallery record the
// deck references (the gallery of this checkout's packages/gallery, RR-78). Not a test.
import {embed} from '../packages/javascript/dist/index.js';
import {gallery} from '@openpresentation/gallery';

/** The registered catalogs of a host that registers the gallery. */
export const catalogs = Object.freeze([gallery]);

/** `deck` with every record it references embedded; throws when a reference resolves nowhere. */
export function withRecords(deck) {
  const {document, unresolved} = embed(deck, {catalogs});
  if (unresolved.length) throw new Error(`ecosystem deck: ${unresolved.map((entry) => entry.message).join('; ')}`);
  return document;
}
