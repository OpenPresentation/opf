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
$names=@('Test-Integer','Require-Property','Assert-String','Read-AndValidateActionPlan','Invoke-FurnitureCom','Set-FurnitureTextStyle','Get-ExactShape','Read-FurnitureProperty','Read-FurnitureTextFont','Assert-PresentationNotOpen','Assert-FurnitureOfficeIdle','Stop-FurnitureLifecycle','Open-OwnedFurniture','Save-OwnedFurnitureCopy','Close-OwnedFurniture','Assert-OwnedFurnitureApplication','Quit-OwnedFurnitureApplication','Get-ExactSlide','Read-FurnitureFiniteNumber','New-FurniturePointProbe','Read-FurnitureSlicePoint','Get-FurnitureNativeCircleCenter','Get-FurnitureCurvedSliceBounds','Read-FurnitureChartPoint','Apply-FurnitureAction')
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

# SH25: parse the actual bounded measurement action before any application exists.
$pointPlan=[ordered]@{op='measure-chart-point';slideIndex=1;shapeName='Exact ring';chartName='Exact chart';seriesIndex=1;pointIndex=1;chartKind='marker';edge='center';valueSign=1}
function Copy-PointPlan {
    $copy=[ordered]@{};foreach($key in $pointPlan.Keys) {$copy[$key]=$pointPlan[$key]};return $copy
}
foreach($kind in @('horizontal-bar','vertical-bar','marker','slice')) {
    $valid=(Copy-PointPlan);$valid.chartKind=$kind
    Accept-Plan ('point-kind-'+$kind) (ConvertTo-Json -InputObject @($valid) -Compress) 1
}
$valid=(Copy-PointPlan);$valid.seriesIndex=256;$valid.pointIndex=256;$valid.valueSign=-1;$valid.edge='start'
Accept-Plan 'point-index-upper-bound' (ConvertTo-Json -InputObject @($valid) -Compress) 1
$valid=(Copy-PointPlan);$valid.valueSign=0;$valid.edge='bottom'
Accept-Plan 'point-zero-sign' (ConvertTo-Json -InputObject @($valid) -Compress) 1
foreach($field in @('chartName','seriesIndex','pointIndex','chartKind','edge','valueSign')) {
    $invalid=(Copy-PointPlan);$invalid.Remove($field)
    Reject-Plan ('point-missing-'+$field) (ConvertTo-Json -InputObject @($invalid) -Compress)
}
foreach($field in @('seriesIndex','pointIndex')) {
    foreach($bad in @(@('zero',0),@('negative',-1),@('too-high',257),@('fraction',1.5),@('string','1'),@('boolean',$true),@('null',$null),@('array',@(1)))) {
        $invalid=(Copy-PointPlan);$invalid[$field]=$bad[1]
        Reject-Plan ('point-'+$field+'-'+$bad[0]) (ConvertTo-Json -InputObject @($invalid) -Compress -Depth 5)
    }
}
foreach($spec in @(
    @('chartName-empty','chartName',''),@('chartName-number','chartName',7),@('chartName-too-long','chartName',('x'*256)),
    @('chartName-array','chartName',@('Exact chart')),@('shapeName-array','shapeName',@('Exact ring')),@('sign-array','valueSign',@(1)),
    @('shapeName-empty','shapeName',''),@('kind-unsupported','chartKind','radar'),@('kind-case','chartKind','Marker'),@('kind-array','chartKind',@('marker')),
    @('edge-unsupported','edge','left'),@('edge-case','edge','Center'),@('edge-array','edge',@('center')),
    @('sign-too-high','valueSign',2),@('sign-too-low','valueSign',-2),@('sign-fraction','valueSign',0.5),@('sign-string','valueSign','1'),@('sign-boolean','valueSign',$true),
    @('unknown-field','sourceX',123)
)) {
    $invalid=(Copy-PointPlan);$invalid[$spec[1]]=$spec[2]
    Reject-Plan ('point-'+$spec[0]) (ConvertTo-Json -InputObject @($invalid) -Compress -Depth 5)
}

# The same function-output unwrapping affected shared fields and legacy actions.
foreach($scope in @('point','legacy')) {
    foreach($bad in @(@('op-array','op',@('unused')),@('op-null','op',$null),@('op-number','op',7),@('slide-array','slideIndex',@(1)),@('slide-null','slideIndex',$null),@('shape-array','shapeName',@('Exact ring')),@('shape-null','shapeName',$null),@('shape-number','shapeName',7))) {
        $invalid=if($scope -eq 'point') {Copy-PointPlan} else {[ordered]@{op='set-text';slideIndex=1;shapeName='Exact ring';text='Words'}}
        # Assign the property itself so no helper output can collapse test arrays.
        if($bad[0] -eq 'op-array') {$invalid[$bad[1]]=@($invalid.op)}
        elseif($bad[0] -in @('slide-array','shape-array')) {$invalid[$bad[1]]=@($bad[2])}
        else {$invalid[$bad[1]]=$bad[2]}
        Reject-Plan ($scope+'-common-'+$bad[0]) (ConvertTo-Json -InputObject @($invalid) -Compress -Depth 5)
    }
}
Reject-Plan 'legacy-text-array' '[{"op":"set-text","slideIndex":1,"shapeName":"Exact ring","text":["Words"]}]'

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


# RR-109: execute the actual owned lifecycle helpers against file-backed fakes.
# No Office entrypoint or COM class is evaluated; injected failures prove the latch.
function Write-FurnitureReport { }
$lifecycleCases=New-Object 'System.Collections.Generic.List[object]'
function New-LifecycleFixture([string]$Name,[string]$Mode='') {
    $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true; $script:presentation=$null; $script:ownedPresentationPath=$null
    $script:lifecycleLog=New-Object 'System.Collections.Generic.List[string]'
    $script:lifecycleMode=$Mode; $script:lifecycleCopies=@{}
    $fixtureInput=Join-Path $planRoot ($Name+'.pptx'); $copy=Join-Path $planRoot ($Name+'-saved.pptx')
    [IO.File]::WriteAllText($fixtureInput,'original')
    $list=[pscustomobject]@{Count=0;Values=@()}
    $list | Add-Member -MemberType ScriptMethod -Name Item -Value {param($index) return $this.Values[$index-1]}
    $list | Add-Member -MemberType ScriptMethod -Name Open -Value {
        param($path,$readOnly,$untitled,$window)
        $script:lifecycleLog.Add('open:'+ $path + ':' + $readOnly)
        if($readOnly -ne -1 -or $untitled -ne 0) { throw 'Writable or untitled open was requested' }
        $text=if($script:lifecycleCopies.ContainsKey($path)){$script:lifecycleCopies[$path]}else{'original'}
        $presentation=[pscustomobject]@{FullName=$path;ReadOnly=-1;Saved=0;Text=$text;Closed=$false}
        if($script:lifecycleMode -eq 'wrong-open-path') { $presentation.FullName='unrelated.pptx' }
        if($script:lifecycleMode -eq 'writable-open') { $presentation.ReadOnly=0 }
        $presentation | Add-Member -MemberType ScriptMethod -Name SaveCopyAs -Value {
            param($path,$format)
            $script:lifecycleLog.Add('save-copy:'+ $path)
            if($script:lifecycleMode -eq 'copy-failure') { throw 'Injected SaveCopyAs failure' }
            if($format -ne 24) { throw 'Unexpected output format' }
            [IO.File]::WriteAllText($path,$this.Text); $script:lifecycleCopies[$path]=$this.Text
            if($script:lifecycleMode -eq 'copy-identity-change') { $this.FullName=$path }
        }
        $presentation | Add-Member -MemberType ScriptMethod -Name Save -Value {throw 'Save must never run'}
        $presentation | Add-Member -MemberType ScriptMethod -Name SaveAs -Value {throw 'SaveAs must never run'}
        $presentation | Add-Member -MemberType ScriptMethod -Name Close -Value {
            if($this.Saved -ne -1) { throw 'Dirty close would prompt' }
            $script:lifecycleLog.Add('close:'+ $this.FullName)
            if($script:lifecycleMode -eq 'close-failure') { throw 'Injected Close failure' }
            $this.Closed=$true; $script:lifecycleCollection.Count=0; $script:lifecycleCollection.Values=@()
        }
        $this.Count=1; $this.Values=@($presentation); return $presentation
    }
    $script:lifecycleCollection=$list
    $application=[pscustomobject]@{Presentations=$list;QuitCalled=$false}
    $application | Add-Member -MemberType ScriptMethod -Name Quit -Value {
        $script:lifecycleLog.Add('quit')
        if($script:lifecycleMode -eq 'quit-failure') { throw 'Injected Quit failure' }
        if($this.Presentations.Count -ne 0) { throw 'Foreign presentation must not be closed' }
        $this.QuitCalled=$true
    }
    $script:ownedApplication=$null
    Assert-OwnedFurnitureApplication $application
    return [ordered]@{input=$fixtureInput;copy=$copy;app=$application}
}
function Assert-LifecycleLatched([string]$Name,[scriptblock]$Action) {
    $rejected=$false;try { & $Action } catch { $rejected=$true }
    if(-not $rejected -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw "$Name did not refuse and latch" }
    $before=$script:lifecycleLog.Count
    try { Save-OwnedFurnitureCopy 'forbidden.pptx' 'forbidden-copy.pptx' } catch { }
    try { Close-OwnedFurniture 'forbidden-close' 'forbidden.pptx' } catch { }
    try { Quit-OwnedFurnitureApplication $fixture.app } catch { }
    if($script:lifecycleLog.Count -ne $before) { throw "$Name performed a later Office operation" }
    $lifecycleCases.Add([ordered]@{name=$Name;passed=$true})
}
$fixture=New-LifecycleFixture 'success'
Open-OwnedFurniture $fixture.app $fixture.input 'input'
$script:presentation.Text='Native edit' + [char]13 + 'Second line'
Save-OwnedFurnitureCopy $fixture.input $fixture.copy
if($script:presentation.FullName -cne $fixture.input -or $script:ownedPresentationPath -cne $fixture.input) { throw 'SaveCopyAs changed exact owned identity' }
Close-OwnedFurniture 'edited' $fixture.input
Open-OwnedFurniture $fixture.app $fixture.copy 'reopen'
if($script:presentation.Text -cne ('Native edit' + [char]13 + 'Second line')) { throw 'Reopened current text differs' }
Close-OwnedFurniture 'reopened' $fixture.copy
Quit-OwnedFurnitureApplication $fixture.app
if(-not $fixture.app.QuitCalled) {throw 'Owned empty application was not quit'}
if([IO.File]::ReadAllText($fixture.input) -cne 'original' -or -not $script:cleanupConfirmed -or $script:presentation -ne $null) { throw 'Input changed or owned cleanup incomplete' }
$lifecycleCases.Add([ordered]@{name='readonly-copy-edit-reopen';passed=$true;events=@($script:lifecycleLog.ToArray())})
foreach($mode in @('wrong-open-path','writable-open')) {
    $fixture=New-LifecycleFixture $mode $mode
    Assert-LifecycleLatched $mode { Open-OwnedFurniture $fixture.app $fixture.input 'input' }
}
foreach($mode in @('copy-failure','copy-identity-change')) {
    $fixture=New-LifecycleFixture $mode $mode; Open-OwnedFurniture $fixture.app $fixture.input 'input'
    Assert-LifecycleLatched $mode { Save-OwnedFurnitureCopy $fixture.input $fixture.copy }
}
$fixture=New-LifecycleFixture 'same-path'; Open-OwnedFurniture $fixture.app $fixture.input 'input'
Assert-LifecycleLatched 'refuse-input-overwrite' { Save-OwnedFurnitureCopy $fixture.input $fixture.input }
$fixture=New-LifecycleFixture 'existing-output'; Open-OwnedFurniture $fixture.app $fixture.input 'input'; [IO.File]::WriteAllText($fixture.copy,'prior-attempt')
Assert-LifecycleLatched 'refuse-existing-output' { Save-OwnedFurnitureCopy $fixture.input $fixture.copy }
if([IO.File]::ReadAllText($fixture.copy) -cne 'prior-attempt') { throw 'Prior derivative overwritten' }
$fixture=New-LifecycleFixture 'wrong-close-owner'; Open-OwnedFurniture $fixture.app $fixture.input 'input'; $held=$script:presentation
Assert-LifecycleLatched 'refuse-unowned-close' { Close-OwnedFurniture 'unowned' 'unrelated.pptx' }
if($held.Saved -ne 0 -or $held.Closed) { throw 'Unowned presentation modified before identity refusal' }
$fixture=New-LifecycleFixture 'close-failure' 'close-failure'; Open-OwnedFurniture $fixture.app $fixture.input 'input'
Assert-LifecycleLatched 'close-failure' { Close-OwnedFurniture 'edited' $fixture.input }
$fixture=New-LifecycleFixture 'foreign-at-adoption'; $script:ownedApplication=$null; $fixture.app.Presentations.Count=1
Assert-LifecycleLatched 'refuse-nonempty-application-adoption' {Assert-OwnedFurnitureApplication $fixture.app}
if($fixture.app.QuitCalled) {throw 'Foreign application was cleaned up'}
$fixture=New-LifecycleFixture 'foreign-at-quit'; $fixture.app.Presentations.Count=1
Assert-LifecycleLatched 'refuse-nonempty-application-quit' {Quit-OwnedFurnitureApplication $fixture.app}
if($fixture.app.QuitCalled) {throw 'Foreign presentation application was quit'}
$fixture=New-LifecycleFixture 'quit-failure' 'quit-failure'
Assert-LifecycleLatched 'quit-failure' {Quit-OwnedFurnitureApplication $fixture.app}
$fixture=New-LifecycleFixture 'unowned-quit'; $other=[pscustomobject]@{Presentations=$fixture.app.Presentations}
Assert-LifecycleLatched 'refuse-unowned-application-quit' {Quit-OwnedFurnitureApplication $other}
function Get-Process { param($Name,$ErrorAction) if($script:mockPowerPointRunning){return [pscustomobject]@{Name='POWERPNT'}} }
$script:mockPowerPointRunning=$true; $rejected=$false;try {Assert-FurnitureOfficeIdle} catch {$rejected=$true}
if(-not $rejected) {throw 'Running Office was not refused'}
$script:mockPowerPointRunning=$false; Assert-FurnitureOfficeIdle
Remove-Item Function:Get-Process
$lifecycleCases.Add([ordered]@{name='refuse-running-office';passed=$true})

# SH-25: tabled independent actual-property probes. No expected source coordinates enter the action.
$chartPointCases=New-Object 'System.Collections.Generic.List[object]'
function New-ChartPointFixture([string]$Kind='horizontal-bar') {
    $fixtureType=switch($Kind){'horizontal-bar'{57};'vertical-bar'{51};'marker'{65};'slice'{5};default{throw 'Unknown fake native kind'}}
    # Slice success is a pie (type5) fixture, never evidence of doughnut API availability.
    $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true; $script:forbiddenChartData=$false
    $point=[pscustomobject]@{Left=10;Top=20;Width=40;Height=30;SliceChartType=$fixtureType;SliceCoordinates=@{2=@(40,60);3=@(60,20);4=@(35,20);8=@(30,40)};SliceCalls=(New-Object 'System.Collections.Generic.List[object]');SliceThrowAt=''}
    $point | Add-Member -MemberType ScriptMethod -Name PieSliceLocation -Value {
        param($location,$index)
        $this.SliceCalls.Add([ordered]@{location=$location;index=$index})
        if($this.SliceChartType -eq 5 -and $index -eq 8) {throw 'Index8 is doughnut-only, not an inner point of a pie'}
        if($index -eq 5) {throw 'Index5 does not establish the required radial midpoint'}
        if($this.SliceThrowAt -eq ('{0}:{1}' -f $index,$location)) {throw 'Injected radial getter failure'}
        if(-not $this.SliceCoordinates.ContainsKey($index)) {throw 'Unexpected slice index'}
        return $this.SliceCoordinates[$index][$location-1]
    }
    $points=[pscustomobject]@{Count=1;Values=@($point)}
    $points | Add-Member -MemberType ScriptMethod -Name Item -Value {param($index) return $this.Values[$index-1]}
    $series=[pscustomobject]@{Name='Native value';ChartType=$fixtureType;PointCollection=$points}
    $series | Add-Member -MemberType ScriptMethod -Name Points -Value {return ,$this.PointCollection}
    $seriesCollection=[pscustomobject]@{Count=1;Values=@($series)}
    $seriesCollection | Add-Member -MemberType ScriptMethod -Name Item -Value {param($index) return $this.Values[$index-1]}
    $chart=[pscustomobject]@{ChartType=$fixtureType;Series=$seriesCollection}
    $chart | Add-Member -MemberType ScriptMethod -Name SeriesCollection -Value {return ,$this.Series}
    $chart | Add-Member -MemberType ScriptProperty -Name ChartData -Value {$script:forbiddenChartData=$true;throw 'ChartData must not be activated or read'}
    $chartShape=[pscustomobject]@{Name='Native chart';Left=100;Top=200;HasChart=-1;Chart=$chart}
    $overlay=[pscustomobject]@{Name='Native ring';Left=0;Top=0;Width=10;Height=10}
    $shapes=[pscustomobject]@{Count=2;Values=@($chartShape,$overlay)}
    $shapes | Add-Member -MemberType ScriptMethod -Name Item -Value {param($index) return $this.Values[$index-1]}
    $slides=[pscustomobject]@{Count=1;Values=@([pscustomobject]@{Shapes=$shapes})}
    $slides | Add-Member -MemberType ScriptMethod -Name Item -Value {param($index) return $this.Values[$index-1]}
    return [ordered]@{presentation=[pscustomobject]@{Slides=$slides};point=$point;points=$points;overlay=$overlay;chart=$chart;chartShape=$chartShape;series=$seriesCollection}
}
$coordinateCases=@(
    @('horizontal-bar','end',1,150,235),@('horizontal-bar','start',1,110,235),
    @('horizontal-bar','end',-1,110,235),@('horizontal-bar','start',-1,150,235),
    @('horizontal-bar','top',1,130,220),@('horizontal-bar','bottom',1,130,250),@('horizontal-bar','center',1,130,235),
    @('vertical-bar','end',1,130,220),@('vertical-bar','start',1,130,250),
    @('vertical-bar','end',-1,130,250),@('vertical-bar','start',-1,130,220),
    @('marker','end',1,130,235),@('marker','top',1,130,235),@('marker','center',1,130,235),
    @('slice','end',1,140,260),@('slice','start',1,110,220),@('slice','center',1,125,240),
    @('slice','top',1,130,220),@('slice','bottom',1,130,250)
)
foreach($spec in $coordinateCases) {
    $nativeFixture=New-ChartPointFixture $spec[0]
    # Top/bottom mocks now supply actual circular arcs instead of assuming the unrelated endpoint box is a curve.
    if($spec[0] -eq 'slice' -and $spec[1] -eq 'top') {$nativeFixture.point.SliceCoordinates=@{1=@(10,40);2=@(30,20);3=@(50,40);4=@(40,40)}}
    if($spec[0] -eq 'slice' -and $spec[1] -eq 'bottom') {$nativeFixture.point.SliceCoordinates=@{1=@(50,30);2=@(30,50);3=@(10,30);4=@(20,30)}}
    $action=[pscustomobject]@{slideIndex=1;shapeName='Native ring';chartName='Native chart';seriesIndex=1;pointIndex=1;chartKind=$spec[0];edge=$spec[1];valueSign=$spec[2]}
    $nativeFixture.overlay.Left=$spec[3]-5; $nativeFixture.overlay.Top=$spec[4]-5
    $observed=Read-FurnitureChartPoint $nativeFixture.presentation $action 'chart-probe'
    if($observed.nativePointSlidePoints[0] -ne $spec[3] -or $observed.nativePointSlidePoints[1] -ne $spec[4] -or $observed.distancePixels -ne 0 -or -not $observed.withinFourPixels -or $script:forbiddenChartData) {throw 'Native point probe changed coordinate systems or accessed data workbook'}
    $chartPointCases.Add([ordered]@{kind=$spec[0];edge=$spec[1];sign=$spec[2];nativeSlidePoints=@($spec[3],$spec[4]);passed=$true})
}
# Radial positions are independent native API observations, including translated and full-circle models.
foreach($model in @('pie-translated','pie-full-circle','doughnut-radial')) {
    foreach($edge in @('start','center','end')) {
        $nativeFixture=New-ChartPointFixture 'slice'
        $wantedIndices=@();$expected=@()
        switch($model) {
            'pie-translated' {
                $nativeFixture.chartShape.Left=-60;$nativeFixture.chartShape.Top=340
                $nativeFixture.point.SliceCoordinates=@{2=@(130,180);3=@(150,140);4=@(125,140)}
                $expected=switch($edge){'start'{@(40,480)};'center'{@(55,500)};'end'{@(70,520)}}
            }
            'pie-full-circle' {
                $nativeFixture.point.Left=0;$nativeFixture.point.Top=20;$nativeFixture.point.Width=100;$nativeFixture.point.Height=100
                $nativeFixture.point.SliceCoordinates=@{2=@(0,70);3=@(100,70);4=@(75,70)}
                $expected=switch($edge){'start'{@(150,270)};'center'{@(125,270)};'end'{@(100,270)}}
            }
            'doughnut-radial' {
                $nativeFixture.chart.ChartType=-4120;$nativeFixture.series.Values[0].ChartType=-4120;$nativeFixture.point.SliceChartType=-4120
                $expected=switch($edge){'start'{@(130,240)};'center'{@(135,250)};'end'{@(140,260)}}
            }
        }
        $wantedIndices=if($model -eq 'doughnut-radial'){switch($edge){'start'{@(8,8)};'center'{@(8,8,2,2)};'end'{@(2,2)}}}else{switch($edge){'start'{@(3,3,4,4)};'center'{@(3,3,4,4,2,2)};'end'{@(2,2)}}}
        $action=[pscustomobject]@{slideIndex=1;shapeName='Native ring';chartName='Native chart';seriesIndex=1;pointIndex=1;chartKind='slice';edge=$edge;valueSign=1}
        $nativeFixture.overlay.Left=$expected[0]-5;$nativeFixture.overlay.Top=$expected[1]-5
        $observed=Read-FurnitureChartPoint $nativeFixture.presentation $action 'radial-model'
        if($observed.nativePointSlidePoints[0] -ne $expected[0] -or $observed.nativePointSlidePoints[1] -ne $expected[1] -or $observed.distancePixels -ne 0) {throw 'Independent radial model used an unsupported index or guessed center'}
        if((@($observed.nativeSliceObservations | ForEach-Object {$_.index}) -join ',') -cne ($wantedIndices -join ',')) {throw 'Raw native API indices were not retained'}
        if((@($nativeFixture.point.SliceCalls | ForEach-Object {$_.index}) -join ',') -cne ($wantedIndices -join ',')) {throw 'Unexpected native radial API call'}
        if(@($observed.nativeSliceObservations | Where-Object {-not $_.Contains('rawValue') -or -not $_.Contains('value')}).Count -ne 0) {throw 'Raw native coordinate values were lost'}
        if($nativeFixture.point.SliceCalls.Count -ne $wantedIndices.Count -or $script:forbiddenChartData) {throw 'Radial model accessed unrelated native data'}
        $chartPointCases.Add([ordered]@{name=$model+'-'+$edge;nativeSlidePoints=$expected;indices=$wantedIndices;rawNativeCoordinates=$observed.nativeSliceObservations;passed=$true})
    }
}
$nativeFixture=New-ChartPointFixture 'marker'
$action=[pscustomobject]@{slideIndex=1;shapeName='Native ring';chartName='Native chart';seriesIndex=1;pointIndex=1;chartKind='marker';edge='center';valueSign=1}
foreach($delta in @(3,3.01)) {
    $nativeFixture.overlay.Left=125+$delta; $nativeFixture.overlay.Top=230
    $observed=Read-FurnitureChartPoint $nativeFixture.presentation $action 'distance-bound'
    if($observed.withinFourPixels -ne ($delta -eq 3)) {throw 'Actual4px measurement threshold changed'}
}
$chartPointCases.Add([ordered]@{name='exact-four-pixel-bound';passed=$true})
foreach($failure in @('missing-series','missing-point','nonfinite-point','slice-getter')) {
    $nativeFixture=New-ChartPointFixture 'marker';$action.chartKind='marker';$action.edge='center'
    switch($failure) {
        'missing-series' {$nativeFixture.series.Count=0}
        'missing-point' {$nativeFixture.points.Count=0}
        'nonfinite-point' {$nativeFixture.point.Left=[double]::NaN}
        'slice-getter' {$nativeFixture=New-ChartPointFixture 'slice';$action.chartKind='slice';$action.edge='end';$nativeFixture.point | Add-Member -Force -MemberType ScriptMethod -Name PieSliceLocation -Value {throw 'Injected native slice getter failure'}}
    }
    $rejected=$false;try {$null=Read-FurnitureChartPoint $nativeFixture.presentation $action 'refusal'} catch {$rejected=$true}
    if(-not $rejected -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) {throw 'Missing/nonfinite/failed native point was not latched'}
    $eventCount=$script:events.Count;try {$null=Read-FurnitureChartPoint $nativeFixture.presentation $action 'forbidden-followup'} catch {}
    if($script:events.Count -ne $eventCount -or $script:forbiddenChartData) {throw 'A later native measurement ran after failure'}
    $chartPointCases.Add([ordered]@{name=$failure;passed=$true})
}

# Invalid native values/getters latch immediately; the partial independent observations remain inspectable.
foreach($failure in @('pie-midradius-getter-failure','pie-midradius-nonfinite','pie-midradius-null','pie-center-nonfinite','pie-outer-nonfinite','doughnut-inner-nonfinite')) {
    $nativeFixture=New-ChartPointFixture 'slice'
    $action=[pscustomobject]@{slideIndex=1;shapeName='Native ring';chartName='Native chart';seriesIndex=1;pointIndex=1;chartKind='slice';edge='start';valueSign=1}
    $expectedCalls=switch($failure){
        'pie-midradius-getter-failure' {$nativeFixture.point.SliceThrowAt='4:1';3}
        'pie-midradius-nonfinite' {$nativeFixture.point.SliceCoordinates[4][0]=[double]::NaN;3}
        'pie-midradius-null' {$nativeFixture.point.SliceCoordinates[4][0]=$null;3}
        'pie-center-nonfinite' {$nativeFixture.point.SliceCoordinates[3][0]=-1e308;$nativeFixture.point.SliceCoordinates[4][0]=1e308;$action.edge='center';4}
        'pie-outer-nonfinite' {$nativeFixture.point.SliceCoordinates[2][0]=[double]::PositiveInfinity;$action.edge='center';5}
        'doughnut-inner-nonfinite' {$nativeFixture.chart.ChartType=-4120;$nativeFixture.series.Values[0].ChartType=-4120;$nativeFixture.point.SliceChartType=-4120;$nativeFixture.point.SliceCoordinates[8][0]=[double]::NaN;1}
    }
    $probe=New-FurniturePointProbe $action 'partial-radial';$rejected=$false
    try {$null=Read-FurnitureChartPoint $nativeFixture.presentation $action 'partial-radial' $probe} catch {$rejected=$true}
    if(-not $rejected -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed -or $script:forbiddenChartData) {throw 'Invalid radial native coordinates did not latch'}
    if($nativeFixture.point.SliceCalls.Count -ne $expectedCalls) {throw 'A radial getter ran after the first failure'}
    if($probe.sliceCoordinates.Count -eq 0 -or @($probe.sliceCoordinates | Where-Object {-not $_.Contains('rawValue')}).Count -ne 0) {throw 'Partial native radial observations were lost'}
    $eventCount=$script:events.Count;try {$null=Read-FurnitureChartPoint $nativeFixture.presentation $action 'forbidden-radial-followup'} catch {}
    if($script:events.Count -ne $eventCount -or $nativeFixture.point.SliceCalls.Count -ne $expectedCalls) {throw 'A latched radial failure allowed later native calls'}
    $chartPointCases.Add([ordered]@{name=$failure;nativeCalls=$expectedCalls;partialRawCoordinates=@($probe.sliceCoordinates.ToArray());passed=$true})
}

function New-ActualDoughnutFixture {
    $native=New-ChartPointFixture 'slice'
    $raw=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/sh25-native-circle-observations.json') -Raw | ConvertFrom-Json
    $native.chart.ChartType=-4120;$native.series.Values[0].ChartType=-4120;$native.point.SliceChartType=-4120
    $native.point.SliceCoordinates=@{}
    foreach($index in @(1,2,3,7,8,9)){$values=@($raw.probe.sliceCoordinates | Where-Object {$_.index -eq $index} | Sort-Object location | ForEach-Object {[double]$_.value});$native.point.SliceCoordinates[$index]=$values}
    $native.chartShape.Left=$raw.chart.left;$native.chartShape.Top=$raw.chart.top
    foreach($name in @('Left','Top','Width','Height')){$native.overlay.$name=$raw.overlay.($name.ToLowerInvariant())}
    $native.chart | Add-Member -MemberType NoteProperty -Name ObservedPlotArea -Value ([pscustomobject]@{InsideLeft=($raw.probe.plotCenterLocalPoints[0]-50);InsideTop=($raw.probe.plotCenterLocalPoints[1]-50);InsideWidth=100;InsideHeight=100})
    $script:plotCenterReads=0
    $native.chart | Add-Member -MemberType ScriptProperty -Name PlotArea -Value {$script:plotCenterReads++;return $this.ObservedPlotArea}
    return $native
}
$nativeFixture=New-ActualDoughnutFixture
$action=[pscustomobject]@{op='measure-chart-point';slideIndex=1;shapeName='Native ring';chartName='Native chart';seriesIndex=1;pointIndex=1;chartKind='slice';edge='top';valueSign=1}
$probe=New-FurniturePointProbe $action 'actual-native-circle'
$actualCircle=Read-FurnitureChartPoint $nativeFixture.presentation $action 'actual-native-circle' $probe
if(-not $actualCircle.withinFourPixels -or $script:plotCenterReads -ne 0){throw 'Actual native doughnut observations must pass without using PlotArea center'}
$chartPointCases.Add([ordered]@{name='actual-doughnut-outer-circle';distancePixels=$actualCircle.distancePixels;observations=$actualCircle.nativeSliceObservations;passed=$true})
$nativeFixture=New-ActualDoughnutFixture
$nativeFixture.point.SliceCoordinates[7][0]+=5
$script:report=[ordered]@{actionPlan=[ordered]@{chartPoints=@();currentChartPointProbe=$null}}
$failureMessage=$null;try{Apply-FurnitureAction $nativeFixture.presentation $action 1}catch{$failureMessage=$_.Exception.Message}
if($null -eq $failureMessage -or -not $script:officeOperationsStopped){throw 'Invalid actual inner circle was not refused'}
$serializedPath=Join-Path $planRoot 'serialized-curved-refusal.json'
$report | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $serializedPath -Encoding UTF8
$serialized=Get-Content -LiteralPath $serializedPath -Raw | ConvertFrom-Json
if(@($serialized.actionPlan.chartPoints).Count -ne 0 -or @($serialized.actionPlan.currentChartPointProbe.sliceCoordinates).Count -ne 12){throw 'Serialized failed report lost actual partial observations'}
foreach($observation in $serialized.actionPlan.currentChartPointProbe.sliceCoordinates){if($null -eq $observation.rawValue -or $null -eq $observation.value){throw 'Serialized raw/value observation was lost'}}
$eventsAtFailure=$script:events.Count;try{Apply-FurnitureAction $nativeFixture.presentation $action 2}catch{}
if($eventsAtFailure -ne $script:events.Count){throw 'Serialized geometry refusal allowed later Office calls'}
$chartPointCases.Add([ordered]@{name='serialized-curved-refusal';error=$failureMessage;path=$serializedPath;rawObservations=12;passed=$true})

foreach($failure in @('wrong-native-kind','mixed-series-type','unsupported-native-type','doughnut-api-unavailable')) {
    $nativeFixture=New-ChartPointFixture 'vertical-bar'
    $action=[pscustomobject]@{slideIndex=1;shapeName='Native ring';chartName='Native chart';seriesIndex=1;pointIndex=1;chartKind='vertical-bar';edge='end';valueSign=1}
    $wanted=switch($failure){
        'wrong-native-kind' {$action.chartKind='marker';'chartKind differs'}
        'mixed-series-type' {$nativeFixture.series.Values[0].ChartType=65;'series type differs'}
        'unsupported-native-type' {$nativeFixture.chart.ChartType=-4152;'not a supported classic'}
        'doughnut-api-unavailable' {$nativeFixture=New-ChartPointFixture 'slice';$nativeFixture.chart.ChartType=-4120;$nativeFixture.series.Values[0].ChartType=-4120;$action.chartKind='slice';$nativeFixture.point | Add-Member -Force -MemberType ScriptMethod -Name PieSliceLocation -Value {throw 'Doughnut API availability is unqualified'};'Doughnut API availability is unqualified'}
    }
    $errorText=$null;try {$null=Read-FurnitureChartPoint $nativeFixture.presentation $action 'type-refusal'} catch {$errorText=$_.Exception.Message}
    if($null -eq $errorText -or -not $errorText.Contains($wanted) -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed -or $script:forbiddenChartData) {throw ('Native type/availability refusal failed: '+$failure)}
    if($failure -ne 'doughnut-api-unavailable' -and @($script:events | Where-Object {$_ -like 'type-refusal.point.*'}).Count -ne 0) {throw 'Wrong native type reached point geometry'}
    $eventCount=$script:events.Count;try {$null=Read-FurnitureChartPoint $nativeFixture.presentation $action 'forbidden-type-followup'} catch {}
    if($script:events.Count -ne $eventCount) {throw 'A native type failure allowed later calls'}
    $chartPointCases.Add([ordered]@{name=$failure;passed=$true})
}

[ordered]@{
    passed=$true
    textFontControls=$fontCases
    lifecycleControls=@($lifecycleCases.ToArray())
    chartPointControls=@($chartPointCases.ToArray())
    scope='Read-only owned-copy lifecycle, SaveCopyAs identity, overwrite/unowned-close/running-Office refusals, error latch; Windows PowerShell 5.1 parse; pure uniform/mixed/unavailable whole-range font descriptors and error latch; size/color edit and exact-target mocks; readback/text-change refusal;  AST-only action-plan validation; empty/single/multi list behavior; invalid-plan rejection; collection identity and fail-closed wrapper. No Office object was constructed.'
    powershell=$PSVersionTable.PSVersion.ToString()
    verifierSha256=(Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
    checkerSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    accepted=@($cases.ToArray() | Where-Object {$_.expected -eq 'accept'}).Count
    rejected=@($cases.ToArray() | Where-Object {$_.expected -eq 'reject'}).Count
    cases=@($cases.ToArray())
    events=@($script:events.ToArray())
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportFull -Encoding UTF8
Write-Output 'Furniture harness checks passed: plans, collection identity and fail-closed wrapper. No Office automation used.'
