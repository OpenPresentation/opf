param([string]$ScriptPath=(Join-Path $PSScriptRoot 'run-b07-current-profile.ps1'))
$ErrorActionPreference='Stop'
# AST only: no launcher entrypoint, process query or Office definition is evaluated.
$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($ScriptPath,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw ($errors | Out-String) }
foreach($name in @('Assert-B07BootstrapPath','Assert-B07BootstrapFile','Read-B07BootstrapEnvelope','Assert-B07BootstrapController','Get-B07WorkerArguments','Copy-B07Exclusive')) {
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
