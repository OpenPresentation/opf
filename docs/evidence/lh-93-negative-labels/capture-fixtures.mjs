// Run the maintained fixture generator unchanged except retaining each exact archive for a reviewed part comparison.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=process.argv[2],runtimeSource=process.argv[3];assert.ok(out&&runtimeSource);await fs.mkdir(out,{recursive:true});
const generator=await fs.readFile(path.join(root,'packages/pptx/test/fixtures/chartex-fallback-main.mjs.txt'),'utf8'),anchor='  entries[name] = {sha256:';assert.ok(generator.includes(anchor));const augmented=generator.replace(anchor,"  writeFileSync(process.argv[3] + '/' + name + '.pptx', bytes);\n"+anchor);
const log=execFileSync(process.execPath,['--input-type=module','-',path.join(out,'generated.json'),out],{cwd:path.join(root,'packages/pptx/test'),input:augmented,encoding:'utf8'});await fs.writeFile(path.join(out,'generator.log'),log);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),actual=await fs.readFile(path.join(root,'packages/pptx/src/index.js')),expected=execFileSync('git',['-C',root,'show',runtimeSource+':packages/pptx/src/index.js']);assert.equal(hash(actual),hash(expected));await fs.writeFile(path.join(out,'runtime.json'),JSON.stringify({runtimeProductCommit:runtimeSource,nativeIndexSha256:hash(actual),generatorSha256:hash(generator),generatorLocation:'packages/pptx/test/fixtures/chartex-fallback-main.mjs.txt',instrumentation:'Only retained the exact bytes immediately before each maintained entries[name] hash; generator metadata and calculations unchanged. The raw generated HEAD stamp is retained, with this explicit runtime source/blob receipt.'},null,2)+'\n');console.log(log);
