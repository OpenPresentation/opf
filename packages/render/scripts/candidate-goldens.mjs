import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,lstatSync,readdirSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readBaseline,writeBaseline} from '../test/golden-store.mjs';
export function candidatePlan({core,gallery,selection='examples',name}) {
  for(const [key,value] of Object.entries({core,gallery})) assert.match(value??'',/^[0-9a-f]{40}$/,`${key} must be an exact commit SHA`);
  assert.ok(['examples','templates','both'].includes(selection),'invalid selection');
  assert.match(name??'',/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/,'invalid baseline name');
  assert.notEqual(name,'cover-centering','preserve the published baseline');
  return {core,gallery,examples:selection!=='templates',templates:selection!=='examples',baseline:`test/golden/opf-examples-png.${name}`,template:'test/golden/layout-templates-0.19.json'};
}
export function verifyManifest(next,previous,count,template=false,source) {
  if(source)assert.deepEqual(next.source,source,'candidate source does not match selected source inputs');
  assert.match(next.source?.sha256??'',/^[0-9a-f]{64}$/,'invalid source digest');
  assert.deepEqual(Object.keys(next.source).sort(),Object.keys(previous.source).sort(),'source fields changed');
  if(template){assert.equal(next.source.templates,28);assert.ok(typeof next.source.fixture==='string'&&next.source.fixture.length>0);}else{for(const key of ['repository','path'])assert.equal(next.source[key],previous.source[key]);assert.equal(next.source.decks,new Set(Object.keys(next.entries).map(k=>k.slice(0,k.lastIndexOf('#')))).size);}
  for(const entry of Object.values(next.entries))assert.ok(Number.isSafeInteger(entry.bytes)&&entry.bytes>0,'invalid entry bytes');
  for(const key of ['version','format','scale','systemFonts',...(template?['trace']:[])]) assert.deepEqual(next[key],previous[key],`golden ${key} changed`);
  assert.equal(Object.keys(next.entries).length,count,'candidate corpus count changed');
  assert.deepEqual(Object.keys(next.entries).sort(),Object.keys(previous.entries).sort(),'candidate dropped or added cases');
  for(const entry of Object.values(next.entries)) for(const field of template?['svg','png']:['sha256']) assert.match(entry[field],/^[0-9a-f]{64}$/,'invalid hash');
}
export function verifyHead(expected,actual){assert.match(expected,/^[0-9a-f]{40}$/);assert.equal(actual,expected,'branch moved during generation');}
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function expectedSources(workspace,plan,renderer){
 const core=path.join(workspace,'opf'),gallery=path.join(workspace,'gallery-candidate'),sources={};
 for(const [directory,sha]of[[core,plan.core],[gallery,plan.gallery]])assert.equal(execFileSync('git',['-C',directory,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha,'source checkout HEAD mismatch');
 if(plan.examples){const read=(directory,prefix='')=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const file=path.posix.join(prefix,entry.name),absolute=path.join(directory,entry.name);return entry.isDirectory()?read(absolute,file):entry.isFile()&&file.endsWith('.opf.json')?[[file,canonical(readArtifact(absolute))]]:[];});const corpus=read(path.join(core,'examples')).sort(([a],[b])=>a<b?-1:a>b?1:0);sources.examples={repository:'OpenPresentation/opf',path:'examples',sha256:hash(JSON.stringify(corpus)),decks:corpus.length};}
 if(plan.templates){const fixtureText=readFileSync(path.join(renderer,'test/layout-template-fixture.mjs'),'utf8');const marker=/export const fixture = \{ source: '([^']+)', layouts: gallery.layouts \};/.exec(fixtureText)?.[1];assert.equal(marker,`gallery2 ${plan.gallery}`,'template fixture does not name selected gallery');const records=readArtifact(path.join(gallery,'catalog/layouts/index.json')).records;const layouts=Object.fromEntries(records.map(({id,file})=>{assert.ok(!file.includes('..')&&!path.isAbsolute(file),'invalid gallery record path');const record=readArtifact(path.join(gallery,'catalog/layouts',file));return[id,Object.fromEntries(Object.entries(record).filter(([key])=>key!=='$schema'&&key!=='id'&&!key.startsWith('x-')))];}));sources.templates={fixture:'@openpresentation/gallery layouts (see layout-template-fixture.mjs)',sha256:hash(JSON.stringify({source:marker,layouts})),templates:records.length};}
 return sources;
}
export function trustedTemplate(file){assert.equal(hash(readFileSync(file)),'a6102dd12a26594eb101ac6344ab4af45e71f247decaa663f3bf3be6e207ee98','template baseline differs from reviewed PR215 reference');return readArtifact(file);}
export function requireNewBaseline(root,relative){const target=safeTarget(root,relative);try{lstatSync(target);throw new Error('new example baseline already exists');}catch(error){if(error.code!=='ENOENT')throw error;}return target;}
export function regularTree(target){let stat;try{stat=lstatSync(target);}catch(error){if(error.code==='ENOENT')return;throw error;}assert.ok(!stat.isSymbolicLink(),'symlink in promotion tree');if(stat.isDirectory())for(const name of readdirSync(target))regularTree(path.join(target,name));else assert.ok(stat.isFile(),'nonregular promotion file');}
export function readArtifact(file){assert.equal(realpathSync(file),path.resolve(file),'aliased artifact path');assert.ok(lstatSync(file).isFile()&&!lstatSync(file).isSymbolicLink(),'artifact is not a regular file');return JSON.parse(readFileSync(file,'utf8'));}
export function verifyGraph(graph,plan,head,candidates){assert.deepEqual(graph,{renderer:head,core:plan.core,gallery:plan.gallery,selection:plan.examples?(plan.templates?'both':'examples'):'templates',sources:Object.fromEntries(Object.entries(candidates).map(([key,value])=>[key,value.source.sha256]))},'artifact graph differs from selected source graph');}
export function verifyGuard(candidate,expected){assert.deepEqual(candidate,expected,'unchanged main golden does not reproduce');}
export function safeTarget(root,relative){const target=path.join(realpathSync(root),relative);let current=target;while(!existsSync(current))current=path.dirname(current);assert.equal(realpathSync(current),current,'aliased promotion path');regularTree(target);return target;}
export function allowedPaths(plan,files){for(const file of files) assert.ok(!file.includes('..')&&!path.isAbsolute(file)&&((plan.examples&&file.startsWith(plan.baseline+'/'))||(plan.templates&&file===plan.template)),`unexpected promotion path ${file}`);}
export function linkSources(workspace,plan){
 const root=realpathSync(workspace),core=path.join(root,'opf'),gallery=path.join(root,'gallery-candidate'),renderer=path.join(root,'opf-render');
 for(const [dir,sha,name]of[[core,plan.core,'@openpresentation/opf'],[gallery,plan.gallery,'@openpresentation/gallery']]){assert.equal(execFileSync('git',['-C',dir,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha);assert.equal(JSON.parse(readFileSync(path.join(dir,'package.json'),'utf8')).name,name==='@openpresentation/opf'?'openpresentation-workspace':name);}
 assert.equal(JSON.parse(readFileSync(path.join(gallery,'package.json'),'utf8')).opf.catalogSchema,2);
 for(const [dir,name,target]of[[core,'gallery',gallery],[path.join(core,'packages/javascript'),'gallery',gallery],[renderer,'gallery',gallery],[renderer,'opf',path.join(core,'packages/javascript')]]){const parent=path.join(dir,'node_modules/@openpresentation');mkdirSync(parent,{recursive:true});assert.equal(realpathSync(parent),parent,'aliased package parent');const dest=path.join(parent,name);rmSync(dest,{recursive:true,force:true});symlinkSync(target,dest,process.platform==='win32'?'junction':'dir');}
}
const toolsRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [command,...args]=process.argv.slice(2);const get=k=>args[args.indexOf('--'+k)+1];const root=args.includes('--root')?path.resolve(get('root')):toolsRoot;const plan=candidatePlan({core:get('core'),gallery:get('gallery'),selection:get('selection'),name:get('name')});
 if(command==='plan'){if(args.includes('--head'))verifyHead(get('head'),get('head'));if(args.includes('--branch')){const branch=get('branch');assert.match(branch,/^[A-Za-z0-9][A-Za-z0-9._/-]*$/);assert.ok(branch!=='main'&&!branch.includes('..')&&!branch.includes('//')&&!branch.endsWith('/')&&!branch.endsWith('.lock')&&!/^(refs\/|origin\/|pull\/)/.test(branch)&&!/^[0-9a-f]{40}$/.test(branch),'invalid candidate branch');}if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,`baseline=${plan.baseline}\nexamples=${plan.examples}\ntemplates=${plan.templates}\n`,{flag:'a'});console.log(JSON.stringify(plan));}
 else if(command==='link')linkSources(get('workspace'),plan);
 else if(command==='guard')verifyGuard(readArtifact(get('candidate')),readBaseline(get('baseline')));
 else if(command==='verify'){
  const expected=expectedSources(get('workspace'),plan,root);
  if(plan.examples)verifyManifest(JSON.parse(readFileSync(path.join(root,'artifacts/golden/candidate.json'))),readBaseline(path.join(toolsRoot,'test/golden/opf-examples-png.cover-centering')),807,false,expected.examples);
  if(plan.templates)verifyManifest(JSON.parse(readFileSync(path.join(root,'artifacts/template-goldens/candidate.json'))),trustedTemplate(path.join(root,plan.template)),498,true,expected.templates);
  const candidates={};if(plan.examples)candidates.examples=readArtifact(path.join(root,'artifacts/golden/candidate.json'));if(plan.templates)candidates.templates=readArtifact(path.join(root,'artifacts/template-goldens/candidate.json'));
  const graph={renderer:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),core:plan.core,gallery:plan.gallery,selection:get('selection'),sources:Object.fromEntries(Object.entries(expected).map(([key,value])=>[key,value.sha256]))};
  writeFileSync(path.join(root,'artifacts/candidate-graph.json'),JSON.stringify(graph,null,2)+'\n');
 }else if(command==='apply'){
  verifyHead(get('head'),execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());
  assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}),'','promotion checkout must be clean');
  const expected=expectedSources(get('workspace'),plan,root);
  const artifact=get('artifact'),candidates={};if(plan.examples)candidates.examples=readArtifact(path.join(artifact,'golden/candidate.json'));if(plan.templates)candidates.templates=readArtifact(path.join(artifact,'template-goldens/candidate.json'));
  verifyGraph(readArtifact(path.join(artifact,'candidate-graph.json')),plan,get('head'),candidates);
  if(plan.examples){verifyManifest(candidates.examples,readBaseline(path.join(toolsRoot,'test/golden/opf-examples-png.cover-centering')),807,false,expected.examples);requireNewBaseline(root,plan.baseline);}
  if(plan.templates){verifyManifest(candidates.templates,trustedTemplate(path.join(root,plan.template)),498,true,expected.templates);safeTarget(root,plan.template);}
  if(plan.examples){const next=candidates.examples,previous=readBaseline(path.join(toolsRoot,'test/golden/opf-examples-png.cover-centering'));verifyManifest(next,previous,807,false,expected.examples);writeBaseline(requireNewBaseline(root,plan.baseline),next);}
  if(plan.templates){const next=candidates.templates;verifyManifest(next,trustedTemplate(path.join(root,plan.template)),498,true,expected.templates);writeFileSync(safeTarget(root,plan.template),JSON.stringify(next,null,1)+'\n');}
  const files=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean).map(line=>line.slice(3));allowedPaths(plan,files);
 }else throw Error('unknown command');
}
