import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutTimeline,composeSlide,OPFCompositionError} from '../dist/composition.js';
import {paginateSlide,OPFPaginationError} from '../dist/pagination.js';

const synthetic={
  measure:(text,size)=>Array.from(text).length*size*.5,
  outlineBounds:(text,size)=>text.trim()?{x:-size*.08,y:-size*.82,width:Array.from(text).length*size*.5+size*.16,height:size*1.08}:null,
};
const get=(value,path)=>path.split('.').reduce((object,key)=>object[key],value);
const inside=(inner,outer)=>inner.x>=outer.x-.01&&inner.y>=outer.y-.01&&inner.x+inner.width<=outer.x+outer.width+.01&&inner.y+inner.height<=outer.y+outer.height+.01;

test('timeline parts keep exact array/object source paths, whitespace, selected floors and outlined ink',()=>{
  const events=[{when:' Q1 ',what:'Alpha\u00a0Beta',description:'\tFirst\r\n\rSecond\n  end  '},{what:'',description:'Blank label remains editable.'}];
  for(const value of [events,{name:'Source title',description:'Source context',events}])for(const scale of [.5,1,1.5])for(const textMeasurement of [undefined,synthetic]){
    const before=structuredClone(value),box={x:10,y:20,width:1600*scale,height:1400*scale},options={path:'timeline',scale,minFontSize:32,textMeasurement};
    const result=layoutTimeline(value,box,options);
    assert.equal(result.overflow,false);assert.deepEqual(result,layoutTimeline(value,box,options));assert.deepEqual(value,before);
    assert.equal(result.markers.length,events.length);assert.ok(result.attempts>=1&&result.attempts<=50);
    for(const part of result.parts){
      assert.equal(get({timeline:value},part.path),part.text);assert.deepEqual(part.sources,[{path:part.path,start:0,end:part.text.length}]);
      assert.ok(part.fit.fontSize>=32*scale);assert.equal(part.fit.sourceLines.map(line=>part.text.slice(line.start,line.nextStart)).join(''),part.text);
      assert.ok(inside(part.box,box));
      for(const line of part.fit.placement?.lines??[])if(line.outline)assert.ok(inside(line.outline,part.box));
    }
    for(const marker of result.markers){assert.equal(get({timeline:value},marker.path),value.events?.[marker.eventIndex]??value[marker.eventIndex]);assert.ok(inside({x:marker.x-marker.radius,y:marker.y-marker.radius,width:marker.radius*2,height:marker.radius*2},box));}
  }
});

test('timeline tries a vertical arrangement before accepting unreadable narrow labels',()=>{
  const description='Keep every source detail while measuring enough readable space for the complete milestone.';
  const value={events:[{when:'Q1',what:'Pilot',description},{when:'Q2',what:'Expand',description}]};
  const result=layoutTimeline(value,{x:10,y:20,width:180,height:400});
  assert.equal(result.overflow,false);assert.equal(result.arrangement,'vertical');assert.equal(result.attempts,2);
  assert.deepEqual(result.parts.map(part=>part.text),value.events.flatMap(event=>[event.when,event.what,event.description]));
  assert.equal(result.connector.x1,result.connector.x2);assert.ok(result.connector.y2>result.connector.y1);
});

test('timeline rejects irreducible fields and invalid inputs with bounded attempts and source diagnostics',()=>{
  const value={name:'Long name '.repeat(200),events:[{what:'W'.repeat(300)}]},box={x:0,y:0,width:80,height:60};
  const before=structuredClone(value),result=layoutTimeline(value,box,{path:'slides.0.timeline',minFontSize:32});
  assert.ok(result.overflow);assert.ok(result.attempts<=50);assert.ok(result.diagnostics.every(d=>d.path.startsWith('slides.0.timeline.')));
  assert.throws(()=>layoutTimeline(value,box,{overflow:'error',minFontSize:32}),OPFCompositionError);assert.deepEqual(value,before);
  for(const invalid of [null,[],{events:[]},{events:[{}]},{events:[{what:4}]}])assert.throws(()=>layoutTimeline(invalid,box),TypeError);
  for(const width of [0,-1,NaN,Infinity])assert.throws(()=>layoutTimeline([{what:'A'}],{...box,width}),RangeError);
  assert.throws(()=>layoutTimeline([{what:'A'}],box,{textMeasurement:{measure:()=>1,outlineBounds:true}}),TypeError);
});

test('composition measures nested timelines and pagination preserves atomic event order and metadata',()=>{
  const events=Array.from({length:8},(_,i)=>({when:`Q${i+1}`,what:`Milestone ${i+1}`,description:'Keep every label inside its allocated space and preserve every source detail.'}));
  const slide={title:'Readable timeline',timeline:{name:'Plan',description:'Keep this context.',events},composition:{minFontSize:32,overflow:'error'}},before=structuredClone(slide);
  assert.throws(()=>composeSlide(slide,{explain:true}),error=>error instanceof OPFCompositionError&&error.diagnostics.some(d=>d.path.includes('.timeline.')));
  const paged=paginateSlide(slide,{minFontSize:32});assert.ok(paged.slides.length>1);
  assert.deepEqual(paged.slides.flatMap(page=>page.timeline.events),events);
  for(const page of paged.slides){assert.equal(page.timeline.name,slide.timeline.name);assert.equal(page.timeline.description,slide.timeline.description);const composition=composeSlide(page,{explain:true});assert.deepEqual(composition.diagnostics,[]);assert.deepEqual(composition.explanation.unmeasuredPayloads,[]);assert.ok(composition.items.find(item=>item.timelineLayout).timelineLayout.parts.every(part=>part.fit.fontSize>=32));}
  const ranges=paged.pages.flatMap(page=>page.mappings).filter(mapping=>mapping.sourcePath.endsWith('.timeline')).map(mapping=>mapping.range);
  assert.equal(ranges[0].start,0);assert.equal(ranges.at(-1).end,8);for(let i=1;i<ranges.length;i++)assert.equal(ranges[i-1].end,ranges[i].start);
  assert.deepEqual(slide,before);
  const nested={composition:{minFontSize:32,overflow:'error',mode:'row',weights:[1,2]},blocks:[{blocks:[{timeline:[{what:'One event'}]}],composition:{minFontSize:8}},{text:'Keep the human layout.'}]};
  const copy=structuredClone(nested),geometry=composeSlide(nested,{width:1440,height:1000,explain:true}),item=geometry.items.find(item=>item.timelineLayout);
  assert.equal(item.composition.minFontSize,8);assert.ok(item.timelineLayout.parts.every(part=>part.fit.fontSize>=8*1000/720));assert.deepEqual(nested,copy);
  const inherited=structuredClone(nested);delete inherited.blocks[0].composition.minFontSize;
  const inheritedItem=composeSlide(inherited,{width:1440,height:1000}).items.find(item=>item.timelineLayout);
  assert.equal(inheritedItem.composition.minFontSize,32);assert.ok(inheritedItem.timelineLayout.parts.every(part=>part.fit.fontSize>=32*1000/720));
  assert.throws(()=>paginateSlide({timeline:{name:'Irreducible '.repeat(1000),events:[{what:'One'}]}},{minFontSize:32,maxSlides:5}),OPFPaginationError);
});
