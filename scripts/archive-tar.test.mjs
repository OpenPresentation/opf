import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {tar,tarInvocation} from './archive-tar.mjs';

test('Windows font cache and checkout on different drives never pass a remote archive or backslash destination',()=>{
  const invocation=tarInvocation('C:\\Users\\Runner\\Temp\\fonts\\emoji.tgz','-xzf',['-C','D:\\a\\opf-editor\\node_modules\\.opf-link-stage'],path.win32);
  assert.deepEqual(invocation,{cwd:'C:\\Users\\Runner\\Temp\\fonts',args:['-xzf','emoji.tgz','-C','D:/a/opf-editor/node_modules/.opf-link-stage']});
});
test('Windows same-drive extraction keeps relative destination with spaces',()=>{
  assert.deepEqual(tarInvocation('D:\\font cache\\emoji.tgz','-xzf',['-C','D:\\checkout space\\stage'],path.win32),{cwd:'D:\\font cache',args:['-xzf','emoji.tgz','-C','../checkout space/stage']});
});
test('real font archive extraction preserves bytes and leaves the cached archive reusable',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'opf-tar-test-'));
  try{
    const source=path.join(root,'font source'),destination=path.join(root,'node modules','stage'),archive=path.join(root,'emoji.tgz');
    mkdirSync(path.join(source,'package'),{recursive:true});mkdirSync(destination,{recursive:true});
    const bytes=Buffer.from([0,255,42,10,13,128]);writeFileSync(path.join(source,'package','font.ttf'),bytes);
    tar(archive,'-czf',['-C',source,'package']);
    const packed=readFileSync(archive);tar(archive,'-xzf',['-C',destination]);
    assert.deepEqual(readFileSync(path.join(destination,'package','font.ttf')),bytes);assert.deepEqual(readFileSync(archive),packed);
  }finally{rmSync(root,{recursive:true,force:true});}
});
