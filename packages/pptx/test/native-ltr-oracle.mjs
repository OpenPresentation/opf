import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanPowerShellSource} from './powershell-scan.mjs';
const worker=new URL('native-furniture-control.ps1',import.meta.url),checker=new URL('native-ltr-oracle-check.ps1',import.meta.url);
for(const file of [worker,checker])assert.deepEqual(scanPowerShellSource(readFileSync(file,'utf8')).issues,[]);
const modeled=scanPowerShellSource(readFileSync(worker,'utf8')).code;
const oracle=modeled.split('function Read-FurnitureLtrRunState')[1]?.split('function Read-FurnitureFiniteNumber')[0];
assert.ok(oracle,'reviewed oracle functions exist');
assert.equal([...oracle.matchAll(/\.LtrRun\s*\(/g)].length,1,'one literal native format call');
assert.doesNotMatch(oracle,/\.(?:Select|Activate|RtlRun|Save|SaveAs|Quit|Close|Replace)\s*\(/i,'no UI, alternate method or ownership bypass');
assert.doesNotMatch(oracle,/\b(?:ActiveWindow|ActivePresentation|New-Object\s+-ComObject)\b/i);
assert.doesNotMatch(oracle,/\$(?:Range|Shape|Font)\.(?:Text|LanguageID|Name|Size|Bold|Italic|Left|Top|Width|Height|Rotation)\s*=/i,'oracle never sets observed properties');
if(process.platform==='win32'){
 const artifacts=fileURLToPath(new URL('../../../artifacts/',import.meta.url));mkdirSync(artifacts,{recursive:true});const dir=mkdtempSync(path.join(artifacts,'native-ltr-')),report=path.join(dir,'report.json'),env={...process.env};for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];
 const r=spawnSync(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',fileURLToPath(checker),'-ScriptPath',fileURLToPath(worker),'-ReportPath',report],{encoding:'utf8',windowsHide:true,env,timeout:30000});writeFileSync(path.join(dir,'stdout.log'),r.stdout??'');writeFileSync(path.join(dir,'stderr.log'),r.stderr??'');assert.equal(r.status,0,r.error?.message??r.stdout+r.stderr);const result=JSON.parse(readFileSync(report,'utf8').replace(/^\uFEFF/,''));assert.equal(result.passed,true);assert.equal(result.officeConstructed,false);assert.ok(result.cases.every(c=>c.passed));assert.equal(new Set(result.cases.map(c=>c.name)).size,result.cases.length);assert.ok(result.cases.some(c=>c.name==='exact-one-call-positive'));assert.ok(result.cases.some(c=>c.name==='no-retry'));console.log(r.stdout.trim());console.log(JSON.stringify({report,controls:result.cases.length,officeConstructed:false}));
}else console.log('Native LtrRun oracle source policy passes; PowerShell object mocks require Windows. No native acceptance.');
