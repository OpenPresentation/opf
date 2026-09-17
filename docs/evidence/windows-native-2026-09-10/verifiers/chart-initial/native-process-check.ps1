param([string]$OutputDirectory='artifacts/native-process-check')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'native-process.ps1')
$outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
[void](New-Item -ItemType Directory -Path $outputRoot -Force)
$reports=@()
foreach($case in @('success','failure','timeout')) {
    $directory=Join-Path $outputRoot $case
    [void](New-Item -ItemType Directory -Path $directory -Force)
    $scriptFile=Join-Path $directory 'owned worker with spaces.ps1'
    $body=switch($case) {
        success { 'param([string]$Value); Write-Output $Value; exit 0' }
        failure { 'Write-Error "Controlled verifier failure"; exit 17' }
        timeout { 'Start-Sleep -Seconds 30; Set-Content -LiteralPath (Join-Path $PSScriptRoot "unexpected-completion.txt") -Value "must not happen"' }
    }
    Set-Content -LiteralPath $scriptFile -Value $body -Encoding UTF8
    $value='literal argument with spaces; $() and ` characters'
    $arguments=@(); if($case -eq 'success'){$arguments=@('-Value',$value)}
    $result=Invoke-OpfNativeWorker -ScriptPath $scriptFile -WorkerArguments $arguments -OutputDirectory $directory -TimeoutSeconds $(if($case -eq 'timeout'){1}else{10})
    if($case -eq 'success') {
        if($result.timedOut -or $result.exitCode -ne 0) { throw 'Successful owned worker did not complete' }
        if((Get-Content -LiteralPath (Join-Path $directory 'worker.stdout.log') -Raw).Trim() -cne $value) { throw 'Worker argument was not passed literally' }
    }
    if($case -eq 'failure' -and ($result.timedOut -or $result.exitCode -ne 17)) { throw 'Worker failure status was lost' }
    if($case -eq 'timeout') {
        if(-not $result.timedOut) { throw 'Worker deadline was not enforced' }
        if(Get-Process -Id $result.processId -ErrorAction SilentlyContinue) { throw 'Timed-out owned worker still exists' }
        if(Test-Path -LiteralPath (Join-Path $directory 'unexpected-completion.txt')) { throw 'Timed-out script reached completion' }
    }
    $reports+=@{case=$case;result=$result;passed=$true}
}
$reports | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Encoding UTF8
Write-Output 'Native worker controls pass: literal arguments, successful exit, exact failure exit and owned-process timeout. No Office automation used.'
