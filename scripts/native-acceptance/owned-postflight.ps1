# Definitions only. No Office/process query or executable launcher import here.
function Get-OwnedPostflightHash([string]$Path) {
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash([IO.File]::ReadAllBytes($Path)))).Replace('-','').ToLowerInvariant() } finally { $algorithm.Dispose() }
}
function Assert-OwnedPostflightPath([string]$Path) {
    if([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path) -or $Path -match '[\x00-\x1f]' -or $Path.StartsWith('\\') -or [IO.Path]::GetFullPath($Path) -cne $Path) { throw 'Canonical local postflight path required' }
    $cursor=$Path
    while($cursor) {
        $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Aliased postflight path' }
        $parent=Split-Path -Parent $cursor;if($parent -ceq $cursor) { break };$cursor=$parent
    }
}
function Test-OwnedPostflightKeys($Record,[string[]]$Names) {
    if($null -eq $Record) { return $false }
    return (($Record.PSObject.Properties.Name | Sort-Object) -join '|') -ceq (($Names | Sort-Object) -join '|')
}
function Test-OwnedPostflightInteger($Value) { return ($Value -is [int] -or $Value -is [long]) }
function Test-OwnedPostflightPrimitive([object]$Value) {
    if($Value -is [System.Array]) {return $false}
    if([object]::ReferenceEquals($null,$Value) -or $Value -is [string] -or $Value -is [bool]) {return $true}
    if($Value -is [double]) {return (-not [double]::IsNaN($Value) -and -not [double]::IsInfinity($Value))}
    if($Value -is [single]) {return (-not [single]::IsNaN($Value) -and -not [single]::IsInfinity($Value))}
    # Integral and decimal CLR values are always finite. Never cast strings,
    # inspect object members, or return a replacement/normalized value.
    return ($Value -is [sbyte] -or $Value -is [byte] -or $Value -is [int16] -or $Value -is [uint16] -or
        $Value -is [int] -or $Value -is [uint32] -or $Value -is [long] -or $Value -is [uint64] -or $Value -is [decimal])
}
function Test-OwnedPostflightStageWire($Stages) {
    if($Stages -isnot [array] -or $Stages.Count -lt 1 -or $Stages.Count -gt 5000) { return $false }
    $last=[DateTimeOffset]::MinValue
    for($i=0;$i -lt $Stages.Count;$i++) {
        $s=$Stages[$i]
        $fields=@('sequence','timestamp','stage','status','value','error','officeOperationsStopped','cleanupConfirmed')
        if($s.PSObject.Properties.Name -ccontains 'ownedPresentationPath') {$fields+=@('ownedPresentationPath')}
        if(-not (Test-OwnedPostflightKeys $s $fields)) {return $false}
        if(-not (Test-OwnedPostflightInteger $s.sequence) -or $s.sequence -ne ($i+1) -or $s.status -cnotin @('begin','success') -or $s.officeOperationsStopped -isnot [bool] -or $s.officeOperationsStopped -or $s.cleanupConfirmed -isnot [bool]) { return $false }
        if($s.PSObject.Properties.Name -cnotcontains 'value' -or -not (Test-OwnedPostflightPrimitive $s.value)) { return $false }
        if($s.PSObject.Properties.Name -cnotcontains 'error' -or ($null -ne $s.error -and ($s.error -isnot [string] -or $s.error -cne ''))) { return $false }
        if($s.timestamp -isnot [string] -or $s.timestamp -cnotmatch 'Z$') { return $false }
        try { $stamp=[DateTimeOffset]::Parse($s.timestamp,[Globalization.CultureInfo]::InvariantCulture) } catch { return $false }
        if($stamp -lt $last) { return $false };$last=$stamp
    }
    return $true
}
function Test-OwnedPostflightOperations($Stages,[string[]]$Names) {
    if(-not (Test-OwnedPostflightStageWire $Stages)) { return $false }
    $expected=[Collections.Generic.List[object]]::new()
    foreach($name in $Names) {
        if($name.StartsWith('worker.')) { $expected.Add(@{stage=$name;status='success'}) }
        else { $expected.Add(@{stage=$name;status='begin'});$expected.Add(@{stage=$name;status='success'}) }
    }
    if($expected.Count -ne $Stages.Count) { return $false }
    for($i=0;$i -lt $expected.Count;$i++) { if($Stages[$i].stage -cne $expected[$i].stage -or $Stages[$i].status -cne $expected[$i].status) { return $false } }
    return $true
}
function Get-OwnedPostflightSuccess($Stages,[string]$Name) {
    if($Stages -is [Collections.IDictionary]) { if(-not $Stages.Contains($Name)) {throw 'Missing actual operation'};return $Stages[$Name] }
    $matches=@($Stages | Where-Object {$_.stage -ceq $Name -and $_.status -ceq 'success'})
    if($matches.Count -ne 1) { throw 'Missing/duplicate actual completed operation' }
    return $matches[0]
}
function Test-OwnedPostflightCommonReady($Terminal,$Evidence,[string]$Profile,[string]$Policy,[int]$Opens,[int]$Saves,[int]$Closes,[int]$Edits) {
    try {
        $a=$Evidence.admission;$r=$Evidence.report;$q=$Evidence.request;$p=$a.policy
        foreach($record in @($a,$r,$q)) {if(-not (Test-OwnedPostflightInteger $record.schemaVersion)) {return $false}}
        if(-not (Test-OwnedPostflightKeys $q @('schemaVersion','profile','policy','envelopeSha256','output','node','controller','generation','snapshots','timeoutSeconds','runOfficeRequested','selectedCase','workerPath','nativeRoot','workerArguments','nativeAcceptance','registryAcceptance'))) {return $false}
        if($q.nativeAcceptance -isnot [bool] -or $q.nativeAcceptance -or $q.registryAcceptance -isnot [bool] -or $q.registryAcceptance -or $q.workerArguments -isnot [array]) {return $false}
        if(-not (Test-OwnedPostflightKeys $a @('schemaVersion','profile','policy','requestSha256','ready','files','nativeAcceptance','registryAcceptance'))) { return $false }
        if($a.schemaVersion -ne 1 -or $a.profile -cne $Profile -or $a.nativeAcceptance -isnot [bool] -or $a.nativeAcceptance -or $a.registryAcceptance -isnot [bool] -or $a.registryAcceptance -or $q.profile -cne $Profile -or $r.profile -cne $Profile) { return $false }
        if(-not (Test-OwnedPostflightKeys $p @('policy','observationPolicy','budgetMilliseconds','intervalMilliseconds','maximumQueries','observerSource','observerSourceSha256'))) { return $false }
        if($p.policy -cne $Policy -or $p.observationPolicy -cne 'global-zero-after-completed-owned-quit-v1' -or $p.observerSource -cne 'scripts/native-acceptance/run-reference-chart-profile.ps1' -or $p.observerSourceSha256 -cne '8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3') { return $false }
        foreach($pair in @(@('budgetMilliseconds',5000),@('intervalMilliseconds',100),@('maximumQueries',51))) { if(-not (Test-OwnedPostflightInteger $p.($pair[0])) -or $p.($pair[0]) -ne $pair[1]) { return $false } }
        if(($q.policy | ConvertTo-Json -Compress -Depth 10) -cne ($p | ConvertTo-Json -Compress -Depth 10) -or $q.schemaVersion -ne 1 -or $q.runOfficeRequested -isnot [bool] -or -not $q.runOfficeRequested) { return $false }
        if($Terminal.timedOut -isnot [bool] -or $Terminal.timedOut -or -not (Test-OwnedPostflightInteger $Terminal.exitCode) -or $Terminal.exitCode -ne 0 -or $Terminal.timeoutSeconds -ne $q.timeoutSeconds -or -not (Test-OwnedPostflightInteger $q.timeoutSeconds) -or $q.timeoutSeconds -lt 5 -or $q.timeoutSeconds -gt 60) { return $false }
        if($r.error -ne $null -or $r.PSObject.Properties.Name -cnotcontains 'error' -or $r.cleanupConfirmed -isnot [bool] -or -not $r.cleanupConfirmed -or $r.officeOperationsStopped -isnot [bool] -or $r.officeOperationsStopped -or $r.lastStage -cne 'worker.complete' -or $r.lastStatus -cne 'success' -or $r.envelopeSha256 -cne $q.envelopeSha256 -or $r.requestSha256 -cne $a.requestSha256) { return $false }
        if(-not (Test-OwnedPostflightStageWire $Evidence.stages)) { return $false }
        foreach($name in @('startedAt','finishedAt')) {
            if($Terminal.$name -isnot [string] -or $Terminal.$name -cnotmatch 'Z$') {return $false}
            try {[void][DateTimeOffset]::Parse($Terminal.$name,[Globalization.CultureInfo]::InvariantCulture)} catch {return $false}
        }
        if([DateTimeOffset]::Parse($Terminal.finishedAt) -lt [DateTimeOffset]::Parse($Terminal.startedAt)) {return $false}
        $ready=$a.ready
        if(-not (Test-OwnedPostflightInteger $ready.stageCount)) {return $false}
        if(-not (Test-OwnedPostflightKeys $ready @('workerCleanupConfirmed','stageCount','lifecycle','opens','saves','closes','edits','quits')) -or $ready.workerCleanupConfirmed -isnot [bool] -or -not $ready.workerCleanupConfirmed -or $ready.stageCount -ne $Evidence.stages.Count) { return $false }
        foreach($pair in @(@('opens',$Opens),@('saves',$Saves),@('closes',$Closes),@('edits',$Edits),@('quits',1))) { if(-not (Test-OwnedPostflightInteger $ready.($pair[0])) -or $ready.($pair[0]) -ne $pair[1]) { return $false } }
        $actual=@($Evidence.stages | Where-Object {$_.status -ceq 'success'})
        if($ready.lifecycle -isnot [array] -or $ready.lifecycle.Count -ne $actual.Count) { return $false }
        for($i=0;$i -lt $actual.Count;$i++) { if(-not (Test-OwnedPostflightInteger $ready.lifecycle[$i].sequence)) {return $false};if(-not (Test-OwnedPostflightKeys $ready.lifecycle[$i] @('stage','sequence')) -or $ready.lifecycle[$i].stage -cne $actual[$i].stage -or $ready.lifecycle[$i].sequence -ne $actual[$i].sequence) { return $false } }
        return $true
    } catch { return $false }
}
function Import-OwnedPostflightObserver([string]$Path) {
    Assert-OwnedPostflightPath $Path
    if((Get-OwnedPostflightHash $Path) -cne '8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3') { throw 'Exact reviewed observer source required' }
    $tokens=$null;$parseFailures=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$parseFailures)
    if($parseFailures.Count -ne 0) { throw 'Reviewed observer parse failure' }
    foreach($name in @('Test-ReferenceWitnessPostflightInteger','Invoke-ReferenceWitnessPostflight')) {
        $matches=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true))
        if($matches.Count -ne 1) { throw 'Missing/duplicate reviewed observer definition' }
        # Return unchanged definitions, not executable launcher statements.
        $matches[0].Extent.Text
    }
}
function Read-OwnedPostflightEvidence([string]$AdmissionFile,[string]$ExpectedSha256,[string]$Profile) {
    Assert-OwnedPostflightPath $AdmissionFile
    if($ExpectedSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-Item -LiteralPath $AdmissionFile).Length -gt 4194304 -or (Get-OwnedPostflightHash $AdmissionFile) -cne $ExpectedSha256) { throw 'Externally pinned admission differs' }
    $a=Get-Content -LiteralPath $AdmissionFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if($a.profile -cne $Profile -or $a.files -isnot [array] -or $a.files.Count -lt 1 -or $a.files.Count -gt 2000) { throw 'Unsupported admission or identity list' }
    $seen=@{}
    foreach($record in $a.files) {
        if(-not (Test-OwnedPostflightKeys $record @('file','bytes','sha256'))) { throw 'Unsupported identity field' }
        Assert-OwnedPostflightPath $record.file
        if($seen.ContainsKey($record.file) -or -not (Test-OwnedPostflightInteger $record.bytes) -or $record.bytes -lt 0 -or $record.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid/duplicate admission identity' }
        $seen[$record.file]=$true;$item=Get-Item -LiteralPath $record.file -Force
        if($item.PSIsContainer -or $item.Length -ne $record.bytes -or (Get-OwnedPostflightHash $record.file) -cne $record.sha256) { throw 'Bound evidence/source changed before observer' }
    }
    $output=Split-Path -Parent $AdmissionFile
    if((Split-Path -Leaf $AdmissionFile) -cne 'postflight-admission.json') { throw 'Canonical admission name required' }
    function Read-BoundOwnedJson([string]$File) {
        if(-not $seen.ContainsKey($File) -or (Get-Item -LiteralPath $File).Length -gt 4194304) { throw 'Required immutable evidence is unbound or oversized' }
        return Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    $requestFile=Join-Path $output 'execution-request.json';$q=Read-BoundOwnedJson $requestFile
    if($a.requestSha256 -cne (Get-OwnedPostflightHash $requestFile) -or $q.output -cne $output) { throw 'Admission request/root differs' }
    $root=$q.nativeRoot
    $expectedRoot=Join-Path $output $(if($Profile -ceq 'seven-chart-original-readonly-v2'){'native'}else{'table-colors'})
    if($root -cne $expectedRoot) {throw 'Foreign native root'}
    if($q.snapshots -isnot [array] -or $q.snapshots.Count -lt 1 -or $q.snapshots.Count -gt 1000) {throw 'Missing/bounded immutable snapshots required'}
    foreach($snapshot in $q.snapshots) {
        if($snapshot.path -isnot [string] -or $snapshot.path -match '[\\:]|(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($snapshot.path)) {throw 'Invalid immutable snapshot path'}
        $snapshotPath=Join-Path $output $snapshot.path
        $bound=@($a.files | Where-Object {$_.file -ceq $snapshotPath -and $_.bytes -eq $snapshot.bytes -and $_.sha256 -ceq $snapshot.sha256})
        if($bound.Count -ne 1) {throw 'Immutable snapshot is unbound'}
    }
    if($Profile -ceq 'seven-chart-original-readonly-v2') { $reportFile=Join-Path $root 'report.json' }
    elseif($Profile -ceq 'table-colors-v3') { $reportFile=Join-Path $root 'native.json' }
    else { throw 'Unsupported typed postflight profile' }
    $stageFile=Join-Path $root 'stages.jsonl'
    if(-not $seen.ContainsKey($stageFile) -or (Get-Item -LiteralPath $stageFile).Length -gt 4194304) { throw 'Raw stage identity missing/oversized' }
    $stages=@(Get-Content -LiteralPath $stageFile -Encoding UTF8 | ForEach-Object {$_ | ConvertFrom-Json})
    $e=[ordered]@{admission=$a;request=$q;report=(Read-BoundOwnedJson $reportFile);terminal=(Read-BoundOwnedJson (Join-Path $root 'worker.json'));stages=$stages}
    if($Profile -ceq 'table-colors-v3') { $e.generation=Read-BoundOwnedJson (Join-Path $root 'generation.json');$e.progress=Read-BoundOwnedJson (Join-Path $root 'progress.json') }
    return $e
}
function Invoke-OwnedProfilePostflight {
    param([string]$AdmissionFile,[string]$ExpectedAdmissionSha256,[string]$Profile,[string]$ControllerRoot,
          [scriptblock]$ReadProcesses,[scriptblock]$Clock,[scriptblock]$Utc,[scriptblock]$Delay,[scriptblock]$Append)
    # All definitions imported below are LOCAL to this invocation. Never script:/global:.
    $evidence=Read-OwnedPostflightEvidence $AdmissionFile $ExpectedAdmissionSha256 $Profile
    $bridge=if($Profile -ceq 'seven-chart-original-readonly-v2') {'seven'} elseif($Profile -ceq 'table-colors-v3') {'table'} else {throw 'Unsupported typed profile'}
    $sharedPath=Join-Path $ControllerRoot 'scripts/native-acceptance/owned-postflight.ps1'
    if(@($evidence.admission.files | Where-Object {$_.file -ceq $sharedPath}).Count -ne 1) { throw 'Shared bridge source is unbound' }
    $bridgePath=Join-Path $ControllerRoot "scripts/native-acceptance/$bridge-postflight.ps1"
    if(@($evidence.admission.files | Where-Object {$_.file -ceq $bridgePath}).Count -ne 1) { throw 'Typed bridge source is unbound' }
    $tokens=$null;$parseFailures=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($bridgePath,[ref]$tokens,[ref]$parseFailures)
    if($parseFailures.Count -ne 0) { throw 'Typed bridge parse failure' }
    $names=if($bridge -ceq 'seven') {@('Get-SevenPostflightOperations','Test-SevenPostflightReady')} else {@('Get-TablePostflightOperations','Test-TablePostflightReady')}
    foreach($name in $names) {
        $matches=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true))
        if($matches.Count -ne 1) { throw 'Missing/duplicate typed bridge' }
        Invoke-Expression $matches[0].Extent.Text
    }
    foreach($definition in @(Import-OwnedPostflightObserver (Join-Path $ControllerRoot 'scripts/native-acceptance/run-reference-chart-profile.ps1'))) { Invoke-Expression $definition }
    function Test-ReferenceWitnessPostflightReady($Terminal,$Evidence) {
        if($Evidence.admission.profile -ceq 'seven-chart-original-readonly-v2') { return Test-SevenPostflightReady $Terminal $Evidence }
        if($Evidence.admission.profile -ceq 'table-colors-v3') { return Test-TablePostflightReady $Terminal $Evidence }
        return $false
    }
    # Refusal precedes IO defaults, journal creation and even the first clock call.
    if(-not (Test-ReferenceWitnessPostflightReady $evidence.terminal $evidence)) { throw 'Typed completion admission refused; zero observer queries' }
    $postflightPath=Join-Path (Split-Path -Parent $AdmissionFile) 'postflight.jsonl'
    if(Test-Path -LiteralPath $postflightPath) { throw 'Preserve existing postflight journal' }
    $rows=[Collections.Generic.List[object]]::new()
    $watch=[Diagnostics.Stopwatch]::StartNew()
    if($null -eq $ReadProcesses) {
        $ReadProcesses={
            try { return @(Get-Process -Name POWERPNT -ErrorAction Stop | ForEach-Object {$_.Id}) }
            catch { if($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenName*') { return @() };throw }
        }
    }
    if($null -eq $Clock) { $Clock={return $watch.Elapsed.TotalMilliseconds} }
    if($null -eq $Utc) { $Utc={return [DateTime]::UtcNow.ToString('o')} }
    if($null -eq $Delay) { $Delay={param($Milliseconds) Start-Sleep -Milliseconds $Milliseconds} }
    if($null -eq $Append) {
        $Append={
            param($Row)
            $bytes=[Text.Encoding]::UTF8.GetBytes(($Row | ConvertTo-Json -Compress -Depth 8)+[Environment]::NewLine)
            $mode=if($rows.Count -eq 0) {[IO.FileMode]::CreateNew} else {[IO.FileMode]::Append}
            $stream=[IO.File]::Open($postflightPath,$mode,[IO.FileAccess]::Write,[IO.FileShare]::Read)
            try {$stream.Write($bytes,0,$bytes.Length);$stream.Flush()} finally {$stream.Dispose()}
            $rows.Add($Row)
        }
    }
    $result=$null;$failure=$null
    try {$result=Invoke-ReferenceWitnessPostflight $evidence.terminal $evidence $ReadProcesses $Clock $Utc $Delay $Append} catch {$failure=$_.Exception.Message}
    $initial=$null;$final=$null;$observed=@($rows | Where-Object {$_.status -ceq 'observed'})
    if($observed.Count -gt 0) {$initial=@($observed[0].processIds).Count;$final=@($observed[-1].processIds).Count}
    $identity=$null
    if(Test-Path -LiteralPath $postflightPath) {$identity=[ordered]@{path='postflight.jsonl';bytes=(Get-Item -LiteralPath $postflightPath).Length;sha256=(Get-OwnedPostflightHash $postflightPath)}}
    return [ordered]@{schemaVersion=1;policy=$evidence.admission.policy;workerCleanupConfirmed=$true;admission=[ordered]@{path=$AdmissionFile;bytes=(Get-Item -LiteralPath $AdmissionFile).Length;sha256=$ExpectedAdmissionSha256};identity=$identity;initialCount=$initial;finalCount=$final;result=$result;error=$failure}
}

