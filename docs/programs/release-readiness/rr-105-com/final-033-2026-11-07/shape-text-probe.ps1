param([string]$Out = 'C:\opf-work\release-033-artifacts\shape-text-probe.json')
$ErrorActionPreference = 'Stop'
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { throw 'Refusing to attach to an existing PowerPoint instance.' }
$app = New-Object -ComObject PowerPoint.Application
$p = $null
try {
  $app.DisplayAlerts = 1
  $p = $app.Presentations.Open('C:\opf-work\release-033-artifacts\qualification\pptx\shapes.pptx', -1, 0, 0)
  $s = $p.Slides.Item(6).Shapes.Item('OPF shape slides.5.blocks.3.shape')
  $tf = $s.TextFrame2
  $r = $tf.TextRange
  $chars = @(for ($i = 1; $i -le $r.Length; $i++) { $c = $r.Characters($i,1); [ordered]@{ text=$c.Text; top=$c.BoundTop; left=$c.BoundLeft; width=$c.BoundWidth; height=$c.BoundHeight; size=$c.Font.Size } })
  [ordered]@{ name=$s.Name; box=@($s.Left,$s.Top,$s.Width,$s.Height); orientation=$tf.Orientation; margins=@($tf.MarginLeft,$tf.MarginRight,$tf.MarginTop,$tf.MarginBottom); anchor=$tf.VerticalAnchor; range=@($r.BoundLeft,$r.BoundTop,$r.BoundWidth,$r.BoundHeight); chars=$chars } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Out -Encoding UTF8
} finally {
  if ($p) { $p.Saved=-1; $p.Close() }
  if ($app.Presentations.Count -eq 0) { $app.Quit() }
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}