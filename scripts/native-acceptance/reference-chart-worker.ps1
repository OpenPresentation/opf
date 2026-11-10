param(
    [Parameter(Mandatory=$true)][string]$ExecutionEnvelope,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker
)
$ErrorActionPreference='Stop'
# Independent referenceWitness-case worker; the original ce92 worker is never loaded.
function Get-ReferenceWitnessHash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
# Only script-owned records and primitives may enter JSON. Never reflect an unexpected Office/managed object.
function Test-ReferenceWitnessInteger($Value) { return ($Value -is [int] -or $Value -is [long]) }
function Test-ReferenceWitnessFiniteNumber($Value) {
    if(-not ($Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [single] -or $Value -is [decimal] -or $Value -is [System.Int16] -or $Value -is [byte])) { return $false }
    return (-not [double]::IsNaN([double]$Value) -and -not [double]::IsInfinity([double]$Value))
}
function Get-ReferenceWitnessPrimitive($Value) {
    if($null -eq $Value -or $Value -is [string] -or $Value -is [bool]) { return ,$Value }
    if(Test-ReferenceWitnessFiniteNumber $Value) { return ,$Value }
    if($Value -is [double] -or $Value -is [single]) {
        if([double]::IsNaN([double]$Value)) { return '[nonfinite number: NaN]' }
        return '[nonfinite number: Infinity]'
    }
    return '[unsupported non-primitive value]'
}
function Write-ReferenceWitnessReport { $script:report | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath (Join-Path $script:root 'report.json') -Encoding UTF8 }
function Write-ReferenceWitnessStage([string]$Name,[string]$Status,$Value=$null,[string]$ErrorMessage=$null) {
    $script:sequence++;$script:report.lastStage=$Name;$script:report.lastStatus=$Status
    $primitive=Get-ReferenceWitnessPrimitive $Value
    [ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$Name;status=$Status;value=$primitive;error=$ErrorMessage;officeOperationsStopped=$script:stopped;cleanupConfirmed=$script:cleanup} | ConvertTo-Json -Compress -Depth 8 | Add-Content -LiteralPath (Join-Path $script:root 'stages.jsonl') -Encoding UTF8
    Write-ReferenceWitnessReport
}
function Stop-ReferenceWitnessLifecycle([string]$Message) { $script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;throw $Message }
function Assert-ReferenceWitnessProbe([bool]$Condition,[string]$Stage,$Expected,$Actual) {
    # Persist actual and expected before a refusal can abort the remaining phase.
    $script:report.probes+=@([ordered]@{stage=$Stage;expected=(Get-ReferenceWitnessPrimitive $Expected);actual=(Get-ReferenceWitnessPrimitive $Actual);matched=$Condition})
    Write-ReferenceWitnessReport
    if(-not $Condition) { Stop-ReferenceWitnessLifecycle "$Stage differs; expected/actual retained in report and stage journal" }
}
function Invoke-ReferenceWitnessCom([string]$Stage,[scriptblock]$Operation) {
    if($script:stopped) { throw 'ReferenceWitness Office operations stopped; no later COM is permitted' }
    try {Write-ReferenceWitnessStage $Stage 'begin';$value=& $Operation;Write-ReferenceWitnessStage $Stage 'success' $value;return ,$value}
    catch {$script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;Write-ReferenceWitnessStage $Stage 'error' $null $_.Exception.Message;throw}
}
function Read-ReferenceWitnessProperty($Object,[string]$Property,[string]$Stage) {
    if($Property -cnotin @('Presentations','Count','Version','Path','FullName','ReadOnly','Slides','SlideID','Name','Shapes','Id','Type','Left','Top','Width','Height','Rotation','HasTextFrame','AlternativeText','TextFrame','TextRange','Text')) { Stop-ReferenceWitnessLifecycle 'Property is outside the reviewed referenceWitness descriptor allowlist' }
    return ,(Invoke-ReferenceWitnessCom $Stage {if($null -eq $Object) {throw 'Missing owned object'};$member=$Object.PSObject.Properties[$Property];if($null -eq $member) {throw "Missing reviewed property $Property"};return ,$member.get_Value()})
}
function Assert-ReferenceWitnessOwnedPresentation([string]$Stage) {
    $owned=($null -ne $script:app -and $null -ne $script:ownedApp -and $null -ne $script:presentation -and [object]::ReferenceEquals($script:presentation,$script:ownedPresentation) -and [object]::ReferenceEquals($script:app,$script:ownedApp) -and -not [string]::IsNullOrEmpty($script:ownedPath))
    Assert-ReferenceWitnessProbe $owned $Stage 'same verified owned application/presentation references' $owned
}
function Assert-ReferenceWitnessOfficeIdle { if(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) {Stop-ReferenceWitnessLifecycle 'PowerPoint already running; refuse attachment'} }
function New-ReferenceWitnessApplication { $script:cleanup=$false;$script:report.cleanupConfirmed=$false;return Invoke-ReferenceWitnessCom 'application.create' {New-Object -ComObject PowerPoint.Application} }
function Read-ReferenceWitnessPresentations([string]$Stage) { return ,(Read-ReferenceWitnessProperty $script:app 'Presentations' "$Stage.presentations") }
function Own-ReferenceWitnessApplication($Application) {
    $script:app=$Application;$presentations=Read-ReferenceWitnessPresentations 'application.initial';$count=Read-ReferenceWitnessProperty $presentations 'Count' 'application.initial.count'
    Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $count) -and $count -eq 0) 'application.initial.count' 0 $count
    $script:ownedApp=$Application
    $version=Read-ReferenceWitnessProperty $Application 'Version' 'application.version';Assert-ReferenceWitnessProbe ($version -is [string] -and -not [string]::IsNullOrEmpty($version)) 'application.version' 'nonempty string' $version
    $directory=Read-ReferenceWitnessProperty $Application 'Path' 'application.path';Assert-ReferenceWitnessProbe ($directory -is [string] -and -not [string]::IsNullOrEmpty($directory)) 'application.path' 'nonempty string' $directory
    $executable=Join-Path $directory 'POWERPNT.EXE';$file=Get-Item -LiteralPath $executable -Force
    if($file.PSIsContainer) {Stop-ReferenceWitnessLifecycle 'PowerPoint executable metadata is not one file'}
    $build=$file.VersionInfo.FileVersion;if([string]::IsNullOrEmpty($build)) {$build=$null};$windowsBuild=$null
    $os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue
    if($null -ne $os -and $os.CurrentBuild -match '^\d+$' -and ($os.UBR -is [int] -or $os.UBR -is [long])) {$windowsBuild="$($os.CurrentBuild).$($os.UBR)"}
    $script:report.environment=[ordered]@{powerPointVersion=$version;executablePath=$executable;executableSha256=(Get-ReferenceWitnessHash $executable);executableVersion=$build;windowsBuild=$windowsBuild;hostVersion=$PSVersionTable.PSVersion.ToString()};Write-ReferenceWitnessReport
}
function Open-ReferenceWitnessOwned([string]$Path,[string]$Phase) {
    Assert-ReferenceWitnessProbe ($null -ne $script:app -and $null -ne $script:ownedApp -and [object]::ReferenceEquals($script:app,$script:ownedApp) -and $null -eq $script:presentation -and $null -eq $script:ownedPresentation) "$Phase.applicationOwnership" 'one verified owned empty application' ($null -ne $script:ownedApp)
    $presentations=Read-ReferenceWitnessPresentations "$Phase.preflight";$count=Read-ReferenceWitnessProperty $presentations 'Count' "$Phase.preflight.count";Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $count) -and $count -eq 0) "$Phase.preflight.count" 0 $count
    Assert-ReferenceWitnessProbe ((Get-ReferenceWitnessHash $Path) -ceq $script:hashes[$Path]) "$Phase.inputHash" $script:hashes[$Path] (Get-ReferenceWitnessHash $Path)
    $script:cleanup=$false;$script:report.cleanupConfirmed=$false;$script:ownedPath=$Path
    $script:presentation=Invoke-ReferenceWitnessCom "$Phase.open" {$presentations.Open($Path,-1,0,0)}
    $actual=Read-ReferenceWitnessProperty $script:presentation 'FullName' "$Phase.fullName";Assert-ReferenceWitnessProbe ($actual -is [string] -and [string]::Equals($actual,$Path,[StringComparison]::OrdinalIgnoreCase)) "$Phase.fullName" $Path $actual
    $readonly=Read-ReferenceWitnessProperty $script:presentation 'ReadOnly' "$Phase.readOnly";Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $readonly) -and $readonly -eq -1) "$Phase.readOnly" -1 $readonly
    $script:ownedPresentation=$script:presentation
    $script:report.opens+=@([ordered]@{phase=$Phase;path=$actual;readOnly=$readonly;sha256=(Get-ReferenceWitnessHash $Path)});Write-ReferenceWitnessReport
}
function Read-ReferenceWitnessPhase([string]$Phase) {
    Assert-ReferenceWitnessOwnedPresentation "$Phase.read.ownership"
    $current=[ordered]@{slideCount=$null;slides=@();rasters=@()};$script:report.phases[$Phase]=$current;Write-ReferenceWitnessReport
    $slides=Read-ReferenceWitnessProperty $script:presentation 'Slides' "$Phase.slides";$count=Read-ReferenceWitnessProperty $slides 'Count' "$Phase.slides.count";$current.slideCount=Get-ReferenceWitnessPrimitive $count;Write-ReferenceWitnessReport
    Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $count) -and $count -eq 3) "$Phase.slides.count" 3 $count
    $total=0
    for($index=1;$index -le 3;$index++) {
        $slide=Invoke-ReferenceWitnessCom "$Phase.slide.$index.get" {$slides.Item($index)}
        $record=[ordered]@{index=$index;slideId=$null;name=$null;shapeCount=$null;shapes=@()};$current.slides+=@($record);Write-ReferenceWitnessReport
        $slideId=Read-ReferenceWitnessProperty $slide 'SlideID' "$Phase.slide.$index.id";$record.slideId=Get-ReferenceWitnessPrimitive $slideId;Write-ReferenceWitnessReport
        Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $slideId) -and $slideId -gt 0) "$Phase.slide.$index.id" 'positive integer' $slideId
        $slideName=Read-ReferenceWitnessProperty $slide 'Name' "$Phase.slide.$index.name";$record.name=Get-ReferenceWitnessPrimitive $slideName;Write-ReferenceWitnessReport
        Assert-ReferenceWitnessProbe ($slideName -is [string]) "$Phase.slide.$index.name" 'string' $record.name
        $shapes=Read-ReferenceWitnessProperty $slide 'Shapes' "$Phase.slide.$index.shapes";$shapeCount=Read-ReferenceWitnessProperty $shapes 'Count' "$Phase.slide.$index.shapes.count";$record.shapeCount=Get-ReferenceWitnessPrimitive $shapeCount;Write-ReferenceWitnessReport
        Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $shapeCount) -and $shapeCount -ge 1 -and $shapeCount -le 3) "$Phase.slide.$index.shapes.count" '1..3; exact source binding follows offline' $shapeCount
        $total+=$shapeCount;Assert-ReferenceWitnessProbe ($total -le 9) "$Phase.totalShapes" '<=9' $total
        for($position=1;$position -le $shapeCount;$position++) {
            $shape=Invoke-ReferenceWitnessCom "$Phase.slide.$index.shape.$position.get" {$shapes.Item($position)};$item=[ordered]@{index=$position};$record.shapes+=@($item);Write-ReferenceWitnessReport
            foreach($pair in @(@('Id','id'),@('Name','name'),@('Type','type'),@('Left','left'),@('Top','top'),@('Width','width'),@('Height','height'),@('Rotation','rotation'),@('HasTextFrame','hasTextFrame'),@('AlternativeText','alternativeText'))) {
                $value=Read-ReferenceWitnessProperty $shape $pair[0] "$Phase.slide.$index.shape.$position.$($pair[1])";$item[$pair[1]]=Get-ReferenceWitnessPrimitive $value;Write-ReferenceWitnessReport
                if($pair[1] -in @('name','alternativeText')) {Assert-ReferenceWitnessProbe ($value -is [string]) "$Phase.slide.$index.shape.$position.$($pair[1])" 'string' $value}
                elseif($pair[1] -eq 'hasTextFrame') {Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $value) -and $value -in @(-1,0)) "$Phase.slide.$index.shape.$position.$($pair[1])" '0 or -1' $value}
                elseif($pair[1] -in @('id','type')) {Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $value) -and $value -gt 0) "$Phase.slide.$index.shape.$position.$($pair[1])" 'positive integer identity/type' $value}
                else {Assert-ReferenceWitnessProbe (Test-ReferenceWitnessFiniteNumber $value) "$Phase.slide.$index.shape.$position.$($pair[1])" 'finite numeric descriptor' $value}
            }
            $item.text=$null
            if($item.hasTextFrame -eq -1) {$frame=Read-ReferenceWitnessProperty $shape 'TextFrame' "$Phase.slide.$index.shape.$position.textFrame";$range=Read-ReferenceWitnessProperty $frame 'TextRange' "$Phase.slide.$index.shape.$position.textRange";$actualText=Read-ReferenceWitnessProperty $range 'Text' "$Phase.slide.$index.shape.$position.text";$item.text=Get-ReferenceWitnessPrimitive $actualText;Write-ReferenceWitnessReport;Assert-ReferenceWitnessProbe ($actualText -is [string]) "$Phase.slide.$index.shape.$position.text" 'string' $item.text}
            Write-ReferenceWitnessReport
        }
        $png=Join-Path $script:root "$Phase-$('{0:D2}' -f $index).png";Assert-ReferenceWitnessProbe (-not (Test-Path -LiteralPath $png)) "$Phase.slide.$index.pngFresh" $false (Test-Path -LiteralPath $png)
        Invoke-ReferenceWitnessCom "$Phase.slide.$index.export" {$slide.Export($png,'PNG',1280,720)}
        $current.rasters+=@([ordered]@{slideIndex=$index;path=$png;sha256=(Get-ReferenceWitnessHash $png)});Write-ReferenceWitnessReport
    }
}
function Save-ReferenceWitnessCopy {
    Assert-ReferenceWitnessOwnedPresentation 'copy.referenceOwnership'
    Assert-ReferenceWitnessProbe ($script:savedPath -ine $script:sourcePath -and -not (Test-Path -LiteralPath $script:savedPath)) 'copy.fresh' 'fresh derivative' $script:savedPath
    $actual=Read-ReferenceWitnessProperty $script:presentation 'FullName' 'copy.fullName';Assert-ReferenceWitnessProbe ($actual -is [string] -and $actual -ieq $script:ownedPath -and $actual -ieq $script:sourcePath) 'copy.ownership' $script:sourcePath $actual
    Invoke-ReferenceWitnessCom 'copy.saveCopyAs' {$script:presentation.SaveCopyAs($script:savedPath,24)};$script:report.saveCopies++
    $after=Read-ReferenceWitnessProperty $script:presentation 'FullName' 'copy.afterName';Assert-ReferenceWitnessProbe ($after -is [string] -and $after -ieq $script:sourcePath) 'copy.afterName' $script:sourcePath $after
    $script:hashes[$script:savedPath]=Get-ReferenceWitnessHash $script:savedPath;$script:report.savedSha256=$script:hashes[$script:savedPath];Write-ReferenceWitnessReport
}
function Close-ReferenceWitnessOwned([string]$Expected,[string]$Phase) {
    Assert-ReferenceWitnessOwnedPresentation "$Phase.close.referenceOwnership"
    $actual=Read-ReferenceWitnessProperty $script:presentation 'FullName' "$Phase.close.fullName";Assert-ReferenceWitnessProbe ($actual -is [string] -and $actual -ieq $Expected -and $script:ownedPath -ieq $Expected) "$Phase.close.ownership" $Expected $actual
    Invoke-ReferenceWitnessCom "$Phase.close.discard" {$script:presentation.Saved=-1}
    Invoke-ReferenceWitnessCom "$Phase.close" {$script:presentation.Close()};$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null;$script:report.closes++;Write-ReferenceWitnessReport
}
function Quit-ReferenceWitnessOwned {
    Assert-ReferenceWitnessProbe ($null -ne $script:app -and $null -ne $script:ownedApp -and [object]::ReferenceEquals($script:app,$script:ownedApp)) 'quit.ownership' 'verified owned application' ($null -ne $script:ownedApp)
    Assert-ReferenceWitnessProbe ($null -eq $script:presentation -and $null -eq $script:ownedPresentation) 'quit.presentationOwnership' 'no owned presentation remains' ($null -ne $script:presentation)
    $presentations=Read-ReferenceWitnessPresentations 'application.final';$count=Read-ReferenceWitnessProperty $presentations 'Count' 'application.final.count';Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $count) -and $count -eq 0) 'application.final.count' 0 $count
    Invoke-ReferenceWitnessCom 'application.quit' {$script:app.Quit()};$script:app=$null;$script:ownedApp=$null;$script:cleanup=$true;$script:report.cleanupConfirmed=$true;$script:report.quits++;Write-ReferenceWitnessReport
}
function Invoke-ReferenceWitnessLifecycle {
    Assert-ReferenceWitnessOfficeIdle
    $application=New-ReferenceWitnessApplication;Own-ReferenceWitnessApplication $application
    Open-ReferenceWitnessOwned $script:sourcePath 'original';Read-ReferenceWitnessPhase 'original';Save-ReferenceWitnessCopy;Close-ReferenceWitnessOwned $script:sourcePath 'original'
    Open-ReferenceWitnessOwned $script:savedPath 'saved-reopened';Read-ReferenceWitnessPhase 'saved-reopened';Close-ReferenceWitnessOwned $script:savedPath 'saved-reopened'
    Assert-ReferenceWitnessProbe ((Get-ReferenceWitnessHash $script:sourcePath) -ceq $script:report.sourceSha256) 'source.unchanged' $script:report.sourceSha256 (Get-ReferenceWitnessHash $script:sourcePath)
    Quit-ReferenceWitnessOwned
}


# Executable bootstrap is default-deny. No COM in setup or failure cleanup.
if(-not $Worker) { throw 'ReferenceWitness worker is private to the explicitly authorized, bound controller' }
$workerFile=[IO.Path]::GetFullPath($PSCommandPath)
$envelopeFile=[IO.Path]::GetFullPath($ExecutionEnvelope)
foreach($p in @($workerFile,$envelopeFile)) {
    if($p.StartsWith('\') -or $p -match '[\x00-\x1f]') { throw 'ReferenceWitness worker requires local paths' }
    $cursor=$p
    while($cursor) { $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'ReferenceWitness worker refuses aliased paths' };$parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent }
}
$envelopeItem=Get-Item -LiteralPath $envelopeFile -Force
if($envelopeItem.PSIsContainer -or $envelopeItem.Length -gt 4194304 -or (Get-ReferenceWitnessHash $envelopeFile) -cne $ExpectedEnvelopeSha256) { throw 'External referenceWitness envelope digest/size differs before code loading' }
$profile=Get-Content -LiteralPath $envelopeFile -Raw -Encoding UTF8 | ConvertFrom-Json
$wrapper=Join-Path $profile.controllerRepository.directory 'scripts/native-acceptance/run-reference-chart-profile.ps1'
$cursor=[IO.Path]::GetFullPath($wrapper)
if($cursor.StartsWith('\') -or $cursor -match '[\x00-\x1f]') { throw 'ReferenceWitness bootstrap wrapper must be local' }
while($cursor) { $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'ReferenceWitness bootstrap wrapper is aliased' };$parent=Split-Path -Parent $cursor;if($parent -eq $cursor) { break };$cursor=$parent }
$wrapperRecord=@($profile.controllerRepository.files | Where-Object {$_.path -ceq 'scripts/native-acceptance/run-reference-chart-profile.ps1'})
if($wrapperRecord.Count -ne 1 -or (Get-Item -LiteralPath $wrapper -Force).Length -ne $wrapperRecord[0].bytes -or (Get-ReferenceWitnessHash $wrapper) -cne $wrapperRecord[0].sha256) { throw 'Bound referenceWitness bootstrap code differs' }
$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($wrapper,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw 'Bound referenceWitness bootstrap has parser errors' }
foreach($name in @('Assert-ReferenceWitnessBootstrapPath','Read-ReferenceWitnessBootstrapEnvelope','Assert-ReferenceWitnessBootstrapNode','Assert-ReferenceWitnessBootstrapController')) {
    $found=@($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($found.Count -ne 1) { throw 'Missing/duplicate reviewed bootstrap definition' }
    Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
}
$profile=Read-ReferenceWitnessBootstrapEnvelope $envelopeFile $ExpectedEnvelopeSha256
Assert-ReferenceWitnessBootstrapNode $NodeExecutable $profile.node
Assert-ReferenceWitnessBootstrapController $profile.controllerRepository.directory $profile.controllerRepository
$root=Assert-ReferenceWitnessBootstrapPath $OutputDirectory
$execution=Split-Path -Parent $root
if((Split-Path -Leaf $root) -cne 'native' -or (Get-Item -LiteralPath $root -Force).PSIsContainer -ne $true) { throw 'ReferenceWitness worker requires its owned native output' }
# The unchanged supervisor creates these logs/receipt before starting its owned worker.
# No report, stages, derivative or raster may already exist; do not confuse kernel logs with stale native evidence.
$kernelNames=@('worker.stdout.log','worker.stderr.log','worker.json')
foreach($item in @(Get-ChildItem -LiteralPath $root -Force)) {
    if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Name -cnotin $kernelNames) { throw 'ReferenceWitness worker output contains pre-existing native evidence' }
}
if($envelopeFile -ine (Join-Path $execution 'execution-envelope.json') -or $workerFile -ine (Join-Path $execution 'inputs/reference-chart-worker.ps1')) { throw 'ReferenceWitness worker is not the owned execution snapshot' }
$validator=Join-Path $profile.controllerRepository.directory 'scripts/native-acceptance/reference-chart-profile.mjs'
$checked=& $NodeExecutable $validator verify-execution --envelope $envelopeFile --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true
if($LASTEXITCODE -ne 0) { throw 'ReferenceWitness worker authorization failed before Office' }
$binding=($checked | Out-String) | ConvertFrom-Json
$runner=Get-Content -LiteralPath (Join-Path $execution 'runner.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($runner.timeoutSeconds -ne $TimeoutSeconds) { throw 'ReferenceWitness worker deadline differs from authorized runner' }
$script:root=$root;$script:sourcePath=$binding.inputPath;$script:savedPath=Join-Path $root 'saved.pptx'
$script:app=$null;$script:ownedApp=$null;$script:presentation=$null;$script:ownedPresentation=$null;$script:ownedPath=$null
$script:sequence=0;$script:stopped=$false;$script:cleanup=$true;$script:hashes=@{};$script:hashes[$script:sourcePath]=Get-ReferenceWitnessHash $script:sourcePath
$script:report=[ordered]@{schemaVersion=1;profile=$profile.profile;envelopeSha256=$ExpectedEnvelopeSha256;generation=$profile.generation;controllerRepository=$profile.controllerRepository;node=$profile.node;limits=$profile.limits;sourcePath=$script:sourcePath;sourceSha256=$script:hashes[$script:sourcePath];savedPath=$script:savedPath;savedSha256=$null;workerPath=$workerFile;workerSha256=(Get-ReferenceWitnessHash $workerFile);phases=[ordered]@{};probes=@();actions=@();opens=@();closes=0;saveCopies=0;quits=0;officeOperationsStopped=$false;cleanupConfirmed=$true;error=$null;lastStage=$null;lastStatus=$null}
try {
    Write-ReferenceWitnessStage 'worker.initialize' 'success'
    Invoke-ReferenceWitnessLifecycle
    # Revalidate all source/runtime/controller bindings after the owned application was quit.
    & $NodeExecutable $validator verify-execution --envelope $envelopeFile --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $execution --require-office true
    if($LASTEXITCODE -ne 0) { throw 'ReferenceWitness source/runtime identity changed during observation' }
    Write-ReferenceWitnessStage 'worker.complete' 'success'
} catch {
    $script:stopped=$true;$script:cleanup=$false;$script:report.officeOperationsStopped=$true;$script:report.cleanupConfirmed=$false;$script:report.error=$_.Exception.Message
    Write-ReferenceWitnessStage 'worker.failed' 'error' $null $_.Exception.Message
    throw
}
