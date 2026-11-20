param([Parameter(Mandatory=$true)][string]$NodeExecutable)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) {throw 'Actual Windows PowerShell 5.1 is required'}
$controller=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $PSScriptRoot 'owned-postflight.ps1')
$parent=Join-Path $controller 'artifacts/native-pure-tests'
[void](New-Item -ItemType Directory -Path $parent -Force)
$ownedRoot=Join-Path $parent ('owned-admission-'+[Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $ownedRoot)
$oldReady=Get-Item -LiteralPath 'Function:\global:Test-ReferenceWitnessPostflightReady' -ErrorAction SilentlyContinue
$script:oldReadyCalls=0
function global:Test-ReferenceWitnessPostflightReady { $script:oldReadyCalls++;throw 'Old global/B07/reference ready must never run' }
function Write-SyntheticJson([string]$File,$Value) { [IO.File]::WriteAllText($File,($Value | ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false)) }
function Invoke-SyntheticAdmission([string]$Profile,[string]$Mutation,[int]$Index) {
    $output=Join-Path $ownedRoot ("case-$Index")
    $created=& $NodeExecutable (Join-Path $PSScriptRoot 'owned-profile-postflight.test.mjs') --emit-fixture $output $Profile $controller
    if($LASTEXITCODE -ne 0){throw 'Synthetic fixture source failed'}
    $identity=($created | Out-String) | ConvertFrom-Json
    $admission=Get-Content -LiteralPath $identity.path -Raw -Encoding UTF8 | ConvertFrom-Json
    $root=Join-Path $output $(if($Profile.StartsWith('seven')){'native'}else{'table-colors'})
    $reportFile=Join-Path $root $(if($Profile.StartsWith('seven')){'report.json'}else{'native.json'})
    $report=Get-Content -LiteralPath $reportFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $stageFile=Join-Path $root 'stages.jsonl'
    $stages=@(Get-Content -LiteralPath $stageFile -Encoding UTF8 | ForEach-Object {$_ | ConvertFrom-Json})
    if($Mutation -ceq 'missing-error') {$stages[0].PSObject.Properties.Remove('error')}
    if($Mutation -ceq 'nonempty-error') {$stages[0].error='Synthetic failure'}
    if($Mutation -ceq 'sequence-gap') {$stages[0].sequence=2}
    if($Mutation -ceq 'raw-readonly') {($stages | Where-Object {$_.stage -ceq 'original.readOnly' -and $_.status -ceq 'success'}).value=0}
    if($Mutation -ceq 'nonempty-final-count') {($stages | Where-Object {$_.stage -ceq 'application.final.count' -and $_.status -ceq 'success'}).value=1}
    if($Mutation -ceq 'raw-object-value') {($stages | Where-Object {$_.stage -ceq 'application.version' -and $_.status -ceq 'success'}).value=[pscustomobject]@{unexpected=$true}}
    if($Mutation -ceq 'raw-array-value') {($stages | Where-Object {$_.stage -ceq 'application.version' -and $_.status -ceq 'success'}).value=@(1,2)}
    if($Mutation -ceq 'raw-nonfinite-value') {($stages | Where-Object {$_.stage -ceq 'application.version' -and $_.status -ceq 'success'}).value='SYNTHETIC_NONFINITE_TOKEN'}
    if($Mutation -ceq 'cleanup-false') {$report.cleanupConfirmed=$false}
    if($Mutation -ceq 'foreign-profile') {$admission.profile='unsupported'}
    if($Mutation -ceq 'policy-change') {$admission.policy.maximumQueries=52}
    Write-SyntheticJson $reportFile $report
    $wire=(($stages | ForEach-Object {$_ | ConvertTo-Json -Compress -Depth 12}) -join [Environment]::NewLine)+[Environment]::NewLine
    if($Mutation -ceq 'raw-nonfinite-value') {
        if(-not $wire.Contains('"SYNTHETIC_NONFINITE_TOKEN"')) {throw 'Synthetic nonfinite wire token absent'}
        $wire=$wire.Replace('"SYNTHETIC_NONFINITE_TOKEN"','1e999')
    }
    [IO.File]::WriteAllText($stageFile,$wire,[Text.UTF8Encoding]::new($false))
    foreach($record in $admission.files) {$record.bytes=(Get-Item -LiteralPath $record.file).Length;$record.sha256=Get-OwnedPostflightHash $record.file}
    Write-SyntheticJson $identity.path $admission
    $identity.sha256=Get-OwnedPostflightHash $identity.path
    $io=@{reads=0;clocks=0;rows=[Collections.Generic.List[object]]::new()}
    $failed=$false;$result=$null
    try {
        $parameters=@{AdmissionFile=$identity.path;ExpectedAdmissionSha256=$identity.sha256;Profile=$Profile;ControllerRoot=$controller;ReadProcesses={$io.reads++;return @()};Clock={$io.clocks++;return 0.0};Utc={return '2000-01-01T00:00:00.000Z'};Delay={param($ms) throw 'First zero never delays'};Append={param($row) $io.rows.Add($row)}}
        $result=Invoke-OwnedProfilePostflight @parameters
    } catch {$failed=$true}
    if($Mutation -ceq 'valid') {
        if($failed -or $io.reads -ne 1 -or $result.result.observedZero -cne $true -or $null -ne $result.error) {throw 'Valid local typed dispatcher did not resolve'}
    } elseif(-not $failed -or $io.reads -ne 0 -or $io.clocks -ne 0) {throw 'Malformed admission/raw evidence reached IO'}
    if($script:oldReadyCalls -ne 0) {throw 'Old global readiness function was resolved'}
}
try {
    $index=0
    foreach($profile in @('seven-chart-original-readonly-v2','table-colors-v3')) {
        foreach($mutation in @('valid','missing-error','nonempty-error','sequence-gap','raw-readonly','nonempty-final-count','cleanup-false','foreign-profile','policy-change','raw-object-value','raw-array-value','raw-nonfinite-value')) {$index++;Invoke-SyntheticAdmission $profile $mutation $index}
    }
    $index++;Invoke-SyntheticAdmission 'seven-chart-original-readonly-v2' 'valid' $index
    $primitiveControls=0
    $primitiveCases=@(
        @{value=$null;valid=$true},@{value='';valid=$true},@{value='synthetic';valid=$true},
        @{value=$false;valid=$true},@{value=$true;valid=$true},@{value=[int]0;valid=$true},
        @{value=[long]7;valid=$true},@{value=[double]1.5;valid=$true},@{value=[decimal]2.5;valid=$true},
        @{value=[single]3.5;valid=$true},@{value=[pscustomobject]@{unexpected=$true};valid=$false},
        @{value=@(1,2);valid=$false},@{value=@();valid=$false},@{value=@($null);valid=$false},@{value=[double]::NaN;valid=$false},
        @{value=[double]::PositiveInfinity;valid=$false},@{value=[double]::NegativeInfinity;valid=$false},
        @{value=[single]::NaN;valid=$false}
    )
    foreach($case in $primitiveCases) {
        $primitiveControls++
        if((Test-OwnedPostflightPrimitive $case.value) -ne $case.valid) {throw 'Shared primitive guard coerced an unsupported value'}
        $record=[pscustomobject]@{sequence=1;stage='worker.initialize';status='success';timestamp='2000-01-01T00:00:00.000Z';value=$case.value;error='';officeOperationsStopped=$false;cleanupConfirmed=$true}
        if((Test-OwnedPostflightStageWire @($record)) -ne $case.valid) {throw 'Shared raw stage guard disagrees with exact primitive contract'}
    }
    [ordered]@{controls=$index+$primitiveControls;failed=0;primitiveControls=$primitiveControls;globalReadyCalls=$script:oldReadyCalls;realProcessQueries=0;officeActions=0} | ConvertTo-Json -Compress
} finally {
    if($null -ne $oldReady) {Set-Item -LiteralPath 'Function:\global:Test-ReferenceWitnessPostflightReady' -Value $oldReady.ScriptBlock}
    else {Remove-Item -LiteralPath 'Function:\global:Test-ReferenceWitnessPostflightReady' -ErrorAction SilentlyContinue}
    $absolute=[IO.Path]::GetFullPath($ownedRoot);$allowed=[IO.Path]::GetFullPath($parent)+[IO.Path]::DirectorySeparatorChar
    if(-not $absolute.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $absolute) -notlike 'owned-admission-*') {throw 'Refuse cleanup outside owned pure fixture root'}
    Remove-Item -LiteralPath $absolute -Recurse -Force
}

