param([Parameter(Mandatory = $true)][string]$ReportPath)
# RR-87 offline controls for native-playground-lib.ps1. Fake Office objects only: no PowerPoint process or COM class is created.
# Cases: ownership (the fixture is hashed, copied and never opened), an already-open exact path, the failure latch, closing only
# the presentation this attempt opened, a fresh attempt directory, and the bounded worker's deadline.
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $ReportPath) { throw 'Preserve the existing control report and select a fresh ReportPath' }
. (Join-Path $PSScriptRoot 'native-playground-lib.ps1')
. (Join-Path $PSScriptRoot '../../pptx/test/native-process.ps1')
$root = Join-Path ([IO.Path]::GetTempPath()) ('opf-native-playground-check-' + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $root)
$cases = @()
function Assert-Control([bool]$Condition, [string]$Message) { if (-not $Condition) { throw "Control failed: $Message" } }
function Expect-Throw([scriptblock]$Action, [string]$Pattern, [string]$Message) {
    $caught = $null
    try { & $Action } catch { $caught = $_.Exception.Message }
    Assert-Control ($null -ne $caught -and $caught -match $Pattern) "$Message (got: $caught)"
}

# The list of open presentations with a PowerPoint-style Open method; it logs every call.
class FakePresentations : System.Collections.ArrayList {
    [object]$Log
    [hashtable]$Saved
    [int]$Tables
    [object] Open([string]$path, $readOnly, $untitled, $window) {
        $this.Log.Add('open:' + $path)
        $text = 'Edited before export'
        if ($this.Saved.ContainsKey($path)) { $text = $this.Saved[$path] }
        $presentation = New-FakePresentation $this $path $text $this.Tables
        [void]$this.Add($presentation)
        return $presentation
    }
}

function New-FakePresentation($List, [string]$Path, [string]$Text, [int]$Tables) {
    $range = [pscustomobject]@{ Text = $Text }
    $textShape = [pscustomobject]@{ HasTable = 0; HasTextFrame = -1; TextFrame = [pscustomobject]@{ HasText = -1; TextRange = $range } }
    $shapes = @($textShape)
    for ($i = 0; $i -lt $Tables; $i++) { $shapes += [pscustomobject]@{ HasTable = -1; HasTextFrame = 0 } }
    $slide = [pscustomobject]@{ Shapes = $shapes }
    $slide | Add-Member -MemberType ScriptMethod -Name Export -Value { param($p, $f, $w, $h) Set-Content -LiteralPath $p -Value 'png' }
    $slides = [pscustomobject]@{ Count = 1 }
    $slides | Add-Member -MemberType ScriptMethod -Name Item -Value { param($n) $slide }.GetNewClosure()
    $presentation = [pscustomobject]@{ FullName = $Path; Slides = $slides; Range = $range; Saved = $false }
    $presentation | Add-Member -MemberType ScriptMethod -Name SaveAs -Value { param($p, $f) Set-Content -LiteralPath $p -Value ('saved:' + $this.Range.Text) -Encoding ascii; $List.Saved[$p] = $this.Range.Text; $this.FullName = $p }.GetNewClosure()
    $presentation | Add-Member -MemberType ScriptMethod -Name SaveCopyAs -Value { param($p, $f) Set-Content -LiteralPath $p -Value ('saved:' + $this.Range.Text) -Encoding ascii; $List.Saved[$p] = $this.Range.Text; $List.Log.Add('save-copy:' + $p) }.GetNewClosure()
    $presentation | Add-Member -MemberType ScriptMethod -Name Close -Value { if (-not $this.Saved) { throw 'Unsaved owned presentation would prompt on close.' }; $List.Log.Add('close:' + $this.FullName); $List.Remove($this) }.GetNewClosure()
    return $presentation
}

function New-FakeApplication([int]$Tables = 1, [string[]]$AlreadyOpen = @()) {
    $list = [FakePresentations]::new()
    $list.Log = New-Object 'System.Collections.Generic.List[string]'
    $list.Saved = @{}
    $list.Tables = $Tables
    foreach ($path in $AlreadyOpen) { [void]$list.Add((New-FakePresentation $list $path 'user work' 0)) }
    return [pscustomobject]@{ Log = $list.Log; Saved = $list.Saved; Presentations = $list; Version = 'fake' }
}

function New-Fixture([string]$Name) {
    $directory = Join-Path $root $Name
    [void](New-Item -ItemType Directory -Path $directory)
    $fixture = Join-Path $directory 'export.pptx'
    Set-Content -LiteralPath $fixture -Value ('fixture ' + $Name) -Encoding ascii
    return @{ directory = $directory; fixture = $fixture; attempt = (Join-Path $directory 'attempt') }
}

# 1. Ownership and success: the fixture is copied and never opened; only the owned copy and the saved file are closed.
$f = New-Fixture 'success'
$app = New-FakeApplication -AlreadyOpen @((Join-Path $f.directory 'user-deck.pptx'))
$owned = New-OpfOwnedCopy -FixturePath $f.fixture -AttemptDirectory $f.attempt
Assert-Control ($owned.copy -ne $owned.fixture -and (Test-Path -LiteralPath $owned.copy)) 'the owned copy is a different file'
$report = Invoke-OpfOwnedEdit -Application $app -Owned $owned
Assert-Control ($report.fixtureSha256 -eq $report.fixtureSha256After) 'the fixture was not changed'
Assert-Control ($report.copySha256 -eq $report.fixtureSha256) 'the copy matched the fixture when it was made'
Assert-Control (-not ($app.Log -contains ('open:' + $f.fixture))) 'the fixture path was never opened'
Assert-Control (($app.Log | Where-Object { $_ -like 'close:*' }).Count -eq 2) 'exactly the two owned presentations were closed'
Assert-Control (-not ($app.Log -contains ('close:' + (Join-Path $f.directory 'user-deck.pptx')))) 'the user presentation was not closed'
Assert-Control ($app.Presentations.Count -eq 1) 'the user presentation is still open'
Assert-Control ($report.passed -and $report.editedAndReopened -and $report.tables -eq 1) 'the edit round-tripped'
$cases += @{ case = 'ownership'; passed = $true; stages = $report.stages }

# 2. The exact fixture path is already open: refuse before any Open call.
$f = New-Fixture 'already-open'
$app = New-FakeApplication -AlreadyOpen @($f.fixture.ToUpperInvariant())
$owned = New-OpfOwnedCopy -FixturePath $f.fixture -AttemptDirectory $f.attempt
Expect-Throw { Invoke-OpfOwnedEdit -Application $app -Owned $owned } 'already open' 'an open fixture is refused'
Assert-Control (-not ($app.Log | Where-Object { $_ -like 'open:*' -or $_ -like 'close:*' })) 'a refusal makes no Office call'
Assert-Control (Test-Path -LiteralPath $f.fixture) 'the fixture is untouched'
$cases += @{ case = 'already-open'; passed = $true }

# 3. A failure latches: no later stage runs, and nothing is closed afterwards.
$f = New-Fixture 'latch'
$app = New-FakeApplication -Tables 0 -AlreadyOpen @((Join-Path $f.directory 'user-deck.pptx'))
$owned = New-OpfOwnedCopy -FixturePath $f.fixture -AttemptDirectory $f.attempt
Expect-Throw { Invoke-OpfOwnedEdit -Application $app -Owned $owned } 'expected native text/table' 'an unexpected fixture fails the edit stage'
Assert-Control (-not ($app.Log | Where-Object { $_ -like 'close:*' })) 'no close call after the failure'
$latch = New-OpfNativeLatch
Expect-Throw { Invoke-OpfNativeStage $latch 'first' { throw 'boom' } } 'boom' 'a stage failure is raised'
$ran = $false
Expect-Throw { Invoke-OpfNativeStage $latch 'second' { $ran = $true } } 'earlier stage failed' 'a stage after the failure is refused'
Assert-Control (-not $ran) 'the action after the failure never ran'
$cases += @{ case = 'failure-latch'; passed = $true }

# 4. Only the owned presentation is closed.
$foreign = New-FakeApplication
$other = New-FakePresentation $foreign.Presentations (Join-Path $root 'someone-else.pptx') 'x' 0
Expect-Throw { Close-OpfOwnedPresentation $other (Join-Path $root 'owned.pptx') } 'not the presentation this attempt opened' 'a foreign presentation is not closed'
Assert-Control (-not ($foreign.Log | Where-Object { $_ -like 'close:*' })) 'the foreign presentation stayed open'
$cases += @{ case = 'close-only-owned'; passed = $true }

# 5. A fresh attempt directory: an earlier attempt is preserved, never reused.
$f = New-Fixture 'fresh'
[void](New-OpfOwnedCopy -FixturePath $f.fixture -AttemptDirectory $f.attempt)
Expect-Throw { New-OpfOwnedCopy -FixturePath $f.fixture -AttemptDirectory $f.attempt } 'fresh attempt directory' 'an existing attempt is not reused'
Expect-Throw { New-OpfOwnedCopy -FixturePath (Join-Path $f.directory 'missing.pptx') -AttemptDirectory (Join-Path $f.directory 'other') } 'does not exist' 'a missing fixture is refused'
$cases += @{ case = 'fresh-attempt'; passed = $true }

# 6. The bounded worker enforces its deadline on the owned process only.
$f = New-Fixture 'timeout'
$script = Join-Path $f.directory 'slow worker.ps1'
Set-Content -LiteralPath $script -Value 'Start-Sleep -Seconds 30' -Encoding UTF8
$result = Invoke-OpfNativeWorker -ScriptPath $script -WorkerArguments @() -OutputDirectory $f.directory -TimeoutSeconds 1
Assert-Control $result.timedOut 'the deadline was enforced'
Assert-Control (-not (Get-Process -Id $result.processId -ErrorAction SilentlyContinue)) 'the timed-out worker is gone'
$cases += @{ case = 'timeout'; passed = $true }

# SaveAs changes the presentation identity; SaveCopyAs leaves the owned input identity intact.
$f = New-Fixture 'save-identity'
$app = New-FakeApplication
$owned = New-OpfOwnedCopy -FixturePath $f.fixture -AttemptDirectory $f.attempt
$p = New-FakePresentation $app.Presentations $owned.copy 'Edited in native PowerPoint' 1
$renamed = Join-Path $f.attempt 'renamed.pptx'
$p.SaveAs($renamed,24)
Assert-Control ($p.FullName -eq $renamed) 'SaveAs changes the presentation identity, like Office'
Expect-Throw { Close-OpfOwnedPresentation $p $owned.copy } 'not the presentation this attempt opened' 'renaming invalidates the old identity guard'
$q = New-FakePresentation $app.Presentations $owned.copy 'Edited in native PowerPoint' 1
$saved = Join-Path $f.attempt 'copied.pptx'
$q.SaveCopyAs($saved,24)
Assert-Control ($q.FullName -eq $owned.copy) 'SaveCopyAs preserves the owned input identity'
Assert-Control ($app.Saved[$saved] -eq 'Edited in native PowerPoint') 'SaveCopyAs persists the edited contents'
Assert-Control ($report.stages -contains 'save-copy:ok') 'the maintained workflow saves a derivative copy'
$cases += @{ case = 'save-identity'; passed = $true }
@{ passed = $true; scope = 'Fake Office objects and an owned PowerShell worker. No PowerPoint process or COM class was created.'; powershell = $PSVersionTable.PSVersion.ToString(); cases = $cases } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Remove-Item -LiteralPath $root -Recurse -Force
Write-Output 'Native playground controls passed: ownership, already-open refusal, failure latch, close-only-owned, fresh attempts and worker timeout. No Office automation used.'
