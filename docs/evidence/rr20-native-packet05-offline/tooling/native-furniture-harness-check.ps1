param([string]$ScriptPath='',[Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop'
if($ScriptPath -eq '') { $ScriptPath=Join-Path $PSScriptRoot 'native-furniture-control.ps1' }
if(Test-Path -LiteralPath $ReportPath) { throw 'Preserve the existing control report and select a fresh ReportPath' }
$reportFull=[IO.Path]::GetFullPath($ReportPath); $reportParent=Split-Path -Parent $reportFull
if(-not (Test-Path -LiteralPath $reportParent -PathType Container)) { throw 'ReportPath parent directory must already exist' }
$planRoot=$reportFull+'.plans'
if(Test-Path -LiteralPath $planRoot) { throw 'Preserve the existing plan controls and select a fresh ReportPath' }
[void](New-Item -ItemType Directory -Path $planRoot)

$tokens=$null; $parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($ScriptPath,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -ne 0) { throw ($parseErrors | Out-String) }
$names=@('Test-Integer','Require-Property','Assert-String','Read-AndValidateActionPlan','Invoke-FurnitureCom')
foreach($name in $names) {
    $functionAst=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
    if($null -eq $functionAst) { throw "Missing reviewed function: $name" }
    # Execute only the selected pure validation/wrapper functions. The worker's
    # Office entrypoint and every COM operation remain outside this checker.
    Invoke-Expression $functionAst.Extent.Text
}

$cases=New-Object 'System.Collections.Generic.List[object]'
function Write-Plan([string]$Name,[string]$Json) {
    $file=Join-Path $planRoot "$Name.json"; Set-Content -LiteralPath $file -Value $Json -Encoding UTF8; return $file
}
function Accept-Plan([string]$Name,[string]$Json,[int]$ExpectedCount,[scriptblock]$Inspect=$null) {
    $file=Write-Plan $Name $Json; $items=Read-AndValidateActionPlan $file
    if($items.Count -ne $ExpectedCount) { throw "$Name expected $ExpectedCount action(s), observed $($items.Count)" }
    if($null -ne $Inspect) { & $Inspect $items }
    $script:cases.Add([ordered]@{name=$Name;expected='accept';passed=$true;count=$items.Count})
}
function Reject-Plan([string]$Name,[string]$Json) {
    $file=Write-Plan $Name $Json; $message=$null
    try { $null=Read-AndValidateActionPlan $file } catch { $message=$_.Exception.Message }
    if($null -eq $message) { throw "$Name was unexpectedly accepted" }
    $script:cases.Add([ordered]@{name=$Name;expected='reject';passed=$true;error=$message})
}

$emptyJson=ConvertTo-Json -InputObject @() -Compress
if($emptyJson.Trim() -cne '[]') { throw "Windows PowerShell empty-list serialization changed: $emptyJson" }
Accept-Plan 'empty-list' $emptyJson 0
Accept-Plan 'singleton-empty-text' '[{"op":"set-text","slideIndex":1,"shapeName":"Exact shape","text":""}]' 1 {
    param($items) if($items[0].text -cne '') { throw 'Empty set-text payload was not preserved' }
}
Accept-Plan 'multi-empty-alt' '[{"op":"set-alt","slideIndex":2,"shapeName":"Picture","alt":""},{"op":"set-tag","target":"slide","slideIndex":1,"tagName":"CONTROL","tagValue":"value"},{"op":"move-slide","slideIndex":3,"toIndex":1}]' 3 {
    param($items) if($items[0].alt -cne '') { throw 'Empty set-alt payload was not preserved' }
}

Reject-Plan 'null-entry' '[null]'
Reject-Plan 'malformed-json' '['
Reject-Plan 'non-list-root' '{"op":"move-slide","slideIndex":1,"toIndex":1}'
Reject-Plan 'unknown-operation' '[{"op":"rename-shape","slideIndex":1,"shapeName":"Shape"}]'
Reject-Plan 'unknown-property' '[{"op":"set-text","slideIndex":1,"shapeName":"Shape","text":"value","unexpected":true}]'
Reject-Plan 'string-slide-index' '[{"op":"set-text","slideIndex":"1","shapeName":"Shape","text":"value"}]'
Reject-Plan 'numeric-text' '[{"op":"set-text","slideIndex":1,"shapeName":"Shape","text":17}]'
Reject-Plan 'numeric-target' '[{"op":"set-tag","target":1,"slideIndex":1,"shapeName":"Shape","tagName":"A","tagValue":"B"}]'
Reject-Plan 'fractional-move-index' '[{"op":"move-slide","slideIndex":1,"toIndex":1.5}]'
Reject-Plan 'slide-index-zero' '[{"op":"delete-shape","slideIndex":0,"shapeName":"Shape"}]'
Reject-Plan 'slide-index-four' '[{"op":"delete-shape","slideIndex":4,"shapeName":"Shape"}]'
Reject-Plan 'move-index-four' '[{"op":"move-slide","slideIndex":1,"toIndex":4}]'
$twentyOne=@(); for($index=0;$index -lt 21;$index++) { $twentyOne+=@([ordered]@{op='move-slide';slideIndex=1;toIndex=1}) }
Reject-Plan 'twenty-one-actions' (ConvertTo-Json -InputObject $twentyOne -Depth 5)

$script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true
$script:events=New-Object 'System.Collections.Generic.List[string]'
function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) { $script:events.Add($Name+':'+$Status) }
$empty=New-Object 'System.Collections.Generic.List[string]'
$populated=New-Object 'System.Collections.Generic.List[string]'; $populated.Add('first'); $populated.Add('second')
$observedEmpty=Invoke-FurnitureCom 'empty' { return ,$empty }
$observedPopulated=Invoke-FurnitureCom 'populated' { return ,$populated }
if(-not [object]::ReferenceEquals($empty,$observedEmpty)) { throw 'Empty collection identity was lost' }
if(-not [object]::ReferenceEquals($populated,$observedPopulated)) { throw 'Populated collection identity was lost' }
$failureCaught=$false
try { Invoke-FurnitureCom 'controlled-error' { throw 'Deliberate non-Office failure' } } catch { $failureCaught=$true }
if(-not $failureCaught -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw 'Failure latch was not retained' }
$script:unexpectedCall=$false
try { Invoke-FurnitureCom 'forbidden-followup' { $script:unexpectedCall=$true } } catch { }
if($script:unexpectedCall) { throw 'Operation ran after the failure latch' }

[ordered]@{
    passed=$true
    scope='Windows PowerShell 5.1 parse; AST-only action-plan validation; empty/single/multi list behavior; invalid-plan rejection; collection identity and fail-closed wrapper. No Office object was constructed.'
    powershell=$PSVersionTable.PSVersion.ToString()
    verifierSha256=(Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
    checkerSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    accepted=3
    rejected=13
    cases=@($cases.ToArray())
    events=@($script:events.ToArray())
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportFull -Encoding UTF8
Write-Output 'Furniture harness checks passed: plans, collection identity and fail-closed wrapper. No Office automation used.'
