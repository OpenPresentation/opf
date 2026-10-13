import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {compareListEditSemantics,nativeListDescription,LIST_EDIT_ACTION} from './compare-list-edit.mjs';
const require=createRequire(new URL('../../packages/javascript/package.json',import.meta.url));
const peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));
const dependencies={...peer('fflate'),...peer('fast-xml-parser')};
function fixture(){
 const source={design:{fontScheme:'roboto'},slides:[{title:'Descriptions remain descriptions',items:[{text:'With a description',description:'about it'},'Unchanged second entry']}]};
 const original=structuredClone(source),edited=structuredClone(source);
 edited.slides[0].items[0].description=[{text:'about it',fontSize:36,color:'#FF0000'}];
 const shapes=[{name:'OPF heading slides.0.title line 0',text:source.slides[0].title},{name:'OPF list slides.0.items line 0',text:'With a description'},{name:LIST_EDIT_ACTION.shapeName,text:'about it'},{name:'OPF list slides.0.items line 2',text:'Unchanged second entry'}];
 const phase=()=>({slideCount:1,slides:[{index:1,shapeCount:4,shapes:shapes.map(shape=>({...shape,hasTextFrame:-1}))}]});
 const report={schemaVersion:1,cleanupConfirmed:true,officeOperationsStopped:false,error:null,lastStage:'worker.complete',lastStatus:'success',actionPlan:{actions:[LIST_EDIT_ACTION],completed:[{index:1,op:'set-text-style',status:'success'}],styleEdits:[{index:1,slideIndex:1,shapeName:LIST_EDIT_ACTION.shapeName,observed:{textBefore:'about it',textAfter:'about it',fontSize:36,color:'FF0000'}}]},phases:{original:phase(),edited:phase(),reopened:phase()}};
 return {source,original,edited,report,actions:[LIST_EDIT_ACTION],expectedText:[{shapes}],nativeStyle:{text:'about it',fontSize:36,color:'#FF0000'}};
}
test('exact semantic edit passes without native or visual-fit acceptance',()=>{
 const result=compareListEditSemantics(fixture());assert.equal(result.passed,true);assert.equal(result.nativeAcceptance,false);assert.equal(result.visualFitAcceptance,false);assert.equal(result.registryAcceptance,false);
});
test('source, native/current words, style receipts, lifecycle and unrelated content mutations fail',()=>{
 for(const mutate of [
  f=>{f.source.slides[0].items[1]='Wrong source';},
  f=>{f.original.slides[0].items[0].description='Wrong original';},
  f=>{f.edited.slides[0].items[0].text='Changed native entry';},
  f=>{f.edited.slides[0].items[0].description[0].fontSize=35;},
  f=>{f.edited.slides[0].items[0].description[0].fontFamily='Unrequested explicit family';},
  f=>{f.edited.slides[0].items[1]='Unrelated change';},
  f=>{f.edited.slides[0].items[0].description[0].text='Stale source replay';},
  f=>{f.actions[0]={...LIST_EDIT_ACTION,color:'00FF00'};},
  f=>{f.report.actionPlan.styleEdits=[];},
  f=>{f.report.actionPlan.styleEdits.push(structuredClone(f.report.actionPlan.styleEdits[0]));},
  f=>{f.report.actionPlan.styleEdits[0].observed.textAfter='Edited words';},
  f=>{f.report.actionPlan.styleEdits[0].observed.fontSize=35;},
  f=>{f.report.actionPlan.styleEdits[0].shapeName='Wrong target';},
  f=>{f.report.phases.reopened.slides[0].shapes[2].text='Changed after reopen';},
  f=>{f.report.phases.edited.slides[0].shapes[2].name='Missing target';},
  f=>{f.report.phases.original.slides[0].shapes[3].name=LIST_EDIT_ACTION.shapeName;},
  f=>{f.report.cleanupConfirmed=false;},
  f=>{f.report.actionPlan.completed=[];},
  f=>{f.nativeStyle.color='#00FF00';},
 ]){const f=fixture();mutate(f);assert.throws(()=>compareListEditSemantics(f));}
});
const shape=(name=LIST_EDIT_ACTION.shapeName,size='3600',color='FF0000',text='about it')=>`<p:sp><p:nvSpPr><p:cNvPr id="1" name="${name}"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr sz="${size}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
const archive=shapes=>dependencies.zipSync({'ppt/slides/slide1.xml':Buffer.from(`<p:sld><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`)});
test('independent native XML proves exact target words and literal run style; mutations fail',()=>{
 assert.deepEqual(nativeListDescription(archive(shape()),dependencies),{shape:LIST_EDIT_ACTION.shapeName,text:'about it',fontSize:36,color:'#FF0000',runs:1});
 for(const xml of [shape('wrong'),shape()+shape(),shape(undefined,'3500'),shape(undefined,'3600','00FF00'),shape(undefined,'3600','FF0000','wrong'),shape().replace('<a:rPr sz="3600">','<a:rPr>'),shape().replace('</a:p>','<a:br/></a:p>'),shape().replace('<a:r>','<a:fld>').replace('</a:r>','</a:fld>'),shape().replace('<a:srgbClr val="FF0000"/>','<a:schemeClr val="accent1"/>')])assert.throws(()=>nativeListDescription(archive(xml),dependencies));
});
