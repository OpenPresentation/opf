import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {stageBootstrapPackage,verifyBootstrapInstallation} from '../scripts/bootstrap-artifacts.mjs';
import {bootstrapInvocation} from '../scripts/bootstrap-command.mjs';
const run=(command,args,cwd)=>{const invocation=bootstrapInvocation(command,args);return execFileSync(invocation.command,invocation.args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});};
const tar=(file,flags,args=[],options={})=>execFileSync('tar',[flags,path.basename(file),...args],{cwd:path.dirname(file),encoding:'utf8',...options});
test('three development tarballs preserve versions/runtime and share exact core/gallery',()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'gallery-artifacts-')));
 try{
  const originals={gallery:{name:'@openpresentation/gallery',version:'2.0.0',type:'module',exports:{'.':'./dist/index.js','./package.json':'./package.json'},files:['dist']},core:{name:'@openpresentation/opf',version:'0.19.0-next.0',type:'module',exports:{'.':'./dist/index.js','./package.json':'./package.json'},files:['dist'],dependencies:{'@openpresentation/gallery':'^1.0.0'},peerDependencies:{'@openpresentation/opf-render':'^0.19.0'},peerDependenciesMeta:{'@openpresentation/opf-render':{optional:true}}},render:{name:'@openpresentation/opf-render',version:'0.18.2',type:'module',exports:{'.':'./dist/index.js','./package.json':'./package.json'},files:['dist'],dependencies:{'@openpresentation/opf':'^0.18.4'}}};
  const paths=Object.fromEntries(Object.entries(originals).map(([name,item])=>[item.name,path.join(root,`${item.name.slice(1).replace('/','-')}-${item.version}.tgz`)]));
  const artifacts=[];
  for(const [name,original]of Object.entries(originals)){
   const directory=path.join(root,'source',name);mkdirSync(path.join(directory,'dist'),{recursive:true});writeFileSync(path.join(directory,'dist/index.js'),'export const exactRuntime = true;\n');for(const file of ['README.md','LICENSE'])writeFileSync(path.join(directory,file),'fixture\n');writeFileSync(path.join(directory,'package.json'),JSON.stringify(original)+'\n');
   const staged=structuredClone(original);if(name==='core'){staged.dependencies['@openpresentation/gallery']=`file:${paths['@openpresentation/gallery']}`;staged.peerDependencies['@openpresentation/opf-render']='^0.18.2';}if(name==='render')staged.dependencies['@openpresentation/opf']=`file:${paths['@openpresentation/opf']}`;
   const sourceBytes=readFileSync(path.join(directory,'package.json'));
   const artifact=stageBootstrapPackage({directory,temporary:root,original,staged,sourceSha:'a'.repeat(40),run,tar});assert.deepEqual(readFileSync(path.join(directory,'package.json')),sourceBytes);assert.equal(artifact.version,original.version);artifacts.push(artifact);
  }
  const consumer=path.join(root,'consumer');mkdirSync(consumer);writeFileSync(path.join(consumer,'package.json'),JSON.stringify({name:'@openpresentation/gallery',version:'2.0.0',private:true}));
  run('npm',['install','--no-save','--package-lock=false',...artifacts.map(item=>item.file)],consumer);
  for(const artifact of artifacts)verifyBootstrapInstallation(path.join(consumer,'node_modules',artifact.name),artifact);
  const modules=path.join(consumer,'node_modules'),core=path.join(modules,'@openpresentation/opf/package.json'),render=path.join(modules,'@openpresentation/opf-render/package.json'),gallery=path.join(modules,'@openpresentation/gallery/package.json');assert.equal(createRequire(render).resolve('@openpresentation/opf/package.json'),core);for(const entry of [core,render])assert.equal(createRequire(entry).resolve('@openpresentation/gallery/package.json'),gallery);
  const installed=path.join(modules,'@openpresentation/opf');writeFileSync(path.join(installed,'dist/index.js'),'tampered');assert.throws(()=>verifyBootstrapInstallation(installed,artifacts[1]),/bytes changed/);
  const invalid={...artifacts[0],version:'3.0.0'};assert.throws(()=>verifyBootstrapInstallation(path.join(modules,'@openpresentation/gallery'),invalid));
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('canonical temporary root permits an aliased parent but rejects aliased source children',()=>{
 const parent=realpathSync(mkdtempSync(path.join(tmpdir(),'gallery-alias-')));
 try{
  const actual=path.join(parent,'actual'),alias=path.join(parent,'alias');mkdirSync(actual);
  symlinkSync(actual,alias,process.platform==='win32'?'junction':'dir');
  const source=readFileSync(new URL('../scripts/bootstrap-engines.mjs',import.meta.url),'utf8');
  const expression=source.match(/const temporary = (realpathSync\(mkdtempSync\(path\.join\(tmpdir\(\), 'gallery-engines-'\)\)\));/);
  assert.ok(expression,'bootstrap must canonicalize its created temporary root');
  const temporary=Function('realpathSync','mkdtempSync','path','tmpdir',`return ${expression[1]}`)(realpathSync,mkdtempSync,path,()=>alias);
  assert.equal(temporary,realpathSync(temporary));assert.ok(temporary.startsWith(actual+path.sep));
  const directory=path.join(temporary,'source');mkdirSync(path.join(directory,'dist'),{recursive:true});
  const original={name:'@openpresentation/gallery',version:'3.0.0',files:['dist']};
  writeFileSync(path.join(directory,'package.json'),JSON.stringify(original));for(const file of ['README.md','LICENSE'])writeFileSync(path.join(directory,file),'fixture');
  writeFileSync(path.join(directory,'dist/index.js'),'export const exact = true;');
  const options={directory,temporary,original,staged:original,sourceSha:'a'.repeat(40),run,tar};
  const artifact=stageBootstrapPackage(options);assert.equal(artifact.version,'3.0.0');
  const external=path.join(temporary,'external');mkdirSync(external);writeFileSync(path.join(external,'child.js'),'outside');
  symlinkSync(external,path.join(directory,'dist/linked'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>stageBootstrapPackage(options),/aliased bootstrap file/);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
