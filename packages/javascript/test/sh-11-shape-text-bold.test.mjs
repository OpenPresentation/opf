// SH-11: a shape's text is fitted in the weight both engines draw it. The intense style draws bold text (PowerPoint's Intense Effect), so
// composition measures it bold: the preview's lines and PowerPoint's own wrap of the same bold runs break alike. Before SH-11 the text was
// fitted in the regular weight and drawn bold, so the bold lines ran past the shape's text rectangle in the preview and PowerPoint broke
// them elsewhere (COM evidence in the SH-11 pull request).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeSlide } from '../dist/composition.js';

// Bold glyphs measure 40% wider than regular ones, so the two weights break differently.
const textMeasurement = { measure: (text, size, style) => text.length * size * ((style?.fontWeight ?? 400) >= 700 ? 0.7 : 0.5) };
const compose = (style) => {
  const shapes = [{ shape: 'roundRect', style, text: 'Every team reviews the plan', x: 0.1, y: 0.3, width: 0.15, height: 0.3 }];
  const slide = { title: 'Shapes', blocks: [1, 2, 3].map(() => ({ shape: 'rect', style, text: 'Every team reviews the plan' })), shapes };
  const composition = composeSlide(slide, { presentation: { name: 'Shapes', slides: [slide] }, textMeasurement });
  return [composition.items.find((item) => item.field === 'shape'), composition.overlayShapes.find((entry) => entry.kind === 'shape')];
};

test('intense shape text is fitted bold, the weight it is drawn in; other styles stay regular', () => {
  const moderate = compose('moderate'), intense = compose('intense');
  // A shape block and an overlay shape, each in both styles.
  for (const [regular, bold] of moderate.map((item, index) => [item, intense[index]])) {
    assert.equal(regular.shape.textBold, false);
    assert.equal(bold.shape.textBold, true);
    assert.equal(regular.textStyle.fontWeight, 400);
    assert.equal(bold.textStyle.fontWeight, 700);
    // Every bold line, measured bold, fits the text rectangle the export hands PowerPoint.
    const limit = bold.shape.textBox.width + 1e-6;
    for (const line of bold.text.lines) assert.ok(textMeasurement.measure(line.trimEnd(), bold.text.fontSize, { fontWeight: 700 }) <= limit, `${bold.path}: "${line}" fits bold`);
    // The bold fit breaks elsewhere than the regular one: it was measured in its own weight.
    assert.notDeepEqual([bold.text.fontSize, bold.text.lines], [regular.text.fontSize, regular.text.lines], `${bold.path}: fitted bold`);
  }
});
