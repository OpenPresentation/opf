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
  const manifest=parse(git(['show',`${ref}:${prefix}/manifest.json`]));
  const listed=(mode==='index'?git(['ls-files','-z','--cached','--',prefix]):git(['ls-tree','-rz','--name-only',ref,'--',prefix])).toString().split('\0').filter(Boolean).map(file=>file.slice(prefix.length+1)).filter(file=>file!=='manifest.json').sort();
  assert.deepEqual(listed,manifest.files.map(record=>record.file).sort(),'Manifest must cover every tracked evidence file');
  for(const file of listed)assert.ok(!/[\r\n]/.test(file),'Evidence paths cannot contain newlines');
  // Fetch all exact Git blobs in one process. Thousands of git-show processes
  // add minutes on Windows without providing any additional verification.
  const blobs=execFileSync('git',['cat-file','--batch'],{cwd:repo,input:listed.map(file=>`${ref}:${prefix}/${file}\n`).join(''),maxBuffer:128*1024*1024});
  const retained=new Map();let offset=0;
  for(const file of listed) {
    const end=blobs.indexOf(10,offset),header=blobs.subarray(offset,end).toString();
    assert.match(header,/^[0-9a-f]+ blob \d+$/u,`${file}: expected Git blob`);
    const length=Number(header.split(' ')[2]);offset=end+1;
    retained.set(file,blobs.subarray(offset,offset+length));offset+=length;
    assert.equal(blobs[offset++],10,'Git batch separator');
  }
  assert.equal(offset,blobs.length,'Unexpected extra Git batch output');
  const read=file=>{assert.ok(retained.has(file),`Missing tracked evidence: ${file}`);return retained.get(file);};
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
    for(const deck of generation.decks??[])assert.equal(sha(read(`${directory}/${deck.id}.pptx`)),deck.pptxSha256);
  }
  console.log(`Verified ${manifest.files.length} evidence files against ${mode==='index'?'staged Git blobs':ref}.`);
}
