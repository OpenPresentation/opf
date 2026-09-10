param([Parameter(Mandatory=$true)][string]$EvidenceDirectory,[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile=Join-Path $root 'generation.json'
$generation=Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
function Sha([string]$File){return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
if(-not $Worker){
    if(Test-Path -LiteralPath (Join-Path $root 'worker.json')){throw 'Preserve this attempt; use a fresh directory'}
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    . (Join-Path $PSScriptRoot 'native-open-fonts.ps1')
    Invoke-OpfWithBundledFontFixture -Generation $generation -EvidenceRoot $root -Action {
        $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$root,'-Worker') -OutputDirectory $root -TimeoutSeconds $TimeoutSeconds
        Get-Content -LiteralPath (Join-Path $root 'worker.stdout.log')
        if($result.timedOut -or $result.exitCode -ne 0){throw 'Native font worker failed or timed out; preserve the attempt and inspect Office. No retry was started.'}
    }
    return
}
$owned=$null; $stage='connect'; $phases=@()
function Progress([string]$Value){$script:stage=$Value;@{stage=$Value;phases=$phases} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $root 'progress.json') -Encoding UTF8}
function Open-Owned([string]$File){
    for($i=1;$i -le $app.Presentations.Count;$i++){if($app.Presentations.Item($i).FullName -eq $File){throw 'Fixture already open; ownership not established'}}
    return $app.Presentations.Open($File,0,0,0)
}
function Read-Range($Range){
    $runs=@();$last=$null
    for($i=1;$i -le $Range.Length;$i++){
        $char=$Range.Characters($i,1);$font=$char.Font
        $key="$($font.Name)|$($font.Bold)|$($font.Italic)"
        if($null -ne $last -and $last.key -eq $key){$last.text+=$char.Text}
        else{$last=@{key=$key;text=$char.Text;family=$font.Name;bold=($font.Bold -eq -1);italic=($font.Italic -eq -1)};$runs+=$last}
    }
    return $runs
}
function Read-Phase($Presentation,[string]$Phase){
    if($Presentation.Slides.Count -ne 7){throw 'Expected seven native font fixture slides'}
    $slides=@()
    for($index=1;$index -le $Presentation.Slides.Count;$index++){
        Progress "$Phase-slide-$index"
        $slide=$Presentation.Slides.Item($index);$runs=@()
        for($n=1;$n -le $slide.Shapes.Count;$n++){
            $shape=$slide.Shapes.Item($n)
            if($shape.HasTable -eq -1){
                for($r=1;$r -le $shape.Table.Rows.Count;$r++){for($c=1;$c -le $shape.Table.Columns.Count;$c++){$runs+=Read-Range $shape.Table.Cell($r,$c).Shape.TextFrame2.TextRange}}
            }elseif($shape.HasTextFrame -eq -1 -and $shape.TextFrame2.HasText -eq -1){$runs+=Read-Range $shape.TextFrame2.TextRange}
        }
        $png="$Phase-$index.png";$slide.Export((Join-Path $root $png),'PNG',1280,720)
        $slides+=@{slide=$index;runs=$runs;png=$png;sha256=(Sha (Join-Path $root $png))}
    }
    return @{phase=$Phase;slides=$slides}
}
try{
    $source=Join-Path $root 'selection.pptx'
    if((Sha $source) -ne $generation.pptxSha256){throw 'Changed source fixture'}
    $app=New-Object -ComObject PowerPoint.Application
    Progress 'open-original';$owned=Open-Owned $source
    $phases+=Read-Phase $owned 'original'
    Progress 'save-owned';$saved=Join-Path $root 'selection-saved.pptx';$owned.SaveAs($saved,24);$owned.Close();$owned=$null
    Progress 'reopen-owned';$owned=Open-Owned $saved
    $phases+=Read-Phase $owned 'reopened'
    Progress 'export-private-pdf';$pdf=Join-Path $root 'private-font-proof.pdf';$owned.SaveAs($pdf,32)
    $exe=Join-Path $app.Path 'POWERPNT.EXE';$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{generationSha256=(Sha $generationFile);savedSha256=(Sha $saved);privatePdfSha256=(Sha $pdf);phases=$phases;powerPointBuild=(Get-Item -LiteralPath $exe).VersionInfo.FileVersion;executableSha256=(Sha $exe);windowsBuild="$($os.CurrentBuild).$($os.UBR)";hostVersion=$PSVersionTable.PSVersion.ToString();scope='Owned seven-slide font fixture; private PDF is excluded from portable evidence. Font names do not establish every physical glyph file.'} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $root 'native.json') -Encoding UTF8
    Write-Output 'Native font fixture observed and exported.'
}catch{
    @{stage=$stage;error=$_.Exception.Message;phases=$phases} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $root 'failure.json') -Encoding UTF8
    throw
}finally{if($null -ne $owned){$owned.Saved=-1;$owned.Close()}}
