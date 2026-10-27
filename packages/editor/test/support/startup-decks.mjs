// Decks for the editor startup benchmark (test/startup-perf-browser.mjs): the playground's own sample deck, read from its source so the
// benchmark follows it, and a large deck: the sample's slides once, then its ordinary slides over and over (the long draft that paginates
// appears once: fifty copies of it would measure pagination, not startup).
import { readFile } from 'node:fs/promises';

export async function playgroundDeck(source = new URL('../../examples/playground.js', import.meta.url)) {
  const text = await readFile(source, 'utf8');
  const start = text.indexOf('const startDeck = '), end = text.indexOf('\n};\n', start);
  if (start < 0 || end < 0) throw new Error('The playground sample deck (const startDeck = {...};) was not found.');
  return Function(`"use strict"; return (${text.slice(start + 'const startDeck = '.length, end + 2)});`)();
}

export function largeDeck(sample, slides = 300) {
  const ordinary = sample.slides.filter(slide => slide.id !== 'overflow');
  const pick = index => index < sample.slides.length ? sample.slides[index] : ordinary[index % ordinary.length];
  return { ...sample, name: `${slides} slides`, slides: Array.from({ length: slides }, (_, index) => ({ ...structuredClone(pick(index)), id: `slide-${index + 1}` })) };
}
