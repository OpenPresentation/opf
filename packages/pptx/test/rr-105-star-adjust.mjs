// RR-105 finding 20: star24 and star32 write the author's inner radius (a:gd adj) and import it back, as every other star does.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx} from '../dist/index.js';

const decoder = new TextDecoder();
test('star16, star24 and star32 keep an authored adj through export and import', async () => {
  const doc = {design: {background: 'light1'}, slides: [{title: 'Stars', blocks: ['star16', 'star24', 'star32'].map((shape) => ({shape, adjust: {adj: 0.319}}))}]};
  const diagnostics = [];
  const bytes = await toPptx(doc, {onDiagnostic: (d) => diagnostics.push(d)});
  const xml = decoder.decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
  for (const shape of ['star16', 'star24', 'star32']) assert.match(xml, new RegExp(`<a:prstGeom prst="${shape}"><a:avLst><a:gd name="adj" fmla="val 31900"/></a:avLst>`), shape);
  assert.ok(!diagnostics.some((d) => /adjust/.test(d.code ?? '')), JSON.stringify(diagnostics));
  const blocks = (await fromPptx(bytes)).slides[0].blocks ?? [];
  const stars = blocks.filter((block) => /^star/.test(block.shape ?? ''));
  assert.deepEqual(stars.map((block) => [block.shape, block.adjust?.adj]), [['star16', 0.319], ['star24', 0.319], ['star32', 0.319]]);
});
