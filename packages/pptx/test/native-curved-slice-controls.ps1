param([string]$ScriptPath='', [Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop'
if($ScriptPath -eq '') {$ScriptPath=Join-Path $PSScriptRoot 'native-furniture-control.ps1'}
if(Test-Path -LiteralPath $ReportPath){throw 'Preserve the earlier report; choose a fresh output'}
$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($ScriptPath,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors | Out-String)}
$definition=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-FurnitureCurvedSliceBounds'},$true)
if($null -eq $definition){throw 'Missing independently reviewed pure curved-bounds function'}
function Stop-FurnitureLifecycle([string]$Message){throw ('REFUSED: '+$Message)}
Invoke-Expression $definition.Extent.Text
function Point([double]$x,[double]$y){return [pscustomobject]@{x=$x;y=$y}}
function Arc([double]$cx,[double]$cy,[double]$r,[double]$start,[double]$end){
    $points=New-Object 'System.Collections.Generic.List[object]'
    foreach($angle in @($start,($start/2+$end/2),$end)){$a=$angle*[math]::PI/180;$points.Add((Point ($cx+$r*[math]::Cos($a)) ($cy+$r*[math]::Sin($a))))}
    return ,$points.ToArray()
}
$cases=New-Object 'System.Collections.Generic.List[object]'
function Accept([string]$Name,$Center,$Outer,$Inner,$Expected,[bool]$Full=$false){
    $result=Get-FurnitureCurvedSliceBounds $Center $Outer $Inner
    $values=@($result.left,$result.top,$result.width,$result.height)
    for($i=0;$i -lt 4;$i++){if([math]::Abs($values[$i]-$Expected[$i]) -gt 0.0000001){throw "$Name independent analytic bound differs at$i"}}
    if($result.fullCircle -ne $Full){throw "$Name changed the independently observed closure"}
    $cases.Add([ordered]@{name=$Name;bounds=$values;fullCircle=$Full;passed=$true})
}
function Refuse([string]$Name,$Center,$Outer,$Inner=$null){
    $rejected=$false;try{$null=Get-FurnitureCurvedSliceBounds $Center $Outer $Inner}catch{if(-not $_.Exception.Message.StartsWith('REFUSED:')){throw};$rejected=$true}
    if(-not $rejected){throw "$Name silently accepted an unmeasurable curve"}
    $cases.Add([ordered]@{name=$Name;refused=$true;passed=$true})
}
$c=Point 100 200;$root3=[math]::Sqrt(3)
Accept 'wide-arc-includes-left-cardinal' $c (Arc 100 200 40 0 240) $null @(60,(200-20*$root3),80,(40+20*$root3))
Accept 'upper-half' $c (Arc 100 200 40 180 360) $null @(60,160,80,40)
Accept 'lower-half' $c (Arc 100 200 40 0 180) $null @(60,200,80,40)
Accept 'wraps-zero-angle' $c (Arc 100 200 40 300 420) $null @(100,(200-20*$root3),40,(40*$root3))
Accept 'reversed-endpoints-same-observed-middle' $c (Arc 100 200 40 60 -60) $null @(100,(200-20*$root3),40,(40*$root3))
Accept 'complete-circle' $c (Arc 100 200 40 0 360) $null @(60,160,80,80) $true
Accept 'almost-complete-circle-keeps-extrema' $c (Arc 100 200 40 10 369) $null @(60,160,80,80)
Accept 'closed-within-native-resolution' $c (Arc 100 200 40 0 359.999999) $null @(60,160,80,80) $true
Accept 'translated-negative-chart-local-coordinates' (Point -50 20) (Arc -50 20 25 180 360) $null @(-75,-5,50,25)
Accept 'annular-sector-excludes-empty-center' $c (Arc 100 200 40 0 60) (Arc 100 200 20 0 60) @(110,200,30,(20*$root3))
Accept 'annular-full-circle' $c (Arc 100 200 40 0 360) (Arc 100 200 20 0 360) @(60,160,80,80) $true
Refuse 'missing-center' $null (Arc 100 200 40 0 90)
Refuse 'missing-outer-observation' $c @((Point 140 200),(Point 100 240))
$bad=Arc 100 200 40 0 90;$bad[1].x=[double]::NaN;Refuse 'nonfinite-outer' $c $bad
$bad=Arc 100 200 40 0 90;$bad[1].y=[double]::PositiveInfinity;Refuse 'infinite-outer' $c $bad
Refuse 'nonfinite-center' (Point ([double]::NaN) 200) (Arc 100 200 40 0 90)
Refuse 'zero-radius' $c (Arc 100 200 0 0 90)
Refuse 'radius-below-observation-resolution' $c (Arc 100 200 0.0001 0 90)
Refuse 'zero-sweep-not-a-full-circle' $c (Arc 100 200 40 0 0)
Refuse 'near-zero-sweep-not-a-full-circle' $c (Arc 100 200 40 0 0.00000001)
$bad=Arc 100 200 40 0 90;$bad[1]=Point 100 230;Refuse 'mismatched-outer-radius' $c $bad
$bad=Arc 100 200 40 0 90;$bad[1]=(Arc 100 200 40 20 20)[0];Refuse 'middle-does-not-establish-half-sweep' $c $bad
Refuse 'inner-outside-outer' $c (Arc 100 200 40 0 90) (Arc 100 200 50 0 90)
Refuse 'inner-missing-observation' $c (Arc 100 200 40 0 90) @((Point 120 200),(Point 100 220))
$bad=Arc 100 200 20 0 90;$bad[1].x=[double]::NaN;Refuse 'nonfinite-inner' $c (Arc 100 200 40 0 90) $bad
Refuse 'inner-wrong-sweep' $c (Arc 100 200 40 0 90) (Arc 100 200 20 10 100)
$report=[ordered]@{passed=$true;officeConstructed=$false;observedNativeAvailabilityClaimed=$false;cases=@($cases.ToArray())}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Output ('Pure independent curved bounds: '+$cases.Count+' analytic/refusal controls, no Office')
