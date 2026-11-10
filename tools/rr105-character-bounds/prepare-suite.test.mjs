import assert from 'node:assert/strict';import {test} from 'node:test';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {parseArgs,sourcePlan,inspect,sha} from './prepare-suite.mjs';
const folder=fileURLToPath(new URL('./',import.meta.url));
test('default source plan binds original archive, zero actions and fixed10 samples without producing a suite',()=>{
 const before=fs.readdirSync(folder).sort(),p=sourcePlan();assert.equal(p.mode,'source-plan-only');assert.equal(p.nativeAuthorized,false);assert.equal(p.nativeRun,false);assert.equal(p.validateOnlyRun,false);assert.equal(p.source.originalArchiveSha256,'4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2');assert.equal(p.source.limits.timeoutSeconds,45);assert.equal(p.source.limits.shapes,3);assert.equal(p.source.limits.actions,0);assert.deepEqual(p.source.samplePlan.map(x=>x.positions1Based),[[1,2,3,4,6,9],[1,2,3,4]]);assert.deepEqual(JSON.parse(fs.readFileSync(new URL('./references/empty.json',import.meta.url))),[]);const raw=gunzipSync(fs.readFileSync(new URL('./references/original09.pptx.gz',import.meta.url)));assert.equal(raw.length,101027);assert.equal(sha(raw),p.source.originalArchiveSha256);assert.deepEqual(fs.readdirSync(folder).sort(),before);
});
test('actual default CLI remains source-only and preserves file inventory',()=>{
 const before=fs.readdirSync(folder).sort(),raw=execFileSync(process.execPath,[fileURLToPath(new URL('./prepare-suite.mjs',import.meta.url))],{encoding:'utf8'}),p=JSON.parse(raw);assert.equal(p.mode,'source-plan-only');assert.equal(p.nativeRun,false);assert.deepEqual(fs.readdirSync(folder).sort(),before);
});
test('explicit preparation arguments reject missing, duplicate and unknown modes/flags',()=>{
 assert.deepEqual(parseArgs([]),{mode:'plan'});const args=['--worker-checkout','C:/worker','--controller','C:/controller','--expect-head','a'.repeat(40)];assert.equal(parseArgs(['inspect',...args]).mode,'inspect');assert.equal(parseArgs(['prepare',...args,'--output','C:/fresh']).mode,'prepare');for(const bad of [['native'],['prepare'],['inspect',...args,'--output','C:/bad'],['prepare',...args],['inspect',...args,'--controller','C:/duplicate'],['inspect',...args,'--allow-native','true'],['inspect',...args,'--output']])assert.throws(()=>parseArgs(bad));
});
test('identity admission refuses an unreviewed head before reading supplied roots',()=>{
 assert.throws(()=>inspect({workerCheckout:'C:/not-an-execution-root',controller:'C:/not-an-execution-root',expectedHead:'unreviewed'}),/Explicit reviewed head required/);
});
