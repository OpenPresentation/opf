# Closed new-protocol bootstrap. The unchanged v1 bootstrap admits SOURCE bytes only.
function Assert-SnapshotPath([string]$Path) {
    if([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path) -or $Path.StartsWith('\') -or [IO.Path]::GetFullPath($Path) -cne $Path -or $Path -match '[\x00-\x1f]'){throw 'Canonical local snapshot path required'}
    $cursor=$Path;while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased snapshot path'};$parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent};return $Path
}
function Assert-SevenSnapshotBootstrap($Envelope,[string]$NodeExecutable) {
    if($Envelope.schemaVersion -ne 1 -or $Envelope.profile -cne 'seven-treemap-setter-native-archives-v1' -or $Envelope.nativeAcceptance -isnot [bool] -or $Envelope.nativeAcceptance -or $Envelope.registryAcceptance -isnot [bool] -or $Envelope.registryAcceptance){throw 'Closed snapshot envelope required'}
    $source=$Envelope.sourceAdmission;$root=Assert-SnapshotPath $Envelope.controller.directory
    if($root -cne $source.base.controllerRepository.directory -or $Envelope.controller.revision -cne $source.base.controllerRepository.revision -or $Envelope.controller.dirty -isnot [bool] -or $Envelope.controller.dirty){throw 'Separate frozen snapshot controller identity differs'}
    $old=Join-Path $root 'scripts/native-acceptance/seven-value-bootstrap.ps1';$null=Assert-SnapshotPath $old
    $records=@($source.base.controllerRepository.files | Where-Object {$_.path -ceq 'scripts/native-acceptance/seven-value-bootstrap.ps1'})
    if($records.Count -ne 1 -or (Get-Item -LiteralPath $old).Length -ne $records[0].bytes -or (Get-FileHash -LiteralPath $old -Algorithm SHA256).Hash.ToLowerInvariant() -cne $records[0].sha256){throw 'Original source bootstrap differs'}
    . $old
    $verified=Assert-SevenValueBootstrap $source $NodeExecutable;if($verified -cne $root){throw 'Source bootstrap root differs'}
    $extra=@('seven-value-snapshot-profile.mjs','seven-value-snapshot-compare.mjs','seven-value-snapshot-namespace.mjs','seven-value-snapshot-bootstrap.ps1','seven-value-snapshot-actions.ps1','seven-value-snapshot-worker.ps1','seven-value-snapshot-postflight.ps1','run-seven-value-snapshots.ps1','seven-value-snapshot.test.mjs','seven-value-snapshot-output.test.mjs','seven-value-snapshot-check.ps1') | ForEach-Object {'scripts/native-acceptance/'+$_}
    $required=@($source.base.controllerRepository.files | ForEach-Object {$_.path})+@($extra)
    if($Envelope.controller.files -isnot [array] -or $Envelope.controller.files.Count -ne $required.Count){throw 'Exact new snapshot source closure required'}
    foreach($name in $required){$rows=@($Envelope.controller.files | Where-Object {$_.path -ceq $name});if($rows.Count -ne 1){throw 'Missing/duplicate snapshot source'};$file=Assert-SnapshotPath (Join-Path $root $name);$item=Get-Item -LiteralPath $file -Force;if($item.PSIsContainer -or $item.Length -ne $rows[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $rows[0].sha256){throw 'Snapshot source changed'}}
    if(Test-Path Env:NODE_OPTIONS){throw 'No Node preloads permitted'};if(Test-Path Env:NODE_PATH){throw 'No foreign Node search path permitted'}
    return $root
}
function Import-SnapshotDefinitions([string]$Root,[string]$File,[string[]]$Names){
    $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $Root $File),[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0){throw 'Bound snapshot definition parse failure'}
    foreach($name in $Names){$found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true));if($found.Count -ne 1){throw 'Missing/duplicate snapshot definition'};Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')}
}
