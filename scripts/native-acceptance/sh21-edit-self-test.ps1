param([Parameter(Mandatory=$true)][string]$ControllerRoot,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 Desktop required for managed SH21 controls'}
# Managed test doubles only: no Office factories/process queries/launcher.
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-bootstrap.ps1')
Import-Sh21Definitions (Join-Path $ControllerRoot 'scripts/native-acceptance/seven-chart-worker.ps1') @('Get-SevenHash','Test-SevenInteger','Test-SevenFiniteNumber','Get-SevenPrimitive','Write-SevenReport','Write-SevenStage','Stop-SevenLifecycle','Assert-SevenProbe','Invoke-SevenCom','Read-SevenProperty','Assert-SevenOwnedPresentation')
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-actions.ps1')
. (Join-Path $ControllerRoot 'scripts/native-acceptance/owned-postflight.ps1')
. (Join-Path $ControllerRoot 'scripts/native-acceptance/sh21-edit-postflight.ps1')
function New-FakeNode([string]$Text,[int]$Level,$Parent){
    $range=[pscustomobject]@{Text=$Text};$node=[pscustomobject]@{TextFrame2=[pscustomobject]@{TextRange=$range};Level=$Level;ParentNode=$Parent;Type=1;Nodes=[pscustomobject]@{Count=0}}
    if($Level -eq 1){$node.PSObject.Properties.Remove('ParentNode');$node|Add-Member ScriptProperty ParentNode {throw 'Root ParentNode must never be read'}}
    $node|Add-Member ScriptMethod AddNode {param($position,$type)if($position -ne 2 -or $type -ne 1){throw 'Wrong actual AddNode arguments'};$script:addCalls++;$script:addTargetText=$this.TextFrame2.TextRange.Text;if($script:failure -eq 'add-fault'){throw 'Injected AddNode fault'};$script:collection.values=@($script:collection.values)+@($script:newNode);if($script:newNode.Level -gt 1){$script:rootNode.Nodes.Count++};return $script:newNode}
    return $node
}
function New-Sh21FakeTarget($Plan,[int[]]$Order,[string]$Mode) {
    $script:sequence=0;$script:stopped=$false;$script:cleanup=$false;$script:failure=$Mode;$script:addCalls=0;$script:addTargetText=$null
    $script:report=[ordered]@{actions=@();phases=[ordered]@{};probes=@();officeOperationsStopped=$false;cleanupConfirmed=$false;lastStage=$null;lastStatus=$null};$script:app=[pscustomobject]@{};$script:ownedApp=$script:app;$script:ownedPath=Join-Path $script:root 'source.pptx';$script:presentation=[pscustomobject]@{FullName=$script:ownedPath;ReadOnly=-1};$script:ownedPresentation=$script:presentation
    $values=@();$script:rootNode=$null
    foreach($row in $Plan.before){$parent=if($row.level -gt 1){$script:rootNode}else{$null};$node=New-FakeNode $row.text $row.level $parent;$node.Nodes.Count=$row.children;$values+=@($node);if($row.index -eq 1){$script:rootNode=$node}}
    $script:semanticNodes=$values;$row=$Plan.after[3];$parent=if($row.level -gt 1){$script:rootNode}else{$null};$script:newNode=New-FakeNode '' $row.level $parent
    $script:collection=[pscustomobject]@{values=@($Order|ForEach-Object{$values[$_]})};$script:collection|Add-Member ScriptProperty Count {return $this.values.Count};$script:collection|Add-Member ScriptMethod Item {param($i)return $this.values[$i-1]}
    $art=[pscustomobject]@{};$art|Add-Member ScriptProperty AllNodes {if($script:failure -ceq 'reorder-before-add' -and $script:semanticNodes[1].TextFrame2.TextRange.Text -ceq 'Craft'){$script:collection.values=@($script:semanticNodes[2],$script:semanticNodes[1],$script:semanticNodes[0])};return $script:collection}
    return [pscustomobject]@{app=$script:app;presentation=$script:presentation;path=$script:ownedPath;smartArt=$art}
}
function New-Plan {
    $plans=Get-Content -LiteralPath (Join-Path $OutputDirectory 'plans.json') -Raw -Encoding UTF8|ConvertFrom-Json;return $plans[0]
}
$results=@()
foreach($scenario in @('valid','foreign-path','writable','changed-app','changed-presentation','fullName-fault','readOnly-fault','range-getter-changes-path','range-getter-changes-owner','range-getter-makes-writable','add-fault','second-plan')){
    $script:root=Join-Path $OutputDirectory $scenario;[void](New-Item -ItemType Directory -Path $script:root);$plan=New-Plan;$target=New-Sh21FakeTarget $plan @(0,1,2) $scenario;$node2=$script:semanticNodes[1]
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
$plans=Get-Content -LiteralPath (Join-Path $OutputDirectory 'plans.json') -Raw -Encoding UTF8|ConvertFrom-Json
foreach($plan in $plans){foreach($orderName in @('natural','child-first')){
    $scenario='identity-'+$plan.caseId+'-'+$orderName;$script:root=Join-Path $OutputDirectory $scenario;[void](New-Item -ItemType Directory -Path $script:root)
    $order=if($orderName -ceq 'child-first'){@(1,0,2)}else{@(0,1,2)};$target=New-Sh21FakeTarget $plan $order 'valid'
    Invoke-Sh21Edit $target $plan
    if($script:addCalls -ne 1 -or $script:addTargetText -cne $plan.before[2].text -or $script:semanticNodes[1].TextFrame2.TextRange.Text -cne $plan.after[1].text -or $script:newNode.TextFrame2.TextRange.Text -cne $plan.after[3].text){throw 'Semantic edit hit the wrong actual node'}
    $action=$script:report.actions[0];if($action.targets[0].node.index -ne ([array]::IndexOf($order,1)+1) -or $action.targets[1].node.text -cne $plan.before[2].text){throw 'Actual native indices were not retained'}
    $script:collection.values=@($script:newNode,$script:semanticNodes[2],$script:semanticNodes[0],$script:semanticNodes[1]);$observation=[ordered]@{nodes=@();semanticToNativeIndex=@()};$script:report.phases['afterRead']=$observation
    [void](Read-Sh21Nodes $target $plan 'afterRead' 'after' $observation)
    if(($observation.semanticToNativeIndex -join ',') -cne '3,4,2,1' -or $observation.nodes[0].text -cne $plan.after[3].text){throw 'Final raw order or updated parent/child counts differ'}
    $results+=@([ordered]@{scenario=$scenario;passed=$true;addCalls=$script:addCalls})
}}
$plan=New-Plan
foreach($mode in @('reorder-before-add','duplicate-tuple','wrong-parent','wrong-level','wrong-type','wrong-children','target-reread-changed')){
    $scenario='identity-'+$mode;$script:root=Join-Path $OutputDirectory $scenario;[void](New-Item -ItemType Directory -Path $script:root);$target=New-Sh21FakeTarget $plan @(1,0,2) $mode
    switch($mode){
        'duplicate-tuple'{$script:collection.values=@($script:semanticNodes[1],$script:semanticNodes[1],$script:semanticNodes[2])}
        'wrong-parent'{$script:semanticNodes[1].ParentNode=$script:semanticNodes[2]}
        'wrong-level'{$script:semanticNodes[1].Level=1}
        'wrong-type'{$script:semanticNodes[1].Type=2}
        'wrong-children'{$script:rootNode.Nodes.Count=1}
        'target-reread-changed'{$script:collection|Add-Member NoteProperty Reads 0;$script:collection|Add-Member ScriptMethod Item {param($i)$this.Reads++;if($this.Reads -eq 4){$script:semanticNodes[1].TextFrame2.TextRange.Text='Foreign'};return $this.values[$i-1]} -Force}
    }
    $caught=$null;try{Invoke-Sh21Edit $target $plan}catch{$caught=$_.Exception.Message}
    if($mode -ceq 'reorder-before-add'){if($null -ne $caught -or $script:addTargetText -cne 'Ship' -or $script:report.actions[0].targets[1].node.index -ne 1){throw 'Fresh semantic mapping before AddNode differs'}}else{
        if($null -eq $caught -or -not $script:stopped -or $script:addCalls -ne 0 -or $script:report.actions[0].textSetterAttempts -ne 0){throw 'Identity refusal reached an edit'}
        if($mode -in @('duplicate-tuple','wrong-parent','wrong-children')){$durable=Get-Content -LiteralPath (Join-Path $script:root 'report.json') -Raw -Encoding UTF8|ConvertFrom-Json;if($durable.actions[0].observations.before.nodes.Count -ne 3 -or $null -eq $durable.actions[0].observations.before.semanticToNativeIndex){throw 'Refused semantic match lost actual raw rows/map'}}
        $sequence=$script:sequence;try{Invoke-SevenCom 'forbidden.later' {throw 'must not run'}}catch{};if($script:sequence -ne $sequence){throw 'Identity fault allowed later operation'}
    }
    $results+=@([ordered]@{scenario=$scenario;passed=$true;addCalls=$script:addCalls;failure=$caught})
}
# Unlike the original PSCustomObject fixture, these actual CLR collections are
# enumerable AND expose Office-style one-based Item, so pipeline unrolling is observable.
Add-Type -TypeDefinition @'
public sealed class Sh21EnumerableCollection : System.Collections.IEnumerable {
    private readonly object[] values;
    public int Enumerations { get; private set; }
    public int CountReads { get; private set; }
    public readonly System.Collections.Generic.List<int> ItemCalls = new System.Collections.Generic.List<int>();
    public Sh21EnumerableCollection(object[] values) { this.values = values; }
    public int Count { get { CountReads++; return values.Length; } }
    public object Item(int index) {
        ItemCalls.Add(index);
        if (index < 1 || index > values.Length) throw new System.IndexOutOfRangeException("Native one-based Item outside collection");
        return values[index - 1];
    }
    public System.Collections.IEnumerator GetEnumerator() { Enumerations++; return values.GetEnumerator(); }
}
public sealed class Sh21EnumerableSmartArt {
    public Sh21EnumerableCollection AllNodes { get; private set; }
    public Sh21EnumerableSmartArt(Sh21EnumerableCollection nodes) { AllNodes = nodes; }
}
'@
function New-Sh21EnumerableTarget($Plan) {
    $target=New-Sh21FakeTarget $Plan @(0,1,2) 'valid';$children=@()
    for($i=0;$i -lt $Plan.before.Count;$i++){
        $values=@();for($j=0;$j -lt $Plan.before.Count;$j++){if($Plan.before[$j].parent -is [string] -and $Plan.before[$j].parent -ceq $Plan.before[$i].text){$values+=@($script:semanticNodes[$j])}}
        $collection=[Sh21EnumerableCollection]::new([object[]]$values);$script:semanticNodes[$i].Nodes=$collection;$children+=,$collection
    }
    $all=[Sh21EnumerableCollection]::new([object[]]$script:semanticNodes);$target.smartArt=[Sh21EnumerableSmartArt]::new($all)
    return [pscustomobject]@{target=$target;all=$all;children=$children}
}
$scenario='enumerable-old-unrolled-root';$script:root=Join-Path $OutputDirectory $scenario;[void](New-Item -ItemType Directory -Path $script:root);$plan=New-Plan;$f=New-Sh21EnumerableTarget $plan;$target=$f.target
# Exercise the OLD operation block through the unchanged actual shared helper.
$old=Invoke-SevenCom 'enumerable.old.nodes' {$target.smartArt.AllNodes};$outside=$null
if([object]::ReferenceEquals($old,$f.all) -or $old -isnot [object[]]){throw 'Old operation did not replace the collection with an array'}
$oldCount=$old.Count;$oldItem1=$old.Item(1).TextFrame2.TextRange.Text;$oldItem2=$old.Item(2).TextFrame2.TextRange.Text;$enumerations=$f.all.Enumerations;$nativeItems=$f.all.ItemCalls.Count
try{$null=Invoke-SevenCom 'enumerable.old.item3' {$old.Item(3)}}catch{$outside=$_.Exception.Message}
if($oldCount -ne 3 -or $oldItem1 -cne 'Build' -or $oldItem2 -cne 'Ship' -or $null -eq $outside -or -not $script:stopped -or $enumerations -ne 1 -or $nativeItems -ne 0){throw 'Old enumerable collection counterexample was not reproduced'}
$results+=@([ordered]@{scenario=$scenario;passed=$true;count=$oldCount;item1=$oldItem1;item2=$oldItem2;item3Failure=$outside;enumerations=$enumerations;faultLatched=$script:stopped})
foreach($plan in $plans){
    $scenario='enumerable-native-'+$plan.caseId;$script:root=Join-Path $OutputDirectory $scenario;[void](New-Item -ItemType Directory -Path $script:root);$f=New-Sh21EnumerableTarget $plan;$observation=[ordered]@{nodes=@();semanticToNativeIndex=@()};$script:report.phases['enumerable']=$observation
    $actual=Read-Sh21Nodes $f.target $plan 'enumerable' 'before' $observation
    if(-not [object]::ReferenceEquals($actual,$f.all) -or $actual.Count -ne 3 -or ($f.all.ItemCalls -join ',') -cne '1,2,3' -or $f.all.Enumerations -ne 0 -or ($observation.semanticToNativeIndex -join ',') -cne '1,2,3'){throw 'Actual collection identity/count/one-based order was not preserved'}
    for($i=0;$i -lt 3;$i++){if($observation.nodes[$i].text -cne $plan.before[$i].text -or $observation.nodes[$i].children -ne $plan.before[$i].children -or $f.children[$i].CountReads -ne 1 -or $f.children[$i].Enumerations -ne 0){throw 'Actual child collection, including empty children, was flattened'}}
    $results+=@([ordered]@{scenario=$scenario;passed=$true;collectionIdentity=$true;count=$actual.Count;itemCalls=@($f.all.ItemCalls);enumerations=$f.all.Enumerations;childCounts=@($observation.nodes|ForEach-Object{$_.children})})
}
$scenario='enumerable-phase-group-items';$script:root=Join-Path $OutputDirectory $scenario;[void](New-Item -ItemType Directory -Path $script:root);$plan=New-Plan;$f=New-Sh21EnumerableTarget $plan;$target=$f.target;$groupValues=@()
for($i=0;$i -lt 3;$i++){$groupValues+=@([pscustomobject]@{Left=($i*10);Top=1;Width=8;Height=5;Rotation=0;Type=1;HasTextFrame=-1;TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Text=$plan.before[$i].text;Font=[pscustomobject]@{Size=36}}}})}
$group=[Sh21EnumerableCollection]::new([object[]]$groupValues);$shape=[pscustomobject]@{Left=0;Top=0;Width=100;Height=60;GroupItems=$group};$slide=[pscustomobject]@{};$script:inertExports=0
$slide|Add-Member ScriptMethod Export {param($file,$format,$width,$height)if($file -cne (Join-Path $script:root 'enumerable-phase.png') -or $format -cne 'PNG' -or $width -ne 1280 -or $height -ne 720){throw 'Inert owned export arguments differ'};$script:inertExports++;[IO.File]::WriteAllBytes($file,[byte[]]@(83,72,50,49))}
$target|Add-Member NoteProperty shape $shape;$target|Add-Member NoteProperty slide $slide
Read-Sh21Phase $target $plan 'enumerable-phase' $false
$phase=$script:report.phases['enumerable-phase'];$bytes=[IO.File]::ReadAllBytes((Join-Path $script:root 'enumerable-phase.png'))
if($script:inertExports -ne 1 -or ($bytes -join ',') -cne '83,72,50,49' -or $group.Enumerations -ne 0 -or $group.CountReads -ne 1 -or ($group.ItemCalls -join ',') -cne '1,2,3' -or $phase.items.Count -ne 3 -or ($phase.items.text -join '|') -cne ($plan.before.text -join '|')){throw 'Actual phase GroupItems collection capture differs'}
$results+=@([ordered]@{scenario=$scenario;passed=$true;itemCalls=@($group.ItemCalls);enumerations=$group.Enumerations;inertExports=$script:inertExports;nativeRaster=$false})
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
