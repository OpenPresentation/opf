param([Parameter(Mandatory=$true)][string]$FixtureFile)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 required'}
$fixture=Get-Content -LiteralPath $FixtureFile -Raw -Encoding UTF8 | ConvertFrom-Json
if($fixture.synthetic -isnot [bool] -or -not $fixture.synthetic -or $fixture.nativeAcceptance -cne $false){throw 'Explicit synthetic fixture required'}
$controller=$fixture.controllerRoot
. (Join-Path $controller 'scripts/native-acceptance/owned-postflight.ps1')
. (Join-Path $controller 'scripts/native-acceptance/seven-value-postflight.ps1')
function Import-ValuePureDefinitions([string]$File,[string[]]$Names){
    $tokens=$null;$failures=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($File,[ref]$tokens,[ref]$failures)
    if($failures.Count -ne 0){throw 'Actual pure function source parse refusal'}
    foreach($name in $Names){$found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true));if($found.Count -ne 1){throw 'Missing/duplicate actual pure function'};Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')}
}
function Write-ValueSyntheticJson([string]$File,$Value){[IO.File]::WriteAllText($File,($Value | ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))}
function Fresh-ValueEvidence {
    $fresh=(Get-Content -LiteralPath $FixtureFile -Raw -Encoding UTF8 | ConvertFrom-Json).evidence
    # Model actual Write-SevenReport's Double readback values; Node JSON numbers
    # alone do not carry this CLR distinction. Actual-helper proof below verifies it.
    foreach($probe in $fresh.report.probes){if($probe.stage -cmatch '^value\.(original|edited|saved-reopened)\.expected\.\d+$'){$probe.actual=[double]$probe.actual}}
    return $fresh
}
function Persist-ValueSyntheticEvidence($Evidence){
    $output=$Evidence.request.output;$native=$Evidence.request.nativeRoot
    Write-ValueSyntheticJson (Join-Path $output 'execution-request.json') $Evidence.request
    $requestSha=Get-OwnedPostflightHash (Join-Path $output 'execution-request.json');$Evidence.report.requestSha256=$requestSha;$Evidence.admission.requestSha256=$requestSha
    Write-ValueSyntheticJson (Join-Path $native 'report.json') $Evidence.report;Write-ValueSyntheticJson (Join-Path $native 'worker.json') $Evidence.terminal
    $wire=(($Evidence.stages | ForEach-Object {$_ | ConvertTo-Json -Compress -Depth 12}) -join [Environment]::NewLine)+[Environment]::NewLine
    [IO.File]::WriteAllText((Join-Path $native 'stages.jsonl'),$wire,[Text.UTF8Encoding]::new($false))
    # Keep metadata coherently rebound so semantic mutations reach actual guards.
    $Evidence.admission.ready.stageCount=$Evidence.stages.Count
    $Evidence.admission.ready.lifecycle=@($Evidence.stages | Where-Object {$_.status -ceq 'success'} | ForEach-Object {[ordered]@{stage=$_.stage;sequence=$_.sequence}})
    foreach($record in $Evidence.admission.files){$record.bytes=(Get-Item -LiteralPath $record.file).Length;$record.sha256=Get-OwnedPostflightHash $record.file}
    Write-ValueSyntheticJson $fixture.admissionFile $Evidence.admission
}
$oldProcess=Get-Item -LiteralPath 'Function:\global:Get-Process' -ErrorAction SilentlyContinue
$oldReady=Get-Item -LiteralPath 'Function:\global:Test-ReferenceWitnessPostflightReady' -ErrorAction SilentlyContinue
$script:globalReadyCalls=0;$script:processCallbacks=0;$script:mode='forbidden'
function global:Test-ReferenceWitnessPostflightReady {$script:globalReadyCalls++;throw 'Global/old readiness must not be resolved'}
function global:Get-Process {
    [CmdletBinding()]param([string]$Name)
    if($Name -cne 'POWERPNT'){throw 'Unexpected process-name query'};$script:processCallbacks++
    if($script:mode -ceq 'zero'){return @()};if($script:mode -ceq 'busy'){return [pscustomobject]@{Id=11}}
    $id=if($script:mode -ceq 'no-process'){'NoProcessFoundForGivenName'}elseif($script:mode -ceq 'foreign-no-process-prefix'){'NoProcessFoundForGivenNameUnexpected'}else{'AccessDenied'}
    $record=[Management.Automation.ErrorRecord]::new([InvalidOperationException]::new('Synthetic enumeration outcome'),$id,[Management.Automation.ErrorCategory]::ObjectNotFound,$Name)
    $PSCmdlet.ThrowTerminatingError($record)
}
$controls=0;$passed=$false
try {
    Import-ValuePureDefinitions (Join-Path $controller 'scripts/native-acceptance/seven-chart-worker.ps1') @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation')
    Import-ValuePureDefinitions (Join-Path $controller 'scripts/native-acceptance/seven-value-worker.ps1') @('Assert-SevenValueOfficeIdle')
    foreach($mode in @('zero','no-process','busy','enumeration-fault','foreign-no-process-prefix')){
        $script:mode=$mode;$script:root=Join-Path $fixture.root ('strict-preflight-'+$mode);[void](New-Item -ItemType Directory -Path $script:root)
        $script:sequence=0;$script:stopped=$false;$script:cleanup=$true;$script:report=[ordered]@{probes=@();officeOperationsStopped=$false;cleanupConfirmed=$true;lastStage=$null;lastStatus=$null}
        $before=$script:processCallbacks;$factoryStatements=0;$failure=$null
        try{Assert-SevenValueOfficeIdle;$factoryStatements++}catch{$failure=$_.Exception.Message}
        $refuse=$mode -cnotin @('zero','no-process')
        if(($null -ne $failure) -ne $refuse -or $script:processCallbacks -ne $before+1 -or $factoryStatements -ne $(if($refuse){0}else{1})){throw ('Strict preflight failed: '+$mode)}
        if($refuse){$before=$script:processCallbacks;try{Invoke-SevenCom 'after-fault' {Get-Process -Name POWERPNT}}catch{};if($script:processCallbacks -ne $before -or -not $script:stopped){throw 'Preflight fault permitted a later query'}}
        $controls++
    }
    $script:mode='forbidden'
    # REAL bound reader/readback/writer over ordinary managed numeric values.
    Import-ValuePureDefinitions (Join-Path $controller 'scripts/native-acceptance/seven-value-actions.ps1') @('Assert-SevenValueTargetOwnership','Read-SevenValueArray','Assert-SevenValueReadback')
    $script:root=Join-Path $fixture.root 'real-numeric-proof';[void](New-Item -ItemType Directory -Path $script:root)
    $script:sequence=0;$script:stopped=$false;$script:cleanup=$false;$script:report=[ordered]@{probes=@();actions=@();officeOperationsStopped=$false;cleanupConfirmed=$false;lastStage=$null;lastStatus=$null}
    $script:app=[object]::new();$script:ownedApp=$script:app;$script:presentation=[pscustomobject]@{FullName='managed-numeric';ReadOnly=-1};$script:ownedPresentation=$script:presentation;$script:ownedPath='managed-numeric'
    $expected=@([int]6,[decimal]6.25,[long]7,[double]0.125);$probe=[ordered]@{observedKind=$null;observedRank=$null;observedLength=$null;observedValues=@()}
    $target=[pscustomobject]@{ownedApp=$script:app;ownedPresentation=$script:presentation;ownedPath=$script:ownedPath;series=[pscustomobject]@{Values=$expected}}
    $actual=Read-SevenValueArray $target 'original' $probe;Assert-SevenValueReadback $actual $expected 'value.original.expected';Write-SevenReport
    $actualProof=@((Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json).probes | Where-Object {$_.stage -cmatch '^value\.original\.expected\.'})
    $context=Fresh-ValueEvidence;$context.request.selectedCase.action.expectedValues=$expected
    $expectedProof=@(Get-SevenValueCriticalProbes $context.report $context.request.selectedCase.action | Where-Object {$_.stage -cmatch '^value\.original\.expected\.'})
    for($i=0;$i -lt 4;$i++){foreach($field in @('stage','expected','actual','matched')){if(($actualProof[$i].$field | ConvertTo-Json -Compress) -cne ($expectedProof[$i].$field | ConvertTo-Json -Compress)){throw 'Actual numeric reader/writer proof differs from typed recomputation'}}};$controls++
    foreach($mutation in @('valid','missing-proof','duplicate-proof','reordered-proof','false-actual-proof','false-expected-proof','extra-proof-key','wrong-readback-proof','missing-preflight-proof','failed-worker','timed-out','cleanup-false','nonempty-error','sequence-gap','missing-stage','extra-stage','setter-readonly','preflight-nonzero','second-setter','stale-reopened','wrong-wire','foreign-profile','policy-change')){
        $e=Fresh-ValueEvidence;$r=$e.report;$s=$e.stages;$p=@($r.probes | Where-Object {$_.stage -ceq 'value.setter.capturedRefs'})[0];$index=[Array]::IndexOf($r.probes,$p)
        if($mutation -ceq 'missing-proof'){$r.probes=@($r.probes | Where-Object {$_ -ne $p})}
        if($mutation -ceq 'duplicate-proof'){$r.probes=@($r.probes[0..$index]) + @($p) + @($r.probes[($index+1)..($r.probes.Count-1)])}
        if($mutation -ceq 'reordered-proof'){$swap=$r.probes[$index];$r.probes[$index]=$r.probes[$index+1];$r.probes[$index+1]=$swap}
        if($mutation -ceq 'false-actual-proof'){$p.actual=$false};if($mutation -ceq 'false-expected-proof'){$p.expected='foreign'};if($mutation -ceq 'extra-proof-key'){$p | Add-Member -NotePropertyName unknown -NotePropertyValue $true}
        if($mutation -ceq 'wrong-readback-proof'){($r.probes | Where-Object {$_.stage -ceq 'value.edited.expected.0'}).actual=[double]42}
        if($mutation -ceq 'missing-preflight-proof'){$r.probes=@($r.probes | Where-Object {$_.stage -cne 'preflight.globalIdle'})}
        if($mutation -ceq 'failed-worker'){$e.terminal.exitCode=1};if($mutation -ceq 'timed-out'){$e.terminal.timedOut=$true};if($mutation -ceq 'cleanup-false'){$r.cleanupConfirmed=$false}
        if($mutation -ceq 'nonempty-error'){$s[0].error='fault'};if($mutation -ceq 'sequence-gap'){$s[0].sequence=2};if($mutation -ceq 'missing-stage'){$e.stages=@($s[0..($s.Count-2)])};if($mutation -ceq 'extra-stage'){$e.stages+=@($s[-1])}
        if($mutation -ceq 'setter-readonly'){($s | Where-Object {$_.stage -ceq 'value.setter.readOnly' -and $_.status -ceq 'success'}).value=0};if($mutation -ceq 'preflight-nonzero'){($s | Where-Object {$_.stage -ceq 'preflight.globalIdle' -and $_.status -ceq 'success'}).value=1}
        if($mutation -ceq 'second-setter'){$r.actions[0].setterAttempts=2};if($mutation -ceq 'stale-reopened'){$r.actions[0].reopened[0]=42};if($mutation -ceq 'wrong-wire'){$r.actions[0].actionFileIdentity.sha256='0'*64};if($mutation -ceq 'foreign-profile'){$e.admission.profile='foreign'};if($mutation -ceq 'policy-change'){$e.admission.policy.maximumQueries=52}
        Persist-ValueSyntheticEvidence $e
        $io=@{reads=0;clocks=0;appends=0;rows=[Collections.Generic.List[object]]::new()};$failure=$null;$result=$null
        try{$result=Invoke-SevenValueBoundPostflight -Evidence $e -ControllerRoot $controller -AdmissionFile $fixture.admissionFile -ExpectedAdmissionSha256 (Get-OwnedPostflightHash $fixture.admissionFile) -ReadProcesses {$io.reads++;return @()} -Clock {$io.clocks++;return 0.0} -Utc {return '2000-01-01T00:00:00.000Z'} -Delay {param($ms) throw 'First zero does not delay'} -Append {param($row) $io.appends++;$io.rows.Add($row)}}catch{$failure=$_.Exception.Message}
        if($mutation -ceq 'valid'){if($null -ne $failure -or $io.reads -ne 1 -or $result.result.observedZero -cne $true){throw 'Valid bound typed bridge failed'}}elseif($null -eq $failure -or $io.reads -ne 0 -or $io.clocks -ne 0 -or $io.appends -ne 0){throw ('Malformed typed evidence reached observer IO: '+$mutation)}
        $controls++
    }
    foreach($scenario in @('first-zero','one-to-zero','new-ID','query-fault','deadline','query-ceiling','append-fault')){
        $e=Fresh-ValueEvidence;Persist-ValueSyntheticEvidence $e;$io=@{reads=0;clocks=0;appends=0;rows=[Collections.Generic.List[object]]::new()}
        $read={$io.reads++;if($scenario -ceq 'query-fault'){throw 'Injected query failure'};if($scenario -ceq 'one-to-zero'){if($io.reads -eq 1){return @(11)};return @()};if($scenario -ceq 'new-ID'){if($io.reads -eq 1){return @(11)};return @(12)};if($scenario -ceq 'query-ceiling'){return @(11)};return @()}
        $clock={$io.clocks++;if($scenario -ceq 'deadline' -and $io.clocks -gt 1){return 5000.0};return 0.0}
        $append={param($row) $io.appends++;if($scenario -ceq 'append-fault'){throw 'Injected append failure'};$io.rows.Add($row)}
        $result=Invoke-SevenValueBoundPostflight -Evidence $e -ControllerRoot $controller -AdmissionFile $fixture.admissionFile -ExpectedAdmissionSha256 (Get-OwnedPostflightHash $fixture.admissionFile) -ReadProcesses $read -Clock $clock -Utc {return '2000-01-01T00:00:00.000Z'} -Delay {param($ms) if($ms -ne 100){throw 'Fixed delay changed'}} -Append $append
        $success=$scenario -cin @('first-zero','one-to-zero');if(($null -eq $result.error) -ne $success){throw ('Wrong same-kernel bridge outcome: '+$scenario)}
        $expectedReads=if($scenario -ceq 'deadline'){0}elseif($scenario -ceq 'query-ceiling'){51}elseif($scenario -cin @('one-to-zero','new-ID')){2}else{1}
        if($io.reads -ne $expectedReads -or $io.reads -gt 51){throw 'Bridge exceeded fixed query bound'}
        if($scenario -ceq 'one-to-zero' -and ($io.rows.Count -ne 2 -or $io.rows[0].processIds[0] -ne 11 -or $result.result.initialCount -ne 1 -or $result.initialCount -ne 1 -or $result.finalCount -ne 0)){throw 'Immediate first nonzero sample or delegated row counters lost'}
        if($scenario -ceq 'append-fault' -and $io.appends -ne 1){throw 'Append fault retried'};$controls++
    }
    # Omit ReadProcesses: exercise the ACTUAL new default delegate against the
    # global mock, including unknown-prefix enumeration faults. No real query.
    foreach($mode in @('zero','no-process','foreign-no-process-prefix','enumeration-fault','busy')){
        $e=Fresh-ValueEvidence;Persist-ValueSyntheticEvidence $e;$script:mode=$mode;$before=$script:processCallbacks;$io=@{clocks=0;rows=[Collections.Generic.List[object]]::new()}
        $result=Invoke-SevenValueBoundPostflight -Evidence $e -ControllerRoot $controller -AdmissionFile $fixture.admissionFile -ExpectedAdmissionSha256 (Get-OwnedPostflightHash $fixture.admissionFile) -Clock {$io.clocks++;return 0.0} -Utc {return '2000-01-01T00:00:00.000Z'} -Delay {param($ms) if($ms -ne 100){throw 'Fixed interval changed'}} -Append {param($row) $io.rows.Add($row)}
        $success=$mode -cin @('zero','no-process');if(($null -eq $result.error) -ne $success){throw ('Actual default process delegate outcome differs: '+$mode)}
        $expectedQueries=if($mode -ceq 'busy'){51}else{1};if($script:processCallbacks -ne $before+$expectedQueries){throw 'Default delegate queried again after failure or exceeded cap'}
        if($success -and ($result.result.observedZero -cne $true -or $result.initialCount -ne 0 -or $result.finalCount -ne 0)){throw 'Actual default no-process observation is not first-zero'}
        if($mode -ceq 'busy' -and ($result.initialCount -ne 1 -or $io.rows[0].processIds[0] -ne 11)){throw 'Default delegate lost first nonzero sample'};$controls++
    }
    $script:mode='forbidden'
    # Public/default reader refusals occur before any Node/observer invocation.
    foreach($mutation in @('wire-pin','missing-stage','snapshot-hash','file-hash','foreign-root')){
        $e=Fresh-ValueEvidence;$e.request.controller.directory=$controller;Persist-ValueSyntheticEvidence $e
        if($mutation -ceq 'missing-stage'){$e.admission.files=@($e.admission.files | Where-Object {$_.file -cne (Join-Path $e.request.nativeRoot 'stages.jsonl')})}
        if($mutation -ceq 'snapshot-hash'){$e.request.snapshots[0].sha256='0'*64;Persist-ValueSyntheticEvidence $e}
        if($mutation -ceq 'file-hash'){$e.admission.files[0].sha256='0'*64}
        if($mutation -ceq 'foreign-root'){$e.request.nativeRoot=Join-Path $e.request.output 'foreign';Write-ValueSyntheticJson (Join-Path $e.request.output 'execution-request.json') $e.request;foreach($record in $e.admission.files){$record.bytes=(Get-Item -LiteralPath $record.file).Length;$record.sha256=Get-OwnedPostflightHash $record.file}}
        Write-ValueSyntheticJson $fixture.admissionFile $e.admission;$sha=if($mutation -ceq 'wire-pin'){'0'*64}else{Get-OwnedPostflightHash $fixture.admissionFile};$io=@{reads=0;clocks=0};$failure=$null
        try{Invoke-SevenValuePostflight -AdmissionFile $fixture.admissionFile -ExpectedAdmissionSha256 $sha -ControllerRoot $controller -ReadProcesses {$io.reads++;throw 'Forbidden query'} -Clock {$io.clocks++;return 0.0} | Out-Null}catch{$failure=$_.Exception.Message}
        if($null -eq $failure -or $io.reads -ne 0 -or $io.clocks -ne 0){throw 'Default reader did not stop before observer'}
        if($failure -notmatch 'admission differs|Raw stages|raw stages|snapshot identity|evidence changed|request/output'){throw ('Default reader failed for an unrelated reason: '+$failure)};$controls++
    }
    if($script:globalReadyCalls -ne 0){throw 'Old/global ready function was used'}
    $passed=$true;[ordered]@{controls=$controls;failed=0;mockProcessCallbacks=$script:processCallbacks;realProcessQueries=0;officeActions=0;scope='Synthetic owned-record/typed bridge and actual managed functions; no native acceptance'} | ConvertTo-Json -Compress
}finally{
    if($null -ne $oldProcess){Set-Item -LiteralPath 'Function:\global:Get-Process' -Value $oldProcess.ScriptBlock}else{Remove-Item -LiteralPath 'Function:\global:Get-Process' -ErrorAction SilentlyContinue}
    if($null -ne $oldReady){Set-Item -LiteralPath 'Function:\global:Test-ReferenceWitnessPostflightReady' -Value $oldReady.ScriptBlock}else{Remove-Item -LiteralPath 'Function:\global:Test-ReferenceWitnessPostflightReady' -ErrorAction SilentlyContinue}
    if(-not $passed){[Console]::Error.WriteLine('Preserved failed managed Seven-value fixture: '+$FixtureFile)}
}
