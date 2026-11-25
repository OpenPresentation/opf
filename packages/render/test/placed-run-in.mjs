import assert from 'node:assert/strict';
import {defaultCatalog, toSvg} from './catalog-harness.mjs';

// opf#1469: a deck whose texts sit in two named cells and open with a short "Label:" draws (it used to stop with "Cannot read properties
// of undefined (reading 'some')"): the label bold, the rest of the text as written.
const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const placed = {name: 'Placed', language: 'en-US', slides: [{blocks: [{region: 'top:start', text: 'a: b'}, {region: 'bottom:end', text: 'c'}]}]};
const second = {name: 'Placed', language: 'en-US', slides: [{blocks: [{region: 'top:start', text: 'Term: a longer definition that the slide sets beside it'}, {region: 'bottom:end', text: 'Other: more'}, {region: 'bottom:start', text: 'c'}]}]};
const texts = (svg) => [...svg.matchAll(/<(?:tspan|text)\b([^>]*)>([^<]*)<\/(?:tspan|text)>/g)].map(([, a, text]) => ({...attrs(a), text}));
for (const [deck, label, rest] of [[placed, 'a:', ' b'], [second, 'Term:', ' a longer definition that the slide sets beside it']]) {
  const [svg] = toSvg(deck, {catalogs: [defaultCatalog]});
  const drawn = texts(svg);
  const head = drawn.find((entry) => entry.text === label);
  assert.ok(head, `${label} is drawn as its own run`);
  assert.equal(head['font-weight'], '700', `${label} is bold`);
  assert.ok(drawn.some((entry) => entry.text === rest || rest.startsWith(entry.text)), `${rest} is drawn after it`);
}
assert.doesNotThrow(() => toSvg({...placed, slides: [{blocks: [{region: 'top:start', text: 'a: b'}, {region: 'bottom:end', text: 'c'}]}]}, {catalogs: [defaultCatalog], trace: true}));
console.log('placed run-in heading in the preview: ok');
