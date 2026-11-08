$ErrorActionPreference='Stop'
$env:PSModulePath='C:\Windows\System32\WindowsPowerShell\v1.0\Modules;C:\Program Files\WindowsPowerShell\Modules;C:\Users\micha\Documents\WindowsPowerShell\Modules'
$suiteRoot='C:/opf-work/rtl-scalar-owned-export-01/suite'
$nativeRoot='C:/opf-work/qualification034-rtl-scalar-owned-native-01'
if(Test-Path -LiteralPath $nativeRoot){throw 'Fresh native output required'}
if((Get-FileHash -LiteralPath ($suiteRoot+'/suite.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne '0ce6fb8a1b88d5ed719f6f026ae541fcb3d1d22d2b706b32d58c2d069eeeda80'){throw 'Exact contrast suite required'}
[void](New-Item -ItemType Directory -Path $nativeRoot)
$suite=Get-Content -LiteralPath ($suiteRoot+'/suite.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$completed=New-Object System.Collections.Generic.List[object]
foreach($item in $suite.cases){
 $running=@(Get-Process POWERPNT -ErrorAction SilentlyContinue)
 [ordered]@{time=(Get-Date).ToUniversalTime().ToString('o');case=$item.id;processCount=$running.Count;processIds=@($running | ForEach-Object {$_.Id})} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath ($nativeRoot+'/'+$item.id+'.preflight.json') -Encoding UTF8
 if($running.Count -ne 0){throw ('Fresh PowerPoint guard refused '+$item.id+'; no attach/kill/retry')}
 Write-Output ('START '+$item.id)
 & 'C:/opf-work/rr105-readonly-survey/scripts/native-acceptance/run-windows.ps1' -SuiteDirectory $suiteRoot -PptxRepository C:/opf-work/rr105-readonly-survey/packages/pptx -Case $item.id -OutputDirectory ($nativeRoot+'/'+$item.id) -CaptureTextFonts -TimeoutSeconds 60
 $terminal=Get-Content -LiteralPath ($nativeRoot+'/'+$item.id+'/native/supervisor.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 if($terminal.timedOut -ne $false -or $terminal.exitCode -ne 0 -or $terminal.cleanupConfirmed -ne $true){throw ('Native cleanup/failure latch '+$item.id+'; no retry')}
 # Observe process exit after confirmed cleanup; this makes no Office call and never kills/attaches.
 $remaining=@(Get-Process POWERPNT -ErrorAction SilentlyContinue)
 $waitRecord=[ordered]@{started=(Get-Date).ToUniversalTime().ToString('o');observedProcesses=@($remaining | Select-Object Id,StartTime);maximumSeconds=30;officeCalls=0;processOwnershipInferred=$false}
 if($remaining.Count -gt 0){
  try{Wait-Process -Id @($remaining | ForEach-Object {$_.Id}) -Timeout 30 -ErrorAction Stop}catch{$waitRecord.observationError=$_.FullyQualifiedErrorId}
 }
 $still=@(Get-Process POWERPNT -ErrorAction SilentlyContinue)
 $waitRecord.finished=(Get-Date).ToUniversalTime().ToString('o');$waitRecord.remainingProcessCount=$still.Count
 $waitRecord | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath ($nativeRoot+'/'+$item.id+'.process-exit.json') -Encoding UTF8
 if($still.Count -ne 0){throw ('PowerPoint process remains after observational wait; stop before further Office work: '+$item.id)}
 $completed.Add([ordered]@{id=$item.id;slides=$item.slideCount;cleanupConfirmed=$true;officeProcessCountAfter=0;at=(Get-Date).ToUniversalTime().ToString('o')})
 ConvertTo-Json -InputObject @($completed.ToArray()) -Depth 5 | Set-Content -LiteralPath ($nativeRoot+'/completed.json') -Encoding UTF8
 Write-Output ('DONE '+$item.id)
}
Write-Output ('COMPLETED '+$completed.Count+' owned contrast cases; visual/import acceptance separate')