import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const read=name=>readFileSync(new URL(name,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const r=JSON.parse(read('receipt.json')),files=JSON.parse(read('files.json')),bytes=read('raw.zip');
const {unzipSync}=createRequire(new URL('../../../../packages/pptx/package.json',import.meta.url))('fflate');
assert.equal(bytes.length,r.raw.bytes);assert.equal(sha(bytes),r.raw.sha256);
const entries=unzipSync(bytes);assert.equal(files.length,r.raw.entries);assert.deepEqual(Object.keys(entries).sort(),files.map(f=>f.path).sort());
for(const f of files){assert.equal(entries[f.path].length,f.bytes,f.path);assert.equal(sha(entries[f.path]),f.sha256,f.path);}
const parse=name=>JSON.parse(Buffer.from(entries[name]).toString());
const s=parse('recovered-suite.json'),i=parse('recovery-inventory.json');
assert.equal(entries['recovered-suite.json'].length,r.suite.bytes);assert.equal(sha(entries['recovered-suite.json']),r.suite.sha256);
assert.equal(s.provenance.suiteRepository.revision,r.testedSource);assert.equal(s.provenance.suiteRepository.dirty,false);
assert.equal(s.cases.length,59);assert.equal(s.files.length,339);assert.equal(s.chartModes.cases.length,30);assert.ok(s.chartModes.cases.every(c=>c.input&&!c.rejected));
assert.equal(i.files.length,340);assert.equal(i.genericStructurallyEligible,53);assert.deepEqual(i.ineligible,r.ineligible);
for(const f of s.files)assert.deepEqual(i.files.find(row=>row.path===f.path),f);
assert.deepEqual(s.cases.map(c=>c.id),i.cases.map(c=>c.id));
for(const expected of [r,i,s.provenance]){assert.equal(expected.nativeAcceptance,false);assert.equal(expected.registryAcceptance,false);}
const repo=fileURLToPath(new URL('../../../../',import.meta.url));
const git=args=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
for(const o of r.protectedObjects){assert.equal(git(['rev-parse','HEAD:'+o.path]),o.current,o.path);assert.equal(o.current,o.baseline,o.path);}
assert.equal(git(['rev-parse','HEAD:scripts/native-acceptance']),git(['rev-parse',r.testedSource+':scripts/native-acceptance']));
assert.equal(s.provenance.chartBaselines.current.path,'packages/pptx/test/fixtures/chartex-fallback-main.json');
assert.equal(s.provenance.chartBaselines.historicalNative.path,'scripts/native-acceptance/fixtures/chartex-fallback-main.json');
for(const name of ['mapped-delta-02.exit.json','recovery-gallery-tracker-01.exit.json','recovery-text-01.exit.json','prepare-recovery-01.exit.json'])assert.equal(parse(name).status,0,name);
assert.equal(parse('mapped-01.exit.json').status,1);assert.ok(r.checks.original.status.startsWith('RED'));
console.log('PASS:47 lossless raw records;59/339 exact seal; six exclusions; protected source; original failures and bounded recovery; no native acceptance');
