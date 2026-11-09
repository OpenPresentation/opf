# Pure metric/ordering functions. Dot-sourcing never reads or starts Office.
function Get-OpfTitleCanvasComparison([double]$WidthPx,[double]$HeightPx,[double]$NativeWidthPt,[double]$NativeHeightPt) {
  $widthPt=$WidthPx*.75; $heightPt=$HeightPx*.75
  $quantizedWidth=[math]::Round($widthPt*8,[MidpointRounding]::AwayFromZero)/8
  $quantizedHeight=[math]::Round($heightPt*8,[MidpointRounding]::AwayFromZero)/8
  return @{authoredPx=@($WidthPx,$HeightPx);authoredPt=@($widthPt,$heightPt);nativePt=@($NativeWidthPt,$NativeHeightPt);quantumPt=.125;expectedQuantizedPt=@($quantizedWidth,$quantizedHeight);matches=($NativeWidthPt -eq $quantizedWidth -and $NativeHeightPt -eq $quantizedHeight)}
}
function Get-OpfOrderedTitleShapes($Shapes) { return @($Shapes | Sort-Object { [int]$_.index }) }
function ConvertTo-OpfNormalizedTitleLines($Shapes) {
  return @($Shapes | ForEach-Object { $_.rawLines } | ForEach-Object { [regex]::Replace(([string]$_).Replace([char]0x00A0,' ').Replace([char]0x202F,' '),'\s+',' ').Trim() } | Where-Object { $_ -ne '' })
}
