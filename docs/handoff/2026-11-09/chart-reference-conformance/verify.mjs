import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=new URL('./',import.meta.url),root=fileURLToPath(new URL('../../../../',folder)),m=JSON.parse(readFileSync(new URL('manifest.json',folder)));
const hash=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('rev-parse',m.source+'^{tree}'),m.sourceTree);
for(const f of m.sourceFiles){assert.equal(git('rev-parse',m.source+':'+f.file),f.blob);assert.equal(git('rev-parse','HEAD:'+f.file),f.blob);assert.equal(hash(readFileSync(new URL('../../../../'+f.file,folder))),f.sha256);}
assert.deepEqual(git('diff','--name-only',m.base,m.source).split('\n').sort(),m.sourceFiles.map(f=>f.file).sort());
const gz=readFileSync(new URL(m.archive.file,folder));assert.equal(gz.length,m.archive.size);assert.equal(hash(gz),m.archive.sha256);const raw=gunzipSync(gz,{maxOutputLength:2*1024*1024});assert.equal(raw.length,m.archive.rawBytes);const p=JSON.parse(raw);assert.equal(p.format,'lh110-conformance-v1');assert.equal(p.entries.length,m.entries.length);const records=new Map();let bytes=0;
for(const[i,e]of p.entries.entries()){assert.ok(!records.has(e.name));const b=Buffer.from(e.base64,'base64');assert.equal(b.length,e.size);assert.equal(hash(b),e.sha256);const{base64,...meta}=e;assert.deepEqual(meta,m.entries[i]);bytes+=b.length;records.set(e.name,b.toString('utf8'));}assert.equal(bytes,m.archive.decodedBytes);
assert.match(records.get('chart-conformance-before-corrected-selector.log'),/native accessible text box/);assert.match(records.get('chart-conformance-before-corrected-selector.log'),/Host locale collation is forbidden/);assert.match(records.get('chart-conformance-after.log'),/pass 43/);assert.match(records.get('chart-conformance-native.log'),/148 example decks \(965 slides\)/);const d=JSON.parse(records.get('chart-conformance-determinism.log').trim());assert.equal(d.passed,true);assert.equal(d.children,45);assert.equal(d.cases,43);const o=JSON.parse(records.get('observed-exits.json'));assert.equal(o.nativeXmlConformance.actualExitCode,0);assert.equal(o.determinism.actualExitCode,0);console.log(JSON.stringify({verified:true,source:m.source,records:records.size,decodedBytes:bytes,scope:m.scope}));
