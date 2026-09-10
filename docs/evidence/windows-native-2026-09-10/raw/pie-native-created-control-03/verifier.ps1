param([string]$EvidenceDirectory,[switch]$Worker)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
if(-not $Worker) {
    if(Test-Path -LiteralPath (Join-Path $root 'worker.json')){throw 'Use a fresh control directory'}
    . (Join-Path $PSScriptRoot '../test/native-process.ps1')
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$root,'-Worker') -OutputDirectory $root -TimeoutSeconds 45
    Get-Content -LiteralPath (Join-Path $root 'worker.stdout.log')
    if($result.timedOut -or $result.exitCode -ne 0){throw 'Native pie control failed or timed out; no retry was started'}
    return
}
$presentation=$null;$stage='connect';$observed=@();$failure=$null
function Progress([string]$Value){$script:stage=$Value;@{stage=$stage;observed=$observed} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $root 'progress.json') -Encoding UTF8}
try {
    Progress 'connect';$app=New-Object -ComObject PowerPoint.Application
    $source=Join-Path $root 'created-by-powerpoint.pptx'
    if(Test-Path -LiteralPath $source){throw 'Native control output already exists'}
    Progress 'create-owned-presentation';$presentation=$app.Presentations.Add(0)
    Progress 'save-owned-presentation';$presentation.SaveAs((Join-Path $root 'empty-owned.pptx'),24)
    Progress 'add-native-pie'
    $slide=$presentation.Slides.Add(1,12)
    # Office creates this chart and its default embedded data; no OPF export used.
    # https://learn.microsoft.com/en-us/office/vba/api/powerpoint.shapes.addchart2
    $shape=$slide.Shapes.AddChart2(-1,5,0,0,640,400,$false)
    Progress 'observe-native-pie'
    $series=$shape.Chart.SeriesCollection().Item(1)
    $observed+=@{phase='created';name=$series.Name;categories=@($series.XValues);values=@($series.Values)}
    Progress 'save-native-pie';$presentation.SaveAs($source,24)
    $png=Join-Path $root 'created-by-powerpoint.png';$slide.Export($png,'PNG',1280,720)
    Progress 'close-owned-presentation';$presentation.Close();$presentation=$null
    Progress 'reopen-native-pie';$presentation=$app.Presentations.Open($source,-1,0,0)
    Progress 'observe-reopened-native-pie'
    if($presentation.Slides.Count -ne 1){throw 'Saved native control must contain exactly one slide'}
    $series=$presentation.Slides.Item(1).Shapes.Item(1).Chart.SeriesCollection().Item(1)
    $observed+=@{phase='reopened';name=$series.Name;categories=@($series.XValues);values=@($series.Values)}
    Progress 'close-reopened-native-pie';$presentation.Close();$presentation=$null
    $exe=Join-Path $app.Path 'POWERPNT.EXE'
    @{observed=$observed;powerPointVersion=(Get-Item -LiteralPath $exe).VersionInfo.FileVersion;hostVersion=$PSVersionTable.PSVersion.ToString();pptxSha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant();pngSha256=(Get-FileHash -LiteralPath $png -Algorithm SHA256).Hash.ToLowerInvariant();scope='Pie chart and default workbook created by PowerPoint AddChart2. No OPF input and no Series.Formula call.'} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $root 'control.json') -Encoding UTF8
    Progress 'completed';Write-Output 'Native-created pie control captured and its owned presentation closed.'
} catch {
    $failure=$_.Exception.Message
    @{stage=$stage;error=$failure;observed=$observed} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $root 'failure.json') -Encoding UTF8
    throw
} finally {
    if($null -ne $presentation){try{Progress 'close-owned-presentation';$presentation.Close()}catch{@{error=$_.Exception.Message;originalFailure=$failure}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'cleanup-failure.json') -Encoding UTF8}}
}
