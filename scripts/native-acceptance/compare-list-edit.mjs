// Evidence-bound list-description native edit comparison. No Office or visual acceptance.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,installedIdentity} from './identity.mjs';
import {bindNativeCaseEvidence,exportedTextShapes} from './compare-text.mjs';
export const LIST_EDIT_CASE='list-description-native-edit';
export const LIST_EDIT_ACTION=Object.freeze({op:'set-text-style',slideIndex:1,shapeName:'OPF list slides.0.items line 1',fontSize:36,color:'FF0000'});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
export function nativeListDescription(bytes,{unzipSync,XMLParser,XMLValidator}){
  const parts=unzipSync(bytes);assert.ok(parts['ppt/slides/slide1.xml']);
  assert.equal(Object.keys(parts).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).length,1,'One native slide required');
  const xml=Buffer.from(parts['ppt/slides/slide1.xml']).toString('utf8');
  assert.equal(XMLValidator.validate(xml),true);assert.doesNotMatch(xml,/<!DOCTYPE|<!ENTITY/);
  const root=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false}).parse(xml);
  const tree=root?.['p:sld']?.['p:cSld']?.['p:spTree'];assert.ok(tree);assert.equal(array(tree['p:grpSp']).length,0,'Grouped shape unsupported');
  const matches=array(tree['p:sp']).filter(shape=>shape?.['p:nvSpPr']?.['p:cNvPr']?.name===LIST_EDIT_ACTION.shapeName);
  assert.equal(matches.length,1,'One exact native description shape required');
  const paragraphs=array(matches[0]['p:txBody']?.['a:p']);assert.equal(paragraphs.length,1);
  const paragraph=paragraphs[0];assert.equal(array(paragraph['a:fld']).length,0);assert.equal(array(paragraph['a:br']).length,0);
  const runs=array(paragraph['a:r']);assert.ok(runs.length>0&&runs.length<=100,'Bounded actual native runs required');
  const words=runs.map(run=>{assert.equal(typeof run['a:t'],'string');return run['a:t'];}).join('');assert.equal(words,'about it','Current native description words');
  for(const run of runs){assert.equal(Number(run['a:rPr']?.sz),3600,'Actual native run must be36pt');assert.equal(run['a:rPr']?.['a:solidFill']?.['a:srgbClr']?.val?.toUpperCase(),'FF0000','Actual native run must be literal red');}
  return {shape:LIST_EDIT_ACTION.shapeName,text:words,fontSize:36,color:'#FF0000',runs:runs.length};
}
export function compareListEditSemantics({source,original,edited,report,actions,expectedText,nativeStyle}){
  assert.deepEqual(actions,[LIST_EDIT_ACTION],'Exact maintained action required');
  assert.equal(source.slides.length,1);assert.deepEqual(source.slides[0].items,[{text:'With a description',description:'about it'},'Unchanged second entry'],'Exact maintained source required');
  assert.deepEqual(original,source,'Original unchanged archive must exactly round trip');
  const expected=structuredClone(source);expected.slides[0].items=[{text:'With a description',description:[{text:'about it',fontSize:36,color:'#FF0000'}]},'Unchanged second entry'];
  assert.deepEqual(edited,expected,'Saved/reopened native archive must preserve description identity and only edited styles');
  assert.equal(report.schemaVersion,1);assert.equal(report.cleanupConfirmed,true);assert.equal(report.officeOperationsStopped,false);assert.equal(report.error,null);assert.equal(report.lastStage,'worker.complete');assert.equal(report.lastStatus,'success');
  assert.deepEqual(report.actionPlan.actions,actions);assert.deepEqual(report.actionPlan.completed,[{index:1,op:'set-text-style',status:'success'}]);
  assert.deepEqual(report.actionPlan.styleEdits,[{index:1,slideIndex:1,shapeName:LIST_EDIT_ACTION.shapeName,observed:{textBefore:'about it',textAfter:'about it',fontSize:36,color:'FF0000'}}],'Immediate COM property readback and unchanged words');
  assert.equal(expectedText.length,1);
  for(const phase of ['original','edited','reopened']){
    const observed=report.phases[phase];assert.equal(observed.slideCount,1);assert.equal(observed.slides.length,1);
    const slide=observed.slides[0];assert.equal(slide.index,1);assert.equal(slide.shapeCount,slide.shapes.length);assert.ok(slide.shapeCount<=30);
    const shapes=slide.shapes.filter(shape=>shape.hasTextFrame!==0&&shape.text!==null);
    assert.equal(shapes.length,expectedText[0].shapes.length);
    assert.equal(new Set(shapes.map(shape=>shape.name.toLowerCase())).size,shapes.length,'Unique native names');
    for(const expectedShape of expectedText[0].shapes){const matches=shapes.filter(shape=>shape.name===expectedShape.name);assert.equal(matches.length,1);assert.equal(matches[0].text,expectedShape.text,`${phase}: native words changed`);}
  }
  assert.equal(nativeStyle.text,'about it');assert.equal(nativeStyle.fontSize,36);assert.equal(nativeStyle.color,'#FF0000');
  return {passed:true,case:LIST_EDIT_CASE,sourceRoundTripEqual:true,editedItems:edited.slides[0].items,nativeStyle,nativeAcceptance:false,registryAcceptance:false,visualFitAcceptance:false,scope:'Exact source and saved/reopened import semantics, sealed runtime/actions/input/report identities, immediate COM style receipt and independent native XML. Reopened archive hash equals saved archive; XML proves serialized run semantics, not glyph selection.36pt exceeds original description box height; no visual fit, raster, baseline or overall native acceptance.'};
}
async function regular(file){assert.equal(await realpath(file),path.resolve(file),'Aliased evidence');assert.ok((await lstat(file)).isFile());return readFile(file);}
export async function compareListEdit({suiteDirectory,output,consumer}){
  const bound=await bindNativeCaseEvidence({suiteDirectory,output,consumer,caseId:LIST_EDIT_CASE});
  const {suite,selected,input,saved,actions,report,dependencies}=bound;
  assert.equal(selected.source,`sources/${LIST_EDIT_CASE}.opf.json`,'Exact maintained sealed source path');
  const sourceBytes=bound.sourceBytes;assert.ok(Buffer.isBuffer(sourceBytes),'Sealed source bytes required');
  const source=JSON.parse(sourceBytes.toString('utf8'));
  const require=createRequire(path.join(consumer,'package.json'));
  const pptx=await import(pathToFileURL(require.resolve('@openpresentation/opf-pptx')).href);
  const {gallery}=await import(pathToFileURL(require.resolve('@openpresentation/gallery')).href);
  const original=await pptx.fromPptx(input,{catalogs:[gallery]}),edited=await pptx.fromPptx(saved,{catalogs:[gallery]});
  const result=compareListEditSemantics({source,original,edited,report,actions,expectedText:exportedTextShapes(input,dependencies,1),nativeStyle:nativeListDescription(saved,dependencies)});
  assert.deepEqual(installedIdentity(consumer),suite.provenance.packages,'Runtime changed during comparison');
  assert.equal(digest(input),bound.identity.inputSha256,'Importer mutated original archive bytes');
  assert.equal(digest(saved),bound.identity.savedSha256,'Importer mutated saved archive bytes');
  Object.assign(result,{...bound.identity,sourceSha256:digest(sourceBytes),inputSha256:digest(input),savedSha256:digest(saved),comparatorSha256:digest(await regular(fileURLToPath(import.meta.url))),node:process.version});
  await writeFile(path.join(output,'list-edit-comparison.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const options={};for(let i=2;i<process.argv.length;i+=2){const flag=process.argv[i];assert.ok(['--suite','--output','--consumer'].includes(flag));assert.ok(!options[flag]&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'));options[flag]=process.argv[i+1];}
  for(const flag of ['--suite','--output','--consumer'])assert.ok(options[flag],`Required ${flag}`);
  console.log(JSON.stringify(await compareListEdit({suiteDirectory:path.resolve(options['--suite']),output:path.resolve(options['--output']),consumer:path.resolve(options['--consumer'])})));
}
