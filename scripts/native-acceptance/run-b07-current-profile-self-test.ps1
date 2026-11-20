param([string]$ScriptPath=(Join-Path $PSScriptRoot 'run-b07-current-profile.ps1'))
$ErrorActionPreference='Stop'
# AST only: no launcher entrypoint, process query or Office definition is evaluated.
$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($ScriptPath,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw ($errors | Out-String) }
foreach($name in @('Assert-B07BootstrapPath','Assert-B07BootstrapFile','Read-B07BootstrapEnvelope','Assert-B07BootstrapController','Get-B07WorkerArguments','Copy-B07Exclusive','Get-B07SnapshotCopies')) {
    $found=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
    if($found.Count -ne 1) { throw 'Missing/duplicate B07 managed definition' }
    Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
}
$passed=0
function Reject-B07([scriptblock]$Action) { $caught=$false;try { & $Action | Out-Null } catch { $caught=$true };if(-not $caught) { throw 'B07 managed negative unexpectedly passed' };$script:passed++ }
$arguments=Get-B07WorkerArguments 'C:\unit\case.pptx' 'C:\unit\actions.json' 'C:\unit\probe.json' 'C:\unit\native' 45
$expected=@('-InputPresentation','C:\unit\case.pptx','-ActionPlan','C:\unit\actions.json','-OutputDirectory','C:\unit\native','-TimeoutSeconds','45','-CaptureTextFonts','-TextProbePlan','C:\unit\probe.json')
if(($arguments | ConvertTo-Json -Compress) -cne ($expected | ConvertTo-Json -Compress) -or $arguments -contains '-Worker' -or $arguments -contains '-ReadOnlySurvey') { throw 'B07 must dispatch exactly the ordinary furniture supervisor' };$passed++
Reject-B07 { Assert-B07BootstrapPath 'relative\file.json' }
Reject-B07 { Assert-B07BootstrapPath '\\server\share\file.json' }
Reject-B07 { Assert-B07BootstrapPath ("C:\unit\bad"+[char]0+".json") }
Reject-B07 { Assert-B07BootstrapController 'C:\unit' ([pscustomobject]@{directory='C:\unit';dirty=$true;revision=('a'*40)}) }
$root=Join-Path ([IO.Path]::GetTempPath()) ('opf-b07-profile-'+[guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $root)
try {
    $file=Join-Path $root 'envelope.json';$copy=Join-Path $root 'copy.json'
    $profile=[ordered]@{schemaVersion=1;profile='b07-current-one-case-readonly-v1';nativeAcceptance=$false;registryAcceptance=$false}
    $profile | ConvertTo-Json | Set-Content -LiteralPath $file -Encoding UTF8
    $sha=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    $read=Read-B07BootstrapEnvelope $file $sha;if($read.profile -cne $profile.profile) { throw 'B07 managed envelope changed' };$passed++
    Reject-B07 { Read-B07BootstrapEnvelope $file ('0'*64) }
    $identity=[pscustomobject]@{bytes=(Get-Item -LiteralPath $file).Length;sha256=$sha}
    Assert-B07BootstrapFile $file $identity;$passed++
    $copied=Copy-B07Exclusive $file $copy
    if($copied.sha256 -cne $sha -or $copied.bytes -ne $identity.bytes) { throw 'B07 snapshot bytes differ' };$passed++
    Reject-B07 { Copy-B07Exclusive $file $copy }
    # Exercise the launcher's real pair builder and real exclusive copier with an envelope and two distinct file payloads.
    $sourceRoot=Join-Path $root 'source payloads';$targetRoot=Join-Path $root 'snapshot copies'
    [void](New-Item -ItemType Directory -Path $sourceRoot);[void](New-Item -ItemType Directory -Path (Join-Path $sourceRoot 'nested'))
    [void](New-Item -ItemType Directory -Path $targetRoot);[void](New-Item -ItemType Directory -Path (Join-Path $targetRoot 'nested'))
    [IO.File]::WriteAllBytes((Join-Path $sourceRoot 'one.bin'),[byte[]]@(0,1,127,128,255))
    [IO.File]::WriteAllBytes((Join-Path $sourceRoot 'nested/two.bin'),[Text.Encoding]::UTF8.GetBytes('second actual payload'))
    $snapshotProfile=[pscustomobject]@{output=$sourceRoot;snapshots=@([pscustomobject]@{path='one.bin'},[pscustomobject]@{path='nested/two.bin'})}
    $pairs=Get-B07SnapshotCopies $file $snapshotProfile
    if($pairs -isnot [array] -or $pairs.Count -ne 3) { throw 'B07 snapshot builder must return three intact source/destination pairs' };$passed++
    $expectedSources=@($file,(Join-Path $sourceRoot 'one.bin'),(Join-Path $sourceRoot 'nested/two.bin'))
    $expectedTargets=@('execution-envelope.json','one.bin','nested/two.bin')
    for($index=0;$index -lt $pairs.Count;$index++) {
        $pair=$pairs[$index]
        if($pair -isnot [array] -or $pair.Count -ne 2 -or -not [string]::Equals($pair[0],$expectedSources[$index],[StringComparison]::Ordinal) -or -not [string]::Equals($pair[1],$expectedTargets[$index],[StringComparison]::Ordinal)) { throw 'B07 snapshot pair lost its full literal paths or order' };$passed++
        $sourceBytes=(Get-Item -LiteralPath $pair[0]).Length;$sourceHash=(Get-FileHash -LiteralPath $pair[0] -Algorithm SHA256).Hash.ToLowerInvariant()
        $destination=Join-Path $targetRoot $pair[1];$actual=Copy-B07Exclusive $pair[0] $destination
        if($actual.bytes -ne $sourceBytes -or $actual.sha256 -cne $sourceHash -or (Get-Item -LiteralPath $destination).Length -ne $sourceBytes -or (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -cne $sourceHash) { throw 'B07 actual snapshot payload bytes/hash differ' };$passed++
        Reject-B07 { Copy-B07Exclusive $pair[0] $destination }
        if((Get-Item -LiteralPath $destination).Length -ne $sourceBytes -or (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -cne $sourceHash -or (Get-FileHash -LiteralPath $pair[0] -Algorithm SHA256).Hash.ToLowerInvariant() -cne $sourceHash) { throw 'B07 overwrite refusal changed a source or existing destination' };$passed++
    }
    Add-Content -LiteralPath $file 'changed' -Encoding UTF8
    Reject-B07 { Assert-B07BootstrapFile $file $identity }
    $profile.nativeAcceptance=$true;$profile | ConvertTo-Json | Set-Content -LiteralPath $file -Encoding UTF8
    $changed=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    Reject-B07 { Read-B07BootstrapEnvelope $file $changed }
} finally {
    if((Split-Path -Leaf $root) -cnotmatch '^opf-b07-profile-[a-f0-9]{32}$') { throw 'B07 managed owned temporary root differs' }
    Remove-Item -LiteralPath $root -Recurse -Force
}
[ordered]@{schemaVersion=1;passed=$passed;scope='Managed bootstrap/dispatch only; no Office, deck generation or native acceptance';nativeAcceptance=$false} | ConvertTo-Json -Compress
