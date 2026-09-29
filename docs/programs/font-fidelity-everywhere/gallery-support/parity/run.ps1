# Re-runnable parity command. Every fix PR can report before/after "perfect" counts:
#   run.ps1                                  # current parity worktrees (sources\parity-*), writes parity-results.json + PARITY.md
#   run.ps1 -Prefix fix123 -Baseline parity-results.json -Out out\fix123.json
#     (create sources\fix123-{opf,opf-render,opf-pptx,pptx-gallery} worktrees on the PR branches; build.ps1 -Prefix fix123 first)
#   run.ps1 -Only layouts,charts -Limit 20   # quick subset
#   run.ps1 -Update                           # fetch origin/main, move sources\<Prefix>-* worktrees to it, rebuild
param([string]$Prefix = "parity", [string]$Baseline = "", [string]$Out = "", [string]$Only = "", [int]$Limit = 0, [switch]$Update, [switch]$SkipSnippets)
$ErrorActionPreference = "Continue"
# Optional Node 24 toolchain (node_modules with node\bin and .bin); otherwise node/pnpm come from PATH.
$T = if ($env:NODE_TOOLCHAIN) { $env:NODE_TOOLCHAIN } else { "<workspace>\toolchain\node_modules" }
$env:PATH = "$T\node\bin;$T\.bin;$env:PATH"
$P = Split-Path -Parent $MyInvocation.MyCommand.Path
$S = Resolve-Path "$P\..\..\sources"
if ($Update) {
  # OPF_REPOS: directory holding the opf, opf-render, opf-pptx and pptx-gallery clones.
  $R = if ($env:OPF_REPOS) { $env:OPF_REPOS } else { '<workspace>' }
  $map = @{ 'opf' = "$R\opf"; 'opf-render' = "$R\opf-render"; 'opf-pptx' = "$R\opf-pptx"; 'pptx-gallery' = "$R\pptx-gallery" }
  foreach ($k in $map.Keys) { & git -C $map[$k] fetch -q origin; & git -c core.longpaths=true -C "$S\$Prefix-$k" checkout -q --detach origin/main }
  & "$P\build.ps1" -Prefix $Prefix
}
$env:PARITY_PREFIX = $Prefix
if ($Only) { $env:ONLY = $Only } else { Remove-Item Env:ONLY -ErrorAction SilentlyContinue }
if ($Limit -gt 0) { $env:LIMIT = "$Limit" } else { Remove-Item Env:LIMIT -ErrorAction SilentlyContinue }
if (-not $Out) { $Out = "$P\parity-results.json" }
$env:OUT = $Out
Push-Location "$P\scripts"
try {
  if (-not $SkipSnippets) { & node.exe gen-snippets.mjs | Select-Object -Last 1 }
  & node.exe --import "file:///$($S -replace '\\','/')/$Prefix-opf/scripts/register-local-opf.mjs" parity.mjs
  $md = if ($Out -eq "$P\parity-results.json") { "$P\PARITY.md" } else { [IO.Path]::ChangeExtension($Out, '.md') }
  if ($Baseline) { & node.exe summarize.mjs $Out $md $Baseline } else { & node.exe summarize.mjs $Out $md }
} finally { Pop-Location }
