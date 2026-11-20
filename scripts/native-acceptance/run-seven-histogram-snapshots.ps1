param([Parameter(Mandatory=$true)][string]$ExecutionEnvelope,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,[Parameter(Mandatory=$true)][string]$NodeExecutable,[Parameter(Mandatory=$true)][string]$OutputDirectory,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedRequestSha256,[switch]$RunOffice)
$ErrorActionPreference='Stop'
# New closed profile, same exact owned lifecycle and unchanged bounded observer.
& (Join-Path $PSScriptRoot 'run-seven-value-snapshots.ps1') -ExecutionEnvelope $ExecutionEnvelope -ExpectedEnvelopeSha256 $ExpectedEnvelopeSha256 -NodeExecutable $NodeExecutable -OutputDirectory $OutputDirectory -ExpectedRequestSha256 $ExpectedRequestSha256 -RunOffice:$RunOffice -HistogramClassic
