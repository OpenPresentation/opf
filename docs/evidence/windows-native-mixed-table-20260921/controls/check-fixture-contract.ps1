$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSCommandPath
$worker=Join-Path $root 'mixed-table-worker-01/native-mixed-table-observe.ps1'
$tokens=$null; $parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -ne 0){throw 'PS5 parse failed'}
foreach($name in @('ExpectedSourceSha256','ExpectedFontGenerationSha256','ExpectedProcessHelperSha256','ExpectedFontHelperSha256')){
  $assignments=@($ast.EndBlock.Statements | Where-Object {$_ -is [System.Management.Automation.Language.AssignmentStatementAst] -and $_.Left.Extent.Text -ceq ('$'+$name)})
  if($assignments.Count -ne 1){throw "Missing or duplicate constant: $name"}
  Invoke-Expression $assignments[0].Extent.Text
}
foreach($name in @('Get-MixedTableSha256','Assert-MixedTableHash','Read-MixedTableTableFixture','Read-MixedTableFontFixture')){
  $definitions=@($ast.EndBlock.Statements | Where-Object {$_ -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -ceq $name})
  if($definitions.Count -ne 1){throw "Missing or duplicate validator: $name"}
  Invoke-Expression $definitions[0].Extent.Text
}
$tableRoot=(Resolve-Path -LiteralPath (Join-Path $root 'R/mixed-table-registry-01')).Path
$fontRoot=(Resolve-Path -LiteralPath (Join-Path $root 'font-edit-fixture-01')).Path
$table=Read-MixedTableTableFixture $tableRoot (Join-Path $tableRoot 'source.pptx')
$fonts=Read-MixedTableFontFixture $fontRoot
$result=[ordered]@{passed=$true;officeCalls=0;fontRegistrationCalls=0;hostVersion=$PSVersionTable.PSVersion.ToString();workerSha256=(Get-MixedTableSha256 $worker);tableFiles=$table.files.Count;sourceRunCount=$table.sourceRuns.Count;sourceTextLength=$table.text.Length;fontFaceCount=$fonts.fontFiles.Count;sourceSha256=(Get-MixedTableSha256 $table.sourcePath);fontGenerationSha256=(Get-MixedTableSha256 $fonts.generationPath)}
$result | ConvertTo-Json -Depth 8
