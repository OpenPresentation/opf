# Q2b: no layout part at all (PowerPoint resolves the built-in layout from the data's loTypeId?), all ten layouts,
# with OPF-written data, colors, quick style and drawing. Plus r:lo variants on Basic Process.
. "$PSScriptRoot\common.ps1"
. "$PSScriptRoot\gen.ps1"
$q = "$Root\q2b"; New-Item -ItemType Directory -Force $q | Out-Null
$shell = "$Root\q1\process1-base.pptx"
$flat = @(@{ t = 'Alpha'; p = -1 }, @{ t = 'Beta'; p = -1 }, @{ t = 'Gamma'; p = -1 }, @{ t = 'Delta'; p = -1 })
$tree = @(@{ t = 'Chief'; p = -1 }, @{ t = 'Left'; p = 0 }, @{ t = 'Right'; p = 0 }, @{ t = 'Leaf'; p = 1 })
$files = @()
foreach ($k in $Candidates.Keys) {
  $nodes = if ($k -in 'orgChart1', 'nameTitleOrg', 'hierarchy1') { $tree } else { $flat }
  New-OpfSmartArt $shell "$q\$k-nolayout.pptx" $Candidates[$k] $nodes @{ omit = @('lo') }
  $files += "$q\$k-nolayout.pptx"
}
$three = @($flat[0], $flat[1], $flat[2]); $lo = $Candidates['process1']
New-OpfSmartArt $shell "$q\lo-dangling.pptx" $lo $three @{ omit = @('lo') }
$t = "$q\lo-dangling.pptx"; $s = (Read-Part $t 'ppt/slides/slide1.xml').Replace('r:dm="rId2"', 'r:dm="rId2" r:lo="rId99"'); Move-Item $t "$t.src" -Force; Write-Parts "$t.src" $t @{ 'ppt/slides/slide1.xml' = $s }; Remove-Item "$t.src"
New-OpfSmartArt $shell "$q\lo-emptyattr.pptx" $lo $three @{ omit = @('lo') }
$t = "$q\lo-emptyattr.pptx"; $s = (Read-Part $t 'ppt/slides/slide1.xml').Replace('r:dm="rId2"', 'r:dm="rId2" r:lo=""'); Move-Item $t "$t.src" -Force; Write-Parts "$t.src" $t @{ 'ppt/slides/slide1.xml' = $s }; Remove-Item "$t.src"
New-OpfSmartArt $shell "$q\all-omitted-but-data.pptx" $lo $three @{ omit = @('lo', 'qs', 'cs') }
$files += "$q\lo-dangling.pptx", "$q\lo-emptyattr.pptx", "$q\all-omitted-but-data.pptx"
foreach ($f in $files) { & "$PSScriptRoot\run-probe.ps1" -File $f -OutPrefix ($f -replace '\.pptx$', '') -TimeoutSec 75 | Out-Null }
foreach ($f in $files) { Get-Content (($f -replace '\.pptx$', '') + '-probe.json') -Raw }
