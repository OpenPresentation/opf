param([string]$ScriptPath='', [Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop'
if($ScriptPath -eq ''){$ScriptPath=Join-Path $PSScriptRoot 'native-furniture-control.ps1'}
if(Test-Path -LiteralPath $ReportPath){throw 'Preserve earlier report; select fresh output'}
$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($ScriptPath,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors | Out-String)}
function Stop-FurnitureLifecycle([string]$Message){throw ('REFUSED: '+$Message)}
foreach($name in @('Get-FurnitureNativeCircleCenter','Get-FurnitureCurvedSliceBounds')){$fn=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true);if($null -eq $fn){throw 'Missing pure circle function'};Invoke-Expression $fn.Extent.Text}
function Point([double]$x,[double]$y){return [pscustomobject]@{x=$x;y=$y}}
function Arc([double]$cx,[double]$cy,[double]$r,[double]$start,[double]$end){$points=New-Object 'System.Collections.Generic.List[object]';foreach($angle in @($start,($start/2+$end/2),$end)){$a=$angle*[math]::PI/180;$points.Add((Point ($cx+$r*[math]::Cos($a)) ($cy+$r*[math]::Sin($a))))};return ,$points.ToArray()}
$cases=New-Object 'System.Collections.Generic.List[object]'
function Accept([string]$Name,$Outer,[double]$X,[double]$Y){$center=Get-FurnitureNativeCircleCenter $Outer;if([math]::Abs($center.x-$X) -gt .000001 -or [math]::Abs($center.y-$Y) -gt .000001){throw "$Name independent analytic center differs"};$curve=Get-FurnitureCurvedSliceBounds $center $Outer;if($null -eq $curve){throw 'Observed circle did not produce bounded curve'};$cases.Add([ordered]@{name=$Name;center=@($center.x,$center.y);method=$center.method;passed=$true})}
function Refuse([string]$Name,$Outer){$message=$null;try{$null=Get-FurnitureNativeCircleCenter $Outer}catch{if(-not $_.Exception.Message.StartsWith('REFUSED:')){throw};$message=$_.Exception.Message};if($null -eq $message){throw "$Name silently accepted an unmeasurable center"};$cases.Add([ordered]@{name=$Name;refused=$true;error=$message;passed=$true})}
Accept 'wide' (Arc 100 200 40 0 240) 100 200
Accept 'upper-half' (Arc 100 200 40 180 360) 100 200
Accept 'wraps-zero' (Arc 100 200 40 300 420) 100 200
Accept 'reversed' (Arc 100 200 40 60 -60) 100 200
Accept 'full-circle' (Arc 100 200 40 0 360) 100 200
Accept 'native-resolution-closed' (Arc 100 200 40 0 359.999999) 100 200
Accept 'almost-full' (Arc 100 200 40 10 369) 100 200
Accept 'translated-negative' (Arc -500 200 40 0 240) -500 200
Accept 'bounded-small-arc' (Arc 100 200 40 0 5) 100 200
$raw=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/sh25-native-circle-observations.json') -Raw | ConvertFrom-Json
$nativePoints=@();foreach($index in @(1,2,3)){$v=@($raw.probe.sliceCoordinates | Where-Object {$_.index -eq $index} | Sort-Object location);$nativePoints+=@(Point $v[0].value $v[1].value)}
Accept 'actual-native-three-point-circle' $nativePoints 395.34767569926817 192.96278836183922
Refuse 'missing' $null
Refuse 'missing-point' @((Point 1 0),(Point 0 1))
Refuse 'missing-coordinate' @((Point 1 0),([pscustomobject]@{x=0}),(Point -1 0))
Refuse 'nonnumeric' @((Point 1 0),([pscustomobject]@{x='bad';y=1}),(Point -1 0))
Refuse 'nan' @((Point 1 0),(Point ([double]::NaN) 1),(Point -1 0))
Refuse 'infinite' @((Point 1 0),(Point ([double]::PositiveInfinity) 1),(Point -1 0))
Refuse 'coincident' @((Point 1 0),(Point 1 0),(Point 1 0))
Refuse 'below-native-resolution' (Arc 100 200 .0001 0 180)
Refuse 'collinear' @((Point 0 0),(Point 1 1),(Point 2 2))
Refuse 'ill-conditioned-at-native-precision' @((Point 0 0),(Point 1 .000001),(Point 2 0))
[ordered]@{passed=$true;officeConstructed=$false;productGeometryRead=$false;cases=@($cases.ToArray())}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Output ('Independent native circle center: '+$cases.Count+' analytic/refusal controls, no Office')
