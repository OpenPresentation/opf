param([string]$pptx, [string]$out)
# Opens a copy of a diagram PPTX, moves every node a bound connector ends on by 60 points right and 40 down, and exports the slide, so the
# picture shows whether PowerPoint keeps the connector on the node (a:stCxn / a:endCxn). Lists each connector's ends before and after.
$ErrorActionPreference = 'Stop'
$copy = [System.IO.Path]::ChangeExtension($out, '.pptx')
Copy-Item $pptx $copy -Force
$app = New-Object -ComObject PowerPoint.Application
try {
  $deck = $app.Presentations.Open($copy, $false, $false, $false)
  $slide = $deck.Slides.Item(1)
  $deck.Slides.Item(1).Export(($out -replace '\.png$', '-before.png'), 'PNG', 1280, 720)
  $moved = @{}
  foreach ($shape in $slide.Shapes) {
    if ($shape.Type -ne 6) { continue }
    foreach ($item in $shape.GroupItems) {
      if (-not $item.Connector) { continue }
      $c = $item.ConnectorFormat
      Write-Output ("{0}: begin {1} end {2}  ({3:n1},{4:n1} {5:n1}x{6:n1})" -f $item.Name, $(if ($c.BeginConnected) { $c.BeginConnectedShape.Name + ' #' + $c.BeginConnectionSite } else { '-' }), $(if ($c.EndConnected) { $c.EndConnectedShape.Name + ' #' + $c.EndConnectionSite } else { '-' }), $item.Left, $item.Top, $item.Width, $item.Height)
      if ($c.EndConnected -and -not $moved.ContainsKey($c.EndConnectedShape.Name)) { $moved[$c.EndConnectedShape.Name] = $c.EndConnectedShape }
    }
  }
  foreach ($node in $moved.Values) { $node.Left = $node.Left + 60; $node.Top = $node.Top + 40; Write-Output ("moved {0}" -f $node.Name) }
  foreach ($shape in $slide.Shapes) {
    if ($shape.Type -ne 6) { continue }
    foreach ($item in $shape.GroupItems) { if ($item.Connector) { Write-Output ("after {0}: ({1:n1},{2:n1} {3:n1}x{4:n1})" -f $item.Name, $item.Left, $item.Top, $item.Width, $item.Height) } }
  }
  $slide.Export($out, 'PNG', 1280, 720)
  $deck.Close()
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
