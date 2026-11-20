import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),sha=b=>createHash('sha256').update(b).digest('hex');
const protectedPaths=['scripts/native-acceptance/reference-chart-worker.ps1','packages/pptx/test/native-process.ps1'];
function protectedBytes(){return protectedPaths.map(name=>({name,sha256:sha(fs.readFileSync(path.join(root,name)))}));}
test('reference postflight retains unchanged worker, ce92 supervisor, fixed worker timeout and seven-file identity boundary',()=>{
 for(const name of protectedPaths)assert.equal(sha(fs.readFileSync(path.join(root,name))),sha(execFileSync('git',['show',`b5a57bc86aba4de3e1ea28dcc38e47cfb46827f1:${name}`],{cwd:root})));
 const wrapper=fs.readFileSync(path.join(root,'scripts/native-acceptance/run-reference-chart-profile.ps1'),'utf8');
 assert.match(wrapper,/\[int\]\$TimeoutSeconds=45/);assert.match(wrapper,/Invoke-OpfNativeWorker[^\r\n]+-TimeoutSeconds \$TimeoutSeconds/);
 assert(wrapper.indexOf("source/runtime identity differs before postflight")<wrapper.indexOf('$postflight=Invoke-ReferenceWitnessPostflight'));
 assert.match(wrapper,/\$budget=5000;\$interval=100;\$maxQueries=51/);
});
test('AST-only managed postflight completion/fault controls never activate Office or query real processes',{skip:process.platform!=='win32'},()=>{
 const before=protectedBytes(),base=path.join(root,'artifacts/reference-postflight');fs.mkdirSync(base,{recursive:true});const out=fs.mkdtempSync(path.join(base,'managed-')),report=path.join(out,'report.json');
 const child=spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/native-acceptance/reference-postflight-self-test.ps1'),'-Wrapper',path.join(root,'scripts/native-acceptance/run-reference-chart-profile.ps1'),'-Output',report],{cwd:root,env:windowsPowerShellEnvironment(process.env),windowsHide:true,encoding:'utf8',timeout:20000});
 fs.writeFileSync(path.join(out,'stdout.log'),child.stdout??'');fs.writeFileSync(path.join(out,'stderr.log'),child.stderr??'');fs.writeFileSync(path.join(out,'exit.json'),JSON.stringify({status:child.status,signal:child.signal,error:child.error?.message??null,managedOnly:true,officeActivated:false},null,2)+'\n');
 assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);const value=JSON.parse(fs.readFileSync(report,'utf8').replace(/^\uFEFF/,''));assert.equal(value.status,'PASS');assert.equal(value.officeActivated,false);assert.equal(value.processQueriesAreInjected,true);assert(value.tests>=30);assert.deepEqual(protectedBytes(),before);
 console.log(JSON.stringify({managedReport:path.relative(root,report),controls:value.tests,protected:before}));
});
