# Q3: what a COM node edit changes, and whether colors and fonts follow the theme.
# PowerPoint is restarted per layout: a theme change invalidates the SmartArtLayouts objects for the session.
. "$PSScriptRoot\common.ps1"
$q = "$Root\q3"; New-Item -ItemType Directory -Force $q | Out-Null
function Snap($shp, $tag) {
  $g = Get-SmartArtGeometry $shp
  $fonts = @(); $gi = $shp.GroupItems; for ($i = 1; $i -le $gi.Count; $i++) { try { if ($gi.Item($i).TextFrame2.HasText) { $fonts += $gi.Item($i).TextFrame2.TextRange.Font.Name } } catch {} }
  return [pscustomobject]@{ tag = $tag; shapes = @($g | ForEach-Object { "[$($_.text)] L=$($_.left) T=$($_.top) W=$($_.width) H=$($_.height) sz=$($_.fontSize) fill=$($_.fill)" }); fonts = (($fonts | Select-Object -Unique) -join ',') }
}
$out = @()
foreach ($k in $Candidates.Keys) {
  $app = Start-PPT; $script:LayoutCache = @{}
  try {
    $hold = $app.Presentations.Add(-1)
    $pres = $app.Presentations.Add(-1); $pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
    $slide = $pres.Slides.Add(1, 12)
    $shp = $slide.Shapes.AddSmartArt((Get-LayoutById $app $Candidates[$k]), 80, 60, 800, 420)
    $sa = $shp.SmartArt
    for ($i = 1; $i -le $sa.AllNodes.Count; $i++) { $sa.AllNodes.Item($i).TextFrame2.TextRange.Text = "Node $i" }
    $s = @(Snap $shp 'A-short')
    $slide.Export("$q\$k-A-short.png", 'PNG', 960, 540)
    $sa.AllNodes.Item(2).TextFrame2.TextRange.Text = 'A much longer label for the second node that has to wrap'
    $s += Snap $shp 'B-node2-long'
    $slide.Export("$q\$k-B-node2-long.png", 'PNG', 960, 540)
    $sa.AllNodes.Item(2).TextFrame2.TextRange.Text = 'Node 2'
    $s += Snap $shp 'C-node2-short-again'
    $th = $pres.SlideMaster.Theme
    $th.ThemeColorScheme.Colors(5).RGB = 255   # accent1 -> pure red (BGR int)
    $th.ThemeFontScheme.MinorFont.Item(1).Name = 'Georgia'
    $s += Snap $shp 'D-theme-accent1-red-minor-Georgia'
    $slide.Export("$q\$k-D-theme.png", 'PNG', 960, 540)
    $sa.AllNodes.Item(1).TextFrame2.TextRange.Font.Size = 12
    $sa.AllNodes.Item(3).TextFrame2.TextRange.Text = 'Node 3 edited'
    $s += Snap $shp 'E-node1-explicit-12pt-then-node3-edit'
    $pres.SaveAs("$q\$k-edit.pptx")
    $out += [pscustomobject]@{ layout = $k; snaps = $s }
    "$k done"
  } catch { "$k ERROR: $($_.Exception.Message) line $($_.InvocationInfo.ScriptLineNumber)" }
  finally { Stop-PPT $app }
}
$out | ConvertTo-Json -Depth 5 | Set-Content "$q\q3-results.json"
