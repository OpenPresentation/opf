/** Reproduce RR-79/#566 calibration against the committed FF-44 natural Chromium advances.
 * Run after pnpm build: node scripts/report-script-width-estimates.mjs [output.json]. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {measureText} from '../packages/javascript/dist/composition.js';
const source=new URL('../docs/evidence/script-corpora-20261001/',import.meta.url);
const corpusBytes=await readFile(new URL('script-corpora.json',source));
const browserBytes=await readFile(new URL('browser.json',source));
const corpus=JSON.parse(corpusBytes),browser=JSON.parse(browserBytes);
const samples=new Map(corpus.groups.flatMap(group=>group.samples.map(sample=>[sample.id,{...sample,script:group.script}])));
const protectedScripts=new Set(['Latn','Jpan','Hans','Hant','Kore']);
const base=(character,spacing)=> /\p{Mn}|\p{Me}|\u200d|\ufe0f/u.test(character)||(!spacing&&/\p{Mc}/u.test(character))?0:character===' '?0.32:/[A-Z0-9]/u.test(character)?0.62:character.codePointAt(0)>0x2e80?1:.54;
const rows=browser.rows.map(row=>{
  const sample=samples.get(row.id);
  const script=protectedScripts.has(sample.script)?null:new RegExp(`\\p{Script=${sample.script}}`,'u');
  let before=0,spacing=0,own=0,common=0;
  for(const character of sample.text){
    before+=base(character,false);spacing+=base(character,true);
    if(script?.test(character))own+=base(character,true);else common+=base(character,true);
  }
  return {id:row.id,script:sample.script,family:row.family,weight:row.weight,italic:row.italic,browser:row.browser,before:before*100,spacing:spacing*100,after:measureText(sample.text,100),ownUnits:own,commonUnits:common,neededFactor:own?(row.browser/100-common)/own:1};
});
const median=values=>{values.sort((a,b)=>a-b);return(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2;};
const distribution=(cases,key)=>{const errors=cases.map(row=>Math.abs(row[key]/row.browser-1)).sort((a,b)=>a-b);return {mean:errors.reduce((sum,value)=>sum+value,0)/errors.length,median:median([...errors]),p90:errors[Math.ceil(errors.length*.9)-1],max:errors.at(-1)};};
const summary=corpus.groups.map(group=>{
  const cases=rows.filter(row=>row.script===group.script);
  const weighted=cases.filter(row=>row.ownUnits>0).sort((a,b)=>a.neededFactor-b.neededFactor);
  const totalWeight=weighted.reduce((sum,row)=>sum+row.ownUnits*100/row.browser,0);let cumulative=0;
  const robust=weighted.find(row=>{cumulative+=row.ownUnits*100/row.browser;return cumulative>=totalWeight/2;})?.neededFactor??1;
  const robustFactor=Math.round(robust*100)/100;
  const robustRatios=cases.map(row=>(row.commonUnits+row.ownUnits*robustFactor)*100/row.browser);
  const limiting=cases.reduce((a,b)=>a.neededFactor>b.neededFactor?a:b);
  return {script:group.script,cases:cases.length,protected:protectedScripts.has(group.script),robustAlternative:{factor:robustFactor,minEstimateToBrowser:Math.min(...robustRatios),maxEstimateToBrowser:Math.max(...robustRatios),meanAbsoluteRelativeError:robustRatios.reduce((sum,ratio)=>sum+Math.abs(ratio-1),0)/cases.length},maximumAlternativeFactor:protectedScripts.has(group.script)?1:Math.max(1,Math.ceil(limiting.neededFactor*100)/100),absoluteRelativeError:{before:distribution(cases,'before'),spacingOnly:distribution(cases,'spacing'),after:distribution(cases,'after')},beforeMedian:median(cases.map(row=>row.browser/row.before)),spacingMedian:median(cases.map(row=>row.browser/row.spacing)),afterMedian:median(cases.map(row=>row.browser/row.after)),afterMax:Math.max(...cases.map(row=>row.browser/row.after)),estimateToBrowser:{min:Math.min(...cases.map(row=>row.after/row.browser)),median:median(cases.map(row=>row.after/row.browser)),max:Math.max(...cases.map(row=>row.after/row.browser)),over25Percent:cases.filter(row=>row.after/row.browser>1.25).length},byWeight:[400,700].map(weight=>{const faces=cases.filter(row=>row.weight===weight);return {weight,cases:faces.length,medianEstimateToBrowser:faces.length?median(faces.map(row=>row.after/row.browser)):null,maxEstimateToBrowser:faces.length?Math.max(...faces.map(row=>row.after/row.browser)):null};}),underestimated:cases.filter(row=>row.browser>row.after+.1).length,limiting:{id:limiting.id,family:limiting.family,weight:limiting.weight,neededFactor:limiting.neededFactor}};
});
const report={method:'Natural Chromium advances at 100px from FF-44; robust script factor minimizes mean absolute relative error after Mc correction: weighted median of (browserEm-commonUnits)/scriptUnits with weight scriptUnits/browserEm, rounded to nearest .01; only six named scripts receive factors. No runtime fonts or native accuracy claim.',sources:{corpus:createHash('sha256').update(corpusBytes).digest('hex'),browser:createHash('sha256').update(browserBytes).digest('hex')},summary,rows};
const output=process.argv[2]??new URL('../docs/evidence/script-width-estimates/report.json',import.meta.url);
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cases:rows.length,nonprotectedUnderestimates:summary.filter(row=>!row.protected).reduce((total,row)=>total+row.underestimated,0),protectedUnderestimates:summary.filter(row=>row.protected).reduce((total,row)=>total+row.underestimated,0)},null,2));
