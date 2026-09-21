param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [string]$InputPresentation='',
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker
)
$ErrorActionPreference='Stop'

function Get-ControlSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

if(-not $Worker) {
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    $mode='native-created'
    $requestedSource=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'fixtures/images/wide.png')).Path
    if($InputPresentation -ne '') {
        $requestedSource=(Resolve-Path -LiteralPath $InputPresentation).Path
        if([IO.Path]::GetExtension($requestedSource) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
        $mode='supplied-presentation'
    }
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'
    [void](New-Item -ItemType Directory -Path $snapshotRoot)
    $verifierSnapshot=Join-Path $snapshotRoot 'native-picture-control.ps1'
    $helperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path
    $helperSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $sourceSnapshot=Join-Path $snapshotRoot $(if($mode -eq 'native-created'){'wide.png'}else{'input.pptx'})
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $helperOriginal -Destination $helperSnapshot
    Copy-Item -LiteralPath $requestedSource -Destination $sourceSnapshot
    $request=[ordered]@{
        mode=$mode
        source=[ordered]@{path=$requestedSource;sha256=(Get-ControlSha256 $requestedSource);snapshotPath=$sourceSnapshot;snapshotSha256=(Get-ControlSha256 $sourceSnapshot)}
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-ControlSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-ControlSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$helperOriginal;sha256=(Get-ControlSha256 $helperOriginal);snapshotPath=$helperSnapshot;snapshotSha256=(Get-ControlSha256 $helperSnapshot)}
    }
    $request | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $arguments=@('-OutputDirectory',$outputRoot,'-Worker')
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
    if($result.timedOut -or $result.exitCode -ne 0) { throw 'Native picture control failed or timed out; preserve the entire attempt and inspect Office. No retry was started.' }
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$stageFile=Join-Path $root 'stages.jsonl'
$progressFile=Join-Path $root 'progress.json'
$reportFile=Join-Path $root 'report.json'
foreach($reserved in @($stageFile,$progressFile,$reportFile,(Join-Path $root 'original.png'),(Join-Path $root 'reopened.png'),(Join-Path $root 'native-picture-control.pptx'),(Join-Path $root 'input-picture-control.pptx'))) {
    if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' }
}

$script:sequence=0
$script:lastStage='worker.initialize'
$script:lastStatus='begin'
$script:cleanupConfirmed=$true
$script:officeOperationsStopped=$false
$script:ownedPresentationPath=$null
$script:presentation=$null
$script:originalObservation=$null
$script:reopenedObservation=$null
$requestFile=(Resolve-Path -LiteralPath (Join-Path $root 'request.json')).Path
$request=Get-Content -LiteralPath $requestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$mode=$request.mode
if($mode -ne 'native-created' -and $mode -ne 'supplied-presentation') { throw 'Snapshot request has an unsupported mode' }
$sourcePath=$request.source.path
$sourceHash=$request.source.sha256
$officeSourcePath=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path
$helperPath=(Resolve-Path -LiteralPath $request.processHelper.path).Path
$imagePath=$(if($mode -eq 'native-created'){$officeSourcePath}else{$null})
$savedPath=Join-Path $root $(if($mode -eq 'native-created'){'native-picture-control.pptx'}else{'input-picture-control.pptx'})
$originalPng=Join-Path $root 'original.png'
$reopenedPng=Join-Path $root 'reopened.png'
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
if((Get-ControlSha256 $PSCommandPath) -cne $request.verifier.sha256 -or (Get-ControlSha256 $request.verifier.snapshotPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }
if((Get-ControlSha256 $helperPath) -cne $request.processHelper.sha256 -or (Get-ControlSha256 $request.processHelper.snapshotPath) -cne $request.processHelper.sha256) { throw 'Process-helper snapshot does not match the loaded helper' }
if((Get-ControlSha256 $officeSourcePath) -cne $sourceHash) { throw 'Source snapshot hash does not match the requested source' }
$report=[ordered]@{
    schemaVersion=1
    mode=$mode
    source=[ordered]@{path=$sourcePath;sha256=$sourceHash;openedPath=$officeSourcePath;openedSha256=(Get-ControlSha256 $officeSourcePath)}
    saved=[ordered]@{path=$savedPath;sha256=$null}
    reopened=[ordered]@{path=$savedPath;sha256=$null;observation=$null;raster=[ordered]@{path=$reopenedPng;sha256=$null}}
    original=[ordered]@{observation=$null;raster=[ordered]@{path=$originalPng;sha256=$null}}
    inputs=[ordered]@{
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-ControlSha256 $PSCommandPath);snapshotPath=$request.verifier.snapshotPath;snapshotSha256=(Get-ControlSha256 $request.verifier.snapshotPath)}
        processHelper=[ordered]@{path=$helperPath;sha256=(Get-ControlSha256 $helperPath);snapshotPath=$request.processHelper.snapshotPath;snapshotSha256=(Get-ControlSha256 $request.processHelper.snapshotPath)}
        image=$(if($mode -eq 'native-created'){[ordered]@{path=$sourcePath;sha256=$sourceHash;snapshotPath=$officeSourcePath;snapshotSha256=(Get-ControlSha256 $officeSourcePath)}}else{$null})
        presentation=$(if($mode -eq 'supplied-presentation'){[ordered]@{path=$sourcePath;sha256=$sourceHash;snapshotPath=$officeSourcePath;snapshotSha256=(Get-ControlSha256 $officeSourcePath)}}else{$null})
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
    scope='One explicit native-created PNG picture control or one explicitly supplied PPTX. The worker never quits or kills Office, changes security, retries, or closes unrelated presentations.'
}

function Write-ControlReport {
    $report.cleanupConfirmed=$script:cleanupConfirmed
    $report.officeOperationsStopped=$script:officeOperationsStopped
    $report.lastStage=$script:lastStage
    $report.lastStatus=$script:lastStatus
    $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reportFile -Encoding UTF8
}

function Write-ControlStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
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
    Write-ControlReport
}

function Invoke-ControlCom([string]$Name,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-ControlStage $Name 'begin'
    try {
        $value=& $Operation
        Write-ControlStage $Name 'success'
        return ,$value
    } catch {
        $script:officeOperationsStopped=$true
        $script:cleanupConfirmed=$false
        Write-ControlStage $Name 'error' $_.Exception.Message
        throw
    }
}

function Assert-PresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-ControlCom "$Prefix.presentations.get" { return ,$Application.Presentations }
    $count=Invoke-ControlCom "$Prefix.presentations.count.get" { $presentations.Count }
    for($index=1;$index -le $count;$index++) {
        $candidate=Invoke-ControlCom "$Prefix.presentations.item-$index.get" { $presentations.Item($index) }
        $candidatePath=Invoke-ControlCom "$Prefix.presentations.item-$index.fullName.get" { $candidate.FullName }
        if($candidatePath -ieq $Path) { throw "Presentation is already open, so ownership cannot be established: $Path" }
    }
}

function Read-PictureObservation($Presentation,[string]$Phase) {
    $slides=Invoke-ControlCom "$Phase.slides.get" { return ,$Presentation.Slides }
    $slideCount=Invoke-ControlCom "$Phase.slides.count.get" { $slides.Count }
    if($slideCount -ne 1) { throw "Picture control must contain exactly one slide; observed $slideCount" }
    $slide=Invoke-ControlCom "$Phase.slides.item-1.get" { $slides.Item(1) }
    $shapes=Invoke-ControlCom "$Phase.slide-1.shapes.get" { return ,$slide.Shapes }
    $shapeCount=Invoke-ControlCom "$Phase.slide-1.shapes.count.get" { $shapes.Count }
    $pictures=@()
    $linkedPictureCount=0
    for($index=1;$index -le $shapeCount;$index++) {
        $shape=Invoke-ControlCom "$Phase.shape-$index.get" { $shapes.Item($index) }
        $type=Invoke-ControlCom "$Phase.shape-$index.type.get" { $shape.Type }
        if($type -eq 11 -or $type -eq 13) {
            if($type -eq 11) { $linkedPictureCount++ }
            $name=Invoke-ControlCom "$Phase.shape-$index.name.get" { $shape.Name }
            $alternativeText=Invoke-ControlCom "$Phase.shape-$index.alternativeText.get" { $shape.AlternativeText }
            $left=Invoke-ControlCom "$Phase.shape-$index.left.get" { $shape.Left }
            $top=Invoke-ControlCom "$Phase.shape-$index.top.get" { $shape.Top }
            $width=Invoke-ControlCom "$Phase.shape-$index.width.get" { $shape.Width }
            $height=Invoke-ControlCom "$Phase.shape-$index.height.get" { $shape.Height }
            $rotation=Invoke-ControlCom "$Phase.shape-$index.rotation.get" { $shape.Rotation }
            $lockAspectRatio=Invoke-ControlCom "$Phase.shape-$index.lockAspectRatio.get" { $shape.LockAspectRatio }
            $pictureFormat=Invoke-ControlCom "$Phase.shape-$index.pictureFormat.get" { $shape.PictureFormat }
            $cropLeft=Invoke-ControlCom "$Phase.shape-$index.cropLeft.get" { $pictureFormat.CropLeft }
            $cropTop=Invoke-ControlCom "$Phase.shape-$index.cropTop.get" { $pictureFormat.CropTop }
            $cropRight=Invoke-ControlCom "$Phase.shape-$index.cropRight.get" { $pictureFormat.CropRight }
            $cropBottom=Invoke-ControlCom "$Phase.shape-$index.cropBottom.get" { $pictureFormat.CropBottom }
            $pictures+=@([ordered]@{index=$index;name=$name;alternativeText=$alternativeText;type=$type;left=$left;top=$top;width=$width;height=$height;rotation=$rotation;lockAspectRatio=$lockAspectRatio;cropLeft=$cropLeft;cropTop=$cropTop;cropRight=$cropRight;cropBottom=$cropBottom})
        }
    }
    $pageSetup=Invoke-ControlCom "$Phase.pageSetup.get" { $Presentation.PageSetup }
    $slideWidth=Invoke-ControlCom "$Phase.slideWidth.get" { $pageSetup.SlideWidth }
    $slideHeight=Invoke-ControlCom "$Phase.slideHeight.get" { $pageSetup.SlideHeight }
    $observation=[ordered]@{slideCount=$slideCount;slideWidth=$slideWidth;slideHeight=$slideHeight;shapeCount=$shapeCount;pictureCount=$pictures.Count;linkedPictureCount=$linkedPictureCount;pictures=$pictures}
    if($shapeCount -ne 1 -or $pictures.Count -ne 1) { throw "Picture control must contain exactly one shape and one native picture; observed $shapeCount shape(s) and $($pictures.Count) picture(s)" }
    return $observation
}

function Close-OwnedPresentation([string]$Phase,[string]$ExpectedPath) {
    $actualPath=Invoke-ControlCom "$Phase.fullName.get" { $script:presentation.FullName }
    if($actualPath -ine $ExpectedPath) { throw "Refusing to close a presentation whose exact saved path is not owned: $actualPath" }
    Invoke-ControlCom "$Phase.close" { $script:presentation.Close() }
    $script:presentation=$null
    $script:ownedPresentationPath=$null
    $script:cleanupConfirmed=$true
    Write-ControlStage "$Phase.cleanup" 'success'
}

Write-ControlReport
Write-ControlStage 'worker.initialize' 'success'
try {
    $app=Invoke-ControlCom 'application.create' { New-Object -ComObject PowerPoint.Application }
    $officeVersion=Invoke-ControlCom 'application.version.get' { $app.Version }
    $officeDirectory=Invoke-ControlCom 'application.path.get' { $app.Path }
    $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $report.environment.powerPointVersion=$officeVersion
    $report.environment.powerPointExecutable=$officeExecutable
    $report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion
    $report.environment.powerPointExecutableSha256=Get-ControlSha256 $officeExecutable
    Write-ControlReport

    $originalCaptured=$false
    if($mode -eq 'native-created') {
        Assert-PresentationNotOpen $app $savedPath 'create.preflight'
        $script:cleanupConfirmed=$false
        $script:ownedPresentationPath=$savedPath
        Write-ControlReport
        $presentations=Invoke-ControlCom 'create.presentations.get' { return ,$app.Presentations }
        $script:presentation=Invoke-ControlCom 'create.presentation.add' { $presentations.Add(-1) }
        $pageSetup=Invoke-ControlCom 'create.pageSetup.get' { $script:presentation.PageSetup }
        Invoke-ControlCom 'create.slideWidth.set' { $pageSetup.SlideWidth=960 }
        Invoke-ControlCom 'create.slideHeight.set' { $pageSetup.SlideHeight=540 }
        $slides=Invoke-ControlCom 'create.slides.get' { return ,$script:presentation.Slides }
        $slide=Invoke-ControlCom 'create.blankSlide.add' { $slides.Add(1,12) }
        $shapes=Invoke-ControlCom 'create.blankSlide.shapes.get' { return ,$slide.Shapes }
        $picture=Invoke-ControlCom 'create.picture.add' { $shapes.AddPicture($imagePath,0,-1,180,120,600,300) }
        Invoke-ControlCom 'create.picture.name.set' { $picture.Name='native-picture-control' }
        Invoke-ControlCom 'create.picture.alternativeText.set' { $picture.AlternativeText='Four quadrants and a circle' }
        Invoke-ControlCom 'create.presentation.saveAs' { $script:presentation.SaveAs($savedPath,24) }
    } else {
        Assert-PresentationNotOpen $app $officeSourcePath 'input.preflight'
        Assert-PresentationNotOpen $app $savedPath 'input-output.preflight'
        $script:cleanupConfirmed=$false
        $script:ownedPresentationPath=$officeSourcePath
        Write-ControlReport
        $presentations=Invoke-ControlCom 'input.presentations.get' { return ,$app.Presentations }
        $script:presentation=Invoke-ControlCom 'input.presentation.open' { $presentations.Open($officeSourcePath,0,0,-1) }
        $script:originalObservation=Read-PictureObservation $script:presentation 'original.observe'
        $report.original.observation=$script:originalObservation
        Write-ControlReport
        $originalSlides=Invoke-ControlCom 'original.export.slides.get' { return ,$script:presentation.Slides }
        $originalSlide=Invoke-ControlCom 'original.export.slide-1.get' { $originalSlides.Item(1) }
        Invoke-ControlCom 'original.export.png' { $originalSlide.Export($originalPng,'PNG',1280,720) }
        $report.original.raster.sha256=Get-ControlSha256 $originalPng
        $originalCaptured=$true
        Write-ControlReport
        Invoke-ControlCom 'input.presentation.saveAs-owned-copy' { $script:presentation.SaveAs($savedPath,24) }
        $script:ownedPresentationPath=$savedPath
        Write-ControlReport
    }

    if(-not $originalCaptured) {
        $script:originalObservation=Read-PictureObservation $script:presentation 'original.observe'
        $report.original.observation=$script:originalObservation
        Write-ControlReport
        $originalSlides=Invoke-ControlCom 'original.export.slides.get' { return ,$script:presentation.Slides }
        $originalSlide=Invoke-ControlCom 'original.export.slide-1.get' { $originalSlides.Item(1) }
        Invoke-ControlCom 'original.export.png' { $originalSlide.Export($originalPng,'PNG',1280,720) }
        $report.original.raster.sha256=Get-ControlSha256 $originalPng
        Write-ControlReport
    }
    Close-OwnedPresentation 'original.presentation' $savedPath

    $report.saved.sha256=Get-ControlSha256 $savedPath
    if($mode -eq 'supplied-presentation') {
        $currentSourceHash=Get-ControlSha256 $sourcePath
        if($currentSourceHash -cne $sourceHash) { throw 'The supplied source presentation changed during the control run' }
        if((Get-ControlSha256 $officeSourcePath) -cne $sourceHash) { throw 'The supplied source snapshot changed during the control run' }
    }
    Write-ControlReport

    Assert-PresentationNotOpen $app $savedPath 'reopen.preflight'
    $script:cleanupConfirmed=$false
    $script:ownedPresentationPath=$savedPath
    Write-ControlReport
    $presentations=Invoke-ControlCom 'reopen.presentations.get' { return ,$app.Presentations }
    $script:presentation=Invoke-ControlCom 'reopen.presentation.open' { $presentations.Open($savedPath,-1,0,-1) }
    $reopenedFullName=Invoke-ControlCom 'reopen.presentation.fullName.get' { $script:presentation.FullName }
    if($reopenedFullName -ine $savedPath) { throw "Reopened presentation path does not match the exact saved path: $reopenedFullName" }
    $script:reopenedObservation=Read-PictureObservation $script:presentation 'reopened.observe'
    $report.reopened.observation=$script:reopenedObservation
    Write-ControlReport
    $reopenedSlides=Invoke-ControlCom 'reopened.export.slides.get' { return ,$script:presentation.Slides }
    $reopenedSlide=Invoke-ControlCom 'reopened.export.slide-1.get' { $reopenedSlides.Item(1) }
    Invoke-ControlCom 'reopened.export.png' { $reopenedSlide.Export($reopenedPng,'PNG',1280,720) }
    $report.reopened.raster.sha256=Get-ControlSha256 $reopenedPng
    Write-ControlReport
    Close-OwnedPresentation 'reopened.presentation' $savedPath
    $report.reopened.sha256=Get-ControlSha256 $savedPath
    Write-ControlStage 'worker.complete' 'success'
    Write-Output "Native picture control completed: $mode"
} catch {
    $report.error=$_.Exception.Message
    if($script:officeOperationsStopped) {
        $script:cleanupConfirmed=$false
    }
    Write-ControlStage 'worker.failure' 'error' $_.Exception.Message
    throw
}
