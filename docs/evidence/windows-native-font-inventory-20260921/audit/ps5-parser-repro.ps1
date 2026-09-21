param(
    [string]$InputPath=(Join-Path $PSScriptRoot '..\native-font-inventory-01\font-registration.json'),
    [string]$OutputPath=(Join-Path $PSScriptRoot 'parser-repro.json')
)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $OutputPath) { throw 'Preserve the existing parser-repro output' }
$pipelineWrapped=@(Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json)
$direct=ConvertFrom-Json (Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8)
$fixed=@($direct)
$report=[ordered]@{
    kind='powershell-5.1-root-array-pipeline-reproduction'
    hostVersion=$PSVersionTable.PSVersion.ToString()
    officeOrFontCalls=0
    pipelineWrappedCount=$pipelineWrapped.Count
    pipelineWrappedFirstType=$pipelineWrapped[0].GetType().FullName
    pipelineWrappedFirstCount=$pipelineWrapped[0].Count
    directType=$direct.GetType().FullName
    directCount=$direct.Count
    fixedCount=$fixed.Count
    rawRowsAllRemoved=(@($direct | Where-Object {-not $_.removed -or $_.added -lt 1}).Count -eq 0)
}
if($report.pipelineWrappedCount -ne 1 -or $report.pipelineWrappedFirstCount -ne 4 -or $report.directCount -ne 4 -or $report.fixedCount -ne 4 -or -not $report.rawRowsAllRemoved) { throw 'The expected PowerShell 5.1 root-array behavior was not reproduced' }
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
$report | ConvertTo-Json -Compress
