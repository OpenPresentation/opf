import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {scanPowerShellSource} from './powershell-scan.mjs';
import {windowsPowerShellEnvironment} from '../../../scripts/native-acceptance/windows-powershell-env.mjs';
const worker=new URL('./native-furniture-control.ps1',import.meta.url),checker=new URL('./native-reference-startup-check.ps1',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
test('reference startup retains exact immutable stages with fixed hashes and no Git/history requirement',()=>{
 const source=readFileSync(worker);assert.equal(source.length,93940);assert.equal(sha(source),'1cb61400327a06df95a03562e524c9fe4487375efd86a21dd49494b9db773870');
 const snapshotEdits=[
  [
    "    [switch]$ReferenceNameEdit\n",
    "    [switch]$ReferenceNameEdit,\n    [switch]$ReferenceNameSnapshots\n"
  ],
  [
    "$ErrorActionPreference='Stop'\n",
    "$ErrorActionPreference='Stop'\nif($ReferenceNameSnapshots -and -not $ReferenceNameEdit){throw 'Name snapshots require the exact closed reference-name mode'}\n"
  ],
  [
    "    if($ReferenceNameEdit){$request.referenceNameEdit=$true}",
    "    if($ReferenceNameEdit){$request.referenceNameEdit=$true}\n    if($ReferenceNameSnapshots){$request.referenceNameSnapshots=$true}"
  ],
  [
    "    if($ReferenceNameEdit){$workerArguments+='-ReferenceNameEdit'}",
    "    if($ReferenceNameEdit){$workerArguments+='-ReferenceNameEdit'}\n    if($ReferenceNameSnapshots){$workerArguments+='-ReferenceNameSnapshots'}"
  ],
  [
    "Assert-FurnitureSurvey ([bool]$ReadOnlySurvey) $actions $sourceSnapshot",
    "$script:referenceNameSnapshotsModeEnabled=$false\nif($ReferenceNameSnapshots -or $null -ne $request.PSObject.Properties['referenceNameSnapshots']){\n    if(-not $script:referenceNameModeEnabled -or -not $ReferenceNameSnapshots -or $request.referenceNameSnapshots -isnot [bool] -or -not $request.referenceNameSnapshots){throw 'Name snapshot switch differs from its closed snapshotted request'}\n    $script:referenceNameSnapshotsModeEnabled=$true\n}\nAssert-FurnitureSurvey ([bool]$ReadOnlySurvey) $actions $sourceSnapshot"
  ],
  [
    "if($script:referenceNameModeEnabled){$report.referenceNameEdit=$true}",
    "if($script:referenceNameModeEnabled){$report.referenceNameEdit=$true}\nif($script:referenceNameSnapshotsModeEnabled){$report.referenceNameSnapshots=@()}"
  ],
  [
    "function Close-OwnedFurniture([string]$Phase,[string]$ExpectedPath) {",
    "# Two closed extra copies for the prospective Name route; the old Save helper above is unchanged.\nfunction Save-OwnedReferenceNameSnapshot([string]$ExpectedPath,[string]$CopyPath,[string]$Phase) {\n    if(-not $script:referenceNameSnapshotsModeEnabled -or -not $script:referenceNameModeEnabled -or $Phase -cnotin @('before','reopened')) { Stop-FurnitureLifecycle 'Only the closed Name snapshot mode may save these two copies' }\n    $fixed=Join-Path $outputRoot ('reference-name-'+$Phase+'.pptx')\n    if($CopyPath -cne $fixed -or $CopyPath -ieq $ExpectedPath -or (Test-Path -LiteralPath $CopyPath)) { Stop-FurnitureLifecycle 'Name snapshot requires its exact fresh derivative separate from the owned input' }\n    $actual=Invoke-FurnitureCom \"reference-$Phase.presentation.fullName.get\" { $script:presentation.FullName }\n    if($actual -ine $ExpectedPath -or $script:ownedPresentationPath -ine $ExpectedPath) { Stop-FurnitureLifecycle 'Refusing to snapshot a presentation whose exact identity is not owned' }\n    Invoke-FurnitureCom \"reference-$Phase.presentation.saveCopyAs\" { $script:presentation.SaveCopyAs($CopyPath,24) }\n    $after=Invoke-FurnitureCom \"reference-$Phase.presentation.fullName.afterCopy.get\" { $script:presentation.FullName }\n    if($after -ine $ExpectedPath) { Stop-FurnitureLifecycle 'Name snapshot changed the owned input identity' }\n    $report.referenceNameSnapshots+=@([ordered]@{phase=$Phase;path=$CopyPath;sha256=(Get-FurnitureSha256 $CopyPath)})\n    Write-FurnitureReport\n}\nfunction Close-OwnedFurniture([string]$Phase,[string]$ExpectedPath) {"
  ],
  [
    "    $report.phases.original=Read-FurnitureState $script:presentation 'original'; Write-FurnitureReport",
    "    $report.phases.original=Read-FurnitureState $script:presentation 'original'; Write-FurnitureReport\n    if($script:referenceNameSnapshotsModeEnabled){Save-OwnedReferenceNameSnapshot $sourceSnapshot (Join-Path $outputRoot 'reference-name-before.pptx') 'before'}"
  ],
  [
    "    $report.phases.reopened=Read-FurnitureState $script:presentation 'reopened'; Write-FurnitureReport",
    "    $report.phases.reopened=Read-FurnitureState $script:presentation 'reopened'; Write-FurnitureReport\n    if($script:referenceNameSnapshotsModeEnabled){Save-OwnedReferenceNameSnapshot $savedPath (Join-Path $outputRoot 'reference-name-reopened.pptx') 'reopened'}"
  ]
];
 let inverse=source.toString('utf8');for(const [prior,next]of [...snapshotEdits].reverse()){assert.equal(inverse.split(next).length-1,1);inverse=inverse.replace(next,prior);}
 const stage5=Buffer.from(inverse);assert.equal(stage5.length,91281);assert.equal(sha(stage5),'d8f0aa7e0b7fcf72cb2401808f45c2cdb69cd99862ad14c88103180b86278210');
 const old='$script:referenceNameEdit',next='$script:referenceNameModeEnabled';assert.equal(inverse.split(next).length-1,9);assert.ok(!inverse.includes(old));const stage4=Buffer.from(inverse.replaceAll(next,old));assert.equal(stage4.length,91218);assert.equal(sha(stage4),'641c30e6dc9e3e89bae814c752e4fbc1bea41d8318b4f8a0af7e863434466060');assert.deepEqual(Buffer.from(stage4.toString('utf8').replaceAll(old,next)),stage5);
 for(const file of [worker,checker])assert.deepEqual(scanPowerShellSource(readFileSync(file,'utf8')).issues,[]);assert.match(source.toString('utf8'),/\[switch\]\$ReferenceNameEdit/);assert.match(source.toString('utf8'),/\$request\.referenceNameEdit -isnot \[bool\]/);
});
test('actual Windows PS5 executes the real main parameter and startup handshake, old fails/new passes without Office',{skip:process.platform!=='win32'},()=>{
 const artifacts=fileURLToPath(new URL('../../../artifacts/',import.meta.url));mkdirSync(artifacts,{recursive:true});const output=mkdtempSync(path.join(artifacts,'native-reference-startup-')),report=path.join(output,'report.json');
 const result=spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',fileURLToPath(checker),'-ScriptPath',fileURLToPath(worker),'-ReportPath',report],{env:windowsPowerShellEnvironment(process.env),encoding:'utf8',windowsHide:true,timeout:15000});writeFileSync(path.join(output,'stdout.log'),result.stdout??'');writeFileSync(path.join(output,'stderr.log'),result.stderr??'');assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);
 const data=JSON.parse(readFileSync(report,'utf8').replace(/^\uFEFF/u,''));assert.equal(data.powerShellEdition,'Desktop');assert.match(data.powerShellVersion,/^5\.1\./u);assert.equal(data.genuineArchive,false);assert.equal(data.earlierFullSourceBootstrapExercised,false);assert.equal(data.officeConstructed,false);assert.equal(data.processQueries,0);assert.equal(data.observerIO,0);assert.deepEqual(data.cases.map(r=>r.scenario),['valid','old-collision','disabled','missing-switch','missing-request','false-request','nonboolean-request','wrong-source']);for(const row of data.cases)assert.equal(row.passed,true,row.scenario);assert.equal(data.cases[0].publicSwitch,true);assert.equal(data.cases[0].internalEnabled,true);assert.equal(data.cases[1].refusal,'Reference-name switch differs from its snapshotted request');
});
