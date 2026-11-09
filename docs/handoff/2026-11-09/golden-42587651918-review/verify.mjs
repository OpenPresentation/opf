import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {sha,zipEntries,bodyObservation} from './read-only.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=name=>readFileSync(path.join(root,name));const json=name=>JSON.parse(read(name));
const manifest=json('pair-manifest.json'),inventory=json('artifact-inventory.json'),observations=json('pixel-body-observations.json');
assert.equal(manifest.neverMerge,true);assert.equal(manifest.scope.visualAcceptance,false);
for(const binding of json('baseline-bindings.json')){const bytes=read(binding.local);assert.equal(bytes.length,binding.bytes);assert.equal(sha(bytes),binding.sha256);}
for(const receipt of json('download-receipts-raw.json')){const gzip=read(receipt.transport);assert.equal(gzip.length,receipt.transportBytes);assert.equal(sha(gzip),receipt.transportSha256);const raw=gunzipSync(gzip);assert.equal(raw.length,receipt.rawBytes);assert.equal(sha(raw),receipt.rawSha256);assert.deepEqual(JSON.parse(raw),json(receipt.path));}
for(const name of ['initial-raw-files.json','recovery-raw-files.json','final-raw-files.json']){let files;try{files=json('checks/'+name);}catch(error){if(name==='final-raw-files.json'&&error.code==='ENOENT')continue;throw error;}for(const f of files){const gzip=read('checks/'+f.transport);assert.equal(gzip.length,f.transportBytes);assert.equal(sha(gzip),f.transportSha256);const raw=gunzipSync(gzip);assert.equal(raw.length,f.rawBytes);assert.equal(sha(raw),f.rawSha256);}}
const proof=json('source-proof.json');for(const tree of Object.values(proof.trees))assert.equal(tree.actual,tree.expected);assert.equal(proof.base,manifest.bot);
const qualification=json('checks/qualification.json');assert.equal(qualification.initial.exitCode,1);assert.equal(qualification.narrowTextRecovery.exitCode,0);assert.equal(qualification.final.exitCode,0);assert.equal(qualification.final.packageTestsSelected.length,0);
const archives=new Map();
for(const archive of manifest.archives){const raw=read(archive.path);assert.equal(raw.length,archive.bytes);assert.equal(sha(raw),archive.sha256);const entries=zipEntries(raw);archives.set(archive.run,entries);const actual=[...entries].map(([member,bytes])=>({member,bytes:bytes.length,sha256:sha(bytes)}));assert.deepEqual(actual,inventory[archive.run]);}
const old=archives.get('42498350968'),current=archives.get('42587651918');assert.equal(old.size,186);assert.equal(current.size,74);
const before=json('before-template-baseline.json'),after=json('after-template-baseline.json');
assert.deepEqual(JSON.parse(old.get('templates/candidate.json')),before);assert.deepEqual(JSON.parse(current.get('templates/candidate.json')),after);
const keys=JSON.parse(current.get('templates/diff.json')).changedSlides;assert.deepEqual(keys,manifest.pairs.map(x=>x.key));
for(const pair of manifest.pairs)for(const [side,archive,baseline] of [['before',old,before],['after',current,after]]){const value=pair[side],bytes=archive.get(value.archiveMember);assert(bytes,pair.key);assert.equal(sha(bytes),value.sha256);assert.equal(bytes.length,value.bytes);assert.deepEqual(value.expected,baseline.entries[pair.key]);assert.equal(value.sha256,value.expected.png);assert.deepEqual(bodyObservation(bytes),observations.pairs[pair.index][side]);assert(bodyObservation(bytes).brightPixels>0,'body contains visible bright pixels');}
const removed=Object.keys(before.entries).filter(k=>!after.entries[k]);assert.deepEqual(removed,manifest.removed.map(x=>x.key));assert.equal(removed.length,3);assert.equal(Object.keys(after.entries).filter(k=>!before.entries[k]).length,0);
for(const item of manifest.removed){const bytes=old.get(item.before.archiveMember);assert.equal(sha(bytes),item.before.sha256);assert.deepEqual(item.before.expected,before.entries[item.key]);}
const coreBefore=json('before-core-baseline.json'),coreAfter=json('after-core-baseline.json');assert.equal(Object.keys(coreBefore).length,480);assert.equal(Object.keys(coreAfter).length,480);assert.deepEqual(Object.keys(coreBefore),Object.keys(coreAfter));
const changed=Object.keys(coreAfter).filter(k=>JSON.stringify(coreBefore[k])!==JSON.stringify(coreAfter[k])).map(key=>({key,before:coreBefore[key],after:coreAfter[key]}));assert.deepEqual(changed,manifest.changedCore);assert.equal(changed.length,10);
const patch=current.get('golden.patch').toString();const paths=[...patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map(x=>{assert.equal(x[1],x[2]);return x[1];});assert.deepEqual(paths,['packages/javascript/test/fixtures/template-goldens-0.19.json','packages/render/test/golden/layout-templates-rr96-color-variants.json']);
assert.deepEqual(JSON.parse(current.get('diff.json')),manifest.examples);assert.equal(manifest.examples.changedSlides.length,0);assert.equal(manifest.examples.changedDecks.length,0);
console.log('PASS: both original ZIP identities and260CRC-verifiedmembers; all67before/current PNGpairs+3removedkeys;480corekeys/10changes; exact2-filepatch; noexamples changed. Pixelbody checks prove only nonblank bright content, not words/type/design/native acceptance.');