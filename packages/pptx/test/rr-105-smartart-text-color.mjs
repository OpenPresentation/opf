// RR-105 final COM: Basic Pyramid uses revTx for some on-shape labels on light slides.
// Those labels must share the readable shape text color; OPF's own beside-shape labels retain the slide text color.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx} from './helpers/default-catalog.mjs';
import {smartArtColorsXml} from '../src/smart-art.js';

const textFill = (xml, name) => new RegExp(`<dgm:styleLbl name="${name}">[\\s\\S]*?<dgm:txFillClrLst[^>]*>([\\s\\S]*?)</dgm:txFillClrLst>`).exec(xml)?.[1];
for (const background of ['light1', 'dark1']) {
  const deck = {design: {background}, slides: [
    {layout:'pyramid', title:'What the pilot builds on', items:['Goal','Evidence','Pilot teams','Shared baseline']},
  ]};
  const parts=unzipSync(new Uint8Array(await toPptx(deck)));
  const first=strFromU8(parts['ppt/diagrams/colors1.xml']);
  assert.equal(textFill(first,'revTx'),textFill(first,'node1'),`${background}: every native-pyramid node uses its readable on-shape color`);
  const second=smartArtColorsXml({fill:{slot:'accent1'},line:{slot:'bg1'},background:{slot:'bg1'},text:{slot:'bg1'},arrow:{slot:'accent1'}}, undefined, false);
  assert.equal(textFill(second,'revTx'),'<a:schemeClr val="tx1"/>',`${background}: OPF beside-shape text retains the slide text color`);
}
console.log('Native SmartArt label colors match on light and dark slides; beside-shape text retains tx1.');