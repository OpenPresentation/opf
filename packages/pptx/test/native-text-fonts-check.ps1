param([Parameter(Mandatory=$true)][string]$EvidenceDirectory,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'native-process.ps1')
. (Join-Path $PSScriptRoot 'native-text-fonts.ps1')
$evidenceRoot=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generation=Get-Content -LiteralPath (Join-Path $evidenceRoot 'generation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$outputRoot=[IO.Path]::GetFullPath($OutputDirectory)
if(Test-Path -LiteralPath $outputRoot) { throw 'Use a fresh font-control output directory' }
[void](New-Item -ItemType Directory -Path $outputRoot)
$reports=@()
foreach($case in @('failure','timeout')) {
    $runRoot=Join-Path $outputRoot $case
    [void](New-Item -ItemType Directory -Path $runRoot)
    $scriptFile=Join-Path $runRoot 'owned-font-control.ps1'
    $body=if($case -eq 'failure'){'exit 17'}else{'Start-Sleep -Seconds 30; throw "Timed-out worker reached completion"'}
    Set-Content -LiteralPath $scriptFile -Value $body -Encoding UTF8
    $caught=$null
    try {
        Invoke-OpfWithTemporaryFonts -Generation $generation -EvidenceRoot $evidenceRoot -RunRoot $runRoot -Action {
            $result=Invoke-OpfNativeWorker -ScriptPath $scriptFile -WorkerArguments @() -OutputDirectory $runRoot -TimeoutSeconds $(if($case -eq 'timeout'){1}else{10})
            if($result.timedOut -or $result.exitCode -ne 0) { throw 'Controlled font-owner failure' }
        }
    } catch { $caught=$_.Exception.Message }
    if($caught -ne 'Controlled font-owner failure') { throw "Expected the controlled failure; got: $caught" }
    $worker=Get-Content -LiteralPath (Join-Path $runRoot 'worker.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($case -eq 'failure' -and ($worker.timedOut -or $worker.exitCode -ne 17)) { throw 'Expected worker exit 17' }
    if($case -eq 'timeout' -and -not $worker.timedOut) { throw 'Expected worker timeout' }
    $fonts=Get-Content -LiteralPath (Join-Path $runRoot 'font-registration.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($fonts.Count -ne 4 -or @($fonts | Where-Object {-not $_.removed -or $_.added -lt 1}).Count) { throw 'Temporary font cleanup did not complete' }
    $reports+=@{case=$case;passed=$true;worker=$worker;fonts=$fonts}
}
@{hostVersion=$PSVersionTable.PSVersion.ToString();reports=$reports;scope='Real temporary font registration/removal after a failed and timed-out owned dummy worker. No Office calls.'} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outputRoot 'report.json') -Encoding UTF8
Write-Output 'Temporary font cleanup passed after both worker failure and timeout. No Office automation used.'
