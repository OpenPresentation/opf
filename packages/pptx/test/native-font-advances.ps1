param([string]$EvidenceDirectory='artifacts/native-font-advances')
$ErrorActionPreference='Stop'
function Get-ProbeHash([string]$File) { return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
$evidenceRoot=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile=Join-Path $evidenceRoot 'generation.json'
$generation=Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
$app=New-Object -ComObject PowerPoint.Application
$deck=$null
$results=@()
try {
    # This is a measurement-only native reference fixture, independent of OPF.
    # It never changes a user's presentation or installs a font.
    $deck=$app.Presentations.Add(0)
    $slide=$deck.Slides.Add(1,12)
    foreach($case in $generation.cases){
        if($case.missing){continue}
        # A fresh shape prevents paragraph/script state leaking between samples.
        $shape=$slide.Shapes.AddTextbox(1,0,0,4000,300)
        $shape.TextFrame.MarginLeft=0; $shape.TextFrame.MarginRight=0
        $shape.TextFrame.MarginTop=0; $shape.TextFrame.MarginBottom=0
        $shape.TextFrame.WordWrap=0; $shape.TextFrame.AutoSize=0
        $shape.TextFrame.TextRange.Text=$case.text
        $range=$shape.TextFrame2.TextRange
        $range.Font.Name=$case.family
        $range.Font.NameComplexScript=$case.family
        $range.Font.NameFarEast=$case.family
        $range.Font.Size=[single]$case.requestedSize
        $range.Font.Bold=0
        if($case.weight -ge 600){$range.Font.Bold=-1}
        $range.Font.Italic=0
        $range.Font.Spacing=0
        $range.Font.Kerning=12
        $range.ParagraphFormat.Alignment=1
        $characters=$range.Characters(1,$case.text.Length)
        $results+=@{id=$case.id;text=$range.Text;font=$range.Font.Name;complexScriptFont=$range.Font.NameComplexScript;eastAsianFont=$range.Font.NameFarEast;language=$range.LanguageID;size=$range.Font.Size;bold=$range.Font.Bold;kerning=$range.Font.Kerning;spacing=$range.Font.Spacing;width=$characters.BoundWidth;height=$characters.BoundHeight;left=$characters.BoundLeft;top=$characters.BoundTop}
        $shape.Delete()
    }
    $exe=Join-Path $app.Path 'POWERPNT.EXE'
    $os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{generationSha256=(Get-ProbeHash $generationFile);executableVersion=(Get-Item -LiteralPath $exe).VersionInfo.FileVersion;executableSha256=(Get-ProbeHash $exe);windowsBuild="$($os.CurrentBuild).$($os.UBR)";cases=$results} | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding utf8
    Write-Output "Measured $($results.Count) native reference-font cases."
}finally{if($null -ne $deck){$deck.Saved=-1;$deck.Close()}}
