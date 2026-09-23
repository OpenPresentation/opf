param(
    [string]$OutputDirectory,
    [string]$InputPresentation,
    [string]$FontFixtureDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$PureRegression
)
$ErrorActionPreference='Stop'

function Get-FontEmbedSha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Read-FontEmbedRegistrations([string]$Path) { $parsed=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json; return ,@($parsed) }
function Assert-FontEmbedHash([string]$Value,[string]$Context) { if($Value -notmatch '^[0-9a-f]{64}$') { throw "$Context must be a lowercase SHA-256" } }
function Test-FontEmbedInteger($Value) { return ($Value -is [int]) -or ($Value -is [long]) }
$script:fontEmbedLicenseSha256='58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00'
$script:fontEmbedCanonicalFaces=[ordered]@{
    'fonts/Carlito-400-normal.ttf'='ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89'
    'fonts/Carlito-400-italic.ttf'='074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5'
    'fonts/Carlito-700-normal.ttf'='51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0'
    'fonts/Carlito-700-italic.ttf'='25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691'
}
$script:fontEmbedAllowedNativeNames=@('Carlito','Carlito Bold','Carlito Italic','Carlito Bold Italic')

function Assert-FontEmbedCanonicalGeneration($Generation) {
    if($Generation.kind -cne 'native-font-edit-fixture') { throw 'generation.kind must be native-font-edit-fixture' }
    if($null -eq $Generation.source -or $Generation.source.file -cne 'source.pptx') { throw 'generation.source.file must be source.pptx' }
    Assert-FontEmbedHash ([string]$Generation.source.sha256) 'generation.source.sha256'
    if($null -eq $Generation.license -or $Generation.license.file -cne 'LICENSE_FONT' -or $Generation.license.spdx -cne 'OFL-1.1' -or $Generation.license.sha256 -cne $script:fontEmbedLicenseSha256) { throw 'generation.license must bind the canonical OFL-1.1 license' }
    if($null -eq $Generation.registration -or $null -eq $Generation.registration.PSObject.Properties['flags'] -or -not (Test-FontEmbedInteger $Generation.registration.flags) -or $Generation.registration.flags -ne 0) { throw 'generation.registration.flags must be the JSON integer 0' }
    $fonts=@($Generation.fonts)
    if($fonts.Count -ne $script:fontEmbedCanonicalFaces.Count) { throw 'generation.fonts must contain exactly four canonical Carlito faces' }
    $seen=@{}
    foreach($font in $fonts) {
        $file=[string]$font.file; $hash=[string]$font.sha256
        if(-not $script:fontEmbedCanonicalFaces.Contains($file) -or $seen.ContainsKey($file)) { throw "Invalid or duplicate generation font path: $file" }
        if($hash -cne [string]$script:fontEmbedCanonicalFaces[$file]) { throw "Generation font hash is not the canonical permitted Carlito face: $file" }
        $seen[$file]=$true
    }
    foreach($file in $script:fontEmbedCanonicalFaces.Keys) { if(-not $seen.ContainsKey($file)) { throw "Missing canonical fixture font: $file" } }
}

function Assert-FontEmbedFileHash([string]$Path,[string]$Expected,[string]$Context) {
    if((Get-FontEmbedSha256 $Path) -cne $Expected) { throw "$Context hash differs from the canonical permitted value" }
}

function Test-FontEmbedMember($Object,[string]$Name) {
    if($null -eq $Object) { return $false }
    if($Object -is [System.Collections.IDictionary]) { return $Object.Contains($Name) }
    return $null -ne $Object.PSObject.Properties[$Name]
}
function Get-FontEmbedMember($Object,[string]$Name) {
    if($Object -is [System.Collections.IDictionary]) { return $Object[$Name] }
    return $Object.PSObject.Properties[$Name].Value
}

function Get-FontEmbedNativeFontsGate($Observation) {
    $entries=@($(if(Test-FontEmbedMember $Observation 'entries'){Get-FontEmbedMember $Observation 'entries'}else{@()}))
    $countValue=$(if(Test-FontEmbedMember $Observation 'count'){Get-FontEmbedMember $Observation 'count'}else{$null})
    $countIsInteger=Test-FontEmbedInteger $countValue
    $count=$(if($countIsInteger){[long]$countValue}else{-1})
    $entryTypesValid=$true
    foreach($entry in $entries) {
        $hasName=Test-FontEmbedMember $entry 'name'; $hasEmbedded=Test-FontEmbedMember $entry 'embedded'; $hasEmbeddable=Test-FontEmbedMember $entry 'embeddable'
        $name=$(if($hasName){Get-FontEmbedMember $entry 'name'}else{$null}); $embedded=$(if($hasEmbedded){Get-FontEmbedMember $entry 'embedded'}else{$null}); $embeddable=$(if($hasEmbeddable){Get-FontEmbedMember $entry 'embeddable'}else{$null})
        if(-not $hasName -or -not ($name -is [string]) -or [string]::IsNullOrEmpty($name) -or -not $hasEmbedded -or -not (Test-FontEmbedInteger $embedded) -or -not $hasEmbeddable -or -not (Test-FontEmbedInteger $embeddable)) { $entryTypesValid=$false }
    }
    $countValid=($countIsInteger -and $entryTypesValid -and $count -ge 1 -and $count -le 64 -and $count -eq $entries.Count)
    $unexpected=@($entries | Where-Object {$name=Get-FontEmbedMember $_ 'name'; -not ($name -is [string]) -or $script:fontEmbedAllowedNativeNames -cnotcontains $name} | ForEach-Object {[string](Get-FontEmbedMember $_ 'name')})
    $unembeddable=@($entries | Where-Object {$value=Get-FontEmbedMember $_ 'embeddable'; -not (Test-FontEmbedInteger $value) -or $value -ne (-1)} | ForEach-Object {[string](Get-FontEmbedMember $_ 'name')})
    $baseFamilyPresent=@($entries | Where-Object {(Get-FontEmbedMember $_ 'name') -is [string] -and (Get-FontEmbedMember $_ 'name') -ceq 'Carlito'}).Count -ge 1
    return ,([ordered]@{
        passed=($countValid -and $baseFamilyPresent -and $unexpected.Count -eq 0 -and $unembeddable.Count -eq 0)
        reportedCount=$count;entryCount=$entries.Count;countValid=$countValid;baseFamilyPresent=$baseFamilyPresent
        allowedReportedNames=$script:fontEmbedAllowedNativeNames;unexpectedNames=$unexpected;unembeddableNames=$unembeddable;entries=$entries
        scope='Exact Presentation.Fonts Name values and native Embeddable flags are a fail-closed semantic gate. They do not prove physical font-file or per-glyph identity.'
    })
}

function Test-FontEmbedSaveAsPathArgument($Argument) {
    return ($Argument -is [System.Management.Automation.Language.VariableExpressionAst]) -and ($Argument.VariablePath.UserPath -ceq 'savedPath')
}
function Get-FontEmbedNumericLiteralValue($Argument) {
    while($Argument -is [System.Management.Automation.Language.ParenExpressionAst]) {
        $elements=@($Argument.Pipeline.PipelineElements)
        if($elements.Count -ne 1) { return $null }
        $Argument=$elements[0].Expression
    }
    if($Argument -is [System.Management.Automation.Language.ConstantExpressionAst]) { return [int]$Argument.Value }
    if($Argument -is [System.Management.Automation.Language.UnaryExpressionAst]) {
        if($Argument.TokenKind -ne [System.Management.Automation.Language.TokenKind]::Minus) { return $null }
        $child=$Argument.Child
        if($child -is [System.Management.Automation.Language.ConstantExpressionAst]) { return -([int]$child.Value) }
    }
    return $null
}
function Test-FontEmbedSaveAsNumericArgument($Argument,[int]$Expected) {
    $value=Get-FontEmbedNumericLiteralValue $Argument
    return ($null -ne $value) -and ($value -eq $Expected)
}
function Get-FontEmbedOwnedSaveAsEmbedArgument($Invoke) {
    if(-not ($Invoke.Member -is [System.Management.Automation.Language.StringConstantExpressionAst]) -or $Invoke.Member.Value -cne 'SaveAs') { return $null }
    $arguments=@($Invoke.Arguments)
    if($arguments.Count -ne 3) { return $null }
    if(-not (Test-FontEmbedSaveAsPathArgument $arguments[0])) { return $null }
    if(-not (Test-FontEmbedSaveAsNumericArgument $arguments[1] 24)) { return $null }
    $embed=Get-FontEmbedNumericLiteralValue $arguments[2]
    if($null -eq $embed -or ($embed -ne 0 -and $embed -ne (-1))) { return $null }
    return $embed
}
function Assert-FontEmbedVerifierAst([string]$Path) {
    $tokens=$null; $parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Verifier parse failed: $($parseErrors[0].Message)" }
    foreach($invoke in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst]},$true)) {
        $member=$invoke.Member
        if($member -is [System.Management.Automation.Language.StringConstantExpressionAst] -and $member.Value -ceq 'Quit') { throw 'Embed harness must not invoke .Quit() on an Office application' }
    }
    $embedOn=0; $embedOff=0
    foreach($invoke in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst]},$true)) {
        $embedArgument=Get-FontEmbedOwnedSaveAsEmbedArgument $invoke
        if($null -eq $embedArgument) { continue }
        if($embedArgument -eq (-1)) { $embedOn++ } elseif($embedArgument -eq 0) { $embedOff++ }
    }
    if($embedOff -gt 0) { throw 'Embed harness must not call SaveAs with EmbedFonts 0' }
    if($embedOn -ne 1) { throw 'Embed harness must call SaveAs with EmbedFonts -1 (msoTrue) exactly once on $savedPath' }
    return $ast
}
function Invoke-FontEmbedPureRegression {
    $ast=Assert-FontEmbedVerifierAst $PSCommandPath
    $definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true))
    $stageDefinition=@($definitions | Where-Object {$_.Name -ceq 'Write-FontEmbedStage'})
    $comDefinition=@($definitions | Where-Object {$_.Name -ceq 'Invoke-FontEmbedCom'})
    if($stageDefinition.Count -ne 1) { throw 'Expected exactly one Write-FontEmbedStage definition' }
    if($comDefinition.Count -ne 1) { throw 'Expected exactly one Invoke-FontEmbedCom definition' }
    $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
    $pureRoot=Join-Path $tempRoot ('opf-font-embed-pure-' + [Guid]::NewGuid().ToString('n'))
    [void](New-Item -ItemType Directory -Path $pureRoot); $pureRoot=(Resolve-Path -LiteralPath $pureRoot).Path
    if(-not $pureRoot.StartsWith($tempRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Pure regression directory escaped the system temporary directory' }
    try {
        $script:stageFile=Join-Path $pureRoot 'stages.jsonl'
        $script:progressFile=Join-Path $pureRoot 'progress.json'
        $script:sequence=0
        Invoke-Expression $stageDefinition[0].Extent.Text
        Invoke-Expression $comDefinition[0].Extent.Text
        $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true
        [void](Invoke-FontEmbedCom 'pure.success' { 1 })
        $failureCaught=$false
        try { Invoke-FontEmbedCom 'pure.failure' { throw 'Deliberate non-Office failure' } } catch { $failureCaught=$true }
        if(-not $failureCaught -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw 'COM failure latch did not engage or cleanup remained misleadingly confirmed' }
        $script:unexpectedCall=$false
        try { Invoke-FontEmbedCom 'pure.forbidden-followup' { $script:unexpectedCall=$true } } catch { }
        if($script:unexpectedCall) { throw 'Operation ran after the failure latch' }
        $stageLines=@(Get-Content -LiteralPath $script:stageFile -Encoding UTF8)
        $stageRecords=@($stageLines | ForEach-Object { $_ | ConvertFrom-Json })
        if(($stageRecords | ForEach-Object { "$($_.stage)/$($_.status)" }) -join ',' -cne 'pure.success/begin,pure.success/success,pure.failure/begin,pure.failure/error') { throw 'Unexpected pure stage sequence' }
        if(@($stageLines[0..2] | Where-Object { $_ -notmatch '"error":null,' }).Count -ne 0) { throw 'Non-error stage records must serialize error as JSON null' }
        if($stageRecords[3].error -cne 'Deliberate non-Office failure') { throw 'Error stage record lost its message' }
        $canonicalFonts=@($script:fontEmbedCanonicalFaces.Keys | ForEach-Object {[pscustomobject]@{file=$_;sha256=$script:fontEmbedCanonicalFaces[$_]}})
        $validGeneration=[pscustomobject]@{kind='native-font-edit-fixture';source=[pscustomobject]@{file='source.pptx';sha256=('0'*64)};license=[pscustomobject]@{file='LICENSE_FONT';spdx='OFL-1.1';sha256=$script:fontEmbedLicenseSha256};registration=[pscustomobject]@{flags=0};fonts=$canonicalFonts}
        Assert-FontEmbedCanonicalGeneration $validGeneration
        $wrongGeneration=[pscustomobject]@{kind='native-font-edit-fixture';source=$validGeneration.source;license=$validGeneration.license;registration=$validGeneration.registration;fonts=@($canonicalFonts | ForEach-Object {[pscustomobject]@{file=$_.file;sha256=$_.sha256}})}
        $wrongGeneration.fonts[0].sha256=('f'*64); $wrongHashRejected=$false
        try { Assert-FontEmbedCanonicalGeneration $wrongGeneration } catch { $wrongHashRejected=$true }
        $missingFlags=[pscustomobject]@{kind='native-font-edit-fixture';source=$validGeneration.source;license=$validGeneration.license;registration=[pscustomobject]@{};fonts=$canonicalFonts}; $missingFlagsRejected=$false
        try { Assert-FontEmbedCanonicalGeneration $missingFlags } catch { $missingFlagsRejected=$true }
        $stringFlags=[pscustomobject]@{kind='native-font-edit-fixture';source=$validGeneration.source;license=$validGeneration.license;registration=[pscustomobject]@{flags='0'};fonts=$canonicalFonts}; $stringFlagsRejected=$false
        try { Assert-FontEmbedCanonicalGeneration $stringFlags } catch { $stringFlagsRejected=$true }
        $wrongLicense=Join-Path $pureRoot 'wrong-license.txt'; [IO.File]::WriteAllText($wrongLicense,'not the OFL fixture license')
        $wrongLicenseRejected=$false; try { Assert-FontEmbedFileHash $wrongLicense $script:fontEmbedLicenseSha256 'Carlito OFL license' } catch { $wrongLicenseRejected=$true }
        $goodGate=Get-FontEmbedNativeFontsGate ([pscustomobject]@{count=1;entries=@([pscustomobject]@{name='Carlito';embedded=0;embeddable=-1})})
        $badGate=Get-FontEmbedNativeFontsGate ([pscustomobject]@{count=2;entries=@([pscustomobject]@{name='Carlito';embedded=0;embeddable=-1},[pscustomobject]@{name='Aptos';embedded=0;embeddable=-1})})
        $orderedGoodGate=Get-FontEmbedNativeFontsGate ([ordered]@{count=1;entries=@([ordered]@{name='Carlito';embedded=0;embeddable=-1})})
        $orderedBadGate=Get-FontEmbedNativeFontsGate ([ordered]@{count=2;entries=@([ordered]@{name='Carlito';embedded=0;embeddable=-1},[ordered]@{name='Aptos';embedded=0;embeddable=-1})})
        $stringCountGate=Get-FontEmbedNativeFontsGate ([pscustomobject]@{count='1';entries=@([pscustomobject]@{name='Carlito';embedded=0;embeddable=-1})})
        $stringFlagGate=Get-FontEmbedNativeFontsGate ([pscustomobject]@{count=1;entries=@([pscustomobject]@{name='Carlito';embedded='0';embeddable='-1'})})
        if(-not $wrongHashRejected -or -not $missingFlagsRejected -or -not $stringFlagsRejected -or -not $wrongLicenseRejected -or -not $goodGate.passed -or $badGate.passed -or $badGate.unexpectedNames -cnotcontains 'Aptos' -or -not $orderedGoodGate.passed -or $orderedBadGate.passed -or $orderedBadGate.unexpectedNames -cnotcontains 'Aptos' -or $stringCountGate.passed -or $stringFlagGate.passed) { throw 'Canonical provenance or native Fonts negative controls failed' }
        [ordered]@{passed=$true;officeOrComCalls=0;embedSaveArgument=(-1);noEmbedFontsZero=$true;canonicalHashRejected=$wrongHashRejected;wrongLicenseRejected=$wrongLicenseRejected;strictRegistrationFlagsRejected=($missingFlagsRejected -and $stringFlagsRejected);carlitoGatePassed=($goodGate.passed -and $orderedGoodGate.passed);carlitoAptosGateRejected=(-not $badGate.passed -and -not $orderedBadGate.passed);strictNativeTypesRejected=(-not $stringCountGate.passed -and -not $stringFlagGate.passed);stopLatchPassed=$true;nonErrorStageErrorIsNull=$true} | ConvertTo-Json -Depth 6
    } finally {
        if(Test-Path -LiteralPath $pureRoot) {
            $deleteRoot=(Resolve-Path -LiteralPath $pureRoot).Path
            if($deleteRoot.StartsWith($tempRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $deleteRoot -Recurse -Force -ErrorAction SilentlyContinue }
        }
    }
}

if($PureRegression) { Invoke-FontEmbedPureRegression; return }
foreach($required in @(@('OutputDirectory',$OutputDirectory),@('InputPresentation',$InputPresentation),@('FontFixtureDirectory',$FontFixtureDirectory))) {
    if([string]::IsNullOrWhiteSpace([string]$required[1])) { throw "$($required[0]) is required unless -PureRegression is selected" }
}

function Read-FontEmbedGeneration([string]$FixtureRoot,[string]$ExpectedSource) {
    $generationPath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'generation.json')).Path
    $generation=Get-Content -LiteralPath $generationPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-FontEmbedCanonicalGeneration $generation
    $source=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'source.pptx')).Path
    if($source -ine $ExpectedSource) { throw 'InputPresentation must be the fixture source.pptx' }
    if((Get-FontEmbedSha256 $source) -cne $generation.source.sha256) { throw 'Fixture source.pptx hash differs from generation.json' }
    $licensePath=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot 'LICENSE_FONT')).Path
    Assert-FontEmbedFileHash $licensePath $script:fontEmbedLicenseSha256 'Carlito OFL license'
    $fonts=@($generation.fonts)
    foreach($font in $fonts) {
        $path=(Resolve-Path -LiteralPath (Join-Path $FixtureRoot $font.file)).Path
        Assert-FontEmbedFileHash $path ([string]$script:fontEmbedCanonicalFaces[[string]$font.file]) "Carlito face $($font.file)"
    }
    return ,([ordered]@{generation=$generation;generationPath=$generationPath;sourcePath=$source;fontFiles=$fonts;licensePath=$licensePath})
}

function Set-FontEmbedRange($Range,[string]$RequestedText,[string]$RequestedFamily,[double]$RequestedSize,[bool]$RequestedBold,[bool]$RequestedItalic,$RequestedRuns,[string]$Prefix) {
    Invoke-FontEmbedCom "$Prefix.text.set" {$Range.Text=$RequestedText}
    $wholeFont=Invoke-FontEmbedCom "$Prefix.font.get" {return ,$Range.Font}
    Invoke-FontEmbedCom "$Prefix.font.name.set" {$wholeFont.Name=$RequestedFamily}; Invoke-FontEmbedCom "$Prefix.font.size.set" {$wholeFont.Size=$RequestedSize}
    Invoke-FontEmbedCom "$Prefix.font.bold.set" {$wholeFont.Bold=$(if($RequestedBold){-1}else{0})}; Invoke-FontEmbedCom "$Prefix.font.italic.set" {$wholeFont.Italic=$(if($RequestedItalic){-1}else{0})}
    foreach($run in @($RequestedRuns)) {
        $runRange=Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).get" {return ,$Range.Characters([int]$run.start,[int]$run.length)}
        $runFont=Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.get" {return ,$runRange.Font}
        Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.name.set" {$runFont.Name=$RequestedFamily}; Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.size.set" {$runFont.Size=[double]$run.size}
        Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.bold.set" {$runFont.Bold=$(if($run.bold){-1}else{0})}; Invoke-FontEmbedCom "$Prefix.run-$($run.start)-$($run.length).font.italic.set" {$runFont.Italic=$(if($run.italic){-1}else{0})}
    }
}

function Get-FontEmbedInputChecks($Request,[switch]$SnapshotsOnly) {
    $checks=@()
    $records=@(
        [ordered]@{role='source';expected=[string]$Request.source.sha256;original=[string]$Request.source.path;snapshot=[string]$Request.source.snapshotPath},
        [ordered]@{role='generation';expected=[string]$Request.fixture.generation.sha256;original=[string]$Request.fixture.generation.path;snapshot=[string]$Request.fixture.generation.snapshotPath},
        [ordered]@{role='license';expected=[string]$Request.fixture.license.sha256;original=[string]$Request.fixture.license.path;snapshot=[string]$Request.fixture.license.snapshotPath},
        [ordered]@{role='verifier';expected=[string]$Request.verifier.sha256;original=[string]$Request.verifier.path;snapshot=[string]$Request.verifier.snapshotPath},
        [ordered]@{role='process-helper';expected=[string]$Request.processHelper.sha256;original=[string]$Request.processHelper.path;snapshot=[string]$Request.processHelper.snapshotPath},
        [ordered]@{role='font-helper';expected=[string]$Request.fontHelper.sha256;original=[string]$Request.fontHelper.path;snapshot=[string]$Request.fontHelper.snapshotPath}
    )
    foreach($font in @($Request.fixture.fonts)) { $records+=@([ordered]@{role="font:$($font.file)";expected=[string]$font.sha256;original=[string]$font.path;snapshot=[string]$font.snapshotPath}) }
    foreach($record in $records) {
        $snapshotActual=$(if(Test-Path -LiteralPath $record.snapshot -PathType Leaf){Get-FontEmbedSha256 $record.snapshot}else{$null})
        $checks+=@([ordered]@{role=$record.role;copy='snapshot';path=$record.snapshot;expected=$record.expected;actual=$snapshotActual;matched=($snapshotActual -ceq $record.expected)})
        if(-not $SnapshotsOnly) {
            $originalActual=$(if(Test-Path -LiteralPath $record.original -PathType Leaf){Get-FontEmbedSha256 $record.original}else{$null})
            $checks+=@([ordered]@{role=$record.role;copy='original';path=$record.original;expected=$record.expected;actual=$originalActual;matched=($originalActual -ceq $record.expected)})
        }
    }
    return ,$checks
}

if(-not $Worker) {
    $inputPath=(Resolve-Path -LiteralPath $InputPresentation).Path
    if([IO.Path]::GetExtension($inputPath) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
    $fixtureRoot=(Resolve-Path -LiteralPath $FontFixtureDirectory).Path
    $fixture=Read-FontEmbedGeneration $fixtureRoot $inputPath
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'; [void](New-Item -ItemType Directory -Path $snapshotRoot); [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'fonts'))
    $verifierSnapshot=Join-Path $snapshotRoot 'native-font-embed.ps1'
    $processOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path; $processSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $fontHelperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-text-fonts.ps1')).Path; $fontHelperSnapshot=Join-Path $snapshotRoot 'native-text-fonts.ps1'
    $sourceSnapshot=Join-Path $snapshotRoot 'source.pptx'; $generationSnapshot=Join-Path $snapshotRoot 'generation.json'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $processOriginal -Destination $processSnapshot
    Copy-Item -LiteralPath $fontHelperOriginal -Destination $fontHelperSnapshot
    Copy-Item -LiteralPath $inputPath -Destination $sourceSnapshot
    Copy-Item -LiteralPath $fixture.generationPath -Destination $generationSnapshot
    $licenseSnapshot=Join-Path $snapshotRoot 'LICENSE_FONT'
    Copy-Item -LiteralPath $fixture.licensePath -Destination $licenseSnapshot
    $fontInputs=@()
    foreach($font in $fixture.fontFiles) {
        $external=(Resolve-Path -LiteralPath (Join-Path $fixtureRoot $font.file)).Path; $snapshot=Join-Path $snapshotRoot $font.file
        Copy-Item -LiteralPath $external -Destination $snapshot
        $fontInputs+=@([ordered]@{file=$font.file;path=$external;sha256=$font.sha256;snapshotPath=$snapshot;snapshotSha256=(Get-FontEmbedSha256 $snapshot)})
    }
    $expectations=[ordered]@{
        title=[ordered]@{text='Gate E - Carlito';family='Carlito';size=30;bold=$true;italic=$false}
        body=[ordered]@{
            text='Regular 18 | Bold 20 | Italic 22 | BoldItalic 24';family='Carlito';defaultSize=18
            runs=@(
                [ordered]@{start=1;length=10;text='Regular 18';size=18;bold=$false;italic=$false},
                [ordered]@{start=14;length=7;text='Bold 20';size=20;bold=$true;italic=$false},
                [ordered]@{start=24;length=9;text='Italic 22';size=22;bold=$false;italic=$true},
                [ordered]@{start=36;length=13;text='BoldItalic 24';size=24;bold=$true;italic=$true}
            )
        }
        embedFonts=[ordered]@{saveFormat=24;saveArgument=(-1);meaning='Presentation.SaveAs third argument -1 (msoTrue) on the owned presentation only'}
        nativeFonts=[ordered]@{allowedNames=$script:fontEmbedAllowedNativeNames;maxEntries=64;unexpectedNamesBlockSave=$true;requireEmbeddable=$true}
    }
    $request=[ordered]@{
        source=[ordered]@{path=$inputPath;sha256=(Get-FontEmbedSha256 $inputPath);snapshotPath=$sourceSnapshot;snapshotSha256=(Get-FontEmbedSha256 $sourceSnapshot)}
        fixture=[ordered]@{path=$fixtureRoot;generation=[ordered]@{path=$fixture.generationPath;sha256=(Get-FontEmbedSha256 $fixture.generationPath);snapshotPath=$generationSnapshot;snapshotSha256=(Get-FontEmbedSha256 $generationSnapshot)};license=[ordered]@{path=$fixture.licensePath;sha256=$script:fontEmbedLicenseSha256;snapshotPath=$licenseSnapshot;snapshotSha256=(Get-FontEmbedSha256 $licenseSnapshot);spdx='OFL-1.1'};fonts=$fontInputs}
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-FontEmbedSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-FontEmbedSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$processOriginal;sha256=(Get-FontEmbedSha256 $processOriginal);snapshotPath=$processSnapshot;snapshotSha256=(Get-FontEmbedSha256 $processSnapshot)}
        fontHelper=[ordered]@{path=$fontHelperOriginal;sha256=(Get-FontEmbedSha256 $fontHelperOriginal);snapshotPath=$fontHelperSnapshot;snapshotSha256=(Get-FontEmbedSha256 $fontHelperSnapshot);registrationFlags=0}
        expectations=$expectations
    }
    $request | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    $generation=Get-Content -LiteralPath $generationSnapshot -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-FontEmbedCanonicalGeneration $generation
    Assert-FontEmbedFileHash $licenseSnapshot $script:fontEmbedLicenseSha256 'Carlito OFL license snapshot'
    $preRegistrationChecks=Get-FontEmbedInputChecks $request -SnapshotsOnly
    if(@($preRegistrationChecks | Where-Object {-not $_.matched}).Count -ne 0) { throw 'One or more copied input snapshots changed before temporary font registration; no font API or Office call was started' }
    . $processSnapshot; . $fontHelperSnapshot
    $script:fontEmbedWorkerResult=$null; $parentFailure=$null
    try {
        Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $snapshotRoot -RunRoot $outputRoot -Action {
            $script:fontEmbedWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments @('-OutputDirectory',$outputRoot,'-InputPresentation',$sourceSnapshot,'-FontFixtureDirectory',$snapshotRoot,'-Worker') -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
        }
    } catch { $parentFailure=$_.Exception.Message }
    $lastDurable=$null
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')) { try {$lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json} catch {} }
    $registrations=@(); $registrationPath=Join-Path $outputRoot 'font-registration.json'
    if(Test-Path -LiteralPath $registrationPath) { try {$registrations=Read-FontEmbedRegistrations $registrationPath} catch {$parentFailure="Unreadable font-registration.json: $($_.Exception.Message)"} }
    $fontCleanupConfirmed=($registrations.Count -eq 4 -and @($registrations | Where-Object {-not $_.removed -or $_.added -lt 1}).Count -eq 0)
    $inputChecks=Get-FontEmbedInputChecks $request; $inputsUnchanged=(@($inputChecks | Where-Object {-not $_.matched}).Count -eq 0)
    $result=$script:fontEmbedWorkerResult; $workerReport=$null; $workerReportPath=Join-Path $outputRoot 'report.json'
    if(Test-Path -LiteralPath $workerReportPath) { try {$workerReport=Get-Content -LiteralPath $workerReportPath -Raw -Encoding UTF8 | ConvertFrom-Json} catch {$parentFailure="Unreadable worker report: $($_.Exception.Message)"} }
    $timedOut=($null -ne $result -and [bool]$result.timedOut)
    $officeLifecycleComplete=($null -ne $result -and -not $timedOut -and [int]$result.exitCode -eq 0 -and $null -ne $lastDurable -and $lastDurable.stage -ceq 'worker.complete' -and $lastDurable.status -ceq 'success' -and [bool]$lastDurable.cleanupConfirmed -and $null -ne $workerReport -and [bool]$workerReport.cleanupConfirmed -and [int]$workerReport.ownedCloseCount -eq 1)
    $nativeFontsGatePassed=($null -ne $workerReport -and $null -ne $workerReport.nativeFontsGate -and [bool]$workerReport.nativeFontsGate.passed)
    $embedSaveRecorded=($null -ne $workerReport -and $null -ne $workerReport.embedFonts -and [int]$workerReport.embedFonts.saveArgument -eq (-1) -and [bool]$workerReport.embedFonts.attempted -and [bool]$workerReport.embedFonts.completed)
    $terminal=[ordered]@{
        timestamp=(Get-Date).ToUniversalTime().ToString('o');timedOut=$timedOut;exitCode=$(if($null -eq $result){$null}else{$result.exitCode})
        officeLifecycleComplete=$officeLifecycleComplete;nativeFontsGatePassed=$nativeFontsGatePassed;embedSaveRecorded=$embedSaveRecorded;fontCleanupConfirmed=$fontCleanupConfirmed;inputsUnchanged=$inputsUnchanged
        ownedCloseCount=$(if($null -eq $workerReport){0}else{[int]$workerReport.ownedCloseCount});lastDurableStage=$(if($null -eq $lastDurable){$null}else{$lastDurable.stage});lastDurableStatus=$(if($null -eq $lastDurable){$null}else{$lastDurable.status});parentError=$parentFailure;inputChecks=$inputChecks
    }
    $terminal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'worker.stdout.log')) { Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object {Write-Host $_} }
    if(-not [string]::IsNullOrEmpty([string]$parentFailure) -or $null -eq $result -or $timedOut -or $result.exitCode -ne 0 -or -not $officeLifecycleComplete -or -not $fontCleanupConfirmed -or -not $inputsUnchanged -or -not $nativeFontsGatePassed -or -not $embedSaveRecorded) {
        throw 'Native font embed failed, timed out, failed the native Fonts gate, or did not confirm the owned Office/font/input lifecycle and embed save argument; preserve the attempt and inspect supervisor.json. No retry was started.'
    }
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$request=Get-Content -LiteralPath (Join-Path $root 'request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceSnapshot=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path
$savedPath=Join-Path $root 'native-font-embed.pptx'
$script:stageFile=Join-Path $root 'stages.jsonl'; $script:progressFile=Join-Path $root 'progress.json'; $reportFile=Join-Path $root 'report.json'
if(Test-Path -LiteralPath $savedPath) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' }
$workerInputChecks=Get-FontEmbedInputChecks $request -SnapshotsOnly
if(@($workerInputChecks | Where-Object {-not $_.matched}).Count -ne 0) { throw 'One or more worker input snapshots changed before Office startup' }
if((Get-FontEmbedSha256 $PSCommandPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }
$workerGeneration=Get-Content -LiteralPath $request.fixture.generation.snapshotPath -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-FontEmbedCanonicalGeneration $workerGeneration
Assert-FontEmbedFileHash $request.fixture.license.snapshotPath $script:fontEmbedLicenseSha256 'Carlito OFL license snapshot'

$script:sequence=0; $script:lastStage='worker.initialize'; $script:lastStatus='begin'; $script:cleanupConfirmed=$true; $script:officeOperationsStopped=$false; $script:ownedPresentationPath=$null; $script:presentation=$null
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$report=[ordered]@{
    schemaVersion=1;kind='native-font-embed'
    source=[ordered]@{path=$request.source.path;sha256=$request.source.sha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-FontEmbedSha256 $sourceSnapshot)}
    saved=[ordered]@{path=$savedPath;sha256=$null}
    embedFonts=[ordered]@{saveFormat=24;saveArgument=-1;stage='edited.presentation.saveAs-owned-copy-embed-fonts';attempted=$false;completed=$false;blockedByNativeFontsGate=$false}
    opcFontParts=$null
    requested=$request.expectations
    nativeFontsObservation=[ordered]@{count=$null;entries=@()};nativeFontsGate=$null;ownedCloseCount=0
    environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null}
    cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;lastStage=$script:lastStage;lastStatus=$script:lastStatus;error=$null
    scope='Open one owned Gate E fixture snapshot, apply the same Carlito edit spans, save with EmbedFonts -1 on that presentation only, and record filesystem evidence for offline OPC font-part audit. COM Font.Name does not prove which TTF drew each glyph.'
    limitations=@('Native font properties do not identify the physical file used for every glyph.','This control does not replace Gate E geometry persistence or browser/native pixel checks.','Offline audit hashes ppt/fonts package parts; obfuscated bytes may not match fixture TTF SHA-256.')
}
function Write-FontEmbedReport { $report.cleanupConfirmed=$script:cleanupConfirmed; $report.officeOperationsStopped=$script:officeOperationsStopped; $report.lastStage=$script:lastStage; $report.lastStatus=$script:lastStatus; $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reportFile -Encoding UTF8 }
# [string] parameters coerce `$null to ''; keep the parameter untyped so a successful stage records JSON null.
function Write-FontEmbedStage([string]$StageName,[string]$Status,$ErrorMessage=$null) {
    $script:sequence++; $script:lastStage=$StageName; $script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$StageName;status=$Status;error=$(if([string]::IsNullOrEmpty([string]$ErrorMessage)){$null}else{[string]$ErrorMessage});cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;ownedPresentationPath=$script:ownedPresentationPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $script:stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $script:progressFile -Encoding UTF8
}
function Invoke-FontEmbedCom([string]$StageName,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-FontEmbedStage $StageName 'begin'
    try {$value=& $Operation; Write-FontEmbedStage $StageName 'success'; return ,$value}
    catch {$script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-FontEmbedStage $StageName 'error' $_.Exception.Message; throw}
}
function Assert-FontEmbedPresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-FontEmbedCom "$Prefix.presentations.get" {return ,$Application.Presentations}; $count=Invoke-FontEmbedCom "$Prefix.presentations.count.get" {$presentations.Count}
    for($index=1;$index -le $count;$index++) { $candidate=Invoke-FontEmbedCom "$Prefix.presentation-$index.get" {return ,$presentations.Item($index)}; $actual=Invoke-FontEmbedCom "$Prefix.presentation-$index.fullName.get" {$candidate.FullName}; if($actual -ieq $Path) {throw "Presentation is already open, so ownership cannot be established: $Path"} }
}
function Close-OwnedFontEmbed([string]$Phase,[string]$ExpectedPath,[switch]$DiscardUnsaved) {
    $actual=Invoke-FontEmbedCom "$Phase.fullName.get" {$script:presentation.FullName}
    if($actual -ine $ExpectedPath){throw "Refusing to close a presentation whose exact saved path is not owned: $actual"}
    if($DiscardUnsaved) { Invoke-FontEmbedCom "$Phase.saved.set" {$script:presentation.Saved=(-1)} }
    Invoke-FontEmbedCom "$Phase.close" {$script:presentation.Close()}; $script:presentation=$null; $script:ownedPresentationPath=$null; $script:cleanupConfirmed=$true; $report.ownedCloseCount=[int]$report.ownedCloseCount+1; Write-FontEmbedStage "$Phase.cleanup" 'success'
}

Write-FontEmbedReport; Write-FontEmbedStage 'worker.initialize' 'success'
try {
    $app=Invoke-FontEmbedCom 'application.create' {return ,(New-Object -ComObject PowerPoint.Application)}
    $report.environment.powerPointVersion=Invoke-FontEmbedCom 'application.version.get' {$app.Version}; Write-FontEmbedReport
    Assert-FontEmbedPresentationNotOpen $app $sourceSnapshot 'input.preflight'; Assert-FontEmbedPresentationNotOpen $app $savedPath 'output.preflight'
    $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$sourceSnapshot; Write-FontEmbedReport
    $presentations=Invoke-FontEmbedCom 'input.presentations.get' {return ,$app.Presentations}
    $script:presentation=Invoke-FontEmbedCom 'input.presentation.open' {return ,$presentations.Open($sourceSnapshot,0,0,(-1))}
    $slides=Invoke-FontEmbedCom 'edit.slides.get' {return ,$script:presentation.Slides}; $slide=Invoke-FontEmbedCom 'edit.slide-1.get' {return ,$slides.Item(1)}; $shapes=Invoke-FontEmbedCom 'edit.shapes.get' {return ,$slide.Shapes}
    $titleShape=Invoke-FontEmbedCom 'edit.title.get' {return ,$shapes.Item('OPF heading slides.0.title line 0')}; $titleRange=Invoke-FontEmbedCom 'edit.title.textRange2.get' {return ,$titleShape.TextFrame2.TextRange}
    Set-FontEmbedRange $titleRange $request.expectations.title.text $request.expectations.title.family ([double]$request.expectations.title.size) ([bool]$request.expectations.title.bold) ([bool]$request.expectations.title.italic) @() 'edit.title'
    $bodyShape=Invoke-FontEmbedCom 'edit.body.get' {return ,$shapes.Item('OPF text slides.0.text line 0')}; $bodyRange=Invoke-FontEmbedCom 'edit.body.textRange2.get' {return ,$bodyShape.TextFrame2.TextRange}
    Set-FontEmbedRange $bodyRange $request.expectations.body.text $request.expectations.body.family ([double]$request.expectations.body.defaultSize) $false $false $request.expectations.body.runs 'edit.body'
    $fontCollection=Invoke-FontEmbedCom 'edited.presentation.fonts.get' {return ,$script:presentation.Fonts}
    $fontCount=[int](Invoke-FontEmbedCom 'edited.presentation.fonts.count.get' {$fontCollection.Count}); $report.nativeFontsObservation.count=$fontCount
    if($fontCount -ge 1 -and $fontCount -le 64) {
        for($index=1;$index -le $fontCount;$index++) {
            $font=Invoke-FontEmbedCom "edited.presentation.fonts.item-$index.get" {return ,$fontCollection.Item($index)}
            $name=Invoke-FontEmbedCom "edited.presentation.fonts.item-$index.name.get" {$font.Name}
            $embedded=[int](Invoke-FontEmbedCom "edited.presentation.fonts.item-$index.embedded.get" {$font.Embedded})
            $embeddable=[int](Invoke-FontEmbedCom "edited.presentation.fonts.item-$index.embeddable.get" {$font.Embeddable})
            $report.nativeFontsObservation.entries+=@([ordered]@{index=$index;name=[string]$name;embedded=$embedded;embeddable=$embeddable})
        }
    }
    $report.nativeFontsGate=Get-FontEmbedNativeFontsGate $report.nativeFontsObservation
    if(-not $report.nativeFontsGate.passed) {
        $report.embedFonts.blockedByNativeFontsGate=$true; Write-FontEmbedStage 'edited.presentation.native-fonts-gate' 'blocked' (($report.nativeFontsGate.unexpectedNames -join ',') + '|' + ($report.nativeFontsGate.unembeddableNames -join ',')); Write-FontEmbedReport
        Close-OwnedFontEmbed 'blocked.presentation' $sourceSnapshot -DiscardUnsaved
        throw 'Native Presentation.Fonts allowlist/embeddability gate failed before SaveAs; the owned presentation was closed without saving and no retry was started.'
    }
    Write-FontEmbedStage 'edited.presentation.native-fonts-gate' 'success'; Write-FontEmbedReport
    $report.embedFonts.attempted=$true
    Invoke-FontEmbedCom 'edited.presentation.saveAs-owned-copy-embed-fonts' {$script:presentation.SaveAs($savedPath,24,(-1))}; $script:ownedPresentationPath=$savedPath; $report.embedFonts.completed=$true; Write-FontEmbedReport
    Close-OwnedFontEmbed 'edited.presentation' $savedPath; $report.saved.sha256=Get-FontEmbedSha256 $savedPath; Write-FontEmbedReport
    Write-FontEmbedStage 'worker.complete' 'success'; Write-FontEmbedReport
    Write-Output 'Native font embed completed; run native-font-embed-audit.mjs on this directory for OPC font-part hashes.'
} catch {
    $report.error=$_.Exception.Message; if($script:officeOperationsStopped -or $null -ne $script:presentation){$script:cleanupConfirmed=$false}; Write-FontEmbedStage 'worker.failure' 'error' $_.Exception.Message; Write-FontEmbedReport; throw
}
