// Pure planner plus genuine current V2 topology/geometry. No native-pixel claim.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {convert} from '@openpresentation/opf';
import {itemizeScripts,textWidthMeasurer,runInHeading,paragraphDirection,physicalAlignment} from '@openpresentation/opf/composition';
import {resolvePresentation} from '@openpresentation/opf-render';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx,fromPptx} from '../dist/index.js';
import {planNativeUnicodeIntervals} from '../dist/native-text-fragments.js';
import {readNativeScalarGroups} from '../dist/native-scalar-fragments.js';

const bytes=readFileSync(new URL('../../../scripts/native-acceptance/test-fixtures/b07-current/original-10.opf.json',import.meta.url)),source=JSON.parse(bytes);
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decode=text=>String(parser.parse('<t>'+text+'</t>').t??'');
const attr=(xml,key)=>new RegExp('\\b'+key+'="([^"]*)"').exec(xml)?.[1];
const nativeShapes=xml=>[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([xml])=>({xml,name:attr(/<p:cNvPr\b[^>]*>/.exec(xml)?.[0]??'','name'),runs:[...xml.matchAll(/<a:r>(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>)<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(([,properties,text])=>({properties,text:decode(text)}))}));

test('Unicode intervals preserve original UTF16, native CS properties and derived scalar styles',()=>{
 const scalar='Item ١: Arabic-Indic number',style={lang:'ar-SA',fontFamily:'Chosen Latin',fontWeight:400},bold={...style,fontWeight:700},properties='<a:rPr lang="ar-SA" sz="2000"><a:latin typeface="Chosen Latin"/><a:cs typeface="Actual Arabic"/></a:rPr>';
 const heading=runInHeading(scalar);assert(heading);assert.equal(heading[0].text,'Item ١:');assert.equal(heading[0].bold,true);
 const first=heading[0].text,rest=heading[1],measurement={measure:(text,size)=>text.length*size},profile=()=>({script:'Arab',bcp47:'ar-SA'});
 const line={width:scalar.length*10,fragments:[{text:first,x:0,width:first.length*10,fontSize:10,style:bold},{text:rest,x:first.length*10,width:rest.length*10,fontSize:10,style}]};
 const input={source:scalar,from:0,to:scalar.length,line,originX:17,rtl:false,nativeRuns:[{text:scalar,properties}],measurement,profile},planned=planNativeUnicodeIntervals(input);
 assert.equal(planned.status,'planned');assert.deepEqual(planned.intervals.map(part=>part.text),['Item ','١:',rest]);
 assert.deepEqual(planned.intervals.map(part=>[part.from,part.to]),[[0,5],[5,7],[7,27]]);
 assert.deepEqual(planned.intervals.map(part=>part.style.fontWeight),[700,700,400]);
 assert.equal(planned.intervals[1].role,'complexScript');assert.equal(planned.intervals[1].numeric,true);assert.equal(planned.intervals[1].text.charCodeAt(0),0x661);
 for(const part of planned.intervals){assert.equal(part.native.map(run=>run.text).join(''),part.text);assert(part.native.every(run=>run.properties===properties));assert.equal(part.x,17+part.from*10);assert.equal(part.right,17+part.to*10);assert(!Object.hasOwn(part,'restoreScalar'));}
 const persian={...input,line:structuredClone(line),nativeRuns:structuredClone(input.nativeRuns)};persian.source=scalar.replace('١','۱');persian.line.fragments[0].text=first.replace('١','۱');persian.nativeRuns[0].text=persian.source;assert.equal(planNativeUnicodeIntervals(persian).intervals[1].text.charCodeAt(0),0x6f1);
 const later=planNativeUnicodeIntervals({...input,source:'Earlier '+scalar,from:8,to:8+scalar.length});assert.equal(later.status,'planned');assert.deepEqual(later.intervals.map(part=>[part.from,part.to]),[[8,13],[13,15],[15,35]]);assert.deepEqual(later.intervals.flatMap(part=>part.native.map(run=>[run.from,run.to])),[[8,13],[13,15],[15,35]]);
 assert.deepEqual(planNativeUnicodeIntervals({...input,nativeRuns:[{text:scalar.replace(':',';'),properties}]}),{status:'refused',reason:'current-text-mismatch'},'Current edits never replay the original scalar');
 assert.equal(planned.alignmentWidth,line.width);assert.equal(planned.fullAdvance,line.width);assert.equal(planned.hangingSpaceAdvance,0);
 const hanging={...input,line:structuredClone(line),nativeRuns:structuredClone(input.nativeRuns)};hanging.source+='  ';hanging.to+=2;hanging.line.fragments[1].text+='  ';hanging.line.fragments[1].width+=20;hanging.nativeRuns[0].text+='  ';
 const hangingPlan=planNativeUnicodeIntervals(hanging);assert.equal(hangingPlan.status,'planned');assert.equal(hangingPlan.alignmentWidth,line.width);assert.equal(hangingPlan.fullAdvance,line.width+20);assert.equal(hangingPlan.hangingSpaceAdvance,20);assert.equal(hangingPlan.intervals.at(-1).to,hanging.to);assert.equal(hangingPlan.intervals.at(-1).text,rest+'  ');assert.equal(hangingPlan.intervals.at(-1).right,17+line.width+20);
 assert.deepEqual(planNativeUnicodeIntervals({...input,line:{...line,width:line.width-10}}),{status:'refused',reason:'line-advance-mismatch'},'An unexplained gap cannot become whitespace or padding');
 assert.deepEqual(planNativeUnicodeIntervals({...hanging,line:{...hanging.line,width:line.width-5}}),{status:'refused',reason:'line-advance-mismatch'},'Real trailing spaces cannot explain an arbitrary extra gap');
 assert.deepEqual(planNativeUnicodeIntervals({...input,measurement:{measure:(text,size)=>text.length*size+(text==='١:'?1:0)}}),{status:'refused',reason:'nonadditive-script-advance'});
 assert.equal(planNativeUnicodeIntervals({...input,rtl:true}).status,'refused');
 assert.equal(planNativeUnicodeIntervals({...input,profile:()=>({script:'Latn'})}).status,'refused');
 const inherited={...input,line:structuredClone(line),profile:language=>language===undefined?{script:'Arab',bcp47:'ar-SA'}:undefined};for(const fragment of inherited.line.fragments)delete fragment.style.lang;
 const inheritedPlan=planNativeUnicodeIntervals(inherited);assert.equal(inheritedPlan.status,'planned');assert(inheritedPlan.intervals.every(part=>!Object.hasOwn(part.style,'lang')),'Effective deck proofing must not inject an own lang property into the resolved style');assert.deepEqual(inheritedPlan.intervals.map(part=>part.native),planned.intervals.map(part=>part.native));assert.equal(planNativeUnicodeIntervals({...inherited,profile:()=>undefined}).status,'refused','Missing effective script profile must not be guessed');
 for(const kind of ['text','tab','marker','foreign','',null,false]){const changed={...input,line:structuredClone(line)};changed.line.fragments[0].kind=kind;assert.equal(planNativeUnicodeIntervals(changed).status,'refused','Only the actual unmarked RichTextFragment contract is admitted: '+kind);}
 for(const [key,value]of [['tracking',.1],['caps',true],['lang',42],['lang','']]){const changed={...input,line:structuredClone(line)};changed.line.fragments[0].style[key]=value;assert.equal(planNativeUnicodeIntervals(changed).status,'refused',key+' must retain its original refusal');}
 for(const scalar of ['Item א: suffix','Item بند: suffix','Item १: suffix','Item 1: suffix']){const changed={...input,source:scalar,from:0,to:scalar.length,nativeRuns:[{text:scalar,properties}],line:{width:scalar.length*10,fragments:[{text:scalar,x:0,width:scalar.length*10,fontSize:10,style}]}};assert.equal(planNativeUnicodeIntervals(changed).status,'refused','Other scripts/Arabic letters/ASCII-only digits are not Unicode-digit eligibility');}
 const changedProperties=properties.replace('Actual Arabic','Current Edited Arabic'),current=planNativeUnicodeIntervals({...input,nativeRuns:[{text:scalar,properties:changedProperties}]});assert.equal(current.status,'planned');assert(current.intervals.every(part=>part.native.every(run=>run.properties===changedProperties)),'No old font/property receipt is replayed');
 const latinProperties=properties.replace('Actual Arabic','Chosen Latin'),slots=planNativeUnicodeIntervals({...input,nativeRuns:[{text:'Item ',properties:latinProperties},{text:'١:',properties},{text:rest,properties:latinProperties}]});assert.equal(slots.status,'planned');assert.equal(slots.intervals[0].native[0].properties,latinProperties);assert.equal(slots.intervals[1].native[0].properties,properties,'The actual Arabic CS face on the Unicode digit must not become the Latin CS face');assert.equal(slots.intervals[2].native[0].properties,latinProperties);
 for(const malformed of [undefined,null,[],{}, {...input,source:{}},{...input,from:-1},{...input,from:.5},{...input,to:scalar.length+1},{...input,line:{...line,fragments:null}},{...input,nativeRuns:null}])assert.equal(planNativeUnicodeIntervals(malformed).status,'refused');
 for(const bad of ['<a:rPr>','<a:rPr><a:latin/></a:rPr><a:rPr/>','<a:rPr/><other/>'])assert.equal(planNativeUnicodeIntervals({...input,nativeRuns:[{text:scalar,properties:bad}]}).reason,'native-properties');
 const supplementary=scalar+'😀',split=supplementary.length-1;assert.equal(planNativeUnicodeIntervals({...input,source:supplementary,to:supplementary.length,nativeRuns:[{text:supplementary.slice(0,split),properties},{text:supplementary.slice(split),properties}],line:{...line,fragments:[{...line.fragments[0],text:supplementary}]}}).reason,'native-boundary','A current RPr boundary must not bisect one scalar code point');
 assert.equal(planNativeUnicodeIntervals({...input,source:scalar+'\ud83d'}).reason,'source-boundary');
});

test('genuine unchanged case10 supplies exact native/script/core/SVG geometry including full hanging spaces',async()=>{
 assert.equal(bytes.length,519);assert.equal(createHash('sha256').update(bytes).digest('hex'),'69ad66eae58f2d7d7a075a78d8cc64d70b8900032f31e97d9e87748ecf85ecbb');
 const blocks=source.slides[0].blocks,body=[blocks[0].text,blocks[1].text,...blocks[2].items];assert.deepEqual(body.map(text=>text.length),[27,22,27,22]);assert.equal(body.reduce((sum,text)=>sum+text.length,0),98);assert.equal(source.slides[0].title.length,19);
 const before=structuredClone(source),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source});
 try{
  const diagnostic=phase=>issue=>console.log(JSON.stringify({event:'native-unicode-public-diagnostic',phase,issue}));
  const pptx=await toPptx(source,{fonts,onDiagnostic:diagnostic('export')}),preview=await convert(source,{format:'svg',fonts}),bound=resolvePresentation(source,{fonts,validate:false}).slides[0],zip=unzipSync(new Uint8Array(pptx)),xml=strFromU8(zip['ppt/slides/slide1.xml']),all=nativeShapes(xml),svg=strFromU8(preview.files[0].bytes),svgText=[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([,attributes,content])=>({attributes,content,text:decode(content.replace(/<[^>]*>/g,''))}));
  const current=await fromPptx(pptx,{onDiagnostic:diagnostic('import')}),ownership=readNativeScalarGroups(zip,'ppt/slides/slide1.xml',diagnostic('raw-scan'));console.log(JSON.stringify({event:'native-unicode-public-ownership',groups:ownership.groups.length,exact:ownership.groups.filter(group=>group.exact).length,lines:ownership.groups.flatMap(group=>group.header.lines).length,nativeUTF16:all.flatMap(shape=>shape.runs).map(run=>run.text).join('').length}));
  assert.deepEqual(source,before);assert.deepEqual(current,source);assert.equal(all.flatMap(shape=>shape.runs).map(run=>run.text).join('').length,117);
  assert.equal(ownership.groups.length,4);assert(ownership.groups.every(group=>group.exact));assert.equal(ownership.groups.flatMap(group=>group.header.lines).length,7);
  const rows=[];
  for(const item of bound.geometry.items){
   if(item.field==='text')rows.push({scalar:item.value,fit:item.text,style:item.textStyle,box:item.box,prefix:`OPF text ${item.path} line `,lineOffset:0});
   if(item.field==='items'){assert(!bound.geometry.arrangements?.some(arrangement=>arrangement.path===item.path));let lineOffset=0;for(const entry of item.text.listEntries){rows.push({kind:'list',direction:entry.direction,scalar:item.value[entry.index],fit:entry.text,style:item.textStyle,box:entry.textBox,prefix:`OPF list ${item.path} line `,lineOffset});lineOffset+=entry.text.lines.length;}}
  }
  assert.equal(rows.length,4);let numericLines=0,totalLines=0,plannedLines=0,expectedShapes=1;
  for(const row of rows){let cursor=0;assert.equal(typeof row.scalar,'string');
   for(const [index,text]of row.fit.lines.entries()){
    const from=cursor,to=from+text.length;assert.equal(row.scalar.slice(from,to),text);cursor=to;totalLines++;
    const name=row.prefix+(row.lineOffset+index),owner=ownership.groups.find(group=>group.header.lines.some(line=>line.original.name===name));assert(owner);const ownedLine=owner.header.lines.find(line=>line.original.name===name),pieces=ownedLine.members.map(member=>all.find(shape=>shape.name===owner.header.members[member].name));assert(pieces.every(Boolean));const shape={name,runs:pieces.flatMap(piece=>piece.runs)};assert.equal(shape.runs.map(run=>run.text).join(''),text);
    if(!/[\u0660-\u0669\u06f0-\u06f9]/u.test(text)){assert.equal(pieces.length,1);expectedShapes++;continue;}numericLines++;
    assert.equal(typeof bound.textMeasurement?.measure,'function','Real supplied font measurements exclude SVG natural-flow placement');
    const direction=row.fit.directions?.[index]??row.direction??paragraphDirection(row.scalar,bound.geometry.direction);assert.equal(direction,'ltr','LTR lines do not use SVG RTL edge trimming');
    const line=row.fit.richLines?.[index]??{width:row.fit.sourceLines[index].width,fragments:[{text,x:0,width:row.fit.sourceLines[index].width,fontSize:row.fit.fontSize,style:row.style}]};
    const placed=row.fit.placement?.lines[index];let originX;
    if(placed){assert.equal(placed.alignment,'left');originX=placed.x;}
    else{assert.equal(row.kind,'list','Only maintained unplaced list entries use their current textBox origin');const alignment=physicalAlignment('left',direction);assert.equal(alignment,'left');originX=row.box.x+(alignment==='right'?row.box.width-line.width:alignment==='center'?(row.box.width-line.width)/2:0);}
    assert(Number.isFinite(originX));
    const input={source:row.scalar,from,to,line,originX,rtl:false,nativeRuns:shape.runs,measurement:bound.textMeasurement,profile:lang=>(bound.scriptFontsFor(lang)??bound.scriptFonts).profile},plan=planNativeUnicodeIntervals(input);
    // Alignment may exclude source spaces; SVG still draws each full fragment.
    // All four genuine lines need exact geometry: no refusal is a waiver.
    const full=line.fragments.reduce((sum,fragment)=>sum+textWidthMeasurer(fragment.style,bound.textMeasurement)(fragment.text,fragment.fontSize),0);
    assert.equal(plan.status,'planned',shape.name+': '+plan.reason);plannedLines++;assert.equal(plan.intervals.map(part=>part.text).join(''),text);assert.equal(plan.alignmentWidth,line.width);assert(Math.abs(plan.fullAdvance-full)<=1e-7);assert.equal(plan.intervals[0].x,originX);assert(Math.abs(plan.intervals.at(-1).right-(originX+full))<=1e-7);
    assert.equal(pieces.length,plan.intervals.length);expectedShapes+=plan.intervals.length;
    if(Math.abs(full-line.width)>1e-7){assert.match(text,/ +$/);assert(plan.hangingSpaceAdvance>0);assert(Math.abs(plan.hangingSpaceAdvance-(full-line.width))<=1e-7);}else assert.equal(plan.hangingSpaceAdvance,0);
    for(const part of plan.intervals){assert.equal(row.scalar.slice(part.from,part.to),part.text);assert.equal(part.native.map(run=>run.text).join(''),part.text);for(const run of part.native)assert(shape.runs.some(current=>current.properties===run.properties));}
    const numeric=plan.intervals.filter(part=>part.numeric);assert.equal(numeric.length,1);assert.equal(numeric[0].role,'complexScript');assert.match(numeric[0].text,/^[\p{Decimal_Number}\p{Punctuation}\p{Separator}]+$/u);
    let fragmentFrom=from;
    for(const fragment of line.fragments){
     const parts=plan.intervals.filter(part=>part.from>=fragmentFrom&&part.to<=fragmentFrom+fragment.text.length),nodes=svgText.filter(node=>node.text===fragment.text&&Number(attr(node.attributes,'x'))===Number((originX+fragment.x).toFixed(3)));assert(nodes.length,'Actual SVG must retain the full fragment including source spaces at its measured origin');
     assert(nodes.some(node=>{
      if(parts.length===1)return Number(attr(node.attributes,'textLength'))===Number(fragment.width.toFixed(3));
      const spans=[...node.content.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)].map(([,attributes,text])=>({attributes,text:decode(text)}));
      return spans.length===parts.length&&parts.every((part,index)=>spans[index].text===part.text&&Number(attr(spans[index].attributes,'x'))===Number(part.x.toFixed(3))&&Number(attr(spans[index].attributes,'textLength'))===Number(part.width.toFixed(3)));
     }),'Every actual SVG fragment/script span must agree on full origins and advances without scaling');fragmentFrom+=fragment.text.length;
    }
    const scriptRuns=line.fragments.flatMap(fragment=>itemizeScripts(fragment.text,input.profile(fragment.style.lang)));assert(scriptRuns.some(run=>run.role==='complexScript'&&/\p{Decimal_Number}/u.test(run.text)));
   }
   assert.equal(cursor,row.scalar.length,'All source characters, including hanging spaces, remain mapped');
  }
  assert.equal(numericLines,4);assert.equal(totalLines,7);assert.equal(plannedLines,4,'All four genuine numeric lines need exact geometry');assert.equal(all.length,expectedShapes,'Actual emitted count must equal independently measured interval topology plus heading');
 }finally{fonts.dispose?.();}
});
