param(
    [string]$WorkerPath=(Join-Path $PSScriptRoot '..\native-font-inventory-worker-02\native-font-inventory.ps1'),
    [string]$RegistrationPath=(Join-Path $PSScriptRoot '..\native-font-inventory-01\font-registration.json'),
    [string]$OutputPath=(Join-Path $PSScriptRoot 'worker02-parser-check.json')
)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $OutputPath) { throw 'Preserve the existing parser check' }
$worker=(Resolve-Path -LiteralPath $WorkerPath).Path
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw $errors[0].Message }
$definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]},$true))
foreach($name in @('ConvertFrom-InventoryRegistrationJson','Test-InventoryFontCleanup')) {
    $definition=@($definitions | Where-Object {$_.Name -ceq $name})
    if($definition.Count -ne 1) { throw "Expected one $name" }
    Invoke-Expression $definition[0].Extent.Text
}
$rows=ConvertFrom-InventoryRegistrationJson (Get-Content -LiteralPath $RegistrationPath -Raw -Encoding UTF8)
$actualPass=Test-InventoryFontCleanup $rows
$fewerPass=Test-InventoryFontCleanup $rows[0..2]
$emptyPass=Test-InventoryFontCleanup (ConvertFrom-InventoryRegistrationJson '[]')
$savedRemoved=$rows[2].removed; $rows[2].removed=$false; $failedRemovalPass=Test-InventoryFontCleanup $rows; $rows[2].removed=$savedRemoved
$savedAdded=$rows[1].added; $rows[1].added=0; $zeroAddPass=Test-InventoryFontCleanup $rows; $rows[1].added=$savedAdded
if($rows.Count -ne 4 -or -not $actualPass -or $fewerPass -or $emptyPass -or $failedRemovalPass -or $zeroAddPass) { throw 'Corrected parser/helper acceptance differs' }
$result=[ordered]@{kind='worker02-registration-parser-delta-check';hostVersion=$PSVersionTable.PSVersion.ToString();officeOrFontCalls=0;workerSha256=(Get-FileHash -LiteralPath $worker -Algorithm SHA256).Hash.ToLowerInvariant();actualRawRowCount=$rows.Count;actualRawCleanupPassed=$actualPass;fewerRejected=(-not $fewerPass);emptyRejected=(-not $emptyPass);failedRemovalRejected=(-not $failedRemovalPass);zeroAdditionRejected=(-not $zeroAddPass)}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
$result | ConvertTo-Json -Compress
