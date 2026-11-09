import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {moduleHashes,transformForPreflight,runtimeSource} from './diagnostic-loader.mjs';
const[runtime,output]=process.argv.slice(2);
assert.equal(process.argv.length,4);
assert.ok(!existsSync(output),'fresh preflight output');
mkdirSync(output,{recursive:false});
const own=path.dirname(fileURLToPath(import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={schema:1,scope:'Syntax/hash/unique-anchor preflight only. No renderer imported or executed; no fonts loaded; no measured children.',started:new Date().toISOString(),node:process.version,runtimeSource,status:'RUNNING',files:[],modules:[]};
try{
  receipt.head=execFileSync('git',['-C',runtime,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  receipt.tree=execFileSync('git',['-C',runtime,'rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
  for(const file of ['diagnostic-loader.mjs','diagnostic-case.mjs','run-diagnostic.mjs','preflight.mjs']){
    const bytes=readFileSync(path.join(own,file)),check=spawnSync(process.execPath,['--check',path.join(own,file)],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
    receipt.files.push({file,bytes:bytes.length,sha256:sha(bytes),exitCode:check.status,stdout:check.stdout,stderr:check.stderr,error:check.error?.message});
    assert.equal(check.status,0,'syntax '+file);
  }
  for(const[file,expected]of Object.entries(moduleHashes)){
    const bytes=readFileSync(path.join(runtime,'packages/render/src',file));
    const item={file,bytes:bytes.length,sha256:sha(bytes),expected};receipt.modules.push(item);
    assert.equal(item.sha256,expected,'source module '+file);
    const transformed=transformForPreflight(file,bytes.toString('utf8'));
    item.anchors=transformed.anchors;item.transformedSha256=sha(transformed.source);
    const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:transformed.source,encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
    Object.assign(item,{syntaxExitCode:check.status,stdout:check.stdout,stderr:check.stderr,error:check.error?.message});
    assert.equal(check.status,0,'transformed syntax '+file);
  }
  receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.failure=error.stack??String(error);process.exitCode=1;}
receipt.finished=new Date().toISOString();
writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,files:receipt.files.length,modules:receipt.modules.length,output}));
