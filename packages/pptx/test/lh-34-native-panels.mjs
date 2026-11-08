import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{unzipSync,zipSync,strFromU8,strToU8}from'fflate';
import{fromPptx}from'./helpers/default-catalog.mjs';
const source=readFileSync(new URL('fixtures/lh34-native-panels/source.pptx',import.meta.url)),native=readFileSync(new URL('fixtures/lh34-native-panels/native-saved.pptx',import.meta.url)),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=JSON.parse(readFileSync(new URL('fixtures/lh34-native-panels/expected.json',import.meta.url),'utf8'));
assert.equal(hash(source),expected.sourceSha256,'sealed source archive');assert.equal(hash(native),expected.nativeSavedSha256,'sealed actual native archive');
const imageOf=deck=>deck.slides[0].blocks?.find(block=>block.image)?.image??deck.slides[0].image;
const current=['Native edit\nSecond line','','Inspection point'];
const sourceZip=unzipSync(source),nativeZip=unzipSync(native),xml=strFromU8(nativeZip['ppt/slides/slide1.xml']);
const panelNames=[0,1,2].map(index=>'OPF image callout OPF image 1 '+index),shapes=text=>[...text.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m=>m[0]);
for(const name of panelNames){const before=shapes(strFromU8(sourceZip['ppt/slides/slide1.xml'])).find(s=>s.includes('name="'+name+'"')),after=shapes(xml).find(s=>s.includes('name="'+name+'"'));assert.equal(after.match(/<a:xfrm>[\s\S]*?<\/a:xfrm>/)?.[0],before.match(/<a:xfrm>[\s\S]*?<\/a:xfrm>/)?.[0],'actual native frame exact');assert.ok(!before.includes('<p:txBody>')&&after.includes('<p:txBody>'),'PowerPoint adds only an empty panel body');}
const findings=[],back=await fromPptx(native,{onDiagnostic:d=>findings.push(d)}),callouts=imageOf(back).callouts;
assert.deepEqual(callouts.map(c=>c.text),current,'actual multiline and cleared native words');
const original=await fromPptx(source);assert.deepEqual(callouts.map(({text,...frame})=>frame),imageOf(original).callouts.map(({text,...frame})=>frame),'exact authored fractions survive');
assert.ok(!findings.some(d=>d.code==='invalid-image-callout-provenance'));
assert.ok(findings.some(d=>d.code==='image-callout-import-reflow'&&d.message.includes('panel fill/line styling')),'native paint is explicitly a reflow limitation');
for(const [name,mutate]of [
 ['one-EMU-move',shape=>shape.replace(/<a:off x="(\d+)"/,(_,x)=>'<a:off x="'+(Number(x)+1)+'"')],
 ['rotation',shape=>shape.replace('<a:xfrm>','<a:xfrm rot="60000">')],
 ['flip',shape=>shape.replace('<a:xfrm>','<a:xfrm flipH="1">')],
 ['visible-panel-word',shape=>shape.replace('</a:p>','<a:r><a:t>Current panel word</a:t></a:r></a:p>')],
 ['visible-panel-bullet',shape=>shape.replace('<a:p>','<a:p><a:pPr><a:buChar char="•"/></a:pPr>')],
 ['different-outline',shape=>shape.replace('prst="rect"','prst="ellipse"')],
 ['deleted-panel',()=>'' ],
]){
 const zip={...nativeZip},text=xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>shape.includes('name="'+panelNames[0]+'"')?mutate(shape):shape);assert.notEqual(text,xml,name+' mutation effective');zip['ppt/slides/slide1.xml']=strToU8(text);
 const issues=[],fallback=await fromPptx(zipSync(zip),{onDiagnostic:d=>issues.push(d)});assert.equal(imageOf(fallback)?.callouts,undefined,name+' remains ordinary native content');assert.ok(issues.some(d=>d.code==='invalid-image-callout-provenance'),name+' located diagnostic');const visible=JSON.stringify(fallback.slides);assert.ok(visible.includes('Native edit\\nSecond line'),name+' current words survive');assert.ok(!visible.includes('Red zone')&&!visible.includes('Blue zone'),name+' no old words restored');
}
console.log('LH34 actual PowerPoint empty-body normalization: current multiline/cleared text and exact frames pass; seven strict tamper refusals pass. Source '+hash(source)+', saved '+hash(native));
