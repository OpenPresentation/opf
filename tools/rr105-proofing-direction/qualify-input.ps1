param([Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop';$here=$PSScriptRoot;$e=$null;$t=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $here 'worker-package/test/native-furniture-control.ps1'),[ref]$t,[ref]$e)
if($e.Count){throw ($e|Out-String)}
foreach($name in @('Get-FurnitureSha256','Get-FurnitureSurveySlideCount','Assert-FurnitureProofingInput')){$f=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$true));if($f.Count -ne 1){throw 'Function identity failure'};Invoke-Expression $f[0].Extent.Text}
$parent=Split-Path -Parent ([IO.Path]::GetFullPath($ReportPath));if(-not(Test-Path $parent)){[void](New-Item -ItemType Directory -Path $parent)};if(Test-Path $ReportPath){throw 'Preserve existing input report'}
$work=Join-Path $parent ('input-'+[Guid]::NewGuid().ToString('N'));[void](New-Item -ItemType Directory -Path $work)
$stream=[IO.File]::OpenRead((Join-Path $here 'original09.pptx.gz'));try{$gzip=[IO.Compression.GZipStream]::new($stream,[IO.Compression.CompressionMode]::Decompress);$out=[IO.MemoryStream]::new();try{$gzip.CopyTo($out);$bytes=$out.ToArray()}finally{$gzip.Dispose();$out.Dispose()}}finally{$stream.Dispose()}
$input=Join-Path $work 'original09.pptx';[IO.File]::WriteAllBytes($input,$bytes)
if((Get-FurnitureSha256 $input) -cne '4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2'){throw 'Original09 bytes changed'}
$cases=[Collections.Generic.List[string]]::new();$passed=$false
try{
 Assert-FurnitureProofingInput $input @() $true $false;$cases.Add('exact-original09-accepted-office-free')
 $changed=Join-Path $work 'changed.pptx';[IO.File]::WriteAllBytes($changed,([byte[]]($bytes+@(0))))
 if((Get-FurnitureSurveySlideCount $changed) -ne 1){throw 'Counterexample must remain a valid one-slide ZIP'}
 $wrong=Join-Path $work 'wrong.zip';[IO.File]::WriteAllBytes($wrong,$bytes)
 foreach($mode in @('changed-valid-archive','wrong-extension','null-actions','edit-actions','fonts-disabled','survey')){$rejected=$false;try{switch($mode){'changed-valid-archive'{Assert-FurnitureProofingInput $changed @() $true $false};'wrong-extension'{Assert-FurnitureProofingInput $wrong @() $true $false};'null-actions'{Assert-FurnitureProofingInput $input $null $true $false};'edit-actions'{Assert-FurnitureProofingInput $input @([pscustomobject]@{op='set-text'}) $true $false};'fonts-disabled'{Assert-FurnitureProofingInput $input @() $false $false};'survey'{Assert-FurnitureProofingInput $input @() $true $true}}}catch{$rejected=$true};if(-not $rejected){throw "Accepted $mode"};$cases.Add('refuse-'+$mode)}
 $passed=$true
}finally{[ordered]@{passed=$passed;officeConstructed=$false;workerEntrypointExecuted=$false;cases=@($cases.ToArray());scope='ZIP directory/hash and pure input preconditions only. Temporary bytes are exact copies or explicit mutants, never new exports.'}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $ReportPath -Encoding UTF8}
Write-Output ('PASS pure input controls: '+$cases.Count)