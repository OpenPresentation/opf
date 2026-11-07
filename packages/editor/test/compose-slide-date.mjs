import assert from 'node:assert/strict';
import {resolveSlideContext} from '@openpresentation/opf';
import {createEditorSession} from '../dist/index.js';

// The session composes a slide with the host's `date` in core's slide resolution, as the renderer does. LH-164 decides a message slide's
// accent surface by composing the slide, and a `date: true` footer field without a date fails that composition (overflow: 'error'), so a
// session that added the date only afterwards kept the plain surface the renderer does not draw (opf#1072, test-furniture-fields-browser).
const deck = {
  design: {fontScheme: 'roboto', footer: {left: {date: true, dateFormat: 'MMMM d, yyyy'}}},
  slides: [
    {title: 'Opening', text: 'The title still counts.'},
    {title: 'Second slide', text: 'Authored second body.', composition: {minFontSize: 32, overflow: 'error'}},
    {title: 'Third slide', text: 'Authored third body.', composition: {minFontSize: 32, overflow: 'error'}},
  ],
};
const date = '2026-09-22';
const session = createEditorSession(deck, {rejectInvalid: true});
const surfaces = deck.slides.map((_, index) => resolveSlideContext(deck, index, {date}).resolved.messageSurface);
assert.ok(surfaces.some(Boolean), 'the deck has a message slide on the accent surface with the host date');
assert.ok(deck.slides.some((_, index) => surfaces[index] && !resolveSlideContext(deck, index, {}).resolved.messageSurface), 'and one whose surface needs the date');
for (const [index, surface] of surfaces.entries()) {
  const geometry = session.composeSlide(index, {date});
  assert.deepEqual(geometry.surface, surface, `slide ${index + 1}: the session composes the surface the engines draw`);
  assert.ok(geometry.furniture.parts.some(part => part.field === 'date' && part.text.includes('2026')), `slide ${index + 1}: the date field draws the host date`);
}
console.log('Session composition passes the host date to the slide resolution: message surfaces match the engines.');
