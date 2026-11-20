// Renderer-only CI builds gallery/core/render, so public PPTX conversion belongs in integration.
// The shared runner discovers *.test.mjs; integration already builds its renderer and PPTX dependencies.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {convert} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const renderOptions={catalogs:[gallery]},request=presentation=>({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation,renderOptions});

test('actual safe/native preparation keeps original-family900 weight, whole-pack output and preview bytes',async()=>{
 const doc={name:'Native selected weight',design:{fontScheme:'aptos'},slides:[{title:'Native role names',text:[{text:'Ärger ü Action',fontFamily:'Arial Black',bold:true},' plain body']}]};
 const demand=await loadFonts(request(doc)),whole=await loadFonts({pack:'office',substitutionPolicy:'visual'}),options={catalogs:[gallery],date:'2026-11-08'};
 const preview=await convert(doc,{...options,format:'svg',fonts:demand,text:'paths'});
 for(const typefaces of['selected','safe']){const a=await convert(doc,{...options,format:'pptx',fonts:demand,typefaces}),b=await convert(doc,{...options,format:'pptx',fonts:whole,typefaces});assert.deepEqual(a.files.map(f=>f.bytes),b.files.map(f=>f.bytes),typefaces+': all native bytes');}
 const after=await convert(doc,{...options,format:'svg',fonts:demand,text:'paths'});assert.deepEqual(after.files.map(f=>f.bytes),preview.files.map(f=>f.bytes));assert(demand.registry.describeFaces().some(f=>f.family==='Montserrat'&&f.weight===900));assert.deepEqual(demand.pending(doc,renderOptions),[]);
});
