param([string]$RunnerPath=(Join-Path $PSScriptRoot 'run-windows.ps1'),[string]$TableRunnerPath=(Join-Path $PSScriptRoot 'run-table-windows.ps1'))
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($RunnerPath,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw ($errors | Out-String) }
# Evaluate only pure preflight definitions. Never evaluate the runner entrypoint, child launcher or Office.
foreach($name in @('Assert-PlainNativePath','Resolve-NativeAsset','Assert-NativeFileRecords','Read-NativeSuite','Assert-FreshNativeOutput','Assert-NativeRepositoryIdentity')) {
    $function=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
    if($null -eq $function) { throw "Missing preflight function: $name" }
    Invoke-Expression $function.Extent.Text
}
$tableAst=[System.Management.Automation.Language.Parser]::ParseFile($TableRunnerPath,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw ($errors | Out-String) }
$tableFunction=$tableAst.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Read-TableNativeBinding'},$true)
if($null -eq $tableFunction) { throw 'Missing pure dedicated table preflight' }
Invoke-Expression $tableFunction.Extent.Text
$root=Join-Path ([IO.Path]::GetTempPath()) ('opf-native-runner-'+[guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $root)
$suiteRoot=Join-Path $root 'suite';[void](New-Item -ItemType Directory -Path $suiteRoot)
$output=Join-Path $root 'attempt'
$inputPath=Join-Path $suiteRoot 'case.pptx';$planPath=Join-Path $suiteRoot 'actions.json'
[IO.File]::WriteAllBytes($inputPath,[byte[]](1,2,3));[IO.File]::WriteAllText($planPath,'[]')
function Record([string]$Path) { return [ordered]@{path=[IO.Path]::GetFileName($Path);sha256=(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $Path).Length} }
function Manifest { return [ordered]@{schemaVersion=1;provenance=[ordered]@{testOnly=$true};files=@((Record $inputPath),(Record $planPath));cases=@([ordered]@{id='example';input='case.pptx';actionPlan='actions.json';automaticControlEligible=$true;worker='furniture'})} }
function Save($Value) { $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $suiteRoot 'suite.json') -Encoding UTF8 }
$passed=0
function Reject([string]$Name,[scriptblock]$Operation) {
    $caught=$false;try { & $Operation } catch { $caught=$true }
    if(-not $caught) { throw "$Name unexpectedly passed" }
    if(Test-Path -LiteralPath $output) { throw "$Name created output before preflight refusal" }
    $script:passed++
}
try {
    Save (Manifest);$binding=Read-NativeSuite $suiteRoot 'example';if($binding.selected.id -cne 'example') { throw 'Valid identity did not select exact case' };$passed++
    $null=Assert-FreshNativeOutput $output @($suiteRoot);$passed++
    Reject 'missing case' { $null=Read-NativeSuite $suiteRoot 'missing' }
    $m=Manifest;$m.cases[0].automaticControlEligible=$false;Save $m;Reject 'manual case' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.cases[0].automaticControlEligible='true';Save $m;Reject 'string eligibility' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.cases[0].worker='table-colors';Save $m;Reject 'wrong worker despite eligibility' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.schemaVersion=$true;Save $m;Reject 'boolean schema' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.files[0].sha256='not-a-hash';Save $m;Reject 'malformed hash' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.files[0].path='C:/outside.pptx';Save $m;Reject 'absolute asset' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.schemaVersion=2;Save $m;Reject 'unknown schema' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.files[0].sha256='0'*64;Save $m;Reject 'tampered hash' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.files[0].bytes=4;Save $m;Reject 'wrong length' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.files[0].path='../case.pptx';Save $m;Reject 'traversal' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.files+=@($m.files[0]);Save $m;Reject 'duplicate file' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.cases+=@($m.cases[0]);Save $m;Reject 'duplicate case' { $null=Read-NativeSuite $suiteRoot 'example' }
    $m=Manifest;$m.cases[0].actionPlan='undeclared.json';Save $m;Reject 'unrecorded plan' { $null=Read-NativeSuite $suiteRoot 'example' }
    Reject 'output within input suite' { $null=Assert-FreshNativeOutput (Join-Path $suiteRoot 'attempt') @($suiteRoot) }
    $existing=Join-Path $root 'prior-attempt';[void](New-Item -ItemType Directory -Path $existing)
    Reject 'existing output' { $null=Assert-FreshNativeOutput $existing @($suiteRoot) }
    $repo=Join-Path $root 'repository';[void](New-Item -ItemType Directory -Path $repo)
    & git -C $repo init -q;if($LASTEXITCODE -ne 0) { throw 'Pure repository fixture needs Git' }
    & git -C $repo config user.name 'Pure fixture';& git -C $repo config user.email 'fixture@example.invalid'
    $code=Join-Path $repo 'worker.ps1';[IO.File]::WriteAllText($code,'# Pure identity fixture')
    & git -C $repo add worker.ps1;& git -C $repo commit -qm 'Pure fixture';if($LASTEXITCODE -ne 0) { throw 'Pure repository fixture commit failed' }
    $revision=(& git -C $repo rev-parse HEAD | Out-String).Trim()
    $identity=[pscustomobject]@{revision=$revision;dirty=$false;files=@((Record $code))}
    $null=Assert-NativeRepositoryIdentity $repo $identity @('worker.ps1');$passed++
    $identity.revision='0'*40;Reject 'wrong repository revision' { $null=Assert-NativeRepositoryIdentity $repo $identity @('worker.ps1') };$identity.revision=$revision
    $identity.dirty=$true;Reject 'wrong dirty state' { $null=Assert-NativeRepositoryIdentity $repo $identity @('worker.ps1') };$identity.dirty=$false
    $originalHash=$identity.files[0].sha256;$identity.files[0].sha256='0'*64;Reject 'wrong recorded worker bytes' { $null=Assert-NativeRepositoryIdentity $repo $identity @('worker.ps1') };$identity.files[0].sha256=$originalHash
    Reject 'unrecorded required worker' { $null=Assert-NativeRepositoryIdentity $repo $identity @('other.ps1') }
    $tableDirectory=Join-Path $suiteRoot 'table-colors';[void](New-Item -ItemType Directory -Path $tableDirectory)
    $tableInput=Join-Path $tableDirectory 'table-colors.pptx';[IO.File]::WriteAllBytes($tableInput,[byte[]](1,2,3))
    $tableHash=(Get-FileHash -LiteralPath $tableInput -Algorithm SHA256).Hash.ToLowerInvariant()
    $expected=@();for($index=0;$index -lt 6;$index++) { $expected+=@([ordered]@{cells=@([ordered]@{row=1;column=1},[ordered]@{row=1;column=2},[ordered]@{row=2;column=1},[ordered]@{row=2;column=2})}) }
    $generationPath=Join-Path $tableDirectory 'generation.json';[ordered]@{pptxSha256=$tableHash;expected=$expected} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $generationPath -Encoding UTF8
    function TableManifest {
        $m=Manifest;$m.cases[0].id='feature-table'
        $inputRecord=Record $tableInput;$inputRecord.path='table-colors/table-colors.pptx'
        $generationRecord=Record $generationPath;$generationRecord.path='table-colors/generation.json'
        $m.files+=@($inputRecord,$generationRecord)
        $m.cases+=@([ordered]@{id='table-colors';worker='table-colors';dedicatedWorker='native-table-colors.ps1';automaticControlEligible=$false;slideCount=6;input='table-colors/table-colors.pptx';archiveSha256=$tableHash})
        return $m
    }
    Save (TableManifest);$null=Read-TableNativeBinding $suiteRoot;$passed++
    foreach($change in @('missing','worker','eligible','slideCount','archive')) {
        $m=TableManifest
        switch($change) { missing {$m.cases=@($m.cases[0])} worker {$m.cases[1].worker='furniture'} eligible {$m.cases[1].automaticControlEligible=$true} slideCount {$m.cases[1].slideCount=7} archive {$m.cases[1].archiveSha256='0'*64} }
        Save $m;Reject "dedicated table $change" { $null=Read-TableNativeBinding $suiteRoot }
    }
    Save (TableManifest);Remove-Item -LiteralPath $generationPath
    Reject 'missing dedicated generation input' { $null=Read-TableNativeBinding $suiteRoot }
    Write-Output ("PASS: $passed pure preflight controls; no worker, Office or native observation executed.")
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
