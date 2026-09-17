import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,writeFile,cp,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {catalogs,validatePresentation} from '../packages/javascript/dist/index.js';
const root=fileURLToPath(new URL('../',import.meta.url)),skills=path.join(root,'skills'),helper=path.join(skills,'opf-inspect/scripts/opf-inspect.mjs');
const temp=await mkdtemp(path.join(tmpdir(),'opf-skills-'));
let checks=0;
function run(args,{status=0,cwd=root,script=helper,env={}}={}){
 const result=spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8',env:{...process.env,OPF_ROOT:'',...env},timeout:20000});
 assert.equal(result.status,status,result.stderr||result.stdout);checks++;
 return status===2?result:JSON.parse(result.stdout);
}
try{
 const names=(await readdir(skills)).sort();assert.equal(names.length,6);
 let exampleCount=0;
 for(const name of names){
  const files=async directory=>{for(const entry of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await files(file);else if(entry.name.endsWith('.md')){
    const text=await readFile(file,'utf8');
    for(const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
      const link=match[1];if(/^(https?:|#)/.test(link))continue;
      const resolved=path.resolve(path.dirname(file),link.split('#')[0]);
      assert.ok(resolved.startsWith(path.join(skills,name)+path.sep),`Skill reference escapes its folder: ${file} ${link}`);
      await readFile(resolved);
    }
    for(const match of text.matchAll(/```json\s*\n([\s\S]*?)```/g)){
      const value=JSON.parse(match[1]);assert.equal(validatePresentation(value).valid,true,`${file}: invalid JSON example`);exampleCount++;
    }
   }else if(entry.name.endsWith('.opf.json')){const result=validatePresentation(JSON.parse(await readFile(file,'utf8')));assert.equal(result.valid,true,JSON.stringify(result.errors));exampleCount++;}}};
  await files(path.join(skills,name));
 }
 assert.ok(exampleCount>=3);
 const version=run(['version']);assert.equal(version.package,'@openpresentation/opf');
 const schema=run(['schema','presentation','/$defs/Composition']);assert.ok(schema.value.properties.mode.enum.includes('grid'));
 const search=run(['find-schema','watermark']);assert.ok(search.matches.some(match=>match.path.endsWith('/properties/watermark')));
 const found=run(['catalog','layouts','text-2x']);assert.ok(found.records.some(record=>record.id==='text-2x'));
 assert.equal(run(['record','fontSchemes','roboto']).record.id,'roboto');
 run(['record','layouts','does-not-exist'],{status:2});run(['schema','presentation','/__proto__'],{status:2});run(['schema','presentation','/bad~9'],{status:2});run(['catalog','constructor'],{status:2});
 const source=path.join(skills,'opf-author/assets/decision-brief.opf.json');assert.equal(run(['validate',source]).valid,true);
 const invalid=path.join(temp,'invalid.json');await writeFile(invalid,JSON.stringify({slides:'not-an-array'}));assert.equal(run(['validate',invalid],{status:1}).valid,false);
 const warning=path.join(temp,'warning.json');await writeFile(warning,JSON.stringify({design:{theme:'a-theme-that-is-not-bundled'},slides:[{title:'Custom'}]}));assert.ok(run(['validate',warning]).warnings.length>0);
 const record=path.join(temp,'layout.json');await writeFile(record,JSON.stringify(catalogs.layouts[0]));assert.equal(run(['validate',record,'layouts']).valid,true);
 const broken=path.join(temp,'broken.json');await writeFile(broken,'{');run(['validate',broken],{status:2});
 const copied=path.join(temp,'installed-skill');await cp(path.join(skills,'opf-inspect'),copied,{recursive:true});
 const portable=path.join(copied,'scripts/opf-inspect.mjs');assert.equal(run(['validate',source],{cwd:temp,script:portable,env:{OPF_ROOT:root}}).valid,true);
 // A consumer resolves its installed version rather than the skill's original repository.
 const consumer=path.join(temp,'consumer');await mkdir(path.join(consumer,'node_modules/@openpresentation'),{recursive:true});await writeFile(path.join(consumer,'package.json'),'{"private":true,"type":"module"}');
 await symlink(path.join(root,'packages/javascript'),path.join(consumer,'node_modules/@openpresentation/opf'),process.platform==='win32'?'junction':'dir');
 assert.equal(run(['version'],{cwd:consumer,script:portable}).entry,version.entry);
 // A partially broken explicit installation must not fall back to a different version.
 const brokenRoot=path.join(temp,'broken-root');await mkdir(path.join(brokenRoot,'node_modules/@openpresentation/opf'),{recursive:true});
 await writeFile(path.join(brokenRoot,'node_modules/@openpresentation/opf/package.json'),JSON.stringify({name:'@openpresentation/opf',version:'0.0.0',exports:{'.':{import:'./missing.js'},'./package.json':'./package.json'}}));
 run(['version'],{cwd:root,script:portable,env:{OPF_ROOT:brokenRoot},status:2});
 console.log(`Skills passed: 6 self-contained skill folders, ${exampleCount} valid OPF examples, ${checks} helper execution checks (including portable installation).`);
}finally{await rm(temp,{recursive:true,force:true});}
