// RR-105 (coverage finding 27): the preview draws the marker of an empty cited or footnoted run, after the text before it, at core's
// fragment position, so the note listed at the slide foot is tied to the body.
import assert from 'node:assert/strict';
import { composeSlide } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

const deck = {
  references: [{ id: 'itf', text: 'International Transport Forum, Port Outlook 2025.' }],
  slides: [
    { title: 'Cite', text: ['Ports grew 3 percent', { text: '', cite: 'itf' }, '.'] },
    { title: 'Footnote', text: ['Ports grew 3 percent', { text: '', footnote: 'Unaudited.' }, '.'] },
  ],
};
for (const index of [0, 1]) {
  const svg = toSvg(deck, index + 1, { trace: true });
  const markers = [...svg.matchAll(/<tspan[^>]*data-opf-segment="marker"[^>]*>([^<]*)<\/tspan>/g)].map(match => match[1]);
  assert.deepEqual(markers, [String(index + 1)], `slide ${index + 1}: one marker`);
  const core = composeSlide(deck.slides[index], { presentation: deck, slideIndex: index });
  const fragments = core.items.find(item => item.field === 'text').text.richLines.flatMap(line => line.fragments);
  const at = fragments.findIndex(fragment => fragment.kind === 'marker');
  assert.ok(at > 0 && /percent$/u.test(fragments[at - 1].text) && fragments[at + 1]?.text === '.', `slide ${index + 1}: the marker follows "percent"`);
  assert.match(svg, new RegExp(`data-opf-footnotes="slides\\.${index}"`), `slide ${index + 1}: the footnote area is drawn`);
}
console.log('RR-105 empty cite marker: preview checks passed.');
