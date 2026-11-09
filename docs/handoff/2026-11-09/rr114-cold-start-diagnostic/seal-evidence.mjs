import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const own=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(own,'../../../..');
const source='6e862542059efacffcd45b1ffa44e71011b18a74',tree='f9bfa17c08d50b211bae4041a221e4e0630ed0e4';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',repo,...args],{maxBuffer:4*1024*1024});
const gitText=(...args)=>git(...args).toString('utf8').trim();
assert.equal(gitText('rev-parse','HEAD'),source);
const roots=[['results','C:/opf-work/rr114-cold-diagnostic-01'],['execution','C:/opf-work/rr114-cold-execution-01']];
const entries=[];
for(const[prefix,root]of roots){
  for(const name of readdirSync(root).sort()){
    assert.match(name,/^[a-zA-Z0-9.-]+$/);
    const bytes=readFileSync(path.join(root,name));
    entries.push({name:prefix+'/'+name,size:bytes.length,sha256:sha(bytes),base64:bytes.toString('base64')});
  }
}
assert.equal(entries.length,16);
const archiveBytes=Buffer.from(JSON.stringify({format:'opf-cold-start-diagnostic-v1',entries})+'\n');
const compressed=gzipSync(archiveBytes,{level:9,mtime:0});
writeFileSync(path.join(own,'raw.json.gz'),compressed,{flag:'wx'});
const entryMap=new Map(entries.map(item=>[item.name,Buffer.from(item.base64,'base64')]));
const json=name=>JSON.parse(entryMap.get(name));
const summary=json('results/summary.json'),exit=json('execution/process-exit.json');
assert.equal(summary.status,'PASS');assert.equal(summary.runtimeHead,source);assert.equal(summary.runtimeTree,tree);
assert.equal(summary.verifiedSlideHashes,312);assert.equal(exit.exitCode,0);assert.equal(exit.source,source);assert.equal(exit.tree,tree);
const sum=(items,fn)=>items.reduce((total,item)=>total+fn(item),0);
const facts={schema:1,status:'PASS',scope:'Instrumented attribution, not replacement performance statistics. Nested/concurrent spans are inclusive and not additive.',source,tree,children:4,perConfigurationSlideHashes:104,verifiedRenderHashes:312,rows:[]};
for(const row of summary.rows){
  const name=String(row.order).padStart(2,'0')+'-'+row.size+'-'+row.variant,result=json('results/'+name+'.json');
  const spans=result.diagnostic.spans,prep=spans.filter(item=>item.phase==='fontPreparation');
  const counters=(phase,name)=>sum(result.diagnostic.counters.filter(item=>item.phase===phase&&item.name===name),item=>item.value);
  const grouped=Object.fromEntries([...new Set(prep.map(item=>item.name))].map(name=>{
    const matching=prep.filter(item=>item.name===name);
    return[name,{count:matching.length,inclusiveMs:sum(matching,item=>item.elapsedMs)}];
  }));
  const contexts=prep.filter(item=>item.name==='demand.context');
  for(let i=1;i<contexts.length;i++)assert.ok(contexts[i].startMs>=contexts[i-1].endMs,'top-level contexts are disjoint');
  const caches=result.diagnostic.events.filter(item=>item.name==='analysis.faces.cache'&&item.phase==='fontPreparation');
  const handoff=result.diagnostic.events.find(item=>item.name==='font.shaperHandoff');
  facts.rows.push({name,size:row.size,variant:row.variant,fontPreparationMs:result.fontMs,firstSvgBatchMs:result.samples[0].elapsedMs,firstUseSumMs:result.fontMs+result.samples[0].elapsedMs,faces:result.faceCount,
    contexts:contexts.map(item=>({generation:item.meta.generation,held:item.meta.held,elapsedMs:item.elapsedMs,analysisStats:item.meta.analysisStats,scriptStats:item.meta.scriptStats})),
    disjointContextMs:sum(contexts,item=>item.elapsedMs),prepGroups:grouped,analysisCache:caches.map(item=>item.meta),shaperHandoff:handoff.meta,
    coverageProbes:counters('fontPreparation','coverage.calls'),coverageCharacters:counters('fontPreparation','coverage.characters'),
    fontkitShapesDuringPreparation:counters('fontPreparation','shaping.fontkit'),
    firstRenderMetrics:{calls:counters('firstRender','metrics.calls'),misses:counters('firstRender','metrics.cacheMiss'),hits:counters('firstRender','metrics.cacheHit'),harfbuzzShapes:counters('firstRender','shaping.harfbuzz'),outlineUpgrades:counters('firstRender','metrics.outlineUpgrade')},
    firstRenderSpans:spans.filter(item=>item.phase==='firstRender').map(item=>({name:item.name,elapsedMs:item.elapsedMs})),
    scriptAnalysis:prep.filter(item=>item.name==='analysis.scripts').map(item=>({elapsedMs:item.elapsedMs,before:item.meta.before,after:item.meta.after}))});
}
writeFileSync(path.join(own,'facts.json'),JSON.stringify(facts,null,2)+'\n',{flag:'wx'});
const relative='docs/handoff/2026-11-09/rr114-cold-start-diagnostic/';
const sourceFiles=gitText('ls-tree','-r','--name-only',source,'--',relative).split('\n').map(file=>{
 const bytes=git('show',source+':'+file);
 return{file,bytes:bytes.length,sha256:sha(bytes),blob:gitText('rev-parse',source+':'+file)};
});
const protectedObjects=['packages','spec','pnpm-lock.yaml','pnpm-workspace.yaml'].map(file=>({file,runtime:gitText('rev-parse','ed29f47f092aeefbde5fabac26d395f92c6b7823:'+file),tested:gitText('rev-parse',source+':'+file)}));
assert.ok(protectedObjects.every(item=>item.runtime===item.tested));
const manifest={schema:1,format:'opf-cold-start-diagnostic-v1',evidenceOnly:true,neverMerge:true,source,tree,runtimeSource:'ed29f47f092aeefbde5fabac26d395f92c6b7823',builtSource:'3857ff1bbc467ddb0d0031bc400e159d120b67b9',originalEvidence:'4d1ffa78440c47d955d9883575d347996325bf40',
 process:{session:45612,exitCode:0,started:exit.started,finished:exit.finished},raw:{file:'raw.json.gz',bytes:compressed.length,sha256:sha(compressed),expandedBytes:archiveBytes.length,members:entries.length,decodedBytes:sum(entries,item=>item.size)},entries:entries.map(({base64,...item})=>item),sourceFiles,protectedObjects,facts:{file:'facts.json',bytes:readFileSync(path.join(own,'facts.json')).length,sha256:sha(readFileSync(path.join(own,'facts.json')))}};
writeFileSync(path.join(own,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',members:entries.length,decodedBytes:manifest.raw.decodedBytes,archiveBytes:compressed.length,sourceFiles:sourceFiles.length,verifiedRenderHashes:312}));
