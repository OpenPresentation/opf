// Independent analytic native-geometry controls. No product geometry or Office object is used.
import assert from 'node:assert/strict';
import{spawnSync}from'node:child_process';
import{mkdirSync,mkdtempSync,readFileSync}from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
import{scanPowerShellSource}from'./powershell-scan.mjs';
const worker=new URL('native-furniture-control.ps1',import.meta.url),checker=new URL('native-curved-slice-controls.ps1',import.meta.url);
for(const file of[worker,checker])assert.deepEqual(scanPowerShellSource(readFileSync(file,'utf8')).issues,[]);
const source=readFileSync(worker,'utf8');assert.match(source,/nativeLocalBoundsPoints=@\(\$left,\$top,\$width,\$height\)/,'keep the endpoint box as a raw observation');assert.match(source,/withinFourPixels=\(\$distance -le 4\)/,'keep the exact four-pixel criterion');
if(process.platform==='win32'){
 const root=fileURLToPath(new URL('../../../',import.meta.url)),artifacts=path.join(root,'artifacts');mkdirSync(artifacts,{recursive:true});const out=mkdtempSync(path.join(artifacts,'curved-native-')),report=path.join(out,'report.json'),env={...process.env};for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];
 const ps=path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),result=spawnSync(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(checker),'-ScriptPath',fileURLToPath(worker),'-ReportPath',report],{encoding:'utf8',windowsHide:true,env,timeout:30000});assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);const data=JSON.parse(readFileSync(report,'utf8').replace(/^\uFEFF/,''));assert.equal(data.passed,true);assert.equal(data.officeConstructed,false);assert.equal(data.observedNativeAvailabilityClaimed,false);assert.equal(data.cases.length,26);assert.ok(data.cases.every(c=>c.passed));console.log(result.stdout.trim());
}else console.log('Independent curved-bounds source policy passed; PowerShell5 analytic controls run on Windows.');
