param([Parameter(Mandatory=$true)][string]$ExecutionEnvelope,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedEnvelopeSha256,[Parameter(Mandatory=$true)][string]$NodeExecutable,[Parameter(Mandatory=$true)][string]$OutputDirectory,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedRequestSha256,[switch]$RunOffice)
$ErrorActionPreference='Stop'
# Default path validates only. No Office/process query before explicit RunOffice.
if(-not[IO.Path]::IsPathRooted($ExecutionEnvelope) -or $ExecutionEnvelope.StartsWith('\') -or [IO.Path]::GetFullPath($ExecutionEnvelope) -cne $ExecutionEnvelope){throw 'Local canonical SH21 envelope required'}
$i=Get-Item -LiteralPath $ExecutionEnvelope -Force;if($i.PSIsContainer -or ($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $i.Length -gt 4194304 -or (Get-FileHash -LiteralPath $ExecutionEnvelope -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedEnvelopeSha256){throw 'External SH21 envelope differs'}
$e=Get-Content -LiteralPath $ExecutionEnvelope -Raw -Encoding UTF8|ConvertFrom-Json;$bootstrap=Join-Path $e.controller.directory 'scripts/native-acceptance/sh21-node-shapes-bootstrap.ps1';$record=@($e.controller.files|Where-Object{$_.path -ceq 'scripts/native-acceptance/sh21-node-shapes-bootstrap.ps1'})
if($record.Count -ne 1 -or -not[IO.Path]::IsPathRooted($bootstrap) -or $bootstrap.StartsWith('\') -or [IO.Path]::GetFullPath($bootstrap) -cne $bootstrap -or (Get-Item -LiteralPath $bootstrap).Length -ne $record[0].bytes -or (Get-FileHash -LiteralPath $bootstrap -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record[0].sha256){throw 'SH21 bootstrap differs'}
$cursor=$bootstrap;while($cursor){$item=Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue;if($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased SH21 bootstrap'};$parent=Split-Path -Parent $cursor;if($parent -ceq $cursor){break};$cursor=$parent}
. $bootstrap
$controller=Assert-Sh21ShapesBootstrap $e $NodeExecutable;$output=Assert-Sh21Path $OutputDirectory
if($PSCommandPath -cne (Join-Path $controller 'scripts/native-acceptance/run-sh21-node-shapes.ps1') -or $ExecutionEnvelope -cne (Join-Path $output 'execution-envelope.json')){throw 'Use the actual bound SH21 launcher and snapshot'}
$validator=Join-Path $controller 'scripts/native-acceptance/sh21-node-shapes-profile.mjs';$office=([bool]$RunOffice).ToString().ToLowerInvariant()
$checked=& $NodeExecutable $validator verify-execution --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office $office
if($LASTEXITCODE -ne 0){throw 'SH21 request/source/runtime refused before Office'};$binding=($checked|Out-String)|ConvertFrom-Json;if($binding.requestSha256 -cne $ExpectedRequestSha256){throw 'External SH21 request pin differs'}
if(-not $RunOffice){return}
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'SH21 Office requires separately authorized Windows execution'}
$q=Get-Content -LiteralPath (Join-Path $output 'execution-request.json') -Raw -Encoding UTF8|ConvertFrom-Json;$native=Join-Path $output 'native';if(Test-Path -LiteralPath $native){throw 'Preserve prior SH21 native attempt'};[void](New-Item -ItemType Directory -Path $native)
. (Join-Path $output 'inputs/native-process.ps1')
$terminal=Invoke-OpfNativeWorker -ScriptPath $q.workerPath -WorkerArguments @('-ExecutionEnvelope',$ExecutionEnvelope,'-ExpectedEnvelopeSha256',$ExpectedEnvelopeSha256,'-NodeExecutable',$NodeExecutable,'-OutputDirectory',$native,'-TimeoutSeconds',[string]$q.timeoutSeconds,'-ExpectedRequestSha256',$ExpectedRequestSha256,'-Worker') -OutputDirectory $native -TimeoutSeconds $q.timeoutSeconds
# Only a source-bound, completed zero-action lifecycle may reach the unchanged observer.
$admitted=& $NodeExecutable $validator verify-complete --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
if($LASTEXITCODE -ne 0){throw 'Capability capture failed; preserve all partial observations and fault latch'};$admission=($admitted|Out-String)|ConvertFrom-Json
. (Join-Path $controller 'scripts/native-acceptance/owned-postflight.ps1')
$p=Invoke-Sh21ShapesPostflight -AdmissionFile $admission.path -ExpectedAdmissionSha256 $admission.sha256 -ControllerRoot $controller -NodeExecutable $NodeExecutable -ExecutionEnvelope $ExecutionEnvelope -ExpectedEnvelopeSha256 $ExpectedEnvelopeSha256
$confirmed=($null -eq $p.error -and $null -ne $p.result -and $p.result.observedZero -ceq $true)
[ordered]@{schemaVersion=1;profile=$e.profile;timedOut=$terminal.timedOut;exitCode=$terminal.exitCode;cleanupConfirmed=$confirmed;postflight=$p;geometryAcceptance=$false;nativeAcceptance=$false;registryAcceptance=$false}|ConvertTo-Json -Depth 40|Set-Content -LiteralPath (Join-Path $native 'supervisor.json') -Encoding UTF8
if(-not $confirmed){throw 'Capability postflight failed; no retry'}
& $NodeExecutable $validator observe --envelope $ExecutionEnvelope --sha256 $ExpectedEnvelopeSha256 --output $output --require-office true
if($LASTEXITCODE -ne 0){throw 'Capability final binding refused'}
