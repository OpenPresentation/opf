import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';

const directory=fileURLToPath(new URL('.',import.meta.url));
test('Windows PowerShell child environment removes inherited module paths without changing its parent',()=>{
  const parent=Object.freeze({
    PSModulePath:'C:/Program Files/PowerShell/7/Modules',
    PSMODULEPATH:'C:/inherited/modules',
    pSmOdUlEpAtH:'C:/another/modules',
    WINDIR:'C:/Windows',
    Path:'C:/Windows/System32;C:/Git/bin',
    TEMP:'C:/scratch',
    PSModulePathExtra:'preserved',
  });
  const child=windowsPowerShellEnvironment(parent);
  assert.deepEqual(child,{
    WINDIR:'C:/Windows',Path:'C:/Windows/System32;C:/Git/bin',TEMP:'C:/scratch',PSModulePathExtra:'preserved',
  });
  assert.equal(parent.PSModulePath,'C:/Program Files/PowerShell/7/Modules');
  assert.equal(parent.PSMODULEPATH,'C:/inherited/modules');
  assert.equal(parent.pSmOdUlEpAtH,'C:/another/modules');
  assert.notEqual(windowsPowerShellEnvironment(child),child);
  assert.deepEqual(windowsPowerShellEnvironment(child),child);
});
test('Windows runner parses and exercises pure refusal/identity controls without Office',{
  skip:process.platform!=='win32'?'Windows PowerShell is unavailable on this host; Windows execution is not claimed':false,
},()=>{
  assert.ok(process.env.WINDIR,'Windows requires an actual WINDIR');
  const shell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
  assert.ok(existsSync(shell),'Windows PowerShell is required; a missing Windows prerequisite must fail');
  const result=spawnSync(shell,['-NoProfile','-NonInteractive','-File',path.join(directory,'run-windows-self-test.ps1'),'-RunnerPath',path.join(directory,'run-windows.ps1'),'-TableRunnerPath',path.join(directory,'run-table-windows.ps1')],{
    encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,env:windowsPowerShellEnvironment(process.env),
  });
  assert.ifError(result.error);
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout,/PASS: \d+ pure preflight controls; no worker, Office or native observation executed\./);
});
