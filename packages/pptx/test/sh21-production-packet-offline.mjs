import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'opf-sh21-production-guard-'));
const sentinel=path.join(temporary,'earlier-proof.txt');fs.writeFileSync(sentinel,'Keep the original acceptance packet unchanged.');
try{
  const before=fs.readFileSync(sentinel);
  const script=fileURLToPath(new URL('../../../tools/shapes/sh-21/build-production-witnesses.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script,temporary],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Supply a fresh output directory/);
  assert.deepEqual(fs.readdirSync(temporary),['earlier-proof.txt']);assert.deepEqual(fs.readFileSync(sentinel),before);
  console.log('SH21 production packet refuses an existing output directory and preserves its original bytes.');
}finally{
  const base=path.resolve(os.tmpdir())+path.sep,target=path.resolve(temporary);
  assert.ok(target.startsWith(base)&&path.basename(target).startsWith('opf-sh21-production-guard-'),'cleanup stays inside this owned temporary directory');
  fs.rmSync(target,{recursive:true});
}
