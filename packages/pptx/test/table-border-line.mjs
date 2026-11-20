// A cell border is a Line: 'none' writes no fill on that edge, and a line without a color or a width takes the table rule's own.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { toPptx, fromPptx } from '../dist/index.js';
const deck = (borders) => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Bookings', table: { columns: ['Region', 'Bookings'], rows: [[{ value: 'North', style: { borders } }, 42], ['South', 31]] } }] });
const cellEdges = async (borders) => {
  const bytes = await toPptx(deck(borders), {}), slide = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const cell = slide.split('<a:tc>').find((part) => part.includes('>North<'));
  return { bytes, edge: (name) => new RegExp(`<a:${name}\\b[^>]*>[\\s\\S]*?</a:${name}>`).exec(cell)?.[0] };
};
test("'none', partial and whole cell borders export natively and import as valid borders", async () => {
  const { bytes, edge } = await cellEdges({ bottom: 'none', top: { dash: 'dash' }, left: { width: 3 }, right: { color: '#C01234', width: 2 } });
  assert.match(edge('lnB'), /w="0"[^>]*><a:noFill\/>/);
  // No color: the scheme's border neutral; no width: one slide pixel (9525 EMU at the default slide size).
  assert.match(edge('lnT'), /w="9525"/); assert.match(edge('lnT'), /<a:prstDash val="dash"\/>/); assert.doesNotMatch(edge('lnT'), /noFill|NaN|undefined/);
  assert.match(edge('lnL'), /w="28575"/); assert.doesNotMatch(edge('lnL'), /noFill|NaN|undefined/);
  assert.match(edge('lnR'), /w="19050"/); assert.match(edge('lnR'), /C01234/i);
  // An unchanged export imports the borders as the document wrote them.
  const back = await fromPptx(bytes, {});
  assert.deepEqual(back.slides[0].table.rows[0][0].style.borders, { bottom: 'none', top: { dash: 'dash' }, left: { width: 3 }, right: { color: '#C01234', width: 2 } });
});
