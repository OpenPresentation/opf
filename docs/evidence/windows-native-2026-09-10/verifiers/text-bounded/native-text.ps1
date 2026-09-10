param([Parameter(Mandatory=$true)][string]$EvidenceDirectory,[ValidateRange(-1,23)][int]$Case=-1,[switch]$FontsOnly,[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference='Stop'
function Get-FixtureSha256([string]$File) { (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
$evidenceRoot=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile=Join-Path $evidenceRoot 'generation.json'
$generation=Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
if(-not $FontsOnly -and $Case -lt 0) { throw 'Select one native text fixture with -Case 0 through 23. A failed Office invocation is never retried.' }
$runName=if($FontsOnly){'font-preflight'}else{'case-{0:00}' -f $Case}
$runRoot=Join-Path $evidenceRoot "runs/$runName"
if(-not $Worker) {
    if(Test-Path -LiteralPath $runRoot) { throw 'This attempt already exists. Preserve its evidence and use a fresh generation directory.' }
    [void](New-Item -ItemType Directory -Path $runRoot)
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    . (Join-Path $PSScriptRoot 'native-text-fonts.ps1')
    $workerScript=$PSCommandPath
    Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $evidenceRoot -RunRoot $runRoot -Action {
        if($FontsOnly) { Write-Output 'All four fixture fonts registered temporarily; cleanup runs before return.'; return }
        $result=Invoke-OpfNativeWorker -ScriptPath $workerScript -WorkerArguments @('-EvidenceDirectory',$evidenceRoot,'-Case',[string]$Case,'-Worker') -OutputDirectory $runRoot -TimeoutSeconds $TimeoutSeconds
        Get-Content -LiteralPath (Join-Path $runRoot 'worker.stdout.log')
        if($result.timedOut) { throw 'Native text worker timed out. No retry was started. Office fixture cleanup is unconfirmed; parent font removal still runs.' }
        if($result.exitCode -ne 0) { Get-Content -LiteralPath (Join-Path $runRoot 'worker.stderr.log'); throw "Native text worker failed with exit code $($result.exitCode). No retry was started." }
    }
    return
}
function Save-FixtureProgress([string]$Value) {
    $script:stage=$Value
    @{stage=$stage;case=$Case;generationSha256=(Get-FixtureSha256 $generationFile);records=$records} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $runRoot 'progress.json') -Encoding UTF8
}
function Open-OwnedFixture([string]$File,[int]$ReadOnly=0) {
    Save-FixtureProgress "open-$([IO.Path]::GetFileName($File))"
    for($i=1;$i -le $powerpoint.Presentations.Count;$i++) { if($powerpoint.Presentations.Item($i).FullName -eq $File) { throw 'Fixture already open; ownership is not established' } }
    return $powerpoint.Presentations.Open($File,$ReadOnly,0,0)
}
$records=@(); $presentation=$null; $stage='connect'; $completed=$false
try {
    Save-FixtureProgress 'connect'; $powerpoint=New-Object -ComObject PowerPoint.Application
    foreach($fixture in @($generation.records[$Case])) {
        if($fixture.file -notmatch '^case-\d{2}\.pptx$') { throw 'Invalid fixture filename' }
        $source=Join-Path $evidenceRoot $fixture.file
        if((Get-FixtureSha256 $source) -ne $fixture.sha256) { throw 'Changed native fixture' }
        $presentation=Open-OwnedFixture $source
        Save-FixtureProgress "observe-$($fixture.file)"
        if($presentation.Slides.Count -ne 1) { throw 'Expected one fixture slide' }
        $slide=$presentation.Slides.Item(1)
        $expected=@(foreach($item in $fixture.items) { for($i=0;$i -lt $item.text.lines.Count;$i++) { if($item.text.lines[$i] -ne '') { @{item=$item;index=$i;text=$item.text.lines[$i]} } } })
        $shapes=@(for($i=1;$i -le $slide.Shapes.Count;$i++) { $shape=$slide.Shapes.Item($i); if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.TextRange.Text -ne '') { $shape } })
        if($shapes.Count -ne $expected.Count) { throw 'Native editable line count changed' }
        $observations=@()
        for($i=0;$i -lt $shapes.Count;$i++) {
            $shape=$shapes[$i]; $wanted=$expected[$i]; $item=$wanted.item; $placed=$item.text.placement.lines[$wanted.index]
            $text=$shape.TextFrame.TextRange.Text
            if($text -cne $wanted.text) { throw "Native line source changed: $($fixture.file) line $i" }
            $factor=0; if($fixture.alignment -eq 'center'){$factor=.5}; if($fixture.alignment -eq 'right'){$factor=1}
            $top=$placed.baseline-$item.text.fontSize; if($item.text.richLines){$top=$placed.y}
            if([Math]::Abs($shape.Left+$shape.Width*$factor-($placed.x+$placed.width*$factor)*.75) -gt .02 -or [Math]::Abs($shape.Top-$top*.75) -gt .02 -or [Math]::Abs($shape.Height-$placed.height*.75) -gt .02) { throw 'Native accepted line geometry changed' }
            $descriptors=@(for($char=1;$char -le $text.Length;$char++) {$shape.TextFrame2.TextRange.Characters($char,1).Font.Name}) | Select-Object -Unique
            $observations+=@{path=$item.path;line=$wanted.index;text=$text;fonts=@($descriptors);left=$shape.Left;top=$shape.Top;width=$shape.Width;height=$shape.Height;tags=$shape.Tags.Count}
        }
        $stem=[IO.Path]::GetFileNameWithoutExtension($fixture.file)
        $originalFile="$stem-original.png"; $slide.Export((Join-Path $evidenceRoot $originalFile),'PNG',[int]$fixture.width,[int]$fixture.height)
        Save-FixtureProgress "save-$stem"
        $savedFile="$stem-saved.pptx"; $presentation.SaveAs((Join-Path $evidenceRoot $savedFile),24)
        $presentation.Close(); $presentation=$null
        $presentation=Open-OwnedFixture (Join-Path $evidenceRoot $savedFile)
        Save-FixtureProgress "edit-$stem"
        $slide=$presentation.Slides.Item(1)
        $reopenedFile="$stem-reopened.png"; $slide.Export((Join-Path $evidenceRoot $reopenedFile),'PNG',[int]$fixture.width,[int]$fixture.height)
        # Original references belonged to the closed deck. Reacquire only this deck.
        $shapes=@(for($i=1;$i -le $slide.Shapes.Count;$i++) { $shape=$slide.Shapes.Item($i); if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.TextRange.Text -ne '') { $shape } })
        if($shapes.Count -ne $expected.Count) { throw 'Saved line count changed' }
        for($i=0;$i -lt $shapes.Count;$i++) { if($expected[$i].index -eq 0) { [void]$shapes[$i].TextFrame.TextRange.InsertBefore('Edited ') }; $shapes[$i].Name="Native renamed line $i" }
        $editedFile="$stem-edited.pptx"; $presentation.SaveAs((Join-Path $evidenceRoot $editedFile),24)
        $presentation.Close(); $presentation=$null
        $presentation=Open-OwnedFixture (Join-Path $evidenceRoot $editedFile) -ReadOnly -1
        for($i=0;$i -lt $expected.Count;$i++) {
            $wanted=$expected[$i].text; if($expected[$i].index -eq 0){$wanted="Edited $wanted"}
            if($presentation.Slides.Item(1).Shapes.Item("Native renamed line $i").TextFrame.TextRange.Text -cne $wanted) { throw 'Native edit did not reopen' }
        }
        $presentation.Close(); $presentation=$null
        # Masks mutate a fresh, unsaved original fixture; no altered formatting is
        # saved into the original, native-saved or edited deck.
        $presentation=Open-OwnedFixture $source; $slide=$presentation.Slides.Item(1)
        Save-FixtureProgress "masks-$stem"
        $slide.FollowMasterBackground=0; $slide.Background.Fill.Solid(); $slide.Background.Fill.ForeColor.RGB=0
        $shapes=@(for($i=1;$i -le $slide.Shapes.Count;$i++) { $shape=$slide.Shapes.Item($i); if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.TextRange.Text -ne '') { $shape } })
        for($i=1;$i -le $slide.Shapes.Count;$i++) { $slide.Shapes.Item($i).Visible=0 }
        for($i=0;$i -lt $shapes.Count;$i++) { $shapes[$i].TextFrame.TextRange.Font.Color.RGB=16777215 }
        $masks=@(); $maskIndex=0
        foreach($item in $fixture.items) {
            for($i=0;$i -lt $shapes.Count;$i++) { $shapes[$i].Visible=0; if($expected[$i].item.path -eq $item.path){$shapes[$i].Visible=-1} }
            $maskFile="$stem-mask-$maskIndex.png"; $slide.Export((Join-Path $evidenceRoot $maskFile),'PNG',[int]$fixture.width,[int]$fixture.height)
            $masks+=@{file=$maskFile;path=$item.path;sha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $maskFile))}; $maskIndex++
        }
        $presentation.Saved=-1; $presentation.Close(); $presentation=$null
        $records+=@{file=$fixture.file;lines=$observations;original=@{file=$originalFile;sha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $originalFile))};reopened=@{file=$reopenedFile;sha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $reopenedFile))};savedSha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $savedFile));editedSha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $editedFile));masks=$masks}
        Write-Output "Native text edits, save/reopen and paint captured $($fixture.file)"
    }
    $completed=$true
} catch {
    @{stage=$stage;error=$_.Exception.Message;records=$records;generationSha256=(Get-FixtureSha256 $generationFile)} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $runRoot 'failure.json') -Encoding UTF8
    throw
} finally {
    if($null -ne $presentation) { Save-FixtureProgress 'close-owned-fixture'; $presentation.Saved=-1; $presentation.Close() }
    # Never quit Office, close user files, or remove registrations we did not add.
}
if($completed) {
    $executable=Join-Path $powerpoint.Path 'POWERPNT.EXE'; $os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{generationSha256=(Get-FixtureSha256 $generationFile);powerPointVersion=(Get-Item -LiteralPath $executable).VersionInfo.FileVersion;executableSha256=(Get-FixtureSha256 $executable);windowsBuild="$($os.CurrentBuild).$($os.UBR)";hostVersion=$PSVersionTable.PSVersion.ToString();records=$records} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $runRoot 'native.json') -Encoding UTF8
    Save-FixtureProgress 'completed'
}
