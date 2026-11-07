# SH-19 COM checks on OPF-exported live SmartArt on OPF's own layout: HasSmartArt and the live nodes; a node edit (OPF's size kept on every
# node, the node rectangles kept); an added node and two deleted nodes (the layout stays OPF's, the added node takes OPF's size); Change
# Layout to Basic Block List and back to OPF's layout; SaveCopyAs, reopen (OPF's layout and the same rectangles). Files are opened
# read-only; only copies are saved; only our presentations are closed.
param([string]$List, [string]$OutDir)
. "C:/opf-work/shapes/sh-17/scripts/ppt.ps1"
New-Item -ItemType Directory -Force $OutDir | Out-Null
function Rects($shp) { $gi = $shp.GroupItems; for ($t = 0; $t -lt 40 -and $gi.Count -lt 1; $t++) { Start-Sleep -Milliseconds 250; $gi = $shp.GroupItems }; @(for ($i = 1; $i -le $gi.Count; $i++) { $g = $gi.Item($i); '{0:0.###},{1:0.###},{2:0.###},{3:0.###},{4:0.##}' -f ($g.Left - $shp.Left), ($g.Top - $shp.Top), $g.Width, $g.Height, $g.Rotation }) }
function Sizes($sa) { @(for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $sa.AllNodes.Item($n).TextFrame2.TextRange.Font.Size }) }
function Find-SmartArt($slide) { for ($k = 1; $k -le $slide.Shapes.Count; $k++) { if ($slide.Shapes.Item($k).HasSmartArt -eq -1) { return $slide.Shapes.Item($k) } }; return $null }
$Files = @($List -split ';' | Where-Object { $_ })
$app = Start-PPT; $mine = New-Object Collections.ArrayList; $result = @()
try {
  foreach ($file in $Files) {
    $name = [IO.Path]::GetFileNameWithoutExtension($file); $rec = [ordered]@{ file = $name }
    try {
      # A copy, opened for editing (Change Layout needs a presentation that is not read-only); the original is never opened for writing.
      $work = Join-Path $OutDir "$name-work.pptx"; Copy-Item $file $work -Force
      $p = Invoke-Retry { $app.Presentations.Open($work, 0, 0, -1) }; [void]$mine.Add($p)
      $sl = $p.Slides.Item(1); try { $p.Windows.Item(1).View.GotoSlide(1) } catch {}
      $shp = Find-SmartArt $sl; $rec.hasSmartArt = [bool]$shp
      if ($shp) {
        $sa = $shp.SmartArt; $own = $sa.Layout
        $rec.layout = $own.Name; $rec.layoutId = $own.Id; $rec.category = $own.Category; $rec.description = $own.Description
        $rec.nodes = $sa.AllNodes.Count; $rec.texts = @(for ($n = 1; $n -le $sa.AllNodes.Count; $n++) { $sa.AllNodes.Item($n).TextFrame2.TextRange.Text })
        $rec.sizes = Sizes $sa; $rec.rects = Rects $shp
        $sa.AllNodes.Item(1).TextFrame2.TextRange.Text = 'Edited in PowerPoint'
        $rec.edit = [ordered]@{ sizes = (Sizes $sa); rectsKept = ((Rects $shp) -join ';') -eq ($rec.rects -join ';'); layout = $sa.Layout.Name }
        $sl.Export((Join-Path $OutDir "$name-edited.png"), 'PNG', [int]($p.PageSetup.SlideWidth * 4 / 3), [int]($p.PageSetup.SlideHeight * 4 / 3))
        $added = $sa.AllNodes.Add(); $added.TextFrame2.TextRange.Text = 'Added in PowerPoint'
        $rec.add = [ordered]@{ nodes = $sa.AllNodes.Count; layout = $sa.Layout.Name; sizes = (Sizes $sa); shapes = (Rects $shp).Count }
        $sl.Export((Join-Path $OutDir "$name-added.png"), 'PNG', [int]($p.PageSetup.SlideWidth * 4 / 3), [int]($p.PageSetup.SlideHeight * 4 / 3))
        $sa.AllNodes.Item($sa.AllNodes.Count).Delete(); $sa.AllNodes.Item($sa.AllNodes.Count).Delete()
        $rec.delete = [ordered]@{ nodes = $sa.AllNodes.Count; layout = $sa.Layout.Name; shapes = (Rects $shp).Count }
        $sl.Export((Join-Path $OutDir "$name-deleted.png"), 'PNG', [int]($p.PageSetup.SlideWidth * 4 / 3), [int]($p.PageSetup.SlideHeight * 4 / 3))
        $script:LayoutCache = @{}; try { $p.Windows.Item(1).Activate() } catch {}; $app.WindowState = 2; $builtin = Invoke-Retry { Get-Layout $app 'urn:microsoft.com/office/officeart/2005/8/layout/default' }
        $sa.Layout = $builtin; $rec.switchedTo = $sa.Layout.Name
        $sl.Export((Join-Path $OutDir "$name-switched.png"), 'PNG', [int]($p.PageSetup.SlideWidth * 4 / 3), [int]($p.PageSetup.SlideHeight * 4 / 3))
        $sa.Layout = $own; $rec.switchedBack = "$($sa.Layout.Name) | $($sa.Layout.Id)"
        $sl.Export((Join-Path $OutDir "$name-back.png"), 'PNG', [int]($p.PageSetup.SlideWidth * 4 / 3), [int]($p.PageSetup.SlideHeight * 4 / 3))
      }
      $p.Saved = -1; $p.Close(); [void]$mine.Remove($p)
      # Saved again by PowerPoint (unchanged), then reopened.
      $p = Invoke-Retry { $app.Presentations.Open($file, -1, 0, -1) }; [void]$mine.Add($p); $copy = Join-Path $OutDir "$name-resaved.pptx"; $p.SaveCopyAs($copy); $p.Saved = -1; $p.Close(); [void]$mine.Remove($p)
      $q = Invoke-Retry { $app.Presentations.Open($copy, -1, 0, -1) }; [void]$mine.Add($q); $s2 = Find-SmartArt $q.Slides.Item(1)
      $rec.reopened = [ordered]@{ hasSmartArt = [bool]$s2; layout = $(if ($s2) { "$($s2.SmartArt.Layout.Name) | $($s2.SmartArt.Layout.Id)" }); rectsKept = $(if ($s2) { ((Rects $s2) -join ';') -eq ($rec.rects -join ';') }) }
      $q.Saved = -1; $q.Close(); [void]$mine.Remove($q)
    } catch { $rec.error = "$($_.Exception.Message) line $($_.InvocationInfo.ScriptLineNumber)" }
    $result += [pscustomobject]$rec
  }
} finally { Stop-PPT $app @($mine) }
$result | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $OutDir 'com-checks.json')
$result | ForEach-Object { "$($_.file): live=$($_.hasSmartArt) [$($_.layout)] nodes=$($_.nodes) sizes=$($_.sizes -join '/') edit=$($_.edit.sizes -join '/') kept=$($_.edit.rectsKept) add=$($_.add.nodes)@$($_.add.layout) $($_.add.sizes -join '/') delete=$($_.delete.nodes)@$($_.delete.layout) switch=$($_.switchedTo) back=[$($_.switchedBack)] reopen=$($_.reopened.layout) kept=$($_.reopened.rectsKept) $($_.error)" }
