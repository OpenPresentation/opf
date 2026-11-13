# Definitions only; the outer envelope pins this source before it is loaded.
function Assert-Sh21ShapesBootstrap($Envelope,[string]$NodeExecutable) {
    if($Envelope.schemaVersion -ne 1 -or $Envelope.profile -cne 'sh21-org-windowless-node-shapes-capability-v1' -or $Envelope.timeoutSeconds -ne 45 -or $Envelope.maximumTotalShapes -ne 32 -or $Envelope.actions -isnot [array] -or $Envelope.actions.Count -ne 0 -or $Envelope.source.plan.caseId -cne 'org-chart-3'){throw 'Closed org capability envelope required'}
    foreach($name in @('geometryAcceptance','nativeAcceptance','registryAcceptance')){if($Envelope.$name -isnot [bool] -or $Envelope.$name){throw 'Capability capture is not native acceptance'}}
    $root=$Envelope.controller.directory;$source=$Envelope.source
    if($root -cne $source.controller.directory -or $Envelope.controller.revision -cne $source.controller.revision){throw 'Capability/source controller differs'}
    $old=Join-Path $root 'scripts/native-acceptance/sh21-edit-bootstrap.ps1';$row=@($source.controller.files|Where-Object{$_.path -ceq 'scripts/native-acceptance/sh21-edit-bootstrap.ps1'})
    if($row.Count -ne 1 -or (Get-Item -LiteralPath $old -Force).Length -ne $row[0].bytes -or (Get-FileHash -LiteralPath $old -Algorithm SHA256).Hash.ToLowerInvariant() -cne $row[0].sha256){throw 'Bound existing SH21 bootstrap differs'}
    $cursor=$old;while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased existing bootstrap'};$parent=Split-Path -Parent $cursor;if($parent -ceq $cursor){break};$cursor=$parent}
    . $old
    $verified=Assert-Sh21Bootstrap $source $NodeExecutable;if($verified -cne $root){throw 'Capability source bootstrap root differs'}
    $extra=@('sh21-node-shapes-profile.mjs','sh21-node-shapes-bootstrap.ps1','sh21-node-shapes-actions.ps1','sh21-node-shapes-worker.ps1','run-sh21-node-shapes.ps1','sh21-node-shapes.test.mjs','sh21-node-shapes-check.ps1')|ForEach-Object{'scripts/native-acceptance/'+$_}
    $required=@($source.controller.files|ForEach-Object{$_.path})+@($extra)
    if($Envelope.controller.dirty -isnot [bool] -or $Envelope.controller.dirty -or $Envelope.controller.files -isnot [array] -or $Envelope.controller.files.Count -ne $required.Count){throw 'Exact complete capability closure required'}
    foreach($name in $required){$rows=@($Envelope.controller.files|Where-Object{$_.path -ceq $name});if($rows.Count -ne 1){throw 'Missing/duplicate capability source'};$file=Assert-Sh21Path (Join-Path $root $name);$item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or $item.Length -ne $rows[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $rows[0].sha256){throw 'Capability code changed'}}
    Import-Sh21Definitions $old @('Assert-Sh21Path','Import-Sh21Definitions')
    return $root
}
function Invoke-Sh21ShapesPostflight {
    param([string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[string]$ControllerRoot,[string]$NodeExecutable,[string]$ExecutionEnvelope,[string]$ExpectedEnvelopeSha256)
    $null=Assert-Sh21Path $AdmissionFile
    if($AdmissionFile -cne (Join-Path (Split-Path -Parent $ExecutionEnvelope) 'postflight-admission.json') -or (Get-Item -LiteralPath $AdmissionFile).Length -gt 4194304 -or (Get-FileHash -LiteralPath $AdmissionFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedAdmissionSha256){throw 'Externally bound capability admission differs'}
    $output=Split-Path -Parent $AdmissionFile;$validator=Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-node-shapes-profile.mjs'
    $verified=& $NodeExecutable $validator verify-admission --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
    if($LASTEXITCODE -ne 0){throw 'Capability full source/observations/lifecycle admission refused before observer'};$summary=($verified|Out-String)|ConvertFrom-Json
    $a=Get-Content -LiteralPath $AdmissionFile -Raw -Encoding UTF8|ConvertFrom-Json
    foreach($r in $a.files){$null=Assert-Sh21Path $r.file;if((Get-Item -LiteralPath $r.file).Length -ne $r.bytes -or (Get-FileHash -LiteralPath $r.file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $r.sha256){throw 'Capability source/evidence changed before observer'}}
    $terminal=Get-Content -LiteralPath (Join-Path $output 'native/worker.json') -Raw -Encoding UTF8|ConvertFrom-Json
    foreach($definition in @(Import-OwnedPostflightObserver (Join-Path $ControllerRoot 'scripts/native-acceptance/run-reference-chart-profile.ps1'))){Invoke-Expression $definition}
    function Test-ReferenceWitnessPostflightReady($Terminal,$Report){
        return ($Terminal.timedOut -is [bool] -and -not $Terminal.timedOut -and $Terminal.exitCode -eq 0 -and $Terminal.timeoutSeconds -eq 45 -and $Report.profile -ceq 'sh21-org-windowless-node-shapes-capability-v1' -and $Report.ready.captureCompleted -ceq $true -and $Report.ready.workerCleanupConfirmed -ceq $true -and $Report.ready.opens -eq 1 -and $Report.ready.saves -eq 0 -and $Report.ready.closes -eq 1 -and $Report.ready.quits -eq 1 -and $Report.ready.actions -eq 0 -and $Report.ready.geometryAcceptance -ceq $false -and $Report.ready.connectorCoverage -ceq 'unproven')
    }
    if(-not(Test-ReferenceWitnessPostflightReady $terminal $summary)){throw 'Capability zero-action completion refused before observer'}
    $journal=Join-Path $output 'postflight.jsonl';if(Test-Path -LiteralPath $journal){throw 'Preserve existing capability postflight'}
    $read={try{return @(Get-Process -Name POWERPNT -ErrorAction Stop|ForEach-Object{$_.Id})}catch{if($_.FullyQualifiedErrorId.Split(',')[0] -ceq 'NoProcessFoundForGivenName'){return @()};throw}}
    $watch=[Diagnostics.Stopwatch]::StartNew();$clock={$watch.Elapsed.TotalMilliseconds}.GetNewClosure();$utc={[DateTime]::UtcNow.ToString('o')};$delay={param($ms)[Threading.Thread]::Sleep($ms)};$rows=[Collections.Generic.List[object]]::new()
    $append={param($row)$mode=if($rows.Count -eq 0){[IO.FileMode]::CreateNew}else{[IO.FileMode]::Append};$stream=[IO.File]::Open($journal,$mode,[IO.FileAccess]::Write,[IO.FileShare]::Read);$writer=[IO.StreamWriter]::new($stream,[Text.UTF8Encoding]::new($false));try{$writer.WriteLine(($row|ConvertTo-Json -Compress -Depth 8));$writer.Flush()}finally{$writer.Dispose()};$rows.Add($row)}.GetNewClosure()
    $result=$null;$failure=$null;try{$result=Invoke-ReferenceWitnessPostflight $terminal $summary $read $clock $utc $delay $append}catch{$failure=$_.Exception.Message}
    $identity=$null;if(Test-Path -LiteralPath $journal){$identity=[ordered]@{path='postflight.jsonl';bytes=(Get-Item -LiteralPath $journal).Length;sha256=(Get-FileHash -LiteralPath $journal -Algorithm SHA256).Hash.ToLowerInvariant()}}
    $observed=@($rows|Where-Object{$_.status -ceq 'observed'})
    return [ordered]@{schemaVersion=1;policy=$a.policy;admission=[ordered]@{path=$AdmissionFile;bytes=(Get-Item -LiteralPath $AdmissionFile).Length;sha256=$ExpectedAdmissionSha256};workerCleanupConfirmed=$true;initialCount=if($observed.Count){@($observed[0].processIds).Count}else{$null};finalCount=if($observed.Count){@($observed[$observed.Count-1].processIds).Count}else{$null};error=$failure;result=$result;identity=$identity}
}
