param([string]$ScriptPath=(Join-Path $PSScriptRoot 'native-furniture-control.ps1'),[string]$RunnerPath=(Join-Path $PSScriptRoot '../../../scripts/native-acceptance/run-windows.ps1'))
$ErrorActionPreference='Stop'
function Import-PureDefinitions([string]$Path,[string[]]$Names) {
    $tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw ($errors | Out-String) }
    foreach($name in $Names) {
        $found=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
        if($found.Count -ne 1) { throw "Missing or repeated pure helper: $name" }
        Invoke-Expression ($found[0].Extent.Text -replace '^function\s+', 'function script:')
    }
}
Import-PureDefinitions $ScriptPath @('Get-FurnitureSha256','Assert-FurnitureTextProbeIntegrity','Test-Integer','Require-Property','Assert-String','Assert-FurnitureProbeKeys','Test-FurnitureProbeFinite','Read-AndValidateTextProbePlan','Read-FurnitureProbeDescriptor','Read-FurnitureTextProbe','Read-FurnitureProperty','Invoke-FurnitureCom','Stop-FurnitureLifecycle')
Import-PureDefinitions $RunnerPath @('Assert-PlainNativePath','Resolve-NativeAsset','Read-NativeTextProbeBinding','Import-NativePlanValidation')
function Write-FurnitureStage { param($Name,$Status,$Message) $script:events+=@($Name+':'+$Status) }
function Reset-Probe { $script:events=@();$script:officeOperationsStopped=$false;$script:cleanupConfirmed=$true }
$root=Join-Path ([IO.Path]::GetTempPath()) ('opf-text-probes-'+[guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $root)
$passed=0
function Reject([string]$Name,[scriptblock]$Action,[bool]$Latch=$false) {
    Reset-Probe;$caught=$false
    try { & $Action | Out-Null } catch { $caught=$true }
    if(-not $caught) { throw "$Name unexpectedly passed" }
    if($Latch) {
        if(-not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw "$Name did not stop the existing lifecycle" }
        $script:forbiddenProbeCall=$false
        try { Invoke-FurnitureCom 'forbidden-followup' { $script:forbiddenProbeCall=$true } } catch { }
        if($script:forbiddenProbeCall) { throw "$Name ran a followup after failure" }
    }
    $script:passed++
}
function New-Plan {
    return [pscustomobject]@{schemaVersion=1;archiveSha256=$script:archiveHash;targets=@([pscustomobject]@{slideIndex=1;shapeId=3;shapeName='OPF test';text='Bonjour 1';ranges=@([pscustomobject]@{start1Based=1;length=1;text='B';style=[pscustomobject]@{name='Aptos';sizePoints=24;bold=0;italic=0}})})}
}
function Save-Plan($Value) { $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $script:planPath -Encoding UTF8 }
function Read-Plan([bool]$Fonts=$true,$Actions=@()) { return Read-AndValidateTextProbePlan $script:planPath $script:archiveHash $Fonts $Actions }
function New-Range([string]$Text,[string]$Mode='') {
    $font=[pscustomobject]@{Name='Aptos';NameAscii='Aptos';NameOther='Aptos';NameFarEast='';NameComplexScript='Arabic Typesetting';Size=24;Bold=0;Italic=0}
    $range=[pscustomobject]@{Text=$Text;Font=$font;LanguageID=1025;BoundLeft=[single]12.125;BoundTop=[single]20.5;BoundWidth=[single]8.25;BoundHeight=[single]24;Mode=$Mode}
    $range | Add-Member ScriptMethod Characters { param($start,$length)
        $text=$this.Text.Substring($start-1,$length)
        $child=[pscustomobject]@{Text=$text;Font=$this.Font;LanguageID=$this.LanguageID;BoundLeft=$this.BoundLeft;BoundTop=$this.BoundTop;BoundWidth=$this.BoundWidth;BoundHeight=$this.BoundHeight}
        if($this.Mode -eq 'wrong-range') { $child.Text='foreign' }
        if($this.Mode -eq 'getter-failure') { $child | Add-Member ScriptProperty BoundWidth { throw 'Injected bound getter failure' } -Force }
        return $child
    }
    return $range
}
function New-Shape([string]$Mode='') {
    $one=New-Range 'Bonjour 1';$two=New-Range 'Bonjour 1' $Mode
    return [pscustomobject]@{TextFrame=[pscustomobject]@{TextRange=$one};TextFrame2=[pscustomobject]@{TextRange=$two}}
}
try {
    $inputPath=Join-Path $root 'case.pptx';[IO.File]::WriteAllBytes($inputPath,[byte[]](1,2,3))
    $script:archiveHash=(Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $script:planPath=Join-Path $root 'probe.json'
    $plan=New-Plan;Save-Plan $plan;$null=Read-Plan;$passed++
    if($null -ne (Read-AndValidateTextProbePlan '' 'ignored' $false @())) { throw 'Disabled probe changed default scope' };$passed++
    foreach($mode in @('wrong-archive','unknown','empty-targets','too-many-targets','duplicate-id','duplicate-name','bad-slide','bad-shape','bad-range','wrong-utf16','overlap','too-many-ranges','too-many-units','nonfinite-style','wrong-style-flag','unknown-style')) {
        $plan=New-Plan
        switch($mode) {
            wrong-archive {$plan.archiveSha256='0'*64}
            unknown {$plan | Add-Member NoteProperty foreign $true}
            empty-targets {$plan.targets=@()}
            too-many-targets {$plan.targets=@($plan.targets[0],$plan.targets[0],$plan.targets[0],$plan.targets[0])}
            duplicate-id {$other=New-Plan;$other.targets[0].shapeName='different';$plan.targets+=@($other.targets[0])}
            duplicate-name {$other=New-Plan;$other.targets[0].shapeId=4;$plan.targets+=@($other.targets[0])}
            bad-slide {$plan.targets[0].slideIndex=4}
            bad-shape {$plan.targets[0].shapeId=0}
            bad-range {$plan.targets[0].ranges[0].start1Based=999}
            wrong-utf16 {$plan.targets[0].ranges[0].text='b'}
            overlap {$plan.targets[0].ranges+=@($plan.targets[0].ranges[0])}
            too-many-ranges {$plan.targets[0].ranges=@(1..9 | ForEach-Object {$plan.targets[0].ranges[0]})}
            too-many-units {$plan.targets[0].text='a'*33;$plan.targets[0].ranges[0].text='a'*32;$plan.targets[0].ranges[0].length=32;$sample=(New-Plan).targets[0].ranges[0];$sample.start1Based=33;$sample.text='a';$plan.targets[0].ranges+=@($sample)}
            nonfinite-style {$plan.targets[0].ranges[0].style.sizePoints=[double]::PositiveInfinity}
            wrong-style-flag {$plan.targets[0].ranges[0].style.bold=$true}
            unknown-style {$plan.targets[0].ranges[0].style | Add-Member NoteProperty languageId 1025}
        }
        Save-Plan $plan;Reject $mode { $null=Read-Plan }
    }
    $plan=New-Plan;$plan.targets[0].text='A'+[char]0xD83D+[char]0xDE00+'B'
    foreach($which in @('start','end')) {
        $plan.targets[0].ranges[0].start1Based=$(if($which -eq 'start'){3}else{2})
        $plan.targets[0].ranges[0].text=$plan.targets[0].text.Substring($plan.targets[0].ranges[0].start1Based-1,1)
        Save-Plan $plan;Reject ('surrogate-'+$which) { $null=Read-Plan }
    }
    $plan.targets[0].ranges[0].start1Based=2;$plan.targets[0].ranges[0].length=2;$plan.targets[0].ranges[0].text=$plan.targets[0].text.Substring(1,2);Save-Plan $plan;$null=Read-Plan;$passed++
    $plan=New-Plan;$plan.targets[0].text=[string][char]0xE9;$plan.targets[0].ranges[0].text='e'+[char]0x301;Save-Plan $plan
    Reject 'canonically equivalent source is not exact UTF16' { $null=Read-Plan }
    $unicodeTarget=(New-Plan).targets[0];$unicodeTarget.text=[string][char]0xE9;$unicodeTarget.ranges[0].text=$unicodeTarget.text
    $unicodeShape=New-Shape;$unicodeShape.TextFrame.TextRange.Text='e'+[char]0x301;$unicodeShape.TextFrame2.TextRange.Text=$unicodeTarget.text
    Reject 'canonically equivalent native text is stale UTF16' { $null=Read-FurnitureTextProbe $unicodeShape $unicodeTarget 'ordinal' } $true
    Save-Plan (New-Plan);Reject 'missing capture switch' { $null=Read-Plan $false }
    Reject 'probe alongside mutation' { $null=Read-Plan $true @([pscustomobject]@{op='set-text'}) }
    # Actual getter/Characters implementations are invoked only on plain managed mocks.
    $target=(New-Plan).targets[0];Reset-Probe;$shape=New-Shape
    $result=Read-FurnitureTextProbe $shape $target 'mock'
    if($result.ranges.Count -ne 1 -or $result.ranges[0].styleMismatches.Count -ne 0 -or $result.ranges[0].bounds.BoundLeft.value -ne 12.125 -or $result.primary.languageId.value -ne 1025 -or $result.primary.fontSlots.NameComplexScript.value -cne 'Arabic Typesetting' -or $result.primary.fontSlots.NameFarEast.status -cne 'mixed-or-unavailable' -or $result.nativeAcceptance) { throw 'Probe observations or precision changed' };$passed++
    $shape=New-Shape;$shape.TextFrame.TextRange.Font.Name='Different';Reset-Probe;$result=Read-FurnitureTextProbe $shape $target 'style-mismatch'
    if($result.ranges[0].styleMismatches -cnotcontains 'name' -or $script:officeOperationsStopped) { throw 'Observed style mismatch was lost or treated as stale selection' };$passed++
    $shape=New-Shape;$shape.TextFrame.TextRange.Font.PSObject.Properties.Remove('NameAscii');$shape.TextFrame.TextRange.LanguageID=-2;Reset-Probe;$result=Read-FurnitureTextProbe $shape $target 'missing-mixed'
    if($result.primary.fontSlots.NameAscii.status -cne 'mixed-or-unavailable' -or $result.primary.languageId.value -ne -2 -or $result.primary.languageId.status -cne 'mixed-or-unavailable') { throw 'Missing/mixed native fields were coerced' };$passed++
    foreach($mode in @('wrong-primary','wrong-secondary','wrong-range','getter-failure','nonfinite-bounds','negative-width','nonfinite-size')) {
        $shape=New-Shape $mode
        switch($mode) {
            wrong-primary {$shape.TextFrame.TextRange.Text='foreign'}
            wrong-secondary {$shape.TextFrame2.TextRange.Text='foreign'}
            nonfinite-bounds {$shape.TextFrame2.TextRange.BoundTop=[double]::NaN}
            negative-width {$shape.TextFrame2.TextRange.BoundWidth=-1}
            nonfinite-size {$shape.TextFrame.TextRange.Font.Size=[double]::NaN}
        }
        Reject $mode { $null=Read-FurnitureTextProbe $shape $target $mode } $true
    }
    # Phase-boundary integrity reads only exact owned files; each mutation latches before further COM.
    $sourceCopy=Join-Path $root 'source-copy.pptx';$actionsCopy=Join-Path $root 'actions.json';$probeCopy=Join-Path $root 'probe-copy.json'
    [IO.File]::WriteAllBytes($sourceCopy,[IO.File]::ReadAllBytes($inputPath));[IO.File]::WriteAllText($actionsCopy,'[]');[IO.File]::WriteAllText($probeCopy,'{}')
    $probeReceipt=[pscustomobject]@{path=$planPath;snapshotPath=$probeCopy;sha256=(Get-FurnitureSha256 $planPath)}
    [IO.File]::WriteAllBytes($probeCopy,[IO.File]::ReadAllBytes($planPath));$actionsHash=Get-FurnitureSha256 $actionsCopy
    Reset-Probe;Assert-FurnitureTextProbeIntegrity $probeReceipt $inputPath $sourceCopy $script:archiveHash $actionsCopy $actionsHash;$passed++
    foreach($path in @($inputPath,$sourceCopy,$actionsCopy,$planPath,$probeCopy)) {
        $saved=[IO.File]::ReadAllBytes($path);[IO.File]::WriteAllText($path,'changed')
        Reject ('lifecycle input mutation '+[IO.Path]::GetFileName($path)) { Assert-FurnitureTextProbeIntegrity $probeReceipt $inputPath $sourceCopy $script:archiveHash $actionsCopy $actionsHash } $true
        [IO.File]::WriteAllBytes($path,$saved)
    }
    # The actual runner binds only an explicitly declared sealed suite asset.
    Save-Plan (New-Plan)
    $record=[pscustomobject]@{path='probe.json';bytes=(Get-Item -LiteralPath $planPath).Length;sha256=(Get-FileHash -LiteralPath $planPath -Algorithm SHA256).Hash.ToLowerInvariant()}
    $binding=[pscustomobject]@{root=$root;inputPath=$inputPath;selected=[pscustomobject]@{textProbePlan='probe.json'};suite=[pscustomobject]@{files=@($record)}}
    Import-NativePlanValidation $ScriptPath $false $true
    $bound=Read-NativeTextProbeBinding $binding $ScriptPath $true $true @()
    if($bound.path -ine $planPath) { throw 'Runner selected an unbound probe plan' };$passed++
    $binding.selected.textProbePlan='missing.json';Reject 'unsealed plan' { $null=Read-NativeTextProbeBinding $binding $ScriptPath $true $true @() }
    $binding.selected.textProbePlan='probe.json';Reject 'runner mutation' { $null=Read-NativeTextProbeBinding $binding $ScriptPath $true $true @([pscustomobject]@{op='set-text'}) }
    $oldWorker=Join-Path $root 'old.ps1';[IO.File]::WriteAllText($oldWorker,'param([string]$Other)')
    Reject 'old worker' { $null=Read-NativeTextProbeBinding $binding $oldWorker $true $true @() }
    Write-Output ("PASS: $passed pure/managed text-probe controls; no Office entrypoint, COM class, UI or native observation executed.")
} finally {
    $resolved=[IO.Path]::GetFullPath($root);$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if(-not $resolved.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'opf-text-probes-*') { throw 'Refuse cleanup outside the exact owned temporary root' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
