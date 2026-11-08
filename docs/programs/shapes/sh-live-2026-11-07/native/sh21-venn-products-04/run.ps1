$ErrorActionPreference='Stop'
$env:PSModulePath='C:\Windows\System32\WindowsPowerShell\v1.0\Modules;C:\Program Files\WindowsPowerShell\Modules;C:\Users\micha\Documents\WindowsPowerShell\Modules'
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'PowerPoint already running'}
. C:\opf-work\release-033-final\packages\pptx\test\native-process.ps1
$receipt=Invoke-OpfNativeWorker -ScriptPath 'C:\opf-work\release-033-artifacts\sh21-venn-products-04\worker.ps1' -WorkerArguments @() -OutputDirectory 'C:\opf-work\release-033-artifacts\sh21-venn-products-04' -TimeoutSeconds 60
$receipt|ConvertTo-Json -Depth 5
