import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {windowsPowerShellEnvironment} from '../../../scripts/native-acceptance/windows-powershell-env.mjs';

if (process.platform === 'win32') {
  const script=fileURLToPath(new URL('./native-text-probes-check.ps1',import.meta.url));
  const shell=path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const result=spawnSync(shell,['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,env:windowsPowerShellEnvironment(process.env)});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.match(result.stdout,/PASS: \d+ pure\/managed text-probe controls; no Office/);
  console.log(result.stdout.trim());
} else {
  console.log('SKIP: Windows PowerShell required for managed text-probe controls; no native execution claimed.');
}
