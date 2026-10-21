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
 // RR-70: a removed package export is breaking. The version bump acknowledges it, or before the bump a pending `changed`
 // fragment that names the removed specifier exactly.
 const manifest=(version,exports)=>write("packages/javascript/package.json",{name:"@openpresentation/opf",version,exports});
 manifest("0.2.0",{".":{},"./node":{},"./node/engine":{}});
 git("add",".");git("commit","-qm","Exports");git("tag","opf-v0.2.0");writeFileSync(path.join(root,"README.md"),"after the tag\n");git("add",".");git("commit","-qm","After the tag");
 manifest("0.2.0",{".":{}});
 const removed=run(process.execPath,["scripts/check-breaking-changes.mjs"]);
 assert.equal(removed.status,1,removed.stdout+removed.stderr);assert.match(removed.stderr,/\[export removed\] @openpresentation\/opf\/node \(/);assert.match(removed.stderr,/@openpresentation\/opf\/node\/engine/);
 mkdirSync(path.join(root,"changes"));
 const fragment=(type,text)=>writeFileSync(path.join(root,"changes","rr-70.md"),`---\ntype: ${type}\npackages: [opf, cli]\n---\n${text}\n`);
 fragment("changed","Removed `@openpresentation/opf/node`: import the root.");
 const partly=run(process.execPath,["scripts/check-breaking-changes.mjs"]);
 assert.equal(partly.status,1,"a fragment naming /node does not acknowledge /node/engine");assert.match(partly.stderr,/opf\/node\/engine/);
 fragment("added","Removed `@openpresentation/opf/node` and `@openpresentation/opf/node/engine`.");
 assert.equal(run(process.execPath,["scripts/check-breaking-changes.mjs"]).status,1,"only a changed fragment acknowledges a removal");
 fragment("changed","Removed `@openpresentation/opf/node` and `@openpresentation/opf/node/engine`.");
 const named=run(process.execPath,["scripts/check-breaking-changes.mjs"]);
 assert.equal(named.status,0,named.stdout+named.stderr);assert.match(named.stdout,/"acknowledgedBy": "changelog-fragment"/);
 rmSync(path.join(root,"changes"),{recursive:true});manifest("0.3.0",{".":{}});
 const bumped=run(process.execPath,["scripts/check-breaking-changes.mjs"]);assert.equal(bumped.status,0,bumped.stdout+bumped.stderr);
 // RR-78: a record that moved from spec/catalogs to packages/gallery/catalog is not removed; one that is gone is.
 mkdirSync(path.join(root,"spec/catalogs/tones"),{recursive:true});write("spec/catalogs/tones/formal.json",{id:"formal"});write("spec/catalogs/tones/casual.json",{id:"casual"});
 git("add",".");git("commit","-qm","Records");git("tag","opf-v0.3.0");writeFileSync(path.join(root,"README.md"),"records tagged\n");git("add",".");git("commit","-qm","After the records");
 rmSync(path.join(root,"spec/catalogs"),{recursive:true});mkdirSync(path.join(root,"packages/gallery/catalog/tones"),{recursive:true});write("packages/gallery/catalog/tones/formal.json",{id:"formal"});
 const moved=run(process.execPath,["scripts/check-breaking-changes.mjs"]);
 assert.equal(moved.status,1,moved.stdout+moved.stderr);assert.match(moved.stdout+moved.stderr,/\[record removed\] tones\/casual/);assert.doesNotMatch(moved.stdout+moved.stderr,/tones\/formal/);
 write("packages/gallery/catalog/tones/casual.json",{id:"casual"});
 const kept=run(process.execPath,["scripts/check-breaking-changes.mjs"]);assert.equal(kept.status,0,kept.stdout+kept.stderr);
 // MR-35: tags created after the monorepo import are `vX.Y.Z` and carry packages/gallery/catalog (kebab-case kind directories).
 // The newest release tag of either family is the baseline, by version; a prerelease and a `gallery-v*` tag are not baselines.
 const record=(kind,id)=>{mkdirSync(path.join(root,"packages/gallery/catalog",kind),{recursive:true});write(`packages/gallery/catalog/${kind}/${id}.json`,{id});};
 record("layouts","hero");record("color-schemes","cool-horizon");record("tones","formal");manifest("0.26.0",{".":{}});
 git("add",".");git("commit","-qm","Import");git("tag","v0.26.0");git("tag","gallery-v9.0.0");writeFileSync(path.join(root,"README.md"),"after the import\n");git("add",".");git("commit","-qm","After the import");
 const shared=run(process.execPath,["scripts/check-breaking-changes.mjs"]);assert.equal(shared.status,0,shared.stdout+shared.stderr);assert.match(shared.stdout,/"tag": "v0.26.0"/,"v0.26.0 outranks opf-v0.3.0 and gallery-v9.0.0 is no baseline");
 rmSync(path.join(root,"packages/gallery/catalog/layouts/hero.json"));rmSync(path.join(root,"packages/gallery/catalog/color-schemes/cool-horizon.json"));
 const gone=run(process.execPath,["scripts/check-breaking-changes.mjs"]);
 assert.equal(gone.status,1,gone.stdout+gone.stderr);assert.match(gone.stderr,/\[record removed\] layouts\/hero \(packages\/gallery\/catalog\/layouts\/hero\.json existed at v0\.26\.0/);assert.match(gone.stderr,/color-schemes\/cool-horizon/);assert.doesNotMatch(gone.stderr,/tones\/formal/);
 mkdirSync(path.join(root,"changes"),{recursive:true});
 const gallery=(front)=>writeFileSync(path.join(root,"changes","mr-35-gallery.md"),`---\ntype: changed\n${front}\n---\nRemoved layouts.\n`);
 gallery('packages: [gallery]\ndrawing: ["layouts:hero"]');
 const partlyDeclared=run(process.execPath,["scripts/check-breaking-changes.mjs"]);assert.equal(partlyDeclared.status,1,"a fragment declaring only layouts:hero leaves colorSchemes:cool-horizon unacknowledged");assert.match(partlyDeclared.stderr,/color-schemes\/cool-horizon/);assert.doesNotMatch(partlyDeclared.stderr,/\[record removed\] layouts\/hero/);
 gallery('packages: [opf]\ndrawing: ["layouts:hero", "colorSchemes:cool-horizon"]');
 assert.equal(run(process.execPath,["scripts/check-breaking-changes.mjs"]).status,1,"a fragment that does not name the gallery declares nothing");
 gallery('packages: [gallery]\ndrawing: ["layouts:hero", "colorSchemes:cool-horizon"]');
 const declared=run(process.execPath,["scripts/check-breaking-changes.mjs"]);assert.equal(declared.status,0,declared.stdout+declared.stderr);
 assert.match(declared.stdout,/"acknowledgedBy": "changelog-fragment"/);assert.deepEqual(JSON.parse(declared.stdout.slice(declared.stdout.indexOf("{"))).removedRecords.sort(),["colorSchemes:cool-horizon","layouts:hero"]);assert.match(declared.stderr,/\[record removed\] colorSchemes:cool-horizon \(changes\/mr-35-gallery\.md\)/);
 rmSync(path.join(root,"changes"),{recursive:true});
 manifest("0.26.1",{".":{}});assert.equal(run(process.execPath,["scripts/check-breaking-changes.mjs"]).status,1,"a patch bump does not acknowledge a removed record id");
 manifest("0.27.0",{".":{}});const minor=run(process.execPath,["scripts/check-breaking-changes.mjs"]);assert.equal(minor.status,0,minor.stdout+minor.stderr);
 git("add",".");git("commit","-qm","Remove records");git("tag","v0.27.0-rc.0");writeFileSync(path.join(root,"README.md"),"after the canary\n");git("add",".");git("commit","-qm","After the canary");
 record("layouts","hero");record("color-schemes","cool-horizon");manifest("0.26.1",{".":{}});
 const canary=run(process.execPath,["scripts/check-breaking-changes.mjs"]);assert.equal(canary.status,0,canary.stdout+canary.stderr);assert.match(canary.stdout,/"tag": "v0.26.0"/,"the rc tag is no baseline, so v0.26.0 still is");
 // An untracked or generated catalog (no tag has records) is a no-op: the check compares with the tag's own listing.
 console.log("Release gate regression passed: a tag at HEAD cannot hide removals from the prior release; a removed package export needs the bump or a changed fragment naming it.");
}finally{rmSync(root,{recursive:true,force:true});}
