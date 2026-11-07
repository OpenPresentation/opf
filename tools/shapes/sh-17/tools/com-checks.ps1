# SH-17 COM checks on OPF-exported live SmartArt: HasSmartArt, the layout, every entry a live node (AllNodes, its text), a node edit
# (OPF's explicit size kept for every node, the node rectangles), and Change Layout to Basic Block List. Opens a copy, never the original.
param([string[]]$Files, [string]$OutDir)
. "C:/opf-work/shapes/sh-17/scripts/ppt.ps1"
New-Item -ItemType Directory -Force $OutDir | Out-Null
$app = Start-PPT; $mine = New-Object Collections.ArrayList; $result = @()
try {
  foreach ($file in $Files) {
    $name = [IO.Path]::GetFileNameWithoutExtension($file); $copy = Join-Path $OutDir "$name-edit.pptx"; Copy-Item $file $copy -Force
    $p = Invoke-Retry { $app.Presentations.Open($copy, 0, 0, -1) }; [void]$mine.Add($p)
    $rec = [ordered]@{ file = $name }
    try {
      $sl = $p.Slides.Item(1); $shp = $null
      for ($k = 1; $k -le $sl.Shapes.Count; $k++) { if ($sl.Shapes.Item($k).HasSmartArt -eq -1) { $shp = $sl.Shapes.Item($k) } }
      $rec.hasSmartArt = [bool]$shp
      if ($shp) {
        try { $p.Windows.Item(1).View.GotoSlide(1) } catch {}
        $sa = $shp.SmartArt; $rec.layout = $sa.Layout.Name; $rec.nodes = $sa.AllNodes.Count
        $rec.texts = @(for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $sa.AllNodes.Item($n).TextFrame2.TextRange.Text })
        $rec.sizesBefore = @(for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $sa.AllNodes.Item($n).TextFrame2.TextRange.Font.Size })
        $rec.rectsBefore = @(for ($i = 1; $i -le $shp.GroupItems.Count; $i++) { $g = $shp.GroupItems.Item($i); '{0:N2},{1:N2},{2:N2},{3:N2}' -f $g.Left, $g.Top, $g.Width, $g.Height })
        $sa.AllNodes.Item(1).TextFrame2.TextRange.Text = 'Edited'
        $rec.sizesAfter = @(for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $sa.AllNodes.Item($n).TextFrame2.TextRange.Font.Size })
        $rec.rectsAfter = @(for ($i = 1; $i -le $shp.GroupItems.Count; $i++) { $g = $shp.GroupItems.Item($i); '{0:N2},{1:N2},{2:N2},{3:N2}' -f $g.Left, $g.Top, $g.Width, $g.Height })
        $sl.Export((Join-Path $OutDir "$name-edited.png"), 'PNG', 1280, 720)
        $script:LayoutCache = @{}; try { $p.Windows.Item(1).Activate() } catch {}; $app.WindowState = 2
        $target = Get-Layout $app "urn:microsoft.com/office/officeart/2005/8/layout/default"
        $sa.Layout = $target; $rec.switchedTo = $sa.Layout.Name; $rec.nodesAfterSwitch = $sa.AllNodes.Count
        $sl.Export((Join-Path $OutDir "$name-switched.png"), 'PNG', 1280, 720)
      }
    } catch { $rec.error = $_.Exception.Message }
    $p.Saved = -1; $p.Close(); [void]$mine.Remove($p)
    $result += [pscustomobject]$rec
  }
} finally { Stop-PPT $app @($mine) }
$result | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $OutDir "$([IO.Path]::GetFileNameWithoutExtension($Files[0])).json")
$result | ForEach-Object { "$($_.file): live=$($_.hasSmartArt) $($_.layout) nodes=$($_.nodes) sizes $($_.sizesBefore -join '/') -> $($_.sizesAfter -join '/') rectsKept=$((($_.rectsBefore | Select-Object -Skip 0) -join ';') -eq (($_.rectsAfter) -join ';')) switched=$($_.switchedTo) ($($_.nodesAfterSwitch)) $($_.error)" }
