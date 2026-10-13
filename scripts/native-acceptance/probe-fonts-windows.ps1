# Read-only, standalone fresh-process GDI+ enumeration. No setup entrypoint,
# shared mutex, registry writes, font registration, or Office interaction.
$ErrorActionPreference='Stop'
if($env:OS -ne 'Windows_NT') { throw 'This probe requires Windows' }
Add-Type -AssemblyName System.Drawing
$collection=New-Object Drawing.Text.InstalledFontCollection
try {
    $names=@($collection.Families | ForEach-Object { $_.Name })
    [ordered]@{schemaVersion=1;names=$names} | ConvertTo-Json -Depth 3 -Compress
} finally { $collection.Dispose() }
