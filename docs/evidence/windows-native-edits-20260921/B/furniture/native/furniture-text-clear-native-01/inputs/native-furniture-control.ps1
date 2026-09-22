param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][string]$InputPresentation,
    [string]$ActionPlan='',
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker
)
$ErrorActionPreference='Stop'

function Get-FurnitureSha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Test-Integer($Value) { return $Value -is [int] -or $Value -is [long] }
function Require-Property($Action,[string]$Name,[string]$Context) {
    if($null -eq $Action.PSObject.Properties[$Name]) { throw "$Context requires property '$Name'" }
    return $Action.$Name
}
function Assert-String($Value,[string]$Name,[string]$Context,[int]$Maximum=65535,[bool]$AllowEmpty=$true) {
    if(-not ($Value -is [string])) { throw "$Context property '$Name' must be a string" }
    if((-not $AllowEmpty -and $Value.Length -eq 0) -or $Value.Length -gt $Maximum) { throw "$Context property '$Name' has an invalid length" }
}
function Read-AndValidateActionPlan([string]$Path) {
    if($Path -eq '') { return ,@() }
    $resolved=(Resolve-Path -LiteralPath $Path).Path
    if([IO.Path]::GetExtension($resolved) -ine '.json') { throw 'ActionPlan must be one existing JSON file' }
    $raw=Get-Content -LiteralPath $resolved -Raw -Encoding UTF8
    if(-not $raw.TrimStart().StartsWith('[') -or -not $raw.TrimEnd().EndsWith(']')) { throw 'ActionPlan root must be a JSON list' }
    # Windows PowerShell 5.1 wraps an inline empty ConvertFrom-Json pipeline as
    # one nested Object[] inside @(...). Assign first, then normalize, so [] is
    # exactly zero actions while singleton and multi-action lists stay flat.
    $parsed=$raw | ConvertFrom-Json
    $items=@($parsed)
    if($items.Count -gt 20) { throw 'ActionPlan cannot contain more than 20 actions' }
    $operations=@('set-text','set-alt','delete-shape','duplicate-shape','set-tag','delete-tag','move-slide')
    for($index=0;$index -lt $items.Count;$index++) {
        $action=$items[$index]; $context="Action $($index+1)"
        if($null -eq $action -or $action -isnot [pscustomobject]) { throw "$context must be an object" }
        $op=Require-Property $action 'op' $context; Assert-String $op 'op' $context 40 $false
        if($operations -notcontains $op) { throw "$context has unknown operation '$op'" }
        $slideIndex=Require-Property $action 'slideIndex' $context
        if(-not (Test-Integer $slideIndex) -or $slideIndex -lt 1 -or $slideIndex -gt 3) { throw "$context slideIndex must be an integer from 1 through 3" }
        $allowed=@('op','slideIndex')
        if($op -ne 'move-slide') {
            if($op -notin @('set-tag','delete-tag') -or $action.target -ne 'slide') {
                $shapeName=Require-Property $action 'shapeName' $context; Assert-String $shapeName 'shapeName' $context 255 $false; $allowed+='shapeName'
            }
        }
        switch($op) {
            'set-text' { $text=Require-Property $action 'text' $context; Assert-String $text 'text' $context; $allowed+='text' }
            'set-alt' { $alt=Require-Property $action 'alt' $context; Assert-String $alt 'alt' $context; $allowed+='alt' }
            'duplicate-shape' { $newName=Require-Property $action 'newName' $context; Assert-String $newName 'newName' $context 255 $false; $allowed+='newName' }
            'set-tag' {
                $target=Require-Property $action 'target' $context; if($target -notin @('shape','slide')) { throw "$context target must be 'shape' or 'slide'" }
                $tagName=Require-Property $action 'tagName' $context; $tagValue=Require-Property $action 'tagValue' $context
                Assert-String $tagName 'tagName' $context 255 $false; Assert-String $tagValue 'tagValue' $context
                $allowed+=@('target','tagName','tagValue')
            }
            'delete-tag' {
                $target=Require-Property $action 'target' $context; if($target -notin @('shape','slide')) { throw "$context target must be 'shape' or 'slide'" }
                $tagName=Require-Property $action 'tagName' $context; Assert-String $tagName 'tagName' $context 255 $false
                $allowed+=@('target','tagName')
            }
            'move-slide' {
                $toIndex=Require-Property $action 'toIndex' $context
                if(-not (Test-Integer $toIndex) -or $toIndex -lt 1 -or $toIndex -gt 3) { throw "$context toIndex must be an integer from 1 through 3" }
                $allowed+='toIndex'
            }
        }
        foreach($property in $action.PSObject.Properties.Name) { if($allowed -cnotcontains $property) { throw "$context has unknown property '$property'" } }
    }
    return ,$items
}

if(-not $Worker) {
    $inputPath=(Resolve-Path -LiteralPath $InputPresentation).Path
    if([IO.Path]::GetExtension($inputPath) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
    $plan=Read-AndValidateActionPlan $ActionPlan
    $planPath=$(if($ActionPlan -eq ''){$null}else{(Resolve-Path -LiteralPath $ActionPlan).Path})
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'; [void](New-Item -ItemType Directory -Path $snapshotRoot)
    $verifierSnapshot=Join-Path $snapshotRoot 'native-furniture-control.ps1'
    $helperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path
    $helperSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $presentationSnapshot=Join-Path $snapshotRoot 'input.pptx'
    $planSnapshot=Join-Path $snapshotRoot 'action-plan.json'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $helperOriginal -Destination $helperSnapshot
    Copy-Item -LiteralPath $inputPath -Destination $presentationSnapshot
    if($null -ne $planPath) { Copy-Item -LiteralPath $planPath -Destination $planSnapshot }
    else { ConvertTo-Json -InputObject @() | Set-Content -LiteralPath $planSnapshot -Encoding UTF8 }
    $request=[ordered]@{
        source=[ordered]@{path=$inputPath;sha256=(Get-FurnitureSha256 $inputPath);snapshotPath=$presentationSnapshot;snapshotSha256=(Get-FurnitureSha256 $presentationSnapshot)}
        actionPlan=[ordered]@{path=$planPath;sha256=$(if($null -eq $planPath){$null}else{Get-FurnitureSha256 $planPath});snapshotPath=$planSnapshot;snapshotSha256=(Get-FurnitureSha256 $planSnapshot);count=$plan.Count}
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-FurnitureSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-FurnitureSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$helperOriginal;sha256=(Get-FurnitureSha256 $helperOriginal);snapshotPath=$helperSnapshot;snapshotSha256=(Get-FurnitureSha256 $helperSnapshot)}
    }
    $request | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-OutputDirectory',$outputRoot,'-InputPresentation',$presentationSnapshot,'-ActionPlan',$planSnapshot,'-Worker') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
    $lastDurable=$null
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')) { try { $lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json } catch { } }
    if($null -eq $lastDurable -and (Test-Path -LiteralPath (Join-Path $outputRoot 'stages.jsonl'))) {
        foreach($line in (Get-Content -LiteralPath (Join-Path $outputRoot 'stages.jsonl') -Encoding UTF8)) { try { $lastDurable=$line | ConvertFrom-Json } catch { } }
    }
    $terminal=[ordered]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');timedOut=$result.timedOut;exitCode=$result.exitCode;cleanupConfirmed=$(if($result.timedOut){$false}elseif($null -ne $lastDurable){[bool]$lastDurable.cleanupConfirmed}else{$false});lastDurableStage=$(if($null -ne $lastDurable){$lastDurable.stage}else{$null});lastDurableStatus=$(if($null -ne $lastDurable){$lastDurable.status}else{$null})}
    $terminal | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if($result.timedOut -and (Test-Path -LiteralPath (Join-Path $outputRoot 'report.json'))) {
        try {
            Copy-Item -LiteralPath (Join-Path $outputRoot 'report.json') -Destination (Join-Path $outputRoot 'report.worker.json')
            $timedOutReport=Get-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            $timedOutReport.cleanupConfirmed=$false; $timedOutReport.officeOperationsStopped=$true; $timedOutReport.lastStage=$terminal.lastDurableStage; $timedOutReport.lastStatus=$terminal.lastDurableStatus
            $timedOutReport.error='Owned native worker timed out; Office cleanup is unconfirmed and no retry was started.'
            $timedOutReport | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Encoding UTF8
        } catch { }
    }
    Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object { Write-Host $_ }
    if($result.timedOut -or $result.exitCode -ne 0) { throw 'Native furniture control failed or timed out; preserve the entire attempt and inspect Office. No retry was started.' }
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$request=Get-Content -LiteralPath (Join-Path $root 'request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourcePath=$request.source.path; $sourceHash=$request.source.sha256; $sourceSnapshot=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path
$planSnapshot=(Resolve-Path -LiteralPath $request.actionPlan.snapshotPath).Path; $actions=Read-AndValidateActionPlan $planSnapshot
$savedPath=Join-Path $root 'native-furniture-control.pptx'
$stageFile=Join-Path $root 'stages.jsonl'; $progressFile=Join-Path $root 'progress.json'; $reportFile=Join-Path $root 'report.json'
foreach($reserved in @($stageFile,$progressFile,$reportFile,$savedPath)) { if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' } }
if((Get-FurnitureSha256 $PSCommandPath) -cne $request.verifier.sha256 -or (Get-FurnitureSha256 $request.verifier.snapshotPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }
if((Get-FurnitureSha256 $request.processHelper.path) -cne $request.processHelper.sha256 -or (Get-FurnitureSha256 $request.processHelper.snapshotPath) -cne $request.processHelper.sha256) { throw 'Process-helper snapshot does not match the loaded helper' }
if((Get-FurnitureSha256 $sourceSnapshot) -cne $sourceHash) { throw 'Presentation snapshot hash does not match the requested source' }
if((Get-FurnitureSha256 $planSnapshot) -cne $request.actionPlan.snapshotSha256 -or $actions.Count -ne $request.actionPlan.count) { throw 'Action-plan snapshot does not match the validated request' }

$script:sequence=0; $script:lastStage='worker.initialize'; $script:lastStatus='begin'; $script:cleanupConfirmed=$true; $script:officeOperationsStopped=$false
$script:ownedPresentationPath=$null; $script:presentation=$null
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$report=[ordered]@{
    schemaVersion=1
    source=[ordered]@{path=$sourcePath;sha256=$sourceHash;openedPath=$sourceSnapshot;openedSha256=(Get-FurnitureSha256 $sourceSnapshot)}
    saved=[ordered]@{path=$savedPath;sha256=$null}
    reopened=[ordered]@{path=$savedPath;sha256=$null}
    actionPlan=[ordered]@{path=$request.actionPlan.path;sha256=$request.actionPlan.sha256;snapshotPath=$planSnapshot;snapshotSha256=(Get-FurnitureSha256 $planSnapshot);actions=$actions;completed=@()}
    phases=[ordered]@{original=$null;edited=$null;reopened=$null}
    inputs=[ordered]@{verifier=$request.verifier;processHelper=$request.processHelper}
    environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null;powerPointExecutable=$null;powerPointBuild=$null;powerPointExecutableSha256=$null}
    cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;lastStage=$script:lastStage;lastStatus=$script:lastStatus;error=$null
    scope='One explicitly supplied presentation with at most three slides, thirty shapes per slide and twenty prevalidated actions. Original, edited and read-only reopened native states and PNGs are observations. The worker never quits or kills Office, changes security, retries, or closes unrelated presentations.'
}
function Write-FurnitureReport {
    $report.cleanupConfirmed=$script:cleanupConfirmed; $report.officeOperationsStopped=$script:officeOperationsStopped; $report.lastStage=$script:lastStage; $report.lastStatus=$script:lastStatus
    $report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportFile -Encoding UTF8
}
function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++; $script:lastStage=$Name; $script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$Name;status=$Status;error=$ErrorMessage;cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;ownedPresentationPath=$script:ownedPresentationPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $progressFile -Encoding UTF8
}
function Invoke-FurnitureCom([string]$Name,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-FurnitureStage $Name 'begin'
    try { $value=& $Operation; Write-FurnitureStage $Name 'success'; return ,$value }
    catch { $script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-FurnitureStage $Name 'error' $_.Exception.Message; throw }
}
function Assert-PresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-FurnitureCom "$Prefix.presentations.get" { return ,$Application.Presentations }
    $count=Invoke-FurnitureCom "$Prefix.presentations.count.get" { $presentations.Count }
    for($index=1;$index -le $count;$index++) { $candidate=Invoke-FurnitureCom "$Prefix.presentations.item-$index.get" { $presentations.Item($index) }; $candidatePath=Invoke-FurnitureCom "$Prefix.presentations.item-$index.fullName.get" { $candidate.FullName }; if($candidatePath -ieq $Path) { throw "Presentation is already open, so ownership cannot be established: $Path" } }
}
function Get-ExactSlide($Presentation,[int]$Index,[string]$Prefix) {
    $slides=Invoke-FurnitureCom "$Prefix.slides.get" { return ,$Presentation.Slides }; $count=Invoke-FurnitureCom "$Prefix.slides.count.get" { $slides.Count }
    if($count -lt 1 -or $count -gt 3) { throw "Presentation must contain 1 through 3 slides; observed $count" }
    if($Index -gt $count) { throw "$Prefix slideIndex $Index exceeds current slide count $count" }
    return ,(Invoke-FurnitureCom "$Prefix.slide-$Index.get" { $slides.Item($Index) })
}
function Get-ExactShape($Slide,[string]$Name,[string]$Prefix) {
    $shapes=Invoke-FurnitureCom "$Prefix.shapes.get" { return ,$Slide.Shapes }; $count=Invoke-FurnitureCom "$Prefix.shapes.count.get" { $shapes.Count }
    if($count -gt 30) { throw "$Prefix exceeds the 30-shape-per-slide limit" }
    $matches=@()
    for($index=1;$index -le $count;$index++) { $shape=Invoke-FurnitureCom "$Prefix.shape-$index.get" { $shapes.Item($index) }; $actual=Invoke-FurnitureCom "$Prefix.shape-$index.name.get" { $shape.Name }; if($actual -ceq $Name) { $matches+=@($shape) } }
    if($matches.Count -ne 1) { throw "$Prefix expected one exact shape named '$Name'; observed $($matches.Count)" }
    return ,$matches[0]
}
function Assert-ShapeNameAvailable($Slide,[string]$Name,[string]$Prefix) {
    $shapes=Invoke-FurnitureCom "$Prefix.shapes.get" { return ,$Slide.Shapes }; $count=Invoke-FurnitureCom "$Prefix.shapes.count.get" { $shapes.Count }
    if($count -ge 30) { throw "$Prefix cannot duplicate beyond the 30-shape-per-slide limit" }
    for($index=1;$index -le $count;$index++) { $shape=Invoke-FurnitureCom "$Prefix.shape-$index.get" { $shapes.Item($index) }; $actual=Invoke-FurnitureCom "$Prefix.shape-$index.name.get" { $shape.Name }; if($actual -ieq $Name) { throw "$Prefix newName already exists: $Name" } }
}
function Read-NativeTags($Tags,[string]$Prefix) {
    $count=Invoke-FurnitureCom "$Prefix.count.get" { $Tags.Count }; $items=@()
    for($index=1;$index -le $count;$index++) { $name=Invoke-FurnitureCom "$Prefix.name-$index.get" { $Tags.Name($index) }; $value=Invoke-FurnitureCom "$Prefix.value-$index.get" { $Tags.Value($index) }; $items+=@([ordered]@{index=$index;name=$name;value=$value}) }
    return ,$items
}
function Read-FurnitureState($Presentation,[string]$Phase) {
    $slides=Invoke-FurnitureCom "$Phase.slides.get" { return ,$Presentation.Slides }; $slideCount=Invoke-FurnitureCom "$Phase.slides.count.get" { $slides.Count }
    if($slideCount -lt 1 -or $slideCount -gt 3) { throw "Presentation must contain 1 through 3 slides; observed $slideCount" }
    $slideRecords=@(); $rasters=@()
    for($slideIndex=1;$slideIndex -le $slideCount;$slideIndex++) {
        $slide=Invoke-FurnitureCom "$Phase.slide-$slideIndex.get" { $slides.Item($slideIndex) }
        $slideId=Invoke-FurnitureCom "$Phase.slide-$slideIndex.id.get" { $slide.SlideID }; $slideName=Invoke-FurnitureCom "$Phase.slide-$slideIndex.name.get" { $slide.Name }
        $slideTagsObject=Invoke-FurnitureCom "$Phase.slide-$slideIndex.tags.get" { return ,$slide.Tags }; $slideTags=Read-NativeTags $slideTagsObject "$Phase.slide-$slideIndex.tags"
        $shapes=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shapes.get" { return ,$slide.Shapes }; $shapeCount=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shapes.count.get" { $shapes.Count }
        if($shapeCount -gt 30) { throw "$Phase slide $slideIndex exceeds the 30-shape limit" }
        $shapeRecords=@()
        for($shapeIndex=1;$shapeIndex -le $shapeCount;$shapeIndex++) {
            $shape=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.get" { $shapes.Item($shapeIndex) }
            $id=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.id.get" { $shape.Id }; $name=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.name.get" { $shape.Name }; $type=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.type.get" { $shape.Type }
            $left=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.left.get" { $shape.Left }; $top=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.top.get" { $shape.Top }; $width=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.width.get" { $shape.Width }; $height=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.height.get" { $shape.Height }; $rotation=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.rotation.get" { $shape.Rotation }
            $hasTextFrame=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.hasTextFrame.get" { $shape.HasTextFrame }; $text=$null
            if($hasTextFrame -ne 0) { $frame=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.textFrame.get" { $shape.TextFrame }; $range=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.textRange.get" { $frame.TextRange }; $text=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.text.get" { $range.Text } }
            $alt=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.alternativeText.get" { $shape.AlternativeText }
            $shapeTagsObject=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.tags.get" { return ,$shape.Tags }; $shapeTags=Read-NativeTags $shapeTagsObject "$Phase.slide-$slideIndex.shape-$shapeIndex.tags"
            $shapeRecords+=@([ordered]@{index=$shapeIndex;id=$id;name=$name;type=$type;left=$left;top=$top;width=$width;height=$height;rotation=$rotation;hasTextFrame=$hasTextFrame;text=$text;alternativeText=$alt;tags=$shapeTags})
        }
        $png=Join-Path $root "$Phase-slide-$('{0:D2}' -f $slideIndex).png"; Invoke-FurnitureCom "$Phase.slide-$slideIndex.export.png" { $slide.Export($png,'PNG',1280,720) }
        $rasters+=@([ordered]@{slideIndex=$slideIndex;path=$png;sha256=(Get-FurnitureSha256 $png)})
        $slideRecords+=@([ordered]@{index=$slideIndex;slideId=$slideId;name=$slideName;tags=$slideTags;shapeCount=$shapeCount;shapes=$shapeRecords})
    }
    return [ordered]@{slideCount=$slideCount;slides=$slideRecords;rasters=$rasters}
}
function Get-ActionTags($Presentation,$Action,[string]$Prefix) {
    $slide=Get-ExactSlide $Presentation ([int]$Action.slideIndex) $Prefix
    if($Action.target -eq 'slide') { return ,(Invoke-FurnitureCom "$Prefix.slide.tags.get" { return ,$slide.Tags }) }
    $shape=Get-ExactShape $slide $Action.shapeName $Prefix
    return ,(Invoke-FurnitureCom "$Prefix.shape.tags.get" { return ,$shape.Tags })
}
function Apply-FurnitureAction($Presentation,$Action,[int]$Number) {
    $prefix="action-$Number-$($Action.op)"
    if($Action.op -eq 'move-slide') { $slide=Get-ExactSlide $Presentation ([int]$Action.slideIndex) $prefix; Invoke-FurnitureCom "$prefix.moveTo" { $slide.MoveTo([int]$Action.toIndex) }; return }
    $slide=Get-ExactSlide $Presentation ([int]$Action.slideIndex) $prefix
    if($Action.op -in @('set-tag','delete-tag')) {
        $tags=Get-ActionTags $Presentation $Action $prefix
        if($Action.op -eq 'set-tag') { Invoke-FurnitureCom "$prefix.tags.add" { $tags.Add($Action.tagName,$Action.tagValue) }; return }
        $existing=Read-NativeTags $tags "$prefix.tags.precondition"; if(@($existing | Where-Object { $_.name -ieq $Action.tagName }).Count -ne 1) { throw "$prefix expected one existing tag '$($Action.tagName)'" }
        Invoke-FurnitureCom "$prefix.tags.delete" { $tags.Delete($Action.tagName) }; return
    }
    $shape=Get-ExactShape $slide $Action.shapeName $prefix
    switch($Action.op) {
        'set-text' { $has=Invoke-FurnitureCom "$prefix.hasTextFrame.get" { $shape.HasTextFrame }; if($has -eq 0) { throw "$prefix selected shape has no text frame" }; $frame=Invoke-FurnitureCom "$prefix.textFrame.get" { $shape.TextFrame }; $range=Invoke-FurnitureCom "$prefix.textRange.get" { $frame.TextRange }; Invoke-FurnitureCom "$prefix.text.set" { $range.Text=$Action.text } }
        'set-alt' { Invoke-FurnitureCom "$prefix.alternativeText.set" { $shape.AlternativeText=$Action.alt } }
        'delete-shape' { Invoke-FurnitureCom "$prefix.delete" { $shape.Delete() } }
        'duplicate-shape' { Assert-ShapeNameAvailable $slide $Action.newName $prefix; $range=Invoke-FurnitureCom "$prefix.duplicate" { return ,$shape.Duplicate() }; $count=Invoke-FurnitureCom "$prefix.duplicateRange.count.get" { $range.Count }; if($count -ne 1) { throw "$prefix expected one duplicated shape; observed $count" }; $duplicate=Invoke-FurnitureCom "$prefix.duplicateRange.item-1.get" { $range.Item(1) }; Invoke-FurnitureCom "$prefix.duplicate.name.set" { $duplicate.Name=$Action.newName } }
    }
}
function Close-OwnedFurniture([string]$Phase,[string]$ExpectedPath) {
    $actual=Invoke-FurnitureCom "$Phase.fullName.get" { $script:presentation.FullName }; if($actual -ine $ExpectedPath) { throw "Refusing to close a presentation whose exact saved path is not owned: $actual" }
    Invoke-FurnitureCom "$Phase.close" { $script:presentation.Close() }; $script:presentation=$null; $script:ownedPresentationPath=$null; $script:cleanupConfirmed=$true; Write-FurnitureStage "$Phase.cleanup" 'success'
}

Write-FurnitureReport; Write-FurnitureStage 'worker.initialize' 'success'
try {
    $app=Invoke-FurnitureCom 'application.create' { New-Object -ComObject PowerPoint.Application }
    $officeVersion=Invoke-FurnitureCom 'application.version.get' { $app.Version }; $officeDirectory=Invoke-FurnitureCom 'application.path.get' { $app.Path }; $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $report.environment.powerPointVersion=$officeVersion; $report.environment.powerPointExecutable=$officeExecutable; $report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion; $report.environment.powerPointExecutableSha256=Get-FurnitureSha256 $officeExecutable; Write-FurnitureReport
    Assert-PresentationNotOpen $app $sourceSnapshot 'input.preflight'; Assert-PresentationNotOpen $app $savedPath 'output.preflight'
    $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$sourceSnapshot; Write-FurnitureReport
    $presentations=Invoke-FurnitureCom 'input.presentations.get' { return ,$app.Presentations }; $script:presentation=Invoke-FurnitureCom 'input.presentation.open' { $presentations.Open($sourceSnapshot,0,0,-1) }
    $report.phases.original=Read-FurnitureState $script:presentation 'original'; Write-FurnitureReport
    Invoke-FurnitureCom 'owned-copy.saveAs' { $script:presentation.SaveAs($savedPath,24) }; $script:ownedPresentationPath=$savedPath; Write-FurnitureReport
    for($index=0;$index -lt $actions.Count;$index++) { Apply-FurnitureAction $script:presentation $actions[$index] ($index+1); $report.actionPlan.completed+=@([ordered]@{index=$index+1;op=$actions[$index].op;status='success'}) }
    Write-FurnitureReport
    Invoke-FurnitureCom 'edited.presentation.save' { $script:presentation.Save() }
    $report.phases.edited=Read-FurnitureState $script:presentation 'edited'; Write-FurnitureReport
    Close-OwnedFurniture 'edited.presentation' $savedPath; $report.saved.sha256=Get-FurnitureSha256 $savedPath; Write-FurnitureReport
    Assert-PresentationNotOpen $app $savedPath 'reopen.preflight'; $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$savedPath; Write-FurnitureReport
    $presentations=Invoke-FurnitureCom 'reopen.presentations.get' { return ,$app.Presentations }; $script:presentation=Invoke-FurnitureCom 'reopen.presentation.open' { $presentations.Open($savedPath,-1,0,-1) }
    $reopenedPath=Invoke-FurnitureCom 'reopen.presentation.fullName.get' { $script:presentation.FullName }; if($reopenedPath -ine $savedPath) { throw "Reopened presentation path differs from exact saved path: $reopenedPath" }
    $report.phases.reopened=Read-FurnitureState $script:presentation 'reopened'; Write-FurnitureReport
    Close-OwnedFurniture 'reopened.presentation' $savedPath; $report.reopened.sha256=Get-FurnitureSha256 $savedPath
    if((Get-FurnitureSha256 $sourcePath) -cne $sourceHash -or (Get-FurnitureSha256 $sourceSnapshot) -cne $sourceHash) { throw 'Requested source or its snapshot changed during the native lifecycle' }
    if((Get-FurnitureSha256 $planSnapshot) -cne $request.actionPlan.snapshotSha256) { throw 'Action-plan snapshot changed during the native lifecycle' }
    Write-FurnitureStage 'worker.complete' 'success'; Write-FurnitureReport; Write-Output "Native furniture control completed with $($actions.Count) action(s)."
} catch {
    $report.error=$_.Exception.Message; if($script:officeOperationsStopped -or $null -ne $script:presentation) { $script:cleanupConfirmed=$false }
    Write-FurnitureStage 'worker.failure' 'error' $_.Exception.Message; Write-FurnitureReport; throw
}
