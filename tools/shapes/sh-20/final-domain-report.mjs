// Reconcile every sealed native observation with current shipped eligibility. Composition only: never renders or opens Office.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolvePresentation} from '../../../packages/render/dist/svg.js';
import {gallery} from '../../../packages/gallery/dist/index.js';
import {loadFonts} from '../../../packages/render/dist/fonts-node.js';
import {smartArtReason,opfLayoutReason} from '../../../packages/pptx/src/smart-art.js';
import {opfLayoutDefinition} from '../../../packages/pptx/src/smart-art-layouts.js';
import {smartArtScript,smartArtUnavailable,opfSmartArtUnavailable,SMART_ART_DOMAIN,SMART_ART_OPF_DOMAIN} from '../../../packages/javascript/dist/composition.js';
const [sweep,gatePath,output]=process.argv.slice(2);
if(!sweep||!gatePath||!output)throw Error('Usage: node tools/shapes/sh-20/final-domain-report.mjs <sealed-sweep> <gate.json> <fresh-output>');
if(fs.existsSync(output))throw Error('Preserve previous report: output already exists');
const root=fileURLToPath(new URL('../../../',import.meta.url)),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),baseline=JSON.parse(fs.readFileSync(gatePath));
// Match the original office/visual witness planner; the actual bound document chooses each script slot.
const fonts=await loadFonts({pack:'office',scripts:['Arab','Hebr','Hans','Jpan'],substitutionPolicy:'visual'}),rows=[],inputManifest=[];
for(const row of baseline){
 const source=path.join(sweep,'decks',row.id.replace(/-1$/,'')+'.opf.json'),bytes=fs.readFileSync(source),document=JSON.parse(bytes),bound=resolvePresentation(document,{catalogs:[gallery],fonts,validate:false}).slides[0],composition=bound.geometry,arrangement=composition.arrangements?.[0],item=composition.items.find(i=>i.path===arrangement?.path),values=Array.isArray(item?.value)?item.value:[];
 inputManifest.push({path:'decks/'+path.basename(source),size:bytes.length,sha256:hash(bytes)});
 let reason='No live arrangement; complete composed content is preserved',current,predicate;
 if(arrangement){
  const design=arrangement.design??'smartart',script=smartArtScript(values.map(v=>typeof v==='string'?v:typeof v?.text==='string'?v.text:Array.isArray(v?.text)?v.text.map(r=>r.text??r).join(''):'')),rtl=composition.direction==='rtl'||script.rtl,a=arrangement.smartArt;
  current={design,layout:arrangement.layout,kind:arrangement.kind,frame:arrangement.frame,smartArt:a,count:arrangement.nodes.length};
  if(design==='smartart'){
   reason=smartArtReason(arrangement,values,composition.direction==='rtl');
   predicate={type:'builtin',candidate:{...a,kind:arrangement.kind,count:values.length,frame:arrangement.frame,rtl,...(script.script?{script:script.script}:{}),nodes:a.lines.map((lines,i)=>({lines,stable:a.stable[i]}))}};
  }else{
   reason=opfLayoutReason(arrangement,values,composition.direction==='rtl');
   if(reason===undefined)reason=opfLayoutDefinition(arrangement,item).reason;
   if(arrangement.layout)predicate={type:'opf',candidate:{...a,design:arrangement.layout.design,compact:!!arrangement.layout.compact,count:values.length,rtl,...(script.script?{script:script.script}:{})}};
  }
 }
 const eligible=reason===undefined;
 if(predicate){const modeled=predicate.type==='builtin'?smartArtUnavailable(predicate.candidate):opfSmartArtUnavailable(predicate.candidate);assert.equal(modeled===undefined,eligible,row.id+': recorded core predicate matches actual export decision');}
 rows.push({...row,inputSha256:hash(bytes),current:{candidate:current,eligible,reason},predicate});
}
const live=rows.filter(r=>r.live),eligible=rows.filter(r=>r.current.eligible),own=eligible.filter(r=>r.predicate?.type==='opf');
assert.equal(rows.length,516);assert.equal(live.length,465);assert.ok(eligible.every(r=>r.live&&r.result==='pass'),'every admitted instance passed the full native gate');
const sharedCaps=rows.filter(r=>r.live&&r.script==='latin'&&r.predicate?.type==='opf').filter(r=>{const c=r.predicate.candidate;return !c.rtl&&!c.script&&Math.max(...c.lines)<=SMART_ART_OPF_DOMAIN.lines&&c.stable.every(Boolean)&&(c.widest??0)<=SMART_ART_DOMAIN.lineWidth+1e-6&&(c.ink??0)<=SMART_ART_OPF_DOMAIN.ink+1e-6});
const newlySafe=sharedCaps.filter(r=>!r.current.eligible);
const scripts=[...new Set(rows.map(r=>r.script))].map(script=>({script,total:rows.filter(r=>r.script===script).length,live:live.filter(r=>r.script===script).length,pass:live.filter(r=>r.script===script&&r.result==='pass').length,eligible:eligible.filter(r=>r.script===script).length}));
const sources=['packages/javascript/src/arrangements.ts','packages/javascript/src/smart-art-layout.ts','packages/pptx/src/smart-art.js','packages/pptx/src/smart-art-layouts.js','packages/render/src/svg.js','tools/shapes/sh-20/gate.mjs'].map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const summary={source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'Current canonical composition/export predicates against every immutable original diagnostic observation; no current native sweep, render or Office run',gate:{path:gatePath,sha256:hash(fs.readFileSync(gatePath)),observations:rows.length,live:live.length,pass:live.filter(r=>r.result==='pass').length,fail:live.filter(r=>r.result!=='pass').length},currentEligible:eligible.length,currentEligibleFailures:eligible.filter(r=>r.result!=='pass').length,builtinEligible:eligible.length-own.length,opfEligible:own.length,allMeasuredFailuresRefused:live.filter(r=>r.result!=='pass').every(r=>!r.current.eligible&&!!r.current.reason),sharedCapsWithoutDesignCountOrCompactRestriction:sharedCaps.length,newlySafeCandidates:newlySafe.map(r=>r.id),scripts,sources,decision:'No additional safe live domain under unchanged full-gate/text-density/wrap/line-width bounds; preserve native-shape fallback and explicit refusal reasons'};
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(rows,null,2)+'\n');fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');fs.writeFileSync(path.join(output,'inputs.json'),JSON.stringify(inputManifest,null,2)+'\n');
fs.writeFileSync(path.join(output,'boundary-fixture.json'),JSON.stringify({scope:summary.scope,rows:rows.map(r=>({id:r.id,kind:r.kind,script:r.script,originalLive:r.live,originalResult:r.result,checks:r.checks,predicate:r.predicate,eligible:r.current.eligible,reason:r.current.reason})),summary:{observations:rows.length,live:live.length,pass:summary.gate.pass,fail:summary.gate.fail,eligible:eligible.length,ownEligible:own.length,newlySafeCandidates:summary.newlySafeCandidates}},null,2)+'\n');fs.writeFileSync(path.join(output,'boundary-fixture.json.gz'),gzipSync(fs.readFileSync(path.join(output,'boundary-fixture.json')),{level:9}));console.log(JSON.stringify({source:summary.source,observations:rows.length,live:live.length,pass:summary.gate.pass,fail:summary.gate.fail,currentEligible:eligible.length,ownEligible:own.length,newlySafe:summary.newlySafeCandidates}));
