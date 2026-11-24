// A preset's paths are painted fills first, then lines (shapes.js renderShapeBlock): chartX, chartStar and chartPlus list their lines
// first and the filled square after them, and PowerPoint draws the lines over the square. Before, the square's fill hid the lines.
import assert from 'node:assert/strict';
import { composeSlide } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

const deck = (blocks) => ({ name: 'Chart shapes', language: 'en-US', slides: [{ title: 'Chart shapes', blocks }] });
const shapeOf = (preset) => composeSlide(deck([{ shape: preset }]).slides[0], { presentation: deck([{ shape: preset }]) }).items.find((entry) => entry.field === 'shape').shape;
const elementAt = (svg, d, kind) => {
  const pattern = new RegExp(`<path [^>]*d="${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'g');
  for (const match of svg.matchAll(pattern)) {
    const tag = match[0];
    if (kind === 'line' && /\bstroke="#/.test(tag) && /fill="none"/.test(tag)) return match.index;
    if (kind === 'fill' && /\bfill="#/.test(tag) && !/\bstroke=/.test(tag)) return match.index;
  }
  return -1;
};

for (const preset of ['chartX', 'chartStar', 'chartPlus']) {
  const shape = shapeOf(preset);
  const [lines, square] = shape.paths;
  assert.ok(lines.stroke && lines.fill === 'none', `${preset}: the first path is the lines, stroked and not filled`);
  assert.ok(!square.stroke && square.fill !== 'none', `${preset}: the second path is the square, filled and not stroked`);
  const svg = toSvg(deck([{ shape: preset }]), 1);
  const line = elementAt(svg, lines.d, 'line'), fill = elementAt(svg, square.d, 'fill');
  assert.ok(line >= 0, `${preset}: the lines are stroked`);
  assert.ok(fill >= 0, `${preset}: the square is filled`);
  assert.ok(line > fill, `${preset}: the lines are painted after the square's fill, so the fill does not cover them`);
}

// cloudCallout: each bubble's whole outline shows through the next, overlapping bubble's fill, as in PowerPoint.
{
  const shape = shapeOf('cloudCallout');
  const svg = toSvg(deck([{ shape: 'cloudCallout' }]), 1);
  const lastFill = Math.max(...shape.paths.filter((path) => path.fill !== 'none').map((path) => elementAt(svg, path.d, 'fill')));
  const firstLine = Math.min(...shape.paths.filter((path) => path.stroke).map((path) => elementAt(svg, path.d, 'line')));
  assert.ok(lastFill >= 0 && firstLine > lastFill, 'every fill of cloudCallout is painted before any of its lines');
}

console.log('preset path paint order: ok');
