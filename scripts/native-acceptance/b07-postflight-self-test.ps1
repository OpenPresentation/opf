$ErrorActionPreference='Stop'
# Only definitions and injected callbacks are executed. No launcher, worker,
# Office creation, process discovery, real delay, window lookup or cleanup.
. (Join-Path $PSScriptRoot 'b07-postflight.ps1')
Import-B07PostflightObserver (Join-Path $PSScriptRoot 'run-reference-chart-profile.ps1')
function Require-B07($Condition,[string]$Message) { if(-not $Condition) { throw $Message } }
function New-B07Terminal { return ('{"timedOut":false,"exitCode":0,"cleanupConfirmed":true,"lastDurableStage":"worker.complete","lastDurableStatus":"success"}' | ConvertFrom-Json) }
function New-B07Evidence {
    $report='{"cleanupConfirmed":true,"officeOperationsStopped":false,"error":null,"lastStage":"worker.complete","lastStatus":"success","captureTextFonts":true,"readOnlySurvey":false,"actionPlan":{"actions":[],"completed":[]},"phases":{"original":{},"edited":{},"reopened":{}}}' | ConvertFrom-Json
    $policy=[ordered]@{policy='b07-bounded-global-zero-after-completed-owned-quit-v1';observationPolicy='global-zero-after-completed-owned-quit-v1';budgetMilliseconds=5000;intervalMilliseconds=100;maximumQueries=51;observerSource='scripts/native-acceptance/run-reference-chart-profile.ps1';observerSourceSha256='8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3'}
    $names=@('worker.initialize','application.ownership.presentations.count.get','input.presentation.open','input.presentation.fullName.get','input.presentation.readOnly.get','edited.presentation.saveCopyAs','edited.presentation.close','edited.presentation.cleanup','reopen.presentation.open','reopen.presentation.fullName.get','reopen.presentation.readOnly.get','reopened.presentation.close','reopened.presentation.cleanup','application.cleanup.presentations.count.get','application.cleanup.quit','worker.complete')
    $lifecycle=@();for($index=0;$index -lt $names.Count;$index++) { $lifecycle+=@([pscustomobject]@{stage=$names[$index];sequence=($index+1)}) }
    return [pscustomobject]@{report=$report;binding=[pscustomobject]@{schemaVersion=1;profile='b07-current-one-case-readonly-v1';nativeAcceptance=$false;policy=[pscustomobject]$policy;ready=[pscustomobject]@{workerCleanupConfirmed=$true;stageCount=$names.Count;lifecycle=$lifecycle}}}
}
$mutations=@(
    {param($t,$e) $t.timedOut=$true},
    {param($t,$e) $t.exitCode='0'},
    {param($t,$e) $t.cleanupConfirmed=$false},
    {param($t,$e) $t.lastDurableStage='worker.failure'},
    {param($t,$e) $t.lastDurableStatus='begin'},
    {param($t,$e) $e.report.error='COM failure'},
    {param($t,$e) $e.report.error=''},
    {param($t,$e) $e.report.PSObject.Properties.Remove('error')},
    {param($t,$e) $e.report.officeOperationsStopped=$true},
    {param($t,$e) $e.report.cleanupConfirmed=1},
    {param($t,$e) $e.report.lastStatus='begin'},
    {param($t,$e) $e.report.captureTextFonts=$false},
    {param($t,$e) $e.report.readOnlySurvey=$true},
    {param($t,$e) $e.report.actionPlan.actions=@('unexpected')},
    {param($t,$e) $e.report.actionPlan.completed=@('unexpected')},
    {param($t,$e) $e.report.phases.edited=$null},
    {param($t,$e) $e.binding.nativeAcceptance=$true},
    {param($t,$e) $e.binding.ready.workerCleanupConfirmed=$false},
    {param($t,$e) $e.binding.ready.stageCount=0},
    {param($t,$e) $e.binding.ready.stageCount=5000},
    {param($t,$e) $e.binding.ready.lifecycle[0].stage='not-initialized'},
    {param($t,$e) $e.binding.ready.lifecycle[1].sequence=1},
    {param($t,$e) $e.binding.policy.budgetMilliseconds=5001},
    {param($t,$e) $e.binding.policy.budgetMilliseconds='5000'},
    {param($t,$e) $e.binding.policy.observerSourceSha256=('0'*64)}
)
$guardRefusals=0
foreach($mutate in $mutations) {
    $terminal=New-B07Terminal;$evidence=New-B07Evidence;& $mutate $terminal $evidence
    $script:queries=0;$caught=$false
    try { Invoke-ReferenceWitnessPostflight $terminal $evidence {$script:queries++} {0} {'2026-11-10T00:00:00Z'} {throw 'Unexpected delay'} {throw 'Unexpected append'} | Out-Null }
    catch { $caught=$true }
    Require-B07 ($caught -and $script:queries -eq 0) 'B07 invalid worker/evidence reached a process read'
    $guardRefusals++
}
$scenarios=0
foreach($name in @('immediate-zero','delayed-zero','persistent','new-pid','query-fault','late-zero','append-fault','late-append')) {
    $state=[pscustomobject]@{time=0.0;queries=0;delays=0;rows=[Collections.Generic.List[object]]::new()}
    $result=$null;$scenarioFailure=$null
    try {
        $result=Invoke-ReferenceWitnessPostflight (New-B07Terminal) (New-B07Evidence) {
            $state.queries++
            switch($name) {
                'delayed-zero' { if($state.queries -le 2) {12345} }
                'persistent' {12345}
                'new-pid' {if($state.queries -eq 1){12345}else{99999}}
                'query-fault' {throw 'injected query failure'}
                'late-zero' {$state.time=5000.0}
            }
        } {$state.time} {([DateTime]::Parse('2026-11-10T00:00:00Z').ToUniversalTime().AddMilliseconds($state.time)).ToString('o')} {
            param($milliseconds) Require-B07 ($milliseconds -eq 100) 'Changed cadence';$state.delays++;$state.time+=100
        } {
            param($row)
            if($name -eq 'append-fault') {throw 'injected append failure'}
            $state.rows.Add($row)
            if($name -eq 'late-append') {$state.time=5000.0}
        }
    } catch {$scenarioFailure=$_.Exception.Message}
    switch($name) {
        'immediate-zero' {Require-B07 ($null -eq $scenarioFailure -and $state.queries -eq 1 -and $state.delays -eq 0 -and $result.initialCount -eq 0) 'Immediate zero changed'}
        'delayed-zero' {Require-B07 ($null -eq $scenarioFailure -and $state.queries -eq 3 -and $state.rows[0].processIds[0] -eq 12345 -and $result.initialCount -eq 1 -and $result.finalCount -eq 0 -and $result.elapsedMilliseconds -eq 200) 'Initial nonzero was lost'}
        'persistent' {Require-B07 ($null -ne $scenarioFailure -and $state.queries -eq 50 -and $state.time -eq 5000) 'Persistent nonzero did not stop'}
        'new-pid' {Require-B07 ($null -ne $scenarioFailure -and $state.queries -eq 2 -and $state.rows[1].processIds[0] -eq 99999) 'New PID did not stop'}
        default {Require-B07 ($null -ne $scenarioFailure -and $state.queries -eq 1 -and $state.delays -eq 0) 'Postflight fault caused another process read or wait'}
    }
    $scenarios++
}
[ordered]@{schemaVersion=1;guardRefusals=$guardRefusals;scenarios=$scenarios;officeActivated=$false;processQueriesAreInjected=$true;scope='B07 actual-schema guard and exact reviewed observer with injected process/clock/append callbacks only'} | ConvertTo-Json -Compress
