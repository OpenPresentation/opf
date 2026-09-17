param([string]$EvidenceDirectory,[switch]$Worker)
$ErrorActionPreference='Stop';$root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
if(-not $Worker){
 if(Test-Path -LiteralPath (Join-Path $root 'worker.json')){throw 'Use fresh control directory'}
 . (Join-Path $PSScriptRoot '../test/native-process.ps1')
 $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$root,'-Worker') -OutputDirectory $root -TimeoutSeconds 45
 if($result.timedOut -or $result.exitCode -ne 0){throw 'Control stopped; preserve logs and inspect Office'};return
}
$owned=$null;$stage='connect'
try{
 $app=New-Object -ComObject PowerPoint.Application;$stage='create-owned';$owned=$app.Presentations.Add(0);$owned.SaveAs((Join-Path $root 'empty-owned.pptx'),24)
 $stage='add-slide';$slide=$owned.Slides.Add(1,12);$image=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../test/fixtures/images/wide.png')).Path
 $stage='add-picture';$shape=$slide.Shapes.AddPicture($image,0,-1,72,72,720,360)
 $stage='save-owned';$source=Join-Path $root 'native-created.pptx';$owned.SaveAs($source,24);$slide.Export((Join-Path $root 'native.png'),'PNG',1280,720);$owned.Close();$owned=$null
 $stage='reopen-owned';$owned=$app.Presentations.Open($source,0,0,0)
 @{passed=$true;shapes=$owned.Slides.Item(1).Shapes.Count} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'control.json') -Encoding UTF8
}catch{@{stage=$stage;error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'failure.json') -Encoding UTF8;throw}
finally{if($null -ne $owned){$owned.Saved=-1;$owned.Close()}}
