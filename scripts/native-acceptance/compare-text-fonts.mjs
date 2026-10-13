// Opt-in whole-range font descriptors for the sealed no-op metrics fixture.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest} from './identity.mjs';
import {bindNativeCaseEvidence,exportedTextShapes,TEXT_GEOMETRY_TOLERANCE_POINTS} from './compare-text.mjs';
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const bit=value=>{assert.ok(['0','1','false','true'].includes(value),'Unsupported font style boolean');return value==='1'||value==='true';};

export function explicitUniformTextFonts(input,dependencies,slideCount){
 const expected=exportedTextShapes(input,dependencies,slideCount),parts=dependencies.unzipSync(input),parser=new dependencies.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
 const xml=file=>{assert.ok(parts[file],`Missing font inheritance part ${file}`);const source=Buffer.from(parts[file]).toString();assert.equal(dependencies.XMLValidator.validate(source),true);assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(source));return parser.parse(source);};
 const presentation=xml('ppt/presentation.xml')['p:presentation'];
 const relation=(file,type)=>{const matches=list(xml(file).Relationships.Relationship).filter(item=>item.Type.endsWith('/'+type));assert.equal(matches.length,1,`Unsupported ${type} inheritance relationship`);assert.equal(matches[0].TargetMode,undefined);const target=path.posix.normalize(path.posix.join(path.posix.dirname(path.posix.dirname(file)),matches[0].Target));assert.ok(target.startsWith('ppt/')&&!target.includes('..'),'Unsafe inheritance part');return target;};
 const defaultsSafe=(node,field,context)=>{
  if(!node||typeof node!=='object')return;
  for(const [key,value] of Object.entries(node)){
   if(key==='a:defRPr'||key==='a:rPr')for(const style of list(value))if(style[field]!==undefined)assert.equal(bit(style[field]),false,`Unsupported inherited ${field}: ${context}`);
   if(value&&typeof value==='object')for(const child of list(value))defaultsSafe(child,field,context);
  }
 };
 const ids=list(presentation['p:sldIdLst']['p:sldId']),relations=list(xml('ppt/_rels/presentation.xml.rels').Relationships.Relationship);
 for(const [index,slide] of expected.entries()){
  const file='ppt/'+relations.find(item=>item.Id===ids[index]['r:id']).Target,source=xml(file)['p:sld'],sourceShapes=list(source['p:cSld']['p:spTree']['p:sp']);
  const layoutFile=relation(path.posix.join(path.posix.dirname(file),'_rels',path.posix.basename(file)+'.rels'),'slideLayout'),layout=xml(layoutFile)['p:sldLayout'];
  const masterFile=relation(path.posix.join(path.posix.dirname(layoutFile),'_rels',path.posix.basename(layoutFile)+'.rels'),'slideMaster'),master=xml(masterFile)['p:sldMaster'];
  const themeFile=relation(path.posix.join(path.posix.dirname(masterFile),'_rels',path.posix.basename(masterFile)+'.rels'),'theme'),theme=xml(themeFile)['a:theme'];assert.ok(theme&&typeof theme==='object','Missing theme inheritance context');
  // Nonempty object defaults may contribute text styles; applicability is outside this narrow comparator.
  const objectDefaults=theme['a:objectDefaults'];assert.ok(objectDefaults===undefined||objectDefaults===''||(typeof objectDefaults==='object'&&Object.keys(objectDefaults).length===0),'Unsupported theme object defaults');
  for(const shape of slide.shapes){
   assert.ok(shape.text.trim(),'Unsupported empty text font comparison');
   const candidates=sourceShapes.filter(item=>item['p:nvSpPr']['p:cNvPr'].name===shape.name);assert.equal(candidates.length,1);const sourceShape=candidates[0],body=sourceShape['p:txBody'],placeholder=sourceShape['p:nvSpPr']['p:nvPr']?.['p:ph'],runs=[];
   for(const paragraph of list(body['a:p']))for(const kind of ['a:r','a:fld'])for(const run of list(paragraph[kind])){
    if(run['a:t']===undefined||run['a:t']==='')continue;
    const style=run['a:rPr'];assert.ok(style&&typeof style==='object','Missing explicit font style');assert.equal(typeof style['a:latin']?.typeface,'string','Missing explicit Latin font');const name=style['a:latin'].typeface;assert.ok(name.length&&!name.startsWith('+'),'Unsupported theme font');assert.match(style.sz??'',/^\d+$/u,'Missing explicit font size');const sizePoints=Number(style.sz)/100;assert.ok(Number.isFinite(sizePoints)&&sizePoints>0);
    const resolved={name,sizePoints};
    for(const [field,property] of [['b','bold'],['i','italic']]){
     if(style[field]!==undefined){resolved[property]=bit(style[field]);continue;}
     // OOXML absence is false only after ruling out applicable inherited true defaults.
     defaultsSafe(paragraph['a:pPr'],field,'paragraph');defaultsSafe(body['a:lstStyle'],field,'list');defaultsSafe(presentation['p:defaultTextStyle'],field,'presentation');
     const type=placeholder?.type??'body',styleKind=placeholder?(type==='title'||type==='ctrTitle'?'p:titleStyle':'p:bodyStyle'):'p:otherStyle';defaultsSafe(master['p:txStyles']?.[styleKind],field,'master text style');
     if(placeholder){
      // Initial metrics scope has one unindexed title. Do not infer a title/ctrTitle alias or body mapping.
      assert.ok(type==='title'&&placeholder.idx===undefined,'Unsupported placeholder inheritance');
      for(const [label,parent] of [['layout',layout],['master',master]]){
       const candidates=list(parent['p:cSld']?.['p:spTree']?.['p:sp']).filter(item=>['title','ctrTitle'].includes(item['p:nvSpPr']?.['p:nvPr']?.['p:ph']?.type));
       assert.ok(candidates.length<=1,'Ambiguous placeholder inheritance');if(label==='layout')assert.equal(candidates.length,1,'Missing exact layout title inheritance');
       // A master without any title/ctrTitle placeholder contributes only its checked title text style.
       for(const inherited of candidates){const ph=inherited['p:nvSpPr']['p:nvPr']['p:ph'];assert.ok(ph.type==='title'&&ph.idx===undefined,'Unsupported title placeholder correspondence');defaultsSafe(inherited['p:txBody'],field,label+' placeholder');}
      }
     }
     resolved[property]=false;
    }
    runs.push(resolved);
   }
   assert.ok(runs.length,'Missing explicit text runs');for(const run of runs)assert.deepEqual(run,runs[0],'Unsupported mixed source font styles');shape.font=runs[0];
  }
 }
 return expected;
}
export function compareUniformTextFonts({expected,report,actions=[],captureTextFonts,caseId}){
 assert.equal(caseId,'feature-metrics','Unsupported font comparison case');assert.equal(captureTextFonts,true,'Font comparison requires requested capture');assert.deepEqual(actions,[],'Unsupported font comparison actions');
 const findings=[],observations=[];
 for(const phase of ['original','edited','reopened']){
  const current=report.phases[phase];assert.equal(current.slideCount,expected.length);assert.equal(current.slides.length,expected.length);
  for(const [index,slide] of expected.entries()){
   const actual=current.slides[index];assert.equal(actual.index,index+1);assert.equal(actual.shapeCount,actual.shapes.length);
   assert.equal(actual.shapes.filter(shape=>shape.hasTextFrame!==0&&shape.text!==null).length,slide.shapes.length,'Unexpected native text shape count');
   const names=actual.shapes.map(shape=>shape.name);assert.equal(new Set(names.map(name=>name.toLowerCase())).size,names.length,'Duplicate native shape');
   for(const shape of slide.shapes){
    const matching=actual.shapes.filter(item=>item.name===shape.name);assert.equal(matching.length,1,'Missing exact font shape');const record=matching[0],font=record.textFont;assert.ok(record.hasTextFrame!==0&&record.text!==null);assert.equal(font?.status,'uniform','Unsupported missing/mixed native font descriptor');assert.deepEqual(font.unavailableFields,[]);
    assert.equal(typeof font.name,'string');assert.ok(Number.isFinite(font.sizePoints)&&typeof font.sizePoints==='number');assert.ok([-1,0].includes(font.bold)&&[-1,0].includes(font.italic));
    const expectedFont=shape.font;for(const [field,value] of [['name',expectedFont.name],['bold',expectedFont.bold?-1:0],['italic',expectedFont.italic?-1:0]])if(font[field]!==value)findings.push({phase,slide:index+1,name:shape.name,field,expected:value,actual:font[field]});
    const sizeDifferencePoints=font.sizePoints-expectedFont.sizePoints;if(Math.abs(sizeDifferencePoints)>TEXT_GEOMETRY_TOLERANCE_POINTS)findings.push({phase,slide:index+1,name:shape.name,field:'sizePoints',expected:expectedFont.sizePoints,actual:font.sizePoints,sizeDifferencePoints});
    observations.push({phase,slide:index+1,name:shape.name,expected:expectedFont,observed:{name:font.name,sizePoints:font.sizePoints,bold:font.bold,italic:font.italic},sizeDifferencePoints});
   }
  }
 }
 assert.ok(observations.length,'No font observations');return {passed:findings.length===0,case:caseId,tolerancePoints:TEXT_GEOMETRY_TOLERANCE_POINTS,observations,findings,nativeAcceptance:false,registryAcceptance:false,scope:'Opt-in whole TextFrame2 range name/size/bold/italic descriptors for the no-op metrics case. False b/i absence is accepted only after verifying applicable inheritance. Not per-character font selection, physical glyph-file identity, baseline, outline or pixel equivalence.'};
}
export async function compareTextFonts(options){
 const bound=await bindNativeCaseEvidence(options);const expected=explicitUniformTextFonts(bound.input,bound.dependencies,bound.selected.slideCount);const result=compareUniformTextFonts({...bound,expected,caseId:options.caseId});Object.assign(result,{identity:bound.identity,comparatorSha256:digest(await readFile(fileURLToPath(import.meta.url)))});await writeFile(path.join(options.output,'text-font-comparison.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const options={};for(let index=2;index<process.argv.length;index+=2){const key=process.argv[index];assert.ok(['--suite','--output','--consumer','--case'].includes(key));assert.ok(!Object.hasOwn(options,key)&&process.argv[index+1]&&!process.argv[index+1].startsWith('--'));options[key]=process.argv[index+1];}for(const key of ['--suite','--output','--consumer','--case'])assert.ok(options[key]);const result=await compareTextFonts({suiteDirectory:path.resolve(options['--suite']),output:path.resolve(options['--output']),consumer:path.resolve(options['--consumer']),caseId:options['--case']});console.log(JSON.stringify(result));assert.ok(result.passed,'Whole-range font descriptors differ; preserve text-font-comparison.json');
}
