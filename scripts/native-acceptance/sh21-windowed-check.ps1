param([Parameter(Mandatory=$true)][string]$ControllerRoot,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 required'}
# Definitions and managed doubles only. No launcher/worker entry, factory or OS query.
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-bootstrap.ps1')
Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/seven-chart-worker.ps1') @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation','Read-SevenPresentations')
Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-actions.ps1') @('Assert-Sh21Plan','Assert-Sh21Owner','Get-Sh21ExpectedNodes','Read-Sh21Node','Set-Sh21NodeMap','Read-Sh21Nodes')
Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-windowed-actions.ps1') @('Read-Sh21WindowedProperty','Set-Sh21OwnedWindowed','Open-Sh21WindowedOwned','Read-Sh21WindowedPhase')
. (Join-Path $ControllerRoot 'scripts/native-acceptance/owned-postflight.ps1')
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-postflight.ps1')
$results=@();$fixtures=Get-Content -LiteralPath (Join-Path $OutputDirectory 'fixtures.json') -Raw -Encoding UTF8|ConvertFrom-Json
for($i=0;$i -lt 4;$i++){
    $e=$fixtures[$i];$script:io=0;$admission=Join-Path $OutputDirectory ("positive-$i.json");'{}'|Set-Content -LiteralPath $admission -Encoding UTF8;$e.admission|Add-Member NoteProperty files @()
    $p=Invoke-Sh21WindowedBoundPostflight -Evidence $e -AdmissionFile $admission -ExpectedAdmissionSha256 ('a'*64) -ControllerRoot $ControllerRoot -ReadProcesses {$script:io++;return @()} -Clock {$script:io++;return 0} -Utc {return '2026-11-11T00:00:00Z'} -Delay {throw 'Immediate zero must not delay'} -Append {param($row)$script:io++}
    if($null -ne $p.error -or -not $p.result.observedZero -or $script:io -lt 1){throw 'Actual windowed typed bridge positive refused'}
    $results+=@([ordered]@{scenario="ready-positive-$i";passed=$true})
}
foreach($mode in @('normal-profile','wrong-window','wrong-mode','witness-action','timeout','failed-worker','missing-quit','crossed-visibility')){
    $e=Get-Content -LiteralPath (Join-Path $OutputDirectory 'fixtures.json') -Raw -Encoding UTF8|ConvertFrom-Json;$e=$e[0];$e.admission|Add-Member NoteProperty files @();$script:io=0
    switch($mode){
        'normal-profile'{$e.admission.profile='sh21-three-case-node-and-text-edit-v1'}
        'wrong-window'{$e.request.windowMode.withWindow=0}
        'wrong-mode'{$e.request.mode='any'}
        'witness-action'{$e.report.actions=@([pscustomobject]@{status='success'})}
        'timeout'{$e.terminal.timedOut=$true}
        'failed-worker'{$e.report.error='fault'}
        'missing-quit'{$e.report.quits=0}
        'crossed-visibility'{$row=@($e.stages|Where-Object{$_.stage -ceq 'application.visible.set'});$other=@($e.stages|Where-Object{$_.stage -cne 'application.visible.set'});$e.stages=@($other[0])+$row+@($other[1..($other.Count-1)]);for($j=0;$j -lt $e.stages.Count;$j++){$e.stages[$j].sequence=$j+1}}
    }
    $caught=$null;try{Invoke-Sh21WindowedBoundPostflight -Evidence $e -AdmissionFile (Join-Path $OutputDirectory 'negative.json') -ExpectedAdmissionSha256 ('a'*64) -ControllerRoot $ControllerRoot -ReadProcesses {$script:io++;return @()} -Clock {$script:io++;return 0} -Utc {$script:io++;return ''} -Delay {$script:io++} -Append {$script:io++}|Out-Null}catch{$caught=$_.Exception.Message}
    if($null -eq $caught -or $script:io -ne 0){throw 'Windowed refusal performed observer IO'}
    $results+=@([ordered]@{scenario=$mode;passed=$true})
}
foreach($mode in @('visible-positive','foreign-app','nonempty','visible-fault','windowState-fault','open-positive','writable','windows-fault','two-windows','closed-property')){
    $script:root=Join-Path $OutputDirectory $mode;[void](New-Item -ItemType Directory -Path $script:root);$script:sequence=0;$script:stopped=$false;$script:cleanup=$false;$script:opens=0
    $script:sourcePath=Join-Path $script:root 'source.pptx';[IO.File]::WriteAllBytes($script:sourcePath,[byte[]]@(83,72,50,49));$script:hashes=@{};$script:hashes[$script:sourcePath]=Get-SevenHash $script:sourcePath
    $script:report=[ordered]@{opens=@();probes=@();officeOperationsStopped=$false;cleanupConfirmed=$false;lastStage=$null;lastStatus=$null}
    $script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null
    $script:mode=$mode;$script:presentations=[pscustomobject]@{Count=0};if($mode -ceq 'nonempty'){$script:presentations.Count=1}
    $script:presentations|Add-Member ScriptMethod Open {param($file,$ro,$untitled,$window)if($file -cne $script:sourcePath -or $ro -ne -1 -or $untitled -ne 0 -or $window -ne -1){throw 'Exact read-only visible Open args changed'};$script:opens++;$p=[pscustomobject]@{FullName=$file;ReadOnly=-1;Windows=[pscustomobject]@{Count=1}};if($script:mode -ceq 'writable'){$p.ReadOnly=0};if($script:mode -ceq 'two-windows'){$p.Windows.Count=2};if($script:mode -ceq 'windows-fault'){$p.PSObject.Properties.Remove('Windows');$p|Add-Member ScriptProperty Windows {throw 'Window collection getter fault'}};return $p}
    $script:app=[pscustomobject]@{Presentations=$script:presentations;Visible=0;WindowState=1};$script:ownedApp=$script:app
    if($mode -ceq 'foreign-app'){$script:ownedApp=[pscustomobject]@{}}
    foreach($property in @('Visible','WindowState')){if(($mode -ceq 'visible-fault' -and $property -ceq 'Visible') -or ($mode -ceq 'windowState-fault' -and $property -ceq 'WindowState')){$script:app.PSObject.Properties.Remove($property);$script:app|Add-Member ScriptProperty $property {throw 'Owned app getter fault'} {param($value)}}}
    $caught=$null;try{if($mode -ceq 'closed-property'){Read-Sh21WindowedProperty $script:app 'HWND' 'forbidden'|Out-Null}elseif($mode -cin @('open-positive','writable','windows-fault','two-windows')){Open-Sh21WindowedOwned $script:sourcePath 'original'}else{Set-Sh21OwnedWindowed}}catch{$caught=$_.Exception.Message}
    $positive=$mode -cin @('visible-positive','open-positive');if(($null -eq $caught) -ne $positive){throw "Managed windowed primitive outcome differs: $mode : $caught"}
    if($positive){if($script:stopped){throw 'Positive latched unexpectedly'};if($mode -ceq 'visible-positive' -and ($script:app.Visible -ne -1 -or $script:app.WindowState -ne 2)){throw 'Visible/minimized setter values changed'};if($mode -ceq 'open-positive' -and ($script:opens -ne 1 -or $script:report.opens.Count -ne 1)){throw 'Actual RO Open not captured'}}else{if(-not $script:stopped){throw 'Managed getter/refusal must latch'};$before=$script:sequence;try{Invoke-SevenCom 'forbidden.after-fault' {throw 'Must not run'}}catch{};if($script:sequence -ne $before){throw 'Postfault COM ran'}}
    $results+=@([ordered]@{scenario=$mode;passed=$true;failure=$caught})
}
# Real indexed enumerable collection: old unrolling is detected, no Office/real Export.
Add-Type -TypeDefinition @'
public sealed class Sh21WindowedRange : System.Collections.IEnumerable {
 private readonly object[] rows; public int Enumerations; public int Calls;
 public Sh21WindowedRange(object[] rows){this.rows=rows;}
 public int Count {get{return rows.Length;}}
 public object Item(int i){Calls++;if(i<1||i>rows.Length)throw new System.IndexOutOfRangeException();return rows[i-1];}
 public System.Collections.IEnumerator GetEnumerator(){Enumerations++;return rows.GetEnumerator();}
}
'@
foreach($mode in @('materialized-group','no-materialization','group-fault','group33','materialized-font-fault','child-first-group')){
    $script:root=Join-Path $OutputDirectory $mode;[void](New-Item -ItemType Directory -Path $script:root);$script:sequence=0;$script:stopped=$false;$script:cleanup=$false;$script:exports=0
    $script:app=[pscustomobject]@{};$script:ownedApp=$script:app;$script:ownedPath=Join-Path $script:root 'source.pptx';$script:presentation=[pscustomobject]@{FullName=$script:ownedPath;ReadOnly=-1};$script:ownedPresentation=$script:presentation
    $script:report=[ordered]@{phases=[ordered]@{};probes=@();officeOperationsStopped=$false;cleanupConfirmed=$false;lastStage=$null;lastStatus=$null}
    $plan=$fixtures[0].request.plan;$nodes=@();$items=@()
    for($i=0;$i -lt 3;$i++){
        $node=[pscustomobject]@{TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Text=$plan.before[$i].text}};Level=$plan.before[$i].level;Type=1;Nodes=[pscustomobject]@{Count=$plan.before[$i].children}}
        if($i -eq 0){$node|Add-Member ScriptProperty ParentNode {throw 'Root ParentNode is forbidden'}}else{$node|Add-Member NoteProperty ParentNode $nodes[0]};$nodes+=@($node)
        $font=[pscustomobject]@{Size=36};if($mode -ceq 'materialized-font-fault' -and $i -eq 0){$font.PSObject.Properties.Remove('Size');$font|Add-Member ScriptProperty Size {throw 'Materialized Size fault'}}
        $item=[pscustomobject]@{Name='';Left=1;Top=2;Width=3;Height=4;Rotation=0;Type=1;HasTextFrame=-1;TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Text=$plan.before[$i].text;Font=$font}}};$items+=@($item)
    }
    for($i=0;$i -lt 2;$i++){$items+=@([pscustomobject]@{Name='';Left=1;Top=2;Width=3;Height=0;Rotation=0;Type=9;HasTextFrame=0})}
    if($mode -ceq 'no-materialization'){$items=@()};if($mode -ceq 'group33'){$items=@(1..33|ForEach-Object{$items[0]})}
    $group=[Sh21WindowedRange]::new([object[]]$items);$order=if($mode -ceq 'child-first-group'){@($nodes[1],$nodes[0],$nodes[2])}else{$nodes};$all=[Sh21WindowedRange]::new([object[]]$order)
    $shape=[pscustomobject]@{Left=1;Top=2;Width=30;Height=20;GroupItems=$group};if($mode -ceq 'group-fault'){$shape.PSObject.Properties.Remove('GroupItems');$shape|Add-Member ScriptProperty GroupItems {throw 'Materialized GroupItems fault'}}
    $slide=[pscustomobject]@{};$slide|Add-Member ScriptMethod Export {param($file,$format,$width,$height)if($format -cne 'PNG' -or $width -ne 1280 -or $height -ne 720){throw 'Inert Export arguments changed'};$script:exports++;[IO.File]::WriteAllBytes($file,[byte[]]@(83,72,50,49))}
    $target=[pscustomobject]@{app=$script:app;presentation=$script:presentation;path=$script:ownedPath;slide=$slide;shape=$shape;smartArt=[pscustomobject]@{AllNodes=$all}}
    $caught=$null;try{Read-Sh21WindowedPhase $target $plan 'original' $false}catch{$caught=$_.Exception.Message}
    $positive=$mode -cin @('materialized-group','child-first-group')
    if(($null -eq $caught) -ne $positive -or $script:exports -ne 1 -or $all.Enumerations -ne 0 -or $group.Enumerations -ne 0){throw "Actual materialized survey differs: $mode : $caught"}
    if($positive){if($group.Calls -ne 5 -or $script:report.phases.original.items.Count -ne 5 -or $script:report.phases.original.items[3].Type -ne 9 -or $script:report.phases.original.items[0].fontSize -ne 36){throw 'Complete materialized text/connector survey lost'};if($mode -ceq 'child-first-group' -and ($script:report.phases.original.semanticToNativeIndex -join ',') -cne '2,1,3'){throw 'Materialized survey rewrote semantic mapping'}}else{if(-not $script:stopped){throw 'Materialized fault/refusal must latch'};if($mode -cin @('no-materialization','group33') -and $group.Calls -ne 0){throw 'Materialized bound crossed before Item'};if($script:report.phases.original.nodes.Count -ne 3){throw 'Partial original semantic facts lost'}}
    $results+=@([ordered]@{scenario=$mode;passed=$true;failure=$caught})
}
if($results.Count -ne 28){throw 'Managed28 scenario roster changed'}
[ordered]@{schemaVersion=1;powerShellEdition=$PSVersionTable.PSEdition;powerShellVersion=$PSVersionTable.PSVersion.ToString();OfficeActions=0;realProcessQueries=0;scenarios=$results}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $OutputDirectory 'managed-controls.json') -Encoding UTF8
