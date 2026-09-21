param(
    [string]$OutputDirectory,
    [string]$CandidateFixtureDirectory,
    [string]$FontFixtureDirectory,
    [ValidateRange(1,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$ValidateInputs,
    [switch]$PureRegression
)
$ErrorActionPreference='Stop'

function Get-InventorySha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-InventoryJson([string]$Path) { return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json) }
function ConvertFrom-InventoryRegistrationJson([string]$Json) {
    # Windows PowerShell 5.1 emits a root JSON array as one pipeline item.
    # Decode before wrapping, so four registration records do not become one.
    $parsed=$Json | ConvertFrom-Json
    return ,@($parsed)
}
function Test-InventoryFontCleanup($Registrations) {
    return (@($Registrations).Count -eq 4 -and @($Registrations | Where-Object {-not $_.removed -or $_.added -lt 1}).Count -eq 0)
}
function Assert-InventoryHash([string]$Value,[string]$Context) { if($Value -notmatch '^[0-9a-f]{64}$') { throw "$Context must be a lowercase SHA-256" } }
function Get-InventoryFullPath([string]$Path) { return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path) }
function Test-InventoryPathInside([string]$Root,[string]$Path) {
    $rootFull=[IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
    $pathFull=[IO.Path]::GetFullPath($Path)
    return $pathFull.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)
}
function Assert-InventoryPathInside([string]$Root,[string]$Path,[string]$Context) { if(-not (Test-InventoryPathInside $Root $Path)) { throw "$Context escaped its pinned root: $Path" } }
function Assert-InventoryFileHash([string]$Path,[string]$Expected,[string]$Context) {
    Assert-InventoryHash $Expected "$Context expected hash"
    $actual=Get-InventorySha256 $Path
    if($actual -cne $Expected) { throw "$Context hash mismatch: expected $Expected, observed $actual" }
    return $actual
}
function Get-InventoryRelativeLockKey([string]$Root,[string]$Path) {
    Assert-InventoryPathInside $Root $Path 'Installed package'
    $relative=[IO.Path]::GetFullPath($Path).Substring([IO.Path]::GetFullPath($Root).TrimEnd('\').Length).TrimStart('\')
    return $relative.Replace('\','/')
}
function Test-RegistryBindings($Generation) {
    $registry=$Generation.registryConsumer
    if($null -eq $registry) { throw 'Candidate registryConsumer record is missing' }
    $consumer=Get-InventoryFullPath ([string]$registry.realpath)
    $lockPath=Get-InventoryFullPath ([string]$registry.lockfilePath)
    $packageJson=Join-Path $consumer 'package.json'
    Assert-InventoryPathInside $consumer $lockPath 'Consumer lockfile'
    if((Get-InventorySha256 $packageJson) -cne [string]$registry.packageJsonSha256) { throw 'Pinned consumer package.json changed' }
    if((Get-InventorySha256 $lockPath) -cne [string]$registry.lockfileSha256) { throw 'Pinned consumer lockfile changed' }
    Add-Type -AssemblyName System.Web.Extensions
    $lockSerializer=New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $lockSerializer.MaxJsonLength=67108864
    $lock=$lockSerializer.DeserializeObject([IO.File]::ReadAllText($lockPath))
    $expectedVersions=@{
        '@openpresentation/opf'='0.11.0'; '@openpresentation/opf-pptx'='0.9.1';
        '@openpresentation/opf-render'='0.9.0'; '@openpresentation/opf-editor'='0.8.0';
        '@openpresentation/cli'='0.9.0'; 'fflate'='0.8.3'; 'fast-xml-parser'='5.11.1'
    }
    $results=@()
    foreach($name in @($expectedVersions.Keys | Sort-Object)) {
        $moduleProperty=$registry.packages.PSObject.Properties[$name]
        if($null -eq $moduleProperty) { throw "Candidate report has no package binding for $name" }
        $module=$moduleProperty.Value
        if([string]$module.version -cne $expectedVersions[$name]) { throw "Unexpected package version for $name" }
        $rawInstallPath=[string]$module.installPath
        $installPath=Get-InventoryFullPath $rawInstallPath
        $manifestPath=Get-InventoryFullPath ([string]$module.manifestPath)
        $entryPath=Get-InventoryFullPath ([string]$module.entrypointRealpath)
        Assert-InventoryPathInside $consumer $installPath "$name install path"
        Assert-InventoryPathInside $consumer $manifestPath "$name manifest"
        Assert-InventoryPathInside $consumer $entryPath "$name public entry"
        $installItem=Get-Item -LiteralPath $rawInstallPath -Force
        if(($installItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or [bool]$module.installPathIsSymbolicLink) { throw "$name is installed through a symbolic link/reparse point" }
        $manifest=Get-InventoryJson $manifestPath
        if($manifest.name -cne $name -or $manifest.version -cne $expectedVersions[$name]) { throw "$name installed manifest identity changed" }
        if((Get-InventorySha256 $manifestPath) -cne [string]$module.manifestSha256) { throw "$name installed manifest hash changed" }
        if((Get-InventorySha256 $entryPath) -cne [string]$module.entrypointSha256) { throw "$name public entry hash changed" }
        $lockKey=Get-InventoryRelativeLockKey $consumer $installPath
        if(-not $lock['packages'].ContainsKey($lockKey)) { throw "$name is absent from the consumer lockfile at $lockKey" }
        $lockEntry=$lock['packages'][$lockKey]
        if($lockEntry['version'] -cne $expectedVersions[$name] -or $lockEntry['resolved'] -cne [string]$module.lockResolved -or $lockEntry['integrity'] -cne [string]$module.lockIntegrity -or [bool]$lockEntry['link'] -or [bool]$module.lockLink) { throw "$name lockfile resolved/integrity/link identity changed" }
        if($name -eq '@openpresentation/cli') {
            if($module.entrypointKind -notlike 'manifest-declared CLI binary*') { throw 'CLI binding must be its declared executable entry, not a guessed public ESM root' }
        } elseif($module.entrypointKind -cne 'public ESM root entry' -or [string]$module.publicEsmEntryUrl -notlike 'file:*') { throw "$name must resolve through its public ESM root entry" }
        $results+=@([ordered]@{name=$name;version=$expectedVersions[$name];lockKey=$lockKey;manifestPath=$manifestPath;entrypointRealpath=$entryPath;manifestSha256=$module.manifestSha256;entrypointSha256=$module.entrypointSha256;installPathIsSymbolicLink=$false;lockLink=$false})
    }
    if($results.Count -ne 7) { throw 'Expected exactly five OPF packages and two inspection helpers' }
    return ,([ordered]@{consumer=$consumer;packageJsonSha256=$registry.packageJsonSha256;lockfilePath=$lockPath;lockfileSha256=$registry.lockfileSha256;bindingScope=[string]$registry.bindingScope;packages=$results})
}
function Read-InventoryCandidate([string]$CandidateDirectory,[string]$FontDirectory) {
    $candidate=Get-InventoryFullPath $CandidateDirectory
    $resumeRoot=Get-InventoryFullPath (Split-Path -Parent $candidate)
    $generationPath=Join-Path $candidate 'generation-corrected.json'
    $sourcePath=Join-Path $candidate 'source.pptx'
    $sourceJsonPath=Join-Path $candidate 'source.opf.json'
    $generatorPath=Join-Path $candidate 'generate.mjs'
    foreach($path in @($generationPath,$sourcePath,$sourceJsonPath,$generatorPath)) { if(-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required candidate file is missing: $path" } }
    $generation=Get-InventoryJson $generationPath
    if($generation.kind -cne 'opf-carlito-embedding-candidate-fixture' -or $generation.nativeFontsGate.status -cne 'pending') { throw 'Candidate report has unexpected scope or prematurely claims the native Fonts gate' }
    if($generation.inventoryVerification.generatedSourceAndPptxBytesMatchedPreservedFiles -ne $true -or $generation.inventoryVerification.supersedesReport -cne 'generation.json') { throw 'Corrected report lacks byte-identical inventory verification lineage' }
    if((Get-InventorySha256 $generatorPath) -cne [string]$generation.generator.sha256) { throw 'Corrected generator source hash differs from its report' }
    if((Get-InventorySha256 $sourceJsonPath) -cne [string]$generation.source.sha256 -or (Get-InventorySha256 $sourcePath) -cne [string]$generation.source.presentationSha256) { throw 'Candidate OPF or PPTX input hash differs from corrected report' }
    $packageInspection=$generation.packageInspection
    if($packageInspection.fontProgramMembers.Count -ne 0 -or $packageInspection.fontBearingSvgMembers.Count -ne 0) { throw 'Candidate must not contain copied/embedded font programs or font-bearing SVG' }
    if($packageInspection.slideStats.Count -ne 1 -or $packageInspection.slideStats[0].shapeCount -ne 1 -or $packageInspection.slideStats[0].placeholderCount -ne 0 -or $packageInspection.slideStats[0].tableCount -ne 0 -or $packageInspection.slideStats[0].hardBreakCount -ne 0 -or $packageInspection.slideStats[0].slideTextTabCount -ne 0) { throw 'Candidate slide/package is outside the bounded one-text-shape control' }
    $runs=@($packageInspection.slideRunRecords)
    if($runs.Count -ne 4) { throw 'Candidate must contain exactly four nonempty authored rich runs' }
    $wantedText=@('Regular ','Bold ','Italic ','BoldItalic'); $wantedSize=@(18,20,22,24); $wantedBold=@($false,$true,$false,$true); $wantedItalic=@($false,$false,$true,$true)
    $expectedRuns=@(); $expectedText=''; $position=1
    for($index=0;$index -lt 4;$index++) {
        $run=$runs[$index]
        if([string]$run.text -cne $wantedText[$index] -or [double]$run.fontSizeHundredthsPoint -ne ($wantedSize[$index]*100) -or [bool]$run.bold -ne $wantedBold[$index] -or [bool]$run.italic -ne $wantedItalic[$index]) { throw "Candidate run $index text/size/style differs from the four authored inventory spans" }
        $expectedText += [string]$run.text
        $face=$run.typefaces
        if($face.latin -cne 'Carlito' -or $face.ea -cne 'Carlito' -or $face.cs -cne 'Carlito') { throw "Candidate rich run $index is not explicit Carlito for all scripts" }
        if([double]$run.fontSizeHundredthsPoint -notin @(1800,2000,2200,2400)) { throw "Candidate run $index has an unexpected font size" }
        $expectedRuns+=@([ordered]@{index=$index;start=$position;length=([string]$run.text).Length;text=[string]$run.text;size=[double]$run.fontSizeHundredthsPoint/100;bold=[bool]$run.bold;italic=[bool]$run.italic})
        $position += ([string]$run.text).Length
    }
    if($expectedText -cne [string]$generation.source.expectedText) { throw 'Candidate source expectedText does not equal its four authored XML runs' }
    $sourceOpf=Get-InventoryJson $sourceJsonPath
    if(@($sourceOpf.slides).Count -ne 1 -or $sourceOpf.slides[0].type -cne 'text' -or $sourceOpf.slides[0].layout -cne 'blank' -or @($sourceOpf.slides[0].text).Count -ne 4 -or $null -ne $sourceOpf.slides[0].title -or $null -ne $sourceOpf.slides[0].notes) { throw 'Source OPF is outside the one-slide, four-run, no-title/no-notes fixture contract' }
    $sourceFontScheme=$sourceOpf.design.fontScheme
    if($sourceFontScheme.major -cne 'Carlito' -or $sourceFontScheme.minor -cne 'Carlito' -or $sourceFontScheme.heading.family -cne 'Carlito' -or $sourceFontScheme.body.family -cne 'Carlito' -or $sourceFontScheme.accent.family -cne 'Carlito' -or $sourceFontScheme.code.family -cne 'Carlito') { throw 'Source OPF font-scheme fields differ from the Carlito-only authoring contract' }
    for($index=0;$index -lt 4;$index++) { $span=$sourceOpf.slides[0].text[$index]; if($span.text -cne $wantedText[$index] -or $span.fontFamily -cne 'Carlito' -or [double]$span.fontSize -ne $wantedSize[$index] -or [bool]$span.bold -ne $wantedBold[$index] -or [bool]$span.italic -ne $wantedItalic[$index]) { throw "Source OPF span $index differs from the expected rich-run contract" } }
    $registry=Test-RegistryBindings $generation
    $fontRoot=Get-InventoryFullPath $FontDirectory
    Assert-InventoryPathInside $resumeRoot $fontRoot 'Carlito license/source directory'
    $fontGenerationPath=Join-Path $fontRoot 'generation.json'; $licensePath=Join-Path $fontRoot 'LICENSE_FONT'
    $fontGeneration=Get-InventoryJson $fontGenerationPath
    $reference=$generation.permittedCarlitoInventoryReference
    if($fontGeneration.package.name -cne '@expo-google-fonts/carlito' -or $fontGeneration.package.version -cne '0.4.1' -or $fontGeneration.license.spdx -cne 'OFL-1.1' -or $fontGeneration.registration.flags -ne 0) { throw 'Carlito package/license/session-registration metadata differs from the reviewed fixture' }
    if((Get-InventorySha256 $fontGenerationPath) -cne [string]$reference.sourceGenerationSha256 -or $fontGeneration.package.manifestSha256 -cne [string]$reference.package.manifestSha256 -or $fontGeneration.license.sha256 -cne [string]$reference.license.sha256) { throw 'Candidate permitted-face reference differs from the licensed Carlito source metadata' }
    Assert-InventoryFileHash $licensePath ([string]$fontGeneration.license.sha256) 'Carlito license'
    $allowed=@('fonts/Carlito-400-normal.ttf','fonts/Carlito-400-italic.ttf','fonts/Carlito-700-normal.ttf','fonts/Carlito-700-italic.ttf')
    $fontRecords=@($fontGeneration.fonts); if($fontRecords.Count -ne 4) { throw 'Licensed font metadata must enumerate exactly four Carlito styles' }
    $permitted=@($reference.exactPermittedFaces); if($permitted.Count -ne 4) { throw 'Candidate report must record exactly four permitted face hashes' }
    $fontInputs=@()
    foreach($file in $allowed) {
        $record=@($fontRecords | Where-Object {$_.file -ceq $file}); $permittedRecord=@($permitted | Where-Object {$_.file -ceq $file})
        if($record.Count -ne 1 -or $permittedRecord.Count -ne 1 -or $record[0].sha256 -cne $permittedRecord[0].sha256) { throw "Carlito face metadata mismatch for $file" }
        $fontPath=Join-Path $fontRoot $file; Assert-InventoryFileHash $fontPath ([string]$record[0].sha256) "Licensed Carlito face $file"
        $fontInputs+=@([ordered]@{file=$file;path=$fontPath;sha256=[string]$record[0].sha256})
    }
    return ,([ordered]@{resumeRoot=$resumeRoot;candidateRoot=$candidate;generationPath=$generationPath;sourcePath=$sourcePath;sourceJsonPath=$sourceJsonPath;generatorPath=$generatorPath;generation=$generation;registry=$registry;fontRoot=$fontRoot;fontGenerationPath=$fontGenerationPath;fontGeneration=$fontGeneration;licensePath=$licensePath;fontInputs=$fontInputs;expectedText=$expectedText;expectedRuns=$expectedRuns})
}
function New-InventoryInputCheck([string]$Path,[string]$Expected) {
    try { $actual=Get-InventorySha256 $Path; return ,([ordered]@{path=$Path;expected=$Expected;actual=$actual;matched=($actual -ceq $Expected);error=$null}) }
    catch { return ,([ordered]@{path=$Path;expected=$Expected;actual=$null;matched=$false;error=$_.Exception.Message}) }
}
function Get-InventoryInputChecks($Request) {
    $checks=@()
    foreach($item in @($Request.inputs)) {
        $checks+=@((New-InventoryInputCheck ([string]$item.sourcePath) ([string]$item.sha256)),(New-InventoryInputCheck ([string]$item.snapshotPath) ([string]$item.sha256)))
    }
    foreach($item in @($Request.registryBindings.packages)) {
        $checks+=@((New-InventoryInputCheck ([string]$item.manifestPath) ([string]$item.manifestSha256)),(New-InventoryInputCheck ([string]$item.entrypointRealpath) ([string]$item.entrypointSha256)))
    }
    return ,$checks
}
function Assert-InventoryInputsUnchanged($Request) {
    $checks=Get-InventoryInputChecks $Request
    $failed=@($checks | Where-Object {-not $_.matched})
    if($failed.Count -gt 0) { throw "Input/code snapshot changed: $($failed[0].path)" }
}

function Get-InventoryContentGate($Observation,$Expected) {
    $failures=@(); $checks=@()
    $passed=[bool]$Observation.openedPathMatches; $checks+=@([ordered]@{check='opened path is exact owned snapshot';passed=$passed;actual=$Observation.fullName;expected=$Observation.sourceSnapshotPath}); if(-not $passed) {$failures+='opened path is not the exact owned snapshot'}
    $passed=[bool]$Observation.readOnly; $checks+=@([ordered]@{check='presentation reports read-only';passed=$passed;actual=$Observation.readOnly;expected=$true}); if(-not $passed) {$failures+='presentation is not read-only'}
    $passed=([int]$Observation.slideCount -eq 1); $checks+=@([ordered]@{check='one slide';passed=$passed;actual=$Observation.slideCount;expected=1}); if(-not $passed) {$failures+='slide count differs'}
    $shapeValue=[ordered]@{shapeCount=$Observation.shapeCount;hasTextFrame=$Observation.hasTextFrame}; $passed=([int]$Observation.shapeCount -eq 1 -and [bool]$Observation.hasTextFrame); $checks+=@([ordered]@{check='one text shape';passed=$passed;actual=$shapeValue;expected=[ordered]@{shapeCount=1;hasTextFrame=$true}}); if(-not $passed) {$failures+='shape count or text frame differs'}
    $textValue=[ordered]@{text=$Observation.text;length=$Observation.textLength;start=$Observation.textStart}; $textExpected=[ordered]@{text=$Expected.text;length=$Expected.text.Length;start=1}; $passed=($Observation.text -ceq $Expected.text -and [int]$Observation.textLength -eq $Expected.text.Length -and [int]$Observation.textStart -eq 1); $checks+=@([ordered]@{check='exact whole current text, length, and native Start';passed=$passed;actual=$textValue;expected=$textExpected}); if(-not $passed) {$failures+='whole text, length, or native Start differs'}
    $runChecks=@();
    if(@($Observation.runs).Count -ne @($Expected.runs).Count) { $runChecks+=@([ordered]@{passed=$false;reason='run observation count differs';actualCount=@($Observation.runs).Count;expectedCount=@($Expected.runs).Count}) }
    else {
        for($index=0;$index -lt @($Expected.runs).Count;$index++) {
            $actual=$Observation.runs[$index]; $wanted=$Expected.runs[$index]
            $runPassed=([int]$actual.start -eq [int]$wanted.start -and [int]$actual.length -eq [int]$wanted.length -and $actual.text -ceq $wanted.text -and [string]$actual.font.name -ceq 'Carlito' -and [Math]::Abs([double]$actual.font.size-[double]$wanted.size) -le 0.0001 -and [int]$actual.font.bold -eq $(if($wanted.bold){-1}else{0}) -and [int]$actual.font.italic -eq $(if($wanted.italic){-1}else{0}))
            $runChecks+=@([ordered]@{index=$index;passed=$runPassed;actual=$actual;expected=$wanted})
        }
    }
    $allRunsPassed=(@($runChecks | Where-Object {-not $_.passed}).Count -eq 0 -and @($runChecks).Count -eq @($Expected.runs).Count)
    $checks+=@([ordered]@{check='four exact authored current run ranges/styles';passed=$allRunsPassed;actual=$runChecks;expected=$Expected.runs}); if(-not $allRunsPassed) {$failures+='authored current run ranges/styles differ'}
    return ,([ordered]@{passed=($failures.Count -eq 0);failures=$failures;checks=$checks;runChecks=$runChecks;scope='Current read-only text/range/style observation; not an edit, save/reopen, physical-font, or rendering-fidelity test.'})
}
function Get-InventoryFontGate($Observation) {
    $allowed=@('Carlito','Carlito Bold','Carlito Italic','Carlito Bold Italic')
    $entries=@($Observation.entries); $invalidCount=([int]$Observation.count -lt 1 -or [int]$Observation.count -gt 64 -or [int]$Observation.count -ne $entries.Count)
    $unexpected=@($entries | Where-Object {$allowed -cnotcontains [string]$_.name} | ForEach-Object {[string]$_.name})
    return ,([ordered]@{passed=(-not $invalidCount -and $unexpected.Count -eq 0);reportedCount=$Observation.count;entryCount=$entries.Count;countValid=(-not $invalidCount);allowedReportedNames=$allowed;unexpectedNames=$unexpected;entries=$entries;scope='Only exact reported Presentation.Fonts Name values are compared with the permitted family/style names; Embeddable/Embedded are recorded but do not prove physical face identity.'})
}
function Get-InventoryParentDecision($Result,$LastDurable,$WorkerReport,[bool]$FontCleanupConfirmed,[bool]$InputsUnchanged) {
    $timedOut=($null -ne $Result -and [bool]$Result.timedOut)
    $lifecycle=($null -ne $Result -and -not $timedOut -and [int]$Result.exitCode -eq 0 -and $null -ne $LastDurable -and $LastDurable.stage -ceq 'worker.complete' -and $LastDurable.status -ceq 'success' -and [bool]$LastDurable.cleanupConfirmed -and $null -ne $WorkerReport -and [bool]$WorkerReport.cleanupConfirmed -and [int]$WorkerReport.ownedCloseCount -eq 1 -and $FontCleanupConfirmed -and $InputsUnchanged)
    $content=($lifecycle -and $null -ne $WorkerReport.contentGate -and [bool]$WorkerReport.contentGate.passed)
    $fontInventory=($lifecycle -and $null -ne $WorkerReport.nativeFontsGate -and [bool]$WorkerReport.nativeFontsGate.passed)
    return ,([ordered]@{timedOut=$timedOut;lifecycleComplete=$lifecycle;contentGatePassed=$content;nativeFontsGatePassed=$fontInventory;fontCleanupConfirmed=$FontCleanupConfirmed;inputsUnchanged=$InputsUnchanged})
}
function Assert-InventoryParentSuccess($Decision,$Result,$ParentFailure) {
    if(-not [string]::IsNullOrEmpty([string]$ParentFailure) -or $null -eq $Result -or $Decision.timedOut -or $Result.exitCode -ne 0 -or -not $Decision.lifecycleComplete) { throw 'Native font inventory attempt failed or did not complete exactly one owned close and all four parent-owned removals; preserve the attempt. No retry was started.' }
    if(-not $Decision.contentGatePassed) { throw 'The read-only document content/style gate failed after owned close; preserve the observation. No retry was started.' }
    if(-not $Decision.nativeFontsGatePassed) { throw 'The native Fonts family/style allowlist failed after owned close; preserve the observation and do not proceed to embedding. No retry was started.' }
}

function Invoke-InventoryPureRegression {
    $tokens=$null; $parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Verifier parse failed: $($parseErrors[0].Message)" }
    $definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true))
    foreach($functionName in @('Get-InventoryContentGate','Get-InventoryFontGate','Get-InventoryParentDecision','Assert-InventoryParentSuccess','Invoke-InventoryCom','Test-InventoryPathEqual','Read-InventoryTextRange','Close-OwnedInventoryPresentation','ConvertFrom-InventoryRegistrationJson','Test-InventoryFontCleanup')) {
        $definition=@($definitions | Where-Object {$_.Name -ceq $functionName})
        if($definition.Count -ne 1) { throw "Expected exactly one $functionName definition" }
        Invoke-Expression $definition[0].Extent.Text
    }
    $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true; $script:sequence=0; $script:pureStages=@()
    function Write-InventoryStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) { $script:sequence++; $script:pureStages+=@([ordered]@{stage=$Name;status=$Status;error=$ErrorMessage}) }
    $callCounter=@{value=0}; $null=Invoke-InventoryCom 'pure.ok' {$callCounter.value++; return 7}; if($callCounter.value -ne 1) { throw 'Pure wrapper did not call its successful operation' }
    $failed=$false; try {$null=Invoke-InventoryCom 'pure.fail' {$callCounter.value++; throw 'controlled'}} catch {$failed=$true}
    if(-not $failed -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw 'Pure wrapper did not latch and record a controlled failure' }
    $blocked=$false; try {$null=Invoke-InventoryCom 'pure.blocked' {$callCounter.value++}} catch {$blocked=$true}
    if(-not $blocked -or $callCounter.value -ne 2 -or @($script:pureStages | Where-Object {$_.stage -ceq 'pure.blocked'}).Count -ne 0) { throw 'Pure wrapper allowed an Office call after the failure latch' }
    # The first segment intentionally leaves the latch set. Reset only the pure
    # in-memory harness state before exercising independent positive/negative gates.
    $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true
    $expected=[ordered]@{text='Regular Bold Italic BoldItalic';runs=@(
        [ordered]@{start=1;length=8;text='Regular ';size=18;bold=$false;italic=$false},
        [ordered]@{start=9;length=5;text='Bold ';size=20;bold=$true;italic=$false},
        [ordered]@{start=14;length=7;text='Italic ';size=22;bold=$false;italic=$true},
        [ordered]@{start=21;length=10;text='BoldItalic';size=24;bold=$true;italic=$true})}
    $runs=@(); foreach($run in $expected.runs) {$fakeRange=[pscustomobject]@{Start=$run.start;Length=$run.length;Text=$run.text;Font=[pscustomobject]@{Name='Carlito';Size=$run.size;Bold=$(if($run.bold){-1}else{0});Italic=$(if($run.italic){-1}else{0})}}; $runs+=@(Read-InventoryTextRange $fakeRange 'pure.authored-run')}
    $observation=[ordered]@{openedPathMatches=$true;sourceSnapshotPath='C:\owned\source.pptx';fullName='C:\owned\source.pptx';readOnly=$true;slideCount=1;shapeCount=1;hasTextFrame=$true;text=$expected.text;textStart=1;textLength=$expected.text.Length;runs=$runs}
    $content=Get-InventoryContentGate $observation $expected
    if(-not $content.passed) { throw 'Positive content/range/style pure control failed' }
    $wrongFullName=$observation.fullName; $observation.fullName='C:\owned\other.pptx'; $observation.openedPathMatches=Test-InventoryPathEqual $observation.fullName $observation.sourceSnapshotPath; $badPathGate=Get-InventoryContentGate $observation $expected; $observation.fullName=$wrongFullName; $observation.openedPathMatches=$true
    $wrongWholeStart=$observation.textStart; $observation.textStart=2; $badWholeStart=Get-InventoryContentGate $observation $expected; $observation.textStart=$wrongWholeStart
    $bad=$runs[1].font; $bad.name='Aptos'; $badFamily=Get-InventoryContentGate $observation $expected; $bad.name='Carlito'
    $savedText=$runs[0].text; $runs[0].text='Mutated'; $badText=Get-InventoryContentGate $observation $expected; $runs[0].text=$savedText
    $wrongStart=$runs[2].start; $runs[2].start++; $badStart=Get-InventoryContentGate $observation $expected; $runs[2].start=$wrongStart
    $savedSize=$runs[1].font.size; $runs[1].font.size=21; $badSize=Get-InventoryContentGate $observation $expected; $runs[1].font.size=$savedSize
    $savedBold=$runs[1].font.bold; $runs[1].font.bold=0; $badBold=Get-InventoryContentGate $observation $expected; $runs[1].font.bold=$savedBold
    $savedItalic=$runs[2].font.italic; $runs[2].font.italic=0; $badItalic=Get-InventoryContentGate $observation $expected; $runs[2].font.italic=$savedItalic
    if($badFamily.passed -or $badText.passed -or $badStart.passed -or $badSize.passed -or $badBold.passed -or $badItalic.passed -or $badPathGate.passed -or $badWholeStart.passed) { throw "Content/style gate accepted a mutation: family=$($badFamily.passed) text=$($badText.passed) runStart=$($badStart.passed) size=$($badSize.passed) bold=$($badBold.passed) italic=$($badItalic.passed) path=$($badPathGate.passed) wholeStart=$($badWholeStart.passed)" }
    $script:presentation=[pscustomobject]@{FullName='C:\owned\other.pptx'}; $script:ownedPresentationPath='C:\owned\source.pptx'; $closeCounter=@{value=0}; $script:presentation | Add-Member -MemberType ScriptMethod -Name Close -Value {$closeCounter.value++}; $wrongOwnedPathRejected=$false; try {Close-OwnedInventoryPresentation 'C:\owned\source.pptx'} catch {$wrongOwnedPathRejected=$true}; $script:presentation=$null; $script:ownedPresentationPath=$null
    if(-not $wrongOwnedPathRejected -or $closeCounter.value -ne 0 -or $script:officeOperationsStopped) { throw 'Wrong owned path was closed or latched as a COM failure' }
    $badInputRequest=[pscustomobject]@{inputs=@([pscustomobject]@{sourcePath=$PSCommandPath;snapshotPath=$PSCommandPath;sha256=('0'*64)});registryBindings=[pscustomobject]@{packages=@()}}
    $badInputChecks=Get-InventoryInputChecks $badInputRequest
    if(@($badInputChecks | Where-Object {-not $_.matched}).Count -ne 2) { throw 'Input hash mutation was not detected by the real hash checker' }
    $fontGate=Get-InventoryFontGate ([ordered]@{count=4;entries=@([ordered]@{name='Carlito';embedded=$false;embeddable=$true},[ordered]@{name='Carlito Bold';embedded=$false;embeddable=$true},[ordered]@{name='Carlito Italic';embedded=$false;embeddable=$true},[ordered]@{name='Carlito Bold Italic';embedded=$false;embeddable=$true})})
    $registrationJson='[{"added":1,"removed":true},{"added":1,"removed":true},{"added":1,"removed":true},{"added":1,"removed":true}]'
    $decodedRegistrations=ConvertFrom-InventoryRegistrationJson $registrationJson
    if(-not (Test-InventoryFontCleanup $decodedRegistrations)) { throw 'Root JSON registration array did not decode into four removed records' }
    $decodedRegistrations[2].removed=$false
    if(Test-InventoryFontCleanup $decodedRegistrations) { throw 'Registration parser accepted a failed removal' }
    $decodedRegistrations[2].removed=$true; $decodedRegistrations[1].added=0
    if(Test-InventoryFontCleanup $decodedRegistrations) { throw 'Registration parser accepted a missing addition' }
    $decodedRegistrations[1].added=1
    if(Test-InventoryFontCleanup $decodedRegistrations[0..2]) { throw 'Registration parser accepted only three records' }
    if(Test-InventoryFontCleanup (ConvertFrom-InventoryRegistrationJson '[]')) { throw 'Registration parser accepted no records' }
    $badFontGate=Get-InventoryFontGate ([ordered]@{count=2;entries=@([ordered]@{name='Carlito';embedded=$false;embeddable=$true},[ordered]@{name='Aptos';embedded=$false;embeddable=$true})})
    $badCount=Get-InventoryFontGate ([ordered]@{count=65;entries=@()})
    $zeroCount=Get-InventoryFontGate ([ordered]@{count=0;entries=@()})
    if(-not $fontGate.passed -or $badFontGate.passed -or $badCount.passed -or $zeroCount.passed) { throw 'Font inventory gate accepted an unexpected family or invalid count' }
    $goodDecision=Get-InventoryParentDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{cleanupConfirmed=$true;ownedCloseCount=1;contentGate=[pscustomobject]@{passed=$true};nativeFontsGate=[pscustomobject]@{passed=$true}}) $true $true
    $badCloseDecision=Get-InventoryParentDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{cleanupConfirmed=$true;ownedCloseCount=0;contentGate=[pscustomobject]@{passed=$true};nativeFontsGate=[pscustomobject]@{passed=$true}}) $true $true
    $badRemovalDecision=Get-InventoryParentDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{cleanupConfirmed=$true;ownedCloseCount=1;contentGate=[pscustomobject]@{passed=$true};nativeFontsGate=[pscustomobject]@{passed=$true}}) $false $true
    $badInputsDecision=Get-InventoryParentDecision ([pscustomobject]@{timedOut=$false;exitCode=0}) ([pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}) ([pscustomobject]@{cleanupConfirmed=$true;ownedCloseCount=1;contentGate=[pscustomobject]@{passed=$true};nativeFontsGate=[pscustomobject]@{passed=$true}}) $true $false
    if(-not $goodDecision.lifecycleComplete -or -not $goodDecision.nativeFontsGatePassed -or $badCloseDecision.lifecycleComplete -or $badRemovalDecision.lifecycleComplete -or $badInputsDecision.lifecycleComplete) { throw 'Parent lifecycle, removal, or input decision accepted a negative case' }
    $wrongPath=Test-InventoryPathEqual 'C:\owned\other.pptx' $observation.sourceSnapshotPath
    if($wrongPath) { throw 'Pure exact-path ownership test failed' }
    [ordered]@{passed=$true;officeOrComCalls=0;stopLatchPassed=$true;contentStylesPassed=$content.passed;runTextStartAndStyleMutationsRejected=$true;wholeRangeStartMutationRejected=$true;wrongOwnedPathRejected=$wrongOwnedPathRejected;inputHashMutationRejected=$true;fontAllowlistNegativeRejected=$true;invalidFontCountRejected=$true;incompleteCloseRejected=$true;incompleteFontRemovalRejected=$true} | ConvertTo-Json -Depth 8
}

function Write-InventoryStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++; $script:lastStage=$Name; $script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$Name;status=$Status;error=$ErrorMessage;cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;ownedPresentationPath=$script:ownedPresentationPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $script:stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $script:progressFile -Encoding UTF8
}
function Write-InventoryReport { $script:report.cleanupConfirmed=$script:cleanupConfirmed; $script:report.officeOperationsStopped=$script:officeOperationsStopped; $script:report.lastStage=$script:lastStage; $script:report.lastStatus=$script:lastStatus; $script:report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $script:reportFile -Encoding UTF8 }
function Invoke-InventoryCom([string]$Name,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-InventoryStage $Name 'begin'
    try { $value=& $Operation; Write-InventoryStage $Name 'success'; return ,$value }
    catch { $script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-InventoryStage $Name 'error' $_.Exception.Message; throw }
}
function Test-InventoryPathEqual([string]$Left,[string]$Right) { return ([IO.Path]::GetFullPath($Left) -ieq [IO.Path]::GetFullPath($Right)) }
function Read-InventoryTextRange($Range,[string]$Prefix) {
    $text=Invoke-InventoryCom "$Prefix.text.get" {$Range.Text}
    $start=[int](Invoke-InventoryCom "$Prefix.start.get" {$Range.Start})
    $length=[int](Invoke-InventoryCom "$Prefix.length.get" {$Range.Length})
    $font=Invoke-InventoryCom "$Prefix.font.get" {return ,$Range.Font}
    $name=Invoke-InventoryCom "$Prefix.font.name.get" {$font.Name}
    $size=[double](Invoke-InventoryCom "$Prefix.font.size.get" {$font.Size})
    $bold=Invoke-InventoryCom "$Prefix.font.bold.get" {$font.Bold}
    $italic=Invoke-InventoryCom "$Prefix.font.italic.get" {$font.Italic}
    return ,([ordered]@{start=$start;text=$text;length=$length;font=[ordered]@{name=$name;size=$size;bold=$bold;italic=$italic}})
}
function Close-OwnedInventoryPresentation([string]$ExpectedPath) {
    if($null -eq $script:presentation -or [string]::IsNullOrWhiteSpace($script:ownedPresentationPath)) { throw 'No owned presentation is available for close' }
    $actual=Invoke-InventoryCom 'presentation.fullName-before-owned-close.get' {$script:presentation.FullName}
    if(-not (Test-InventoryPathEqual ([string]$actual) $ExpectedPath)) { throw "Refusing to close a presentation whose exact path is not owned: $actual" }
    Invoke-InventoryCom 'presentation.close-owned-snapshot' {$script:presentation.Close()}
    $script:presentation=$null; $script:ownedPresentationPath=$null; $script:cleanupConfirmed=$true; $script:report.ownedCloseCount=1
    Write-InventoryStage 'presentation.owned-close-confirmed' 'success'; Write-InventoryReport
}

if($PureRegression) { Invoke-InventoryPureRegression; return }
if($ValidateInputs) {
    try {
        $preflight=Read-InventoryCandidate $CandidateFixtureDirectory $FontFixtureDirectory
        [ordered]@{passed=$true;officeOrComCalls=0;candidatePptxSha256=$preflight.generation.source.presentationSha256;correctedGenerationSha256=(Get-InventorySha256 $preflight.generationPath);generatorSha256=$preflight.generation.generator.sha256;registryPackageCount=$preflight.registry.packages.Count;fontFaceCount=$preflight.fontInputs.Count;licenseSpdx=$preflight.fontGeneration.license.spdx;expectedText=$preflight.expectedText;expectedRuns=$preflight.expectedRuns;declaredConcreteFamilyCount=$preflight.generation.packageInspection.allConcreteTypefaces.Count;themeFallbackFamilies=$preflight.generation.packageInspection.concreteNonCarlitoTypefaces;nativeFontsGate='pending'} | ConvertTo-Json -Depth 12
        return
    } catch { [ordered]@{passed=$false;officeOrComCalls=0;error=$_.Exception.Message;scriptStackTrace=$_.ScriptStackTrace} | ConvertTo-Json -Depth 8; exit 1 }
}
if(-not $Worker) {
    foreach($required in @(@('OutputDirectory',$OutputDirectory),@('CandidateFixtureDirectory',$CandidateFixtureDirectory),@('FontFixtureDirectory',$FontFixtureDirectory))) { if([string]::IsNullOrWhiteSpace([string]$required[1])) { throw "$($required[0]) is required" } }
    $preflight=Read-InventoryCandidate $CandidateFixtureDirectory $FontFixtureDirectory
    $runRoot=[IO.Path]::GetFullPath($OutputDirectory)
    Assert-InventoryPathInside $preflight.resumeRoot $runRoot 'Output directory'
    if(Test-Path -LiteralPath $runRoot) { throw 'Preserve the previous attempt and use a fresh output directory' }
    [void](New-Item -ItemType Directory -Path $runRoot)
    $snapshotRoot=Join-Path $runRoot 'inputs'; [void](New-Item -ItemType Directory -Path $snapshotRoot); [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'font-fixture')); [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'font-fixture/fonts'))
    $sourceSnapshot=Join-Path $snapshotRoot 'source.pptx'; $sourceJsonSnapshot=Join-Path $snapshotRoot 'source.opf.json'; $generationSnapshot=Join-Path $snapshotRoot 'generation-corrected.json'; $generatorSnapshot=Join-Path $snapshotRoot 'generate.mjs'; $lockSnapshot=Join-Path $snapshotRoot 'registry-package-lock.json'
    $fontGenerationSnapshot=Join-Path $snapshotRoot 'font-fixture/generation.json'; $licenseSnapshot=Join-Path $snapshotRoot 'font-fixture/LICENSE_FONT'
    $workerSnapshot=Join-Path $snapshotRoot 'native-font-inventory.ps1'; $processOriginal=Get-InventoryFullPath (Join-Path $PSScriptRoot '..\sources\opf-pptx\test\native-process.ps1'); $processSnapshot=Join-Path $snapshotRoot 'native-process.ps1'; $fontHelperOriginal=Get-InventoryFullPath (Join-Path $PSScriptRoot '..\sources\opf-pptx\test\native-text-fonts.ps1'); $fontHelperSnapshot=Join-Path $snapshotRoot 'native-text-fonts.ps1'
    $copyPairs=@(
        [pscustomobject]@{source=$preflight.sourcePath;destination=$sourceSnapshot},
        [pscustomobject]@{source=$preflight.sourceJsonPath;destination=$sourceJsonSnapshot},
        [pscustomobject]@{source=$preflight.generationPath;destination=$generationSnapshot},
        [pscustomobject]@{source=$preflight.generatorPath;destination=$generatorSnapshot},
        [pscustomobject]@{source=$preflight.registry.lockfilePath;destination=$lockSnapshot},
        [pscustomobject]@{source=$preflight.fontGenerationPath;destination=$fontGenerationSnapshot},
        [pscustomobject]@{source=$preflight.licensePath;destination=$licenseSnapshot},
        [pscustomobject]@{source=$PSCommandPath;destination=$workerSnapshot},
        [pscustomobject]@{source=$processOriginal;destination=$processSnapshot},
        [pscustomobject]@{source=$fontHelperOriginal;destination=$fontHelperSnapshot}
    )
    foreach($copy in $copyPairs) { Copy-Item -LiteralPath $copy.source -Destination $copy.destination }
    $fontSnapshots=@()
    foreach($font in $preflight.fontInputs) { $snapshot=Join-Path $snapshotRoot ('font-fixture/'+$font.file); Copy-Item -LiteralPath $font.path -Destination $snapshot; $fontSnapshots+=@([ordered]@{file=$font.file;path=$font.path;sha256=$font.sha256;snapshotPath=$snapshot;snapshotSha256=(Get-InventorySha256 $snapshot)}) }
    $inputs=@(
        [ordered]@{role='candidate PPTX';sourcePath=$preflight.sourcePath;sha256=$preflight.generation.source.presentationSha256;snapshotPath=$sourceSnapshot},
        [ordered]@{role='candidate OPF source';sourcePath=$preflight.sourceJsonPath;sha256=$preflight.generation.source.sha256;snapshotPath=$sourceJsonSnapshot},
        [ordered]@{role='corrected generation report';sourcePath=$preflight.generationPath;sha256=(Get-InventorySha256 $preflight.generationPath);snapshotPath=$generationSnapshot},
        [ordered]@{role='candidate generator';sourcePath=$preflight.generatorPath;sha256=$preflight.generation.generator.sha256;snapshotPath=$generatorSnapshot},
        [ordered]@{role='consumer lockfile';sourcePath=$preflight.registry.lockfilePath;sha256=$preflight.registry.lockfileSha256;snapshotPath=$lockSnapshot},
        [ordered]@{role='licensed Carlito generation';sourcePath=$preflight.fontGenerationPath;sha256=(Get-InventorySha256 $preflight.fontGenerationPath);snapshotPath=$fontGenerationSnapshot},
        [ordered]@{role='Carlito license';sourcePath=$preflight.licensePath;sha256=$preflight.fontGeneration.license.sha256;snapshotPath=$licenseSnapshot},
        [ordered]@{role='worker verifier';sourcePath=$PSCommandPath;sha256=(Get-InventorySha256 $PSCommandPath);snapshotPath=$workerSnapshot},
        [ordered]@{role='owned worker process helper';sourcePath=$processOriginal;sha256=(Get-InventorySha256 $processOriginal);snapshotPath=$processSnapshot},
        [ordered]@{role='owned font registration helper';sourcePath=$fontHelperOriginal;sha256=(Get-InventorySha256 $fontHelperOriginal);snapshotPath=$fontHelperSnapshot}
    )
    foreach($font in $fontSnapshots) { $inputs+=@([ordered]@{role="Carlito face $($font.file)";sourcePath=$font.path;sha256=$font.sha256;snapshotPath=$font.snapshotPath}) }
    $expectations=[ordered]@{text=$preflight.expectedText;runs=$preflight.expectedRuns;permittedReportedFontNames=@('Carlito','Carlito Bold','Carlito Italic','Carlito Bold Italic');maxFontEntries=64}
    $request=[ordered]@{
        schemaVersion=1
        source=[ordered]@{path=$preflight.sourcePath;sha256=$preflight.generation.source.presentationSha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-InventorySha256 $sourceSnapshot)}
        candidate=[ordered]@{generationPath=$preflight.generationPath;generationSha256=(Get-InventorySha256 $preflight.generationPath);generationSnapshotPath=$generationSnapshot;generatorPath=$preflight.generatorPath;generatorSha256=$preflight.generation.generator.sha256;generatorSnapshotPath=$generatorSnapshot;sourceJsonPath=$preflight.sourceJsonPath;sourceJsonSha256=$preflight.generation.source.sha256;sourceJsonSnapshotPath=$sourceJsonSnapshot}
        registryBindings=$preflight.registry
        fontFixture=[ordered]@{root=$preflight.fontRoot;generationPath=$preflight.fontGenerationPath;generationSha256=(Get-InventorySha256 $preflight.fontGenerationPath);generationSnapshotPath=$fontGenerationSnapshot;licensePath=$preflight.licensePath;licenseSha256=$preflight.fontGeneration.license.sha256;licenseSnapshotPath=$licenseSnapshot;fonts=$fontSnapshots;registrationFlags=0;package=$preflight.fontGeneration.package;license=$preflight.fontGeneration.license}
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-InventorySha256 $PSCommandPath);snapshotPath=$workerSnapshot;snapshotSha256=(Get-InventorySha256 $workerSnapshot)}
        processHelper=[ordered]@{path=$processOriginal;sha256=(Get-InventorySha256 $processOriginal);snapshotPath=$processSnapshot;snapshotSha256=(Get-InventorySha256 $processSnapshot)}
        fontHelper=[ordered]@{path=$fontHelperOriginal;sha256=(Get-InventorySha256 $fontHelperOriginal);snapshotPath=$fontHelperSnapshot;snapshotSha256=(Get-InventorySha256 $fontHelperSnapshot)}
        expectations=$expectations;inputs=$inputs
        scope='Read-only registry candidate, exact source snapshots, and temporary parent-owned Carlito session registration. This binds package manifest/entrypoint/lock records, not every transitive installed byte.'
    }
    $requestPath=Join-Path $runRoot 'request.json'; $request | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $requestPath -Encoding UTF8
    $fontSnapshotRoot=Join-Path $snapshotRoot 'font-fixture'
    . $processSnapshot; . $fontHelperSnapshot
    $fontGeneration=Get-InventoryJson $fontGenerationSnapshot; $script:inventoryWorkerResult=$null; $parentFailure=$null
    try {
        Invoke-OpfWithTemporaryFonts -Generation $fontGeneration -EvidenceRoot $fontSnapshotRoot -RunRoot $runRoot -Action {
            $script:inventoryWorkerResult=Invoke-OpfNativeWorker -ScriptPath $workerSnapshot -WorkerArguments @('-OutputDirectory',$runRoot,'-Worker') -OutputDirectory $runRoot -TimeoutSeconds $TimeoutSeconds
        }
    } catch { $parentFailure=$_.Exception.Message }
    $workerResult=$script:inventoryWorkerResult; $workerReport=$null; $reportPath=Join-Path $runRoot 'report.json'
    if(Test-Path -LiteralPath $reportPath) { try {$workerReport=Get-InventoryJson $reportPath} catch {$parentFailure="Unreadable worker report: $($_.Exception.Message)"} }
    $lastDurable=$null; $progressPath=Join-Path $runRoot 'progress.json'
    if(Test-Path -LiteralPath $progressPath) { try {$lastDurable=Get-InventoryJson $progressPath} catch {} }
    $registrations=@(); $registrationPath=Join-Path $runRoot 'font-registration.json'
    if(Test-Path -LiteralPath $registrationPath) { try {$registrations=ConvertFrom-InventoryRegistrationJson (Get-Content -LiteralPath $registrationPath -Raw -Encoding UTF8)} catch {$parentFailure="Unreadable font-registration.json: $($_.Exception.Message)"} }
    $fontCleanupConfirmed=Test-InventoryFontCleanup $registrations
    $inputChecks=Get-InventoryInputChecks $request
    try { $after=Read-InventoryCandidate $CandidateFixtureDirectory $FontFixtureDirectory; $inputsUnchanged=(@($inputChecks | Where-Object {-not $_.matched}).Count -eq 0) } catch { $inputsUnchanged=$false; $parentFailure="Post-run input verification failed: $($_.Exception.Message)" }
    $decision=Get-InventoryParentDecision $workerResult $lastDurable $workerReport $fontCleanupConfirmed $inputsUnchanged
    $supervisor=[ordered]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');timeoutSeconds=$TimeoutSeconds;timedOut=[bool]$decision.timedOut;exitCode=$(if($null -eq $workerResult){$null}else{$workerResult.exitCode});lifecycleComplete=[bool]$decision.lifecycleComplete;contentGatePassed=[bool]$decision.contentGatePassed;nativeFontsGatePassed=[bool]$decision.nativeFontsGatePassed;fontCleanupConfirmed=$fontCleanupConfirmed;inputsUnchanged=$inputsUnchanged;ownedCloseCount=$(if($null -eq $workerReport){0}else{$workerReport.ownedCloseCount});lastDurableStage=$(if($null -eq $lastDurable){$null}else{$lastDurable.stage});lastDurableStatus=$(if($null -eq $lastDurable){$null}else{$lastDurable.status});parentError=$parentFailure;inputChecks=$inputChecks;fontRegistrations=$registrations}
    $supervisor | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $runRoot 'supervisor.json') -Encoding UTF8
    if(Test-Path -LiteralPath (Join-Path $runRoot 'worker.stdout.log')) { Get-Content -LiteralPath (Join-Path $runRoot 'worker.stdout.log') | ForEach-Object {Write-Host $_} }
    Assert-InventoryParentSuccess $decision $workerResult $parentFailure
    return
}

if(-not $Worker -or [string]::IsNullOrWhiteSpace($OutputDirectory)) { throw 'Worker mode requires OutputDirectory and is not a general-purpose Office runner' }
$workerRoot=Get-InventoryFullPath $OutputDirectory
$request=Get-InventoryJson (Join-Path $workerRoot 'request.json')
Assert-InventoryInputsUnchanged $request
if((Get-InventorySha256 $PSCommandPath) -cne $request.verifier.sha256 -or (Get-InventorySha256 $request.verifier.snapshotPath) -cne $request.verifier.sha256) { throw 'Executing worker or verifier snapshot hash changed' }
if((Get-InventorySha256 $request.source.snapshotPath) -cne $request.source.sha256) { throw 'Worker source snapshot hash changed' }
if((Get-InventorySha256 $request.candidate.generationSnapshotPath) -cne $request.candidate.generationSha256 -or (Get-InventorySha256 $request.candidate.sourceJsonSnapshotPath) -cne $request.candidate.sourceJsonSha256 -or (Get-InventorySha256 $request.candidate.generatorSnapshotPath) -cne $request.candidate.generatorSha256) { throw 'Candidate report/source/generator snapshot changed' }
if((Get-InventorySha256 $request.fontFixture.generationSnapshotPath) -cne $request.fontFixture.generationSha256 -or (Get-InventorySha256 $request.fontFixture.licenseSnapshotPath) -cne $request.fontFixture.licenseSha256) { throw 'Carlito generation/license snapshot changed' }
foreach($font in @($request.fontFixture.fonts)) { if((Get-InventorySha256 $font.snapshotPath) -cne $font.sha256) { throw "Carlito font snapshot changed: $($font.file)" } }
foreach($helper in @($request.processHelper,$request.fontHelper)) { if((Get-InventorySha256 $helper.path) -cne $helper.sha256 -or (Get-InventorySha256 $helper.snapshotPath) -cne $helper.sha256) { throw 'A pinned process/font helper or snapshot changed' } }
if([int]$request.fontFixture.registrationFlags -ne 0 -or @($request.fontFixture.fonts).Count -ne 4) { throw 'Expected exactly four parent-owned Carlito registrations with flags 0' }

$script:sequence=0; $script:lastStage='worker.initialize'; $script:lastStatus='begin'; $script:cleanupConfirmed=$true; $script:officeOperationsStopped=$false; $script:ownedPresentationPath=$null; $script:presentation=$null; $script:app=$null
$script:stageFile=Join-Path $workerRoot 'stages.jsonl'; $script:progressFile=Join-Path $workerRoot 'progress.json'; $script:reportFile=Join-Path $workerRoot 'report.json'
foreach($reserved in @($script:stageFile,$script:progressFile,$script:reportFile)) { if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve the attempt and do not retry in it' } }
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$script:report=[ordered]@{
    schemaVersion=1
    scope='One read-only native PowerPoint Presentation.Fonts enumeration and a bounded current-content/rich-run observation; no edit, save, embedding, reopen, renderer, PDF, or application quit.'
    source=[ordered]@{path=$request.source.path;sha256=$request.source.sha256;snapshotPath=$request.source.snapshotPath;snapshotSha256=$request.source.snapshotSha256;openedPathMatches=$false;fullName=$null;readOnly=$null;unchanged=$null}
    candidate=[ordered]@{generationSha256=$request.candidate.generationSha256;generatorSha256=$request.candidate.generatorSha256;sourceJsonSha256=$request.candidate.sourceJsonSha256;registryBindings=$request.registryBindings}
    fontFixture=[ordered]@{package=$request.fontFixture.package;license=$request.fontFixture.license;registrationFlags=$request.fontFixture.registrationFlags;exactPermittedFaces=@($request.fontFixture.fonts | ForEach-Object {[ordered]@{file=$_.file;sha256=$_.sha256}})}
    openedDocument=[ordered]@{slideCount=$null;shapeCount=$null;shapeName=$null;shapeType=$null;hasTextFrame=$false;text=$null;textLength=$null}
    authoredRuns=@()
    nativeFontsObservation=[ordered]@{count=$null;entries=@()}
    contentGate=$null;nativeFontsGate=$null;ownedCloseCount=0
    environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null;powerPointExecutable=$null;powerPointBuild=$null;powerPointExecutableSha256=$null}
    cleanupConfirmed=$true;officeOperationsStopped=$false;lastStage='worker.initialize';lastStatus='begin';error=$null
    limitations=@('Presentation.Fonts Name/Embeddable/Embedded values are reported native attributes, not proof of physical face or per-glyph identity.','Theme/XML supplemental fallback declarations in the source may exceed Carlito; this gate observes the native collection and accepts only the documented Carlito family/style names.','This does not test font embedding, persistence, reopen, or renderer/native visual equivalence.')
}
Write-InventoryReport; Write-InventoryStage 'worker.initialize' 'success'
try {
    $script:app=Invoke-InventoryCom 'application.create' {return ,(New-Object -ComObject PowerPoint.Application)}
    $officeVersion=Invoke-InventoryCom 'application.version.get' {$script:app.Version}
    $officeDirectory=Invoke-InventoryCom 'application.path.get' {$script:app.Path}
    $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $script:report.environment.powerPointVersion=$officeVersion; $script:report.environment.powerPointExecutable=$officeExecutable
    if(Test-Path -LiteralPath $officeExecutable) { $script:report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion; $script:report.environment.powerPointExecutableSha256=Get-InventorySha256 $officeExecutable }
    $presentations=Invoke-InventoryCom 'application.presentations.get' {return ,$script:app.Presentations}
    $existingCount=[int](Invoke-InventoryCom 'application.presentations.count.get' {$presentations.Count})
    if($existingCount -ne 0) { throw "A PowerPoint session already has $existingCount open presentations; worker refuses to inspect unrelated documents" }
    $script:cleanupConfirmed=$false; $script:report.cleanupConfirmed=$false; Write-InventoryReport
    $script:presentation=Invoke-InventoryCom 'presentation.open-readonly-snapshot' {return ,$presentations.Open($request.source.snapshotPath,-1,0,0)}
    $fullName=Invoke-InventoryCom 'presentation.fullName.get' {$script:presentation.FullName}
    $pathMatches=Test-InventoryPathEqual ([string]$fullName) ([string]$request.source.snapshotPath)
    if(-not $pathMatches) { throw "Opened presentation path does not match the exact owned snapshot: $fullName" }
    $script:ownedPresentationPath=[string]$request.source.snapshotPath
    $readOnly=Invoke-InventoryCom 'presentation.readOnly.get' {$script:presentation.ReadOnly}
    $script:report.source.fullName=$fullName; $script:report.source.openedPathMatches=$pathMatches; $script:report.source.readOnly=([bool]$readOnly -or [int]$readOnly -eq -1)
    $slides=Invoke-InventoryCom 'presentation.slides.get' {return ,$script:presentation.Slides}
    $slideCount=[int](Invoke-InventoryCom 'presentation.slides.count.get' {$slides.Count}); $script:report.openedDocument.slideCount=$slideCount
    if($slideCount -eq 1) {
        $slide=Invoke-InventoryCom 'presentation.slide-1.get' {return ,$slides.Item(1)}
        $shapes=Invoke-InventoryCom 'slide.shapes.get' {return ,$slide.Shapes}
        $shapeCount=[int](Invoke-InventoryCom 'slide.shapes.count.get' {$shapes.Count}); $script:report.openedDocument.shapeCount=$shapeCount
        if($shapeCount -eq 1) {
            $shape=Invoke-InventoryCom 'slide.shape-1.get' {return ,$shapes.Item(1)}
            $shapeName=Invoke-InventoryCom 'slide.shape-1.name.get' {$shape.Name}; $shapeType=Invoke-InventoryCom 'slide.shape-1.type.get' {$shape.Type}; $hasTextFrame=Invoke-InventoryCom 'slide.shape-1.hasTextFrame.get' {$shape.HasTextFrame}
            $script:report.openedDocument.shapeName=$shapeName; $script:report.openedDocument.shapeType=$shapeType; $script:report.openedDocument.hasTextFrame=([bool]$hasTextFrame -or [int]$hasTextFrame -eq -1)
            if($script:report.openedDocument.hasTextFrame) {
                $frame=Invoke-InventoryCom 'shape.textFrame2.get' {return ,$shape.TextFrame2}
                $range=Invoke-InventoryCom 'shape.textRange2.get' {return ,$frame.TextRange}
                $wholeText=Invoke-InventoryCom 'shape.current-text.get' {$range.Text}; $wholeStart=[int](Invoke-InventoryCom 'shape.current-text.start.get' {$range.Start}); $wholeLength=[int](Invoke-InventoryCom 'shape.current-text.length.get' {$range.Length})
                $script:report.openedDocument.text=$wholeText; $script:report.openedDocument.textStart=$wholeStart; $script:report.openedDocument.textLength=$wholeLength
                $lastExpected=$request.expectations.runs[-1]
                if($wholeLength -ge ([int]$lastExpected.start+[int]$lastExpected.length-1)) {
                    foreach($run in @($request.expectations.runs)) {
                        $runRange=Invoke-InventoryCom "shape.authored-run-$($run.index).characters.get" {return ,$range.Characters([int]$run.start,[int]$run.length)}
                        $observed=Read-InventoryTextRange $runRange "shape.authored-run-$($run.index)"
                        $observed.expectedStart=[int]$run.start; $observed.expectedLength=[int]$run.length
                        $script:report.authoredRuns+=@($observed)
                    }
                } else {
                    $script:report.authoredRuns=@([ordered]@{skipped=$true;reason='Whole text range is shorter than the final expected authored run; no out-of-range COM character query attempted.'})
                }
            }
        }
    }
    $fontCollection=Invoke-InventoryCom 'presentation.fonts.get' {return ,$script:presentation.Fonts}
    $fontCount=[int](Invoke-InventoryCom 'presentation.fonts.count.get' {$fontCollection.Count})
    $script:report.nativeFontsObservation.count=$fontCount
    if($fontCount -ge 1 -and $fontCount -le [int]$request.expectations.maxFontEntries) {
        for($index=1;$index -le $fontCount;$index++) {
            $font=Invoke-InventoryCom "presentation.fonts.item-$index.get" {return ,$fontCollection.Item($index)}
            $name=Invoke-InventoryCom "presentation.fonts.item-$index.name.get" {$font.Name}
            $embedded=Invoke-InventoryCom "presentation.fonts.item-$index.embedded.get" {$font.Embedded}
            $embeddable=Invoke-InventoryCom "presentation.fonts.item-$index.embeddable.get" {$font.Embeddable}
            $script:report.nativeFontsObservation.entries+=@([ordered]@{index=$index;name=[string]$name;embedded=$embedded;embeddable=$embeddable})
        }
    }
    Close-OwnedInventoryPresentation ([string]$request.source.snapshotPath)
    $script:report.source.unchanged=((Get-InventorySha256 $request.source.path) -ceq $request.source.sha256 -and (Get-InventorySha256 $request.source.snapshotPath) -ceq $request.source.sha256)
    $observation=[ordered]@{openedPathMatches=$script:report.source.openedPathMatches;sourceSnapshotPath=$request.source.snapshotPath;fullName=$script:report.source.fullName;readOnly=$script:report.source.readOnly;slideCount=$script:report.openedDocument.slideCount;shapeCount=$script:report.openedDocument.shapeCount;hasTextFrame=$script:report.openedDocument.hasTextFrame;text=$script:report.openedDocument.text;textStart=$script:report.openedDocument.textStart;textLength=$script:report.openedDocument.textLength;runs=$script:report.authoredRuns}
    $script:report.contentGate=Get-InventoryContentGate $observation $request.expectations
    $script:report.nativeFontsGate=Get-InventoryFontGate $script:report.nativeFontsObservation
    Write-InventoryStage 'worker.complete' 'success'; Write-InventoryReport
    Write-Output 'Read-only native font inventory completed; content and allowlist gates are recorded in report.json.'
} catch {
    $script:report.error=$_.Exception.Message
    if($script:officeOperationsStopped -or $null -ne $script:presentation) { $script:cleanupConfirmed=$false }
    Write-InventoryStage 'worker.failure' 'error' $_.Exception.Message; Write-InventoryReport
    throw
}
