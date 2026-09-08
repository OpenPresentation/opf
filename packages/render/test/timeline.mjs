import assert from 'node:assert/strict';
import { renderSvg, resolvePresentation } from '../dist/svg.js';
import { loadBundledFontRegistry } from '../dist/fonts-node.js';
const fonts = await loadBundledFontRegistry();
for (const count of [1, 2, 4, 8]) {
  for (const dimensions of [{ width: 1280, height: 720 }, { width: 540, height: 960 }]) {
    const deck = { design: { dimensions, fontScheme: 'roboto' }, slides: [{
      title: 'A timeline with bounded labels',
      blocks: [{ timeline: { events: Array.from({ length: count }, (_, i) => ({ when: `Q${i + 1}`, what: `Milestone ${i + 1}`, description: 'Keep every label inside its allocated space.' })) } }],
    }] };
    const options = { trace: true, textMeasurement: fonts.textMeasurement };
    const svg = renderSvg(deck, options);
    const bound = resolvePresentation(deck, options).slides[0];
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
      const x = Number(/\bx="([^"]+)"/.exec(attributes)[1]), size = Number(/font-size="([^"]+)"/.exec(attributes)[1]);
      const width = fonts.textMeasurement.measure(text, size, { fontFamily: 'Roboto', fontWeight: 500 });
      assert.ok(x - width / 2 >= box.x - 0.1, 'First event text must not spill past the left edge');
      assert.ok(x + width / 2 <= box.x + box.width + 0.1, 'Last event text must not spill past the right edge');
    }
    assert.ok(labels >= count, 'Every event must render measurable label text');
  }
}
console.log('Timelines passed: 1/2/4/8 events, wide and portrait slides, measured text and marker containment.');
