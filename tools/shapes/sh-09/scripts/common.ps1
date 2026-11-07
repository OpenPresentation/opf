$ErrorActionPreference = 'Stop'
$Root = 'C:\opf-work\shapes\sh-09'

$Candidates = [ordered]@{
  'process1'      = 'urn:microsoft.com/office/officeart/2005/8/layout/process1'
  'chevron1'      = 'urn:microsoft.com/office/officeart/2005/8/layout/chevron1'
  'process2'      = 'urn:microsoft.com/office/officeart/2005/8/layout/process2'
  'cycle2'        = 'urn:microsoft.com/office/officeart/2005/8/layout/cycle2'
  'orgChart1'     = 'urn:microsoft.com/office/officeart/2005/8/layout/orgChart1'
  'nameTitleOrg'  = 'urn:microsoft.com/office/officeart/2008/layout/NameandTitleOrganizationalChart'
  'hierarchy1'    = 'urn:microsoft.com/office/officeart/2005/8/layout/hierarchy1'
  'venn1'         = 'urn:microsoft.com/office/officeart/2005/8/layout/venn1'
  'matrix1'       = 'urn:microsoft.com/office/officeart/2005/8/layout/matrix3'
  'pyramid1'      = 'urn:microsoft.com/office/officeart/2005/8/layout/pyramid1'
}

function Start-PPT {
  $app = New-Object -ComObject PowerPoint.Application
  $app.Visible = -1
  $app.WindowState = 2
  return $app
}

function Stop-PPT($app) {
  try {
    foreach ($p in @($app.Presentations)) { try { $p.Saved = -1; $p.Close() } catch {} }
    $app.Quit()
  } catch {}
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  Start-Sleep -Milliseconds 1500
  Get-Process POWERPNT -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq '' -or $true } | Out-Null
}

$script:LayoutCache = @{}
function Get-LayoutById($app, $id) {
  if ($script:LayoutCache.Count -eq 0) { foreach ($l in $app.SmartArtLayouts) { $script:LayoutCache[$l.Id] = $l } }
  if ($script:LayoutCache.ContainsKey($id)) { return $script:LayoutCache[$id] }
  foreach ($l in $app.SmartArtLayouts) { if ($l.Id -eq $id) { return $l } }
  throw "layout not found: $id"
}

function Export-Slide($pres, $path) {
  $pres.Slides.Item(1).Export($path, 'PNG', 1280, 720)
}

# Describe every SmartArt shape geometry visible to COM (GroupItems of the SmartArt shape)
function Get-SmartArtGeometry($shape) {
  $out = @()
  $gi = $shape.GroupItems
  for ($i = 1; $i -le $gi.Count; $i++) {
    $g = $gi.Item($i)
    $txt = ''
    $size = ''
    try { if ($g.HasTextFrame) { $txt = $g.TextFrame2.TextRange.Text; $size = $g.TextFrame2.TextRange.Font.Size } } catch {}
    $fill = ''
    try { $fill = '{0:X6}' -f $g.Fill.ForeColor.RGB } catch {}
    $out += [pscustomobject]@{ i = $i; name = $g.Name; type = $g.AutoShapeType; left = [math]::Round($g.Left, 2); top = [math]::Round($g.Top, 2); width = [math]::Round($g.Width, 2); height = [math]::Round($g.Height, 2); fill = $fill; text = $txt; fontSize = $size }
  }
  return $out
}

