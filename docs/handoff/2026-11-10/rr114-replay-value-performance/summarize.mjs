// Pure arithmetic over retained result vectors; no product imports or measurements.
import assert from 'node:assert/strict';
const mean=values=>values.reduce((n,x)=>n+x,0)/values.length;
export const metrics=Object.freeze({
 preparationMs:r=>r.preparationMs,firstMs:r=>r.firstMs,continuousStartupMs:r=>r.continuousPreparationToFirstMs,prepPlusFirstMs:r=>r.prepPlusFirstMs,
 preparationCpuMs:r=>r.preparationCpuMs,firstCpuMs:r=>r.prepPlusFirstCpuMs-r.preparationCpuMs,startupCpuMs:r=>r.prepPlusFirstCpuMs,
 warmMs:r=>mean(r.warmMs),warmCpuMs:r=>mean(r.warmCpuMs),
 firstHwmMiB:r=>r.firstMaxRssBytes/1048576,finalHwmMiB:r=>r.finalRenderMaxRssBytes/1048576,postDropHeapMiB:r=>r.postDropHeapUsed/1048576,
});
export function summarize(run){
 assert.equal(run.status,'PASS');assert.equal(run.rows.length,12);
 return {kind:'DESCRIPTIVE_TWO_REPETITION_SCREEN',children:12,svgChecks:1200,performanceResult:true,universalImprovement:false,candidateFolded:false,stressReplayEligibility:'UNKNOWN_NOT_OBSERVED',sizes:[16,36,48].map(size=>{
  const control=run.rows.filter(r=>r.size===size&&r.variant==='control'),candidate=run.rows.filter(r=>r.size===size&&r.variant==='candidate');assert.equal(control.length,2);assert.equal(candidate.length,2);
  const values=Object.fromEntries(Object.entries(metrics).map(([key,get])=>{const c=control.map(get),v=candidate.map(get),cm=mean(c),vm=mean(v);return [key,{control:c,candidate:v,controlMean:cm,candidateMean:vm,candidateChangePercent:(vm/cm-1)*100}];}));
  return {size,repetitionsPerVariant:2,values,controlRaw:control,candidateRaw:candidate};
 })};
}
