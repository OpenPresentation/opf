# Live-gate extras COM run (smartart agent): refuses when PowerPoint is already running, then runs the existing, guarded SH-19 tools
# (open read-only, close only their own presentations, quit only when none is open) on the sweep folder, and the tree measurement.
param([string]$Root = 'C:\opf-work\_supervisor\com-jobs\sh-live-extras', [switch]$SkipTrees)
$ErrorActionPreference = 'Stop'
if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'PowerPoint is already running; close it first. Nothing was done.'; exit 1 }
$tools = 'C:\opf-work\shapes\sh-19\tools'
# 1. Every live export and every native-shape export, drawn and measured by PowerPoint (SH-20, SH-22).
& "$tools\com-probe.ps1" -Dir "$Root\sweep\pptx" -OutDir "$Root\sweep\ppt"
& "$tools\com-probe.ps1" -Dir "$Root\sweep\pptx-shapes" -OutDir "$Root\sweep\ppt-shapes"
# 2. SH-23: OPF's layouts at 8 entries, a ninth node added in PowerPoint (com-checks adds one node, then deletes two).
$eight = @(Get-ChildItem "$Root\sweep\pptx\*-8-short-*.pptx" | ForEach-Object FullName) -join ';'
& "$tools\com-checks.ps1" -List $eight -OutDir "$Root\sweep\ninth"
# 3. SH-21: PowerPoint's Organization Chart, Hierarchy and Basic Venn, measured for core's fit.
if (-not $SkipTrees) {
  # The tools above quit PowerPoint when they close their last presentation; give it time to exit before the next refuses to start.
  for ($t = 0; $t -lt 60 -and (Get-Process POWERPNT -ErrorAction SilentlyContinue); $t++) { Start-Sleep -Seconds 1 }
  & "$Root\measure-trees.ps1" -Out "$Root\trees"
}
