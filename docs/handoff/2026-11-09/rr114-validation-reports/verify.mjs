import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const {unzipSync}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const parse=b=>JSON.parse(Buffer.from(b).toString('utf8').replace(/^\uFEFF/,'')),sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=parse(readFileSync(path.join(here,'receipt.json'))),git=(...a)=>execFileSync('git',['-C',root,...a],{encoding:'utf8'}).trim();
assert.equal(git('status','--porcelain'),'','clean checkpoint required');assert.equal(git('rev-parse',receipt.source+'^{tree}'),receipt.tree);
for(const item of receipt.files)for(const ref of[receipt.source,'HEAD'])assert.equal(git('rev-parse',ref+':'+item.path),item.blob,item.path);
for(const item of receipt.protectedObjects)for(const ref of[receipt.base,receipt.source,'HEAD'])assert.equal(git('rev-parse',ref+':'+item.path),item.object,item.path);
for(const name of git('diff','--name-only',receipt.source,'HEAD').split('\n').filter(Boolean))assert.ok(name.startsWith('docs/handoff/2026-11-09/rr114-validation-reports/')||name==='docs/programs/release-readiness/burndown.md',name);
const zip=readFileSync(path.join(here,receipt.raw.path));assert.equal(zip.length,receipt.raw.bytes);assert.equal(sha(zip),receipt.raw.sha256);const raw=unzipSync(zip);assert.equal(Object.keys(raw).length,receipt.raw.members);let decoded=0;
for(const item of receipt.raw.files){assert.ok(!item.path.startsWith('/')&&!item.path.split('/').includes('..'));assert.ok(raw[item.path],item.path);assert.equal(raw[item.path].length,item.bytes);assert.equal(sha(raw[item.path]),item.sha256);decoded+=item.bytes;}assert.equal(decoded,receipt.raw.decodedBytes);
const text=p=>Buffer.from(raw[p]).toString('utf8');for(const item of receipt.outcomes){assert.ok(raw[item.log]);assert.equal(parse(raw[item.exit]).exitCode,item.exitCode,item.log);}
const binding=parse(raw['source-binding.json']);assert.equal(binding.source,receipt.source);assert.equal(binding.tree,receipt.tree);assert.equal(binding.platform,'win32');assert.equal(binding.pnpm,'10.33.2');
for(const item of binding.sourceFiles){assert.equal(sha(raw['qualified-source/'+item.path]),item.sha256);assert.equal(Buffer.from(raw['qualified-source/'+item.path]).toString().replace(/\r\n/g,'\n'),execFileSync('git',['-C',root,'show',receipt.source+':'+item.path],{encoding:'utf8'}).replace(/\r\n/g,'\n'),item.path);}
const baseline=parse(raw['baseline-probe.json']),candidate=parse(raw['candidate-probe.json']);assert.equal(baseline.length,3);assert.equal(candidate.length,3);
for(let i=0;i<3;i++){const before=baseline[i],after=candidate[i];assert.deepEqual(after.input,before.input);assert.equal(before.cli.status,2);assert.equal(parse(before.cli.stderr).code,'internal-error');assert.equal(before.mcp.error.name,'OPFRenderError');assert.equal(before.mcp.error.code,'invalid-opf');assert.equal(before.mcp.error.hasReport,true);assert.equal(before.mcp.error.report.valid,false);assert.equal(after.cli.status,1);assert.equal(after.cli.stderr,'');const cli=parse(after.cli.stdout);assert.equal(cli.valid,false);assert.ok(cli.counts.error>0);assert.equal(after.mcp.report.valid,false);assert.deepEqual(after.mcp.report.findings,cli.findings);assert.ok(cli.findings.some(f=>f.location?.line>=1));}
assert.match(text('focused-01.log'),/pass\s+8/);assert.match(text('existing-cli.log'),/pass\s+14/);assert.match(text('existing-mcp-validation.log'),/pass\s+4/);assert.match(text('focused-01.log'),/actual MCP stdio tool/);assert.match(text('focused-01.log'),/actual renderer class\/report/);assert.equal(receipt.acceptance.fullMapped,false);assert.equal(receipt.acceptance.ci,false);assert.equal(receipt.acceptance.native,false);assert.equal(receipt.acceptance.release,false);
console.log(`PASS validation boundary evidence: ${receipt.raw.members} lossless records/${decoded} bytes; exact3-source baseline errors→canonical reports; 8new+14CLI+4selectedMCP groups; ${receipt.protectedObjects.length} protected production objects. Combined mapped/CI/native gates remain separate.`);
