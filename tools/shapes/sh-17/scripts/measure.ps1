# SH-17 geometry sweep: PowerPoint's own SmartArt (AddSmartArt) at n nodes in frames of several sizes, one-letter text at a fixed explicit
# size so the text never drives the geometry. Records every GroupItem rectangle to 4 decimals. Each frame is retried on a COM failure
# (PowerPoint is shared with another agent).
param([string]$Layout, [int]$Max = 10, [string]$Out, [double[]]$Widths = @(800, 600, 400, 250), [double[]]$Heights = @(420, 300, 200, 120, 540), [double]$Size = 8, [string]$Text = 'A')
. "$PSScriptRoot\ppt.ps1"
$id = "urn:microsoft.com/office/officeart/2005/8/layout/$Layout"
$rows = New-Object Collections.ArrayList
$app = $null; $pres = $null
function Open-Session {
  $script:app = Start-PPT
  $script:pres = Invoke-Retry { $script:app.Presentations.Add(-1) }
  $script:app.WindowState = 2; $script:pres.PageSetup.SlideWidth = 1000; $script:pres.PageSetup.SlideHeight = 600
  $script:LayoutCache = @{}
}
Open-Session
try {
  foreach ($W in $Widths) { foreach ($H in $Heights) {
    for ($attempt = 0; ; $attempt++) {
      $batch = New-Object Collections.ArrayList
      try {
        $script:LayoutCache = @{}; try { $pres.Windows.Item(1).Activate() } catch {}; $app.WindowState = 2
        $l = Get-Layout $app $id
        foreach ($n in 1..$Max) {
          $slide = $pres.Slides.Add(1, 12)
          $shp = $slide.Shapes.AddSmartArt($l, 50, 30, $W, $H)
          $sa = $shp.SmartArt
          while ($sa.AllNodes.Count -gt $n) { $sa.AllNodes.Item($sa.AllNodes.Count).Delete() }
          while ($sa.AllNodes.Count -lt $n) { [void]$sa.AllNodes.Add() }
          for ($i = 1; $i -le $n; $i++) { $tr = $sa.AllNodes.Item($i).TextFrame2.TextRange; $tr.Text = $Text; $tr.Font.Size = $Size }
          $gi = $shp.GroupItems
          for ($i = 1; $i -le $gi.Count; $i++) { $g = $gi.Item($i)
            [void]$batch.Add([pscustomobject]@{ layout = $Layout; W = $W; H = $H; n = $n; i = $i; type = $g.AutoShapeType; left = [math]::Round($g.Left - 50, 4); top = [math]::Round($g.Top - 30, 4); width = [math]::Round($g.Width, 4); height = [math]::Round($g.Height, 4); rot = $g.Rotation; size = $(try { if ($g.HasTextFrame -and $g.TextFrame2.HasText) { $g.TextFrame2.TextRange.Font.Size } else { '' } } catch { '' }) })
          }
          $slide.Delete()
        }
        $rows.AddRange($batch); break
      } catch {
        if ($attempt -ge 12) { throw }
        Write-Host "retry $W x $H : $($_.Exception.Message)"; Start-Sleep -Seconds 5; try { while ($pres.Slides.Count -gt 0) { $pres.Slides.Item(1).Delete() } } catch {}
        try { $null = $pres.Slides.Count } catch { Open-Session }
      }
    }
  } }
} finally { Stop-PPT $app @($pres) }
$rows | Export-Csv $Out -NoTypeInformation
"rows=$($rows.Count) -> $Out"
