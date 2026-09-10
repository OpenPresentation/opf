import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),npmCli=process.env.npm_execpath;
assert.ok(npmCli?.endsWith('npm-cli.js'),'Run with npm run test:packed');
const temporary=await mkdtemp(path.join(tmpdir(),'opf-render-packed-'));
const actualTemporary=await realpath(temporary),temporaryParent=await realpath(tmpdir());
const npm=(args,cwd)=>execFileSync(process.execPath,[npmCli,...args],{cwd,encoding:'utf8',maxBuffer:8*1024*1024});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
  const packed=JSON.parse(npm(['pack','--json','--pack-destination',temporary],root))[0];
  const consumer=path.join(temporary,'consumer');await mkdir(consumer);
  await writeFile(path.join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
  npm(['install','--ignore-scripts','--no-fund','--no-audit',path.join(temporary,packed.filename)],consumer);
  const installed=path.join(consumer,'node_modules/@openpresentation/opf-render');
  const manifest=JSON.parse(await readFile(path.join(installed,'package.json'),'utf8'));
  assert.equal(manifest.version,JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version);
  const files={};
  for(const {path:file} of packed.files){
    assert.ok(!path.isAbsolute(file)&&!file.split(/[/\\]/).includes('..'));
    const bytes=await readFile(path.join(installed,file));
    assert.equal(hash(bytes),hash(await readFile(path.join(root,file))),`Installed package file differs: ${file}`);
    files[file]=hash(bytes);
  }
  for(const entry of ['dist/index.js','dist/svg.js','dist/fonts-node.js','dist/fonts-browser.js','dist/svg.d.ts','LICENSE'])assert.ok(files[entry],`Missing public entry: ${entry}`);
  const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
  const core=lock.packages['node_modules/@openpresentation/opf'];
  assert.ok(core.resolved.startsWith('https://registry.npmjs.org/')&&core.integrity.startsWith('sha512-')&&!core.link);
  const actualCore=await realpath(path.join(consumer,'node_modules/@openpresentation/opf'));
  assert.ok(actualCore.startsWith((await realpath(path.join(consumer,'node_modules')))+path.sep),'Core must be installed inside the clean consumer');
  for(const file of ['shared-quote.mjs','quote-footer.mjs']){
    const source=(await readFile(path.join(root,'test',file),'utf8'))
      .replaceAll("'../dist/svg.js'","'@openpresentation/opf-render/svg'")
      .replaceAll("'../dist/fonts-node.js'","'@openpresentation/opf-render/fonts-node'");
    await writeFile(path.join(consumer,file),source);
    process.stdout.write(execFileSync(process.execPath,[file],{cwd:consumer,encoding:'utf8'}));
  }
  const audit=JSON.parse(npm(['audit','--json'],consumer));
  assert.equal(audit.metadata.vulnerabilities.total,0);
  const signatures=npm(['audit','signatures'],consumer);process.stdout.write(signatures);
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeFile(path.join(root,`artifacts/packed-consumer-node${process.versions.node.split('.')[0]}.json`),JSON.stringify({
    node:process.version,package:manifest.name,version:manifest.version,integrity:packed.integrity,
    core:{version:core.version,resolved:core.resolved,integrity:core.integrity},files,knownVulnerabilities:0,
    boundary:'Clean installed candidate with registry core, byte-matched shipped files and Node quote regressions. Browser glyph tests run separately; this is not native raster equivalence or renderer registry publication.',
  },null,2)+'\n');
  console.log(`Packed renderer passed: ${Object.keys(files).length} byte-matched files; registry core ${core.version}; ${packed.integrity}`);
}finally{
  const actual=await realpath(temporary),relative=path.relative(temporaryParent,actual);
  assert.equal(actual,actualTemporary);assert.ok(relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Cleanup must stay inside its temporary parent');
  await rm(temporary,{recursive:true,force:true});
}
