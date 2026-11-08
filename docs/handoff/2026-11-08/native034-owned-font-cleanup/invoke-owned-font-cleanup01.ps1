$ErrorActionPreference='Stop'
$env:PSModulePath='C:\Windows\System32\WindowsPowerShell\v1.0\Modules;C:\Program Files\WindowsPowerShell\Modules;C:\Users\micha\Documents\WindowsPowerShell\Modules'
$existing=@(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)
[ordered]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');shell=$PSVersionTable.PSVersion.ToString();processCount=$existing.Count;processes=@($existing|ForEach-Object {[ordered]@{id=$_.Id;start=$_.StartTime.ToUniversalTime().ToString('o');path=$_.Path}})}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath C:\opf-work\release-033-artifacts\owned-font-cleanup01-preflight.json -Encoding UTF8
if($existing.Count -ne 0){throw 'PowerPoint is already running; owned font cleanup not performed'}
$profiles=@(
 @{name='mono';tool='C:\opf-work\rr-105-mono-profile\scripts\native-acceptance\setup-roboto-mono-windows.ps1';state='C:\Users\micha\AppData\Local\OPFNativeFonts\qualification034-mono-20261108-01'},
 @{name='roboto';tool='C:\opf-work\sh25-chart-points\scripts\native-acceptance\setup-fonts-windows.ps1';state='C:\Users\micha\AppData\Local\OPFNativeFonts\qualification034-20261108-01'}
)
foreach($profile in $profiles){
 $journal=Join-Path $profile.state 'state.json'
 $state=Get-Content -LiteralPath $journal -Raw -Encoding UTF8|ConvertFrom-Json
 if($state.status -cne 'ready' -or $state.toolSha256 -cne (Get-FileHash -LiteralPath $profile.tool -Algorithm SHA256).Hash.ToLowerInvariant()){throw ('Original owned tool identity differs: '+$profile.name)}
 Copy-Item -LiteralPath $journal -Destination (Join-Path C:\opf-work\release-033-artifacts ('owned-font-'+$profile.name+'-ready-before-cleanup01.json')) -ErrorAction Stop
 & $profile.tool -Action Cleanup -StateDirectory $profile.state
 $after=Get-Content -LiteralPath $journal -Raw -Encoding UTF8|ConvertFrom-Json
 if($after.status -cne 'cleaned'){throw ('Owned cleanup not confirmed: '+$profile.name)}
 Copy-Item -LiteralPath $journal -Destination (Join-Path C:\opf-work\release-033-artifacts ('owned-font-'+$profile.name+'-cleaned01.json')) -ErrorAction Stop
}
& C:\opf-work\rr-105-mono-profile\scripts\native-acceptance\probe-fonts-windows.ps1 | Set-Content -LiteralPath C:\opf-work\release-033-artifacts\owned-font-fresh-postcleanup01.json -Encoding UTF8
