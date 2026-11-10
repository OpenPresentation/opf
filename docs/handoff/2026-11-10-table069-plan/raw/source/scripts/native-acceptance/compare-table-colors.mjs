// Office-free comparison of the dedicated native table-color worker's output.
// The worker creates native.json and saved/edited archives; this comparator
// never starts Office or changes an existing generated/native input.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {installedEngines} from './generate.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const cellText=value=>typeof value==='string'?value:Array.isArray(value)?value.map(cellText).join(''):value&&typeof value==='object'?cellText(value.value??value.text):String(value??'');

export async function compareNativeTableColors({consumer,output,sourceIdentity,engines}={}){
  assert.ok(sourceIdentity&&typeof sourceIdentity==='object','explicit current source identity required');
  const root=path.join(path.resolve(output),'table-colors');
  const generationPath=path.join(root,'generation.json'),nativePath=path.join(root,'native.json');
  const generation=await readJson(generationPath),native=await readJson(nativePath);
  assert.ok(isDeepStrictEqual(generation.runtime,sourceIdentity),'installed runtime identity changed after generation');
  assert.equal(native.generationSha256,hash(await readFile(generationPath)),'native worker used a different generation receipt');
  for(const [file,digest] of [['table-colors.pptx',generation.pptxSha256],['table-colors-saved.pptx',native.savedSha256],['table-colors-edited.pptx',native.editedSha256]])
    assert.equal(hash(await readFile(path.join(root,file))),digest,`${file}: archive changed`);
  let observations=0;
  for(const phase of ['original','reopened','edited']){
    assert.equal(native[phase].length,generation.expected.length,`${phase}: slide count`);
    for(const [index,slide] of generation.expected.entries()){
      const actual=native[phase][index];assert.equal(actual.slide,index+1);assert.equal(actual.cells.length,slide.cells.length);
      for(const [cellIndex,cell] of slide.cells.entries()){
        const runs=structuredClone(cell.runs);
        if(phase==='edited'&&cell.row===2&&cell.column===1)runs[0].text=`Native ${runs[0].text}`;
        const characters=runs.flatMap(run=>Array.from(run.text,character=>({character,color:run.color})));
        assert.deepEqual(actual.cells[cellIndex],{row:cell.row,column:cell.column,text:runs.map(run=>run.text).join(''),characters},`${phase} slide ${index+1} cell ${cellIndex+1}`);
        observations+=characters.length;
      }
      assert.equal(actual.pngSha256,hash(await readFile(path.join(root,actual.png))),`${phase} raster digest`);
    }
  }
  const {pptx}=engines??await installedEngines(consumer),imports=[];
  for(const [phase,file] of [['original','table-colors.pptx'],['saved','table-colors-saved.pptx'],['edited','table-colors-edited.pptx']]){
    let document=await pptx.fromPptx(await readFile(path.join(root,file)));
    for(let cycle=0;cycle<=2;cycle++){
      assert.equal(document.slides.length,6,`${phase} cycle ${cycle}: slide count`);
      for(const [index,slide] of document.slides.entries()){
        const table=slide.table??slide.blocks?.find(block=>block.type==='table')?.table;assert.ok(table,`${phase} cycle ${cycle} slide ${index+1}: table`);
        for(const cell of generation.expected[index].cells){
          const value=cell.row===1?table.columns[cell.column-1]:table.rows[cell.row-2][cell.column-1];
          const expected=(phase==='edited'&&cell.row===2&&cell.column===1?'Native ':'')+cell.runs.map(run=>run.text).join('');
          assert.equal(cellText(value),expected,`${phase} cycle ${cycle} slide ${index+1} cell ${cell.row},${cell.column}`);
        }
      }
      imports.push({phase,cycle,slides:6,currentCellText:true});
      if(cycle<2){
        const reexport=await pptx.toPptx(document),next=`table-${phase}-reexport-${cycle+1}.pptx`;
        await writeFile(path.join(root,next),reexport,{flag:'wx'});document=await pptx.fromPptx(reexport);
      }
    }
  }
  for(let index=0;index<6;index++)assert.equal(native.original[index].pngSha256,native.reopened[index].pngSha256,`slide ${index+1}: native save/reopen raster`);
  const result={generationSha256:native.generationSha256,nativeSha256:hash(await readFile(nativePath)),slides:6,phases:3,cells:72,characterColorObservations:observations,imports,passed:true,scope:'Native editable table text and character colors persist through save/reopen; two additional export/import cycles preserve cell text. No formatting/geometry or raster equivalence claim for reexports.'};
  await writeFile(path.join(root,'comparison.json'),`${JSON.stringify(result,null,2)}\n`,{flag:'wx'});
  return result;
}
