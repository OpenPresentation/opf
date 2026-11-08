import assert from'node:assert/strict';
import {test} from'node:test';
import {composeSlide,vennNodes,smartArtUnavailable} from'../dist/composition.js';
import {resolveSlideContext} from'../dist/index.js';
import {gallery} from'@openpresentation/gallery';
const short=count=>Array.from({length:count},(_,index)=>'N'+(index+1));
const bounds=boxes=>{const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return{x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y}};
const overlaps=(a,b)=>a.x<b.x+b.width-1e-6&&b.x<a.x+a.width-1e-6&&a.y<b.y+b.height-1e-6&&b.y<a.y+a.height-1e-6;
function composition(items,extra={}){const document={language:'en-US',slides:[{layout:'venn',title:'Overlapping sets',items}],...extra},context=resolveSlideContext(document,0,{catalogs:[gallery]});return composeSlide(context.slide,context.options)}
for(const count of[5,6,7])test('SH21: '+count+' editable Venn sets fill the body at the original48px with a uniform native-circle transform',()=>{
 const items=short(count),before=structuredClone(items),g=composition(items),a=g.arrangements[0];assert.ok(a);assert.equal(a.design,'opf');assert.equal(a.layout,undefined,'adapted shapes have no live layout definition');assert.equal(a.fontSize,48,'do not reduce the existing witness type');assert.equal(a.nodes.length,count);assert.deepEqual(items,before);
 const native=vennNodes(a.frame,count),circleBounds=bounds(a.nodes.map(n=>n.box)),nativeBounds=bounds(native.map(n=>n.box)),scale=a.nodes[0].box.width/native[0].box.width;
 assert.ok(scale>1.1,'visible enlargement, not only a new metric');assert.ok(circleBounds.height>=.65*a.frame.height);assert.ok(circleBounds.height>nativeBounds.height*1.1);
 for(let i=0;i<count;i++){
  const node=a.nodes[i],old=native[i];assert.equal(node.index,i);assert.ok(Math.abs(node.box.width/old.box.width-scale)<1e-8);assert.ok(Math.abs(node.box.height/old.box.height-scale)<1e-8);
  for(const field of['x','y'])assert.ok(Math.abs((node.box[field]-a.nodes[0].box[field])-(old.box[field]-native[0].box[field])*scale)<1e-7,'one scale/translation preserves every overlap');
  for(const box of[node.box,node.textBox]){assert.ok(box.x>=a.frame.x-1e-5&&box.y>=a.frame.y-1e-5);assert.ok(box.x+box.width<=a.frame.x+a.frame.width+1e-5&&box.y+box.height<=a.frame.y+a.frame.height+1e-5);}
  for(let j=0;j<count;j++){
   const circle=a.nodes[j].box,x=circle.x+circle.width/2,y=circle.y+circle.height/2,label=node.textBox,px=Math.max(label.x,Math.min(x,label.x+label.width)),py=Math.max(label.y,Math.min(y,label.y+label.height));assert.ok(Math.hypot(x-px,y-py)>=Math.max(circle.width,circle.height)/2,'outside label clears every intended overlapping circle');
   if(i!==j)assert.equal(overlaps(label,a.nodes[j].textBox),false,'outside labels never overlap');
  }
 }
 const item=g.items.find(i=>i.field==='items');assert.ok(item.listColumns.every(column=>column.text.fontSize>=48));assert.deepEqual(item.value,items);assert.ok(g.diagnostics.some(d=>d.code==='arrangement-adapted'&&d.path==='slides.0.items'&&/enlarged editable/.test(d.message)));
 assert.match(smartArtUnavailable({kind:'venn',count,frame:a.frame,nodes:items.map(()=>({lines:1,stable:true})),rtl:false}),/awaiting native qualification/);
});
test('SH21: long labels use complete readable cards with a finding instead of shrinking to a tiny overlap',()=>{
 const text='Planning and operational support for participants across several teams';
 const items=Array.from({length:7},(_,i)=>'Set '+(i+1)+': '+text),g=composition(items),a=g.arrangements[0];assert.ok(a);assert.equal(a.design,'cards');assert.equal(a.layout,undefined);assert.ok(g.diagnostics.some(d=>d.code==='arrangement-adapted'&&/editable cards/.test(d.message)));assert.deepEqual(g.items.find(i=>i.field==='items').value,items);assert.ok(g.items.find(i=>i.field==='items').listColumns.every(c=>!c.text.overflow));
 for(const column of g.items.find(i=>i.field==='items').listColumns)for(const entry of column.text.listEntries)assert.ok(entry.text.richLines.every(line=>line.fragments.map(f=>f.text).join('').trim().length<=70));
});
test('SH21: very long labels retain the whole full-size list when cards also cannot hold it',()=>{
 const text='Planning and operational support for participants across several teams with regular training reviews and shared measurement of progress during the pilot. ';
 const items=Array.from({length:7},(_,i)=>'Set '+(i+1)+': '+text),g=composition(items),item=g.items.find(i=>i.field==='items');assert.equal(g.arrangements?.length??0,0);assert.deepEqual(item.value,items);assert.equal(item.text.overflow,false);assert.ok(g.diagnostics.some(d=>d.code==='arrangement-adapted'&&/drawn as a list/.test(d.message)));
 const plain=structuredClone(gallery.layouts.venn);for(const region of plain.regions)delete region.arrangement;
 const deck={language:'en-US',catalogs:{custom:{layouts:{plain}}},slides:[{layout:'custom:plain',title:'Overlapping sets',items}]},context=resolveSlideContext(deck,0,{catalogs:[gallery]}),baseline=composeSlide(context.slide,context.options).items.find(i=>i.field==='items');assert.ok(item.text.fontSize>=baseline.text.fontSize,'the complete-list fallback does not shrink the pre-arrangement fit');
});
test('SH21: a narrow body uses whole labels in a complete card fallback and RTL keeps source identity',()=>{
 const layout={name:'Narrow sets',direction:'row',regions:[{name:'sets',accepts:['list'],role:'primary',flow:'none',arrangement:'venn',size:1},{name:'reserve',accepts:['text'],size:5,empty:'keep'}]};
 const items=short(7),g=composeSlide({items},{width:1280,height:720,layout});assert.deepEqual(g.items.find(i=>i.field==='items').value,items);assert.ok(g.diagnostics.some(d=>d.code==='arrangement-adapted'));assert.ok(g.arrangements?.[0]?.design==='cards'||!g.arrangements?.length);
 const rtl=composition(['ألف','باء','جيم','دال','هاء','واو','زاي'],{language:'ar'});assert.deepEqual(rtl.items.find(i=>i.field==='items').value,['ألف','باء','جيم','دال','هاء','واو','زاي']);assert.ok(rtl.arrangements?.[0]);assert.ok(rtl.diagnostics.some(d=>d.code==='arrangement-adapted'));
});

test('SH21: a mixed long/short set keeps the larger old full-list result when an adapted diagram would reduce its type',()=>{
 const items=['Planning and operational support for participants across several teams',...short(6)],g=composition(items),item=g.items.find(i=>i.field==='items');
 assert.ok(item.text.fontSize>=44,'the frozen-before full-region fallback holds this mixed case at44px');assert.deepEqual(item.value,items);assert.equal(item.text.overflow,false);
});
