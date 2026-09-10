# Keep temporary font ownership outside the Office worker. Killing a timed-out
# worker must not skip removal of registrations added by its surviving parent.
function Invoke-OpfWithTemporaryFonts {
    param($Generation,[string]$EvidenceRoot,[string]$RunRoot,[scriptblock]$Action)
    if(-not ('OpfNativeTextFonts' -as [type])) {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OpfNativeTextFonts {
  [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern int AddFontResourceExW(string file,uint flags,IntPtr reserved);
  [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern bool RemoveFontResourceExW(string file,uint flags,IntPtr reserved);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeoutW(IntPtr hwnd,uint message,UIntPtr wParam,IntPtr lParam,uint flags,uint timeout,out UIntPtr result);
  public static void Notify() { UIntPtr result; SendMessageTimeoutW(new IntPtr(0xffff),0x001d,UIntPtr.Zero,IntPtr.Zero,2,1000,out result); }
}
'@
    }
    $fonts=@()
    try {
        if($Generation.fonts.Count -ne 4) { throw 'Expected four pinned Carlito faces' }
        foreach($face in $Generation.fonts) {
            if($face.file -notmatch '^fonts/Carlito-(400|700)-(normal|italic)\.ttf$') { throw 'Invalid fixture font path' }
            $fontPath=Join-Path $EvidenceRoot $face.file
            $hash=(Get-FileHash -LiteralPath $fontPath -Algorithm SHA256).Hash.ToLowerInvariant()
            if($hash -ne $face.sha256) { throw 'Changed native fixture font' }
            $added=[OpfNativeTextFonts]::AddFontResourceExW($fontPath,0,[IntPtr]::Zero)
            if($added -lt 1) { throw "Could not register $($face.file)" }
            $fonts+=@{file=$face.file;sha256=$hash;added=$added;removed=$false}
        }
        [OpfNativeTextFonts]::Notify()
        & $Action
    } finally {
        foreach($face in $fonts) { $face.removed=[OpfNativeTextFonts]::RemoveFontResourceExW((Join-Path $EvidenceRoot $face.file),0,[IntPtr]::Zero) }
        [OpfNativeTextFonts]::Notify()
        @($fonts) | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $RunRoot 'font-registration.json') -Encoding UTF8
        if(@($fonts | Where-Object { -not $_.removed }).Count -gt 0) { throw 'An owned temporary font registration could not be removed; see font-registration.json' }
    }
}
