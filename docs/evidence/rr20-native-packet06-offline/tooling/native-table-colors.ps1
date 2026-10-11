param([string]$EvidenceDirectory = 'artifacts/native-table-colors',[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference = 'Stop'
function Get-FixtureSha256([string]$FixturePath) {
    return (Get-FileHash -LiteralPath $FixturePath -Algorithm SHA256).Hash.ToLowerInvariant()
}
$evidenceRoot = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile = Join-Path $evidenceRoot 'generation.json'
$generation = Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
$sourcePath = Join-Path $evidenceRoot 'table-colors.pptx'
if ((Get-FixtureSha256 $sourcePath) -ne $generation.pptxSha256) { throw 'Stale table fixture' }
if(-not $Worker) {
    if(Test-Path -LiteralPath (Join-Path $evidenceRoot 'worker.json')) { throw 'Preserve this attempt; use a fresh generation directory' }
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$evidenceRoot,'-Worker') -OutputDirectory $evidenceRoot -TimeoutSeconds $TimeoutSeconds
    Get-Content -LiteralPath (Join-Path $evidenceRoot 'worker.stdout.log')
    if($result.timedOut -or $result.exitCode -ne 0) { throw 'Native table worker failed or timed out; preserve logs and inspect Office. No retry was started.' }
    return
}
function Save-FixtureProgress([string]$Value) {
    $script:stage=$Value
    @{stage=$Value;generationSha256=(Get-FixtureSha256 $generationFile);original=$original;reopened=$reopened} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'progress.json') -Encoding UTF8
}
function Open-OwnedFixture([string]$File) {
    Save-FixtureProgress "open-$([IO.Path]::GetFileName($File))"
    for($i=1;$i -le $powerpoint.Presentations.Count;$i++) { if($powerpoint.Presentations.Item($i).FullName -eq $File) { throw 'Fixture already open; ownership is not established' } }
    return $powerpoint.Presentations.Open($File,0,0,0)
}
function Read-FixtureTables($Presentation, [string]$Phase) {
    if ($Presentation.Slides.Count -ne $generation.expected.Count) { throw 'Unexpected slide count' }
    $observations = @()
    foreach ($slide in $Presentation.Slides) {
        Save-FixtureProgress "$Phase-slide-$($slide.SlideIndex)"
        $tables = @($slide.Shapes | Where-Object { $_.HasTable -eq -1 })
        if ($tables.Count -ne 1) { throw 'Expected one editable native table per slide' }
        $table = $tables[0].Table
        if ($table.Rows.Count -ne 2 -or $table.Columns.Count -ne 2) { throw 'Unexpected native table dimensions' }
        $cells = @()
        foreach ($cell in $generation.expected[$slide.SlideIndex-1].cells) {
            $range = $table.Cell($cell.row,$cell.column).Shape.TextFrame.TextRange
            $text = $range.Text
            $characters = @()
            for ($i=1; $i -le $text.Length; $i++) {
                $color = [long]$range.Characters($i,1).Font.Color.RGB
                $hex = '#{0:X2}{1:X2}{2:X2}' -f ($color -band 255),(($color -shr 8) -band 255),(($color -shr 16) -band 255)
                $characters += @{character=$text.Substring($i-1,1); color=$hex}
            }
            $cells += @{row=$cell.row; column=$cell.column; text=$text; characters=$characters}
        }
        $png = "$Phase-$($slide.SlideIndex).png"
        $pngPath = Join-Path $evidenceRoot $png
        $slide.Export($pngPath,'PNG',1280,720)
        $observations += @{slide=$slide.SlideIndex; cells=$cells; png=$png; pngSha256=(Get-FixtureSha256 $pngPath)}
    }
    return $observations
}
$powerpoint = $null; $stage='connect'; $original=@(); $reopened=@()
$presentation = $null
try {
    Save-FixtureProgress 'connect'; $powerpoint=New-Object -ComObject PowerPoint.Application
    $presentation = Open-OwnedFixture $sourcePath
    $original = @(Read-FixtureTables $presentation 'original')
    $savedPath = Join-Path $evidenceRoot 'table-colors-saved.pptx'
    $presentation.SaveAs($savedPath,24)
    $presentation.Close(); $presentation = $null
    $presentation = Open-OwnedFixture $savedPath
    $reopened = @(Read-FixtureTables $presentation 'reopened')
    Save-FixtureProgress 'edit-cells'
    foreach($slide in $presentation.Slides) {
        $table=@($slide.Shapes | Where-Object {$_.HasTable -eq -1})[0].Table
        $range=$table.Cell(2,1).Shape.TextFrame.TextRange
        $range.Text='Native '+$range.Text
    }
    $editedPath=Join-Path $evidenceRoot 'table-colors-edited.pptx'
    Save-FixtureProgress 'save-edited'; $presentation.SaveAs($editedPath,24)
    $presentation.Close(); $presentation=$null
    $presentation=Open-OwnedFixture $editedPath
    $edited=@(Read-FixtureTables $presentation 'edited')
    $executable = Join-Path $powerpoint.Path 'POWERPNT.EXE'
    $osVersion = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{generationSha256=(Get-FixtureSha256 $generationFile); savedSha256=(Get-FixtureSha256 $savedPath); editedSha256=(Get-FixtureSha256 $editedPath); powerPointVersion=$powerpoint.Version; executableVersion=(Get-Item -LiteralPath $executable).VersionInfo.FileVersion; executableSha256=(Get-FixtureSha256 $executable); windowsBuild="$($osVersion.CurrentBuild).$($osVersion.UBR)"; original=$original; reopened=$reopened; edited=$edited} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
} catch {
    @{stage=$stage;error=$_.Exception.Message;original=$original;reopened=$reopened} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'failure.json') -Encoding UTF8
    throw
} finally {
    if ($null -ne $presentation) { $presentation.Close() }
    # Do not quit PowerPoint or touch unrelated user presentations.
}
