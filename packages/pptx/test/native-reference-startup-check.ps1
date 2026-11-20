param([Parameter(Mandatory=$true)][string]$ScriptPath,[Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 required'}
if(Test-Path -LiteralPath $ReportPath){throw 'Preserve prior startup controls'}
$root=$ReportPath+'.startup';if(Test-Path -LiteralPath $root){throw 'Preserve prior startup fixture'};[void](New-Item -ItemType Directory -Path $root)
$before=(Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
if((Get-Item -LiteralPath $ScriptPath).Length -ne 93931 -or $before -cne '3ce6b57ca190a4c0c89b3202eeb11e2685fb2731bfc9a3a206bc3f8b022d8573'){throw 'Exact reviewed startup worker required'}
$source=[IO.File]::ReadAllText($ScriptPath)
# Stage8 (owner-approved 2026-11-13) accepts only the current worker, which admits the v0.34.0 reference export and its helper series
# names, then proves the exact stage-7 worker before the earlier derivations.
$measuredInputEdits=@(
 @("if(`$SourceBytes -ne 129025 -or `$SourceHash -cne '06c82deb1dbe067d4f097aebe760b8f1dbdcc0e2a74e95b8d1f99eeea2302a83'","if(`$SourceBytes -ne 129055 -or `$SourceHash -cne '3ec4712d167e889815f22266bd871b8ea2633974689f37ea42a089ae2976c918'"),
 @("`$name -cne ('OPF reference '+(`$index-1))","`$name -cne (@('Target 80','Floor -10')[`$index-2])")
)
$stage7Source=$source
foreach($pair in $measuredInputEdits){$at=$stage7Source.IndexOf($pair[1],[StringComparison]::Ordinal);if($at -lt 0 -or $stage7Source.LastIndexOf($pair[1],[StringComparison]::Ordinal) -ne $at){throw 'Unique eighth-stage measured-input inverse required'};$stage7Source=$stage7Source.Replace($pair[1],$pair[0])}
$stage7Bytes=[Text.Encoding]::UTF8.GetBytes($stage7Source)
$sha=[Security.Cryptography.SHA256]::Create();try{$stage7Hash=([BitConverter]::ToString($sha.ComputeHash($stage7Bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
if($stage7Bytes.Length -ne 93922 -or $stage7Hash -cne '21fad1db47a4194431f8750f4f117df33f718c93782eca415b3de0f6e7fca255'){throw 'Exact seventh-stage worker inverse required'}
$measuredInputForward=$stage7Source
foreach($pair in $measuredInputEdits){$at=$measuredInputForward.IndexOf($pair[0],[StringComparison]::Ordinal);if($at -lt 0 -or $measuredInputForward.LastIndexOf($pair[0],[StringComparison]::Ordinal) -ne $at){throw 'Unique eighth-stage measured-input forward required'};$measuredInputForward=$measuredInputForward.Replace($pair[0],$pair[1])}
if($measuredInputForward -cne $source){throw 'Eighth-stage measured-input forward differs'}
# Stage7 proves the exact prior stage before any startup extraction.
$workerRootEdits=@(
 @("`$fixed=Join-Path `$outputRoot ('reference-name-'+`$Phase+'.pptx')","`$fixed=Join-Path `$root ('reference-name-'+`$Phase+'.pptx')"),
 @("Join-Path `$outputRoot 'reference-name-before.pptx'","Join-Path `$root 'reference-name-before.pptx'"),
 @("Join-Path `$outputRoot 'reference-name-reopened.pptx'","Join-Path `$root 'reference-name-reopened.pptx'")
)
$snapshotSource=$stage7Source
foreach($pair in $workerRootEdits){$at=$snapshotSource.IndexOf($pair[1],[StringComparison]::Ordinal);if($at -lt 0 -or $snapshotSource.LastIndexOf($pair[1],[StringComparison]::Ordinal) -ne $at){throw 'Unique seventh-stage worker-root inverse required'};$snapshotSource=$snapshotSource.Replace($pair[1],$pair[0])}
$snapshotBytes=[Text.Encoding]::UTF8.GetBytes($snapshotSource)
$sha=[Security.Cryptography.SHA256]::Create();try{$snapshotHash=([BitConverter]::ToString($sha.ComputeHash($snapshotBytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
if($snapshotBytes.Length -ne 93940 -or $snapshotHash -cne '1cb61400327a06df95a03562e524c9fe4487375efd86a21dd49494b9db773870'){throw 'Exact sixth-stage worker inverse required'}
$workerRootForward=$snapshotSource
foreach($pair in $workerRootEdits){$at=$workerRootForward.IndexOf($pair[0],[StringComparison]::Ordinal);if($at -lt 0 -or $workerRootForward.LastIndexOf($pair[0],[StringComparison]::Ordinal) -ne $at){throw 'Unique seventh-stage worker-root forward required'};$workerRootForward=$workerRootForward.Replace($pair[0],$pair[1])}
if($workerRootForward -cne $stage7Source){throw 'Seventh-stage worker-root forward differs'}
$oldSource=$snapshotSource.Replace('$script:referenceNameModeEnabled','$script:referenceNameEdit')
$sha=[Security.Cryptography.SHA256]::Create();try{$oldHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($oldSource)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
if($oldHash -cne '4fc89960c8b1e777d7ccc5d9f8f54e9f9dddb9ca1ca864b4bb9cf9ac881ff6fa'){throw 'Old whole-worker inverse differs'}
function New-StartupScript([string]$Text,[string]$StateName,[string]$Path){
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($Text,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Actual startup source did not parse'}
 $statements=@($ast.EndBlock.Statements);$matches=@(for($i=1;$i -lt $statements.Count;$i++){if($statements[$i].Extent.Text.StartsWith('if($ReferenceNameEdit -or $null -ne $request.PSObject.Properties[''referenceNameEdit''])',[StringComparison]::Ordinal)){$i}})
 if($matches.Count -ne 1 -or $statements[$matches[0]-1] -isnot [Management.Automation.Language.AssignmentStatementAst] -or $statements[$matches[0]-1].Left.Extent.Text -cne ('$script:'+$StateName)){throw 'Exact adjacent real startup initializer/IF required'}
 $definitions=@(foreach($name in @('Test-Integer','Require-Property','Assert-String','Assert-LiteralSeriesName','Assert-FurnitureReferenceNameAction','Assert-FurnitureReferenceNameMode','Read-AndValidateActionPlan')){$found=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($found.Count -ne 1){throw 'Exact pure startup helper missing/duplicate'};$found[0].Extent.Text})
 $setup=@'
$ErrorActionPreference='Stop'
$request=Get-Content -LiteralPath (Join-Path $OutputDirectory 'request.json') -Raw -Encoding UTF8|ConvertFrom-Json
$sourceHash=$request.source.sha256;$sourceSnapshot=$InputPresentation
$actions=Read-AndValidateActionPlan (Join-Path $OutputDirectory 'plan.json')
'@
 $result='[pscustomobject]@{publicSwitch=[bool]$ReferenceNameEdit;internalEnabled=$script:'+ $StateName +'}'
 # Only the actual ParamBlock, closed pure validators and two exact statements.
 # No worker entrypoint, full bootstrap, factory, process query, observer or COM.
 $scriptText=@($ast.ParamBlock.Extent.Text,($definitions -join "`n"),$setup,$statements[$matches[0]-1].Extent.Text,$statements[$matches[0]].Extent.Text,$result)-join "`n"
 [IO.File]::WriteAllText($Path,$scriptText,[Text.UTF8Encoding]::new($false))
}
$newPath=Join-Path $root 'actual-new-startup.ps1';$oldPath=Join-Path $root 'actual-old-startup.ps1'
New-StartupScript $source 'referenceNameModeEnabled' $newPath;New-StartupScript $oldSource 'referenceNameEdit' $oldPath
# This is a synthetic length fixture, NOT the genuine sealed PPTX. Earlier full
# hash/bootstrap checks are deliberately not executed or claimed in this test.
$inputPath=Join-Path $root 'synthetic-length-fixture.pptx';[IO.File]::WriteAllBytes($inputPath,[Array]::CreateInstance([byte],129055));$inputHash=(Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
$sourceHash='3ec4712d167e889815f22266bd871b8ea2633974689f37ea42a089ae2976c918';if($inputHash -ceq $sourceHash){throw 'Synthetic input must not impersonate the sealed archive'}
$plan=@([pscustomobject]@{op='set-chart-series-name';slideIndex=1;chartName='OPF chart 1';seriesIndex=1;expectedName='Actual';newName='Actual edited'});ConvertTo-Json -InputObject $plan -Depth 8|Set-Content -LiteralPath (Join-Path $root 'plan.json') -Encoding UTF8
$rows=@()
foreach($mode in @('valid','old-collision','disabled','missing-switch','missing-request','false-request','nonboolean-request','wrong-source')){
 $request=[ordered]@{source=[ordered]@{sha256=$sourceHash}};$startupArguments=@{OutputDirectory=$root;InputPresentation=$inputPath;Worker=$true};$selected=$newPath
 if($mode -cnotin @('disabled','missing-request')){$request.referenceNameEdit=$true}
 if($mode -cnotin @('disabled','missing-switch')){$startupArguments.ReferenceNameEdit=$true}
 if($mode -ceq 'old-collision'){$selected=$oldPath};if($mode -ceq 'false-request'){$request.referenceNameEdit=$false};if($mode -ceq 'nonboolean-request'){$request.referenceNameEdit='true'};if($mode -ceq 'wrong-source'){$request.source.sha256='0'*64}
 $request|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $root 'request.json') -Encoding UTF8
 $caught=$null;$value=$null;try{$value=& $selected @startupArguments}catch{$caught=$_.Exception.Message}
 $positive=$mode -cin @('valid','disabled')
 if($positive){$enabled=$mode -ceq 'valid';if($null -ne $caught -or $null -eq $value -or $value.publicSwitch -isnot [bool] -or $value.internalEnabled -isnot [bool] -or $value.publicSwitch -ne $enabled -or $value.internalEnabled -ne $enabled){throw "Actual startup handshake differs: $mode : $caught"}}else{
  $expected=if($mode -ceq 'wrong-source'){'Exact sealed reference-name source and one plan required'}else{'Reference-name switch differs from its snapshotted request'}
  if($caught -cne $expected){throw "Actual startup refusal differs: $mode : $caught"}
 }
 $rows+=@([ordered]@{scenario=$mode;passed=$true;publicSwitch=if($null -eq $value){$null}else{$value.publicSwitch};internalEnabled=if($null -eq $value){$null}else{$value.internalEnabled};refusal=$caught})
}
if((Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $before -or (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $inputHash){throw 'Startup controls mutated source/input bytes'}
[ordered]@{schemaVersion=1;powerShellEdition=$PSVersionTable.PSEdition;powerShellVersion=$PSVersionTable.PSVersion.ToString();scope='Actual ParamBlock and two exact pre-COM startup statements only';earlierFullSourceBootstrapExercised=$false;syntheticLengthFixture=$true;genuineArchive=$false;officeConstructed=$false;processQueries=0;observerIO=0;workerSha256=$before;oldInverseSha256=$oldHash;measuredInputDerivation=[ordered]@{edits=$measuredInputEdits.Count;workerBytes=(Get-Item -LiteralPath $ScriptPath).Length;inverseBytes=$stage7Bytes.Length;inverseSha256=$stage7Hash;forwardExact=($measuredInputForward -ceq $source)};workerRootDerivation=[ordered]@{edits=$workerRootEdits.Count;workerBytes=$stage7Bytes.Length;inverseBytes=$snapshotBytes.Length;inverseSha256=$snapshotHash;forwardExact=($workerRootForward -ceq $stage7Source)};cases=$rows}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $ReportPath -Encoding UTF8
