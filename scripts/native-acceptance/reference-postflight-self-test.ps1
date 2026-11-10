param([Parameter(Mandatory=$true)][string]$Wrapper,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Wrapper,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'Wrapper parse failed'}
foreach($name in @('Test-ReferenceWitnessPostflightInteger','Test-ReferenceWitnessPostflightReady','Invoke-ReferenceWitnessPostflight')){
 $found=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($found.Count -ne 1){throw 'Missing/duplicate private function'}
 Invoke-Expression ($found[0].Extent.Text -replace '^function\s+','function script:')
}
function Require($Condition,[string]$Message){if(-not $Condition){throw $Message}}
function New-Report {return ('{"error":null,"cleanupConfirmed":true,"officeOperationsStopped":false,"lastStage":"worker.complete","lastStatus":"success","actions":[],"opens":[{"phase":"original","readOnly":-1},{"phase":"saved-reopened","readOnly":-1}],"closes":2,"saveCopies":1,"quits":1}'|ConvertFrom-Json)}
$terminal=(' {"timedOut":false,"exitCode":0}'|ConvertFrom-Json)
$results=[Collections.Generic.List[object]]::new()
function Scenario([string]$Name,[scriptblock]$Query,[scriptblock]$DelayAction,[string]$ExpectedError,[scriptblock]$Inspect){
 $state=[pscustomobject]@{time=0.0;queries=0;delays=0;rows=[Collections.Generic.List[object]]::new()};$result=$null;$failure=$null
 try{$result=Invoke-ReferenceWitnessPostflight $terminal (New-Report) {$state.queries++; & $Query $state} {$state.time} {([DateTime]::Parse('2026-11-10T00:00:00Z').ToUniversalTime().AddMilliseconds($state.time)).ToString('o')} {param($ms) Require ($ms -eq 100) 'Cadence changed';$state.delays++;if($null -ne $DelayAction){& $DelayAction $state}else{$state.time+=100}} {param($row)$state.rows.Add($row)}}catch{$failure=$_.Exception.Message}
 if($ExpectedError){Require ($null -ne $failure -and $failure -match $ExpectedError) ($Name+': expected '+$ExpectedError+', got '+$failure);Require ($null -eq $result) 'Failure must not return success'}else{Require ($null -eq $failure) ($Name+': '+$failure);Require ($result.observedZero -ceq $true) 'No zero result'}
 & $Inspect $state $result
 $results.Add([ordered]@{name=$Name;status='PASS';queries=$state.queries;delays=$state.delays;rows=@($state.rows);result=$result;failure=$failure})
}
Scenario 'immediate zero: one query/no delay' {} $null '' {param($s,$r)Require ($s.queries -eq 1 -and $s.delays -eq 0 -and $s.rows.Count -eq 1 -and $r.initialCount -eq 0) 'Immediate zero scope'}
Scenario 'delayed global zero retains first PID and every timestamp' {param($s)if($s.queries -le 2){6328}} $null '' {param($s,$r)Require ($s.queries -eq 3 -and $s.rows.Count -eq 3 -and $r.initialCount -eq 1 -and $r.finalCount -eq 0 -and $r.elapsedMilliseconds -eq 200) 'Delayed scope';Require ($s.rows[0].processIds[0] -eq 6328 -and $s.rows[0].elapsedMilliseconds -eq 0 -and $s.rows[1].elapsedMilliseconds -eq 100 -and $s.rows[2].elapsedMilliseconds -eq 200) 'First/every sample lost'}
Scenario 'persistent process reaches finite deadline' {6328} $null 'deadline' {param($s,$r)Require ($s.queries -eq 50 -and $s.delays -eq 50 -and $s.time -eq 5000 -and $s.rows.Count -eq 51 -and $s.rows[-1].status -eq 'failed') 'Deadline widened'}
Scenario 'new global PID fails without another query' {param($s)if($s.queries -eq 1){6328}else{9999}} $null 'new global process' {param($s,$r)Require ($s.queries -eq 2 -and $s.rows[0].processIds[0] -eq 6328 -and $s.rows[1].processIds[0] -eq 9999 -and $s.rows[-1].status -eq 'failed') 'New PID not retained/refused'}
Scenario 'query exception stops immediately' {throw 'managed query fault'} $null 'managed query fault' {param($s,$r)Require ($s.queries -eq 1 -and $s.delays -eq 0 -and $s.rows.Count -eq 1) 'Query retried'}
Scenario 'zero exactly at deadline refused' {param($s)$s.time=5000.0} $null 'late zero' {param($s,$r)Require ($s.queries -eq 1 -and $s.rows[0].processIds.Count -eq 0 -and $s.rows[0].elapsedMilliseconds -eq 5000 -and $s.rows[-1].status -eq 'failed') 'Boundary zero promoted'}
Scenario 'zero after deadline refused' {param($s)$s.time=5001.0} $null 'late zero' {param($s,$r)Require ($s.queries -eq 1 -and $s.rows[-1].status -eq 'failed') 'Late zero promoted'}
Scenario 'backward clock during query refused' {param($s)$s.time=-1.0;6328} $null 'clock moved backward' {param($s,$r)Require ($s.queries -eq 1 -and $s.delays -eq 0 -and $s.rows[-1].processIds[0] -eq 6328) 'Backward clock lost observed PID or retried'}
Scenario 'backward clock between queries refused' {6328} {param($s)$s.time=-1.0} 'clock moved backward' {param($s,$r)Require ($s.queries -eq 1 -and $s.delays -eq 1) 'Backward clock queried again'}
Scenario 'frozen clock cannot exceed fixed query cap' {6328} {param($s)} 'query bound' {param($s,$r)Require ($s.queries -eq 51 -and $s.rows.Count -eq 52) 'Query cap widened'}
Scenario 'duplicate process IDs refused' {6328;6328} $null 'duplicated' {param($s,$r)Require ($s.queries -eq 1 -and $s.delays -eq 0) 'Duplicate query continued'}
Scenario 'noninteger process ID refused' {'6328'} $null 'IDs are invalid' {param($s,$r)Require ($s.queries -eq 1) 'ID coerced'}
Scenario 'zero process ID refused' {0} $null 'IDs are invalid' {param($s,$r)Require ($s.queries -eq 1) 'Zero ID coerced'}
Scenario 'negative process ID refused' {-1} $null 'IDs are invalid' {param($s,$r)Require ($s.queries -eq 1) 'Negative ID coerced'}
Scenario 'query duration counts against the same fixed budget' {param($s)if($s.queries -eq 1){$s.time=4999.0;6328}} $null 'deadline' {param($s,$r)Require ($s.queries -eq 1 -and $s.rows[0].elapsedMilliseconds -eq 4999) 'Query duration excluded'}

$appendCalls=[Collections.Generic.List[string]]::new();$queryCalls=[Collections.Generic.List[string]]::new();$failure=$null
try { Invoke-ReferenceWitnessPostflight $terminal (New-Report) {$queryCalls.Add('query')} {0} {'2026-11-10T00:00:00Z'} {throw 'Must not delay after append failure'} {param($row)$appendCalls.Add('append');throw 'managed append fault'}|Out-Null } catch {$failure=$_.Exception.Message}
Require ($failure -match 'managed append fault' -and $appendCalls.Count -eq 1 -and $queryCalls.Count -eq 1) 'Failed append was retried or continued'
$results.Add([ordered]@{name='failed append latches without retry';status='PASS';queries=$queryCalls.Count;appendCalls=$appendCalls.Count;failure=$failure})


# The query sample is durable before the final clock; append latency is part of the fixed budget.
foreach($case in @(
 [pscustomobject]@{name='slow append within deadline';after=4999.0;error=$null},
 [pscustomobject]@{name='append reaches exact deadline';after=5000.0;error='deadline reached after append'},
 [pscustomobject]@{name='append exceeds deadline';after=5001.0;error='deadline reached after append'},
 [pscustomobject]@{name='append leaves backward final clock';after=-1.0;error='final clock moved backward'},
 [pscustomobject]@{name='append leaves nonfinite final clock';after=[double]::NaN;error='final clock moved backward'},
 [pscustomobject]@{name='append leaves invalid final clock type';after='0';error='final clock moved backward'}
)) {
 $state=[pscustomobject]@{time=0.0;queries=0;rows=[Collections.Generic.List[object]]::new()};$outcome=$null;$failure=$null
 try {$outcome=Invoke-ReferenceWitnessPostflight $terminal (New-Report) {$state.queries++} {$state.time} {'2026-11-10T00:00:00Z'} {throw 'Final-clock failure must not delay'} {param($row)$state.rows.Add($row);if($row.status -ceq 'observed'){$state.time=$case.after}}}catch{$failure=$_.Exception.Message}
 Require ($state.queries -eq 1 -and $state.rows[0].status -ceq 'observed' -and $state.rows[0].elapsedMilliseconds -eq 0 -and $state.rows[0].processIds.Count -eq 0) 'Actual query-time sample was not retained'
 if($case.error){Require ($null -eq $outcome -and $failure -match $case.error -and $state.rows.Count -eq 2 -and $state.rows[-1].status -ceq 'failed') ('Final clock failure promoted: '+$case.name)}else{Require ($null -eq $failure -and $outcome.finishedElapsedMilliseconds -eq 4999 -and $outcome.elapsedMilliseconds -eq 0 -and $state.rows.Count -eq 1) 'Slow valid append lost separate times'}
 $results.Add([ordered]@{name=$case.name;status='PASS';rows=@($state.rows);result=$outcome;failure=$failure})
}

$bad=[Collections.Generic.List[object]]::new()
foreach($pair in @(@('cleanupConfirmed',$false),@('officeOperationsStopped',$true),@('error','failure'),@('lastStage','worker.failed'),@('lastStatus','error'),@('closes',1),@('saveCopies',2),@('quits',0))){$r=New-Report;$r.($pair[0])=$pair[1];$bad.Add([pscustomobject]@{name=$pair[0];report=$r;terminal=$terminal})}
$r=New-Report;$r.PSObject.Properties.Remove('error');$bad.Add([pscustomobject]@{name='missing error field';report=$r;terminal=$terminal})
$r=New-Report;$r.opens[0].readOnly=0;$bad.Add([pscustomobject]@{name='writable open';report=$r;terminal=$terminal})
$r=New-Report;$r.opens[0].phase='other';$bad.Add([pscustomobject]@{name='wrong open phase';report=$r;terminal=$terminal})
$r=New-Report;$r.actions=@([pscustomobject]@{action='edit'});$bad.Add([pscustomobject]@{name='nonempty actions';report=$r;terminal=$terminal})
$bad.Add([pscustomobject]@{name='worker exit1';report=(New-Report);terminal=([pscustomobject]@{timedOut=$false;exitCode=1})});$bad.Add([pscustomobject]@{name='worker timeout';report=(New-Report);terminal=([pscustomobject]@{timedOut=$true;exitCode=0})});$bad.Add([pscustomobject]@{name='missing report';report=$null;terminal=$terminal});$bad.Add([pscustomobject]@{name='string exit';report=(New-Report);terminal=([pscustomobject]@{timedOut=$false;exitCode='0'})})
foreach($x in $bad){$called=[Collections.Generic.List[string]]::new();$failure=$null;try{Invoke-ReferenceWitnessPostflight $x.terminal $x.report {$called.Add('query')} {$called.Add('clock');0} {$called.Add('utc');'2026-11-10T00:00:00Z'} {$called.Add('delay')} {$called.Add('append')}|Out-Null}catch{$failure=$_.Exception.Message};Require ($null -ne $failure -and $called.Count -eq 0) ('Admission allowed callbacks: '+$x.name);$results.Add([ordered]@{name=('admission '+$x.name);status='PASS';callbacks=$called.Count;failure=$failure})}
[ordered]@{status='PASS';managedOnly=$true;officeActivated=$false;processQueriesAreInjected=$true;policy=@{budgetMilliseconds=5000;intervalMilliseconds=100;maximumQueries=51};tests=$results.Count;results=@($results)}|ConvertTo-Json -Depth 40|Set-Content -LiteralPath $Output -Encoding UTF8
Write-Output ('PASS '+$results.Count+' managed postflight controls; Office/process queries not run')
