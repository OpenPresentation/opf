# Independent Windows standard-library ZIP interoperability audit; no extraction.
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../../..'))
$taskManifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$taskCount = 0
$taskBytes = 0L
$taskResults = @()
$taskDelta = $taskManifest.delta
$taskArchive = @{archivePath=$taskDelta.archivePath;file='generic-recovery-delta.zip';bytes=$taskDelta.bytes;sha256=$taskDelta.sha256;expectedFiles=59;files=$taskDelta.files}
foreach ($taskArchive in @($taskArchive)) {
    $taskArchivePath = Join-Path $taskRoot $taskArchive.archivePath
    $taskInfo = Get-Item -LiteralPath $taskArchivePath
    if ($taskInfo.Length -ne $taskArchive.bytes -or $taskInfo.Length -ge 50MB) { throw 'Archive size mismatch' }
    if ((Get-FileHash -LiteralPath $taskArchivePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskArchive.sha256) { throw 'Archive SHA mismatch' }
    $taskZip = [IO.Compression.ZipFile]::OpenRead($taskArchivePath)
    try {
        if ($taskZip.Entries.Count -ne $taskArchive.expectedFiles) { throw 'Member count mismatch' }
        for ($taskIndex = 0; $taskIndex -lt $taskZip.Entries.Count; $taskIndex++) {
            $taskEntry = $taskZip.Entries[$taskIndex]
            $taskExpected = $taskArchive.files[$taskIndex]
            if ($taskEntry.FullName -cne $taskExpected.path) { throw 'Member order/path mismatch' }
            if ($taskEntry.Length -ne $taskExpected.bytes -or $taskEntry.Length -ge 32MB) { throw 'Member size mismatch' }
            if ($taskEntry.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss') -cne '1980-01-01T00:00:00') { throw 'Timestamp mismatch' }
            if ((($taskEntry.ExternalAttributes -shr 16) -band 0xffff) -ne 33188) { throw 'Nonregular member refused' }
            $taskStream = $taskEntry.Open()
            $taskHash = [Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
            try {
                $taskBuffer = New-Object byte[] 65536
                $taskExpanded = 0L
                while (($taskRead = $taskStream.Read($taskBuffer, 0, $taskBuffer.Length)) -gt 0) {
                    $taskExpanded += $taskRead
                    if ($taskExpanded -gt $taskExpected.bytes -or $taskExpanded -ge 32MB) { throw 'Expansion bound exceeded' }
                    $taskHash.AppendData($taskBuffer, 0, $taskRead)
                }
                if ($taskExpanded -ne $taskExpected.bytes) { throw 'Expanded bytes mismatch' }
                $taskActualHash = [Convert]::ToHexString($taskHash.GetHashAndReset()).ToLowerInvariant()
                if ($taskActualHash -cne $taskExpected.sha256) { throw 'Expanded SHA mismatch' }
                $taskBytes += $taskExpanded
                $taskCount++
            } finally { $taskHash.Dispose(); $taskStream.Dispose() }
        }
    } finally { $taskZip.Dispose() }
    $taskResults += @{file=$taskArchive.file;members=$taskArchive.expectedFiles;bytes=$taskArchive.bytes;sha256=$taskArchive.sha256}
}
if ($taskCount -ne 59 -or $taskBytes -ne 4112797) { throw 'Total mismatch' }
@{result='PASS';reader='Windows .NET System.IO.Compression.ZipArchive';source=$taskManifest.source;packageSource=$taskManifest.packageSource;archives=$taskResults;members=$taskCount;expandedBytes=$taskBytes;nativeAcceptance=$false;preparationSeal=$true;nativeStatus='pending'} | ConvertTo-Json -Depth 5
