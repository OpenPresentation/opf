// RR-105 (supervisor decision 2026-11-12): a continuation page is never drawn smaller than v0.33.0 drew it. Its body grows to fill the
// slide as an unpaginated slide's does; LH-144 holds a later page only to the size every later page reaches (never under the first page's),
// so a last page does not read larger than its siblings. No line of these pages runs past the 70-character reading measure.
import assert from 'node:assert/strict';
import { paginate } from '@openpresentation/opf/pagination';
import { templateDeck } from './layout-template-fixture.mjs';
import { toSvg } from './catalog-harness.mjs';

// The body size of pages 2 to 4 of each `paginated <id> 5 long` deck as v0.33.0 drew it (supervisor sheets, measurements.csv).
const V033 = { pyramid: 28, matrix: 30.667, cycle: 30.667, 'vertical-flow': 30.667, chevrons: 25.333 };
const MEASURE = 70;
for (const [id, before] of Object.entries(V033)) {
  const { keys, deck } = templateDeck(id), index = keys.indexOf(`${id} 5 long`);
  assert.ok(index >= 0, `${id}: the 5 long sample`);
  const { presentation } = paginate({ ...deck, slides: [deck.slides[index]] });
  assert.equal(presentation.slides.length, 4, `${id}: four pages`);
  let previous = 0;
  for (let page = 0; page < presentation.slides.length; page++) {
    const svg = toSvg(presentation, page + 1);
    const lines = [...svg.matchAll(/<text\b[^>]*font-size="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)].map((match) => ({ size: Number(match[1]), text: match[2].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, 'x') }));
    // The body: every line under the heading sizes that carries words (not a slide number or a marker).
    const body = lines.filter((line) => line.size < 36 && line.text.trim().length > 6);
    assert.ok(body.length, `${id} page ${page + 1}: a body`);
    const smallest = Math.min(...body.map((line) => line.size));
    if (page > 0) assert.ok(smallest >= before - 0.01, `${id} page ${page + 1}: body at ${smallest} px, v0.33.0 drew ${before} px`);
    assert.ok(smallest >= previous - 0.01, `${id} page ${page + 1}: body at ${smallest} px, under the page before (${previous} px)`);
    previous = page > 0 ? smallest : previous;
    for (const line of body) assert.ok([...line.text].length <= MEASURE, `${id} page ${page + 1}: "${line.text}" runs past ${MEASURE} characters`);
  }
}
console.log(`RR-105 continuation sizes: ${Object.keys(V033).length} paginated template decks keep at least their v0.33.0 body size within the reading measure.`);
