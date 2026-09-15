import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderSvg,resolvePresentation} from '../dist/svg.js';
import {prepareNodeFonts} from '../dist/fonts-node.js';
const {options}=await prepareNodeFonts();
const bytes=await readFile(new URL('fixtures/jpeg/expected-1.png',import.meta.url));
const image={src:`data:image/png;base64,${bytes.toString('base64')}`,alt:'Visible furniture logo'};
for(const measured of [false,true])for(const floor of [16,32])for(const [width,height]of [[1280,720],[720,1280]]){
 const deck={organization:{id:'opf',name:'Organization'},design:{fontScheme:'roboto',imageFill:'crop',dimensions:{widthInches:width/96,heightInches:height/96},header:{left:{image,text:'Keep both'},center:{organization:true},right:{section:true}},footer:{left:{date:'Literal date'},right:{slideNumber:true}}},slides:[{section:'Section',title:'Furniture',text:'Body',composition:{minFontSize:floor,overflow:'error'}}]};
 const before=structuredClone(deck),config={...(measured?options:{}),trace:true},geometry=resolvePresentation(deck,config).slides[0].geometry,svg=renderSvg(deck,config);
 assert.deepEqual(geometry.diagnostics,[]);assert.deepEqual(deck,before);
 assert.ok(svg.includes('Visible furniture logo'));assert.ok(svg.includes('xMidYMid meet'));assert.ok(svg.includes('Keep both'));
 assert.equal((svg.match(/data-opf-furniture-field=/g)??[]).length,geometry.furniture.parts.length);
 for(const match of svg.matchAll(/<text\b([^>]*)data-opf-path="design\.(header|footer)\.[^"]+"([^>]*)>/g))assert.ok(Number(/font-size="([^"]+)"/.exec(match[0])[1])>=floor);
 const disabled=structuredClone(deck);disabled.slides[0].design={header:false,footer:false};const plain=renderSvg(disabled,config);assert.ok(!plain.includes('data-opf-furniture-field'));
 const empty=structuredClone(deck);empty.slides[0].design={header:{},footer:{}};assert.ok(!renderSvg(empty,config).includes('data-opf-furniture-field'));
}
assert.throws(()=>renderSvg({design:{header:{left:{date:true}}},slides:[{text:'Body',composition:{overflow:'error'}}]}),{code:'layout-overflow'});
console.log('Furniture renderer passed: shared readable fields, combined image/text, generated metadata, fit images, local disabling and unresolved-content rejection.');
