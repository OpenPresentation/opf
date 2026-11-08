// SH21 read-only product probe guard controls. Fake source bytes only; never creates an Office object.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.platform==='win32'){
 const root=mkdtempSync(path.join(tmpdir(),'opf-sh21-product-'));
 try{
  const script=fileURLToPath(new URL('../../../tools/shapes/sh-21/verify-product.ps1',import.meta.url)),helpers=path.join(root,'helpers.ps1'),manifest=path.join(root,'manifest.json'),out=path.join(root,'attempt');
  writeFileSync(helpers,"function Get-OpfFileSha256([string]$Path){[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([IO.File]::ReadAllBytes($Path))).Replace('-','').ToLowerInvariant()}\nfunction New-OpfNativeLatch{throw 'Plan crossed Office boundary'}\n");
  const ids=['org-chart-3','org-chart-5','hierarchy-3','hierarchy-5',...Array.from({length:7},(_,i)=>'venn-'+(i+1))],cases=ids.map(id=>({id,kind:id.startsWith('org-chart')?'org-chart':id.startsWith('hierarchy')?'hierarchy':'venn',count:1,items:['Sentinel']}));
  for(const directory of ['pptx','pptx-shapes'])mkdirSync(path.join(root,directory));
  for(const c of cases)for(const mode of ['live','native']){const file=(mode==='live'?'pptx':'pptx-shapes')+'/'+c.id+'.pptx',content=mode+' '+c.id;writeFileSync(path.join(root,file),content);c[mode]={file,sha256:createHash('sha256').update(content).digest('hex')};}
  const save=()=>writeFileSync(manifest,JSON.stringify({cases}));save();
  const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Manifest',manifest,'-Out',out,'-NativeHelpersPath',helpers,'-PlanOnly'],run=()=>execFileSync('powershell',args,{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});
  const plan=JSON.parse(run());assert.equal(plan.cases.length,22);assert.equal(existsSync(out),false);
  const proof=path.join(root,'open-proof.ps1');writeFileSync(proof,`param([string]$Witness,[string]$Manifest,[string]$Out,[string]$Helpers,[string]$Owned)
. $Witness -Manifest $Manifest -Out $Out -NativeHelpersPath $Helpers -PlanOnly|Out-Null
$log=New-Object 'System.Collections.Generic.List[object]';$presentations=[pscustomobject]@{Log=$log}
$presentations|Add-Member -MemberType ScriptMethod -Name Open -Value {param($p,$readOnly,$untitled,$window)$this.Log.Add(@{path=$p;type=$p.GetType().FullName;readOnly=$readOnly;untitled=$untitled;window=$window});return 'owned-fake'}
$app=[pscustomobject]@{Presentations=$presentations};$witnessInput=@{copy=$Owned};$opened=&{1|ForEach-Object{Open-OpfSH21Product -Application $app -OwnedPath ([string]$witnessInput.copy)}}
@{result=$opened;calls=@($log.ToArray());powershell=$PSVersionTable.PSVersion.ToString()}|ConvertTo-Json -Depth 5
`);
  const source=path.join(root,'pptx','org-chart-3.pptx'),opened=JSON.parse(execFileSync('powershell',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',proof,'-Witness',script,'-Manifest',manifest,'-Out',out,'-Helpers',helpers,'-Owned',source],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}));assert.equal(opened.result,'owned-fake');assert.deepEqual(opened.calls,[{path:source,type:'System.String',readOnly:-1,untitled:0,window:-1}]);assert.match(opened.powershell,/^5\./);
  mkdirSync(out);writeFileSync(path.join(out,'prior-evidence'),'preserve');assert.throws(run,e=>/Preserve prior evidence/.test(e.stderr));assert.equal(readFileSync(path.join(out,'prior-evidence'),'utf8'),'preserve');rmSync(out,{recursive:true});
  const saved=cases[0].live.file;cases[0].live.file='../outside.pptx';save();assert.throws(run,e=>/fixed case path/.test(e.stderr));cases[0].live.file=saved;save();writeFileSync(source,'modified');assert.throws(run,e=>/Sealed source hash mismatch/.test(e.stderr));assert.equal(existsSync(out),false);
  console.log('SH21 product-probe offline controls pass: PS5 typed read-only Open, plan with no Office/output, fixed paths, hashes and prior evidence refusal.');
 }finally{rmSync(root,{recursive:true,force:true});}
}else console.log('SH21 product-probe offline PowerShell controls are Windows-only; no Office object is created.');
