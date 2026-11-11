$ErrorActionPreference='Stop'
# Import only the actual writer AST. Do not evaluate the worker, COM functions,
# launcher, process helper, Office creation, process discovery or cleanup logic.
if($PSVersionTable.PSVersion.Major -ne 5) { throw 'This control requires Windows PowerShell5' }
$source=Join-Path $PSScriptRoot '../../packages/pptx/test/native-furniture-control.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0) { throw ($errors | Out-String) }
$definitions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Write-FurnitureStage'},$true))
if($definitions.Count -ne 1) { throw 'Missing/duplicate real stage writer' }
Invoke-Expression $definitions[0].Extent.Text
$root=Join-Path ([IO.Path]::GetTempPath()) ('opf-b07-stage-wire-'+[guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $root)
try {
    $script:sequence=0;$script:lastStage='';$script:lastStatus=''
    $script:cleanupConfirmed=$true;$script:officeOperationsStopped=$false;$script:ownedPresentationPath=$null
    $stageFile=Join-Path $root 'stages.jsonl';$progressFile=Join-Path $root 'progress.json'
    Write-FurnitureStage 'synthetic.default' 'begin'
    Write-FurnitureStage 'synthetic.default' 'success'
    Write-FurnitureStage 'synthetic.explicit-null' 'begin' $null
    Write-FurnitureStage 'synthetic.explicit-null' 'success' $null
    Write-FurnitureStage 'synthetic.explicit-empty' 'begin' ''
    Write-FurnitureStage 'synthetic.explicit-empty' 'success' ''
    Write-FurnitureStage 'worker.complete' 'success'
    $success=[IO.File]::ReadAllBytes($stageFile)
    $stageFile=Join-Path $root 'fault-stages.jsonl';$script:sequence=0
    $script:cleanupConfirmed=$false;$script:officeOperationsStopped=$true
    Write-FurnitureStage 'synthetic.failure' 'error' 'synthetic COM failure'
    $fault=[IO.File]::ReadAllBytes($stageFile)
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try { $sourceHash=([BitConverter]::ToString($algorithm.ComputeHash([IO.File]::ReadAllBytes($source)))).Replace('-','').ToLowerInvariant() } finally { $algorithm.Dispose() }
    [ordered]@{schemaVersion=1;hostMajor=$PSVersionTable.PSVersion.Major;stagesBase64=[Convert]::ToBase64String($success);faultStagesBase64=[Convert]::ToBase64String($fault);writerSourceSha256=$sourceHash;nativeAcceptance=$false;scope='Actual writer serialization only; no Office or lifecycle execution'} | ConvertTo-Json -Compress
} finally {
    if((Split-Path -Leaf $root) -cnotmatch '^opf-b07-stage-wire-[a-f0-9]{32}$') { throw 'Wrong owned synthetic temporary root' }
    Remove-Item -LiteralPath $root -Recurse -Force
}
