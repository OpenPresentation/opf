import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {unzipSync,strFromU8} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {catalogs,toPptx,toSvg} from './helpers/default-catalog.mjs';

const document=JSON.parse(await readFile(new URL('../../../examples/technical/localized-chart-references.opf.json',import.meta.url),'utf8'));
const options={pack:'office',substitutionPolicy:'visual'};

test('the real localized reference example exports with only its needed faces and the same native XML as an explicit whole pack',async()=>{
  const demand=await loadFonts({...options,scripts:'auto',presentation:document,renderOptions:{catalogs}});
  const before=demand.registry.describeFaces(),files=[...demand.fontFiles];
  assert.deepEqual(before.map(face=>[face.family,face.weight,face.italic]),[['Arimo',400,false],['Arimo',700,false],['Montserrat',900,false]]);
  const bytes=await toPptx(document,{fonts:demand});
  assert.deepEqual(demand.fontFiles,files,'native preparation never loads the unrelated Montserrat 700 face');
  assert.deepEqual(demand.registry.describeFaces(),before);
  const whole=await loadFonts(options);
  assert.ok(whole.fontFiles.length>100,'whole-pack mode remains explicit');
  assert.deepEqual(bytes,await toPptx(document,{fonts:whole}),'complete native archive and all title styles/point sizes match');
  for(let slide=1;slide<=document.slides.length;slide++)assert.equal(toSvg(document,slide,{fonts:demand,text:'paths'}),toSvg(document,slide,{fonts:whole,text:'paths'}),'actual glyph geometry stays whole/demand exact on slide '+slide);
  const zip=unzipSync(bytes),german=strFromU8(zip['ppt/slides/slide2.xml']);
  assert.match(german,/<a:rPr\b[^>]*\blang="de-DE"[^>]*\bsz="4050"[^>]*\bb="1"/);
  assert.match(german,/<a:latin typeface="Arial Black"/,'the developer\'s native typeface is retained');
  assert.ok(!german.includes('typeface="Montserrat"'),'the measurement replacement never becomes the native authored typeface');
});
