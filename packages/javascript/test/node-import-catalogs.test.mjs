// Registered catalogs must reach the import engine, not only post-import validation.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {installIsolatedCore} from '../../../scripts/isolated-core.mjs';

const bytes=reference=>Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from(reference)]);
const custom={source:'https://example.test/registered',layouts:{'host-only':{name:'Host only',regions:[{name:'body',accepts:['text'],flow:'column'}]}}};

test('Node open/convert import resolves default and registered host layouts, including signals and explicit empty catalogs',async()=>{
 const scratch=await mkdtemp(path.join(tmpdir(),'opf-import-catalogs-'));
 try{
  const modules=path.join(scratch,'node_modules'),core=await installIsolatedCore(modules),peer=path.join(modules,'@openpresentation/opf-pptx');
  await mkdir(peer,{recursive:true});
  await writeFile(path.join(peer,'package.json'),JSON.stringify({name:'@openpresentation/opf-pptx',version:'0.20.0',type:'module',main:'index.js'}));
  // The peer performs catalog-based layout recovery. A missing registry loses
  // the native layout and emits a finding, as the real importer does.
  await writeFile(path.join(peer,'index.js'),`
import {resolveReference} from '../opf/dist/browser.js';
export const toPptx=async()=>new Uint8Array();
export const inventoryTypefaces=()=>[];
export const fromPptx=async(input,options={})=>{
 const reference=new TextDecoder().decode(input.slice(4));
 const presentation={slides:[{text:'Native placeholder words'}],...(reference.startsWith('registered:')?{catalogs:{registered:{source:'https://example.test/registered'}}}:{})};
 const found=resolveReference(presentation,'layouts',reference,{catalogs:options.catalogs??[]});
 if(found)presentation.slides[0].layout=reference;
 else options.onDiagnostic?.({code:'unresolved-reference',path:'slides.0.layout',message:'Native layout cannot resolve in the import registry.'});
 return options.signals?{presentation,signals:{version:1}}:presentation;
};
`);
  const api=await import(pathToFileURL(path.join(core,'dist/index.js')).href);
  for(const signals of [false,true]){
   for(const {catalogs,reference} of [{catalogs:undefined,reference:'two-column'},{catalogs:[gallery],reference:'two-column'},{catalogs:[custom],reference:'registered:host-only'},{catalogs:[],reference:'two-column'}]){
    const result=await api.convert(bytes(reference),{format:'json',catalogs,signals});
    const deck=JSON.parse(Buffer.from(result.files[0].bytes).toString());
    assert.equal(deck.slides[0].text,'Native placeholder words');
    assert.equal(deck.slides[0].layout,catalogs?.length===0?undefined:reference);
    assert.equal(result.findings.some(item=>item.ruleId==='import/unresolved-reference'),catalogs?.length===0);
    if(signals)assert.equal(result.signals.version,1);
    const opened=await api.open(bytes(reference),{catalogs});
    assert.equal(opened.slides[0].layout,catalogs?.length===0?undefined:reference);
   }
   const defaults=await api.convert(bytes('two-column'),{format:'json',signals});
   assert.equal(JSON.parse(Buffer.from(defaults.files[0].bytes).toString()).slides[0].layout,'two-column','Omitted catalogs use the Gallery');
  }
 }finally{await rm(scratch,{recursive:true,force:true});}
});
