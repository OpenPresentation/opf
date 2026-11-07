# SH-18: open each deck read-only and SaveCopyAs it (PowerPoint's re-save), then quit if nothing else is open.
param([string[]]$Files, [string]$OutDir)
. "$PSScriptRoot/ppt.ps1"
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutDir | Out-Null
$app = Start-Ppt; $mine = @()
try { foreach ($file in $Files) { $p = $app.Presentations.Open($file, -1, 0, -1); $mine += $p; $p.SaveCopyAs((Join-Path $OutDir ([IO.Path]::GetFileName($file)))) } }
finally { Stop-Ppt $app $mine }
"saved $($Files.Count)"
