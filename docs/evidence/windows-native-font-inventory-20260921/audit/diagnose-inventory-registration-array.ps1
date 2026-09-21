param([string]$AttemptDirectory)
$ErrorActionPreference='Stop'
$path=Join-Path $AttemptDirectory 'font-registration.json'
$legacy=@(Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
$parsed=Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
$flat=@($parsed)
$legacyGate=($legacy.Count -eq 4 -and @($legacy | Where-Object {-not $_.removed -or $_.added -lt 1}).Count -eq 0)
$flatGate=($flat.Count -eq 4 -and @($flat | Where-Object {-not $_.removed -or $_.added -lt 1}).Count -eq 0)
if($legacy.Count -ne 1 -or $flat.Count -ne 4 -or $legacyGate -or -not $flatGate) { throw 'Observed registration-array hypothesis did not reproduce' }
[ordered]@{
  kind='offline-inventory-parent-array-diagnosis'; powerShell=$PSVersionTable.PSVersion.ToString()
  officeOrComCalls=0; fontRegistrationCalls=0; rawAttemptChanged=$false
  sourceSha256=(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()
  originalExpressionOuterCount=$legacy.Count
  originalExpressionInnerType=$legacy[0].GetType().FullName
  originalExpressionCleanupGate=$legacyGate
  decodedThenWrappedCount=$flat.Count
  decodedThenWrappedCleanupGate=$flatGate
  registrationRecords=$flat
  scope='Offline parser diagnosis only; original supervisor remains unchanged, and the independent native font allowlist still fails.'
} | ConvertTo-Json -Depth 8
