Start-Sleep -Seconds 30; Set-Content -LiteralPath (Join-Path $PSScriptRoot "unexpected-completion.txt") -Value "must not happen"
