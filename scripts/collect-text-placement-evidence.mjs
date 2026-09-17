import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const core=fileURLToPath(new URL('../',import.meta.url)),base=path.dirname(core),input=path.resolve(process.argv[2]??path.join(base,'text-raster-final-checks'));
const output=path.join(core,'docs/evidence/text-placement'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const files=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(async entry=>entry.isDirectory()?(await files(path.join(dir,entry.name))).map(file=>path.join(entry.name,file)):[entry.name]))).flat();
await mkdir(output,{recursive:true});
const corpusDirs=[path.join(base,'accepted-text-final-checks/golden-node24'),path.join(input,'golden-node20'),path.join(input,'golden-node24')];
const corpus=[];
for(const directory of corpusDirs) {
  const manifest=await read(path.join(directory,'candidate.json'));
  if(corpus.length)assert.deepEqual(manifest,corpus[0].manifest,'Default estimated rendering must remain unchanged');
  for(const [index,record] of Object.values(manifest.entries).entries()) {
    const bytes=await readFile(path.join(directory,`${String(index).padStart(4,'0')}.png`));
    assert.equal(hash(bytes),record.sha256);assert.equal(bytes.length,record.bytes);
  }
  corpus.push({directory:path.relative(base,directory).replaceAll('\\','/'),verifiedImages:Object.keys(manifest.entries).length,manifest});
}
const comparisons=[];
for(const major of [20,24]) {
  const pass=await read(path.join(input,`browser-node${major}/accepted-text/report.json`));
  const control=await read(path.join(input,`zero-padding-node${major}/report.json`));
  assert.equal(pass.results.length,24);assert.ok(pass.results.every(result=>result.failures.length===0));
  const failures=control.results.filter(result=>result.failures.length);
  assert.deepEqual(failures.map(result=>result.id),['portrait-plain-right-scalar','portrait-plain-right-rich','portrait-card-right-scalar','portrait-card-right-rich']);
  assert.ok(failures.every(result=>result.failures.length===1&&result.failures[0]==='Paint leaves cell: slides.0.title (1 pixels)'));
  comparisons.push({node:pass.node,browser:pass.browser,passed:24,controlFailures:failures.map(result=>result.id),fontHashes:pass.fontHashes});
  const native=await read(path.join(input,`pptx-node${major}/report.json`));
  for(const record of native.records)assert.equal(hash(await readFile(path.join(input,`pptx-node${major}`,record.file))),record.sha256);
}
const artifacts=[];
for(const relative of await files(input)) {
  if(/^golden-node\d+[\\/]/.test(relative)&&!relative.endsWith('candidate.json')&&!relative.endsWith('diff.json'))continue;
  const target=path.join(output,relative);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(input,relative),target);
  const bytes=await readFile(target);artifacts.push({path:relative.replaceAll('\\','/'),bytes:bytes.length,sha256:hash(bytes)});
}
const source={};
for(const repo of ['opf','opf-render','opf-pptx','opf-editor'])source[repo]={branch:execFileSync('git',['branch','--show-current'],{cwd:path.join(base,repo),encoding:'utf8'}).trim(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:path.join(base,repo),encoding:'utf8'}).trim()};
await writeFile(path.join(output,'summary.json'),JSON.stringify({source,scope:'Linked source; no published versions, baseline or deployment changed.',comparisons,corpus:corpus.map(({manifest,...rest})=>({...rest,source:manifest.source})),changedDefaultRasters:0,verifiedCorpusImages:corpus.reduce((sum,item)=>sum+item.verifiedImages,0),artifacts},null,2)+'\n');
console.log(JSON.stringify({output,artifacts:artifacts.length,bytes:artifacts.reduce((sum,item)=>sum+item.bytes,0),verifiedCorpusImages:corpus.reduce((sum,item)=>sum+item.verifiedImages,0)}));
