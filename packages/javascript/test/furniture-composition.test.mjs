import assert from 'node:assert/strict';
import test from 'node:test';
import {composeSlide,layoutFurniture,OPFCompositionError} from '../dist/composition.js';
import {paginateSlide,paginatePresentation,OPFPaginationError} from '../dist/pagination.js';

const measure=(text,size)=>{assert.ok(!/[\r\n\t]/u.test(text));return [...text].length*size/2;};
const outlined={measure,outlineBounds:(text,size)=>text.trim()?{x:-2,y:-size,width:measure(text,size)+4,height:size+3}:null};
function sourceRanges(part) {
  let cursor=0,rebuilt='';
  for(const line of part.fit.sourceLines){
    assert.equal(line.start,cursor);
    rebuilt+=part.text.slice(line.start,line.nextStart);cursor=line.nextStart;
    for(const segment of line.segments)assert.ok(segment.start>=line.start&&segment.end<=line.end);
  }
  assert.equal(cursor,part.text.length);assert.equal(rebuilt,part.text);
}
test('furniture preserves inherited/local sources, whitespace and generated metadata at both floors',()=>{
  for(const [width,height] of [[1280,720],[720,1280]])for(const minFontSize of [16,32])for(const textMeasurement of [undefined,outlined]){
    const presentation={organization:[{id:'secondary',name:'Secondary'},{id:'primary',name:' Primary ',role:'primary'}],design:{header:{left:{text:' A\t B \r\n\r\n'},center:{organization:true},right:{section:true}},footer:{left:{text:''},center:{date:' 2026-09-10 '},right:{slideNumber:true}}}};
    const slide={section:'Current section',composition:{minFontSize,overflow:'error'},text:'Body'};
    const before=structuredClone({presentation,slide}),options={width,height,presentation,slideIndex:4,slideNumber:11,textMeasurement,fonts:{body:'Fixture'}};
    const geometry=composeSlide(slide,options),layout=geometry.furniture;
    assert.deepEqual({presentation,slide},before);assert.deepEqual(geometry.diagnostics,[]);
    assert.deepEqual(geometry,composeSlide(slide,options));
    assert.equal(layout.parts.length,6);assert.equal(layout.algorithm,'furniture-flow-v1');
    const byField=field=>layout.parts.find(part=>part.field===field);
    assert.equal(byField('organization').text,' Primary ');assert.equal(byField('organization').sourcePath,'organization.1.name');
    assert.equal(byField('section').sourcePath,'slides.4.section');assert.equal(byField('slideNumber').text,'11');
    assert.equal(byField('text').path,'design.header.left.text');assert.equal(byField('date').generated,false);
    assert.ok(geometry.contentBox.y>=layout.headerBottom);assert.ok(geometry.contentBox.y+geometry.contentBox.height<=layout.footerTop);
    for(const part of layout.parts){
      sourceRanges(part);assert.ok(part.fit.fontSize>=minFontSize);assert.equal(part.style.fontFamily,'Fixture');
      assert.ok(part.box.y>=0&&part.box.y+part.box.height<=height);
      for(const line of part.fit.placement?.lines??[]){if(!line.outline)continue;const ink=line.outline;
        assert.ok(ink.x>=part.box.x+1-.001&&ink.x+ink.width<=part.box.x+part.box.width-1+.001);
        assert.ok(ink.y>=part.box.y+1-.001&&ink.y+ink.height<=part.box.y+part.box.height-1+.001);
      }
    }
  }
});
test('whole local overrides and explicit false preserve furniture-free body geometry',()=>{
  const presentation={design:{header:{left:{text:'Inherited'}},footer:{right:{slideNumber:true}}}};
  const source={text:'Body',composition:{mode:'row',weights:[2,1]}};
  const plain=composeSlide(source),disabled=composeSlide({...source,design:{header:false,footer:false}},{presentation});
  assert.deepEqual(disabled,plain);
  const empty=composeSlide({...source,design:{header:{},footer:{}}},{presentation});
  assert.deepEqual(empty.items,plain.items);assert.deepEqual(empty.contentBox,plain.contentBox);assert.equal(empty.furniture.configured,true);assert.deepEqual(empty.furniture.parts,[]);
  const local=layoutFurniture({...source,design:{header:{right:{text:'Local'}},footer:false}},{presentation,slideIndex:7});
  assert.equal(local.parts.length,1);assert.equal(local.parts[0].path,'slides.7.design.header.right.text');
});
test('images and every authored/generated field coexist without deleting text',()=>{
  const image={src:'data:image/png;base64,AAAA',alt:'Logo'},slide={section:'Section',design:{header:{left:{image,text:'Literal',organization:true,section:true,slideNumber:true,date:'Date'}}}};
  const layout=layoutFurniture(slide,{presentation:{organization:{id:'organization',name:'Organization'}}});
  assert.deepEqual(layout.diagnostics,[]);assert.deepEqual(layout.parts.map(p=>p.field),['image','text','organization','section','slideNumber','date']);
  assert.deepEqual(layout.parts[0].image,image);
  for(let i=1;i<layout.parts.length;i++)assert.ok(layout.parts[i].box.y>=layout.parts[i-1].box.y+layout.parts[i-1].box.height);
});
test('missing generated values diagnose controlling paths and strict composition/pagination reject them',()=>{
  const presentation={design:{header:{left:{date:true,organization:true,section:true}}}},slide={text:'Body'};
  const geometry=composeSlide(slide,{presentation});
  assert.equal(geometry.diagnostics.length,3);assert.ok(geometry.diagnostics.every(d=>d.code==='unresolved-content'&&d.path.startsWith('design.header.left.')));
  assert.throws(()=>composeSlide({...slide,composition:{overflow:'error'}},{presentation}),OPFCompositionError);
  assert.throws(()=>paginateSlide(slide,{presentation}),error=>error instanceof OPFPaginationError&&error.diagnostics.length===3);
  const inactive=layoutFurniture({design:{header:{left:{organization:false,section:false,date:false,slideNumber:false}}}});
  assert.deepEqual(inactive.parts,[]);assert.deepEqual(inactive.diagnostics,[]);
});
test('irreducible furniture and provided ink cannot be hidden by body pagination',()=>{
  const slide={design:{header:{left:{text:'Line\n'.repeat(80)}}},text:'Body'};
  const result=composeSlide(slide);assert.ok(result.furniture.overflow);assert.ok(result.diagnostics.some(d=>d.path==='slides.0.design.header.left.text'));
  assert.throws(()=>paginateSlide(slide),error=>error instanceof OPFPaginationError&&error.diagnostics.some(d=>d.path==='slides.0.design.header.left.text'));
  const hugeInk={measure,outlineBounds:()=>({x:0,y:-16,width:1000,height:16})};
  assert.throws(()=>composeSlide({composition:{overflow:'error'},design:{footer:{right:{text:'X'}}}},{textMeasurement:hugeInk}),OPFCompositionError);
  assert.throws(()=>layoutFurniture({}, {slideNumber:0}),RangeError);
  assert.throws(()=>layoutFurniture({}, {width:Infinity}),RangeError);
});
test('pagination repeats furniture and retains exact body source and mappings',()=>{
  const source='First sentence with enough detail. '.repeat(160);
  const input={design:{header:{left:{text:'Repeated heading'}},footer:{right:{slideNumber:true}}},slides:[{title:'Title',text:source},{text:'Last slide'}]};
  const before=structuredClone(input),numbers=[];
  const textMeasurement={measure:(text,size,style)=>{if(style.path?.endsWith('.slideNumber'))numbers.push(text);return measure(text,size);}};
  const result=paginatePresentation(input,{minFontSize:24,textMeasurement});
  assert.deepEqual(input,before);assert.ok(result.presentation.slides.length>2);
  assert.equal(result.presentation.slides.slice(0,-1).map(slide=>slide.text).join(''),source);
  assert.ok(numbers.includes(String(result.presentation.slides.length)),'The last source slide must use its actual output number.');
  for(const [index,slide]of result.presentation.slides.entries()){
    const geometry=composeSlide(slide,{presentation:result.presentation,slideIndex:index,textMeasurement});assert.deepEqual(geometry.diagnostics,[]);
    assert.equal(geometry.furniture.parts.find(p=>p.field==='slideNumber').text,String(index+1));
    assert.ok(result.pages[index].repeatedMappings.some(m=>m.sourcePath==='design.header.left.text'&&m.outputPath==='design.header.left.text'));
    if(index<result.presentation.slides.length-1)assert.ok(result.pages[index].repeatedMappings.some(m=>m.sourcePath==='slides.0.title'&&m.outputPath===`slides.${index}.title`));
  }
});
test('a continuation whose wider number cannot fit fails atomically',()=>{
  const slide={design:{footer:{right:{slideNumber:true}}},text:'Content with words. '.repeat(200)};
  const before=structuredClone(slide),seen=new Set();
  const textMeasurement={measure:(text,size,style)=>{if(style.path?.endsWith('.slideNumber')){seen.add(text);return text==='9'?size/2:2000;}return measure(text,size);}};
  assert.throws(()=>paginateSlide(slide,{slideNumber:9,textMeasurement}),error=>error instanceof OPFPaginationError&&error.diagnostics.some(d=>d.path==='slides.0.design.footer.right.slideNumber'));
  assert.ok(seen.has('9')&&seen.has('10'));assert.deepEqual(slide,before);
});
