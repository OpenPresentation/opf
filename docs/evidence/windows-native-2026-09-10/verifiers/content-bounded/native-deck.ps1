# Shared lifecycle for one explicitly selected quote/code fixture. Office access
# stays in the caller's killable worker; the parent owns only its exact helper.
function Initialize-OpfNativeDeck {
    param([string]$ScriptPath,[string]$EvidenceDirectory,[string]$Deck,[bool]$Worker,[int]$TimeoutSeconds)
    if($Deck -eq '') { throw 'Select exactly one fixture with -Deck; never automatically retry a blocked Office call' }
    $script:evidenceRoot=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
    $script:generationFile=Join-Path $evidenceRoot 'generation.json'
    $script:generation=Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $script:runRoot=Join-Path $evidenceRoot "runs/$Deck"
    if(-not $Worker) {
        if(Test-Path -LiteralPath $runRoot) { throw 'Preserve this attempt and use a fresh generation directory' }
        [void](New-Item -ItemType Directory -Path $runRoot)
        . (Join-Path $PSScriptRoot 'native-process.ps1')
        $result=Invoke-OpfNativeWorker -ScriptPath $ScriptPath -WorkerArguments @('-EvidenceDirectory',$evidenceRoot,'-Deck',$Deck,'-Worker') -OutputDirectory $runRoot -TimeoutSeconds $TimeoutSeconds
        Get-Content -LiteralPath (Join-Path $runRoot 'worker.stdout.log') | ForEach-Object { Write-Host $_ }
        if($result.timedOut -or $result.exitCode -ne 0) { throw 'Native worker failed or timed out; preserve logs and inspect Office. No retry was started.' }
        return $false
    }
    return $true
}
function Save-FixtureProgress([string]$Value) {
    $script:stage=$Value
    @{stage=$Value;generationSha256=(Get-FixtureSha256 $generationFile);decks=$reports;slides=$slides} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $runRoot 'progress.json') -Encoding UTF8
}
function Open-OwnedFixture([string]$File,[int]$ReadOnly=0) {
    Save-FixtureProgress "open-$([IO.Path]::GetFileName($File))"
    for($i=1;$i -le $powerpoint.Presentations.Count;$i++) { if($powerpoint.Presentations.Item($i).FullName -eq $File) { throw 'Fixture already open; ownership is not established' } }
    return $powerpoint.Presentations.Open($File,$ReadOnly,0,0)
}
