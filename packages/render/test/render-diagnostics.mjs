import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {toSvg} from '@openpresentation/opf-render';
import {toSvg as svg} from '@openpresentation/opf-render/svg';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

for (const name of ['index','svg']) assert.equal(await readFile(new URL(`../src/${name}.d.ts`,import.meta.url),'utf8'),await readFile(new URL(`../dist/${name}.d.ts`,import.meta.url),'utf8'),'shipped declaration equals source');
const diagnosticUnion=async name=>(await readFile(new URL(`../dist/${name}.d.ts`,import.meta.url),'utf8')).split('export type RenderDiagnostic =')[1].split('export interface ToSvgOptions')[0];
assert.equal(await diagnosticUnion('index'),await diagnosticUnion('svg'),'Node and browser-safe public entries expose the same diagnostics');
const base=await loadFonts({pack:'base'});
const described=base.registry.describeFaces(),exported=base.registry.exportFaces();
const faces=[400,700].map(weight=>{
  const source=exported[described.findIndex(f=>f.family==='Roboto' && f.weight===weight && !f.italic)].data;
  const data=Uint8Array.from(source),view=new DataView(data.buffer);
  let changed=false;
  for(let n=0;n<view.getUint16(4);n++){const at=12+n*16;if(String.fromCharCode(...data.subarray(at,at+4))==='OS/2'){view.setUint16(view.getUint32(at+8)+8,2);changed=true;}}
  assert.ok(changed);return {data,family:'Host',weight};
});
const fonts=await loadFonts({pack:'base',faces});
const deck={catalogs:{host:{source:'https://example.invalid/host',fontSchemes:{host:{name:'Host',app:'powerpoint',languageFamily:'latin',languages:[],major:'Host',minor:'Host',textSample:'x',type:'sans-serif'}}}},design:{fontScheme:'host:host'},slides:[{title:'Control',text:'Body'}]};
const capture=draw=>{const diagnostics=[];draw(deck,1,{fonts,text:'paths',onDiagnostic:d=>diagnostics.push(d)});return diagnostics.filter(d=>['text-as-paths-fallback','font-embedding-restricted'].includes(d.code));};
const diagnostics=capture(toSvg);assert.deepEqual(capture(svg),diagnostics,'both actual public imports emit identical font diagnostics');
const outline=diagnostics.find(d=>d.code==='text-as-paths-fallback');assert.ok(outline,'restricted outline text reports its fallback');
assert.deepEqual(Object.keys(outline).sort(),['code','fontFamily','message','reason']);assert.equal(outline.reason,'restricted');assert.equal(outline.fontFamily,'roboto','outline diagnostics identify the font data name, not the declared Host alias');assert.equal(typeof outline.message,'string');
const restricted=diagnostics.find(d=>d.code==='font-embedding-restricted');assert.ok(restricted,'restricted font embedding is reported');
assert.deepEqual(Object.keys(restricted).sort(),['code','faces','message']);assert.equal(typeof restricted.message,'string');
assert.deepEqual(restricted.faces.map(f=>[f.fontFamily,f.weight,f.italic,f.fsType]).sort(),[['Host',400,false,2],['Host',700,false,2]]);
console.log('Public renderer entries preserve actual outline/embedding diagnostics and shipped type parity.');
