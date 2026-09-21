param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][string]$InputPresentation,
    [Parameter(Mandatory=$true)][ValidateSet('alter','replace','delete')][string]$EditMode,
    [string]$ReplacementPng='',
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker
)
$ErrorActionPreference='Stop'

function Get-EditSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

if(-not $Worker) {
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    $requestedPresentation=(Resolve-Path -LiteralPath $InputPresentation).Path
    if([IO.Path]::GetExtension($requestedPresentation) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
    $requestedReplacement=$null
    if($EditMode -eq 'replace') {
        if([string]::IsNullOrWhiteSpace($ReplacementPng)) { throw 'ReplacementPng is required for replace mode' }
        $requestedReplacement=(Resolve-Path -LiteralPath $ReplacementPng).Path
        if([IO.Path]::GetExtension($requestedReplacement) -ine '.png') { throw 'ReplacementPng must select one existing .png file' }
    } elseif(-not [string]::IsNullOrWhiteSpace($ReplacementPng)) {
        throw 'ReplacementPng is accepted only in replace mode'
    }

    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'
    [void](New-Item -ItemType Directory -Path $snapshotRoot)
    $verifierSnapshot=Join-Path $snapshotRoot 'native-picture-edit.ps1'
    $helperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path
    $helperSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $presentationSnapshot=Join-Path $snapshotRoot 'input.pptx'
    $replacementSnapshot=$(if($EditMode -eq 'replace'){Join-Path $snapshotRoot 'replacement.png'}else{$null})
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $helperOriginal -Destination $helperSnapshot
    Copy-Item -LiteralPath $requestedPresentation -Destination $presentationSnapshot
    if($EditMode -eq 'replace') { Copy-Item -LiteralPath $requestedReplacement -Destination $replacementSnapshot }

    $request=[ordered]@{
        editMode=$EditMode
        source=[ordered]@{path=$requestedPresentation;sha256=(Get-EditSha256 $requestedPresentation);snapshotPath=$presentationSnapshot;snapshotSha256=(Get-EditSha256 $presentationSnapshot)}
        replacement=$(if($EditMode -eq 'replace'){[ordered]@{path=$requestedReplacement;sha256=(Get-EditSha256 $requestedReplacement);snapshotPath=$replacementSnapshot;snapshotSha256=(Get-EditSha256 $replacementSnapshot)}}else{$null})
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-EditSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-EditSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$helperOriginal;sha256=(Get-EditSha256 $helperOriginal);snapshotPath=$helperSnapshot;snapshotSha256=(Get-EditSha256 $helperSnapshot)}
        expectations=[ordered]@{
            alter=[ordered]@{left=216;top=132;width=504;height=252;cropLeft=18;cropTop=12;cropRight=0;cropBottom=0;alternativeText=''}
            replace=[ordered]@{left=204;top=126;width=516;height=288;name='native-picture-replacement';alternativeText='Replacement picture added by native-picture-edit'}
            delete=[ordered]@{shapeCount=0;pictureCount=0}
        }
    }
    $request | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $arguments=@('-OutputDirectory',$outputRoot,'-InputPresentation',$requestedPresentation,'-EditMode',$EditMode,'-Worker')
    if($EditMode -eq 'replace') { $arguments+=@('-ReplacementPng',$requestedReplacement) }
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments $arguments -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
    $lastDurable=$null
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')) {
        try { $lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $lastDurable=$null }
    }
    if($null -eq $lastDurable -and (Test-Path -LiteralPath (Join-Path $outputRoot 'stages.jsonl'))) {
        foreach($line in (Get-Content -LiteralPath (Join-Path $outputRoot 'stages.jsonl') -Encoding UTF8)) {
            try { $lastDurable=$line | ConvertFrom-Json } catch { }
        }
    }
    $terminal=[ordered]@{
        timestamp=(Get-Date).ToUniversalTime().ToString('o')
        timedOut=$result.timedOut
        exitCode=$result.exitCode
        cleanupConfirmed=$(if($result.timedOut){$false}elseif($null -ne $lastDurable){[bool]$lastDurable.cleanupConfirmed}else{$false})
        lastDurableStage=$(if($null -ne $lastDurable){$lastDurable.stage}else{$null})
        lastDurableStatus=$(if($null -ne $lastDurable){$lastDurable.status}else{$null})
    }
    $terminal | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if($result.timedOut -and (Test-Path -LiteralPath (Join-Path $outputRoot 'report.json'))) {
        try {
            Copy-Item -LiteralPath (Join-Path $outputRoot 'report.json') -Destination (Join-Path $outputRoot 'report.worker.json')
            $timedOutReport=Get-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            $timedOutReport.cleanupConfirmed=$false
            $timedOutReport.officeOperationsStopped=$true
            $timedOutReport.lastStage=$terminal.lastDurableStage
            $timedOutReport.lastStatus=$terminal.lastDurableStatus
            $timedOutReport.error='Owned native worker timed out; Office cleanup is unconfirmed and no retry was started.'
            $timedOutReport | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Encoding UTF8
        } catch { }
    }
    Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object { Write-Host $_ }
    if($result.timedOut -or $result.exitCode -ne 0) { throw 'Native picture edit failed or timed out; preserve the entire attempt and inspect Office. No retry was started.' }
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$stageFile=Join-Path $root 'stages.jsonl'
$progressFile=Join-Path $root 'progress.json'
$reportFile=Join-Path $root 'report.json'
$savedPath=Join-Path $root 'native-picture-edit.pptx'
$originalPng=Join-Path $root 'original.png'
$editedPng=Join-Path $root 'edited.png'
$reopenedPng=Join-Path $root 'reopened.png'
foreach($reserved in @($stageFile,$progressFile,$reportFile,$savedPath,$originalPng,$editedPng,$reopenedPng)) {
    if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' }
}

$script:sequence=0
$script:lastStage='worker.initialize'
$script:lastStatus='begin'
$script:cleanupConfirmed=$true
$script:officeOperationsStopped=$false
$script:ownedPresentationPath=$null
$script:presentation=$null
$requestFile=(Resolve-Path -LiteralPath (Join-Path $root 'request.json')).Path
$request=Get-Content -LiteralPath $requestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$editMode=$request.editMode
if($editMode -notin @('alter','replace','delete')) { throw 'Snapshot request has an unsupported edit mode' }
$sourcePath=$request.source.path
$sourceHash=$request.source.sha256
$officeSourcePath=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path
$helperPath=(Resolve-Path -LiteralPath $request.processHelper.path).Path
$replacementPath=$(if($editMode -eq 'replace'){(Resolve-Path -LiteralPath $request.replacement.snapshotPath).Path}else{$null})
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
if((Get-EditSha256 $PSCommandPath) -cne $request.verifier.sha256 -or (Get-EditSha256 $request.verifier.snapshotPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }
if((Get-EditSha256 $helperPath) -cne $request.processHelper.sha256 -or (Get-EditSha256 $request.processHelper.snapshotPath) -cne $request.processHelper.sha256) { throw 'Process-helper snapshot does not match the recorded helper' }
if((Get-EditSha256 $officeSourcePath) -cne $sourceHash) { throw 'Presentation snapshot hash does not match the requested source' }
if($editMode -eq 'replace' -and (Get-EditSha256 $replacementPath) -cne $request.replacement.sha256) { throw 'Replacement snapshot hash does not match the requested PNG' }

$report=[ordered]@{
    schemaVersion=1
    editMode=$editMode
    source=[ordered]@{path=$sourcePath;sha256=$sourceHash;openedPath=$officeSourcePath;openedSha256=(Get-EditSha256 $officeSourcePath);unchanged=$null;snapshotUnchanged=$null}
    saved=[ordered]@{path=$savedPath;sha256=$null}
    original=[ordered]@{observation=$null;raster=[ordered]@{path=$originalPng;sha256=$null}}
    edited=[ordered]@{expectation=$request.expectations.$editMode;observation=$null;raster=[ordered]@{path=$editedPng;sha256=$null}}
    reopened=[ordered]@{path=$savedPath;sha256=$null;observation=$null;raster=[ordered]@{path=$reopenedPng;sha256=$null}}
    inputs=[ordered]@{
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-EditSha256 $PSCommandPath);snapshotPath=$request.verifier.snapshotPath;snapshotSha256=(Get-EditSha256 $request.verifier.snapshotPath)}
        processHelper=[ordered]@{path=$helperPath;sha256=(Get-EditSha256 $helperPath);snapshotPath=$request.processHelper.snapshotPath;snapshotSha256=(Get-EditSha256 $request.processHelper.snapshotPath)}
        presentation=[ordered]@{path=$sourcePath;sha256=$sourceHash;snapshotPath=$officeSourcePath;snapshotSha256=(Get-EditSha256 $officeSourcePath)}
        replacementImage=$(if($editMode -eq 'replace'){[ordered]@{path=$request.replacement.path;sha256=$request.replacement.sha256;snapshotPath=$replacementPath;snapshotSha256=(Get-EditSha256 $replacementPath);unchanged=$null;snapshotUnchanged=$null}}else{$null})
    }
    environment=[ordered]@{
        hostVersion=$PSVersionTable.PSVersion.ToString()
        windowsProductName=$os.ProductName
        windowsDisplayVersion=$os.DisplayVersion
        windowsBuild="$($os.CurrentBuild).$($os.UBR)"
        powerPointVersion=$null
        powerPointExecutable=$null
        powerPointBuild=$null
        powerPointExecutableSha256=$null
    }
    cleanupConfirmed=$script:cleanupConfirmed
    officeOperationsStopped=$script:officeOperationsStopped
    lastStage=$script:lastStage
    lastStatus=$script:lastStatus
    error=$null
    scope='One explicitly supplied PPTX snapshot containing one slide and one embedded picture. The worker alters, replaces, or deletes only that picture; it never quits or kills Office, changes security, retries, or closes unrelated presentations.'
}

function Write-EditReport {
    $report.cleanupConfirmed=$script:cleanupConfirmed
    $report.officeOperationsStopped=$script:officeOperationsStopped
    $report.lastStage=$script:lastStage
    $report.lastStatus=$script:lastStatus
    $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reportFile -Encoding UTF8
}

function Write-EditStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++
    $script:lastStage=$Name
    $script:lastStatus=$Status
    $record=[ordered]@{
        sequence=$script:sequence
        timestamp=(Get-Date).ToUniversalTime().ToString('o')
        stage=$Name
        status=$Status
        error=$ErrorMessage
        cleanupConfirmed=$script:cleanupConfirmed
        officeOperationsStopped=$script:officeOperationsStopped
        ownedPresentationPath=$script:ownedPresentationPath
    }
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $progressFile -Encoding UTF8
    Write-EditReport
}

function Invoke-EditCom([string]$Name,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-EditStage $Name 'begin'
    try {
        $value=& $Operation
        Write-EditStage $Name 'success'
        return ,$value
    } catch {
        $script:officeOperationsStopped=$true
        $script:cleanupConfirmed=$false
        Write-EditStage $Name 'error' $_.Exception.Message
        throw
    }
}

function Assert-PresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-EditCom "$Prefix.presentations.get" { return ,$Application.Presentations }
    $count=Invoke-EditCom "$Prefix.presentations.count.get" { $presentations.Count }
    for($index=1;$index -le $count;$index++) {
        $candidate=Invoke-EditCom "$Prefix.presentations.item-$index.get" { return ,$presentations.Item($index) }
        $candidatePath=Invoke-EditCom "$Prefix.presentations.item-$index.fullName.get" { $candidate.FullName }
        if($candidatePath -ieq $Path) { throw "Presentation is already open, so ownership cannot be established: $Path" }
    }
}

function Read-PictureObservation($Presentation,[string]$Phase,[int]$ExpectedShapeCount,[int]$ExpectedPictureCount,[bool]$RequireEmbeddedPicture) {
    $slides=Invoke-EditCom "$Phase.slides.get" { return ,$Presentation.Slides }
    $slideCount=Invoke-EditCom "$Phase.slides.count.get" { $slides.Count }
    if($slideCount -ne 1) { throw "Native picture edit requires exactly one slide; observed $slideCount" }
    $slide=Invoke-EditCom "$Phase.slides.item-1.get" { return ,$slides.Item(1) }
    $shapes=Invoke-EditCom "$Phase.slide-1.shapes.get" { return ,$slide.Shapes }
    $shapeCount=Invoke-EditCom "$Phase.slide-1.shapes.count.get" { $shapes.Count }
    $pictures=@()
    $linkedPictureCount=0
    $embeddedPictureCount=0
    for($index=1;$index -le $shapeCount;$index++) {
        $shape=Invoke-EditCom "$Phase.shape-$index.get" { return ,$shapes.Item($index) }
        $type=Invoke-EditCom "$Phase.shape-$index.type.get" { $shape.Type }
        if($type -eq 11 -or $type -eq 13) {
            if($type -eq 11) { $linkedPictureCount++ } else { $embeddedPictureCount++ }
            $name=Invoke-EditCom "$Phase.shape-$index.name.get" { $shape.Name }
            $alternativeText=Invoke-EditCom "$Phase.shape-$index.alternativeText.get" { $shape.AlternativeText }
            $left=Invoke-EditCom "$Phase.shape-$index.left.get" { $shape.Left }
            $top=Invoke-EditCom "$Phase.shape-$index.top.get" { $shape.Top }
            $width=Invoke-EditCom "$Phase.shape-$index.width.get" { $shape.Width }
            $height=Invoke-EditCom "$Phase.shape-$index.height.get" { $shape.Height }
            $rotation=Invoke-EditCom "$Phase.shape-$index.rotation.get" { $shape.Rotation }
            $lockAspectRatio=Invoke-EditCom "$Phase.shape-$index.lockAspectRatio.get" { $shape.LockAspectRatio }
            $pictureFormat=Invoke-EditCom "$Phase.shape-$index.pictureFormat.get" { return ,$shape.PictureFormat }
            $cropLeft=Invoke-EditCom "$Phase.shape-$index.cropLeft.get" { $pictureFormat.CropLeft }
            $cropTop=Invoke-EditCom "$Phase.shape-$index.cropTop.get" { $pictureFormat.CropTop }
            $cropRight=Invoke-EditCom "$Phase.shape-$index.cropRight.get" { $pictureFormat.CropRight }
            $cropBottom=Invoke-EditCom "$Phase.shape-$index.cropBottom.get" { $pictureFormat.CropBottom }
            $pictures+=@([ordered]@{index=$index;name=$name;alternativeText=$alternativeText;type=$type;left=$left;top=$top;width=$width;height=$height;rotation=$rotation;lockAspectRatio=$lockAspectRatio;cropLeft=$cropLeft;cropTop=$cropTop;cropRight=$cropRight;cropBottom=$cropBottom})
        }
    }
    $pageSetup=Invoke-EditCom "$Phase.pageSetup.get" { return ,$Presentation.PageSetup }
    $slideWidth=Invoke-EditCom "$Phase.slideWidth.get" { $pageSetup.SlideWidth }
    $slideHeight=Invoke-EditCom "$Phase.slideHeight.get" { $pageSetup.SlideHeight }
    $observation=[ordered]@{slideCount=$slideCount;slideWidth=$slideWidth;slideHeight=$slideHeight;shapeCount=$shapeCount;pictureCount=$pictures.Count;linkedPictureCount=$linkedPictureCount;embeddedPictureCount=$embeddedPictureCount;pictures=$pictures}
    if($shapeCount -ne $ExpectedShapeCount -or $pictures.Count -ne $ExpectedPictureCount) { throw "$Phase expected $ExpectedShapeCount shape(s) and $ExpectedPictureCount picture(s); observed $shapeCount shape(s) and $($pictures.Count) picture(s)" }
    if($RequireEmbeddedPicture -and ($embeddedPictureCount -ne 1 -or $linkedPictureCount -ne 0)) { throw "$Phase expected one embedded picture and no linked pictures; observed $embeddedPictureCount embedded and $linkedPictureCount linked" }
    return $observation
}

function Assert-ObservedNumber([string]$Name,$Actual,$Expected) {
    if([Math]::Abs(([double]$Actual)-([double]$Expected)) -gt 0.02) { throw "$Name expected $Expected but observed $Actual" }
}

function Assert-EditedObservation($Observation,[string]$Mode,$Expectation) {
    if($Mode -eq 'delete') {
        if($Observation.shapeCount -ne 0 -or $Observation.pictureCount -ne 0) { throw 'Delete mode did not leave the slide empty' }
        return
    }
    $picture=$Observation.pictures[0]
    if($picture.type -ne 13 -or $Observation.embeddedPictureCount -ne 1 -or $Observation.linkedPictureCount -ne 0) { throw "$Mode mode did not leave exactly one embedded picture" }
    Assert-ObservedNumber "$Mode.left" $picture.left $Expectation.left
    Assert-ObservedNumber "$Mode.top" $picture.top $Expectation.top
    Assert-ObservedNumber "$Mode.width" $picture.width $Expectation.width
    Assert-ObservedNumber "$Mode.height" $picture.height $Expectation.height
    if($Mode -eq 'alter') {
        if($picture.alternativeText -cne '') { throw 'Alter mode did not clear alternative text to the empty string' }
        Assert-ObservedNumber 'alter.cropLeft' $picture.cropLeft $Expectation.cropLeft
        Assert-ObservedNumber 'alter.cropTop' $picture.cropTop $Expectation.cropTop
        Assert-ObservedNumber 'alter.cropRight' $picture.cropRight $Expectation.cropRight
        Assert-ObservedNumber 'alter.cropBottom' $picture.cropBottom $Expectation.cropBottom
    } else {
        if($picture.name -cne $Expectation.name) { throw "Replace mode expected name $($Expectation.name) but observed $($picture.name)" }
        if($picture.alternativeText -cne $Expectation.alternativeText) { throw 'Replace mode alternative text did not match the requested fresh value' }
    }
}

function Close-OwnedPresentation([string]$Phase,[string]$ExpectedPath) {
    $actualPath=Invoke-EditCom "$Phase.fullName.get" { $script:presentation.FullName }
    if($actualPath -ine $ExpectedPath) { throw "Refusing to close a presentation whose exact path is not owned: $actualPath" }
    Invoke-EditCom "$Phase.close" { $script:presentation.Close() }
    $script:presentation=$null
    $script:ownedPresentationPath=$null
    $script:cleanupConfirmed=$true
    Write-EditStage "$Phase.cleanup" 'success'
}

Write-EditReport
Write-EditStage 'worker.initialize' 'success'
try {
    $app=Invoke-EditCom 'application.create' { return ,(New-Object -ComObject PowerPoint.Application) }
    $officeVersion=Invoke-EditCom 'application.version.get' { $app.Version }
    $officeDirectory=Invoke-EditCom 'application.path.get' { $app.Path }
    $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $report.environment.powerPointVersion=$officeVersion
    $report.environment.powerPointExecutable=$officeExecutable
    $report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion
    $report.environment.powerPointExecutableSha256=Get-EditSha256 $officeExecutable
    Write-EditReport

    Assert-PresentationNotOpen $app $officeSourcePath 'input.preflight'
    Assert-PresentationNotOpen $app $savedPath 'output.preflight'
    $script:cleanupConfirmed=$false
    $script:ownedPresentationPath=$officeSourcePath
    Write-EditReport
    $presentations=Invoke-EditCom 'input.presentations.get' { return ,$app.Presentations }
    $script:presentation=Invoke-EditCom 'input.presentation.open' { return ,$presentations.Open($officeSourcePath,0,0,-1) }

    $originalObservation=Read-PictureObservation $script:presentation 'original.observe' 1 1 $true
    $report.original.observation=$originalObservation
    Write-EditReport
    $originalSlides=Invoke-EditCom 'original.export.slides.get' { return ,$script:presentation.Slides }
    $originalSlide=Invoke-EditCom 'original.export.slide-1.get' { return ,$originalSlides.Item(1) }
    Invoke-EditCom 'original.export.png' { $originalSlide.Export($originalPng,'PNG',1280,720) }
    $report.original.raster.sha256=Get-EditSha256 $originalPng
    Write-EditReport

    $editSlides=Invoke-EditCom 'edit.slides.get' { return ,$script:presentation.Slides }
    $editSlide=Invoke-EditCom 'edit.slide-1.get' { return ,$editSlides.Item(1) }
    $editShapes=Invoke-EditCom 'edit.slide-1.shapes.get' { return ,$editSlide.Shapes }
    $originalPicture=Invoke-EditCom 'edit.original-picture.get' { return ,$editShapes.Item(1) }
    if($editMode -eq 'alter') {
        $expected=$request.expectations.alter
        Invoke-EditCom 'edit.alter.alternativeText.set' { $originalPicture.AlternativeText='' }
        $pictureFormat=Invoke-EditCom 'edit.alter.pictureFormat.get' { return ,$originalPicture.PictureFormat }
        Invoke-EditCom 'edit.alter.cropLeft.set' { $pictureFormat.CropLeft=$expected.cropLeft }
        Invoke-EditCom 'edit.alter.cropTop.set' { $pictureFormat.CropTop=$expected.cropTop }
        Invoke-EditCom 'edit.alter.cropRight.set' { $pictureFormat.CropRight=$expected.cropRight }
        Invoke-EditCom 'edit.alter.cropBottom.set' { $pictureFormat.CropBottom=$expected.cropBottom }
        Invoke-EditCom 'edit.alter.lockAspectRatio.set' { $originalPicture.LockAspectRatio=0 }
        Invoke-EditCom 'edit.alter.left.set' { $originalPicture.Left=$expected.left }
        Invoke-EditCom 'edit.alter.top.set' { $originalPicture.Top=$expected.top }
        Invoke-EditCom 'edit.alter.width.set' { $originalPicture.Width=$expected.width }
        Invoke-EditCom 'edit.alter.height.set' { $originalPicture.Height=$expected.height }
    } elseif($editMode -eq 'replace') {
        $expected=$request.expectations.replace
        Invoke-EditCom 'edit.replace.original.delete' { $originalPicture.Delete() }
        $replacementPicture=Invoke-EditCom 'edit.replace.picture.add' { return ,$editShapes.AddPicture($replacementPath,0,-1,$expected.left,$expected.top,$expected.width,$expected.height) }
        Invoke-EditCom 'edit.replace.picture.name.set' { $replacementPicture.Name=$expected.name }
        Invoke-EditCom 'edit.replace.picture.alternativeText.set' { $replacementPicture.AlternativeText=$expected.alternativeText }
    } else {
        Invoke-EditCom 'edit.delete.original.delete' { $originalPicture.Delete() }
    }

    $expectedShapeCount=$(if($editMode -eq 'delete'){0}else{1})
    $expectedPictureCount=$expectedShapeCount
    $editedObservation=Read-PictureObservation $script:presentation 'edited.observe' $expectedShapeCount $expectedPictureCount ($editMode -ne 'delete')
    $report.edited.observation=$editedObservation
    Write-EditReport
    Assert-EditedObservation $editedObservation $editMode $request.expectations.$editMode
    $editedSlides=Invoke-EditCom 'edited.export.slides.get' { return ,$script:presentation.Slides }
    $editedSlide=Invoke-EditCom 'edited.export.slide-1.get' { return ,$editedSlides.Item(1) }
    Invoke-EditCom 'edited.export.png' { $editedSlide.Export($editedPng,'PNG',1280,720) }
    $report.edited.raster.sha256=Get-EditSha256 $editedPng
    Write-EditReport

    Invoke-EditCom 'edited.presentation.saveAs-owned-copy' { $script:presentation.SaveAs($savedPath,24) }
    $script:ownedPresentationPath=$savedPath
    Write-EditReport
    Close-OwnedPresentation 'edited.presentation' $savedPath
    $report.saved.sha256=Get-EditSha256 $savedPath
    Write-EditReport

    Assert-PresentationNotOpen $app $savedPath 'reopen.preflight'
    $script:cleanupConfirmed=$false
    $script:ownedPresentationPath=$savedPath
    Write-EditReport
    $presentations=Invoke-EditCom 'reopen.presentations.get' { return ,$app.Presentations }
    $script:presentation=Invoke-EditCom 'reopen.presentation.open-readonly' { return ,$presentations.Open($savedPath,-1,0,-1) }
    $reopenedFullName=Invoke-EditCom 'reopen.presentation.fullName.get' { $script:presentation.FullName }
    if($reopenedFullName -ine $savedPath) { throw "Reopened presentation path does not match the exact saved path: $reopenedFullName" }
    $reopenedObservation=Read-PictureObservation $script:presentation 'reopened.observe' $expectedShapeCount $expectedPictureCount ($editMode -ne 'delete')
    $report.reopened.observation=$reopenedObservation
    Write-EditReport
    Assert-EditedObservation $reopenedObservation $editMode $request.expectations.$editMode
    $reopenedSlides=Invoke-EditCom 'reopened.export.slides.get' { return ,$script:presentation.Slides }
    $reopenedSlide=Invoke-EditCom 'reopened.export.slide-1.get' { return ,$reopenedSlides.Item(1) }
    Invoke-EditCom 'reopened.export.png' { $reopenedSlide.Export($reopenedPng,'PNG',1280,720) }
    $report.reopened.raster.sha256=Get-EditSha256 $reopenedPng
    Write-EditReport
    Close-OwnedPresentation 'reopened.presentation' $savedPath
    $report.reopened.sha256=Get-EditSha256 $savedPath

    $report.source.unchanged=((Get-EditSha256 $sourcePath) -ceq $sourceHash)
    $report.source.snapshotUnchanged=((Get-EditSha256 $officeSourcePath) -ceq $sourceHash)
    if(-not $report.source.unchanged -or -not $report.source.snapshotUnchanged) { throw 'The external input presentation or its snapshot changed during the native edit run' }
    if($editMode -eq 'replace') {
        $report.inputs.replacementImage.unchanged=((Get-EditSha256 $request.replacement.path) -ceq $request.replacement.sha256)
        $report.inputs.replacementImage.snapshotUnchanged=((Get-EditSha256 $replacementPath) -ceq $request.replacement.sha256)
        if(-not $report.inputs.replacementImage.unchanged -or -not $report.inputs.replacementImage.snapshotUnchanged) { throw 'The external replacement PNG or its snapshot changed during the native edit run' }
    }
    Write-EditStage 'worker.complete' 'success'
    Write-Output "Native picture edit completed: $editMode"
} catch {
    $report.error=$_.Exception.Message
    if($script:officeOperationsStopped) { $script:cleanupConfirmed=$false }
    Write-EditStage 'worker.failure' 'error' $_.Exception.Message
    throw
}
