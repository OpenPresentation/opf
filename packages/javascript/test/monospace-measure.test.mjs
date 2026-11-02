// Without a host measurement, a monospace family is measured on its 0.6 em cells: the proportional estimate was about 15%
// short for code, so a line it accepted ran past its panel once drawn in Roboto Mono (layout sampler, code layout).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutCode, measureText, textWidthMeasurer } from '../dist/composition.js';

const LINE = 'const total = items.reduce((sum, item) => sum + item.value, 0);';

test('a monospace family measures 0.6 em per ASCII character; other families keep the estimate', () => {
  for (const fontFamily of ['monospace', 'Roboto Mono, monospace', '"JetBrains Mono"', 'Courier New', 'Consolas']) {
    assert.ok(Math.abs(textWidthMeasurer({ fontFamily, fontWeight: 400, italic: false })(LINE, 18) - LINE.length * 0.6 * 18) < 1e-6, fontFamily);
  }
  for (const fontFamily of ['Aptos', 'Monotype Corsiva', 'Georgia, monospace']) {
    assert.equal(textWidthMeasurer({ fontFamily, fontWeight: 400, italic: false })(LINE, 18), measureText(LINE, 18), fontFamily);
  }
});

test('a code line wider than its panel wraps inside it', () => {
  const panel = { x: 0, y: 0, width: 660, height: 400 };
  const code = layoutCode({ source: `${LINE}\nconsole.log(total);`, language: 'javascript' }, panel, { fontFamilies: { code: 'Roboto Mono, monospace' } });
  const body = code.parts.find((part) => part.role === 'body');
  assert.ok(body.fit.lines.length > 2, 'the long line wraps');
  for (const line of body.fit.lines) assert.ok(line.length * 0.6 * body.fit.fontSize <= panel.width - 36 + 1, `"${line}" fits the panel`);
});
