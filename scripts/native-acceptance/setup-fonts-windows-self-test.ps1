param([Parameter(Mandatory=$true)][string]$ToolPath)
$ErrorActionPreference='Stop'
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('opf-font-controls-'+[Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($scratch)
. $ToolPath -StateDirectory $scratch
function Assert-True([bool]$Value,[string]$Message) { if(-not $Value) { throw $Message } }
function Must-Refuse([scriptblock]$Operation,[string]$Message) {
    $refused=$false
    try { & $Operation | Out-Null } catch { $refused=$true }
    Assert-True $refused $Message
}
# Exercise the actual bounded child launcher without registering any font.
$freshNames=@(Fresh-InstalledNames)
Assert-True ($freshNames.Count -gt 0 -and $freshNames.Count -le 10000) 'Fresh child must enumerate installed families'
Add-Type @'
using System;
using System.Collections.Generic;
using Microsoft.Win32;
public class OpfFontMockKey {
 public Dictionary<string,object> Values = new Dictionary<string,object>();
 public object GetValue(string name) { return Values.ContainsKey(name) ? Values[name] : null; }
 public object GetValue(string name, object fallback, RegistryValueOptions options) { return GetValue(name); }
 public RegistryValueKind GetValueKind(string name) { return RegistryValueKind.String; }
 public void DeleteValue(string name, bool fail) { Values.Remove(name); }
 public int ValueCount { get { return Values.Count; } }
 public int SubKeyCount { get { return 0; } }
 public void Dispose() { }
}
public static class OpfNativeFontApi {
 public static int Removals;
 public static bool RemoveFontResourceEx(string path, uint flags, IntPtr reserved) { Removals++; return true; }
 public static void Notify() { }
}
'@
$script:mockKey=New-Object OpfFontMockKey
function Open-FontKey { return $script:mockKey }
$script:keyRemovals=0
function Remove-EmptyFontKey { $script:keyRemovals++ }
try {
    $fontDir=Join-Path $scratch 'fonts/roboto'
    [void][IO.Directory]::CreateDirectory($fontDir)
    $styles=@(
        @{file='400Regular/Roboto_400Regular.ttf';family='Roboto';weight=400;italic=$false},
        @{file='500Medium/Roboto_500Medium.ttf';family='Roboto Medium';weight=500;italic=$false},
        @{file='600SemiBold/Roboto_600SemiBold.ttf';family='Roboto SemiBold';weight=600;italic=$false},
        @{file='700Bold/Roboto_700Bold.ttf';family='Roboto';weight=700;italic=$false},
        @{file='800ExtraBold/Roboto_800ExtraBold.ttf';family='Roboto ExtraBold';weight=800;italic=$false},
        @{file='400Regular_Italic/Roboto_400Regular_Italic.ttf';family='Roboto';weight=400;italic=$true},
        @{file='700Bold_Italic/Roboto_700Bold_Italic.ttf';family='Roboto';weight=700;italic=$true}
    )
    $faces=@();$files=@();$pins=@()
    for($i=0;$i -lt 7;$i++) {
        $style=$styles[$i]
        $relative="fonts/roboto/$($style.file)"; $file=Join-Path $scratch $relative
        [void][IO.Directory]::CreateDirectory((Split-Path -Parent $file))
        [IO.File]::WriteAllBytes($file,[Text.Encoding]::UTF8.GetBytes("synthetic-$i"))
        $faces+=@{file=$relative;family=$style.family;weight=$style.weight;italic=$style.italic;sha256=(Hash-File $file)}
        $pins+=@{file=$style.file;family=$style.family;weight=$style.weight;italic=$style.italic;sha256=(Hash-File $file)}
        $files+=@{path=$relative;sha256=(Hash-File $file);bytes=(Get-Item -LiteralPath $file).Length}
    }
    $license=Join-Path $fontDir 'LICENSE'
    [IO.File]::WriteAllText($license,'SIL OPEN FONT LICENSE')
    $files+=@{path='fonts/roboto/LICENSE';sha256=(Hash-File $license);bytes=(Get-Item -LiteralPath $license).Length}
    $inventory=@{name='@expo-google-fonts/roboto';license='OFL-1.1';licenseSha256=(Hash-File $license);faces=$pins;actualLicenseVerified=$true;actualFaceHashesVerified=$true;transferredFaces=$faces;transferredLicense=@{file='fonts/roboto/LICENSE';sha256=(Hash-File $license)}}
    $suite=@{schemaVersion=1;fontInventory=$inventory;files=$files}
    $suitePath=Join-Path $scratch 'suite.json'
    $suite | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $suitePath -Encoding UTF8
    Assert-True (@(Read-FontInputs $scratch).Count -eq 7) 'Seven sealed faces should validate'
    foreach($field in @('family','weight','italic','file','sha256')) {
        $original=$faces[1][$field]
        $faces[1][$field]=switch($field) {
            'family' { 'Roboto' }; 'weight' { 400 }; 'italic' { $true }
            'file' { $faces[0].file }; 'sha256' { $faces[0].sha256 }
        }
        $suite | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $suitePath -Encoding UTF8
        Must-Refuse { Read-FontInputs $scratch } "Transferred $field mismatch must be refused"
        $faces[1][$field]=$original
    }
    $pins[1].family='Roboto Unexpected';$faces[1].family='Roboto Unexpected'
    $suite | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $suitePath -Encoding UTF8
    Must-Refuse { Read-FontInputs $scratch } 'Unrecognized source and transfer family must be refused'
    $pins[1].family='Roboto Medium';$faces[1].family='Roboto Medium'
    $suite | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $suitePath -Encoding UTF8
    [IO.File]::WriteAllText((Join-Path $scratch $faces[0].file),'tampered')
    Must-Refuse { Read-FontInputs $scratch } 'Changed font must be refused'
    Must-Refuse { Suite-File $scratch 'fonts/roboto/../suite.json' $faces[0].sha256 } 'Traversal must be refused'
    Must-Refuse { Suite-File $scratch 'fonts/roboto/C:/font.ttf' $faces[0].sha256 } 'Drive path must be refused'
    $script:statePath=Join-Path $scratch 'owned';[void][IO.Directory]::CreateDirectory($statePath)
    $source=Join-Path $scratch $faces[1].file
    $entry=@{sha256=(Hash-File $source);file="$(Hash-File $source).ttf";value="OPF Native $('a'*32) $(Hash-File $source) (TrueType)"}
    $state=[ordered]@{schemaVersion=1;id=('a'*32);status='preparing';createdRegistryKey=$false;suiteSha256=('b'*64);toolSha256=('c'*64);entries=@($entry)}
    $owned=Join-Path $statePath $entry.file
    [IO.File]::Copy($source,$owned)
    $script:mockKey.Values[$entry.value]=$owned
    $script:mockKey.Values['unrelated']='preserve'
    $unrelated=Join-Path $statePath 'unrelated.txt';[IO.File]::WriteAllText($unrelated,'preserve')
    Save-State $state
    Assert-Owned (Read-State) $true
    $script:mockKey.Values[$entry.value]='changed'
    Must-Refuse { Cleanup-Owned (Read-State) } 'Changed registration must stop cleanup before removal'
    Assert-True (Test-Path -LiteralPath $owned) 'Refused cleanup must retain font'
    Assert-True ([OpfNativeFontApi]::Removals -eq 0) 'Refused cleanup must not unregister'
    $script:mockKey.Values[$entry.value]=$owned
    [IO.File]::WriteAllText($owned,'changed')
    Must-Refuse { Cleanup-Owned (Read-State) } 'Changed owned font must stop cleanup'
    [IO.File]::Delete($owned);[IO.File]::Copy($source,$owned)
    Cleanup-Owned (Read-State)
    Assert-True (-not (Test-Path -LiteralPath $owned)) 'Owned font should be removed'
    Assert-True ($null -eq $script:mockKey.GetValue($entry.value)) 'Owned registry value should be removed'
    Assert-True ($script:mockKey.GetValue('unrelated') -ceq 'preserve') 'Unrelated registry state must survive'
    Assert-True ((Get-Content -LiteralPath $unrelated -Raw) -ceq 'preserve') 'Unrelated file must survive'
    Assert-True ((Read-State).status -ceq 'cleaned') 'Cleanup must retain journal'
    Cleanup-Owned (Read-State)
    Assert-True ([OpfNativeFontApi]::Removals -eq 1) 'Repeated cleanup must not unregister twice'
    Assert-True ($script:keyRemovals -eq 0) 'Preexisting shared key must survive cleanup'
    $state.entries=@();$state.createdRegistryKey=$true;Save-State $state
    Cleanup-Owned (Read-State)
    Assert-True ($script:keyRemovals -eq 0) 'Created shared key with unrelated values must survive'
    $script:mockKey.Values.Clear()
    Cleanup-Owned (Read-State)
    Assert-True ($script:keyRemovals -eq 1) 'Only a created empty shared key can be removed'
    $state.entries=@($entry)
    $state.entries[0].file='../unrelated.txt';Save-State $state
    Must-Refuse { Read-State } 'Forged journal path must be refused'
    Write-Output 'PASS: font input and owned-cleanup controls; no real registration, registry writes or Office executed.'
} finally { Remove-Item -LiteralPath $scratch -Recurse -Force }
