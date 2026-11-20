param([Parameter(Mandatory=$true)][string]$ToolPath,[Parameter(Mandatory=$true)][string]$SuiteDirectory)
$ErrorActionPreference='Stop'
$inputSuite=[IO.Path]::GetFullPath($SuiteDirectory)
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('opf-mono-controls-'+[Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($scratch)
. $ToolPath -StateDirectory $scratch
function Assert-True([bool]$Value,[string]$Message) { if(-not $Value) { throw $Message } }
function Must-Refuse([scriptblock]$Operation,[string]$Message) {
    $refused=$false
    try { & $Operation | Out-Null } catch { $refused=$true }
    Assert-True $refused $Message
}
# All mutation APIs below are in-memory mocks, not P/Invoke or registry objects.
Add-Type @'
using System;
using System.Collections.Generic;
using Microsoft.Win32;
public class OpfMonoMockKey {
 public Dictionary<string,object> Values = new Dictionary<string,object>();
 public object GetValue(string name) { return Values.ContainsKey(name) ? Values[name] : null; }
 public object GetValue(string name, object fallback, RegistryValueOptions options) { return GetValue(name); }
 public RegistryValueKind GetValueKind(string name) { return RegistryValueKind.String; }
 public void SetValue(string name, object value, RegistryValueKind kind) { Values[name]=value; }
 public void DeleteValue(string name, bool fail) { Values.Remove(name); }
 public int ValueCount { get { return Values.Count; } }
 public int SubKeyCount { get { return 0; } }
 public void Dispose() { }
}
public static class OpfNativeMonoFontApi {
 public static int Additions;
 public static int Removals;
 public static int AddFontResourceEx(string path, uint flags, IntPtr reserved) { Additions++; return 1; }
 public static bool RemoveFontResourceEx(string path, uint flags, IntPtr reserved) { Removals++; return true; }
 public static void Notify() { }
}
'@
$script:mockKey=New-Object OpfMonoMockKey
$script:keyRemovals=0
$script:foreignMono=$false
function Initialize-FontApi { }
function Open-FontKey { return $script:mockKey }
function Remove-EmptyFontKey { $script:keyRemovals++ }
function User-Root { return $scratch }
function Font-Names([string[]]$Files) { Assert-True ($Files.Count -eq 2) 'Only two faces are allowed'; return @('Roboto Mono') }
function Fresh-InstalledNames {
    $names=@('Roboto','Roboto Medium','Roboto SemiBold','Roboto ExtraBold','Unrelated Family')
    if($script:foreignMono -or [OpfNativeMonoFontApi]::Additions -gt [OpfNativeMonoFontApi]::Removals) { $names+='Roboto Mono' }
    return $names
}
try {
    $SuiteDirectory=Join-Path $scratch 'input'
    Copy-Item -LiteralPath $inputSuite -Destination $SuiteDirectory -Recurse
    $suitePath=Join-Path $SuiteDirectory 'suite.json'
    $original=[IO.File]::ReadAllBytes($suitePath)
    function Restore-Suite { [IO.File]::WriteAllBytes($suitePath,$original) }
    function Test-Tamper([scriptblock]$Change,[string]$Message) {
        $value=[Text.Encoding]::UTF8.GetString($original) | ConvertFrom-Json
        & $Change $value
        $value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $suitePath -Encoding UTF8
        Must-Refuse { Read-FontInputs $SuiteDirectory } $Message
        Restore-Suite
    }
    Assert-True (@(Read-FontInputs $SuiteDirectory).Count -eq 2) 'Exact pinned two-face suite must validate'
    Test-Tamper { param($v) $v.profileId='arbitrary-font-profile' } 'Wrong profile must be refused'
    Test-Tamper { param($v) $v.setupToolSha256='a'*64 } 'Wrong setup tool must be refused'
    Test-Tamper { param($v) $v.probeToolSha256='a'*64 } 'Wrong probe tool must be refused'
    Test-Tamper { param($v) $v.fontInventory.name='@expo-google-fonts/roboto' } 'Wrong package must be refused'
    Test-Tamper { param($v) $v.fontInventory.version='0.4.3' } 'Wrong package version must be refused'
    Test-Tamper { param($v) $v.fontInventory.license='MIT' } 'Wrong license must be refused'
    Test-Tamper { param($v) $v.fontInventory.licenseSha256='a'*64 } 'Wrong license hash must be refused'
    Test-Tamper { param($v) $v.fontInventory.faces[0].family='Roboto';$v.fontInventory.transferredFaces[0].family='Roboto' } 'Wrong family on both records must be refused'
    Test-Tamper { param($v) $v.fontInventory.faces[0].weight=500;$v.fontInventory.transferredFaces[0].weight=500 } 'Wrong weight on both records must be refused'
    Test-Tamper { param($v) $v.fontInventory.faces[0].italic=$true;$v.fontInventory.transferredFaces[0].italic=$true } 'Wrong style on both records must be refused'
    Test-Tamper { param($v) $v.fontInventory.faces[0].sha256='a'*64;$v.fontInventory.transferredFaces[0].sha256='a'*64 } 'Wrong face hash must be refused'
    Test-Tamper { param($v) $v.fontInventory.transferredFaces[0].file='fonts/roboto-mono/../suite.json' } 'Traversal must be refused'
    Test-Tamper { param($v) $v.fontInventory.transferredFaces[1]=$v.fontInventory.transferredFaces[0] } 'Duplicate face must be refused'
    $suite=Get-Content -LiteralPath $suitePath -Raw | ConvertFrom-Json
    foreach($relative in @($suite.fontInventory.transferredFaces[0].file,$suite.fontInventory.transferredLicense.file)) {
        $file=Join-Path $SuiteDirectory $relative;$bytes=[IO.File]::ReadAllBytes($file)
        [IO.File]::WriteAllText($file,'tampered')
        Must-Refuse { Read-FontInputs $SuiteDirectory } 'Changed font/license bytes must be refused'
        [IO.File]::WriteAllBytes($file,$bytes)
    }
    Must-Refuse { Suite-File $SuiteDirectory 'fonts/roboto-mono/../suite.json' ('a'*64) } 'Direct traversal must be refused'
    Must-Refuse { Assert-NoMonoIdentity @('Roboto','Roboto Mono') } 'Preinstalled Mono must be preserved'
    Must-Refuse { Assert-NoMonoIdentity @('roboto mono Bold') } 'Case/style Mono identity must be preserved'
    Assert-NoMonoIdentity @('Roboto','Roboto Medium','Roboto Slab','Unrelated Family')
    $oldRoboto=Join-Path $scratch 'existing-roboto.ttf';[IO.File]::WriteAllText($oldRoboto,'preserve Roboto')
    $script:mockKey.Values['OPF Native preexisting Roboto']=$oldRoboto
    $script:mockKey.Values['unrelated']='preserve'
    $StateDirectory=Join-Path $scratch 'owned-mono';$Action='Setup'
    Invoke-FontSetup
    $state=Read-State
    Assert-True ($state.status -ceq 'ready' -and $state.entries.Count -eq 2 -and [OpfNativeMonoFontApi]::Additions -eq 2) 'Two owned Mono faces must be journaled'
    $Action='Check';Invoke-FontSetup
    $unrelated=Join-Path $statePath 'unrelated.txt';[IO.File]::WriteAllText($unrelated,'preserve')
    $journal=[IO.File]::ReadAllBytes((Join-Path $statePath 'state.json'))
    $state.toolSha256='a'*64;Save-State $state
    Must-Refuse { Cleanup-Owned (Read-State) } 'Changed setup tool identity must stop cleanup'
    [IO.File]::WriteAllBytes((Join-Path $statePath 'state.json'),$journal);$state=Read-State
    $entry=$state.entries[0];$owned=Join-Path $statePath $entry.file
    $script:mockKey.Values[$entry.value]='changed'
    Must-Refuse { Cleanup-Owned (Read-State) } 'Changed registration must stop cleanup'
    $script:mockKey.Values[$entry.value]=$owned
    $ownedBytes=[IO.File]::ReadAllBytes($owned);[IO.File]::WriteAllText($owned,'changed')
    Must-Refuse { Cleanup-Owned (Read-State) } 'Changed owned font must stop cleanup'
    [IO.File]::WriteAllBytes($owned,$ownedBytes)
    Assert-True ([OpfNativeMonoFontApi]::Removals -eq 0) 'Refusals must not remove any font'
    $state.profileId='other-profile';Save-State $state
    Must-Refuse { Read-State } 'Foreign profile journal must be refused'
    [IO.File]::WriteAllBytes((Join-Path $statePath 'state.json'),$journal)
    $Action='Cleanup';Invoke-FontSetup
    Assert-True ([OpfNativeMonoFontApi]::Removals -eq 2) 'Only two owned faces should be removed'
    foreach($item in $state.entries) {
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $statePath $item.file))) 'Owned font should be removed'
        Assert-True ($null -eq $script:mockKey.GetValue($item.value)) 'Owned registration should be removed'
    }
    Assert-True (([IO.File]::ReadAllText($oldRoboto)) -ceq 'preserve Roboto') 'Existing Roboto file must survive'
    Assert-True ($script:mockKey.GetValue('OPF Native preexisting Roboto') -ceq $oldRoboto) 'Existing Roboto registration must survive'
    Assert-True ($script:mockKey.GetValue('unrelated') -ceq 'preserve') 'Unrelated registration must survive'
    Assert-True (([IO.File]::ReadAllText($unrelated)) -ceq 'preserve') 'Unrelated file must survive'
    Assert-True ((Read-State).status -ceq 'cleaned') 'Cleanup journal must remain'
    Invoke-FontSetup
    Assert-True ([OpfNativeMonoFontApi]::Removals -eq 2 -and $script:keyRemovals -eq 0) 'Repeated cleanup must preserve existing shared key'
    $script:foreignMono=$true;$StateDirectory=Join-Path $scratch 'refuse-existing';$Action='Setup'
    Must-Refuse { Invoke-FontSetup } 'Setup must refuse an installed Mono identity'
    Assert-True (-not (Test-Path -LiteralPath $StateDirectory)) 'Refusal must precede state creation'
    Assert-True ([OpfNativeMonoFontApi]::Additions -eq 2) 'Refusal must not register anything'
    Write-Output 'PASS: bounded Mono profile and owned lifecycle controls; no real registration, registry writes or Office executed.'
} finally {
    $absolute=[IO.Path]::GetFullPath($scratch)
    $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if(-not $absolute.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $absolute) -cnotmatch '^opf-mono-controls-[a-f0-9]{32}$') { throw 'Scratch cleanup target refused' }
    Remove-Item -LiteralPath $absolute -Recurse -Force
}
