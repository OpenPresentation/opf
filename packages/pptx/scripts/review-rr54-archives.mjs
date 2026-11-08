#!/usr/bin/env node
// Produce a review candidate, never overwrite the locked fixture. Review the changed ZIP parts and native sheets before copying it.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const options={};
for(let i=0;i<process.argv.slice(2).length;i+=2){const [key,value]=process.argv.slice(2).slice(i,i+2);if(!['--baseline','--candidate','--out','--baseline-export-ref'].includes(key)||!value)throw Error('usage: review-rr54-archives.mjs --baseline DIR --candidate DIR --out FRESH_DIR --baseline-export-ref SHA');options[key.slice(2)]=value;}
for(const key of ['baseline','candidate','out','baseline-export-ref'])if(!options[key])throw Error('Missing --'+key);
const baselineRoot=path.resolve(options.baseline),candidateRoot=path.resolve(options.candidate),out=path.resolve(options.out);
if(existsSync(out))throw Error('Preserve previous evidence: choose a fresh output directory.');
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
const baselineHead=git(baselineRoot,'rev-parse','HEAD'),candidateHead=git(candidateRoot,'rev-parse','HEAD');
const sourcePaths=['packages/javascript','packages/gallery','packages/render','packages/pptx','spec'];
git(baselineRoot,'diff','--exit-code',options['baseline-export-ref'],baselineHead,'--',...sourcePaths);
git(baselineRoot,'diff','--exit-code','HEAD','--',...sourcePaths);
const fixturePath=path.join(candidateRoot,'packages/pptx/test/fixtures/rr-54-unchanged.json');
const fixture=JSON.parse(readFileSync(fixturePath,'utf8')),next=structuredClone(fixture);
const baseline=await import(pathToFileURL(path.join(baselineRoot,'packages/pptx/dist/index.js')));
const candidate=await import(pathToFileURL(path.join(candidateRoot,'packages/pptx/dist/index.js')));
const {unzipSync,strFromU8}=createRequire(path.join(candidateRoot,'packages/pptx/package.json'))('fflate');
const sha=data=>createHash('sha256').update(data).digest('hex');
const nativeHash=parts=>sha(JSON.stringify(Object.entries(parts).filter(([file])=>/^ppt\/slides\/slide\d+\.xml$/.test(file)).map(([file,data])=>[file,strFromU8(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g,'')])));
const rows=[];
mkdirSync(out,{recursive:true});
for(const [name,entry]of Object.entries(fixture.entries)){
 assert.match(name,/^[a-z0-9-]+$/);
 const oldBytes=new Uint8Array(await baseline.toPptx(structuredClone(entry.deck))),newBytes=new Uint8Array(await candidate.toPptx(structuredClone(entry.deck)));
 const oldParts=unzipSync(oldBytes),newParts=unzipSync(newBytes);
 assert.equal(sha(oldBytes),entry.sha256,name+': reproduce locked baseline bytes');
 assert.equal(oldBytes.length,entry.rr20Bytes,name+': reproduce baseline size');
 assert.equal(Object.keys(oldParts).length,entry.rr20PartCount,name+': reproduce baseline part inventory');
 if(entry.nativeSlideSha256)assert.equal(nativeHash(oldParts),entry.nativeSlideSha256,name+': reproduce native-slide lock');
 const changedParts=[...new Set([...Object.keys(oldParts),...Object.keys(newParts)])].filter(file=>!oldParts[file]||!newParts[file]||!Buffer.from(oldParts[file]).equals(Buffer.from(newParts[file])));
 const row={name,baseline:sha(oldBytes),candidate:sha(newBytes),baselineBytes:oldBytes.length,candidateBytes:newBytes.length,baselineParts:Object.keys(oldParts).length,candidateParts:Object.keys(newParts).length,changedParts};
 rows.push(row);
 if(!changedParts.length)continue;
 const directory=path.join(out,name);mkdirSync(directory);
 writeFileSync(path.join(directory,'before.pptx'),oldBytes);writeFileSync(path.join(directory,'after.pptx'),newBytes);
 for(const file of changedParts){const leaf=file.replace(/[\\/]/g,'__');if(oldParts[file])writeFileSync(path.join(directory,leaf+'.before'),oldParts[file]);if(newParts[file])writeFileSync(path.join(directory,leaf+'.after'),newParts[file]);}
 const updated=next.entries[name];
 updated.rr105033Previous={sha256:entry.sha256,bytes:entry.rr20Bytes,partCount:entry.rr20PartCount,...(entry.nativeSlideSha256?{nativeSlideSha256:entry.nativeSlideSha256}:{})};
 updated.sha256=row.candidate;updated.rr20Bytes=row.candidateBytes;updated.rr20PartCount=row.candidateParts;
 if(entry.nativeSlideSha256)updated.nativeSlideSha256=nativeHash(newParts);
}
const review={baselineHead,baselineExportRef:options['baseline-export-ref'],candidateHead,scope:'Exact bare toPptx caller; every old archive hash, byte length, part count and applicable native-slide digest reproduced before generating a review candidate.',entries:rows};
next.source.rr105033ArchiveReview={baselineExportRef:options['baseline-export-ref'],baselineBuildHead:baselineHead,candidateHead,evidence:'docs/evidence/rr105-033-archive-review/review.json',scope:'Reviewed v0.33 default bar labels, doughnut hole, scatter axes and histogram/waterfall scales; all other archives and embedded workbooks remain byte-identical.'};
writeFileSync(path.join(out,'review.json'),JSON.stringify(review,null,2)+'\n');
writeFileSync(path.join(out,'candidate-fixture.json'),JSON.stringify(next,null,2)+'\n');
console.log(`${rows.length} exact baselines reproduced; ${rows.filter(row=>row.changedParts.length).length} archive candidates require review. Locked fixture unchanged.`);
