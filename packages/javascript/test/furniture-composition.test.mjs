import assert from 'node:assert/strict';
import test from 'node:test';
import {composeSlide,layoutFurniture,OPFCompositionError} from '../dist/composition.js';
import {paginateSlide,paginate,OPFPaginationError} from '../dist/pagination.js';

const measure=(text,size)=>{assert.ok(!/[\r\n\t]/u.test(text));return [...text].length*size/2;};
// Ink excludes trailing spaces (a space that does not fit hangs at the end of its line, RR-17).
const outlined={measure,outlineBounds:(text,size)=>text.trim()?{x:-2,y:-size,width:measure(text.trimEnd(),size)+4,height:size+3}:null};
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
    const presentation={design:{header:{left:{text:' A\t B \r\n\r\n'},center:{text:' Primary '},right:{text:'{{slide.section}}'}},footer:{left:{text:''},center:{date:' 2026-09-10 '},right:{text:'{{slide.number}}'}}}};
    const slide={section:'Current section',composition:{minFontSize,overflow:'error'},text:'Body'};
    const before=structuredClone({presentation,slide}),options={width,height,presentation,slideIndex:4,slideNumber:11,textMeasurement,fontFamilies:{body:'Fixture'}};
    const geometry=composeSlide(slide,options),layout=geometry.furniture;
    assert.deepEqual({presentation,slide},before);assert.deepEqual(geometry.diagnostics,[]);
    assert.deepEqual(geometry,composeSlide(slide,options));
    assert.equal(layout.parts.length,6);assert.equal(layout.algorithm,'furniture-flow-v2');
    const byPath=path=>layout.parts.find(part=>part.path===path);
    assert.equal(byPath('design.header.center.text').text,' Primary ');
    assert.equal(byPath('design.header.right.text').text,'Current section');assert.equal(byPath('design.footer.right.text').text,'11');
    assert.deepEqual(byPath('design.footer.right.text').fields,[{type:'slideNumber',start:0,end:2}]);
    assert.equal(byPath('design.header.left.text').sourcePath,'design.header.left.text');assert.equal(layout.parts.find(part=>part.field==='date').generated,false);
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
  const presentation={design:{header:{left:{text:'Inherited'}},footer:{right:{text:'{{slide.number}}'}}}};
  const source={text:'Body',composition:{mode:'row',weights:[2,1]}};
  const plain=composeSlide(source),disabled=composeSlide({...source,design:{header:false,footer:false}},{presentation});
  assert.deepEqual(disabled,plain);
  const empty=composeSlide({...source,design:{header:{},footer:{}}},{presentation});
  assert.deepEqual(empty.items,plain.items);assert.deepEqual(empty.contentBox,plain.contentBox);assert.equal(empty.furniture.configured,true);assert.deepEqual(empty.furniture.parts,[]);
  const local=layoutFurniture({...source,design:{header:{right:{text:'Local'}},footer:false}},{presentation,slideIndex:7});
  assert.equal(local.parts.length,1);assert.equal(local.parts[0].path,'slides.7.design.header.right.text');
});
test('images and every authored/generated field coexist without deleting text',()=>{
  const image={src:'data:image/png;base64,AAAA',alt:'Logo'},slide={section:'Section',design:{header:{left:{image,text:'Literal\n{{slide.section}}\n{{slide.number}}',date:'Date'}}}};
  const layout=layoutFurniture(slide,{slideNumber:4});
  assert.deepEqual(layout.diagnostics,[]);assert.deepEqual(layout.parts.map(p=>p.field),['image','text','date']);
  assert.deepEqual(layout.parts[0].image,image);assert.equal(layout.parts[1].text,'Literal\nSection\n4');
  assert.deepEqual(layout.parts[1].fields,[{type:'slideNumber',start:16,end:17}]);assert.equal(layout.parts[1].generated,false);
  // RR-71: one row, image then text then date, each vertically centered on the row.
  const center=part=>part.box.y+part.box.height/2;
  for(let i=1;i<layout.parts.length;i++){assert.ok(layout.parts[i].box.x>=layout.parts[i-1].box.x+layout.parts[i-1].box.width+12-1e-9);assert.ok(Math.abs(center(layout.parts[i])-center(layout.parts[0]))<1e-9);}
});
test('missing generated values diagnose controlling paths and strict composition/pagination reject them',()=>{
  const presentation={design:{header:{left:{date:true,socials:true}}}},slide={text:'Body'};
  const geometry=composeSlide(slide,{presentation});
  assert.equal(geometry.diagnostics.length,2);assert.ok(geometry.diagnostics.every(d=>d.code==='unresolved-content'&&d.path.startsWith('design.header.left.')));
  assert.throws(()=>composeSlide({...slide,composition:{overflow:'error'}},{presentation}),OPFCompositionError);
  assert.throws(()=>paginateSlide(slide,{presentation}),error=>error instanceof OPFPaginationError&&error.diagnostics.length===2);
  const inactive=layoutFurniture({design:{header:{left:{socials:false,date:false,logo:false}}}});
  assert.deepEqual(inactive.parts,[]);assert.deepEqual(inactive.diagnostics,[]);
  // A slide without a section draws {{slide.section}} as nothing (validation warns at the slide), never a layout error.
  const sectionless=layoutFurniture({design:{header:{left:{text:'{{slide.section}}'}}}});
  assert.deepEqual(sectionless.diagnostics,[]);assert.equal(sectionless.parts[0].text,'');
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
  const input={design:{header:{left:{text:'Repeated heading'}},footer:{right:{text:'{{slide.number}}'}}},slides:[{title:'Title',text:source},{text:'Last slide'}]};
  const before=structuredClone(input),numbers=[];
  const textMeasurement={measure:(text,size,style)=>{if(style.path?.endsWith('footer.right.text'))numbers.push(text);return measure(text,size);}};
  const result=paginate(input,{minFontSize:24,fonts:{textMeasurement}});
  assert.deepEqual(input,before);assert.ok(result.presentation.slides.length>2);
  assert.equal(result.presentation.slides.slice(0,-1).map(slide=>slide.text).join(''),source);
  assert.ok(numbers.includes(String(result.presentation.slides.length)),'The last source slide must use its actual output number.');
  for(const [index,slide]of result.presentation.slides.entries()){
    const geometry=composeSlide(slide,{presentation:result.presentation,slideIndex:index,textMeasurement});assert.deepEqual(geometry.diagnostics,[]);
    assert.equal(geometry.furniture.parts.find(p=>p.path==='design.footer.right.text').text,String(index+1));
    assert.ok(result.pages[index].repeatedMappings.some(m=>m.sourcePath==='design.header.left.text'&&m.outputPath==='design.header.left.text'));
    if(index<result.presentation.slides.length-1)assert.ok(result.pages[index].repeatedMappings.some(m=>m.sourcePath==='slides.0.title'&&m.outputPath===`slides.${index}.title`));
  }
});
test('a continuation whose wider number cannot fit fails atomically',()=>{
  const slide={design:{footer:{right:{text:'{{slide.number}}'}}},text:'Content with words. '.repeat(200)};
  const before=structuredClone(slide),seen=new Set();
  const textMeasurement={measure:(text,size,style)=>{if(style.path?.endsWith('footer.right.text')){seen.add(text);return text==='9'?size/2:2000;}return measure(text,size);}};
  assert.throws(()=>paginateSlide(slide,{slideNumber:9,fonts:{textMeasurement}}),error=>error instanceof OPFPaginationError&&error.diagnostics.some(d=>d.path==='slides.0.design.footer.right.text'));
  assert.ok(seen.has('9')&&seen.has('10'));assert.deepEqual(slide,before);
});
test('{{slide.number}} in header/footer text is a live field and {{deck.slideCount}} the displayed deck size',()=>{
  const part=(text,options={})=>layoutFurniture({design:{footer:{right:{text}}}},options);
  const plain=part('{{slide.number}}',{slideNumber:7}).parts[0];
  assert.equal(plain.text,'7');assert.deepEqual(plain.fields,[{type:'slideNumber',start:0,end:1}]);
  assert.equal(plain.field,'text');assert.equal(plain.generated,false);assert.equal(plain.sourcePath,'slides.0.design.footer.right.text');
  const appendix=part('A-{{ slide.number }}',{slideNumber:12}).parts[0];
  assert.equal(appendix.text,'A-12');assert.deepEqual(appendix.fields,[{type:'slideNumber',start:2,end:4}]);
  const presentation={slides:[{},{},{},{},{}]};
  const progress=part('{{slide.number}} / {{deck.slideCount}}',{presentation,slideNumber:2}).parts[0];
  assert.equal(progress.text,'2 / 5');assert.deepEqual(progress.fields,[{type:'slideNumber',start:0,end:1}]);
  const twice=part('Page {{deck.slideCount}}-{{slide.number}} ({{slide.number}})',{presentation,slideNumber:3,slideCount:40}).parts[0];
  assert.equal(twice.text,'Page 40-3 (3)');assert.deepEqual(twice.fields,[{type:'slideNumber',start:8,end:9},{type:'slideNumber',start:11,end:12}]);
  const unknownTotal=part('{{slide.number}}/{{deck.slideCount}}');
  assert.equal(unknownTotal.parts[0].text,'1/{{deck.slideCount}}');assert.deepEqual(unknownTotal.diagnostics.map(d=>[d.code,d.path]),[['unresolved-content','slides.0.design.footer.right.text']]);
  // An escaped token is literal text and no field; other tokens and escapes are left for the deck-wide pass.
  const escaped=part('\\{{slide.number}} {{slide.number}} \\{{client}} {{slide.unknown}}',{slideNumber:5}).parts[0];
  assert.equal(escaped.text,'{{slide.number}} 5 \\{{client}} {{slide.unknown}}');assert.deepEqual(escaped.fields,[{type:'slideNumber',start:17,end:18}]);
  assert.equal(part('No number').parts[0].fields,undefined);
  assert.throws(()=>part('{{slide.number}}',{slideCount:0}),RangeError);
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
test('date and slide number in one zone sit side by side on one line, aligned to the zone edge',()=>{
  const shared=layoutFurniture({design:{footer:{right:{text:'{{slide.number}}',date:'2026-04-23',dateFormat:'yyyy-MM-dd'}}}},{slideNumber:3});
  assert.deepEqual(shared.diagnostics,[]);assert.deepEqual(shared.parts.map(p=>[p.field,p.text]),[['text','3'],['date','2026-04-23']]);
  const [number,date]=shared.parts;
  assert.equal(number.box.y,date.box.y);assert.ok(Math.abs(date.box.x-(number.box.x+number.box.width+12))<1e-9,'one gap between the parts');
  assert.ok(Math.abs(date.box.x+date.box.width-1280*.93)<1e-9,'the row ends at the right zone edge');
  for(const part of shared.parts)assert.equal(part.fit.lines.length,1);
  const split=layoutFurniture({design:{footer:{left:{date:'2026-04-23',dateFormat:'MMM d, yyyy'},right:{text:'{{slide.number}}'}}}},{slideNumber:3});
  assert.deepEqual(split.diagnostics,[]);assert.equal(split.parts[0].box.y,split.parts[1].box.y);assert.equal(split.footerTop,shared.footerTop);
});
test('whole-deck pagination resolves {{deck.slideCount}} to the final page count',()=>{
  const source='First sentence with enough detail. '.repeat(160);
  const input={design:{footer:{right:{text:'{{slide.number}} / {{deck.slideCount}}'},left:{date:true,dateFormat:'MMM d, yyyy'}}},slides:[{title:'Title',text:source},{text:'Last slide'}]};
  const before=structuredClone(input),result=paginate(input,{minFontSize:24,date:'2026-04-23'});
  assert.deepEqual(input,before);const total=result.presentation.slides.length;assert.ok(total>2);
  for(const [index,slide]of result.presentation.slides.entries()){
    const geometry=composeSlide(slide,{presentation:result.presentation,slideIndex:index,date:'2026-04-23'});assert.deepEqual(geometry.diagnostics,[]);
    assert.equal(geometry.furniture.parts.find(p=>p.path==='design.footer.right.text').text,`${index+1} / ${total}`);
    assert.equal(geometry.furniture.parts.find(p=>p.field==='date').text,'Apr 23, 2026');
  }
  assert.throws(()=>paginate(input,{minFontSize:24}),OPFPaginationError);
});
test('a slide-count retry reports each unknown font scheme once',()=>{
  const source='First sentence with enough detail. '.repeat(160),issues=[];
  const input={design:{fontScheme:'no-such-scheme',footer:{right:{text:'{{slide.number}} / {{deck.slideCount}}'}}},slides:[{title:'Title',text:source},{text:'Last slide'}]};
  const result=paginate(input,{minFontSize:24,onDiagnostic:issue=>issues.push(issue)});
  assert.ok(result.presentation.slides.length>2,'The retry path runs: the page count differs from the source count.');
  assert.deepEqual(issues.map(issue=>[issue.code,issue.path]),[['unresolved-reference','design.fontScheme']]);
});
test('generated socials format the primary organization profiles through the engine social-platform vocabulary',async()=>{
  const {resolveSocialProfile}=await import('../dist/composition.js');
  const organization={id:'acme',name:'Acme',socials:{linkedin:'acme',x:'@acme',github:'acme',mastodon:'@acme@hachyderm.io',bluesky:'https://bsky.app/profile/acme.bsky.social',custom:' Visit  us ',blank:'  '}};
  const presentation={organization:[{id:'other',name:'Other',socials:{x:'other'}},{...organization,role:'primary'}],design:{footer:{right:{text:'Acme',socials:true}}}};
  const before=structuredClone(presentation);
  const layout=layoutFurniture({text:'Body'},{presentation});
  assert.deepEqual(presentation,before);assert.deepEqual(layout.diagnostics,[]);
  const part=layout.parts.find(item=>item.field==='socials');
  assert.equal(part.generated,true);assert.equal(part.path,'design.footer.right.socials');assert.equal(part.sourcePath,'organization.1.socials');
  assert.deepEqual(layout.parts.map(item=>item.field),['text','socials']);
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
  // Speakers use member profile patterns.
  assert.equal(resolveSocialProfile('linkedin','alice-chen','speaker').text,'linkedin.com/in/alice-chen');
  // A key outside the vocabulary keeps the raw authored value (Socials engine fallback).
  assert.deepEqual(resolveSocialProfile('custom','acme'),{text:'acme',resolved:false});
  // Every platform of the vocabulary formats the example handle of its gallery display record.
  const {catalogDisplay}=await import('../dist/catalog.js');
  const {SOCIAL_PLATFORMS}=await import('../dist/composition.js');
  assert.deepEqual(Object.keys(SOCIAL_PLATFORMS).sort(),Object.keys(catalogDisplay.socialPlatforms).sort());
  for(const [platform,display] of Object.entries(catalogDisplay.socialPlatforms)){
    const profile=resolveSocialProfile(platform,display.handleExample);
    assert.equal(profile.resolved,true,platform);assert.match(profile.href,/^https:\/\//);assert.equal(`https://${profile.text}`,decodeURI(profile.href));
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
  const {pages}=paginate(input);
  assert.equal(pages.length,1);
  assert.throws(()=>paginate({...input,organization:{id:'acme',name:'Acme'}}),OPFPaginationError);
});
test('one footer carries FF-27 live slide-number fields and FF-34 social links without mixing them',async()=>{
  const presentation={organization:{id:'acme',name:'Acme',socials:{x:'@acme',custom:'Visit us'}},slides:[{},{},{}],
    design:{footer:{left:{text:'Slide {{slide.number}} of {{deck.slideCount}}'},right:{text:'{{slide.number}}',socials:true}}}};
  const layout=layoutFurniture({},{presentation,slideIndex:1});
  assert.deepEqual(layout.diagnostics,[]);
  assert.deepEqual(layout.parts.map(part=>[part.zone,part.field]),[['left','text'],['right','text'],['right','socials']]);
  const [numbered,bare,socials]=layout.parts;
  assert.equal(numbered.text,'Slide 2 of 3');assert.deepEqual(numbered.fields,[{type:'slideNumber',start:6,end:7}]);assert.equal(numbered.links,undefined);
  assert.equal(socials.text,'x.com/acme\nVisit us');assert.equal(socials.fields,undefined);
  assert.deepEqual(socials.links.map(link=>[link.platform,link.href]),[['x','https://x.com/acme'],['custom',undefined]]);
  assert.equal(bare.text,'2');assert.deepEqual(bare.fields,[{type:'slideNumber',start:0,end:1}]);assert.equal(bare.links,undefined);
  // Side by side (RR-71): the one-line number is centered on the two-line socials.
  assert.ok(socials.box.x>=bare.box.x+bare.box.width);
  assert.ok(Math.abs(bare.box.y+bare.box.height/2-(socials.box.y+socials.box.height/2))<1e-9);
});
