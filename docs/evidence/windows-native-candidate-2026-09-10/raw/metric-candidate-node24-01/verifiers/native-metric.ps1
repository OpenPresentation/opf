param([string]$EvidenceDirectory = 'artifacts/native-metric',[ValidateSet('','metric-1280-left','metric-1280-center','metric-1280-right','metric-540-left','metric-540-center','metric-540-right')][string]$Deck='',[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference = 'Stop'
function Get-FixtureSha256([string]$FixturePath) {
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hasher.ComputeHash([System.IO.File]::ReadAllBytes($FixturePath)))).Replace('-', '').ToLowerInvariant() }
    finally { $hasher.Dispose() }
}
$evidenceRoot = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile = Join-Path $evidenceRoot 'generation.json'
$generation = Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
if($Deck -eq '') { throw 'Select exactly one metric fixture with -Deck; a blocked Office invocation is never retried' }
$runRoot=Join-Path $evidenceRoot "runs/$Deck"
if(-not $Worker) {
    if(Test-Path -LiteralPath $runRoot) { throw 'This attempt already exists; retain it and use a fresh generation directory' }
    [void](New-Item -ItemType Directory -Path $runRoot)
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$evidenceRoot,'-Deck',$Deck,'-Worker') -OutputDirectory $runRoot -TimeoutSeconds $TimeoutSeconds
    Get-Content -LiteralPath (Join-Path $runRoot 'worker.stdout.log')
    if($result.timedOut) { throw 'Native metric worker timed out. No retry was started; Office fixture cleanup is unconfirmed.' }
    if($result.exitCode -ne 0) { Get-Content -LiteralPath (Join-Path $runRoot 'worker.stderr.log'); throw "Native metric worker failed with exit code $($result.exitCode). No retry was started." }
    return
}
function Save-FixtureProgress([string]$Value) {
    $script:stage=$Value
    @{stage=$stage;deck=$Deck;generationSha256=(Get-FixtureSha256 $generationFile);decks=$reports;slides=$slides} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $runRoot 'progress.json') -Encoding UTF8
}
function Open-OwnedFixture([string]$File,[int]$ReadOnly=0) {
    Save-FixtureProgress "open-$([IO.Path]::GetFileName($File))"
    for($i=1;$i -le $powerpoint.Presentations.Count;$i++) { if($powerpoint.Presentations.Item($i).FullName -eq $File) { throw 'Fixture already open; ownership is not established' } }
    return $powerpoint.Presentations.Open($File,$ReadOnly,0,0)
}
$powerpoint = $null
$presentation = $null
$reopened = $null
$reports = @()
$slides = @(); $stage='connect'
try {
    Save-FixtureProgress 'connect'; $powerpoint=New-Object -ComObject PowerPoint.Application
    $selected=@($generation.decks | Where-Object {$_.id -eq $Deck})
    if($selected.Count -ne 1) { throw 'Selected metric fixture not found exactly once' }
    foreach ($record in $selected) {
        $id = $record.id
        if ($id -notmatch '^metric-\d+-(left|center|right)$') { throw 'Invalid fixture filename' }
        $sourcePath = Join-Path $evidenceRoot "$id.pptx"
        if ((Get-FixtureSha256 $sourcePath) -ne $record.pptxSha256) { throw 'Stale source fixture' }
        $presentation = Open-OwnedFixture $sourcePath
        if ($presentation.Slides.Count -ne $record.layouts.Count) { throw 'Native slide count mismatch' }
        $slides = @()
        $edits = @()
        foreach ($slide in $presentation.Slides) {
            Save-FixtureProgress "observe-slide-$($slide.SlideIndex)"
            $layout = $record.layouts[$slide.SlideIndex-1]
            $expected = @($layout.parts | Where-Object { $_.visible } | ForEach-Object { $part = $_; $index = 0; $part.fit.sourceLines | ForEach-Object { @{part=$part; line=$_; index=$index}; $index++ } })
            $index = 0
            $observations = @()
            foreach ($shape in $slide.Shapes) {
                if ($shape.Name -notmatch '^OPF metric \d+ (value|unit|label|description|delta|trend) line \d+$') { throw 'Unexpected native metric shape' }
                if ($index -ge $expected.Count) { throw 'Unexpected duplicate native metric line' }
                $item = $expected[$index]
                $part = $item.part
                $line = $item.line
                $origin = $part.linePositions[$item.index]
                $wanted = $part.text.Substring($line.start, $line.end - $line.start)
                $actual = $shape.TextFrame.TextRange.Text
                if ($actual -cne $wanted) { throw "Changed native text: $id slide $($slide.SlideIndex) line $index" }
                if ($shape.Tags.Count -lt 1) { throw 'Missing native metric tags' }
                if ($actual -ne '' -and [Math]::Abs($shape.TextFrame.TextRange.Font.Size - $part.fit.fontSize * .75) -gt .02) { throw 'Native metric font size differs' }
                $expectedX = $part.box.x
                $expectedWidth = $part.box.width
                if ([Math]::Abs($shape.Left - $expectedX*.75) -gt .02 -or [Math]::Abs($shape.Top - ($origin.baseline-$part.fit.fontSize)*.75) -gt .02 -or [Math]::Abs($shape.Width - $expectedWidth*.75) -gt .02) { throw 'Native metric shape differs from accepted geometry' }
                $range = $shape.TextFrame2.TextRange
                $tabTargets = @()
                for ($segmentIndex=1; $segmentIndex -lt $line.segments.Count; $segmentIndex++) {
                    $segment = $line.segments[$segmentIndex]
                    if ($line.segments[$segmentIndex-1].kind -eq 'tab' -and $segment.kind -eq 'text') {
                        $segmentRange = $range.Characters($segment.start - $line.start + 1, $segment.end - $segment.start)
                        $lineLeft = $range.Characters(1,1).BoundLeft
                        $errorPoints = [Math]::Abs($segmentRange.BoundLeft - $lineLeft - $segment.x*.75)
                        # Collect every outlier so later slides and source recovery still run.
                        # compare retains the strict 0.02-point gate and exits nonzero.
                        $tabTargets += @{sourceStart=$segment.start; expectedOffsetPoints=$segment.x*.75; actualOffsetPoints=$segmentRange.BoundLeft-$lineLeft; errorPoints=$errorPoints}
                    }
                }
                # The full paragraph range includes an invisible terminator advance.
                # Bound only the actual source characters when testing visible content.
                $characters = $range
                if ($actual.Length -gt 0) { $characters = $range.Characters(1,$actual.Length) }
                $insideCell = $true
                if ($actual.Trim() -ne '') {
                    $cell = $layout.cell
                    $insideCell = $characters.BoundLeft -ge $cell.x*.75-.1 -and $characters.BoundTop -ge $cell.y*.75-.1 -and $characters.BoundLeft+$characters.BoundWidth -le ($cell.x+$cell.width)*.75+.1 -and $characters.BoundTop+$characters.BoundHeight -le ($cell.y+$cell.height)*.75+.1
                    # Record native advance differences, including trailing whitespace.
                    # The separate PNG comparison tests actual visible ink containment.
                }
                $observations += @{role=$part.role; text=$actual; font=$range.Font.Name; fontSize=$range.Font.Size; left=$characters.BoundLeft; top=$characters.BoundTop; width=$characters.BoundWidth; height=$characters.BoundHeight; paragraphWidth=$range.BoundWidth; tags=$shape.Tags.Count; tabTargets=$tabTargets; characterBoundsInsideCell=$insideCell}
                if ($item.index -eq 0) {
                    $editText = $null
                    switch ($part.role) {
                        'value' { if ($part.sources[0].value -isnot [string]) { $editText = '7' } else { $editText = "NATIVE $actual" } }
                        'unit' { $editText = "Native $actual" }
                        'label' { $editText = "Saved $actual" }
                        'description' { $editText = "Edited $actual" }
                        'delta' { if ($part.sources[0].value -isnot [string]) { $editText = '1' } else { $editText = "Delta $actual" } }
                        'trend' { $editText = 'down' }
                    }
                    if ($null -ne $editText) { $edits += @{shape=$shape; name=$shape.Name; slide=$slide.SlideIndex; text=$editText} }
                }
                $index++
            }
            if ($index -ne $expected.Count) { throw 'Missing native accepted lines' }
            $rasterPath = Join-Path $evidenceRoot "$id-native-$($slide.SlideIndex).png"
            $slide.Export($rasterPath, 'PNG', [int]$record.width, [int]$record.height)
            # Isolate actual native raster ink for each semantic part. Temporarily hide
            # only our generated shapes; always restore their original visibility.
            $partRasters = @()
            $visibility = @{}
            foreach ($shape in $slide.Shapes) { $visibility[$shape.Name] = $shape.Visible }
            try {
                foreach ($part in @($layout.parts | Where-Object { $_.visible })) {
                    foreach ($shape in $slide.Shapes) {
                        $shape.Visible = 0
                        if ($shape.Name -match "^OPF metric \d+ $($part.role) line \d+$") { $shape.Visible = $visibility[$shape.Name] }
                    }
                    $partFile = "$id-native-$($slide.SlideIndex)-$($part.role).png"
                    $partPath = Join-Path $evidenceRoot $partFile
                    $slide.Export($partPath, 'PNG', [int]$record.width, [int]$record.height)
                    $partRasters += @{role=$part.role; file=$partFile; sha256=(Get-FixtureSha256 $partPath)}
                }
            } finally { foreach ($shape in $slide.Shapes) { $shape.Visible = $visibility[$shape.Name] } }
            $slides += @{slide=$slide.SlideIndex; lines=$observations; rasterSha256=(Get-FixtureSha256 $rasterPath); partRasters=$partRasters}
        }
        $savedPath = Join-Path $evidenceRoot "$id-saved.pptx"
        Save-FixtureProgress 'save-and-edit'
        $presentation.SaveCopyAs($savedPath,24)
        foreach ($edit in $edits) { $edit.shape.TextFrame.TextRange.Text = $edit.text }
        $editedPath = Join-Path $evidenceRoot "$id-edited.pptx"
        $presentation.SaveAs($editedPath,24)
        $presentation.Close(); $presentation = $null
        $reopened = Open-OwnedFixture $editedPath -ReadOnly -1
        foreach ($edit in $edits) {
            $shape = $reopened.Slides.Item($edit.slide).Shapes.Item($edit.name)
            if ($shape.TextFrame.TextRange.Text -cne $edit.text) { throw 'Native metric edit did not survive reopen' }
            if ($shape.Tags.Count -lt 1) { throw 'Native metric tags did not survive reopen' }
        }
        $reopened.Close(); $reopened = $null
        $reports += @{id=$id; slides=$slides; editsReopened=$edits.Count; savedSha256=(Get-FixtureSha256 $savedPath); editedSha256=(Get-FixtureSha256 $editedPath)}
        Write-Output "Native metric source, shape geometry and save/reopen verified $id"
    }
    $nativeExecutable = Join-Path $powerpoint.Path 'POWERPNT.EXE'
    $osVersion = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{powerPointVersion=$powerpoint.Version; executableVersion=(Get-Item -LiteralPath $nativeExecutable).VersionInfo.FileVersion; executableSha256=(Get-FixtureSha256 $nativeExecutable); windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; hostVersion=$PSVersionTable.PSVersion.ToString(); generationSha256=(Get-FixtureSha256 $generationFile); decks=$reports} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $runRoot 'native.json') -Encoding UTF8
    Save-FixtureProgress 'completed'
} catch {
    @{stage=$stage;error=$_.Exception.Message;decks=$reports;slides=$slides;generationSha256=(Get-FixtureSha256 $generationFile)} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $runRoot 'failure.json') -Encoding UTF8
    throw
} finally {
    if ($null -ne $reopened) { $reopened.Close() }
    if ($null -ne $presentation) { $presentation.Close() }
    # Preserve PowerPoint and every unrelated user presentation.
}
