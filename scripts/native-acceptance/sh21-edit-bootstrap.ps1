# Definitions only. An externally pinned envelope binds this file before import.
function Assert-Sh21Path([string]$Path) {
    if([string]::IsNullOrWhiteSpace($Path) -or -not[IO.Path]::IsPathRooted($Path) -or $Path.StartsWith('\') -or $Path -match '[\x00-\x1f]' -or [IO.Path]::GetFullPath($Path) -cne $Path){throw 'Canonical local SH21 path required'}
    $cursor=$Path
    while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased SH21 path refused'};$parent=Split-Path -Parent $cursor;if($parent -ceq $cursor){break};$cursor=$parent}
    return $Path
}
function Assert-Sh21Bootstrap($Envelope,[string]$Node) {
    if($Envelope.schemaVersion -ne 1 -or $Envelope.profile -cne 'sh21-three-case-node-and-text-edit-v1' -or $Envelope.nativeAcceptance -isnot [bool] -or $Envelope.nativeAcceptance -or $Envelope.registryAcceptance -isnot [bool] -or $Envelope.registryAcceptance){throw 'Closed SH21 envelope required'}
    $root=Assert-Sh21Path $Envelope.controller.directory;$nodePath=Assert-Sh21Path $Node
    if($Envelope.node.path -cne $nodePath -or $Envelope.node.version -cnotmatch '^v24\.' -or (Get-Item -LiteralPath $nodePath).Length -ne $Envelope.node.identity.bytes -or (Get-FileHash -LiteralPath $nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Envelope.node.identity.sha256){throw 'Bound SH21 Node differs'}
    $files=$Envelope.controller.files
    if($files -isnot [array] -or $files.Count -lt 10 -or $files.Count -gt 256 -or $Envelope.controller.dirty -isnot [bool] -or $Envelope.controller.dirty){throw 'Clean bounded SH21 controller required'}
    $seen=@{}
    foreach($record in $files){if($record.path -isnot [string] -or $record.path -match '[\\:]|(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($record.path) -or $seen.ContainsKey($record.path) -or $record.sha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid/duplicate SH21 source record'};$seen[$record.path]=$true;$file=Assert-Sh21Path (Join-Path $root $record.path);$item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or $item.Length -ne $record.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record.sha256){throw 'Bound SH21 code changed'}}
    foreach($name in @('sh21-edit-profile.mjs','sh21-edit-contract.mjs','sh21-edit-bootstrap.ps1','sh21-edit-actions.ps1','sh21-edit-worker.ps1','run-sh21-edit-profile.ps1','sh21-edit-postflight.ps1','seven-chart-worker.ps1','owned-postflight.ps1','run-reference-chart-profile.ps1')){if(-not $seen.ContainsKey('scripts/native-acceptance/'+$name)){throw 'Missing required SH21 source binding'}}
    $head=(& git -C $root rev-parse HEAD|Out-String).Trim();if($LASTEXITCODE -ne 0 -or $head -cne $Envelope.controller.revision){throw 'SH21 controller HEAD differs'}
    $status=(& git -C $root status --porcelain --untracked-files=normal|Out-String).Trim();if($LASTEXITCODE -ne 0 -or $status -ne ''){throw 'SH21 controller is dirty'}
    return $root
}
function Import-Sh21Definitions([string]$Path,[string[]]$Names) {
    $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'Bound SH21 definition parse failure'}
    foreach($name in $Names){$found=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($found.Count -ne 1){throw 'Missing/duplicate SH21 definition'};Invoke-Expression($found[0].Extent.Text -replace '^function\s+','function script:')}
}
