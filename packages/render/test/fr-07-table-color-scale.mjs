// FR-07: the preview draws the fills and text colors core computes for a table color scale (core table-color-scale.ts); a table without
// a scale draws as before.
import assert from 'node:assert/strict';
import { colorContrast, mixOklab } from '@openpresentation/opf/composition';
import { resolvePresentation, toSvg } from './catalog-harness.mjs';

const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map(([, a]) => attributesOf(a));
const table = { columns: ['Region', 'Q1', 'Q2'], rows: [['EMEA', 10, 20], ['APAC', 30, 40], ['AMER', 'n/a', { value: 25, style: { fill: '#FF00FF' } }]] };
const deck = (design, extra) => ({ design: { fontScheme: 'roboto', ...design }, slides: [{ title: 'Scores', table: { ...table, ...extra } }] });
let checks = 0;

for (const design of [{}, { theme: 'classic', variant: 'dark1' }, { colorScheme: 'pastel-red' }]) {
  const input = deck(design, { colorScale: { columns: ['Q1', 'Q2'] } });
  const svg = toSvg(input, 1, { trace: true }), colors = resolvePresentation(input).slides[0].design.colors;
  const rects = tags(svg, 'rect'), texts = tags(svg, 'text');
  const fill = (row, column) => rects.find((rect) => rect['data-opf-path'] === `slides.0.table.rows.${row}.${column}`)?.fill.toUpperCase();
  const ink = (row, column) => texts.find((text) => text['data-opf-path'] === `slides.0.table.rows.${row}.${column}`)?.fill.toUpperCase();
  assert.equal(fill(0, 0), colors.surface.toUpperCase(), 'an unnamed column keeps the surface');
  assert.equal(fill(0, 1), mixOklab(colors.surface, colors.primary, 0).toUpperCase(), 'the lowest number is the surface');
  assert.equal(fill(1, 2), colors.primary.toUpperCase().slice(0, 7), 'the highest number is the primary color');
  assert.equal(fill(0, 2), mixOklab(colors.surface, colors.primary, 1 / 3).toUpperCase());
  assert.equal(fill(2, 1), colors.surface.toUpperCase(), 'text is not shaded');
  assert.equal(fill(2, 2), '#FF00FF', 'a fill of its own wins');
  for (const [row, column] of [[0, 1], [0, 2], [1, 1], [1, 2]]) assert.ok(colorContrast(ink(row, column), fill(row, column)) >= 4.5, `text on ${fill(row, column)}`);
  checks += 7;
}

{
  const plain = toSvg(deck({}, {}), 1, { trace: true }), withNoNames = toSvg(deck({}, { colorScale: { columns: ['Region'] } }), 1, { trace: true });
  assert.equal(withNoNames, plain, 'a scale over a column of text draws the table as it was');
  checks += 1;
}
console.log(`FR-07 render: ${checks} checks`);
