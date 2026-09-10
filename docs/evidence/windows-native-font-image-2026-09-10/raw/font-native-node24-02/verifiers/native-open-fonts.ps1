# Dedicated nine-face bundled open-font fixture. The existing four-face Carlito
# safety contract remains unchanged. Registrations belong to the surviving parent.
function Invoke-OpfWithBundledFontFixture {
    param($Generation,[string]$EvidenceRoot,[scriptblock]$Action)
    # Keep this fixture's registration ownership separate from the Carlito suite.
    if(-not ('OpfBundledFontFixture' -as [type])) {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OpfBundledFontFixture {
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern int AddFontResourceExW(string file,uint flags,IntPtr reserved);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern bool RemoveFontResourceExW(string file,uint flags,IntPtr reserved);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeoutW(IntPtr hwnd,uint message,UIntPtr wParam,IntPtr lParam,uint flags,uint timeout,out UIntPtr result);
 public static void Notify() { UIntPtr result; SendMessageTimeoutW(new IntPtr(0xffff),0x001d,UIntPtr.Zero,IntPtr.Zero,2,1000,out result); }
}
'@
    }
    $owned=@()
    try {
        if($Generation.fonts.Count -ne 9){throw 'Expected nine pinned bundled faces'}
        $seen=@{}
        foreach($face in $Generation.fonts){
            if($face.file -notmatch '^fonts/face-[0-8]\.ttf$' -or $seen.ContainsKey($face.file)){throw 'Invalid or duplicate owned font path'}
            $seen[$face.file]=$true
            $file=Join-Path $EvidenceRoot $face.file
            $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
            if($hash -ne $face.sha256){throw 'Changed fixture font bytes'}
            $added=[OpfBundledFontFixture]::AddFontResourceExW($file,0,[IntPtr]::Zero)
            if($added -lt 1){throw 'Temporary font registration failed'}
            $owned+=@{file=$face.file;sha256=$hash;added=$added;removed=$false}
        }
        [OpfBundledFontFixture]::Notify()
        & $Action
    } finally {
        foreach($face in $owned){$face.removed=[OpfBundledFontFixture]::RemoveFontResourceExW((Join-Path $EvidenceRoot $face.file),0,[IntPtr]::Zero)}
        [OpfBundledFontFixture]::Notify()
        @($owned) | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $EvidenceRoot 'font-registration.json') -Encoding UTF8
        if(@($owned | Where-Object {-not $_.removed}).Count -gt 0){throw 'An owned font registration was not removed; inspect font-registration.json'}
    }
}
