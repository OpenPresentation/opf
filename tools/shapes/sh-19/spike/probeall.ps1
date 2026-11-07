param([string]$List)
. "C:/opf-work/shapes/sh-17/scripts/ppt.ps1"
$app = Start-PPT
foreach ($f in @($List -split ';' | ? { $_ })) {
  $p = $null
  try { $p = $app.Presentations.Open($f, -1, 0, -1); $s = $p.Slides.Item(1).Shapes.Item(1); $gi = $s.GroupItems; for ($t = 0; $t -lt 20 -and $gi.Count -lt 1; $t++) { Start-Sleep -Milliseconds 250; $gi = $s.GroupItems }; "$(Split-Path $f -Leaf): opened sa=$($s.HasSmartArt) layout=$($s.SmartArt.Layout.Name) items=$($s.GroupItems.Count)" } catch { "$(Split-Path $f -Leaf): ERR $($_.Exception.Message)" } finally { if ($p) { $p.Saved = -1; $p.Close() } }
}
Stop-PPT $app @()
