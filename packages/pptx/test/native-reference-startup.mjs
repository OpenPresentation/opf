import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {scanPowerShellSource} from './powershell-scan.mjs';
import {windowsPowerShellEnvironment} from '../../../scripts/native-acceptance/windows-powershell-env.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),worker=new URL('./native-furniture-control.ps1',import.meta.url),checker=new URL('./native-reference-startup-check.ps1',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
test('reference startup repair is only nine internal-state renames with the public parameter and all guards byte-exact',()=>{
 const source=readFileSync(worker),before=execFileSync('git',['show','fdb175da1160deb9747a8bccb898d79f4dc273a6:packages/pptx/test/native-furniture-control.ps1'],{cwd:root});assert.equal(before.length,91218);assert.equal(sha(before),'641c30e6dc9e3e89bae814c752e4fbc1bea41d8318b4f8a0af7e863434466060');
 const old='$script:referenceNameEdit',next='$script:referenceNameModeEnabled';assert.equal(before.toString('utf8').split(old).length-1,9);assert.ok(!before.includes(next));assert.deepEqual(source,Buffer.from(before.toString('utf8').replaceAll(old,next)));assert.deepEqual(Buffer.from(source.toString('utf8').replaceAll(next,old)),before);assert.equal(source.length,91281);assert.equal(sha(source),'d8f0aa7e0b7fcf72cb2401808f45c2cdb69cd99862ad14c88103180b86278210');
 for(const file of [worker,checker])assert.deepEqual(scanPowerShellSource(readFileSync(file,'utf8')).issues,[]);assert.match(source.toString('utf8'),/\[switch\]\$ReferenceNameEdit/);assert.match(source.toString('utf8'),/\$request\.referenceNameEdit -isnot \[bool\]/);
});
test('actual Windows PS5 executes the real main parameter and startup handshake, old fails/new passes without Office',{skip:process.platform!=='win32'},()=>{
 const artifacts=fileURLToPath(new URL('../../../artifacts/',import.meta.url));mkdirSync(artifacts,{recursive:true});const output=mkdtempSync(path.join(artifacts,'native-reference-startup-')),report=path.join(output,'report.json');
 const result=spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',fileURLToPath(checker),'-ScriptPath',fileURLToPath(worker),'-ReportPath',report],{env:windowsPowerShellEnvironment(process.env),encoding:'utf8',windowsHide:true,timeout:15000});writeFileSync(path.join(output,'stdout.log'),result.stdout??'');writeFileSync(path.join(output,'stderr.log'),result.stderr??'');assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);
 const data=JSON.parse(readFileSync(report,'utf8').replace(/^\uFEFF/u,''));assert.equal(data.powerShellEdition,'Desktop');assert.match(data.powerShellVersion,/^5\.1\./u);assert.equal(data.genuineArchive,false);assert.equal(data.earlierFullSourceBootstrapExercised,false);assert.equal(data.officeConstructed,false);assert.equal(data.processQueries,0);assert.equal(data.observerIO,0);assert.deepEqual(data.cases.map(r=>r.scenario),['valid','old-collision','disabled','missing-switch','missing-request','false-request','nonboolean-request','wrong-source']);for(const row of data.cases)assert.equal(row.passed,true,row.scenario);assert.equal(data.cases[0].publicSwitch,true);assert.equal(data.cases[0].internalEnabled,true);assert.equal(data.cases[1].refusal,'Reference-name switch differs from its snapshotted request');
});
