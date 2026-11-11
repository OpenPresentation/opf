# Definitions only; existing target/ownership/latch functions are individually bound imports.
function Save-SevenNativeSnapshot([string]$Phase,[string]$Path) {
    if($script:stopped){throw 'Snapshot operations already stopped'}
    if($Phase -cnotin @('before','edited','reopened') -or $script:report.snapshots.Contains($Phase) -or $Path -cne (Join-Path $script:root ($Phase+'.pptx')) -or (Test-Path -LiteralPath $Path)){Stop-SevenLifecycle 'Fresh exact native snapshot required'}
    $owner=[pscustomobject]@{ownedApp=$script:app;ownedPresentation=$script:presentation;ownedPath=$script:ownedPath}
    Assert-SevenValueTargetOwnership $owner "archive.$Phase"
    Invoke-SevenCom "archive.$Phase.saveCopyAs" {$owner.ownedPresentation.SaveCopyAs($Path,24)}
    $script:report.saveCopies++
    Assert-SevenValueTargetOwnership $owner "archive.$Phase.after"
    $sha=Get-SevenHash $Path;$script:hashes[$Path]=$sha;$script:report.snapshots[$Phase]=[ordered]@{path=$Path;sha256=$sha};Write-SevenReport
}
function Set-SevenSnapshotNumericArray($Action,[string]$ModelSha256,$WireIdentity) {
    if($script:stopped){throw 'Snapshot setter already stopped'}
    Assert-SevenValueAction $Action;Assert-SevenValueActionIdentity $ModelSha256 $WireIdentity
    if($Action.sourceType -cne 'treemap' -or $Action.slideIndex -ne 1 -or $Action.branch -cne 'choice' -or $Action.comChartType -ne 117 -or $script:report.actions.Count -ne 0){Stop-SevenLifecycle 'Only one exact reviewed treemap setter is admitted'}
    if($null -eq $script:report.beforeAdmission -or -not(Test-Path -LiteralPath $script:report.beforeAdmission.path) -or (Get-SevenHash $script:report.beforeAdmission.path) -cne $script:report.beforeAdmission.sha256){Stop-SevenLifecycle 'Actual native-before admission required before setter'}
    $before=Get-Content -LiteralPath $script:report.beforeAdmission.path -Raw -Encoding UTF8 | ConvertFrom-Json
    if($before.sourceFidelityVerified -isnot [bool] -or -not $before.sourceFidelityVerified -or $before.profile -cne 'seven-treemap-setter-native-archives-v1' -or $before.requestSha256 -cne $script:report.requestSha256 -or $before.sourceSha256 -cne $script:report.sourceSha256 -or $before.beforeSha256 -cne $script:report.snapshots.before.sha256){Stop-SevenLifecycle 'Native-before proof belongs to another state/request'}
    $probe=[ordered]@{op=$Action.op;actionModelSha256=$ModelSha256;actionFileIdentity=[ordered]@{bytes=$WireIdentity.bytes;sha256=$WireIdentity.sha256};status='begin';setterAttempts=0};$script:report.actions+=@($probe);Write-SevenReport
    $target=Get-SevenValueTarget $Action 'snapshot.target'
    Assert-SevenValueTargetOwnership $target 'snapshot.setter'
    $probe.setterAttempts=1;Write-SevenReport
    Invoke-SevenCom 'snapshot.series.values.set' {$target.series.Values=[object[]]$Action.newValues}
    $probe.status='setter-success';Write-SevenReport
}
