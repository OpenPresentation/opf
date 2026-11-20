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
    if($Relative -cnotmatch '^fonts/roboto-mono/[A-Za-z0-9_./-]+$' -or @($Relative.Split('/') | Where-Object { $_ -in @('','.','..') }).Count -ne 0 -or $Hash -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid suite font record' }
    $full=Plain-Path (Join-Path $Root $Relative)
    if((Get-Item -LiteralPath $full).PSIsContainer -or (Hash-File $full) -cne $Hash) { throw "Font/license hash differs: $Relative" }
    return $full
}
function Mono-Pins {
    return @(
        @{file='400Regular/RobotoMono_400Regular.ttf';family='Roboto Mono';weight=400;italic=$false;sha256='e4bf45837847d4abfa5a502b807a83393aa138727bdb9ea9c93fb17d53208d95'},
        @{file='700Bold/RobotoMono_700Bold.ttf';family='Roboto Mono';weight=700;italic=$false;sha256='92649d819cc4c20480b23a47aaa111769924eb31c66b6ecdcf6f573662558c83'}
    )
}
function Probe-Path { return Plain-Path (Join-Path (Split-Path -Parent $script:toolPath) 'probe-fonts-windows.ps1') }
function User-Root { return [Environment]::GetFolderPath('LocalApplicationData') }
function Assert-ToolIdentity($State) {
    if($State.toolSha256 -cne (Hash-File $script:toolPath) -or $State.probeSha256 -cne (Hash-File (Probe-Path))) { throw 'Exact setup/probe identity differs from ownership journal' }
}
function Read-FontInputs([string]$Root) {
    $rootPath=Plain-Path $Root
    $suite=Get-Content -LiteralPath (Plain-Path (Join-Path $rootPath 'suite.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
    $inventory=$suite.fontInventory
    $licenseHash='50ab8dd54680d3473f649c9db86fece88434d097c7834475c1c72d2f8c429215'
    if($suite.schemaVersion -ne 1 -or $suite.profileId -cne 'opf-native-roboto-mono-0.4.2-400-700-v1' -or $suite.setupToolSha256 -cne (Hash-File $script:toolPath) -or $suite.probeToolSha256 -cne (Hash-File (Probe-Path))) { throw 'Expected the exact bounded Mono profile and tools' }
    if($inventory.name -cne '@expo-google-fonts/roboto-mono' -or $inventory.version -cne '0.4.2' -or $inventory.license -cne 'OFL-1.1' -or $inventory.licenseFile -cne 'LICENSE_FONT' -or $inventory.licenseSha256 -cne $licenseHash -or $inventory.actualLicenseVerified -isnot [bool] -or $inventory.actualLicenseVerified -ne $true -or $inventory.actualFaceHashesVerified -isnot [bool] -or $inventory.actualFaceHashesVerified -ne $true -or $inventory.faces -isnot [array] -or $inventory.faces.Count -ne 2 -or $inventory.transferredFaces -isnot [array] -or $inventory.transferredFaces.Count -ne 2 -or $suite.files -isnot [array] -or $suite.files.Count -ne 3) { throw 'Expected the pinned two-face Mono inventory/license' }
    if($inventory.transferredLicense.file -cne 'fonts/roboto-mono/LICENSE' -or $inventory.transferredLicense.sha256 -cne $licenseHash) { throw 'Mono license differs from renderer pin' }
    $license=Suite-File $rootPath $inventory.transferredLicense.file $licenseHash
    if((Get-Content -LiteralPath $license -Raw -Encoding UTF8) -notmatch 'SIL OPEN FONT LICENSE' -or @($suite.files | Where-Object { $_.path -ceq 'fonts/roboto-mono/LICENSE' -and $_.sha256 -ceq $licenseHash -and $_.bytes -eq (Get-Item -LiteralPath $license).Length }).Count -ne 1) { throw 'Mono license differs from sealed files' }
    $result=@()
    foreach($pin in (Mono-Pins)) {
        $sourcePins=@($inventory.faces | Where-Object { $_.file -ceq $pin.file -and $_.family -ceq $pin.family -and ($_.weight -is [int] -or $_.weight -is [long]) -and $_.weight -eq $pin.weight -and $_.italic -is [bool] -and $_.italic -eq $false -and $_.sha256 -ceq $pin.sha256 })
        $transfers=@($inventory.transferredFaces | Where-Object { $_.file -ceq ('fonts/roboto-mono/'+$pin.file) -and $_.family -ceq $pin.family -and ($_.weight -is [int] -or $_.weight -is [long]) -and $_.weight -eq $pin.weight -and $_.italic -is [bool] -and $_.italic -eq $false -and $_.sha256 -ceq $pin.sha256 })
        if($sourcePins.Count -ne 1 -or $transfers.Count -ne 1) { throw 'Mono family/style/file/hash differs from fixed renderer pin' }
        $face=$transfers[0];$source=Suite-File $rootPath $face.file $pin.sha256
        if($face.bytes -ne (Get-Item -LiteralPath $source).Length -or @($suite.files | Where-Object { $_.path -ceq $face.file -and $_.sha256 -ceq $pin.sha256 -and $_.bytes -eq (Get-Item -LiteralPath $source).Length }).Count -ne 1) { throw 'Mono face differs from sealed files' }
        $result+=@{source=$source;sha256=$pin.sha256}
    }
    return $result
}
function Assert-NoMonoIdentity([string[]]$Names) {
    if(@($Names | Where-Object { $_ -match '^Roboto Mono($| )' }).Count -gt 0) { throw 'Roboto Mono already exists; preserve it and resolve identity before setup' }
}
function Initialize-FontApi {
    Add-Type -AssemblyName System.Drawing
    if(-not ('OpfNativeMonoFontApi' -as [type])) {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OpfNativeMonoFontApi {
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
        if($names.Count -ne 1 -or $names[0] -cne 'Roboto Mono') { throw 'Font bytes do not contain only Roboto Mono' }
        foreach($style in @([Drawing.FontStyle]::Regular,[Drawing.FontStyle]::Bold)) { if(-not $collection.Families[0].IsStyleAvailable($style)) { throw 'Pinned Mono regular/bold style is unavailable' } }
        return $names
    } finally { $collection.Dispose() }
}
function Installed-Names {
    $collection=New-Object Drawing.Text.InstalledFontCollection
    try { return @($collection.Families | ForEach-Object { $_.Name }) } finally { $collection.Dispose() }
}
function Fresh-InstalledNames {
    $probePath=Plain-Path (Join-Path (Split-Path -Parent $script:toolPath) 'probe-fonts-windows.ps1')
    $shell=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$shell
    $start.Arguments='-NoLogo -NoProfile -NonInteractive -File "'+$probePath+'"'
    $start.UseShellExecute=$false
    $start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true
    $start.RedirectStandardError=$true
    # The child rebuilds its Windows PowerShell module paths, independently of
    # an inherited PowerShell 7 environment. The parent environment is unchanged.
    $start.EnvironmentVariables.Remove('PSModulePath')
    $child=New-Object Diagnostics.Process
    $child.StartInfo=$start
    try {
        if(-not $child.Start()) { throw 'Could not start read-only font probe' }
        $stdout=$child.StandardOutput.ReadToEndAsync()
        $stderr=$child.StandardError.ReadToEndAsync()
        if(-not $child.WaitForExit(10000)) {
            # This exact child is ours; no Office or unrelated process is touched.
            $child.Kill(); [void]$child.WaitForExit(1000)
            throw 'Fresh font enumeration exceeded its 10-second bound'
        }
        $output=$stdout.GetAwaiter().GetResult()
        $errorOutput=$stderr.GetAwaiter().GetResult()
        if($child.ExitCode -ne 0 -or $errorOutput.Trim()) { throw "Fresh font enumeration failed: $errorOutput" }
        $probe=$output | ConvertFrom-Json
        if($probe.schemaVersion -ne 1 -or $probe.names -isnot [array] -or $probe.names.Count -eq 0 -or $probe.names.Count -gt 10000 -or @($probe.names | Where-Object { $_ -isnot [string] -or -not $_.Trim() }).Count -gt 0) { throw 'Fresh font probe returned malformed names' }
        return $probe.names
    } finally { $child.Dispose() }
}
$registryPath='Software\Microsoft\Windows NT\CurrentVersion\Fonts'
function Open-FontKey { return [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registryPath,$true) }
function Remove-EmptyFontKey { [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($registryPath,$false) }
function Save-State($State) {
    # Write-ahead journal: a crash leaves recoverable intent, never unrecorded files.
    $temp=Join-Path $statePath 'state.next.json'
    $State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temp -Encoding UTF8
    $target=Join-Path $statePath 'state.json'
    # Windows PowerShell 5.1 coerces $null to an empty string for this .NET parameter.
    if(Test-Path -LiteralPath $target) { [IO.File]::Replace($temp,$target,[NullString]::Value) } else { [IO.File]::Move($temp,$target) }
}
function Read-State {
    $state=Get-Content -LiteralPath (Plain-Path (Join-Path $statePath 'state.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
    if($state.profileId -cne 'opf-native-roboto-mono-0.4.2-400-700-v1' -or $state.probeSha256 -cnotmatch '^[a-f0-9]{64}$' -or $state.status -cnotin @('preparing','ready','cleaned') -or $state.schemaVersion -ne 1 -or $state.id -cnotmatch '^[a-f0-9]{32}$' -or $state.entries -isnot [array] -or $state.entries.Count -gt 2 -or $state.createdRegistryKey -isnot [bool] -or $state.suiteSha256 -cnotmatch '^[a-f0-9]{64}$' -or $state.toolSha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid ownership journal' }
    $seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach($entry in $state.entries) {
        if($entry.sha256 -cnotin @((Mono-Pins).sha256) -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$' -or -not $seen.Add($entry.sha256) -or $entry.file -cne "$($entry.sha256).ttf" -or $entry.value -cne "OPF Native Mono $($state.id) $($entry.sha256) (TrueType)") { throw 'Invalid ownership journal entry' }
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
    Assert-ToolIdentity $State
    Assert-Owned $State $false
    $key=Open-FontKey
    try {
        foreach($entry in $State.entries) {
            $file=Plain-Path (Join-Path $statePath $entry.file)
            if($null -ne $key) { $key.DeleteValue($entry.value,$false) }
            if(Test-Path -LiteralPath $file) {
                [void][OpfNativeMonoFontApi]::RemoveFontResourceEx($file,0,[IntPtr]::Zero)
                Remove-Item -LiteralPath $file
            }
        }
    } finally { if($null -ne $key) { $key.Dispose() }; [OpfNativeMonoFontApi]::Notify() }
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
    $userRoot=Plain-Path (User-Root)
    if(-not $statePath.StartsWith($userRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'StateDirectory must be a new private directory under this user LocalApplicationData' }
    Initialize-FontApi
    if($Action -eq 'Cleanup') { Cleanup-Owned (Read-State); Write-Output 'PASS: owned font changes cleaned; receipt retained'; return }
    if($Action -eq 'Check') {
        $state=Read-State
        Assert-ToolIdentity $state
        if($state.status -cne 'ready' -or $state.entries.Count -ne 2) { throw 'Font setup is incomplete or cleaned' }
        if($state.toolSha256 -cne (Hash-File $script:toolPath)) { throw 'Setup tool identity differs from receipt' }
        if($state.probeSha256 -cne (Hash-File (Plain-Path (Join-Path (Split-Path -Parent $script:toolPath) 'probe-fonts-windows.ps1')))) { throw 'Fresh enumeration probe differs from receipt' }
        Assert-Owned $state $true
        $files=@($state.entries | ForEach-Object { Join-Path $statePath $_.file })
        $installed=Fresh-InstalledNames
        foreach($name in (Font-Names $files)) { if($name -cnotin $installed) { throw "Font family is not available through GDI+: $name" } }
        if($SuiteDirectory) {
            if($state.suiteSha256 -cne (Hash-File (Plain-Path (Join-Path $SuiteDirectory 'suite.json')))) { throw 'Suite manifest differs from receipt' }
            $inputs=@(Read-FontInputs $SuiteDirectory)
            if((@($inputs.sha256 | Sort-Object) -join ',') -cne (@($state.entries.sha256 | Sort-Object) -join ',')) { throw 'Installed font receipt differs from suite' }
        }
        Write-Output 'PASS: two exact font files, user registry entries and available families verified'; return
    }
    if(-not $SuiteDirectory) { throw 'Setup requires SuiteDirectory' }
    if(Test-Path -LiteralPath $statePath) { throw 'Setup requires a new StateDirectory; use Check or Cleanup on an existing receipt' }
    $inputs=@(Read-FontInputs $SuiteDirectory)
    [void](Font-Names @($inputs.source))
    Assert-NoMonoIdentity @(Fresh-InstalledNames)
    $existing=Open-FontKey
    $createdRegistryKey=($null -eq $existing)
    if($null -ne $existing) { $existing.Dispose() }
    [void][IO.Directory]::CreateDirectory($statePath)
    $state=[ordered]@{profileId='opf-native-roboto-mono-0.4.2-400-700-v1';schemaVersion=1;id=[Guid]::NewGuid().ToString('N');status='preparing';createdRegistryKey=$createdRegistryKey;suiteSha256=(Hash-File (Join-Path (Plain-Path $SuiteDirectory) 'suite.json'));toolSha256=(Hash-File $script:toolPath);probeSha256=(Hash-File (Plain-Path (Join-Path (Split-Path -Parent $script:toolPath) 'probe-fonts-windows.ps1')));entries=@()}
    Save-State $state
    try {
        if($createdRegistryKey) {
            $created=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($registryPath)
            $created.Dispose()
        }
        foreach($faceInput in $inputs) {
            $entry=@{sha256=$faceInput.sha256;file="$($faceInput.sha256).ttf";value="OPF Native Mono $($state.id) $($faceInput.sha256) (TrueType)"}
            $file=Plain-Path (Join-Path $statePath $entry.file)
            $key=Open-FontKey
            try {
                if($null -ne $key.GetValue($entry.value) -or (Test-Path -LiteralPath $file)) { throw 'Refusing to overwrite a preexisting font file or registry value' }
                $state.entries+=,$entry; Save-State $state
                [IO.File]::Copy($faceInput.source,$file,$false)
                if((Hash-File $file) -cne $entry.sha256) { throw 'Copied font hash differs' }
                $key.SetValue($entry.value,$file,[Microsoft.Win32.RegistryValueKind]::String)
                if([OpfNativeMonoFontApi]::AddFontResourceEx($file,0,[IntPtr]::Zero) -le 0) { throw 'GDI refused font registration' }
            } finally { $key.Dispose() }
        }
        [OpfNativeMonoFontApi]::Notify()
        Assert-Owned $state $true
        $installed=Fresh-InstalledNames
        foreach($name in (Font-Names @($inputs.source))) { if($name -cnotin $installed) { throw "Registered family unavailable: $name" } }
        $state.status='ready'; Save-State $state
        Write-Output 'PASS: two renderer-pinned Roboto Mono faces registered for the current user'
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
