# NT-16 tests only: the fake COM layer that `powerpoint.ps1 -SelfTest -Fake <scenario.json>` dot-sources in place of the
# real one. Every Com-* function and Get-OfficeProcesses of powerpoint.ps1 is redefined here (the script refuses to run
# when one is not), so a self-test never creates PowerPoint.Application and never lists real processes. The scenario
# (written by driver.test.mjs) says per input file name what "PowerPoint" answers: slides and shapes, an open that fails or
# does not return, a slide whose export fails or does not return, a failed close, an edit case that does not apply.
# A call that "does not return" waits on an event nobody sets for hangMs, longer than the plan's time limit.

function Set-FakeMainScenario {
  param([string]$Path)
  $script:FakeMain = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
  $script:FakeProcessCalls = 0
}

function Get-OfficeProcesses {
  param()
  $lists = @($script:FakeMain.processes)
  $answer = @()
  if ($lists.Count -gt 0) {
    $at = [math]::Min($script:FakeProcessCalls, $lists.Count - 1)
    $answer = @($lists[$at])
  }
  $script:FakeProcessCalls++
  return $answer
}

function Com-FakeScenario {
  param()
  if ($null -eq $global:NtFake) { $global:NtFake = Get-Content -LiteralPath $global:NtFakeScenario -Raw -Encoding UTF8 | ConvertFrom-Json; $global:NtFakeOpen = 0 }
  return $global:NtFake
}

function Com-FakeHang {
  param($Ms)
  if ($Ms) { [void](New-Object System.Threading.ManualResetEvent $false).WaitOne([int]$Ms) }
}

function Com-FakeMark {
  param([string]$What)
  Add-Content -LiteralPath ($global:NtFakeScenario + '.calls') -Value $What -Encoding UTF8
}

function Com-NewApp {
  param()
  $scenario = Com-FakeScenario
  Com-FakeMark 'new-app'
  Com-FakeHang $scenario.startHangMs
  if ($scenario.startError) { throw [string]$scenario.startError }
  return @{ fake = 'PowerPoint.Application' }
}

function Com-AppInfo {
  param($App)
  $scenario = Com-FakeScenario
  return [ordered]@{ name = 'PowerPoint'; version = [string]$scenario.app.version; build = [string]$scenario.app.build }
}

function Com-Open {
  param($App, [string]$Path)
  $scenario = Com-FakeScenario
  $name = [System.IO.Path]::GetFileName($Path)
  Com-FakeMark "open $name"
  $spec = $scenario.files.$name
  if ($null -eq $spec) { throw "The fake has no file $name" }
  Com-FakeHang $spec.openHangMs
  if ($spec.openError) { throw [string]$spec.openError }
  $global:NtFakeOpen++
  return @{ name = $name; path = $Path; spec = $spec }
}

function Com-PresInfo {
  param($Pres)
  $slides = @()
  $i = 0
  foreach ($slide in @($Pres.spec.slides)) {
    $i++
    $slides += [ordered]@{ index = $i; id = 255 + $i; hidden = [bool]$slide.hidden; layout = [string]$slide.layout }
  }
  return [ordered]@{ slideCount = $i; slideSize = @($Pres.spec.slideSize); fonts = @($Pres.spec.fonts); slides = $slides }
}

function Com-ExportSlide {
  param($Pres, [int]$Index, [string]$File, [int]$Width, [int]$Height)
  if ([string]$Pres.spec.exportHang -eq [string]$Index) { Com-FakeHang 6000 }
  if (@($Pres.spec.exportFail) -contains $Index) { throw "Slide.Export failed for slide $Index (fake)" }
  # A 1 x 1 PNG: the fake does not draw; the Node side reads the size PowerPoint was asked for from the raw output.
  [System.IO.File]::WriteAllBytes($File, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='))
}

function Com-ProbeSlide {
  param($Pres, [int]$Index, [bool]$ReadCharts)
  $slide = @($Pres.spec.slides)[$Index - 1]
  if (@($Pres.spec.probeFail) -contains $Index) { throw "probe failed on slide $Index (fake)" }
  $notes = $null
  if ($slide.notes) { $notes = [string]$slide.notes }
  return [ordered]@{ notes = $notes; shapes = @($slide.shapes) }
}

function Com-SaveCopy {
  param($Pres, [string]$File)
  Com-FakeMark "save-copy $([System.IO.Path]::GetFileName($File))"
  [System.IO.File]::WriteAllText($File, "fake copy of $($Pres.name)")
}

function Com-ApplyEdit {
  param($Pres, [string]$Case)
  $answer = $Pres.spec.edits.$Case
  if ($null -eq $answer) { return [ordered]@{ applies = $true; what = "$Case (fake)" } }
  if ($answer.error) { throw [string]$answer.error }
  return [ordered]@{ applies = [bool]$answer.applies; what = [string]$answer.what; why = [string]$answer.why }
}

function Com-Close {
  param($Pres)
  Com-FakeMark "close $($Pres.name)"
  if ($Pres.spec.writeInput) { Add-Content -LiteralPath $Pres.path -Value 'changed by the fake' }
  if ($Pres.spec.closeError) { throw [string]$Pres.spec.closeError }
  $global:NtFakeOpen--
}

function Com-OpenCount {
  param($App)
  [void](Com-FakeScenario)
  return [int]$global:NtFakeOpen
}

function Com-Quit {
  param($App)
  Com-FakeMark 'quit'
}

function Com-Release {
  param($App)
  Com-FakeMark 'release'
}
