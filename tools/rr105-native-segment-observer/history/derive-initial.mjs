import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('tools/rr105-native-segment-observer');
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(dir,p),s.replace(/\r\n/g,'\n'));
function replaceFunction(source,name,replacement){const start=source.indexOf('function '+name+'(')>=0?source.indexOf('function '+name+'('):source.indexOf('function '+name+' {');if(start<0)throw Error(name);const next=source.indexOf('\nfunction ',start+1);if(next<0)throw Error('next '+name);return source.slice(0,start)+replacement.trimEnd()+'\n'+source.slice(next);}
let worker=read('references/base-worker.ps1');
worker=worker.replace('Independent referenceWitness-case worker; the original ce92 worker is never loaded.','Closed five-case, one-slide, zero-edit diagnostic. Original ce92 supervisor bytes are unchanged.');
worker=worker.replace('if(Test-ReferenceWitnessFiniteNumber $Value) { return ,$Value }','if(Test-ReferenceWitnessFiniteNumber $Value) { if($Value -is [single]) { return ,[double]$Value };return ,$Value }');
worker=worker.replace("'TextRange','Text'))","'TextRange','Text','Font','Size','LanguageID'))");
worker=replaceFunction(worker,'Read-ReferenceWitnessPhase',String.raw`function Read-ReferenceWitnessPhase([string]$Phase) {
    Assert-ReferenceWitnessOwnedPresentation "$Phase.read.ownership"
    $current=[ordered]@{slideCount=$null;slides=@();rasters=@()};$script:report.phases[$Phase]=$current;Write-ReferenceWitnessReport
    $slides=Read-ReferenceWitnessProperty $script:presentation 'Slides' "$Phase.slides";$count=Read-ReferenceWitnessProperty $slides 'Count' "$Phase.slides.count";$current.slideCount=Get-ReferenceWitnessPrimitive $count;Write-ReferenceWitnessReport
    Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $count) -and $count -eq 1) "$Phase.slides.count" 1 $count
    $slide=Invoke-ReferenceWitnessCom "$Phase.slide.1.get" {$slides.Item(1)}
    $record=[ordered]@{index=1;slideId=$null;name=$null;shapeCount=$null;shapes=@()};$current.slides+=@($record);Write-ReferenceWitnessReport
    $id=Read-ReferenceWitnessProperty $slide 'SlideID' "$Phase.slide.1.id";$record.slideId=Get-ReferenceWitnessPrimitive $id;Write-ReferenceWitnessReport
    Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $id) -and $id -gt 0) "$Phase.slide.1.id" 'positive integer' $id
    $name=Read-ReferenceWitnessProperty $slide 'Name' "$Phase.slide.1.name";$record.name=Get-ReferenceWitnessPrimitive $name;Write-ReferenceWitnessReport
    Assert-ReferenceWitnessProbe ($name -is [string]) "$Phase.slide.1.name" 'string' $name
    $shapes=Read-ReferenceWitnessProperty $slide 'Shapes' "$Phase.slide.1.shapes";$count=Read-ReferenceWitnessProperty $shapes 'Count' "$Phase.slide.1.shapes.count";$record.shapeCount=Get-ReferenceWitnessPrimitive $count;Write-ReferenceWitnessReport
    Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $count) -and $count -eq $script:expectation.shapeCount -and $count -le 30) "$Phase.slide.1.shapes.count" $script:expectation.shapeCount $count
    for($position=1;$position -le $count;$position++) {
        $expected=$script:expectation.shapes[$position-1];$prefix="$Phase.slide.1.shape.$position"
        $shape=Invoke-ReferenceWitnessCom "$prefix.get" {$shapes.Item($position)};$item=[ordered]@{index=$position};$record.shapes+=@($item);Write-ReferenceWitnessReport
        foreach($pair in @(@('Id','id'),@('Name','name'),@('Type','type'),@('Left','left'),@('Top','top'),@('Width','width'),@('Height','height'),@('Rotation','rotation'),@('HasTextFrame','hasTextFrame'),@('AlternativeText','alternativeText'))) {
            $value=Read-ReferenceWitnessProperty $shape $pair[0] "$prefix.$($pair[1])";$item[$pair[1]]=Get-ReferenceWitnessPrimitive $value;Write-ReferenceWitnessReport
            switch($pair[1]) {
                'id' {Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $value) -and $value -eq $expected.id) "$prefix.id" $expected.id $value}
                'name' {Assert-ReferenceWitnessProbe ($value -is [string] -and $value -ceq $expected.name) "$prefix.name" $expected.name $value}
                'type' {Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $value) -and $value -in @(14,17)) "$prefix.type" 'placeholder or editable text box' $value}
                'hasTextFrame' {Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $value) -and $value -eq -1) "$prefix.hasTextFrame" -1 $value}
                'alternativeText' {Assert-ReferenceWitnessProbe ($value -is [string]) "$prefix.alternativeText" 'string observation' $value}
                'rotation' {Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessFiniteNumber $value) -and $value -eq 0) "$prefix.rotation" 0 $value}
                default {$number=$expected.framePoints.($pair[1]);Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessFiniteNumber $value) -and [double]$value -eq [double]$number) "$prefix.$($pair[1])" $number $value}
            }
        }
        $frame=Read-ReferenceWitnessProperty $shape 'TextFrame' "$prefix.textFrame";$range=Read-ReferenceWitnessProperty $frame 'TextRange' "$prefix.textRange"
        $value=Read-ReferenceWitnessProperty $range 'Text' "$prefix.text";$item.text=Get-ReferenceWitnessPrimitive $value;Write-ReferenceWitnessReport
        Assert-ReferenceWitnessProbe ($value -is [string] -and $value -ceq $expected.text) "$prefix.text" $expected.text $value
        $value=Read-ReferenceWitnessProperty $range 'LanguageID' "$prefix.languageId";$item.languageId=Get-ReferenceWitnessPrimitive $value;Write-ReferenceWitnessReport
        Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessInteger $value) -and $value -eq $expected.languageId) "$prefix.languageId" $expected.languageId $value
        $font=Read-ReferenceWitnessProperty $range 'Font' "$prefix.font"
        $value=Read-ReferenceWitnessProperty $font 'Name' "$prefix.fontName";$item.fontName=Get-ReferenceWitnessPrimitive $value;Write-ReferenceWitnessReport
        Assert-ReferenceWitnessProbe ($value -is [string] -and -not [string]::IsNullOrEmpty($value)) "$prefix.fontName" 'nonempty API font name; not physical-face evidence' $value
        $value=Read-ReferenceWitnessProperty $font 'Size' "$prefix.fontSize";$item.fontSize=Get-ReferenceWitnessPrimitive $value;Write-ReferenceWitnessReport
        Assert-ReferenceWitnessProbe ((Test-ReferenceWitnessFiniteNumber $value) -and [double]$value -eq [double]$expected.fontSize) "$prefix.fontSize" $expected.fontSize $value
    }
    $png=Join-Path $script:root "$Phase-01.png";Assert-ReferenceWitnessProbe (-not (Test-Path -LiteralPath $png)) "$Phase.slide.1.pngFresh" $false (Test-Path -LiteralPath $png)
    Invoke-ReferenceWitnessCom "$Phase.slide.1.export" {$slide.Export($png,'PNG',1280,720)}
    $current.rasters+=@([ordered]@{slideIndex=1;path=$png;sha256=(Get-ReferenceWitnessHash $png)});Write-ReferenceWitnessReport
}`);
worker=worker.replaceAll('scripts/native-acceptance/run-reference-chart-profile.ps1','tools/rr105-native-segment-observer/run-segment-observer.ps1').replaceAll('scripts/native-acceptance/reference-chart-profile.mjs','tools/rr105-native-segment-observer/profile.mjs').replaceAll('inputs/reference-chart-worker.ps1','inputs/segment-worker.ps1');
worker=worker.replace('$script:root=$root;$script:sourcePath=','$script:expectation=$binding.expectation\n$script:root=$root;$script:sourcePath=');
worker=worker.replace("if($runner.timeoutSeconds -ne $TimeoutSeconds)","if($runner.timeoutSeconds -ne 45 -or $TimeoutSeconds -ne 45)");
write('segment-worker.ps1',worker);
let wrapper=read('references/base-wrapper.ps1');
wrapper=wrapper.replaceAll('reference-chart-original-readonly-v1','b07-independent-segments-readonly-v1');
const required="@('tools/rr105-native-segment-observer/profile.mjs','tools/rr105-native-segment-observer/data-tools.mjs','tools/rr105-native-segment-observer/segment-worker.ps1','tools/rr105-native-segment-observer/run-segment-observer.ps1','tools/rr105-native-segment-observer/native-process.ps1','tools/rr105-native-segment-observer/SOURCE.json')";
wrapper=wrapper.replace(/\$required=@\([^\r\n]+\)/,`$required=${required}`);
wrapper=wrapper.replace('all seven exact code identities','all six exact code identities');
const marker='# No executable path, imported definition, child or Office query precedes these checks.';
wrapper=wrapper.slice(0,wrapper.indexOf(marker));
// Only four unchanged/closed bootstrap functions, exclusive-copy, report writer are used.
const importStart=wrapper.indexOf('function Import-ReferenceWitnessPurePaths('),importEnd=wrapper.indexOf('function Copy-ReferenceWitnessExclusive(',importStart);wrapper=wrapper.slice(0,importStart)+wrapper.slice(importEnd);
wrapper+=String.raw`# No child or process query precedes complete envelope, Node, clean-controller and source checks.
$profile=Read-ReferenceWitnessBootstrapEnvelope $ExecutionEnvelope $ExpectedEnvelopeSha256
Assert-ReferenceWitnessBootstrapNode $NodeExecutable $profile.node
$controller=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Assert-ReferenceWitnessBootstrapController $controller $profile.controllerRepository
if($TimeoutSeconds -ne 45 -or $profile.timeoutSeconds -ne 45) { throw 'Closed segment observer requires its unchanged 45-second deadline' }
$validator=Join-Path $PSScriptRoot 'profile.mjs'
$checked=& $NodeExecutable $validator verify --envelope $ExecutionEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --require-office ([bool]$RunOffice).ToString().ToLowerInvariant()
if($LASTEXITCODE -ne 0) { throw 'Segment pure verification failed; Office was not started' }
$binding=($checked | Out-String) | ConvertFrom-Json
$output=Assert-ReferenceWitnessBootstrapPath $OutputDirectory
if(Test-Path -LiteralPath $output) { throw 'Segment observer requires absent fresh output' }
foreach($protected in @($controller,(Split-Path -Parent $ExecutionEnvelope))) {
    $p=[IO.Path]::GetFullPath($protected).TrimEnd('\');$o=$output.TrimEnd('\')
    if($o -ieq $p -or $o.StartsWith($p+'\',[StringComparison]::OrdinalIgnoreCase) -or $p.StartsWith($o+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Output overlaps immutable controller/admission inputs' }
}
if(-not (Test-Path -LiteralPath (Split-Path -Parent $output) -PathType Container)) { throw 'Fresh output parent must already exist' }
[void](New-Item -ItemType Directory -Path $output)
[void](New-Item -ItemType Directory -Path (Join-Path $output 'inputs'))
$script:referenceWitnessRunnerPath=Join-Path $output 'runner.json'
$script:referenceWitnessRunner=[ordered]@{schemaVersion=1;profile=$profile.profile;envelopeSha256=$ExpectedEnvelopeSha256;generation=$profile.generation;controllerRepository=$profile.controllerRepository;node=$profile.node;limits=$profile.limits;timeoutSeconds=45;runOfficeRequested=[bool]$RunOffice;nativeAcceptance=$false;registryAcceptance=$false;publicImportAcceptance=$false;status='snapshots-pending';snapshots=@()}
Write-ReferenceWitnessRunner
try {
    $copies=@(@($ExecutionEnvelope,'execution-envelope.json'),@($binding.inputPath,'inputs/case.pptx'),@($binding.workerPath,'inputs/segment-worker.ps1'),@($binding.supervisorPath,'inputs/native-process.ps1'))
    foreach($copy in $copies) { $id=Copy-ReferenceWitnessExclusive $copy[0] (Join-Path $output $copy[1]);$script:referenceWitnessRunner.snapshots+=@([ordered]@{path=$copy[1];bytes=$id.bytes;sha256=$id.sha256});Write-ReferenceWitnessRunner }
    $ownedEnvelope=Join-Path $output 'execution-envelope.json'
    & $NodeExecutable $validator verify-execution --envelope $ownedEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output --require-office ([bool]$RunOffice).ToString().ToLowerInvariant()
    if($LASTEXITCODE -ne 0) { throw 'Segment owned snapshots failed verification' }
    if(-not $RunOffice) { $script:referenceWitnessRunner.status='pure-checks-completed; native-not-run';Write-ReferenceWitnessRunner;return }
    if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Explicit root-authorized native execution requires Windows' }
    # Unchanged b944 supervisor is not loaded until all checks and explicit RunOffice.
    $native=Join-Path $output 'native';[void](New-Item -ItemType Directory -Path $native)
    . (Join-Path $output 'inputs/native-process.ps1')
    $arguments=@('-ExecutionEnvelope',$ownedEnvelope,'-ExpectedEnvelopeSha256',$ExpectedEnvelopeSha256,'-NodeExecutable',$NodeExecutable,'-OutputDirectory',$native,'-TimeoutSeconds','45','-Worker')
    $terminal=Invoke-OpfNativeWorker -ScriptPath (Join-Path $output 'inputs/segment-worker.ps1') -WorkerArguments $arguments -OutputDirectory $native -TimeoutSeconds 45
    # No COM cleanup/kill/retry on any outcome. Raw worker.json remains unmodified.
    $success=(-not $terminal.timedOut -and $terminal.exitCode -eq 0);$report=$null
    if($success -and (Test-Path -LiteralPath (Join-Path $native 'report.json') -PathType Leaf)) {$report=Get-Content -LiteralPath (Join-Path $native 'report.json') -Raw -Encoding UTF8 | ConvertFrom-Json}
    $confirmed=($success -and $null -ne $report -and $report.cleanupConfirmed -ceq $true -and $report.officeOperationsStopped -ceq $false -and $report.lastStage -ceq 'worker.complete' -and $report.lastStatus -ceq 'success')
    $remaining=$null;if($confirmed){$remaining=@(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue).Count;$confirmed=($remaining -eq 0)}
    [ordered]@{schemaVersion=1;profile=$profile.profile;timedOut=[bool]$terminal.timedOut;exitCode=$terminal.exitCode;cleanupConfirmed=[bool]$confirmed;powerPointPostflightCount=$remaining;originalSupervisorSha256='b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c';nativeAcceptance=$false;registryAcceptance=$false;publicImportAcceptance=$false} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $native 'supervisor.json') -Encoding UTF8
    if(-not $confirmed) { throw 'Worker failed/cleanup unconfirmed; preserve all output. No retry or COM cleanup.' }
    & $NodeExecutable $validator verify-execution --envelope $ownedEnvelope --expected-envelope-sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
    if($LASTEXITCODE -ne 0) { throw 'Segment postflight source/controller binding failed' }
    $script:referenceWitnessRunner.status='native-observation-completed; root-review-required';Write-ReferenceWitnessRunner
} catch {
    $script:referenceWitnessRunner.status='failed; preserve-output; no-retry';$script:referenceWitnessRunner.error=$_.Exception.Message;Write-ReferenceWitnessRunner;throw
}
`;
write('run-segment-observer.ps1',wrapper);
console.log('Derived closed worker/wrapper; no Office or supervisor execution.');
