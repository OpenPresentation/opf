import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {toSvg} from '../../../../packages/render/test/catalog-harness.mjs';
const out=path.resolve(process.argv[2]);await mkdir(out,{recursive:true});
const sourceRoot='C:/opf-work/sh25-final-cli-01/cases',records=[],hash=x=>createHash('sha256').update(x).digest('hex');
const selected=new Set(['column-ar','column-en-us','stacked-column-ar','100pct-stacked-column-ar','bar-ar','stacked-bar-ar','100pct-stacked-bar-ar']);
for(const id of (await readdir(sourceRoot)).sort()){
 const source=await readFile(path.join(sourceRoot,id,'source.opf.json')),deck=JSON.parse(source),svg=toSvg(deck,1,{trace:true,date:'2026-11-08'});
 const entry={id,sourceSha256:hash(source),analyticalSvgSha256:hash(svg),nativeAcceptance:false};
 if(selected.has(id)){
  const dir=path.join(out,id);await mkdir(dir);await writeFile(path.join(dir,'source.opf.json'),source);await copyFile(path.join(sourceRoot,id,'action-plan.json'),path.join(dir,'action-plan.json'));
  for(const [file,extra]of [['preview.png',['--scale','1']],['input.pptx',[]]]){
   const args=['packages/cli/dist/index.js','convert',path.join(dir,'source.opf.json'),path.join(dir,file),'--date','2026-11-08',...extra];
   const r=spawnSync(process.execPath,args,{encoding:'utf8'});await writeFile(path.join(dir,file+'.stdout.json'),r.stdout??'');await writeFile(path.join(dir,file+'.stderr.txt'),r.stderr??'');assert.equal(r.status,0,id+' '+file+' failed');
   const report=JSON.parse(r.stdout);assert.equal(report.ok,true);assert.equal(report.fonts.pack,'office');assert.equal(report.fonts.substitutionPolicy,'visual');entry[file+'Sha256']=hash(await readFile(path.join(dir,file)));entry[file+'Findings']=report.findings;
  }
 }
 records.push(entry);
}
await writeFile(path.join(out,'manifest.json'),JSON.stringify({revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),node:process.version,fontRoute:'Shipped CLI office/visual/script-auto for both PNG/PPTX; analytical SVG controls are font-free and do not claim native acceptance',records},null,2)+'\n');console.log('Sealed '+records.length+' SVG controls and '+selected.size+' complete CLI PNG/PPTX witnesses');
