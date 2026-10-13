// Six-slide editable table-color regression payload for the dedicated native
// table worker. It is deliberately outside the three-slide generic worker.
import assert from 'node:assert/strict';
import {realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fixtureWriter,installedEngines} from './generate.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>Buffer.from(`${JSON.stringify(value,null,2)}\n`);

export function tableColorDocument(){
  const cases=[
    ['#F8FAFC','#000000','#000000'],['#0F172A','#FFFFFF','#FFFFFF'],
    ['#777777','#000000','#000000'],['#767676','#FFFFFF','#000000'],
    ['#FFFFFF80','#FFFFFF','#000000'],['#F8FAFC','#FFFFFF','#FFFFFF','#FFFFFF'],
  ];
  const slides=[],expected=[];
  for(const [fill,header,body,explicit] of cases){
    const style={fill,...(explicit?{color:explicit}:{})};
    slides.push({table:{columns:[{value:'Header',style},{value:['Inherited',{text:'Explicit',color:'#FF0000'}],style}],rows:[[{value:'Body',style},{value:['BodyInherited',{text:'BodyExplicit',color:'#FF0000'}],style}]]}});
    expected.push({fill,explicit:explicit??null,cells:[
      {row:1,column:1,runs:[{text:'Header',color:header}]},
      {row:1,column:2,runs:[{text:'Inherited',color:header},{text:'Explicit',color:'#FF0000'}]},
      {row:2,column:1,runs:[{text:'Body',color:body}]},
      {row:2,column:2,runs:[{text:'BodyInherited',color:body},{text:'BodyExplicit',color:'#FF0000'}]},
    ]});
  }
  return {document:{design:{background:'#FFFFFF',fontScheme:'roboto',colorScheme:{id:'cool-horizon',dark1:'#000000'}},slides},expected};
}

export async function generateTableColors({consumer,output,sourceIdentity,engines}={}){
  assert.ok(sourceIdentity&&typeof sourceIdentity==='object'&&!Array.isArray(sourceIdentity),'source identity required');
  const root=await realpath(output),installed=await realpath(consumer);
  assert.ok(root!==installed&&!root.startsWith(installed+path.sep),'table outputs cannot live in installed consumer');
  const {pptx}=engines??await installedEngines(consumer);
  assert.ok(pptx?.toPptx);
  const {document,expected}=tableColorDocument(),original=structuredClone(document);
  const bytes=await pptx.toPptx(document);assert.deepEqual(document,original,'table export mutated source');
  assert.deepEqual(bytes,await pptx.toPptx(document),'nondeterministic table archive');
  const {put,files}=fixtureWriter(root);
  await put('sources/table-colors.opf.json',json(document));
  const archive=await put('table-colors/table-colors.pptx',bytes);
  await put('table-colors/generation.json',json({node:process.version,runtime:structuredClone(sourceIdentity),sourceSha256:hash(JSON.stringify(document)),pptxSha256:archive.sha256,expected}));
  return {cases:[{id:'table-colors',input:archive.path,slideCount:6,automaticControlEligible:false,dedicatedWorker:'native-table-colors.ps1',archiveSha256:archive.sha256,expectedCells:24,nativeAcceptance:'pending'}],files};
}
