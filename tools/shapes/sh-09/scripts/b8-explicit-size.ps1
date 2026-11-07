# Does an explicit run size written by OPF in the data model survive PowerPoint's layout on open (no autofit)?
. "$PSScriptRoot\common.ps1"
. "$PSScriptRoot\gen.ps1"
$q = "$Root\q3b"; New-Item -ItemType Directory -Force $q | Out-Null
$shell = "$Root\q1\process1-base.pptx"
$long = @(@{ t = 'Plan'; p = -1 }, @{ t = 'A considerably longer label that has to wrap over several lines'; p = -1 }, @{ t = 'Ship'; p = -1 }, @{ t = 'Learn'; p = -1 })
$files = @()
foreach ($k in 'pyramid1', 'chevron1', 'process1', 'process2') {
  foreach ($sz in 0, 2400) {
    $f = "$q\$k-sz$sz.pptx"
    New-OpfSmartArt $shell $f $Candidates[$k] $long @{ omit = @('lo', 'cs', 'qs') }
    if ($sz) { $d = (Read-Part $f 'ppt/diagrams/data1.xml').Replace('<a:rPr lang="en-US"/>', "<a:rPr lang=`"en-US`" sz=`"$sz`"/>"); Move-Item $f "$f.src" -Force; Write-Parts "$f.src" $f @{ 'ppt/diagrams/data1.xml' = $d }; Remove-Item "$f.src" }
    $files += $f
  }
}
foreach ($f in $files) { & "$PSScriptRoot\run-probe.ps1" -File $f -OutPrefix ($f -replace '\.pptx$', '') -TimeoutSec 75 | Out-Null }
foreach ($f in $files) { Get-Content (($f -replace '\.pptx$', '') + '-probe.json') -Raw }

