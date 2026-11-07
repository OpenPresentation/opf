# Q2 variant matrix on Basic Process
. "$PSScriptRoot\common.ps1"
. "$PSScriptRoot\gen.ps1"
$q = "$Root\q2"; New-Item -ItemType Directory -Force $q | Out-Null
$shell = "$Root\q1\process1-base.pptx"
$lo = $Candidates['process1']
$nodes = @(@{ t = 'Alpha'; p = -1 }, @{ t = 'Beta'; p = -1 }, @{ t = 'Gamma'; p = -1 })
New-OpfSmartArt $shell "$q\v1-min-layout.pptx" $lo $nodes @{ layoutKind = 'min' }
New-OpfSmartArt $shell "$q\v2-empty-layout.pptx" $lo $nodes @{ layoutKind = 'empty' }
New-OpfSmartArt $shell "$q\v3-unknown-layout.pptx" $lo $nodes @{ layoutKind = 'min'; layoutId = 'urn:openpresentation.org/layout/test-unknown' }
New-OpfSmartArt $shell "$q\v4-min-layout-nodrawing.pptx" $lo $nodes @{ layoutKind = 'min'; noDrawing = $true }
New-OpfSmartArt $shell "$q\v5-real-layout-owndrawing.pptx" $lo $nodes @{ realLayoutFrom = $shell }
Get-ChildItem $q *.pptx | ForEach-Object { "$($_.Name) $($_.Length)" }
