// The COM witness's plan and refusal paths run without creating Office or an output directory.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
if (process.platform !== 'win32') {
  console.log('SH20 witness offline PowerShell controls are Windows-only; no Office process is created.');
} else {
  const root=mkdtempSync(path.join(tmpdir(),'opf-sh20-plan-'));
  try {
    const script=fileURLToPath(new URL('../../../tools/shapes/sh-20/com-witness.ps1',import.meta.url));
    const seed=path.join(root,'seed.pptx'),sweep=path.join(root,'sweep'),out=path.join(root,'attempt'),helpers=path.join(root,'helpers.ps1');
    writeFileSync(seed,'seed sentinel');
    writeFileSync(helpers,"function Get-OpfFileSha256([string]$Path) { [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([IO.File]::ReadAllBytes($Path))).Replace('-','').ToLowerInvariant() }\nfunction New-OpfNativeLatch { throw 'Plan crossed the Office boundary' }\n");
    for(const kind of ['pptx','pptx-shapes']) {
      mkdirSync(path.join(sweep,kind),{recursive:true});
      for(const name of ['cycle-4-short-square','matrix-4-cjk-wide','matrix-4-rtl-wide']) writeFileSync(path.join(sweep,kind,name+'.pptx'),kind+name);
    }
    const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Seeds',seed,'-Sweep',sweep,'-Out',out,'-NativeHelpersPath',helpers,'-PlanOnly'];
    const run=()=>execFileSync('powershell',args,{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});
    const before=createHash('sha256').update(readFileSync(seed)).digest('hex'),plan=JSON.parse(run().replace(/^\uFEFF/,''));
    assert.equal(plan.inputs.length,7);
    assert.equal(plan.treeCases.length,10);
    assert.equal(plan.inputs[0].sha256,before);
    assert.equal(existsSync(out),false,'a plan creates no attempt directory');
    assert.equal(createHash('sha256').update(readFileSync(seed)).digest('hex'),before);
    const probe=path.join(root,'open-probe.ps1');
    writeFileSync(probe,`param([string]$Witness,[string]$Seeds,[string]$Sweep,[string]$Out,[string]$Helpers)
. $Witness -Seeds $Seeds -Sweep $Sweep -Out $Out -NativeHelpersPath $Helpers -PlanOnly | Out-Null
$log=New-Object 'System.Collections.Generic.List[object]'
$presentations=[pscustomobject]@{Log=$log}
$presentations | Add-Member -MemberType ScriptMethod -Name Open -Value {param($p,$readOnly,$untitled,$window) $this.Log.Add(@{path=$p;type=$p.GetType().FullName;readOnly=$readOnly;untitled=$untitled;window=$window});return 'owned-fake'}
$app=[pscustomobject]@{Presentations=$presentations}
$witnessInput=@{copy=$Seeds}
$result=& { 1 | ForEach-Object { Open-OpfWitnessInput -Application $app -OwnedPath ([string]$witnessInput.copy) } }
@{result=$result;calls=@($log.ToArray());powershell=$PSVersionTable.PSVersion.ToString()} | ConvertTo-Json -Depth 6
`);
    const opened=JSON.parse(execFileSync('powershell',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',probe,'-Witness',script,'-Seeds',seed,'-Sweep',sweep,'-Out',out,'-Helpers',helpers],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}));
    assert.equal(opened.result,'owned-fake');assert.equal(opened.calls.length,1);assert.equal(opened.calls[0].path,seed);assert.equal(opened.calls[0].type,'System.String');assert.equal(opened.calls[0].readOnly,-1);assert.equal(opened.calls[0].untitled,0);assert.equal(opened.calls[0].window,-1);assert.match(opened.powershell,/^5\./);
    mkdirSync(out);const marker=path.join(out,'prior-evidence');writeFileSync(marker,'preserve');
    assert.throws(run,error=>/Preserve prior evidence/.test(error.stderr));
    assert.equal(readFileSync(marker,'utf8'),'preserve');
    rmSync(out,{recursive:true});rmSync(seed);
    assert.throws(run,error=>/Missing witness input/.test(error.stderr));
    assert.equal(existsSync(out),false,'a missing input creates no attempt directory');
    console.log('SH20 witness offline controls pass: plan never crosses Office boundary, source hashes unchanged, existing evidence and missing inputs refused.');
  } finally {rmSync(root,{recursive:true,force:true});}
}
