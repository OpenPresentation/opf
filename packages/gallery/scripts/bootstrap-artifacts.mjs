// Development-only artifacts. Original package versions and runtime bytes never change.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function regular(file){assert.equal(realpathSync(file),path.resolve(file),'aliased bootstrap file');const stat=lstatSync(file);assert.ok(stat.isFile()||stat.isDirectory(),'nonregular bootstrap file');if(stat.isDirectory())for(const name of readdirSync(file))regular(path.join(file,name));}
export function stageBootstrapPackage({directory,temporary,original,staged,sourceSha,run,tar}){
 assert.deepEqual(JSON.parse(readFileSync(path.join(directory,'package.json'))),original,'bootstrap changed original metadata');
 assert.match(original.name,/^@openpresentation\/(opf|opf-render|gallery)$/);
 assert.equal(staged.name,original.name);assert.equal(staged.version,original.version,'bootstrap must preserve own version');assert.match(sourceSha,/^[0-9a-f]{40}$/);
 const stage=path.join(temporary,'staging',original.name.split('/')[1]);mkdirSync(stage,{recursive:true});
 for(const relative of new Set([...(original.files??['dist']),'README.md','LICENSE'])){
  assert.ok(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split(/[/\\]/).includes('..')&&!/[*?\[\]{}!]/.test(relative),'unsafe bootstrap distributable');
  const source=path.join(directory,relative);regular(source);cpSync(source,path.join(stage,relative),{recursive:true});
 }
 const stagedBytes=Buffer.from(JSON.stringify(staged,null,2)+'\n');writeFileSync(path.join(stage,'package.json'),stagedBytes);
 const packed=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',temporary],stage))[0];assert.ok(typeof packed.filename==='string'&&!/[\/\\]/.test(packed.filename)&&!packed.filename.includes('..'),'unsafe bootstrap tarball');const file=path.join(temporary,packed.filename);
 assert.ok(tar(file,'-tvzf').trim().split(/\r?\n/).every(line=>line.startsWith('-')),'bootstrap archive must contain regular files only');
 assert.deepEqual(tar(file,'-tzf').trim().split(/\r?\n/).sort(),packed.files.map(item=>`package/${item.path}`).sort());
 const files=packed.files.map(item=>{
  assert.ok(!path.isAbsolute(item.path)&&!item.path.split(/[/\\]/).includes('..'),'unsafe bootstrap archive member');
  const bytes=tar(file,'-xOzf',[`package/${item.path}`],{encoding:null});assert.deepEqual(bytes,readFileSync(path.join(stage,item.path)),'archive differs from stage');
  if(item.path!=='package.json')assert.deepEqual(bytes,readFileSync(path.join(directory,item.path)),'bootstrap changed runtime bytes');
  return {path:item.path,sha256:digest(bytes),bytes:bytes.length};
 });
 return {name:original.name,version:original.version,sourceSha,file,sha256:digest(readFileSync(file)),bytes:readFileSync(file).length,originalManifest:original,originalManifestText:readFileSync(path.join(directory,'package.json'),'utf8'),stagedManifest:staged,originalManifestSha256:digest(readFileSync(path.join(directory,'package.json'))),stagedManifestSha256:digest(stagedBytes),files};
}
export function verifyBootstrapInstallation(directory,artifact){
 assert.match(artifact.name,/^@openpresentation\/(opf|opf-render|gallery)$/);
 assert.equal(artifact.version,artifact.originalManifest.version);assert.equal(artifact.version,artifact.stagedManifest.version,'own version changed');
 assert.equal(digest(Buffer.from(artifact.originalManifestText)),artifact.originalManifestSha256);assert.deepEqual(JSON.parse(artifact.originalManifestText),artifact.originalManifest);
 assert.match(artifact.sourceSha,/^[0-9a-f]{40}$/);assert.match(artifact.sha256,/^[0-9a-f]{64}$/);

 assert.equal(realpathSync(directory),path.resolve(directory),'aliased installed bootstrap package');assert.ok(lstatSync(directory).isDirectory());assert.equal(digest(readFileSync(path.join(directory,'package.json'))),artifact.stagedManifestSha256,'installed staged metadata digest changed');assert.deepEqual(JSON.parse(readFileSync(path.join(directory,'package.json'))),artifact.stagedManifest,'installed bootstrap metadata changed');
 // Dependencies are independently resolution-checked; package's own inventory must exactly match its tarball.
 const actual=[];function walk(relative=''){for(const name of readdirSync(path.join(directory,relative)).sort()){if(name==='node_modules')continue;const child=path.join(relative,name);if(lstatSync(path.join(directory,child)).isDirectory()){assert.ok(!lstatSync(path.join(directory,child)).isSymbolicLink());walk(child);}else {regular(path.join(directory,child));actual.push(child.replaceAll(path.sep,'/'));}}}walk();
 assert.deepEqual(actual.sort(),artifact.files.map(item=>item.path).sort(),'installed bootstrap inventory changed');
 for(const file of artifact.files){assert.ok(!path.isAbsolute(file.path)&&!file.path.split(/[/\\]/).includes('..'),'unsafe bootstrap inventory');const bytes=readFileSync(path.join(directory,file.path));assert.equal(bytes.length,file.bytes,'installed bootstrap bytes changed');assert.equal(digest(bytes),file.sha256,'installed bootstrap bytes changed');}
}
