$ErrorActionPreference = 'Stop'
# Read the reference application and OS without changing settings or presentations.
$referencePowerPoint = New-Object -ComObject PowerPoint.Application
$executable = Join-Path $referencePowerPoint.Path 'POWERPNT.EXE'
$version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($executable)
$hasher = [System.Security.Cryptography.SHA256]::Create()
try { $executableHash = ([BitConverter]::ToString($hasher.ComputeHash([System.IO.File]::ReadAllBytes($executable)))).Replace('-', '').ToLowerInvariant() }
finally { $hasher.Dispose() }
$windowsKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SOFTWARE\Microsoft\Windows NT\CurrentVersion')
try {
    $windows = @{product=$windowsKey.GetValue('ProductName'); displayVersion=$windowsKey.GetValue('DisplayVersion'); build=$windowsKey.GetValue('CurrentBuildNumber'); revision=$windowsKey.GetValue('UBR')}
} finally { $windowsKey.Dispose() }
@{
    powerPointVersion=$referencePowerPoint.Version
    executable=@{fileVersion=$version.FileVersion; productVersion=$version.ProductVersion; sha256=$executableHash}
    windows=$windows
    culture=[System.Globalization.CultureInfo]::CurrentCulture.Name
    uiCulture=[System.Globalization.CultureInfo]::CurrentUICulture.Name
} | ConvertTo-Json -Depth 6
