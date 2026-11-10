param([Parameter(Mandatory=$true)][string]$ReportDirectory)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $ReportDirectory){throw 'Fresh pure report directory required'}
[void](New-Item -ItemType Directory -Path $ReportDirectory)
$worker=Join-Path $PSScriptRoot 'worker-package/test/native-furniture-control.ps1'
$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($worker,[ref]$t,[ref]$e)
if($e.Count){throw ($e|Out-String)}
$extract=@('Test-Integer','Require-Property','Assert-String','Assert-LiteralSeriesName','Read-AndValidateActionPlan','Get-FurnitureSha256','Get-FurnitureSurveySlideCount','Assert-FurnitureProofingInput','Invoke-FurnitureCom','Read-FurnitureProperty','Stop-FurnitureLifecycle','Get-ExactSlide','Get-ExactShape','Test-FurnitureCharacterNumber','Get-FurnitureCharacterPlan','Write-FurnitureCompositeJournal','Read-FurnitureCompositeValue','Read-FurnitureCompositeState','Assert-FurnitureCompositeInvariant','Assert-FurnitureCompositePhase','Invoke-FurnitureLtrProofingComposite','Apply-FurnitureAction')
foreach($name in $extract){$f=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($f.Count -ne 1){throw "Missing/ambiguous function $name"};Invoke-Expression $f[0].Extent.Text}
Add-Type -TypeDefinition @"
using System;using System.Collections.Generic;using System.Runtime.InteropServices;
public static class CP {public static string Stage="",Fail="",Mode="normal";public static int UnsafeReads=0;public static int Step=0,Ltr=0,Set=0;public static List<string> Calls=new List<string>();public static void Reset(string mode){Stage="";Fail="";Mode=mode;UnsafeReads=0;Step=0;Ltr=0;Set=0;Calls.Clear();}public static void Hit(){Calls.Add(Stage);if(Stage==Fail)throw new COMException("injected "+Stage);}public static bool Mut(string suffix){return Mode==suffix&&Step==1||Mode=="final-"+suffix&&Step==2;}}
public class CPUnsafe {public object Value {get{CP.UnsafeReads++;return "unexpected proxy traversal";}}}
public class CPFont {public object Name{get{CP.Hit();return CP.Mut("font")?"Other":"Aptos";}}public object Size{get{CP.Hit();return (float)24;}}public object Bold{get{CP.Hit();return 0;}}public object Italic{get{CP.Hit();return 0;}}}
public class CPRange {string text;public CPRange(string value){text=value;}public object Text{get{CP.Hit();return CP.Mut("text")?text+"x":text;}}public object LanguageID{get{CP.Hit();if(CP.Mode=="middle-object"&&CP.Step==1)return new CPUnsafe();if(CP.Mode=="middle-nonfinite"&&CP.Step==1)return double.NaN;if(CP.Mode=="middle-overlong"&&CP.Step==1)return new string('x',257);if(CP.Mode=="middle-invalid"&&CP.Step==1)return 0;if(CP.Mode=="middle-string"&&CP.Step==1)return "1033";if(CP.Mode=="final-language"&&CP.Step==2)return 1033;return CP.Step==1&&CP.Mode!="middle-1025"?1033:1025;}set{CP.Hit();CP.Set++;if(CP.Step!=1||(int)value!=1025)throw new Exception("not literal one-step 1025 assignment");CP.Step=2;}}public void LtrRun(){CP.Hit();CP.Ltr++;if(CP.Step!=0)throw new Exception("LtrRun retried");CP.Step=1;}public object Font{get{CP.Hit();return new CPFont();}}}
public class CPFrame {CPRange r;public CPFrame(CPRange value){r=value;}public object TextRange{get{CP.Hit();return r;}}}
public class CPShape {int id;string name;CPRange r;public CPShape(int i,string n,string text){id=i;name=n;r=new CPRange(text);}public object Id{get{CP.Hit();return CP.Mut("id")?99:id;}}public object Name{get{CP.Hit();return name;}}public object Type{get{CP.Hit();return 17;}}public object Left{get{CP.Hit();return (float)(CP.Mut("geometry")?45:43.2);}}public object Top{get{CP.Hit();return (float)270.1;}}public object Width{get{CP.Hit();return (float)870.5;}}public object Height{get{CP.Hit();return (float)33.8;}}public object Rotation{get{CP.Hit();return (float)0;}}public object TextFrame{get{CP.Hit();return new CPFrame(r);}}public object TextFrame2{get{CP.Hit();return new CPFrame(r);}}}
public class CPShapes {CPShape[] shapes;public CPShapes(CPShape[] s){shapes=s;}public object Count{get{CP.Hit();return shapes.Length;}}public object Item(int i){CP.Hit();return shapes[i-1];}}
public class CPSlide {CPShapes s;public CPSlide(CPShape[] values){s=new CPShapes(values);}public object Shapes{get{CP.Hit();return s;}}}
public class CPSlides {CPSlide s;public CPSlides(CPSlide value){s=value;}public object Count{get{CP.Hit();return 1;}}public object Item(int i){CP.Hit();if(i!=1)throw new Exception("foreign slide");return s;}}
public class CPPresentation {CPSlides s;public CPPresentation(CPShape[] values){s=new CPSlides(new CPSlide(values));}public object Slides{get{CP.Hit();return s;}}}
"@
function Write-FurnitureStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null){if($Status -ceq 'begin'){[CP]::Stage=$Name;$script:begun+=@($Name);if($script:FailStageWrite -ceq $Name){throw 'injected stage I/O'}}}
function Write-FurnitureReport {
    $script:writes++
    if($script:FailWrite -eq $script:writes){throw 'injected report I/O'}
    foreach($entry in @($report.composite.primitiveReads)){if($entry.status -ceq 'observed'){$script:persisted[$entry.stage]=[ordered]@{kind=$entry.kind;value=$entry.value}}}
}
function New-CompositeReport {return [ordered]@{api='diagnostic';ltrRunAttempts=0;ltrRunCalls=0;ltrRunSucceeded=$false;intermediateLanguageId=$null;intermediateVerified=$false;languageAssignmentAttempts=0;languageAssignments=0;languageAssignmentSucceeded=$false;allThreeShapesVerifiedBeforeSave=$false;completed=$false;primitiveReads=@();states=@();phaseStates=@();failure=$null}}
$plans=@(Get-FurnitureCharacterPlan);$action=[pscustomobject]@{op='ltr-run-restore-ar-sa';slideIndex=1;shapeName=$plans[1].name}
function Reset-Composite([string]$Mode='normal') {
    [CP]::Reset($Mode);$script:officeOperationsStopped=$false;$script:cleanupConfirmed=$true;$script:compositeAttempted=$false;$script:report=[ordered]@{composite=(New-CompositeReport)};$script:begun=@();$script:writes=0;$script:FailWrite=-1;$script:FailStageWrite='';$script:persisted=@{}
    $records=@();$shapes=New-Object 'System.Collections.Generic.List[CPShape]'
    foreach($plan in $plans){$shapes.Add((New-Object CPShape($plan.id,$plan.name,$plan.text)));$records+=@([ordered]@{id=$plan.id;name=$plan.name;type=17;text=$plan.text;left=[single]43.2;top=[single]270.1;width=[single]870.5;height=[single]33.8;rotation=[single]0;textProofingLanguage=@{languageId=1025};textFont=@{status='uniform';name='Aptos';sizePoints=[single]24;bold=0;italic=0}})}
    $script:originalRecords=$records;Assert-FurnitureCompositePhase 'original' $records
    $script:presentation=New-Object CPPresentation(,$shapes.ToArray())
}
function Run-Composite {Apply-FurnitureAction $script:presentation $action 1}
function Assert-Latched {
    if(-not $script:officeOperationsStopped -or $script:cleanupConfirmed){throw 'Failure did not latch Office stop/cleanup false'}
    $calls=[CP]::Calls.Count;$ltr=[CP]::Ltr;$set=[CP]::Set;$denied=$false
    try{Invoke-FurnitureCom 'forbidden.after.failure' {[CP]::Calls.Add('UNSAFE')}}catch{$denied=$true}
    if(-not $denied -or [CP]::Calls.Count -ne $calls -or [CP]::Ltr -ne $ltr -or [CP]::Set -ne $set){throw 'Office call continued after failure'}
}

function Copy-CompositeRecords($Records) {
    $copy=@()
    foreach($record in $Records){
        $item=[ordered]@{}
        foreach($key in $record.Keys){
            $value=$record[$key]
            if($value -is [Collections.IDictionary]){
                $nested=if($value -is [Collections.Specialized.OrderedDictionary]){[ordered]@{}}else{@{}}
                foreach($field in $value.Keys){$nested[$field]=$value[$field]}
                $item[$key]=$nested
            }else{$item[$key]=$value}
        }
        $copy+=@($item)
    }
    return ,$copy
}

$cases=@()
foreach($mode in @('normal','middle-1025')){
    Reset-Composite $mode;Run-Composite
    if([CP]::Ltr -ne 1 -or [CP]::Set -ne 1 -or -not $report.composite.completed -or -not $report.composite.allThreeShapesVerifiedBeforeSave -or $officeOperationsStopped){throw 'Positive composite sequence failed'}
    $middle=$report.composite.states[1];if($middle.languageId -ne $(if($mode -ceq 'normal'){1033}else{1025})){throw 'Intermediate state was hidden or normalized'}
    $calls=@([CP]::Calls);$ltrIndex=[Array]::IndexOf($calls,'action-1-ltr-run-restore-ar-sa.LtrRun.call');$setterIndex=[Array]::IndexOf($calls,'action-1-ltr-run-restore-ar-sa.LanguageID.set.literal1025')
    if($ltrIndex -lt 0 -or $setterIndex -le $ltrIndex){throw 'Declared operation order changed'}
    $actionWrites=$writes
    $independent=Copy-CompositeRecords $originalRecords
    if([object]::ReferenceEquals($independent[0],$originalRecords[0]) -or [object]::ReferenceEquals($independent[0].textFont,$originalRecords[0].textFont) -or $independent[0].textFont.GetType() -ne $originalRecords[0].textFont.GetType()){throw 'Independent fixture copy lost dictionary type or identity'}
    Assert-FurnitureCompositePhase 'edited' $independent;Assert-FurnitureCompositePhase 'reopened' (Copy-CompositeRecords $originalRecords)
    $cases+=@([ordered]@{name=$mode;passed=$true;ltrRunCalls=[CP]::Ltr;languageAssignments=[CP]::Set;intermediateLanguageId=$middle.languageId;completedPhases=@($report.composite.phaseStates|ForEach-Object {$_.phase});persistedPrimitives=$persisted.Count})
    if($mode -ceq 'normal'){$positiveIoStages=@($begun|Select-Object -Unique);$positiveStages=@($positiveIoStages|Where-Object {$_ -notmatch '\.preSave-[0-2]\.(shapes|shape-[0-9])' -and ($_ -match '\.(before|intermediate|final|preSave-[0-2])\.' -or $_ -match '\.LtrRun\.call$|\.LanguageID\.set\.literal1025$|^action-1-ltr-run-restore-ar-sa\.Text(Frame|Range)\.get$')});$positiveWrites=$actionWrites;$positiveCalls=$calls;$positiveJournal=$report.composite}
}
# Fault every declared COM/getter/setter stage, including every getter of all three pre-save shapes.
foreach($stage in $positiveStages){
    Reset-Composite;[CP]::Fail=$stage;$caught=$false
    try{Run-Composite}catch{$caught=$true}
    if(-not $caught){throw "Fault was not exercised: $stage"};Assert-Latched
    if([CP]::Calls.Contains('action-1-ltr-run-restore-ar-sa.LanguageID.set.literal1025') -and $stage -notlike '*.final.*' -and $stage -notlike '*.preSave-*' -and $stage -cne 'action-1-ltr-run-restore-ar-sa.LanguageID.set.literal1025'){throw "Restoration occurred after earlier stage fault: $stage"}
    $cases+=@([ordered]@{name='com-fault:'+ $stage;passed=$true;ltrRunCalls=[CP]::Ltr;languageAssignments=[CP]::Set;stopped=$officeOperationsStopped;cleanupConfirmed=$cleanupConfirmed})
}
# Fault each report write occurring inside the action (not the initial original-phase fixture construction).
Reset-Composite;$initialWrites=$writes
for($write=$initialWrites+1;$write -le $positiveWrites;$write++){
    Reset-Composite;$script:FailWrite=$write;$caught=$false;try{Run-Composite}catch{$caught=$true}
    if(-not $caught){throw "Journal write fault was not exercised: $write"};Assert-Latched
    $cases+=@([ordered]@{name='report-io:'+ $write;passed=$true;ltrRunCalls=[CP]::Ltr;languageAssignments=[CP]::Set;stopped=$officeOperationsStopped;cleanupConfirmed=$cleanupConfirmed})
}
foreach($stage in $positiveIoStages){
    Reset-Composite;$script:FailStageWrite=$stage;$caught=$false;try{Run-Composite}catch{$caught=$true}
    if(-not $caught){throw "Stage journal fault was not exercised: $stage"};Assert-Latched
    $cases+=@([ordered]@{name='stage-io:'+ $stage;passed=$true;ltrRunCalls=[CP]::Ltr;languageAssignments=[CP]::Set;stopped=$officeOperationsStopped})
}
foreach($mode in @('text','font','geometry','id','middle-invalid','middle-string','middle-object','middle-nonfinite','middle-overlong','final-text','final-font','final-geometry','final-id','final-language')){
    Reset-Composite $mode;$caught=$false;try{Run-Composite}catch{$caught=$true}
    if(-not $caught){throw "Mutation accepted: $mode"};Assert-Latched
    if($mode -notlike 'final-*' -and [CP]::Set -ne 0){throw 'Invalid intermediate state reached the language setter'}
    if($mode -ceq 'middle-invalid' -and $persisted['action-1-ltr-run-restore-ar-sa.intermediate.LanguageID.get'].value -ne 0){throw 'Actual invalid primitive was not persisted before refusal'}
    if($mode -ceq 'middle-string' -and $persisted['action-1-ltr-run-restore-ar-sa.intermediate.LanguageID.get'].kind -cne 'string'){throw 'Actual invalid type was not persisted'}

    if($mode -in @('middle-object','middle-nonfinite','middle-overlong')){
        $entry=$persisted['action-1-ltr-run-restore-ar-sa.intermediate.LanguageID.get']
        $expected=if($mode -ceq 'middle-object'){'nonprimitive'}elseif($mode -ceq 'middle-nonfinite'){'nonfinite-number'}else{'overlong-string'}
        if($entry.kind -cne $expected -or $null -ne $entry.value -or $null -ne $report.composite.states[-1].languageId){throw 'Unsafe getter result escaped the primitive journal into a state snapshot'}
        $serialized=ConvertTo-Json -Depth 40 -InputObject $report.composite
        if([CP]::UnsafeReads -ne 0){throw 'Report serialization traversed an unexpected object after failure'}
    }

    $cases+=@([ordered]@{name=$mode;passed=$true;stopped=$officeOperationsStopped;languageAssignments=[CP]::Set;persistedPrimitives=$persisted.Count})
}
foreach($mode in @('no-original','wrong-prefix','retry','phase-order','phase-font','phase-geometry','phase-text','phase-id')){
    Reset-Composite;$caught=$false
    try{switch($mode){
        'no-original' {$report.composite.phaseStates=@();Run-Composite}
        'wrong-prefix' {Invoke-FurnitureLtrProofingComposite $presentation $action 'action-2-ltr-run-restore-ar-sa'}
        'retry' {Run-Composite;Run-Composite}
        'phase-order' {Run-Composite;Assert-FurnitureCompositePhase 'reopened' $originalRecords}
        default {Run-Composite;$mutated=Copy-CompositeRecords $originalRecords;switch($mode){'phase-font'{$mutated[2].textFont.name='Other'}'phase-geometry'{$mutated[2].width=1}'phase-text'{$mutated[2].text+='x'}'phase-id'{$mutated[2].id=99}};Assert-FurnitureCompositePhase 'edited' $mutated}
    }}catch{$caught=$true}
    if(-not $caught){throw "Identity/phase mutation accepted: $mode"};Assert-Latched
    $cases+=@([ordered]@{name=$mode;passed=$true;stopped=$officeOperationsStopped;ltrRunCalls=[CP]::Ltr;languageAssignments=[CP]::Set})
}
$planFile=Join-Path $ReportDirectory 'one.json';Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'references/composite.json') -Destination $planFile
$inputBytes=[IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'references/original09.pptx.gz'));$inputStream=New-Object IO.MemoryStream(,$inputBytes);$gzip=New-Object IO.Compression.GZipStream($inputStream,[IO.Compression.CompressionMode]::Decompress);$expanded=New-Object IO.MemoryStream;try{$gzip.CopyTo($expanded);$inputFile=Join-Path $ReportDirectory 'original09.pptx';[IO.File]::WriteAllBytes($inputFile,$expanded.ToArray())}finally{$expanded.Dispose();$gzip.Dispose();$inputStream.Dispose()}
$validated=Read-AndValidateActionPlan $planFile
Assert-FurnitureProofingInput $inputFile $validated $true $false
if($validated.Count -ne 1 -or $validated[0].op -cne 'ltr-run-restore-ar-sa'){throw 'Controller-compatible parser failed'}
foreach($mutation in @('empty','duplicate','extra-key','wrong-target','wrong-case','wrong-slide','legacy-op')){
    $bad=@([pscustomobject]@{op=$action.op;slideIndex=1;shapeName=$action.shapeName})
    switch($mutation){'empty'{$bad=@()}'duplicate'{$bad+=@($bad[0])}'extra-key'{$bad[0]|Add-Member NoteProperty extra $true}'wrong-target'{$bad[0].shapeName+='x'}'wrong-case'{$bad[0].op='LTR-RUN-RESTORE-AR-SA'}'wrong-slide'{$bad[0].slideIndex=2}'legacy-op'{$bad[0].op='ltr-run-oracle'}}
    $raw=ConvertTo-Json -InputObject $bad -Compress;$badFile=Join-Path $ReportDirectory ($mutation+'.json');[IO.File]::WriteAllText($badFile,$raw)
    $refused=$false;try{$parsed=Read-AndValidateActionPlan $badFile;if($parsed.Count -ne 1 -or $parsed[0].op -cne $action.op){throw 'Not the one closed operation'};Assert-FurnitureProofingInput $inputFile $parsed $true $false}catch{$refused=$true}
    if(-not $refused){throw "Action mutation accepted: $mutation"}
    $cases+=@([ordered]@{name='plan:'+ $mutation;passed=$true})
}

foreach($mutation in @('missing-fonts','survey','wrong-hash','wrong-extension','two-actions','no-action','foreign-op','wrong-target-admission')){
    $candidate=$inputFile;$candidateActions=$validated;$fonts=$true;$survey=$false
    switch($mutation){
        'missing-fonts'{$fonts=$false}
        'survey'{$survey=$true}
        'wrong-hash'{$candidate=Join-Path $ReportDirectory 'wrong-hash.pptx';$changed=[IO.File]::ReadAllBytes($inputFile);$changed[$changed.Length-1]=$changed[$changed.Length-1] -bxor 1;[IO.File]::WriteAllBytes($candidate,$changed)}
        'wrong-extension'{$candidate=Join-Path $ReportDirectory 'wrong-extension.zip';[IO.File]::WriteAllBytes($candidate,[IO.File]::ReadAllBytes($inputFile))}
        'two-actions'{$candidateActions=@($validated[0],$validated[0])}
        'no-action'{$candidateActions=@()}
        'foreign-op'{$candidateActions=@([pscustomobject]@{op='ltr-run-oracle';slideIndex=1;shapeName=$action.shapeName})}
        'wrong-target-admission'{$candidateActions=@([pscustomobject]@{op=$action.op;slideIndex=1;shapeName='Other'})}
    }
    $denied=$false;try{Assert-FurnitureProofingInput $candidate $candidateActions $fonts $survey}catch{$denied=$true}
    if(-not $denied){throw "Input admission accepted: $mutation"}
    $cases+=@([ordered]@{name='input:'+ $mutation;passed=$true})
}

$result=[ordered]@{schema=1;mode='PURE_MANAGED_FAKE_ONLY';workerSha256=(Get-FileHash $worker -Algorithm SHA256).Hash.ToLowerInvariant();cases=$cases;comStages=$positiveStages;actionReportWrites=($positiveWrites-$initialWrites);positiveCalls=$positiveCalls;positiveJournal=$positiveJournal;officeActivated=$false;nativeRun=$false;validateOnlyRun=$false;glyphFix=$false;nativeAcceptance=$false}
$result|ConvertTo-Json -Depth 40|Set-Content -LiteralPath (Join-Path $ReportDirectory 'managed.json') -Encoding UTF8
Write-Output (ConvertTo-Json -Compress -InputObject ([ordered]@{passed=$true;cases=$cases.Count;comStages=$positiveStages.Count;actionReportWrites=$result.actionReportWrites;officeActivated=$false}))
