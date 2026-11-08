$ErrorActionPreference='Stop'
$env:PSModulePath='C:\Windows\System32\WindowsPowerShell\v1.0\Modules;C:\Program Files\WindowsPowerShell\Modules;C:\Users\micha\Documents\WindowsPowerShell\Modules'
$suiteRoot='C:/opf-work/qualification034-sh26-rtl-suite-01'
$nativeRoot='C:/opf-work/qualification034-sh26-rtl-native-01'
$runner='C:/opf-work/rr105-readonly-survey/scripts/native-acceptance/run-windows.ps1'
$worker='C:/opf-work/rr105-readonly-survey/packages/pptx'
if(Test-Path -LiteralPath $nativeRoot){throw 'Fresh native output required'}
[void](New-Item -ItemType Directory -Path $nativeRoot)
$manifest=Get-Content -LiteralPath (Join-Path $suiteRoot 'suite.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$progress=New-Object System.Collections.Generic.List[object]
foreach($item in $manifest.cases){
  $running=@(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)
  $preflight=[ordered]@{time=(Get-Date).ToUniversalTime().ToString('o');case=$item.id;processCount=$running.Count;processIds=@($running | ForEach-Object {$_.Id})}
  $preflight | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $nativeRoot ($item.id+'.preflight.json')) -Encoding UTF8
  if($running.Count -ne 0){throw ('Fresh PowerPoint process guard refused case '+$item.id+'; no retry')}
  Write-Output ('START '+$item.id)
  & $runner -SuiteDirectory $suiteRoot -PptxRepository $worker -Case $item.id -OutputDirectory (Join-Path $nativeRoot $item.id) -CaptureTextFonts -TimeoutSeconds 60
  $terminal=Get-Content -LiteralPath (Join-Path $nativeRoot ($item.id+'/native/supervisor.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
  if($terminal.timedOut -ne $false -or $terminal.exitCode -ne 0 -or $terminal.cleanupConfirmed -ne $true){throw ('Native cleanup/failure latch: '+$item.id)}
  $progress.Add([ordered]@{id=$item.id;slides=$item.slideCount;cleanupConfirmed=$true;completed=(Get-Date).ToUniversalTime().ToString('o')})
  ConvertTo-Json -InputObject @($progress.ToArray()) -Depth 5 | Set-Content -LiteralPath (Join-Path $nativeRoot 'completed.json') -Encoding UTF8
  Write-Output ('DONE '+$item.id)
  Start-Sleep -Seconds 2
}
Write-Output ('COMPLETED '+$progress.Count+' owned cases; supervisor acceptance remains separate')