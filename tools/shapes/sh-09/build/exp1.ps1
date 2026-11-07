# SH-09 build, experiment 1: how PowerPoint treats explicit run size, custT, paragraph spacing and typeface in an OPF data model.
param([string[]]$Kinds = @("pyramid1","matrix1"), [string[]]$Only = @())
. 'C:\opf-work\shapes\sh-09\scripts\common.ps1'
. 'C:\opf-work\shapes\sh-09\scripts\gen.ps1'
$q = 'C:\opf-work\shapes\sh-09\build\exp1'; New-Item -ItemType Directory -Force $q | Out-Null
$shell = 'C:\opf-work\shapes\sh-09\q1\process1-base.pptx'
$nodes = @(@{ t = 'Vision'; p = -1 }, @{ t = 'A considerably longer label that has to wrap'; p = -1 }, @{ t = 'Ship'; p = -1 }, @{ t = 'Learn and measure'; p = -1 })
$variants = [ordered]@{
  'plain'  = @{ prSet = '<dgm:prSet/>'; ppr = '' }
  'custT'  = @{ prSet = '<dgm:prSet custT="1"/>'; ppr = '' }
  'custTp' = @{ prSet = '<dgm:prSet custT="1"/>'; ppr = '<a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft></a:pPr>' }
}
$files = @()
foreach ($k in $Kinds) {
  foreach ($v in $variants.Keys) {
    $f = "$q\$k-$v.pptx"
    New-OpfSmartArt $shell $f $Candidates[$k] $nodes @{ omit = @('lo', 'cs', 'qs') }
    $d = Read-Part $f 'ppt/diagrams/data1.xml'
    $d = $d.Replace('<dgm:pt modelId="{', '<dgm:pt modelId="{')
    # node points: those with a run
    $d = [regex]::Replace($d, '<dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/>', { param($m) "$($variants[$v].prSet)<dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p>$($variants[$v].ppr)<a:r><a:rPr lang=`"en-US`" sz=`"2400`"><a:latin typeface=`"Georgia`"/></a:rPr>" })
    Move-Item $f "$f.src" -Force; Write-Parts "$f.src" $f @{ 'ppt/diagrams/data1.xml' = $d }; Remove-Item "$f.src"
    $files += $f
  }
}
$app = Start-PPT
$all = @()
try {
  foreach ($f in $files) {
    $p = $app.Presentations.Open($f, -1, 0, -1)
    $sl = $p.Slides.Item(1); $shp = $sl.Shapes.Item(1)
    $sl.Export(($f -replace '\.pptx$', '.png'), 'PNG', 1280, 720)
    $gi = $shp.GroupItems
    for ($i = 1; $i -le $gi.Count; $i++) {
      $g = $gi.Item($i); $o = [ordered]@{ file = (Split-Path $f -Leaf); i = $i; L = $g.Left; T = $g.Top; W = $g.Width; H = $g.Height }
      if ($g.HasTextFrame -and $g.TextFrame2.HasText) {
        $tf = $g.TextFrame2; $tr = $tf.TextRange
        $o.mL = $tf.MarginLeft; $o.mT = $tf.MarginTop; $o.mR = $tf.MarginRight; $o.mB = $tf.MarginBottom
        $o.sz = $tr.Font.Size; $o.face = $tr.Font.Name; $o.lines = $tr.Lines().Count
        $o.spcB = $tr.ParagraphFormat.SpaceBefore; $o.spcA = $tr.ParagraphFormat.SpaceAfter; $o.within = $tr.ParagraphFormat.SpaceWithin; $o.lineRule = $tr.ParagraphFormat.LineRuleWithin
        $o.bL = $tr.BoundLeft; $o.bT = $tr.BoundTop; $o.bW = $tr.BoundWidth; $o.bH = $tr.BoundHeight
        $ls = @(); for ($j = 1; $j -le $tr.Lines().Count; $j++) { $l = $tr.Lines($j); $ls += "[$($l.Text.Trim())] $([math]::Round($l.BoundLeft,2)),$([math]::Round($l.BoundTop,2)) w$([math]::Round($l.BoundWidth,2))" }
        $o.lineBoxes = $ls -join ' / '
      }
      $all += [pscustomobject]$o
    }
    $p.SaveCopyAs(($f -replace '\.pptx$', '-resaved.pptx'))
    $p.Close()
  }
} finally { Stop-PPT $app }
$all | ConvertTo-Json -Depth 3 | Set-Content "$q\exp1.json"
$all | Format-Table file, i, L, T, W, H, mL, mT, sz, face, lines, spcA, within -AutoSize | Out-String -Width 250
