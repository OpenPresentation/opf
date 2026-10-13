import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';

const directory=fileURLToPath(new URL('.',import.meta.url));
test('font registration is current-user/session-visible and preserves an ownership journal',()=>{
  const source=readFileSync(path.join(directory,'setup-fonts-windows.ps1'),'utf8');
  assert.match(source,/Registry\]::CurrentUser/);
  assert.doesNotMatch(source,/Registry\]::LocalMachine|FR_PRIVATE|Stop-Process|PowerPoint\.Application/);
  assert.match(source,/AddFontResourceEx\(\$file,0,/);
  assert.match(source,/Assert-Owned \$State \$false/);
  assert.match(source,/\$state\.entries\+=,\$entry; Save-State \$state/);
  assert.match(source,/InstalledFontCollection/);
});
test('Windows font controls validate sealed inputs and preserve unrelated state without installing fonts',{
  skip:process.platform!=='win32'?'Windows PowerShell unavailable; actual registration remains unverified':false,
},()=>{
  assert.ok(process.env.WINDIR);
  const shell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
  assert.ok(existsSync(shell),'Windows PowerShell is required');
  const result=spawnSync(shell,['-NoProfile','-NonInteractive','-File',path.join(directory,'setup-fonts-windows-self-test.ps1'),'-ToolPath',path.join(directory,'setup-fonts-windows.ps1')],{
    encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,env:windowsPowerShellEnvironment(process.env),
  });
  assert.ifError(result.error);
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout,/PASS: font input and owned-cleanup controls/);
});

// This actual Windows check opens only a fresh read-only PowerShell process;
// Roboto need not be installed, and no font or registry state is changed.
test('fresh Windows font probe enumerates well-formed families without registration',{
  skip:process.platform!=='win32'?'Windows PowerShell unavailable; fresh-process enumeration remains unverified':false,
},()=>{
  assert.ok(process.env.WINDIR);
  const shell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
  assert.ok(existsSync(shell),'Windows PowerShell is required');
  const result=spawnSync(shell,['-NoProfile','-NonInteractive','-File',path.join(directory,'probe-fonts-windows.ps1')],{
    encoding:'utf8',timeout:10000,maxBuffer:1024*1024,env:windowsPowerShellEnvironment(process.env),
  });
  assert.ifError(result.error);
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
  assert.equal(result.stderr.trim(),'');
  const probe=JSON.parse(result.stdout);
  assert.equal(probe.schemaVersion,1);
  assert.ok(Array.isArray(probe.names)&&probe.names.length>0&&probe.names.length<=10000);
  assert.ok(probe.names.every(name=>typeof name==='string'&&name.trim().length>0));
});
