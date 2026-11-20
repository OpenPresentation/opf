# Definitions only. The prospective B07 launcher binds this controller input
# before import; process reads are supplied only by its post-success caller.
function Import-B07PostflightObserver([string]$Path) {
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try { $hash=([BitConverter]::ToString($algorithm.ComputeHash([IO.File]::ReadAllBytes($Path)))).Replace('-','').ToLowerInvariant() } finally { $algorithm.Dispose() }
    if($hash -cne '8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3') { throw 'B07 requires the exact reviewed reference postflight source' }
    $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw 'B07 reviewed postflight source parse failure' }
    foreach($name in @('Test-ReferenceWitnessPostflightInteger','Invoke-ReferenceWitnessPostflight')) {
        $found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
        if($found.Count -ne 1) { throw 'Missing/duplicate reviewed B07 observer definition' }
        # Keep each reviewed body byte-identical; only export its function scope.
        Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
    }
}

# Private B07-schema bridge for the unchanged observer's existing guard call.
# The binding comes from the source-bound pure verify-postflight command, which
# validated actual request/snapshot/report/stage bytes before any process read.
# No reference-controller opens/closes/saveCopies/quits counters are fabricated.
function Test-ReferenceWitnessPostflightReady($Terminal,$Evidence) {
    if($null -eq $Terminal -or $null -eq $Evidence -or $null -eq $Evidence.report -or $null -eq $Evidence.binding) { return $false }
    $report=$Evidence.report;$binding=$Evidence.binding
    if($Terminal.timedOut -isnot [bool] -or $Terminal.timedOut -or -not (Test-ReferenceWitnessPostflightInteger $Terminal.exitCode) -or $Terminal.exitCode -ne 0 -or $Terminal.cleanupConfirmed -isnot [bool] -or -not $Terminal.cleanupConfirmed -or $Terminal.lastDurableStage -cne 'worker.complete' -or $Terminal.lastDurableStatus -cne 'success') { return $false }
    if($report.PSObject.Properties.Name -cnotcontains 'error' -or $null -ne $report.error -or $report.cleanupConfirmed -isnot [bool] -or -not $report.cleanupConfirmed -or $report.officeOperationsStopped -isnot [bool] -or $report.officeOperationsStopped -or $report.lastStage -cne 'worker.complete' -or $report.lastStatus -cne 'success' -or $report.captureTextFonts -isnot [bool] -or -not $report.captureTextFonts -or $report.readOnlySurvey -isnot [bool] -or $report.readOnlySurvey) { return $false }
    if($report.actionPlan.actions -isnot [array] -or $report.actionPlan.actions.Count -ne 0 -or $report.actionPlan.completed -isnot [array] -or $report.actionPlan.completed.Count -ne 0) { return $false }
    foreach($phase in @('original','edited','reopened')) { if($null -eq $report.phases.$phase) { return $false } }
    if(-not (Test-ReferenceWitnessPostflightInteger $binding.schemaVersion) -or $binding.schemaVersion -ne 1 -or $binding.profile -cne 'b07-current-one-case-readonly-v1' -or $binding.nativeAcceptance -isnot [bool] -or $binding.nativeAcceptance -or $binding.ready.workerCleanupConfirmed -isnot [bool] -or -not $binding.ready.workerCleanupConfirmed) { return $false }
    $policy=$binding.policy
    if($policy.policy -cne 'b07-bounded-global-zero-after-completed-owned-quit-v1' -or $policy.observationPolicy -cne 'global-zero-after-completed-owned-quit-v1' -or $policy.budgetMilliseconds -ne 5000 -or $policy.intervalMilliseconds -ne 100 -or $policy.maximumQueries -ne 51 -or $policy.observerSource -cne 'scripts/native-acceptance/run-reference-chart-profile.ps1' -or $policy.observerSourceSha256 -cne '8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3') { return $false }
    foreach($name in @('budgetMilliseconds','intervalMilliseconds','maximumQueries')) { if(-not (Test-ReferenceWitnessPostflightInteger $policy.$name)) { return $false } }
    if(-not (Test-ReferenceWitnessPostflightInteger $binding.ready.stageCount) -or $binding.ready.stageCount -le 0 -or $binding.ready.stageCount -ge 5000) { return $false }
    $expected=@('worker.initialize','application.ownership.presentations.count.get','input.presentation.open','input.presentation.fullName.get','input.presentation.readOnly.get','edited.presentation.saveCopyAs','edited.presentation.close','edited.presentation.cleanup','reopen.presentation.open','reopen.presentation.fullName.get','reopen.presentation.readOnly.get','reopened.presentation.close','reopened.presentation.cleanup','application.cleanup.presentations.count.get','application.cleanup.quit','worker.complete')
    if($binding.ready.lifecycle -isnot [array] -or $binding.ready.lifecycle.Count -ne $expected.Count) { return $false }
    $previous=0
    for($index=0;$index -lt $expected.Count;$index++) {
        $stage=$binding.ready.lifecycle[$index]
        if($stage.stage -cne $expected[$index] -or -not (Test-ReferenceWitnessPostflightInteger $stage.sequence) -or $stage.sequence -le $previous -or $stage.sequence -gt $binding.ready.stageCount) { return $false }
        $previous=$stage.sequence
    }
    return $true
}
