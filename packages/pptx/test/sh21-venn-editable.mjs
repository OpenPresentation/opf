import assert from'node:assert/strict';
import {test}from'node:test';
import {unzipSync,strFromU8}from'fflate';
import {toPptx,fromPptx}from'../dist/index.js';
import {toSvg}from'@openpresentation/opf-render';
import {gallery}from'@openpresentation/gallery';
import {resolveSlideContext}from'@openpresentation/opf';
import {composeSlide}from'@openpresentation/opf/composition';
for(const count of[5,6,7])test('SH21: '+count+' adapted Venn circles export shared editable geometry,48px type and explicit live refusal',async()=>{
 const items=Array.from({length:count},(_,i)=>'N'+(i+1)),document={language:'en-US',slides:[{layout:'venn',title:'Readable overlaps',items}]},context=resolveSlideContext(document,0,{catalogs:[gallery]}),geometry=composeSlide(context.slide,context.options),arrangement=geometry.arrangements[0],diagnostics=[];
 const bytes=new Uint8Array(await toPptx(document,{catalogs:[gallery],onDiagnostic:d=>diagnostics.push(d),seed:2121,timestamp:'2026-11-08T00:00:00Z',zipDate:'2026-11-08T00:00:00Z'})),parts=unzipSync(bytes),xml=strFromU8(parts['ppt/slides/slide1.xml']);
 assert.equal(arrangement.fontSize,48);assert.ok(!Object.keys(parts).some(path=>path.startsWith('ppt/diagrams/')));assert.ok(diagnostics.some(d=>d.code==='smartart-unavailable'&&/unused slide body/.test(d.reason)));assert.equal((xml.match(/<a:alpha val="50000"\/>/g)||[]).length,count);assert.ok(!/<a:(?:normAutofit|spAutoFit)\b/.test(xml));
 const imported=await fromPptx(bytes,{signals:true});assert.deepEqual(imported.presentation.slides[0].items,items);
 const runs=imported.signals.slides[0].shapes.filter(s=>s.name?.startsWith('OPF list slides.0.items')).flatMap(s=>s.text?.paragraphs.flatMap(p=>p.runs)??[]);assert.ok(runs.length);assert.ok(runs.every(r=>Math.abs(r.size-36)<.011),'all native set labels retain48px=36pt');
 const svg=toSvg(document,{catalogs:[gallery],trace:true})[0];assert.equal((svg.match(/fill-opacity="0.5"/g)||[]).length,count);for(const node of arrangement.nodes)assert.ok(svg.includes('data-opf-arrangement-path="'+node.path+'"'));
});
test('SH21: readable Venn cards stay opaque, editable and non-live with complete labels',async()=>{
 const items=Array.from({length:7},(_,i)=>'Set '+(i+1)+': Planning and operational support for participants across several teams'),document={slides:[{layout:'venn',title:'Keep every set label',items}]},diagnostics=[];
 const bytes=new Uint8Array(await toPptx(document,{catalogs:[gallery],onDiagnostic:d=>diagnostics.push(d)})),parts=unzipSync(bytes),xml=strFromU8(parts['ppt/slides/slide1.xml']);assert.ok(!Object.keys(parts).some(path=>path.startsWith('ppt/diagrams/')));assert.ok(diagnostics.some(d=>d.code==='smartart-unavailable'));assert.equal((xml.match(/<a:alpha val="50000"\/>/g)||[]).length,0);assert.ok(xml.includes('prst="roundRect"'));assert.ok(!/<a:(?:normAutofit|spAutoFit)\b/.test(xml));assert.deepEqual((await fromPptx(bytes)).slides[0].items,items);
 const svg=toSvg(document,{catalogs:[gallery]})[0];assert.equal((svg.match(/fill-opacity="0.5"/g)||[]).length,0,'card fallback keeps its ordinary full-opacity neutral');
});
