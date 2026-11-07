# Q2 for all ten layouts (stub layout with built-in uniqueId), Q5 part omissions, and an OPF-authored layoutDef.
. "$PSScriptRoot\common.ps1"
. "$PSScriptRoot\gen.ps1"
$q = "$Root\q2"; $q5 = "$Root\q5"; New-Item -ItemType Directory -Force $q, $q5 | Out-Null
$shell = "$Root\q1\process1-base.pptx"
$flat = @(@{ t = 'Alpha'; p = -1 }, @{ t = 'Beta'; p = -1 }, @{ t = 'Gamma'; p = -1 }, @{ t = 'Delta'; p = -1 })
$tree = @(@{ t = 'Chief'; p = -1 }, @{ t = 'Left'; p = 0 }, @{ t = 'Right'; p = 0 }, @{ t = 'Leaf'; p = 1 })
$files = @()
foreach ($k in $Candidates.Keys) {
  $nodes = if ($k -in 'orgChart1', 'nameTitleOrg', 'hierarchy1') { $tree } else { $flat }
  New-OpfSmartArt $shell "$q\$k-stub.pptx" $Candidates[$k] $nodes @{ layoutKind = 'min' }
  New-OpfSmartArt $shell "$q\$k-ctrl.pptx" $Candidates[$k] $nodes @{ realLayoutFrom = "$Root\q1\$k-base.pptx" }
  $files += "$q\$k-stub.pptx", "$q\$k-ctrl.pptx"
}
$lo = $Candidates['process1']; $three = @($flat[0], $flat[1], $flat[2])
foreach ($o in 'lo', 'qs', 'cs', 'dm') { New-OpfSmartArt $shell "$q5\omit-$o.pptx" $lo $three @{ realLayoutFrom = $shell; omit = @($o) }; $files += "$q5\omit-$o.pptx" }
New-OpfSmartArt $shell "$q5\no-trans-points.pptx" $lo $three @{ realLayoutFrom = $shell; noTrans = $true }; $files += "$q5\no-trans-points.pptx"
New-OpfSmartArt $shell "$q5\no-drawing.pptx" $lo $three @{ realLayoutFrom = $shell; noDrawing = $true }; $files += "$q5\no-drawing.pptx"
$opfId = 'urn:openpresentation.org/smartart/layout/row'
New-OpfSmartArt $shell "$q\opfrow-3.pptx" $opfId $three @{ layoutKind = 'opfrow' }
$long = @(@{ t = 'Plan the work'; p = -1 }, @{ t = 'Build a much longer second step label'; p = -1 }, @{ t = 'Ship'; p = -1 }, @{ t = 'Measure'; p = -1 }, @{ t = 'Learn'; p = -1 })
New-OpfSmartArt $shell "$q\opfrow-5long.pptx" $opfId $long @{ layoutKind = 'opfrow' }
$files += "$q\opfrow-3.pptx", "$q\opfrow-5long.pptx"
$files | Set-Content "$Root\q2\files.txt"
