import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {composeSlide} from '../dist/composition.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/lh-41-timeline-notes.json',import.meta.url),'utf8'));
const options=(advance=.44,direction='ltr')=>({layout:fixture.layout,themeDesign:fixture.design,direction,textMeasurement:{measure:(text,size)=>[...text].length*size*advance}});
const timelines=r=>r.items.filter(i=>i.timelineLayout),notes=r=>r.items.filter(i=>i.field==='text'&&!i.emphasis);
const bottom=b=>b.y+b.height,words=text=>text.replace(/\s+/gu,' ').trim();
for(const advance of[.44,.48])for(const direction of['ltr','rtl'])test('observed horizontal timeline row reserves measured note height '+advance+'/'+direction,()=>{
 const slide=structuredClone(fixture.slide),original=JSON.stringify(slide),r=composeSlide(slide,options(advance,direction));
 assert.deepEqual(r.diagnostics,[]);assert.equal(JSON.stringify(slide),original);assert.equal(timelines(r).length,3);assert.equal(notes(r).length,2);
 const roles={name:advance===.44?21:22,what:advance===.44?19:20,description:16,when:16,'event-description':16};
 for(const item of timelines(r)){
  assert.equal(item.timelineLayout.arrangement,'alternating');assert.equal(item.timelineLayout.markers.length,4);assert.equal(item.timelineLayout.parts.length,14);
  const authored=slide.blocks[Number(/blocks\.(\d+)/u.exec(item.path)[1])].timeline;assert.deepEqual(item.value,authored);
  for(const part of item.timelineLayout.parts){assert.ok(part.fit.fontSize>=roles[part.role]-.02,part.path+' retains font size');assert.ok(!part.fit.overflow);assert.ok(bottom(part.box)<=bottom(item.box)+.02);}
 }
 for(const item of notes(r)){
  assert.equal(item.text.fontSize,18,'notes grow one existing type-scale step from 16px');assert.ok(!item.text.overflow);assert.ok(item.text.lines.every(line=>line.trim().length<=70));
  assert.equal(words(item.text.lines.join('')),words(item.value));assert.ok(item.box.y>=Math.max(...timelines(r).map(i=>bottom(i.box))));assert.ok(bottom(item.box)<=bottom(r.contentBox)+.02);
 }
 assert.ok((Math.max(...notes(r).map(i=>bottom(i.box)))-r.contentBox.y)/r.contentBox.height>=.9,'retained content fills the body');
 assert.equal(r.items.find(i=>i.field==='title').text.fontSize,54);assert.equal(r.items.find(i=>i.emphasis).text.fontSize,28);assert.equal(r.titleRule,undefined,'no new title decoration');
 const xs=timelines(r).map(i=>i.box.x);assert.ok(direction==='rtl'?xs[0]>xs[1]&&xs[1]>xs[2]:xs[0]<xs[1]&&xs[1]<xs[2]);
});
test('authored gap remains exact when a retained arrangement fits',()=>{
 const slide=structuredClone(fixture.slide);slide.composition={gap:.02};const r=composeSlide(slide,options());assert.deepEqual(r.diagnostics,[]);const t=timelines(r)[0],note=notes(r)[0];assert.ok(Math.abs(note.box.y-bottom(t.box)-.02*720)<.001);assert.equal(r.composition.gap,.02);
});
test('insufficient authored gap budget remains an explicit refusal',()=>{
 const slide=structuredClone(fixture.slide);slide.composition={gap:1/30};const r=composeSlide(slide,options());assert.ok(r.diagnostics.some(i=>i.code==='text-overflow'));assert.equal(r.composition.gap,1/30);assert.equal(notes(r)[0].text.fontSize,16);
});
test('authored vertical composition and pinned layout regions keep their contracts',()=>{
 const column=structuredClone(fixture.slide);column.composition={mode:'column'};const r=composeSlide(column,options());assert.equal(r.composition.mode,'column');assert.ok(timelines(r).some(i=>i.timelineLayout.arrangement==='vertical')||r.diagnostics.some(i=>i.code==='text-overflow'));
 const fixed=composeSlide(fixture.slide,{...options(),recompose:false});assert.ok(fixed.regions,'explicitly disabled recomposition keeps the authored layout');
 const pinned=structuredClone(fixture.slide);pinned.blocks[0].region='timeline';const p=composeSlide(pinned,options());assert.ok(p.regions);assert.equal(timelines(p)[0].region,'timeline');
});
test('over-capacity timeline notes retain their content and explicit overflow',()=>{
 const slide=structuredClone(fixture.slide);slide.blocks[1].text=slide.blocks[1].text.repeat(12);const r=composeSlide(slide,options());assert.ok(r.diagnostics.some(i=>i.code==='text-overflow'));assert.equal(r.items.find(i=>i.path.endsWith('blocks.1.text')).value,slide.blocks[1].text);assert.ok(r.items.filter(i=>i.text).every(i=>i.text.fontSize>=16));
});
test('ordinary non-timeline and lone vertical-timeline slides retain their arrangement',()=>{
 const slide={title:'Choices',composition:{mode:'row'},blocks:[{text:'Keep the scope clear.'},{text:'Make the next decision.'}]},r=composeSlide(slide,options());assert.deepEqual(r.diagnostics,[]);assert.equal(r.items.filter(i=>i.field==='text').length,2);assert.equal(r.composition.mode,'row');
 const single={title:'Sequence',composition:{mode:'column'},blocks:[{timeline:fixture.slide.blocks[0].timeline}]},t=composeSlide(single,{...options(),width:500,height:900});assert.equal(timelines(t).length,1);assert.equal(timelines(t)[0].timelineLayout.arrangement,'vertical');
});
