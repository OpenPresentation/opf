# Managed, definitions-only tests of actual v3 worker helpers. Never run its entrypoint.
param([Parameter(Mandatory=$true)][string]$NodeExecutable)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) {throw 'Actual Windows PowerShell 5.1 is required'}
$controller=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$worker=Join-Path $controller 'packages/pptx/test/native-table-colors-v3.ps1'
$tokens=$null;$parseFailures=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$parseFailures)
if($parseFailures.Count -ne 0) {throw 'Actual v3 helper source must parse'}
$definitions=@('Get-TablePrimitive','Get-TableCharacterProbe','Write-TableStage','Stop-TableLifecycle','Assert-TableCondition','Invoke-TableCom','Write-TableCharacterProbe')
foreach($name in $definitions) {
    $found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
    if($found.Count -ne 1) {throw 'Missing/duplicate actual v3 helper definition'}
    Invoke-Expression $found[0].Extent.Text
}
$parent=Join-Path $controller 'artifacts/native-pure-tests'
[void](New-Item -ItemType Directory -Path $parent -Force)
$ownedRoot=Join-Path $parent ('table-v3-managed-'+[Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $ownedRoot)
$script:controls=0
function Reset-ManagedTableState {
    $script:controls++
    $script:root=Join-Path $ownedRoot ("case-$script:controls")
    [void](New-Item -ItemType Directory -Path $script:root)
    $script:sequence=0;$script:lastStage=$null;$script:lastStatus=$null
    $script:stopped=$false;$script:cleanup=$true;$script:ownedPath=$null
    $script:report=[ordered]@{lastStage=$null;lastStatus=$null;currentCellProbe=$null}
}
function Assert-ManagedExactValue($Actual,$Expected) {
    if($null -eq $Expected) {if($null -ne $Actual) {throw 'Actual helper changed null'};return}
    if($null -eq $Actual -or $Actual.GetType() -ne $Expected.GetType() -or -not [object]::Equals($Actual,$Expected)) {throw 'Actual helper coerced or lost a primitive'}
}
function Assert-ManagedStopLatch {
    if(-not $script:stopped -or $script:cleanup) {throw 'Actual helper did not latch failure'}
    $calls=@{later=0};$refused=$false
    $stageCount=$script:sequence
    try {Invoke-TableCom 'synthetic.later' {$calls.later++;return 1}} catch {$refused=$true}
    if(-not $refused -or $calls.later -ne 0 -or $script:sequence -ne $stageCount) {throw 'Actual stopped helper permitted a later managed operation/journal'}
}
try {
    $values=@(
        @{value=$null},@{value=$false},@{value=$true},@{value=''},@{value='synthetic'},
        @{value=[int]0},@{value=[int]7},@{value=[long]9},@{value=[double]1.5},
        @{value=[single]2.5},@{value=[decimal]3.5},@{value=[int16]4},@{value=[byte]5}
    )
    foreach($case in $values) {
        Reset-ManagedTableState
        $actual=Get-TablePrimitive -Value $case.value
        Assert-ManagedExactValue $actual $case.value
        $returned=Invoke-TableCom 'synthetic.primitive' {return ,$case.value}
        Assert-ManagedExactValue $returned $case.value
        $stageFile=Join-Path $script:root 'stages.jsonl'
        $before=(Get-FileHash -LiteralPath $stageFile -Algorithm SHA256).Hash
        $stages=@(Get-Content -LiteralPath $stageFile -Encoding UTF8 | ForEach-Object {$_ | ConvertFrom-Json})
        if($stages.Count -ne 2 -or $stages[0].status -cne 'begin' -or $stages[1].status -cne 'success') {throw 'Actual Invoke-TableCom did not journal its pair'}
        foreach($stage in $stages) {
            if($stage.PSObject.Properties.Name -cnotcontains 'error' -or ($null -ne $stage.error -and ($stage.error -isnot [string] -or $stage.error -cne ''))) {throw 'Actual Write-TableStage error wire differs'}
        }
        if($before -cne (Get-FileHash -LiteralPath $stageFile -Algorithm SHA256).Hash) {throw 'Reading actual raw PS5 stages rewrote them'}
    }
    $opaque=[pscustomobject]@{}
    Add-Member -InputObject $opaque -MemberType ScriptProperty -Name NeverRead -Value {throw 'Unsupported object was reflected'}
    foreach($case in @(@{value=$opaque},@{value=@(1,2)})) {
        Reset-ManagedTableState
        $actual=Get-TablePrimitive -Value $case.value
        if($actual -isnot [string] -or $actual -cne '[unsupported non-primitive value]') {throw 'Actual worker reflected/coerced a nonprimitive'}
        [void](Invoke-TableCom 'synthetic.nonprimitive' {return ,$case.value})
        $stage=Get-Content -LiteralPath (Join-Path $script:root 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        if($stage.value -cne '[unsupported non-primitive value]') {throw 'Actual journal retained an unsafe object/array'}
    }
    foreach($value in @([double]::NaN,[double]::PositiveInfinity,[double]::NegativeInfinity,[single]::NaN)) {
        Reset-ManagedTableState
        if((Get-TablePrimitive -Value $value) -cne '[unsupported nonfinite value]') {throw 'Actual worker did not retain its explicit nonfinite sentinel'}
    }
    foreach($case in @(@{value=[int]0;color='#000000'},@{value=[long]16777215;color='#FFFFFF'},@{value=[int]3351057;color='#112233'})) {
        Reset-ManagedTableState
        $probe=Get-TableCharacterProbe -Phase 'synthetic' -Slide 1 -Row 1 -Column 1 -CharacterIndex 1 -Character 'A' -ExpectedColor $case.color -Rgb $case.value
        if($probe.rgbValid -isnot [bool] -or -not $probe.rgbValid -or $probe.actualHex -cne $case.color) {throw 'Actual RGB primitive decoding differs'}
        Assert-ManagedExactValue $probe.actualRgb $case.value
        Write-TableCharacterProbe $probe
        Assert-TableCondition $probe.rgbValid 'Synthetic valid RGB must qualify'
    }
    $invalid=@(
        @{value=$null},@{value=$false},@{value='0'},@{value=[int]-1},@{value=[long]16777216},
        @{value=[double]1.5},@{value=$opaque},@{value=@(1,2)},@{value=[double]::NaN},@{value=[double]::PositiveInfinity}
    )
    foreach($case in $invalid) {
        Reset-ManagedTableState
        $rgb=Invoke-TableCom 'synthetic.rgb.get' {return ,$case.value}
        $probe=Get-TableCharacterProbe -Phase 'synthetic' -Slide 1 -Row 1 -Column 1 -CharacterIndex 1 -Character 'A' -ExpectedColor '#000000' -Rgb $rgb
        if($probe.rgbValid -isnot [bool] -or $probe.rgbValid) {throw 'Actual RGB probe accepted invalid type/range'}
        Write-TableCharacterProbe $probe
        $rejected=$false
        try {Assert-TableCondition $probe.rgbValid 'Synthetic invalid RGB'} catch {$rejected=$true}
        if(-not $rejected) {throw 'Actual condition did not refuse invalid RGB'}
        Assert-ManagedStopLatch
    }
    Reset-ManagedTableState
    $calls=@{count=0};$failed=$false
    try {Invoke-TableCom 'synthetic.getter.fault' {$calls.count++;throw 'Synthetic managed getter fault'}} catch {$failed=$true}
    if(-not $failed -or $calls.count -ne 1) {throw 'Actual Invoke-TableCom lost the first managed fault'}
    $errorStage=Get-Content -LiteralPath (Join-Path $script:root 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($errorStage.status -cne 'error' -or $errorStage.error -isnot [string] -or $errorStage.error.Length -eq 0) {throw 'Actual managed fault was not durable'}
    Assert-ManagedStopLatch
    Reset-ManagedTableState
    [void](New-Item -ItemType Directory -Path (Join-Path $script:root 'character-probes.jsonl'))
    $probe=Get-TableCharacterProbe -Phase 'synthetic' -Slide 1 -Row 1 -Column 1 -CharacterIndex 1 -Character 'A' -ExpectedColor '#000000' -Rgb 0
    $failed=$false
    try {Write-TableCharacterProbe $probe} catch {$failed=$true}
    if(-not $failed) {throw 'Actual probe append fault was swallowed'}
    Assert-ManagedStopLatch
    [ordered]@{controls=$script:controls;failed=0;actualWorkerDefinitions=$definitions.Count;hostMajor=5;hostMinor=1;entrypointExecuted=$false;realProcessQueries=0;officeActions=0} | ConvertTo-Json -Compress
} finally {
    $absolute=[IO.Path]::GetFullPath($ownedRoot);$allowed=[IO.Path]::GetFullPath($parent)+[IO.Path]::DirectorySeparatorChar
    if(-not $absolute.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $absolute) -notlike 'table-v3-managed-*') {throw 'Refuse cleanup outside owned helper-control root'}
    Remove-Item -LiteralPath $absolute -Recurse -Force
}

