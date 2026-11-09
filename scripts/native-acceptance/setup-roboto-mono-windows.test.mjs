import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {mkdir,mkdtemp,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {generateMonoFontInputs} from './roboto-mono-fonts.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';

const directory=fileURLToPath(new URL('.',import.meta.url));
test('Mono tool is bounded, separately owned, current-user only and serializes with the existing Roboto tool',()=>{
  const source=readFileSync(path.join(directory,'setup-roboto-mono-windows.ps1'),'utf8');
  assert.match(source,/Registry\]::CurrentUser/u);
  assert.doesNotMatch(source,/Registry\]::LocalMachine|FR_PRIVATE|Stop-Process|PowerPoint\.Application/u);
  assert.match(source,/AddFontResourceEx\(\$file,0,/u);
  assert.match(source,/function Cleanup-Owned\(\$State\) \{\s+Assert-ToolIdentity \$State\s+Assert-Owned \$State \$false/u);
  assert.match(source,/OPF Native Mono/u);
  assert.match(source,/Local\\OPFNativeFonts-\$sid/u);
  assert.match(source,/Assert-NoMonoIdentity @\(Fresh-InstalledNames\)/u);
  assert.match(source,/\$state\.entries\+=,\$entry; Save-State \$state/u);
});
test('actual Windows PowerShell exercises pinned Mono setup/check/cleanup only through mocked mutation APIs',{
  skip:process.platform!=='win32'?'Windows PowerShell unavailable; actual registration remains unverified':false,
},async()=>{
  const shell=path.join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');assert.ok(existsSync(shell));
  const scratch=await realpath(await mkdtemp(path.join(tmpdir(),'opf-mono-test-')));
  try{
    const suite=path.join(scratch,'suite');await mkdir(suite);
    await writeFile(path.join(suite,'suite.json'),JSON.stringify(await generateMonoFontInputs({output:suite}))+'\n');
    const result=spawnSync(shell,['-NoProfile','-NonInteractive','-File',path.join(directory,'setup-roboto-mono-windows-self-test.ps1'),'-ToolPath',path.join(directory,'setup-roboto-mono-windows.ps1'),'-SuiteDirectory',suite],{
      encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,env:windowsPowerShellEnvironment(process.env),
    });
    assert.ifError(result.error);assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout,/PASS: bounded Mono profile and owned lifecycle controls/u);
  }finally{await rm(scratch,{recursive:true,force:true});}
});
