import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {generateTableColors} from './table-colors.mjs';
import {compareNativeTableColors} from './compare-table-colors.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('table comparator verifies native color observations, archive hashes and 54 slide imports',async()=>{
  const scratch=await realpath(await mkdtemp(path.join(tmpdir(),'native-table-compare-')));
  try{
    const consumer=path.join(scratch,'consumer'),output=path.join(scratch,'suite'),sourceIdentity={packages:{core:'selected'}};
    await mkdir(consumer);await mkdir(output);
    const pptx={toPptx:async document=>Buffer.from(JSON.stringify(document)),fromPptx:async bytes=>JSON.parse(Buffer.from(bytes).toString())};
    await generateTableColors({consumer,output,sourceIdentity,engines:{pptx}});
    const root=path.join(output,'table-colors'),generationBytes=await readFile(path.join(root,'generation.json')),generation=JSON.parse(generationBytes);
    const source=JSON.parse(await readFile(path.join(output,'sources/table-colors.opf.json'))),edited=structuredClone(source);
    for(const slide of edited.slides)slide.table.rows[0][0].value='Native Body';
    const saved=await readFile(path.join(root,'table-colors.pptx')),editedBytes=Buffer.from(JSON.stringify(edited));
    await writeFile(path.join(root,'table-colors-saved.pptx'),saved);
    await writeFile(path.join(root,'table-colors-edited.pptx'),editedBytes);
    const phases={};
    for(const phase of ['original','reopened','edited']){
      phases[phase]=[];
      for(const [index,slide] of generation.expected.entries()){
        const png=`${phase}-${index+1}.png`,pngBytes=Buffer.from(`${phase==='edited'?'edited':'saved'} raster ${index}`);await writeFile(path.join(root,png),pngBytes);
        const cells=slide.cells.map(cell=>{
          const runs=structuredClone(cell.runs);
          if(phase==='edited'&&cell.row===2&&cell.column===1)runs[0].text=`Native ${runs[0].text}`;
          return {row:cell.row,column:cell.column,text:runs.map(run=>run.text).join(''),characters:runs.flatMap(run=>Array.from(run.text,character=>({character,color:run.color})))};
        });
        phases[phase].push({slide:index+1,cells,png,pngSha256:hash(pngBytes)});
      }
    }
    const native={generationSha256:hash(generationBytes),savedSha256:hash(saved),editedSha256:hash(editedBytes),...phases};
    native.original[0].cells[0].characters[0].color='#FFFFFF';
    await writeFile(path.join(root,'native.json'),JSON.stringify(native));
    await assert.rejects(()=>compareNativeTableColors({consumer,output,sourceIdentity,engines:{pptx}}),/original slide 1 cell 1/);
    native.original[0].cells[0].characters[0].color=generation.expected[0].cells[0].runs[0].color;
    const changedRaster=Buffer.from('changed raster');
    await writeFile(path.join(root,native.reopened[0].png),changedRaster);
    native.reopened[0].pngSha256=hash(changedRaster);
    await writeFile(path.join(root,'native.json'),JSON.stringify(native));
    await assert.rejects(()=>compareNativeTableColors({consumer,output,sourceIdentity,engines:{pptx}}),/native save\/reopen raster/);
    for(const phase of ['original','saved','edited'])for(const cycle of [1,2])await rm(path.join(root,`table-${phase}-reexport-${cycle}.pptx`));
    await writeFile(path.join(root,native.reopened[0].png),await readFile(path.join(root,native.original[0].png)));
    native.reopened[0].pngSha256=native.original[0].pngSha256;
    await writeFile(path.join(root,'native.json'),JSON.stringify(native));
    const result=await compareNativeTableColors({consumer,output,sourceIdentity,engines:{pptx}});
    assert.equal(result.passed,true);assert.equal(result.cells,72);assert.equal(result.imports.length,9);
    assert.equal(result.imports.reduce((sum,item)=>sum+item.slides,0),54);
  }finally{await rm(scratch,{recursive:true,force:true});}
});
