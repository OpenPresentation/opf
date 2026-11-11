param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][string]$InputPresentation,
    [string]$ActionPlan='',
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$Worker,
    [switch]$CaptureTextFonts,
    [switch]$ReadOnlySurvey,
    [string]$TextProbePlan=''
)
$ErrorActionPreference='Stop'

function Get-FurnitureSha256([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Test-Integer($Value) { return $Value -is [int] -or $Value -is [long] }
function Require-Property($Action,[string]$Name,[string]$Context) {
    if($null -eq $Action.PSObject.Properties[$Name]) { throw "$Context requires property '$Name'" }
    # Preserve the JSON property value itself: a singleton array must remain an array.
    return ,($Action.$Name)
}
function Assert-String($Value,[string]$Name,[string]$Context,[int]$Maximum=65535,[bool]$AllowEmpty=$true) {
    if(-not ($Value -is [string])) { throw "$Context property '$Name' must be a string" }
    if((-not $AllowEmpty -and $Value.Length -eq 0) -or $Value.Length -gt $Maximum) { throw "$Context property '$Name' has an invalid length" }
}
function Assert-LiteralSeriesName($Value,[string]$Name,[string]$Context) {
    Assert-String $Value $Name $Context 255 $false
    if($Value.Trim() -cne $Value -or $Value -match '[\x00-\x1F\x7F=!\[\]\$:]+|^[+@-]'){throw "$Context $Name must be a literal name, not a formula, range, control text or padded value"}
}

function Read-AndValidateActionPlan([string]$Path) {
    if($Path -eq '') { return ,@() }
    $resolved=(Resolve-Path -LiteralPath $Path).Path
    if([IO.Path]::GetExtension($resolved) -ine '.json') { throw 'ActionPlan must be one existing JSON file' }
    $raw=Get-Content -LiteralPath $resolved -Raw -Encoding UTF8
    if(-not $raw.TrimStart().StartsWith('[') -or -not $raw.TrimEnd().EndsWith(']')) { throw 'ActionPlan root must be a JSON list' }
    # Windows PowerShell 5.1 wraps an inline empty ConvertFrom-Json pipeline as
    # one nested Object[] inside @(...). Assign first, then normalize, so [] is
    # exactly zero actions while singleton and multi-action lists stay flat.
    $parsed=$raw | ConvertFrom-Json
    $items=@($parsed)
    if($items.Count -gt 20) { throw 'ActionPlan cannot contain more than 20 actions' }
    $operations=@('set-text-style','set-text','set-alt','delete-shape','duplicate-shape','set-tag','delete-tag','move-slide','measure-chart-point','set-chart-series-name')
    for($index=0;$index -lt $items.Count;$index++) {
        $action=$items[$index]; $context="Action $($index+1)"
        if($null -eq $action -or $action -isnot [pscustomobject]) { throw "$context must be an object" }
        $op=Require-Property $action 'op' $context; Assert-String $op 'op' $context 40 $false
        if($operations -notcontains $op) { throw "$context has unknown operation '$op'" }
        if($op -ieq 'set-chart-series-name' -and $op -cne 'set-chart-series-name'){throw "$context requires the exact bounded series-name operation spelling"}
        $slideIndex=Require-Property $action 'slideIndex' $context
        if(-not (Test-Integer $slideIndex) -or $slideIndex -lt 1 -or $slideIndex -gt 3) { throw "$context slideIndex must be an integer from 1 through 3" }
        $allowed=@('op','slideIndex')
        if($op -notin @('move-slide','set-chart-series-name')) {
            if($op -notin @('set-tag','delete-tag') -or $action.target -ne 'slide') {
                $shapeName=Require-Property $action 'shapeName' $context; Assert-String $shapeName 'shapeName' $context 255 $false; $allowed+='shapeName'
            }
        }
        switch($op) {
            'set-chart-series-name' {
                $chartName=Require-Property $action 'chartName' $context;Assert-String $chartName 'chartName' $context 255 $false
                $seriesIndex=Require-Property $action 'seriesIndex' $context;if(-not (Test-Integer $seriesIndex) -or $seriesIndex -lt 1 -or $seriesIndex -gt 256){throw "$context seriesIndex must be an integer from1through256"}
                foreach($key in @('expectedName','newName')){$value=Require-Property $action $key $context;Assert-LiteralSeriesName $value $key $context}
                if($action.expectedName -ceq $action.newName){throw "$context must make an actual literal name change"}
                $allowed+=@('chartName','seriesIndex','expectedName','newName')
            }
            'measure-chart-point' {
                $chartName=Require-Property $action 'chartName' $context; Assert-String $chartName 'chartName' $context 255 $false
                foreach($key in @('seriesIndex','pointIndex')) {
                    $number=Require-Property $action $key $context
                    if(-not (Test-Integer $number) -or $number -lt 1 -or $number -gt 256) { throw "$context $key must be an integer from 1 through 256" }
                }
                $kind=Require-Property $action 'chartKind' $context; Assert-String $kind 'chartKind' $context 40 $false
                if($kind -cnotin @('horizontal-bar','vertical-bar','marker','slice')) {throw "$context chartKind is not a bounded classic mark"}
                $edge=Require-Property $action 'edge' $context; Assert-String $edge 'edge' $context 20 $false
                if($edge -cnotin @('start','end','top','bottom','center')) {throw "$context edge is not a point edge"}
                $sign=Require-Property $action 'valueSign' $context; if(-not (Test-Integer $sign) -or $sign -notin @(-1,0,1)) {throw "$context valueSign must be -1, 0 or 1"}
                $allowed+=@('chartName','seriesIndex','pointIndex','chartKind','edge','valueSign')
            }

            'set-text' { $text=Require-Property $action 'text' $context; Assert-String $text 'text' $context; $allowed+='text' }
            'set-text-style' {
                $hasSize=$null -ne $action.PSObject.Properties['fontSize']; $hasColor=$null -ne $action.PSObject.Properties['color']
                if(-not $hasSize -and -not $hasColor) { throw "$context requires fontSize or color" }
                if($hasSize) {
                    $size=$action.fontSize
                    if(($size -isnot [int] -and $size -isnot [long] -and $size -isnot [double] -and $size -isnot [decimal]) -or [double]::IsNaN([double]$size) -or [double]::IsInfinity([double]$size) -or $size -lt 1 -or $size -gt 96) { throw "$context fontSize must be a finite number from 1 through 96 points" }
                    $allowed+='fontSize'
                }
                if($hasColor) { if($action.color -isnot [string] -or $action.color -cnotmatch '^[0-9A-Fa-f]{6}$') { throw "$context color must be six hex digits RRGGBB" }; $allowed+='color' }
            }
            'set-alt' { $alt=Require-Property $action 'alt' $context; Assert-String $alt 'alt' $context; $allowed+='alt' }
            'duplicate-shape' { $newName=Require-Property $action 'newName' $context; Assert-String $newName 'newName' $context 255 $false; $allowed+='newName' }
            'set-tag' {
                $target=Require-Property $action 'target' $context; if($target -notin @('shape','slide')) { throw "$context target must be 'shape' or 'slide'" }
                $tagName=Require-Property $action 'tagName' $context; $tagValue=Require-Property $action 'tagValue' $context
                Assert-String $tagName 'tagName' $context 255 $false; Assert-String $tagValue 'tagValue' $context
                $allowed+=@('target','tagName','tagValue')
            }
            'delete-tag' {
                $target=Require-Property $action 'target' $context; if($target -notin @('shape','slide')) { throw "$context target must be 'shape' or 'slide'" }
                $tagName=Require-Property $action 'tagName' $context; Assert-String $tagName 'tagName' $context 255 $false
                $allowed+=@('target','tagName')
            }
            'move-slide' {
                $toIndex=Require-Property $action 'toIndex' $context
                if(-not (Test-Integer $toIndex) -or $toIndex -lt 1 -or $toIndex -gt 3) { throw "$context toIndex must be an integer from 1 through 3" }
                $allowed+='toIndex'
            }
        }
        foreach($property in $action.PSObject.Properties.Name) { if($allowed -cnotcontains $property) { throw "$context has unknown property '$property'" } }
    }
    $renames=@($items | Where-Object {$_.op -ceq 'set-chart-series-name'})
    if($renames.Count){
        if(@($items | Where-Object {$_.op -cnotin @('set-chart-series-name','measure-chart-point')}).Count){throw 'Series-name qualification may mix only literal edits and point measurements'}
        $targets=@{};$newNames=@{}
        foreach($rename in $renames){$target=ConvertTo-Json -InputObject @($rename.slideIndex,$rename.chartName,$rename.seriesIndex) -Compress;$name=ConvertTo-Json -InputObject @($rename.slideIndex,$rename.chartName,$rename.newName) -Compress;if($targets.ContainsKey($target) -or $newNames.ContainsKey($name)){throw 'Repeated series target or duplicate new name in one native edit plan'};$targets[$target]=$true;$newNames[$name]=$true}
    }
    return ,$items
}

function Get-FurnitureSurveySlideCount([string]$Path) {
    # Read the ZIP directory only. No extraction, XML execution or Office construction.
    if((Get-Item -LiteralPath $Path).Length -gt 16777216) { throw 'Read-only survey input exceeds 16 MiB' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $surveyArchive=[IO.Compression.ZipFile]::OpenRead($Path)
    try {
        if($surveyArchive.Entries.Count -gt 4096) { throw 'Read-only survey ZIP directory exceeds 4096 entries' }
        $surveySlides=0
        foreach($surveyEntry in $surveyArchive.Entries) { if($surveyEntry.FullName -cmatch '^ppt/slides/slide[1-9][0-9]*\.xml$') { $surveySlides++ } }
        return $surveySlides
    } finally { $surveyArchive.Dispose() }
}
function Assert-FurnitureSurvey([bool]$Requested,$Actions,[string]$Path) {
    if(-not $Requested) { return }
    if($Actions -isnot [array] -or $Actions.Count -ne 0) { throw 'Read-only survey requires an empty validated action plan' }
    if((Get-FurnitureSurveySlideCount $Path) -ne 1) { throw 'Read-only survey requires exactly one slide part' }
}

# Opt-in fixed authored ranges. All validation is pure and occurs before output/Office.
function Assert-FurnitureProbeKeys($Object,[string[]]$Allowed,[string]$Context) {
    if($null -eq $Object -or $Object -isnot [pscustomobject]) { throw "$Context must be an object" }
    foreach($property in $Object.PSObject.Properties) { if($property.Name -cnotin $Allowed) { throw "$Context has unknown property '$($property.Name)'" } }
    foreach($name in $Allowed) { $null=Require-Property $Object $name $Context }
}
function Test-FurnitureProbeFinite($Value) {
    return ($Value -is [single] -or $Value -is [double] -or $Value -is [int] -or $Value -is [long] -or $Value -is [decimal]) -and -not [double]::IsNaN([double]$Value) -and -not [double]::IsInfinity([double]$Value)
}
function Read-AndValidateTextProbePlan([string]$Path,[string]$ArchiveSha256,[bool]$Fonts,$Actions) {
    if($Path -ceq '') { return $null }
    if(-not $Fonts -or $Actions -isnot [array] -or $Actions.Count -ne 0) { throw 'Text probes require CaptureTextFonts and an empty action plan' }
    if((Get-Item -LiteralPath $Path).Length -gt 65536) { throw 'Text probe plan exceeds 64 KiB' }
    $plan=Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-FurnitureProbeKeys $plan @('schemaVersion','archiveSha256','targets') 'Text probe plan'
    if(-not (Test-Integer $plan.schemaVersion) -or $plan.schemaVersion -ne 1 -or $plan.archiveSha256 -isnot [string] -or $plan.archiveSha256 -cnotmatch '^[a-f0-9]{64}$' -or $plan.archiveSha256 -cne $ArchiveSha256) { throw 'Text probe plan is unsupported or bound to a different archive' }
    if($plan.targets -isnot [array] -or $plan.targets.Count -lt 1 -or $plan.targets.Count -gt 3) { throw 'Text probe plan requires 1 through 3 exact targets' }
    $targets=@();$totalRanges=0;$totalUnits=0
    foreach($target in $plan.targets) {
        Assert-FurnitureProbeKeys $target @('slideIndex','shapeId','shapeName','text','ranges') 'Text probe target'
        if(-not (Test-Integer $target.slideIndex) -or $target.slideIndex -lt 1 -or $target.slideIndex -gt 3 -or -not (Test-Integer $target.shapeId) -or $target.shapeId -lt 1 -or $target.shapeId -gt 2147483647) { throw 'Text probe target has an invalid slide or shape ID' }
        Assert-String $target.shapeName 'shapeName' 'Text probe target' 255 $false
        Assert-String $target.text 'text' 'Text probe target' 4096 $false
        foreach($prior in $targets) { if($prior.slideIndex -eq $target.slideIndex -and ($prior.shapeId -eq $target.shapeId -or [string]::Equals($prior.shapeName,$target.shapeName,[StringComparison]::Ordinal))) { throw 'Duplicate text probe target' } }
        $targets+=@($target)
        if($target.ranges -isnot [array] -or $target.ranges.Count -lt 1 -or $target.ranges.Count -gt 8) { throw 'Text probe target requires a bounded explicit range list' }
        $seen=@()
        foreach($sample in $target.ranges) {
            Assert-FurnitureProbeKeys $sample @('start1Based','length','text','style') 'Text probe range'
            if(-not (Test-Integer $sample.start1Based) -or -not (Test-Integer $sample.length) -or $sample.start1Based -lt 1 -or $sample.length -lt 1 -or $sample.length -gt 32 -or $sample.start1Based -gt $target.text.Length -or $sample.length -gt ($target.text.Length-$sample.start1Based+1)) { throw 'Text probe range exceeds the literal source text' }
            $start=$sample.start1Based-1;$end=$start+$sample.length
            if(($start -gt 0 -and [char]::IsHighSurrogate($target.text[$start-1]) -and [char]::IsLowSurrogate($target.text[$start])) -or ($end -lt $target.text.Length -and [char]::IsHighSurrogate($target.text[$end-1]) -and [char]::IsLowSurrogate($target.text[$end]))) { throw 'Text probe range splits a UTF16 surrogate pair' }
            Assert-String $sample.text 'text' 'Text probe range' 32 $false
            if(-not [string]::Equals($sample.text,$target.text.Substring($start,$sample.length),[StringComparison]::Ordinal)) { throw 'Text probe range text differs from exact UTF16 source' }
            foreach($prior in $seen) { if($start -lt ($prior.start1Based-1+$prior.length) -and ($prior.start1Based-1) -lt $end) { throw 'Duplicate or overlapping text probe ranges' } }
            $seen+=@($sample)
            Assert-FurnitureProbeKeys $sample.style @('name','sizePoints','bold','italic') 'Text probe source style'
            Assert-String $sample.style.name 'name' 'Text probe source style' 128 $false
            if(-not (Test-FurnitureProbeFinite $sample.style.sizePoints) -or $sample.style.sizePoints -le 0 -or $sample.style.sizePoints -gt 400) { throw 'Text probe source size must be finite positive points, at most 400' }
            foreach($flag in @('bold','italic')) { if(-not (Test-Integer $sample.style.$flag) -or $sample.style.$flag -notin @(-1,0)) { throw 'Text probe source style flag must be exactly -1 or 0' } }
            $totalRanges++;$totalUnits+=$sample.length
        }
    }
    if($totalRanges -gt 8 -or $totalUnits -gt 32) { throw 'Text probes exceed 8 ranges or 32 sampled UTF16 units' }
    return ,$plan
}
function Assert-FurnitureTextProbeIntegrity($Probe,[string]$Source,[string]$Snapshot,[string]$SourceHash,[string]$ActionsSnapshot,[string]$ActionsHash) {
    if($null -eq $Probe) { return }
    try {
        foreach($pair in @(@($Source,$SourceHash),@($Snapshot,$SourceHash),@($ActionsSnapshot,$ActionsHash),@($Probe.path,$Probe.sha256),@($Probe.snapshotPath,$Probe.sha256))) {
            if((Get-FurnitureSha256 $pair[0]) -cne $pair[1]) { Stop-FurnitureLifecycle 'Source, action or text probe plan changed across the owned lifecycle' }
        }
    } catch { Stop-FurnitureLifecycle $_.Exception.Message }
}
function Read-FurnitureProbeDescriptor($Range,[string]$Prefix) {
    $font=Read-FurnitureProperty $Range 'Font' "$Prefix.font.get"
    $language=Read-FurnitureProperty $Range 'LanguageID' "$Prefix.languageId.get"
    $slots=[ordered]@{}
    foreach($name in @('Name','NameAscii','NameOther','NameFarEast','NameComplexScript')) {
        $value=Read-FurnitureProperty $font $name "$Prefix.font.$name.get"
        $status=if($value -is [string] -and -not [string]::IsNullOrWhiteSpace($value)){'reported'}else{'mixed-or-unavailable'}
        $slots[$name]=[ordered]@{value=$value;status=$status}
    }
    $size=Read-FurnitureProperty $font 'Size' "$Prefix.font.size.get"
    if($null -ne $size -and -not (Test-FurnitureProbeFinite $size)) { Stop-FurnitureLifecycle 'Observed probe font size is nonfinite or nonnumeric' }
    $bold=Read-FurnitureProperty $font 'Bold' "$Prefix.font.bold.get"
    $italic=Read-FurnitureProperty $font 'Italic' "$Prefix.font.italic.get"
    return [ordered]@{languageId=[ordered]@{value=$language;status=$(if((Test-Integer $language) -and $language -gt 0){'reported'}else{'mixed-or-unavailable'})};fontSlots=$slots;sizePoints=$size;bold=$bold;italic=$italic;scope='Reported primary TextRange descriptors only; not physical font-file or glyph identity.'}
}
function Read-FurnitureTextProbe($Shape,$Target,[string]$Prefix) {
    $frame=Read-FurnitureProperty $Shape 'TextFrame' "$Prefix.frame.get"
    $primary=Read-FurnitureProperty $frame 'TextRange' "$Prefix.range.get"
    $frame2=Read-FurnitureProperty $Shape 'TextFrame2' "$Prefix.frame2.get"
    $secondary=Read-FurnitureProperty $frame2 'TextRange' "$Prefix.range2.get"
    foreach($range in @($primary,$secondary)) { $text=Read-FurnitureProperty $range 'Text' "$Prefix.sourceText.get";if($text -isnot [string] -or -not [string]::Equals($text,$Target.text,[StringComparison]::Ordinal)) { Stop-FurnitureLifecycle 'Foreign or stale text probe selection: exact UTF16 shape text differs' } }
    $record=[ordered]@{shapeId=$Target.shapeId;shapeName=$Target.shapeName;text=$Target.text;primary=(Read-FurnitureProbeDescriptor $primary "$Prefix.whole");ranges=@();nativeAcceptance=$false;scope='Fixed authored UTF16 ranges, not enumerated native run boundaries or physical glyph correctness.'}
    foreach($sample in $Target.ranges) {
        $tag="$Prefix.characters-$($sample.start1Based)-$($sample.length)"
        $one=Invoke-FurnitureCom "$tag.primary.get" { return ,$primary.Characters($sample.start1Based,$sample.length) }
        $two=Invoke-FurnitureCom "$tag.secondary.get" { return ,$secondary.Characters($sample.start1Based,$sample.length) }
        foreach($range in @($one,$two)) { $text=Read-FurnitureProperty $range 'Text' "$tag.text.get";if($text -isnot [string] -or -not [string]::Equals($text,$sample.text,[StringComparison]::Ordinal)) { Stop-FurnitureLifecycle 'Foreign or stale text probe range: exact UTF16 characters differ' } }
        $descriptor=Read-FurnitureProbeDescriptor $one $tag
        $bounds=[ordered]@{}
        foreach($property in @('BoundLeft','BoundTop','BoundWidth','BoundHeight')) {
            $value=Read-FurnitureProperty $two $property "$tag.$property.get"
            if($null -ne $value -and (-not (Test-FurnitureProbeFinite $value) -or ($property -in @('BoundWidth','BoundHeight') -and $value -lt 0))) { Stop-FurnitureLifecycle 'Observed probe bound is nonfinite, nonnumeric or negative in size' }
            $bounds[$property]=[ordered]@{value=$(if($null -eq $value){$null}else{[double]$value});status=$(if($null -eq $value){'unavailable'}else{'reported'});unit='pt'}
        }
        $mismatches=@()
        if(-not [string]::Equals($descriptor.fontSlots.Name.value,$sample.style.name,[StringComparison]::Ordinal)) { $mismatches+='name' }
        if($descriptor.sizePoints -ne $sample.style.sizePoints) { $mismatches+='sizePoints' }
        foreach($flag in @('bold','italic')) { if($descriptor.$flag -ne $sample.style.$flag) { $mismatches+=$flag } }
        $record.ranges+=@([ordered]@{start1Based=$sample.start1Based;length=$sample.length;text=$sample.text;expectedStyle=$sample.style;observed=$descriptor;styleMismatches=$mismatches;bounds=$bounds;nativeAcceptance=$false})
    }
    return ,$record
}

if(-not $Worker) {
    $inputPath=(Resolve-Path -LiteralPath $InputPresentation).Path
    if([IO.Path]::GetExtension($inputPath) -ine '.pptx') { throw 'InputPresentation must select one existing .pptx file' }
    $plan=Read-AndValidateActionPlan $ActionPlan
    Assert-FurnitureSurvey ([bool]$ReadOnlySurvey) $plan $inputPath
    $planPath=$(if($ActionPlan -eq ''){$null}else{(Resolve-Path -LiteralPath $ActionPlan).Path})
    $probePlan=Read-AndValidateTextProbePlan $TextProbePlan (Get-FurnitureSha256 $inputPath) ([bool]$CaptureTextFonts) $plan
    $probePath=$(if($null -eq $probePlan){$null}else{(Resolve-Path -LiteralPath $TextProbePlan).Path})
    $outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
    if(Test-Path -LiteralPath $outputRoot) { throw 'Preserve the prior attempt and select a fresh output directory' }
    [void](New-Item -ItemType Directory -Path $outputRoot)
    $snapshotRoot=Join-Path $outputRoot 'inputs'; [void](New-Item -ItemType Directory -Path $snapshotRoot)
    $verifierSnapshot=Join-Path $snapshotRoot 'native-furniture-control.ps1'
    $helperOriginal=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'native-process.ps1')).Path
    $helperSnapshot=Join-Path $snapshotRoot 'native-process.ps1'
    $presentationSnapshot=Join-Path $snapshotRoot 'input.pptx'
    $planSnapshot=Join-Path $snapshotRoot 'action-plan.json'
    Copy-Item -LiteralPath $PSCommandPath -Destination $verifierSnapshot
    Copy-Item -LiteralPath $helperOriginal -Destination $helperSnapshot
    Copy-Item -LiteralPath $inputPath -Destination $presentationSnapshot
    if($null -ne $planPath) { Copy-Item -LiteralPath $planPath -Destination $planSnapshot }
    else { ConvertTo-Json -InputObject @() | Set-Content -LiteralPath $planSnapshot -Encoding UTF8 }
    $request=[ordered]@{
        captureTextFonts=[bool]$CaptureTextFonts
        readOnlySurvey=[bool]$ReadOnlySurvey
        source=[ordered]@{path=$inputPath;sha256=(Get-FurnitureSha256 $inputPath);snapshotPath=$presentationSnapshot;snapshotSha256=(Get-FurnitureSha256 $presentationSnapshot)}
        actionPlan=[ordered]@{path=$planPath;sha256=$(if($null -eq $planPath){$null}else{Get-FurnitureSha256 $planPath});snapshotPath=$planSnapshot;snapshotSha256=(Get-FurnitureSha256 $planSnapshot);count=$plan.Count}
        verifier=[ordered]@{path=$PSCommandPath;sha256=(Get-FurnitureSha256 $PSCommandPath);snapshotPath=$verifierSnapshot;snapshotSha256=(Get-FurnitureSha256 $verifierSnapshot)}
        processHelper=[ordered]@{path=$helperOriginal;sha256=(Get-FurnitureSha256 $helperOriginal);snapshotPath=$helperSnapshot;snapshotSha256=(Get-FurnitureSha256 $helperSnapshot)}
    }
    if($null -ne $probePath) {
        $probeSnapshot=Join-Path $snapshotRoot 'text-probe-plan.json'
        Copy-Item -LiteralPath $probePath -Destination $probeSnapshot
        $request.textProbePlan=[ordered]@{path=$probePath;sha256=(Get-FurnitureSha256 $probePath);snapshotPath=$probeSnapshot;snapshotSha256=(Get-FurnitureSha256 $probeSnapshot)}
        if($request.textProbePlan.sha256 -cne $request.textProbePlan.snapshotSha256) { throw 'Text probe snapshot changed during copy' }
    }
    $request | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'request.json') -Encoding UTF8
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $workerArguments=@('-OutputDirectory',$outputRoot,'-InputPresentation',$presentationSnapshot,'-ActionPlan',$planSnapshot,'-Worker')
    if($CaptureTextFonts) { $workerArguments+='-CaptureTextFonts' }
    if($ReadOnlySurvey) { $workerArguments+='-ReadOnlySurvey' }
    if($null -ne $probePath) { $workerArguments+=@('-TextProbePlan',$probeSnapshot) }
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments $workerArguments -OutputDirectory $outputRoot -TimeoutSeconds $TimeoutSeconds
    $lastDurable=$null
    if(Test-Path -LiteralPath (Join-Path $outputRoot 'progress.json')) { try { $lastDurable=Get-Content -LiteralPath (Join-Path $outputRoot 'progress.json') -Raw -Encoding UTF8 | ConvertFrom-Json } catch { } }
    if($null -eq $lastDurable -and (Test-Path -LiteralPath (Join-Path $outputRoot 'stages.jsonl'))) {
        foreach($line in (Get-Content -LiteralPath (Join-Path $outputRoot 'stages.jsonl') -Encoding UTF8)) { try { $lastDurable=$line | ConvertFrom-Json } catch { } }
    }
    $terminal=[ordered]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');timedOut=$result.timedOut;exitCode=$result.exitCode;cleanupConfirmed=$(if($result.timedOut){$false}elseif($null -ne $lastDurable){[bool]$lastDurable.cleanupConfirmed}else{$false});lastDurableStage=$(if($null -ne $lastDurable){$lastDurable.stage}else{$null});lastDurableStatus=$(if($null -ne $lastDurable){$lastDurable.status}else{$null})}
    $terminal | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'supervisor.json') -Encoding UTF8
    if($result.timedOut -and (Test-Path -LiteralPath (Join-Path $outputRoot 'report.json'))) {
        try {
            Copy-Item -LiteralPath (Join-Path $outputRoot 'report.json') -Destination (Join-Path $outputRoot 'report.worker.json')
            $timedOutReport=Get-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            $timedOutReport.cleanupConfirmed=$false; $timedOutReport.officeOperationsStopped=$true; $timedOutReport.lastStage=$terminal.lastDurableStage; $timedOutReport.lastStatus=$terminal.lastDurableStatus
            $timedOutReport.error='Owned native worker timed out; Office cleanup is unconfirmed and no retry was started.'
            $timedOutReport | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Encoding UTF8
        } catch { }
    }
    Get-Content -LiteralPath (Join-Path $outputRoot 'worker.stdout.log') | ForEach-Object { Write-Host $_ }
    if($result.timedOut -or $result.exitCode -ne 0) { throw 'Native furniture control failed or timed out; preserve the entire attempt and inspect Office. No retry was started.' }
    return
}

$root=(Resolve-Path -LiteralPath $OutputDirectory).Path
$request=Get-Content -LiteralPath (Join-Path $root 'request.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($request.captureTextFonts -isnot [bool] -or $request.captureTextFonts -ne [bool]$CaptureTextFonts) { throw 'Font observation option differs from validated request' }
$surveyRequested=$false
if($null -ne $request.PSObject.Properties['readOnlySurvey']) {
    if($request.readOnlySurvey -isnot [bool]) { throw 'Read-only survey request must be a Boolean' }
    $surveyRequested=$request.readOnlySurvey
}
if($surveyRequested -ne [bool]$ReadOnlySurvey) { throw 'Read-only survey option differs from validated request' }
$sourcePath=$request.source.path; $sourceHash=$request.source.sha256; $sourceSnapshot=(Resolve-Path -LiteralPath $request.source.snapshotPath).Path
$planSnapshot=(Resolve-Path -LiteralPath $request.actionPlan.snapshotPath).Path; $actions=Read-AndValidateActionPlan $planSnapshot
$savedPath=Join-Path $root 'native-furniture-control.pptx'
$stageFile=Join-Path $root 'stages.jsonl'; $progressFile=Join-Path $root 'progress.json'; $reportFile=Join-Path $root 'report.json'
foreach($reserved in @($stageFile,$progressFile,$reportFile,$savedPath)) { if(Test-Path -LiteralPath $reserved) { throw 'Worker evidence already exists; preserve this attempt and do not retry in it' } }
if((Get-FurnitureSha256 $PSCommandPath) -cne $request.verifier.sha256 -or (Get-FurnitureSha256 $request.verifier.snapshotPath) -cne $request.verifier.sha256) { throw 'Verifier snapshot does not match the executing verifier' }
if((Get-FurnitureSha256 $request.processHelper.path) -cne $request.processHelper.sha256 -or (Get-FurnitureSha256 $request.processHelper.snapshotPath) -cne $request.processHelper.sha256) { throw 'Process-helper snapshot does not match the loaded helper' }
if((Get-FurnitureSha256 $sourceSnapshot) -cne $sourceHash) { throw 'Presentation snapshot hash does not match the requested source' }
if((Get-FurnitureSha256 $planSnapshot) -cne $request.actionPlan.snapshotSha256 -or $actions.Count -ne $request.actionPlan.count) { throw 'Action-plan snapshot does not match the validated request' }

Assert-FurnitureSurvey ([bool]$ReadOnlySurvey) $actions $sourceSnapshot
$script:validatedTextProbePlan=$null
if($null -ne $request.PSObject.Properties['textProbePlan']) {
    $probe=$request.textProbePlan
    if($TextProbePlan -ceq '' -or (Resolve-Path -LiteralPath $TextProbePlan).Path -ine $probe.snapshotPath -or $probe.sha256 -cne $probe.snapshotSha256 -or (Get-FurnitureSha256 $probe.path) -cne $probe.sha256 -or (Get-FurnitureSha256 $TextProbePlan) -cne $probe.sha256) { throw 'Text probe plan request/source/snapshot differs' }
    $script:validatedTextProbePlan=Read-AndValidateTextProbePlan $TextProbePlan $sourceHash ([bool]$CaptureTextFonts) $actions
} elseif($TextProbePlan -cne '') { throw 'Text probe plan is not bound to the validated request' }

$script:sequence=0; $script:lastStage='worker.initialize'; $script:lastStatus='begin'; $script:cleanupConfirmed=$true; $script:officeOperationsStopped=$false
$script:ownedPresentationPath=$null; $script:presentation=$null; $script:ownedApplication=$null
$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$report=[ordered]@{
    schemaVersion=1
    captureTextFonts=[bool]$CaptureTextFonts
    readOnlySurvey=[bool]$ReadOnlySurvey
    source=[ordered]@{path=$sourcePath;sha256=$sourceHash;openedPath=$sourceSnapshot;openedSha256=(Get-FurnitureSha256 $sourceSnapshot)}
    saved=[ordered]@{path=$savedPath;sha256=$null}
    reopened=[ordered]@{path=$savedPath;sha256=$null}
    actionPlan=[ordered]@{path=$request.actionPlan.path;sha256=$request.actionPlan.sha256;snapshotPath=$planSnapshot;snapshotSha256=(Get-FurnitureSha256 $planSnapshot);actions=$actions;completed=@();styleEdits=@();chartPoints=@();currentChartPointProbe=$null;chartSeriesEdits=@();currentChartSeriesProbe=$null}
    phases=[ordered]@{original=$null;edited=$null;reopened=$null}
    inputs=[ordered]@{verifier=$request.verifier;processHelper=$request.processHelper}
    environment=[ordered]@{hostVersion=$PSVersionTable.PSVersion.ToString();windowsProductName=$os.ProductName;windowsDisplayVersion=$os.DisplayVersion;windowsBuild="$($os.CurrentBuild).$($os.UBR)";powerPointVersion=$null;powerPointExecutable=$null;powerPointBuild=$null;powerPointExecutableSha256=$null}
    cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;lastStage=$script:lastStage;lastStatus=$script:lastStatus;error=$null
    scope='One explicitly supplied presentation with at most three slides, thirty shapes per slide and twenty prevalidated actions. Original, edited and read-only reopened native states and PNGs are observations. The worker quits only its exact verified empty application, never kills Office, changes security, retries, or closes unrelated presentations.'
}
if($null -ne $script:validatedTextProbePlan) { $report.textProbePlan=$request.textProbePlan }
if($ReadOnlySurvey) { $report.scope='One explicitly supplied read-only survey: exactly one slide, at most 100 shapes, an empty action plan, source at most 16 MiB/4096 ZIP entries and the unchanged 60-second maximum. Owned read-only Open, SaveCopyAs, read-only reopen and observations only; no content edits, UI, process termination or retry.' }
function Write-FurnitureReport {
    $report.cleanupConfirmed=$script:cleanupConfirmed; $report.officeOperationsStopped=$script:officeOperationsStopped; $report.lastStage=$script:lastStage; $report.lastStatus=$script:lastStatus
    $report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $reportFile -Encoding UTF8
}
function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
    $script:sequence++; $script:lastStage=$Name; $script:lastStatus=$Status
    $record=[ordered]@{sequence=$script:sequence;timestamp=(Get-Date).ToUniversalTime().ToString('o');stage=$Name;status=$Status;error=$ErrorMessage;cleanupConfirmed=$script:cleanupConfirmed;officeOperationsStopped=$script:officeOperationsStopped;ownedPresentationPath=$script:ownedPresentationPath}
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $stageFile -Encoding UTF8
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $progressFile -Encoding UTF8
}
function Invoke-FurnitureCom([string]$Name,[scriptblock]$Operation) {
    if($script:officeOperationsStopped) { throw 'Office operations already stopped after a COM failure' }
    Write-FurnitureStage $Name 'begin'
    try { $value=& $Operation; Write-FurnitureStage $Name 'success'; return ,$value }
    catch { $script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false; Write-FurnitureStage $Name 'error' $_.Exception.Message; throw }
}
function Assert-PresentationNotOpen($Application,[string]$Path,[string]$Prefix) {
    $presentations=Invoke-FurnitureCom "$Prefix.presentations.get" { return ,$Application.Presentations }
    $count=Invoke-FurnitureCom "$Prefix.presentations.count.get" { $presentations.Count }
    for($index=1;$index -le $count;$index++) { $candidate=Invoke-FurnitureCom "$Prefix.presentations.item-$index.get" { $presentations.Item($index) }; $candidatePath=Invoke-FurnitureCom "$Prefix.presentations.item-$index.fullName.get" { $candidate.FullName }; if($candidatePath -ieq $Path) { throw "Presentation is already open, so ownership cannot be established: $Path" } }
}
function Get-ExactSlide($Presentation,[int]$Index,[string]$Prefix) {
    $slides=Invoke-FurnitureCom "$Prefix.slides.get" { return ,$Presentation.Slides }; $count=Invoke-FurnitureCom "$Prefix.slides.count.get" { $slides.Count }
    if($count -lt 1 -or $count -gt 3) { throw "Presentation must contain 1 through 3 slides; observed $count" }
    if($Index -gt $count) { throw "$Prefix slideIndex $Index exceeds current slide count $count" }
    return ,(Invoke-FurnitureCom "$Prefix.slide-$Index.get" { $slides.Item($Index) })
}
function Get-ExactShape($Slide,[string]$Name,[string]$Prefix) {
    $shapes=Invoke-FurnitureCom "$Prefix.shapes.get" { return ,$Slide.Shapes }; $count=Invoke-FurnitureCom "$Prefix.shapes.count.get" { $shapes.Count }
    if($count -gt 30) { throw "$Prefix exceeds the 30-shape-per-slide limit" }
    $matches=@()
    for($index=1;$index -le $count;$index++) { $shape=Invoke-FurnitureCom "$Prefix.shape-$index.get" { $shapes.Item($index) }; $actual=Invoke-FurnitureCom "$Prefix.shape-$index.name.get" { $shape.Name }; if($actual -ceq $Name) { $matches+=@($shape) } }
    if($matches.Count -ne 1) { throw "$Prefix expected one exact shape named '$Name'; observed $($matches.Count)" }
    return ,$matches[0]
}
function Assert-ShapeNameAvailable($Slide,[string]$Name,[string]$Prefix) {
    $shapes=Invoke-FurnitureCom "$Prefix.shapes.get" { return ,$Slide.Shapes }; $count=Invoke-FurnitureCom "$Prefix.shapes.count.get" { $shapes.Count }
    if($count -ge 30) { throw "$Prefix cannot duplicate beyond the 30-shape-per-slide limit" }
    for($index=1;$index -le $count;$index++) { $shape=Invoke-FurnitureCom "$Prefix.shape-$index.get" { $shapes.Item($index) }; $actual=Invoke-FurnitureCom "$Prefix.shape-$index.name.get" { $shape.Name }; if($actual -ieq $Name) { throw "$Prefix newName already exists: $Name" } }
}
function Read-NativeTags($Tags,[string]$Prefix) {
    $count=Invoke-FurnitureCom "$Prefix.count.get" { $Tags.Count }; $items=@()
    for($index=1;$index -le $count;$index++) { $name=Invoke-FurnitureCom "$Prefix.name-$index.get" { $Tags.Name($index) }; $value=Invoke-FurnitureCom "$Prefix.value-$index.get" { $Tags.Value($index) }; $items+=@([ordered]@{index=$index;name=$name;value=$value}) }
    return ,$items
}
# Whole-range reported descriptors only; no per-character or physical glyph-file assertion.
function Read-FurnitureProperty($Object,[string]$Property,[string]$Stage) {
    $value=Invoke-FurnitureCom $Stage {
        if($null -eq $Object) { return $null }
        $member=$Object.PSObject.Properties[$Property]
        if($null -eq $member) { return $null }
        # Explicit getter invocation retains the adapted COM property path and
        # makes getter failures terminating instead of silently returning null.
        return ,$member.get_Value()
    }
    return ,$value
}
function Read-FurnitureTextFont($Shape,[string]$Text,[string]$Prefix) {
    if([string]::IsNullOrEmpty($Text)) { return [ordered]@{status='no-text';scope='No nonempty text range was observed.'} }
    $frame=Read-FurnitureProperty $Shape 'TextFrame2' "$Prefix.textFrame2.get"
    $range=Read-FurnitureProperty $frame 'TextRange' "$Prefix.textRange2.get"
    $font=Read-FurnitureProperty $range 'Font' "$Prefix.font2.get"
    $name=Read-FurnitureProperty $font 'Name' "$Prefix.font2.name.get"
    $size=Read-FurnitureProperty $font 'Size' "$Prefix.font2.size.get"
    $bold=Read-FurnitureProperty $font 'Bold' "$Prefix.font2.bold.get"
    $italic=Read-FurnitureProperty $font 'Italic' "$Prefix.font2.italic.get"
    $unavailable=@()
    if($name -isnot [string] -or [string]::IsNullOrWhiteSpace($name)) { $unavailable+='name' }
    $numericSize=$size -is [single] -or $size -is [double] -or $size -is [int] -or $size -is [long] -or $size -is [decimal]
    if(-not $numericSize -or [double]::IsNaN([double]$size) -or [double]::IsInfinity([double]$size) -or $size -le 0) { $unavailable+='sizePoints' }
    foreach($entry in @(@{name='bold';value=$bold},@{name='italic';value=$italic})) {
        if(-not (Test-Integer $entry.value) -or $entry.value -notin @(-1,0)) { $unavailable+=$entry.name }
    }
    $status=if($unavailable.Count -eq 0){'uniform'}else{'mixed-or-unavailable'}
    return [ordered]@{status=$status;name=$name;sizePoints=$size;bold=$bold;italic=$italic;unavailableFields=$unavailable;scope='Whole TextFrame2 range reported name/size/bold/italic; not character-level font selection, glyph-file identity or baseline measurement.'}
}
function Read-FurnitureState($Presentation,[string]$Phase) {
    $slides=Invoke-FurnitureCom "$Phase.slides.get" { return ,$Presentation.Slides }; $slideCount=Invoke-FurnitureCom "$Phase.slides.count.get" { $slides.Count }
    if($slideCount -lt 1 -or $slideCount -gt 3) { throw "Presentation must contain 1 through 3 slides; observed $slideCount" }
    if($ReadOnlySurvey -and $slideCount -ne 1) { throw 'Read-only survey requires exactly one actual slide' }
    $slideRecords=@(); $rasters=@(); $probeTargetsSeen=0
    for($slideIndex=1;$slideIndex -le $slideCount;$slideIndex++) {
        $slide=Invoke-FurnitureCom "$Phase.slide-$slideIndex.get" { $slides.Item($slideIndex) }
        $slideId=Invoke-FurnitureCom "$Phase.slide-$slideIndex.id.get" { $slide.SlideID }; $slideName=Invoke-FurnitureCom "$Phase.slide-$slideIndex.name.get" { $slide.Name }
        $slideTagsObject=Invoke-FurnitureCom "$Phase.slide-$slideIndex.tags.get" { return ,$slide.Tags }; $slideTags=Read-NativeTags $slideTagsObject "$Phase.slide-$slideIndex.tags"
        $shapes=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shapes.get" { return ,$slide.Shapes }; $shapeCount=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shapes.count.get" { $shapes.Count }
        if($ReadOnlySurvey) {
            if($shapeCount -gt 100) { throw "$Phase slide $slideIndex exceeds the 100-shape read-only survey limit" }
        } else {
            if($shapeCount -gt 30) { throw "$Phase slide $slideIndex exceeds the 30-shape limit" }
        }
        $shapeRecords=@()
        for($shapeIndex=1;$shapeIndex -le $shapeCount;$shapeIndex++) {
            $shape=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.get" { $shapes.Item($shapeIndex) }
            $id=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.id.get" { $shape.Id }; $name=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.name.get" { $shape.Name }; $type=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.type.get" { $shape.Type }
            $left=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.left.get" { $shape.Left }; $top=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.top.get" { $shape.Top }; $width=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.width.get" { $shape.Width }; $height=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.height.get" { $shape.Height }; $rotation=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.rotation.get" { $shape.Rotation }
            $hasTextFrame=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.hasTextFrame.get" { $shape.HasTextFrame }; $text=$null
            if($hasTextFrame -ne 0) { $frame=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.textFrame.get" { $shape.TextFrame }; $range=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.textRange.get" { $frame.TextRange }; $text=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.text.get" { $range.Text } }
            $alt=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.alternativeText.get" { $shape.AlternativeText }
            $shapeTagsObject=Invoke-FurnitureCom "$Phase.slide-$slideIndex.shape-$shapeIndex.tags.get" { return ,$shape.Tags }; $shapeTags=Read-NativeTags $shapeTagsObject "$Phase.slide-$slideIndex.shape-$shapeIndex.tags"
            $shapeRecord=[ordered]@{index=$shapeIndex;id=$id;name=$name;type=$type;left=$left;top=$top;width=$width;height=$height;rotation=$rotation;hasTextFrame=$hasTextFrame;text=$text;alternativeText=$alt;tags=$shapeTags}
            if($CaptureTextFonts) { $shapeRecord.textFont=Read-FurnitureTextFont $shape $text "$Phase.slide-$slideIndex.shape-$shapeIndex" }
            if($null -ne $script:validatedTextProbePlan) {
                foreach($target in $script:validatedTextProbePlan.targets) {
                    if($target.slideIndex -eq $slideIndex -and ([string]::Equals($target.shapeName,$name,[StringComparison]::Ordinal) -or $target.shapeId -eq $id)) {
                        if(-not [string]::Equals($target.shapeName,$name,[StringComparison]::Ordinal) -or $target.shapeId -ne $id) { Stop-FurnitureLifecycle 'Foreign or stale text probe shape name/ID pair' }
                        $shapeRecord.textProbe=Read-FurnitureTextProbe $shape $target "$Phase.slide-$slideIndex.shape-$shapeIndex.probe"
                        $probeTargetsSeen++
                    }
                }
            }
            $shapeRecords+=@($shapeRecord)
        }
        $png=Join-Path $root "$Phase-slide-$('{0:D2}' -f $slideIndex).png"; Invoke-FurnitureCom "$Phase.slide-$slideIndex.export.png" { $slide.Export($png,'PNG',1280,720) }
        $rasters+=@([ordered]@{slideIndex=$slideIndex;path=$png;sha256=(Get-FurnitureSha256 $png)})
        $slideRecords+=@([ordered]@{index=$slideIndex;slideId=$slideId;name=$slideName;tags=$slideTags;shapeCount=$shapeCount;shapes=$shapeRecords})
    }
    if($null -ne $script:validatedTextProbePlan -and $probeTargetsSeen -ne $script:validatedTextProbePlan.targets.Count) { Stop-FurnitureLifecycle 'Missing or repeated exact text probe target' }
    return [ordered]@{slideCount=$slideCount;slides=$slideRecords;rasters=$rasters;chartSeriesNames=(Read-FurnitureSeriesNameState $Presentation $actions $Phase)}
}
function Get-ActionTags($Presentation,$Action,[string]$Prefix) {
    $slide=Get-ExactSlide $Presentation ([int]$Action.slideIndex) $Prefix
    if($Action.target -eq 'slide') { return ,(Invoke-FurnitureCom "$Prefix.slide.tags.get" { return ,$slide.Tags }) }
    $shape=Get-ExactShape $slide $Action.shapeName $Prefix
    return ,(Invoke-FurnitureCom "$Prefix.shape.tags.get" { return ,$shape.Tags })
}
# Operates on an already uniquely selected shape. Each property write/read is logged by the existing fail-closed wrapper.
function Set-FurnitureTextStyle($Shape,$Action,[string]$Prefix) {
    $has=Invoke-FurnitureCom "$Prefix.hasTextFrame.get" { $Shape.HasTextFrame }
    if($has -eq 0) { throw "$Prefix selected shape has no text frame" }
    $frame=Invoke-FurnitureCom "$Prefix.textFrame.get" { return ,$Shape.TextFrame }
    $range=Invoke-FurnitureCom "$Prefix.textRange.get" { return ,$frame.TextRange }
    $before=Invoke-FurnitureCom "$Prefix.text.before.get" { $range.Text }
    $font=Invoke-FurnitureCom "$Prefix.font.get" { return ,$range.Font }
    $evidence=[ordered]@{textBefore=$before;textAfter=$null}
    if($null -ne $Action.PSObject.Properties['fontSize']) {
        Invoke-FurnitureCom "$Prefix.font.size.set" { $font.Size=[double]$Action.fontSize }
        $observed=Invoke-FurnitureCom "$Prefix.font.size.get" { $font.Size }
        if([double]$observed -ne [double]$Action.fontSize) { throw "$Prefix fontSize readback differs from requested value" }
        $evidence.fontSize=[double]$observed
    }
    if($null -ne $Action.PSObject.Properties['color']) {
        $hex=$Action.color
        $rgb=[Convert]::ToInt32($hex.Substring(0,2),16) + 256*[Convert]::ToInt32($hex.Substring(2,2),16) + 65536*[Convert]::ToInt32($hex.Substring(4,2),16)
        $color=Invoke-FurnitureCom "$Prefix.font.color.get" { return ,$font.Color }
        Invoke-FurnitureCom "$Prefix.font.color.rgb.set" { $color.RGB=$rgb }
        $observed=Invoke-FurnitureCom "$Prefix.font.color.rgb.get" { $color.RGB }
        if([int]$observed -ne $rgb) { throw "$Prefix color readback differs from requested value" }
        $evidence.color=$Action.color.ToUpperInvariant()
    }
    $after=Invoke-FurnitureCom "$Prefix.text.after.get" { $range.Text }
    if($after -cne $before) { throw "$Prefix style action changed native words" }
    $evidence.textAfter=$after
    return $evidence
}
# SH-25 independent object-model measurement. Never activates ChartData, Excel or Edit Data.
function Read-FurnitureFiniteNumber($Object,[string]$Property,[string]$Stage) {
    $value=Invoke-FurnitureCom $Stage { $Object.$Property }
    if($null -eq $value) {Stop-FurnitureLifecycle "$Stage is unavailable"}
    try {$number=[double]$value} catch {Stop-FurnitureLifecycle "$Stage is not numeric"}
    if([double]::IsNaN($number) -or [double]::IsInfinity($number)) {Stop-FurnitureLifecycle "$Stage is not finite"}
    return $number
}
function New-FurniturePointProbe($Action,[string]$Prefix) {
    return [ordered]@{stage=$Prefix;chartName=$Action.chartName;shapeName=$Action.shapeName;seriesIndex=$Action.seriesIndex;pointIndex=$Action.pointIndex;edge=$Action.edge;strategy='native-point-bounds';sliceCoordinates=(New-Object 'System.Collections.Generic.List[object]');pieCenterLocalPoints=$null;curvedBoundsLocalPoints=$null;plotCenterLocalPoints=$null;circleCenterLocalPoints=$null;circleCenterMethod=$null;areaValueObservation=$null;pointBoundsLocalPoints=$null}
}
function Read-FurnitureSlicePoint($Point,[int]$Index,[string]$Prefix,$Probe) {
    $coordinates=New-Object 'System.Collections.Generic.List[double]'
    foreach($location in @(1,2)) {
        $stage="$Prefix.point.slice.$Index.$location"
        $value=Invoke-FurnitureCom $stage {$Point.PieSliceLocation($location,$Index)}
        $observation=[ordered]@{index=$Index;location=$location;rawValue=if($null -eq $value){$null}else{[Convert]::ToString($value,[Globalization.CultureInfo]::InvariantCulture)}}
        $Probe.sliceCoordinates.Add($observation)
        if($null -eq $value) {Stop-FurnitureLifecycle "$stage is unavailable"}
        try {$number=[double]$value} catch {Stop-FurnitureLifecycle "$stage is not numeric"}
        if([double]::IsNaN($number) -or [double]::IsInfinity($number)) {Stop-FurnitureLifecycle "$stage is not finite"}
        $observation['value']=$number
        $coordinates.Add($number)
    }
    return [pscustomobject]@{x=$coordinates[0];y=$coordinates[1]}
}
# Pure independent circular-outline bounds, from native points only. Endpoint boxes omit arc extrema.
# Independent circumcenter from actual native outer1/2/3; PlotArea's inside box can be offset from the drawn rings.
function Get-FurnitureNativeCircleCenter($Outer) {
    if($null -eq $Outer -or @($Outer).Count -ne 3){Stop-FurnitureLifecycle 'Three observed native circle points are required'}
    $points=New-Object 'System.Collections.Generic.List[object]'
    foreach($candidate in $Outer){
        if($null -eq $candidate){Stop-FurnitureLifecycle 'Observed native circle point is missing'}
        $px=$candidate.PSObject.Properties['x'];$py=$candidate.PSObject.Properties['y']
        if($null -eq $px -or $null -eq $py -or $null -eq $px.Value -or $null -eq $py.Value){Stop-FurnitureLifecycle 'Observed native circle coordinates are missing'}
        try{$x=[double]$px.Value;$y=[double]$py.Value}catch{Stop-FurnitureLifecycle 'Observed native circle coordinates are not numeric'}
        if([double]::IsNaN($x) -or [double]::IsInfinity($x) -or [double]::IsNaN($y) -or [double]::IsInfinity($y)){Stop-FurnitureLifecycle 'Observed native circle coordinates are not finite'}
        $points.Add([pscustomobject]@{x=$x;y=$y})
    }
    $a=$points[0];$b=$points[1];$c=$points[2];$epsilon=0.001
    $ux=$b.x-$a.x;$uy=$b.y-$a.y;$vx=$c.x-$a.x;$vy=$c.y-$a.y
    $scale=[math]::Max([math]::Max([math]::Abs($ux),[math]::Abs($uy)),[math]::Max([math]::Abs($vx),[math]::Abs($vy)))
    if([double]::IsNaN($scale) -or [double]::IsInfinity($scale) -or $scale -le $epsilon){Stop-FurnitureLifecycle 'Observed native circle is degenerate or not finite'}
    # Normalize before the determinant to avoid translation/large-coordinate cancellation.
    $closed=[math]::Sqrt($vx*$vx+$vy*$vy) -le $epsilon
    if($closed){
        # A closed slice's observed halfway arc point is antipodal. Tiny/coincident observations refuse below.
        $cx=$a.x+$ux/2;$cy=$a.y+$uy/2;$method='closed-native-antipodal-midpoint'
    }else{
        $ux/=$scale;$uy/=$scale;$vx/=$scale;$vy/=$scale
        $det=2*($ux*$vy-$uy*$vx)
        if([math]::Abs($det)*$scale -le $epsilon){Stop-FurnitureLifecycle 'Observed native circle points are collinear or ill-conditioned at native precision'}
        $u2=$ux*$ux+$uy*$uy;$v2=$vx*$vx+$vy*$vy
        $cx=$a.x+$scale*($u2*$vy-$v2*$uy)/$det;$cy=$a.y+$scale*($ux*$v2-$vx*$u2)/$det;$method='native-outer123-circumcenter'
    }
    $radius=[math]::Sqrt([math]::Pow($a.x-$cx,2)+[math]::Pow($a.y-$cy,2))
    if([double]::IsNaN($cx) -or [double]::IsInfinity($cx) -or [double]::IsNaN($cy) -or [double]::IsInfinity($cy) -or [double]::IsNaN($radius) -or [double]::IsInfinity($radius) -or $radius -le $epsilon){Stop-FurnitureLifecycle 'Observed native circle center/radius is degenerate or not finite'}
    return [pscustomobject]@{x=$cx;y=$cy;method=$method}
}

function Get-FurnitureCurvedSliceBounds($Center,$Outer,$Inner=$null) {
    $finitePoint={param($candidate)
        if($null -eq $candidate) {Stop-FurnitureLifecycle 'Native curved point is missing'}
        $px=$candidate.PSObject.Properties['x'];$py=$candidate.PSObject.Properties['y']
        if($null -eq $px -or $null -eq $py -or $null -eq $px.Value -or $null -eq $py.Value) {Stop-FurnitureLifecycle 'Native curved point coordinates are missing'}
        try {$cx=[double]$px.Value;$cy=[double]$py.Value} catch {Stop-FurnitureLifecycle 'Native curved point is not numeric'}
        if([double]::IsNaN($cx) -or [double]::IsInfinity($cx) -or [double]::IsNaN($cy) -or [double]::IsInfinity($cy)) {Stop-FurnitureLifecycle 'Native curved point is not finite'}
        return [pscustomobject]@{x=$cx;y=$cy}
    }
    $centerPoint=& $finitePoint $Center
    if($null -eq $Outer -or @($Outer).Count -ne 3) {Stop-FurnitureLifecycle 'Three native outer arc points are required'}
    $outerPoints=New-Object 'System.Collections.Generic.List[object]'
    foreach($candidate in $Outer) {$outerPoints.Add((& $finitePoint $candidate))}
    $distance={param($point) [math]::Sqrt([math]::Pow($point.x-$centerPoint.x,2)+[math]::Pow($point.y-$centerPoint.y,2))}
    $radius=& $distance $outerPoints[2]
    if([double]::IsNaN($radius) -or [double]::IsInfinity($radius) -or $radius -le 0.001) {Stop-FurnitureLifecycle 'Native circular radius is degenerate or not finite'}
    # API observations are rounded in points. This consistency check is <0.002px, not a change to the four-pixel gate.
    $epsilon=0.001;$turn=2*[math]::PI;$angleEpsilon=$epsilon/$radius
    $normalize={param([double]$angle) $answer=$angle%$turn;if($answer -lt 0){$answer+=$turn};return $answer}
    $angles=New-Object 'System.Collections.Generic.List[double]'
    foreach($point in $outerPoints) {
        $r=& $distance $point
        if([double]::IsNaN($r) -or [double]::IsInfinity($r) -or [math]::Abs($r-$radius) -gt $epsilon) {Stop-FurnitureLifecycle 'Native outer points do not share the observed circular radius'}
        $angles.Add((& $normalize ([math]::Atan2($point.y-$centerPoint.y,$point.x-$centerPoint.x))))
    }
    $start=$angles[0];$sweep=& $normalize ($angles[2]-$start);$middle=& $normalize ($angles[1]-$start)
    $closed=[math]::Sqrt([math]::Pow($outerPoints[0].x-$outerPoints[2].x,2)+[math]::Pow($outerPoints[0].y-$outerPoints[2].y,2)) -le $epsilon
    if($closed) {
        if([math]::Abs($middle-[math]::PI) -gt $angleEpsilon) {Stop-FurnitureLifecycle 'Native closed arc is degenerate or ambiguous, not an observed full circle'}
        $sweep=$turn
    } else {
        if($middle -gt $sweep+$angleEpsilon) {$start=$angles[2];$sweep=& $normalize ($angles[0]-$start);$middle=& $normalize ($angles[1]-$start)}
        if($sweep -le $angleEpsilon -or $middle -le $angleEpsilon -or $middle -ge $sweep-$angleEpsilon -or [math]::Abs($middle-$sweep/2) -gt $angleEpsilon) {Stop-FurnitureLifecycle 'Native arc midpoint does not establish an unambiguous circular sweep'}
    }
    $points=New-Object 'System.Collections.Generic.List[object]'
    foreach($point in $outerPoints) {$points.Add($point)}
    $innerRadius=0.0
    if($null -eq $Inner) {$points.Add($centerPoint)} else {
        if(@($Inner).Count -ne 3) {Stop-FurnitureLifecycle 'Three native inner arc points are required'}
        $innerPoints=New-Object 'System.Collections.Generic.List[object]'
        foreach($candidate in $Inner) {$innerPoints.Add((& $finitePoint $candidate))}
        $innerRadius=& $distance $innerPoints[2]
        if([double]::IsNaN($innerRadius) -or [double]::IsInfinity($innerRadius) -or $innerRadius -le 0 -or $innerRadius -ge $radius-$epsilon) {Stop-FurnitureLifecycle 'Native inner radius is not a finite hole inside the outer circle'}
        for($index=0;$index -lt 3;$index++) {
            $point=$innerPoints[$index];$r=& $distance $point
            $angle=& $normalize ([math]::Atan2($point.y-$centerPoint.y,$point.x-$centerPoint.x))
            $difference=& $normalize ($angle-$angles[$index]);$difference=[math]::Min($difference,$turn-$difference)
            if([double]::IsNaN($r) -or [double]::IsInfinity($r) -or [math]::Abs($r-$innerRadius) -gt $epsilon -or $difference -gt $angleEpsilon) {Stop-FurnitureLifecycle 'Native inner arc does not share the observed center and sweep'}
            $points.Add($point)
        }
    }
    foreach($angle in @(0.0,([math]::PI/2),[math]::PI,(3*[math]::PI/2))) {
        $fromStart=& $normalize ($angle-$start)
        if($closed -or $fromStart -le $sweep+$angleEpsilon) {
            foreach($r in @($radius,$innerRadius)) {if($r -gt 0) {$points.Add([pscustomobject]@{x=$centerPoint.x+$r*[math]::Cos($angle);y=$centerPoint.y+$r*[math]::Sin($angle)})}}
        }
    }
    $xs=$points | Measure-Object -Property x -Minimum -Maximum;$ys=$points | Measure-Object -Property y -Minimum -Maximum
    return [pscustomobject]@{left=[double]$xs.Minimum;top=[double]$ys.Minimum;width=[double]($xs.Maximum-$xs.Minimum);height=[double]($ys.Maximum-$ys.Minimum);center=@($centerPoint.x,$centerPoint.y);outerRadius=$radius;innerRadius=$innerRadius;startAngle=$start;sweep=$sweep;fullCircle=$closed}
}
# Read only actual native values; never open ChartData/Excel or resolve a worksheet range.
function Read-FurnitureAreaValue($Series,[int]$PointIndex,[int]$PointCount,[string]$Prefix,$Probe) {
    $holder=Invoke-FurnitureCom "$Prefix.series.values.get" {[pscustomobject]@{raw=$Series.Values}}
    $raw=$holder.raw
    $describe={param($value)
        if($null -eq $value){return [ordered]@{type='null';rawValue=$null}}
        $type=[Convert]::GetTypeCode($value);$name=$value.GetType().FullName
        $safe=$type -in @([TypeCode]::String,[TypeCode]::Boolean,[TypeCode]::Byte,[TypeCode]::SByte,[TypeCode]::Int16,[TypeCode]::UInt16,[TypeCode]::Int32,[TypeCode]::UInt32,[TypeCode]::Int64,[TypeCode]::UInt64,[TypeCode]::Single,[TypeCode]::Double,[TypeCode]::Decimal)
        return [ordered]@{type=$name;rawValue=if($safe){[Convert]::ToString($value,[Globalization.CultureInfo]::InvariantCulture)}else{'<unsupported native value type>'}}
    }
    $observation=[ordered]@{containerType=if($null -eq $raw){'null'}else{$raw.GetType().FullName};pointIndex=$PointIndex;pointCount=$PointCount;rank=$null;dimensions=@();rawValues=@();selectedValue=$null}
    $Probe.areaValueObservation=$observation
    if($raw -is [Array]){
        $observation.rank=$raw.Rank
        for($dimension=0;$dimension -lt $raw.Rank;$dimension++){$observation.dimensions+=@([ordered]@{lowerBound=$raw.GetLowerBound($dimension);length=$raw.GetLength($dimension)})}
        if($raw.Length -gt 10000){Stop-FurnitureLifecycle 'Native area value array exceeds the bounded probe limit'}
        # Index this managed Variant array explicitly, retaining every returned primitive before rank/value validation.
        for($linear=0;$linear -lt $raw.Length;$linear++){
            $indices=New-Object 'int[]' $raw.Rank;$remaining=$linear
            for($dimension=$raw.Rank-1;$dimension -ge 0;$dimension--){$length=$raw.GetLength($dimension);$indices[$dimension]=$raw.GetLowerBound($dimension)+($remaining%$length);$remaining=[int][math]::Floor($remaining/$length)}
            $observation.rawValues+=@((& $describe ($raw.GetValue([int[]]$indices))))
        }
        if($raw.Rank -ne 1 -or $raw.Length -ne $PointCount){Stop-FurnitureLifecycle 'Native area values have an unqualified rank or count'}
        $value=$raw.GetValue($raw.GetLowerBound(0)+$PointIndex-1)
    }else{
        $observation.rawValues=@((& $describe $raw))
        if($PointCount -ne 1){Stop-FurnitureLifecycle 'Native area scalar does not identify this point collection'}
        $value=$raw
    }
    if($null -eq $value -or [Convert]::GetTypeCode($value) -notin @([TypeCode]::Byte,[TypeCode]::SByte,[TypeCode]::Int16,[TypeCode]::UInt16,[TypeCode]::Int32,[TypeCode]::UInt32,[TypeCode]::Int64,[TypeCode]::UInt64,[TypeCode]::Single,[TypeCode]::Double,[TypeCode]::Decimal)){Stop-FurnitureLifecycle 'Native area value is missing, nonnumeric or a worksheet range; never resolve it'}
    $number=[double]$value
    if([double]::IsNaN($number) -or [double]::IsInfinity($number)){Stop-FurnitureLifecycle 'Native area value is not finite'}
    $observation.selectedValue=$number
    return $number
}

function Read-FurnitureChartPoint($Presentation,$Action,[string]$Prefix,$Probe=$null) {
    if($null -eq $Probe) {$Probe=New-FurniturePointProbe $Action $Prefix}
    $slide=Get-ExactSlide $Presentation ([int]$Action.slideIndex) $Prefix
    $overlay=Get-ExactShape $slide $Action.shapeName "$Prefix.overlay"
    $chartShape=Get-ExactShape $slide $Action.chartName "$Prefix.chart"
    $hasChart=Invoke-FurnitureCom "$Prefix.chart.hasChart" {$chartShape.HasChart}
    if($hasChart -ne -1) {Stop-FurnitureLifecycle 'The exact chart shape has no native chart'}
    $chart=Invoke-FurnitureCom "$Prefix.chart.get" {$chartShape.Chart}
    $chartType=Invoke-FurnitureCom "$Prefix.chart.type" {$chart.ChartType}
    # Only the sixteen source-supported homogeneous classic types; never guess a combo/3-D/ChartEx formula.
    # Microsoft XlChartType: https://learn.microsoft.com/en-us/office/vba/api/excel.xlcharttype
    $nativeKinds=@{51='vertical-bar';52='vertical-bar';53='vertical-bar';57='horizontal-bar';58='horizontal-bar';59='horizontal-bar';4='marker';65='marker';63='marker';66='marker';1='marker';76='marker';77='marker';-4169='marker';5='slice';-4120='slice'}
    if(-not (Test-Integer $chartType) -or -not $nativeKinds.ContainsKey([int]$chartType)) {Stop-FurnitureLifecycle 'Native chart type is not a supported classic point domain'}
    if($nativeKinds[[int]$chartType] -cne $Action.chartKind) {Stop-FurnitureLifecycle 'Action chartKind differs from the actual native chart type'}
    $seriesCollection=Invoke-FurnitureCom "$Prefix.series.get" {return ,$chart.SeriesCollection()}
    $seriesCount=Invoke-FurnitureCom "$Prefix.series.count" {$seriesCollection.Count}
    if($Action.seriesIndex -gt $seriesCount) {Stop-FurnitureLifecycle 'Native series index is no longer present'}
    $series=Invoke-FurnitureCom "$Prefix.series.item" {$seriesCollection.Item([int]$Action.seriesIndex)}
    $seriesType=Invoke-FurnitureCom "$Prefix.series.type" {$series.ChartType}
    if(-not (Test-Integer $seriesType) -or $seriesType -ne $chartType) {Stop-FurnitureLifecycle 'Selected native series type differs from the homogeneous chart type'}
    $seriesName=Invoke-FurnitureCom "$Prefix.series.name" {$series.Name}
    $points=Invoke-FurnitureCom "$Prefix.points.get" {return ,$series.Points()}
    $pointCount=Invoke-FurnitureCom "$Prefix.points.count" {$points.Count}
    if($Action.pointIndex -gt $pointCount) {Stop-FurnitureLifecycle 'Native point index is no longer present'}
    $point=Invoke-FurnitureCom "$Prefix.points.item" {$points.Item([int]$Action.pointIndex)}
    $chartLeft=Read-FurnitureFiniteNumber $chartShape 'Left' "$Prefix.chart.left"
    $chartTop=Read-FurnitureFiniteNumber $chartShape 'Top' "$Prefix.chart.top"
    $left=Read-FurnitureFiniteNumber $point 'Left' "$Prefix.point.left"
    $top=Read-FurnitureFiniteNumber $point 'Top' "$Prefix.point.top"
    $width=Read-FurnitureFiniteNumber $point 'Width' "$Prefix.point.width"
    $height=Read-FurnitureFiniteNumber $point 'Height' "$Prefix.point.height"
    $Probe.pointBoundsLocalPoints=@($left,$top,$width,$height)
    if($width -lt 0 -or $height -lt 0) {Stop-FurnitureLifecycle 'Native point bounds are negative'}
    $x=$left+$width/2; $y=$top+$height/2
    if($Action.chartKind -eq 'slice' -and $Action.edge -in @('top','bottom')) {
        $one=Read-FurnitureSlicePoint $point 1 $Prefix $Probe
        $two=Read-FurnitureSlicePoint $point 2 $Prefix $Probe
        $three=Read-FurnitureSlicePoint $point 3 $Prefix $Probe
        $innerArc=$null
        if($chartType -eq 5) {
            $four=Read-FurnitureSlicePoint $point 4 $Prefix $Probe
            $center=[pscustomobject]@{x=2*$four.x-$three.x;y=2*$four.y-$three.y}
            $Probe.pieCenterLocalPoints=@($center.x,$center.y)
        } else {
            $seven=Read-FurnitureSlicePoint $point 7 $Prefix $Probe
            $eight=Read-FurnitureSlicePoint $point 8 $Prefix $Probe
            $nine=Read-FurnitureSlicePoint $point 9 $Prefix $Probe
            $innerArc=@($nine,$eight,$seven)
            $center=Get-FurnitureNativeCircleCenter @($one,$two,$three)
            $Probe.circleCenterLocalPoints=@($center.x,$center.y);$Probe.circleCenterMethod=$center.method
        }
        $curve=Get-FurnitureCurvedSliceBounds $center @($one,$two,$three) $innerArc
        $Probe.curvedBoundsLocalPoints=$curve
        $Probe.strategy='native-curved-slice-bounds'
        $x=$curve.left+$curve.width/2;$y=if($Action.edge -eq 'top'){$curve.top}else{$curve.top+$curve.height}
    } elseif($Action.chartKind -eq 'slice' -and $Action.edge -in @('start','end','center')) {
        # Native XlPieSliceIndex: outer-center2, outer-clockwise3, mid-clockwise-radius4,
        # inner-center8 (doughnut only). Index5 does not establish a radial midpoint.
        # https://learn.microsoft.com/en-us/office/vba/api/excel.xlpiesliceindex
        # PowerPoint documents this API for pie only; doughnut getter availability stays unqualified.
        # https://learn.microsoft.com/en-us/office/vba/api/powerpoint.point.pieslicelocation
        if($Action.edge -eq 'end') {
            $outer=Read-FurnitureSlicePoint $point 2 $Prefix $Probe
            $x=$outer.x; $y=$outer.y; $Probe.strategy='native-outer-center2'
        } else {
            if($chartType -eq 5) {
                $clockwise=Read-FurnitureSlicePoint $point 3 $Prefix $Probe
                $midRadius=Read-FurnitureSlicePoint $point 4 $Prefix $Probe
                # Two independently observed native radial positions recover the actual center,
                # including a full-circle slice: C = M + (M - O) = 2*M - O. No serialized plot/overlay.
                $inner=[pscustomobject]@{x=$midRadius.x+($midRadius.x-$clockwise.x);y=$midRadius.y+($midRadius.y-$clockwise.y)}
                if([double]::IsNaN($inner.x) -or [double]::IsInfinity($inner.x) -or [double]::IsNaN($inner.y) -or [double]::IsInfinity($inner.y)) {Stop-FurnitureLifecycle 'Reconstructed native pie center is not finite'}
                $Probe.pieCenterLocalPoints=@($inner.x,$inner.y); $Probe.strategy='pie-center-from-native-radius3/4'
            } else {
                $inner=Read-FurnitureSlicePoint $point 8 $Prefix $Probe
                $Probe.strategy='native-doughnut-inner8'
            }
            $x=$inner.x; $y=$inner.y
            if($Action.edge -eq 'center') {
                $outer=Read-FurnitureSlicePoint $point 2 $Prefix $Probe
                $x=$inner.x/2+$outer.x/2; $y=$inner.y/2+$outer.y/2
                $Probe.strategy+='-midpoint-to-outer2'
            }
        }
    } elseif($chartType -in @(1,76,77)) {
        # Area Point bounds extend from the actual data tip to its baseline; the middle is not the plotted point.
        # Read actual Series.Values, never the serialized action sign. Other marker/line routes stay unchanged.
        $nativeValue=Read-FurnitureAreaValue $series ([int]$Action.pointIndex) ([int]$pointCount) $Prefix $Probe
        if([math]::Abs($width) -gt 0.001 -or $height -lt 0){Stop-FurnitureLifecycle 'Native area point bounds are outside the qualified zero-width vertical domain'}
        $x=$left;$y=if($nativeValue -lt 0){$top+$height}else{$top}
        $Probe.strategy='native-area-tip-from-actual-values'
    } elseif($Action.chartKind -ne 'marker') {
        if($Action.edge -eq 'top') {$y=$top}
        elseif($Action.edge -eq 'bottom') {$y=$top+$height}
        elseif($Action.edge -in @('start','end')) {
            $positive=$Action.valueSign -ge 0; $end=$Action.edge -eq 'end'
            if($Action.chartKind -eq 'horizontal-bar') {$x=if($positive -eq $end){$left+$width}else{$left}}
            elseif($Action.chartKind -eq 'vertical-bar') {$y=if($positive -eq $end){$top}else{$top+$height}}
        }
    }
    $nativeX=$chartLeft+[double]$x; $nativeY=$chartTop+[double]$y
    if([double]::IsNaN($nativeX) -or [double]::IsInfinity($nativeX) -or [double]::IsNaN($nativeY) -or [double]::IsInfinity($nativeY)) {Stop-FurnitureLifecycle 'Native chart point coordinate is not finite'}
    $overlayLeft=Read-FurnitureFiniteNumber $overlay 'Left' "$Prefix.overlay.left"
    $overlayTop=Read-FurnitureFiniteNumber $overlay 'Top' "$Prefix.overlay.top"
    $overlayWidth=Read-FurnitureFiniteNumber $overlay 'Width' "$Prefix.overlay.width"
    $overlayHeight=Read-FurnitureFiniteNumber $overlay 'Height' "$Prefix.overlay.height"
    $overlayX=$overlayLeft+$overlayWidth/2; $overlayY=$overlayTop+$overlayHeight/2
    $distance=[math]::Sqrt([math]::Pow($overlayX-$nativeX,2)+[math]::Pow($overlayY-$nativeY,2))*4/3
    return [ordered]@{chartName=$Action.chartName;shapeName=$Action.shapeName;chartType=$chartType;seriesChartType=$seriesType;seriesName=$seriesName;seriesIndex=$Action.seriesIndex;pointIndex=$Action.pointIndex;kind=$Action.chartKind;edge=$Action.edge;valueSign=$Action.valueSign;nativeLocalBoundsPoints=@($left,$top,$width,$height);nativeSliceObservations=@($Probe.sliceCoordinates.ToArray());nativePieCenterLocalPoints=$Probe.pieCenterLocalPoints;nativeCurvedBoundsLocalPoints=$Probe.curvedBoundsLocalPoints;nativePlotCenterLocalPoints=$Probe.plotCenterLocalPoints;nativeCircleCenterLocalPoints=$Probe.circleCenterLocalPoints;nativeCircleCenterMethod=$Probe.circleCenterMethod;nativeAreaValueObservation=$Probe.areaValueObservation;coordinateStrategy=$Probe.strategy;nativePointSlidePoints=@($nativeX,$nativeY);overlayCenterSlidePoints=@($overlayX,$overlayY);distancePixels=$distance;withinFourPixels=($distance -le 4);scope='Independent actual native point/shape coordinates; no serialized overlay coordinate is used as the point measurement'}
}

# Bounded current native chart metadata only: no ChartData, Values setter, Excel or UI.
function Get-FurnitureSeriesTarget($Presentation,$Action,[string]$Prefix) {
    $slide=Get-ExactSlide $Presentation ([int]$Action.slideIndex) $Prefix
    $shape=Get-ExactShape $slide $Action.chartName "$Prefix.chart"
    $has=Invoke-FurnitureCom "$Prefix.chart.hasChart" {$shape.HasChart};if($has -ne -1){Stop-FurnitureLifecycle 'The exact series-name target is not a native chart'}
    $chart=Invoke-FurnitureCom "$Prefix.chart.get" {$shape.Chart};$type=Invoke-FurnitureCom "$Prefix.chart.type" {$chart.ChartType}
    if(-not (Test-Integer $type) -or $type -notin @(51,52,53,57,58,59,4,65,63,66,1,76,77,-4169,5,-4120)){Stop-FurnitureLifecycle 'Series-name qualification requires a supported classic point chart'}
    $collection=Invoke-FurnitureCom "$Prefix.series.get" {return ,$chart.SeriesCollection()};$count=Invoke-FurnitureCom "$Prefix.series.count" {$collection.Count}
    if(-not (Test-Integer $count) -or $count -lt 1 -or $count -gt 256 -or $Action.seriesIndex -gt $count){Stop-FurnitureLifecycle 'Series-name target count/index is outside the bounded collection'}
    $series=Invoke-FurnitureCom "$Prefix.series.item" {$collection.Item([int]$Action.seriesIndex)}
    $seriesType=Invoke-FurnitureCom "$Prefix.series.type" {$series.ChartType};if($seriesType -ne $type){Stop-FurnitureLifecycle 'Mixed native series types are outside name-edit qualification'}
    return [pscustomobject]@{series=$series;collection=$collection;count=$count;chartType=$type}
}
function Read-FurnitureLiteralSeriesName($Series,[string]$Prefix,$Probe) {
    $name=Invoke-FurnitureCom "$Prefix.series.name.get" {$Series.Name}
    $Probe.observedType=if($null -eq $name){'null'}else{$name.GetType().FullName};$Probe.observedName=if($name -is [string]){$name}else{$null};$Probe.observedRawValue=if($null -eq $name){$null}elseif($name -is [string] -or $name -is [ValueType]){[Convert]::ToString($name,[Globalization.CultureInfo]::InvariantCulture)}else{'<unsupported native name type>'}
    if($name -isnot [string]){Stop-FurnitureLifecycle 'Native series name is not a literal String'}
    return $name
}
function Set-FurnitureSeriesName($Presentation,$Action,[string]$Prefix) {
    if($script:officeOperationsStopped){throw 'Office operations already stopped; preserve the original series-name failure receipt'}
    try{Assert-LiteralSeriesName $Action.expectedName 'expectedName' $Prefix;Assert-LiteralSeriesName $Action.newName 'newName' $Prefix;if($Action.expectedName -ceq $Action.newName){throw 'Series-name action must make a literal change'}}catch{Stop-FurnitureLifecycle $_.Exception.Message}
    $probe=[ordered]@{phase='action';slideIndex=$Action.slideIndex;chartName=$Action.chartName;seriesIndex=$Action.seriesIndex;expectedName=$Action.expectedName;newName=$Action.newName;before=$null;after=$null;observedType=$null;observedName=$null;observedRawValue=$null;otherNames=@();status='begin'}
    $report.actionPlan.currentChartSeriesProbe=$probe;$report.actionPlan.chartSeriesEdits+=@($probe)
    $target=Get-FurnitureSeriesTarget $Presentation $Action $Prefix
    $before=Read-FurnitureLiteralSeriesName $target.series $Prefix $probe;$probe.before=$before
    if($before -cne $Action.expectedName){Stop-FurnitureLifecycle 'Native series name no longer equals the literal expectedName; no setter was called'}
    for($index=1;$index -le $target.count;$index++){
        if($index -eq $Action.seriesIndex){continue}
        $other=Invoke-FurnitureCom "$Prefix.series.other-$index.get" {$target.collection.Item($index)}
        $name=Invoke-FurnitureCom "$Prefix.series.other-$index.name.get" {$other.Name};$probe.otherNames+=@([ordered]@{index=$index;name=if($name -is [string]){$name}else{$null}})
        if($name -isnot [string]){Stop-FurnitureLifecycle 'Another native series has no String name'}
        if($name -ieq $Action.newName){Stop-FurnitureLifecycle 'New literal name already identifies another native series; no setter was called'}
    }
    Invoke-FurnitureCom "$Prefix.series.name.set" {$target.series.Name=$Action.newName}
    $after=Read-FurnitureLiteralSeriesName $target.series "$Prefix.readback" $probe;$probe.after=$after
    if($after -cne $Action.newName){Stop-FurnitureLifecycle 'Native series name setter did not retain the exact requested literal'}
    $probe.status='success'
}
function Read-FurnitureSeriesNameState($Presentation,$Targets,[string]$Phase) {
    if($script:officeOperationsStopped){throw 'Office operations already stopped; preserve the original series-name failure receipt'}
    $records=New-Object 'System.Collections.Generic.List[object]'
    foreach($action in $Targets){
        if($action.op -cne 'set-chart-series-name'){continue}
        $expected=if($Phase -ceq 'original'){$action.expectedName}else{$action.newName}
        $probe=[ordered]@{phase=$Phase;slideIndex=$action.slideIndex;chartName=$action.chartName;seriesIndex=$action.seriesIndex;expectedName=$expected;observedName=$null;observedType=$null;observedRawValue=$null;status='begin'};$report.actionPlan.currentChartSeriesProbe=$probe
        $target=Get-FurnitureSeriesTarget $Presentation $action "$Phase.series-name-$($records.Count+1)"
        $name=Read-FurnitureLiteralSeriesName $target.series "$Phase.series-name-$($records.Count+1)" $probe
        if($name -cne $expected){Stop-FurnitureLifecycle "Native $Phase series name does not equal its exact expected current literal"}
        $probe.status='success';$records.Add($probe)
    }
    return ,$records.ToArray()
}

function Apply-FurnitureAction($Presentation,$Action,[int]$Number) {
    $prefix="action-$Number-$($Action.op)"
    if($Action.op -ceq 'set-chart-series-name'){Set-FurnitureSeriesName $Presentation $Action $prefix;return}
    if($Action.op -eq 'move-slide') { $slide=Get-ExactSlide $Presentation ([int]$Action.slideIndex) $prefix; Invoke-FurnitureCom "$prefix.moveTo" { $slide.MoveTo([int]$Action.toIndex) }; return }
    $slide=Get-ExactSlide $Presentation ([int]$Action.slideIndex) $prefix
    if($Action.op -in @('set-tag','delete-tag')) {
        $tags=Get-ActionTags $Presentation $Action $prefix
        if($Action.op -eq 'set-tag') { Invoke-FurnitureCom "$prefix.tags.add" { $tags.Add($Action.tagName,$Action.tagValue) }; return }
        $existing=Read-NativeTags $tags "$prefix.tags.precondition"; if(@($existing | Where-Object { $_.name -ieq $Action.tagName }).Count -ne 1) { throw "$prefix expected one existing tag '$($Action.tagName)'" }
        Invoke-FurnitureCom "$prefix.tags.delete" { $tags.Delete($Action.tagName) }; return
    }
    if($Action.op -eq 'measure-chart-point') {$probe=New-FurniturePointProbe $Action $prefix;$report.actionPlan.currentChartPointProbe=$probe;$report.actionPlan.chartPoints+=@(Read-FurnitureChartPoint $Presentation $Action $prefix $probe);return}
    $shape=Get-ExactShape $slide $Action.shapeName $prefix
    switch($Action.op) {
        'set-text-style' { $evidence=Set-FurnitureTextStyle $shape $Action $prefix; $report.actionPlan.styleEdits+=@([ordered]@{index=$Number;slideIndex=$Action.slideIndex;shapeName=$Action.shapeName;observed=$evidence}) }
        'set-text' { $has=Invoke-FurnitureCom "$prefix.hasTextFrame.get" { $shape.HasTextFrame }; if($has -eq 0) { throw "$prefix selected shape has no text frame" }; $frame=Invoke-FurnitureCom "$prefix.textFrame.get" { $shape.TextFrame }; $range=Invoke-FurnitureCom "$prefix.textRange.get" { $frame.TextRange }; Invoke-FurnitureCom "$prefix.text.set" { $range.Text=$Action.text } }
        'set-alt' { Invoke-FurnitureCom "$prefix.alternativeText.set" { $shape.AlternativeText=$Action.alt } }
        'delete-shape' { Invoke-FurnitureCom "$prefix.delete" { $shape.Delete() } }
        'duplicate-shape' { Assert-ShapeNameAvailable $slide $Action.newName $prefix; $range=Invoke-FurnitureCom "$prefix.duplicate" { return ,$shape.Duplicate() }; $count=Invoke-FurnitureCom "$prefix.duplicateRange.count.get" { $range.Count }; if($count -ne 1) { throw "$prefix expected one duplicated shape; observed $count" }; $duplicate=Invoke-FurnitureCom "$prefix.duplicateRange.item-1.get" { $range.Item(1) }; Invoke-FurnitureCom "$prefix.duplicate.name.set" { $duplicate.Name=$Action.newName } }
    }
}
function Assert-FurnitureOfficeIdle {
    if(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) { throw 'POWERPNT.EXE is already running; do not attach to another session' }
}
function Stop-FurnitureLifecycle([string]$Message) {
    $script:officeOperationsStopped=$true; $script:cleanupConfirmed=$false
    throw $Message
}
function Assert-OwnedFurnitureApplication($Application) {
    $presentations=Invoke-FurnitureCom 'application.ownership.presentations.get' { return ,$Application.Presentations }
    $count=Invoke-FurnitureCom 'application.ownership.presentations.count.get' { $presentations.Count }
    if($count -ne 0) { Stop-FurnitureLifecycle 'Application has presentations; refuse to adopt or clean up a potentially foreign instance' }
    $script:ownedApplication=$Application
}
function Quit-OwnedFurnitureApplication($Application) {
    if(-not [object]::ReferenceEquals($script:ownedApplication,$Application)) { Stop-FurnitureLifecycle 'Refusing to quit an application this worker did not verify and own' }
    $presentations=Invoke-FurnitureCom 'application.cleanup.presentations.get' { return ,$Application.Presentations }
    $count=Invoke-FurnitureCom 'application.cleanup.presentations.count.get' { $presentations.Count }
    if($count -ne 0) { Stop-FurnitureLifecycle 'Application is no longer empty; do not quit or close foreign presentations' }
    Invoke-FurnitureCom 'application.cleanup.quit' { $Application.Quit() }
    $script:ownedApplication=$null
}
function Open-OwnedFurniture($Application,[string]$Path,[string]$Phase) {
    if(-not [object]::ReferenceEquals($script:ownedApplication,$Application)) { Stop-FurnitureLifecycle 'Refusing to open through an unverified application' }
    Assert-PresentationNotOpen $Application $Path "$Phase.preflight"
    $script:cleanupConfirmed=$false; $script:ownedPresentationPath=$Path; Write-FurnitureReport
    $presentations=Invoke-FurnitureCom "$Phase.presentations.get" { return ,$Application.Presentations }
    $script:presentation=Invoke-FurnitureCom "$Phase.presentation.open" { $presentations.Open($Path,-1,0,0) }
    $actual=Invoke-FurnitureCom "$Phase.presentation.fullName.get" { $script:presentation.FullName }
    if($actual -ine $Path) { Stop-FurnitureLifecycle "Opened presentation path differs from exact owned path: $actual" }
    $readonly=Invoke-FurnitureCom "$Phase.presentation.readOnly.get" { $script:presentation.ReadOnly }
    if($readonly -ne -1) { Stop-FurnitureLifecycle 'Owned presentation did not open read-only' }
}
function Save-OwnedFurnitureCopy([string]$ExpectedPath,[string]$CopyPath) {
    if($CopyPath -ieq $ExpectedPath -or (Test-Path -LiteralPath $CopyPath)) { Stop-FurnitureLifecycle 'SaveCopyAs requires a fresh derivative separate from the owned input' }
    $actual=Invoke-FurnitureCom 'edited.presentation.fullName.get' { $script:presentation.FullName }
    if($actual -ine $ExpectedPath -or $script:ownedPresentationPath -ine $ExpectedPath) { Stop-FurnitureLifecycle 'Refusing to copy a presentation whose exact identity is not owned' }
    Invoke-FurnitureCom 'edited.presentation.saveCopyAs' { $script:presentation.SaveCopyAs($CopyPath,24) }
    $after=Invoke-FurnitureCom 'edited.presentation.fullName.afterCopy.get' { $script:presentation.FullName }
    if($after -ine $ExpectedPath) { Stop-FurnitureLifecycle 'SaveCopyAs changed the owned input identity' }
}
function Close-OwnedFurniture([string]$Phase,[string]$ExpectedPath) {
    $actual=Invoke-FurnitureCom "$Phase.fullName.get" { $script:presentation.FullName }; if($actual -ine $ExpectedPath -or $script:ownedPresentationPath -ine $ExpectedPath) { Stop-FurnitureLifecycle "Refusing to close a presentation whose exact path is not owned: $actual" }
    # SaveCopyAs preserved the edited derivative. Discard only this verified owned in-memory state without a save prompt.
    Invoke-FurnitureCom "$Phase.discardChanges" { $script:presentation.Saved=-1 }
    Invoke-FurnitureCom "$Phase.close" { $script:presentation.Close() }; $script:presentation=$null; $script:ownedPresentationPath=$null; $script:cleanupConfirmed=$true; Write-FurnitureStage "$Phase.cleanup" 'success'
}

Write-FurnitureReport; Write-FurnitureStage 'worker.initialize' 'success'
try {
    Assert-FurnitureTextProbeIntegrity $request.textProbePlan $sourcePath $sourceSnapshot $sourceHash $planSnapshot $request.actionPlan.snapshotSha256
    Assert-FurnitureOfficeIdle
    $app=Invoke-FurnitureCom 'application.create' { New-Object -ComObject PowerPoint.Application }
    Assert-OwnedFurnitureApplication $app
    $officeVersion=Invoke-FurnitureCom 'application.version.get' { $app.Version }; $officeDirectory=Invoke-FurnitureCom 'application.path.get' { $app.Path }; $officeExecutable=Join-Path $officeDirectory 'POWERPNT.EXE'
    $report.environment.powerPointVersion=$officeVersion; $report.environment.powerPointExecutable=$officeExecutable; $report.environment.powerPointBuild=(Get-Item -LiteralPath $officeExecutable).VersionInfo.FileVersion; $report.environment.powerPointExecutableSha256=Get-FurnitureSha256 $officeExecutable; Write-FurnitureReport
    Assert-PresentationNotOpen $app $savedPath 'output.preflight'
    Open-OwnedFurniture $app $sourceSnapshot 'input'
    $report.phases.original=Read-FurnitureState $script:presentation 'original'; Write-FurnitureReport
    for($index=0;$index -lt $actions.Count;$index++) { Apply-FurnitureAction $script:presentation $actions[$index] ($index+1); $report.actionPlan.completed+=@([ordered]@{index=$index+1;op=$actions[$index].op;status='success'}) }
    Write-FurnitureReport
    Assert-FurnitureTextProbeIntegrity $request.textProbePlan $sourcePath $sourceSnapshot $sourceHash $planSnapshot $request.actionPlan.snapshotSha256
    Save-OwnedFurnitureCopy $sourceSnapshot $savedPath
    $report.phases.edited=Read-FurnitureState $script:presentation 'edited'; Write-FurnitureReport
    Close-OwnedFurniture 'edited.presentation' $sourceSnapshot; $report.saved.sha256=Get-FurnitureSha256 $savedPath; Write-FurnitureReport
    Assert-FurnitureTextProbeIntegrity $request.textProbePlan $sourcePath $sourceSnapshot $sourceHash $planSnapshot $request.actionPlan.snapshotSha256
    Open-OwnedFurniture $app $savedPath 'reopen'
    $report.phases.reopened=Read-FurnitureState $script:presentation 'reopened'; Write-FurnitureReport
    Close-OwnedFurniture 'reopened.presentation' $savedPath; $report.reopened.sha256=Get-FurnitureSha256 $savedPath
    if((Get-FurnitureSha256 $sourcePath) -cne $sourceHash -or (Get-FurnitureSha256 $sourceSnapshot) -cne $sourceHash) { throw 'Requested source or its snapshot changed during the native lifecycle' }
    if((Get-FurnitureSha256 $planSnapshot) -cne $request.actionPlan.snapshotSha256) { throw 'Action-plan snapshot changed during the native lifecycle' }
    Assert-FurnitureTextProbeIntegrity $request.textProbePlan $sourcePath $sourceSnapshot $sourceHash $planSnapshot $request.actionPlan.snapshotSha256
    Quit-OwnedFurnitureApplication $app
    Write-FurnitureStage 'worker.complete' 'success'; Write-FurnitureReport; Write-Output "Native furniture control completed with $($actions.Count) action(s)."
} catch {
    $report.error=$_.Exception.Message; if($script:officeOperationsStopped -or $null -ne $script:presentation) { $script:cleanupConfirmed=$false }
    Write-FurnitureStage 'worker.failure' 'error' $_.Exception.Message; Write-FurnitureReport; throw
}
