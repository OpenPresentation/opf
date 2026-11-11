import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
const [repo, ref] = process.argv.slice(2);
assert.ok(repo && /^[a-f0-9]{40}$/.test(ref));
const base = 'f435a338973a1956025a6bc46f9fbd6ef28c4cc2';
const prefix = 'docs/handoff/2026-11-08/rr105-baseline-qa/';
const git = args => execFileSync('git', ['-C', repo, ...args], {maxBuffer:32*1024*1024});
const blob = (path, at=ref) => git(['cat-file','blob',at+':'+path]);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = JSON.parse(blob(prefix+'git-blob-verification.json'));
for (const file of report.files) {
 const bytes=blob(file.path);
 assert.equal(bytes.length,file.gitBytes,file.path+' length');
 assert.equal(hash(bytes),file.gitSha256,file.path+' hash');
}
const changed = git(['diff','--name-only',base,ref]).toString('utf8').trim().split('\n').sort();
assert.deepEqual(changed,[...report.files.map(f=>f.path),prefix+'git-blob-verification.json'].sort(),'Declared changed-file coverage');
const packageChanges = git(['diff','--name-only',base,ref,'--','packages','spec','scripts','examples']).toString('utf8').trim().split('\n').sort();
const expectedTests=['packages/pptx/test/rr-105-native-body-wrap.mjs','packages/pptx/test/sh21-venn-reading-measure.mjs','packages/pptx/test/template-layouts.mjs'];
assert.deepEqual(packageChanges,expectedTests,'No production/schema/catalog/fixture/golden/tooling change');
for (const file of expectedTests) assert.deepEqual(blob(file),blob(file,report.testedSourceCommit),file+' exact tested source');
const archive = blob(prefix+'qualification.zip');
assert.equal(hash(archive),'db1d133daf072d815315994c11b35cc39ee5f45e415ca585821459a95a7f1519');
const {unzipSync}=createRequire(repo+'/packages/pptx/package.json')('fflate');
const members=unzipSync(archive), inventory=JSON.parse(blob(prefix+'qualification.files.json')).files;
assert.equal(inventory.length,99);
assert.deepEqual(Object.keys(members).sort(),inventory.map(f=>f.path).sort());
for(const file of inventory) { const bytes=members[file.path];assert.equal(bytes.length,file.bytes,file.path);assert.equal(hash(bytes),file.sha256,file.path); }
console.log(JSON.stringify({ref,base,verifiedDeclaredBlobs:report.files.length,selfManifestGitBound:true,changedFiles:changed.length,qualifiedTestFiles:3,losslessArchiveMembers:inventory.length,allOtherPackageSchemaCatalogFixtureGoldenToolingTreesUnchanged:true,fullIntegrationAcceptance:false}));