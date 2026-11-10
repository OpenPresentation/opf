param(
 [Parameter(Mandatory=$true)][string]$WorkerFile,
 [Parameter(Mandatory=$true)][string]$BaseWorker,
 [Parameter(Mandatory=$true)][string]$InputFile,
 [Parameter(Mandatory=$true)][string]$OriginalFile,
 [Parameter(Mandatory=$true)][string]$FixtureReceipt,
 [Parameter(Mandatory=$true)][string]$ReportPath
)
# Managed/.NET ZIP/XML and AST-extracted pure input guards only. No worker entrypoint or Office construction.
$ErrorActionPreference='Stop';Add-Type -AssemblyName System.IO.Compression.FileSystem
$oldSha='4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2';$baseAllowed='4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2';$baseSha='51cb21003f058bd401669458e6f0afdd0acd899fdd54c4ee529595a32f5e65b9'
$fixture=Get-Content -LiteralPath $FixtureReceipt -Raw -Encoding UTF8|ConvertFrom-Json
$parent=Split-Path -Parent ([IO.Path]::GetFullPath($ReportPath));if(-not(Test-Path -LiteralPath $parent -PathType Container)){throw 'Existing owned report parent required'};if(Test-Path -LiteralPath $ReportPath){throw 'Fresh managed report required'}
$cases=[Collections.Generic.List[string]]::new();$passed=$false;$failure=$null;$work=Join-Path $parent ('pure-input-'+[Guid]::NewGuid().ToString('N'));[void](New-Item -ItemType Directory -Path $work)
function Bytes-Sha([byte[]]$Bytes){$hasher=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($hasher.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$hasher.Dispose()}}
function Read-ZipBytes($Entry){$stream=$Entry.Open();$memory=[IO.MemoryStream]::new();try{$stream.CopyTo($memory);return ,$memory.ToArray()}finally{$stream.Dispose();$memory.Dispose()}}
function Read-Xml([string]$Text){$settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null;$settings.MaxCharactersInDocument=8388608;$reader=[Xml.XmlReader]::Create([IO.StringReader]::new($Text),$settings);$doc=[Xml.XmlDocument]::new();$doc.XmlResolver=$null;try{$doc.Load($reader)}finally{$reader.Dispose()};return ,$doc}
function Assert-SameXml($A,$B,[string]$Path){
 if($A.NodeType -ne $B.NodeType -or -not [string]::Equals($A.NamespaceURI,$B.NamespaceURI,[StringComparison]::Ordinal) -or -not [string]::Equals($A.LocalName,$B.LocalName,[StringComparison]::Ordinal)){throw ('Different node identity '+$Path)}
 if($A.NodeType -eq [Xml.XmlNodeType]::Element){$left=[Collections.Generic.SortedDictionary[string,string]]::new([StringComparer]::Ordinal);$right=[Collections.Generic.SortedDictionary[string,string]]::new([StringComparer]::Ordinal);foreach($attr in $A.Attributes){if($attr.NamespaceURI -cne 'http://www.w3.org/2000/xmlns/'){$left.Add($attr.NamespaceURI+'|'+$attr.LocalName,$attr.Value)}};foreach($attr in $B.Attributes){if($attr.NamespaceURI -cne 'http://www.w3.org/2000/xmlns/'){$right.Add($attr.NamespaceURI+'|'+$attr.LocalName,$attr.Value)}};if($left.Count -ne $right.Count){throw ('Different attribute count '+$Path)};foreach($key in $left.Keys){if(-not $right.ContainsKey($key) -or -not [string]::Equals($left[$key],$right[$key],[StringComparison]::Ordinal)){throw ('Different attribute '+$Path+'/'+$key)}}
 }elseif(-not [string]::Equals($A.Value,$B.Value,[StringComparison]::Ordinal)){throw ('Different node text/value '+$Path)}
 if($A.ChildNodes.Count -ne $B.ChildNodes.Count){throw ('Different child count '+$Path)};for($i=0;$i -lt $A.ChildNodes.Count;$i++){Assert-SameXml $A.ChildNodes.Item($i) $B.ChildNodes.Item($i) ($Path+'/'+$i)}
}
try{
 if((Get-FileHash -LiteralPath $BaseWorker -Algorithm SHA256).Hash.ToLowerInvariant() -cne $baseSha){throw 'Wrong immutable base worker'}
 if((Get-FileHash -LiteralPath $WorkerFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $fixture.derivedWorker.sha256){throw 'Wrong derived worker'}
 if((Get-FileHash -LiteralPath $InputFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $fixture.proof.mutantSha256){throw 'Wrong mutant input'}
 if((Get-FileHash -LiteralPath $OriginalFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $oldSha){throw 'Wrong original input'}
 $baseText=[IO.File]::ReadAllText($BaseWorker);$workerText=[IO.File]::ReadAllText($WorkerFile);$newSha=[string]$fixture.proof.mutantSha256
 if(([regex]::Matches($workerText,[regex]::Escape($newSha))).Count -ne 1 -or $workerText.Replace($newSha,$baseAllowed) -cne $baseText){throw 'Derived worker changes more than one allowlist hash'}
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($WorkerFile,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Derived worker parse refusal'}
 foreach($name in @('Get-FurnitureSha256','Get-FurnitureSurveySlideCount','Assert-FurnitureProofingInput')){$functions=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true));if($functions.Count -ne 1){throw 'Pure function identity refused'};Invoke-Expression $functions[0].Extent.Text}
 $old=[IO.Compression.ZipFile]::OpenRead($OriginalFile);$new=[IO.Compression.ZipFile]::OpenRead($InputFile)
 try{
  if($old.Entries.Count -ne 147 -or $new.Entries.Count -ne 147){throw 'Exactly147 parts required'};$changed=@();$oldXml=$null;$newXml=$null
  for($index=0;$index -lt 147;$index++){$a=$old.Entries[$index];$b=$new.Entries[$index];if($a.FullName -cne $b.FullName){throw 'ZIP entry names/order changed'};$aBytes=Read-ZipBytes $a;$bBytes=Read-ZipBytes $b;if((Bytes-Sha $aBytes) -cne (Bytes-Sha $bBytes)){$changed+=@($a.FullName)};if($a.FullName -ceq 'ppt/slides/slide1.xml'){$oldXml=[Text.Encoding]::UTF8.GetString($aBytes);$newXml=[Text.Encoding]::UTF8.GetString($bBytes)}}
  if($changed.Count -ne 1 -or $changed[0] -cne 'ppt/slides/slide1.xml'){throw 'Unrelated ZIP part differs'}
 }finally{$old.Dispose();$new.Dispose()}

 $rawShapes=[regex]::Matches($oldXml,'<p:sp(?:\s[^>]*)?>[\s\S]*?</p:sp>');$bad=@($rawShapes|Where-Object {$_.Value.Contains('name="OPF list slides.0.items line 0"')});$good=@($rawShapes|Where-Object {$_.Value.Contains('name="OPF list slides.0.items line 1"')});if($bad.Count -ne 1 -or $good.Count -ne 1){throw 'Unique bad/donor shapes required'}
 $rPrRaw=[regex]::Matches($bad[0].Value,'<a:rPr\b[^>]*>[\s\S]*?</a:rPr>');if($rPrRaw.Count -ne 1){throw 'Unique target run properties required'};$insertion='<a:rtl val="0"/>';$offset=$bad[0].Index+$rPrRaw[0].Index+$rPrRaw[0].Length-'</a:rPr>'.Length;$expectedXml=$oldXml.Substring(0,$offset)+$insertion+$oldXml.Substring($offset);if($newXml -cne $expectedXml){throw 'Not exactly one bounded run-boolean insertion'}
 $oldDoc=Read-Xml $oldXml;$newDoc=Read-Xml $newXml;$ns=[Xml.XmlNamespaceManager]::new($newDoc.NameTable);$ns.AddNamespace('p','http://schemas.openxmlformats.org/presentationml/2006/main');$ns.AddNamespace('a','http://schemas.openxmlformats.org/drawingml/2006/main')
 if($newDoc.DocumentElement.NamespaceURI -cne 'http://schemas.openxmlformats.org/presentationml/2006/main'){throw 'Unexpected presentation namespace'}
 $target=$newDoc.SelectNodes('//p:sp[p:nvSpPr/p:cNvPr[@name="OPF list slides.0.items line 0"]]/p:txBody/a:p',$ns);if($target.Count -ne 1){throw 'Unique target paragraph required'};$runs=$target[0].SelectNodes('a:r',$ns);if($runs.Count -ne 1){throw 'One target run required'};$rPr=$runs[0].SelectSingleNode('a:rPr',$ns);$rtl=$rPr.SelectNodes('a:rtl',$ns);if($rtl.Count -ne 1 -or $rtl[0].GetAttribute('val') -cne '0' -or $rtl[0].Attributes.Count -ne 1 -or $rtl[0].ChildNodes.Count -ne 0){throw 'Exactly one false boolean required'}
 $children=@($rPr.ChildNodes|Where-Object {$_.NodeType -eq [Xml.XmlNodeType]::Element}|ForEach-Object LocalName);if(($children -join ',') -cne 'solidFill,latin,cs,rtl'){throw 'Run property child order changed'}
 if($rPr.GetAttribute('lang') -cne 'ar-SA' -or $rPr.GetAttribute('altLang') -cne 'en-US'){throw 'Primary/alternate language changed'};$text=$runs[0].SelectSingleNode('a:t',$ns).InnerText;if($text.Length -ne 69 -or $text -cne 'Item 1: Customers told us onboarding took too long, so we rebuilt it '){throw 'Target UTF16 context changed'}
 $number=$target[0].SelectNodes('a:pPr/a:buAutoNum',$ns);if($number.Count -ne 1 -or $number[0].GetAttribute('type') -cne 'arabicPeriod' -or $target[0].SelectNodes('a:pPr/a:buNone',$ns).Count -ne 0){throw 'Original automatic numbering not preserved'}
 $expected=$oldDoc.CloneNode($true);$expectedNs=[Xml.XmlNamespaceManager]::new($expected.NameTable);$expectedNs.AddNamespace('p','http://schemas.openxmlformats.org/presentationml/2006/main');$expectedNs.AddNamespace('a','http://schemas.openxmlformats.org/drawingml/2006/main');$expectedRPr=$expected.SelectSingleNode('//p:sp[p:nvSpPr/p:cNvPr[@name="OPF list slides.0.items line 0"]]/p:txBody/a:p/a:r/a:rPr',$expectedNs);$newBoolean=$expected.CreateElement('a','rtl','http://schemas.openxmlformats.org/drawingml/2006/main');$newBoolean.SetAttribute('val','0');[void]$expectedRPr.AppendChild($newBoolean);Assert-SameXml $expected $newDoc '/'
 $oldNs=[Xml.XmlNamespaceManager]::new($oldDoc.NameTable);$oldNs.AddNamespace('a','http://schemas.openxmlformats.org/drawingml/2006/main');$oldTexts=$oldDoc.SelectNodes('//a:t',$oldNs);$newTexts=$newDoc.SelectNodes('//a:t',$ns);if($oldTexts.Count -ne $newTexts.Count){throw 'Text node count changed'};for($index=0;$index -lt $oldTexts.Count;$index++){if(-not [string]::Equals($oldTexts[$index].InnerText,$newTexts[$index].InnerText,[StringComparison]::Ordinal)){throw 'UTF16 text changed'}}
 $cases.Add('independent-dotnet147parts146exact-one-run-boolean-fulltree-UTF16')
 Assert-FurnitureProofingInput $InputFile @() $true $false;$cases.Add('exact-mutant-accepted')
 $changed=Join-Path $work 'appended.pptx';$sourceBytes=[IO.File]::ReadAllBytes($InputFile);[IO.File]::WriteAllBytes($changed,([byte[]]($sourceBytes+@(0))));$wrong=Join-Path $work 'same-bytes.zip';[IO.File]::WriteAllBytes($wrong,$sourceBytes)
 if((Get-FurnitureSurveySlideCount $changed) -ne 1){throw 'Changed-hash counterexample must remain a valid one-slide ZIP'}
 foreach($mode in @('original09-refused','changed-hash','wrong-extension','null-actions','edit-actions','fonts-disabled','survey')){$refused=$false;try{switch($mode){'original09-refused'{Assert-FurnitureProofingInput $OriginalFile @() $true $false};'changed-hash'{Assert-FurnitureProofingInput $changed @() $true $false};'wrong-extension'{Assert-FurnitureProofingInput $wrong @() $true $false};'null-actions'{Assert-FurnitureProofingInput $InputFile $null $true $false};'edit-actions'{Assert-FurnitureProofingInput $InputFile @([pscustomobject]@{op='set-text'}) $true $false};'fonts-disabled'{Assert-FurnitureProofingInput $InputFile @() $false $false};'survey'{Assert-FurnitureProofingInput $InputFile @() $true $true}}}catch{$refused=$true};if(-not $refused){throw ('Accepted '+$mode)};$cases.Add($mode)}
 $passed=$true
}catch{$failure=$_.Exception.Message;throw}finally{[ordered]@{passed=$passed;failure=$failure;officeConstructed=$false;workerEntrypointExecuted=$false;cases=@($cases.ToArray());mutantSha256=$fixture.proof.mutantSha256;derivedWorkerSha256=$fixture.derivedWorker.sha256;scope='Independent .NET ZIP/XML and actual AST-extracted pure input guards only; no Office/ValidateOnly/native/export.'}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $ReportPath -Encoding UTF8}
Write-Output ('PASS managed-only run-boolean discriminator input controls: '+$cases.Count)
