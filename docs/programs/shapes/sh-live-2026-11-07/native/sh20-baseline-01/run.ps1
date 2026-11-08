$ErrorActionPreference='Stop'
$env:PSModulePath='C:\Windows\System32\WindowsPowerShell\v1.0\Modules;C:\Program Files\WindowsPowerShell\Modules;C:\Users\micha\Documents\WindowsPowerShell\Modules'
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'PowerPoint already running'}
. C:\opf-work\release-033-final\packages\pptx\test\native-process.ps1
$record=Invoke-OpfNativeWorker -ScriptPath 'C:\opf-work\release-033-artifacts\sh20-baseline-01\com-witness.ps1' -WorkerArguments @('-Seeds','C:\opf-work\_supervisor\com-jobs\sh-08\smartart-seeds.pptx','-Sweep','C:\opf-work\_supervisor\com-jobs\sh-live-extras\sweep','-Out','C:\opf-work\release-033-artifacts\sh20-baseline-01\result','-NativeHelpersPath','C:\opf-work\release-033-final\packages\editor\test\native-playground-lib.ps1','-BaselineOnly') -OutputDirectory 'C:\opf-work\release-033-artifacts\sh20-baseline-01' -TimeoutSeconds 60
$record | ConvertTo-Json -Depth 5
