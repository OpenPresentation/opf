# Definitions only, imported into the shared observer invocation's local scope.
function Get-SevenPostflightOperations($Report) {
    $names=[Collections.Generic.List[string]]::new()
    foreach($n in @('worker.initialize','application.create','application.initial.presentations','application.initial.count','application.version','application.path')) {$names.Add($n)}
    foreach($phase in @('original','saved-reopened')) {
        foreach($n in @('preflight.presentations','preflight.count','open','fullName','readOnly','slides','slides.count')) {$names.Add("$phase.$n")}
        if($Report.phases.$phase.slides.Count -ne 7) { throw 'Seven complete phase required' }
        for($i=1;$i -le 7;$i++) {
            $slide=$Report.phases.$phase.slides[$i-1];if($slide.shapeCount -ne 2 -or $slide.shapes.Count -ne 2) {throw 'Exact title/chart pair required'}
            foreach($n in @('get','id','name','shapes','shapes.count')) {$names.Add("$phase.slide.$i.$n")}
            for($j=1;$j -le 2;$j++) {
                foreach($n in @('get','id','name','type','left','top','width','height','rotation','hasTextFrame','alternativeText')) {$names.Add("$phase.slide.$i.shape.$j.$n")}
                $flag=$slide.shapes[$j-1].hasTextFrame
                if(-not (Test-OwnedPostflightInteger $flag) -or $flag -notin @(-1,0)) {throw 'Unsupported actual text-frame flag'}
                if($flag -eq -1) {foreach($n in @('textFrame','textRange','text')) {$names.Add("$phase.slide.$i.shape.$j.$n")}}
            }
            $names.Add("$phase.slide.$i.export")
        }
        if($phase -ceq 'original') {foreach($n in @('copy.fullName','copy.saveCopyAs','copy.afterName')) {$names.Add($n)}}
        foreach($n in @('close.fullName','close.discard','close')) {$names.Add("$phase.$n")}
    }
    foreach($n in @('application.final.presentations','application.final.count','application.quit','worker.complete')) {$names.Add($n)}
    return $names.ToArray()
}
function Test-SevenPostflightReady($Terminal,$Evidence) {
    try {
        if(-not (Test-OwnedPostflightCommonReady $Terminal $Evidence 'seven-chart-original-readonly-v2' 'seven-bounded-global-zero-after-completed-owned-quit-v1' 2 1 2 0)) {return $false}
        $r=$Evidence.report;$q=$Evidence.request;$s=$Evidence.stages
        if($r.schemaVersion -ne 2 -or $r.actions -isnot [array] -or $r.actions.Count -ne 0 -or $r.opens -isnot [array] -or $r.opens.Count -ne 2 -or $r.closes -ne 2 -or $r.saveCopies -ne 1 -or $r.quits -ne 1) {return $false}
        foreach($stage in $s) {if($stage.PSObject.Properties.Name -ccontains 'ownedPresentationPath') {return $false}}
        if(-not (Test-OwnedPostflightOperations $s @(Get-SevenPostflightOperations $r))) {return $false}
        $successes=@{};foreach($stage in $s) {if($stage.status -ceq 'success') {$successes[$stage.stage]=$stage}}
        foreach($count in @($r.closes,$r.saveCopies,$r.quits)) {if(-not (Test-OwnedPostflightInteger $count)) {return $false}}
        foreach($name in @('application.initial.count','original.preflight.count','saved-reopened.preflight.count','application.final.count')) {
            $value=(Get-OwnedPostflightSuccess $successes $name).value
            if(-not (Test-OwnedPostflightInteger $value) -or $value -ne 0) {return $false}
        }
        $paths=@((Join-Path $q.output 'inputs/case.pptx'),(Join-Path $q.nativeRoot 'saved.pptx'));$phases=@('original','saved-reopened')
        for($i=0;$i -lt 2;$i++) {
            $phase=$phases[$i];$open=$r.opens[$i]
            if($open.phase -cne $phase -or $open.path -cne $paths[$i] -or -not (Test-OwnedPostflightInteger $open.readOnly) -or $open.readOnly -ne -1) {return $false}
            foreach($name in @("$phase.fullName","$phase.close.fullName")) {if((Get-OwnedPostflightSuccess $successes $name).value -cne $paths[$i]) {return $false}}
            $readonly=(Get-OwnedPostflightSuccess $successes "$phase.readOnly").value
            if(-not (Test-OwnedPostflightInteger $readonly) -or $readonly -ne -1 -or $r.phases.$phase.slideCount -ne 7 -or $r.phases.$phase.rasters.Count -ne 7) {return $false}
            for($slide=1;$slide -le 7;$slide++) {for($shape=1;$shape -le 2;$shape++) {
                $observed=$r.phases.$phase.slides[$slide-1].shapes[$shape-1]
                foreach($property in @('id','name','type','left','top','width','height','rotation','hasTextFrame','alternativeText')) {
                    $value=(Get-OwnedPostflightSuccess $successes "$phase.slide.$slide.shape.$shape.$property").value
                    if($property -cin @('name','alternativeText')) {if($value -isnot [string] -or $observed.$property -isnot [string] -or $value -cne $observed.$property) {return $false}}
                    else {
                        if($value -isnot [int] -and $value -isnot [long] -and $value -isnot [double] -and $value -isnot [decimal]) {return $false}
                        if([double]::IsNaN($value) -or [double]::IsInfinity($value) -or $value -ne $observed.$property) {return $false}
                    }
                }
                if($observed.hasTextFrame -eq -1) {
                    $text=(Get-OwnedPostflightSuccess $successes "$phase.slide.$slide.shape.$shape.text").value
                    if($text -isnot [string] -or $text -cne $observed.text) {return $false}
                }
            }}
        }
        if($r.probes -isnot [array] -or $r.probes.Count -eq 0) {return $false}
        foreach($probe in $r.probes) {if($probe.matched -isnot [bool] -or -not $probe.matched) {return $false}}
        return $s[-1].cleanupConfirmed -ceq $true
    } catch {return $false}
}

