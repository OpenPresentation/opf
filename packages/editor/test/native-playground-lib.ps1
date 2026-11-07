# RR-87: the owned-copy workflow behind native-playground.ps1. Pure functions: every Office object comes in as a parameter, so
# native-playground-check.ps1 drives them with fakes and no Office process is ever created by the controls.
#
# Rules: the fixture is never opened. A fresh copy of it is made in a new attempt directory (hashed before and after), the exact
# fixture, copy and saved paths must not be open already, every Office call runs in a stage behind a failure latch (after one
# failure no later Office call is made), and only a presentation whose FullName is the exact path this attempt created is closed.
function Get-OpfFileSha256([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }

function Get-OpfFullPath([string]$Path) { [IO.Path]::GetFullPath($Path) }

function New-OpfNativeLatch { return @{ failed = $false; reason = $null; stages = (New-Object 'System.Collections.Generic.List[string]') } }

# One Office stage. After any failure the latch stays closed: later stages throw without running their action.
function Invoke-OpfNativeStage {
    param([hashtable]$Latch, [string]$Name, [scriptblock]$Action)
    if ($Latch.failed) { throw "Office stage '$Name' not run: an earlier stage failed ($($Latch.reason))." }
    try {
        $result = & $Action
        $Latch.stages.Add("${Name}:ok")
        return $result
    } catch {
        $Latch.failed = $true
        $Latch.reason = "${Name}: $($_.Exception.Message)"
        $Latch.stages.Add("${Name}:failed")
        throw
    }
}

# Refuse when any open presentation is one of the exact paths (case-insensitive, as Windows compares them).
function Assert-OpfPathsNotOpen {
    param($Application, [string[]]$Paths)
    $wanted = @($Paths | ForEach-Object { (Get-OpfFullPath $_).ToLowerInvariant() })
    foreach ($open in $Application.Presentations) {
        $name = [string]$open.FullName
        if ($name -and ($wanted -contains (Get-OpfFullPath $name).ToLowerInvariant())) {
            throw "Refused: $name is already open in PowerPoint. Close it yourself and run the helper again."
        }
    }
}

# A fresh attempt directory with a copy of the fixture. Returns the paths and the hashes taken before anything else happens.
function New-OpfOwnedCopy {
    param([string]$FixturePath, [string]$AttemptDirectory)
    $fixture = Get-OpfFullPath $FixturePath
    $attempt = Get-OpfFullPath $AttemptDirectory
    if (-not (Test-Path -LiteralPath $fixture -PathType Leaf)) { throw 'Run the browser export test first: the fixture does not exist.' }
    if (Test-Path -LiteralPath $attempt) { throw 'Preserve earlier attempts: select a fresh attempt directory.' }
    [void](New-Item -ItemType Directory -Path $attempt -Force)
    $copy = Join-Path $attempt 'owned-input.pptx'
    $before = Get-OpfFileSha256 $fixture
    Copy-Item -LiteralPath $fixture -Destination $copy
    $copyHash = Get-OpfFileSha256 $copy
    if ($copyHash -ne $before) { throw 'The owned copy does not match the fixture.' }
    return @{ fixture = $fixture; attempt = $attempt; copy = $copy; fixtureSha256 = $before; copySha256 = $copyHash }
}

# Close one presentation only after proving it is the one this attempt opened (its exact path).
function Close-OpfOwnedPresentation {
    param($Presentation, [string]$OwnedPath)
    if ($null -eq $Presentation) { return $false }
    if ((Get-OpfFullPath ([string]$Presentation.FullName)).ToLowerInvariant() -ne (Get-OpfFullPath $OwnedPath).ToLowerInvariant()) {
        throw "Not closing $($Presentation.FullName): it is not the presentation this attempt opened."
    }
    $Presentation.Close()
    return $true
}

# The whole edit on the owned copy. $Application is PowerPoint's Application (or a fake); returns the report.
function Invoke-OpfOwnedEdit {
    param($Application, [hashtable]$Owned, [string]$Text = 'Edited in native PowerPoint', [string]$Expect = 'Edited before export')
    $latch = New-OpfNativeLatch
    $saved = Join-Path $Owned.attempt 'native-saved.pptx'
    $png = Join-Path $Owned.attempt 'native-slide.png'
    $presentation = $null; $reopened = $null; $closed = @()
    $state = @{ tables = 0; edited = $false; found = $false }
    try {
        Invoke-OpfNativeStage $latch 'not-open' { Assert-OpfPathsNotOpen $Application @($Owned.fixture, $Owned.copy, $saved) } | Out-Null
        $presentation = Invoke-OpfNativeStage $latch 'open-copy' { $Application.Presentations.Open($Owned.copy, 0, 0, 0) }
        Invoke-OpfNativeStage $latch 'owned-identity' {
            if ((Get-OpfFullPath ([string]$presentation.FullName)).ToLowerInvariant() -ne (Get-OpfFullPath $Owned.copy).ToLowerInvariant()) { throw 'Opened presentation is not the owned copy.' }
        } | Out-Null
        Invoke-OpfNativeStage $latch 'edit' {
            if ($presentation.Slides.Count -ne 1) { throw 'Expected the single browser fixture slide.' }
            foreach ($shape in $presentation.Slides.Item(1).Shapes) {
                if ($shape.HasTable -eq -1) { $state.tables++ }
                if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1 -and $shape.TextFrame.TextRange.Text.Contains($Expect)) {
                    $shape.TextFrame.TextRange.Text = $Text
                    $state.edited = $true
                }
            }
            if ($state.tables -ne 1 -or -not $state.edited) { throw 'Browser export did not expose the expected native text/table.' }
        } | Out-Null
        Invoke-OpfNativeStage $latch 'save-as' { $presentation.SaveAs($saved, 24) } | Out-Null
        Invoke-OpfNativeStage $latch 'close-copy' { [void](Close-OpfOwnedPresentation $presentation $Owned.copy) } | Out-Null
        $closed += $Owned.copy; $presentation = $null
        $reopened = Invoke-OpfNativeStage $latch 'open-saved' { $Application.Presentations.Open($saved, -1, 0, 0) }
        Invoke-OpfNativeStage $latch 'verify-saved' {
            if ((Get-OpfFullPath ([string]$reopened.FullName)).ToLowerInvariant() -ne (Get-OpfFullPath $saved).ToLowerInvariant()) { throw 'Reopened presentation is not the saved copy.' }
            foreach ($shape in $reopened.Slides.Item(1).Shapes) {
                if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1 -and $shape.TextFrame.TextRange.Text.Contains($Text)) { $state.found = $true }
            }
            if (-not $state.found) { throw 'Native edit was not preserved after save/reopen.' }
        } | Out-Null
        Invoke-OpfNativeStage $latch 'export-png' { $reopened.Slides.Item(1).Export($png, 'PNG', 1280, 720) } | Out-Null
        Invoke-OpfNativeStage $latch 'close-saved' { [void](Close-OpfOwnedPresentation $reopened $saved) } | Out-Null
        $closed += $saved; $reopened = $null
    } finally {
        # Cleanup closes only what this attempt demonstrably owns, and only while the latch has not stopped Office calls (a failed
        # stage may have left an object in an unknown state: it is reported by the failure, not touched again).
        if (-not $latch.failed) {
            foreach ($pair in @(@($presentation, $Owned.copy), @($reopened, $saved))) {
                if ($null -ne $pair[0]) { try { [void](Close-OpfOwnedPresentation $pair[0] $pair[1]) } catch { } }
            }
        }
    }
    return @{
        passed = $true; tables = $state.tables; editedAndReopened = $state.found
        fixtureSha256 = $Owned.fixtureSha256; fixtureSha256After = (Get-OpfFileSha256 $Owned.fixture)
        copySha256 = $Owned.copySha256; savedSha256 = (Get-OpfFileSha256 $saved)
        closed = @($closed); stages = @($latch.stages.ToArray()); raster = 'native-slide.png'
    }
}
