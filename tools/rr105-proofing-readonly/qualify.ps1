param(
    [Parameter(Mandatory=$true)][string]$ScriptPath,
    [Parameter(Mandatory=$true)][string]$BaselinePath,
    [Parameter(Mandatory=$true)][string]$SuiteRoot,
    [Parameter(Mandatory=$true)][string]$ReportPath,
    [switch]$ValidateOnly
)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $ReportPath) { throw 'Preserve the prior qualification report; select a fresh path' }
$parent=Split-Path -Parent ([IO.Path]::GetFullPath($ReportPath))
if(-not(Test-Path -LiteralPath $parent -PathType Container)) { throw 'Qualification report parent must exist' }
$planRoot=$ReportPath+'.plans'
if(Test-Path -LiteralPath $planRoot) { throw 'Preserve the prior pure/mock fixtures' }
[void](New-Item -ItemType Directory -Path $planRoot)
$cases=New-Object 'System.Collections.Generic.List[object]'
$protected=New-Object 'System.Collections.Generic.List[object]'
$script:events=New-Object 'System.Collections.Generic.List[string]'
$passed=$false
function Add-Case([string]$Name,$Evidence=$null) { $cases.Add([ordered]@{name=$Name;passed=$true;evidence=$Evidence}) }
function Parse-Source([string]$Path) {
    $tokens=$null;$errors=$null
    $result=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
    if($errors.Count) { throw ($errors | Out-String) }
    return ,$result
}
function Find-Function($Ast,[string]$Name) {
    $definitions=@($Ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $Name},$true))
    if($definitions.Count -ne 1) { throw "Expected one source function $Name" }
    return ,$definitions[0]
}
function Hash-Text([string]$Value) {
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-','').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}
try {
    $ast=Parse-Source $ScriptPath
    $baseline=Parse-Source $BaselinePath
    $baselineBytes=[IO.File]::ReadAllBytes($BaselinePath)
    $baselineHash=(Get-FileHash -LiteralPath $BaselinePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if($baselineHash -cne 'de0905bd8024f3eebbd0518c338e67449c45f5e2de998714069d7a14210e1943') { throw 'Frozen ce92 baseline changed' }
    $helper=Join-Path (Split-Path -Parent $ScriptPath) 'native-process.ps1'
    if((Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c') { throw 'Process helper changed' }
    $null=Parse-Source $helper
    $null=Parse-Source $PSCommandPath
    if($ast.ParamBlock.Extent.Text -cne $baseline.ParamBlock.Extent.Text) { throw 'Worker parameter block or timeout caps changed' }
    foreach($definition in $baseline.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true)) {
        $current=Find-Function $ast $definition.Name
        if($definition.Name -ceq 'Read-FurnitureState') {
            if($current.Extent.Text -ceq $definition.Extent.Text) { throw 'Expected explicit state extension is missing' }
            continue
        }
        if($current.Extent.Text -cne $definition.Extent.Text) { throw "Protected function changed: $($definition.Name)" }
        $protected.Add([ordered]@{name=$definition.Name;sha256=(Hash-Text $definition.Extent.Text);exact=$true})
    }
    $newNames=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true) | Where-Object { $candidate=$_.Name; -not @($baseline.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $candidate},$true)).Count } | ForEach-Object {$_.Name})
    if(($newNames | Sort-Object) -join '|' -cne 'Assert-FurnitureProofingInput|Assert-FurnitureProofingPhase|Read-FurnitureProofingLanguage') { throw 'Unexpected new source functions' }
    $supervisor=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.IfStatementAst] -and $node.Extent.Text.StartsWith('if(-not $Worker) {')},$true))
    $baselineSupervisor=@($baseline.FindAll({param($node) $node -is [System.Management.Automation.Language.IfStatementAst] -and $node.Extent.Text.StartsWith('if(-not $Worker) {')},$true))
    if($supervisor.Count -ne 1 -or $baselineSupervisor.Count -ne 1 -or $supervisor[0].Extent.Text -cne $baselineSupervisor[0].Extent.Text) { throw 'Supervisor source block changed' }
    $raw=[IO.File]::ReadAllText($ScriptPath);$baseRaw=[IO.File]::ReadAllText($BaselinePath)
    $tail='Write-FurnitureReport; Write-FurnitureStage ''worker.initialize'' ''success'''
    if($raw.Substring($raw.IndexOf($tail,[StringComparison]::Ordinal)) -cne $baseRaw.Substring($baseRaw.IndexOf($tail,[StringComparison]::Ordinal))) { throw 'Acquisition/SaveCopy/edited/reopen/cleanup execution tail changed' }
    if($raw.IndexOf('Save-OwnedFurnitureCopy $sourceSnapshot $savedPath',[StringComparison]::Ordinal) -ge $raw.IndexOf('$report.phases.edited=Read-FurnitureState',[StringComparison]::Ordinal)) { throw 'SaveCopy must remain before edited capture' }
    $languageMembers=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.MemberExpressionAst] -and $node.Member.Extent.Text -ceq 'LanguageID'},$true))
    if($languageMembers.Count -ne 1 -or $languageMembers[0].Extent.Text -cne '$Range.LanguageID') { throw 'Expected only the one reviewed legacy LanguageID getter' }
    foreach($assignment in $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst]},$true)) {
        if($assignment.Left.Extent.Text -match '\.LanguageID\b') { throw 'LanguageID setter introduced' }
    }
    if($raw -match '\.(LtrRun|RtlRun)\b') { throw 'Direction mutation/alternate API introduced' }
    foreach($name in @('Assert-FurnitureProofingInput','Read-FurnitureProofingLanguage','Assert-FurnitureProofingPhase')) {
        $definition=Find-Function $ast $name
        if($definition.Extent.Text -match 'New-Object\s+-ComObject|GetActiveObject|\.Select\b|\.Activate\b|Stop-Process|taskkill') { throw "Forbidden API in $name" }
    }
    Add-Case 'protected-ce92-functions-supervisor-parameters-and-execution-tail-exact' ([ordered]@{protectedFunctions=$protected.Count;saveCopyBeforeEdited=$true})
    foreach($name in @('Get-FurnitureSha256','Test-Integer','Require-Property','Assert-String','Assert-LiteralSeriesName','Read-AndValidateActionPlan','Get-FurnitureSurveySlideCount','Assert-FurnitureProofingInput','Invoke-FurnitureCom','Stop-FurnitureLifecycle','Read-NativeTags','Read-FurnitureProperty','Read-FurnitureTextFont','Read-FurnitureSeriesNameState','Read-FurnitureProofingLanguage','Assert-FurnitureProofingPhase','Read-FurnitureState')) {
        $definition=Find-Function $ast $name
        # Definitions only, explicitly selected. Never execute the worker entrypoint.
        Invoke-Expression $definition.Extent.Text
    }
    function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) { $script:events.Add($Name+':'+$Status) }
    $validPlan=Join-Path $planRoot 'empty.json';[IO.File]::WriteAllText($validPlan,'[]')
    $emptyActions=Read-AndValidateActionPlan $validPlan
    foreach($id in @('A','B','C')) {
        Assert-FurnitureProofingInput (Join-Path $SuiteRoot ($id+'.pptx')) $emptyActions $true $false
        Add-Case ('validate-only-sealed-'+$id) ([ordered]@{sha256=(Get-FurnitureSha256 (Join-Path $SuiteRoot ($id+'.pptx')));officeConstructed=$false})
    }
    function Reject-Input([string]$Name,[string]$InputPath,$Actions,[bool]$Fonts,[bool]$Survey) {
        $rejected=$false;$message=$null
        try { Assert-FurnitureProofingInput $InputPath $Actions $Fonts $Survey } catch {$rejected=$true;$message=$_.Exception.Message}
        if(-not $rejected) { throw "$Name was accepted" }
        Add-Case $Name ([ordered]@{rejected=$true;message=$message;officeConstructed=$false})
    }
    $inputA=Join-Path $SuiteRoot 'A.pptx'
    $changed=Join-Path $planRoot 'changed.pptx';$copy=[IO.File]::ReadAllBytes($inputA);$copy[1000]=$copy[1000] -bxor 1;[IO.File]::WriteAllBytes($changed,$copy)
    Reject-Input 'refuse-changed-archive' $changed $emptyActions $true $false
    Reject-Input 'refuse-unlisted-valid-archive' (Join-Path $SuiteRoot 'unlisted.pptx') $emptyActions $true $false
    Reject-Input 'refuse-multiple-slide-archive' (Join-Path $SuiteRoot 'two-slides.pptx') $emptyActions $true $false
    Reject-Input 'refuse-missing-shape-archive' (Join-Path $SuiteRoot 'missing-shape.pptx') $emptyActions $true $false
    Reject-Input 'refuse-duplicate-shape-archive' (Join-Path $SuiteRoot 'duplicate-shape.pptx') $emptyActions $true $false
    Reject-Input 'refuse-foreign-shape-archive' (Join-Path $SuiteRoot 'foreign-shape.pptx') $emptyActions $true $false
    Reject-Input 'refuse-actions' $inputA @([pscustomobject]@{op='set-text';slideIndex=1;shapeName='Exact';text='Changed'}) $true $false
    Reject-Input 'refuse-null-actions' $inputA $null $true $false
    Reject-Input 'refuse-survey-mode' 'not-read.pptx' $emptyActions $true $true
    Reject-Input 'refuse-disabled-font-capture' 'not-read.pptx' $emptyActions $false $false
    if(-not $ValidateOnly) {
        function Collection($Values,[int]$Count) {
            $collection=[pscustomobject]@{Values=@($Values);Count=$Count}
            $collection | Add-Member ScriptMethod Item {param([int]$Index) return ,$this.Values[$Index-1]}
            return ,$collection
        }
        function New-ProofingFixture {
            $script:officeOperationsStopped=$false;$script:cleanupConfirmed=$true
            $script:languageGetterCount=0;$script:phaseExports=New-Object 'System.Collections.Generic.List[string]'
            $script:mockGetterThrow=$false;$script:currentPhase='original'
            $script:report=[ordered]@{proofingLanguage=[ordered]@{expectedLanguageId=1025;observations=@();completedPhases=@()}}
            $script:actions=@();$script:ReadOnlySurvey=$false;$script:CaptureTextFonts=$true
            $script:root=Join-Path $planRoot ('mock-'+[Guid]::NewGuid().ToString('N'));[void](New-Item -ItemType Directory -Path $script:root)
            $shapeRows=Get-Content -LiteralPath (Join-Path $SuiteRoot 'mock-shapes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            $shapes=@();$ranges=@();$emptyTags=[pscustomobject]@{Count=0}
            foreach($row in $shapeRows) {
                $range=[pscustomobject]@{Text=$row.text;MockLanguageID=1025;ShapeName=$row.name}
                $range | Add-Member ScriptProperty LanguageID {
                    $script:languageGetterCount++
                    if($script:mockGetterThrow) { throw 'Deliberate read-only primary LanguageID getter failure' }
                    return ,$this.MockLanguageID
                }
                $font=[pscustomobject]@{Name=$row.font.name;Size=[single]$row.font.sizePoints;Bold=[int]$row.font.bold;Italic=[int]$row.font.italic}
                $shape=[pscustomobject]@{Id=$row.id;Name=$row.name;Type=$row.type;Left=$row.left;Top=$row.top;Width=$row.width;Height=$row.height;Rotation=$row.rotation;HasTextFrame=-1;TextFrame=[pscustomobject]@{TextRange=$range};TextFrame2=[pscustomobject]@{TextRange=[pscustomobject]@{Font=$font}};AlternativeText=$row.alternativeText;Tags=$emptyTags}
                $shapes+=@($shape);$ranges+=@($range)
            }
            $slide=[pscustomobject]@{SlideID=256;Name='Slide1';Tags=$emptyTags;Shapes=(Collection $shapes 3)}
            $slide | Add-Member ScriptMethod Export {
                param($Path,$Format,$Width,$Height)
                if($Format -cne 'PNG' -or $Width -ne 1280 -or $Height -ne 720) { throw 'Mock export shape changed' }
                $script:phaseExports.Add($script:currentPhase)
                [IO.File]::WriteAllText($Path,'Mock PNG boundary only; never a native rendering')
            }
            return [pscustomobject]@{presentation=[pscustomobject]@{Slides=(Collection @($slide) 1)};slide=$slide;shapes=$shapes;ranges=$ranges;sourceRows=$shapeRows}
        }
        function Read-Phase($Fixture,[string]$Phase) {
            $script:currentPhase=$Phase
            return Read-FurnitureState $Fixture.presentation $Phase
        }
        function Assert-Latched([string]$Name,[int]$ExportCount) {
            if(-not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw "$Name did not retain the failure latch" }
            if($script:phaseExports.Count -ne $ExportCount) { throw "$Name exported a phase PNG after failure" }
            $script:forbiddenCalled=$false;$beforeEvents=$script:events.Count
            try { Invoke-FurnitureCom 'forbidden-after-proofing-failure' {$script:forbiddenCalled=$true} } catch { }
            if($script:forbiddenCalled -or $script:events.Count -ne $beforeEvents) { throw "$Name performed a later COM operation" }
        }
        $fixture=New-ProofingFixture;$states=@()
        foreach($phase in @('original','edited','reopened')) { $states+=@(Read-Phase $fixture $phase) }
        if($script:languageGetterCount -ne 9 -or $script:report.proofingLanguage.observations.Count -ne 9 -or ($script:report.proofingLanguage.completedPhases -join '|') -cne 'original|edited|reopened') { throw 'Positive control lacks exactly nine actual getter observations' }
        if($script:phaseExports.Count -ne 3) { throw 'Positive control lacks three mock PNG boundaries' }
        foreach($state in $states) {
            foreach($shape in $state.slides[0].shapes) {
                $source=@($fixture.sourceRows | Where-Object {$_.name -ceq $shape.name})[0]
                if(-not [string]::Equals($shape.text,$source.text,[StringComparison]::Ordinal)) { throw 'Ordinal mock UTF16 text changed' }
                foreach($key in @('left','top','width','height','rotation')) { if($shape[$key] -ne $source.$key) { throw "Mock geometry $key changed" } }
                foreach($key in @('name','sizePoints','bold','italic')) { if($shape.textFont[$key] -cne $source.font.$key) { throw "Mock reported font $key changed" } }
                if($shape.textProofingLanguage.languageId -ne 1025 -or $shape.textProofingLanguage.status -cne 'uniform-exact') { throw 'Positive shape proofing descriptor changed' }
            }
        }
        Add-Case 'all-nine-phase-name-primary-language-getters-exact' ([ordered]@{getters=$script:languageGetterCount;observations=@($script:report.proofingLanguage.observations);mockPngBoundaries=@($script:phaseExports.ToArray());nativeRendering=$false;utf16FontGeometryExact=$true})
        foreach($bad in @(@('null',$null),@('mixed',-2),@('english',1033),@('zero',0),@('string','1025'),@('fraction',1025.5))) {
            $fixture=New-ProofingFixture;$fixture.ranges[0].MockLanguageID=$bad[1]
            $rejected=$false;try {$null=Read-Phase $fixture 'original'} catch {$rejected=$true}
            if(-not $rejected -or $script:languageGetterCount -ne 1 -or $script:report.proofingLanguage.observations.Count -ne 1 -or $script:report.proofingLanguage.observations[0].status -cne 'failed' -or $null -eq $script:report.proofingLanguage.observations[0].failure) { throw "$($bad[0]) lacks failure-visible proofing observation" }
            if($script:report.proofingLanguage.observations[0].observedLanguageId -cne $bad[1]) { throw "$($bad[0]) did not retain actual observed value" }
            Assert-Latched $bad[0] 0
            Add-Case ('reject-language-'+$bad[0]) $script:report.proofingLanguage.observations[0]
        }
        $fixture=New-ProofingFixture;$script:mockGetterThrow=$true
        $rejected=$false;try {$null=Read-Phase $fixture 'original'} catch {$rejected=$true}
        if(-not $rejected -or $script:languageGetterCount -ne 1 -or $script:report.proofingLanguage.observations.Count -ne 1 -or $script:report.proofingLanguage.observations[0].status -cne 'failed') { throw 'Getter throw was not retained' }
        Assert-Latched 'getter-throw' 0;Add-Case 'reject-language-getter-throw' ([ordered]@{observation=$script:report.proofingLanguage.observations[0];scope='Windows PowerShell adapts this throwing ScriptProperty as a null read; the exact-value guard rejects and latches. This is not evidence of native COM exception wording.'})
        foreach($phase in @('edited','reopened')) {
            $fixture=New-ProofingFixture;$null=Read-Phase $fixture 'original';$exports=1
            if($phase -ceq 'reopened') { $null=Read-Phase $fixture 'edited';$exports=2 }
            $fixture.ranges[1].MockLanguageID=1033
            $rejected=$false;try {$null=Read-Phase $fixture $phase} catch {$rejected=$true}
            if(-not $rejected -or $script:report.proofingLanguage.observations[-1].observedLanguageId -ne 1033) { throw "$phase language change was not retained" }
            Assert-Latched $phase $exports;Add-Case ('reject-changed-language-in-'+$phase) ([ordered]@{phase=$phase;previousMockPngs=$exports;failedObservation=$script:report.proofingLanguage.observations[-1]})
        }
        foreach($mode in @('missing','duplicate','foreign','wrong-case','no-text-frame','empty-text','extra-slide')) {
            $fixture=New-ProofingFixture
            switch($mode) {
                'missing' {$fixture.slide.Shapes=Collection @($fixture.shapes[0],$fixture.shapes[1]) 2}
                'duplicate' {$fixture.slide.Shapes=Collection @($fixture.shapes[0],$fixture.shapes[0],$fixture.shapes[2]) 3}
                'foreign' {$fixture.shapes[0].Name='Foreign shape'}
                'wrong-case' {$fixture.shapes[0].Name='opf heading slides.0.title line 0'}
                'no-text-frame' {$fixture.shapes[0].HasTextFrame=0}
                'empty-text' {$fixture.ranges[0].Text=''}
                'extra-slide' {$fixture.presentation.Slides.Count=2}
            }
            $rejected=$false;try {$null=Read-Phase $fixture 'original'} catch {$rejected=$true}
            if(-not $rejected) { throw "$mode native shape state was accepted" }
            Assert-Latched $mode 0;Add-Case ('reject-native-'+$mode)
        }
        $fixture=New-ProofingFixture;$null=Read-Phase $fixture 'original'
        $rejected=$false;try {$null=Read-Phase $fixture 'reopened'} catch {$rejected=$true}
        if(-not $rejected) { throw 'Missing edited phase was accepted' }
        Assert-Latched 'missing-phase' 1;Add-Case 'reject-missing-phase'
        $fixture=New-ProofingFixture;$null=Read-Phase $fixture 'original'
        $rejected=$false;try {$null=Read-Phase $fixture 'original'} catch {$rejected=$true}
        if(-not $rejected) { throw 'Repeated phase was accepted' }
        Assert-Latched 'repeated-phase' 1;Add-Case 'reject-repeated-phase'
        foreach($mode in @('missing-observation','duplicate-observation','foreign-observation','changed-observation')) {
            $fixture=New-ProofingFixture
            foreach($index in @(0,1,2)) { $null=Read-FurnitureProofingLanguage $fixture.ranges[$index] 'original' 1 $fixture.shapes[$index].Name ('mock-shape-'+$index) }
            switch($mode) {
                'missing-observation' {$script:report.proofingLanguage.observations=@($script:report.proofingLanguage.observations[0],$script:report.proofingLanguage.observations[1])}
                'duplicate-observation' {$script:report.proofingLanguage.observations[2].shapeName=$script:report.proofingLanguage.observations[0].shapeName}
                'foreign-observation' {$script:report.proofingLanguage.observations[2].shapeName='Foreign'}
                'changed-observation' {$script:report.proofingLanguage.observations[2].observedLanguageId=1033}
            }
            $rejected=$false;try {Assert-FurnitureProofingPhase 'original' $true} catch {$rejected=$true}
            if(-not $rejected) { throw "$mode completed a phase" }
            Assert-Latched $mode 0;Add-Case ('reject-'+$mode)
        }
    }
    $passed=$true
} finally {
    [ordered]@{schema=1;passed=$passed;validateOnly=[bool]$ValidateOnly;officeConstructed=$false;actualOfficeAcceptance=$false;source=[ordered]@{workerSha256=(Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant();baselineSha256=(Get-FileHash -LiteralPath $BaselinePath -Algorithm SHA256).Hash.ToLowerInvariant();processHelperSha256=(Get-FileHash -LiteralPath (Join-Path (Split-Path -Parent $ScriptPath) 'native-process.ps1') -Algorithm SHA256).Hash.ToLowerInvariant()};protectedFunctions=@($protected.ToArray());cases=@($cases.ToArray());events=@($script:events.ToArray());scope='Only parsed source functions, exact archives and plain object mocks. No worker entrypoint, COM object, Office, UI, setters, fallback or native rendering is executed.'} | ConvertTo-Json -Depth 24 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
}
Write-Output ('Proofing source/mock qualification passed: '+$cases.Count+' controls; Office constructed: false')
