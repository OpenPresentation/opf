# Dedicated SH21 admission. Polling is ONLY the maintained hash-pinned kernel.
function Test-Sh21PostflightReady($Evidence) {
    try{
        $a=$Evidence.admission;$r=$Evidence.report;$q=$Evidence.request;$s=$Evidence.stages;$t=$Evidence.terminal
        if($q.plan.caseId -isnot [string] -or $q.plan.caseId -cnotin @('org-chart-3','hierarchy-3','venn-3')){return $false}
        if($a.profile -cne 'sh21-three-case-node-and-text-edit-v1' -or $q.profile -cne $a.profile -or $r.profile -cne $a.profile -or $a.requestSha256 -cne $r.requestSha256 -or $q.envelopeSha256 -cne $r.envelopeSha256 -or $q.runOfficeRequested -isnot [bool] -or -not $q.runOfficeRequested){return $false}
        foreach($v in @($a,$q)){if($v.nativeAcceptance -isnot [bool] -or $v.nativeAcceptance -or $v.registryAcceptance -isnot [bool] -or $v.registryAcceptance){return $false}}
        if($a.policy.policy -cne 'sh21-node-text-bounded-global-zero-after-completed-owned-quit-v1' -or $a.policy.observationPolicy -cne 'global-zero-after-completed-owned-quit-v1' -or $a.policy.budgetMilliseconds -ne 5000 -or $a.policy.intervalMilliseconds -ne 100 -or $a.policy.maximumQueries -ne 51 -or $a.policy.observerSource -cne 'scripts/native-acceptance/run-reference-chart-profile.ps1' -or $a.policy.observerSourceSha256 -cne '8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3'){return $false}
        if(($q.policy|ConvertTo-Json -Compress) -cne ($a.policy|ConvertTo-Json -Compress)){return $false}
        if($t.timedOut -isnot [bool] -or $t.timedOut -or -not(Test-OwnedPostflightInteger $t.exitCode) -or $t.exitCode -ne 0 -or $t.timeoutSeconds -ne $q.timeoutSeconds -or -not(Test-OwnedPostflightInteger $q.timeoutSeconds) -or $q.timeoutSeconds -lt 5 -or $q.timeoutSeconds -gt 60){return $false}
        if($r.cleanupConfirmed -isnot [bool] -or -not $r.cleanupConfirmed -or $r.officeOperationsStopped -isnot [bool] -or $r.officeOperationsStopped -or $r.error -ne $null -or $r.PSObject.Properties.Name -cnotcontains 'error' -or $r.lastStage -cne 'worker.complete' -or $r.lastStatus -cne 'success' -or $r.opens.Count -ne 2 -or $r.saveCopies -ne 1 -or $r.closes -ne 2 -or $r.quits -ne 1){return $false}
        if($r.actions -isnot [array] -or $r.actions.Count -ne 1 -or $r.actions[0].status -cne 'success' -or $r.actions[0].textSetterAttempts -ne 1 -or $r.actions[0].newTextSetterAttempts -ne 1 -or $r.actions[0].addNodeAttempts -ne 1){return $false}
        foreach($name in @('closes','saveCopies','quits')){if(-not(Test-OwnedPostflightInteger $r.$name)){return $false}}
        foreach($name in @('textSetterAttempts','newTextSetterAttempts','addNodeAttempts')){if(-not(Test-OwnedPostflightInteger $r.actions[0].$name)){return $false}}
        if(-not(Test-OwnedPostflightStageWire $s)){return $false}
        $ready=$a.ready;$success=@($s|Where-Object{$_.status -ceq 'success'})
        foreach($name in @('stageCount','opens','saves','closes','textSetters','nodeAdds','quits')){if(-not(Test-OwnedPostflightInteger $ready.$name)){return $false}}
        if($ready.workerCleanupConfirmed -isnot [bool] -or -not $ready.workerCleanupConfirmed -or $ready.stageCount -ne $s.Count -or $ready.lifecycle.Count -ne $success.Count -or $ready.opens -ne 2 -or $ready.saves -ne 1 -or $ready.closes -ne 2 -or $ready.textSetters -ne 2 -or $ready.nodeAdds -ne 1 -or $ready.quits -ne 1){return $false}
        for($i=0;$i -lt $success.Count;$i++){if($ready.lifecycle[$i].stage -cne $success[$i].stage -or $ready.lifecycle[$i].sequence -ne $success[$i].sequence){return $false}}
        $critical=@('worker.initialize','preflight.globalIdle','application.create','application.initial.count','original.open','edit.existingText.set','edit.node.add','edit.newText.set','copy.saveCopyAs','original.close','saved-reopened.open','saved-reopened.close','application.final.count','application.quit','worker.complete');$previous=0
        foreach($name in $critical){$rows=@($s|Where-Object{$_.stage -ceq $name});$ends=@($rows|Where-Object{$_.status -ceq 'success'});if($ends.Count -ne 1){return $false};if($name.StartsWith('worker.')){if($rows.Count -ne 1){return $false}}else{$begins=@($rows|Where-Object{$_.status -ceq 'begin'});if($rows.Count -ne 2 -or $begins.Count -ne 1 -or $begins[0].sequence -le $previous -or $begins[0].sequence -ge $ends[0].sequence){return $false}};if($ends[0].sequence -le $previous){return $false};$previous=$ends[0].sequence;if($name -cin @('preflight.globalIdle','application.initial.count','application.final.count') -and $ends[0].value -ne 0){return $false}}
        if($r.probes -isnot [array] -or $r.probes.Count -lt 1){return $false};foreach($p in $r.probes){if($p.matched -isnot [bool] -or -not $p.matched){return $false}}
        return $true
    }catch{return $false}
}
function Read-Sh21PostflightEvidence([string]$AdmissionFile,[string]$ExpectedSha256,[string]$ControllerRoot) {
    Assert-OwnedPostflightPath $AdmissionFile
    if((Split-Path -Leaf $AdmissionFile) -cne 'postflight-admission.json' -or (Get-Item -LiteralPath $AdmissionFile).Length -gt 4194304 -or (Get-OwnedPostflightHash $AdmissionFile) -cne $ExpectedSha256){throw 'Externally pinned SH21 admission differs'}
    $a=Get-Content -LiteralPath $AdmissionFile -Raw -Encoding UTF8|ConvertFrom-Json
    if($a.profile -cne 'sh21-three-case-node-and-text-edit-v1' -or $a.files -isnot [array] -or $a.files.Count -lt 1 -or $a.files.Count -gt 2000){throw 'Closed SH21 admission required'}
    $seen=@{}
    foreach($r in $a.files){if(-not(Test-OwnedPostflightKeys $r @('file','bytes','sha256'))){throw 'Unknown SH21 identity field'};Assert-OwnedPostflightPath $r.file;if($seen.ContainsKey($r.file) -or -not(Test-OwnedPostflightInteger $r.bytes) -or $r.bytes -lt 0 -or $r.sha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid/duplicate SH21 identity'};$i=Get-Item -LiteralPath $r.file -Force;if($i.PSIsContainer -or $i.Length -ne $r.bytes -or (Get-OwnedPostflightHash $r.file) -cne $r.sha256){throw 'SH21 source/evidence changed before observer'};$seen[$r.file]=$true}
    $output=Split-Path -Parent $AdmissionFile
    function Read-Sh21Bound([string]$File){if(-not $seen.ContainsKey($File) -or (Get-Item -LiteralPath $File).Length -gt 4194304){throw 'Unbound SH21 JSON'};return Get-Content -LiteralPath $File -Raw -Encoding UTF8|ConvertFrom-Json}
    $q=Read-Sh21Bound (Join-Path $output 'execution-request.json')
    if($q.output -cne $output -or $q.nativeRoot -cne (Join-Path $output 'native') -or $q.controller.directory -cne $ControllerRoot -or $a.requestSha256 -cne (Get-OwnedPostflightHash (Join-Path $output 'execution-request.json')) -or -not $seen.ContainsKey($q.node.path)){throw 'Foreign SH21 request/runtime'}
    $stageFile=Join-Path $q.nativeRoot 'stages.jsonl';if(-not $seen.ContainsKey($stageFile) -or (Get-Item -LiteralPath $stageFile).Length -gt 4194304){throw 'Unbound SH21 raw stages'}
    $e=[ordered]@{admission=$a;request=$q;report=(Read-Sh21Bound (Join-Path $q.nativeRoot 'report.json'));terminal=(Read-Sh21Bound (Join-Path $q.nativeRoot 'worker.json'));stages=@(Get-Content -LiteralPath $stageFile -Encoding UTF8|ForEach-Object{$_|ConvertFrom-Json})}
    # Recompute exact source, snapshot, public import, raw graph/style, geometry
    # and full operation grammar before the first process/timer/append callback.
    & $q.node.path (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-profile.mjs') verify-admission --envelope (Join-Path $output 'execution-envelope.json') --sha256 $q.envelopeSha256 --output $output --require-office true|Out-Null
    if($LASTEXITCODE -ne 0){throw 'SH21 full typed admission refused; zero observer IO'}
    return $e
}
function Invoke-Sh21Postflight {
    param([string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[string]$ControllerRoot,[scriptblock]$ReadProcesses,[scriptblock]$Clock,[scriptblock]$Utc,[scriptblock]$Delay,[scriptblock]$Append)
    $e=Read-Sh21PostflightEvidence $AdmissionFile $ExpectedAdmissionSha256 $ControllerRoot
    return Invoke-Sh21BoundPostflight -Evidence $e -AdmissionFile $AdmissionFile -ExpectedAdmissionSha256 $ExpectedAdmissionSha256 -ControllerRoot $ControllerRoot -ReadProcesses $ReadProcesses -Clock $Clock -Utc $Utc -Delay $Delay -Append $Append
}
function Invoke-Sh21BoundPostflight {
    param($Evidence,[string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[string]$ControllerRoot,[scriptblock]$ReadProcesses,[scriptblock]$Clock,[scriptblock]$Utc,[scriptblock]$Delay,[scriptblock]$Append)
    foreach($definition in @(Import-OwnedPostflightObserver (Join-Path $ControllerRoot 'scripts/native-acceptance/run-reference-chart-profile.ps1'))){Invoke-Expression $definition}
    function Test-ReferenceWitnessPostflightReady($Terminal,$Report){return Test-Sh21PostflightReady $Report}
    if(-not(Test-Sh21PostflightReady $Evidence)){throw 'SH21 completion refused; zero observer IO'}
    foreach($r in $Evidence.admission.files){if((Get-Item -LiteralPath $r.file).Length -ne $r.bytes -or (Get-OwnedPostflightHash $r.file) -cne $r.sha256){throw 'SH21 source/evidence drift before observer'}}
    $journal=Join-Path (Split-Path -Parent $AdmissionFile) 'postflight.jsonl';if(Test-Path -LiteralPath $journal){throw 'Preserve existing SH21 postflight journal'}
    if(-not $ReadProcesses){$ReadProcesses={try{return @(Get-Process -Name POWERPNT -ErrorAction Stop|ForEach-Object{$_.Id})}catch{if($_.FullyQualifiedErrorId.Split(',')[0] -ceq 'NoProcessFoundForGivenName'){return @()};throw}}}
    $watch=[Diagnostics.Stopwatch]::StartNew();if(-not $Clock){$Clock={$watch.Elapsed.TotalMilliseconds}.GetNewClosure()};if(-not $Utc){$Utc={[DateTime]::UtcNow.ToString('o')}};if(-not $Delay){$Delay={param($milliseconds)[Threading.Thread]::Sleep($milliseconds)}}
    $rows=[Collections.Generic.List[object]]::new()
    if(-not $Append){$Append={param($row)$mode=if($rows.Count -eq 0){[IO.FileMode]::CreateNew}else{[IO.FileMode]::Append};$stream=[IO.File]::Open($journal,$mode,[IO.FileAccess]::Write,[IO.FileShare]::Read);$writer=[IO.StreamWriter]::new($stream,[Text.UTF8Encoding]::new($false));try{$writer.WriteLine(($row|ConvertTo-Json -Compress -Depth 8));$writer.Flush()}finally{$writer.Dispose()}}.GetNewClosure()}
    $delegate=$Append;$appendRecorded={param($row)& $delegate $row;$rows.Add($row)}.GetNewClosure();$result=$null;$failure=$null
    try{$result=Invoke-ReferenceWitnessPostflight $Evidence.terminal $Evidence $ReadProcesses $Clock $Utc $Delay $appendRecorded}catch{$failure=$_.Exception.Message}
    $identity=$null;if(Test-Path -LiteralPath $journal){$identity=[ordered]@{path='postflight.jsonl';bytes=(Get-Item -LiteralPath $journal).Length;sha256=(Get-OwnedPostflightHash $journal)}}
    $observed=@($rows|Where-Object{$_.status -ceq 'observed'})
    return [ordered]@{schemaVersion=1;policy=$Evidence.admission.policy;admission=[ordered]@{path=$AdmissionFile;bytes=(Get-Item -LiteralPath $AdmissionFile).Length;sha256=$ExpectedAdmissionSha256};workerCleanupConfirmed=$true;initialCount=if($observed.Count){@($observed[0].processIds).Count}else{$null};finalCount=if($observed.Count){@($observed[$observed.Count-1].processIds).Count}else{$null};error=$failure;result=$result;identity=$identity}
}
