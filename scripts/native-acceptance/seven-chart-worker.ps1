param(
    [Parameter(Mandatory=$true)][string]$ExecutionEnvelope,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45
)
$ErrorActionPreference='Stop'
# Independent seven-case worker; the original ce92 worker is never loaded.
function Get-SevenHash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Write-SevenReport { $script:report | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath (Join-Path $script:root 'report.json') -Encoding UTF8 }
function Write-SevenStage([string]$Name,[string]$Status,$Value=$null,[string]$ErrorMessage=$null) {
    $script:sequence++;$script:report.lastStage=$Name;$script:report.lastStatus=$Status
    $primitive=$null;if($null -eq $Value -or $Value -is [string] -or $Value -is [ValueType]) {$primitive=$Value}
    [ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$Name;status=$Status;value=$primitive;error=$ErrorMessage;officeOperationsStopped=$script:stopped;cleanupConfirmed=$script:cleanup} | ConvertTo-Json -Compress -Depth 8 | Add-Content -LiteralPath (Join-Path $script:root 'stages.jsonl') -Encoding UTF8
    Write-SevenReport
}
function Stop-SevenLifecycle([string]$Message) { $script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;throw $Message }
function Assert-SevenProbe([bool]$Condition,[string]$Stage,$Expected,$Actual) {
    # Persist actual and expected before a refusal can abort the remaining phase.
    $script:report.probes+=@([ordered]@{stage=$Stage;expected=$Expected;actual=$Actual;matched=$Condition})
    Write-SevenReport
    if(-not $Condition) { Stop-SevenLifecycle "$Stage differs; expected/actual retained in report and stage journal" }
}
function Invoke-SevenCom([string]$Stage,[scriptblock]$Operation) {
    if($script:stopped) { throw 'Seven Office operations stopped; no later COM is permitted' }
    Write-SevenStage $Stage 'begin'
    try {$value=& $Operation;Write-SevenStage $Stage 'success' $value;return ,$value}
    catch {$script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;Write-SevenStage $Stage 'error' $null $_.Exception.Message;throw}
}
function Read-SevenProperty($Object,[string]$Property,[string]$Stage) {
    return ,(Invoke-SevenCom $Stage {if($null -eq $Object) {throw 'Missing owned object'};$member=$Object.PSObject.Properties[$Property];if($null -eq $member) {throw "Missing reviewed property $Property"};return ,$member.get_Value()})
}
function Assert-SevenOfficeIdle { if(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) {Stop-SevenLifecycle 'PowerPoint already running; refuse attachment'} }
function New-SevenApplication { return Invoke-SevenCom 'application.create' {New-Object -ComObject PowerPoint.Application} }
function Read-SevenPresentations([string]$Stage) { return ,(Read-SevenProperty $script:app 'Presentations' "$Stage.presentations") }
function Own-SevenApplication($Application) {
    $script:app=$Application;$presentations=Read-SevenPresentations 'application.initial';$count=Read-SevenProperty $presentations 'Count' 'application.initial.count'
    Assert-SevenProbe (($count -is [int] -or $count -is [long]) -and $count -eq 0) 'application.initial.count' 0 $count
    $script:ownedApp=$Application
    $version=Read-SevenProperty $Application 'Version' 'application.version';Assert-SevenProbe ($version -is [string] -and -not [string]::IsNullOrEmpty($version)) 'application.version' 'nonempty string' $version
    $directory=Read-SevenProperty $Application 'Path' 'application.path';Assert-SevenProbe ($directory -is [string] -and -not [string]::IsNullOrEmpty($directory)) 'application.path' 'nonempty string' $directory
    $executable=Join-Path $directory 'POWERPNT.EXE';$file=Get-Item -LiteralPath $executable -Force
    if($file.PSIsContainer) {Stop-SevenLifecycle 'PowerPoint executable metadata is not one file'}
    $build=$file.VersionInfo.FileVersion;if([string]::IsNullOrEmpty($build)) {$build=$null};$windowsBuild=$null
    $os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue
    if($null -ne $os -and $os.CurrentBuild -match '^\d+$' -and ($os.UBR -is [int] -or $os.UBR -is [long])) {$windowsBuild="$($os.CurrentBuild).$($os.UBR)"}
    $script:report.environment=[ordered]@{powerPointVersion=$version;executablePath=$executable;executableSha256=(Get-SevenHash $executable);executableVersion=$build;windowsBuild=$windowsBuild;hostVersion=$PSVersionTable.PSVersion.ToString()};Write-SevenReport
}
function Open-SevenOwned([string]$Path,[string]$Phase) {
    Assert-SevenProbe ([object]::ReferenceEquals($script:app,$script:ownedApp) -and $null -eq $script:presentation) "$Phase.applicationOwnership" 'one verified owned empty application' ($null -ne $script:ownedApp)
    $presentations=Read-SevenPresentations "$Phase.preflight";$count=Read-SevenProperty $presentations 'Count' "$Phase.preflight.count";Assert-SevenProbe ($count -eq 0) "$Phase.preflight.count" 0 $count
    Assert-SevenProbe ((Get-SevenHash $Path) -ceq $script:hashes[$Path]) "$Phase.inputHash" $script:hashes[$Path] (Get-SevenHash $Path)
    $script:cleanup=$false;$script:report.cleanupConfirmed=$false;$script:ownedPath=$Path
    $script:presentation=Invoke-SevenCom "$Phase.open" {$presentations.Open($Path,-1,0,0)}
    $actual=Read-SevenProperty $script:presentation 'FullName' "$Phase.fullName";Assert-SevenProbe ([string]::Equals($actual,$Path,[StringComparison]::OrdinalIgnoreCase)) "$Phase.fullName" $Path $actual
    $readonly=Read-SevenProperty $script:presentation 'ReadOnly' "$Phase.readOnly";Assert-SevenProbe ($readonly -eq -1) "$Phase.readOnly" -1 $readonly
    $script:report.opens+=@([ordered]@{phase=$Phase;path=$actual;readOnly=$readonly;sha256=(Get-SevenHash $Path)});Write-SevenReport
}
function Read-SevenPhase([string]$Phase) {
    $current=[ordered]@{slideCount=$null;slides=@();rasters=@()};$script:report.phases[$Phase]=$current;Write-SevenReport
    $slides=Read-SevenProperty $script:presentation 'Slides' "$Phase.slides";$count=Read-SevenProperty $slides 'Count' "$Phase.slides.count";$current.slideCount=$count;Write-SevenReport
    Assert-SevenProbe ($count -eq 7) "$Phase.slides.count" 7 $count
    $total=0
    for($index=1;$index -le 7;$index++) {
        $slide=Invoke-SevenCom "$Phase.slide.$index.get" {$slides.Item($index)}
        $record=[ordered]@{index=$index;slideId=$null;name=$null;shapeCount=$null;shapes=@()};$current.slides+=@($record);Write-SevenReport
        $record.slideId=Read-SevenProperty $slide 'SlideID' "$Phase.slide.$index.id";$record.name=Read-SevenProperty $slide 'Name' "$Phase.slide.$index.name";Write-SevenReport
        Assert-SevenProbe (($record.slideId -is [int] -or $record.slideId -is [long]) -and $record.slideId -gt 0) "$Phase.slide.$index.id" 'positive integer' $record.slideId
        Assert-SevenProbe ($record.name -is [string]) "$Phase.slide.$index.name" 'string' $record.name
        $shapes=Read-SevenProperty $slide 'Shapes' "$Phase.slide.$index.shapes";$shapeCount=Read-SevenProperty $shapes 'Count' "$Phase.slide.$index.shapes.count";$record.shapeCount=$shapeCount;Write-SevenReport
        Assert-SevenProbe (($shapeCount -is [int] -or $shapeCount -is [long]) -and $shapeCount -ge 1 -and $shapeCount -le 3) "$Phase.slide.$index.shapes.count" '1..3; exact source binding follows offline' $shapeCount
        $total+=$shapeCount;Assert-SevenProbe ($total -le 20) "$Phase.totalShapes" '<=20' $total
        for($position=1;$position -le $shapeCount;$position++) {
            $shape=Invoke-SevenCom "$Phase.slide.$index.shape.$position.get" {$shapes.Item($position)};$item=[ordered]@{index=$position};$record.shapes+=@($item);Write-SevenReport
            foreach($pair in @(@('Id','id'),@('Name','name'),@('Type','type'),@('Left','left'),@('Top','top'),@('Width','width'),@('Height','height'),@('Rotation','rotation'),@('HasTextFrame','hasTextFrame'),@('AlternativeText','alternativeText'))) {
                $value=Read-SevenProperty $shape $pair[0] "$Phase.slide.$index.shape.$position.$($pair[1])";$item[$pair[1]]=$value;Write-SevenReport
                if($pair[1] -in @('name','alternativeText')) {Assert-SevenProbe ($value -is [string]) "$Phase.slide.$index.shape.$position.$($pair[1])" 'string' $value}
                else {Assert-SevenProbe (($value -is [ValueType]) -and -not ($value -is [bool]) -and -not [double]::IsNaN([double]$value) -and -not [double]::IsInfinity([double]$value)) "$Phase.slide.$index.shape.$position.$($pair[1])" 'finite numeric descriptor' $value}
            }
            Assert-SevenProbe ($item.hasTextFrame -in @(-1,0)) "$Phase.slide.$index.shape.$position.hasTextFrame" '0 or-1' $item.hasTextFrame
            $item.text=$null
            if($item.hasTextFrame -eq -1) {$frame=Read-SevenProperty $shape 'TextFrame' "$Phase.slide.$index.shape.$position.textFrame";$range=Read-SevenProperty $frame 'TextRange' "$Phase.slide.$index.shape.$position.textRange";$item.text=Read-SevenProperty $range 'Text' "$Phase.slide.$index.shape.$position.text";Write-SevenReport;Assert-SevenProbe ($item.text -is [string]) "$Phase.slide.$index.shape.$position.text" 'string' $item.text}
            Write-SevenReport
        }
        $png=Join-Path $script:root "$Phase-$('{0:D2}' -f $index).png";Assert-SevenProbe (-not (Test-Path -LiteralPath $png)) "$Phase.slide.$index.pngFresh" $false (Test-Path -LiteralPath $png)
        Invoke-SevenCom "$Phase.slide.$index.export" {$slide.Export($png,'PNG',1280,720)}
        $current.rasters+=@([ordered]@{slideIndex=$index;path=$png;sha256=(Get-SevenHash $png)});Write-SevenReport
    }
}
function Save-SevenCopy {
    Assert-SevenProbe ($script:savedPath -ine $script:sourcePath -and -not (Test-Path -LiteralPath $script:savedPath)) 'copy.fresh' 'fresh derivative' $script:savedPath
    $actual=Read-SevenProperty $script:presentation 'FullName' 'copy.fullName';Assert-SevenProbe ($actual -ieq $script:ownedPath -and $actual -ieq $script:sourcePath) 'copy.ownership' $script:sourcePath $actual
    Invoke-SevenCom 'copy.saveCopyAs' {$script:presentation.SaveCopyAs($script:savedPath,24)};$script:report.saveCopies++
    $after=Read-SevenProperty $script:presentation 'FullName' 'copy.afterName';Assert-SevenProbe ($after -ieq $script:sourcePath) 'copy.afterName' $script:sourcePath $after
    $script:hashes[$script:savedPath]=Get-SevenHash $script:savedPath;$script:report.savedSha256=$script:hashes[$script:savedPath];Write-SevenReport
}
function Close-SevenOwned([string]$Expected,[string]$Phase) {
    $actual=Read-SevenProperty $script:presentation 'FullName' "$Phase.close.fullName";Assert-SevenProbe ($actual -ieq $Expected -and $script:ownedPath -ieq $Expected) "$Phase.close.ownership" $Expected $actual
    Invoke-SevenCom "$Phase.close.discard" {$script:presentation.Saved=-1}
    Invoke-SevenCom "$Phase.close" {$script:presentation.Close()};$script:presentation=$null;$script:ownedPath=$null;$script:report.closes++;Write-SevenReport
}
function Quit-SevenOwned {
    Assert-SevenProbe ([object]::ReferenceEquals($script:app,$script:ownedApp)) 'quit.ownership' 'verified owned application' ($null -ne $script:ownedApp)
    $presentations=Read-SevenPresentations 'application.final';$count=Read-SevenProperty $presentations 'Count' 'application.final.count';Assert-SevenProbe ($count -eq 0) 'application.final.count' 0 $count
    Invoke-SevenCom 'application.quit' {$script:app.Quit()};$script:app=$null;$script:ownedApp=$null;$script:cleanup=$true;$script:report.cleanupConfirmed=$true;$script:report.quits++;Write-SevenReport
}
function Invoke-SevenLifecycle {
    Assert-SevenOfficeIdle
    $application=New-SevenApplication;Own-SevenApplication $application
    Open-SevenOwned $script:sourcePath 'original';Read-SevenPhase 'original';Save-SevenCopy;Close-SevenOwned $script:sourcePath 'original'
    Open-SevenOwned $script:savedPath 'saved-reopened';Read-SevenPhase 'saved-reopened';Close-SevenOwned $script:savedPath 'saved-reopened'
    Assert-SevenProbe ((Get-SevenHash $script:sourcePath) -ceq $script:report.sourceSha256) 'source.unchanged' $script:report.sourceSha256 (Get-SevenHash $script:sourcePath)
    Quit-SevenOwned
}
