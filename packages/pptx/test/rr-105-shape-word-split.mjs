// RR-105 (coverage finding 21): a one-word label wider than a small shape's text rectangle is one line in the preview, so the PPTX writes
// its shape's text unwrapped (a:bodyPr wrap="none", the insets kept): PowerPoint then draws the word whole, centered on the text
// rectangle, instead of breaking it ("Mite r"). A shape whose text fits keeps wrap="square". Import reads no dropped property.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx, toSvg, fromPptx} from './helpers/default-catalog.mjs';

const triangle = text => ({shape: 'triangle', fill: 'none', stroke: {color: 'dark2', width: 10}, text});
const deck = () => ({language: 'en-US', design: {background: 'light1'}, slides: [{title: 'Shapes', composition: {mode: 'grid', columns: 6}, blocks: [triangle('Miter'), triangle('Round'), {shape: 'rect', fill: 'none', stroke: {color: 'dark2', width: 8}, text: 'Single'}]}]});
const bodyOf = (xml, name) => new RegExp(`name="${name}"[\\s\\S]*?<a:bodyPr\\b([^>]*)>`).exec(xml)?.[1] ?? '';

test('an unwrapped one-word label is written wrap="none"; a fitting one keeps wrap="square"', async () => {
  const source = deck(), diagnostics = [];
  const xml = strFromU8(unzipSync(await toPptx(source))['ppt/slides/slide1.xml']);
  // anchorCtr="1" centers the unwrapped line on the text rectangle and tells import the wrap is the engine's, not an author's.
  for (const index of [0, 1]) assert.match(bodyOf(xml, `OPF shape slides.0.blocks.${index}.shape`), /\bwrap="none"[^>]*\banchorCtr="1"/);
  assert.match(bodyOf(xml, 'OPF shape slides.0.blocks.2.shape'), /\bwrap="square"[^>]*\banchorCtr="0"/);
  // The preview draws each word whole.
  const svg = toSvg(source, 1);
  for (const word of ['Miter', 'Round', 'Single']) assert.ok(svg.includes(`>${word}<`), word);
  const imported = await fromPptx(await toPptx(source), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.deepEqual(diagnostics.filter(diagnostic => diagnostic.code === 'shape-property-dropped'), []);
  assert.deepEqual(imported.slides[0].blocks.map(block => block.text), ['Miter', 'Round', 'Single']);
});
