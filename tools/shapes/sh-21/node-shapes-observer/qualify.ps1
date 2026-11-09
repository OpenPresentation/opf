param([Parameter(Mandatory=$true)][string]$ScriptPath,[Parameter(Mandatory=$true)][string]$BaselinePath,[Parameter(Mandatory=$true)][string]$NativeHelpersPath,[Parameter(Mandatory=$true)][string]$Manifest,[Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $ReportPath) { throw 'Preserve prior source/mock reports' }
$cases=New-Object 'System.Collections.Generic.List[object]';$protected=New-Object 'System.Collections.Generic.List[string]';$passed=$false
function Parse-Source([string]$Path) { $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors);if($errors.Count) { throw ($errors|Out-String) };return ,$ast }
function Find-Function($Ast,[string]$Name) { $all=@($Ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $Name},$true));if($all.Count -ne 1) { throw ('Expected one function '+$Name) };return ,$all[0] }
function Check([string]$Name,[scriptblock]$Body) { try { &$Body;$cases.Add([ordered]@{name=$Name;passed=$true}) } catch { $cases.Add([ordered]@{name=$Name;passed=$false;failure=$_.Exception.Message});throw } }
function Require([bool]$Value,[string]$Message) { if(-not $Value) { throw $Message } }
try {
    Require (((Get-FileHash -LiteralPath $BaselinePath -Algorithm SHA256).Hash.ToLowerInvariant()) -ceq '9a9211b055bc46e3989621a6b2a8d8dd13e8cb0f1df140353fac8f58d294f564') 'Wrong actual executed baseline'
    Require (((Get-FileHash -LiteralPath $NativeHelpersPath -Algorithm SHA256).Hash.ToLowerInvariant()) -ceq 'fbe78773d0baf70bbb17fba75f08dd483ec596f9ae638b5c5be3885591b6057c') 'Wrong exact native helpers'
    $ast=Parse-Source $ScriptPath;$baseline=Parse-Source $BaselinePath;$helpers=Parse-Source $NativeHelpersPath
    Check 'protected-existing-functions-and-parameter-block' {
        Require ($ast.ParamBlock.Extent.Text -ceq $baseline.ParamBlock.Extent.Text) 'Worker parameters changed'
        foreach($definition in $baseline.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst]},$true)) {
            $current=Find-Function $ast $definition.Name
            if($definition.Name -cne 'Read-OpfSH21SmartArt') { Require ($current.Extent.Text -ceq $definition.Extent.Text) ('Protected function changed: '+$definition.Name);$protected.Add($definition.Name) }
            else { $anchor='$nodes=@();$wantedParents';Require ($current.Extent.Text.Substring($current.Extent.Text.IndexOf($anchor)) -ceq $definition.Extent.Text.Substring($definition.Extent.Text.IndexOf($anchor))) 'Original semantic/shape measurement tail changed' }
        }
        $raw=[IO.File]::ReadAllText($ScriptPath);$old=[IO.File]::ReadAllText($BaselinePath)
        Require (([regex]::Matches($raw,'New-Object -ComObject PowerPoint.Application')).Count -eq ([regex]::Matches($old,'New-Object -ComObject PowerPoint.Application')).Count) 'New Office construction path'
        foreach($name in @('Assert-OpfSH21ObserverDefinition','Stop-OpfSH21Observer','Invoke-OpfSH21ObserverRead','Read-OpfSH21NodeShapeObservation')) {
            $source=(Find-Function $ast $name).Extent.Text
            Require (-not ($source -match 'Start-Sleep|Wait-Process|\.Select\b|\.Activate\b|Stop-Process|taskkill|New-Object\s+-ComObject')) ('Forbidden observer operation: '+$name)
        }
        Require ($raw.Contains('if($rawDataCount -ne $Expected.count -or $rawGroupCount -lt 1)')) 'The original first-count guard is absent'
    }
    foreach($name in @('New-OpfNativeLatch','Invoke-OpfNativeStage')) { Invoke-Expression (Find-Function $helpers $name).Extent.Text }
    foreach($name in @('Assert-OpfSH21ObserverDefinition','Stop-OpfSH21Observer','Invoke-OpfSH21ObserverRead','Read-OpfSH21NodeShapeObservation','Read-OpfSH21Shape','Read-OpfSH21SmartArt')) { Invoke-Expression (Find-Function $ast $name).Extent.Text }
    $definition=Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8|ConvertFrom-Json
    Check 'closed-valid-two-case-manifest' { Assert-OpfSH21ObserverDefinition $definition }
    foreach($mode in @('missing','duplicate','order','foreign','kind','count','font','label','liveHash','nativeHash','escape','acceptance','diagnostic')) {
        $copy=$definition|ConvertTo-Json -Depth 20|ConvertFrom-Json
        switch($mode) {
            'missing' {$copy.cases=@($copy.cases[0])}
            'duplicate' {$copy.cases[1]=$copy.cases[0]}
            'order' {$copy.cases=@($copy.cases[1],$copy.cases[0])}
            'foreign' {$copy.cases[0].id='venn-3'}
            'kind' {$copy.cases[0].kind='hierarchy'}
            'count' {$copy.cases[0].count=2}
            'font' {$copy.cases[0].fontSize=35}
            'label' {$copy.cases[1].items[1]='Changed'}
            'liveHash' {$copy.cases[1].live.sha256=('0'*64)}
            'nativeHash' {$copy.cases[1].native.sha256=$copy.cases[1].live.sha256}
            'escape' {$copy.cases[0].live.file='../venn-1.pptx'}
            'acceptance' {$copy.nativeAcceptance=$true}
            'diagnostic' {$copy.diagnosticOnly=$false}
        }
        Check ('refuse-manifest-'+$mode) { $rejected=$false;try {Assert-OpfSH21ObserverDefinition $copy} catch {$rejected=$true};Require $rejected ('Accepted '+$mode) }
    }
    function Collection($Values,$Count,[string]$Name) {
        $value=[pscustomobject]@{MockValues=@($Values);MockCount=$Count;MockName=$Name;MockItemThrow=0}
        $value|Add-Member ScriptProperty Count { $script:mockEvents.Add($this.MockName+'.Count');return ,$this.MockCount }
        $value|Add-Member ScriptMethod Item {param([int]$Index) $script:mockEvents.Add($this.MockName+'.Item-'+$Index);if($this.MockItemThrow -eq $Index) {throw 'Deliberate indexed collection failure'};return ,$this.MockValues[$Index-1]}
        return ,$value
    }
    function Fixture([int]$Count,[int]$FirstGroups,[int]$PostGroups,[int[]]$ShapeCounts=@()) {
        $script:observerStopped=$false;$script:observerQueries=New-Object 'System.Collections.Generic.List[object]';$script:observerProbes=New-Object 'System.Collections.Generic.List[object]';$script:mockEvents=New-Object 'System.Collections.Generic.List[string]';$script:latch=New-OpfNativeLatch
        $nodes=@();$shapes=@();$ranges=@()
        for($i=1;$i -le $Count;$i++) {
            $text=[pscustomobject]@{Text=('N'+$i);Font=[pscustomobject]@{Size=36;Name='Source Sans 3';NameFarEast='Source Sans 3';NameComplexScript='Source Sans 3'};ParagraphFormat=[pscustomobject]@{Alignment=2;SpaceWithin=1;LineRuleWithin=0;SpaceBefore=0;SpaceAfter=0}}
            $text|Add-Member ScriptMethod Lines {param([int]$Index=0,[int]$Length=0) if($Index -eq 0) {return [pscustomobject]@{Count=1}};return [pscustomobject]@{Text=$this.Text;BoundLeft=100;BoundTop=100;BoundWidth=50;BoundHeight=40}}
            $frame=[pscustomobject]@{HasText=-1;TextRange=$text}
            $shape=[pscustomobject]@{Id=$i;Name=('Native '+$i);Type=1;AutoShapeType=9;Left=($i*100.25);Top=100.5;Width=200.75;Height=200.25;Rotation=0.0;HasTextFrame=-1;TextFrame2=$frame;Fill=[pscustomobject]@{Type=1;Transparency=0.5}}
            $shapes+=@($shape)
            $rangeCount=if($ShapeCounts.Count -ge $i){$ShapeCounts[$i-1]}else{1}
            $range=Collection @((1..([Math]::Max(1,$rangeCount)))|ForEach-Object {$shape}) $rangeCount ('node'+$i+'.Shapes');$ranges+=@($range)
            $nodes+=@([pscustomobject]@{TextFrame2=$frame;Shapes=$range;Level=1;Type=1;Nodes=[pscustomobject]@{Count=0}})
        }
        $groups=Collection $shapes $FirstGroups 'GroupItems'
        $groups|Add-Member NoteProperty Sequence @($FirstGroups,$PostGroups)
        $groups|Add-Member NoteProperty ReadIndex 0
        $groups|Add-Member ScriptProperty Count { $script:mockEvents.Add('GroupItems.Count');$this.ReadIndex++;return ,$this.Sequence[[Math]::Min($this.ReadIndex-1,1)] } -Force
        $allNodes=Collection $nodes $Count 'AllNodes'
        $smartArt=[pscustomobject]@{Layout=[pscustomobject]@{Id='urn:microsoft.com/office/officeart/2005/8/layout/venn1';Name='Basic Venn'};AllNodes=$allNodes}
        $parent=[pscustomobject]@{SmartArt=$smartArt;GroupItems=$groups;Left=0.0;Top=0.0;Width=1000.0;Height=600.0}
        $expected=[pscustomobject]@{id=('venn-'+$Count);kind='venn';count=$Count;layoutId=$smartArt.Layout.Id;items=@((1..$Count)|ForEach-Object {'N'+$_})}
        return [pscustomobject]@{Shape=$parent;Expected=$expected;Nodes=$nodes;Ranges=$ranges;Shapes=$shapes;Groups=$groups;AllNodes=$allNodes}
    }
    function Run-Fixture($Fixture) { return Invoke-OpfNativeStage $script:latch 'mock-export-already-completed-read' { Read-OpfSH21SmartArt $Fixture.Shape $Fixture.Expected } }
    function Assert-Latched([string]$Name) {
        Require ($script:observerStopped -or $script:latch.failed) ($Name+': no failure latch')
        $events=$script:mockEvents.Count;$queries=$script:observerQueries.Count;$script:laterCalled=$false
        try { $null=Invoke-OpfSH21ObserverRead 'forbidden-after-failure' {$script:laterCalled=$true;return 1} 'count' } catch {}
        try { $null=Invoke-OpfNativeStage $script:latch 'forbidden-stage' {$script:laterCalled=$true} } catch {}
        Require (-not $script:laterCalled -and $events -eq $script:mockEvents.Count -and $queries -eq $script:observerQueries.Count) ($Name+': later operation executed')
    }
    foreach($count in @(1,2)) {
        Check ('positive-full-original-reader-'+$count) {
            $f=Fixture $count $count $count;$result=Run-Fixture $f
            Require ($result.nodes -eq $count -and $result.items.Count -eq $count) 'Original measurements were dropped'
            Require ($script:observerProbes.Count -eq 1) 'Missing probe'
            $p=$script:observerProbes[0]
            Require ($p.originalGuardWouldPass -and $p.firstGroupCount -eq $count -and $p.postProbeGroupCount -eq $count -and $p.nodes.Count -eq $count) 'Actual initial/post observations differ'
            Require ($p.nodes[0].shapes[0].Left -eq 100.25 -and $p.nodes[0].shapes[0].text -ceq 'N1') 'Observed geometry/text replaced'
            $names=@($script:observerQueries|ForEach-Object {$_.name})
            Require ($names[0] -ceq 'observer.firstDataCount' -and $names[1] -ceq 'observer.firstGroupCount' -and $names[-1] -ceq 'observer.groups.postProbeCount') 'Query order changed'
            Require (@($names|Where-Object {$_ -ceq 'observer.groups.postProbeCount'}).Count -eq 1) 'Post observation repeated'
            Require ($names.IndexOf('observer.node-1.shapes.count') -gt 1) 'Node range read preceded first group count'
            Require (-not $script:latch.failed -and -not $script:observerStopped) 'Positive fixture latched'
        }
    }
    foreach($after in @(0,2)) {
        Check ('first-zero-remains-failure-after-'+$after) {
            $f=Fixture 2 0 $after;$rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true}
            Require $rejected 'First zero became a pass'
            $p=$script:observerProbes[0];Require ($p.firstGroupCount -eq 0 -and $p.postProbeGroupCount -eq $after -and -not $p.originalGuardWouldPass -and $p.status -ceq 'collected') 'First failure observation lost'
            Require ($script:latch.reason -match 'observed 2 data nodes and 0 group items') 'Original first-count failure changed'
            Assert-Latched 'first-zero'
        }
    }
    Check 'zero-node-ranges-are-observed-not-invented' {
        $f=Fixture 2 0 0 @(0,0);$rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true}
        Require ($rejected -and $script:observerProbes[0].totalNodeShapes -eq 0 -and @($script:mockEvents|Where-Object {$_ -like '*.Shapes.Item-*'}).Count -eq 0) 'Empty ranges produced inferred shapes'
        Assert-Latched 'empty-node-ranges'
    }
    Check 'changed-positive-post-count-refused' { $f=Fixture 2 2 0;$rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true};Require $rejected 'Changed count accepted';Assert-Latched 'changed-post';Require ($script:observerProbes[0].postProbeGroupCount -eq 0) 'Changed post count missing' }
    foreach($mode in @('null','string','fraction','negative','over-cap')) {
        Check ('refuse-first-data-'+$mode) {
            $f=Fixture 2 2 2;$f.AllNodes.MockCount=switch($mode){'null'{$null};'string'{'2'};'fraction'{2.5};'negative'{-2};'over-cap'{3}}
            $rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true}
            Require ($rejected -and $script:observerQueries.Count -eq 1 -and $f.Groups.ReadIndex -eq 0) 'Invalid data count did not stop immediately';Assert-Latched $mode
        }
        Check ('refuse-node-range-count-'+$mode) {
            $f=Fixture 2 2 2;$f.Ranges[0].MockCount=switch($mode){'null'{$null};'string'{'1'};'fraction'{1.5};'negative'{-2};'over-cap'{31}}
            $rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true}
            Require ($rejected -and $f.Groups.ReadIndex -eq 1 -and $script:observerQueries[-1].name -ceq 'observer.node-1.shapes.count' -and $script:observerQueries[-1].status -ceq 'failed') 'Invalid range count did not stop before post observation';Assert-Latched $mode
        }
    }
    foreach($location in @('first','post')) { foreach($badKind in @('null','string','fraction','negative','over-cap')) {
        Check ('refuse-'+$location+'-group-count-'+$badKind) {
            $f=Fixture 2 2 2;$index=if($location -ceq 'first'){0}else{1}
            $f.Groups.Sequence[$index]=switch($badKind){'null'{$null};'string'{'2'};'fraction'{2.5};'negative'{-2};'over-cap'{31}}
            $rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true}
            $wanted=if($location -ceq 'first'){'observer.firstGroupCount'}else{'observer.groups.postProbeCount'}
            Require ($rejected -and $script:observerQueries[-1].name -ceq $wanted -and $script:observerQueries[-1].status -ceq 'failed') 'Invalid group count did not stop immediately'
            if($location -ceq 'first') { Require ($script:observerProbes.Count -eq 0 -and $f.Groups.ReadIndex -eq 1) 'Node probe ran after invalid first group count' }
            Assert-Latched ($location+'-'+$badKind)
        }
    } }
    Check 'total-node-shape-cap-stops-before-second-range-items' {
        $f=Fixture 2 2 2 @(16,15);$rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true}
        Require ($rejected -and $f.Groups.ReadIndex -eq 1 -and $script:observerQueries[-1].name -ceq 'observer.node-2.totalShapeCap') 'Total cap not enforced'
        Require (@($script:mockEvents|Where-Object {$_ -like 'node2.Shapes.Item-*'}).Count -eq 0) 'Second range read after total cap';Assert-Latched 'total-cap'
    }
    Check 'indexed-native-range-exception-latches' {
        $f=Fixture 2 2 2;$f.Ranges[0].MockItemThrow=1;$rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true}
        Require ($rejected -and $f.Groups.ReadIndex -eq 1 -and $script:observerQueries[-1].status -ceq 'failed') 'Indexed exception not retained';Assert-Latched 'range-item-throw'
    }
    foreach($mode in @('null','string','nan','infinity')) {
        Check ('refuse-invalid-actual-geometry-'+$mode) {
            $f=Fixture 2 2 2;$f.Shapes[0].Width=switch($mode){'null'{$null};'string'{'200'};'nan'{[double]::NaN};'infinity'{[double]::PositiveInfinity}}
            $rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true}
            Require ($rejected -and $f.Groups.ReadIndex -eq 1 -and $script:observerQueries[-1].name -ceq 'observer.node-1.shape-1.Width') 'Invalid geometry did not stop immediately';Assert-Latched $mode
        }
    }
    Check 'null-node-range-object-refused' { $f=Fixture 2 2 2;$f.Nodes[0].Shapes=$null;$rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true};Require ($rejected -and $f.Groups.ReadIndex -eq 1 -and $script:observerQueries[-1].name -ceq 'observer.node-1.shapes.get') 'Null range accepted';Assert-Latched 'null-range' }
    Check 'null-native-text-refused-before-range-read' { $f=Fixture 2 2 2;$f.Nodes[0].TextFrame2.TextRange.Text=$null;$rejected=$false;try {$null=Run-Fixture $f} catch {$rejected=$true};Require ($rejected -and $script:observerQueries[-1].name -ceq 'observer.node-1.text.get' -and $f.Groups.ReadIndex -eq 1) 'Invalid text did not stop immediately';Assert-Latched 'null-text' }
    $passed=$true
} finally {
    [ordered]@{schema=1;passed=$passed;officeConstructed=$false;nativeAcceptance=$false;workerSha256=(Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant();protectedFunctions=@($protected.ToArray());cases=@($cases.ToArray());lastQueries=@($script:observerQueries.ToArray());lastProbes=@($script:observerProbes.ToArray());scope='Parsed source functions and plain objects only; worker entrypoint and Office are never executed.'}|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $ReportPath -Encoding UTF8
}
Write-Output ('SH21 observer source/mocks passed: '+$cases.Count+' controls; Office constructed false')
