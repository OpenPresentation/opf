# Derive ordering/quantization assessment from immutable raw receipts. No Office calls or edits.
param([Parameter(Mandatory=$true)][string]$Suite,[Parameter(Mandatory=$true)][string]$Raw,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'title-wrap-metrics.ps1')
if (Test-Path -LiteralPath $Out) { throw 'Preserve earlier assessments: choose a fresh output path.' }
$manifestPath=Join-Path $Suite 'manifest.json'; $runPath=Join-Path $Raw 'run.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$run=Get-Content -LiteralPath $runPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.schema -cne 'opf-native-title-wrap/v1' -or -not @($run.files).Count) { throw 'Nonempty matching manifest/run required.' }
$report=[ordered]@{scope='Derived ordering and exact 1/8pt canvas assessment only; raw files unchanged. No new-product or Office acceptance.';manifestSha256=(Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant();rawRunSha256=(Get-FileHash -LiteralPath $runPath -Algorithm SHA256).Hash.ToLowerInvariant();files=@();complete=$false;passed=$false}
foreach ($file in $run.files) {
  $matches=@($manifest.cases | Where-Object { $_.name -ceq $file.name }); if ($matches.Count -ne 1 -or -not $file.result.officeCompleted) { throw 'Unknown or Office-incomplete raw result.' }
  $case=$matches[0]; $result=$file.result
  $ordered=@(Get-OpfOrderedTitleShapes $result.shapes); $actual=@(ConvertTo-OpfNormalizedTitleLines $ordered)
  $expected=@($case.lines | ForEach-Object { [regex]::Replace(([string]$_),'\s+',' ').Trim() })
  $linesMatch=$actual.Count -eq $expected.Count -and ($actual -join "`n") -ceq ($expected -join "`n")
  $canvas=Get-OpfTitleCanvasComparison $case.width $case.height $result.canvas.width $result.canvas.height
  $passed=$linesMatch -and $canvas.matches -and $result.sizeMatches -and $result.frameMatches -and $result.noAutofit -and -not $result.overflow.Count
  $report.files+=@{name=$file.name;mode=$file.mode;rawPassed=$result.passed;rawShapeOrder=@($result.shapes | ForEach-Object { @{name=$_.name;index=$_.index} });orderedShapeIndices=@($ordered | ForEach-Object { [int]$_.index });actualLines=$actual;expectedLines=$expected;linesMatch=$linesMatch;canvas=$canvas;unchangedNativeChecks=@{size=$result.sizeMatches;frame=$result.frameMatches;noAutofit=$result.noAutofit;overflow=$result.overflow};passed=$passed}
}
$after=@($report.files | Where-Object { $_.mode -ceq 'After' })
$report.complete=$after.Count -eq @($manifest.cases).Count -and @($after.name | Select-Object -Unique).Count -eq $after.Count
$report.passed=$report.complete -and @($after | Where-Object { -not $_.passed }).Count -eq 0
$report | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Out -Encoding UTF8
Write-Output "Derived candidates=$($after.Count), complete=$($report.complete), failed=$(@($after | Where-Object { -not $_.passed }).Count). Raw inputs unchanged."
