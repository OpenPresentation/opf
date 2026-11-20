import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {convert} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

const source=readFileSync(new URL('../../../scripts/native-acceptance/qualification/decks/smartart-arabic.opf.json',import.meta.url));
const document=JSON.parse(source),catalogs=[gallery],renderOptions={catalogs};

test('unchanged three-slide Arabic qualification input exports exact eager-font preview and PPTX bytes with demand fonts',async()=>{
 assert.equal(source.length,1077);
 assert.equal(createHash('sha256').update(source).digest('hex'),'f9ece76f6c2d0c223decf52e6f823371a5865c9444eb3a92def00051031e976d');
 const saved=structuredClone(document),options={pack:'office',substitutionPolicy:'visual'};
 const demand=await loadFonts({...options,scripts:'auto',presentation:document,renderOptions});
 const whole=await loadFonts({...options,scripts:['Arab']});
 for(const format of ['svg','png','pptx']){
  if(format==='pptx'){
   assert(!demand.registry.describeFaces().some(face=>face.family==='Intos'),'Arabic preview did not eagerly prepare an unused Latin role');
   assert.throws(()=>demand.textMeasurement.measure('A',20,{fontFamily:'Intos',fontWeight:400}),{code:'font-unavailable'},'An unrelated unprepared face still refuses');
  }
  const request={catalogs,date:'2026-11-11',format,...(format==='svg'?{text:'paths'}:{})};
  const actual=await convert(document,{...request,fonts:demand}),expected=await convert(document,{...request,fonts:whole});
  assert.equal(actual.files.length,format==='pptx'?1:3,format+': every source slide');
  assert.deepEqual(actual.files.map(file=>file.bytes),expected.files.map(file=>file.bytes),format+': full actual public output');
 }
 assert.deepEqual(document,saved,'No source content, layout or language rewrite');
 assert.deepEqual(demand.pending(document,renderOptions),[]);
});
