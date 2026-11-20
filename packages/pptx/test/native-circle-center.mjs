import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanPowerShellSource} from './powershell-scan.mjs';
const worker=new URL('native-furniture-control.ps1',import.meta.url),checker=new URL('native-circle-center-controls.ps1',import.meta.url);
for(const file of [worker,checker])assert.deepEqual(scanPowerShellSource(readFileSync(file,'utf8')).issues,[]);
const source=readFileSync(worker,'utf8');assert.match(source,/withinFourPixels=\(\$distance -le 4\)/,'same four-pixel criterion');assert.doesNotMatch(source,/\$center=\[pscustomobject\]@\{x=\$insideLeft/,'native inside plot must not stand in for ring center');assert.match(source,/currentChartPointProbe=\$null/,'retain the serialized partial-observation path');
if(process.platform==='win32'){
 const artifacts=fileURLToPath(new URL('../../../artifacts/',import.meta.url));mkdirSync(artifacts,{recursive:true});const out=mkdtempSync(path.join(artifacts,'native-circle-')),report=path.join(out,'report.json'),env={...process.env};for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];
 const result=spawnSync(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(checker),'-ScriptPath',fileURLToPath(worker),'-ReportPath',report],{encoding:'utf8',windowsHide:true,env,timeout:30000});assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);const data=JSON.parse(readFileSync(report,'utf8').replace(/^\uFEFF/,''));assert.equal(data.passed,true);assert.equal(data.officeConstructed,false);assert.equal(data.productGeometryRead,false);assert.equal(data.cases.length,20);assert.ok(data.cases.every(c=>c.passed));console.log(result.stdout.trim());
}else console.log('Native circle source controls pass; analytic PowerShell5 controls run on Windows.');
