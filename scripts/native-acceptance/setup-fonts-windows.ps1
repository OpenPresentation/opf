param(
    [ValidateSet('Setup','Check','Cleanup')][string]$Action='Check',
    [string]$SuiteDirectory,
    [Parameter(Mandatory=$true)][string]$StateDirectory
)
$ErrorActionPreference='Stop'
$script:toolPath=$MyInvocation.MyCommand.Path

# No Office, elevation, machine registry, or machine font-directory access.
function Plain-Path([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path)
    if($full.StartsWith('\\')) { throw 'UNC paths are forbidden' }
    for($cursor=$full; $cursor; $cursor=Split-Path -Parent $cursor) {
        $item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Reparse points are forbidden: $cursor" }
    }
    return $full
}
function Hash-File([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Suite-File([string]$Root,[string]$Relative,[string]$Hash) {
    if($Relative -cnotmatch '^fonts/roboto/[A-Za-z0-9_./-]+$' -or @($Relative.Split('/') | Where-Object { $_ -in @('','.','..') }).Count -ne 0 -or $Hash -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid suite font record' }
    $full=Plain-Path (Join-Path $Root $Relative)
    if((Get-Item -LiteralPath $full).PSIsContainer -or (Hash-File $full) -cne $Hash) { throw "Font/license hash differs: $Relative" }
    return $full
}
function Read-FontInputs([string]$Root) {
    $rootPath=Plain-Path $Root
    $suite=Get-Content -LiteralPath (Plain-Path (Join-Path $rootPath 'suite.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
    $inventory=$suite.fontInventory
    if($suite.schemaVersion -ne 1 -or $inventory.name -cne '@expo-google-fonts/roboto' -or $inventory.license -cne 'OFL-1.1' -or $inventory.actualLicenseVerified -ne $true -or $inventory.actualFaceHashesVerified -ne $true -or $inventory.transferredFaces -isnot [array] -or $inventory.transferredFaces.Count -ne 7) { throw 'Expected the verified seven-face Roboto suite inventory' }
    $license=Suite-File $rootPath $inventory.transferredLicense.file $inventory.transferredLicense.sha256
    if(@($suite.files | Where-Object { $_.path -ceq $inventory.transferredLicense.file -and $_.sha256 -ceq $inventory.transferredLicense.sha256 -and $_.bytes -eq (Get-Item -LiteralPath $license).Length }).Count -ne 1) { throw 'License differs from sealed suite files' }
    if((Get-Content -LiteralPath $license -Raw) -notmatch 'SIL OPEN FONT LICENSE') { throw 'Missing OFL notice' }
    $seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $result=@()
    foreach($face in $inventory.transferredFaces) {
        if($face.family -cne 'Roboto' -or $face.file -cnotmatch '\.ttf$' -or -not $seen.Add($face.sha256)) { throw 'Invalid or duplicate Roboto face' }
        $source=Suite-File $rootPath $face.file $face.sha256
        $record=@($suite.files | Where-Object { $_.path -ceq $face.file -and $_.sha256 -ceq $face.sha256 -and $_.bytes -eq (Get-Item -LiteralPath $source).Length })
        if($record.Count -ne 1) { throw 'Font inventory differs from sealed suite files' }
        $result+=@{source=$source;sha256=$face.sha256}
    }
    return $result
}
function Initialize-FontApi {
    Add-Type -AssemblyName System.Drawing
    if(-not ('OpfNativeFontApi' -as [type])) {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OpfNativeFontApi {
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] public static extern int AddFontResourceEx(string path, uint flags, IntPtr reserved);
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] public static extern bool RemoveFontResourceEx(string path, uint flags, IntPtr reserved);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, IntPtr wparam, IntPtr lparam, uint flags, uint timeout, out IntPtr result);
 public static void Notify() { IntPtr result; SendMessageTimeout(new IntPtr(0xffff),0x001d,IntPtr.Zero,IntPtr.Zero,2,1000,out result); }
}
'@
    }
}
function Font-Names([string[]]$Files) {
    $collection=New-Object Drawing.Text.PrivateFontCollection
    try {
        foreach($file in $Files) { $collection.AddFontFile($file) }
        $names=@($collection.Families | ForEach-Object { $_.Name })
        if($names.Count -eq 0 -or @($names | Where-Object { $_ -notmatch '^Roboto($| )' }).Count -gt 0) { throw 'Font bytes do not contain Roboto faces' }
        return $names
    } finally { $collection.Dispose() }
}
function Installed-Names {
    $collection=New-Object Drawing.Text.InstalledFontCollection
    try { return @($collection.Families | ForEach-Object { $_.Name }) } finally { $collection.Dispose() }
}
$registryPath='Software\Microsoft\Windows NT\CurrentVersion\Fonts'
function Open-FontKey { return [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registryPath,$true) }
function Remove-EmptyFontKey { [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($registryPath,$false) }
function Save-State($State) {
    # Write-ahead journal: a crash leaves recoverable intent, never unrecorded files.
    $temp=Join-Path $statePath 'state.next.json'
    $State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temp -Encoding UTF8
    $target=Join-Path $statePath 'state.json'
    if(Test-Path -LiteralPath $target) { [IO.File]::Replace($temp,$target,$null) } else { [IO.File]::Move($temp,$target) }
}
function Read-State {
    $state=Get-Content -LiteralPath (Plain-Path (Join-Path $statePath 'state.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
    if($state.schemaVersion -ne 1 -or $state.id -cnotmatch '^[a-f0-9]{32}$' -or $state.entries -isnot [array] -or $state.entries.Count -gt 7 -or $state.createdRegistryKey -isnot [bool] -or $state.suiteSha256 -cnotmatch '^[a-f0-9]{64}$' -or $state.toolSha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid ownership journal' }
    $seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach($entry in $state.entries) {
        if($entry.sha256 -cnotmatch '^[a-f0-9]{64}$' -or -not $seen.Add($entry.sha256) -or $entry.file -cne "$($entry.sha256).ttf" -or $entry.value -cne "OPF Native $($state.id) $($entry.sha256) (TrueType)") { throw 'Invalid ownership journal entry' }
    }
    return $state
}
function Assert-Owned($State,[bool]$RequireComplete) {
    $key=Open-FontKey
    try {
        foreach($entry in $State.entries) {
            $file=Plain-Path (Join-Path $statePath $entry.file)
            if(Test-Path -LiteralPath $file) { if((Hash-File $file) -cne $entry.sha256) { throw 'Owned font changed; cleanup refused' } } elseif($RequireComplete) { throw 'Owned font is missing' }
            $value=if($null -ne $key) { $key.GetValue($entry.value,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) } else { $null }
            if($null -ne $value -and ($value -cne $file -or $key.GetValueKind($entry.value) -ne [Microsoft.Win32.RegistryValueKind]::String)) { throw 'Owned registry value changed; cleanup refused' }
            if($RequireComplete -and $null -eq $value) { throw 'Font registration is missing' }
        }
    } finally { if($null -ne $key) { $key.Dispose() } }
}
function Cleanup-Owned($State) {
    Assert-Owned $State $false
    $key=Open-FontKey
    try {
        foreach($entry in $State.entries) {
            $file=Plain-Path (Join-Path $statePath $entry.file)
            if($null -ne $key) { $key.DeleteValue($entry.value,$false) }
            if(Test-Path -LiteralPath $file) {
                [void][OpfNativeFontApi]::RemoveFontResourceEx($file,0,[IntPtr]::Zero)
                Remove-Item -LiteralPath $file
            }
        }
    } finally { if($null -ne $key) { $key.Dispose() }; [OpfNativeFontApi]::Notify() }
    if($State.createdRegistryKey) {
        $remaining=Open-FontKey
        $empty=$false
        if($null -ne $remaining) {
            try { $empty=($remaining.ValueCount -eq 0 -and $remaining.SubKeyCount -eq 0) } finally { $remaining.Dispose() }
        }
        if($empty) { Remove-EmptyFontKey }
    }
    # Preserve the receipt and any unrelated files; do not recursively delete.
    $State.status='cleaned'; Save-State $State
}
function Invoke-FontSetup {
    if($env:OS -ne 'Windows_NT') { throw 'This tool requires Windows' }
    $script:statePath=Plain-Path $StateDirectory
    $userRoot=Plain-Path ([Environment]::GetFolderPath('LocalApplicationData'))
    if(-not $statePath.StartsWith($userRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'StateDirectory must be a new private directory under this user LocalApplicationData' }
    Initialize-FontApi
    if($Action -eq 'Cleanup') { Cleanup-Owned (Read-State); Write-Output 'PASS: owned font changes cleaned; receipt retained'; return }
    if($Action -eq 'Check') {
        $state=Read-State
        if($state.status -cne 'ready' -or $state.entries.Count -ne 7) { throw 'Font setup is incomplete or cleaned' }
        if($state.toolSha256 -cne (Hash-File $script:toolPath)) { throw 'Setup tool identity differs from receipt' }
        Assert-Owned $state $true
        $files=@($state.entries | ForEach-Object { Join-Path $statePath $_.file })
        $installed=Installed-Names
        foreach($name in (Font-Names $files)) { if($name -cnotin $installed) { throw "Font family is not available through GDI+: $name" } }
        if($SuiteDirectory) {
            if($state.suiteSha256 -cne (Hash-File (Plain-Path (Join-Path $SuiteDirectory 'suite.json')))) { throw 'Suite manifest differs from receipt' }
            $inputs=@(Read-FontInputs $SuiteDirectory)
            if((@($inputs.sha256 | Sort-Object) -join ',') -cne (@($state.entries.sha256 | Sort-Object) -join ',')) { throw 'Installed font receipt differs from suite' }
        }
        Write-Output 'PASS: seven exact font files, user registry entries and available families verified'; return
    }
    if(-not $SuiteDirectory) { throw 'Setup requires SuiteDirectory' }
    if(Test-Path -LiteralPath $statePath) { throw 'Setup requires a new StateDirectory; use Check or Cleanup on an existing receipt' }
    $inputs=@(Read-FontInputs $SuiteDirectory)
    [void](Font-Names @($inputs.source))
    if(@(Installed-Names | Where-Object { $_ -match '^Roboto($| )' }).Count -gt 0) { throw 'Roboto already exists on this host; preserve it and resolve font identity before setup' }
    $existing=Open-FontKey
    $createdRegistryKey=($null -eq $existing)
    if($null -ne $existing) { $existing.Dispose() }
    [void][IO.Directory]::CreateDirectory($statePath)
    $state=[ordered]@{schemaVersion=1;id=[Guid]::NewGuid().ToString('N');status='preparing';createdRegistryKey=$createdRegistryKey;suiteSha256=(Hash-File (Join-Path (Plain-Path $SuiteDirectory) 'suite.json'));toolSha256=(Hash-File $script:toolPath);entries=@()}
    Save-State $state
    try {
        if($createdRegistryKey) {
            $created=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($registryPath)
            $created.Dispose()
        }
        foreach($faceInput in $inputs) {
            $entry=@{sha256=$faceInput.sha256;file="$($faceInput.sha256).ttf";value="OPF Native $($state.id) $($faceInput.sha256) (TrueType)"}
            $file=Plain-Path (Join-Path $statePath $entry.file)
            $key=Open-FontKey
            try {
                if($null -ne $key.GetValue($entry.value) -or (Test-Path -LiteralPath $file)) { throw 'Refusing to overwrite a preexisting font file or registry value' }
                $state.entries+=,$entry; Save-State $state
                [IO.File]::Copy($faceInput.source,$file,$false)
                if((Hash-File $file) -cne $entry.sha256) { throw 'Copied font hash differs' }
                $key.SetValue($entry.value,$file,[Microsoft.Win32.RegistryValueKind]::String)
                if([OpfNativeFontApi]::AddFontResourceEx($file,0,[IntPtr]::Zero) -le 0) { throw 'GDI refused font registration' }
            } finally { $key.Dispose() }
        }
        [OpfNativeFontApi]::Notify()
        Assert-Owned $state $true
        $installed=Installed-Names
        foreach($name in (Font-Names @($inputs.source))) { if($name -cnotin $installed) { throw "Registered family unavailable: $name" } }
        $state.status='ready'; Save-State $state
        Write-Output 'PASS: seven suite-pinned Roboto faces registered for the current user'
    } catch {
        $failure=$_
        try { Cleanup-Owned $state } catch { Write-Warning "Rollback stopped to preserve changed state: $_" }
        throw $failure
    }
}
if($MyInvocation.InvocationName -ne '.') {
    # Serialize this user's tools across all attempt directories. Never wait/retry.
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $mutex=New-Object Threading.Mutex($false,"Local\OPFNativeFonts-$sid")
    $locked=$false
    try {
        try { $locked=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked=$true }
        if(-not $locked) { throw 'Another font setup/check/cleanup is active for this user' }
        Invoke-FontSetup
    } finally { if($locked) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
}
