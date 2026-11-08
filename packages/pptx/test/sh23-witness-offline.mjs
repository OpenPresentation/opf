// SH23 plan/refusal paths must preserve prior native evidence without starting Office.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.platform!=='win32')console.log('SH23 offline PowerShell checks are Windows-only; no Office process is created.');
else{
 const root=mkdtempSync(path.join(tmpdir(),'opf-sh23-plan-'));
 try{
  const script=fileURLToPath(new URL('../../../tools/shapes/sh-23/verify-ninth.ps1',import.meta.url)),helpers=path.join(root,'helpers.ps1'),manifest=path.join(root,'manifest.json'),out=path.join(root,'attempt');
  writeFileSync(helpers,"function Get-OpfFileSha256([string]$Path) { [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([IO.File]::ReadAllBytes($Path))).Replace('-','').ToLowerInvariant() }\nfunction New-OpfNativeLatch { throw 'Plan crossed Office boundary' }\n");
  const cases=['pyramid','matrix','flow','chevrons','vertical-flow'].map(kind=>{const file=kind+'.pptx',bytes=Buffer.from(kind+' sentinel');writeFileSync(path.join(root,file),bytes);return{kind,file,sha256:createHash('sha256').update(bytes).digest('hex'),initialCount:8,paragraphAlignment:'ctr',text9:Array(9).fill({left:0,right:1}),geometry9:Array(9).fill({})};});
  const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Manifest',manifest,'-Out',out,'-NativeHelpersPath',helpers,'-PlanOnly'];
  const run=(extra=[])=>execFileSync('powershell',[...args,...extra],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});
  writeFileSync(manifest,JSON.stringify({cases}));assert.equal(JSON.parse(run()).cases.length,5);assert.equal(JSON.parse(run(['-Only','pyramid'])).cases.length,1);assert.equal(existsSync(out),false);
  mkdirSync(out);const marker=path.join(out,'prior-evidence');writeFileSync(marker,'preserve');assert.throws(run,error=>/Preserve earlier evidence/.test(error.stderr));assert.equal(readFileSync(marker,'utf8'),'preserve');rmSync(out,{recursive:true});
  writeFileSync(path.join(root,cases[0].file),'modified input');assert.throws(run,error=>/Witness source hash mismatch/.test(error.stderr));assert.equal(existsSync(out),false);
  console.log('SH23 offline checks pass: complete plan, one-case selection, no output/Office boundary, prior evidence and changed inputs refused.');
 }finally{rmSync(root,{recursive:true,force:true});}
}