$ErrorActionPreference='Stop'
$tokens=$null;$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile('C:/opf-work/sh25-chart-points/packages/pptx/test/native-furniture-control.ps1',[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -ne 0){throw 'Parse failure'}
foreach($name in @('Test-Integer','Require-Property','Assert-String','Read-AndValidateActionPlan')){
 $node=$ast.Find({param($item)$item -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq $name},$true)
 Invoke-Expression $node.Extent.Text
}
$results=@()
foreach($field in @('op','slideIndex','shapeName','text')){
 $plan=[ordered]@{op='set-text';slideIndex=1;shapeName='Exact ring';text='Words'}
 $plan[$field]=@($plan[$field])
 $file='C:/opf-work/sh25-common-legacy-before-'+$field+'.json'
 [IO.File]::WriteAllText($file,(ConvertTo-Json -InputObject @($plan) -Compress -Depth 5))
 $accepted=$true;try{$null=Read-AndValidateActionPlan $file}catch{$accepted=$false}
 $results+=@([ordered]@{field=$field;singletonArrayAccepted=$accepted})
 if(-not $accepted){throw ('Expected defect did not reproduce: '+$field)}
}
[ordered]@{source='e0bc1ad9880a6c1477d7659cc772055a51043b16 plus point-only strict guards';officeCalls=0;legacySingletonArrayDefects=$results}|ConvertTo-Json -Depth 6
