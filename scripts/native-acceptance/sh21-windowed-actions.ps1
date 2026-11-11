# Definitions only. Separate closed route; requires explicit owner windowless exception before native assignment.
function Read-Sh21WindowedProperty($Object,[string]$Property,[string]$Stage) {
    if($Property -cnotin @('Visible','WindowState','Windows','GroupItems','TextFrame2','TextRange','Font','Size')){Stop-SevenLifecycle 'Property outside closed windowed qualification'}
    return ,(Invoke-SevenCom $Stage {if($null -eq $Object){throw 'Missing owned windowed object'};$member=$Object.PSObject.Properties[$Property];if($null -eq $member){throw "Missing windowed property $Property"};return ,$member.get_Value()})
}
function Set-Sh21OwnedWindowed {
    Assert-SevenProbe ($null -ne $script:app -and [object]::ReferenceEquals($script:app,$script:ownedApp) -and $null -eq $script:presentation -and $null -eq $script:ownedPresentation) 'application.window.ownership' 'same verified owned empty application' ($null -ne $script:ownedApp)
    $presentations=Read-SevenPresentations 'application.window.preflight';$count=Read-SevenProperty $presentations 'Count' 'application.window.preflight.count'
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 0) 'application.window.preflight.count' 0 $count
    Invoke-SevenCom 'application.visible.set' {$script:app.Visible=-1}
    $v=Read-Sh21WindowedProperty $script:app 'Visible' 'application.visible';Assert-SevenProbe ((Test-SevenInteger $v) -and $v -eq -1) 'application.visible' (-1) (Get-SevenPrimitive $v)
    Invoke-SevenCom 'application.windowState.set' {$script:app.WindowState=2}
    $v=Read-Sh21WindowedProperty $script:app 'WindowState' 'application.windowState';Assert-SevenProbe ((Test-SevenInteger $v) -and $v -eq 2) 'application.windowState' 2 (Get-SevenPrimitive $v)
}
function Open-Sh21WindowedOwned([string]$Path,[string]$Phase) {
    Assert-SevenProbe ($null -ne $script:app -and $null -ne $script:ownedApp -and [object]::ReferenceEquals($script:app,$script:ownedApp) -and $null -eq $script:presentation -and $null -eq $script:ownedPresentation) "$Phase.applicationOwnership" 'one verified owned empty application' ($null -ne $script:ownedApp)
    $presentations=Read-SevenPresentations "$Phase.preflight";$count=Read-SevenProperty $presentations 'Count' "$Phase.preflight.count";Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 0) "$Phase.preflight.count" 0 $count
    Assert-SevenProbe ((Get-SevenHash $Path) -ceq $script:hashes[$Path]) "$Phase.inputHash" $script:hashes[$Path] (Get-SevenHash $Path)
    $script:cleanup=$false;$script:report.cleanupConfirmed=$false;$script:ownedPath=$Path
    $script:presentation=Invoke-SevenCom "$Phase.open" {$presentations.Open($Path,-1,0,-1)}
    $actual=Read-SevenProperty $script:presentation 'FullName' "$Phase.fullName";Assert-SevenProbe ($actual -is [string] -and [string]::Equals($actual,$Path,[StringComparison]::OrdinalIgnoreCase)) "$Phase.fullName" $Path $actual
    $readonly=Read-SevenProperty $script:presentation 'ReadOnly' "$Phase.readOnly";Assert-SevenProbe ((Test-SevenInteger $readonly) -and $readonly -eq -1) "$Phase.readOnly" (-1) $readonly
    $script:ownedPresentation=$script:presentation
    $windows=Read-Sh21WindowedProperty $script:presentation 'Windows' "$Phase.windows";$count=Read-SevenProperty $windows 'Count' "$Phase.windows.count"
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -eq 1) "$Phase.windows.count" 1 (Get-SevenPrimitive $count)
    $script:report.opens+=@([ordered]@{phase=$Phase;path=$actual;readOnly=$readonly;sha256=(Get-SevenHash $Path)});Write-SevenReport
}
function Read-Sh21WindowedPhase($Target,$Plan,[string]$Phase,[bool]$Edited) {
    Assert-Sh21Owner $Target "$Phase.capture.owner"
    $png=Join-Path $script:root "$Phase.png";Assert-SevenProbe (-not(Test-Path -LiteralPath $png)) "$Phase.png.fresh" $false (Test-Path -LiteralPath $png)
    # Exact historical product-pilot sequence: visible/minimized RO Open, then Export, then materialized GroupItems; not Node.Shapes.
    Invoke-SevenCom "$Phase.export" {$Target.slide.Export($png,'PNG',1280,720)}
    $record=[ordered]@{nodes=@();semanticToNativeIndex=@();frame=[ordered]@{};items=@();raster=[ordered]@{path=$png;sha256=(Get-SevenHash $png)}};$script:report.phases[$Phase]=$record;Write-SevenReport
    $state=if($Edited){'after'}else{'before'};[void](Read-Sh21Nodes $Target $Plan $Phase $state $record)
    foreach($property in @('Left','Top','Width','Height')){$value=Read-SevenProperty $Target.shape $property "$Phase.frame.$property";Assert-SevenProbe (Test-SevenFiniteNumber $value) "$Phase.frame.$property.finite" 'finite' (Get-SevenPrimitive $value);$record.frame[$property]=Get-SevenPrimitive $value}
    $group=Read-Sh21WindowedProperty $Target.shape 'GroupItems' "$Phase.group";$count=Read-SevenProperty $group 'Count' "$Phase.group.count"
    # Dedicated bounded descriptor capture, not a legacy worker cap expansion.
    Assert-SevenProbe ((Test-SevenInteger $count) -and $count -ge 1 -and $count -le 32) "$Phase.group.count" '1..32 materialized items' (Get-SevenPrimitive $count)
    for($i=1;$i -le $count;$i++){
        $shape=Invoke-SevenCom "$Phase.item.$i.get" {$group.Item($i)};$item=[ordered]@{index=$i};$record.items+=@($item);Write-SevenReport
        foreach($property in @('Left','Top','Width','Height','Rotation','Type','HasTextFrame')){$v=Read-SevenProperty $shape $property "$Phase.item.$i.$property";Assert-SevenProbe (Test-SevenFiniteNumber $v) "$Phase.item.$i.$property.finite" 'finite' (Get-SevenPrimitive $v);$item[$property]=Get-SevenPrimitive $v}
        $item.text=$null;$item.fontSize=$null
        if($item.HasTextFrame -eq -1){$f=Read-Sh21WindowedProperty $shape 'TextFrame2' "$Phase.item.$i.frame";$r=Read-Sh21WindowedProperty $f 'TextRange' "$Phase.item.$i.range";$text=Read-SevenProperty $r 'Text' "$Phase.item.$i.text";Assert-SevenProbe ($text -is [string]) "$Phase.item.$i.text.string" 'string' (Get-SevenPrimitive $text);$item.text=$text;$font=Read-Sh21WindowedProperty $r 'Font' "$Phase.item.$i.font";$size=Read-Sh21WindowedProperty $font 'Size' "$Phase.item.$i.font.size";Assert-SevenProbe (Test-SevenFiniteNumber $size) "$Phase.item.$i.font.size.finite" 'finite' (Get-SevenPrimitive $size);$item.fontSize=Get-SevenPrimitive $size}
        Write-SevenReport
    }
    Assert-Sh21Owner $Target "$Phase.capture.finalOwner"
    $script:report.phases[$Phase]=$record;Write-SevenReport
}
