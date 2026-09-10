. ./test/native-process.ps1
$result=Invoke-OpfNativeWorker -ScriptPath artifacts/inspect-pie-values-safe.ps1 -WorkerArguments @('-EvidenceDirectory',(Resolve-Path -LiteralPath 'artifacts/pie-values-safe').Path) -OutputDirectory artifacts/pie-values-safe -TimeoutSeconds 45
$result | ConvertTo-Json
if($result.timedOut -or $result.exitCode -ne 0){exit 1}
