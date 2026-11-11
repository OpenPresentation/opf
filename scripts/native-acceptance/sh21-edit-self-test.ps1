param([Parameter(Mandatory=$true)][string]$ControllerRoot,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 Desktop required for managed SH21 controls'}
# Managed test doubles only: no Office factories/process queries/launcher.
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-bootstrap.ps1')
Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/seven-chart-worker.ps1') @('Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation')
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-actions.ps1')
. (Join-Path $ControllerRoot 'scripts/native-acceptance/owned-postflight.ps1')
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-postflight.ps1')
function New-FakeNode([string]$Text,[int]$Level,$Parent){
    $range=[pscustomobject]@{Text=$Text};$node=[pscustomobject]@{TextFrame2=[pscustomobject]@{TextRange=$range};Level=$Level;ParentNode=$Parent;Type=1;Nodes=[pscustomobject]@{Count=0}}
    $node|Add-Member ScriptMethod AddNode {param($position,$type)if($position -ne 2 -or $type -ne 1){throw 'Wrong actual AddNode arguments'};$script:addCalls++;if($script:failure -eq 'add-fault'){throw 'Injected AddNode fault'};return $script:newNode}
    return $node
}
function New-Plan {
    return @((Get-Content -LiteralPath (Join-Path $OutputDirectory 'plans.json') -Raw -Encoding UTF8|ConvertFrom-Json))[0]
}
$results=@()
foreach($scenario in @('valid','foreign-path','writable','changed-app','changed-presentation','fullName-fault','readOnly-fault','range-getter-changes-path','range-getter-changes-owner','range-getter-makes-writable','add-fault','second-plan')){
    $script:root=Join-Path $OutputDirectory $scenario;[void](New-Item -ItemType Directory -Path $script:root);$script:sequence=0;$script:stopped=$false;$script:cleanup=$false;$script:failure=$scenario;$script:addCalls=0
    $script:report=[ordered]@{actions=@();probes=@();officeOperationsStopped=$false;cleanupConfirmed=$false;lastStage=$null;lastStatus=$null};$script:app=[pscustomobject]@{};$script:ownedApp=$script:app;$script:ownedPath=Join-Path $script:root 'source.pptx';$script:presentation=[pscustomobject]@{FullName=$script:ownedPath;ReadOnly=-1};$script:ownedPresentation=$script:presentation
    $lead=New-FakeNode 'Lead' 1 $null;$node2=New-FakeNode 'Build' 2 $lead;$node3=New-FakeNode 'Ship' 2 $lead;$script:newNode=New-FakeNode '' 2 $lead
    $collection=[pscustomobject]@{values=@($lead,$node2,$node3)};$collection|Add-Member ScriptMethod Item {param($i)return $this.values[$i-1]}
    $target=[pscustomobject]@{app=$script:app;presentation=$script:presentation;path=$script:ownedPath;smartArt=[pscustomobject]@{AllNodes=$collection}}
    switch($scenario){
        'foreign-path'{$script:presentation.FullName=Join-Path $script:root 'foreign.pptx'}
        'writable'{$script:presentation.ReadOnly=0}
        'changed-app'{$script:app=[pscustomobject]@{}}
        'changed-presentation'{$script:presentation=[pscustomobject]@{FullName=$script:ownedPath;ReadOnly=-1}}
        'fullName-fault'{$script:presentation.PSObject.Properties.Remove('FullName');$script:presentation|Add-Member ScriptProperty FullName {throw 'Injected FullName fault'}}
        'readOnly-fault'{$script:presentation.PSObject.Properties.Remove('ReadOnly');$script:presentation|Add-Member ScriptProperty ReadOnly {throw 'Injected ReadOnly fault'}}
        {$_ -in @('range-getter-changes-path','range-getter-changes-owner','range-getter-makes-writable')}{$node2.TextFrame2=[pscustomobject]@{Stored=$node2.TextFrame2.TextRange};$node2.TextFrame2|Add-Member ScriptProperty TextRange {switch($script:failure){'range-getter-changes-path'{$script:presentation.FullName+='foreign'};'range-getter-changes-owner'{$script:ownedApp=[pscustomobject]@{}};'range-getter-makes-writable'{$script:presentation.ReadOnly=0}};return $this.Stored}}
        'second-plan'{$script:report.actions=@([ordered]@{status='success'})}
    }
    $plan=New-Plan;$caught=$null
    try{Invoke-Sh21Edit $target $plan}catch{$caught=$_.Exception.Message}
    if($scenario -eq 'valid'){if($null -ne $caught -or $script:addCalls -ne 1 -or $node2.TextFrame2.TextRange.Text -cne 'Craft' -or $script:newNode.TextFrame2.TextRange.Text -cne 'Grow'){throw 'Actual managed positive edit differs'}}else{
        if($null -eq $caught -or -not $script:stopped){throw 'Managed negative did not latch'}
        $before=$script:sequence;try{Invoke-SevenCom 'forbidden.later' {throw 'must never run'}}catch{};if($script:sequence -ne $before){throw 'Postfault operation ran'}
        if($scenario -notin @('add-fault') -and $script:addCalls -ne 0){throw 'Ownership refusal reached AddNode'}
        if($scenario.StartsWith('range-getter') -and $script:report.actions[0].textSetterAttempts -ne 0){throw 'Mutation getter reached existing text setter'}
    }
    $results+=@([ordered]@{scenario=$scenario;passed=$true;addCalls=$script:addCalls;failure=$caught})
}
$script:root=Join-Path $OutputDirectory 'preflight';[void](New-Item -ItemType Directory -Path $script:root)
function global:Get-Process {
    [CmdletBinding()]param([string]$Name)
    $script:queries++
    if($script:processMode -eq 'busy'){return [pscustomobject]@{Id=42}}
    if($script:processMode -eq 'empty'){return}
    $id=if($script:processMode -eq 'no-process'){'NoProcessFoundForGivenName'}elseif($script:processMode -eq 'lookalike'){'NoProcessFoundForGivenNameForeign'}else{'AccessDenied'}
    $record=[Management.Automation.ErrorRecord]::new([InvalidOperationException]::new('Injected process enumeration result'),$id,[Management.Automation.ErrorCategory]::ObjectNotFound,$null)
    $PSCmdlet.ThrowTerminatingError($record)
}
try{
    foreach($mode in @('empty','no-process','busy','lookalike','fault')){
        $script:processMode=$mode;$script:queries=0;$script:stopped=$false;$script:cleanup=$true;$script:sequence=0;$script:report=[ordered]@{probes=@();officeOperationsStopped=$false;cleanupConfirmed=$true;lastStage=$null;lastStatus=$null};$caught=$null
        try{Assert-Sh21OfficeIdle}catch{$caught=$_.Exception.Message}
        if($script:queries -ne 1 -or (($null -eq $caught) -ne ($mode -in @('empty','no-process')))){throw 'Exact real preflight delegate differs'}
        $results+=@([ordered]@{scenario='preflight-'+$mode;passed=$true;queries=$script:queries})
    }
    $syntheticFile=Join-Path $OutputDirectory 'synthetic.json';$admission=Join-Path $OutputDirectory 'postflight-admission.json';'{}'|Set-Content -LiteralPath $admission -Encoding UTF8
    foreach($mode in @('valid','deadline','nonzero-exit','fault','pending','missing-quit','extra-add','crossed-create','missing-proof','default-no-process','default-lookalike','default-fault','busy51')){
        $e=Get-Content -LiteralPath $syntheticFile -Raw -Encoding UTF8|ConvertFrom-Json;$script:io=0;$script:queries=0;$script:processMode='no-process';$script:clockValue=0
        switch($mode){'deadline'{$e.terminal.timedOut=$true};'nonzero-exit'{$e.terminal.exitCode=1};'fault'{$e.report.error='fault'};'pending'{$e.report.lastStage='copy.saveCopyAs'};'missing-quit'{$e.report.quits=0};'extra-add'{$e.report.actions[0].addNodeAttempts=2};'crossed-create'{$create=@($e.stages|Where-Object{$_.stage -ceq 'application.create'});$other=@($e.stages|Where-Object{$_.stage -cne 'application.create'});$e.stages=@($other[0])+$create+@($other[1..($other.Count-1)]);for($i=0;$i -lt $e.stages.Count;$i++){$e.stages[$i].sequence=$i+1}};'missing-proof'{$e.report.probes=@()};'default-lookalike'{$script:processMode='lookalike'};'default-fault'{$script:processMode='fault'}}
        $args=@{Evidence=$e;ControllerRoot=$ControllerRoot;AdmissionFile=$admission;ExpectedAdmissionSha256=('a'*64);Clock={return $script:clockValue};Utc={return '2026-11-11T00:00:00Z'};Delay={param($ms)$script:io++;$script:clockValue+=$ms};Append={param($row)$script:io++}}
        if(-not $mode.StartsWith('default-')){$args.ReadProcesses={if($script:processMode -eq 'busy'){return @(42)};$script:io++;return @()}}
        if($mode -eq 'busy51'){$script:processMode='busy'}
        $caught=$null;$result=$null;try{$result=Invoke-Sh21BoundPostflight @args}catch{$caught=$_.Exception.Message}
        $negative=$mode -in @('deadline','nonzero-exit','fault','pending','missing-quit','extra-add','crossed-create','missing-proof')
        if($negative){if($null -eq $caught -or $script:io -ne 0 -or $script:queries -ne 0){throw 'Typed refusal performed observer IO'}}elseif($null -ne $caught){throw $caught}elseif($mode -in @('default-lookalike','default-fault')){if($null -eq $result.error -or $script:queries -ne 1){throw 'Default enumeration failure did not stop at one query'}}elseif($mode -eq 'busy51'){if($null -eq $result.error){throw 'Busy bounded observer incorrectly passed'}}else{if($null -ne $result.error -or -not $result.result.observedZero){throw 'Managed immediate zero failed'}}
        $results+=@([ordered]@{scenario='postflight-'+$mode;passed=$true;observerIO=$script:io;queries=$script:queries})
    }
}finally{Remove-Item Function:\global:Get-Process}
[ordered]@{schemaVersion=1;powerShellEdition=$PSVersionTable.PSEdition;powerShellVersion=$PSVersionTable.PSVersion.ToString();realProcessQueries=0;OfficeActions=0;scenarios=$results}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $OutputDirectory 'managed-controls.json') -Encoding UTF8
