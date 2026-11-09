param(
    [Parameter(Mandatory=$true)][string]$ControllerPath,
    [Parameter(Mandatory=$true)][string]$ControllerRoot,
    [Parameter(Mandatory=$true)][string]$ControllerIdentity,
    [Parameter(Mandatory=$true)][string]$GenericRunner,
    [Parameter(Mandatory=$true)][string]$WorkerPath,
    [string]$DenseInput
)
$ErrorActionPreference='Stop'
if([string]::IsNullOrEmpty($DenseInput)) { $DenseInput=Join-Path (Split-Path -Parent $PSCommandPath) 'fixtures/dense-survey/input.pptx' }
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($ControllerPath,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw ($errors | Out-String) }
# Only these pure definitions are evaluated. Never the entrypoint, child launcher,
# native delegate, its supervisor or any Office operation.
foreach($name in @('Assert-DensePlainPath','Assert-DenseControllerBootstrap','Import-DensePureHelpers','Get-DenseWorkerArguments')) {
    $definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
    if($definitions.Count -ne 1) { throw "Missing pure controller definition: $name" }
    Invoke-Expression $definitions[0].Extent.Text
}
$passed=0
function Reject([scriptblock]$Operation,[string]$Pattern) {
    $caught=$false
    try { & $Operation } catch { if($_.Exception.Message -notmatch $Pattern) { throw };$caught=$true }
    if(-not $caught) { throw 'Pure refusal unexpectedly accepted input' }
    $script:passed++
}
$runOffice=@($ast.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -ceq 'RunOffice' })
if($runOffice.Count -ne 1 -or $runOffice[0].StaticType -ne [System.Management.Automation.SwitchParameter] -or $null -ne $runOffice[0].DefaultValue) { throw 'Office must require an explicit switch' }
$passed++
$identity=Get-Content -LiteralPath $ControllerIdentity -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-DenseControllerBootstrap $ControllerRoot $identity;$passed++
$protectedFile=Join-Path $ControllerRoot 'scripts/native-acceptance/dense-survey-contract.mjs'
$original=[IO.File]::ReadAllBytes($protectedFile)
try {
    [IO.File]::AppendAllText($protectedFile,"`n// pure drift control`n")
    Reject { Assert-DenseControllerBootstrap $ControllerRoot $identity } 'clean|code changed'
} finally { [IO.File]::WriteAllBytes($protectedFile,$original) }
$untracked=Join-Path $ControllerRoot 'untracked-pure-control.txt'
try {
    [IO.File]::WriteAllText($untracked,'untracked')
    Reject { Assert-DenseControllerBootstrap $ControllerRoot $identity } 'remain clean'
} finally { Remove-Item -LiteralPath $untracked }
$changed=($identity | ConvertTo-Json -Depth 100 | ConvertFrom-Json);$changed.revision='0'*40
Reject { Assert-DenseControllerBootstrap $ControllerRoot $changed } 'HEAD changed'
Reject { Get-DenseWorkerArguments 'owned.pptx' 'empty.json' 'new-output' 61 } 'timeout'
Reject { Get-DenseWorkerArguments 'owned.pptx' 'empty.json' 'new-output' 4 } 'timeout'
$argsAtCap=@(Get-DenseWorkerArguments 'owned input.pptx' 'empty plan.json' 'new output' 60)
$expected=@('-InputPresentation','owned input.pptx','-ActionPlan','empty plan.json','-OutputDirectory','new output','-TimeoutSeconds','60','-ReadOnlySurvey')
if(($argsAtCap | ConvertTo-Json -Compress) -cne ($expected | ConvertTo-Json -Compress)) { throw 'The delegate arguments changed scope, quoting or timeout' };$passed++
Import-DensePureHelpers $GenericRunner
$parent=Split-Path -Parent $ControllerRoot
$fresh=Join-Path $parent 'fresh-dense-pure-output'
$null=Assert-FreshNativeOutput $fresh @($ControllerRoot);$passed++
[void](New-Item -ItemType Directory -Path $fresh)
try { Reject { Assert-FreshNativeOutput $fresh @($ControllerRoot) } 'prior attempts' } finally { Remove-Item -LiteralPath $fresh }
Reject { Assert-FreshNativeOutput (Join-Path $ControllerRoot 'new-output') @($ControllerRoot) } 'separate'
Import-NativePlanValidation $WorkerPath $true
$empty=@();Assert-FurnitureSurvey $true $empty $DenseInput;$passed++
Reject { Assert-FurnitureSurvey $true @([pscustomobject]@{op='noop'}) $DenseInput } 'empty validated action plan'
# The unchanged generic loader still refuses false eligibility. Its valid input
# control first proves this is the eligibility refusal, not a missing-file error.
$genericAst=[System.Management.Automation.Language.Parser]::ParseFile($GenericRunner,[ref]$tokens,[ref]$errors)
$read=$genericAst.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Read-NativeSuite'},$true)
Invoke-Expression $read.Extent.Text
$suite=Join-Path $parent 'generic-pure-suite';[void](New-Item -ItemType Directory -Path $suite)
$input=Join-Path $suite 'case.pptx';$plan=Join-Path $suite 'actions.json'
[IO.File]::WriteAllBytes($input,[byte[]](1,2,3));[IO.File]::WriteAllText($plan,'[]')
$records=@($input,$plan | ForEach-Object { [ordered]@{path=[IO.Path]::GetFileName($_);bytes=(Get-Item -LiteralPath $_).Length;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()} })
$manifest=[ordered]@{schemaVersion=1;provenance=[ordered]@{testOnly=$true};files=$records;cases=@([ordered]@{id='feature-dense-events';input='case.pptx';actionPlan='actions.json';worker='furniture';automaticControlEligible=$true})}
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $suite 'suite.json') -Encoding UTF8
$null=Read-NativeSuite $suite 'feature-dense-events';$passed++
$manifest.cases[0].automaticControlEligible=$false
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $suite 'suite.json') -Encoding UTF8
Reject { Read-NativeSuite $suite 'feature-dense-events' } 'not eligible'
Write-Host "PASS: $passed pure dense-controller controls; no child worker or Office executed"
