import assert from 'node:assert/strict';
import {resolvePresentation, toSvg} from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import { loadFonts } from '../dist/fonts-node.js';
const fonts = (await loadFonts({pack: 'base'})).registry;
for (const count of [1, 2, 4, 8]) {
  for (const dimensions of [{ width: 1280, height: 720 }, { width: 540, height: 960 }]) {
    const deck = { design: { dimensions: {widthInches: dimensions.width / 96, heightInches: dimensions.height / 96}, fontScheme: 'roboto' }, slides: [{
      title: 'A timeline with bounded labels',
      blocks: [{ timeline: { events: Array.from({ length: count }, (_, i) => ({ when: `Q${i + 1}`, what: `Milestone ${i + 1}`, description: 'Keep every label inside its allocated space.' })) } }],
    }] };
    const options = { trace: true, fonts: {textMeasurement: fonts.textMeasurement} };
    const svg = toSvg(deck, 1, options);
    const bound = resolvePresentation(deck, options).slides[0];
    assert.equal(bound.geometry.width, dimensions.width, 'The authored inches preserve the exact pixel width');
    assert.equal(bound.geometry.height, dimensions.height, 'The authored inches preserve the exact pixel height');
    const box = bound.geometry.items.find(item => item.field === 'timeline').box;
    const circles = [...svg.matchAll(/<circle\b([^>]*)>/g)];
    assert.equal(circles.length, count);
    for (const [, attributes] of circles) {
      const cx = Number(/cx="([^"]+)"/.exec(attributes)[1]), r = Number(/r="([^"]+)"/.exec(attributes)[1]);
      assert.ok(cx - r >= box.x && cx + r <= box.x + box.width, 'Timeline markers must stay inside their block');
    }
    let labels = 0;
    for (const [, attributes, text] of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
      if (!attributes.includes('.timeline.events.')) continue;
      labels++;
      const x = Number(/\bx="([^"]+)"/.exec(attributes)[1]);
      // The SVG pins the shaped advance with textLength; it can differ from remeasuring a run at
      // a guessed weight (for example a 400-weight description vs a 500-weight event time).
      const width = Number(/textLength="([^"]+)"/.exec(attributes)?.[1]);
      assert.ok(Number.isFinite(x) && Number.isFinite(width) && width > 0 && text.length > 0, 'Timeline text pins its nonempty measured advance');
      const anchor = /(?:^|\s)text-anchor="([^"]+)"/.exec(attributes)?.[1] ?? 'start';
      const direction = /(?:^|\s)direction="([^"]+)"/.exec(attributes)?.[1] ?? bound.geometry.direction ?? 'ltr';
      assert.ok(['start', 'middle', 'end'].includes(anchor), 'Timeline text has a known SVG anchor');
      assert.ok(['ltr', 'rtl'].includes(direction), 'Timeline text has a known direction');
      // A vertical rail uses start-aligned labels; a horizontal band centers them. Test the full measured advance interval for either.
      const factor = anchor === 'middle' ? 0.5 : anchor === 'start' ? (direction === 'rtl' ? 1 : 0) : (direction === 'rtl' ? 0 : 1);
      assert.ok(x - width * factor >= box.x - 0.1, 'First event text must not spill past the left edge');
      assert.ok(x + width * (1 - factor) <= box.x + box.width + 0.1, 'Last event text must not spill past the right edge');
    }
    assert.ok(labels >= count, 'Every event must render measurable label text');
  }
}
console.log('Timelines passed: 1/2/4/8 events, wide and portrait slides, measured text and marker containment.');
