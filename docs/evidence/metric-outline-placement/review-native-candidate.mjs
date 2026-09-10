import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fromPptx} from '../../../../opf-pptx/dist/index.js';
const require=createRequire(new URL('../../../../opf-render/package.json',import.meta.url)),sharp=require('sharp');
const root=path.resolve(process.argv[2]??fileURLToPath(new URL('../windows-native-candidate-2026-09-10/raw',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
async function mask(file){
  const bytes=await readFile(file),{data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const pixels=new Set();let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let i=0;i<data.length;i+=info.channels)if([0,1,2].some(c=>Math.abs(data[i+c]-data[c])>2)){
    const p=i/info.channels,x=p%info.width,y=Math.floor(p/info.width);pixels.add(p);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return {sha256:sha(bytes),pixels,bounds:pixels.size?{left,top,right,bottom}:null};
}
const results=[];
for(const dir of ['metric-candidate-node20-01','metric-candidate-node24-02']){
  const base=root+'/'+dir,g=await json(base+'/generation.json'),report=await json(base+'/comparison.json');
  assert.equal(report.generationSha256,sha(await readFile(base+'/generation.json')));assert.equal(report.completeMatrix,true);
  const tabs=[],outliers=[];let slideCount=0,maskCount=0,imports=0;
  for(const deck of g.decks){
    const run=base+'/runs/'+deck.id,worker=await json(run+'/worker.json'),native=await json(run+'/native.json');
    assert.equal(worker.timedOut,false);assert.equal(worker.exitCode,0);assert.equal(native.generationSha256,report.generationSha256);
    assert.equal(native.decks.length,1);const record=native.decks[0];assert.equal(record.id,deck.id);
    for(const phase of ['original','saved','edited']) {
      const bytes=await readFile(base+'/'+deck.id+(phase==='original'?'':'-'+phase)+'.pptx');
      assert.equal(sha(bytes),phase==='original'?deck.pptxSha256:record[phase+'Sha256']);
      const document=await fromPptx(bytes);assert.equal(document.slides.length,deck.document.slides.length);
      for(const [index,slide]of document.slides.entries()) {
        let metric=structuredClone(deck.document.slides[index].metric);
        if(phase==='edited') {
          if(typeof metric==='number')metric=7;
          else if(typeof metric==='string')metric='NATIVE '+metric;
          else {
            metric.value=typeof metric.value==='number'?7:'NATIVE '+metric.value;
            for(const [field,prefix]of [['unit','Native '],['label','Saved '],['description','Edited ']])if(metric[field])metric[field]=prefix+metric[field];
            if(metric.delta!==undefined&&String(metric.delta)!=='')metric.delta=typeof metric.delta==='number'?1:'Delta '+metric.delta;
            if(metric.trend)metric.trend='down';
          }
        }
        assert.deepEqual(slide.blocks,[{type:'metric',metric}]);
      }
    }
    for(const slide of record.slides){
      slideCount++;const id=slide.slide,cell=deck.layouts[id-1].cell;
      for(const line of slide.lines)for(const tab of line.tabTargets){
        assert.ok(Math.abs(Math.abs(tab.actualOffsetPoints-tab.expectedOffsetPoints)-tab.errorPoints)<1e-10);
        if(tab.errorPoints>.02)tabs.push({id:deck.id,slide:id,role:line.role,text:line.text,...tab});
      }
      const full=await mask(base+'/'+deck.id+'-native-'+id+'.png'),combined=new Set();assert.equal(full.sha256,slide.rasterSha256);
      for(const part of slide.partRasters){
        const field=await mask(base+'/'+part.file);maskCount++;assert.equal(field.sha256,part.sha256);
        const expected=report.partInk.find(p=>p.id===deck.id&&p.slide===id&&p.role===part.role);assert.deepEqual(field.bounds,expected.bounds);
        for(const p of field.pixels){assert.ok(!combined.has(p),'Unexpected inter-part overlap');combined.add(p);}
      }
      assert.deepEqual(combined,full.pixels,'Part masks must reproduce the complete slide');
      const svg=await mask(base+'/'+deck.id+'-svg-'+id+'.png');assert.equal(svg.sha256,deck.svgRasterSha256[id-1]);
      for(const [engine,ink]of [['native',full.bounds],['svg',svg.bounds]])if(ink&&!(ink.left>=Math.floor(cell.x)&&ink.top>=Math.floor(cell.y)&&ink.right<Math.ceil(cell.x+cell.width)&&ink.bottom<Math.ceil(cell.y+cell.height)))outliers.push({id:deck.id,slide:id,engine,ink,cell});
    }
  }
  for(const item of report.imports){assert.equal(sha(await readFile(base+'/'+item.filename)),item.sha256);assert.equal(item.exactMetricFieldsSourceAndTypes,true);imports+=item.slides;}
  assert.deepEqual(tabs,report.tabOutliers);assert.deepEqual(outliers,report.rasterOutliers);assert.equal(tabs.length,6);assert.equal(outliers.length,0);
  results.push({directory:dir,slides:slideCount,isolatedMasks:maskCount,actualCheckedImports:imports,tabOutliers:tabs.length,maximumTabErrorPoints:Math.max(...tabs.map(t=>t.errorPoints)),rasterOutliers:outliers,workerExitsAndMaskUnionAndNoCollisions:true});
}
const output=path.resolve(process.argv[3]??'artifacts/windows-metric-independent-review.json');
await writeFile(output,JSON.stringify({reviewNode:process.version,reviewerSha256:sha(await readFile(new URL(import.meta.url))),converterSha256:sha(await readFile(new URL('../../../../opf-pptx/dist/index.js',import.meta.url))),evidenceCommit:'5d39217f0716453bf3762057852006b4787de73b',results,scope:'Independent review of committed Windows observations: decoded complete and isolated masks, raw tab arithmetic, worker results and actual current-metric imports with native edits. No new Office execution or claim that failed native gates pass.'},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
