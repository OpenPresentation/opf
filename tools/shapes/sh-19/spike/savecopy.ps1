param([string]$File, [string]$Out)
. "C:/opf-work/shapes/sh-17/scripts/ppt.ps1"
$app = Start-PPT; $p = $null
try { $p = $app.Presentations.Open($File, -1, 0, -1); $s = $p.Slides.Item(1).Shapes.Item(1); $gi = $s.GroupItems; for ($t = 0; $t -lt 20 -and $gi.Count -lt 1; $t++) { Start-Sleep -Milliseconds 250; $gi = $s.GroupItems }; $p.SaveCopyAs($Out); "saved $Out" } catch { "ERR $($_.Exception.Message)" } finally { Stop-PPT $app @($p) }
