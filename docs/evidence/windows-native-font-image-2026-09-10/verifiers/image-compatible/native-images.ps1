param([Parameter(Mandatory=$true)][string]$EvidenceDirectory,[Parameter(Mandatory=$true)][ValidateSet('images-fit','images-crop','images-editor-redo')][string]$Deck,[ValidateRange(5,60)][int]$TimeoutSeconds=45,[switch]$Worker)
$ErrorActionPreference='Stop';$root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile=Join-Path $root 'generation.json';$generation=Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
$record=@($generation.decks | Where-Object {$_.id -eq $Deck});if($record.Count -ne 1){throw 'Expected exactly one selected fixture'};$record=$record[0]
$runRoot=Join-Path $root "runs/$Deck"
function Sha([string]$File){return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
if(-not $Worker){
    if(Test-Path -LiteralPath $runRoot){throw 'Preserve this attempt; use a fresh directory'}
    [void](New-Item -ItemType Directory -Path $runRoot)
    . (Join-Path $PSScriptRoot 'native-process.ps1')
    $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$root,'-Deck',$Deck,'-Worker') -OutputDirectory $runRoot -TimeoutSeconds $TimeoutSeconds
    Get-Content -LiteralPath (Join-Path $runRoot 'worker.stdout.log')
    if($result.timedOut -or $result.exitCode -ne 0){throw 'Native image worker failed or timed out; preserve logs and inspect Office. No retry was started.'}
    return
}
$owned=$null;$stage='connect';$phases=@()
function Progress([string]$Value){$script:stage=$Value;@{stage=$Value;phases=$phases} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $runRoot 'progress.json') -Encoding UTF8}
function Open-Owned([string]$File){for($i=1;$i -le $app.Presentations.Count;$i++){if($app.Presentations.Item($i).FullName -eq $File){throw 'Fixture already open; ownership not established'}};return $app.Presentations.Open($File,0,0,0)}
function Picture($Slide){$pictures=@();for($n=1;$n -le $Slide.Shapes.Count;$n++){if($Slide.Shapes.Item($n).Type -eq 13){$pictures+=$Slide.Shapes.Item($n)}};if($pictures.Count -ne 1){throw 'Expected exactly one native picture'};return $pictures[0]}
function Read-Phase($Presentation,[string]$Phase){
    if($Presentation.Slides.Count -ne 9){throw 'Expected nine image slides'};$slides=@()
    for($i=1;$i -le 9;$i++){
        Progress "$Phase-slide-$i";$slide=$Presentation.Slides.Item($i);$picture=Picture $slide;$png="$Deck-$Phase-$i.png";$slide.Export((Join-Path $root $png),'PNG',1280,720)
        $slides+=@{slide=$i;alt=$picture.AlternativeText;box=@{x=$picture.Left;y=$picture.Top;width=$picture.Width;height=$picture.Height};png=$png;sha256=(Sha (Join-Path $root $png))}
    };return @{phase=$Phase;slides=$slides}
}
try{
    $source=Join-Path $root "$Deck.pptx";if((Sha $source) -ne $record.pptxSha256){throw 'Changed source fixture'}
    $app=New-Object -ComObject PowerPoint.Application;Progress 'open-original';$owned=Open-Owned $source;$phases+=Read-Phase $owned 'original'
    Progress 'save-owned';$saved=Join-Path $root "$Deck-saved.pptx";$owned.SaveAs($saved,24);$owned.Close();$owned=$null
    Progress 'reopen-owned';$owned=Open-Owned $saved;$phases+=Read-Phase $owned 'reopened'
    for($i=1;$i -le 9;$i++){Progress "edit-alt-$i";$picture=Picture $owned.Slides.Item($i);$picture.AlternativeText='Native alt '+$record.records[$i-1].alt}
    Progress 'save-edited';$edited=Join-Path $root "$Deck-edited.pptx";$owned.SaveAs($edited,24);$owned.Close();$owned=$null
    Progress 'reopen-edited';$owned=Open-Owned $edited;$phases+=Read-Phase $owned 'edited'
    $exe=Join-Path $app.Path 'POWERPNT.EXE';$os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{generationSha256=(Sha $generationFile);savedSha256=(Sha $saved);editedSha256=(Sha $edited);phases=$phases;powerPointBuild=(Get-Item -LiteralPath $exe).VersionInfo.FileVersion;executableSha256=(Sha $exe);windowsBuild="$($os.CurrentBuild).$($os.UBR)";hostVersion=$PSVersionTable.PSVersion.ToString();editedPictures=9} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $runRoot 'native.json') -Encoding UTF8
    Write-Output "Observed nine native images and persisted alt edits: $Deck"
}catch{@{stage=$stage;error=$_.Exception.Message;phases=$phases} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $runRoot 'failure.json') -Encoding UTF8;throw}
finally{if($null -ne $owned){$owned.Saved=-1;$owned.Close()}}
