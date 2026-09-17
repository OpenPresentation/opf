import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
const root=mkdtempSync(path.join(tmpdir(),"opf-breaking-"));
const run=(command,args)=>spawnSync(command,args,{cwd:root,encoding:"utf8"});
function git(...args){const result=run("git",args);assert.equal(result.status,0,result.stderr);}
function write(file,value){writeFileSync(path.join(root,file),JSON.stringify(value));}
try{
 for(const dir of ["scripts","packages/javascript","spec/schemas","spec/catalogs"])mkdirSync(path.join(root,dir),{recursive:true});
 copyFileSync(new URL("./check-breaking-changes.mjs",import.meta.url),path.join(root,"scripts/check-breaking-changes.mjs"));
 write("package.json",{type:"module"});write("packages/javascript/package.json",{version:"0.1.0"});
 write("spec/schemas/example.schema.json",{properties:{mode:{enum:["a","b"]}}});
 git("init","-q");git("config","user.name","OPF test");git("config","user.email","test@example.invalid");git("add",".");git("commit","-qm","Baseline");git("tag","opf-v0.1.0");
 write("packages/javascript/package.json",{version:"0.1.1"});write("spec/schemas/example.schema.json",{properties:{mode:{enum:["a"]}}});
 git("add",".");git("commit","-qm","Unacknowledged removal");git("tag","opf-v0.1.1");
 const rejected=run(process.execPath,["scripts/check-breaking-changes.mjs"]);
 assert.equal(rejected.status,1,rejected.stdout+rejected.stderr);assert.match(rejected.stdout+rejected.stderr,/opf-v0.1.0/);
 write("packages/javascript/package.json",{version:"0.2.0"});
 const accepted=run(process.execPath,["scripts/check-breaking-changes.mjs"]);assert.equal(accepted.status,0,accepted.stdout+accepted.stderr);
 console.log("Release gate regression passed: a tag at HEAD cannot hide removals from the prior release.");
}finally{rmSync(root,{recursive:true,force:true});}
