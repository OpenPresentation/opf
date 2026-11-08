// RR-105: a slide's background artwork never draws a stroke inside the frame of a native chart on that slide. PowerPoint lays a
// native chart's plot out itself (the bars, labels and data-label room differ a little from the preview), so a ring or arrow drawn
// in the picture to point at a bar lands on the bar in the preview and beside it in PowerPoint (the v0.33 PowerPoint qualification
// found data-story-academy slides 3 and 4). Checked for every example deck whose background is an SVG in the slide's 1280 x 720 frame.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gallery } from '@openpresentation/gallery';
import { composeSlide } from '../dist/composition.js';
import { resolveSlideContext } from '../dist/index.js';

const examples = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../examples');
const decks = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? decks(file) : entry.name.endsWith('.opf.json') ? [file] : [];
});

/** The stroked paths of an SVG in the slide frame, each with the bounding box of its coordinates. */
export function strokedPaths(svg) {
  if (!/viewBox="0 0 1280 720"/.test(svg)) return [];
  return [...svg.matchAll(/<path\b[^>]*>/g)].map(([tag]) => tag).filter((tag) => /\bstroke="(?!none)[^"]+"/.test(tag)).map((tag) => {
    const numbers = (tag.match(/\bd="([^"]*)"/)?.[1].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const xs = numbers.filter((_, index) => index % 2 === 0), ys = numbers.filter((_, index) => index % 2 === 1);
    return { name: tag.slice(0, 60), x: Math.min(...xs), y: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  });
}

const backgroundSvg = (deck, slide) => {
  const src = slide.design?.background?.src;
  if (typeof src !== 'string' || !src.startsWith('asset:')) return undefined;
  const asset = deck.assets?.[src.slice(6)];
  const data = typeof asset === 'string' ? asset : asset?.src;
  if (typeof data !== 'string' || !data.startsWith('data:image/svg+xml')) return undefined;
  const body = data.slice(data.indexOf(',') + 1);
  return /;base64,/.test(data.slice(0, data.indexOf(',') + 1)) ? Buffer.from(body, 'base64').toString('utf8') : decodeURIComponent(body);
};

test('RR-105: no example draws background strokes inside a native chart', () => {
  let checked = 0;
  const problems = [];
  for (const file of decks(examples)) {
    const deck = JSON.parse(readFileSync(file, 'utf8'));
    for (const [index, slide] of (deck.slides ?? []).entries()) {
      if (!JSON.stringify(slide).includes('"chart"')) continue;
      const svg = backgroundSvg(deck, slide);
      if (!svg) continue;
      const context = resolveSlideContext(deck, index, { catalogs: [gallery] });
      const charts = composeSlide(context.slide, context.options).items.filter((item) => item.field === 'chart');
      checked += charts.length;
      for (const chart of charts) {
        const { x, y, width, height } = chart.box;
        for (const stroke of strokedPaths(svg)) {
          if (stroke.right > x && stroke.x < x + width && stroke.bottom > y && stroke.y < y + height) problems.push(`${path.relative(examples, file)} slide ${index + 1}: ${stroke.name}`);
        }
      }
    }
  }
  assert.ok(checked >= 2, 'the academy deck’s two chart slides are checked');
  assert.deepEqual(problems, []);
});

test('RR-105: strokedPaths reads absolute path coordinates and skips fills', () => {
  const svg = '<svg viewBox="0 0 1280 720"><path d="M10 20C30 40 50 60 70 80" stroke="#E4521B"/><path d="M0 0L5 5" fill="#fff" stroke="none"/></svg>';
  assert.deepEqual(strokedPaths(svg).map(({ x, y, right, bottom }) => [x, y, right, bottom]), [[10, 20, 70, 80]]);
});
