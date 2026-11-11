# Definitions only. Entry scripts verify these exact bytes against the external
# envelope pin BEFORE loading this file. No Office/process operation here.
function Assert-SevenValuePath([string]$Path) {
    if([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path) -or $Path -match '[\x00-\x1f]' -or $Path.StartsWith('\')) {throw 'Absolute local value path required'}
    $full=[IO.Path]::GetFullPath($Path)
    if($full -cne $Path) {throw 'Canonical value path required'}
    $cursor=$full
    while($cursor) {$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {throw 'Aliased value path refused'};$parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent}
    return $full
}
function Assert-SevenValueBootstrap($Envelope,[string]$NodeExecutable,[switch]$HistogramClassic) {
    $expectedProfile=if($HistogramClassic){'seven-histogram-classic-single-value-edit-v1'}else{'seven-chart-treemap-single-value-edit-v1'}
    if($Envelope.schemaVersion -ne 1 -or $Envelope.profile -cne $expectedProfile -or $Envelope.nativeAcceptance -isnot [bool] -or $Envelope.nativeAcceptance -or $Envelope.registryAcceptance -isnot [bool] -or $Envelope.registryAcceptance) {throw 'Unsupported new value envelope'}
    $base=$Envelope.base;$controller=$base.controllerRepository;$root=Assert-SevenValuePath $controller.directory
    if($controller.dirty -isnot [bool] -or $controller.dirty -or $controller.revision -cnotmatch '^[a-f0-9]{40}$') {throw 'Frozen clean value controller required'}
    $required=@('identity.mjs','owned-postflight.mjs','owned-postflight.ps1','reference-chart-archive.mjs','reference-chart-profile.mjs','reference-runtime-routes.mjs','run-reference-chart-profile.ps1','run-seven-chart-profile.ps1','run-windows.ps1','seven-chart-archive.mjs','seven-chart-profile.mjs','seven-chart-worker.ps1','seven-postflight.mjs','seven-postflight.ps1','seven-value-profile.mjs','seven-value-current.mjs','seven-value-raw.mjs','seven-value-archive.mjs','seven-value-actions.ps1','seven-value-worker.ps1','run-seven-value-profile.ps1','seven-value-bootstrap.ps1','seven-value-postflight.ps1','seven-value-archive.test.mjs','seven-value-actions-self-test.ps1','windows-powershell-env.mjs') | ForEach-Object {'scripts/native-acceptance/'+$_}
    $required+=@('scripts/native-acceptance/seven-value-current.test.mjs','scripts/native-acceptance/seven-value-libraries.mjs','scripts/native-acceptance/seven-value-control-fixture.mjs','scripts/native-acceptance/seven-value-profile.test.mjs','scripts/native-acceptance/seven-value-postflight-self-test.ps1','packages/pptx/test/fixtures/chartex-fallback-main.json')
    $required+=@('scripts/native-acceptance/seven-signed-pareto.mjs','scripts/native-acceptance/chart-data-contract.mjs')
    $required+=@('scripts/native-acceptance/test-fixtures/seven-value-old-inspector.mjs')
    $required+=@('scripts/native-acceptance/seven-histogram-classic.mjs')
    if($controller.files -isnot [array] -or $controller.files.Count -ne $required.Count) {throw 'Exact value controller dependency closure required'}
    foreach($name in $required) {
        $records=@($controller.files | Where-Object {$_.path -ceq $name});if($records.Count -ne 1){throw 'Missing/duplicate value code identity'}
        $file=Assert-SevenValuePath (Join-Path $root $name);$item=Get-Item -LiteralPath $file -Force
        if($item.PSIsContainer -or $item.Length -ne $records[0].bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $records[0].sha256){throw 'Value controller code changed'}
    }
    $head=(& git -C $root rev-parse HEAD | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $head -cne $controller.revision){throw 'Value controller HEAD changed'}
    $status=(& git -C $root status --porcelain --untracked-files=normal | Out-String).Trim();if($LASTEXITCODE -ne 0 -or $status -ne ''){throw 'Value controller is dirty'}
    if($Envelope.libraries -isnot [array] -or $Envelope.libraries.Count -lt 2 -or $Envelope.libraries.Count -gt 32){throw 'Exact parser/ZIP library closure required'}
    $libraryFiles=0
    foreach($library in $Envelope.libraries){
        $directory=Assert-SevenValuePath $library.directory
        if($library.files -isnot [array] -or $library.files.Count -eq 0){throw 'Missing library file inventory'}
        foreach($fileRecord in $library.files){
            if($fileRecord.path -isnot [string] -or $fileRecord.path -match '[\\:]|(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($fileRecord.path)){throw 'Invalid library file path'}
            $file=Assert-SevenValuePath (Join-Path $directory $fileRecord.path);$item=Get-Item -LiteralPath $file -Force;$libraryFiles++
            if($libraryFiles -gt 1500 -or $item.PSIsContainer -or $item.Length -ne $fileRecord.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $fileRecord.sha256){throw 'Controller parser/ZIP library differs before Node'}
        }
    }
    $node=Assert-SevenValuePath $NodeExecutable;$item=Get-Item -LiteralPath $node -Force
    if($node -cne $base.node.path -or $base.node.version -cnotmatch '^v24\.' -or $item.PSIsContainer -or $item.Length -ne $base.node.identity.bytes -or (Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant() -cne $base.node.identity.sha256){throw 'Value Node identity changed'}
    return $root
}
function Import-SevenValueDefinitions([string]$Path,[string[]]$Names) {
    $tokens=$null;$parseFailures=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$parseFailures)
    if($parseFailures.Count -ne 0){throw 'Bound value definition parse failure'}
    foreach($name in $Names) {
        $found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
        if($found.Count -ne 1){throw 'Missing/duplicate exact value definition'}
        Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
    }
}
