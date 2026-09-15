import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseTree,findNodeAtLocation} from 'jsonc-parser';
import {examples} from '@openpresentation/opf/examples';
import {lintPresentation} from '@openpresentation/opf/lint';
import {getJsonFieldContext} from '@openpresentation/opf-editor/json-options';
const root=process.argv[2],output=process.argv[3],base='2d29cf0f2fa4d2e5e885b6de22d66ebf07b52283';
assert.ok(root&&output);
globalThis.fetch=()=>{throw new Error('Catalog example verification must stay offline');};
const changes=JSON.parse(await readFile(root+'/docs/evidence/catalog-example-correction-20260915/changes.json','utf8'));
const choices=[];
for(const change of changes.files){
 const source=await readFile(root+'/'+change.file,'utf8'),document=JSON.parse(source);
 const before=execFileSync('git',['-C',root,'show',`${base}:${change.file}`],{encoding:'utf8'});
 assert.equal(createHash('sha256').update(before).digest('hex'),change.beforeSha256);
 assert.equal(createHash('sha256').update(source).digest('hex'),change.afterSha256);
 assert.deepEqual(examples.find(example=>example.file===change.file)?.deck,document);
 const fields=change.file.includes('/gallery/') ? [[['design','theme'],document.catalogs.themes.records[0].id]]
  :change.file.endsWith('/full-feature-tour.opf.json') ? [[['slides',8,'design','colorScheme'],'acme-night']]
  :[[['audience',0,'id'],'technical-reviewers'],[['purpose','id'],'technical-approval'],[['tone','id'],'precise-plain']];
 for(const [path,id] of fields){
  const option=s=>{
   const node=findNodeAtLocation(parseTree(s),path);assert.ok(node,JSON.stringify(path));
   const context=getJsonFieldContext(s,node.offset+1);assert.ok(context,change.file);
   return context.options.find(value=>value.value===id);
  };
  const old=option(before),current=option(source);
  assert.notEqual(old?.source,'Document catalog');assert.equal(current?.source,'Document catalog');
  choices.push({file:change.file,path,id,beforeSource:old?.source??'absent',afterSource:current.source,label:current.label});
 }
}
assert.equal(choices.length,44);assert.equal(examples.length,126);
for(const {file,deck} of examples){const lint=lintPresentation(deck);assert.equal(lint.valid,true,file);assert.equal(lint.counts.warning,0,file);}
const lock=await readFile('package-lock.json');
await writeFile(output,JSON.stringify({node:process.version,runtime:'installed',examples:examples.length,choices,lockSha256:createHash('sha256').update(lock).digest('hex'),externalFetch:'disabled',boundary:'Production lint and JSON catalog options from fresh candidate packages. Input source is the reviewed checked-in JSON; this check does not claim browser or native rendering fidelity.'},null,2)+'\n');
console.log(`Installed package checks passed: ${examples.length} bundled examples lint cleanly and ${choices.length} corrected catalog choices are available offline.`);
