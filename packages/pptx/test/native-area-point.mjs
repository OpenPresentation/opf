// 2026-11-13: the PowerShell 5 child gets 60 s, as its sibling control tests do; 30 s timed out starting PowerShell on a loaded Windows runner.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanPowerShellSource} from './powershell-scan.mjs';
const worker=new URL('native-furniture-control.ps1',import.meta.url),checker=new URL('native-area-point-controls.ps1',import.meta.url),source=readFileSync(worker,'utf8');
for(const file of [worker,checker])assert.deepEqual(scanPowerShellSource(readFileSync(file,'utf8')).issues,[]);
assert.match(source,/function Read-FurnitureAreaValue/,'actual native value getter is required');assert.doesNotMatch(source,/\$(?:Series|series)\.Values\s*=/,'never write native values');assert.match(source,/withinFourPixels=\(\$distance -le 4\)/,'unchanged four-pixel criterion');
const area=source.split('elseif($chartType -in @(1,76,77)) {')[1]?.split("elseif($Action.chartKind -ne 'marker')")[0];assert.ok(area);assert.doesNotMatch(area,/\$Action\.valueSign/,'area must not trust serialized source sign');assert.match(area,/Read-FurnitureAreaValue/);
if(process.platform==='win32'){
 const artifacts=fileURLToPath(new URL('../../../artifacts/',import.meta.url));mkdirSync(artifacts,{recursive:true});const out=mkdtempSync(path.join(artifacts,'native-area-')),report=path.join(out,'report.json'),env={...process.env};for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];
 const result=spawnSync(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(checker),'-ScriptPath',fileURLToPath(worker),'-ReportPath',report],{encoding:'utf8',windowsHide:true,env,timeout:60000});assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);const data=JSON.parse(readFileSync(report,'utf8').replace(/^\uFEFF/,''));assert.equal(data.passed,true);assert.equal(data.officeConstructed,false);assert.equal(data.valuesWritten,false);assert.equal(data.chartDataRead,false);assert.equal(data.cases.length,58);assert.equal(data.cases.filter(c=>c.name.startsWith('actual-')).length,30);assert.equal(new Set(data.cases.map(c=>c.name)).size,58);assert.ok(data.cases.every(c=>c.passed));console.log(result.stdout.trim());
}else console.log('Area probe source policy passed; PowerShell5 native-only mocks run on Windows.');
