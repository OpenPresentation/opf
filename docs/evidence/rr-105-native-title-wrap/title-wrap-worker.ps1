# One bounded child process per file. Never terminate Office. A failed Office stage latches all later Office calls closed.
param(
  [Parameter(Mandatory=$true)][string]$Suite,
  [Parameter(Mandatory=$true)][string]$ManifestSha256,
  [Parameter(Mandatory=$true)][string]$CaseName,
  [Parameter(Mandatory=$true)][ValidateSet('After','BeforeXmlControl')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [Parameter(Mandatory=$true)][string]$HelperRoot
)
$ErrorActionPreference = 'Stop'
. (Join-Path $HelperRoot 'packages/editor/test/native-playground-lib.ps1')
function Normalize-TitleLine([string]$Text) { return [regex]::Replace($Text.Replace([char]0x00A0,' ').Replace([char]0x202F,' '),'\s+',' ').Trim() }
$Suite = (Resolve-Path -LiteralPath $Suite).Path
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
$manifestPath = Join-Path $Suite 'manifest.json'
if ((Get-OpfFileSha256 $manifestPath) -cne $ManifestSha256) { throw 'Manifest changed since parent preflight.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$cases = @($manifest.cases | Where-Object { $_.name -ceq $CaseName })
if ($cases.Count -ne 1) { throw 'Expected exactly one selected case.' }
$case = $cases[0]
$artifact = if ($Mode -ceq 'After') { $case.after } else { $case.beforeGeometryControl }
$fixture = [IO.Path]::GetFullPath((Join-Path $Suite $artifact.path))
if (-not $fixture.StartsWith($Suite.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or (Get-OpfFileSha256 $fixture) -cne $artifact.sha256) { throw 'Input path or hash mismatch.' }
$owned = New-OpfOwnedCopy -FixturePath $fixture -AttemptDirectory (Join-Path $OutputDirectory 'owned')
$latch = New-OpfNativeLatch; $app = $null; $presentation = $null
$result = [ordered]@{name=$CaseName;mode=$Mode;control=($Mode -ceq 'BeforeXmlControl');controlScope='XML-restored former exact-width frame, not an old-source export';officeCompleted=$false;passed=$false;fixtureSha256=$owned.fixtureSha256;errors=@();shapes=@()}
$resultPath = Join-Path $OutputDirectory 'result.json'
try {
  if (Get-Process -Name POWERPNT -ErrorAction SilentlyContinue) { throw 'PowerPoint already running; worker will not attach.' }
  $app = Invoke-OpfNativeStage $latch 'create-application' { New-Object -ComObject PowerPoint.Application }
  Invoke-OpfNativeStage $latch 'new-application-empty' { if ($app.Presentations.Count -ne 0) { throw 'Application has another presentation; ownership not established.' } } | Out-Null
  $result.environment = Invoke-OpfNativeStage $latch 'environment' {
    $version = [Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path $app.Path 'POWERPNT.EXE'))
    @{version=[string]$app.Version;build=[string]$app.Build;fileVersion=$version.FileVersion;culture=[Globalization.CultureInfo]::CurrentCulture.Name}
  }
  Invoke-OpfNativeStage $latch 'disable-alerts' { $app.DisplayAlerts = 1 } | Out-Null
  Invoke-OpfNativeStage $latch 'paths-not-open' { Assert-OpfPathsNotOpen $app @($owned.fixture,$owned.copy) } | Out-Null
  $presentation = Invoke-OpfNativeStage $latch 'open-owned-read-only' { $app.Presentations.Open($owned.copy,-1,0,0) }
  Invoke-OpfNativeStage $latch 'verify-owned' {
    if ((Get-OpfFullPath ([string]$presentation.FullName)).ToLowerInvariant() -ne $owned.copy.ToLowerInvariant()) { throw 'Opened presentation is not the owned copy.' }
    if ($presentation.Slides.Count -ne 1) { throw 'Expected exactly one witness slide.' }
  } | Out-Null
  $measurement = Invoke-OpfNativeStage $latch 'measure-title' {
    $shapes = @(); $slide = $presentation.Slides.Item(1)
    for ($index=1;$index -le $slide.Shapes.Count;$index++) {
      $shape=$slide.Shapes.Item($index)
      if ($shape.Name -notmatch '^OPF heading slides\.0\.title line (\d+)$') { continue }
      $lineIndex=[int]$Matches[1]; $frame=@([double]$shape.Left,[double]$shape.Top,[double]$shape.Width,[double]$shape.Height)
      $tf=$shape.TextFrame2; $range=$tf.TextRange; $rawLines=@()
      for ($line=1;$line -le $range.Lines().Count;$line++) { $rawLines += [string]$range.Lines($line,1).Text }
      $characters=@(); $sizes=@(); $ink=@()
      for ($char=1;$char -le $range.Length;$char++) {
        $one=$range.Characters($char,1); $text=[string]$one.Text; $size=[double]$one.Font.Size; $sizes += $size
        if (-not [string]::IsNullOrWhiteSpace($text)) {
          $bound=@([double]$one.BoundLeft,[double]$one.BoundTop,[double]$one.BoundWidth,[double]$one.BoundHeight)
          $ink += ,$bound; $characters += @{text=$text;size=$size;bound=$bound}
        }
      }
      $overflow=@(); $tolerance=1.5
      if ($ink.Count) {
        $left=($ink | ForEach-Object { $_[0] } | Measure-Object -Minimum).Minimum
        $top=($ink | ForEach-Object { $_[1] } | Measure-Object -Minimum).Minimum
        $right=($ink | ForEach-Object { $_[0]+$_[2] } | Measure-Object -Maximum).Maximum
        $bottom=($ink | ForEach-Object { $_[1]+$_[3] } | Measure-Object -Maximum).Maximum
        if ($left -lt $frame[0]-$tolerance) { $overflow+='left' }; if ($right -gt $frame[0]+$frame[2]+$tolerance) { $overflow+='right' }
        if ($top -lt $frame[1]-$tolerance) { $overflow+='top' }; if ($bottom -gt $frame[1]+$frame[3]+$tolerance) { $overflow+='bottom' }
      }
      $shapes += @{name=[string]$shape.Name;index=$lineIndex;frame=$frame;rawText=[string]$range.Text;rawLines=$rawLines;fontSizes=$sizes;autoSize=[int]$tf.AutoSize;wordWrap=[int]$tf.WordWrap;overflow=$overflow;characters=$characters;aggregateBound=@([double]$range.BoundLeft,[double]$range.BoundTop,[double]$range.BoundWidth,[double]$range.BoundHeight)}
    }
    @{width=[double]$presentation.PageSetup.SlideWidth;height=[double]$presentation.PageSetup.SlideHeight;shapes=@($shapes | Sort-Object index)}
  }
  $result.canvas=$measurement; $result.shapes=@($measurement.shapes)
  $result.actualLines=@($result.shapes | ForEach-Object { $_.rawLines } | ForEach-Object { Normalize-TitleLine $_ } | Where-Object { $_ -ne '' })
  $result.expectedLines=@($case.lines | ForEach-Object { Normalize-TitleLine $_ })
  $result.linesMatch=($result.actualLines.Count -eq $result.expectedLines.Count -and ($result.actualLines -join "`n") -ceq ($result.expectedLines -join "`n"))
  $result.canvasMatches=([math]::Abs($measurement.width-[double]$case.width*.75) -lt .01 -and [math]::Abs($measurement.height-[double]$case.height*.75) -lt .01)
  $expectedSize=[math]::Round([double]$case.fontSize*75)/100
  $allSizes=@($result.shapes | ForEach-Object { $_.fontSizes })
  $result.sizeMatches=$allSizes.Count -gt 0 -and @($allSizes | Where-Object { [math]::Abs($_-$expectedSize) -gt .011 }).Count -eq 0
  $result.noAutofit=$result.shapes.Count -gt 0 -and @($result.shapes | Where-Object { $_.autoSize -ne 0 }).Count -eq 0
  $result.overflow=@($result.shapes | Where-Object { $_.overflow.Count } | ForEach-Object { @{name=$_.name;edges=$_.overflow} })
  $result.frameMatches=$false
  if ($null -ne $case.wrap) {
    $frame=if($Mode -ceq 'After'){$case.wrap}else{$case.originalBox}
    $result.frameMatches=$result.shapes.Count -eq 1 -and [math]::Abs($result.shapes[0].frame[0]-[double]$frame.x*.75) -lt .01 -and [math]::Abs($result.shapes[0].frame[2]-[double]$frame.width*.75) -lt .01
  } else { $result.frameMatches=$result.shapes.Count -eq $case.lines.Count }
  $pixelWidth=[int][math]::Round([double]$case.width);$pixelHeight=[int][math]::Round([double]$case.height)
  Invoke-OpfNativeStage $latch 'export-authored-aspect' { $presentation.Slides.Item(1).Export((Join-Path $OutputDirectory 'native.png'),'PNG',$pixelWidth,$pixelHeight) } | Out-Null
  Invoke-OpfNativeStage $latch 'close-owned' { [void](Close-OpfOwnedPresentation $presentation $owned.copy) } | Out-Null
  $presentation=$null
  Invoke-OpfNativeStage $latch 'quit-empty-application' { if ($app.Presentations.Count -ne 0) { throw 'Another presentation is open; not quitting.' }; $app.Quit() } | Out-Null
  $app=$null
  $result.officeCompleted=$true
  $result.fixtureSha256After=Get-OpfFileSha256 $owned.fixture
  $result.passed=$result.linesMatch -and $result.canvasMatches -and $result.sizeMatches -and $result.frameMatches -and $result.noAutofit -and -not $result.overflow.Count -and $result.fixtureSha256After -ceq $owned.fixtureSha256
} catch { $result.errors += $_.Exception.Message }
finally {
  # After a failed Office stage no Office calls, even cleanup, are permitted. Raw identity/stages are retained for coordinator review.
  $result.stages=@($latch.stages.ToArray());$result.latchFailed=[bool]$latch.failed;$result.failureReason=$latch.reason
  $result | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $resultPath -Encoding UTF8
}
if (-not $result.officeCompleted) { exit 1 }
