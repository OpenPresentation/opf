$ErrorActionPreference='Stop'
$env:PSModulePath='C:\Windows\System32\WindowsPowerShell\v1.0\Modules;C:\Program Files\WindowsPowerShell\Modules;C:\Users\micha\Documents\WindowsPowerShell\Modules'
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'PowerPoint already running'}
. C:\opf-work\release-033-final\packages\pptx\test\native-process.ps1
$record=Invoke-OpfNativeWorker -ScriptPath 'C:\opf-work\release-033-artifacts\sh23-vertical-flow-01\verify-ninth.ps1' -WorkerArguments @('-Manifest','C:\opf-work\sh20-23-review\artifacts\sh23-fresh-03\manifest.json','-Out','C:\opf-work\release-033-artifacts\sh23-vertical-flow-01\result','-NativeHelpersPath','C:\opf-work\release-033-final\packages\editor\test\native-playground-lib.ps1','-Only','vertical-flow') -OutputDirectory 'C:\opf-work\release-033-artifacts\sh23-vertical-flow-01' -TimeoutSeconds 60
$record | ConvertTo-Json -Depth 5


