import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// The decks name the gallery's roboto font scheme, so the host catalog is registered (./catalog-harness.mjs).
import {resolvePresentation, renderSlideSvg} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';
const prepared = await loadFonts();
const bytes=await readFile(new URL('fixtures/jpeg/expected-1.png',import.meta.url));
const image={src:`data:image/png;base64,${bytes.toString('base64')}`,alt:'Visible furniture logo'};
for(const measured of [false,true])for(const floor of [16,32])for(const [width,height]of [[1280,720],[720,1280]]){
 const deck={organization:{id:'opf',name:'Organization'},design:{fontScheme:'roboto',imageFit:'cover',dimensions:{widthInches:width/96,heightInches:height/96},header:{left:{image,text:'Keep both'},center:{organization:true},right:{section:true}},footer:{left:{date:'Literal date'},right:{slideNumber:true}}},slides:[{section:'Section',title:'Furniture',text:'Body',composition:{minFontSize:floor,overflow:'error'}}]};
 const before=structuredClone(deck),config={...(measured?{fonts:prepared}:{}),trace:true},geometry=resolvePresentation(deck,config).slides[0].geometry,svg=renderSlideSvg(deck, 0,config);
 assert.deepEqual(geometry.diagnostics,[]);assert.deepEqual(deck,before);
 assert.ok(svg.includes('Visible furniture logo'));assert.ok(svg.includes('xMidYMid meet'));assert.ok(svg.includes('Keep both'));
 assert.equal((svg.match(/data-opf-furniture-field=/g)??[]).length,geometry.furniture.parts.length);
 for(const match of svg.matchAll(/<text\b([^>]*)data-opf-path="design\.(header|footer)\.[^"]+"([^>]*)>/g))assert.ok(Number(/font-size="([^"]+)"/.exec(match[0])[1])>=floor);
 const disabled=structuredClone(deck);disabled.slides[0].design={header:false,footer:false};const plain=renderSlideSvg(disabled, 0,config);assert.ok(!plain.includes('data-opf-furniture-field'));
 const empty=structuredClone(deck);empty.slides[0].design={header:{},footer:{}};assert.ok(!renderSlideSvg(empty, 0,config).includes('data-opf-furniture-field'));
}
assert.throws(()=>renderSlideSvg({design:{header:{left:{date:true}}},slides:[{text:'Body',composition:{overflow:'error'}}]}, 0),{code:'layout-overflow'});
// FF-27: slide-number formats, fixed formatted dates and host-supplied current dates.
{
 const deck={design:{fontScheme:'roboto',header:{center:{text:'Internal Use Only'}},footer:{left:{date:'2026-04-23',dateFormat:'MMM d, yyyy'},center:{date:true,dateFormat:'MMMM d, yyyy'},right:{slideNumber:true,slideNumberFormat:'{current} / {total}'}}},slides:[{title:'Title',design:{header:false,footer:false}},{title:'Two',text:'Body'},{title:'Three',text:'Body'}]};
 const before=structuredClone(deck),config={trace:true,date:'2026-09-22'},resolved=resolvePresentation(deck,config);
 assert.deepEqual(deck,before);
 assert.deepEqual(resolved.slides.map(slide=>slide.geometry.diagnostics),[[],[],[]]);
 assert.equal(resolved.slides[0].geometry.furniture?.parts.length??0,0,'A title-slide override hides inherited furniture.');
 for(const index of [1,2]){
  const parts=resolved.slides[index].geometry.furniture.parts,svg=renderSlideSvg(deck, index,{...config});
  assert.deepEqual(parts.map(part=>part.text),['Internal Use Only','Apr 23, 2026','September 22, 2026',`${index+1} / 3`]);
  for(const text of ['Apr 23, 2026','September 22, 2026',`${index+1} / 3`])assert.ok(svg.includes(text),text);
  assert.equal((svg.match(/data-opf-furniture-field="date"/g)??[]).length,2);assert.ok(!/<g[^>]*data-opf-furniture-editable="true"[^>]*data-opf-furniture-field="date"/.test(svg),'Formatted and current dates are generated, not editable source text.');
  assert.deepEqual(parts.find(part=>part.field==='slideNumber').fields,[{type:'slideNumber',start:0,end:1}]);
 }
 assert.throws(()=>renderSlideSvg({design:{footer:{left:{date:true}}},slides:[{text:'Body',composition:{overflow:'error'}}]}, 0,{date:'22/09/2026'}),RangeError);
 const literal=renderSlideSvg({design:{footer:{left:{date:'Q3 2026'}}},slides:[{text:'Body'}]}, 0,{trace:true});
 assert.ok(/<g[^>]*data-opf-furniture-editable="true"[^>]*data-opf-furniture-field="date"/.test(literal),'A date string without dateFormat stays editable literal text.');
}
console.log('Furniture renderer passed: shared readable fields, combined image/text, generated metadata, fit images, local disabling and unresolved-content rejection.');
