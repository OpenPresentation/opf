# Build the parity worktrees (core: pnpm; siblings: npm ci). Node 24 toolchain. Read-only w.r.t. product repos.
# Usage: build.ps1 [-Prefix parity]   (worktrees are sources\<Prefix>-opf, -opf-render, -opf-pptx)
param([string]$Prefix = "parity")
# Optional Node 24 toolchain (node_modules with node\bin and .bin); otherwise node/pnpm come from PATH.
$T = if ($env:NODE_TOOLCHAIN) { $env:NODE_TOOLCHAIN } else { "<workspace>\toolchain\node_modules" }
$env:PATH = "$T\node\bin;$T\.bin;$env:PATH"
$P = Split-Path -Parent $MyInvocation.MyCommand.Path
$S = Resolve-Path "$P\..\..\sources"
$L = "$P\out\build"; New-Item -ItemType Directory -Force $L | Out-Null
$npm = "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"
& node.exe --version; & pnpm.cmd --version
$jobs = @()
$jobs += Start-Job -ArgumentList $T,$S,$L,$Prefix -ScriptBlock { param($T,$S,$L,$Prefix) $env:PATH="$T\node\bin;$T\.bin;$env:PATH"; Set-Location "$S\$Prefix-opf"; & pnpm.cmd install --frozen-lockfile *> "$L\core.log"; & pnpm.cmd -r --if-present build *>> "$L\core.log"; "core exit $LASTEXITCODE" }
foreach ($r in 'opf-render','opf-pptx') {
  $jobs += Start-Job -ArgumentList $T,$S,$L,$r,$npm,$Prefix -ScriptBlock { param($T,$S,$L,$r,$npm,$Prefix) $env:PATH="$T\node\bin;$T\.bin;$env:PATH"; Set-Location "$S\$Prefix-$r"; & node.exe $npm ci --no-audit --no-fund *> "$L\$r.log"; & node.exe $npm run build *>> "$L\$r.log"; "$r exit $LASTEXITCODE" }
}
$jobs | Wait-Job | Receive-Job
