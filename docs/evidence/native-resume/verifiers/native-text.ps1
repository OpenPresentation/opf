param([Parameter(Mandatory=$true)][string]$EvidenceDirectory,[switch]$FontsOnly)
$ErrorActionPreference='Stop'
function Get-FixtureSha256([string]$File) { (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
$evidenceRoot=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
$generationFile=Join-Path $evidenceRoot 'generation.json'
$generation=Get-Content -LiteralPath $generationFile -Raw -Encoding UTF8 | ConvertFrom-Json
# Session-only fonts, visible to the separate PowerPoint process. No registry,
# permanent font installation, proprietary font copying or application restart.
# https://learn.microsoft.com/en-us/windows/win32/gdi/font-installation-and-deletion
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
$fonts=@(); $records=@(); $presentation=$null; $stage='register-fonts'; $completed=$false
try {
    foreach($face in $generation.fonts) {
        if($face.file -notmatch '^fonts/Carlito-(400|700)-(normal|italic)\.ttf$') { throw 'Invalid fixture font path' }
        $fontPath=Join-Path $evidenceRoot $face.file
        if((Get-FixtureSha256 $fontPath) -ne $face.sha256) { throw 'Changed native fixture font' }
        $added=[OpfNativeTextFonts]::AddFontResourceExW($fontPath,0,[IntPtr]::Zero)
        if($added -lt 1) { throw "Could not register $($face.file)" }
        $fonts+=@{file=$face.file;sha256=$face.sha256;added=$added;removed=$false}
    }
    [OpfNativeTextFonts]::Notify()
    if($FontsOnly) { Write-Output 'All four fixture fonts registered temporarily; cleanup runs before return.'; return }
    $stage='connect'; $powerpoint=New-Object -ComObject PowerPoint.Application
    foreach($fixture in $generation.records) {
        if($fixture.file -notmatch '^case-\d{2}\.pptx$') { throw 'Invalid fixture filename' }
        $source=Join-Path $evidenceRoot $fixture.file
        if((Get-FixtureSha256 $source) -ne $fixture.sha256) { throw 'Changed native fixture' }
        $stage="open-$($fixture.file)"; $presentation=$powerpoint.Presentations.Open($source,0,0,0)
        if($presentation.Slides.Count -ne 1) { throw 'Expected one fixture slide' }
        $slide=$presentation.Slides.Item(1)
        $expected=@(foreach($item in $fixture.items) { for($i=0;$i -lt $item.text.lines.Count;$i++) { if($item.text.lines[$i] -ne '') { @{item=$item;index=$i;text=$item.text.lines[$i]} } } })
        $shapes=@(for($i=1;$i -le $slide.Shapes.Count;$i++) { $shape=$slide.Shapes.Item($i); if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.TextRange.Text -ne '') { $shape } })
        if($shapes.Count -ne $expected.Count) { throw 'Native editable line count changed' }
        $observations=@()
        for($i=0;$i -lt $shapes.Count;$i++) {
            $shape=$shapes[$i]; $wanted=$expected[$i]; $item=$wanted.item; $placed=$item.text.placement.lines[$wanted.index]
            $text=$shape.TextFrame.TextRange.Text
            if($text -cne $wanted.text) { throw "Native line source changed: $($fixture.file) line $i" }
            $factor=0; if($fixture.alignment -eq 'center'){$factor=.5}; if($fixture.alignment -eq 'right'){$factor=1}
            $top=$placed.baseline-$item.text.fontSize; if($item.text.richLines){$top=$placed.y}
            if([Math]::Abs($shape.Left+$shape.Width*$factor-($placed.x+$placed.width*$factor)*.75) -gt .02 -or [Math]::Abs($shape.Top-$top*.75) -gt .02 -or [Math]::Abs($shape.Height-$placed.height*.75) -gt .02) { throw 'Native accepted line geometry changed' }
            $descriptors=@(for($char=1;$char -le $text.Length;$char++) {$shape.TextFrame2.TextRange.Characters($char,1).Font.Name}) | Select-Object -Unique
            $observations+=@{path=$item.path;line=$wanted.index;text=$text;fonts=@($descriptors);left=$shape.Left;top=$shape.Top;width=$shape.Width;height=$shape.Height;tags=$shape.Tags.Count}
        }
        $stem=[IO.Path]::GetFileNameWithoutExtension($fixture.file)
        $originalFile="$stem-original.png"; $slide.Export((Join-Path $evidenceRoot $originalFile),'PNG',[int]$fixture.width,[int]$fixture.height)
        $savedFile="$stem-saved.pptx"; $presentation.SaveAs((Join-Path $evidenceRoot $savedFile),24)
        $presentation.Close(); $presentation=$null
        $presentation=$powerpoint.Presentations.Open((Join-Path $evidenceRoot $savedFile),0,0,0)
        $slide=$presentation.Slides.Item(1)
        $reopenedFile="$stem-reopened.png"; $slide.Export((Join-Path $evidenceRoot $reopenedFile),'PNG',[int]$fixture.width,[int]$fixture.height)
        # Original references belonged to the closed deck. Reacquire only this deck.
        $shapes=@(for($i=1;$i -le $slide.Shapes.Count;$i++) { $shape=$slide.Shapes.Item($i); if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.TextRange.Text -ne '') { $shape } })
        if($shapes.Count -ne $expected.Count) { throw 'Saved line count changed' }
        for($i=0;$i -lt $shapes.Count;$i++) { if($expected[$i].index -eq 0) { [void]$shapes[$i].TextFrame.TextRange.InsertBefore('Edited ') }; $shapes[$i].Name="Native renamed line $i" }
        $editedFile="$stem-edited.pptx"; $presentation.SaveAs((Join-Path $evidenceRoot $editedFile),24)
        $presentation.Close(); $presentation=$null
        $presentation=$powerpoint.Presentations.Open((Join-Path $evidenceRoot $editedFile),-1,0,0)
        for($i=0;$i -lt $expected.Count;$i++) {
            $wanted=$expected[$i].text; if($expected[$i].index -eq 0){$wanted="Edited $wanted"}
            if($presentation.Slides.Item(1).Shapes.Item("Native renamed line $i").TextFrame.TextRange.Text -cne $wanted) { throw 'Native edit did not reopen' }
        }
        $presentation.Close(); $presentation=$null
        # Masks mutate a fresh, unsaved original fixture; no altered formatting is
        # saved into the original, native-saved or edited deck.
        $presentation=$powerpoint.Presentations.Open($source,0,0,0); $slide=$presentation.Slides.Item(1)
        $slide.FollowMasterBackground=0; $slide.Background.Fill.Solid(); $slide.Background.Fill.ForeColor.RGB=0
        $shapes=@(for($i=1;$i -le $slide.Shapes.Count;$i++) { $shape=$slide.Shapes.Item($i); if($shape.HasTextFrame -eq -1 -and $shape.TextFrame.TextRange.Text -ne '') { $shape } })
        for($i=1;$i -le $slide.Shapes.Count;$i++) { $slide.Shapes.Item($i).Visible=0 }
        for($i=0;$i -lt $shapes.Count;$i++) { $shapes[$i].TextFrame.TextRange.Font.Color.RGB=16777215 }
        $masks=@(); $maskIndex=0
        foreach($item in $fixture.items) {
            for($i=0;$i -lt $shapes.Count;$i++) { $shapes[$i].Visible=0; if($expected[$i].item.path -eq $item.path){$shapes[$i].Visible=-1} }
            $maskFile="$stem-mask-$maskIndex.png"; $slide.Export((Join-Path $evidenceRoot $maskFile),'PNG',[int]$fixture.width,[int]$fixture.height)
            $masks+=@{file=$maskFile;path=$item.path;sha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $maskFile))}; $maskIndex++
        }
        $presentation.Saved=-1; $presentation.Close(); $presentation=$null
        $records+=@{file=$fixture.file;lines=$observations;original=@{file=$originalFile;sha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $originalFile))};reopened=@{file=$reopenedFile;sha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $reopenedFile))};savedSha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $savedFile));editedSha256=(Get-FixtureSha256 (Join-Path $evidenceRoot $editedFile));masks=$masks}
        Write-Output "Native text edits, save/reopen and paint captured $($fixture.file)"
    }
    $completed=$true
} catch {
    @{stage=$stage;error=$_.Exception.Message;records=$records;generationSha256=(Get-FixtureSha256 $generationFile)} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'failure.json') -Encoding UTF8
    throw
} finally {
    try { if($null -ne $presentation) { $presentation.Saved=-1; $presentation.Close() } }
    finally {
        foreach($face in $fonts) { $face.removed=[OpfNativeTextFonts]::RemoveFontResourceExW((Join-Path $evidenceRoot $face.file),0,[IntPtr]::Zero) }
        [OpfNativeTextFonts]::Notify()
        $fonts | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'font-registration.json') -Encoding UTF8
        if(@($fonts | Where-Object { -not $_.removed }).Count -gt 0) { throw 'An owned temporary font registration could not be removed; see font-registration.json' }
    }
    # Never quit Office, close user files, or remove registrations we did not add.
}
if($completed) {
    $executable=Join-Path $powerpoint.Path 'POWERPNT.EXE'; $os=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    @{generationSha256=(Get-FixtureSha256 $generationFile);powerPointVersion=(Get-Item -LiteralPath $executable).VersionInfo.FileVersion;executableSha256=(Get-FixtureSha256 $executable);windowsBuild="$($os.CurrentBuild).$($os.UBR)";fontRegistration=$fonts;records=$records} | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'native.json') -Encoding UTF8
}
