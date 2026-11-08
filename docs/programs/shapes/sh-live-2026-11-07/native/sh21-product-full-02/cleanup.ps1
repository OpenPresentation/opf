$ErrorActionPreference='Stop'
. C:\opf-work\release-033-final\packages\editor\test\native-playground-lib.ps1
$ownedPath='C:\opf-work\release-033-artifacts\sh21-product-full-02\result\pptx\hierarchy-5.pptx'
$all=@(Get-Process POWERPNT -ErrorAction SilentlyContinue)
if($all.Count -ne 1 -or $all[0].Id -ne 38740){throw 'Owned PowerPoint process identity changed; refusing cleanup'}
if($all[0].MainWindowTitle -notlike 'hierarchy-5.pptx*Read-Only*'){throw 'Owned PowerPoint title changed; refusing cleanup'}
$app=[Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
if($app.Presentations.Count -ne 1){throw 'A different presentation is open; refusing cleanup'}
$presentation=$app.Presentations.Item(1)
if([IO.Path]::GetFullPath([string]$presentation.FullName) -ne $ownedPath){throw 'Owned copy identity changed; refusing cleanup'}
$hashBefore=Get-OpfFileSha256 $ownedPath
[void](Close-OpfOwnedPresentation $presentation $ownedPath)
$empty=$app.Presentations.Count -eq 0
if($empty){$app.Quit()}
@{scope='Cleanup only of exact process38740 and its one owned read-only hierarchy5 copy after a failed observation; no Office process termination';closed=$true;quitEmpty=$empty;inputSha256=$hashBefore;inputSha256After=(Get-OpfFileSha256 $ownedPath)}|ConvertTo-Json|Set-Content -LiteralPath 'C:\opf-work\release-033-artifacts\sh21-product-full-02\cleanup.json' -Encoding UTF8
