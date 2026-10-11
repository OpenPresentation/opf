// Builds and stages the explicitly authorized local graph. No source manifests or locks are edited.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,realpathSync,lstatSync,rmSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {galleryConfiguration,readRegularJson,verifyGalleryCheckout,galleryMetadataDigests} from './candidate-gallery.mjs';
import {stageGalleryGraph} from './candidate-gallery-pack.mjs';
import {packageManagerInvocation} from './package-manager.mjs';
const root=realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')),workspace=path.dirname(root);
const candidate=galleryConfiguration(readRegularJson(path.join(root,'packages/javascript/package.json')),readRegularJson(path.join(root,'.github/candidate-gallery.json')));
assert.equal(process.env.CANDIDATE_GALLERY_REF,candidate?.sha,'build requires an authorized exact gallery SHA');
assert.ok(candidate);
const gallery=path.join(workspace,'gallery-candidate');verifyGalleryCheckout(gallery,candidate);
const run=(command,args,cwd=root)=>{
 if(command==='npm'||command==='pnpm')({command,args}=packageManagerInvocation(command,args));
 if(command==='node')command=process.execPath;
 const result=spawnSync(command,args,{cwd,stdio:'inherit'});
 if(result.error)throw result.error;assert.equal(result.status,0,`${command} ${args.join(' ')} failed`);
};
run('pnpm',['build']);run('node',['scripts/link-ecosystem.mjs','--packages-only']);
const before=galleryMetadataDigests(gallery),parent=path.join(gallery,'node_modules/@openpresentation');mkdirSync(parent,{recursive:true});assert.equal(realpathSync(parent),parent,'aliased gallery package parent');
for(const [name,source] of [['opf',path.join(root,'packages/javascript')],['opf-render',path.join(workspace,'opf-render')]]){
 const target=path.join(parent,name);assert.ok(lstatSync(target).isDirectory()||lstatSync(target).isSymbolicLink(),'unexpected gallery development package');
 rmSync(target,{recursive:true,force:true});symlinkSync(source,target,process.platform==='win32'?'junction':'dir');
}
for(const script of ['test','typecheck','verify','check:license','check:previews'])run('npm',['run',script],gallery);
assert.deepEqual(galleryMetadataDigests(gallery),before,'gallery qualification changed source metadata');
const report=stageGalleryGraph({coreRoot:root,workspace,out:path.join(root,'artifacts/npm')});
console.log(JSON.stringify(report,null,2));
