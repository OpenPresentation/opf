// Verify portable evidence against the index or an immutable commit, not merely
// the current filesystem. Creation reads local files before they are staged.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../..');
const prefix=path.relative(repo,here).split(path.sep).join('/'),mode=process.argv[2]??'index';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=args=>execFileSync('git',args,{cwd:repo,maxBuffer:64*1024*1024});
const parse=bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
if(mode==='create') {
  const files=[];
  async function walk(relative='') {
    for(const entry of await readdir(path.join(here,relative),{withFileTypes:true})) {
      const name=path.posix.join(relative,entry.name);
      assert.ok(!entry.name.startsWith('~$'),'Exclude Office lock files');
      if(entry.isDirectory())await walk(name);
      else { assert.ok(entry.isFile(),'Evidence cannot contain symlinks');if(name!=='manifest.json')files.push(name); }
    }
  }
  await walk();
  const records=[];
  for(const file of files.sort()) { const bytes=await readFile(path.join(here,file));records.push({file,bytes:bytes.length,sha256:sha(bytes)}); }
  await writeFile(path.join(here,'manifest.json'),JSON.stringify({algorithm:'sha256',files:records},null,2)+'\n');
  console.log(`Manifest created for ${records.length} files. Stage it and run index verification.`);
} else {
  const ref=mode==='index'?'':git(['rev-parse','--verify',`${mode}^{commit}`]).toString().trim();
  const read=file=>git(['show',`${ref}:${prefix}/${file}`]);
  const manifest=parse(read('manifest.json'));
  const listed=(mode==='index'?git(['ls-files','-z','--cached','--',prefix]):git(['ls-tree','-rz','--name-only',ref,'--',prefix])).toString().split('\0').filter(Boolean).map(file=>file.slice(prefix.length+1)).filter(file=>file!=='manifest.json').sort();
  assert.deepEqual(listed,manifest.files.map(record=>record.file).sort(),'Manifest must cover every tracked evidence file');
  for(const record of manifest.files) {
    assert.ok(!record.file.split('/').some(part=>part==='..'||part.startsWith('~$')));
    const bytes=read(record.file);assert.equal(bytes.length,record.bytes,record.file);assert.equal(sha(bytes),record.sha256,record.file);
  }
  for(const binding of parse(read('bindings.json'))) {
    const generation=parse(read(binding.generation));
    for(const [file,expected] of Object.entries(generation.runtime)) {
      const retained=file.startsWith('test/')?`${binding.verifiers}/${path.posix.basename(file)}`:`runtime/${file}`;
      assert.equal(sha(read(retained)),expected,`${binding.generation}: ${file}`);
    }
    const directory=path.posix.dirname(binding.generation);
    if(generation.pptxSha256)assert.equal(sha(read(`${directory}/charts.pptx`)),generation.pptxSha256);
    for(const record of generation.records??[])assert.equal(sha(read(`${directory}/${record.file}`)),record.sha256);
    for(const font of generation.fonts??[])assert.equal(sha(read(`${directory}/${font.file}`)),font.sha256);
  }
  console.log(`Verified ${manifest.files.length} evidence files against ${mode==='index'?'staged Git blobs':ref}.`);
}
