// NEVERMERGE source derivation. This module never invokes PowerShell or Office.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const lane = path.dirname(fileURLToPath(import.meta.url));
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const BASELINE_SHA = '9a9211b055bc46e3989621a6b2a8d8dd13e8cb0f1df140353fac8f58d294f564';
export const HELPERS_SHA = 'fbe78773d0baf70bbb17fba75f08dd483ec596f9ae638b5c5be3885591b6057c';
export function deriveObserverWorker(baseline, additions) {
  assert.equal(sha(baseline), BASELINE_SHA, 'exact executed 9471-byte baseline, not the LF Git version');
  assert.equal(baseline.length, 9471);
  let text = baseline.toString('utf8');
  const edits = [];
  const replace = (before, after) => {
    assert.equal(text.split(before).length, 2, 'one derivation anchor: ' + before.slice(0, 80));
    text = text.replace(before, () => after); edits.push({before, after});
  };
  replace('. $NativeHelpersPath', additions + '\nif((Get-FileHash -LiteralPath $NativeHelpersPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne "'+HELPERS_SHA+'") { throw "Frozen native helper identity changed" }\n. $NativeHelpersPath');
  replace("$known=@('org-chart-3','org-chart-5','hierarchy-3','hierarchy-5','venn-1','venn-2','venn-3','venn-4','venn-5','venn-6','venn-7')", "Assert-OpfSH21ObserverDefinition $definition\n$known=@('venn-1','venn-2')");
  replace("if($definition.cases.Count -ne 11 -or @($definition.cases|ForEach-Object {$_.id}|Select-Object -Unique).Count -ne 11){throw 'Expected eleven unique diagnostic cases.'}", "if($definition.cases.Count -ne 2 -or @($definition.cases|ForEach-Object {$_.id}|Select-Object -Unique).Count -ne 2){throw 'Expected exactly two sealed diagnostic cases.'}");
  replace("foreach($id in $Only){if($known -notcontains $id){throw 'Unknown requested case.'}}", "if($Only -and (($Only -join '|') -cne 'venn-1|venn-2')) { throw 'The observation diagnostic requires the complete Venn1 then Venn2 pair' }\nforeach($id in $Only){if($known -notcontains $id){throw 'Unknown requested case.'}}");
  const raw = '$rawDataCount=[int]$sa.AllNodes.Count;$rawGroupCount=[int]$Shape.GroupItems.Count';
  replace(raw, "$rawDataCount=Invoke-OpfSH21ObserverRead 'observer.firstDataCount' { return ,$sa.AllNodes.Count } 'count' 2\n $rawGroupCount=Invoke-OpfSH21ObserverRead 'observer.firstGroupCount' { return ,$Shape.GroupItems.Count } 'count' 30\n # DEFERRED GUARD: collect one bounded observation, then retain the ORIGINAL first-count guard below.\n $null=Read-OpfSH21NodeShapeObservation $Shape $sa $Expected $rawDataCount $rawGroupCount");
  replace('$latch=New-OpfNativeLatch;', "$script:observerQueries=New-Object 'System.Collections.Generic.List[object]'\n$script:observerProbes=New-Object 'System.Collections.Generic.List[object]'\n$script:observerStopped=$false\n$latch=New-OpfNativeLatch;");
  replace('$live=@();$shapes=@();for(', "$null=Invoke-OpfSH21ObserverRead ($witnessInput.id+'-'+$witnessInput.mode+'-topShapeCount') { return ,$slide.Shapes.Count } 'count' 30\n   $live=@();$shapes=@();for(");
  replace("@{passed=$passed;scope='Read-only product baseline, no native domain acceptance or edit qualification';", "@{observerQueries=@($script:observerQueries.ToArray());observerProbes=@($script:observerProbes.ToArray());nativeAcceptance=$false;passed=$passed;scope='Bounded read-only observation diagnostic; first-count guard retained, no native acceptance';");
  let recovered = text;
  for(const edit of [...edits].reverse()) { assert.equal(recovered.split(edit.after).length,2); recovered=recovered.replace(edit.after,()=>edit.before); }
  assert.deepEqual(Buffer.from(recovered), baseline, 'every other original byte, including its one CRLF, is exact');
  return {bytes:Buffer.from(text), edits};
}
export const QUALIFIED_RAW_SHA='51439c085e65c168b99424b5355338e6c6b77febb747629bf51ce8aa6a439df5';
export function verifyWorkerTransport(raw,display,baseline,additions) {
  assert.equal(sha(raw),QUALIFIED_RAW_SHA,'exact qualified raw worker');
  assert.deepEqual(raw,deriveObserverWorker(baseline,additions).bytes,'raw worker remains exactly derived');
  assert.equal(display.toString('utf8'),raw.toString('utf8').replaceAll('\r\n','\n'),'readable Git source is canonical LF and otherwise identical');
  return raw;
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(lane,'observer-worker.ps1.gz');
  const baseline=gunzipSync(fs.readFileSync(path.join(lane,'reference-worker.ps1.gz')));
  const derived=deriveObserverWorker(baseline,fs.readFileSync(path.join(lane,'observer-functions.ps1'),'utf8'));
  fs.writeFileSync(output,output.endsWith('.gz')?gzipSync(derived.bytes,{level:9}):derived.bytes,{flag:'wx'});
  console.log(JSON.stringify({output,baselineSha256:BASELINE_SHA,workerSha256:sha(derived.bytes),bytes:derived.bytes.length,edits:derived.edits.length,nativeAuthorized:false,officeConstructed:false}));
}
