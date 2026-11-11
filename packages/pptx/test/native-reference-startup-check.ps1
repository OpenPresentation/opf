param([Parameter(Mandatory=$true)][string]$ScriptPath,[Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 required'}
if(Test-Path -LiteralPath $ReportPath){throw 'Preserve prior startup controls'}
$root=$ReportPath+'.startup';if(Test-Path -LiteralPath $root){throw 'Preserve prior startup fixture'};[void](New-Item -ItemType Directory -Path $root)
$before=(Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($before -cne 'd8f0aa7e0b7fcf72cb2401808f45c2cdb69cd99862ad14c88103180b86278210'){throw 'Exact reviewed startup worker required'}
$source=[IO.File]::ReadAllText($ScriptPath)
$oldSource=$source.Replace('$script:referenceNameModeEnabled','$script:referenceNameEdit')
$sha=[Security.Cryptography.SHA256]::Create();try{$oldHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($oldSource)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
if($oldHash -cne '641c30e6dc9e3e89bae814c752e4fbc1bea41d8318b4f8a0af7e863434466060'){throw 'Old whole-worker inverse differs'}
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
$inputPath=Join-Path $root 'synthetic-length-fixture.pptx';[IO.File]::WriteAllBytes($inputPath,[Array]::CreateInstance([byte],129025));$inputHash=(Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
$sourceHash='06c82deb1dbe067d4f097aebe760b8f1dbdcc0e2a74e95b8d1f99eeea2302a83';if($inputHash -ceq $sourceHash){throw 'Synthetic input must not impersonate the sealed archive'}
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
[ordered]@{schemaVersion=1;powerShellEdition=$PSVersionTable.PSEdition;powerShellVersion=$PSVersionTable.PSVersion.ToString();scope='Actual ParamBlock and two exact pre-COM startup statements only';earlierFullSourceBootstrapExercised=$false;syntheticLengthFixture=$true;genuineArchive=$false;officeConstructed=$false;processQueries=0;observerIO=0;workerSha256=$before;oldInverseSha256=$oldHash;cases=$rows}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $ReportPath -Encoding UTF8
