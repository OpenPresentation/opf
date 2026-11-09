import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync,strFromU8} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {catalogs,toPptx,toSvg} from './helpers/default-catalog.mjs';
const policy={pack:'office',substitutionPolicy:'visual'};
const scheme=family=>({major:family,minor:family});
const documents=[
 {name:'Mixed emoji roles',design:{fontScheme:scheme('Segoe UI Emoji')},slides:[{title:'A launch 🚀',text:'Body 👍 text'}]},
 {name:'Math roles',design:{fontScheme:scheme('Cambria Math')},slides:[{title:'Theorem ℝ',text:'Proof ∑ x'}]},
 {name:'Mixed emoji rich weights',slides:[{title:'Ordinary title',text:[{text:'A launch 🚀',fontFamily:'Segoe UI Emoji',bold:true},' ',{text:'body 👍',fontFamily:'Segoe UI Emoji'}]}]},
];
const whole=await loadFonts({...policy,scripts:['Latn','Zsye','Zmth']});
const parts=bytes=>Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([name])=>/^ppt\/(slides\/slide\d+|theme\/theme\d+)\.xml$/.test(name)).map(([name,value])=>[name,strFromU8(value)]));
for(const document of documents)test(`${document.name}: demand native XML matches full-pack output`,async()=>{
 const fonts=await loadFonts({...policy,scripts:'auto',presentation:document,renderOptions:{catalogs}});
 const before=toSvg(document,1,{fonts,text:'paths'});
 const expected=parts(await toPptx(document,{fonts:whole}));
 const actual=parts(await toPptx(document,{fonts}));
 assert.deepEqual(actual,expected);
 assert.equal(toSvg(document,1,{fonts,text:'paths'}),before,'native-only preparation does not change preview geometry/outlines');
 assert.deepEqual(fonts.pending(document,{catalogs}),[]);
 if(document.name==='Mixed emoji roles'){
  assert.deepEqual(fonts.registry.describeFaces().map(face=>[face.family,face.weight]),[['Noto Sans',400],['Noto Color Emoji',400],['Noto Sans',700]]);
  assert.throws(()=>fonts.textMeasurement.measure('A',20,{fontFamily:'Noto Color Emoji',fontWeight:400}),{code:'missing-glyph'});
 }
 const held=fonts.fontFiles.length;
 await toPptx(document,{fonts});
 assert.equal(fonts.fontFiles.length,held,'repeated export does not add duplicate faces');
});
test('safe native preparation and later document edits preserve full-pack output',async()=>{
 const first=documents[0],fonts=await loadFonts({...policy,scripts:'auto',presentation:first,renderOptions:{catalogs}});
 for(const document of [first,{slides:[{title:'A new title',text:[{text:'A launch 🚀',fontFamily:'Segoe UI Emoji',italic:true}]}]}]){
  assert.deepEqual(parts(await toPptx(document,{fonts,typefaces:'safe'})),parts(await toPptx(document,{fonts:whole,typefaces:'safe'})));
  if(document===first) assert.deepEqual(fonts.registry.describeFaces().map(face=>[face.family,face.weight]),[['Noto Sans',400],['Noto Color Emoji',400],['Noto Sans',700]],'safe mapping does not preload unused Arial substitutes for script-generated fallbacks');
  assert.deepEqual(parts(await toPptx(document,{fonts})),parts(await toPptx(document,{fonts:whole})), 'switching native mapping modes never reuses the wrong preparation context');
 }
});
