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
    assert.equal(layout.parts.length,6);assert.equal(layout.algorithm,'furniture-flow-v2');
    const byField=field=>layout.parts.find(part=>part.field===field);
    assert.equal(byField('organization').text,' Primary ');assert.equal(byField('organization').sourcePath,'organization.1.name');
    assert.equal(byField('section').sourcePath,'slides.4.section');assert.equal(byField('slideNumber').text,'11');
    assert.equal(byField('text').path,'design.header.left.text');assert.equal(byField('date').generated,false);
    assert.ok(geometry.contentBox.y>=layout.headerBottom);assert.ok(geometry.contentBox.y+geometry.contentBox.height<=layout.footerTop);
    for(const part of layout.parts){
      sourceRanges(part);assert.ok(part.fit.fontSize>=minFontSize);assert.equal(part.style.fontFamily,'Fixture');
      assert.ok(part.box.y>=0&&part.box.y+part.box.height<=height);
      for(const line of part.fit.placement?.lines??[]){if(!line.outline)continue;const ink=line.outline;
        assert.ok(ink.x>=part.box.x+2-.001&&ink.x+ink.width<=part.box.x+part.box.width-2+.001);
        assert.ok(ink.y>=part.box.y+2-.001&&ink.y+ink.height<=part.box.y+part.box.height-2+.001);
      }
    }
  }
});
test('furniture clearance scales with the canvas and respects explicit host padding',()=>{
  const slide={text:'Body',design:{header:{left:{text:'trail  '}}}},before=structuredClone(slide);
  for(const [width,height]of [[1280,720],[640,360]])for(const padding of [undefined,0,1,3]){
    const geometry=composeSlide(slide,{width,height,textMeasurement:outlined,textRasterPadding:padding});
    const part=geometry.furniture.parts[0],actual=(padding??2)*Math.min(width,height)/720;
    assert.equal(part.fit.placement.rasterPadding,actual);
    for(const line of part.fit.placement.lines)if(line.outline)assert.ok(line.outline.x>=part.box.x+actual-.001);
    assert.ok(geometry.contentBox.y>=geometry.furniture.headerBottom);
    assert.equal(part.text,slide.design.header.left.text);sourceRanges(part);
  }
  assert.deepEqual(slide,before);
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
test('slide-number formats keep {current} live and resolve {total} from the displayed deck',()=>{
  const part=(content,options={})=>layoutFurniture({design:{footer:{right:{slideNumber:true,...content}}}},options);
  const plain=part({},{slideNumber:7}).parts[0];
  assert.equal(plain.text,'7');assert.deepEqual(plain.fields,[{type:'slideNumber',start:0,end:1}]);
  const appendix=part({slideNumberFormat:'A-{current}'},{slideNumber:12}).parts[0];
  assert.equal(appendix.text,'A-12');assert.deepEqual(appendix.fields,[{type:'slideNumber',start:2,end:4}]);assert.equal(appendix.generated,true);
  const presentation={slides:[{},{},{},{},{}]};
  const progress=part({slideNumberFormat:'{current} / {total}'},{presentation,slideNumber:2}).parts[0];
  assert.equal(progress.text,'2 / 5');assert.deepEqual(progress.fields,[{type:'slideNumber',start:0,end:1}]);
  assert.equal(part({slideNumberFormat:'Page {current} of {total}'},{presentation,slideNumber:3,slideCount:40}).parts[0].text,'Page 3 of 40');
  const unknownTotal=part({slideNumberFormat:'{current}/{total}'});
  assert.deepEqual(unknownTotal.parts,[]);assert.deepEqual(unknownTotal.diagnostics.map(d=>[d.code,d.path]),[['unresolved-content','slides.0.design.footer.right.slideNumberFormat']]);
  assert.deepEqual(part({slideNumberFormat:'No number'}).diagnostics.map(d=>d.path),['slides.0.design.footer.right.slideNumberFormat']);
  assert.deepEqual(part({slideNumber:false,slideNumberFormat:'{current}/{total}'}).diagnostics,[]);
  assert.throws(()=>part({slideNumberFormat:4}),TypeError);
  assert.throws(()=>part({},{slideCount:0}),RangeError);
});
test('dates are fixed ISO values formatted without a clock, or host-supplied current dates',()=>{
  const part=(content,options={})=>layoutFurniture({design:{footer:{left:content}}},options);
  const text=(content,options)=>part(content,options).parts[0]?.text;
  assert.equal(text({date:'2026-04-23',dateFormat:'MMM d, yyyy'}),'Apr 23, 2026');
  assert.equal(text({date:'2026-04-23',dateFormat:'yyyy-MM-dd'}),'2026-04-23');
  assert.equal(text({date:'2026-04-23',dateFormat:'MMM yyyy'}),'Apr 2026');
  assert.equal(text({date:'2026-04-03',dateFormat:'EEEE, MMMM d, yyyy'}),'Friday, April 3, 2026');
  assert.equal(text({date:'2026-04-23',dateFormat:"EEE dd/MM/yy 'at ''Q'''"}),"Thu 23/04/26 at 'Q'");
  assert.equal(text({date:'2024-02-29',dateFormat:'d MMMM yyyy'}),'29 February 2024');
  const fixed=part({date:'2026-04-23',dateFormat:'MMM d, yyyy'}).parts[0];
  assert.equal(fixed.generated,true);assert.equal(fixed.sourcePath,'slides.0.design.footer.left.date');assert.equal(fixed.fields,undefined);
  const literal=part({date:' 2026-04-23 '}).parts[0];
  assert.equal(literal.text,' 2026-04-23 ');assert.equal(literal.generated,false);assert.equal(literal.sourcePath,'slides.0.design.footer.left.date');
  for(const [content,path] of [[{date:'April 2026',dateFormat:'MMM yyyy'},'date'],[{date:'2026-02-29',dateFormat:'yyyy'},'date'],[{date:'2026-04-23',dateFormat:'hh:mm'},'dateFormat'],[{date:'2026-04-23',dateFormat:"'open"},'dateFormat'],[{date:'2026-04-23',dateFormat:''},'dateFormat']]){
    const result=part(content);assert.deepEqual(result.parts,[]);assert.deepEqual(result.diagnostics.map(d=>[d.code,d.path]),[['unresolved-content',`slides.0.design.footer.left.${path}`]]);
  }
  const current=part({date:true},{date:'2026-04-23'}).parts[0];
  assert.equal(current.text,'4/23/2026');assert.equal(current.generated,true);assert.equal(current.sourcePath,undefined);
  assert.deepEqual(current.fields,[{type:'date',start:0,end:9,format:'M/d/yyyy'}]);
  const formatted=part({date:true,dateFormat:'MMMM d, yyyy'},{date:'2026-04-23'}).parts[0];
  assert.equal(formatted.text,'April 23, 2026');assert.deepEqual(formatted.fields,[{type:'date',start:0,end:14,format:'MMMM d, yyyy'}]);
  assert.deepEqual(part({date:true}).diagnostics.map(d=>d.path),['slides.0.design.footer.left.date']);
  assert.deepEqual(part({date:true,dateFormat:'q'},{date:'2026-04-23'}).diagnostics.map(d=>d.path),['slides.0.design.footer.left.dateFormat']);
  assert.throws(()=>part({date:true},{date:'2026-04-23T00:00:00Z'}),RangeError);
  assert.throws(()=>part({date:'2026-04-23',dateFormat:7}),TypeError);
});
test('date and slide number in one zone stack; in separate zones each keeps one line',()=>{
  const shared=layoutFurniture({design:{footer:{right:{slideNumber:true,date:'2026-04-23',dateFormat:'yyyy-MM-dd'}}}},{slideNumber:3});
  assert.deepEqual(shared.diagnostics,[]);assert.deepEqual(shared.parts.map(p=>[p.field,p.text]),[['slideNumber','3'],['date','2026-04-23']]);
  assert.ok(shared.parts[1].box.y>=shared.parts[0].box.y+shared.parts[0].box.height);
  const split=layoutFurniture({design:{footer:{left:{date:'2026-04-23',dateFormat:'MMM d, yyyy'},right:{slideNumber:true}}}},{slideNumber:3});
  assert.deepEqual(split.diagnostics,[]);assert.equal(split.parts[0].box.y,split.parts[1].box.y);assert.ok(split.footerTop>shared.footerTop);
});
test('whole-deck pagination resolves {total} to the final page count',()=>{
  const source='First sentence with enough detail. '.repeat(160);
  const input={design:{footer:{right:{slideNumber:true,slideNumberFormat:'{current} / {total}'},left:{date:true,dateFormat:'MMM d, yyyy'}}},slides:[{title:'Title',text:source},{text:'Last slide'}]};
  const before=structuredClone(input),result=paginatePresentation(input,{minFontSize:24,date:'2026-04-23'});
  assert.deepEqual(input,before);const total=result.presentation.slides.length;assert.ok(total>2);
  for(const [index,slide]of result.presentation.slides.entries()){
    const geometry=composeSlide(slide,{presentation:result.presentation,slideIndex:index,date:'2026-04-23'});assert.deepEqual(geometry.diagnostics,[]);
    assert.equal(geometry.furniture.parts.find(p=>p.field==='slideNumber').text,`${index+1} / ${total}`);
    assert.equal(geometry.furniture.parts.find(p=>p.field==='date').text,'Apr 23, 2026');
  }
  assert.throws(()=>paginatePresentation(input,{minFontSize:24}),OPFPaginationError);
});
test('a {total} retry reports each unknown font scheme once',()=>{
  const source='First sentence with enough detail. '.repeat(160),issues=[];
  const input={design:{fontScheme:'no-such-scheme',footer:{right:{slideNumber:true,slideNumberFormat:'{current} / {total}'}}},slides:[{title:'Title',text:source},{text:'Last slide'}]};
  const result=paginatePresentation(input,{minFontSize:24,onDiagnostic:issue=>issues.push(issue)});
  assert.ok(result.presentation.slides.length>2,'The retry path runs: the page count differs from the source count.');
  assert.deepEqual(issues.map(issue=>[issue.code,issue.path]),[['unresolved-font-scheme','design.fontScheme']]);
});
test('generated socials format the primary organization profiles through platform records',async()=>{
  const {socialPlatforms}=await import('../dist/catalogs.js');
  const {resolveSocialProfile}=await import('../dist/index.js');
  const organization={id:'acme',name:'Acme',socials:{linkedin:'acme',x:'@acme',github:'acme',mastodon:'@acme@hachyderm.io',bluesky:'https://bsky.app/profile/acme.bsky.social',custom:' Visit  us ',blank:'  '}};
  const presentation={organization:[{id:'other',name:'Other',socials:{x:'other'}},{...organization,role:'primary'}],design:{footer:{right:{organization:true,socials:true}}}};
  const before=structuredClone(presentation);
  const layout=layoutFurniture({text:'Body'},{presentation,socialPlatforms});
  assert.deepEqual(presentation,before);assert.deepEqual(layout.diagnostics,[]);
  const part=layout.parts.find(item=>item.field==='socials');
  assert.equal(part.generated,true);assert.equal(part.path,'design.footer.right.socials');assert.equal(part.sourcePath,'organization.1.socials');
  assert.deepEqual(layout.parts.map(item=>item.field),['organization','socials']);
  assert.equal(part.text,['linkedin.com/company/acme','x.com/acme','github.com/acme','mastodon.social/@acme@hachyderm.io','bsky.app/profile/acme.bsky.social','Visit us'].join('\n'));
  assert.deepEqual(part.links.map(link=>[link.platform,link.href,link.resolved,link.sourcePath]),[
    ['linkedin','https://linkedin.com/company/acme',true,'organization.1.socials.linkedin'],
    ['x','https://x.com/acme',true,'organization.1.socials.x'],
    ['github','https://github.com/acme',true,'organization.1.socials.github'],
    ['mastodon','https://mastodon.social/@acme@hachyderm.io',true,'organization.1.socials.mastodon'],
    ['bluesky','https://bsky.app/profile/acme.bsky.social',false,'organization.1.socials.bluesky'],
    ['custom',undefined,false,'organization.1.socials.custom'],
  ]);
  assert.equal(part.fit.sourceLines.filter(line=>line.boundary!=='soft').length,part.links.length);
  // Speakers use member profile patterns; inline records win over host records.
  assert.equal(resolveSocialProfile('linkedin','alice-chen',socialPlatforms,'speaker').text,'linkedin.com/in/alice-chen');
  const inline=layoutFurniture({},{presentation:{...presentation,catalogs:{socialPlatforms:{records:[{id:'x',profileUrlPattern:'https://example.test/u/{handle}',handlePrefix:'@'}]}}},socialPlatforms});
  assert.equal(inline.parts[1].links[1].text,'example.test/u/acme');
  // Without any record a handle stays the raw authored value (Socials engine fallback).
  const bare=layoutFurniture({},{presentation});
  assert.deepEqual(bare.parts[1].links.slice(0,2).map(link=>[link.text,link.href]),[['acme',undefined],['@acme',undefined]]);
  // Every catalog platform formats its own example handle.
  for(const platformRecord of socialPlatforms){
    const profile=resolveSocialProfile(platformRecord.id,platformRecord.handleExample,socialPlatforms);
    assert.equal(profile.resolved,true,platformRecord.id);assert.match(profile.href,/^https:\/\//);assert.equal(`https://${profile.text}`,decodeURI(profile.href));
  }
});
test('generated socials without organization socials diagnose their controlling path',()=>{
  for(const organization of [undefined,{id:'acme',name:'Acme'},{id:'acme',name:'Acme',socials:{x:' '}}]){
    const layout=layoutFurniture({},{presentation:{organization,design:{header:{left:{socials:true}}}}});
    assert.deepEqual(layout.parts,[]);assert.deepEqual(layout.diagnostics.map(d=>[d.code,d.path]),[['unresolved-content','design.header.left.socials']]);
  }
  assert.deepEqual(layoutFurniture({},{presentation:{organization:{id:'a',name:'A',socials:{x:'a'}},design:{header:{left:{socials:false}}}}}).parts,[]);
});
test('whole-deck pagination accepts generated socials and rejects missing ones atomically',()=>{
  const input={$schema:'https://openpresentation.org/schema/opf/v1',organization:{id:'acme',name:'Acme',socials:{x:'@acme'}},design:{footer:{right:{socials:true}}},slides:[{text:'Body'}]};
  const {pages}=paginatePresentation(input);
  assert.equal(pages.length,1);
  assert.throws(()=>paginatePresentation({...input,organization:{id:'acme',name:'Acme'}}),OPFPaginationError);
});
test('one footer carries FF-27 live slide-number fields and FF-34 social links without mixing them',async()=>{
  const {socialPlatforms}=await import('../dist/catalogs.js');
  const presentation={organization:{id:'acme',name:'Acme',socials:{x:'@acme',custom:'Visit us'}},slides:[{},{},{}],
    design:{footer:{left:{slideNumber:true,slideNumberFormat:'Slide {current} of {total}'},right:{slideNumber:true,socials:true}}}};
  const layout=layoutFurniture({},{presentation,socialPlatforms,slideIndex:1});
  assert.deepEqual(layout.diagnostics,[]);
  assert.deepEqual(layout.parts.map(part=>[part.zone,part.field]),[['left','slideNumber'],['right','socials'],['right','slideNumber']]);
  const [numbered,socials,bare]=layout.parts;
  assert.equal(numbered.text,'Slide 2 of 3');assert.deepEqual(numbered.fields,[{type:'slideNumber',start:6,end:7}]);assert.equal(numbered.links,undefined);
  assert.equal(socials.text,'x.com/acme\nVisit us');assert.equal(socials.fields,undefined);
  assert.deepEqual(socials.links.map(link=>[link.platform,link.href]),[['x','https://x.com/acme'],['custom',undefined]]);
  assert.equal(bare.text,'2');assert.deepEqual(bare.fields,[{type:'slideNumber',start:0,end:1}]);assert.equal(bare.links,undefined);
  assert.ok(bare.box.y>=socials.box.y+socials.box.height);
});
