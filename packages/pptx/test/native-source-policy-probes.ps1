param(
    [Parameter(Mandatory=$true)][string]$HarnessPath,
    [Parameter(Mandatory=$true)][string]$AssertFunction,
    [Parameter(Mandatory=$true)][string]$ProbeDirectory
)
# Offline driver for the source-policy probe controls. It loads one harness's function definitions and literal
# $script: policy lists without running the harness, then runs that harness's AST policy function on every probe copy
# in -ProbeDirectory and prints {probe: rejection message or null} as JSON. No Office, COM or font API is used.
$ErrorActionPreference='Stop'
$tokens=$null; $parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($HarnessPath,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -ne 0) { throw "Harness parse failed: $($parseErrors[0].Message)" }
foreach($statement in $ast.EndBlock.Statements) {
    $isFunction=$statement -is [System.Management.Automation.Language.FunctionDefinitionAst]
    $isLiteralList=$statement -is [System.Management.Automation.Language.AssignmentStatementAst] -and $statement.Left.Extent.Text -like '$script:*' -and $statement.Right -is [System.Management.Automation.Language.CommandExpressionAst] -and $statement.Right.Expression -is [System.Management.Automation.Language.ArrayExpressionAst]
    if($isFunction -or $isLiteralList) { . ([scriptblock]::Create($statement.Extent.Text)) }
}
$results=[ordered]@{}
foreach($probe in @(Get-ChildItem -LiteralPath $ProbeDirectory -Filter '*.ps1' | Sort-Object Name)) {
    try { $null=& $AssertFunction $probe.FullName; $results[$probe.BaseName]=$null }
    catch { $results[$probe.BaseName]=$_.Exception.Message }
}
$results | ConvertTo-Json -Depth 3
