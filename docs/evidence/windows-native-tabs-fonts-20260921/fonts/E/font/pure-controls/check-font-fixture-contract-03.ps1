$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$worker=Join-Path $root 'sources/opf-pptx/test/native-font-edit.ps1'
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$errors)
if($errors.Count) {throw 'Font worker parse failed'}
$definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true))
foreach($name in @('Get-FontEditSha256','Assert-FontEditHash','Read-FontEditGeneration','Read-FontEditRegistrations')) {
  $matches=@($definitions | Where-Object {$_.Name -ceq $name})
  if($matches.Count -ne 1) {throw 'Expected one actual helper definition'}
  Invoke-Expression $matches[0].Extent.Text
}
$fixtureRoot=(Resolve-Path -LiteralPath (Join-Path $root 'font-edit-fixture-generator-03')).Path
$fixture=Read-FontEditGeneration $fixtureRoot (Join-Path $fixtureRoot 'source.pptx')
$registrations=Read-FontEditRegistrations (Join-Path $root 'native-font-edit-01/font-registration.json')
if($fixture.fontFiles.Count -ne 4 -or $registrations.Count -ne 4) {throw 'Expected four independent font records'}
foreach($face in $registrations) {if($face.added -ne 1 -or -not $face.removed) {throw 'Owned registration did not clean up'}}
[ordered]@{passed=$true;officeOrFontCalls=0;fixtureContractPassed=$true;registrationArrayCount=$registrations.Count;workerSha256=(Get-FontEditSha256 $worker)} | ConvertTo-Json

