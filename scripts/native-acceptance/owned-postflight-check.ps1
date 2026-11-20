param([Parameter(Mandatory=$true)][string]$NodeExecutable)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { throw 'Actual Windows PowerShell 5.1 is required' }
. (Join-Path $PSScriptRoot 'owned-postflight.ps1')
$observer=Join-Path $PSScriptRoot 'run-reference-chart-profile.ps1'
function Invoke-SyntheticObserverCase($Case) {
    foreach($definition in @(Import-OwnedPostflightObserver $observer)) { Invoke-Expression $definition }
    function Test-ReferenceWitnessPostflightReady($Terminal,$Report) { return $Terminal.syntheticReady -ceq $true }
    $state=@{reads=0;clocks=0;appends=0;delays=0;rows=[Collections.Generic.List[object]]::new()}
    $clockValues=if($null -ne $Case.clocks){$Case.clocks}else{@(0.0,0.0,0.0,0.0)}
    $clock={ $index=[Math]::Min($state.clocks,$clockValues.Count-1);$state.clocks++;return $clockValues[$index] }
    $read={
        $state.reads++
        if($Case.name -cin @('query-fault','failure-append-fault')) {throw 'Synthetic process callback failure'}
        if($Case.name -ceq 'duplicate-ID') {return @(11,11)}
        if($Case.name -ceq 'invalid-ID') {return @(-1)}
        if($Case.name -ceq 'new-ID') {if($state.reads -eq 1){return @(11)}else{return @(12)}}
        if($Case.name -ceq 'subset-to-zero') {if($state.reads -eq 1){return @(11,12)}elseif($state.reads -eq 2){return @(11)}else{return @()}}
        if($Case.name -cin @('query-ceiling','nonzero-deadline')) {return @(11)}
        return @()
    }
    $utc={if($Case.name -ceq 'invalid-UTC'){return 'invalid'};return '2000-01-01T00:00:00.000Z'}
    $delay={param($ms) if($ms -ne 100){throw 'Observer changed fixed interval'};$state.delays++}
    $append={
        param($row)
        $state.appends++
        if($Case.name -cin @('append-fault','failure-append-fault')) {throw 'Synthetic append failure'}
        $state.rows.Add($row)
    }
    $scenarioFailure=$null;$result=$null
    try {$result=Invoke-ReferenceWitnessPostflight @{syntheticReady=($Case.name -cne 'not-ready')} @{} $read $clock $utc $delay $append} catch {$scenarioFailure=$_.Exception.Message}
    if(($null -ne $scenarioFailure) -ne $Case.refuse) {throw ('Wrong synthetic outcome: '+$Case.name)}
    if($state.reads -ne $Case.reads -or $state.reads -gt 51) {throw ('Wrong query count: '+$Case.name)}
    if(-not $Case.refuse -and ($result.observedZero -cne $true -or $result.officeActions -ne 0)) {throw 'Synthetic zero result differs'}
    if($Case.name -ceq 'not-ready' -and ($state.clocks -ne 0 -or $state.appends -ne 0)) {throw 'Refused admission touched IO'}
    if($Case.name -ceq 'append-fault' -and $state.appends -ne 1) {throw 'Append fault was blindly retried'}
    if($Case.name -ceq 'subset-to-zero' -and (($state.rows[0].processIds -join ',') -cne '11,12' -or $state.rows.Count -ne 3 -or $result.initialCount -ne 2)) {throw 'First nonzero/all samples not retained'}
}
$cases=@(
    @{name='first-zero';refuse=$false;reads=1},
    @{name='subset-to-zero';refuse=$false;reads=3;clocks=@(0.0,0.0,1.0,2.0,100.0,101.0,102.0,200.0,201.0,202.0)},
    @{name='new-ID';refuse=$true;reads=2;clocks=@(0.0,0.0,0.0,0.0,100.0,100.0,100.0)},
    @{name='query-fault';refuse=$true;reads=1},
    @{name='invalid-ID';refuse=$true;reads=1},
    @{name='duplicate-ID';refuse=$true;reads=1},
    @{name='invalid-start-clock';refuse=$true;reads=0;clocks=@([double]::NaN)},
    @{name='backward-clock';refuse=$true;reads=0;clocks=@(10.0,9.0)},
    @{name='invalid-UTC';refuse=$true;reads=1},
    @{name='deadline-before-query';refuse=$true;reads=0;clocks=@(0.0,5000.0)},
    @{name='late-zero-query';refuse=$true;reads=1;clocks=@(0.0,0.0,5000.0)},
    @{name='late-zero-append';refuse=$true;reads=1;clocks=@(0.0,0.0,1.0,5000.0)},
    @{name='append-fault';refuse=$true;reads=1},
    @{name='failure-append-fault';refuse=$true;reads=1},
    @{name='query-ceiling';refuse=$true;reads=51},
    @{name='nonzero-deadline';refuse=$true;reads=1;clocks=@(0.0,0.0,1.0,2.0,5000.0)},
    @{name='not-ready';refuse=$true;reads=0}
)
foreach($case in $cases) {Invoke-SyntheticObserverCase $case}
[ordered]@{controls=$cases.Count;failed=0;hostMajor=5;hostMinor=1;realProcessQueries=0;officeActions=0} | ConvertTo-Json -Compress

