param([Parameter(Mandatory=$true)][string]$EvidenceDirectory)
$ErrorActionPreference='Stop'
function Get-FixtureSha256([string]$FixturePath) {
    $hasher=[System.Security.Cryptography.SHA256]::Create()
    try {return ([BitConverter]::ToString($hasher.ComputeHash([System.IO.File]::ReadAllBytes($FixturePath)))).Replace('-','').ToLowerInvariant()}
    finally {$hasher.Dispose()}
}
$evidenceRoot=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationPath=Join-Path $evidenceRoot 'generation.json'
$generation=Get-Content -LiteralPath $generationPath -Raw | ConvertFrom-Json
$fixturePath=Join-Path $evidenceRoot 'tabs.pptx'
if ((Get-FixtureSha256 $fixturePath) -ne $generation.pptxSha256) {throw 'Changed native code fixture'}
$powerpoint=New-Object -ComObject PowerPoint.Application
$presentation=$null
$reopened=$null
$reports=@()
try {
    $presentation=$powerpoint.Presentations.Open($fixturePath,0,0,0)
    if ($presentation.Slides.Count -ne $generation.cases.Count) {throw 'Native slide count mismatch'}
    foreach ($slide in $presentation.Slides) {
        $case=$generation.cases[$slide.SlideIndex-1]
        $shape=$slide.Shapes.Item(1)
        $range=$shape.TextFrame2.TextRange
        if ($range.Text -cne $case.source) {throw 'Native text changed'}
        $segments=@()
        foreach ($segment in $case.line.segments) {
            $chars=$range.Characters($segment.start+1,$segment.end-$segment.start)
            $segments+=@{kind=$segment.kind;text=$chars.Text;expectedX=$segment.x*.75;expectedWidth=$segment.width*.75;left=$chars.BoundLeft-$shape.Left;width=$chars.BoundWidth}
        }
        $reports+=@{source=$case.source;text=$range.Text;slide=$slide.SlideIndex;font=$range.Font.Name;fontSize=$range.Font.Size;segments=$segments}
    }
    $savedPath=Join-Path $evidenceRoot 'tabs-saved.pptx'
    $editedPath=Join-Path $evidenceRoot 'tabs-edited.pptx'
    $presentation.SaveCopyAs($savedPath,24)
    foreach ($slide in $presentation.Slides) {$slide.Shapes.Item(1).TextFrame.TextRange.InsertAfter(' edited') | Out-Null}
    $presentation.SaveAs($editedPath,24)
    $presentation.Close();$presentation=$null
    $reopened=$powerpoint.Presentations.Open($savedPath,-1,0,0)
    $reopenedText=@($reopened.Slides | ForEach-Object {$_.Shapes.Item(1).TextFrame.TextRange.Text})
    $reopened.Close();$reopened=$null
    $reopened=$powerpoint.Presentations.Open($editedPath,-1,0,0)
    $editedText=@($reopened.Slides | ForEach-Object {$_.Shapes.Item(1).TextFrame.TextRange.Text})
    $executable=Join-Path $powerpoint.Path 'POWERPNT.EXE'
    $version=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($executable).FileVersion
    $os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{generationSha256=(Get-FixtureSha256 $generationPath);powerPointVersion=$version;powerPointExeSha256=(Get-FixtureSha256 $executable);
      windowsBuild="$($os.CurrentBuild).$($os.UBR)";displayVersion=$os.DisplayVersion;
      savedSha256=(Get-FixtureSha256 $savedPath);editedSha256=(Get-FixtureSha256 $editedPath);
      reports=$reports;reopenedText=$reopenedText;editedText=$editedText} | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding utf8
    Write-Output "Inspected $($reports.Count) native tab/whitespace cases and saved/reopened edits."
} finally {
    if ($null -ne $reopened) {$reopened.Close()}
    if ($null -ne $presentation) {$presentation.Close()}
    # Do not quit PowerPoint or close the user's unrelated presentations.
}
