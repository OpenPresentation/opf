param([string]$File, [string]$OutPrefix, [string]$SwitchTo = 'urn:microsoft.com/office/officeart/2005/8/layout/chevron1')
# Open one OPF-written file through COM and record what PowerPoint does with it.
. "$PSScriptRoot\common.ps1"
. "$PSScriptRoot\zip.ps1"
Add-Type -AssemblyName System.Drawing
function Count-Red($png) {
  $bmp = [Drawing.Bitmap]::FromFile($png); $n = 0
  try { for ($y = 0; $y -lt $bmp.Height; $y += 2) { for ($x = 0; $x -lt $bmp.Width; $x += 2) { $p = $bmp.GetPixel($x, $y); if ($p.R -gt 230 -and $p.G -lt 30 -and $p.B -lt 30) { $n++ } } } } finally { $bmp.Dispose() }
  return $n
}
$r = [ordered]@{ file = (Split-Path $File -Leaf) }
$app = Start-PPT
try {
  $hold = $app.Presentations.Add(-1)
  try { $p = $app.Presentations.Open($File, 0, 0, -1); $r.open = 'ok' } catch { $r.open = "ERROR: $($_.Exception.Message)"; throw }
  $sl = $p.Slides.Item(1); $r.shapeCount = $sl.Shapes.Count
  $shp = $sl.Shapes.Item(1); $r.shapeType = $shp.Type; $r.hasSmartArt = $shp.HasSmartArt
  $sl.Export("$OutPrefix-open.png", 'PNG', 1280, 720); $r.redPx_open = Count-Red "$OutPrefix-open.png"
  if ($shp.HasSmartArt -eq -1) {
    $sa = $shp.SmartArt
    $r.layoutName = $sa.Layout.Name; $r.layoutId = $sa.Layout.Id; $r.colorId = $sa.Color.Id; $r.quickStyleId = $sa.QuickStyle.Id
    $r.nodeCount = $sa.AllNodes.Count
    $r.nodeTexts = (@(for ($i = 1; $i -le $sa.AllNodes.Count; $i++) { $sa.AllNodes.Item($i).TextFrame2.TextRange.Text }) -join ' | ')
    $g = Get-SmartArtGeometry $shp; $g | ConvertTo-Json -Depth 3 | Set-Content "$OutPrefix-open-geom.json"
    $r.groupItems = $g.Count
    $r.firstShapes = (@($g | Select-Object -First 3 | ForEach-Object { "[$($_.text)] fill=$($_.fill) L=$($_.left) T=$($_.top) W=$($_.width) H=$($_.height) sz=$($_.fontSize)" }) -join ' ; ')
    $p.SaveCopyAs("$OutPrefix-resaved.pptx")
    $lo = Read-Part "$OutPrefix-resaved.pptx" 'ppt/diagrams/layout1.xml'; $r.resavedLayoutBytes = if ($lo) { $lo.Length } else { 0 }
    $dr = (List-Parts "$OutPrefix-resaved.pptx" | Where-Object { $_ -like 'ppt/diagrams/drawing*' }) -join ','; $r.resavedDrawingParts = $dr
    if ($dr) { $dx = Read-Part "$OutPrefix-resaved.pptx" ($dr -split ',')[0]; $r.resavedDrawingHasOpfMarks = $dx.Contains('FF0000') -or $dx.Contains('DRAWN ') }
    # node edit
    $sa.AllNodes.Item(1).TextFrame2.TextRange.Text = 'Edited by COM'
    $sl.Export("$OutPrefix-nodeedit.png", 'PNG', 1280, 720); $r.redPx_nodeedit = Count-Red "$OutPrefix-nodeedit.png"
    # layout switch
    if ($SwitchTo) {
      try { $sa.Layout = (Get-LayoutById $app $SwitchTo); $sl.Export("$OutPrefix-switched.png", 'PNG', 1280, 720); $r.switchedTo = $sa.Layout.Name } catch { $r.switchedTo = "ERROR: $($_.Exception.Message)" }
    }
  }
  $p.Saved = -1; $p.Close()
} catch { if (-not $r.error) { $r.error = "$($_.Exception.Message) line $($_.InvocationInfo.ScriptLineNumber)" } }
finally { Stop-PPT $app }
$r | ConvertTo-Json -Compress
