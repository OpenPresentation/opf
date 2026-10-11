param([string]$ScriptPath='',[Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop'
if($ScriptPath -eq '') { $ScriptPath=Join-Path $PSScriptRoot 'native-picture-control.ps1' }
if(Test-Path -LiteralPath $ReportPath) { throw 'Preserve the existing control report and select a fresh ReportPath' }
$tokens=$null
$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($ScriptPath,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -ne 0) { throw ($parseErrors | Out-String) }
$functionAst=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-ControlCom'},$true)
if($null -eq $functionAst) { throw 'No stage wrapper found' }
# Execute only the reviewed pure wrapper, never the script's Office entrypoint.
Invoke-Expression $functionAst.Extent.Text
$script:officeOperationsStopped=$false
$script:cleanupConfirmed=$true
$script:events=New-Object 'System.Collections.Generic.List[string]'
function Write-ControlStage([string]$Name,[string]$Status,[string]$ErrorMessage=$null) {
    $script:events.Add($Name + ':' + $Status)
}
$empty=New-Object 'System.Collections.Generic.List[string]'
$populated=New-Object 'System.Collections.Generic.List[string]'
$populated.Add('first')
$populated.Add('second')
$observedEmpty=Invoke-ControlCom 'empty' { return ,$empty }
$observedPopulated=Invoke-ControlCom 'populated' { return ,$populated }
if(-not [object]::ReferenceEquals($empty,$observedEmpty)) { throw 'Empty collection identity was lost' }
if(-not [object]::ReferenceEquals($populated,$observedPopulated)) { throw 'Populated collection identity was lost' }
$failureCaught=$false
try { Invoke-ControlCom 'controlled-error' { throw 'Deliberate non-Office failure' } } catch { $failureCaught=$true }
if(-not $failureCaught -or -not $script:officeOperationsStopped -or $script:cleanupConfirmed) { throw 'Failure latch was not retained' }
$script:unexpectedCall=$false
try { Invoke-ControlCom 'forbidden-followup' { $script:unexpectedCall=$true } } catch { }
if($script:unexpectedCall) { throw 'Operation ran after the failure latch' }
@{
    passed=$true
    scope='PowerShell parse, collection identity and fail-closed stage wrapper. No Office object was constructed.'
    powershell=$PSVersionTable.PSVersion.ToString()
    verifierSha256=(Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
    checkerSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    events=@($script:events.ToArray())
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Output 'Parse and independent non-Office stage controls passed.'
