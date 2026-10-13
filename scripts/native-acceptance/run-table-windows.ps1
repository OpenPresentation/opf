param(
    [Parameter(Mandatory=$true)][string]$SuiteDirectory,
    [Parameter(Mandatory=$true)][string]$PptxRepository,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(5,60)][int]$TimeoutSeconds=45
)
$ErrorActionPreference='Stop'
# Import only the generic runner's pure preflight/child-launch definitions, never its entrypoint.
$generic=Join-Path $PSScriptRoot 'run-windows.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($generic,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw ($errors | Out-String) }
foreach($name in @('Assert-PlainNativePath','Resolve-NativeAsset','Assert-NativeFileRecords','Assert-NativeRepositoryIdentity','Read-NativeSuite','Assert-FreshNativeOutput','Invoke-NativeChild')) {
    $definition=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
    if($null -eq $definition) { throw "Missing reviewed generic helper: $name" }
    Invoke-Expression $definition.Extent.Text
}
function Read-TableNativeBinding([string]$Directory) {
    # This eligible generic case verifies the complete file list without pretending the table case is eligible.
    $binding=Read-NativeSuite $Directory 'feature-table'
    $matches=@($binding.suite.cases | Where-Object { $_.id -ceq 'table-colors' })
    if($matches.Count -ne 1) { throw 'Suite needs one exact dedicated table-colors case' }
    $selected=$matches[0]
    if($selected.worker -cne 'table-colors' -or $selected.dedicatedWorker -cne 'native-table-colors.ps1' -or $selected.automaticControlEligible -isnot [bool] -or $selected.automaticControlEligible -ne $false -or $selected.slideCount -ne 6) { throw 'Dedicated table case must retain its separate six-slide worker contract' }
    foreach($relative in @('table-colors/table-colors.pptx','table-colors/generation.json')) {
        if(@($binding.suite.files | Where-Object { $_.path -ceq $relative }).Count -ne 1) { throw 'Dedicated table inputs must both be recorded' }
    }
    if($selected.input -cne 'table-colors/table-colors.pptx') { throw 'Dedicated worker requires its recorded table-colors input' }
    $input=Resolve-NativeAsset $binding.root $selected.input
    $generationPath=Resolve-NativeAsset $binding.root 'table-colors/generation.json'
    $generation=Get-Content -LiteralPath $generationPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $archiveHash=(Get-FileHash -LiteralPath $input -Algorithm SHA256).Hash.ToLowerInvariant()
    if($archiveHash -cne $selected.archiveSha256 -or $archiveHash -cne $generation.pptxSha256 -or $generation.expected -isnot [array] -or $generation.expected.Count -ne 6) { throw 'Dedicated table archive/generation identity or six-slide scope differs' }
    foreach($slide in $generation.expected) {
        if($slide.cells -isnot [array] -or $slide.cells.Count -ne 4) { throw 'Dedicated fixture requires four cells per slide' }
        $seen=New-Object 'System.Collections.Generic.HashSet[string]'
        foreach($cell in $slide.cells) {
            if($cell.row -notin @(1,2) -or $cell.column -notin @(1,2) -or -not $seen.Add("$($cell.row),$($cell.column)")) { throw 'Dedicated fixture requires unique 2 by 2 table cells' }
        }
    }
    return [ordered]@{binding=$binding;selected=$selected;input=$input;generation=$generationPath}
}

$table=Read-TableNativeBinding $SuiteDirectory
$workerRoot=Assert-PlainNativePath $PptxRepository
$suiteRoot=Assert-PlainNativePath (Join-Path $PSScriptRoot '../..')
$workerIdentity=Assert-NativeRepositoryIdentity $workerRoot $table.binding.suite.provenance.workerRepository @('test/native-table-colors.ps1','test/native-process.ps1','test/native-process-check.ps1','test/native-furniture-harness-check.ps1','test/native-furniture-control.ps1')
$suiteIdentity=Assert-NativeRepositoryIdentity $suiteRoot $table.binding.suite.provenance.suiteRepository @('scripts/native-acceptance/run-windows.ps1','scripts/native-acceptance/run-table-windows.ps1')
$output=Assert-FreshNativeOutput $OutputDirectory @($table.binding.root,$workerRoot,$suiteRoot)
$validation=Assert-FreshNativeOutput ($output+'.validation') @($table.binding.root,$workerRoot,$suiteRoot)
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'The dedicated native runner requires Windows and supervisor execution' }
$shell=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
if(-not (Test-Path -LiteralPath $shell -PathType Leaf)) { throw 'Windows PowerShell is required' }
# The generic ValidateOnly run performs both real Office-free worker harnesses first.
# Its fresh sibling directory is preserved even if validation fails; there is no retry.
& $shell -NoProfile -NonInteractive -File $generic -SuiteDirectory $SuiteDirectory -PptxRepository $PptxRepository -Case feature-table -OutputDirectory $validation -ValidateOnly -TimeoutSeconds $TimeoutSeconds
if($LASTEXITCODE -ne 0) { throw 'Pure validation failed; preserve its sibling output and do not start Office' }
$pure=Get-Content -LiteralPath (Join-Path $validation 'runner.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($pure.status -cne 'pure-checks-completed; native-not-run' -or $pure.manifestSha256 -cne $table.binding.manifestSha256) { throw 'Pure validation receipt does not bind this suite' }
[void](New-Item -ItemType Directory -Path $output)
$evidence=Join-Path $output 'table-colors';[void](New-Item -ItemType Directory -Path $evidence)
$receipt=[ordered]@{schemaVersion=1;case='table-colors';manifestSha256=$table.binding.manifestSha256;provenance=$table.binding.suite.provenance;executingCode=[ordered]@{suite=$suiteIdentity;workers=$workerIdentity};validationDirectory=$validation;timeoutSeconds=$TimeoutSeconds;status='verified-input-copy-pending';nativeAcceptance=$false;registryAcceptance=$false}
$receiptPath=Join-Path $output 'runner.json'
function Write-TableRunnerReceipt { $receipt | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $receiptPath -Encoding UTF8 }
Write-TableRunnerReceipt
try {
    Copy-Item -LiteralPath $table.input -Destination (Join-Path $evidence 'table-colors.pptx')
    Copy-Item -LiteralPath $table.generation -Destination (Join-Path $evidence 'generation.json')
    $records=@($table.binding.suite.files | Where-Object { $_.path -cin @('table-colors/table-colors.pptx','table-colors/generation.json') } | ForEach-Object { [pscustomobject]@{path=[IO.Path]::GetFileName($_.path);sha256=$_.sha256;bytes=$_.bytes} })
    Assert-NativeFileRecords $evidence $records
    $current=Read-TableNativeBinding $SuiteDirectory
    if($current.binding.manifestSha256 -cne $table.binding.manifestSha256) { throw 'Original suite changed after pure validation' }
    $null=Assert-NativeRepositoryIdentity $workerRoot $table.binding.suite.provenance.workerRepository @('test/native-table-colors.ps1')
    $null=Assert-NativeRepositoryIdentity $suiteRoot $table.binding.suite.provenance.suiteRepository @('scripts/native-acceptance/run-table-windows.ps1')
    $receipt.status='native-worker-pending';Write-TableRunnerReceipt
    Invoke-NativeChild $shell (Join-Path $workerRoot 'test/native-table-colors.ps1') @('-EvidenceDirectory',$evidence,'-TimeoutSeconds',([string]$TimeoutSeconds)) (Join-Path $output 'native-worker.log')
    $current=Read-TableNativeBinding $SuiteDirectory
    if($current.binding.manifestSha256 -cne $table.binding.manifestSha256) { throw 'Original suite changed during native observation' }
    $receipt.status='native-observation-completed; comparison-and-supervisor-review-required';Write-TableRunnerReceipt
} catch {
    $receipt.status='failed; no-retry';$receipt.error=$_.Exception.Message;Write-TableRunnerReceipt
    throw
}
