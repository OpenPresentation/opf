# Opens a PPTX in PowerPoint (object model, no UI control) and saves a copy, as a person editing and saving the file would; then quits PowerPoint.
param([string]$Pptx, [string]$Out)
$ErrorActionPreference = 'Stop'
$ppt = New-Object -ComObject PowerPoint.Application
try {
  $pres = $ppt.Presentations.Open($Pptx, 0, 0, 0)
  $pres.SaveCopyAs($Out, 24)
  $pres.Close()
  "saved $Out"
} finally {
  $ppt.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
