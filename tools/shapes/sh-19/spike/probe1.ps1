param([string]$File)
. "C:/opf-work/shapes/sh-17/scripts/ppt.ps1"
$app = Start-PPT; $p = $null
try { $p = $app.Presentations.Open($File, -1, 0, -1); "opened shapes=$($p.Slides.Item(1).Shapes.Count) sa=$($p.Slides.Item(1).Shapes.Item(1).HasSmartArt) layout=$($p.Slides.Item(1).Shapes.Item(1).SmartArt.Layout.Name)" } catch { "ERR $($_.Exception.Message)" } finally { Stop-PPT $app @($p) }
