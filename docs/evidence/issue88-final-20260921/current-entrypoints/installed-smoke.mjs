import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,readdirSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const consumer=realpathSync(process.argv[2]??'/private/tmp/opf-registry-20260921/consumer');
assert.match(process.version,/^v24\./);
assert.ok(!process.env.NODE_OPTIONS, 'Run without a source-alias loader.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireConsumer=createRequire(path.join(consumer,'package.json'));
const versions={opf:'0.11.0','opf-render':'0.9.0','opf-editor':'0.8.0','opf-pptx':'0.9.1',cli:'0.9.0'};
const manifests={};
for(const [n,v] of Object.entries(versions)){
  const file=realpathSync(requireConsumer.resolve(`@openpresentation/${n}/package.json`));
  assert.ok(file.startsWith(consumer+'/node_modules/'));
  const manifest=JSON.parse(readFileSync(file));assert.equal(manifest.version,v);
  manifests[n]={file,sha256:hash(readFileSync(file)),manifest};
}
// Evaluate ESM resolution inside the installed consumer so Node applies the
// public package export map with import conditions (core is ESM-only).
const publicEntries=['@openpresentation/opf-editor','@openpresentation/opf-editor/layout',
  '@openpresentation/opf/composition','@openpresentation/opf-editor/canvas',
  '@openpresentation/opf-editor/schema-inspector'];
const resolverSource=`const entries=JSON.parse(process.argv[1]); console.log(JSON.stringify(Object.fromEntries(entries.map(spec=>[spec,import.meta.resolve(spec)]))));`;
const resolved=JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',resolverSource,JSON.stringify(publicEntries)],{cwd:consumer,encoding:'utf8'}));
const resolution={};
for(const spec of publicEntries){
  const file=realpathSync(fileURLToPath(resolved[spec]));
  assert.ok(file.startsWith(consumer+'/node_modules/'),`Resolved outside installed consumer: ${spec}`);
  resolution[spec]={url:resolved[spec],file,sha256:hash(readFileSync(file))};
}
const {createEditorSession}=await import(resolved['@openpresentation/opf-editor']);
const {prepareBlockInsert,prepareBlockDuplicate,prepareBlockRemove,createContentBlock,listBlockContainers}=await import(resolved['@openpresentation/opf-editor/layout']);
const {colorContrast,textColorForFill}=await import(resolved['@openpresentation/opf/composition']);
const {createCanvasEditor}=await import(resolved['@openpresentation/opf-editor/canvas']);
const {createSchemaInspector}=await import(resolved['@openpresentation/opf-editor/schema-inspector']);
assert.equal(typeof createCanvasEditor,'function');assert.equal(typeof createSchemaInspector,'function');
const original={name:'Keep metadata',slides:[{id:'a',title:'Keep title',notes:'Keep notes',text:[{text:'Keep rich',bold:true}]}]};
const editor=createEditorSession(original,{rejectInvalid:true});
const prepared=prepareBlockInsert(editor.document,listBlockContainers(editor.document,{includeImplicit:true})[0].path,createContentBlock('table'));
assert.ok(prepared.patches.some(p=>p.op==='test'));editor.applyPatch(prepared.patches,{rejectInvalid:true});
assert.equal(editor.document.slides[0].blocks.length,2);assert.deepEqual(editor.document.slides[0].blocks[0].text,original.slides[0].text);assert.equal(editor.document.slides[0].notes,'Keep notes');
editor.undo();assert.deepEqual(editor.document,original);editor.redo();
const inserted=structuredClone(editor.document);editor.applyPatch(prepareBlockDuplicate(editor.document,'/slides/0/blocks/1').patches,{rejectInvalid:true});assert.equal(editor.document.slides[0].blocks.length,3);
editor.applyPatch(prepareBlockRemove(editor.document,'/slides/0/blocks/2').patches,{rejectInvalid:true});assert.deepEqual(editor.document,inserted);
const stale=prepareBlockRemove(editor.document,'/slides/0/blocks/1');editor.set('slides.0.title','Newer title');assert.throws(()=>editor.applyPatch(stale.patches,{rejectInvalid:true}));assert.equal(editor.document.slides[0].title,'Newer title');
assert.equal(colorContrast('#000','#fff'),21);assert.equal(colorContrast('#000','#ffffff80'),undefined);assert.equal(textColorForFill('#fff','#eeeeee'),'#000000');assert.equal(textColorForFill('#fff','#111111'),'#111111');
const cliManifest=manifests.cli;assert.equal(typeof cliManifest.manifest.bin.opf,'string');
const cli=realpathSync(path.resolve(path.dirname(cliManifest.file),cliManifest.manifest.bin.opf));
assert.ok(cli.startsWith(path.dirname(cliManifest.file)+path.sep),'CLI bin must remain inside the installed package.');
const cliBin={manifest:cliManifest.file,declaredPath:cliManifest.manifest.bin.opf,file:cli,sha256:hash(readFileSync(cli))};
const cwd=mkdtempSync('/private/tmp/opf-current-skills-');const run=(...args)=>execFileSync(process.execPath,[cli,...args],{cwd,encoding:'utf8'});
const version=run('--version');assert.match(version,/0\.9\.0/);assert.match(version,/0\.11\.0/);
const install=run('skills','install');const skills=readdirSync(path.join(cwd,'.agents/skills')).filter(n=>n.startsWith('opf-'));assert.equal(skills.length,6);
const status=run('skills','status');const repeat=run('skills','install');
assert.equal(JSON.parse(install).changed.length,6);
assert.ok(JSON.parse(status).skills.every(skill=>skill.status==='managed'&&skill.installedVersion==='0.9.0'&&!skill.updateAvailable));
assert.deepEqual(JSON.parse(repeat).changed,[]);assert.equal(JSON.parse(repeat).unchanged.length,6);
run('create','deck.opf.json','--title','Local authored deck');const validation=JSON.parse(run('validate','deck.opf.json'));assert.equal(validation.valid,true);
const help=run('--help');for(const command of ['create','validate','edit','skills'])assert.match(help,new RegExp('opf '+command));
console.log(JSON.stringify({status:'passed',checkedAt:new Date().toISOString(),node:process.version,versions,consumer,verifierSha256:hash(readFileSync(fileURLToPath(import.meta.url))),resolver:{method:'Node ESM import.meta.resolve in installed consumer cwd',source:resolverSource,sha256:hash(resolverSource)},lockSha256:hash(readFileSync(path.join(consumer,'package-lock.json'))),packageManifests:Object.fromEntries(Object.entries(manifests).map(([name,{file,sha256}])=>[name,{file,sha256}])),resolution,cliBin,skillsDirectory:cwd,checks:['published canvas/schema exports','block insert/duplicate/remove guards','rich content and metadata preservation','undo/redo','stale patch rejection','opaque contrast/translucent fallback','CLI version/create/validate','six installed skills/status/idempotent reinstall'],version,install,statusOutput:status,repeat},null,2));
