// Authored public/synthetic inputs for a dedicated, separately bound reference-line observation profile.
// This module is source/pure only: it cannot build/export a deck, query Office or launch a worker.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const REFERENCE_PROFILE='reference-chart-original-readonly-v1';
export const REFERENCE_CASES=Object.freeze([
  {id:'reference-native-lines',file:'reference-native-lines.opf.json',slides:['line-multiple','line-defaults','no-inference'],types:['line','line','column']},
  {id:'reference-native-axes',file:'reference-native-axes.opf.json',slides:['combo-axes','column-percent','area-unlabelled'],types:['combo','column','area']},
  {id:'reference-overlays-markers',file:'reference-overlays-markers.opf.json',slides:['line-markers','bar-overlay','singleton-overlay'],types:['line-with-markers','bar','column']},
  {id:'reference-singleton-axes',file:'reference-singleton-axes.opf.json',slides:['singleton-both-axes','singleton-secondary-only','singleton-no-references'],types:['combo','combo','combo']}
].map(item=>Object.freeze({...item,slides:Object.freeze(item.slides),types:Object.freeze(item.types)})));
export const REFERENCE_LIMITS=Object.freeze({slides:3,maxShapesPerSlide:3,maxTotalShapes:9,maxActions:0,maxArchiveBytes:16*1024*1024,maxZipEntries:4096,defaultTimeoutSeconds:45,maxTimeoutSeconds:60});
const folder=fileURLToPath(new URL('./reference-witnesses/',import.meta.url));
const supported=['area','bar','column','combo','line','line-with-markers'];

export function assertReferenceSources(sources){
  assert.equal(sources.length,REFERENCE_CASES.length,'Exactly the four independently authored cases');
  const types=new Set(),ids=new Set();
  for(const[index,item]of sources.entries()){
    const expected=REFERENCE_CASES[index],doc=item.document;
    assert.equal(item.id,expected.id,'Case order and closed selection');
    assert.ok(!ids.has(item.id));ids.add(item.id);
    assert.equal(doc.design?.fontScheme,'roboto','Pinned open-font source');
    assert.equal(doc.slides.length,3,'Never project or drop a physical witness slide');
    assert.deepEqual(doc.slides.map(slide=>slide.id),expected.slides);
    assert.deepEqual(doc.slides.map(slide=>slide.chart?.type),expected.types);
    assert.equal(doc.assets,undefined,'No external/private assets');
    for(const slide of doc.slides){
      const chart=slide.chart;types.add(chart.type);
      assert.equal(chart.legend,'none');assert.equal(chart.dataLabels,false);
      assert.ok(chart.data.rows.length>=1&&chart.data.rows.length<=3);
      for(const ref of chart.referenceLines??[]){
        assert.ok(Number.isFinite(ref.value),'Only explicit finite raw numeric values');
        if(ref.axis==='secondary'){
          assert.equal(chart.type,'combo');assert.ok(chart.line?.includes('Margin'));assert.ok(chart.secondaryAxis?.includes('Margin'));
        }
      }
    }
  }
  assert.deepEqual([...types].sort(),supported);
  const lines=sources[0].document.slides;
  assert.equal(lines[0].chart.referenceLines.length,2);
  assert.deepEqual(lines[0].chart.referenceLines.map(ref=>ref.stroke.dash),['dash','dot']);
  assert.ok(lines[0].chart.referenceLines.some(ref=>ref.value>60)&&lines[0].chart.referenceLines.some(ref=>ref.value<40),'Automatic bounds must include values outside ordinary data');
  assert.deepEqual(lines[1].chart.referenceLines,[{value:55}],'Unlabelled/default-stroke control');
  assert.equal(lines[2].chart.referenceLines,undefined,'Numeric prose alone is not a reference property');
  assert.match(lines[2].title,/\d/);assert.match(lines[2].subtitle,/\d/);
  const axes=sources[1].document.slides;
  assert.equal(axes[0].chart.referenceLines.find(ref=>ref.axis==='secondary').value,0.25,'Percentage reference is raw .25, not25');
  assert.equal(axes[0].chart.data.columns[2].format,'0%');
  assert.equal(axes[1].chart.referenceLines[0].stroke.dash,'solid');
  for(const slide of sources[2].document.slides.slice(1)){
    assert.equal(slide.title,undefined,'Keep physical fallback fixtures bare');
    assert.equal(slide.subtitle,undefined);
    assert.equal(slide.chart.referenceLines.length,1);
    assert.equal(typeof slide.chart.referenceLines[0].label,'string');
  }
  assert.equal(sources[2].document.slides[2].chart.data.rows.length,1,'Intentional singleton overlay');
  const singleton=sources[3].document.slides;
  for(const slide of singleton){assert.equal(slide.title,undefined);assert.equal(slide.subtitle,undefined);assert.equal(slide.chart.data.rows.length,1);assert.deepEqual(slide.chart.line,['Margin']);assert.deepEqual(slide.chart.secondaryAxis,['Margin']);assert.equal(slide.chart.data.columns[2].format,'0%');}
  assert.deepEqual(singleton[0].chart.referenceLines.map(({value,axis,label})=>({value,axis,label})),[{value:180,axis:undefined,label:undefined},{value:.25,axis:'secondary',label:undefined}]);
  assert.equal(singleton[1].chart.referenceLines.length,1);assert.equal(singleton[1].chart.referenceLines[0].axis,'secondary');assert.equal(singleton[1].chart.referenceLines[0].value,.25);assert.equal(singleton[1].chart.referenceLines[0].label,'Margin 25%');
  assert.equal(singleton[2].chart.referenceLines,undefined);
  return sources;
}

export function readReferenceSources(){
  return assertReferenceSources(REFERENCE_CASES.map(({id,file})=>{
    const bytes=fs.readFileSync(path.join(folder,file));
    return{id,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),document:JSON.parse(bytes)};
  }));
}

export function titleInvariancePair(sources=readReferenceSources()){
  const before=structuredClone(sources[0].document);
  before.slides=[structuredClone(before.slides[0])];
  before.slides[0].title='Planning baseline';
  before.slides[0].subtitle='Evidence context';
  const after=structuredClone(before);
  after.slides[0].title='Target 92%';
  after.slides[0].subtitle='Threshold 30';
  return{before,after,physicalProfileCase:false,requiresActualExportFrameEquality:true,
    limitation:'This is an authored pure-export comparison input only. Future generation must first assert equal actual chart frames, then compare helper/axis/label XML. Source equality alone is not a runtime invariance proof.'};
}

export function sourceSummary(sources=readReferenceSources()){
  return{profile:REFERENCE_PROFILE,scope:'source/pure preparation only',fullSuite:false,nativeAcceptance:false,registryAcceptance:false,automaticControlEligible:false,
    cases:sources.map(item=>({id:item.id,file:item.file,bytes:item.bytes,sha256:item.sha256,slideCount:item.document.slides.length,types:item.document.slides.map(slide=>slide.chart.type),referenceCounts:item.document.slides.map(slide=>slide.chart.referenceLines?.length??0)})),
    limits:REFERENCE_LIMITS,exportedShapeCounts:'UNMEASURED; strict generation gate before physical profile approval',
    expectedNativePhases:['original','saved-reopened'],expectedPngsPerCase:6,actions:[]};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.ok(process.argv.length===2||(process.argv.length===3&&process.argv[2]==='inspect'),'Only default pure source inspection is available; no Office/generation route');
  console.log(JSON.stringify(sourceSummary(),null,2));
}
