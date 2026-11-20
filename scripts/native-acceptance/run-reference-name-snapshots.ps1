# One fixed reference Name edit and three owned copies. Default stays pure.
param(
    [Parameter(Mandatory=$true)][string]$SuiteDirectory,
    [Parameter(Mandatory=$true)][string]$PptxRepository,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][string]$ExecutionEnvelope,
    [Parameter(Mandatory=$true)][string]$ExpectedEnvelopeSha256,
    [Parameter(Mandatory=$true)][string]$ExpectedRequestSha256,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45,
    [switch]$RunOffice
)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'run-windows.ps1') -SuiteDirectory $SuiteDirectory -PptxRepository $PptxRepository -Case 'reference-native-lines' -OutputDirectory $OutputDirectory -ExecutionEnvelope $ExecutionEnvelope -ExpectedEnvelopeSha256 $ExpectedEnvelopeSha256 -ExpectedRequestSha256 $ExpectedRequestSha256 -NodeExecutable $NodeExecutable -TimeoutSeconds $TimeoutSeconds -RunOffice:$RunOffice -ReferenceNameEdit -ReferenceNameSnapshots
