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
$names=@('Test-Integer','Require-Property','Assert-String','Read-AndValidateActionPlan','Invoke-FurnitureCom','Set-FurnitureTextStyle','Get-ExactShape','Read-FurnitureProperty','Read-FurnitureTextFont')
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

Accept-Plan 'style-size' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","fontSize":36}]' 1
Accept-Plan 'style-color' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","color":"12ABEF"}]' 1
Accept-Plan 'style-both' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","fontSize":24.5,"color":"f0f0f0"}]' 1
Reject-Plan 'style-empty' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape"}]'
Reject-Plan 'style-string-size' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","fontSize":"36"}]'
Reject-Plan 'style-bool-size' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","fontSize":true}]'
Reject-Plan 'style-zero' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","fontSize":0}]'
Reject-Plan 'style-too-big' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","fontSize":97}]'
Reject-Plan 'style-overflow' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","fontSize":1e309}]'
Reject-Plan 'style-reference-color' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","color":"primary"}]'
Reject-Plan 'style-hash-color' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","color":"#FF0000"}]'
Reject-Plan 'style-short-color' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","color":"#FFF"}]'
Reject-Plan 'style-extra-key' '[{"op":"set-text-style","slideIndex":1,"shapeName":"Exact shape","fontSize":36,"fontFamily":"Arial"}]'

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
# Pure object mocks: no COM class/application is constructed.
$font=[pscustomobject]@{Size=18;Color=[pscustomobject]@{RGB=0};Name='Untouched family';Bold=0}
$range=[pscustomobject]@{Text='about it';Font=$font}
$shape=[pscustomobject]@{HasTextFrame=-1;TextFrame=[pscustomobject]@{TextRange=$range}}
$action=[pscustomobject]@{fontSize=36;color='12ABEF'}
$observed=Set-FurnitureTextStyle $shape $action 'mock-style'
if($font.Size -ne 36 -or $font.Color.RGB -ne 15706898 -or $observed.textBefore -cne 'about it' -or $observed.textAfter -cne 'about it' -or $font.Name -cne 'Untouched family' -or $font.Bold -ne 0) { throw 'Style mock changed wrong properties or returned wrong RGB/words' }
Set-FurnitureTextStyle $shape ([pscustomobject]@{fontSize=24}) 'mock-size-only' | Out-Null
if($font.Color.RGB -ne 15706898) { throw 'Size-only action changed color' }
Set-FurnitureTextStyle $shape ([pscustomobject]@{color='FF0000'}) 'mock-color-only' | Out-Null
if($font.Size -ne 24 -or $font.Color.RGB -ne 255) { throw 'Color-only action changed size or RGB channel order' }
$missingTextRejected=$false
try { Set-FurnitureTextStyle ([pscustomobject]@{HasTextFrame=0}) $action 'mock-no-text' | Out-Null } catch { $missingTextRejected=$true }
if(-not $missingTextRejected) { throw 'Shape without text was accepted' }
function Reject-StyleMock($MockShape,$MockAction,[string]$Name) {
    $rejected=$false; try { Set-FurnitureTextStyle $MockShape $MockAction $Name | Out-Null } catch { $rejected=$true }
    if(-not $rejected) { throw "$Name was not rejected" }
}
$badFont=[pscustomobject]@{Color=[pscustomobject]@{RGB=0}}
$badFont | Add-Member -MemberType ScriptProperty -Name Size -Value {18} -SecondValue {param($value)}
Reject-StyleMock ([pscustomobject]@{HasTextFrame=-1;TextFrame=[pscustomobject]@{TextRange=[pscustomobject]@{Text='about it';Font=$badFont}}}) ([pscustomobject]@{fontSize=36}) 'mock-size-readback'
$badColor=[pscustomobject]@{}
$badColor | Add-Member -MemberType ScriptProperty -Name RGB -Value {0} -SecondValue {param($value)}
Reject-StyleMock ([pscustomobject]@{HasTextFrame=-1;TextFrame=[pscustomobject]@{TextRange=[pscustomobject]@{Text='about it';Font=[pscustomobject]@{Size=18;Color=$badColor}}}}) ([pscustomobject]@{color='FF0000'}) 'mock-color-readback'
$script:changedWordsRange=[pscustomobject]@{Text='about it';Font=$null}
$mutatingFont=[pscustomobject]@{Color=[pscustomobject]@{RGB=0}}
$mutatingFont | Add-Member -MemberType ScriptProperty -Name Size -Value {36} -SecondValue {param($value) $script:changedWordsRange.Text='UNEXPECTED words'}
$script:changedWordsRange.Font=$mutatingFont
Reject-StyleMock ([pscustomobject]@{HasTextFrame=-1;TextFrame=[pscustomobject]@{TextRange=$script:changedWordsRange}}) ([pscustomobject]@{fontSize=36}) 'mock-changed-words'

# Read-only whole-range font mocks. All font calls use the same failure latch as Office calls.
$fontCases=New-Object 'System.Collections.Generic.List[object]'
$descriptorFont=[pscustomobject]@{Name='Roboto ExtraBold';Size=[single]57;Bold=0;Italic=0}
$descriptorShape=[pscustomobject]@{TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Font=$descriptorFont}}}
$descriptor=Read-FurnitureTextFont $descriptorShape '52' 'font-uniform'
if($descriptor.status -cne 'uniform' -or $descriptor.name -cne 'Roboto ExtraBold' -or $descriptor.sizePoints -ne 57 -or $descriptor.bold -ne 0 -or $descriptor.italic -ne 0 -or $descriptor.unavailableFields.Count -ne 0) { throw 'Uniform font descriptor differs' }
$fontCases.Add([ordered]@{name='uniform';passed=$true})
$descriptorFont.Bold=-1; $descriptorFont.Italic=-1
$descriptor=Read-FurnitureTextFont $descriptorShape 'Styled' 'font-bold-italic'
if($descriptor.status -cne 'uniform' -or $descriptor.bold -ne -1 -or $descriptor.italic -ne -1) { throw 'Bold/italic tri-state changed' }
$fontCases.Add([ordered]@{name='bold-italic';passed=$true})
foreach($spec in @(@{name='mixed-name';field='Name';value='';expected='name'},@{name='mixed-size';field='Size';value=-2;expected='sizePoints'},@{name='nonfinite-size';field='Size';value=[double]::NaN;expected='sizePoints'},@{name='mixed-bold';field='Bold';value=-2;expected='bold'},@{name='unavailable-italic';field='Italic';value=$null;expected='italic'})) {
    $font=[pscustomobject]@{Name='Roboto';Size=18;Bold=0;Italic=0};$font.($spec.field)=$spec.value
    $shape=[pscustomobject]@{TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Font=$font}}}
    $observed=Read-FurnitureTextFont $shape 'Visible' $spec.name
    if($observed.status -cne 'mixed-or-unavailable' -or $observed.unavailableFields.Count -ne 1 -or $observed.unavailableFields[0] -cne $spec.expected) { throw 'Mixed/unavailable descriptor was silently accepted' }
    $fontCases.Add([ordered]@{name=$spec.name;passed=$true})
}
$beforeCalls=$script:events.Count
if((Read-FurnitureTextFont $null '' 'font-empty').status -cne 'no-text' -or $script:events.Count -ne $beforeCalls) { throw 'Empty text performed property reads' }
$fontCases.Add([ordered]@{name='empty-no-calls';passed=$true})
foreach($field in @('TextFrame2','TextRange','Font','Name','Size','Bold','Italic')) {
    $font=[pscustomobject]@{Name='Roboto';Size=18;Bold=0;Italic=0}
    $range=[pscustomobject]@{Font=$font};$frame=[pscustomobject]@{TextRange=$range};$shape=[pscustomobject]@{TextFrame2=$frame}
    $target=switch($field) { 'TextFrame2' {$shape}; 'TextRange' {$frame}; 'Font' {$range}; default {$font} }
    $target.PSObject.Properties.Remove($field)
    $target | Add-Member -MemberType ScriptProperty -Name $field -Value { throw 'Deliberate descriptor property failure' }
    $script:officeOperationsStopped=$false;$script:cleanupConfirmed=$true
    $rejected=$false;try { $null=Read-FurnitureTextFont $shape 'Visible' 'font-property-failure' } catch { $rejected=$true }
    if(-not $rejected -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw "Font $field property failure did not retain the COM latch" }
    $eventCount=$script:events.Count;$script:laterFontRead=$false
    try { Invoke-FurnitureCom 'forbidden-later-font-read' {$script:laterFontRead=$true} } catch { }
    if($script:laterFontRead -or $script:events.Count -ne $eventCount) { throw 'A later read ran after the getter failure' }
    $fontCases.Add([ordered]@{name="property-$field-failure-latched";passed=$true})
}
$script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true

$shapes=[pscustomobject]@{Count=2;Values=@([pscustomobject]@{Name='Exact'},[pscustomobject]@{Name='Other'})}
$shapes | Add-Member -MemberType ScriptMethod -Name Item -Value {param($index) return $this.Values[$index-1]}
$slide=[pscustomobject]@{Shapes=$shapes}
if((Get-ExactShape $slide 'Exact' 'mock-target').Name -cne 'Exact') { throw 'Exact target not selected' }
foreach($name in @('Missing','exact')) { $rejected=$false; try { $null=Get-ExactShape $slide $name 'mock-target' } catch { $rejected=$true }; if(-not $rejected) { throw 'Non-exact target accepted' } }
$shapes.Values[1].Name='Exact'; $rejected=$false
try { $null=Get-ExactShape $slide 'Exact' 'mock-duplicate' } catch { $rejected=$true }
if(-not $rejected) { throw 'Duplicate target accepted' }

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
    textFontControls=$fontCases
    scope='Windows PowerShell 5.1 parse; pure uniform/mixed/unavailable whole-range font descriptors and error latch; size/color edit and exact-target mocks; readback/text-change refusal;  AST-only action-plan validation; empty/single/multi list behavior; invalid-plan rejection; collection identity and fail-closed wrapper. No Office object was constructed.'
    powershell=$PSVersionTable.PSVersion.ToString()
    verifierSha256=(Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
    checkerSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    accepted=6
    rejected=23
    cases=@($cases.ToArray())
    events=@($script:events.ToArray())
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportFull -Encoding UTF8
Write-Output 'Furniture harness checks passed: plans, collection identity and fail-closed wrapper. No Office automation used.'
