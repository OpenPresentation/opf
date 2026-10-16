# Build the parity worktrees (core: pnpm; siblings: npm ci). Node 24 toolchain. Read-only w.r.t. product repos.
# Usage: build.ps1 [-Prefix parity]   (worktrees are sources\<Prefix>-opf, -opf-render, -opf-pptx)
param([string]$Prefix = "parity")
$ErrorActionPreference = "Stop"
# Optional Node 24 toolchain (node_modules with node\bin and .bin); otherwise node/pnpm come from PATH.
# NPM_CLI optionally selects the npm CLI script for that toolchain; the installed Windows npm path remains the default.
$T = if ($env:NODE_TOOLCHAIN) { $env:NODE_TOOLCHAIN } else { "<workspace>\toolchain\node_modules" }
$env:PATH = "$T\node\bin;$T\.bin;$env:PATH"
$P = Split-Path -Parent $MyInvocation.MyCommand.Path
$S = Resolve-Path "$P\..\..\sources"
$L = "$P\out\build"; New-Item -ItemType Directory -Force $L | Out-Null
$npm = if ($env:NPM_CLI) { $env:NPM_CLI } else { "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" }
& node.exe --version
if ($LASTEXITCODE -ne 0) { throw "Node version check failed ($LASTEXITCODE)" }
& pnpm.cmd --version
if ($LASTEXITCODE -ne 0) { throw "pnpm version check failed ($LASTEXITCODE)" }
$jobs = @()
$jobs += Start-Job -ArgumentList $T,$S,$L,$Prefix -ScriptBlock { param($T,$S,$L,$Prefix) $ErrorActionPreference="Stop"; $env:PATH="$T\node\bin;$T\.bin;$env:PATH"; Set-Location "$S\$Prefix-opf"; & pnpm.cmd install --frozen-lockfile *> "$L\core.log"; if ($LASTEXITCODE -ne 0) { throw "core install failed ($LASTEXITCODE)" }; & pnpm.cmd -r --if-present build *>> "$L\core.log"; if ($LASTEXITCODE -ne 0) { throw "core build failed ($LASTEXITCODE)" }; "core exit 0" }
foreach ($r in 'opf-render','opf-pptx') {
  $jobs += Start-Job -ArgumentList $T,$S,$L,$r,$npm,$Prefix -ScriptBlock { param($T,$S,$L,$r,$npm,$Prefix) $ErrorActionPreference="Stop"; $env:PATH="$T\node\bin;$T\.bin;$env:PATH"; Set-Location "$S\$Prefix-$r"; & node.exe $npm ci --no-audit --no-fund *> "$L\$r.log"; if ($LASTEXITCODE -ne 0) { throw "$r install failed ($LASTEXITCODE)" }; & node.exe $npm run build *>> "$L\$r.log"; if ($LASTEXITCODE -ne 0) { throw "$r build failed ($LASTEXITCODE)" }; "$r exit 0" }
}
$jobs | Wait-Job | Out-Null
$failed = @($jobs | Where-Object { $_.State -ne 'Completed' })
try {
  # Receive errors for diagnostics, then fail the caller even though jobs ran out of process.
  $jobs | Receive-Job -ErrorAction Continue
  if ($failed.Count -gt 0) { throw "Parity build failed in $($failed.Count) job(s); see logs in $L" }
} finally { $jobs | Remove-Job -Force }
