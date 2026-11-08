$ErrorActionPreference='Stop'
$env:PSModulePath='C:\Windows\System32\WindowsPowerShell\v1.0\Modules;C:\Program Files\WindowsPowerShell\Modules;C:\Users\micha\Documents\WindowsPowerShell\Modules'
if(Get-Process POWERPNT -ErrorAction SilentlyContinue){throw 'PowerPoint is already running; refusing native acceptance.'}
$success=$false
try{
 & powershell -NoProfile -ExecutionPolicy Bypass -File C:\opf-work\release-033-final\packages\editor\test\native-playground.ps1 -InputPath C:\opf-work\release-033-final\packages\editor\artifacts\browser-evidence\export.pptx -AttemptDirectory C:\opf-work\release-033-artifacts\rr87-native -TimeoutSeconds 60
 if($LASTEXITCODE -ne 0){throw "Owned-copy helper failed: exit $LASTEXITCODE"}
 $success=$true
}finally{
 # This pass began with no PowerPoint. After a successful worker, only its empty application may be quit.
 if($success){try{$app=[Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application');if($app.Presentations.Count -eq 0){$app.Quit()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)}catch{Write-Output $_.Exception.Message}}
}