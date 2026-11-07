param([string[]]$Keys)
# Q1: edit only the cached drawing part, reopen through COM, export, then SaveCopyAs / Save / node edit variants.
. "$PSScriptRoot\common.ps1"
. "$PSScriptRoot\zip.ps1"
Add-Type -AssemblyName System.Drawing
if ($Keys) { $Keys = @($Keys | ForEach-Object { $_ -split ',' }) }
if (-not $Keys) { $Keys = @($Candidates.Keys) }
$q = "$Root\q1"

function Find-DrawingPart($pptx) { (List-Parts $pptx | Where-Object { $_ -like 'ppt/diagrams/drawing*.xml' }) | Select-Object -First 1 }

function Edit-Drawing([string]$xml) {
  $doc = New-Object Xml.XmlDocument; $doc.PreserveWhitespace = $true; $doc.LoadXml($xml)
  $ns = New-Object Xml.XmlNamespaceManager($doc.NameTable)
  $ns.AddNamespace('dsp', 'http://schemas.microsoft.com/office/drawing/2008/diagram')
  $ns.AddNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')
  # first shape that has text runs (a node), else first shape
  $sp = $doc.SelectSingleNode('//dsp:sp[dsp:txBody/a:p/a:r]', $ns); if (-not $sp) { $sp = $doc.SelectSingleNode('//dsp:sp', $ns) }
  $off = $sp.SelectSingleNode('dsp:spPr/a:xfrm/a:off', $ns); $ext = $sp.SelectSingleNode('dsp:spPr/a:xfrm/a:ext', $ns)
  $off.SetAttribute('x', [string]([int64]$off.GetAttribute('x') + 400000)); $off.SetAttribute('y', [string]([int64]$off.GetAttribute('y') + 300000))
  $ext.SetAttribute('cx', [string]([int64]([int64]$ext.GetAttribute('cx') * 0.6)))
  $txo = $sp.SelectSingleNode('dsp:txXfrm/a:off', $ns)
  if ($txo) { $txo.SetAttribute('x', [string]([int64]$txo.GetAttribute('x') + 400000)); $txo.SetAttribute('y', [string]([int64]$txo.GetAttribute('y') + 300000)) }
  $fill = $sp.SelectSingleNode('dsp:spPr/a:solidFill', $ns)
  $new = $doc.CreateElement('a', 'solidFill', 'http://schemas.openxmlformats.org/drawingml/2006/main')
  $c = $doc.CreateElement('a', 'srgbClr', 'http://schemas.openxmlformats.org/drawingml/2006/main'); $c.SetAttribute('val', 'FF0000'); [void]$new.AppendChild($c)
  if ($fill) { [void]$fill.ParentNode.ReplaceChild($new, $fill) } else { $g = $sp.SelectSingleNode('dsp:spPr/a:prstGeom|dsp:spPr/a:custGeom', $ns); [void]$g.ParentNode.InsertAfter($new, $g) }
  $t = $sp.SelectSingleNode('dsp:txBody/a:p/a:r/a:t', $ns); if ($t) { $t.InnerText = 'CACHED' }
  return $doc.OuterXml
}

function Count-Red($png) {
  $bmp = [Drawing.Bitmap]::FromFile($png); $n = 0
  try { for ($y = 0; $y -lt $bmp.Height; $y += 2) { for ($x = 0; $x -lt $bmp.Width; $x += 2) { $p = $bmp.GetPixel($x, $y); if ($p.R -gt 230 -and $p.G -lt 30 -and $p.B -lt 30) { $n++ } } } } finally { $bmp.Dispose() }
  return $n
}

function Has-Edit($pptx) {
  $part = Find-DrawingPart $pptx; if (-not $part) { return 'no-drawing-part' }
  $x = Read-Part $pptx $part
  return "drawingPart=$part red=$($x.Contains('FF0000')) cachedText=$($x.Contains('>CACHED<'))"
}

# Build the edited files (no PowerPoint)
foreach ($k in $Keys) {
  $base = "$q\$k-base.pptx"; $part = Find-DrawingPart $base
  Write-Parts $base "$q\$k-edited.pptx" @{ $part = (Edit-Drawing (Read-Part $base $part)) }
}

$log = @()
$app = Start-PPT
try {
  $hold = $app.Presentations.Add(-1)
  foreach ($k in $Keys) {
    try {
      # (a) plain reopen and export
      $p = $app.Presentations.Open("$q\$k-edited.pptx", 0, 0, -1)
      $shp = $p.Slides.Item(1).Shapes.Item(1)
      $p.Slides.Item(1).Export("$q\$k-a-reopen.png", 'PNG', 1280, 720)
      $t1 = $shp.SmartArt.AllNodes.Item(1).TextFrame2.TextRange.Text
      $g = Get-SmartArtGeometry $shp; $g | ConvertTo-Json -Depth 3 | Set-Content "$q\$k-a-reopen-geom.json"
      $gi1 = $g | Where-Object { $_.text -ne '' } | Select-Object -First 1
      # (b) SaveCopyAs without edits
      $p.SaveCopyAs("$q\$k-b-savecopy.pptx")
      # (c) COM edit of node 2 text, export, save as
      $shp.SmartArt.AllNodes.Item(2).TextFrame2.TextRange.Text = 'Edited by COM'
      $p.Slides.Item(1).Export("$q\$k-c-nodeedit.png", 'PNG', 1280, 720)
      Get-SmartArtGeometry $shp | ConvertTo-Json -Depth 3 | Set-Content "$q\$k-c-nodeedit-geom.json"
      $p.SaveCopyAs("$q\$k-c-nodeedit.pptx")
      $p.Saved = -1; $p.Close()
      # reopen the SaveCopyAs file and export
      $p2 = $app.Presentations.Open("$q\$k-b-savecopy.pptx", 0, 0, -1)
      $p2.Slides.Item(1).Export("$q\$k-b-savecopy.png", 'PNG', 1280, 720)
      $p2.Saved = -1; $p2.Close()
      $log += [pscustomobject]@{
        layout = $k; node1TextViaCOM = $t1; firstTextGroupItem = "$($gi1.text) fill=$($gi1.fill) L=$($gi1.left) W=$($gi1.width)"
        redPx_base = (Count-Red "$q\$k-base.png"); redPx_a = (Count-Red "$q\$k-a-reopen.png"); redPx_b = (Count-Red "$q\$k-b-savecopy.png"); redPx_c = (Count-Red "$q\$k-c-nodeedit.png")
        savecopyPart = (Has-Edit "$q\$k-b-savecopy.pptx"); nodeeditPart = (Has-Edit "$q\$k-c-nodeedit.pptx")
      }
    } catch { $log += [pscustomobject]@{ layout = $k; error = "$($_.Exception.Message) line $($_.InvocationInfo.ScriptLineNumber)" } }
  }
} finally { Stop-PPT $app }
$log | ConvertTo-Json -Depth 3 | Set-Content "$q\q1-results.json"
$log | Format-List | Out-String -Width 220
