import { gallery } from '@openpresentation/gallery';
// OPF 0.35 (list columns by default): the long lists of the long-list goldens, shared by core's composition goldens and the render
// goldens' feature slides. Not a test.

const SHORT = ['Fast acknowledgment', 'Scale on queue depth', 'Append-only ledger', 'Replay safely', 'Dedupe keys', 'Idempotent writes', 'Cheap retries', 'Bounded queue',
  'Typed events', 'Schema registry', 'Dead letters', 'Backpressure', 'Rate limits', 'Audit trail', 'Blue-green deploys', 'Canary checks'];
const LONG = 'a sentence long enough to wrap onto a second line in a narrow column of the slide';
/** The lists: 7, 9, 12 and 16 short entries, and 8 long ones. */
export const LONG_LISTS = [
  ...[7, 9, 12, 16].map((count) => [`short-${count}`, SHORT.slice(0, count)]),
  ['long-8', Array.from({ length: 8 }, (_, index) => `Step ${index + 1}: ${LONG}`)],
];
/** A record with a lead above a body and an aside beside it (the render goldens embed it as `lead-aside`). */
export const LEAD_ASIDE = {
  name: 'Lead and aside', direction: 'column',
  regions: [
    { name: 'title' },
    { name: 'lead', accepts: ['text'], role: 'supporting', max: 1 },
    { direction: 'row', regions: [{ name: 'body', accepts: ['list', 'text'], size: 2 }, { name: 'aside', accepts: ['text'], role: 'supporting', max: 1 }] },
  ],
};
/** Each list in each placement: `{ key, slide, layout }`, `layout` the record (undefined for the automatic slide). */
export function longListCases() {
  const cases = [];
  for (const [name, items] of LONG_LISTS) {
    cases.push({ key: `body ${name}`, layout: gallery.layouts.text, slide: { title: 'The relay, end to end', blocks: [{ items }] } });
    cases.push({ key: `lead-aside ${name}`, layout: LEAD_ASIDE, slide: { title: 'The relay, end to end', blocks: [{ text: 'Every request is acknowledged before work starts.', region: 'lead' }, { items, region: 'body' }, { text: 'Workers are stateless.', region: 'aside' }] } });
    cases.push({ key: `two-column ${name}`, layout: gallery.layouts['two-column'], slide: { title: 'The relay, end to end', blocks: [{ items }, { text: 'The gateway only validates and enqueues; workers are stateless and scale on queue depth.' }] } });
    cases.push({ key: `weighted-row ${name}`, slide: { title: 'The relay, end to end', composition: { mode: 'row', weights: [2, 1] }, blocks: [{ text: 'The gateway only validates and enqueues; workers are stateless and scale on queue depth.' }, { items }] } });
  }
  // The automatic weighted row with the list in the wide cell too.
  for (const [name, items] of LONG_LISTS) cases.push({ key: `weighted-row-wide ${name}`, slide: { title: 'The relay, end to end', composition: { mode: 'row', weights: [2, 1] }, blocks: [{ items }, { text: 'Workers are stateless and scale on queue depth.' }] } });
  return cases;
}
