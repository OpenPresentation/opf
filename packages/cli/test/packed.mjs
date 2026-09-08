import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile, realpath} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const pkg=path.join(root,'packages/cli'),out=path.join(root,'artifacts/cli');
const temp=await mkdtemp(path.join(tmpdir(),'opf-cli-installed-'));
const registry=process.argv.includes('--registry');
const expected=registry
 ? JSON.parse(await readFile(path.join(root,'release-plan.json'),'utf8')).packages.find(item=>item.name==='@openpresentation/cli')
 : JSON.parse(await readFile(path.join(pkg,'package.json'),'utf8'));
assert.ok(expected?.version,'Missing CLI version in the published release plan');
const registrySpec=`${expected.name}@${expected.version}`;
function run(command,args,cwd,env={}) {
 if(process.platform==='win32'&&(command==='npm'||command==='pnpm')){
  const entry=command==='npm'
   ? (process.env.PATH??'').split(path.delimiter).flatMap(directory=>[path.join(directory,'node_modules/npm/bin/npm-cli.js'),path.resolve(directory,'../npm/bin/npm-cli.js')]).find(existsSync)
   : (process.env.npm_execpath?.endsWith('pnpm.cjs')?process.env.npm_execpath:(process.env.PATH??'').split(path.delimiter).flatMap(directory=>[path.join(directory,'node_modules/pnpm/bin/pnpm.cjs'),path.resolve(directory,'../pnpm/bin/pnpm.cjs')]).find(existsSync));
  assert.ok(entry,`Cannot locate ${command} JavaScript entrypoint`);args=[entry,...args];command=process.execPath;
 }
 const result=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,...env},timeout:120000});
 if(result.error)throw result.error;
 assert.equal(result.status,0,result.stderr||result.stdout);return result.stdout;
}
try {
 await mkdir(out,{recursive:true});
 if(!registry)run('pnpm',['build'],pkg);
 const cache=path.join(temp,'npm-cache');
 const packed=JSON.parse(run('npm',['pack',...(registry?[registrySpec]:[]),'--json','--ignore-scripts','--pack-destination',out,'--cache',cache],pkg))[0];
 const tarball=path.join(out,packed.filename);
 // Install globally into an isolated prefix, offline, with no workspace links or dependencies.
 run('npm',['install','--global','--prefix',temp,'--offline','--ignore-scripts','--no-audit','--no-fund','--cache',cache,tarball],temp);
 const installed=path.join(temp,process.platform==='win32'?'node_modules':'lib/node_modules','@openpresentation/cli');
 const manifest=JSON.parse(await readFile(path.join(installed,'package.json'),'utf8'));
 assert.equal(manifest.version,expected.version);
 assert.ok(!manifest.private);assert.equal(Object.keys(manifest.dependencies??{}).length,0);
 const bin=path.join(installed,manifest.bin.opf);
 assert.ok(JSON.parse(run(process.execPath,[bin,'create','-','--title','Installed binary'],temp)).slides.length);
 const richDeck={slides:[{table:{columns:[['Rich ',{text:'header',bold:true}]],rows:[[[{text:'Cell',italic:true}]]]}}]};
 const richFile=path.join(temp,'rich-table.opf.json');await writeFile(richFile,JSON.stringify(richDeck));
 run(process.execPath,[bin,'validate',richFile],temp);
 await writeFile(path.join(temp,'AGENTS.md'),'Keep existing project instructions.');
 const npxResult=JSON.parse(run('npm',['exec','--yes',registry?'--prefer-online':'--offline','--ignore-scripts','--cache',cache,'--package',registry?registrySpec:tarball,'--','opf','skills','install'],temp));
 assert.equal(npxResult.changed.length,6,'npx-style offline installation must install the bundled skills');
 assert.equal(await readFile(path.join(temp,'AGENTS.md'),'utf8'),'Keep existing project instructions.');
 assert.deepEqual(JSON.parse(run(process.execPath,[bin,'skills','install'],temp)).changed,[]);
 assert.ok(JSON.parse(await readFile(path.join(temp,'.agents/skills/opf-author/assets/decision-brief.opf.json'),'utf8')).slides.length);
 let commandTests=path.join(pkg,'test/cli.mjs');
 if(registry){
  const plan=JSON.parse(await readFile(path.join(root,'release-plan.json'),'utf8'));
  assert.match(plan.verificationRefs.cli,/^[a-f0-9]{40}$/);
  commandTests=path.join(temp,'published-command-tests.mjs');
  await writeFile(commandTests,run('git',['show',`${plan.verificationRefs.cli}:packages/cli/test/cli.mjs`],root));
 }
 const output=run(process.execPath,[commandTests],temp,{OPF_TEST_BIN:bin});
 console.log(output.trim());console.log(`Standalone global and npx-style installation passed (${registry?'npm registry':'local pack'}). Integrity: ${packed.integrity}. Tarball: ${tarball}`);
}finally{
 const actual=await realpath(temp),parent=await realpath(tmpdir());
 assert.ok(actual.startsWith(parent+path.sep)&&path.basename(actual).startsWith('opf-cli-installed-'));
 await rm(actual,{recursive:true,force:true});
}
