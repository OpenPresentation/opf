import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gateOutputDirectory} from '../../../tools/shapes/sh-20/output-path.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),artifacts=path.join(root,'artifacts');mkdirSync(artifacts,{recursive:true});const tmp=mkdtempSync(path.join(artifacts,'gate-output-')),input=path.join(tmp,'sealed'),existing=path.join(tmp,'old-output');mkdirSync(input);mkdirSync(existing);mkdirSync(path.join(input,'ppt'));writeFileSync(path.join(input,'ppt','probe.json'),'DO NOT READ THIS AS A PROBE');
for(const dir of [input,existing])for(const name of ['gate.json','gate.md'])writeFileSync(path.join(dir,name),'KEEP '+name);
const file=path.join(tmp,'existing-file');writeFileSync(file,'KEEP FILE');const alias=path.join(tmp,'alias');symlinkSync(input,alias,process.platform==='win32'?'junction':'dir');
const cases=[['omitted-output',undefined,/explicit fresh/],['same-input',input,/outside/],['inside-input',path.join(input,'new'),/outside/],['existing-output',existing,/already exists/],['existing-file',file,/already exists/],['aliased-input',path.join(alias,'new'),/inside/],['missing-parent',path.join(tmp,'missing','new'),/existing parent/]];
for(const [name,output,message]of cases){assert.throws(()=>gateOutputDirectory(input,output),message,name);for(const [tool,args]of [['gate.mjs',[input,...(output?[output]:[])]],['final-domain-report.mjs',[input,path.join(input,'gate.json'),...(output?[output]:[])]]]){const run=spawnSync(process.execPath,[path.join(root,'tools/shapes/sh-20',tool),...args],{encoding:'utf8',timeout:15000,windowsHide:true});assert.notEqual(run.status,0,name);assert.match(run.stderr,message,name+': refuses before trying to parse the invalid probe');assert.doesNotMatch(run.stderr,/Unexpected token|JSON\.parse/,name+': did not read score inputs');}}
for(const dir of [input,existing])for(const name of ['gate.json','gate.md'])assert.equal(readFileSync(path.join(dir,name),'utf8'),'KEEP '+name);assert.equal(readFileSync(file,'utf8'),'KEEP FILE');assert.equal(existsSync(path.join(input,'new')),false);assert.equal(existsSync(path.join(tmp,'missing')),false);
const fresh=path.join(tmp,'fresh');assert.equal(gateOutputDirectory(input,fresh),fresh);assert.equal(existsSync(fresh),false,'valid preflight itself writes nothing');
console.log('SH20 gate outputs:14CLI/7pure refusals preserve input/previous receipts; fresh outside preflight writes nothing.');
