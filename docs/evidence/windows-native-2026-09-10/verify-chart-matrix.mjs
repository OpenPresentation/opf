// Offline provenance/coverage verification. Re-run the retained chart comparator
// in the pinned PPTX checkout for actual imports and independent cache parsing.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=file=>readFile(path.join(root,file));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse((await read(file)).toString('utf8').replace(/^\uFEFF/,''));
const series=data=>data.columns.slice(1).map((name,i)=>({name,categories:data.rows.map(row=>row[0]),values:data.rows.map(row=>row[i+1])}));
const records=[];let baseline;
for(const [node,prefix] of [['v20.20.2','chart-node20-matrix02-slide'],['v24.20.0','chart-node24-matrix-slide']])for(let slide=1;slide<=8;slide++) {
  const directory='raw/'+prefix+slide,readRun=file=>read(directory+'/'+file),jsonRun=file=>json(directory+'/'+file);
  const generation=await jsonRun('generation.json'),native=await jsonRun('native.json'),comparison=await jsonRun('comparison.json'),worker=await jsonRun('worker.json');
  assert.equal(generation.node,node);assert.equal(comparison.node,node);
  assert.deepEqual(native.editedSlides,[slide]);assert.deepEqual(comparison.editedSlides,[slide]);
  assert.equal(comparison.passed,true);assert.equal(comparison.liveEditedSeries,true);assert.equal(comparison.imports,24);assert.equal(comparison.independentCacheComparisons,24);
  assert.equal(worker.exitCode,0);assert.equal(worker.timedOut,false);assert.equal(worker.timeoutSeconds,45);
  assert.equal(native.generationSha256,hash(await readRun('generation.json')));
  assert.equal(comparison.nativeSha256,hash(await readRun('native.json')));
  assert.deepEqual(native.editedLive,series(generation.expected[slide-1].edited));
  assert.equal(native.powerPointVersion,'16.0.20326.20132');assert.equal(native.windowsBuild,'26200.9445');
  assert.equal(native.executableSha256,'90fa931172c507b763ba92a82b19d5bc70816e008c5bb87577e1838e8a92e9f9');
  const identity={runtime:generation.runtime,pptxSha256:generation.pptxSha256,expected:generation.expected};
  if(baseline)assert.deepEqual(identity,baseline,'Both runtimes must use identical fixture and runtime bytes');else baseline=identity;
  for(const [file,digest] of [['charts.pptx',generation.pptxSha256],['charts-saved.pptx',native.savedSha256],['charts-edited.pptx',native.editedSha256]])assert.equal(hash(await readRun(file)),digest);
  for(const phase of ['original','reopened','edited']) {
    assert.equal(native[phase].length,8);
    for(const item of native[phase])assert.equal(hash(await readRun(item.png)),item.pngSha256);
  }
  for(let i=0;i<8;i++) {
    assert.equal(native.original[i].pngSha256,native.reopened[i].pngSha256);
    if(i===slide-1)assert.notEqual(native.edited[i].pngSha256,native.reopened[i].pngSha256);
    else assert.equal(native.edited[i].pngSha256,native.reopened[i].pngSha256);
  }
  assert.equal(comparison.unavailableObservations.length,12);
  for(const item of comparison.unavailableObservations) {
    assert.equal(generation.expected[item.slide-1].type,'pie');assert.equal(item.property,'Series.XValues');assert.deepEqual(item.observed,[null,null]);
  }
  records.push({directory,node,editSlide:slide,comparisonSha256:hash(await readRun('comparison.json')),workerSha256:hash(await readRun('worker.json')),imports:24,independentCacheComparisons:24,unchangedSaveReopenRasters:8,changedEditedRasters:1,unavailableColdPieCategoryObservations:12});
}
const control=await json('raw/pie-native-created-control-03/control.json');
assert.deepEqual(control.observed.map(item=>item.phase),['created','reopened']);
assert.deepEqual(control.observed[0].categories,['1st Qtr','2nd Qtr','3rd Qtr','4th Qtr']);
assert.deepEqual(control.observed[1].categories,[null,null,null,null]);
assert.deepEqual(control.observed[0].values,control.observed[1].values);
assert.equal(hash(await read('raw/pie-native-created-control-03/created-by-powerpoint.pptx')),control.pptxSha256);
const summary={records,runs:16,imports:384,independentCacheComparisons:384,actualWorkbookEdits:16,unchangedSaveReopenRasters:128,changedEditedRasters:16,fixtureAndRuntimeBytesIdentical:true,passed:true,scope:'Chart data/color and native save/reopen gates only. Null cold pie XValues are unavailable observations reproduced with a PowerPoint-created control. Exact live edited series and persisted cache data remain required. No font-file or browser/native raster-equivalence claim.'};
if(process.argv[2]==='create')await writeFile(path.join(root,'chart-two-runtime-summary.json'),JSON.stringify(summary,null,2)+'\n');
else assert.deepEqual(await json('chart-two-runtime-summary.json'),summary);
console.log('Verified all 16 chart runs, source/native/comparison bindings, one edit per invocation, unchanged save/reopen rasters and native-only pie control.');
