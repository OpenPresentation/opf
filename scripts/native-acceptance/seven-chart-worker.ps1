param(
    [Parameter(Mandatory=$true)][string]$ExecutionEnvelope,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker
)
$ErrorActionPreference='Stop'
# Independent seven-case worker; the original ce92 worker is never loaded.
function Get-SevenHash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
# Only script-owned records and primitives may enter JSON. Never reflect an unexpected Office/managed object.
function Test-SevenInteger($Value) { return ($Value -is [int] -or $Value -is [long]) }
function Test-SevenFiniteNumber($Value) {
    if(-not ($Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [single] -or $Value -is [decimal] -or $Value -is [System.Int16] -or $Value -is [byte])) { return $false }
    return (-not [double]::IsNaN([double]$Value) -and -not [double]::IsInfinity([double]$Value))
}
function Get-SevenPrimitive($Value) {
    if($null -eq $Value -or $Value -is [string] -or $Value -is [bool]) { return ,$Value }
    if(Test-SevenFiniteNumber $Value) { return ,$Value }
    if($Value -is [double] -or $Value -is [single]) {
        if([double]::IsNaN([double]$Value)) { return '[nonfinite number: NaN]' }
        return '[nonfinite number: Infinity]'
    }
    return '[unsupported non-primitive value]'
}
function Write-SevenReport { $script:report | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath (Join-Path $script:root 'report.json') -Encoding UTF8 }
function Write-SevenStage([string]$Name,[string]$Status,$Value=$null,[string]$ErrorMessage=$null) {
    $script:sequence++;$script:report.lastStage=$Name;$script:report.lastStatus=$Status
    $primitive=Get-SevenPrimitive $Value
    [ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$Name;status=$Status;value=$primitive;error=$ErrorMessage;officeOperationsStopped=$script:stopped;cleanupConfirmed=$script:cleanup} | ConvertTo-Json -Compress -Depth 8 | Add-Content -LiteralPath (Join-Path $script:root 'stages.jsonl') -Encoding UTF8
    Write-SevenReport
}
function Stop-SevenLifecycle([string]$Message) { $script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;throw $Message }
function Assert-SevenProbe([bool]$Condition,[string]$Stage,$Expected,$Actual) {
    # Persist actual and expected before a refusal can abort the remaining phase.
    $script:report.probes+=@([ordered]@{stage=$Stage;expected=(Get-SevenPrimitive $Expected);actual=(Get-SevenPrimitive $Actual);matched=$Condition})
    Write-SevenReport
    if(-not $Condition) { Stop-SevenLifecycle "$Stage differs; expected/actual retained in report and stage journal" }
}
function Invoke-SevenCom([string]$Stage,[scriptblock]$Operation) {
    if($script:stopped) { throw 'Seven Office operations stopped; no later COM is permitted' }
    try {Write-SevenStage $Stage 'begin';$value=& $Operation;Write-SevenStage $Stage 'success' $value;return ,$value}
    catch {$script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;Write-SevenStage $Stage 'error' $null $_.Exception.Message;throw}
}
function Read-SevenProperty($Object,[string]$Property,[string]$Stage) {
    if($Property -cnotin @('Presentations','Count','Version','Path','FullName','ReadOnly','Slides','SlideID','Name','Shapes','Id','Type','Left','Top','Width','Height','Rotation','HasTextFrame','AlternativeText','TextFrame','TextRange','Text')) { Stop-SevenLifecycle 'Property is outside the reviewed seven descriptor allowlist' }
    return ,(Invoke-SevenCom $Stage {if($null -eq $Object) {throw 'Missing owned object'};$member=$Object.PSObject.Properties[$Property];if($null -eq $member) {throw "Missing reviewed property $Property"};return ,$member.get_Value()})
}
function Assert-SevenOwnedPresentation([string]$Stage) {
    $owned=($null -ne $script:app -and $null -ne $script:ownedApp -and $null -ne $script:presentation -and [object]::ReferenceEquals($script:presentation,$script:ownedPresentation) -and [object]::ReferenceEquals($script:app,$script:ownedApp) -and -not [string]::IsNullOrEmpty($script:ownedPath))
    Assert-SevenProbe $owned $Stage 'same verified owned application/presentation references' $owned
}
function Assert-SevenOfficeIdle { if(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) {Stop-SevenLifecycle 'PowerPoint already running; refuse attachment'} }
function New-SevenApplication { $script:cleanup=$false;$script:report.cleanupConfirmed=$false;return Invoke-SevenCom 'application.create' {New-Object -ComObject PowerPoint.Application} }
function Read-SevenPresentations([string]$Stage) { return ,(Read-SevenProperty $script:app 'Presentations' "$Stage.presentations") }
function Own-SevenApplication($Application) {
    $script:app=$Application;$presentations=Read-SevenPresentations 'application.initial';$count=Read-SevenProperty $presentations 'Count' 'application.initial.count'
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 0) 'application.initial.count' 0 $count
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
    Assert-SevenProbe ($null -ne $script:app -and $null -ne $script:ownedApp -and [object]::ReferenceEquals($script:app,$script:ownedApp) -and $null -eq $script:presentation -and $null -eq $script:ownedPresentation) "$Phase.applicationOwnership" 'one verified owned empty application' ($null -ne $script:ownedApp)
    $presentations=Read-SevenPresentations "$Phase.preflight";$count=Read-SevenProperty $presentations 'Count' "$Phase.preflight.count";Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 0) "$Phase.preflight.count" 0 $count
    Assert-SevenProbe ((Get-SevenHash $Path) -ceq $script:hashes[$Path]) "$Phase.inputHash" $script:hashes[$Path] (Get-SevenHash $Path)
    $script:cleanup=$false;$script:report.cleanupConfirmed=$false;$script:ownedPath=$Path
    $script:presentation=Invoke-SevenCom "$Phase.open" {$presentations.Open($Path,-1,0,0)}
    $actual=Read-SevenProperty $script:presentation 'FullName' "$Phase.fullName";Assert-SevenProbe ($actual -is [string] -and [string]::Equals($actual,$Path,[StringComparison]::OrdinalIgnoreCase)) "$Phase.fullName" $Path $actual
    $readonly=Read-SevenProperty $script:presentation 'ReadOnly' "$Phase.readOnly";Assert-SevenProbe ((Test-SevenInteger $readonly) -and $readonly -eq -1) "$Phase.readOnly" -1 $readonly
    $script:ownedPresentation=$script:presentation
    $script:report.opens+=@([ordered]@{phase=$Phase;path=$actual;readOnly=$readonly;sha256=(Get-SevenHash $Path)});Write-SevenReport
}
function Read-SevenPhase([string]$Phase) {
    Assert-SevenOwnedPresentation "$Phase.read.ownership"
    $current=[ordered]@{slideCount=$null;slides=@();rasters=@()};$script:report.phases[$Phase]=$current;Write-SevenReport
    $slides=Read-SevenProperty $script:presentation 'Slides' "$Phase.slides";$count=Read-SevenProperty $slides 'Count' "$Phase.slides.count";$current.slideCount=Get-SevenPrimitive $count;Write-SevenReport
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 7) "$Phase.slides.count" 7 $count
    $total=0
    for($index=1;$index -le 7;$index++) {
        $slide=Invoke-SevenCom "$Phase.slide.$index.get" {$slides.Item($index)}
        $record=[ordered]@{index=$index;slideId=$null;name=$null;shapeCount=$null;shapes=@()};$current.slides+=@($record);Write-SevenReport
        $slideId=Read-SevenProperty $slide 'SlideID' "$Phase.slide.$index.id";$record.slideId=Get-SevenPrimitive $slideId;Write-SevenReport
        Assert-SevenProbe ((Test-SevenInteger $slideId) -and $slideId -gt 0) "$Phase.slide.$index.id" 'positive integer' $slideId
        $slideName=Read-SevenProperty $slide 'Name' "$Phase.slide.$index.name";$record.name=Get-SevenPrimitive $slideName;Write-SevenReport
        Assert-SevenProbe ($slideName -is [string]) "$Phase.slide.$index.name" 'string' $record.name
        $shapes=Read-SevenProperty $slide 'Shapes' "$Phase.slide.$index.shapes";$shapeCount=Read-SevenProperty $shapes 'Count' "$Phase.slide.$index.shapes.count";$record.shapeCount=Get-SevenPrimitive $shapeCount;Write-SevenReport
        Assert-SevenProbe ((Test-SevenInteger $shapeCount) -and $shapeCount -ge 1 -and $shapeCount -le 3) "$Phase.slide.$index.shapes.count" '1..3; exact source binding follows offline' $shapeCount
        $total+=$shapeCount;Assert-SevenProbe ($total -le 20) "$Phase.totalShapes" '<=20' $total
        for($position=1;$position -le $shapeCount;$position++) {
            $shape=Invoke-SevenCom "$Phase.slide.$index.shape.$position.get" {$shapes.Item($position)};$item=[ordered]@{index=$position};$record.shapes+=@($item);Write-SevenReport
            foreach($pair in @(@('Id','id'),@('Name','name'),@('Type','type'),@('Left','left'),@('Top','top'),@('Width','width'),@('Height','height'),@('Rotation','rotation'),@('HasTextFrame','hasTextFrame'),@('AlternativeText','alternativeText'))) {
                $value=Read-SevenProperty $shape $pair[0] "$Phase.slide.$index.shape.$position.$($pair[1])";$item[$pair[1]]=Get-SevenPrimitive $value;Write-SevenReport
                if($pair[1] -in @('name','alternativeText')) {Assert-SevenProbe ($value -is [string]) "$Phase.slide.$index.shape.$position.$($pair[1])" 'string' $value}
                elseif($pair[1] -in @('id','type','hasTextFrame')) {Assert-SevenProbe ((Test-SevenInteger $value) -and ($pair[1] -eq 'hasTextFrame' -or $value -gt 0)) "$Phase.slide.$index.shape.$position.$($pair[1])" 'integer identity/type or tri-state' $value}
                else {Assert-SevenProbe (Test-SevenFiniteNumber $value) "$Phase.slide.$index.shape.$position.$($pair[1])" 'finite numeric descriptor' $value}
            }
            Assert-SevenProbe ($item.hasTextFrame -in @(-1,0)) "$Phase.slide.$index.shape.$position.hasTextFrame" '0 or-1' $item.hasTextFrame
            $item.text=$null
            if($item.hasTextFrame -eq -1) {$frame=Read-SevenProperty $shape 'TextFrame' "$Phase.slide.$index.shape.$position.textFrame";$range=Read-SevenProperty $frame 'TextRange' "$Phase.slide.$index.shape.$position.textRange";$actualText=Read-SevenProperty $range 'Text' "$Phase.slide.$index.shape.$position.text";$item.text=Get-SevenPrimitive $actualText;Write-SevenReport;Assert-SevenProbe ($actualText -is [string]) "$Phase.slide.$index.shape.$position.text" 'string' $item.text}
            Write-SevenReport
        }
        $png=Join-Path $script:root "$Phase-$('{0:D2}' -f $index).png";Assert-SevenProbe (-not (Test-Path -LiteralPath $png)) "$Phase.slide.$index.pngFresh" $false (Test-Path -LiteralPath $png)
        Invoke-SevenCom "$Phase.slide.$index.export" {$slide.Export($png,'PNG',1280,720)}
        $current.rasters+=@([ordered]@{slideIndex=$index;path=$png;sha256=(Get-SevenHash $png)});Write-SevenReport
    }
}
function Save-SevenCopy {
    Assert-SevenOwnedPresentation 'copy.referenceOwnership'
    Assert-SevenProbe ($script:savedPath -ine $script:sourcePath -and -not (Test-Path -LiteralPath $script:savedPath)) 'copy.fresh' 'fresh derivative' $script:savedPath
    $actual=Read-SevenProperty $script:presentation 'FullName' 'copy.fullName';Assert-SevenProbe ($actual -is [string] -and $actual -ieq $script:ownedPath -and $actual -ieq $script:sourcePath) 'copy.ownership' $script:sourcePath $actual
    Invoke-SevenCom 'copy.saveCopyAs' {$script:presentation.SaveCopyAs($script:savedPath,24)};$script:report.saveCopies++
    $after=Read-SevenProperty $script:presentation 'FullName' 'copy.afterName';Assert-SevenProbe ($after -is [string] -and $after -ieq $script:sourcePath) 'copy.afterName' $script:sourcePath $after
    $script:hashes[$script:savedPath]=Get-SevenHash $script:savedPath;$script:report.savedSha256=$script:hashes[$script:savedPath];Write-SevenReport
}
function Close-SevenOwned([string]$Expected,[string]$Phase) {
    Assert-SevenOwnedPresentation "$Phase.close.referenceOwnership"
    $actual=Read-SevenProperty $script:presentation 'FullName' "$Phase.close.fullName";Assert-SevenProbe ($actual -is [string] -and $actual -ieq $Expected -and $script:ownedPath -ieq $Expected) "$Phase.close.ownership" $Expected $actual
    Invoke-SevenCom "$Phase.close.discard" {$script:presentation.Saved=-1}
    Invoke-SevenCom "$Phase.close" {$script:presentation.Close()};$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null;$script:report.closes++;Write-SevenReport
}
function Quit-SevenOwned {
    Assert-SevenProbe ($null -ne $script:app -and $null -ne $script:ownedApp -and [object]::ReferenceEquals($script:app,$script:ownedApp)) 'quit.ownership' 'verified owned application' ($null -ne $script:ownedApp)
    Assert-SevenProbe ($null -eq $script:presentation -and $null -eq $script:ownedPresentation) 'quit.presentationOwnership' 'no owned presentation remains' ($null -ne $script:presentation)
    $presentations=Read-SevenPresentations 'application.final';$count=Read-SevenProperty $presentations 'Count' 'application.final.count';Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 0) 'application.final.count' 0 $count
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


# Executable bootstrap is default-deny. No COM in setup or failure cleanup.
if(-not $Worker) { throw 'Seven worker is private to the explicitly authorized, bound controller' }
$workerFile=[IO.Path]::GetFullPath($PSCommandPath)
$envelopeFile=[IO.Path]::GetFullPath($ExecutionEnvelope)
foreach($p in @($workerFile,$envelopeFile)) {
    if($p.StartsWith('\') -or $p -match '[\x00-\x1f]') { throw 'Seven worker requires local paths' }
    $cursor=$p
    while($cursor) { $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Seven worker refuses aliased paths' };$parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent }
}
$envelopeItem=Get-Item -LiteralPath $envelopeFile -Force
if($envelopeItem.PSIsContainer -or $envelopeItem.Length -gt 4194304 -or (Get-SevenHash $envelopeFile) -cne $ExpectedEnvelopeSha256) { throw 'External seven envelope digest/size differs before code loading' }
$profile=Get-Content -LiteralPath $envelopeFile -Raw -Encoding UTF8 | ConvertFrom-Json
$wrapper=Join-Path $profile.controllerRepository.directory 'scripts/native-acceptance/run-seven-chart-profile.ps1'
$cursor=[IO.Path]::GetFullPath($wrapper)
if($cursor.StartsWith('\') -or $cursor -match '[\x00-\x1f]') { throw 'Seven bootstrap wrapper must be local' }
while($cursor) { $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Seven bootstrap wrapper is aliased' };$parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent }
$wrapperRecord=@($profile.controllerRepository.files | Where-Object {$_.path -ceq 'scripts/native-acceptance/run-seven-chart-profile.ps1'})
if($wrapperRecord.Count -ne 1 -or (Get-Item -LiteralPath $wrapper -Force).Length -ne $wrapperRecord[0].bytes -or (Get-SevenHash $wrapper) -cne $wrapperRecord[0].sha256) { throw 'Bound seven bootstrap code differs' }
$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($wrapper,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw 'Bound seven bootstrap has parser errors' }
foreach($name in @('Assert-SevenBootstrapPath','Read-SevenBootstrapEnvelope','Assert-SevenBootstrapNode','Assert-SevenBootstrapController')) {
    $found=@($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($found.Count -ne 1) { throw 'Missing/duplicate reviewed bootstrap definition' }
    Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
}
$profile=Read-SevenBootstrapEnvelope $envelopeFile $ExpectedEnvelopeSha256
Assert-SevenBootstrapNode $NodeExecutable $profile.node
Assert-SevenBootstrapController $profile.controllerRepository.directory $profile.controllerRepository
$root=Assert-SevenBootstrapPath $OutputDirectory
$execution=Split-Path -Parent $root
if((Split-Path -Leaf $root) -cne 'native' -or (Get-Item -LiteralPath $root -Force).PSIsContainer -ne $true) { throw 'Seven worker requires its owned native output' }
# The unchanged supervisor creates these logs/receipt before starting its owned worker.
# No report, stages, derivative or raster may already exist; do not confuse kernel logs with stale native evidence.
$kernelNames=@('worker.stdout.log','worker.stderr.log','worker.json')
foreach($item in @(Get-ChildItem -LiteralPath $root -Force)) {
    if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Name -cnotin $kernelNames) { throw 'Seven worker output contains pre-existing native evidence' }
}
if($envelopeFile -ine (Join-Path $execution 'execution-envelope.json') -or $workerFile -ine (Join-Path $execution 'inputs/seven-chart-worker.ps1')) { throw 'Seven worker is not the owned execution snapshot' }
$validator=Join-Path $profile.controllerRepository.directory 'scripts/native-acceptance/seven-chart-profile.mjs'
$checked=& $NodeExecutable $validator verify-execution --envelope $envelopeFile --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true
if($LASTEXITCODE -ne 0) { throw 'Seven worker authorization failed before Office' }
$binding=($checked | Out-String) | ConvertFrom-Json
$runner=Get-Content -LiteralPath (Join-Path $execution 'runner.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($runner.timeoutSeconds -ne $TimeoutSeconds) { throw 'Seven worker deadline differs from authorized runner' }
$script:root=$root;$script:sourcePath=$binding.inputPath;$script:savedPath=Join-Path $root 'saved.pptx'
$script:app=$null;$script:ownedApp=$null;$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null
$script:sequence=0;$script:stopped=$false;$script:cleanup=$true;$script:hashes=@{};$script:hashes[$script:sourcePath]=Get-SevenHash $script:sourcePath
$script:report=[ordered]@{schemaVersion=1;profile=$profile.profile;envelopeSha256=$ExpectedEnvelopeSha256;generation=$profile.generation;controllerRepository=$profile.controllerRepository;node=$profile.node;limits=$profile.limits;sourcePath=$script:sourcePath;sourceSha256=$script:hashes[$script:sourcePath];savedPath=$script:savedPath;savedSha256=$null;workerPath=$workerFile;workerSha256=(Get-SevenHash $workerFile);phases=[ordered]@{};probes=@();actions=@();opens=@();closes=0;saveCopies=0;quits=0;officeOperationsStopped=$false;cleanupConfirmed=$true;error=$null;lastStage=$null;lastStatus=$null}
try {
    Write-SevenStage 'worker.initialize' 'success'
    Invoke-SevenLifecycle
    # Revalidate all source/runtime/controller bindings after the owned application was quit.
    & $NodeExecutable $validator verify-execution --envelope $envelopeFile --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true
    if($LASTEXITCODE -ne 0) { throw 'Seven source/runtime identity changed during observation' }
    Write-SevenStage 'worker.complete' 'success'
} catch {
    $script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;$script:report.error=$_.Exception.Message
    Write-SevenStage 'worker.failed' 'error' $null $_.Exception.Message
    throw
}
