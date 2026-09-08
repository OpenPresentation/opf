import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const pkg=path.join(root,'packages/cli'),out=path.join(root,'artifacts/cli');
const temp=await mkdtemp(path.join(tmpdir(),'opf-cli-installed-'));
function run(command,args,cwd,env={}) {
 const result=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,...env},timeout:120000});
 assert.equal(result.status,0,result.stderr||result.stdout);return result.stdout;
}
try {
 await mkdir(out,{recursive:true});
 run('pnpm',['build'],pkg);
 const packed=JSON.parse(run('npm',['pack','--json','--ignore-scripts','--pack-destination',out,'--cache','/tmp/opf-npm-cache'],pkg))[0];
 const tarball=path.join(out,packed.filename);
 // Install globally into an isolated prefix, offline, with no workspace links or dependencies.
 run('npm',['install','--global','--prefix',temp,'--offline','--ignore-scripts','--no-audit','--no-fund','--cache','/tmp/opf-npm-cache',tarball],temp);
 const manifest=JSON.parse(await readFile(path.join(temp,'lib/node_modules/@openpresentation/cli/package.json'),'utf8'));
 assert.ok(!manifest.private);assert.equal(Object.keys(manifest.dependencies??{}).length,0);
 const bin=path.join(temp,'bin/opf');
 assert.ok(JSON.parse(run(bin,['create','-','--title','Installed binary'],temp)).slides.length);
 const richDeck={slides:[{table:{columns:[['Rich ',{text:'header',bold:true}]],rows:[[[{text:'Cell',italic:true}]]]}}]};
 const richFile=path.join(temp,'rich-table.opf.json');await writeFile(richFile,JSON.stringify(richDeck));
 run(bin,['validate',richFile],temp);
 const output=run(process.execPath,[path.join(pkg,'test/cli.mjs')],temp,{OPF_TEST_BIN:bin});
 console.log(output.trim());console.log(`Standalone global installation passed. Tarball: ${tarball}`);
}finally{await rm(temp,{recursive:true,force:true});}
