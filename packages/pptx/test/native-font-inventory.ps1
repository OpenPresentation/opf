param(
    [string]$OutputDirectory,
    [string]$InputPresentation,
    [string]$FontFixtureDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$WithoutTemporaryFonts,
    [switch]$ControlDeck,
    [switch]$Worker,
    [switch]$PureRegression
)
$ErrorActionPreference='Stop'

# Read-only native font inventory. The worker opens one owned snapshot with
# ReadOnly=-1, reads Presentation.Fonts first, then theme font slots and
# whole-range, paragraph and run Font2 slots, then closes that exact
# presentation. It never edits, saves, exports, quits PowerPoint, or terminates
# Office. -ControlDeck accepts any .pptx without the Carlito fixture contract
# and never registers fonts.

function Get-InventorySha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Assert-InventoryHash([string]$Value,[string]$Context) { if($Value -notmatch '^[0-9a-f]{64}$') { throw "$Context must be a lowercase SHA-256" } }
function Test-InventoryInteger($Value) { return ($Value -is [int]) -or ($Value -is [long]) }
# A cloud deck reports a URL FullName; GetFullPath throws on URLs. Anything that
# is not a local filesystem path is treated as not owned, never as an error.
function Test-InventoryFileSystemPath([string]$Path) { return (-not [string]::IsNullOrWhiteSpace($Path)) -and ($Path -notmatch '^[A-Za-z][A-Za-z0-9+.-]+:') }
function Test-InventoryPathEqual([string]$Left,[string]$Right) {
    if(-not (Test-InventoryFileSystemPath $Left) -or -not (Test-InventoryFileSystemPath $Right)) { return $false }
    try { return ([IO.Path]::GetFullPath($Left) -ieq [IO.Path]::GetFullPath($Right)) } catch { return $false }
}
# Windows PowerShell 5.1 emits a root JSON array as one pipeline item. Decode
# first, then wrap, so four registration rows never collapse into one element.
function Read-InventoryRegistrations([string]$Path) { $parsed=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json; return ,@($parsed) }
function Test-InventoryFontCleanup($Registrations) { return (@($Registrations).Count -eq 4 -and @($Registrations | Where-Object {$_.removed -ne $true -or -not (Test-InventoryInteger $_.added) -or $_.added -lt 1}).Count -eq 0) }

$script:inventoryLicenseSha256='58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00'
$script:inventoryCanonicalFaces=[ordered]@{
    'fonts/Carlito-400-normal.ttf'='ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89'
    'fonts/Carlito-400-italic.ttf'='074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5'
    'fonts/Carlito-700-normal.ttf'='51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0'
    'fonts/Carlito-700-italic.ttf'='25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691'
}
$script:inventoryCarlitoNames=@('Carlito','Carlito Bold','Carlito Italic','Carlito Bold Italic')
$script:inventoryBounds=[ordered]@{maxPresentationFonts=64;maxSlides=2;maxShapesPerSlide=10;maxParagraphsPerShape=12;maxParagraphsTotal=24;maxRunsPerShape=24;maxRunsTotal=40;maxTextCharacters=1024}
$script:inventoryRunFontSlots=@('name','nameAscii','nameOther','nameFarEast','nameComplexScript')
$script:inventoryThemeSlots=@(@('latin',1),@('complexScript',2),@('eastAsian',3))

function Assert-InventoryCanonicalGeneration($Generation) {
    if($Generation.kind -cne 'native-font-edit-fixture') { throw 'generation.kind must be native-font-edit-fixture' }
    if($null -eq $Generation.source -or $Generation.source.file -cne 'source.pptx') { throw 'generation.source.file must be source.pptx' }
    Assert-InventoryHash ([string]$Generation.source.sha256) 'generation.source.sha256'
    if($null -eq $Generation.license -or $Generation.license.file -cne 'LICENSE_FONT' -or $Generation.license.spdx -cne 'OFL-1.1' -or $Generation.license.sha256 -cne $script:inventoryLicenseSha256) { throw 'generation.license must bind the canonical OFL-1.1 license' }
    if($null -eq $Generation.registration -or $null -eq $Generation.registration.PSObject.Properties['flags'] -or -not (Test-InventoryInteger $Generation.registration.flags) -or $Generation.registration.flags -ne 0) { throw 'generation.registration.flags must be the JSON integer 0' }
    $fonts=@($Generation.fonts)
    if($fonts.Count -ne $script:inventoryCanonicalFaces.Count) { throw 'generation.fonts must contain exactly four canonical Carlito faces' }
    $seen=@{}
    foreach($font in $fonts) {
        $file=[string]$font.file; $hash=[string]$font.sha256
        if(-not $script:inventoryCanonicalFaces.Contains($file) -or $seen.ContainsKey($file)) { throw "Invalid or duplicate generation font path: $file" }
        if($hash -cne [string]$script:inventoryCanonicalFaces[$file]) { throw "Generation font hash is not the canonical permitted Carlito face: $file" }
        $seen[$file]=$true
    }
    foreach($file in $script:inventoryCanonicalFaces.Keys) { if(-not $seen.ContainsKey($file)) { throw "Missing canonical fixture font: $file" } }
}
function Assert-InventoryFileHash([string]$Path,[string]$Expected,[string]$Context) { if((Get-InventorySha256 $Path) -cne $Expected) { throw "$Context hash differs from the canonical permitted value" } }

function Test-InventoryMember($Object,[string]$Name) {
    if($null -eq $Object) { return $false }
    if($Object -is [System.Collections.IDictionary]) { return $Object.Contains($Name) }
    return $null -ne $Object.PSObject.Properties[$Name]
}
function Get-InventoryMember($Object,[string]$Name) {
    if(-not (Test-InventoryMember $Object $Name)) { return $null }
    if($Object -is [System.Collections.IDictionary]) { return $Object[$Name] }
    return $Object.PSObject.Properties[$Name].Value
}
function Get-InventoryList($Object,[string]$Name) {
    $value=Get-InventoryMember $Object $Name
    if($null -eq $value) { return ,@() }
    return ,@($value)
}
function Test-InventoryAptosName($Name) { return ($Name -is [string]) -and ($Name -match '^aptos') }
function Get-InventorySortedDistinct($Values) {
    $strings=[string[]]@(@($Values) | Where-Object { ($_ -is [string]) -and $_.Length -gt 0 })
    $set=New-Object -TypeName 'System.Collections.Generic.HashSet[string]' -ArgumentList $strings,([StringComparer]::Ordinal)
    $sorted=[string[]]@($set)
    [Array]::Sort($sorted,[StringComparer]::Ordinal)
    return ,$sorted
}
function Select-InventoryNames($Names,[scriptblock]$Predicate) {
    $selected=[string[]]@(@($Names) | Where-Object $Predicate)
    return ,$selected
}

# The ledger is derived from raw observations after close. It records where a
# name was reported; it does not prove which physical font file drew a glyph.
function Get-InventoryShapeSlotValues($Shapes) {
    $values=@()
    foreach($shape in @($Shapes)) {
        $fonts=@()
        $rangeFont=Get-InventoryMember $shape 'rangeFont'; if($null -ne $rangeFont) { $fonts+=@($rangeFont) }
        foreach($paragraph in (Get-InventoryList $shape 'paragraphs')) { $fonts+=@(Get-InventoryMember $paragraph 'font') }
        foreach($run in (Get-InventoryList $shape 'runs')) { $fonts+=@(Get-InventoryMember $run 'font') }
        foreach($font in $fonts) { foreach($slot in $script:inventoryRunFontSlots) { $values+=@(Get-InventoryMember $font $slot) } }
    }
    return ,$values
}
function Get-InventoryFontLedger($Observation) {
    $fontEntries=Get-InventoryList (Get-InventoryMember $Observation 'presentationFonts') 'entries'
    $presentationNames=Get-InventorySortedDistinct @($fontEntries | ForEach-Object { Get-InventoryMember $_ 'name' })
    $slideShapes=@()
    foreach($slide in (Get-InventoryList (Get-InventoryMember $Observation 'slides') 'entries')) { $slideShapes+=(Get-InventoryList $slide 'shapes') }
    $slideNames=Get-InventorySortedDistinct (Get-InventoryShapeSlotValues $slideShapes)
    $masterNames=Get-InventorySortedDistinct (Get-InventoryShapeSlotValues (Get-InventoryList (Get-InventoryMember $Observation 'slideMaster') 'shapes'))
    $themeValues=@()
    $theme=Get-InventoryMember $Observation 'theme'
    foreach($scheme in @('major','minor')) { $schemeRecord=Get-InventoryMember $theme $scheme; foreach($slot in $script:inventoryThemeSlots) { $themeValues+=@(Get-InventoryMember $schemeRecord $slot[0]) } }
    $themeNames=Get-InventorySortedDistinct $themeValues
    $aptosPresentation=Select-InventoryNames $presentationNames {Test-InventoryAptosName $_}
    $aptosSlide=Select-InventoryNames $slideNames {Test-InventoryAptosName $_}
    $aptosMaster=Select-InventoryNames $masterNames {Test-InventoryAptosName $_}
    $aptosTheme=Select-InventoryNames $themeNames {Test-InventoryAptosName $_}
    $nonCarlito=Select-InventoryNames $presentationNames {$script:inventoryCarlitoNames -cnotcontains $_}
    return ,([ordered]@{
        presentationFontNames=$presentationNames;slideTextSlotNames=$slideNames;masterTextSlotNames=$masterNames;themeFontNames=$themeNames
        aptosPresentationFontNames=$aptosPresentation;aptosSlideTextSlotNames=$aptosSlide;aptosMasterTextSlotNames=$aptosMaster;aptosThemeFontNames=$aptosTheme
        aptosReported=($aptosPresentation.Count -gt 0 -or $aptosSlide.Count -gt 0 -or $aptosMaster.Count -gt 0 -or $aptosTheme.Count -gt 0)
        nonCarlitoPresentationFontNames=$nonCarlito
        carlitoOnlyPresentationFonts=($presentationNames.Count -ge 1 -and $nonCarlito.Count -eq 0)
        scope='Names reported by PowerPoint for Presentation.Fonts, theme font slots and Font2 slots of whole text ranges, paragraphs and runs. Aptos detection is a case-insensitive name prefix. These values do not prove physical font-file or per-glyph identity.'
    })
}

function Get-InventoryParentDecision($Result,$LastDurable,$WorkerReport,[string]$Mode,$Registrations,[bool]$RegistrationFilePresent,[bool]$InputsUnchanged,$ParentFailure) {
    $timedOut=($null -ne $Result -and [bool](Get-InventoryMember $Result 'timedOut'))
    $exitCode=Get-InventoryMember $Result 'exitCode'
    $exitOk=($null -ne $Result -and -not $timedOut -and (Test-InventoryInteger $exitCode) -and $exitCode -eq 0)
    $source=Get-InventoryMember $WorkerReport 'source'
    $lifecycle=($exitOk -and (Get-InventoryMember $LastDurable 'stage') -ceq 'worker.complete' -and (Get-InventoryMember $LastDurable 'status') -ceq 'success' -and (Get-InventoryMember $LastDurable 'cleanupConfirmed') -eq $true -and (Get-InventoryMember $WorkerReport 'cleanupConfirmed') -eq $true -and (Get-InventoryMember $WorkerReport 'officeOperationsStopped') -eq $false -and (Get-InventoryMember $WorkerReport 'ownedOpenCount') -eq 1 -and (Get-InventoryMember $WorkerReport 'ownedCloseCount') -eq 1 -and $null -eq (Get-InventoryMember $WorkerReport 'error'))
    $readOnlyConfirmed=($null -ne $source -and (Get-InventoryMember $source 'readOnly') -eq -1 -and (Get-InventoryMember $source 'openedPathMatches') -eq $true -and (Get-InventoryMember $source 'snapshotUnchangedAfterClose') -eq $true)
    $inventoryComplete=((Test-InventoryMember $WorkerReport 'boundsExceeded') -and (Get-InventoryList $WorkerReport 'boundsExceeded').Count -eq 0 -and (Test-InventoryMember $WorkerReport 'semanticFailures') -and (Get-InventoryList $WorkerReport 'semanticFailures').Count -eq 0 -and $null -ne (Get-InventoryMember $WorkerReport 'fontLedger'))
    if($Mode -ceq 'temporary-session') { $fontCleanup=Test-InventoryFontCleanup $Registrations; $registrationOk=$fontCleanup }
    elseif($Mode -ceq 'none') { $fontCleanup=$null; $registrationOk=(-not $RegistrationFilePresent) }
    else { $fontCleanup=$false; $registrationOk=$false }
    $passed=([string]::IsNullOrEmpty([string]$ParentFailure) -and $lifecycle -and $readOnlyConfirmed -and $inventoryComplete -and $registrationOk -and $InputsUnchanged)
    return ,([ordered]@{passed=$passed;timedOut=$timedOut;exitCode=$exitCode;officeLifecycleComplete=$lifecycle;readOnlyConfirmed=$readOnlyConfirmed;inventoryComplete=$inventoryComplete;fontRegistrationMode=$Mode;fontCleanupConfirmed=$fontCleanup;registrationFilePresent=$RegistrationFilePresent;inputsUnchanged=$InputsUnchanged})
}

# Static safety policy for this file. Every invoked member must be on an
# allowlist: the PowerPoint calls the worker needs (Open, Close, Item,
# Paragraphs, Runs) plus named .NET helpers. Anything else, such as Add,
# ApplyTemplate, ApplyTheme, SaveAs or Quit, is rejected. COM property reads
# are member expressions, not invocations. Allowed member-assignment roots are
# local report/evidence dictionaries, never COM objects.
$script:inventoryAllowedComMembers=@('Open','Close','Item','Paragraphs','Runs')
$script:inventoryAllowedInstanceMembers=@('Contains','ContainsKey','FindAll','GetCommandName','StartsWith','Substring','ToLowerInvariant','ToString','ToUniversalTime','TrimEnd')
$script:inventoryAllowedStaticMembers=@('GetExtension','GetFullPath','GetTempPath','IsNullOrEmpty','IsNullOrWhiteSpace','Max','Min','NewGuid','ParseFile','Sort','WriteAllText')
$script:inventoryForbiddenCommands=@('Stop-Process','taskkill','taskkill.exe','kill','spps','Invoke-Expression','iex','Add-Type')
$script:inventoryAssignmentRoots=@('report','slideRecord','shapeRecord','seen','wrongGeneration','sample','sampleRows','policyRejected','errorCloseOutcomes')
function Get-InventoryAssignmentRoot($Expression) {
    while($Expression -is [System.Management.Automation.Language.MemberExpressionAst] -or $Expression -is [System.Management.Automation.Language.IndexExpressionAst]) {
        if($Expression -is [System.Management.Automation.Language.MemberExpressionAst]) { $Expression=$Expression.Expression } else { $Expression=$Expression.Target }
    }
    if($Expression -is [System.Management.Automation.Language.VariableExpressionAst]) { return ($Expression.VariablePath.UserPath -replace '^(script|global|local|private):','') }
    return $null
}
# Reviewed allowlists for this file's static policy. Every command, invoked member, static access, type literal and
# non-literal & or . invocation must appear here; anything else is rejected. test/native-font-inventory-audit.mjs holds the same lists.
$script:InventoryPolicyCommands=@('Add-Content','ConvertFrom-Json','ConvertTo-Json','Copy-Item','ForEach-Object','Get-Content','Get-Date','Get-FileHash','Get-ItemProperty','Get-Variable','Invoke-OpfNativeWorker','Invoke-OpfWithTemporaryFonts','Join-Path','New-Item','New-Object','Remove-Item','Resolve-Path','Set-Content','Set-Variable','Test-Path','Where-Object','Write-Host','Write-Output')
$script:InventoryPolicyScopedCommands=@('Add-Member|Invoke-InventoryPureRegression')
$script:InventoryPolicyCommandForms=@('New-Object|^New-Object -ComObject PowerPoint\.Application$','New-Object|^New-Object -TypeName ''System\.Collections\.Generic\.HashSet\[string\]'' -ArgumentList \$strings,\(\[StringComparer\]::Ordinal\)$','Get-Variable|^Get-Variable -Scope Script -Name \$TotalCounter -ValueOnly$','Set-Variable|^Set-Variable -Scope Script -Name \$TotalCounter -Value \(\$used\+\$allowed\)$')
$script:InventoryPolicyInstanceMembers=@('Close','Contains','ContainsKey','FindAll','GetCommandName','Item','Open','Paragraphs','Runs','StartsWith','Substring','ToLowerInvariant','ToString','ToUniversalTime','TrimEnd')
$script:InventoryPolicyStaticMembers=@('Array::Sort','Guid::NewGuid','IO.File::WriteAllText','IO.Path::GetExtension','IO.Path::GetFullPath','IO.Path::GetTempPath','Math::Max','Math::Min','string::IsNullOrEmpty','string::IsNullOrWhiteSpace','System.Management.Automation.Language.Parser::ParseFile')
$script:InventoryPolicyStaticProperties=@('IO.Path::AltDirectorySeparatorChar','IO.Path::DirectorySeparatorChar','StringComparer::Ordinal','StringComparison::OrdinalIgnoreCase','System.Management.Automation.Language.TokenKind::Dot','System.Management.Automation.Language.TokenKind::Unknown','System.Management.Automation.Language.StringConstantType::BareWord','System.Management.Automation.Language.TokenKind::Equals')
$script:InventoryPolicyTypes=@('Array','bool','double','Guid','int','IO.File','IO.Path','long','Math','ordered','pscustomobject','ref','scriptblock','string','string[]','StringComparer','StringComparison','switch','void','ValidateRange','System.Collections.IDictionary','System.Management.Automation.Language.AssignmentStatementAst','System.Management.Automation.Language.AttributeBaseAst','System.Management.Automation.Language.CommandAst','System.Management.Automation.Language.ConvertExpressionAst','System.Management.Automation.Language.FunctionDefinitionAst','System.Management.Automation.Language.IndexExpressionAst','System.Management.Automation.Language.InvokeMemberExpressionAst','System.Management.Automation.Language.MemberExpressionAst','System.Management.Automation.Language.Parser','System.Management.Automation.Language.ScriptBlockExpressionAst','System.Management.Automation.Language.StringConstantExpressionAst','System.Management.Automation.Language.StringConstantType','System.Management.Automation.Language.TokenKind','System.Management.Automation.Language.TypeExpressionAst','System.Management.Automation.Language.UnaryExpressionAst','System.Management.Automation.Language.VariableExpressionAst','System.Management.Automation.Language.ArrayLiteralAst','System.Management.Automation.Language.CommandExpressionAst','System.Management.Automation.Language.CommandParameterAst','System.Management.Automation.Language.ForEachStatementAst','System.Management.Automation.Language.HashtableAst','System.Management.Automation.Language.ParameterAst','System.Management.Automation.Language.RedirectionAst')
$script:InventoryPolicyInvocationSites=@('Invoke-InventoryCom|&|Operation','Invoke-InventoryPureRegression|&|decide','Invoke-InventoryPureRegression|&|mutate','|.|processSnapshot','|.|fontHelperSnapshot')
$script:InventoryPolicyPipelineExceptions=@('Select-InventoryNames|Where-Object $Predicate')
$script:InventoryPolicyAssignmentRoots=@('report','slideRecord','shapeRecord','seen','wrongGeneration','sample','sampleRows','policyRejected','errorCloseOutcomes')
$script:InventoryPolicyComSetters=@()
$script:InventoryPolicyRootSources=@('sampleRows|@($script:inventoryCanonicalFaces.Keys | ForEach-Object {@{file=$_;sha256=$script:inventoryCanonicalFaces[$_];added=1;removed=$true}})','sample|$goodReport | ConvertTo-Json -Depth 10 | ConvertFrom-Json')
$script:InventoryPolicyBareArguments=@('Close','Directory','Leaf','PowerPoint.Application','SHA256','Script','ScriptMethod','SilentlyContinue','UTF8')
$script:InventoryPolicyExactForms=@('Add-Content|Add-Content -LiteralPath $script:stageFile -Encoding UTF8','Set-Content|Set-Content -LiteralPath $script:progressFile -Encoding UTF8','Set-Content|Set-Content -LiteralPath $script:reportFile -Encoding UTF8','New-Item|New-Item -ItemType Directory -Path $pureRoot','Set-Content|Set-Content -LiteralPath $registrationPath -Encoding UTF8','Remove-Item|Remove-Item -LiteralPath $deleteRoot -Recurse -Force -ErrorAction SilentlyContinue','New-Item|New-Item -ItemType Directory -Path $outputRoot','New-Item|New-Item -ItemType Directory -Path $snapshotRoot','Copy-Item|Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot','Copy-Item|Copy-Item -LiteralPath $processOriginal -Destination $processSnapshot','Copy-Item|Copy-Item -LiteralPath $fontHelperOriginal -Destination $fontHelperSnapshot','Copy-Item|Copy-Item -LiteralPath $inputPath -Destination $sourceSnapshot','New-Item|New-Item -ItemType Directory -Path (Join-Path $snapshotRoot ''fonts'')','Copy-Item|Copy-Item -LiteralPath $generationPath -Destination $generationSnapshot','Copy-Item|Copy-Item -LiteralPath $licensePath -Destination $licenseSnapshot','Copy-Item|Copy-Item -LiteralPath $external -Destination $snapshot','Set-Content|Set-Content -LiteralPath (Join-Path $outputRoot ''request.json'') -Encoding UTF8','Invoke-OpfWithTemporaryFonts|Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $snapshotRoot -RunRoot $outputRoot -Action { $script:inventoryWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments $workerArguments -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds }','Invoke-OpfNativeWorker|Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments $workerArguments -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds','Set-Content|Set-Content -LiteralPath (Join-Path $outputRoot ''supervisor.json'') -Encoding UTF8')
$script:InventoryPolicyExactApis=@('IO.File::WriteAllText|[IO.File]::WriteAllText($negativePath,$policyNegatives[$key])','IO.File::WriteAllText|[IO.File]::WriteAllText($positivePath,''$p=$a.Open($x,-1,0,0); $n=$p.Fonts.Item(1).Name; $report.name=$n; $p.Close()'')')
$script:InventoryPolicyExactMembers=@()
$script:InventoryPolicyPinned=@('operation','decide','mutate','processsnapshot','fonthelpersnapshot','pureroot','deleteroot','outputroot','snapshotroot','verifiersnapshot','sourcesnapshot','generationsnapshot','licensesnapshot','snapshot','reportfile','stagefile','progressfile','registrationpath','temproot','root','negativepath','positivepath','workerarguments')
$script:InventoryPolicyPinnedBindings=@('root|=|Get-InventoryAssignmentRoot $left','root|=|Get-InventoryAssignmentRoot $unary.Child','temproot|=|[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)','pureroot|=|Join-Path $tempRoot (''opf-font-inventory-pure-'' + [Guid]::NewGuid().ToString(''n''))','pureroot|=|(Resolve-Path -LiteralPath $pureRoot).Path','negativepath|=|Join-Path $pureRoot "policy-$key.ps1"','positivepath|=|Join-Path $pureRoot ''policy-positive.ps1''','stagefile|=|Join-Path $pureRoot ''stages.jsonl''','progressfile|=|Join-Path $pureRoot ''progress.json''','reportfile|=|Join-Path $pureRoot ''report.json''','stagefile|=|Join-Path $pureRoot "error-close-$($case[0]).jsonl"','progressfile|=|Join-Path $pureRoot "error-close-$($case[0]).progress.json"','registrationpath|=|Join-Path $pureRoot ''font-registration.json''','decide|=|{ param($Result,$Durable,$Report,$Mode,$Registrations,$Present,$Inputs) Get-InventoryParentDecision $Result $Durable $Report $Mode $Registrations $Present $Inputs $null }','mutate|=|{ param($Name,$Value) $sample=$goodReport | ConvertTo-Json -Depth 10 | ConvertFrom-Json; if($Name -like ''source.*''){ $sample.source.($Name.Substring(7))=$Value } else { $sample.$Name=$Value }; return ,$sample }','deleteroot|=|(Resolve-Path -LiteralPath $pureRoot).Path','outputroot|=|[IO.Path]::GetFullPath($OutputDirectory)','snapshotroot|=|Join-Path $outputRoot ''inputs''','verifiersnapshot|=|Join-Path $snapshotRoot ''native-font-inventory.ps1''','processsnapshot|=|Join-Path $snapshotRoot ''native-process.ps1''','fonthelpersnapshot|=|Join-Path $snapshotRoot ''native-text-fonts.ps1''','sourcesnapshot|=|Join-Path $snapshotRoot ''source.pptx''','generationsnapshot|=|Join-Path $snapshotRoot ''generation.json''','licensesnapshot|=|Join-Path $snapshotRoot ''LICENSE_FONT''','snapshot|=|Join-Path $snapshotRoot $font.file','workerarguments|=|@(''-OutputDirectory'',$outputRoot,''-InputPresentation'',$sourceSnapshot,''-Worker'')','registrationpath|=|Join-Path $outputRoot ''font-registration.json''','root|=|(Resolve-Path -LiteralPath $OutputDirectory).Path','sourcesnapshot|=|(Resolve-Path -LiteralPath $request.source.snapshotPath).Path','stagefile|=|Join-Path $root ''stages.jsonl''','progressfile|=|Join-Path $root ''progress.json''','reportfile|=|Join-Path $root ''report.json''','operation|param|Invoke-InventoryCom|ScriptBlock')
function Get-InventoryOwnerName($Node) {
    $owner=$Node.Parent
    while($null -ne $owner -and -not ($owner -is [System.Management.Automation.Language.FunctionDefinitionAst])) { $owner=$owner.Parent }
    if($null -eq $owner) { return '' }
    return $owner.Name
}
function Get-InventoryPairValues($Pairs,[string]$Key) {
    $values=@()
    foreach($pair in $Pairs) { $parts=$pair -split '\|',2; if($parts[0] -ieq $Key) { $values+=@($parts[1]) } }
    return ,$values
}
function Get-InventoryAssignmentTarget($Expression) {
    while($Expression -is [System.Management.Automation.Language.MemberExpressionAst] -or $Expression -is [System.Management.Automation.Language.IndexExpressionAst]) {
        if($Expression -is [System.Management.Automation.Language.MemberExpressionAst]) { $Expression=$Expression.Expression } else { $Expression=$Expression.Target }
    }
    if($Expression -is [System.Management.Automation.Language.VariableExpressionAst]) { return ($Expression.VariablePath.UserPath -replace '^(script|global|local|private):','') }
    return $null
}
function Assert-InventoryAllowlistAst($Ast,[string]$Label) {
    $declared=@($Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true) | ForEach-Object { $_.Name })
    foreach($command in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.CommandAst]},$true)) {
        $owner=Get-InventoryOwnerName $command
        $first=$command.CommandElements[0]
        if($command.InvocationOperator -ne [System.Management.Automation.Language.TokenKind]::Unknown) {
            $operator=$(if($command.InvocationOperator -eq [System.Management.Automation.Language.TokenKind]::Dot){'.'}else{'&'})
            if($operator -eq '&' -and $first -is [System.Management.Automation.Language.ScriptBlockExpressionAst]) { continue }
            $variableName=$(if($first -is [System.Management.Automation.Language.VariableExpressionAst]){$first.VariablePath.UserPath -replace '^(script|global|local|private):',''}else{$null})
            if($null -eq $variableName -or $script:InventoryPolicyInvocationSites -cnotcontains "$owner|$operator|$variableName") { throw "$Label must not use dynamic code (non-literal $operator invocation in $(if($owner){$owner}else{'script scope'}): $($command.Extent.Text))" }
            continue
        }
        if(-not ($first -is [System.Management.Automation.Language.StringConstantExpressionAst]) -or $first.StringConstantType -ne [System.Management.Automation.Language.StringConstantType]::BareWord) { throw "$Label must not use dynamic code (command name $($first.Extent.Text))" }
        $name=$first.Value
        $scopes=Get-InventoryPairValues $script:InventoryPolicyScopedCommands $name
        if($scopes.Count -gt 0) {
            if($scopes -cnotcontains $owner) { throw "$Label must not run $name in $(if($owner){$owner}else{'script scope'}); it is not on the reviewed allowlist there" }
        } elseif(-not ($script:InventoryPolicyCommands -contains $name -or $declared -contains $name)) { throw "$Label must not run $name; it is not on the reviewed allowlist" }
        $forms=Get-InventoryPairValues $script:InventoryPolicyCommandForms $name
        if($forms.Count -gt 0 -and @($forms | Where-Object { $command.Extent.Text -cmatch $_ }).Count -eq 0) { throw "$Label must not run $name in a form that is not on the reviewed allowlist: $($command.Extent.Text)" }
        if($name -in @('ForEach-Object','Where-Object')) {
            $scriptBlockOnly=($command.CommandElements.Count -eq 2 -and $command.CommandElements[1] -is [System.Management.Automation.Language.ScriptBlockExpressionAst])
            if(-not $scriptBlockOnly -and $script:InventoryPolicyPipelineExceptions -cnotcontains "$owner|$($command.Extent.Text)") { throw "$Label must pass $name exactly one script block; other forms are not on the reviewed allowlist" }
        }
    }
    foreach($member in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.MemberExpressionAst]},$true)) {
        if(-not ($member.Member -is [System.Management.Automation.Language.StringConstantExpressionAst])) {
            if($member -is [System.Management.Automation.Language.InvokeMemberExpressionAst]) { throw "$Label must not use dynamic code (dynamic member name: $($member.Extent.Text))" }
            continue
        }
        $memberName=$member.Member.Value
        if($memberName -in @('Quit','Kill')) { throw "$Label must not reference .$memberName on any object" }
        if($member.Static) {
            if(-not ($member.Expression -is [System.Management.Automation.Language.TypeExpressionAst])) { throw "$Label must not use dynamic code (static access on an expression: $($member.Extent.Text))" }
            $pair="$($member.Expression.TypeName.FullName)::$memberName"
            $list=$(if($member -is [System.Management.Automation.Language.InvokeMemberExpressionAst]){$script:InventoryPolicyStaticMembers}else{$script:InventoryPolicyStaticProperties})
            if($list -notcontains $pair) { throw "$Label must not use $pair; it is not on the reviewed allowlist" }
        } elseif($member -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $script:InventoryPolicyInstanceMembers -notcontains $memberName) { throw "$Label must not invoke .$memberName(); it is not on the reviewed allowlist" }
    }
    foreach($typeNode in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.TypeExpressionAst] -or $node -is [System.Management.Automation.Language.AttributeBaseAst]},$true)) {
        $typeName=$typeNode.TypeName.FullName
        if($script:InventoryPolicyTypes -notcontains $typeName) { throw "$Label must not use type [$typeName]; it is not on the reviewed allowlist" }
    }
    foreach($variable in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.VariableExpressionAst]},$true)) {
        if(($variable.VariablePath.UserPath -replace '^(script|global|local|private):','') -ieq 'ExecutionContext') { throw "$Label must not use dynamic code ($variable)" }
    }
    foreach($assignment in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst]},$true)) {
        $left=$assignment.Left
        if($left -is [System.Management.Automation.Language.ConvertExpressionAst]) { $left=$left.Child }
        if(-not ($left -is [System.Management.Automation.Language.MemberExpressionAst] -or $left -is [System.Management.Automation.Language.IndexExpressionAst])) { continue }
        $assignmentRoot=Get-InventoryAssignmentTarget $left
        if($null -ne $assignmentRoot -and $script:InventoryPolicyAssignmentRoots -ccontains $assignmentRoot) { continue }
        $setter=$null
        if($left -is [System.Management.Automation.Language.MemberExpressionAst] -and $left.Expression -is [System.Management.Automation.Language.VariableExpressionAst] -and $left.Member -is [System.Management.Automation.Language.StringConstantExpressionAst]) { $setter="$($left.Expression.VariablePath.UserPath -replace '^(script|global|local|private):','').$($left.Member.Value)" }
        if($null -eq $setter -or $script:InventoryPolicyComSetters -cnotcontains $setter) { throw "$Label must not assign $($left.Extent.Text); only local report roots and the documented COM setters are on the reviewed allowlist" }
    }
    foreach($unary in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.UnaryExpressionAst] -and @('PlusPlus','MinusMinus','PostfixPlusPlus','PostfixMinusMinus') -contains [string]$node.TokenKind},$true)) {
        if($unary.Child -is [System.Management.Automation.Language.MemberExpressionAst] -or $unary.Child -is [System.Management.Automation.Language.IndexExpressionAst]) {
            $assignmentRoot=Get-InventoryAssignmentTarget $unary.Child
            if($null -eq $assignmentRoot -or $script:InventoryPolicyAssignmentRoots -cnotcontains $assignmentRoot) { throw "$Label must not increment $($unary.Child.Extent.Text); only local report roots are on the reviewed allowlist" }
        }
    }
    # A local report root is bound only to a hashtable literal ([ordered] or [pscustomobject] casts included) or to one of
    # the reviewed exact sources, never through a multiple assignment, a parameter, a foreach variable or a
    # variable-binding common parameter, so it cannot alias a COM object whose members the roots may then assign.
    foreach($assignment in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst]},$true)) {
        $left=$assignment.Left
        if($left -is [System.Management.Automation.Language.ConvertExpressionAst]) { $left=$left.Child }
        $targets=@($(if($left -is [System.Management.Automation.Language.ArrayLiteralAst]){$left.Elements}else{$left}))
        foreach($target in $targets) {
            if($target -is [System.Management.Automation.Language.ConvertExpressionAst]) { $target=$target.Child }
            if(-not ($target -is [System.Management.Automation.Language.VariableExpressionAst])) { continue }
            $name=$target.VariablePath.UserPath -replace '^(script|global|local|private):',''
            if($script:InventoryPolicyAssignmentRoots -cnotcontains $name) { continue }
            if($left -is [System.Management.Automation.Language.ArrayLiteralAst]) { throw "$Label must not bind local report root `$$name through a multiple assignment" }
            $right=$assignment.Right
            $expression=$(if($right -is [System.Management.Automation.Language.CommandExpressionAst]){$right.Expression}else{$null})
            $literal=($assignment.Operator -eq [System.Management.Automation.Language.TokenKind]::Equals -and ($expression -is [System.Management.Automation.Language.HashtableAst] -or ($expression -is [System.Management.Automation.Language.ConvertExpressionAst] -and $expression.Child -is [System.Management.Automation.Language.HashtableAst] -and @('ordered','pscustomobject') -contains $expression.Type.TypeName.FullName)))
            if(-not $literal -and $script:InventoryPolicyRootSources -cnotcontains "$name|$($right.Extent.Text)") { throw "$Label must not bind local report root `$$name to $($right.Extent.Text); only literals and the reviewed sources are on the allowlist" }
        }
    }
    foreach($parameter in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.ParameterAst]},$true)) {
        if($script:InventoryPolicyAssignmentRoots -ccontains $parameter.Name.VariablePath.UserPath) { throw "$Label must not bind local report root $($parameter.Name) as a parameter" }
    }
    foreach($loop in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.ForEachStatementAst]},$true)) {
        if($script:InventoryPolicyAssignmentRoots -ccontains ($loop.Variable.VariablePath.UserPath -replace '^(script|global|local|private):','')) { throw "$Label must not bind local report root $($loop.Variable) as a foreach variable" }
    }
    foreach($parameter in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.CommandParameterAst]},$true)) {
        if($parameter.ParameterName -match '^(ov|pv|ev|wv|iv|outv[a-z]*|errorv[a-z]*|warningv[a-z]*|informationv[a-z]*|pipelinev[a-z]*|pi|pip|pipe|pipel|pipeli|pipelin|pipeline)$') { throw "$Label must not use the variable-binding parameter -$($parameter.ParameterName)" }
    }
    # Each function name is defined once, so a redefinition cannot inherit an invocation site or a scoped command.
    $functionNames=@($Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true) | ForEach-Object { $_.Name.ToLowerInvariant() })
    for($outer=0; $outer -lt $functionNames.Count; $outer++) {
        for($inner=$outer+1; $inner -lt $functionNames.Count; $inner++) {
            if($functionNames[$outer] -ceq $functionNames[$inner]) { throw "$Label must not define function $($functionNames[$outer]) more than once" }
        }
    }
    # Drive-qualified variables (${variable:...}, $function:...) other than $env: reach runtime state or redefine
    # functions; splatting and redirection bypass the reviewed argument forms.
    foreach($variable in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.VariableExpressionAst]},$true)) {
        if($variable.VariablePath.IsDriveQualified -and $variable.VariablePath.DriveName -ine 'env') { throw "$Label must not use dynamic code (drive-qualified variable $($variable.Extent.Text))" }
        if(($variable.VariablePath.UserPath -replace '^.*:','') -ieq 'ExecutionContext') { throw "$Label must not use dynamic code ($($variable.Extent.Text))" }
        if($variable.Splatted) { throw "$Label must not use dynamic code (splatted arguments $($variable.Extent.Text))" }
    }
    foreach($redirection in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.RedirectionAst]},$true)) { throw "$Label must not use redirection $($redirection.Extent.Text); it is not on the reviewed allowlist" }
    # Bare-word arguments, exact forms of file-system writes, native helper calls and COM path writes.
    foreach($command in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.CommandAst]},$true)) {
        for($position=1; $position -lt $command.CommandElements.Count; $position++) {
            $element=$command.CommandElements[$position]
            if($element -is [System.Management.Automation.Language.StringConstantExpressionAst] -and $element.StringConstantType -eq [System.Management.Automation.Language.StringConstantType]::BareWord -and $script:InventoryPolicyBareArguments -notcontains $element.Value) { throw "$Label must not pass bare argument $($element.Value); it is not on the reviewed allowlist" }
        }
        $commandName=$command.GetCommandName()
        if($null -eq $commandName) { continue }
        $exact=Get-InventoryPairValues $script:InventoryPolicyExactForms $commandName
        if($exact.Count -gt 0 -and $exact -cnotcontains (($command.Extent.Text -replace '\s+',' ') -replace '^ | $','')) { throw "$Label must not run $commandName with arguments that are not on the reviewed allowlist: $($command.Extent.Text)" }
    }
    foreach($invoke in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $node.Member -is [System.Management.Automation.Language.StringConstantExpressionAst]},$true)) {
        if($invoke.Static -and $invoke.Expression -is [System.Management.Automation.Language.TypeExpressionAst]) {
            $exact=Get-InventoryPairValues $script:InventoryPolicyExactApis "$($invoke.Expression.TypeName.FullName)::$($invoke.Member.Value)"
            if($exact.Count -gt 0 -and $exact -cnotcontains (($invoke.Extent.Text -replace '\s+',' ') -replace '^ | $','')) { throw "$Label must not call $($invoke.Extent.Text); that form is not on the reviewed allowlist" }
        } elseif(-not $invoke.Static) {
            $exact=Get-InventoryPairValues $script:InventoryPolicyExactMembers $invoke.Member.Value
            if($exact.Count -gt 0 -and $exact -cnotcontains (($invoke.Extent.Text.Substring($invoke.Expression.Extent.Text.Length) -replace '\s+',' ') -replace '^ | $','')) { throw "$Label must not call $($invoke.Extent.Text); that form is not on the reviewed allowlist" }
        }
    }
    # Pinned variables (invocation-site variables and owned paths) keep exactly their reviewed bindings.
    foreach($assignment in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst]},$true)) {
        $left=$assignment.Left
        if($left -is [System.Management.Automation.Language.ConvertExpressionAst]) { $left=$left.Child }
        $targets=@($(if($left -is [System.Management.Automation.Language.ArrayLiteralAst]){$left.Elements}else{$left}))
        foreach($target in $targets) {
            if($target -is [System.Management.Automation.Language.ConvertExpressionAst]) { $target=$target.Child }
            if(-not ($target -is [System.Management.Automation.Language.VariableExpressionAst])) { continue }
            $pinnedName=($target.VariablePath.UserPath -replace '^(script|global|local|private):','').ToLowerInvariant()
            if($script:InventoryPolicyPinned -notcontains $pinnedName) { continue }
            $binding="$pinnedName|=|$(($assignment.Right.Extent.Text -replace '\s+',' ') -replace '^ | $','')"
            if($left -is [System.Management.Automation.Language.ArrayLiteralAst] -or $assignment.Operator -ne [System.Management.Automation.Language.TokenKind]::Equals -or $script:InventoryPolicyPinnedBindings -cnotcontains $binding) { throw "$Label must not bind pinned variable `$$pinnedName to $($assignment.Right.Extent.Text); only its reviewed bindings are on the allowlist" }
        }
    }
    foreach($loop in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.ForEachStatementAst]},$true)) {
        $pinnedName=($loop.Variable.VariablePath.UserPath -replace '^(script|global|local|private):','').ToLowerInvariant()
        if($script:InventoryPolicyPinned -contains $pinnedName -and $script:InventoryPolicyPinnedBindings -cnotcontains "$pinnedName|foreach|$(($loop.Condition.Extent.Text -replace '\s+',' ') -replace '^ | $','')") { throw "$Label must not bind pinned variable `$$pinnedName in an unreviewed foreach" }
    }
    foreach($parameter in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.ParameterAst]},$true)) {
        $pinnedName=($parameter.Name.VariablePath.UserPath -replace '^(script|global|local|private):','').ToLowerInvariant()
        if($script:InventoryPolicyPinned -contains $pinnedName -and $script:InventoryPolicyPinnedBindings -cnotcontains "$pinnedName|param|$(Get-InventoryOwnerName $parameter)|$($parameter.StaticType.Name)") { throw "$Label must not declare pinned variable `$$pinnedName as an unreviewed parameter" }
    }
    foreach($unary in $Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.UnaryExpressionAst] -and $node.Child -is [System.Management.Automation.Language.VariableExpressionAst]},$true)) {
        if([string]$unary.TokenKind -in @('PlusPlus','MinusMinus','PostfixPlusPlus','PostfixMinusMinus') -and $script:InventoryPolicyPinned -contains ($unary.Child.VariablePath.UserPath -replace '^(script|global|local|private):','').ToLowerInvariant()) { throw "$Label must not modify pinned variable $($unary.Child.Extent.Text)" }
    }
}
function Assert-InventoryWorkerAst([string]$Path) {
    $tokens=$null; $parseErrors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count -ne 0) { throw "Inventory worker parse failed: $($parseErrors[0].Message)" }
    $openCount=0; $closeCount=0
    foreach($invoke in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst]},$true)) {
        if(-not ($invoke.Member -is [System.Management.Automation.Language.StringConstantExpressionAst])) { throw 'Inventory worker must not invoke a dynamically named member' }
        $name=$invoke.Member.Value
        $allowed=$(if($invoke.Static){$script:inventoryAllowedStaticMembers}else{$script:inventoryAllowedComMembers+$script:inventoryAllowedInstanceMembers})
        if($allowed -cnotcontains $name) { throw "Inventory worker must not invoke .$name(); it is not on the read-only member allowlist" }
        if($name -ieq 'Open') { $openCount++ }
        if($name -ieq 'Close') { $closeCount++ }
    }
    if($openCount -ne 1) { throw "Inventory worker must contain exactly one owned Open invocation; found $openCount" }
    if($closeCount -ne 1) { throw "Inventory worker must contain exactly one owned Close invocation; found $closeCount" }
    foreach($command in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.CommandAst]},$true)) {
        $commandName=$command.GetCommandName()
        if($null -ne $commandName -and $script:inventoryForbiddenCommands -contains ($commandName -replace '^.*\\','')) { throw "Inventory worker must not run $commandName" }
    }
    Assert-InventoryAllowlistAst $ast 'Inventory worker'
    foreach($assignment in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst]},$true)) {
        $left=$assignment.Left
        if($left -is [System.Management.Automation.Language.ConvertExpressionAst]) { $left=$left.Child }
        if($left -is [System.Management.Automation.Language.MemberExpressionAst] -or $left -is [System.Management.Automation.Language.IndexExpressionAst]) {
            $root=Get-InventoryAssignmentRoot $left
            if($null -eq $root -or $script:inventoryAssignmentRoots -cnotcontains $root) { throw "Inventory worker must not assign a member of $root" }
        }
    }
    foreach($unary in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.UnaryExpressionAst] -and @('PlusPlus','MinusMinus','PostfixPlusPlus','PostfixMinusMinus') -contains [string]$node.TokenKind},$true)) {
        if($unary.Child -is [System.Management.Automation.Language.MemberExpressionAst] -or $unary.Child -is [System.Management.Automation.Language.IndexExpressionAst]) {
            $root=Get-InventoryAssignmentRoot $unary.Child
            if($null -eq $root -or $script:inventoryAssignmentRoots -cnotcontains $root) { throw "Inventory worker must not increment a member of $root" }
        }
    }
    return $ast
}

# [string] parameters coerce `$null to ''; keep the parameter untyped so a successful stage records JSON null.
function Write-InventoryStage([string]$StageName,[string]$Status,$ErrorMessage=$null) {
    $script:sequence++; $script:lastStage=$StageName; $script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$StageName;status=$Status;error=$(if([string]::IsNullOrEmpty([string]$ErrorMessage)){$null}else{[string]$ErrorMessage});cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;ownedPresentationPath=$script:ownedPresentationPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $script:stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $script:progressFile -Encoding UTF8
}
function Invoke-InventoryCom([string]$StageName,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-InventoryStage $StageName 'begin'
    try { $value=& $Operation; Write-InventoryStage $StageName 'success'; return ,$value }
    catch { $script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-InventoryStage $StageName 'error' $_.Exception.Message; throw }
}
function Write-InventoryReport { $script:report.cleanupConfirmed=$script:cleanupConfirmed; $script:report.officeOperationsStopped=$script:officeOperationsStopped; $script:report.lastStage=$script:lastStage; $script:report.lastStatus=$script:lastStatus; $script:report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $script:reportFile -Encoding UTF8 }
# The only Close invocation in this file. It closes the presentation object this
# worker opened, after its FullName is confirmed to be the owned snapshot.
function Close-OwnedInventoryPresentation([string]$ExpectedPath,[string]$Prefix='owned.presentation') {
    if($null -eq $script:presentation) { throw 'No owned presentation is available for close' }
    $actual=[string](Invoke-InventoryCom "$Prefix.fullName-before-close.get" {$script:presentation.FullName})
    if(-not (Test-InventoryPathEqual $actual $ExpectedPath)) { throw "Refusing to close a presentation whose exact path is not owned: $actual" }
    Invoke-InventoryCom "$Prefix.close" {$script:presentation.Close()}
    $script:presentation=$null; $script:ownedPresentationPath=$null; $script:cleanupConfirmed=$true; $script:report.ownedCloseCount=[int]$script:report.ownedCloseCount+1
    Write-InventoryStage "$Prefix.cleanup" 'success'; Write-InventoryReport
}
# After a failure: close the owned presentation exactly once, but only when no
# COM call has failed (the latch is not set) and its FullName is still the owned
# snapshot. Otherwise leave it open and record cleanupConfirmed=false.
function Close-InventoryAfterFailure([string]$ExpectedPath) {
    if($null -eq $script:presentation) { return 'no-owned-presentation-open' }
    if($script:officeOperationsStopped) { $script:cleanupConfirmed=$false; return 'left-open-com-latched' }
    try { Close-OwnedInventoryPresentation $ExpectedPath 'owned.presentation.error'; return 'closed-owned-after-failure' }
    catch { $script:cleanupConfirmed=$false; return "left-open-not-closed: $($_.Exception.Message)" }
}

function New-InventorySampleObservation([string[]]$FontNames,[string]$FarEast='',[string]$ThemeLatin='Carlito',[string]$MasterComplexScript='') {
    $entries=@(); $index=0
    foreach($name in $FontNames) { $index++; $entries+=@([ordered]@{index=$index;name=$name;embedded=0;embeddable=-1}) }
    $font=[ordered]@{name='Carlito';nameAscii='Carlito';nameOther='Carlito';nameFarEast=$FarEast;nameComplexScript='';size=18.0;bold=0;italic=0}
    $run=[ordered]@{index=1;start=1;length=7;text='Regular';textTruncated=$false;font=$font}
    $paragraph=[ordered]@{index=1;start=1;length=7;text='Regular';textTruncated=$false;font=$font}
    $masterFont=[ordered]@{name='Carlito';nameAscii='Carlito';nameOther='Carlito';nameFarEast='';nameComplexScript=$MasterComplexScript;size=18.0;bold=0;italic=0}
    return ,([ordered]@{
        presentationFonts=[ordered]@{count=$entries.Count;entries=$entries}
        theme=[ordered]@{major=[ordered]@{latin=$ThemeLatin;complexScript='';eastAsian=''};minor=[ordered]@{latin='Carlito';complexScript='';eastAsian=''}}
        slides=[ordered]@{count=1;entries=@([ordered]@{index=1;shapeCount=1;shapes=@([ordered]@{index=1;name='OPF text';type=14;hasTextFrame=-1;hasText=-1;text='Regular';textLength=7;textTruncated=$false;rangeFont=$font;paragraphCount=1;paragraphs=@($paragraph);runCount=1;runs=@($run)})})}
        slideMaster=[ordered]@{shapeCount=1;shapes=@([ordered]@{index=1;name='Body Placeholder';type=14;hasTextFrame=-1;hasText=0;text=$null;textLength=$null;textTruncated=$false;rangeFont=$masterFont;paragraphCount=$null;paragraphs=@();runCount=$null;runs=@()})}
    })
}

function Invoke-InventoryPureRegression {
    $null=Assert-InventoryWorkerAst $PSCommandPath
    $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
    $pureRoot=Join-Path $tempRoot ('opf-font-inventory-pure-' + [Guid]::NewGuid().ToString('n'))
    [void](New-Item -ItemType Directory -Path $pureRoot); $pureRoot=(Resolve-Path -LiteralPath $pureRoot).Path
    if(-not $pureRoot.StartsWith($tempRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Pure regression directory escaped the system temporary directory' }
    try {
        $policyNegatives=[ordered]@{
            saveAs='$p=$a.Open($x,-1,0,0); $p.SaveAs($y,24,0); $p.Close()'
            save='$p=$a.Open($x,-1,0,0); $p.Save(); $p.Close()'
            quit='$p=$a.Open($x,-1,0,0); $p.Close(); $a.Quit()'
            export='$p=$a.Open($x,-1,0,0); $p.ExportAsFixedFormat($y,2); $p.Close()'
            comPropertySet='$p=$a.Open($x,-1,0,0); $shape.Name=''edited''; $p.Close()'
            comFontSet='$p=$a.Open($x,-1,0,0); $font.Name=''Aptos''; $p.Close()'
            secondOpen='$p=$a.Open($x,-1,0,0); $q=$a.Open($y,-1,0,0); $p.Close()'
            missingClose='$p=$a.Open($x,-1,0,0)'
            secondClose='$p=$a.Open($x,-1,0,0); $p.Close(); $p.Close()'
            stopProcess='$p=$a.Open($x,-1,0,0); $p.Close(); Stop-Process -Name POWERPNT'
            dynamicMember='$p=$a.Open($x,-1,0,0); $m=''Save''; $p.$m(); $p.Close()'
            setter='$p=$a.Open($x,-1,0,0); $p.set_Saved(-1); $p.Close()'
            addSlide='$p=$a.Open($x,-1,0,0); $s=$p.Slides.Add(1,1); $p.Close()'
            addShape='$p=$a.Open($x,-1,0,0); $s=$p.Slides.Item(1).Shapes.AddTextbox(1,0,0,9,9); $p.Close()'
            applyTemplate='$p=$a.Open($x,-1,0,0); $p.ApplyTemplate($y); $p.Close()'
            applyTheme='$p=$a.Open($x,-1,0,0); $p.ApplyTheme($y); $p.Close()'
            replaceFont='$p=$a.Open($x,-1,0,0); $p.Fonts.Replace(''Aptos'',''Carlito''); $p.Close()'
            staticCall='$p=$a.Open($x,-1,0,0); [IO.File]::Delete($y); $p.Close()'
            memberIncrement='$p=$a.Open($x,-1,0,0); $shape.Top++; $p.Close()'
            invokeExpression='$p=$a.Open($x,-1,0,0); Invoke-Expression $y; $p.Close()'
            iexAlias='$p=$a.Open($x,-1,0,0); iex $y; $p.Close()'
            qualifiedInvokeExpression='$p=$a.Open($x,-1,0,0); Microsoft.PowerShell.Utility\Invoke-Expression $y; $p.Close()'
            stringNamedIex='$p=$a.Open($x,-1,0,0); & ''iex'' $y; $p.Close()'
            addType='$p=$a.Open($x,-1,0,0); Add-Type -TypeDefinition $y; $p.Close()'
            scriptBlockCreate='$p=$a.Open($x,-1,0,0); $null=[scriptblock]::Create($y); $p.Close()'
            invokeScript='$p=$a.Open($x,-1,0,0); $null=$Host.Runspace.InvokeScript($y); $p.Close()'
            executionContext='$p=$a.Open($x,-1,0,0); $null=$ExecutionContext.SessionState; $p.Close()'
            invokeCommand='$p=$a.Open($x,-1,0,0); Invoke-Command -ScriptBlock $y; $p.Close()'
            callVariable='$p=$a.Open($x,-1,0,0); & $y; $p.Close()'
            dotSourceVariable='$p=$a.Open($x,-1,0,0); . $y; $p.Close()'
            operationOutsideComWrapper='$p=$a.Open($x,-1,0,0); & $Operation; $p.Close()'
        }
        $policyRejected=[ordered]@{}
        foreach($key in $policyNegatives.Keys) {
            $negativePath=Join-Path $pureRoot "policy-$key.ps1"; [IO.File]::WriteAllText($negativePath,$policyNegatives[$key])
            $rejected=$false; try { $null=Assert-InventoryWorkerAst $negativePath } catch { $rejected=$true }
            $policyRejected[$key]=$rejected
        }
        $positivePath=Join-Path $pureRoot 'policy-positive.ps1'; [IO.File]::WriteAllText($positivePath,'$p=$a.Open($x,-1,0,0); $n=$p.Fonts.Item(1).Name; $report.name=$n; $p.Close()')
        $null=Assert-InventoryWorkerAst $positivePath
        if(@($policyRejected.Values | Where-Object {-not $_}).Count -ne 0) { throw "Static policy accepted a negative control: $((@($policyRejected.Keys | Where-Object {-not $policyRejected[$_]})) -join ',')" }

        $script:stageFile=Join-Path $pureRoot 'stages.jsonl'; $script:progressFile=Join-Path $pureRoot 'progress.json'; $script:sequence=0
        $script:officeOperationsStopped=$false; $script:cleanupConfirmed=$true; $script:ownedPresentationPath=$null
        [void](Invoke-InventoryCom 'pure.success' { 1 })
        $failureCaught=$false
        try { Invoke-InventoryCom 'pure.failure' { throw 'Deliberate non-Office failure' } } catch { $failureCaught=$true }
        if(-not $failureCaught -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw 'COM failure latch did not engage or cleanup remained misleadingly confirmed' }
        $script:unexpectedCall=$false
        try { Invoke-InventoryCom 'pure.forbidden-followup' { $script:unexpectedCall=$true } } catch { }
        if($script:unexpectedCall) { throw 'Operation ran after the failure latch' }
        $stageLines=@(Get-Content -LiteralPath $script:stageFile -Encoding UTF8)
        $stageRecords=@($stageLines | ForEach-Object { $_ | ConvertFrom-Json })
        if(($stageRecords | ForEach-Object { "$($_.stage)/$($_.status)" }) -join ',' -cne 'pure.success/begin,pure.success/success,pure.failure/begin,pure.failure/error') { throw 'Unexpected pure stage sequence' }
        if(@($stageLines[0..2] | Where-Object { $_ -notmatch '"error":null,' }).Count -ne 0) { throw 'Non-error stage records must serialize error as JSON null' }
        if($stageRecords[3].error -cne 'Deliberate non-Office failure') { throw 'Error stage record lost its message' }

        # URL FullName values (cloud decks) are never owned and never throw.
        $cloudUrl='https://contoso.sharepoint.com/sites/team/Shared%20Documents/deck.pptx'
        $ownedPath=Join-Path $pureRoot 'inputs\source.pptx'
        if((Test-InventoryPathEqual $cloudUrl $ownedPath) -or (Test-InventoryPathEqual $ownedPath $cloudUrl) -or (Test-InventoryPathEqual '' $ownedPath) -or -not (Test-InventoryPathEqual (Join-Path $pureRoot 'inputs\..\inputs\source.pptx') $ownedPath)) { throw 'Path ownership comparison mishandled a URL, empty or relative path' }

        # Close-on-failure decisions against a non-COM stand-in presentation.
        $script:reportFile=Join-Path $pureRoot 'report.json'
        $errorCloseCases=@(
            @('owned',$ownedPath,$false,'closed-owned-after-failure',$true,'owned.presentation.error.fullName-before-close.get/begin,owned.presentation.error.fullName-before-close.get/success,owned.presentation.error.close/begin,owned.presentation.error.close/success,owned.presentation.error.cleanup/success'),
            @('comLatched',$ownedPath,$true,'left-open-com-latched',$false,''),
            @('otherPath',(Join-Path $pureRoot 'other.pptx'),$false,'left-open-not-closed:*',$false,'owned.presentation.error.fullName-before-close.get/begin,owned.presentation.error.fullName-before-close.get/success'),
            @('cloudUrl',$cloudUrl,$false,'left-open-not-closed:*',$false,'owned.presentation.error.fullName-before-close.get/begin,owned.presentation.error.fullName-before-close.get/success'),
            @('noPresentation',$null,$false,'no-owned-presentation-open',$false,'')
        )
        $errorCloseOutcomes=[ordered]@{}
        foreach($case in $errorCloseCases) {
            $script:stageFile=Join-Path $pureRoot "error-close-$($case[0]).jsonl"; $script:progressFile=Join-Path $pureRoot "error-close-$($case[0]).progress.json"; $script:sequence=0
            $script:report=[ordered]@{ownedCloseCount=0;cleanupConfirmed=$false;officeOperationsStopped=$false;lastStage=$null;lastStatus=$null}
            $script:officeOperationsStopped=$case[2]; $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$ownedPath; $script:presentation=$null
            if($null -ne $case[1]) { $standIn=[pscustomobject]@{FullName=$case[1]}; $standIn | Add-Member -MemberType ScriptMethod -Name Close -Value { }; $script:presentation=$standIn }
            $outcome=Close-InventoryAfterFailure $ownedPath
            $observedStages=$(if(Test-Path -LiteralPath $script:stageFile){(@(Get-Content -LiteralPath $script:stageFile -Encoding UTF8 | ForEach-Object { $row=$_ | ConvertFrom-Json; "$($row.stage)/$($row.status)" })) -join ','}else{''})
            $closed=($null -eq $script:presentation -and $null -ne $case[1])
            if($outcome -notlike $case[3] -or $closed -ne $case[4] -or $script:cleanupConfirmed -ne $case[4] -or $script:report.ownedCloseCount -ne $(if($case[4]){1}else{0}) -or $observedStages -cne $case[5]) { throw "Close-on-failure control $($case[0]) failed: $outcome / $observedStages" }
            $errorCloseOutcomes[$case[0]]=$outcome
        }
        $script:presentation=$null; $script:officeOperationsStopped=$false

        $canonicalFonts=@($script:inventoryCanonicalFaces.Keys | ForEach-Object {[pscustomobject]@{file=$_;sha256=$script:inventoryCanonicalFaces[$_]}})
        $validGeneration=[pscustomobject]@{kind='native-font-edit-fixture';source=[pscustomobject]@{file='source.pptx';sha256=('0'*64)};license=[pscustomobject]@{file='LICENSE_FONT';spdx='OFL-1.1';sha256=$script:inventoryLicenseSha256};registration=[pscustomobject]@{flags=0};fonts=$canonicalFonts}
        Assert-InventoryCanonicalGeneration $validGeneration
        $wrongGeneration=[pscustomobject]@{kind='native-font-edit-fixture';source=$validGeneration.source;license=$validGeneration.license;registration=$validGeneration.registration;fonts=@($canonicalFonts | ForEach-Object {[pscustomobject]@{file=$_.file;sha256=$_.sha256}})}
        $wrongGeneration.fonts[0].sha256=('f'*64); $wrongHashRejected=$false
        try { Assert-InventoryCanonicalGeneration $wrongGeneration } catch { $wrongHashRejected=$true }
        $stringFlags=[pscustomobject]@{kind='native-font-edit-fixture';source=$validGeneration.source;license=$validGeneration.license;registration=[pscustomobject]@{flags='0'};fonts=$canonicalFonts}; $stringFlagsRejected=$false
        try { Assert-InventoryCanonicalGeneration $stringFlags } catch { $stringFlagsRejected=$true }
        if(-not $wrongHashRejected -or -not $stringFlagsRejected) { throw 'Canonical generation negative controls failed' }

        # Serialize registrations exactly as native-text-fonts.ps1 does, then decode.
        $sampleRows=@($script:inventoryCanonicalFaces.Keys | ForEach-Object {@{file=$_;sha256=$script:inventoryCanonicalFaces[$_];added=1;removed=$true}})
        $registrationPath=Join-Path $pureRoot 'font-registration.json'
        @($sampleRows) | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $registrationPath -Encoding UTF8
        $decoded=Read-InventoryRegistrations $registrationPath
        if($decoded.Count -ne 4 -or -not (Test-InventoryFontCleanup $decoded)) { throw 'Registration JSON array did not decode to four cleaned rows' }
        $sampleRows[2].removed=$false; @($sampleRows) | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $registrationPath -Encoding UTF8
        if(Test-InventoryFontCleanup (Read-InventoryRegistrations $registrationPath)) { throw 'An unremoved registration was accepted' }

        $carlitoLedger=Get-InventoryFontLedger (New-InventorySampleObservation @('Carlito'))
        $aptosFontsLedger=Get-InventoryFontLedger (New-InventorySampleObservation @('Carlito','Aptos'))
        $aptosRunLedger=Get-InventoryFontLedger (New-InventorySampleObservation @('Carlito') 'Aptos')
        $aptosThemeLedger=Get-InventoryFontLedger (New-InventorySampleObservation @('Carlito') '' 'Aptos Display')
        $aptosMasterLedger=Get-InventoryFontLedger (New-InventorySampleObservation @('Carlito') '' 'Carlito' 'Aptos')
        if($carlitoLedger.aptosReported -or -not $carlitoLedger.carlitoOnlyPresentationFonts -or ($carlitoLedger.slideTextSlotNames -join '|') -cne 'Carlito' -or ($carlitoLedger.masterTextSlotNames -join '|') -cne 'Carlito') { throw 'Carlito-only ledger control failed' }
        if(-not $aptosFontsLedger.aptosReported -or ($aptosFontsLedger.aptosPresentationFontNames -join '|') -cne 'Aptos' -or ($aptosFontsLedger.nonCarlitoPresentationFontNames -join '|') -cne 'Aptos' -or $aptosFontsLedger.carlitoOnlyPresentationFonts) { throw 'Presentation.Fonts Aptos ledger control failed' }
        if(-not $aptosRunLedger.aptosReported -or ($aptosRunLedger.aptosSlideTextSlotNames -join '|') -cne 'Aptos' -or $aptosRunLedger.aptosPresentationFontNames.Count -ne 0 -or -not $aptosRunLedger.carlitoOnlyPresentationFonts) { throw 'Slide text-slot Aptos ledger control failed' }
        if(-not $aptosThemeLedger.aptosReported -or ($aptosThemeLedger.aptosThemeFontNames -join '|') -cne 'Aptos Display') { throw 'Theme Aptos ledger control failed' }
        if(-not $aptosMasterLedger.aptosReported -or ($aptosMasterLedger.aptosMasterTextSlotNames -join '|') -cne 'Aptos' -or $aptosMasterLedger.aptosSlideTextSlotNames.Count -ne 0) { throw 'Master text-slot Aptos ledger control failed' }
        $ledgerJson=$aptosFontsLedger | ConvertTo-Json -Depth 5 -Compress
        if($ledgerJson -notmatch '"aptosPresentationFontNames":\["Aptos"\]' -or $ledgerJson -notmatch '"aptosSlideTextSlotNames":\[\]') { throw 'Ledger arrays did not serialize as JSON arrays' }

        $goodReport=[pscustomobject]@{cleanupConfirmed=$true;officeOperationsStopped=$false;ownedOpenCount=1;ownedCloseCount=1;error=$null;source=[pscustomobject]@{readOnly=-1;openedPathMatches=$true;snapshotUnchangedAfterClose=$true};boundsExceeded=@();semanticFailures=@();fontLedger=$carlitoLedger}
        $goodDurable=[pscustomobject]@{stage='worker.complete';status='success';cleanupConfirmed=$true}
        $goodResult=[pscustomobject]@{timedOut=$false;exitCode=0}
        $cleanRows=@($script:inventoryCanonicalFaces.Keys | ForEach-Object {[pscustomobject]@{file=$_;added=1;removed=$true}})
        $decide={ param($Result,$Durable,$Report,$Mode,$Registrations,$Present,$Inputs) Get-InventoryParentDecision $Result $Durable $Report $Mode $Registrations $Present $Inputs $null }
        $goodTemporary=& $decide $goodResult $goodDurable $goodReport 'temporary-session' $cleanRows $true $true
        $goodNone=& $decide $goodResult $goodDurable $goodReport 'none' @() $false $true
        $mutate={ param($Name,$Value) $sample=$goodReport | ConvertTo-Json -Depth 10 | ConvertFrom-Json; if($Name -like 'source.*'){ $sample.source.($Name.Substring(7))=$Value } else { $sample.$Name=$Value }; return ,$sample }
        $negativeDecisions=[ordered]@{
            closeCount=(& $decide $goodResult $goodDurable (& $mutate 'ownedCloseCount' 0) 'temporary-session' $cleanRows $true $true)
            openCount=(& $decide $goodResult $goodDurable (& $mutate 'ownedOpenCount' 2) 'temporary-session' $cleanRows $true $true)
            notReadOnly=(& $decide $goodResult $goodDurable (& $mutate 'source.readOnly' 0) 'temporary-session' $cleanRows $true $true)
            snapshotChanged=(& $decide $goodResult $goodDurable (& $mutate 'source.snapshotUnchangedAfterClose' $false) 'temporary-session' $cleanRows $true $true)
            boundsExceeded=(& $decide $goodResult $goodDurable (& $mutate 'boundsExceeded' @('slides')) 'temporary-session' $cleanRows $true $true)
            workerError=(& $decide $goodResult $goodDurable (& $mutate 'error' 'x') 'temporary-session' $cleanRows $true $true)
            unremovedFont=(& $decide $goodResult $goodDurable $goodReport 'temporary-session' @($cleanRows[0],$cleanRows[1],$cleanRows[2],[pscustomobject]@{file='x';added=1;removed=$false}) $true $true)
            noneWithRegistrationFile=(& $decide $goodResult $goodDurable $goodReport 'none' @() $true $true)
            unknownMode=(& $decide $goodResult $goodDurable $goodReport 'other' $cleanRows $true $true)
            timedOut=(& $decide ([pscustomobject]@{timedOut=$true;exitCode=0}) $goodDurable $goodReport 'temporary-session' $cleanRows $true $true)
            stringExitCode=(& $decide ([pscustomobject]@{timedOut=$false;exitCode='0'}) $goodDurable $goodReport 'temporary-session' $cleanRows $true $true)
            inputsChanged=(& $decide $goodResult $goodDurable $goodReport 'temporary-session' $cleanRows $true $false)
            failedDurable=(& $decide $goodResult ([pscustomobject]@{stage='worker.failure';status='error';cleanupConfirmed=$true}) $goodReport 'temporary-session' $cleanRows $true $true)
        }
        if(-not $goodTemporary.passed -or -not $goodNone.passed -or $null -ne $goodNone.fontCleanupConfirmed) { throw 'Parent decision rejected a valid control' }
        $accepted=@($negativeDecisions.Keys | Where-Object {$negativeDecisions[$_].passed})
        if($accepted.Count -ne 0) { throw "Parent decision accepted negative controls: $($accepted -join ',')" }
        [ordered]@{passed=$true;officeOrComCalls=0;fontApiCalls=0;readOnlyStaticPolicy=$true;policyNegativesRejected=$policyRejected;stopLatchPassed=$true;nonErrorStageErrorIsNull=$true;canonicalGenerationNegativesRejected=$true;registrationArrayDecodedRows=$decoded.Count;closeOnFailure=$errorCloseOutcomes;urlFullNameNotOwned=$true;ledgerAptosControlsPassed=$true;parentDecisionNegativesRejected=@($negativeDecisions.Keys)} | ConvertTo-Json -Depth 6
    } finally {
        if(Test-Path -LiteralPath $pureRoot) {
            $deleteRoot=(Resolve-Path -LiteralPath $pureRoot).Path
            if($deleteRoot.StartsWith($tempRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $deleteRoot -Recurse -Force -ErrorAction SilentlyContinue }
        }
    }
}

if($PureRegression) { Invoke-InventoryPureRegression; return }
if($Worker -or $ControlDeck) {
    foreach($required in @(@('OutputDirectory',$OutputDirectory),@('InputPresentation',$InputPresentation))) { if([string]::IsNullOrWhiteSpace([string]$required[1])) { throw "$($required[0]) is required" } }
    if($ControlDeck -and (-not [string]::IsNullOrWhiteSpace($FontFixtureDirectory) -or $WithoutTemporaryFonts -or $Worker)) { throw '-ControlDeck takes only OutputDirectory, InputPresentation and TimeoutSeconds; control decks never register fixture fonts' }
} else {
    foreach($required in @(@('OutputDirectory',$OutputDirectory),@('InputPresentation',$InputPresentation),@('FontFixtureDirectory',$FontFixtureDirectory))) {
        if([string]::IsNullOrWhiteSpace([string]$required[1])) { throw "$($required[0]) is required unless -PureRegression or -ControlDeck is selected" }
    }
}

function Get-InventoryInputChecks($Request,[switch]$SnapshotsOnly) {
    $checks=@()
    $records=@([ordered]@{role='source';expected=[string]$Request.source.sha256;original=[string]$Request.source.path;snapshot=[string]$Request.source.snapshotPath})
    if($null -ne $Request.fixture) {
        $records+=@([ordered]@{role='generation';expected=[string]$Request.fixture.generation.sha256;original=[string]$Request.fixture.generation.path;snapshot=[string]$Request.fixture.generation.snapshotPath})
        $records+=@([ordered]@{role='license';expected=[string]$Request.fixture.license.sha256;original=[string]$Request.fixture.license.path;snapshot=[string]$Request.fixture.license.snapshotPath})
    }
    $records+=@(
        [ordered]@{role='verifier';expected=[string]$Request.verifier.sha256;original=[string]$Request.verifier.path;snapshot=[string]$Request.verifier.snapshotPath},
        [ordered]@{role='process-helper';expected=[string]$Request.processHelper.sha256;original=[string]$Request.processHelper.path;snapshot=[string]$Request.processHelper.snapshotPath},
        [ordered]@{role='font-helper';expected=[string]$Request.fontHelper.sha256;original=[string]$Request.fontHelper.path;snapshot=[string]$Request.fontHelper.snapshotPath}
    )
    if($null -ne $Request.fixture) { foreach($font in @($Request.fixture.fonts)) { $records+=@([ordered]@{role="font:$($font.file)";expected=[string]$font.sha256;original=[string]$font.path;snapshot=[string]$font.snapshotPath}) } }
    foreach($item in $records) {
        $snapshotActual=$(if(Test-Path -LiteralPath $item.snapshot -PathType Leaf){Get-InventorySha256 $item.snapshot}else{$null})
        $checks+=@([ordered]@{role=$item.role;copy='snapshot';path=$item.snapshot;expected=$item.expected;actual=$snapshotActual;matched=($snapshotActual -ceq $item.expected)})
        if(-not $SnapshotsOnly) {
            $originalActual=$(if(Test-Path -LiteralPath $item.original -PathType Leaf){Get-InventorySha256 $item.original}else{$null})
            $checks+=@([ordered]@{role=$item.role;copy='original';path=$item.original;expected=$item.expected;actual=$originalActual;matched=($originalActual -ceq $item.expected)})
        }
    }
    return ,$checks
}

if(-not $Worker) {
    $inputPath=(Resolve-Path -LiteralPath $InputPresentation).Path
    if([IO.Path]::GetExtension($inputPath) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
    $inputMode=$(if($ControlDeck){'control-deck'}else{'carlito-fixture'})
    $registrationMode=$(if($ControlDeck -or $WithoutTemporaryFonts){'none'}else{'temporary-session'})
    $fixtureGeneration=$null
    if(-not $ControlDeck) {
        $fixtureRoot=(Resolve-Path -LiteralPath $FontFixtureDirectory).Path
        $generationPath=(Resolve-Path -LiteralPath (Join-Path $fixtureRoot 'generation.json')).Path
        $fixtureGeneration=Get-Content -LiteralPath $generationPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-InventoryCanonicalGeneration $fixtureGeneration
        $fixtureSource=(Resolve-Path -LiteralPath (Join-Path $fixtureRoot 'source.pptx')).Path
        if($fixtureSource -ine $inputPath) { throw 'InputPresentation must be the fixture source.pptx' }
        if((Get-InventorySha256 $inputPath) -cne $fixtureGeneration.source.sha256) { throw 'Fixture source.pptx hash differs from generation.json' }
        $licensePath=(Resolve-Path -LiteralPath (Join-Path $fixtureRoot 'LICENSE_FONT')).Path
        Assert-InventoryFileHash $licensePath $script:inventoryLicenseSha256 'Carlito OFL license'
        foreach($font in @($fixtureGeneration.fonts)) { Assert-InventoryFileHash (Resolve-Path -LiteralPath (Join-Path $fixtureRoot $font.file)).Path ([string]$script:inventoryCanonicalFaces[[string]$font.file]) "Carlito face $($font.file)" }
    }

    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'; [void](New-Item -ItemType Directory -Path $snapshotRoot)
    $verifierSnapshot=Join-Path $snapshotRoot 'native-font-inventory.ps1'
    $processOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path; $processSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $fontHelperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-text-fonts.ps1')).Path; $fontHelperSnapshot=Join-Path $snapshotRoot 'native-text-fonts.ps1'
    $sourceSnapshot=Join-Path $snapshotRoot 'source.pptx'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $processOriginal -Destination $processSnapshot
    Copy-Item -LiteralPath $fontHelperOriginal -Destination $fontHelperSnapshot
    Copy-Item -LiteralPath $inputPath -Destination $sourceSnapshot
    $fixtureRequest=$null
    if(-not $ControlDeck) {
        [void](New-Item -ItemType Directory -Path (Join-Path $snapshotRoot 'fonts'))
        $generationSnapshot=Join-Path $snapshotRoot 'generation.json'; $licenseSnapshot=Join-Path $snapshotRoot 'LICENSE_FONT'
        Copy-Item -LiteralPath $generationPath -Destination $generationSnapshot
        Copy-Item -LiteralPath $licensePath -Destination $licenseSnapshot
        $fontInputs=@()
        foreach($font in @($fixtureGeneration.fonts)) {
            $external=(Resolve-Path -LiteralPath (Join-Path $fixtureRoot $font.file)).Path; $snapshot=Join-Path $snapshotRoot $font.file
            Copy-Item -LiteralPath $external -Destination $snapshot
            $fontInputs+=@([ordered]@{file=[string]$font.file;path=$external;sha256=[string]$font.sha256;snapshotPath=$snapshot;snapshotSha256=(Get-InventorySha256 $snapshot)})
        }
        $fixtureRequest=[ordered]@{path=$fixtureRoot;generation=[ordered]@{path=$generationPath;sha256=(Get-InventorySha256 $generationPath);snapshotPath=$generationSnapshot;snapshotSha256=(Get-InventorySha256 $generationSnapshot)};license=[ordered]@{path=$licensePath;sha256=$script:inventoryLicenseSha256;snapshotPath=$licenseSnapshot;snapshotSha256=(Get-InventorySha256 $licenseSnapshot);spdx='OFL-1.1'};fonts=$fontInputs}
    }
    $request=[ordered]@{
        schemaVersion=1;kind='native-font-inventory';inputMode=$inputMode
        source=[ordered]@{path=$inputPath;sha256=(Get-InventorySha256 $inputPath);snapshotPath=$sourceSnapshot;snapshotSha256=(Get-InventorySha256 $sourceSnapshot)}
        fixture=$fixtureRequest
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-InventorySha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-InventorySha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$processOriginal;sha256=(Get-InventorySha256 $processOriginal);snapshotPath=$processSnapshot;snapshotSha256=(Get-InventorySha256 $processSnapshot)}
        fontHelper=[ordered]@{path=$fontHelperOriginal;sha256=(Get-InventorySha256 $fontHelperOriginal);snapshotPath=$fontHelperSnapshot;snapshotSha256=(Get-InventorySha256 $fontHelperSnapshot)}
        fontRegistration=[ordered]@{mode=$registrationMode;flags=$(if($registrationMode -ceq 'none'){$null}else{0})}
        bounds=$script:inventoryBounds
        scope='Open one owned input snapshot read-only, enumerate Presentation.Fonts first, then theme font slots and bounded whole-range, paragraph and run Font2 slots on slides and the first slide master, then close that exact presentation. No edit, save, export, reopen, embedding or application quit.'
    }
    $request | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    $generation=$null
    if(-not $ControlDeck) {
        $generation=Get-Content -LiteralPath $generationSnapshot -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-InventoryCanonicalGeneration $generation
        Assert-InventoryFileHash $licenseSnapshot $script:inventoryLicenseSha256 'Carlito OFL license snapshot'
    }
    $preflightChecks=Get-InventoryInputChecks $request -SnapshotsOnly
    if(@($preflightChecks | Where-Object {-not $_.matched}).Count -ne 0) { throw 'One or more copied input snapshots changed before the worker; no font API or Office call was started' }
    . $processSnapshot; . $fontHelperSnapshot
    $script:inventoryWorkerResult=$null; $parentFailure=$null
    $workerArguments=@('-OutputDirectory',$outputRoot,'-InputPresentation',$sourceSnapshot,'-Worker')
    try {
        if($registrationMode -ceq 'temporary-session') {
            Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $snapshotRoot -RunRoot $outputRoot -Action {
                $script:inventoryWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments $workerArguments -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
            }
        } else {
            $script:inventoryWorkerResult=Invoke-OpfNativeWorker -ScriptPath $verifierSnapshot -WorkerArguments $workerArguments -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
        }
    } catch { $parentFailure=$_.Exception.Message }
    $lastDurable=$null; $progressPath=Join-Path $outputRoot 'progress.json'
    if(Test-Path -LiteralPath $progressPath) { try {$lastDurable=Get-Content -LiteralPath $progressPath -Raw -Encoding UTF8 | ConvertFrom-Json} catch {} }
    $registrations=@(); $registrationPath=Join-Path $outputRoot 'font-registration.json'; $registrationFilePresent=(Test-Path -LiteralPath $registrationPath)
    if($registrationFilePresent) { try {$registrations=Read-InventoryRegistrations $registrationPath} catch {$parentFailure="Unreadable font-registration.json: $($_.Exception.Message)"} }
    $inputChecks=Get-InventoryInputChecks $request; $inputsUnchanged=(@($inputChecks | Where-Object {-not $_.matched}).Count -eq 0)
    $workerReport=$null; $workerReportPath=Join-Path $outputRoot 'report.json'
    if(Test-Path -LiteralPath $workerReportPath) { try {$workerReport=Get-Content -LiteralPath $workerReportPath -Raw -Encoding UTF8 | ConvertFrom-Json} catch {$parentFailure="Unreadable worker report: $($_.Exception.Message)"} }
    $decision=Get-InventoryParentDecision $script:inventoryWorkerResult $lastDurable $workerReport $registrationMode $registrations $registrationFilePresent $inputsUnchanged $parentFailure
    $ledger=$(if($null -eq $workerReport){$null}else{$workerReport.fontLedger})
    $ledgerFontNames=$null; if($null -ne $ledger) { $ledgerFontNames=[string[]]@($ledger.presentationFontNames) }
    $terminal=[ordered]@{
        timestamp=(Get-Date).ToUniversalTime().ToString('o');passed=$decision.passed;timedOut=$decision.timedOut;exitCode=$decision.exitCode
        inputMode=$inputMode;fontRegistrationMode=$registrationMode;officeLifecycleComplete=$decision.officeLifecycleComplete;readOnlyConfirmed=$decision.readOnlyConfirmed;inventoryComplete=$decision.inventoryComplete
        fontCleanupConfirmed=$decision.fontCleanupConfirmed;registrationFilePresent=$registrationFilePresent;inputsUnchanged=$inputsUnchanged
        ownedOpenCount=$(if($null -eq $workerReport){0}else{$workerReport.ownedOpenCount});ownedCloseCount=$(if($null -eq $workerReport){0}else{$workerReport.ownedCloseCount})
        lastDurableStage=$(if($null -eq $lastDurable){$null}else{$lastDurable.stage});lastDurableStatus=$(if($null -eq $lastDurable){$null}else{$lastDurable.status});parentError=$parentFailure
        aptosReported=$(if($null -eq $ledger){$null}else{$ledger.aptosReported});presentationFontNames=$ledgerFontNames
        inputChecks=$inputChecks
    }
    $terminal | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'worker.stdout.log')) { Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object {Write-Host $_} }
    [ordered]@{passed=$decision.passed;inputMode=$inputMode;fontRegistrationMode=$registrationMode;aptosReported=$terminal.aptosReported;presentationFontNames=$terminal.presentationFontNames;outputDirectory=$outputRoot} | ConvertTo-Json -Depth 4 -Compress | Write-Host
    if(-not $decision.passed) { throw 'Native font inventory failed, timed out, or did not confirm the owned read-only Office/font/input lifecycle; preserve the attempt and inspect supervisor.json. No retry was started.' }
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$request=Get-Content -LiteralPath (Join-Path $root 'request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceSnapshot=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path
if(-not (Test-InventoryPathEqual $sourceSnapshot (Join-Path $root 'inputs/source.pptx'))) { throw 'Worker source snapshot must be inputs/source.pptx inside the output directory' }
if(-not (Test-InventoryPathEqual $sourceSnapshot $InputPresentation)) { throw 'Worker InputPresentation must be the recorded source snapshot' }
$script:stageFile=Join-Path $root 'stages.jsonl'; $script:progressFile=Join-Path $root 'progress.json'; $script:reportFile=Join-Path $root 'report.json'
foreach($reserved in @($script:stageFile,$script:progressFile,$script:reportFile)) { if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' } }
$workerInputChecks=Get-InventoryInputChecks $request -SnapshotsOnly
if(@($workerInputChecks | Where-Object {-not $_.matched}).Count -ne 0) { throw 'One or more worker input snapshots changed before Office startup' }
if((Get-InventorySha256 $PSCommandPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }
$inputMode=[string]$request.inputMode; $registrationMode=[string]$request.fontRegistration.mode
if($inputMode -ceq 'carlito-fixture') {
    $workerGeneration=Get-Content -LiteralPath $request.fixture.generation.snapshotPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-InventoryCanonicalGeneration $workerGeneration
    if(@('temporary-session','none') -cnotcontains $registrationMode) { throw 'request.fontRegistration.mode must be temporary-session or none' }
    if($registrationMode -ceq 'temporary-session' -and -not ((Test-InventoryInteger $request.fontRegistration.flags) -and $request.fontRegistration.flags -eq 0)) { throw 'Temporary registration flags must be the JSON integer 0' }
} elseif($inputMode -ceq 'control-deck') {
    if($null -ne $request.fixture -or $registrationMode -cne 'none') { throw 'A control deck has no fixture and never registers fonts' }
} else { throw 'request.inputMode must be carlito-fixture or control-deck' }

$script:sequence=0; $script:lastStage='worker.initialize'; $script:lastStatus='begin'; $script:cleanupConfirmed=$true; $script:officeOperationsStopped=$false; $script:ownedPresentationPath=$null; $script:presentation=$null
$script:paragraphsRead=0; $script:runsRead=0
$bounds=$script:inventoryBounds
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$script:report=[ordered]@{
    schemaVersion=1;kind='native-font-inventory';inputMode=$inputMode
    source=[ordered]@{path=$request.source.path;sha256=$request.source.sha256;snapshotPath=$sourceSnapshot;snapshotSha256=(Get-InventorySha256 $sourceSnapshot);fullName=$null;openedPathMatches=$false;readOnly=$null;snapshotUnchangedAfterClose=$null}
    fontRegistration=[ordered]@{mode=$registrationMode;flags=$request.fontRegistration.flags}
    bounds=$bounds
    presentationFonts=[ordered]@{count=$null;entries=@()}
    theme=[ordered]@{major=[ordered]@{latin=$null;complexScript=$null;eastAsian=$null};minor=[ordered]@{latin=$null;complexScript=$null;eastAsian=$null}}
    slides=[ordered]@{count=$null;entries=@()}
    slideMaster=[ordered]@{shapeCount=$null;shapes=@()}
    boundsExceeded=@();semanticFailures=@();fontLedger=$null
    preflightPresentationCount=$null;ownedOpenCount=0;ownedCloseCount=0;failureCleanup=$null
    environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null}
    cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;lastStage=$script:lastStage;lastStatus=$script:lastStatus;error=$null
    scope='Read-only native observation of one unedited input snapshot. Presentation.Fonts, theme font slots and Font2 slots are names reported by PowerPoint; they do not prove physical font-file or per-glyph identity.'
    limitations=@(
        'Presentation.Fonts is enumerated before any other presentation content is read.',
        'Slide layouts, notes pages, the notes master, group members and table cells are not enumerated. Only the first slide master shapes and its theme font slots are read.',
        'endParaRPr is not exposed as a COM object. For a text frame with no text, the whole-range Font2 read is the closest observation; a paragraph range covers its characters, not its end-of-paragraph properties.',
        'A reported name does not prove which physical font file drew a glyph or why PowerPoint listed it.',
        'This worker performs no edit, save, embedding, export or reopen.'
    )
}
function Limit-InventoryText([string]$Text) { if($Text.Length -gt $bounds.maxTextCharacters) { return $Text.Substring(0,$bounds.maxTextCharacters) }; return $Text }
function Assert-InventoryPresentationNotOpen($Application,[string]$Path) {
    $presentations=Invoke-InventoryCom 'input.preflight.presentations.get' {return ,$Application.Presentations}
    $count=[int](Invoke-InventoryCom 'input.preflight.presentations.count.get' {$presentations.Count})
    $script:report.preflightPresentationCount=$count; Write-InventoryReport
    if($count -gt 32) { throw "Refusing to scan $count open presentations for ownership" }
    for($index=1;$index -le $count;$index++) {
        $candidate=Invoke-InventoryCom "input.preflight.presentation-$index.get" {return ,$presentations.Item($index)}
        $actual=Invoke-InventoryCom "input.preflight.presentation-$index.fullName.get" {$candidate.FullName}
        if(Test-InventoryPathEqual ([string]$actual) $Path) { throw "Presentation is already open, so ownership cannot be established: $Path" }
    }
}
function Read-InventoryPresentationFonts {
    $collection=Invoke-InventoryCom 'owned.presentation.fonts.get' {return ,$script:presentation.Fonts}
    $count=[int](Invoke-InventoryCom 'owned.presentation.fonts.count.get' {$collection.Count})
    $script:report.presentationFonts.count=$count
    if($count -gt $bounds.maxPresentationFonts) { $script:report.boundsExceeded+=@('presentationFonts'); return }
    for($index=1;$index -le $count;$index++) {
        $font=Invoke-InventoryCom "owned.presentation.fonts.item-$index.get" {return ,$collection.Item($index)}
        $name=[string](Invoke-InventoryCom "owned.presentation.fonts.item-$index.name.get" {$font.Name})
        $embedded=[int](Invoke-InventoryCom "owned.presentation.fonts.item-$index.embedded.get" {$font.Embedded})
        $embeddable=[int](Invoke-InventoryCom "owned.presentation.fonts.item-$index.embeddable.get" {$font.Embeddable})
        $script:report.presentationFonts.entries+=@([ordered]@{index=$index;name=$name;embedded=$embedded;embeddable=$embeddable})
    }
    Write-InventoryReport
}
function Read-InventoryThemeFonts($Master) {
    $theme=Invoke-InventoryCom 'owned.slideMaster.theme.get' {return ,$Master.Theme}
    $scheme=Invoke-InventoryCom 'owned.theme.themeFontScheme.get' {return ,$theme.ThemeFontScheme}
    foreach($kind in @('major','minor')) {
        if($kind -ceq 'major') { $fonts=Invoke-InventoryCom 'owned.theme.majorFont.get' {return ,$scheme.MajorFont} }
        else { $fonts=Invoke-InventoryCom 'owned.theme.minorFont.get' {return ,$scheme.MinorFont} }
        foreach($slot in $script:inventoryThemeSlots) {
            $themeFont=Invoke-InventoryCom "owned.theme.$($kind)Font.$($slot[0]).get" {return ,$fonts.Item([int]$slot[1])}
            $script:report.theme[$kind][$slot[0]]=[string](Invoke-InventoryCom "owned.theme.$($kind)Font.$($slot[0]).name.get" {$themeFont.Name})
        }
    }
    Write-InventoryReport
}
# Font2 slot reads shared by whole ranges, paragraphs and runs.
function Read-InventoryFont2($Range,[string]$Prefix) {
    $font=Invoke-InventoryCom "$Prefix.font.get" {return ,$Range.Font}
    return ,([ordered]@{
        name=[string](Invoke-InventoryCom "$Prefix.font.name.get" {$font.Name})
        nameAscii=[string](Invoke-InventoryCom "$Prefix.font.nameAscii.get" {$font.NameAscii})
        nameOther=[string](Invoke-InventoryCom "$Prefix.font.nameOther.get" {$font.NameOther})
        nameFarEast=[string](Invoke-InventoryCom "$Prefix.font.nameFarEast.get" {$font.NameFarEast})
        nameComplexScript=[string](Invoke-InventoryCom "$Prefix.font.nameComplexScript.get" {$font.NameComplexScript})
        size=[double](Invoke-InventoryCom "$Prefix.font.size.get" {$font.Size})
        bold=[int](Invoke-InventoryCom "$Prefix.font.bold.get" {$font.Bold})
        italic=[int](Invoke-InventoryCom "$Prefix.font.italic.get" {$font.Italic})
    })
}
function Read-InventorySubrange($Subrange,[int]$Index,[string]$Prefix) {
    $text=[string](Invoke-InventoryCom "$Prefix.text.get" {$Subrange.Text})
    $start=[int](Invoke-InventoryCom "$Prefix.start.get" {$Subrange.Start})
    $length=[int](Invoke-InventoryCom "$Prefix.length.get" {$Subrange.Length})
    $font=Read-InventoryFont2 $Subrange $Prefix
    return ,([ordered]@{index=$Index;start=$start;length=$length;text=(Limit-InventoryText $text);textTruncated=($text.Length -gt $bounds.maxTextCharacters);font=$font})
}
function Get-InventoryAllowance([int]$Count,[int]$PerShape,[string]$TotalCounter,[int]$Total,[string]$Label) {
    $allowed=[Math]::Min($Count,$PerShape)
    if($Count -gt $PerShape) { $script:report.boundsExceeded+=@("$Label.perShape") }
    $used=[int](Get-Variable -Scope Script -Name $TotalCounter -ValueOnly)
    if($used + $allowed -gt $Total) { $script:report.boundsExceeded+=@("$Label.total"); $allowed=[Math]::Max(0,$Total-$used) }
    Set-Variable -Scope Script -Name $TotalCounter -Value ($used+$allowed)
    return $allowed
}
function Read-InventoryShapes($Shapes,[string]$Prefix) {
    $shapeCount=[int](Invoke-InventoryCom "$Prefix.shapes.count.get" {$Shapes.Count})
    if($shapeCount -gt $bounds.maxShapesPerSlide) { $script:report.boundsExceeded+=@("$Prefix.shapes") }
    $records=@()
    for($shapeIndex=1;$shapeIndex -le [Math]::Min($shapeCount,$bounds.maxShapesPerSlide);$shapeIndex++) {
        $shapePrefix="$Prefix.shape-$shapeIndex"
        $shape=Invoke-InventoryCom "$shapePrefix.get" {return ,$Shapes.Item($shapeIndex)}
        $shapeRecord=[ordered]@{index=$shapeIndex;name=[string](Invoke-InventoryCom "$shapePrefix.name.get" {$shape.Name});type=[int](Invoke-InventoryCom "$shapePrefix.type.get" {$shape.Type});hasTextFrame=[int](Invoke-InventoryCom "$shapePrefix.hasTextFrame.get" {$shape.HasTextFrame});hasText=$null;text=$null;textLength=$null;textTruncated=$false;rangeFont=$null;paragraphCount=$null;paragraphs=@();runCount=$null;runs=@()}
        if($shapeRecord.hasTextFrame -eq -1) {
            $frame=Invoke-InventoryCom "$shapePrefix.textFrame2.get" {return ,$shape.TextFrame2}
            $shapeRecord.hasText=[int](Invoke-InventoryCom "$shapePrefix.hasText.get" {$frame.HasText})
            # The whole range is read even when empty: it is the closest COM view of end-of-paragraph properties.
            $range=Invoke-InventoryCom "$shapePrefix.textRange2.get" {return ,$frame.TextRange}
            $text=[string](Invoke-InventoryCom "$shapePrefix.text.get" {$range.Text})
            $shapeRecord.text=Limit-InventoryText $text; $shapeRecord.textTruncated=($text.Length -gt $bounds.maxTextCharacters)
            $shapeRecord.textLength=[int](Invoke-InventoryCom "$shapePrefix.length.get" {$range.Length})
            $shapeRecord.rangeFont=Read-InventoryFont2 $range $shapePrefix
            if($shapeRecord.hasText -eq -1) {
                $paragraphs=Invoke-InventoryCom "$shapePrefix.paragraphs.get" {return ,$range.Paragraphs()}
                $shapeRecord.paragraphCount=[int](Invoke-InventoryCom "$shapePrefix.paragraphs.count.get" {$paragraphs.Count})
                $allowedParagraphs=Get-InventoryAllowance $shapeRecord.paragraphCount $bounds.maxParagraphsPerShape 'paragraphsRead' $bounds.maxParagraphsTotal "$shapePrefix.paragraphs"
                for($paragraphIndex=1;$paragraphIndex -le $allowedParagraphs;$paragraphIndex++) {
                    $paragraphPrefix="$shapePrefix.paragraph-$paragraphIndex"
                    $paragraph=Invoke-InventoryCom "$paragraphPrefix.get" {return ,$range.Paragraphs($paragraphIndex,1)}
                    $shapeRecord.paragraphs+=@(Read-InventorySubrange $paragraph $paragraphIndex $paragraphPrefix)
                }
                $runs=Invoke-InventoryCom "$shapePrefix.runs.get" {return ,$range.Runs()}
                $shapeRecord.runCount=[int](Invoke-InventoryCom "$shapePrefix.runs.count.get" {$runs.Count})
                $allowedRuns=Get-InventoryAllowance $shapeRecord.runCount $bounds.maxRunsPerShape 'runsRead' $bounds.maxRunsTotal "$shapePrefix.runs"
                for($runIndex=1;$runIndex -le $allowedRuns;$runIndex++) {
                    $runPrefix="$shapePrefix.run-$runIndex"
                    $run=Invoke-InventoryCom "$runPrefix.get" {return ,$range.Runs($runIndex,1)}
                    $shapeRecord.runs+=@(Read-InventorySubrange $run $runIndex $runPrefix)
                }
            }
        }
        $records+=@($shapeRecord)
    }
    return ,([ordered]@{shapeCount=$shapeCount;shapes=$records})
}
function Read-InventorySlides {
    $slides=Invoke-InventoryCom 'owned.presentation.slides.get' {return ,$script:presentation.Slides}
    $slideCount=[int](Invoke-InventoryCom 'owned.presentation.slides.count.get' {$slides.Count})
    $script:report.slides.count=$slideCount
    if($slideCount -gt $bounds.maxSlides) { $script:report.boundsExceeded+=@('slides') }
    for($slideIndex=1;$slideIndex -le [Math]::Min($slideCount,$bounds.maxSlides);$slideIndex++) {
        $slidePrefix="owned.slide-$slideIndex"
        $slide=Invoke-InventoryCom "$slidePrefix.get" {return ,$slides.Item($slideIndex)}
        $slideShapes=Invoke-InventoryCom "$slidePrefix.shapes.get" {return ,$slide.Shapes}
        $observed=Read-InventoryShapes $slideShapes $slidePrefix
        $script:report.slides.entries+=@([ordered]@{index=$slideIndex;shapeCount=$observed.shapeCount;shapes=$observed.shapes}); Write-InventoryReport
    }
}
function Read-InventoryMasterShapes($Master) {
    $masterShapes=Invoke-InventoryCom 'owned.slideMaster.shapes.get' {return ,$Master.Shapes}
    $observed=Read-InventoryShapes $masterShapes 'owned.slideMaster'
    $script:report.slideMaster.shapeCount=$observed.shapeCount; $script:report.slideMaster.shapes=$observed.shapes; Write-InventoryReport
}
Write-InventoryReport; Write-InventoryStage 'worker.initialize' 'success'
try {
    $app=Invoke-InventoryCom 'application.create' {return ,(New-Object -ComObject PowerPoint.Application)}
    $script:report.environment.powerPointVersion=[string](Invoke-InventoryCom 'application.version.get' {$app.Version}); Write-InventoryReport
    Assert-InventoryPresentationNotOpen $app $sourceSnapshot
    $presentations=Invoke-InventoryCom 'input.presentations.get' {return ,$app.Presentations}
    $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$sourceSnapshot; Write-InventoryReport
    # Open(FileName, ReadOnly=msoTrue, Untitled=msoFalse, WithWindow=msoFalse)
    $script:presentation=Invoke-InventoryCom 'input.presentation.open-readonly' {return ,$presentations.Open($sourceSnapshot,(-1),0,0)}
    $script:report.ownedOpenCount=1; Write-InventoryReport
    $fullName=[string](Invoke-InventoryCom 'owned.presentation.fullName.get' {$script:presentation.FullName})
    $script:report.source.fullName=$fullName; $script:report.source.openedPathMatches=(Test-InventoryPathEqual $fullName $sourceSnapshot)
    if(-not $script:report.source.openedPathMatches) { throw "Opened presentation path does not match the exact owned snapshot: $fullName" }
    $script:report.source.readOnly=[int](Invoke-InventoryCom 'owned.presentation.readOnly.get' {$script:presentation.ReadOnly}); Write-InventoryReport
    if($script:report.source.readOnly -eq -1) {
        # Presentation.Fonts is read first, before any other presentation content is touched.
        Read-InventoryPresentationFonts
        $master=Invoke-InventoryCom 'owned.presentation.slideMaster.get' {return ,$script:presentation.SlideMaster}
        Read-InventoryThemeFonts $master
        Read-InventorySlides
        Read-InventoryMasterShapes $master
    } else { $script:report.semanticFailures+=@('presentation-not-read-only') }
    Close-OwnedInventoryPresentation $sourceSnapshot
    $script:report.source.snapshotUnchangedAfterClose=((Get-InventorySha256 $sourceSnapshot) -ceq [string]$request.source.sha256)
    if(-not $script:report.source.snapshotUnchangedAfterClose) { $script:report.semanticFailures+=@('source-snapshot-changed') }
    $script:report.fontLedger=Get-InventoryFontLedger $script:report; Write-InventoryReport
    if(@($script:report.boundsExceeded).Count -ne 0 -or @($script:report.semanticFailures).Count -ne 0) { throw "Inventory incomplete after owned close: $((@($script:report.boundsExceeded)+@($script:report.semanticFailures)) -join ',')" }
    Write-InventoryStage 'worker.complete' 'success'; Write-InventoryReport
    Write-Output 'Read-only native font inventory completed; run native-font-inventory-audit.mjs on this directory.'
} catch {
    $caught=$_
    $script:report.error=$caught.Exception.Message
    $script:report.failureCleanup=Close-InventoryAfterFailure $sourceSnapshot
    if($script:officeOperationsStopped -or $null -ne $script:presentation){$script:cleanupConfirmed=$false}
    Write-InventoryStage 'worker.failure' 'error' $caught.Exception.Message; Write-InventoryReport
    throw $caught
}
