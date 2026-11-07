Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-Part([string]$pptx, [string]$part) {
  $z = [IO.Compression.ZipFile]::OpenRead($pptx)
  try {
    $e = $z.GetEntry($part); if (-not $e) { return $null }
    $r = New-Object IO.StreamReader($e.Open(), [Text.Encoding]::UTF8)
    $s = $r.ReadToEnd(); $r.Close(); return $s
  } finally { $z.Dispose() }
}

function List-Parts([string]$pptx) {
  $z = [IO.Compression.ZipFile]::OpenRead($pptx)
  try { $z.Entries | ForEach-Object { $_.FullName } } finally { $z.Dispose() }
}

# Copy $src to $dst and replace/add parts from hashtable @{ 'part/name' = 'xml text' }; $null value removes the part
function Write-Parts([string]$src, [string]$dst, [hashtable]$parts) {
  Copy-Item $src $dst -Force
  $z = [IO.Compression.ZipFile]::Open($dst, 'Update')
  try {
    foreach ($k in $parts.Keys) {
      $e = $z.GetEntry($k); if ($e) { $e.Delete() }
      if ($null -ne $parts[$k]) {
        $ne = $z.CreateEntry($k, 'Optimal')
        $w = New-Object IO.StreamWriter($ne.Open(), (New-Object Text.UTF8Encoding($false)))
        $w.Write($parts[$k]); $w.Close()
      }
    }
  } finally { $z.Dispose() }
}

function Dump-Parts([string]$pptx, [string]$outDir) {
  New-Item -ItemType Directory -Force $outDir | Out-Null
  $z = [IO.Compression.ZipFile]::OpenRead($pptx)
  try {
    foreach ($e in $z.Entries) {
      $p = Join-Path $outDir ($e.FullName -replace '/', '\')
      New-Item -ItemType Directory -Force (Split-Path $p) | Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $p, $true)
    }
  } finally { $z.Dispose() }
}
