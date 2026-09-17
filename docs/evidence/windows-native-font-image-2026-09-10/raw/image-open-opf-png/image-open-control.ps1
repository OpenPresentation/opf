param([string]$EvidenceDirectory,[switch]$Worker)
$ErrorActionPreference='Stop';$root=(Resolve-Path -LiteralPath $EvidenceDirectory).Path
if(-not $Worker){
 if(Test-Path -LiteralPath (Join-Path $root 'worker.json')){throw 'Use fresh control directory'}
 . (Join-Path $PSScriptRoot '../test/native-process.ps1')
 $result=Invoke-OpfNativeWorker -ScriptPath $PSCommandPath -WorkerArguments @('-EvidenceDirectory',$root,'-Worker') -OutputDirectory $root -TimeoutSeconds 45
 if($result.timedOut -or $result.exitCode -ne 0){throw 'Control stopped; preserve logs and inspect Office before further work'};return
}
$owned=$null;$stage='connect'
try{
 $source=Join-Path $root 'source.pptx';$app=New-Object -ComObject PowerPoint.Application
 for($i=1;$i -le $app.Presentations.Count;$i++){if($app.Presentations.Item($i).FullName -eq $source){throw 'Already open, no ownership'}}
 $stage='open';$owned=$app.Presentations.Open($source,0,0,0)
 $count=$owned.Slides.Count;$stage='export';$owned.Slides.Item(1).Export((Join-Path $root 'native.png'),'PNG',1280,720)
 $stage='save';$owned.SaveAs((Join-Path $root 'native-saved.pptx'),24)
 @{passed=$true;slides=$count;sourceSha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'control.json') -Encoding UTF8
}catch{@{stage=$stage;error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'failure.json') -Encoding UTF8;throw}
finally{if($null -ne $owned){$owned.Saved=-1;$owned.Close()}}
