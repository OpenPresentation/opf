param([string]$Root)
$ErrorActionPreference='Stop'
$tool='C:/opf-work/lh16-duration/scripts/native-acceptance/setup-fonts-windows.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($tool,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
foreach($name in @('Plain-Path','Hash-File','Suite-File','Read-FontInputs','Font-Names')){
 $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
 Invoke-Expression $definition.Extent.Text
}
Add-Type -AssemblyName System.Drawing
$inputs=@(Read-FontInputs $Root)
$names=@(Font-Names @($inputs.source))
$installed=[Drawing.Text.InstalledFontCollection]::new()
try{$available=@($installed.Families|ForEach-Object{$_.Name})}finally{$installed.Dispose()}
[ordered]@{purePreflightPassed=$true;registeredByAgent=$false;officeInvoked=$false;faces=$inputs.Count;sfntLegacyFamilies=$names;installedFamilyCount=$available.Count;installedRobotoFamilies=@($available|Where-Object{$_ -match '^Roboto($| )'});toolSha256=(Hash-File $tool);suiteSha256=(Hash-File (Join-Path $Root 'suite.json'))}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $Root 'pure-preflight.json') -Encoding UTF8
