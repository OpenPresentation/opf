# Run one owned verifier process with a deadline. Never kill Office, child
# applications or any process found through an application-name search.
function Invoke-OpfNativeWorker {
    param([string]$ScriptPath,[string[]]$WorkerArguments,[string]$OutputDirectory,[ValidateRange(1,60)][int]$TimeoutSeconds=45)
    $scriptFile=(Resolve-Path -LiteralPath $ScriptPath).Path
    $outputRoot=(Resolve-Path -LiteralPath $OutputDirectory).Path
    $hostExecutable=(Get-Process -Id $PID).Path
    $stdout=Join-Path $outputRoot 'worker.stdout.log'; $stderr=Join-Path $outputRoot 'worker.stderr.log'
    # -File consumes arguments as data, not PowerShell command text. Windows
    # filenames cannot contain a double quote; reject it in other arguments too.
    $arguments=@('-NoProfile','-NonInteractive','-File',$scriptFile)+$WorkerArguments
    foreach($argument in $arguments) { if($argument.Contains('"')) { throw 'Unsupported quote in native worker argument' } }
    $quoted=@($arguments | ForEach-Object { '"'+$_+'"' })
    $worker=Start-Process -FilePath $hostExecutable -WindowStyle Hidden -ArgumentList $quoted -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $record=@{processId=$worker.Id;startedAt=(Get-Date).ToUniversalTime().ToString('o');timeoutSeconds=$TimeoutSeconds;timedOut=$false;exitCode=$null;scope='Owned verifier process only. A timeout does not prove cleanup completed; Office processes are never terminated.'}
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'worker.json') -Encoding UTF8
    try {
        if(-not $worker.WaitForExit($TimeoutSeconds*1000)) {
            $record.timedOut=$true
            if(-not $worker.HasExited) { $worker.Kill() }
            if(-not $worker.WaitForExit(5000)) { throw 'Owned native worker did not exit after termination' }
        }
        $record.exitCode=$worker.ExitCode
        $record.finishedAt=(Get-Date).ToUniversalTime().ToString('o')
        $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'worker.json') -Encoding UTF8
        return $record
    } finally { $worker.Dispose() }
}
