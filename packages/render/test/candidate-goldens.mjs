import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {candidatePlan,verifyManifest,verifyHead,allowedPaths,safeTarget,verifyGraph,verifyGuard,regularTree,readArtifact,requireNewBaseline,trustedTemplate} from '../scripts/candidate-goldens.mjs';
const plan=candidatePlan({core:'a'.repeat(40),gallery:'b'.repeat(40),name:'rr-83-v2',selection:'both'});
for(const core of ['main','a'.repeat(39),'A'.repeat(40),'$(id)'])assert.throws(()=>candidatePlan({...plan,core,name:'x'}));
for(const name of ['../x','x/y','cover-centering',''])assert.throws(()=>candidatePlan({...plan,name}));
assert.throws(()=>candidatePlan({...plan,name:'x',selection:'other'}));
const previous={version:2,format:'png-sha256',scale:.25,systemFonts:false,source:{repository:'OpenPresentation/opf',path:'examples',sha256:'a'.repeat(64),decks:1},entries:{'a#0':{sha256:'a'.repeat(64),bytes:1}}};
verifyManifest(previous,previous,1);
for(const next of [{...previous,scale:1},{...previous,entries:{}},{...previous,entries:{'b#0':{sha256:'b'.repeat(64)}}}])assert.throws(()=>verifyManifest(next,previous,1));
assert.throws(()=>verifyHead('a'.repeat(40),'b'.repeat(40)));verifyHead('a'.repeat(40),'a'.repeat(40));
allowedPaths(plan,[plan.baseline+'/a.sha256.json',plan.template]);
for(const file of ['package.json',plan.baseline+'/../x','/tmp/x','test/golden/other.json'])assert.throws(()=>allowedPaths(plan,[file]));
const text=readFileSync(new URL('../.github/workflows/regenerate-candidate-goldens.yml',import.meta.url),'utf8'),push=text.slice(text.indexOf('\n  push:'));
assert.doesNotMatch(push,/npm ci|npm run build|test\/golden.mjs|test\/layout-template-goldens.mjs/);
assert.match(push,/git push/);assert.match(push,/tip.*HEAD/);assert.match(text,/contents: read/);assert.match(text,/807/);assert.match(text,/498/);
console.log('Candidate goldens: immutable graph refs, fixed counts/keysets/metrics, promotion path and stale-head guards passed.');
const image=/mcr\.microsoft\.com\/playwright:\S+@sha256:[0-9a-f]{64}/.exec(readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8'))[0];
assert.equal([...text.matchAll(/mcr\.microsoft\.com\/playwright:\S+@sha256:[0-9a-f]{64}/g)].every(m=>m[0]===image),true);
assert.match(text,/default: true/);
assert.doesNotMatch(text,/opf-pptx|opf-editor/);

const temp=mkdtempSync(path.join(tmpdir(),'candidate-goldens-')),outside=mkdtempSync(path.join(tmpdir(),'candidate-outside-'));
mkdirSync(path.join(temp,'test'));symlinkSync(outside,path.join(temp,'test/golden'),process.platform==='win32'?'junction':'dir');
assert.throws(()=>safeTarget(temp,'test/golden/new-baseline'),/aliased/);

for(const next of [{...previous,source:{...previous.source,sha256:'wrong'}},{...previous,source:{...previous.source,decks:0}},{...previous,entries:{'a#0':{sha256:'a'.repeat(64),bytes:-1}}}])assert.throws(()=>verifyManifest(next,previous,1));
const graph={renderer:'c'.repeat(40),core:plan.core,gallery:plan.gallery,selection:'both',sources:{examples:previous.source.sha256}};
verifyGraph(graph,plan,'c'.repeat(40),{examples:previous});assert.throws(()=>verifyGraph({...graph,gallery:'d'.repeat(40)},plan,'c'.repeat(40),{examples:previous}));
verifyGuard(previous,previous);assert.throws(()=>verifyGuard({...previous,scale:1},previous));
const nested=mkdtempSync(path.join(tmpdir(),'candidate-nested-'));mkdirSync(path.join(nested,'gallery'));symlinkSync(outside,path.join(nested,'gallery/escape'),process.platform==='win32'?'junction':'dir');assert.throws(()=>regularTree(nested),/symlink/);
assert.throws(()=>readArtifact(path.join(nested,'gallery/escape')),/regular|aliased/);

assert.match(push,/path: tools/);assert.match(push,/tools\/scripts\/candidate-goldens.mjs/);assert.doesNotMatch(push,/node scripts\/candidate-goldens/);
assert.ok(text.indexOf('Reproduce unchanged main')<text.indexOf('Generate fixed 807'));

assert.throws(()=>verifyManifest({...previous,source:{...previous.source,sha256:'b'.repeat(64)}},previous,1,false,previous.source),/selected source/);
const dangling=path.join(nested,'dangling.json');symlinkSync(path.join(outside,'missing.json'),dangling);assert.throws(()=>regularTree(dangling),/symlink/);assert.throws(()=>safeTarget(nested,'dangling.json'),/symlink/);
const danglingNested=path.join(nested,'gallery/dangling.json');symlinkSync(path.join(outside,'missing-again.json'),danglingNested);assert.throws(()=>regularTree(path.join(nested,'gallery')),/symlink/);
const newRoot=mkdtempSync(path.join(tmpdir(),'candidate-new-'));mkdirSync(path.join(newRoot,'historical'));assert.throws(()=>requireNewBaseline(newRoot,'historical'),/already exists/);
const wrongTemplate=path.join(newRoot,'template.json');writeFileSync(wrongTemplate,JSON.stringify(previous));assert.throws(()=>trustedTemplate(wrongTemplate),/reviewed PR215/);
