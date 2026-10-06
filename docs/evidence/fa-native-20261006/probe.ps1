# Read-only PowerPoint COM probe for the FA native verification decks.
#   powershell -NoProfile -File probe.ps1 -Deck <path to .pptx> -Item FA-05
# Prints one JSON line per check: {item, check, expected, actual, pass, note}. pass is true, false, or null (could not be read).
# Safety rules (binding): the deck is opened ReadOnly, without a window; the presentation is closed with Saved=-1 and Close();
# no Save/SaveAs/Quit/Kill; no other presentation is touched; Series.Formula is never read (it crashes this PowerPoint build);
# ChartData.Activate is never called.
param(
    [Parameter(Mandatory = $true)][string]$Deck,
    [Parameter(Mandatory = $true)][ValidatePattern('^FA-\d\d$')][string]$Item
)
$ErrorActionPreference = 'Stop'
$deckPath = (Resolve-Path -LiteralPath $Deck).Path
$deckName = [IO.Path]::GetFileNameWithoutExtension($deckPath)
$sidecarPath = Join-Path (Split-Path $deckPath -Parent) ($deckName + '.expect.json')
$sidecar = $null
if (Test-Path -LiteralPath $sidecarPath) { $sidecar = Get-Content -LiteralPath $sidecarPath -Raw -Encoding UTF8 | ConvertFrom-Json }

# ---------------------------------------------------------------------------------------------------- output helpers
function Emit($check, $expected, $actual, $pass, $note) {
    $line = [ordered]@{ item = $Item; check = $check; expected = $expected; actual = $actual; pass = $pass }
    if ($note) { $line['note'] = $note }
    Write-Output (ConvertTo-Json -InputObject $line -Compress -Depth 6)
}
function Invoke-Check([string]$Check, [scriptblock]$Body) {
    try {
        $r = & $Body
        Emit $Check $r.expected $r.actual $r.pass $r.note
    } catch {
        Emit $Check $null ('ERROR: ' + $_.Exception.Message) $null 'the check threw; read the property by hand or use the OOXML fallback in expect.md'
    }
}
function Result($expected, $actual, $pass, $note) { @{ expected = $expected; actual = $actual; pass = $pass; note = $note } }

# ---------------------------------------------------------------------------------------------------- colour helpers
function Hex($value) {
    $c = [int64]$value
    return ('#{0:X2}{1:X2}{2:X2}' -f ($c -band 255), (($c -shr 8) -band 255), (($c -shr 16) -band 255))
}
function HexToBgr([string]$hex) {
    $h = $hex.TrimStart('#')
    return [int64]([Convert]::ToInt32($h.Substring(0, 2), 16) + 256 * [Convert]::ToInt32($h.Substring(2, 2), 16) + 65536 * [Convert]::ToInt32($h.Substring(4, 2), 16))
}
function Luminance($value) {
    $c = [int64]$value
    $parts = @(($c -band 255), (($c -shr 8) -band 255), (($c -shr 16) -band 255)) | ForEach-Object {
        $v = $_ / 255.0
        if ($v -le 0.03928) { $v / 12.92 } else { [math]::Pow(($v + 0.055) / 1.055, 2.4) }
    }
    return 0.2126 * $parts[0] + 0.7152 * $parts[1] + 0.0722 * $parts[2]
}

# ---------------------------------------------------------------------------------------------------- object-model helpers
function Get-AllShapes($shapes) {
    $out = New-Object System.Collections.ArrayList
    for ($i = 1; $i -le $shapes.Count; $i++) {
        $s = $shapes.Item($i)
        [void]$out.Add($s)
        if ($s.Type -eq 6) { foreach ($child in (Get-AllShapes $s.GroupItems)) { [void]$out.Add($child) } }
    }
    return $out
}
function Find-Shapes($slide, [string]$namePattern) {
    return @(Get-AllShapes $slide.Shapes | Where-Object { $_.Name -match $namePattern })
}
function Find-Run($slide, [string]$text, [switch]$StartsWith) {
    foreach ($s in (Get-AllShapes $slide.Shapes)) {
        if ($s.HasTextFrame -ne -1) { continue }
        $tr = $s.TextFrame.TextRange
        $n = $tr.Runs().Count
        for ($i = 1; $i -le $n; $i++) {
            $run = $tr.Runs($i, 1)
            $t = $run.Text.Trim()
            if (($StartsWith -and $t.StartsWith($text)) -or (-not $StartsWith -and $t -eq $text)) { return $run }
        }
    }
    return $null
}
function Find-TextShape($slide, [string]$text) {
    foreach ($s in (Get-AllShapes $slide.Shapes)) {
        if ($s.HasTextFrame -eq -1 -and $s.TextFrame.TextRange.Text.Trim() -eq $text) { return $s }
    }
    return $null
}
function Get-ChartShape($slide) {
    foreach ($s in (Get-AllShapes $slide.Shapes)) { if ($s.HasChart -eq -1) { return $s } }
    return $null
}
function Get-SlideBg($slide) {
    if ($slide.FollowMasterBackground -eq 0) { return [int64]$slide.Background.Fill.ForeColor.RGB }
    return [int64]$slide.Master.Background.Fill.ForeColor.RGB
}
# ThemeColorScheme index: 1 dk1, 2 lt1, 3 dk2, 4 lt2, 5..10 accent1..6, 11 hyperlink, 12 followed hyperlink.
function Get-ThemeColor($pres, [int]$index) { return [int64]$pres.SlideMaster.Theme.ThemeColorScheme.Colors($index).RGB }
function Close-Quietly($pres) {
    try { $pres.Saved = -1 } catch {}
    try { $pres.Close() } catch {}
}

# ---------------------------------------------------------------------------------------------------- connect and open (read-only)
$expectedSlides = @{
    'fa-05-color-roles' = 3; 'fa-09-chart-alt' = 5; 'fa-11-timeline-status' = 2; 'fa-12-quote-photo' = 2
    'fa-13-conveniences' = 3; 'fa-13-preset-1x1' = 1; 'fa-13-preset-4x5' = 1; 'fa-13-preset-9x16' = 1
    'fa-14-chart-highlight' = 4; 'fa-15-combo-chart' = 1
}
try { $app = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
catch { $app = New-Object -ComObject PowerPoint.Application }
$pres = $null
try {
    # Open(FileName, ReadOnly = msoTrue, Untitled = msoFalse, WithWindow = msoFalse)
    $pres = $app.Presentations.Open($deckPath, -1, 0, 0)
} catch {
    Emit 'opens-read-only' 'Presentations.Open succeeds without a repair prompt' ('Open failed: ' + $_.Exception.Message) $false 'a repair-needed file normally fails to open or hangs on a dialog (the 90 s deadline in run-all.ps1 then fires)'
    exit 1
}
try {
    $slideCount = $pres.Slides.Count
    $want = $expectedSlides[$deckName]
    Emit 'opens-read-only' ('opens, ' + $want + ' slides') ('opened, ' + $slideCount + ' slides, ReadOnly=' + $pres.ReadOnly) ($slideCount -eq $want) 'COM cannot report a silent repair directly; the per-slide shape checks below catch a repaired-away chart or shape'

    switch ($Item) {
        'FA-05' {
            $link = $null
            Invoke-Check 'link-run-has-hyperlink' {
                $run = Find-Run $pres.Slides(1) 'OPF docs'
                $addr = $run.ActionSettings(1).Hyperlink.Address
                Result 'https://example.com/docs' $addr ($addr -eq 'https://example.com/docs') $null
            }
            Invoke-Check 'theme-hyperlink-color-is-AA3311' {
                $h = Hex (Get-ThemeColor $pres 11)
                Result '#AA3311' $h ($h -eq '#AA3311') 'ThemeColorScheme.Colors(11) is the theme hlink slot'
            }
            Invoke-Check 'link-run-reads-as-hyperlink-colored' {
                $run = Find-Run $pres.Slides(1) 'OPF docs'
                $themeLink = Get-ThemeColor $pres 11
                $actual = [int64]$run.Font.Color.RGB
                Result ('theme hyperlink ' + (Hex $themeLink)) ('RGB ' + (Hex $actual) + ', ObjectThemeColor ' + $run.Font.Color.ObjectThemeColor + ', Type ' + $run.Font.Color.Type) ($actual -eq $themeLink) 'the run has no OPF color, so the export writes schemeClr hlink; PowerPoint draws hyperlink runs in the theme hlink color'
            }
            Invoke-Check 'slide2-background-is-FF0000' {
                $s = $pres.Slides(2)
                $bg = Hex (Get-SlideBg $s)
                Result '#FF0000' ($bg + ', FollowMasterBackground=' + $s.FollowMasterBackground) ($bg -eq '#FF0000') $null
            }
            Invoke-Check 'text-on-red-is-dark-body' {
                $run = Find-Run $pres.Slides(2) 'Body text on red'
                $c = [int64]$run.Font.Color.RGB
                $l = Luminance $c
                Result 'WCAG relative luminance < 0.179 (dark text)' ((Hex $c) + ' luminance ' + [math]::Round($l, 4)) ($l -lt 0.179) $null
            }
            Invoke-Check 'text-on-red-is-dark-title' {
                $run = Find-Run $pres.Slides(2) 'Text on saturated red'
                $c = [int64]$run.Font.Color.RGB
                $l = Luminance $c
                Result 'WCAG relative luminance < 0.179 (dark text)' ((Hex $c) + ' luminance ' + [math]::Round($l, 4)) ($l -lt 0.179) $null
            }
            Invoke-Check 'accent-role-is-accent3' {
                $run = Find-Run $pres.Slides(3) 'ref-accent'
                $a3 = Get-ThemeColor $pres 7; $a1 = Get-ThemeColor $pres 5
                $c = [int64]$run.Font.Color.RGB
                Result ('accent3 ' + (Hex $a3) + ' (not accent1 ' + (Hex $a1) + ')') ((Hex $c) + ', ObjectThemeColor ' + $run.Font.Color.ObjectThemeColor) (($c -eq $a3) -and ($c -ne $a1)) 'msoThemeColorAccent3 = 7'
            }
            Invoke-Check 'accent3-ref-is-accent3' {
                $run = Find-Run $pres.Slides(3) 'ref-accent3'
                $a3 = Get-ThemeColor $pres 7
                $c = [int64]$run.Font.Color.RGB
                Result ('accent3 ' + (Hex $a3)) (Hex $c) ($c -eq $a3) $null
            }
            Invoke-Check 'primary-role-is-accent1' {
                $run = Find-Run $pres.Slides(3) 'ref-primary'
                $a1 = Get-ThemeColor $pres 5
                $c = [int64]$run.Font.Color.RGB
                Result ('accent1 ' + (Hex $a1)) (Hex $c) ($c -eq $a1) 'supporting check, not in the FA-05 list'
            }
        }

        'FA-09' {
            $alts = @($sidecar.alts)
            $chartShape = { param($slide) $f = @(Find-Shapes $slide '^OPF chart'); if ($f.Count -gt 0) { return $f[0] } else { return (Get-ChartShape $slide) } }
            for ($n = 1; $n -le 5; $n++) {
                $slideNo = $n
                Invoke-Check ('slide' + $slideNo + '-chart-frame-present') {
                    $sh = & $chartShape $pres.Slides($slideNo)
                    Result 'a chart frame (name OPF chart N) survives the open' $(if ($sh) { 'found ' + $sh.Name + ', HasChart=' + $sh.HasChart } else { 'not found' }) ($null -ne $sh) 'a missing frame means PowerPoint repaired the chart away'
                }
            }
            Invoke-Check 'classic-column-descr-equals-chart-alt' {
                $sh = & $chartShape $pres.Slides(1)
                Result $alts[0] $sh.AlternativeText ($sh.AlternativeText -ceq $alts[0]) $null
            }
            Invoke-Check 'chartex-waterfall-descr-equals-chart-alt' {
                $sh = & $chartShape $pres.Slides(2)
                Result $alts[1] $sh.AlternativeText ($sh.AlternativeText -ceq $alts[1]) ('HasChart=' + $sh.HasChart)
            }
            Invoke-Check 'alt-empty-sets-mark-as-decorative' {
                $sh = & $chartShape $pres.Slides(3)
                $d = $sh.Decorative
                if ($null -eq $d) { return (Result 'Shape.Decorative = -1 (msoTrue)' 'Shape.Decorative is not available in this build' $null 'use the OOXML fallback: p:cNvPr has an a:extLst with the adec:decorative val=1 extension and no descr') }
                Result 'Shape.Decorative = -1 (msoTrue), AlternativeText empty' ('Decorative=' + $d + ', AlternativeText="' + $sh.AlternativeText + '"') (($d -eq -1) -and ($sh.AlternativeText -eq '')) $null
            }
            Invoke-Check 'existing-extlst-with-alt-text-opens' {
                $sh = & $chartShape $pres.Slides(4)
                Result $alts[3] $sh.AlternativeText ($sh.AlternativeText -ceq $alts[3]) 'frame cNvPr already held a16:creationId in an a:extLst; descr added by the exporter function writeFrameAlt'
            }
            Invoke-Check 'existing-extlst-with-decorative-opens' {
                $sh = & $chartShape $pres.Slides(5)
                $d = $sh.Decorative
                if ($null -eq $sh) { return (Result 'chart frame present' 'frame missing (repaired away)' $false $null) }
                if ($null -eq $d) { return (Result 'Shape.Decorative = -1 (msoTrue)' 'Shape.Decorative is not available in this build; the frame opened' $null 'the frame survived; see expect.md for the OOXML (a second a:extLst in p:cNvPr is schema-invalid)') }
                Result 'Shape.Decorative = -1 (msoTrue)' ('Decorative=' + $d) ($d -eq -1) 'the exporter wrote a second a:extLst next to the existing one (schema allows one)'
            }
        }

        'FA-11' {
            $events = @($sidecar.events)
            for ($n = 1; $n -le 2; $n++) {
                $slideNo = $n
                $tag = 'slide' + $slideNo
                Invoke-Check ($tag + '-current-event-two-ellipses') {
                    $s = $pres.Slides($slideNo)
                    $rings = @(Find-Shapes $s '^OPF timeline \d+ ring \d+$')
                    $currentIdx = [array]::IndexOf(@($events | ForEach-Object { $_.status }), 'current')
                    $marker = @(Find-Shapes $s ('^OPF timeline \d+ marker ' + $currentIdx + '$'))
                    $ok = ($rings.Count -eq 1) -and ($marker.Count -eq 1) -and ($rings[0].AutoShapeType -eq 9) -and ($marker[0].AutoShapeType -eq 9)
                    Result 'one ring + one marker for the current event, both msoShapeOval (9)' ('rings=' + $rings.Count + ', markers=' + $marker.Count + $(if ($ok) { ', ring/marker AutoShapeType 9/9' } else { '' })) $ok $null
                }
                Invoke-Check ($tag + '-current-ring-about-1.6x-marker') {
                    $s = $pres.Slides($slideNo)
                    $currentIdx = [array]::IndexOf(@($events | ForEach-Object { $_.status }), 'current')
                    $ring = @(Find-Shapes $s ('^OPF timeline \d+ ring ' + $currentIdx + '$'))[0]
                    $marker = @(Find-Shapes $s ('^OPF timeline \d+ marker ' + $currentIdx + '$'))[0]
                    $ratio = $ring.Width / $marker.Width
                    Result 'ring/marker diameter ratio between 1.4 and 1.8 (exporter wrote 255270/171450 EMU = 1.49)' ([math]::Round($ratio, 3)) (($ratio -ge 1.4) -and ($ratio -le 1.8)) ('ring ' + $ring.Width + ' pt, marker ' + $marker.Width + ' pt')
                }
                Invoke-Check ($tag + '-planned-markers-hollow-over-background') {
                    $s = $pres.Slides($slideNo)
                    $bg = Get-SlideBg $s
                    $rows = @()
                    $allOk = $true
                    for ($i = 0; $i -lt $events.Count; $i++) {
                        if ($events[$i].status -ne 'planned') { continue }
                        $m = @(Find-Shapes $s ('^OPF timeline \d+ marker ' + $i + '$'))[0]
                        $ok = ($m.AutoShapeType -eq 9) -and ($m.Fill.Visible -eq -1) -and ($m.Fill.Type -eq 1) -and ([int64]$m.Fill.ForeColor.RGB -eq $bg) -and ($m.Line.Visible -eq -1)
                        if (-not $ok) { $allOk = $false }
                        $rows += ('marker ' + $i + ': oval=' + $m.AutoShapeType + ' fillType=' + $m.Fill.Type + ' fill=' + (Hex $m.Fill.ForeColor.RGB) + ' lineVisible=' + $m.Line.Visible)
                    }
                    Result ('each planned marker: oval, solid fill ' + (Hex $bg) + ' (the slide background), Line.Visible = -1') ($rows -join '; ') $allOk $null
                }
                Invoke-Check ($tag + '-current-label-bold') {
                    $s = $pres.Slides($slideNo)
                    $rows = @(); $allOk = $true
                    for ($i = 0; $i -lt $events.Count; $i++) {
                        $sh = Find-TextShape $s $events[$i].what
                        if ($null -eq $sh) { $rows += ($events[$i].what + ': text shape not found'); $allOk = $false; continue }
                        $bold = [int]$sh.TextFrame.TextRange.Font.Bold
                        $shouldBold = ($events[$i].status -eq 'current')
                        if (($bold -eq -1) -ne $shouldBold) { $allOk = $false }
                        $rows += ($events[$i].what + ' (' + $events[$i].status + '): Bold=' + $bold)
                    }
                    Result 'only the current event label has Font.Bold = -1' ($rows -join '; ') $allOk $null
                }
            }
        }

        'FA-12' {
            $photos = @($sidecar.photos)
            for ($n = 1; $n -le 2; $n++) {
                $slideNo = $n; $photo = $photos[$n - 1]; $tag = 'slide' + $slideNo
                Invoke-Check ($tag + '-photo-is-ellipse') {
                    $pic = @(Find-Shapes $pres.Slides($slideNo) '^OPF quote photo')[0]
                    $t = $pic.AutoShapeType
                    Result 'AutoShapeType = 9 (msoShapeOval)' ('AutoShapeType=' + $t + ', Type=' + $pic.Type) ($t -eq 9) 'if COM reports -2 (mixed) for a picture, use the OOXML fallback: a:prstGeom prst="ellipse"'
                }
                Invoke-Check ($tag + '-photo-alt-text') {
                    $pic = @(Find-Shapes $pres.Slides($slideNo) '^OPF quote photo')[0]
                    Result $photo.alt $pic.AlternativeText ($pic.AlternativeText -ceq $photo.alt) $null
                }
                Invoke-Check ($tag + '-photo-frame-square') {
                    $pic = @(Find-Shapes $pres.Slides($slideNo) '^OPF quote photo')[0]
                    Result 'Width = Height (circle)' ($pic.Width.ToString() + ' x ' + $pic.Height.ToString()) ([math]::Abs($pic.Width - $pic.Height) -lt 0.5) $null
                }
                Invoke-Check ($tag + '-photo-cropped-not-distorted') {
                    $pic = @(Find-Shapes $pres.Slides($slideNo) '^OPF quote photo')[0]
                    $crop = $pic.PictureFormat.Crop
                    $pw = [double]$crop.PictureWidth; $ph = [double]$crop.PictureHeight
                    $sw = [double]$crop.ShapeWidth; $sh = [double]$crop.ShapeHeight
                    $srcAspect = $photo.width / $photo.height
                    $aspect = $pw / $ph
                    $aspectOk = [math]::Abs($aspect - $srcAspect) / $srcAspect -lt 0.02
                    $coversOk = ($pw -ge $sw - 0.5) -and ($ph -ge $sh - 0.5)
                    $croppedOk = ($pw -gt $sw + 0.5) -or ($ph -gt $sh + 0.5)
                    Result ('picture aspect = source aspect ' + [math]::Round($srcAspect, 4) + ' (undistorted), picture covers the frame and is larger than it on one axis (cropped)') ('picture ' + [math]::Round($pw, 2) + ' x ' + [math]::Round($ph, 2) + ' (aspect ' + [math]::Round($aspect, 4) + '), frame ' + [math]::Round($sw, 2) + ' x ' + [math]::Round($sh, 2) + ', CropL/R/T/B ' + [math]::Round($pic.PictureFormat.CropLeft, 2) + '/' + [math]::Round($pic.PictureFormat.CropRight, 2) + '/' + [math]::Round($pic.PictureFormat.CropTop, 2) + '/' + [math]::Round($pic.PictureFormat.CropBottom, 2)) ($aspectOk -and $coversOk -and $croppedOk) 'expect.md lists the srcRect the exporter wrote (16.667% on the long axis)'
                }
            }
        }

        'FA-13' {
            if ($deckName -like 'fa-13-preset-*') {
                $sizes = @{ 'fa-13-preset-1x1' = @(540, 540); 'fa-13-preset-4x5' = @(540, 675); 'fa-13-preset-9x16' = @(540, 960) }
                $want = $sizes[$deckName]
                Invoke-Check 'preset-slide-size-points' {
                    $w = $pres.PageSetup.SlideWidth; $h = $pres.PageSetup.SlideHeight
                    Result ('' + $want[0] + ' x ' + $want[1]) ('' + $w + ' x ' + $h) (([math]::Abs($w - $want[0]) -lt 0.5) -and ([math]::Abs($h - $want[1]) -lt 0.5)) 'PageSetup.SlideWidth x SlideHeight in points'
                }
            } else {
                Invoke-Check 'watermark-is-rotated-text-box' {
                    $sh = @(Find-Shapes $pres.Slides(1) '^OPF watermark text$')[0]
                    $rot = [double]$sh.Rotation
                    $ok = ([math]::Abs($rot - 330) -le 2) -or ([math]::Abs($rot + 30) -le 2)
                    Result 'Rotation about 330 (= -30)' ('Rotation=' + $rot + ', HasTextFrame=' + $sh.HasTextFrame + ', text="' + $sh.TextFrame.TextRange.Text + '"') ($ok -and ($sh.HasTextFrame -eq -1)) $null
                }
                Invoke-Check 'watermark-text-has-transparency' {
                    $sh = @(Find-Shapes $pres.Slides(1) '^OPF watermark text$')[0]
                    $t = [double]$sh.TextFrame2.TextRange.Font.Fill.Transparency
                    Result 'text fill Transparency about 0.85 (opacity 0.15)' ([math]::Round($t, 3)) ([math]::Abs($t - 0.85) -lt 0.03) 'alpha 15000 in the run solidFill'
                }
                Invoke-Check 'watermark-behind-slide-content' {
                    $s = $pres.Slides(1)
                    $sh = @(Find-Shapes $s '^OPF watermark text$')[0]
                    $others = @(Get-AllShapes $s.Shapes | Where-Object { $_.Name -ne $sh.Name } | ForEach-Object { $_.ZOrderPosition })
                    $min = ($others | Measure-Object -Minimum).Minimum
                    Result 'ZOrderPosition lower than every other shape' ('watermark z=' + $sh.ZOrderPosition + ', others min z=' + $min) ($sh.ZOrderPosition -lt $min) $null
                }
                Invoke-Check 'code-highlight-bands-are-rectangles' {
                    $bands = @(Find-Shapes $pres.Slides(2) '^OPF code \d+ highlight \d+$')
                    $types = ($bands | ForEach-Object { $_.AutoShapeType }) -join ','
                    $ok = ($bands.Count -eq 2) -and (@($bands | Where-Object { $_.AutoShapeType -ne 1 }).Count -eq 0)
                    Result '2 bands (lines 2-3 and line 5), each msoShapeRectangle (1)' ('bands=' + $bands.Count + ', AutoShapeType ' + $types) $ok $null
                }
                Invoke-Check 'code-highlight-bands-behind-line-text' {
                    $s = $pres.Slides(2)
                    $bands = @(Find-Shapes $s '^OPF code \d+ highlight \d+$')
                    $panel = @(Find-Shapes $s '^OPF code \d+ panel$')[0]
                    $lines = @(Find-Shapes $s '^OPF code \d+ body line \d+$')
                    $minLine = ($lines | ForEach-Object { $_.ZOrderPosition } | Measure-Object -Minimum).Minimum
                    $bandZ = @($bands | ForEach-Object { $_.ZOrderPosition })
                    $ok = ($bands.Count -gt 0) -and (@($bandZ | Where-Object { ($_ -le $panel.ZOrderPosition) -or ($_ -ge $minLine) }).Count -eq 0)
                    Result 'panel z < every band z < every body line z' ('panel z=' + $panel.ZOrderPosition + ', band z=' + ($bandZ -join ',') + ', lowest line z=' + $minLine) $ok $null
                }
                Invoke-Check 'run-lang-sets-language-id' {
                    $s = $pres.Slides(3)
                    $en = Find-Run $s 'Default English.'
                    $fr = Find-Run $s 'Bonjour le monde.'
                    $ja = Find-Run $s ([string][char]0x3053) -StartsWith
                    $e = $en.LanguageID; $f = $fr.LanguageID; $j = $ja.LanguageID
                    Result 'English run 1033, French run 1036, Japanese run 1041; French differs from the deck (English)' ('en=' + $e + ', fr=' + $f + ', ja=' + $j) (($f -eq 1036) -and ($j -eq 1041) -and ($e -eq 1033) -and ($f -ne $e)) 'TextRange.LanguageID'
                }
            }
        }

        'FA-14' {
            $muted = HexToBgr $sidecar.muted
            Invoke-Check 'slide1-series-highlight-accent1-vs-muted' {
                $sh = Get-ChartShape $pres.Slides(1); $chart = $sh.Chart
                $col = $chart.SeriesCollection()
                $s1 = $col.Item(1); $s2 = $col.Item(2)
                $f1 = $s1.Format.Fill.ForeColor; $f2 = $s2.Format.Fill.ForeColor
                $a1 = Get-ThemeColor $pres 5
                $ok = ($f1.ObjectThemeColor -eq 5) -and ([int64]$f1.RGB -eq $a1) -and ([int64]$f2.RGB -eq $muted) -and ($f2.ObjectThemeColor -ne 5)
                Result ('series 1 (North) ObjectThemeColor 5 (accent1 ' + (Hex $a1) + '); series 2 (South) RGB ' + $sidecar.muted) ('series1 theme=' + $f1.ObjectThemeColor + ' rgb=' + (Hex $f1.RGB) + '; series2 theme=' + $f2.ObjectThemeColor + ' rgb=' + (Hex $f2.RGB)) $ok 'msoThemeColorAccent1 = 5'
            }
            Invoke-Check 'slide2-category-highlight-point-differs' {
                $sh = Get-ChartShape $pres.Slides(2); $chart = $sh.Chart
                $s1 = $chart.SeriesCollection().Item(1)
                $pts = $s1.Points()
                $p1 = $pts.Item(1).Format.Fill.ForeColor; $p2 = $pts.Item(2).Format.Fill.ForeColor
                $a1 = Get-ThemeColor $pres 5
                $ok = ([int64]$p1.RGB -ne [int64]$p2.RGB) -and ([int64]$p1.RGB -eq $muted) -and ([int64]$p2.RGB -eq $a1)
                Result ('Points(2) (Q2) accent1 ' + (Hex $a1) + ', Points(1) muted ' + $sidecar.muted + ', fills differ') ('point1=' + (Hex $p1.RGB) + ' theme=' + $p1.ObjectThemeColor + '; point2=' + (Hex $p2.RGB) + ' theme=' + $p2.ObjectThemeColor) $ok $null
            }
            Invoke-Check 'slide3-pie-highlight-slice-accent1-others-muted' {
                $sh = Get-ChartShape $pres.Slides(3); $chart = $sh.Chart
                $pts = $chart.SeriesCollection().Item(1).Points()
                $c = @(); for ($i = 1; $i -le 3; $i++) { $c += , $pts.Item($i).Format.Fill.ForeColor }
                $a1 = Get-ThemeColor $pres 5
                $ok = ([int64]$c[1].RGB -eq $a1) -and ([int64]$c[0].RGB -eq $muted) -and ([int64]$c[2].RGB -eq $muted)
                Result ('slice 2 (APAC) accent1 ' + (Hex $a1) + '; slices 1 and 3 muted ' + $sidecar.muted) ('slice1=' + (Hex $c[0].RGB) + ' slice2=' + (Hex $c[1].RGB) + ' (theme ' + $c[1].ObjectThemeColor + ') slice3=' + (Hex $c[2].RGB)) $ok $null
            }
            Invoke-Check 'slide4-line-category-highlight-opens' {
                $sh = Get-ChartShape $pres.Slides(4)
                if ($null -eq $sh) { return (Result 'a line chart with 2 series and 4 points' 'chart missing (repaired away)' $false $null) }
                $chart = $sh.Chart
                $n = $chart.SeriesCollection().Count
                $pts = $chart.SeriesCollection().Item(1).Points().Count
                Result 'line chart present, 2 series, 4 points per series' ('ChartType=' + $chart.ChartType + ', series=' + $n + ', points=' + $pts) (($n -eq 2) -and ($pts -eq 4)) $null
            }
            Invoke-Check 'slide4-line-point-3-colour-info' {
                $sh = Get-ChartShape $pres.Slides(4); $chart = $sh.Chart
                $pts = $chart.SeriesCollection().Item(1).Points()
                $p1 = $pts.Item(1); $p3 = $pts.Item(3)
                Result 'informational: point 3 (Q3) marker accent1 (5), others muted' ('point1 marker=' + (Hex $p1.MarkerBackgroundColor) + ' fill theme=' + $p1.Format.Fill.ForeColor.ObjectThemeColor + '; point3 marker=' + (Hex $p3.MarkerBackgroundColor) + ' fill theme=' + $p3.Format.Fill.ForeColor.ObjectThemeColor) $null 'not part of the FA-14 acceptance list; compare with the dPt in expect.md'
            }
        }

        'FA-15' {
            $sh = Get-ChartShape $pres.Slides(1)
            Invoke-Check 'chart-present' {
                Result 'a native chart on slide 1' $(if ($sh) { 'HasChart=' + $sh.HasChart } else { 'missing (repaired away)' }) ($null -ne $sh) $null
            }
            Invoke-Check 'two-series' {
                $n = $sh.Chart.SeriesCollection().Count
                Result 2 $n ($n -eq 2) $null
            }
            Invoke-Check 'series1-clustered-column' {
                $t = $sh.Chart.SeriesCollection().Item(1).ChartType
                Result '51 (xlColumnClustered)' $t ($t -eq 51) $null
            }
            Invoke-Check 'series2-line-with-markers' {
                $t = $sh.Chart.SeriesCollection().Item(2).ChartType
                Result '65 (xlLineMarkers)' $t ($t -eq 65) $null
            }
            Invoke-Check 'series2-secondary-axis-group' {
                $g = $sh.Chart.SeriesCollection().Item(2).AxisGroup
                Result '2 (xlSecondary)' $g ($g -eq 2) $null
            }
            Invoke-Check 'secondary-value-axis-number-format-0pct' {
                $f = $sh.Chart.Axes(2, 2).TickLabels.NumberFormat
                Result '0%' $f ($f -eq '0%') 'Axes(xlValue=2, xlSecondary=2)'
            }
            Invoke-Check 'primary-value-axis-number-format-info' {
                $f = $sh.Chart.Axes(2, 1).TickLabels.NumberFormat
                Result 'informational: primary axis uses the first column series format ($#,##0.0)' $f $null $null
            }
        }

        default { Emit 'unknown-item' 'FA-05, FA-09, FA-11, FA-12, FA-13, FA-14 or FA-15' $Item $false $null }
    }
}
finally {
    Close-Quietly $pres
    try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($pres) } catch {}
}
