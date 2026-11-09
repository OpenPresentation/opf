import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(folder,'../../../..');
const read=p=>fs.readFileSync(path.join(folder,p));
const json=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
const receipt=json(read('evidence.json')),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(receipt.runtimeHead,'b487178e7d5425c3bb272a4b294dfea3ba15e7cc');
assert.equal(receipt.baselineHead,'f32f7ea982a3bf41edd7e31064ea9a5d779ea5db');
assert.equal(receipt.evidence.length,60);
const raw=new Map();let total=0;
for(const entry of receipt.evidence){
 assert.ok(!entry.file.includes('\\')&&!entry.file.split('/').includes('..')&&!path.isAbsolute(entry.file));
 const target=path.resolve(folder,entry.file);assert.ok(target.startsWith(folder+path.sep));
 const stored=read(entry.file);assert.equal(stored.length,entry.storedBytes);assert.equal(sha(stored),entry.storedSHA256);
 assert.ok(entry.rawBytes<=4*1024*1024);const decoded=entry.encoding==='gzip'?gunzipSync(stored,{maxOutputLength:4*1024*1024}):stored;
 assert.equal(decoded.length,entry.rawBytes);assert.equal(sha(decoded),entry.rawSHA256);raw.set(entry.file,decoded);total+=decoded.length;
}
assert.ok(total<8*1024*1024);
const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:4*1024*1024});
for(const[file,source]of Object.entries(receipt.sourceBlobs)){
 assert.equal(git(['rev-parse',`HEAD:${file}`]).toString().trim(),source.gitBlob);
 assert.equal(sha(git(['show',`HEAD:${file}`])),source.canonicalSHA256);
}
const protectedPaths=['spec','packages/pptx','packages/javascript/src/pagination.ts','packages/javascript/src/chart-marks.ts','packages/javascript/src/chart-layer.ts','packages/render/src/charts.js','packages/gallery/catalog','packages/render/test/golden','.github','pnpm-lock.yaml','pnpm-workspace.yaml'];
assert.equal(git(['diff','--name-only',receipt.baselineHead,receipt.runtimeHead,'--',...protectedPaths]).toString().trim(),'');
const metadata=json(raw.get('raw/metadata/sh26-docs-check.exit.json.gz'));assert.equal(metadata.exitCode,0);assert.equal(metadata.source,receipt.runtimeHead);
const item=p=>json(raw.get(`raw/sh26-tie-baseline/${p}.gz`));
const mapped=item('mapped.exit.json');assert.equal(mapped.exitCode,1);assert.equal(mapped.head,receipt.runtimeHead);assert.equal(mapped.clean,true);
for(const name of['text-recovery.exit.json','script-width-recovery.exit.json']){const result=item(name);assert.equal(result.exitCode,0);assert.equal(result.head,receipt.runtimeHead);assert.equal(result.clean,true);}
const core=raw.get('raw/check-changed/tests_opf.log.gz').toString();
assert.match(core,/pass 4223/);assert.match(core,/fail 2/);assert.match(core,/script-corpora.json/);assert.match(core,/composition goldens/);
assert.equal([...core.matchAll(/^✔.*(?:equal fit failures retain|default pagination fits|whole-block continuation fits|strictly fewer fit failures|equal fit failures without|mixed fallback composition)/gm)].length,21);
const before=raw.get('raw/sh26-tie-baseline/regression-before-corrected.log.gz').toString();assert.equal([...before.split('✖ failing tests:')[0].matchAll(/^✖.*equal fit failures retain/gm)].length,6);
const audit=item('venn5long-audit.json');assert.equal(audit.source.head,receipt.baselineHead);assert.equal(audit.inputLabelCount,35);assert.equal(audit.outputLabelCount,35);assert.equal(audit.exactLabelValuesAndOrder,true);assert.deepEqual(audit.pages.map(p=>p.labels.length),[14,7,7,7]);
const render=json(raw.get('render/render-receipt.json.gz'));assert.equal(render.source,receipt.runtimeHead);assert.equal(render.files.length,9);
console.log(JSON.stringify({verified:true,runtime:receipt.runtimeHead,files:receipt.evidence.length,rawBytes:total,aggregate:'Original mapped RED retained; same-source sparse recovery PASS; managed golden refresh required',receiptSHA256:sha(read('evidence.json'))}));

