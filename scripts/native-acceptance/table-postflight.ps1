# Definitions only. Fixed six-table operation grammar, never inferred from a stage-name list.
function Get-TablePostflightOperations($Generation) {
    if($Generation.expected.Count -ne 6) {throw 'Six canonical table contracts required'}
    $names=[Collections.Generic.List[string]]::new()
    foreach($n in @('worker.initialize','application.create','application.initial.count','application.version','application.path')) {$names.Add($n)}
    foreach($phase in @('original','reopened','edited')) {
        foreach($n in @('preflight.count','open','fullName','readOnly','slides.count')) {$names.Add("$phase.$n")}
        for($i=1;$i -le 6;$i++) {
            foreach($n in @('get','shapes','shape','hasTable','table','rows','columns')) {$names.Add("$phase.slide.$i.$n")}
            if($Generation.expected[$i-1].cells.Count -ne 4) {throw 'Four canonical cells required'}
            $position=0;$canonical=@(@{texts=@('Header')},@{texts=@('Inherited','Explicit')},@{texts=@('Body')},@{texts=@('BodyInherited','BodyExplicit')})
            foreach($cell in $Generation.expected[$i-1].cells) {
                $row=[Math]::Floor($position/2)+1;$column=($position%2)+1
                if($cell.row -ne $row -or $cell.column -ne $column -or $cell.runs.Count -ne $canonical[$position].texts.Count) {throw 'Noncanonical bounded table cell'}
                for($run=0;$run -lt $canonical[$position].texts.Count;$run++) {if($cell.runs[$run].text -isnot [string] -or $cell.runs[$run].text -cne $canonical[$position].texts[$run]) {throw 'Noncanonical bounded table text'}}
                $position++
                $base="$phase.slide.$i.cell.$($cell.row).$($cell.column)"
                $text=($cell.runs | ForEach-Object {$_.text}) -join ''
                if($phase -ceq 'edited' -and $cell.row -eq 2 -and $cell.column -eq 1) {$text='Native '+$text}
                foreach($n in @('range','text')) {$names.Add("$base.$n")}
                for($k=1;$k -le $text.Length;$k++) {$names.Add("$base.character.$k.color")}
            }
            $names.Add("$phase.slide.$i.capture")
        }
        if($phase -ceq 'original') {foreach($n in @('save.fullName','saveCopyAs','save.afterName')) {$names.Add("original.$n")}}
        if($phase -ceq 'reopened') {
            for($i=1;$i -le 6;$i++) {foreach($n in @('get','shapes','shape','hasTable','table','rows','columns','range','before','prefix','after')) {$names.Add("edit.slide.$i.$n")}}
            foreach($n in @('save.fullName','saveCopyAs','save.afterName')) {$names.Add("edited.$n")}
        }
        foreach($n in @('close.fullName','close.discard','close')) {$names.Add("$phase.$n")}
    }
    foreach($n in @('application.final.count','application.quit','worker.complete')) {$names.Add($n)}
    return $names.ToArray()
}
function Test-TablePostflightReady($Terminal,$Evidence) {
    try {
        if(-not (Test-OwnedPostflightCommonReady $Terminal $Evidence 'table-colors-v3' 'table-bounded-global-zero-after-completed-owned-quit-v1' 3 2 3 6)) {return $false}
        $r=$Evidence.report;$q=$Evidence.request;$s=$Evidence.stages;$g=$Evidence.generation
        if($r.schemaVersion -ne 3 -or $r.opens -isnot [array] -or $r.opens.Count -ne 3 -or $r.edits -isnot [array] -or $r.edits.Count -ne 6) {return $false}
        if(-not (Test-OwnedPostflightOperations $s @(Get-TablePostflightOperations $g))) {return $false}
        $successes=@{};foreach($stage in $s) {if($stage.status -ceq 'success') {$successes[$stage.stage]=$stage}}
        if(($Evidence.progress | ConvertTo-Json -Compress -Depth 10) -cne ($s[-1] | ConvertTo-Json -Compress -Depth 10) -or $s[-1].cleanupConfirmed -isnot [bool] -or -not $s[-1].cleanupConfirmed -or $null -ne $s[-1].ownedPresentationPath) {return $false}
        foreach($name in @('application.initial.count','original.preflight.count','reopened.preflight.count','edited.preflight.count','application.final.count')) {
            $v=(Get-OwnedPostflightSuccess $successes $name).value
            if(-not (Test-OwnedPostflightInteger $v) -or $v -ne 0) {return $false}
        }
        $phases=@('original','reopened','edited');$files=@('table-colors.pptx','table-colors-saved.pptx','table-colors-edited.pptx')
        for($i=0;$i -lt 3;$i++) {
            $p=$phases[$i];$file=Join-Path $q.nativeRoot $files[$i];$open=$r.opens[$i]
            if($open.phase -cne $p -or $open.path -cne $file -or -not (Test-OwnedPostflightInteger $open.readOnly) -or $open.readOnly -ne -1 -or $r.$p.Count -ne 6) {return $false}
            foreach($name in @("$p.fullName","$p.close.fullName")) {if((Get-OwnedPostflightSuccess $successes $name).value -cne $file) {return $false}}
            $v=(Get-OwnedPostflightSuccess $successes "$p.readOnly").value
            if(-not (Test-OwnedPostflightInteger $v) -or $v -ne -1) {return $false}
            for($slide=1;$slide -le 6;$slide++) {
                foreach($pair in @(@('shapes',1),@('hasTable',-1),@('rows',2),@('columns',2))) {
                    $v=(Get-OwnedPostflightSuccess $successes "$p.slide.$slide.$($pair[0])").value
                    if(-not (Test-OwnedPostflightInteger $v) -or $v -ne $pair[1]) {return $false}
                }
            }
        }
        $owned=$null
        foreach($stage in $s) {
            $phase=($stage.stage -split '\.')[0]
            if($phase -cin $phases -and $stage.stage -ceq "$phase.open" -and $stage.status -ceq 'begin') {$owned=Join-Path $q.nativeRoot $files[[Array]::IndexOf($phases,$phase)]}
            if($stage.PSObject.Properties.Name -cnotcontains 'ownedPresentationPath' -or $stage.ownedPresentationPath -cne $owned) {return $false}
            if($phase -cin $phases -and $stage.stage -ceq "$phase.close" -and $stage.status -ceq 'success') {$owned=$null}
        }
        foreach($phase in $phases) {
            for($i=1;$i -le 6;$i++) {
                if($r.$phase[$i-1].cells.Count -ne 4) {return $false}
                for($position=0;$position -lt 4;$position++) {
                    $cell=$g.expected[$i-1].cells[$position];$actual=$r.$phase[$i-1].cells[$position]
                    $prefix=if($phase -ceq 'edited' -and $cell.row -eq 2 -and $cell.column -eq 1) {'Native '} else {''}
                    $text=$prefix+(($cell.runs | ForEach-Object {$_.text}) -join '')
                    $colors=[Collections.Generic.List[string]]::new()
                    for($k=0;$k -lt $prefix.Length;$k++) {$colors.Add($cell.runs[0].color)}
                    foreach($run in $cell.runs) {for($k=0;$k -lt $run.text.Length;$k++) {$colors.Add($run.color)}}
                    $base="$phase.slide.$i.cell.$($cell.row).$($cell.column)"
                    if($actual.row -ne $cell.row -or $actual.column -ne $cell.column -or $actual.text -cne $text -or $actual.characters.Count -ne $text.Length -or (Get-OwnedPostflightSuccess $successes "$base.text").value -cne $text) {return $false}
                    for($k=0;$k -lt $text.Length;$k++) {
                        $rgb=(Get-OwnedPostflightSuccess $successes "$base.character.$($k+1).color").value
                        if(-not (Test-OwnedPostflightInteger $rgb) -or $rgb -lt 0 -or $rgb -gt 16777215) {return $false}
                        $color='#{0:X2}{1:X2}{2:X2}' -f ($rgb -band 255),(($rgb -shr 8) -band 255),(($rgb -shr 16) -band 255)
                        if($color -cne $colors[$k] -or $actual.characters[$k].color -cne $color -or $actual.characters[$k].character -cne $text.Substring($k,1)) {return $false}
                    }
                }
            }
        }
        for($i=1;$i -le 6;$i++) {
            $edit=$r.edits[$i-1];$cell=@($g.expected[$i-1].cells | Where-Object {$_.row -eq 2 -and $_.column -eq 1})
            if($cell.Count -ne 1) {return $false};$before=($cell[0].runs | ForEach-Object {$_.text}) -join ''
            if($edit.slide -ne $i -or $edit.row -ne 2 -or $edit.column -ne 1 -or $edit.before -cne $before -or $edit.after -cne ('Native '+$before) -or $edit.prefix -cne 'Native ') {return $false}
        }
        return $true
    } catch {return $false}
}

