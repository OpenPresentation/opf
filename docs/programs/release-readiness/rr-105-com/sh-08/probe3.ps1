if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'PowerPoint running; nothing done.'; exit 1 }
$ppt = New-Object -ComObject PowerPoint.Application
try {
  $v = $ppt.SmartArtLayouts
  Write-Host "property is null: $($null -eq $v)"
  try {
    $c = [System.__ComObject].InvokeMember('SmartArtLayouts', [System.Reflection.BindingFlags]::GetProperty, $null, $ppt, $null)
    Write-Host "InvokeMember: null=$($null -eq $c)"
    if ($c) {
      $n = [System.__ComObject].InvokeMember('Count', [System.Reflection.BindingFlags]::GetProperty, $null, $c, $null)
      Write-Host "Count=$n"
      $one = [System.__ComObject].InvokeMember('Item', [System.Reflection.BindingFlags]::InvokeMethod, $null, $c, @(1))
      Write-Host "Item1=$($one.Name) $($one.Id)"
      $u = [System.__ComObject].InvokeMember('Item', [System.Reflection.BindingFlags]::InvokeMethod, $null, $c, @('urn:microsoft.com/office/officeart/2005/8/layout/pyramid1'))
      Write-Host "ItemUrn=$($u.Name)"
    }
  } catch { Write-Host "InvokeMember error: $($_.Exception.InnerException.Message) | $($_.Exception.Message)" }
  try { Add-Type -AssemblyName Microsoft.Office.Interop.PowerPoint -ErrorAction Stop; Write-Host 'PIA available' } catch { Write-Host 'PIA not available' }
} finally {
  if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
