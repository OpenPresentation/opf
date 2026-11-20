# Definitions only; the outer envelope pins this source before it is loaded.
function Assert-Sh21WindowedBootstrap($Envelope,[string]$NodeExecutable) {
    if($Envelope.schemaVersion -ne 1 -or $Envelope.profile -cne 'sh21-three-case-owned-windowed-qualification-v1' -or $Envelope.timeoutSeconds -ne 45 -or $Envelope.maximumTotalShapes -ne 32 -or $Envelope.mode -cnotin @('org-witness','edit') -or ($Envelope.mode -ceq 'org-witness' -and $Envelope.source.plan.caseId -cne 'org-chart-3')){throw 'Closed org windowed envelope required'}
    foreach($name in @('nativeAcceptance','registryAcceptance')){if($Envelope.$name -isnot [bool] -or $Envelope.$name){throw 'Windowed capture is not native acceptance'}}
    $root=$Envelope.controller.directory;$source=$Envelope.source
    if($root -cne $source.controller.directory -or $Envelope.controller.revision -cne $source.controller.revision){throw 'Windowed/source controller differs'}
    $old=Join-Path $root 'scripts/native-acceptance/sh21-edit-bootstrap.ps1';$row=@($source.controller.files|Where-Object{$_.path -ceq 'scripts/native-acceptance/sh21-edit-bootstrap.ps1'})
    if($row.Count -ne 1 -or (Get-Item -LiteralPath $old -Force).Length -ne $row[0].bytes -or (Get-FileHash -LiteralPath $old -Algorithm SHA256).Hash.ToLowerInvariant() -cne $row[0].sha256){throw 'Bound existing SH21 bootstrap differs'}
    $cursor=$old;while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased existing bootstrap'};$parent=Split-Path -Parent $cursor;if($parent -ceq $cursor){break};$cursor=$parent}
    . $old
    $verified=Assert-Sh21Bootstrap $source $NodeExecutable;if($verified -cne $root){throw 'Windowed source bootstrap root differs'}
    $extra=@('sh21-windowed-profile.mjs','sh21-windowed-bootstrap.ps1','sh21-windowed-actions.ps1','sh21-windowed-worker.ps1','run-sh21-windowed-profile.ps1','sh21-windowed.test.mjs','sh21-windowed-check.ps1')|ForEach-Object{'scripts/native-acceptance/'+$_}
    $required=@($source.controller.files|ForEach-Object{$_.path})+@($extra)
    if($Envelope.controller.dirty -isnot [bool] -or $Envelope.controller.dirty -or $Envelope.controller.files -isnot [array] -or $Envelope.controller.files.Count -ne $required.Count){throw 'Exact complete windowed closure required'}
    foreach($name in $required){$rows=@($Envelope.controller.files|Where-Object{$_.path -ceq $name});if($rows.Count -ne 1){throw 'Missing/duplicate windowed source'};$file=Assert-Sh21Path (Join-Path $root $name);$item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or $item.Length -ne $rows[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $rows[0].sha256){throw 'Windowed code changed'}}
    Import-Sh21Definitions $old @('Assert-Sh21Path','Import-Sh21Definitions')
    return $root
}
function Invoke-Sh21WindowedPostflight {
    param([string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[string]$ControllerRoot,[string]$NodeExecutable,[string]$ExecutionEnvelope,[string]$ExpectedEnvelopeSha256)
    $null=Assert-Sh21Path $AdmissionFile
    if($AdmissionFile -cne (Join-Path (Split-Path -Parent $ExecutionEnvelope) 'postflight-admission.json') -or (Get-Item -LiteralPath $AdmissionFile).Length -gt 4194304 -or (Get-FileHash -LiteralPath $AdmissionFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedAdmissionSha256){throw 'Externally bound windowed admission differs'}
    $output=Split-Path -Parent $AdmissionFile;$validator=Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-windowed-profile.mjs'
    $verified=& $NodeExecutable $validator verify-admission --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
    if($LASTEXITCODE -ne 0){throw 'Windowed full source/observations/lifecycle admission refused before observer'};$summary=($verified|Out-String)|ConvertFrom-Json
    $a=Get-Content -LiteralPath $AdmissionFile -Raw -Encoding UTF8|ConvertFrom-Json
    foreach($r in $a.files){$null=Assert-Sh21Path $r.file;if((Get-Item -LiteralPath $r.file).Length -ne $r.bytes -or (Get-FileHash -LiteralPath $r.file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $r.sha256){throw 'Windowed source/evidence changed before observer'}}
    $terminal=Get-Content -LiteralPath (Join-Path $output 'native/worker.json') -Raw -Encoding UTF8|ConvertFrom-Json
    Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-postflight.ps1') @('Test-Sh21CompletionReady','Test-Sh21WindowedPostflightReady','Invoke-Sh21BoundPostflight','Invoke-Sh21WindowedBoundPostflight')
    $evidence=[ordered]@{admission=$a;request=(Get-Content -LiteralPath (Join-Path $output 'execution-request.json') -Raw -Encoding UTF8|ConvertFrom-Json);report=(Get-Content -LiteralPath (Join-Path $output 'native/report.json') -Raw -Encoding UTF8|ConvertFrom-Json);terminal=$terminal;stages=@(Get-Content -LiteralPath (Join-Path $output 'native/stages.jsonl') -Encoding UTF8|ForEach-Object{$_|ConvertFrom-Json})}
    return Invoke-Sh21WindowedBoundPostflight -Evidence $evidence -AdmissionFile $AdmissionFile -ExpectedAdmissionSha256 $ExpectedAdmissionSha256 -ControllerRoot $ControllerRoot
}
