# SH-19 spike 1c/1e: a SmartArt with an OPF layout through COM: the application's layout list, node edit, add and delete, Change Layout
# to a built-in and back, SaveCopyAs and reopen. Opens the file read-only; saves copies only.
param([string]$File, [string]$OutDir)
. "C:/opf-work/shapes/sh-17/scripts/ppt.ps1"
. "C:/opf-work/shapes/sh-09/scripts/zip.ps1"
New-Item -ItemType Directory -Force $OutDir | Out-Null
function Geo($shp) { $gi = $shp.GroupItems; for ($t = 0; $t -lt 40 -and $gi.Count -lt 1; $t++) { Start-Sleep -Milliseconds 250; $gi = $shp.GroupItems }; @(for ($i = 1; $i -le $gi.Count; $i++) { $g = $gi.Item($i); $s = ''; try { if ($g.HasTextFrame -and $g.TextFrame2.HasText) { $s = "$($g.TextFrame2.TextRange.Text)@$($g.TextFrame2.TextRange.Font.Size)" } } catch {}; '{0:0.####},{1:0.####},{2:0.####},{3:0.####} r{4:0.##} {5}' -f ($g.Left - $shp.Left), ($g.Top - $shp.Top), $g.Width, $g.Height, $g.Rotation, $s }) }
$r = [ordered]@{ file = (Split-Path $File -Leaf) }
$app = Start-PPT; $mine = New-Object Collections.ArrayList
try {
  $p = $app.Presentations.Open($File, -1, 0, -1); [void]$mine.Add($p)
  $sl = $p.Slides.Item(1); $shp = $sl.Shapes.Item(1); $sa = $shp.SmartArt
  $r.layout = "$($sa.Layout.Name) | $($sa.Layout.Id) | $($sa.Layout.Category) | $($sa.Layout.Description)"
  $own = $sa.Layout; $ids = @(); for ($i = 1; $i -le $app.SmartArtLayouts.Count; $i++) { $ids += $app.SmartArtLayouts.Item($i).Id }
  $r.appLayouts = $app.SmartArtLayouts.Count; $r.appListsOwn = ($ids -contains $own.Id)
  $r.open = Geo $shp
  $sl.Export("$OutDir\open.png", 'PNG', 1280, 720)
  $sa.AllNodes.Item(1).TextFrame2.TextRange.Text = 'Edited in PowerPoint with a longer text'
  $r.afterEdit = Geo $shp; $r.layoutAfterEdit = $sa.Layout.Name
  $sl.Export("$OutDir\edit.png", 'PNG', 1280, 720)
  $n = $sa.AllNodes.Add(); $n.TextFrame2.TextRange.Text = 'Added'
  $r.afterAdd = Geo $shp; $r.layoutAfterAdd = $sa.Layout.Name
  $sl.Export("$OutDir\add.png", 'PNG', 1280, 720)
  $sa.AllNodes.Item(2).Delete(); $sa.AllNodes.Item(2).Delete()
  $r.afterDelete = Geo $shp; $r.layoutAfterDelete = $sa.Layout.Name
  $sl.Export("$OutDir\delete.png", 'PNG', 1280, 720)
  $sa.AllNodes.Item(1).TextFrame2.TextRange.Text = 'Edited'; $n = $sa.AllNodes.Add(); $n.TextFrame2.TextRange.Text = 'Again'
  $r.restored = Geo $shp
  $p.SaveCopyAs("$OutDir\edited-copy.pptx")
  $builtin = Get-Layout $app 'urn:microsoft.com/office/officeart/2005/8/layout/default'
  $sa.Layout = $builtin; $r.switchedTo = $sa.Layout.Name; $r.switched = Geo $shp
  $sl.Export("$OutDir\switched.png", 'PNG', 1280, 720)
  try { $sa.Layout = $own; $r.switchedBack = "$($sa.Layout.Name) | $($sa.Layout.Id)"; $r.back = Geo $shp } catch { $r.switchedBack = "ERROR $($_.Exception.Message)" }
  $sl.Export("$OutDir\back.png", 'PNG', 1280, 720)
  $ids2 = @(); for ($i = 1; $i -le $app.SmartArtLayouts.Count; $i++) { $ids2 += $app.SmartArtLayouts.Item($i).Id }; $r.appListsOwnAfterSwitch = ($ids2 -contains $own.Id)
  $p.SaveCopyAs("$OutDir\switched-back-copy.pptx")
  $p.Saved = -1; $p.Close(); $mine.Remove($p)
  # A fresh copy saved without changes, then reopened.
  $p = $app.Presentations.Open($File, -1, 0, -1); [void]$mine.Add($p); $p.SaveCopyAs("$OutDir\resaved.pptx"); $p.Saved = -1; $p.Close(); $mine.Remove($p)
  $q = $app.Presentations.Open("$OutDir\resaved.pptx", -1, 0, -1); [void]$mine.Add($q)
  $s2 = $q.Slides.Item(1).Shapes.Item(1); $r.reopened = "$($s2.HasSmartArt) $($s2.SmartArt.Layout.Name) | $($s2.SmartArt.Layout.Id)"; $r.reopenedGeo = Geo $s2
  $q.Saved = -1; $q.Close(); $mine.Remove($q)
} catch { $r.error = "$($_.Exception.Message) line $($_.InvocationInfo.ScriptLineNumber)" } finally { Stop-PPT $app @($mine) }
$r | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$OutDir\edit.json"
