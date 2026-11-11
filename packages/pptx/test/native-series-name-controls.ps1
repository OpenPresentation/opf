param([string]$ScriptPath='', [Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop';if($ScriptPath -eq ''){$ScriptPath=Join-Path $PSScriptRoot 'native-furniture-control.ps1'};if(Test-Path -LiteralPath $ReportPath){throw 'Preserve prior series-name controls'};$planRoot=$ReportPath+'.plans';[void](New-Item -ItemType Directory -Path $planRoot)
$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($ScriptPath,[ref]$t,[ref]$e);if($e.Count){throw ($e|Out-String)}
$names=@('Test-Integer','Require-Property','Assert-String','Assert-LiteralSeriesName','Assert-FurnitureReferenceNameAction','Assert-FurnitureReferenceNameMode','Read-AndValidateActionPlan','Invoke-FurnitureCom','Stop-FurnitureLifecycle','Get-ExactSlide','Get-ExactShape','Get-FurnitureSeriesTypeObservation','Get-FurnitureSeriesTarget','Read-FurnitureLiteralSeriesName','Set-FurnitureSeriesName','Read-FurnitureSeriesNameState','Apply-FurnitureAction','Assert-PresentationNotOpen','Assert-OwnedFurnitureApplication','Open-OwnedFurniture','Save-OwnedFurnitureCopy','Close-OwnedFurniture','Quit-OwnedFurnitureApplication')
foreach($name in $names){$fn=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if($null -ne $fn){Invoke-Expression $fn.Extent.Text}}
$fixtureAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'native-furniture-harness-check.ps1'),[ref]$t,[ref]$e);foreach($name in @('New-ChartPointFixture','New-LifecycleFixture')){$fn=$fixtureAst.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if($null -eq $fn){throw 'Missing reviewed native-only fixture'};Invoke-Expression $fn.Extent.Text}
$script:events=New-Object 'System.Collections.Generic.List[string]';function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null){$script:events.Add($Name+':'+$Status)};function Write-FurnitureReport{}
$cases=New-Object 'System.Collections.Generic.List[object]'
function Rename([int]$Index=1,[string]$Before='Current',[string]$After='Native renamed'){return [pscustomobject]@{op='set-chart-series-name';slideIndex=1;chartName='Native chart';seriesIndex=$Index;expectedName=$Before;newName=$After}}
function Plan([string]$Name,$Items,[bool]$Accept){$p=Join-Path $planRoot ($Name+'.json');ConvertTo-Json -InputObject $Items -Depth 8|Set-Content -LiteralPath $p -Encoding UTF8;$before=$script:events.Count;$errorText=$null;try{$validated=Read-AndValidateActionPlan $p}catch{$errorText=$_.Exception.Message};if($Accept -and $errorText){throw ($Name+':'+$errorText)};if(-not $Accept -and -not $errorText){throw ($Name+'unexpectedlyaccepted')};if($script:events.Count -ne $before){throw 'Plan validation crossed a native boundary'};$cases.Add([ordered]@{name=('plan-'+$Name);accepted=$Accept;error=$errorText;passed=$true})}
Plan 'single-literal' @((Rename)) $true
Plan 'two-literals' @((Rename 1 'Current' 'New current'),(Rename 2 'Expansion' 'New expansion')) $true
Plan 'unicode' @((Rename 1 'الإيراد' 'إيراد جديد')) $true
Plan 'pipe-literal' @((Rename 1 'Current | total' 'Native | total')) $true
Plan 'with-measurement' @((Rename),([pscustomobject]@{op='measure-chart-point';slideIndex=1;shapeName='Native ring';chartName='Native chart';seriesIndex=1;pointIndex=1;chartKind='vertical-bar';edge='end';valueSign=1})) $true
foreach($field in @('expectedName','newName')){foreach($bad in @(@('empty',''),@('padded',' Current'),@('formula','=Sheet1!A1'),@('range','Sheet1!A1'),@('colon','A1:A2'),@('control',"Current`nOther"),@('number',12),@('single-array',@('Current')),@('null',$null))){$a=Rename;$a.$field=$bad[1];Plan ($field+'-'+$bad[0]) @($a) $false}}
foreach($bad in @(@('zero',0),@('fraction',1.5),@('boolean',$true),@('large',257))){$a=Rename;$a.seriesIndex=$bad[1];Plan ('index-'+$bad[0]) @($a) $false}
$a=Rename;$a.newName=$a.expectedName;Plan 'no-op' @($a) $false
$a=Rename;$a|Add-Member -MemberType NoteProperty -Name shapeName -Value 'extra';Plan 'extra-shape-property' @($a) $false
$a=Rename;$a.op='SET-CHART-SERIES-NAME';Plan 'operation-case' @($a) $false
Plan 'duplicate-target' @((Rename),(Rename 1 'Current' 'Other literal')) $false
Plan 'duplicate-new-name' @((Rename),(Rename 2 'Expansion' 'Native renamed')) $false
Plan 'mixed-slide-move' @((Rename),([pscustomobject]@{op='move-slide';slideIndex=1;toIndex=1})) $false
function Fixture([string]$Mode=''){$script:referenceNameEdit=$false;$n=New-ChartPointFixture 'marker';$n.chart.ChartType=51;$series=$n.series.Values[0];$series.ChartType=51;$series|Add-Member -MemberType NoteProperty -Name NativeName -Value 'Current' -Force;$script:nameMode=$Mode;$script:nameSetterCalls=0;$script:nameGetterCalls=0;$series|Add-Member -Force -MemberType ScriptProperty -Name Name -Value {$script:nameGetterCalls++;if($script:nameMode -eq 'getter' -or ($script:nameMode -eq 'readback-getter' -and $script:nameSetterCalls)){throw 'Injected actual Name getter failure'};if($script:nameMode -eq 'nonstr'){return $true};return $this.NativeName} -SecondValue {param($value)$script:nameSetterCalls++;if($script:nameMode -eq 'setter'){throw 'Injected actual Name setter failure'};if($script:nameMode -ne 'ignored'){$this.NativeName=$value}};$other=[pscustomobject]@{Name='Expansion';ChartType=51};$n.series.Count=2;$n.series.Values=@($series,$other);$script:report=[ordered]@{actionPlan=[ordered]@{chartSeriesEdits=@();currentChartSeriesProbe=$null;chartPoints=@();currentChartPointProbe=$null}};return $n}
$n=Fixture;$a=Rename;$original=Read-FurnitureSeriesNameState $n.presentation @($a) 'original';Apply-FurnitureAction $n.presentation $a 1;$edited=Read-FurnitureSeriesNameState $n.presentation @($a) 'edited';$reopened=Read-FurnitureSeriesNameState $n.presentation @($a) 'reopened';if($script:nameSetterCalls -ne 1 -or $original[0].observedName -cne 'Current' -or $edited[0].observedName -cne 'Native renamed' -or $reopened[0].observedName -cne 'Native renamed'){throw 'Actual setter/current phase readback failed'};$cases.Add([ordered]@{name='literal-set-and-phase-readbacks';passed=$true})
$n=Fixture;$empty=Read-FurnitureSeriesNameState $n.presentation @() 'original';if($empty.Count -ne 0){throw 'Empty name targets were not empty'};$multi=Read-FurnitureSeriesNameState $n.presentation @((Rename),(Rename 2 'Expansion' 'Other')) 'original';if($multi.Count -ne 2){throw 'Two target names were lost'};$cases.Add([ordered]@{name='empty-single-multiple-phase-targets';passed=$true})
foreach($failure in @('getter','setter','ignored','readback-getter','nonstr','expected-mismatch','duplicate','not-chart','unsupported','mixed-type','missing-index','bad-runtime-literal','reopened-mismatch')){$n=Fixture $failure;$a=Rename;switch($failure){'expected-mismatch'{$n.series.Values[0].NativeName='Native current edit'};'duplicate'{$n.series.Values[1].Name='native renamed'};'not-chart'{$n.chartShape.HasChart=0};'unsupported'{$n.chart.ChartType=99};'mixed-type'{$n.series.Values[0].ChartType=4};'missing-index'{$a.seriesIndex=3};'bad-runtime-literal'{$a.newName='=Sheet1!A1'}};$errorText=$null;try{if($failure -eq 'reopened-mismatch'){$null=Read-FurnitureSeriesNameState $n.presentation @($a) 'reopened'}else{Apply-FurnitureAction $n.presentation $a 1}}catch{$errorText=$_.Exception.Message};if(-not $errorText -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed){throw ('Expected native-name failure latch:'+ $failure)};if($failure -notin @('setter','ignored','readback-getter') -and $script:nameSetterCalls -ne 0){throw 'Refused precondition called a setter'};$count=$script:events.Count;try{Apply-FurnitureAction $n.presentation $a 2}catch{};if($count -ne $script:events.Count){throw 'Name failure allowed later native calls'};$serialized=$report|ConvertTo-Json -Depth 16;$cases.Add([ordered]@{name=('refuse-'+$failure);setters=$script:nameSetterCalls;error=$errorText;serializedFailure=($serialized|ConvertFrom-Json);passed=$true})}
# Real adapted getter values are recorded before unchanged chart/series guards.
# A CLR enum is deliberately not cast to an integer or admitted as a chart type.
Add-Type -TypeDefinition 'public enum FurnitureSeriesTypeFixture { Line = 4, MixedParent = -4111 } public struct FurnitureSeriesTypeOpaqueFixture { public static int FormatterCalls; public override string ToString() { FormatterCalls++; throw new System.InvalidOperationException("An opaque value must not be formatted"); } }'
foreach($diagnostic in @(
    @('chart-null','chart',$null,'null',$null,$null),
    @('chart-string','chart','4','System.String','4',$null),
    @('chart-boolean','chart',$true,'System.Boolean','True',$null),
    @('chart-unsupported-int','chart',99,'System.Int32','99',99),
    @('chart-enum','chart',[FurnitureSeriesTypeFixture]::Line,'FurnitureSeriesTypeFixture','Line',$null),
    @('chart-opaque','chart',(New-Object FurnitureSeriesTypeOpaqueFixture),'FurnitureSeriesTypeOpaqueFixture','<unsupported native chart type>',$null),
    @('chart-getter-fault','chart',$null,$null,$null,$null),
    @('series-unsupported-int','series',99,'System.Int32','99',99),
    @('series-getter-fault','series',$null,$null,$null,$null)
)) {
    $n=Fixture;$a=Rename;$script:typeDiagnosticMode=$diagnostic[0];$script:typeDiagnosticValue=$diagnostic[2];$script:typeDiagnosticGetterCalls=0
    $object=if($diagnostic[1] -ceq 'chart'){$n.chart}else{$n.series.Values[0]}
    $object|Add-Member -Force -MemberType ScriptProperty -Name ChartType -Value {$script:typeDiagnosticGetterCalls++;if($script:typeDiagnosticMode.EndsWith('getter-fault')){throw 'Injected actual ChartType getter failure'};return ,$script:typeDiagnosticValue}
    $errorText=$null;try{Apply-FurnitureAction $n.presentation $a 1}catch{$errorText=$_.Exception.Message}
    if(-not $errorText -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed -or $script:nameSetterCalls -ne 0 -or $script:typeDiagnosticGetterCalls -ne 1){throw ('Typed refusal did not stop exactly once: '+$diagnostic[0])}
    $serialized=$report|ConvertTo-Json -Depth 16;$observed=$serialized|ConvertFrom-Json;$probe=$observed.actionPlan.currentChartSeriesProbe
    $actual=if($diagnostic[1] -ceq 'chart'){$probe.chartTypeObservation}else{$probe.seriesTypeObservation}
    if($diagnostic[0].EndsWith('getter-fault')){if($null -ne $actual){throw 'A faulted getter fabricated a returned value'}}
    elseif($null -eq $actual -or $actual.observedType -cne $diagnostic[3] -or $actual.observedRawValue -cne $diagnostic[4] -or $actual.numericValue -cne $diagnostic[5]){throw ('Returned type/value evidence changed: '+$diagnostic[0])}
    if([FurnitureSeriesTypeOpaqueFixture]::FormatterCalls -ne 0){throw 'A custom formatter ran outside the native fault boundary'}
    if($diagnostic[1] -ceq 'chart' -and $null -ne $probe.seriesTypeObservation){throw 'Chart refusal performed a later series query'}
    if($diagnostic[1] -ceq 'series' -and ($probe.chartTypeObservation.observedType -cne 'System.Int32' -or $probe.chartTypeObservation.observedRawValue -cne '51' -or $probe.chartTypeObservation.numericValue -ne 51)){throw 'Successful chart getter evidence was lost before series refusal'}
    $count=$script:events.Count;try{Apply-FurnitureAction $n.presentation $a 2}catch{};if($count -ne $script:events.Count -or $script:typeDiagnosticGetterCalls -ne 1 -or $script:nameSetterCalls -ne 0){throw 'Typed refusal allowed later native operations'}
    $cases.Add([ordered]@{name=('type-evidence-'+$diagnostic[0]);setters=0;serializedFailure=$observed;passed=$true})
}
# Exercise the actual owned helpers: fake SaveCopyAs persists only the derivative, then fresh readonly Open reads its changed native name.
$script:lifecycleLog=New-Object 'System.Collections.Generic.List[string]';$life=New-LifecycleFixture 'name-edit-save-reopen';Open-OwnedFurniture $life.app $life.input 'input';$n=Fixture;$script:presentation|Add-Member -MemberType NoteProperty -Name Slides -Value $n.presentation.Slides;$n.series.Values[0]|Add-Member -Force -MemberType ScriptProperty -Name Name -Value {$script:presentation.Text} -SecondValue {param($value)$script:presentation.Text=$value};$a=Rename 1 'original' 'Native renamed';$before=Read-FurnitureSeriesNameState $script:presentation @($a) 'original';Apply-FurnitureAction $script:presentation $a 1;Save-OwnedFurnitureCopy $life.input $life.copy;Close-OwnedFurniture 'edited' $life.input;Open-OwnedFurniture $life.app $life.copy 'reopen';$script:presentation|Add-Member -MemberType NoteProperty -Name Slides -Value $n.presentation.Slides;$after=Read-FurnitureSeriesNameState $script:presentation @($a) 'reopened';if($after[0].observedName -cne 'Native renamed' -or [IO.File]::ReadAllText($life.input) -cne 'original'){throw 'Owned readonly native-name copy/reopen/source preservation failed'};Close-OwnedFurniture 'reopened' $life.copy;Quit-OwnedFurnitureApplication $life.app;$cases.Add([ordered]@{name='owned-readonly-name-edit-savecopy-reopen';lifecycle=@($script:lifecycleLog.ToArray());passed=$true})
# The new domain is allowed only after a separate exact source/plan mode admission.
function ReferenceAction {return [pscustomobject]@{op='set-chart-series-name';slideIndex=1;chartName='OPF chart 1';seriesIndex=1;expectedName='Actual';newName='Actual edited'}}
$referenceSourceHash='06c82deb1dbe067d4f097aebe760b8f1dbdcc0e2a74e95b8d1f99eeea2302a83'
foreach($mode in @('valid-source','source-hash','source-bytes','fonts','survey','extra-action','target-index','literal')){
 $a=ReferenceAction;$items=@($a);$sha=$referenceSourceHash;$bytes=129025;$fonts=$false;$survey=$false
 if($mode -ceq 'source-hash'){$sha='0'*64};if($mode -ceq 'source-bytes'){$bytes++};if($mode -ceq 'fonts'){$fonts=$true};if($mode -ceq 'survey'){$survey=$true};if($mode -ceq 'extra-action'){$items+=@(ReferenceAction)};if($mode -ceq 'target-index'){$a.seriesIndex=2};if($mode -ceq 'literal'){$a.newName='Other'}
 $count=$script:events.Count;$failure=$null;try{Assert-FurnitureReferenceNameMode $items $sha $bytes $fonts $survey}catch{$failure=$_.Exception.Message}
 if(($mode -ceq 'valid-source') -cne ($null -eq $failure) -or $count -ne $script:events.Count){throw ('Reference source/plan gate failed before native boundary: '+$mode)}
 $cases.Add([ordered]@{name=('reference-mode-'+$mode);nativeCalls=0;passed=$true})
}
function ReferenceFixture {
 $n=Fixture;$script:referenceNameEdit=$true;$n.chartShape.Name='OPF chart 1';$n.chart.ChartType=-4111;$n.series.Values[0].ChartType=4;$n.series.Values[0].NativeName='Actual';$n.series.Values[1].Name='OPF reference 1';$n.series.Values[1].ChartType=4
 $n.series.Values=@($n.series.Values[0],$n.series.Values[1],([pscustomobject]@{Name='OPF reference 2';ChartType=4}));$n.series.Count=3;return $n
}
$n=ReferenceFixture;$a=ReferenceAction;$original=Read-FurnitureSeriesNameState $n.presentation @($a) 'original';Apply-FurnitureAction $n.presentation $a 1;$edited=Read-FurnitureSeriesNameState $n.presentation @($a) 'edited';$reopened=Read-FurnitureSeriesNameState $n.presentation @($a) 'reopened'
if($script:nameSetterCalls -ne 1 -or $original[0].observedName -cne 'Actual' -or $edited[0].observedName -cne 'Actual edited' -or $reopened[0].observedName -cne 'Actual edited'){throw 'Closed reference native-name model failed'}
foreach($record in @($original[0],$edited[0],$reopened[0])){if($record.referenceTypeEvidence.chart.numericValue -ne -4111 -or $record.referenceTypeEvidence.series.Count -ne 3 -or @($record.referenceTypeEvidence.series |Where-Object {$_.typeObservation.observedType -cne 'System.Int32' -or $_.typeObservation.numericValue -ne 4}).Count){throw 'Complete phase type facts were lost'}}
$cases.Add([ordered]@{name='reference-domain-three-lines-positive';setters=1;passed=$true})
$n=ReferenceFixture;$script:referenceNameEdit=$false;$a=ReferenceAction;$failure=$null;try{Apply-FurnitureAction $n.presentation $a 1}catch{$failure=$_.Exception.Message};if(-not $failure -or $script:nameSetterCalls -ne 0){throw 'Mixed parent entered the ordinary name domain'};$cases.Add([ordered]@{name='reference-domain-no-flag-refuses';setters=0;passed=$true})
foreach($mode in @('parent-other','parent-null','parent-string','parent-bool','parent-enum','count-two','count-four','count-string','selected-type','selected-string','selected-enum','selected-getter','helper2-type','helper3-type','helper2-getter','helper3-getter','helper2-item','helper3-item','helper-name','changed-plan')){
 $n=ReferenceFixture;$a=ReferenceAction
 switch($mode){
  'parent-other'{$n.chart.ChartType=51};'parent-null'{$n.chart.ChartType=$null};'parent-string'{$n.chart.ChartType='-4111'};'parent-bool'{$n.chart.ChartType=$true};'parent-enum'{$n.chart.ChartType=[FurnitureSeriesTypeFixture]::MixedParent}
  'count-two'{$n.series.Count=2};'count-four'{$n.series.Count=4};'count-string'{$n.series.Count='3'}
  'selected-type'{$n.series.Values[0].ChartType=51};'selected-string'{$n.series.Values[0].ChartType='4'};'selected-enum'{$n.series.Values[0].ChartType=[FurnitureSeriesTypeFixture]::Line}
  'selected-getter'{$n.series.Values[0]|Add-Member -Force -MemberType ScriptProperty -Name ChartType -Value {throw 'Injected selected ChartType getter fault'}}
  'helper2-type'{$n.series.Values[1].ChartType=51};'helper3-type'{$n.series.Values[2].ChartType=51}
  'helper2-getter'{$n.series.Values[1]|Add-Member -Force -MemberType ScriptProperty -Name ChartType -Value {throw 'Injected helper2 ChartType getter fault'}}
  'helper3-getter'{$n.series.Values[2]|Add-Member -Force -MemberType ScriptProperty -Name ChartType -Value {throw 'Injected helper3 ChartType getter fault'}}
  'helper2-item'{$script:referenceFaultItem=2};'helper3-item'{$script:referenceFaultItem=3}
  'helper-name'{$n.series.Values[1].Name='Foreign helper'};'changed-plan'{$a.newName='Other'}
 }
 if($mode -cin @('helper2-item','helper3-item')){$n.series|Add-Member -Force -MemberType ScriptMethod -Name Item -Value {param($index) if($index -eq $script:referenceFaultItem){throw 'Injected exact reference series item fault'};return $this.Values[$index-1]}}
 $failure=$null;try{Apply-FurnitureAction $n.presentation $a 1}catch{$failure=$_.Exception.Message};if(-not $failure -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed -or $script:nameSetterCalls -ne 0){throw ('Closed reference refusal failed: '+$mode)}
 $count=$script:events.Count;try{Apply-FurnitureAction $n.presentation $a 2}catch{};if($script:events.Count -ne $count -or $script:nameSetterCalls -ne 0){throw ('Reference refusal allowed later COM: '+$mode)}
 $serialized=$report|ConvertTo-Json -Depth 24;$cases.Add([ordered]@{name=('reference-domain-refuse-'+$mode);setters=0;serializedFailure=($serialized|ConvertFrom-Json);passed=$true})
}
[ordered]@{passed=$true;officeConstructed=$false;valuesWritten=$false;chartDataRead=$false;cases=@($cases.ToArray())}|ConvertTo-Json -Depth 24|Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Output ('Native literal series-name edit: '+$cases.Count+'plan/runtime/owned-copy controls, no Office')
