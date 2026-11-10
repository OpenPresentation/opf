param([Parameter(Mandatory=$true)][string]$Wrapper,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
$mockOutput=$Output
if(Test-Path -LiteralPath $Output) {throw 'Select fresh fake integration output'}
[void](New-Item -ItemType Directory -Path $Output)
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Wrapper,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Actual wrapper parse failed'}
foreach($name in @('Test-ReferenceWitnessPostflightInteger','Test-ReferenceWitnessPostflightReady','Invoke-ReferenceWitnessPostflight')) {$found=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($found.Count -ne 1){throw 'Missing/duplicate qualified function'};Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')}
$source=[IO.File]::ReadAllText($Wrapper);$begin='    # BEGIN QUALIFIED POSTFLIGHT INTEGRATION';$end='    # END QUALIFIED POSTFLIGHT INTEGRATION'
if(($source.Split(@($begin),[StringSplitOptions]::None).Count -ne 2) -or ($source.Split(@($end),[StringSplitOptions]::None).Count -ne 2)){throw 'Unique actual integration anchors required'}
$block=$source.Substring($source.IndexOf($begin)+$begin.Length,$source.IndexOf($end)-$source.IndexOf($begin)-$begin.Length)
$transforms=@(
 @("@([Diagnostics.Process]::GetProcessesByName('POWERPNT') | ForEach-Object {`$_.Id})",'@([SegmentPostflightFake]::Query())'),
 @('[Diagnostics.Stopwatch]::StartNew()','[SegmentPostflightWatch]::new()'),
 @('[Threading.Thread]::Sleep($milliseconds)','[SegmentPostflightFake]::Delay($milliseconds)')
)
$changes=@();foreach($t in $transforms){if($block.Split(@($t[0]),[StringSplitOptions]::None).Count -ne 2){throw 'Unique fake-only primitive anchor required'};$block=$block.Replace($t[0],$t[1]);$changes+=@([ordered]@{before=$t[0];after=$t[1]})}
if($block.Contains('[Diagnostics.Process]') -or $block.Contains('Invoke-OpfNativeWorker') -or $block.Contains('Get-Process') -or $block.Contains('New-Object -ComObject')){throw 'Native primitive survived test-only transform'}
# The wrapper BOOTSTRAP/worker/supervisor are NOT evaluated. Only its actual post-completed-worker integration is evaluated.
$script:unexpectedNativeCalls=0
function global:Get-Process {$script:unexpectedNativeCalls++;throw 'Forbidden live process query'}
function global:Start-Process {$script:unexpectedNativeCalls++;throw 'Forbidden process launch'}
function global:Stop-Process {$script:unexpectedNativeCalls++;throw 'Forbidden process termination'}
function global:New-Object {param([string]$TypeName,[object[]]$ArgumentList,[string]$ComObject);if($ComObject){$script:unexpectedNativeCalls++;throw 'Forbidden COM factory'};return Microsoft.PowerShell.Utility\New-Object @PSBoundParameters}
Add-Type -TypeDefinition @"
using System;using System.Collections.Generic;
public static class SegmentPostflightFake {
 public static string Mode;public static double Time;public static int Queries;public static int Delays;public static List<string> Calls=new List<string>();
 public static void Reset(string mode){Mode=mode;Time=0;Queries=0;Delays=0;Calls.Clear();}
 public static int[] Query(){Calls.Add("query");Queries++;if(Mode=="queryFault")throw new Exception("managed query fault");if(Mode=="lateZero"){Time=5000;return new int[0];}if(Mode=="delayed")return Queries<=2?new[]{6328}:new int[0];if(Mode=="persistent"||Mode=="frozenClock")return new[]{6328};if(Mode=="newPid")return Queries==1?new[]{6328}:new[]{9999};return new int[0];}
 public static void Delay(int ms){Calls.Add("delay");if(ms!=100)throw new Exception("Cadence changed");Delays++;if(Mode!="frozenClock")Time+=100;}
}
public sealed class SegmentPostflightWatch {public TimeSpan Elapsed{get{return TimeSpan.FromMilliseconds(SegmentPostflightFake.Time);}}public void Stop(){SegmentPostflightFake.Calls.Add("watch.stop");}}
"@
function Invoke-SegmentPostflightFakeNode {param([Parameter(ValueFromRemainingArguments=$true)][object[]]$Arguments);[SegmentPostflightFake]::Calls.Add('identity.verify');if(($Arguments -join '|') -cnotmatch 'verify-execution\|--envelope\|'){throw 'Identity recheck call changed'};$global:LASTEXITCODE=if([SegmentPostflightFake]::Mode -ceq 'identityFault'){1}else{0}}
function Require($Condition,[string]$Message){if(-not $Condition){throw $Message}}
function New-Report {return ('{"error":null,"cleanupConfirmed":true,"officeOperationsStopped":false,"lastStage":"worker.complete","lastStatus":"success","actions":[],"opens":[{"phase":"original","readOnly":-1},{"phase":"saved-reopened","readOnly":-1}],"closes":2,"saveCopies":1,"quits":1}'|ConvertFrom-Json)}
$cases=[Collections.Generic.List[object]]::new()
foreach($mode in @('immediate','delayed','persistent','newPid','frozenClock','lateZero','queryFault','identityFault')){$cases.Add([pscustomobject]@{name=$mode;mode=$mode;change=$null;success=($mode -in @('immediate','delayed'));noQuery=($mode -ceq 'identityFault')})}
foreach($pair in @(@('cleanupConfirmed',$false),@('officeOperationsStopped',$true),@('error','failed'),@('lastStage','worker.failed'),@('lastStatus','error'),@('closes',1),@('saveCopies',2),@('quits',0))){$key=$pair[0];$value=$pair[1];$mutation={param($t,$r)$r.$key=$value}.GetNewClosure();$cases.Add([pscustomobject]@{name=('bad-'+$key);mode='immediate';change=$mutation;success=$false;noQuery=$true})}
$extras=@(
 @('worker-exit1',{param($t,$r)$t.exitCode=1}),@('worker-timeout',{param($t,$r)$t.timedOut=$true}),@('string-exit',{param($t,$r)$t.exitCode='0'}),
 @('missing-error',{param($t,$r)$r.PSObject.Properties.Remove('error')}),@('wrong-readonly',{param($t,$r)$r.opens[0].readOnly=0}),@('string-readonly',{param($t,$r)$r.opens[0].readOnly='-1'}),
 @('wrong-phase',{param($t,$r)$r.opens[0].phase='saved-reopened'}),@('wrong-open-count',{param($t,$r)$r.opens=@($r.opens[0])}),@('edit-action',{param($t,$r)$r.actions=@([pscustomobject]@{type='edit'})}),
 @('string-close-count',{param($t,$r)$r.closes='2'}),@('nonboolean-cleanup',{param($t,$r)$r.cleanupConfirmed=1})
)
foreach($x in $extras){$cases.Add([pscustomobject]@{name=$x[0];mode='immediate';change=$x[1];success=$false;noQuery=$true})}
$results=@()
foreach($case in $cases){
 [SegmentPostflightFake]::Reset($case.mode);$terminal=(' {"timedOut":false,"exitCode":0}'|ConvertFrom-Json);$r=New-Report;if($null -ne $case.change){&$case.change $terminal $r}
 $native=Join-Path $mockOutput $case.name;[void](New-Item -ItemType Directory -Path $native);$r|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $native 'report.json') -Encoding UTF8
 $profile=[pscustomobject]@{profile='b07-independent-segments-readonly-v1'};$NodeExecutable='Invoke-SegmentPostflightFakeNode';$validator='profile.mjs';$ownedEnvelope='synthetic-envelope.json';$ExpectedEnvelopeSha256=('0'*64);$output=$native;$failure=$null
 try{Invoke-Expression $block}catch{$failure=$_.Exception.Message}
 $reportPath=Join-Path $native 'supervisor.json';$supervisor=$null;if(Test-Path -LiteralPath $reportPath){$supervisor=Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8|ConvertFrom-Json}
 if($case.success){Require ($null -eq $failure -and $supervisor.cleanupConfirmed -ceq $true -and $supervisor.workerCleanupConfirmed -ceq $true) ('Success failed: '+$case.name+' '+$failure)}else{Require ($null -ne $failure) ('Failure promoted: '+$case.name)}
 Require ([SegmentPostflightFake]::Queries -le 51) 'Query bound widened'
 if($case.noQuery){Require ([SegmentPostflightFake]::Queries -eq 0 -and [SegmentPostflightFake]::Delays -eq 0 -and -not(Test-Path -LiteralPath (Join-Path $native 'postflight.jsonl'))) ('Failed worker/identity queried: '+$case.name)}
 else{Require ([SegmentPostflightFake]::Calls[0] -ceq 'identity.verify') 'Query preceded runtime/source revalidation';Require ((Get-Item -LiteralPath (Join-Path $native 'postflight.jsonl')).Length -gt 0) 'Read-only samples not persisted'}
 if($case.mode -ceq 'delayed'){Require ([SegmentPostflightFake]::Queries -eq 3 -and $supervisor.postflight.initialProcessIds[0] -eq 6328 -and $supervisor.postflight.finalCount -eq 0 -and $supervisor.postflight.sampleCount -eq 3) 'Initial PID/delayed zero lost'}
 if($case.mode -ceq 'persistent'){Require ([SegmentPostflightFake]::Queries -eq 50 -and $failure -match 'cleanup is unconfirmed') 'Deadline not propagated';Require ($supervisor.postflightError -match 'deadline') 'Deadline cause lost'}
 if($case.mode -ceq 'frozenClock'){Require ([SegmentPostflightFake]::Queries -eq 51 -and $supervisor.postflightError -match 'query bound') 'Frozen clock exceeded fixed cap'}
 if($case.mode -ceq 'newPid'){Require ([SegmentPostflightFake]::Queries -eq 2 -and $supervisor.postflightError -match 'new global process') 'New process was retried/accepted'}
 if($case.mode -ceq 'lateZero'){Require ([SegmentPostflightFake]::Queries -eq 1 -and $supervisor.postflightError -match 'late zero') 'Late zero promoted'}
 if($case.mode -ceq 'queryFault'){Require ([SegmentPostflightFake]::Queries -eq 1 -and $supervisor.postflightError -match 'managed query fault') 'Query error retried'}
 Require ($script:unexpectedNativeCalls -eq 0) 'A native primitive escaped injection'
 $results+=@([ordered]@{name=$case.name;passed=$true;queries=[SegmentPostflightFake]::Queries;delays=[SegmentPostflightFake]::Delays;calls=@([SegmentPostflightFake]::Calls);failure=$failure;supervisor=$supervisor})
}
[ordered]@{status='PASS';officeInvoked=$false;realProcessQueries=0;inMemoryTransforms=$changes;tests=$results.Count;results=$results;scope='Actual wrapper post-completed-worker integration block with exactly3 test-only native-primitive substitutions; bootstrap/worker/supervisor never evaluated. Node identity command is a test fake; guarded actual default wrappers qualify admission separately.'}|ConvertTo-Json -Depth 40|Set-Content -LiteralPath (Join-Path $mockOutput 'integration-results.json') -Encoding UTF8
Write-Output ('PASS '+$results.Count+' actual wrapper integration fake controls; Office/live process queries:0')
